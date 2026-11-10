/* HUMAN browser vault: no patient data, passphrases or decrypted content in source or localStorage. */
(() => {
  'use strict';
  const FORMAT = 'ayyy-health-v1';
  const ITERATIONS = 310000;
  const AAD = new TextEncoder().encode('AYYY-HUMAN-v1');
  const encode = new TextEncoder();
  const decode = new TextDecoder('utf-8', {fatal: true});
  function base64(bytes) {
    let out = '';
    for (let i=0; i<bytes.length; i+=32768)
      out += String.fromCharCode(...bytes.subarray(i, i+32768));
    return btoa(out);
  }
  function unbase64(value) {
    if (typeof value!=='string' || !/^[A-Za-z0-9+/]*={0,2}$/.test(value) || value.length%4!==0)
      throw new Error('Некорректная кодировка архива.');
    const binary=atob(value);
    return Uint8Array.from(binary, c=>c.charCodeAt(0));
  }
  function assertEnvelope(value) {
    if (!value || typeof value!=='object' || Array.isArray(value) ||
        value.format!==FORMAT || value.kdf!=='PBKDF2-SHA256' ||
        value.iterations!==ITERATIONS || typeof value.vaultId!=='string' ||
        !/^[0-9a-f-]{36}$/i.test(value.vaultId))
      throw new Error('Неизвестный формат зашифрованного архива.');
    const salt=unbase64(value.salt), iv=unbase64(value.iv), ciphertext=unbase64(value.ciphertext);
    if(salt.byteLength!==16 || iv.byteLength!==12 || ciphertext.byteLength<16 ||
       ciphertext.byteLength>40*1024*1024)
      throw new Error('Повреждённый или слишком большой зашифрованный архив.');
    return {salt,iv,ciphertext};
  }
  function assertData(doc) {
    if(doc?.humanMigration)throw new Error('Архив переноса старого HUMAN не поддерживается. Создайте новый журнал и загрузите данные заново.');
    if (!doc || typeof doc!=='object' || Array.isArray(doc) || doc.schema!==1 ||
        typeof doc.id!=='string' || !doc.profile || typeof doc.profile!=='object' ||
        ['observations','vitals','episodes','intakes','reminders','medical','medications','findings','diary','documents','revisions'].some(k=>!Array.isArray(doc[k])))
      throw new Error('Неизвестная структура медицинских данных.');
    return doc;
  }
  function requireCrypto() {
    if(!globalThis.isSecureContext || !globalThis.crypto?.subtle)
      throw new Error('Для защищённого хранилища требуется HTTPS или localhost.');
  }
  async function derive(passphrase, salt) {
    requireCrypto();
    const seed=await crypto.subtle.importKey('raw',encode.encode(passphrase),'PBKDF2',false,['deriveKey']);
    return crypto.subtle.deriveKey(
      {name:'PBKDF2',salt,iterations:ITERATIONS,hash:'SHA-256'},
      seed,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
  }
  async function seal(doc, key, existing) {
    requireCrypto();
    assertData(doc);
    const salt=existing ? assertEnvelope(existing).salt : crypto.getRandomValues(new Uint8Array(16));
    const iv=crypto.getRandomValues(new Uint8Array(12));
    const bytes=encode.encode(JSON.stringify(doc));
    if(bytes.byteLength>28*1024*1024)throw new Error('Архив превышает предел 28 МиБ. Экспортируйте часть вложений.');
    const cipher=new Uint8Array(await crypto.subtle.encrypt(
      {name:'AES-GCM',iv,additionalData:AAD},key,bytes));
    return {format:FORMAT,vaultId:doc.id,kdf:'PBKDF2-SHA256',
      iterations:ITERATIONS,salt:base64(salt),iv:base64(iv),ciphertext:base64(cipher)};
  }
  async function openWithKey(envelope,key) {
    requireCrypto();
    const {iv,ciphertext}=assertEnvelope(envelope);
    try {
      const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv,additionalData:AAD},key,ciphertext);
      const doc=assertData(JSON.parse(decode.decode(plain)));
      if(doc.id!==envelope.vaultId)throw new Error('Несовпадение профиля.');
      return doc;
    } catch {
      throw new Error('Неверная фраза доступа либо повреждён архив.');
    }
  }
  async function unlock(envelope,passphrase) {
    const {salt}=assertEnvelope(envelope);
    const key=await derive(passphrase,salt);
    const doc=await openWithKey(envelope,key);
    return {key,doc};
  }
  async function create(passphrase) {
    if(typeof passphrase!=='string'||passphrase.length<12)
      throw new Error('Фраза доступа должна содержать не менее 12 символов.');
    requireCrypto();
    const id=crypto.randomUUID();
    const doc={schema:1,id,profile:{name:'',birthDate:'',sex:'',notes:'',timezone:Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC'},
      observations:[],vitals:[],episodes:[],intakes:[],reminders:[],carePreferences:{browser_enabled:false},medical:[],medications:[],findings:[],diary:[],documents:[],revisions:[]};
    const salt=crypto.getRandomValues(new Uint8Array(16));
    const key=await derive(passphrase,salt);
    const envelope=await seal(doc,key,{format:FORMAT,vaultId:id,kdf:'PBKDF2-SHA256',iterations:ITERATIONS,
      salt:base64(salt),iv:base64(new Uint8Array(12)),ciphertext:base64(new Uint8Array(16))});
    return {key,doc,envelope};
  }
  window.HumanCrypto={FORMAT,base64,unbase64,assertEnvelope,assertData,seal,unlock,openWithKey,create};
})();
