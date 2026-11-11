/* The pending import is local to this browser and uses the current journal key. */
(() => {
 'use strict';
 const C=window.HumanCrypto,encode=new TextEncoder(),decode=new TextDecoder('utf-8',{fatal:true});
 const invalid=()=>Error('Не удалось открыть сохранённый черновик. Проверьте фразу доступа или удалите этот черновик.');
 const aad=(row,part)=>encode.encode(JSON.stringify([C.FORMAT,'import-draft',row.vaultId,row.salt,part]));
 async function encrypt(row,part,bytes,key){
  const iv=crypto.getRandomValues(new Uint8Array(12));
  const cipher=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:aad(row,part)},key,bytes);
  const encrypted=new Uint8Array(12+cipher.byteLength);
  encrypted.set(iv);encrypted.set(new Uint8Array(cipher),12);
  return encrypted;
 }
 async function decrypt(row,part,bytes,key,limit){
  if(!(bytes instanceof Uint8Array)||bytes.length<C.FILE_OVERHEAD||bytes.length>limit+C.FILE_OVERHEAD)throw invalid();
  try{return new Uint8Array(await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes.subarray(0,12),additionalData:aad(row,part)},key,bytes.subarray(12)));}
  catch{throw invalid();}
 }
 async function metadata(row,entries,key){
  const bytes=encode.encode(JSON.stringify({format:1,entries}));
  if(bytes.length>C.MAX_METADATA)throw Error('Метаданные черновика превышают 28 МиБ. Сохраните меньше файлов за один раз.');
  row.metadata=await encrypt(row,['metadata',row.revision],bytes,key);
  return row;
 }
 async function readMetadata(row,key){
  const bytes=await decrypt(row,['metadata',row.revision],row.metadata,key,C.MAX_METADATA);
  const data=JSON.parse(decode.decode(bytes));
  if(data?.format!==1||!Array.isArray(data.entries)||!Array.isArray(row.files)||data.entries.length!==row.files.length||data.entries.length>100)throw invalid();
  const ids=new Set();let total=0;
  for(const {id,name,size} of data.entries){
   if(typeof id!=='string'||!id||ids.has(id)||typeof name!=='string'||!Number.isSafeInteger(size)||size<0||size>C.MAX_FILE)throw invalid();
   ids.add(id);total+=size;
  }
  if(total>C.MAX_FILES)throw invalid();
  return data.entries;
 }
 function assertActive(active){if(!active())throw Error('Журнал или окно импорта закрыто.');}
 async function seal(vaultId,salt,key,entries,active=()=>true){
  const row={vaultId,salt,revision:crypto.randomUUID(),files:[]},items=[];
  for(const entry of entries){
   assertActive(active);
   const {bytes,...info}=entry;
   if(!(bytes instanceof Uint8Array)||bytes.length>C.MAX_FILE)throw Error('В черновике разрешено до 32 МиБ на файл.');
   items.push({...info,size:bytes.length});
  }
  if(!items.length||items.length>100||items.reduce((size,item)=>size+item.size,0)>C.MAX_FILES)throw Error('Черновик должен содержать до 100 файлов общим размером до 128 МиБ.');
  await metadata(row,items,key);
  for(const {id,bytes} of entries){
   assertActive(active);
   row.files.push({id,bytes:await encrypt(row,['file',id],bytes,key)});
  }
  assertActive(active);
  return row;
 }
 async function open(row,key,active=()=>true){
  const items=await readMetadata(row,key),entries=[];
  const files=new Map(row.files.map(file=>[file.id,file.bytes]));
  for(const {size,...item} of items){
   assertActive(active);
   const bytes=await decrypt(row,['file',item.id],files.get(item.id),key,size);
   if(bytes.length!==size)throw invalid();
   entries.push({...item,bytes});
  }
  assertActive(active);
  return entries;
 }
 async function prune(row,key,id){
  const entries=await readMetadata(row,key),pending=entries.filter(entry=>entry.id!==id);
  if(entries.length===pending.length)return row;
  if(!pending.length)return null;
  const next={vaultId:row.vaultId,salt:row.salt,revision:crypto.randomUUID(),files:row.files.filter(file=>file.id!==id)};
  return metadata(next,pending,key);
 }
 window.HumanImportDraft={seal,open,prune};
})();
