/**
 * Browser-only GEN document helpers.
 * Preserve unknown keys (_raw / metadata) from the Python archive.
 * Never publish sample or user family-data with this public source tree.
 */
export type Document = {
  schema_version: number;
  tree: {id: string; slug: string; name: string; description: string; revision: number; updated_at: string; is_demo?: boolean};
  persons: Record<string, any>[];
  families: Record<string, any>[];
  metadata: Record<string, any>;
};

export function uid(): string {
  return crypto.randomUUID().replace(/-/g, '');
}

export function now(): string {
  return new Date().toISOString();
}

const ru: Record<string, string> = {
  а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ё:'yo',ж:'zh',з:'z',и:'i',й:'y',к:'k',л:'l',
  м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',х:'h',ц:'ts',ч:'ch',ш:'sh',
  щ:'sch',ъ:'',ы:'y',ь:'',э:'e',ю:'yu',я:'ya'
};
export function slugify(value: string): string {
  return [...value.toLowerCase()].map(c => ru[c] ?? c).join('')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0,90) || 'family';
}

/** Legacy sample trees did not have a flag. Recognize only the exact
 * fictional family shipped by the browser, never a tree merely containing
 * the word "пример". Existing user edits and duplicates are never deleted.
 */
export function isDemoDocument(document: Document): boolean {
  if(document.tree.is_demo===true)return true;
  // Title + the shipped description still identifies a legacy sample
  // after someone has edited its people while learning to use the editor.
  if(document.tree.name==='Семья Волковых · пример' &&
     document.tree.description==='Учебное дерево. Все люди и события вымышлены.')return true;
  // A legacy copy may have had its title edited before the marker existed.
  if(document.persons.length!==6||document.families.length!==2)return false;
  const has=(given:string,surname:string)=>
    document.persons.some(p=>p.given_name===given&&p.surname===surname);
  return has('Алексей','Смирнов') && has('Мария','Смирнова') &&
         has('Иван','Смирнов') && has('Наталья','Смирнова') &&
         has('Павел','Смирнов') && has('Анна','Смирнова');
}

export function summary(document: Document) {
  return {
    ...document.tree,
    is_demo:isDemoDocument(document),
    person_count: document.persons.length,
    family_count: document.families.length
  };
}

export function validate(document: Document): void {
  if (!document || document.schema_version !== 1 || !document.tree ||
      !Array.isArray(document.persons) || !Array.isArray(document.families)) {
    throw new Error('Это не документ GEN с поддерживаемой схемой версии 1.');
  }
  if (typeof document.tree.id !== 'string' || !document.tree.id ||
      typeof document.tree.name !== 'string') {
    throw new Error('Не указаны идентификатор и название дерева.');
  }
  if (document.persons.length > 50000 || document.families.length > 50000) {
    throw new Error('Архив слишком большой для текущей версии.');
  }
  const ids = new Set<string>();
  for (const person of document.persons) {
    if (typeof person.id !== 'string' || !person.id || ids.has(person.id)) {
      throw new Error('Повторный или пустой идентификатор человека.');
    }
    ids.add(person.id);
  }
  const familyIds = new Set<string>();
  const children = new Map<string, Set<string>>();
  const inDegree = new Map<string, number>();
  for (const id of ids) { children.set(id, new Set()); inDegree.set(id, 0); }
  for (const family of document.families) {
    if (typeof family.id !== 'string' || !family.id || familyIds.has(family.id)) {
      throw new Error('Повторный или пустой идентификатор семьи.');
    }
    familyIds.add(family.id);
    const parents = [family.partner1_id, family.partner2_id].filter(Boolean) as string[];
    if (!Array.isArray(family.children)) throw new Error('Неверный список детей.');
    const childIds = family.children.map((child: any) => child.person_id);
    const members = [...parents, ...childIds];
    if (members.length !== new Set(members).size || members.some(id => !ids.has(id))) {
      throw new Error('Семья содержит неизвестного человека или повторную связь.');
    }
    for (const parent of parents) {
      for (const child of childIds) {
        if (!children.get(parent)!.has(child)) {
          children.get(parent)!.add(child);
          inDegree.set(child, inDegree.get(child)! + 1);
        }
      }
    }
  }
  const ready = [...inDegree].filter(([, n]) => n === 0).map(([id]) => id);
  let visited = 0;
  for (let i = 0; i < ready.length; i++) {
    const parent = ready[i]; visited++;
    for (const child of children.get(parent)!) {
      inDegree.set(child, inDegree.get(child)! - 1);
      if (!inDegree.get(child)) ready.push(child);
    }
  }
  if (visited !== ids.size) {
    throw new Error('Эта связь создаёт цикл родства: человек стал бы собственным предком.');
  }
}

/** Complete optional schema-v1 fields from older archives without dropping
 * unknown GEDCOM source nodes or other original properties.
 */
export function normalizeDocument<T extends Document>(document:T):T {
  if(!document||!document.tree||!Array.isArray(document.persons)||!Array.isArray(document.families))
    throw new Error('Некорректный JSON семейного дерева.');
  const tree=document.tree as Record<string,any>;
  if(typeof tree.description!=='string')tree.description='';
  if(!Number.isInteger(tree.revision)||tree.revision<1)tree.revision=1;
  if(!tree.updated_at)tree.updated_at=now();
  if(typeof tree.slug!=='string'||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(tree.slug))
    tree.slug=slugify(tree.name||'family')+'-'+String(tree.id||'').slice(0,6);
  for(const person of document.persons){
    for(const field of ['given_name','surname','patronymic','maiden_name','birth_date','birth_place',
      'death_date','death_place','occupation','biography','notes']){
      if(person[field]===undefined||person[field]===null)person[field]='';
    }
    if(!['M','F','U','X'].includes(person.sex))person.sex='U';
    if(typeof person.is_living!=='boolean')person.is_living=!person.death_date;
    if(!['markdown','text'].includes(person.biography_format))person.biography_format='text';
    if(person.events===undefined)person.events=[];
    if(!Array.isArray(person.events))throw new Error('Некорректные события человека.');
    if(!Number.isInteger(person.revision)||person.revision<1)person.revision=1;
    if(typeof person.updated_at!=='string')person.updated_at=now();
  }
  for(const family of document.families){
    for(const field of ['partner1_id','partner2_id'])
      if(family[field]===undefined)family[field]=null;
    for(const field of ['marriage_date','marriage_place','divorce_date','notes'])
      if(family[field]===undefined||family[field]===null)family[field]='';
    if(!Number.isInteger(family.revision)||family.revision<1)family.revision=1;
  }
  if(document.metadata===null||typeof document.metadata!=='object')document.metadata={};
  return document;
}

export function newTree(name: string, description = ''): Document {
  const id = uid();
  const document: Document = {
    schema_version: 1,
    tree: {id, name: name.trim(), description: description.trim(),
      slug: slugify(name) + '-' + id.slice(0, 6), updated_at: now(), revision: 1},
    persons: [], families: [], metadata: {}
  };
  validate(document);
  return document;
}

const personFields = [
  'given_name','surname','patronymic','maiden_name','sex','birth_date','birth_place',
  'death_date','death_place','is_living','occupation','biography','biography_format',
  'notes','events'
];
const familyFields = [
  'partner1_id','partner2_id','children','marriage_date','marriage_place',
  'divorce_date','notes'
];

export function fields(source: Record<string, any>, selected: string[]) {
  return Object.fromEntries(selected.filter(k => Object.hasOwn(source, k)).map(k => [k, source[k]]));
}
export function createPerson(body: Record<string, any>) {
  return {
    given_name:'', surname:'', patronymic:'', maiden_name:'', sex:'U',
    birth_date:'', birth_place:'', death_date:'', death_place:'', is_living:true,
    occupation:'', biography:'', biography_format:'markdown', notes:'', events:[],
    ...fields(body, personFields), id:uid(), gedcom_id:null, revision:1, updated_at:now()
  };
}
export function updatePerson(person: Record<string, any>, body: Record<string, any>) {
  checkRevision(person, body.revision);
  Object.assign(person, fields(body, personFields));
  person.revision = (person.revision || 1) + 1;
  person.updated_at = now();
  return person;
}
export function createFamily(body: Record<string, any>) {
  return {
    partner1_id:null, partner2_id:null, children:[],
    marriage_date:'', marriage_place:'', divorce_date:'', notes:'',
    ...fields(body, familyFields), id:uid(), gedcom_id:null, revision:1
  };
}
export function updateFamily(family: Record<string, any>, body: Record<string, any>) {
  checkRevision(family, body.revision);
  Object.assign(family, fields(body, familyFields));
  family.revision = (family.revision || 1) + 1;
  return family;
}
export function checkRevision(item: Record<string, any>, revision: number | undefined) {
  if (revision !== undefined && item.revision !== revision) {
    throw new Error('Конфликт версий: запись уже изменена. Обновите дерево.');
  }
}

export function addRelative(document: Document, baseId: string, body: Record<string, any>) {
  if (!['parent', 'child', 'partner'].includes(body.relation)) {
    throw new Error('Неизвестный вид родства.');
  }
  const base = document.persons.find(p => p.id === baseId);
  if (!base) throw new Error('Исходный человек не найден.');
  if (Boolean(body.relative_id) === Boolean(body.person)) {
    throw new Error('Укажите нового или существующего родственника.');
  }
  const existing = body.relative_id && document.persons.find(p => p.id === body.relative_id);
  if (body.relative_id && !existing) throw new Error('Родственник не найден.');
  const relative = existing || createPerson(body.person);
  if (relative.id === baseId) throw new Error('Нельзя связать человека с самим собой.');
  let family = body.family_id && document.families.find(f => f.id === body.family_id);
  if (body.family_id && !family) throw new Error('Семья не найдена.');
  if (body.relation === 'partner') {
    if (family) {
      if (![family.partner1_id, family.partner2_id].includes(baseId)) {
        throw new Error('Исходный человек не состоит в указанной семье.');
      }
      const slot = !family.partner1_id ? 'partner1_id' : !family.partner2_id ? 'partner2_id' : null;
      if (!slot) throw new Error('В этой семье оба партнёра уже указаны.');
      family[slot] = relative.id;
      family.revision++;
    } else {
      family = createFamily({partner1_id:baseId, partner2_id:relative.id});
      document.families.push(family);
    }
  } else if (body.relation === 'child') {
    if (!family && !body.create_new_family) {
      const candidates = document.families.filter(f => [f.partner1_id,f.partner2_id].includes(baseId));
      if (candidates.length === 1) family = candidates[0];
    }
    if (family) {
      if (![family.partner1_id, family.partner2_id].includes(baseId)) throw new Error('Родитель не состоит в этой семье.');
      if (family.children.some((c: any) => c.person_id === relative.id)) throw new Error('Ребёнок уже связан с этой семьёй.');
      family.children.push({person_id:relative.id,pedigree:body.pedigree || 'birth'});
      family.revision++;
    } else {
      family = createFamily({partner1_id:baseId,children:[{person_id:relative.id,pedigree:body.pedigree || 'birth'}]});
      document.families.push(family);
    }
  } else {
    if (!family && !body.create_new_family) {
      const candidates = document.families.filter(f =>
        f.children.some((c: any) => c.person_id === baseId) && (!f.partner1_id || !f.partner2_id));
      if (candidates.length === 1) family = candidates[0];
    }
    if (family) {
      if (!family.children.some((c: any) => c.person_id === baseId)) {
        throw new Error('Человек не является ребёнком в выбранной семье.');
      }
      const slot = !family.partner1_id ? 'partner1_id' : !family.partner2_id ? 'partner2_id' : null;
      if (!slot) throw new Error('В этой семье уже есть оба родителя.');
      family[slot] = relative.id;
      family.revision++;
    } else {
      family = createFamily({partner1_id:relative.id,children:[{person_id:baseId,pedigree:body.pedigree || 'birth'}]});
      document.families.push(family);
    }
  }
  if (!existing) document.persons.push(relative);
  validate(document);
  return {person:relative, family};
}
