/* Local document readers. No uploads, script/form execution, or remote resources. */
(() => {
 'use strict';
 const MAX=32*1024*1024,decoder=new TextDecoder('utf-8',{fatal:true});
 function xml(text){if(/<!DOCTYPE|<!ENTITY/i.test(text))throw Error('XML с внешними сущностями не поддерживается.');const d=new DOMParser().parseFromString(text,'application/xml');if(d.querySelector('parsererror'))throw Error('Повреждённый XML в таблице.');return d;}
 const nodes=(d,name)=>Array.from(d.getElementsByTagNameNS('*',name));
 function crc32(bytes){let crc=-1;for(const b of bytes){crc^=b;for(let k=0;k<8;k++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^-1)>>>0;}
 async function unzip(bytes,{raw=false}={}){
  const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),files=new Map();let e=-1;
  for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--)if(v.getUint32(i,true)===0x06054b50&&i+22+v.getUint16(i+20,true)===bytes.length){e=i;break;}
  if(e<0||v.getUint16(e+4,true)||v.getUint16(e+6,true))throw Error('Неверный ZIP.');
  const count=v.getUint16(e+10,true),end=v.getUint32(e+16,true)+v.getUint32(e+12,true);let pos=v.getUint32(e+16,true),total=0;
  if(count>2048||end>e)throw Error('Слишком большой каталог ZIP.');
  for(let i=0;i<count;i++){
   if(pos+46>end||v.getUint32(pos,true)!==0x02014b50)throw Error('Повреждённый каталог ZIP.');
   const flags=v.getUint16(pos+8,true),method=v.getUint16(pos+10,true),crc=v.getUint32(pos+16,true),packed=v.getUint32(pos+20,true),size=v.getUint32(pos+24,true),n=v.getUint16(pos+28,true),extra=v.getUint16(pos+30,true),comment=v.getUint16(pos+32,true),offset=v.getUint32(pos+42,true);
   if(pos+46+n+extra+comment>end)throw Error('Обрезанный каталог ZIP.');
   const name=decoder.decode(bytes.subarray(pos+46,pos+46+n));pos+=46+n+extra+comment;total+=size;
   if(flags&1||![0,8].includes(method)||total>MAX||size>MAX||offset+30>bytes.length||/\\|(^|\/)\.\.(\/|$)|^\//.test(name)||files.has(name))throw Error('Неподдерживаемый или слишком большой ZIP.');
   files.set(name,async()=>{
    if(v.getUint32(offset,true)!==0x04034b50)throw Error('Повреждённый файл ZIP.');
    const start=offset+30+v.getUint16(offset+26,true)+v.getUint16(offset+28,true);if(start+packed>bytes.length)throw Error('Обрезанный ZIP.');
    let data=bytes.slice(start,start+packed);
    if(method===8){const reader=new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader(),chunks=[];let length=0;try{for(;;){const r=await reader.read();if(r.done)break;length+=r.value.length;if(length>size||length>MAX)throw Error('Превышен размер распаковки ZIP.');chunks.push(r.value);}}catch(e){await reader.cancel().catch(()=>{});throw e;}data=new Uint8Array(length);let at=0;for(const c of chunks){data.set(c,at);at+=c.length;}}
    if(data.length!==size||crc32(data)!==crc)throw Error('Не совпадает контрольная сумма ZIP.');return raw?data:xml(decoder.decode(data));
   });
  }
  return files;
 }
 function column(address){const m=/^([A-Z]+)[1-9]\d*$/.exec(address||'');if(!m)throw Error('Некорректный адрес ячейки XLSX.');let n=0;for(const c of m[1])n=n*26+c.charCodeAt(0)-64;if(n>100)throw Error('В таблице больше 100 колонок.');return n-1;}
 async function xlsx(bytes){
  const files=await unzip(bytes),get=async name=>files.has(name)?files.get(name)():null;
  const book=await get('xl/workbook.xml'),rels=await get('xl/_rels/workbook.xml.rels');if(!book||!rels)throw Error('Не найден workbook XLSX.');
  const shared=await get('xl/sharedStrings.xml'),strings=shared?nodes(shared,'si').map(si=>nodes(si,'t').map(t=>t.textContent).join('')):[];
  const styles=await get('xl/styles.xml'),formats=new Map(styles?nodes(styles,'numFmt').map(x=>[Number(x.getAttribute('numFmtId')),x.getAttribute('formatCode')]):[]);
  const xfs=styles?nodes(styles,'cellXfs').flatMap(x=>nodes(x,'xf')):[],epoch1904=['1','true'].includes(nodes(book,'workbookPr')[0]?.getAttribute('date1904'));
  const relations=new Map(nodes(rels,'Relationship').filter(x=>x.getAttribute('TargetMode')!=='External').map(x=>[x.getAttribute('Id'),x.getAttribute('Target')]));
  const sheets=nodes(book,'sheet');if(sheets.length>32)throw Error('Больше 32 листов XLSX.');let total=0;const tables=[];
  for(const sheet of sheets){const rid=sheet.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships','id'),target=relations.get(rid);if(!target)continue;
   const path=target.startsWith('/')?target.slice(1):'xl/'+target;if(!/^xl\/worksheets\/[^/]+\.xml$/.test(path))throw Error('Неподдерживаемый путь листа XLSX.');
   const doc=await get(path);if(!doc)throw Error('Не найден лист XLSX.');const rows=[],provenance=[];
   for(const row of nodes(doc,'row')){const values=[],raw=[];
    for(const c of nodes(row,'c')){const index=column(c.getAttribute('r')),type=c.getAttribute('t'),v=nodes(c,'v')[0]?.textContent||'',formula=nodes(c,'f')[0]?.textContent;let text=v;
     if(type==='s'){if(!/^\d+$/.test(v)||Number(v)>=strings.length)throw Error('Неверный индекс sharedStrings.');text=strings[Number(v)];}
     else if(type==='inlineStr')text=nodes(c,'t').map(t=>t.textContent).join('');
     else if(type==='b')text=v==='1'?'TRUE':'FALSE';
     else if(type!=='str'&&type!=='e'&&v){const f=Number(xfs[Number(c.getAttribute('s')||0)]?.getAttribute('numFmtId')),format=formats.get(f)||'';if((f>=14&&f<=22)||(/[dy]/i.test(format.replace(/"[^"]*"|\[[^\]]*\]/g,'')))){const serial=Number(v),base=epoch1904?Date.UTC(1904,0,1):Date.UTC(1899,11,30);if(Number.isFinite(serial)&&serial>=0&&serial<2958465){text=serial===60&&!epoch1904?'Неопределённая дата Excel (60)':new Date(base+Math.floor(serial)*86400000+(base===Date.UTC(1899,11,30)&&serial<60?86400000:0)).toISOString().slice(0,10);}}}
     values[index]=text;raw.push({address:c.getAttribute('r'),type,raw:v,formula:formula??null});
    }
    if(values.some(x=>x?.trim())){if(++total>5000)throw Error('Не больше 5000 строк за импорт.');rows.push(Array.from({length:values.length},(_,i)=>values[i]||''));provenance.push(raw);}
   }
   tables.push({name:sheet.getAttribute('name')||path,rows,provenance});
  }
  return tables;
 }
 let pdfModule;
 async function pdf(bytes){
  pdfModule??=import('./vendor/pdfjs/pdf.min.mjs');const lib=await pdfModule;lib.GlobalWorkerOptions.workerSrc=new URL('./vendor/pdfjs/pdf.worker.min.mjs',location.href).href;
  const task=lib.getDocument({data:bytes.slice(),isEvalSupported:false,enableXfa:false,disableAutoFetch:true,useSystemFonts:true,cMapUrl:new URL('./vendor/pdfjs/cmaps/',location.href).href,cMapPacked:true,standardFontDataUrl:new URL('./vendor/pdfjs/standard_fonts/',location.href).href,wasmUrl:new URL('./vendor/pdfjs/wasm/',location.href).href});try{const document=await task.promise;return {document,close:()=>task.destroy()};}catch(e){await task.destroy();throw e;}
 }
 async function pdfTables(bytes){const {document:d,close}=await pdf(bytes);try{if(d.numPages>100)throw Error('Не больше 100 страниц за импорт.');const tables=[];let count=0;for(let n=1;n<=d.numPages;n++){
   const p=await d.getPage(n),items=(await p.getTextContent()).items.filter(x=>x.str?.trim()),lines=[];if(items.length>20000||items.reduce((n,x)=>n+x.str.length,0)>2000000)throw Error('Слишком много текста на странице PDF.');
   for(const item of items){const y=item.transform[5];let line=lines.find(l=>Math.abs(l.y-y)<3);if(!line){line={y,items:[]};lines.push(line);}line.items.push(item);}
   const rows=lines.sort((a,b)=>b.y-a.y).map(l=>l.items.sort((a,b)=>a.transform[4]-b.transform[4]).map(x=>x.str));if(rows.some(r=>r.length>100))throw Error('На странице PDF больше 100 колонок.');count+=rows.length;if(count>5000)throw Error('Не больше 5000 строк PDF.');tables.push({name:'Страница '+n,rows});
  }return tables;}finally{await close();}}
 async function renderPDF(bytes,pageNumber=1){const {document:d,close}=await pdf(bytes);try{if(pageNumber<1||pageNumber>d.numPages)throw Error('Страница PDF не найдена.');const p=await d.getPage(pageNumber),base=p.getViewport({scale:1}),scale=Math.min(1.5,1500/base.width,2000/base.height),viewport=p.getViewport({scale}),canvas=document.createElement('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);canvas.setAttribute('aria-label','Страница '+pageNumber+' из '+d.numPages);await p.render({canvasContext:canvas.getContext('2d'),viewport}).promise;return {canvas,pages:d.numPages};}finally{await close();}}
 function csvTable(text){const counts={';':0,',':0,'\t':0};let inQuote=false;for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(inQuote&&text[i+1]==='"')i++;else inQuote=!inQuote;}else if(!inQuote){if(c==='\n'||c==='\r')break;if(c in counts)counts[c]++;}}const sep=Object.keys(counts).sort((a,b)=>counts[b]-counts[a])[0];const rows=[];let row=[],field='',quoted=false;for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){field+='"';i++;}else quoted=!quoted;}else if(c===sep&&!quoted){row.push(field);if(row.length>100)throw Error('Не больше 100 колонок CSV.');field='';}else if(/[\r\n]/.test(c)&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(field);if(row.some(x=>x.trim()))rows.push(row);row=[];field='';}else field+=c;}if(quoted)throw Error('Незакрытая кавычка CSV.');row.push(field);if(row.some(x=>x.trim()))rows.push(row);if(rows.length>5001)throw Error('Не больше 5000 строк за импорт.');return [{name:'CSV',rows}];}
 async function read(file){if(file.size>2*1024*1024)throw Error('Не больше 2 МиБ на файл.');const bytes=new Uint8Array(await file.arrayBuffer()),extension=file.name.split('.').pop().toLowerCase();let tables;
  if(extension==='xlsx')tables=await xlsx(bytes);else if(extension==='pdf')tables=await pdfTables(bytes);else if(extension==='csv')tables=csvTable(decoder.decode(bytes).replace(/^\uFEFF/,''));else throw Error('Выберите PDF, XLSX или CSV.');
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');return {bytes,tables,hash,name:file.name,extension};
 }
 window.HumanDocuments={unzip,read,renderPDF,xlsx,csvTable};
})();
