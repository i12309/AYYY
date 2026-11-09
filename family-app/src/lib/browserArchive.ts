import {readFile, readFiles, readTree} from './browserStore';

const utf8 = new TextEncoder();
function bytes(value: string): Uint8Array {return utf8.encode(value);}
function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (const octet of data) {
    crc ^= octet;
    for (let i=0;i<8;i++) crc = (crc >>> 1) ^ (-(crc & 1) & 0xedb88320);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function u16(view: DataView, at: number, value: number) {view.setUint16(at,value,true);}
function u32(view: DataView, at: number, value: number) {view.setUint32(at,value,true);}

/** Portable ZIP writer: STORE mode, UTF-8 names, CRC32. No CDN or npm dependency. */
function zip(entries: Array<{name:string;data:Uint8Array}>): Blob {
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0, centralLength=0;
  for (const entry of entries) {
    const filename = bytes(entry.name);
    if (filename.length > 65535 || entry.data.length > 0xffffffff) throw new Error('Файл слишком большой для ZIP.');
    const crc = crc32(entry.data);
    const header = new Uint8Array(30+filename.length);
    const h = new DataView(header.buffer);
    u32(h,0,0x04034b50); u16(h,4,20); u16(h,6,0x0800); u16(h,8,0);
    u32(h,14,crc); u32(h,18,entry.data.length); u32(h,22,entry.data.length);
    u16(h,26,filename.length); header.set(filename,30);
    parts.push(header, entry.data);

    const directory = new Uint8Array(46+filename.length);
    const d = new DataView(directory.buffer);
    u32(d,0,0x02014b50); u16(d,4,20); u16(d,6,20); u16(d,8,0x0800);
    u32(d,16,crc); u32(d,20,entry.data.length); u32(d,24,entry.data.length);
    u16(d,28,filename.length); u32(d,42,offset); directory.set(filename,46);
    central.push(directory);centralLength+=directory.length;
    offset += header.length+entry.data.length;
  }
  if(entries.length>65535)throw new Error('Слишком много файлов для ZIP.');
  const end = new Uint8Array(22), d=new DataView(end.buffer);
  u32(d,0,0x06054b50);u16(d,8,entries.length);u16(d,10,entries.length);
  u32(d,12,centralLength);u32(d,16,offset);
  const all = [...parts,...central,end].map(p =>
    p.buffer.slice(p.byteOffset,p.byteOffset+p.byteLength) as ArrayBuffer);
  return new Blob(all,{type:'application/zip'});
}

function save(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.download = filename;
  anchor.href = url;
  document.body.appendChild(anchor);
  anchor.click();anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url),30000);
}

export async function makeArchive(treeId: string): Promise<Blob> {
  const doc = await readTree(treeId);
  const files = await readFiles(treeId);
  const entries: Array<{name:string;data:Uint8Array}> = [];
  entries.push({name:'tree.json',data:bytes(JSON.stringify(doc,null,2)+'\n')});
  const required = new Set<string>();
  for (const p of doc.persons) {
    if (p._photo?.filename) required.add(p._photo.filename);
    for (const media of p._gallery || []) if(media.filename) required.add(media.filename);
  }
  const missing: string[] = [];
  for (const filename of required) {
    const blob = files.get(filename);
    if (!blob) {missing.push(filename);continue;}
    entries.push({name:'media/'+filename,data:new Uint8Array(await blob.arrayBuffer())});
  }
  let instructions = 'GEN · браузерная резервная копия\n\n';
  instructions += 'tree.json — основной документ. media/ — сохранённые в этом браузере файлы.\n';
  instructions += 'Текущий браузерный этап не генерирует актуальный tree.ged.\n';
  if (missing.length) instructions += '\nОтсутствующие медиафайлы (не были импортированы с JSON):\n'+missing.join('\n')+'\n';
  entries.push({name:'README.txt',data:bytes(instructions)});
  return zip(entries);
}

export async function downloadApi(path: string) {
  const url = new URL(path,'https://local.gen.invalid');
  const parts = url.pathname.split('/').filter(Boolean);
  if (parts[0]!=='api' || parts[1]!=='trees' || !parts[2]) throw new Error('Неизвестный архив.');
  const treeId=parts[2],doc=await readTree(treeId);
  const name=(doc.tree.slug || 'family').replace(/[^a-z0-9-]/g,'-');
  if (parts[3]==='tree.json') {
    save(name+'.json',new Blob([JSON.stringify(doc,null,2)+'\n'],{type:'application/json;charset=utf-8'}));
    return;
  }
  if (parts[3]==='backup.zip') {
    save(name+'.zip',await makeArchive(treeId));
    return;
  }
  if (parts[3]==='export.ged' || parts[3]==='original.ged') {
    throw new Error('Полный GEDCOM-экспорт ещё переносится из Python. Для резервной копии используйте ZIP или JSON.');
  }
  if (parts[3]==='persons' && parts[5]==='media' && parts[7]==='file') {
    const person=doc.persons.find(p=>p.id===parts[4]);
    const item=(person?._gallery || []).find((m:any)=>m.id===parts[6]);
    if(!item)throw new Error('Файл отсутствует.');
    const blob=await readFile(treeId,item.filename);
    if(!blob)throw new Error('Файл не сохранён в этом браузере.');
    save(item.caption || item.filename,blob);
    return;
  }
  throw new Error('Неподдерживаемый формат файла.');
}
