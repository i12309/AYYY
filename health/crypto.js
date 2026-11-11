/* HUMAN browser vault: no patient data, passphrases or decrypted content in source or localStorage. */
(() => {
  'use strict';
  const FORMAT = 'ayyy-health-v2';
  const ITERATIONS = 310000;
  const MAX_FILE = 32 * 1024 * 1024;
  const MAX_FILES = 128 * 1024 * 1024;
  const MAX_OBJECTS = 1000;
  const MAX_METADATA = 28 * 1024 * 1024;
  const FILE_OVERHEAD = 28;
  const encode = new TextEncoder();
  const decode = new TextDecoder('utf-8', {fatal: true});
  const isHash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
  const isVaultId = value => typeof value === 'string' && /^[a-f0-9-]{36}$/i.test(value);
  function base64(bytes) {
    if (typeof bytes.toBase64 === 'function') return bytes.toBase64();
    let out = '';
    for (let i=0; i<bytes.length; i+=32768)
      out += String.fromCharCode(...bytes.subarray(i, i+32768));
    return btoa(out);
  }
  function unbase64(value) {
    if (typeof value!=='string' || value.length%4!==0 || /[^A-Za-z0-9+/=]|=(?=.{2})|=[^=]/.test(value))
      throw new Error('Некорректная кодировка архива.');
    if (typeof Uint8Array.fromBase64 === 'function') return Uint8Array.fromBase64(value);
    const binary=atob(value);
    const bytes=new Uint8Array(binary.length);
    for(let index=0;index<bytes.length;index++)bytes[index]=binary.charCodeAt(index);
    return bytes;
  }
  function assertEnvelope(value) {
    if (!value || typeof value!=='object' || Array.isArray(value) ||
        value.format!==FORMAT || value.kdf!=='PBKDF2-SHA256' ||
        value.iterations!==ITERATIONS || !isVaultId(value.vaultId) ||
        !Array.isArray(value.objectIds) || value.objectIds.length>MAX_OBJECTS ||
        !value.objectIds.every(isHash) || new Set(value.objectIds).size!==value.objectIds.length)
      throw new Error('Неизвестный формат зашифрованного архива.');
    if(typeof value.salt!=='string'||value.salt.length!==24||typeof value.iv!=='string'||value.iv.length!==16||
       typeof value.ciphertext!=='string'||value.ciphertext.length>Math.ceil((MAX_METADATA+16)/3)*4)
      throw new Error('Повреждённый или слишком большой зашифрованный архив.');
    const salt=unbase64(value.salt), iv=unbase64(value.iv), ciphertext=unbase64(value.ciphertext);
    if(salt.byteLength!==16 || iv.byteLength!==12 || ciphertext.byteLength<16 ||
       ciphertext.byteLength>MAX_METADATA+16)
      throw new Error('Повреждённый или слишком большой зашифрованный архив.');
    return {salt,iv,ciphertext};
  }
  function assertData(doc) {
    if(doc?.humanMigration)throw new Error('Архив переноса старого HUMAN не поддерживается. Создайте новый журнал и загрузите данные заново.');
    if (!doc || typeof doc!=='object' || Array.isArray(doc) || doc.schema!==1 ||
        typeof doc.id!=='string' || !doc.profile || typeof doc.profile!=='object' ||
        ['observations','vitals','episodes','intakes','reminders','medical','medications','findings','diary','documents','revisions','timeline','recommendationIntakes','recommendationContexts','recommendationReports'].some(k=>!Array.isArray(doc[k])))
      throw new Error('Неизвестная структура медицинских данных.');
    return doc;
  }
  function requireCrypto() {
    if(!globalThis.isSecureContext || !globalThis.crypto?.subtle)
      throw new Error('Для защищённого хранилища требуется HTTPS или localhost.');
  }
  function objectIds(doc) {
    let total=0;
    const ids=new Set(),documentIds=new Set();
    if(doc.documents.length>MAX_OBJECTS)throw Error('В журнале может быть до 1000 документов.');
    for(const file of doc.documents){
      if(typeof file?.id!=='string'||!file.id||documentIds.has(file.id)||Object.hasOwn(file,'data')||
         !isHash(file.objectId)||ids.has(file.objectId)||!isHash(file.sha256)||
         !Number.isSafeInteger(file.size)||file.size<0||file.size>MAX_FILE)
        throw Error('Некорректная ссылка на зашифрованный документ.');
      documentIds.add(file.id);
      ids.add(file.objectId);
      total+=file.size;
    }
    if(total>MAX_FILES)throw Error('Общий размер вложений превышает 128 МиБ.');
    return [...ids].sort();
  }
  const manifestAAD = (vaultId,ids) => encode.encode(JSON.stringify([FORMAT,vaultId,ids]));
  const fileAAD = (vaultId,id) => encode.encode(JSON.stringify([FORMAT,'document',vaultId,id]));
  async function sha256(bytes) {
    const hash=new Uint8Array(await crypto.subtle.digest('SHA-256',bytes));
    return Array.from(hash,value=>value.toString(16).padStart(2,'0')).join('');
  }
  async function verifyObject(id,bytes) {
    if(!isHash(id)||!(bytes instanceof Uint8Array)||bytes.length<FILE_OVERHEAD||
       bytes.length>MAX_FILE+FILE_OVERHEAD||await sha256(bytes)!==id)
      throw Error('Зашифрованный документ повреждён.');
    return bytes;
  }
  async function sealFile(vaultId,id,bytes,key) {
    if(!isVaultId(vaultId)||typeof id!=='string'||!id||!(bytes instanceof Uint8Array)||bytes.length>MAX_FILE)
      throw Error('Проверьте документ: размер файла ограничен 32 МиБ.');
    const iv=crypto.getRandomValues(new Uint8Array(12));
    const ciphertext=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:fileAAD(vaultId,id)},key,bytes);
    const sealed=new Uint8Array(iv.length+ciphertext.byteLength);
    sealed.set(iv);sealed.set(new Uint8Array(ciphertext),iv.length);
    const objectId=await sha256(sealed);
    return {reference:{objectId,size:bytes.length,sha256:await sha256(bytes)},object:{id:objectId,bytes:sealed}};
  }
  async function openFile(vaultId,file,object,key) {
    if(!object||object.id!==file.objectId||object.bytes?.length!==file.size+FILE_OVERHEAD)
      throw Error('Зашифрованный документ отсутствует или повреждён.');
    const bytes=await verifyObject(object.id,object.bytes);
    let plain;
    try{
      plain=new Uint8Array(await crypto.subtle.decrypt({
        name:'AES-GCM',iv:bytes.subarray(0,12),additionalData:fileAAD(vaultId,file.id),
      },key,bytes.subarray(12)));
    }catch{throw Error('Не удалось проверить подлинность документа.');}
    if(await sha256(plain)!==file.sha256)throw Error('Не совпадает контрольная сумма документа.');
    return plain;
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
    const salt=existing ? unbase64(existing.salt) : crypto.getRandomValues(new Uint8Array(16));
    if(salt.length!==16||!isVaultId(doc.id))throw Error('Некорректный профиль архива.');
    const ids=objectIds(doc);
    const iv=crypto.getRandomValues(new Uint8Array(12));
    const bytes=encode.encode(JSON.stringify(doc));
    if(bytes.byteLength>MAX_METADATA)throw new Error('Метаданные журнала превышают 28 МиБ.');
    const cipher=new Uint8Array(await crypto.subtle.encrypt(
      {name:'AES-GCM',iv,additionalData:manifestAAD(doc.id,ids)},key,bytes));
    return {format:FORMAT,vaultId:doc.id,kdf:'PBKDF2-SHA256',
      iterations:ITERATIONS,salt:base64(salt),iv:base64(iv),ciphertext:base64(cipher),objectIds:ids};
  }
  async function openWithKey(envelope,key) {
    requireCrypto();
    const {iv,ciphertext}=assertEnvelope(envelope);
    try {
      const plain=await crypto.subtle.decrypt({
        name:'AES-GCM',iv,additionalData:manifestAAD(envelope.vaultId,envelope.objectIds),
      },key,ciphertext);
      const doc=assertData(JSON.parse(decode.decode(plain)));
      if(doc.id!==envelope.vaultId||JSON.stringify(objectIds(doc))!==JSON.stringify(envelope.objectIds))
        throw new Error('Не совпадает состав архива.');
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
    requireCrypto();
    const id=crypto.randomUUID();
    const doc={schema:1,id,profile:{name:'',birthDate:'',sex:'unknown',heightCm:null,notes:'',timezone:Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC'},
      observations:[],vitals:[],episodes:[],intakes:[],reminders:[],carePreferences:{browser_enabled:false},medical:[],medications:[],findings:[],diary:[],documents:[],revisions:[],timeline:[],recommendationIntakes:[],recommendationContexts:[],recommendationReports:[]};
    return {doc,...await rekey(doc,passphrase)};
  }
  async function newKey(passphrase) {
    if(typeof passphrase!=='string'||passphrase.length<12)
      throw new Error('Фраза доступа должна содержать не менее 12 символов.');
    requireCrypto();
    const salt=crypto.getRandomValues(new Uint8Array(16));
    const key=await derive(passphrase,salt);
    return {key,salt:base64(salt)};
  }
  async function rekey(doc,passphrase) {
    const next=await newKey(passphrase);
    const envelope=await seal(doc,next.key,next);
    return {key:next.key,envelope};
  }
  window.HumanCrypto={FORMAT,MAX_FILE,MAX_FILES,MAX_OBJECTS,MAX_METADATA,FILE_OVERHEAD,
    base64,unbase64,assertEnvelope,assertData,seal,unlock,openWithKey,create,newKey,
    sealFile,openFile,verifyObject,isHash,sha256};
})();
