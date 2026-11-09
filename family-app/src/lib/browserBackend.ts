import {
  addRelative, checkRevision, createFamily, createPerson, newTree, now, slugify,
  summary, uid, updateFamily, updatePerson, validate, type Document
} from './browserModel';
import {
  getSync, listTrees, mutateTree, publicTree, putTree, readTree, removeTree
} from './browserStore';

export class BackendError extends Error {
  constructor(message: string, public status = 400) {super(message);}
}

function input(options: RequestInit): Record<string, any> {
  if (!options.body || options.body instanceof FormData) return {};
  try {return JSON.parse(String(options.body));}
  catch {throw new BackendError('Некорректный JSON запроса.',422);}
}

function person(doc: Document, id: string) {
  const item = doc.persons.find(p => p.id === id);
  if (!item) throw new BackendError('Человек не найден.',404);
  return item;
}
function family(doc: Document, id: string) {
  const item = doc.families.find(f => f.id === id);
  if (!item) throw new BackendError('Семья не найдена.',404);
  return item;
}
function validUpload(file: FormDataEntryValue | null, types: string[], size = 10*1024*1024): File {
  if (!(file instanceof File) || !types.includes(file.type) || file.size > size || file.size === 0) {
    throw new BackendError('Недопустимый формат или размер файла.',422);
  }
  return file;
}
async function publicPerson(id: string, personId: string) {
  const doc = await publicTree(id);
  const item = doc.persons.find(p => (p as Record<string,any>).id === personId);
  if (!item) throw new BackendError('Человек не найден.',404);
  return item;
}
function sampleTree(document: Document) {
  const names = [
    ['Алексей','Смирнов','M','1935'], ['Мария','Смирнова','F','1938'],
    ['Иван','Смирнов','M','1962'], ['Наталья','Смирнова','F','1965'],
    ['Павел','Смирнов','M','1990'], ['Анна','Смирнова','F','1994']
  ];
  const people = names.map(([given_name,surname,sex,birth_date]) => createPerson({
    given_name,surname,sex,birth_date,is_living:sex==='M' && birth_date==='1935'?false:true
  }));
  document.persons.push(...people);
  document.families.push(
    createFamily({partner1_id:people[0].id,partner2_id:people[1].id,
      children:[{person_id:people[2].id,pedigree:'birth'}]}),
    createFamily({partner1_id:people[2].id,partner2_id:people[3].id,
      children:[{person_id:people[4].id,pedigree:'birth'},{person_id:people[5].id,pedigree:'birth'}]})
  );
}

async function importDocument(body: FormData) {
  const file = body.get('file');
  if (!(file instanceof File) || file.size > 25*1024*1024 || !file.size) {
    throw new BackendError('Выберите JSON-файл GEN размером до 25 МБ.',422);
  }
  if (!file.name.toLowerCase().endsWith('.json')) {
    throw new BackendError('На этом этапе поддерживается импорт tree.json GEN. GEDCOM добавим после переноса парсера.',422);
  }
  let archive: Document;
  try {archive = JSON.parse(await file.text()) as Document;}
  catch {throw new BackendError('Не удалось прочитать JSON-файл.',422);}
  validate(archive);
  const existing = await listTrees();
  // Never overwrite a local tree just because an imported archive has the same ID.
  if (existing.some(item => item.id === archive.tree.id)) {
    archive.tree.id = uid();
    archive.tree.slug = slugify(archive.tree.name) + '-' + archive.tree.id.slice(0,6);
  }
  const name = String(body.get('name') || '').trim();
  if (name) archive.tree.name = name.slice(0,150);
  archive.tree.updated_at = now();
  await putTree(archive);
  const warnings = archive.persons.some(p => p._photo || (p._gallery || []).length)
    ? ['JSON импортирован полностью, но фотографии необходимо перенести отдельно из ZIP или GitHub.'] : [];
  return {tree:summary(archive), warnings};
}

export async function browserRequest(path: string, options: RequestInit = {}): Promise<any> {
  const method = (options.method || 'GET').toUpperCase();
  const query = new URL(path,'https://local.gen.invalid');
  const parts = query.pathname.split('/').filter(Boolean);
  const body = input(options);
  if (parts[0] === 'sync') {
    if (method === 'GET' && parts[1] === 'status') {
      return {state:'disabled',message:'Синхронизация GitHub настраивается в редакторе.',
        pending:false,last_sync:null,last_commit:null,conflicts:[]};
    }
    throw new BackendError('Для синхронизации используйте подключение GitHub в новом интерфейсе.',400);
  }
  if (parts[0] !== 'trees') throw new BackendError('Неизвестная операция.',404);
  if (parts.length === 1) {
    if (method === 'GET') return listTrees();
    if (method === 'POST') {
      if (typeof body.name !== 'string' || !body.name.trim()) {
        throw new BackendError('Укажите название дерева.',422);
      }
      const doc = newTree(body.name, body.description || '');
      if (body.demo) sampleTree(doc);
      await putTree(doc);
      return summary(doc);
    }
  }
  if (parts[1] === 'import' && method === 'POST') {
    if (!(options.body instanceof FormData)) throw new BackendError('Загрузите файл.',422);
    return importDocument(options.body);
  }
  const treeId = parts[1];
  if (!treeId) throw new BackendError('Не указано дерево.',404);
  if (parts.length === 2) {
    if (method === 'GET') return publicTree(treeId);
    if (method === 'DELETE') {await removeTree(treeId); return undefined;}
    if (method === 'PATCH') return mutateTree(treeId, doc => {
      checkRevision(doc.tree, body.revision);
      doc.tree.name = String(body.name || '').trim().slice(0,150);
      doc.tree.description = String(body.description || '').slice(0,2000);
      if (!doc.tree.name) throw new BackendError('Название не может быть пустым.',422);
      doc.tree.revision++;
      return summary(doc);
    });
  }
  if (parts[2] === 'storage-status' && method === 'GET') {
    const doc = await readTree(treeId);
    const sync = await getSync(treeId);
    return {
      local_saved_at: doc.tree.updated_at, slug: doc.tree.slug,
      gedcom: {state:'error',message:'GEDCOM-экспорт переносится из Python.',generated_at:null},
      github: {state:sync?'pending':'disabled',message:sync?'Подключён личный репозиторий':'GitHub не подключён',
        pending:Boolean(sync),last_sync:sync?.lastSync || null,last_commit:sync?.lastCommit || null,conflicts:[]}
    };
  }
  if (parts[2] === 'gedcom-status' && method === 'GET') {
    return {state:'error',message:'GEDCOM ещё не подключён.',generated_at:null};
  }
  if (parts[2] === 'rename-directory' && method === 'POST') {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(body.slug) || body.slug.length>100) {
      throw new BackendError('Каталог: латинские буквы, цифры и дефисы.',422);
    }
    return mutateTree(treeId, doc => {
      checkRevision(doc.tree,body.revision);
      doc.tree.slug = body.slug;
      doc.tree.revision++;
      return summary(doc);
    });
  }
  if (parts[2] === 'regenerate-gedcom') {
    throw new BackendError('GEDCOM ещё не подключён в браузерной версии.',501);
  }
  if (parts[2] === 'persons') {
    if (parts.length === 3 && method === 'POST') {
      const p = createPerson(body);
      await mutateTree(treeId,doc=>{doc.persons.push(p);});
      return publicPerson(treeId,p.id);
    }
    const personId = parts[3];
    if (!personId) throw new BackendError('Не указан человек.',404);
    if (parts.length === 4) {
      if (method === 'PUT') {
        await mutateTree(treeId,doc=>{updatePerson(person(doc,personId),body);});
        return publicPerson(treeId,personId);
      }
      if (method === 'DELETE') return mutateTree(treeId,doc=>{
        person(doc,personId);
        doc.persons = doc.persons.filter(p=>p.id!==personId);
        const retained: Document['families'] = [];
        for (const f of doc.families) {
          let changed = false;
          for (const slot of ['partner1_id','partner2_id']) {
            if (f[slot] === personId) {f[slot] = null;changed=true;}
          }
          const children = f.children.filter((c:any)=>c.person_id!==personId);
          if (children.length!==f.children.length) {f.children=children;changed=true;}
          if (changed) f.revision++;
          if (f.partner1_id || f.partner2_id || f.children.length) retained.push(f);
        }
        doc.families=retained;
      });
    }
    if (parts[4] === 'relatives' && method === 'POST') {
      const linked = await mutateTree(treeId,doc=>addRelative(doc,personId,body));
      return {...linked,person:await publicPerson(treeId,linked.person.id)};
    }
    if (parts[4] === 'photo') {
      if (method === 'POST') {
        if (!(options.body instanceof FormData)) throw new BackendError('Фотография не выбрана.',422);
        const file = validUpload(options.body.get('file'),['image/jpeg','image/png','image/webp']);
        const revision = Number(options.body.get('revision'));
        await mutateTree(treeId,(doc, files)=>{
          const p = person(doc,personId);checkRevision(p,revision);
          const filename = uid() + (file.type==='image/png'?'.png':file.type==='image/webp'?'.webp':'.jpg');
          files.put({key:treeId+'/'+filename,blob:file});
          p._photo = {filename,mime_type:file.type};
          p.revision++; p.updated_at=now();
        });
        return publicPerson(treeId,personId);
      }
      if (method === 'DELETE') {
        const revision = Number(query.searchParams.get('revision'));
        await mutateTree(treeId,doc=>{
          const p=person(doc,personId);checkRevision(p,revision);
          delete p._photo;p.revision++;p.updated_at=now();
        });
        return publicPerson(treeId,personId);
      }
    }
    if (parts[4] === 'media') {
      const mediaId = parts[5];
      if (parts.length === 5 && method === 'POST') {
        if (!(options.body instanceof FormData)) throw new BackendError('Файл не выбран.',422);
        const file = validUpload(options.body.get('file'),
          ['image/jpeg','image/png','image/webp','application/pdf']);
        const revision = Number(options.body.get('revision'));
        await mutateTree(treeId,(doc,files)=>{
          const p=person(doc,personId);checkRevision(p,revision);
          const ext=file.type==='application/pdf'?'.pdf':file.type==='image/png'?'.png':file.type==='image/webp'?'.webp':'.jpg';
          const mediaId=uid(),filename=uid()+ext;
          files.put({key:treeId+'/'+filename,blob:file});
          p._gallery ||= [];
          p._gallery.push({id:mediaId,filename,mime_type:file.type,
            caption:String((options.body as FormData).get('caption')||''),date:'',place:'',description:''});
          p.revision++;p.updated_at=now();
        });
        return publicPerson(treeId,personId);
      }
      if (!mediaId) throw new BackendError('Медиафайл не указан.',404);
      if (method === 'PATCH' && parts.length === 6) {
        await mutateTree(treeId,doc=>{
          const p=person(doc,personId);checkRevision(p,body.revision);
          const item=(p._gallery||[]).find((m:any)=>m.id===mediaId);
          if(!item)throw new BackendError('Файл не найден.',404);
          for(const field of ['caption','date','place','description']) {
            if(Object.hasOwn(body,field))item[field]=String(body[field]||'');
          }
          p.revision++;p.updated_at=now();
        });
        return publicPerson(treeId,personId);
      }
      if (method === 'DELETE' && parts.length === 6) {
        await mutateTree(treeId,doc=>{
          const p=person(doc,personId);
          checkRevision(p,Number(query.searchParams.get('revision')));
          if(!(p._gallery||[]).some((m:any)=>m.id===mediaId))throw new BackendError('Файл не найден.',404);
          p._gallery=p._gallery.filter((m:any)=>m.id!==mediaId);
          p.revision++;p.updated_at=now();
        });
        return publicPerson(treeId,personId);
      }
      if (method === 'POST' && parts[6] === 'portrait') {
        await mutateTree(treeId,doc=>{
          const p=person(doc,personId);checkRevision(p,body.revision);
          const item=(p._gallery||[]).find((m:any)=>m.id===mediaId);
          if(!item || !item.mime_type.startsWith('image/'))throw new BackendError('Выберите фотографию.',422);
          p._photo={filename:item.filename,mime_type:item.mime_type};
          p.revision++;p.updated_at=now();
        });
        return publicPerson(treeId,personId);
      }
    }
  }
  if (parts[2] === 'families') {
    if (parts.length === 3 && method === 'POST') {
      const f=createFamily(body);
      await mutateTree(treeId,doc=>{doc.families.push(f);});
      return f;
    }
    const familyId=parts[3];
    if (!familyId) throw new BackendError('Не указана семья.',404);
    if (parts.length === 4 && method === 'PUT') {
      return mutateTree(treeId,doc=>updateFamily(family(doc,familyId),body));
    }
    if (parts.length === 4 && method === 'DELETE') {
      return mutateTree(treeId,doc=>{
        family(doc,familyId);
        doc.families=doc.families.filter(f=>f.id!==familyId);
      });
    }
  }
  throw new BackendError('Операция пока не реализована в браузерной версии.',501);
}
