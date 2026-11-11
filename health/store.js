/* IndexedDB holds ciphertext envelopes and non-sensitive sync metadata only. */
(() => {
  'use strict';
  const DATABASE='ayyy-health-v2';
  const durable={durability:'strict'};
  let connection;
  function open() {
    if(connection)return connection;
    connection=new Promise((resolve,reject)=>{
      if(!globalThis.indexedDB){reject(new Error('Этот браузер не поддерживает IndexedDB.'));return;}
      const request=indexedDB.open(DATABASE,2);
      let blocked=false;
      request.onblocked=()=>{blocked=true;reject(Error('Закройте другие вкладки журнала и откройте эту страницу заново.'));};
      request.onupgradeneeded=()=>{
        const db=request.result;
        if(!db.objectStoreNames.contains('vaults'))db.createObjectStore('vaults',{keyPath:'id'});
        if(!db.objectStoreNames.contains('meta'))db.createObjectStore('meta');
        if(!db.objectStoreNames.contains('objects'))db.createObjectStore('objects',{keyPath:['vaultId','id']}).createIndex('vault','vaultId');
        if(!db.objectStoreNames.contains('importDrafts'))db.createObjectStore('importDrafts',{keyPath:'vaultId'});
      };
      request.onsuccess=()=>{
        const db=request.result;
        if(blocked){db.close();return;}
        db.onversionchange=()=>{db.close();connection=null;};
        resolve(db);
      };
      request.onerror=()=>reject(request.error || new Error('Не удалось открыть хранилище.'));
    }).catch(error=>{connection=null;throw error;});
    return connection;
  }
  async function request(store,mode,command) {
    const db=await open();
    return new Promise((resolve,reject)=>{
      const tx=db.transaction(store,mode,mode==='readwrite'?durable:undefined), object=tx.objectStore(store);
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
  async function write(entry,expected,objects,selectNew,draftUpdate){
    if(!entry || typeof entry.id!=='string' || entry.envelope?.vaultId!==entry.id)
      throw new Error('Попытка записать несовпадающий архив.');
    if(draftUpdate?.next&&(draftUpdate.next.vaultId!==entry.id||draftUpdate.next.salt!==entry.envelope.salt))
      throw Error('Черновик относится к другому журналу.');
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
      if(draftUpdate)stores.push('importDrafts');
      const tx=db.transaction(stores,'readwrite',durable),store=tx.objectStore('vaults'),files=tx.objectStore('objects');
      let failure;
      const fail=error=>{failure=error;tx.abort();};
      tx.oncomplete=resolve;tx.onerror=tx.onabort=()=>reject(failure||tx.error||new Error('Локальное сохранение отменено.'));
      const current=store.get(record.id);current.onsuccess=()=>{
        const previous=current.result;
        if(expected===null?!!previous:expected!==undefined&&!sameRecord(previous,expected)){
          fail(new Error('Журнал изменён в другой операции. Откройте его заново; новые данные не перезаписаны.'));return;
        }
        try{
          if(draftUpdate)updateDraft(tx.objectStore('importDrafts'),record.id,draftUpdate,fail);
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
  function save(entry,expected,objects=[],draftUpdate){return write(entry,expected,objects,false,draftUpdate);}
  function createSelected(entry,objects=[]){return write(entry,null,objects,true);}
  function getObject(vaultId,id){return request('objects','readonly',s=>s.get([vaultId,id]));}
  function importDraft(id){return request('importDrafts','readonly',s=>s.get(id));}
  function updateDraft(store,id,{expected,next},fail){
    const read=store.get(id);
    read.onsuccess=()=>{
      if((read.result?.revision??null)!==expected){fail(Error('Черновик изменился в другом окне. Откройте сохранённый черновик заново.'));return;}
      try{if(next)store.put(next);else store.delete(id);}catch(error){fail(error);}
    };
  }
  async function saveImportDraft(id,salt,expected,next,active=()=>true){
    if(next&&(next.vaultId!==id||next.salt!==salt))throw Error('Черновик относится к другому журналу.');
    const db=await open();
    return new Promise((resolve,reject)=>{
      const tx=db.transaction(['vaults','importDrafts'],'readwrite',durable);
      let failure;
      const fail=error=>{failure=error;tx.abort();};
      tx.oncomplete=()=>resolve(next);tx.onerror=tx.onabort=()=>reject(failure||tx.error||Error('Не удалось сохранить черновик.'));
      const vault=tx.objectStore('vaults').get(id);
      vault.onsuccess=()=>{
        if(!active()){fail(Error('Журнал или окно импорта закрыто.'));return;}
        if(!vault.result||vault.result.envelope.salt!==salt){fail(Error('Журнал изменился. Откройте его заново.'));return;}
        updateDraft(tx.objectStore('importDrafts'),id,{expected,next},fail);
      };
    });
  }
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
  async function remove(id,expectedEnvelope){
    const db=await open();
    return new Promise((resolve,reject)=>{
      const tx=db.transaction(['vaults','objects','meta','importDrafts'],'readwrite',durable);
      const vaults=tx.objectStore('vaults'),objects=tx.objectStore('objects'),meta=tx.objectStore('meta');
      let failure;
      tx.oncomplete=resolve;
      tx.onerror=tx.onabort=()=>reject(failure||tx.error||Error('Не удалось удалить локальную копию.'));
      const current=vaults.get(id);
      current.onsuccess=()=>{
        if(!sameEnvelope(current.result?.envelope,expectedEnvelope)){
          failure=Error('Журнал изменился после подготовки копии. Откройте его заново перед удалением.');
          tx.abort();
          return;
        }
        vaults.delete(id);
        tx.objectStore('importDrafts').delete(id);
        const selected=meta.get('current');
        selected.onsuccess=()=>{if(selected.result===id)meta.delete('current');};
        const cursor=objects.index('vault').openKeyCursor(id);
        cursor.onsuccess=()=>{
          const item=cursor.result;
          if(item){objects.delete(item.primaryKey);item.continue();}
        };
      };
    });
  }
  function current(){return request('meta','readonly',s=>s.get('current'));}
  function select(id){return request('meta','readwrite',s=>s.put(id,'current'));}
  window.HumanStore={list,get,save,remove,current,select,createSelected,sameEnvelope,getObject,snapshot,importDraft,saveImportDraft};
})();
