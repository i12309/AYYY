/* IndexedDB holds ciphertext envelopes and non-sensitive sync metadata only. */
(() => {
  'use strict';
  const DATABASE='ayyy-health-v2';
  let connection;
  function open() {
    if(connection)return connection;
    connection=new Promise((resolve,reject)=>{
      if(!globalThis.indexedDB){reject(new Error('Этот браузер не поддерживает IndexedDB.'));return;}
      const request=indexedDB.open(DATABASE,1);
      request.onupgradeneeded=()=>{
        const db=request.result;
        if(!db.objectStoreNames.contains('vaults'))db.createObjectStore('vaults',{keyPath:'id'});
        if(!db.objectStoreNames.contains('meta'))db.createObjectStore('meta');
        const files=db.createObjectStore('objects',{keyPath:['vaultId','id']});
        files.createIndex('vault','vaultId');
      };
      request.onsuccess=()=>resolve(request.result);
      request.onerror=()=>reject(request.error || new Error('Не удалось открыть хранилище.'));
    }).catch(error=>{connection=null;throw error;});
    return connection;
  }
  async function request(store,mode,command) {
    const db=await open();
    return new Promise((resolve,reject)=>{
      const tx=db.transaction(store,mode), object=tx.objectStore(store);
      let op;
      try{op=command(object);}catch(error){tx.abort();reject(error);return;}
      tx.oncomplete=()=>resolve(op.result);
      tx.onerror=()=>reject(tx.error || new Error('Не удалось сохранить локальный архив.'));
      tx.onabort=()=>reject(tx.error || new Error('Локальная операция отменена.'));
    });
  }
  async function list(){
    const values=await request('vaults','readonly',s=>s.getAll());
    return values.map(x=>({id:x.id,repo:x.repo||null,dirty:!!x.dirty,lastSyncAt:x.lastSyncAt||null}));
  }
  function get(id){return request('vaults','readonly',s=>s.get(id));}
  const sameEnvelope=(a,b)=>!!a&&!!b&&['format','vaultId','kdf','iterations','salt','iv','ciphertext'].every(k=>a[k]===b[k])&&
    a.objectIds.length===b.objectIds.length&&a.objectIds.every((id,index)=>id===b.objectIds[index]);
  function sameRecord(a,b){return !!a&&!!b&&a.id===b.id&&sameEnvelope(a.envelope,b.envelope)&&!!a.dirty===!!b.dirty&&(a.remoteSha||null)===(b.remoteSha||null)&&(a.lastSyncAt||null)===(b.lastSyncAt||null)&&['owner','repo','branch'].every(k=>(a.repo?.[k]||null)===(b.repo?.[k]||null));}
  async function write(entry,expected,objects,selectNew){
    if(!entry || typeof entry.id!=='string' || entry.envelope?.vaultId!==entry.id)
      throw new Error('Попытка записать несовпадающий архив.');
    window.HumanCrypto.assertEnvelope(entry.envelope);
    const record={id:entry.id,envelope:entry.envelope,
      repo:entry.repo||null,remoteSha:entry.remoteSha||null,
      dirty:!!entry.dirty,lastSyncAt:entry.lastSyncAt||null};
    const wanted=new Set(record.envelope.objectIds),newObjects=new Map();
    for(const object of objects){
      if(!wanted.has(object.id)||newObjects.has(object.id))throw Error('Не совпадает состав вложений.');
      await window.HumanCrypto.verifyObject(object.id,object.bytes);
      newObjects.set(object.id,object);
    }
    const db=await open();
    await new Promise((resolve,reject)=>{
      const stores=selectNew?['vaults','objects','meta']:['vaults','objects'];
      const tx=db.transaction(stores,'readwrite'),store=tx.objectStore('vaults'),files=tx.objectStore('objects');
      let failure;
      const fail=error=>{failure=error;tx.abort();};
      tx.oncomplete=resolve;tx.onerror=tx.onabort=()=>reject(failure||tx.error||new Error('Локальное сохранение отменено.'));
      const current=store.get(record.id);current.onsuccess=()=>{
        const previous=current.result;
        if(expected===null?!!previous:expected!==undefined&&!sameRecord(previous,expected)){
          fail(new Error('Журнал изменён в другой операции. Откройте его заново; новые данные не перезаписаны.'));return;
        }
        try{
          const oldIds=new Set(previous?.envelope.objectIds||[]);
          for(const id of wanted){
            if(newObjects.has(id))files.put({vaultId:record.id,...newObjects.get(id)});
            else if(!oldIds.has(id)){
              const found=files.getKey([record.id,id]);
              found.onsuccess=()=>{if(found.result===undefined)fail(Error('В журнале отсутствует зашифрованный документ.'));};
            }
          }
          for(const id of oldIds)if(!wanted.has(id))files.delete([record.id,id]);
          if(selectNew){
            store.add(record);
            tx.objectStore('meta').put(record.id,'current');
          }else store.put(record);
        }catch(e){fail(e);}
      };
    });
    return record;
  }
  function save(entry,expected,objects=[]){return write(entry,expected,objects,false);}
  function createSelected(entry,objects=[]){return write(entry,null,objects,true);}
  function getObject(vaultId,id){return request('objects','readonly',s=>s.get([vaultId,id]));}
  async function snapshot(id){
    const db=await open();
    return new Promise((resolve,reject)=>{
      const tx=db.transaction(['vaults','objects'],'readonly');
      const current=tx.objectStore('vaults').get(id);
      const result={envelope:null,objects:[]};
      current.onsuccess=()=>{
        const entry=current.result;
        if(!entry){tx.abort();return;}
        result.envelope=entry.envelope;
        for(const objectId of entry.envelope.objectIds){
          const read=tx.objectStore('objects').get([id,objectId]);
          read.onsuccess=()=>{if(read.result)result.objects.push(read.result);else tx.abort();};
        }
      };
      tx.oncomplete=()=>resolve(result);
      tx.onerror=tx.onabort=()=>reject(tx.error||Error('Не удалось собрать полную резервную копию.'));
    });
  }
  async function remove(id){
    const db=await open();
    return new Promise((resolve,reject)=>{
      const tx=db.transaction(['vaults','objects','meta'],'readwrite'),objects=tx.objectStore('objects');
      tx.oncomplete=resolve;
      tx.onerror=tx.onabort=()=>reject(tx.error||Error('Не удалось удалить локальную копию.'));
      tx.objectStore('vaults').delete(id);
      const selected=tx.objectStore('meta').get('current');
      selected.onsuccess=()=>{if(selected.result===id)tx.objectStore('meta').delete('current');};
      const cursor=objects.index('vault').openKeyCursor(id);
      cursor.onsuccess=()=>{
        const item=cursor.result;
        if(item){objects.delete(item.primaryKey);item.continue();}
      };
    });
  }
  function current(){return request('meta','readonly',s=>s.get('current'));}
  function select(id){return request('meta','readwrite',s=>s.put(id,'current'));}
  window.HumanStore={list,get,save,remove,current,select,createSelected,sameEnvelope,getObject,snapshot};
})();
