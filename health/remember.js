/* Optional, time-limited HUMAN unlock. The passphrase and plaintext never persist.
   Only a non-extractable WebCrypto key is temporarily structured-cloned to IndexedDB.
   A random per-tab sessionStorage nonce gates reuse; manual lock revokes it. */
(() => {
  'use strict';
  const DB='ayyy-human-temporary-unlock-v1';
  const STORE='leases';
  const SESSION='ayyy-human-unlock-lease-v1';
  const TTL=30*60*1000;
  let opening=null;
  function validId(id){return typeof id==='string'&&/^[a-f0-9-]{36}$/i.test(id);}
  function session(){
    try{
      const entry=JSON.parse(sessionStorage.getItem(SESSION)||'null');
      return entry&&validId(entry.vaultId)&&validId(entry.nonce)&&
        Number.isSafeInteger(entry.expiresAt)?entry:null;
    }catch{return null;}
  }
  function dropSession(){
    try{sessionStorage.removeItem(SESSION);}catch{/* Disabled storage: no automatic unlock. */}
  }
  function db(){
    if(opening)return opening;
    opening=new Promise((resolve,reject)=>{
      if(!globalThis.indexedDB||!globalThis.isSecureContext){
        reject(Error('В этом браузере недоступно безопасное временное хранение.'));return;
      }
      const request=indexedDB.open(DB,1);
      request.onupgradeneeded=()=>{
        const database=request.result;
        if(!database.objectStoreNames.contains(STORE))
          database.createObjectStore(STORE,{keyPath:'nonce'});
      };
      request.onsuccess=()=>{
        const database=request.result;
        database.onversionchange=()=>{database.close();opening=null;};
        resolve(database);
      };
      request.onblocked=()=>reject(Error('Закройте другие вкладки HUMAN и повторите попытку.'));
      request.onerror=()=>reject(request.error||Error('Временное хранилище недоступно.'));
    }).catch(error=>{opening=null;throw error;});
    return opening;
  }
  async function request(mode,task){
    const database=await db();
    return new Promise((resolve,reject)=>{
      const tx=database.transaction(STORE,mode),store=tx.objectStore(STORE);
      let op;
      try{op=task(store);}catch(error){tx.abort();reject(error);return;}
      tx.oncomplete=()=>resolve(op?.result);
      tx.onerror=tx.onabort=()=>reject(tx.error||Error('Временный доступ не сохранён.'));
    });
  }
  async function purge(nonce){
    if(!validId(nonce))return;
    await request('readwrite',store=>store.delete(nonce));
  }
  async function forget(vaultId=null){
    const stored=session();
    if(!vaultId||stored?.vaultId===vaultId)dropSession();
    if(stored&&(!vaultId||stored.vaultId===vaultId))
      try{await purge(stored.nonce);}catch{/* The per-tab capability was revoked synchronously. */}
  }
  async function remember(vaultId,salt,key,active=()=>true){
    if(!validId(vaultId)||typeof salt!=='string'||!key||key.type!=='secret'||
      key.extractable!==false||key.algorithm?.name!=='AES-GCM'||!key.usages?.includes('decrypt'))
      throw Error('Не удалось подтвердить защищённый ключ журнала.');
    if(!active())return false;
    const old=session();
    const lease={vaultId,salt,key,nonce:crypto.randomUUID(),expiresAt:Date.now()+TTL};
    await request('readwrite',store=>store.put(lease));
    if(!active()){await purge(lease.nonce);return false;}
    try{
      sessionStorage.setItem(SESSION,JSON.stringify({
        vaultId,nonce:lease.nonce,expiresAt:lease.expiresAt
      }));
    }catch{
      await purge(lease.nonce);
      throw Error('Браузер не разрешает запоминание доступа в этой вкладке.');
    }
    if(old&&old.nonce!==lease.nonce)void purge(old.nonce).catch(()=>{});
    return true;
  }
  async function recall(vaultId,salt){
    const lease=session();
    if(!lease)return null;
    if(lease.expiresAt<=Date.now()){
      await forget();
      return null;
    }
    if(lease.vaultId!==vaultId)return null;
    try{
      const stored=await request('readonly',store=>store.get(lease.nonce));
      if(!stored||stored.vaultId!==vaultId||stored.salt!==salt||
        stored.expiresAt!==lease.expiresAt||stored.expiresAt<=Date.now()||
        stored.key?.type!=='secret'||stored.key?.extractable!==false||
        stored.key?.algorithm?.name!=='AES-GCM'||!stored.key?.usages?.includes('decrypt')){
        await forget(vaultId);
        return null;
      }
      return stored.key;
    }catch{
      await forget(vaultId);
      return null;
    }
  }
  async function sweep(){
    // Closed tabs may leave an orphan encrypted-key capability until expiry.
    const database=await db();
    await new Promise((resolve,reject)=>{
      const tx=database.transaction(STORE,'readwrite'),store=tx.objectStore(STORE);
      const cursor=store.openCursor();
      cursor.onsuccess=()=>{
        const item=cursor.result;
        if(!item)return;
        if(!Number.isSafeInteger(item.value?.expiresAt)||item.value.expiresAt<=Date.now())
          item.delete();
        item.continue();
      };
      tx.oncomplete=resolve;
      tx.onerror=tx.onabort=()=>reject(tx.error||Error('Не удалось очистить временный доступ.'));
    });
  }
  function expiresAt(vaultId){
    const lease=session();
    return lease&&lease.vaultId===vaultId&&lease.expiresAt>Date.now()?lease.expiresAt:null;
  }
  window.HumanRemember={remember,recall,forget,sweep,expiresAt,TTL};
})();
