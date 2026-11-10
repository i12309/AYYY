/* IndexedDB holds ciphertext envelopes and non-sensitive sync metadata only. */
(() => {
  'use strict';
  const DATABASE='ayyy-health-v1';
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
  const sameEnvelope=(a,b)=>!!a&&!!b&&['format','vaultId','kdf','iterations','salt','iv','ciphertext'].every(k=>a[k]===b[k]);
  function sameRecord(a,b){return !!a&&!!b&&a.id===b.id&&sameEnvelope(a.envelope,b.envelope)&&!!a.dirty===!!b.dirty&&(a.remoteSha||null)===(b.remoteSha||null)&&(a.lastSyncAt||null)===(b.lastSyncAt||null)&&['owner','repo','branch'].every(k=>(a.repo?.[k]||null)===(b.repo?.[k]||null));}
  async function save(entry,expected){
    if(!entry || typeof entry.id!=='string' || entry.envelope?.vaultId!==entry.id)
      throw new Error('Попытка записать несовпадающий архив.');
    window.HumanCrypto.assertEnvelope(entry.envelope);
    const record={id:entry.id,envelope:entry.envelope,
      repo:entry.repo||null,remoteSha:entry.remoteSha||null,
      dirty:!!entry.dirty,lastSyncAt:entry.lastSyncAt||null};
    const db=await open();
    await new Promise((resolve,reject)=>{
      const tx=db.transaction('vaults','readwrite'),store=tx.objectStore('vaults');let failure;
      tx.oncomplete=resolve;tx.onerror=tx.onabort=()=>reject(failure||tx.error||new Error('Локальное сохранение отменено.'));
      const current=store.get(record.id);current.onsuccess=()=>{
        if(expected===null?!!current.result:expected!==undefined&&!sameRecord(current.result,expected)){failure=new Error('Журнал изменён в другой операции. Откройте его заново; новые данные не перезаписаны.');tx.abort();return;}
        try{store.put(record);}catch(e){failure=e;tx.abort();}
      };
    });
    return record;
  }
  function remove(id){return request('vaults','readwrite',s=>s.delete(id));}
  function current(){return request('meta','readonly',s=>s.get('current'));}
  function select(id){return request('meta','readwrite',s=>s.put(id,'current'));}
  async function createSelected(entry){
    if(!entry||entry.envelope?.vaultId!==entry.id)throw new Error('Несовпадение нового архива.');
    window.HumanCrypto.assertEnvelope(entry.envelope);
    const record={id:entry.id,envelope:entry.envelope,repo:entry.repo||null,remoteSha:entry.remoteSha||null,dirty:!!entry.dirty,lastSyncAt:entry.lastSyncAt||null},db=await open();
    await new Promise((resolve,reject)=>{const tx=db.transaction(['vaults','meta'],'readwrite');tx.oncomplete=resolve;tx.onerror=tx.onabort=()=>reject(tx.error||new Error('Не удалось создать новый журнал.'));try{tx.objectStore('vaults').add(record);tx.objectStore('meta').put(record.id,'current');}catch(error){tx.abort();reject(error);}});
    return record;
  }
  window.HumanStore={list,get,save,remove,current,select,createSelected,sameEnvelope};
})();
