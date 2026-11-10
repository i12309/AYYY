/**
 * Import self-contained GEN backups. Supports browser STORE and Python
 * ZIP_DEFLATED archives; no network, third-party ZIP code or server required.
 * All checks run before a single IndexedDB transaction installs the document.
 */
import {type Document,validate} from './browserModel';

const MAX_ARCHIVE = 150*1024*1024;
const MAX_EXPANDED = 350*1024*1024;
const MAX_SINGLE = 60*1024*1024;
const MAX_ENTRIES = 3000;
const MAX_RATIO = 160;
const text = new TextDecoder('utf-8',{fatal:true});
const allowed=/^[a-zA-Z0-9_-][a-zA-Z0-9_.-]*$/;
const u16=(v:DataView,p:number)=>v.getUint16(p,true);
const u32=(v:DataView,p:number)=>v.getUint32(p,true);
function assert(condition:unknown,message:string):asserts condition {
  if(!condition)throw new Error('ZIP: '+message);
}
function crc32(bytes:Uint8Array):number {
  let crc=0xffffffff;
  for(const value of bytes) {
    crc^=value;
    for(let i=0;i<8;i++)crc=(crc>>>1)^(-(crc&1)&0xedb88320);
  }
  return (crc^0xffffffff)>>>0;
}
function safeName(value:string):string {
  // Never extract files to a filesystem. Still reject traversal, separators,
  // Windows drive prefixes, absolute paths and NUL before using a name as a key.
  assert(!value.includes('\0')&&!value.includes('\\')&&!value.startsWith('/')&&
    !value.includes('//')&&!value.split('/').some(x=>x==='.'||x==='..'),
    'Небезопасный путь внутри архива: '+value.slice(0,120));
  return value;
}
async function inflate(source:Uint8Array,expected:number):Promise<Uint8Array> {
  if(typeof DecompressionStream!=='function') {
    throw new Error('Для сжатого ZIP нужен браузер с поддержкой DecompressionStream (например, современный Chrome).');
  }
  let result:Uint8Array;
  try{
    const copy=source.buffer.slice(source.byteOffset,source.byteOffset+source.byteLength) as ArrayBuffer;
    const stream=new Blob([copy]).stream().pipeThrough(
      new DecompressionStream('deflate-raw' as CompressionFormat));
    const buffer=await new Response(stream).arrayBuffer();
    result=new Uint8Array(buffer);
  }catch {
    throw new Error('ZIP: Не удалось распаковать файл DEFLATE. Архив может быть повреждён.');
  }
  assert(result.length===expected,'Неверный размер распакованного файла.');
  return result;
}
export type ArchiveFile={filename:string;blob:Blob};
export type ParsedBackup={document:Document;files:ArchiveFile[];warnings:string[]};

/** Exposes the validated list of entries for tests and potential previews. */
export async function readArchive(file:Blob):Promise<ParsedBackup> {
  assert(file.size>0&&file.size<=MAX_ARCHIVE,'Архив должен быть не больше 150 МБ.');
  const data=new Uint8Array(await file.arrayBuffer()),view=new DataView(data.buffer);
  const min=Math.max(0,data.length-22-0xffff);
  let end=-1;
  for(let p=data.length-22;p>=min;p--){
    if(u32(view,p)===0x06054b50&&p+22+u16(view,p+20)===data.length){end=p;break;}
  }
  assert(end>=0,'Не найден конец центрального каталога.');
  assert(u16(view,end+4)===0&&u16(view,end+6)===0,'Многодисковый ZIP не поддерживается.');
  const entries=u16(view,end+10),length=u32(view,end+12),offset=u32(view,end+16);
  assert(entries===u16(view,end+8)&&entries<MAX_ENTRIES,'Слишком много записей.');
  assert(length!==0xffffffff&&offset!==0xffffffff&&offset+length<=end,'ZIP64 или повреждённый каталог.');
  const indexed=new Map<string,Uint8Array>();
  let p=offset,total=0;
  const seen=new Set<string>();
  for(let i=0;i<entries;i++){
    assert(p+46<=end&&u32(view,p)===0x02014b50,'Повреждён центральный каталог.');
    const flags=u16(view,p+8),method=u16(view,p+10);
    const checksum=u32(view,p+16),compressed=u32(view,p+20),expanded=u32(view,p+24);
    const nameLen=u16(view,p+28),extra=u16(view,p+30),comment=u16(view,p+32);
    const disk=u16(view,p+34),external=u32(view,p+38),local=u32(view,p+42);
    assert(disk===0&&((external>>>16)&0xf000)!==0xa000,'Символические ссылки не поддерживаются.');
    assert(!(flags&1)&&[0,8].includes(method),'ZIP защищён паролем или содержит неподдерживаемое сжатие.');
    assert(![compressed,expanded,local].includes(0xffffffff),'ZIP64 не поддерживается.');
    assert(p+46+nameLen+extra+comment<=end,'Неверная длина записи.');
    const rawName=data.subarray(p+46,p+46+nameLen);
    let name:string;
    try{name=text.decode(rawName);}catch{throw new Error('ZIP: Названия файлов должны быть в UTF-8 или ASCII.');}
    name=safeName(name);
    p+=46+nameLen+extra+comment;
    if(name.endsWith('/'))continue;
    assert(!seen.has(name),'Повторное имя файла: '+name);
    seen.add(name);
    // Unknown harmless ZIP entries are ignored; unsafe paths are rejected.
    if(name!=='tree.json'&&name!=='original.ged'&&name!=='tree.ged'&&
       !name.startsWith('media/'))continue;
    assert(expanded<=MAX_SINGLE,'Слишком большой файл: '+name);
    assert(compressed!==0||expanded===0,'Некорректная запись со сжатием.');
    assert(expanded<=Math.max(1024,compressed*MAX_RATIO),'Подозрительно высокая степень сжатия.');
    total+=expanded;
    assert(total<=MAX_EXPANDED,'Суммарный объём распакованных данных превышает 350 МБ.');
    if(name.startsWith('media/'))assert(allowed.test(name.slice(6)),'Некорректное имя медиафайла.');
    assert(local+30<=data.length&&u32(view,local)===0x04034b50,'Повреждён локальный заголовок.');
    assert(u16(view,local+8)===method,'Разные методы сжатия в заголовках.');
    const payload=local+30+u16(view,local+26)+u16(view,local+28);
    assert(payload+compressed<=offset,'Данные выходят за пределы ZIP.');
    const chunk=data.subarray(payload,payload+compressed);
    const output=method===0?new Uint8Array(chunk):await inflate(chunk,expanded);
    assert(output.length===expanded&&crc32(output)===checksum,'Контрольная сумма CRC32 не совпадает: '+name);
    indexed.set(name,output);
  }
  assert(p===offset+length,'Центральный каталог имеет лишние или отсутствующие записи.');
  const json=indexed.get('tree.json');
  assert(json&&json.length,'В ZIP нет tree.json с семейным деревом.');
  let document:Document;
  try{document=JSON.parse(text.decode(json));}
  catch{throw new Error('ZIP: tree.json повреждён или не является JSON в UTF-8.');}
  validate(document);
  const required=new Map<string,string>();
  for(const person of document.persons){
    if(person._photo?.filename)
      required.set(person._photo.filename,person._photo.mime_type||'image/jpeg');
    for(const item of person._gallery||[])
      required.set(item.filename,item.mime_type||'application/octet-stream');
  }
  for(const name of required.keys()){
    assert(typeof name==='string'&&allowed.test(name)&&!name.includes('..'),
      'Некорректная ссылка на фото или документ.');
    assert(indexed.has('media/'+name),'В архиве отсутствует файл media/'+name);
  }
  const files:ArchiveFile[]=[];
  for(const [name,mime] of required){
    const bytes=indexed.get('media/'+name)!;
    const source=bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength) as ArrayBuffer;
    files.push({filename:name,blob:new Blob([source],{type:mime})});
  }
  const original=indexed.get('original.ged');
  if(original){
    const source=original.buffer.slice(original.byteOffset,original.byteOffset+original.byteLength) as ArrayBuffer;
    files.push({filename:'original.ged',blob:new Blob([source],{type:'text/plain'})});
  }
  const warnings:string[]=[];
  if([...indexed.keys()].some(x=>x.startsWith('media/')&&!required.has(x.slice(6))))
    warnings.push('В архиве есть дополнительные медиафайлы, не связанные с людьми. Они не импортированы.');
  if(!indexed.has('tree.ged'))warnings.push('В архиве нет актуального GEDCOM; он будет создан из JSON при экспорте.');
  return {document,files,warnings};
}
