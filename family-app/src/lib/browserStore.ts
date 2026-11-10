import {type Document, now, summary, validate} from './browserModel';

const DATABASE = 'ayyy-family-v1';
const VERSION = 1;
type TreeRecord = {id: string; document: Document};
type MediaRecord = {key: string; blob: Blob};
type SyncRecord = {
  treeId: string; owner: string; repo: string; branch: string; path: string;
  blobSha?: string; lastCommit?: string; lastSync?: string; lastLocalSavedAt?: string;
};
let opening: Promise<IDBDatabase> | null = null;
const urls = new Map<string, {blob: Blob; url: string}>();

export function openDatabase(): Promise<IDBDatabase> {
  if (!('indexedDB' in window)) return Promise.reject(new Error('Браузер не поддерживает IndexedDB.'));
  if (opening) return opening;
  opening = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE, VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('trees')) db.createObjectStore('trees', {keyPath: 'id'});
      if (!db.objectStoreNames.contains('files')) db.createObjectStore('files', {keyPath: 'key'});
      if (!db.objectStoreNames.contains('sync')) db.createObjectStore('sync', {keyPath: 'treeId'});
    };
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => { db.close(); opening = null; };
      resolve(db);
    };
    request.onerror = () => reject(request.error || new Error('Не удалось открыть IndexedDB.'));
    request.onblocked = () => reject(new Error('Закройте другие вкладки GEN для обновления хранилища.'));
  }).catch(error => {opening = null; throw error;});
  return opening!;
}

function requestValue<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Ошибка IndexedDB.'));
  });
}

export async function listTrees() {
  const db = await openDatabase();
  const rows = await requestValue<TreeRecord[]>(db.transaction('trees','readonly').objectStore('trees').getAll());
  return rows.map(row => summary(row.document)).sort((a,b) => b.updated_at.localeCompare(a.updated_at));
}

export async function readTree(id: string): Promise<Document> {
  const db = await openDatabase();
  const row = await requestValue<TreeRecord | undefined>(db.transaction('trees','readonly').objectStore('trees').get(id));
  if (!row) throw new Error('Дерево не найдено в этом браузере.');
  validate(row.document);
  return row.document;
}

export async function putTree(document: Document) {
  validate(document);
  const db = await openDatabase();
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction('trees','readwrite');
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error || new Error('Не удалось сохранить дерево.'));
    transaction.onerror = () => reject(transaction.error || new Error('Не удалось сохранить дерево.'));
    transaction.objectStore('trees').put({id:document.tree.id, document});
  });
}

/** All edits go through a read/write IndexedDB transaction, including edits from another tab. */
export async function mutateTree<T>(
  treeId: string,
  operation: (document: Document, files: IDBObjectStore) => T
): Promise<T> {
  const db = await openDatabase();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(['trees','files'],'readwrite');
    const trees = tx.objectStore('trees');
    const files = tx.objectStore('files');
    let result: T;
    let failure: Error | null = null;
    tx.oncomplete = () => resolve(result);
    tx.onabort = () => reject(failure || tx.error || new Error('Не удалось изменить дерево.'));
    const lookup = trees.get(treeId);
    lookup.onerror = () => {failure = lookup.error || new Error('Не удалось прочитать дерево.'); tx.abort();};
    lookup.onsuccess = () => {
      if (!lookup.result) {failure = new Error('Дерево не найдено.'); tx.abort(); return;}
      try {
        const document = (lookup.result as TreeRecord).document;
        result = operation(document, files);
        validate(document);
        document.tree.updated_at = now();
        trees.put({id:treeId,document});
      } catch (error) {
        failure = error instanceof Error ? error : new Error('Ошибка изменения дерева.');
        tx.abort();
      }
    };
  });
}

export async function removeTree(treeId: string) {
  const db = await openDatabase();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(['trees','files','sync'],'readwrite');
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error || new Error('Не удалось удалить дерево.'));
    tx.objectStore('trees').delete(treeId);
    tx.objectStore('sync').delete(treeId);
    const files = tx.objectStore('files');
    const keys = files.getAllKeys(IDBKeyRange.bound(treeId+'/',treeId+'/\uffff'));
    keys.onsuccess = () => {
      for (const key of keys.result) files.delete(key);
    };
    for (const [key, value] of urls) {
      if (key.startsWith(treeId+'/')) { URL.revokeObjectURL(value.url); urls.delete(key); }
    }
  });
}

export async function readFiles(treeId: string): Promise<Map<string, Blob>> {
  const db = await openDatabase();
  const rows = await requestValue<MediaRecord[]>(
    db.transaction('files','readonly').objectStore('files')
      .getAll(IDBKeyRange.bound(treeId+'/',treeId+'/\uffff')));
  return new Map(rows.map(row => [row.key.slice(treeId.length+1), row.blob]));
}
export async function readFile(treeId: string, filename: string): Promise<Blob | null> {
  const db = await openDatabase();
  const row = await requestValue<MediaRecord | undefined>(
    db.transaction('files','readonly').objectStore('files').get(treeId+'/'+filename));
  return row?.blob || null;
}
export async function storeFiles(treeId: string, entries: Array<{filename:string;blob:Blob}>) {
  const db = await openDatabase();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction('files','readwrite');
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error || new Error('Не удалось сохранить файлы.'));
    for (const entry of entries) tx.objectStore('files').put({key:treeId+'/'+entry.filename,blob:entry.blob});
  });
}

function objectURL(key: string, blob: Blob) {
  // Media filenames are immutable. IndexedDB returns a new Blob wrapper on
  // each read, so comparing object identity would revoke URLs still in the UI.
  const previous = urls.get(key);
  if (previous) return previous.url;
  const url = URL.createObjectURL(blob);
  urls.set(key, {blob,url});
  return url;
}

export async function publicTree(id: string) {
  const document = await readTree(id);
  const files = await readFiles(id);
  const persons = document.persons.map(person => {
    const photo = person._photo?.filename;
    const file = photo ? files.get(photo) : null;
    const portrait = file ? objectURL(id+'/'+photo, file) : null;
    const gallery = (person._gallery || []).map((item: Record<string, any>) => {
      const blob = files.get(item.filename);
      return {
        id:item.id, caption:item.caption || '', date:item.date || '', place:item.place || '',
        description:item.description || '', mime_type:item.mime_type || blob?.type || '',
        url:blob ? objectURL(id+'/'+item.filename, blob) : ''
      };
    });
    return {...person, photo_url:portrait, gallery};
  });
  return {tree:summary(document),persons,families:document.families};
}

export async function getSync(treeId: string): Promise<SyncRecord | null> {
  const db = await openDatabase();
  return await requestValue<SyncRecord | undefined>(db.transaction('sync','readonly').objectStore('sync').get(treeId)) || null;
}
export async function setSync(record: SyncRecord) {
  const db = await openDatabase();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction('sync','readwrite');
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error || new Error('Не удалось сохранить параметры GitHub.'));
    tx.objectStore('sync').put(record);
  });
}

export type {SyncRecord};


/** Install a validated GitHub snapshot and its media in one IDB transaction. */
export async function installTreeSnapshot(
  document: Document, files: Array<{filename:string;blob:Blob}>
): Promise<void> {
  validate(document);
  const db = await openDatabase();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(['trees','files'],'readwrite');
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error || new Error('Не удалось восстановить дерево.'));
    for (const file of files) {
      tx.objectStore('files').put({key:document.tree.id+'/'+file.filename,blob:file.blob});
    }
    tx.objectStore('trees').put({id:document.tree.id,document});
  });
}


/** A ZIP import is always a new local copy, never an overwrite.
 * ID and slug collision checks, tree and all media share one IDB transaction.
 */
export async function importNewTreeSnapshot(
  original:Document, files:Array<{filename:string;blob:Blob}>
):Promise<Document> {
  validate(original);
  const db=await openDatabase();
  return new Promise<Document>((resolve,reject)=>{
    const tx=db.transaction(['trees','files'],'readwrite');
    const trees=tx.objectStore('trees');
    const media=tx.objectStore('files');
    let result:Document|null=null;
    let failure:Error|null=null;
    tx.oncomplete=()=>result?resolve(result):reject(new Error('Архив не был сохранён.'));
    tx.onabort=()=>reject(failure||tx.error||new Error('Не удалось восстановить архив.'));
    const lookup=trees.getAll();
    lookup.onerror=()=>{failure=lookup.error||new Error('Ошибка чтения каталога деревьев.');tx.abort();};
    lookup.onsuccess=()=>{
      try{
        const doc=structuredClone(original) as Document;
        const existing=new Set((lookup.result as TreeRecord[]).map(x=>x.id));
        const slugs=new Set((lookup.result as TreeRecord[]).map(x=>x.document.tree.slug));
        const idChanged=existing.has(doc.tree.id);
        if(idChanged) {
          do{doc.tree.id=crypto.randomUUID().replace(/-/g,'');}while(existing.has(doc.tree.id));
        }
        if(idChanged||slugs.has(doc.tree.slug)) {
          const stem=(doc.tree.slug||'family').slice(0,85).replace(/-+$/,'');
          do{doc.tree.slug=stem+'-'+crypto.randomUUID().slice(0,8);}while(slugs.has(doc.tree.slug));
        }
        doc.tree.updated_at=now();
        validate(doc);
        for(const {filename,blob} of files)
          media.put({key:doc.tree.id+'/'+filename,blob});
        trees.put({id:doc.tree.id,document:doc});
        result=doc;
      }catch(error){
        failure=error instanceof Error?error:new Error('Некорректный семейный архив.');
        tx.abort();
      }
    };
  });
}
