/** Import GEDCOM 5.5.1 / 7.x in the browser without dropping unmodeled records. */
import {
  GedcomError, type GedNode, type GedParseResult, EVENT_TAGS, PERSON_FIELDS, PEDIGREES,
  gedNode, children, first, gedText, gedValue, warning, noteText, nameParts, cloneGed
} from './gedcomCore';

const LINE=/^(0|[1-9]\d*) (?:(@[^@\s]+@) )?([A-Za-z_][A-Za-z_0-9]*)(?: (.*))?$/;
const ascii=new TextDecoder('iso-8859-1');
const uuid=()=>crypto.randomUUID().replace(/-/g,'');

function splitBytes(data:Uint8Array):Uint8Array[] {
  const parts:Uint8Array[]=[];
  let start=0;
  for(let i=0;i<data.length;i++){
    if(data[i]===10 || data[i]===13){
      parts.push(data.slice(start,i));
      if(data[i]===13&&data[i+1]===10)i++;
      start=i+1;
    }
  }
  parts.push(data.slice(start));
  return parts;
}
/** Recover a legacy byte-split UTF-8 character across a CONC continuation.
 * Never "repair" arbitrary invalid bytes; only a valid prefix on a legal
 * adjacent CONC line is accepted.
 */
function repairSplitUtf8Conc(data:Uint8Array):{data:Uint8Array;count:number} {
  const lines=splitBytes(data),encoder=new TextEncoder();
  let count=0;
  const parseHeader=(line:Uint8Array)=>{
    const text=ascii.decode(line);
    const match=text.match(/^\s*(\d+) (?:(@[^@\s]+@) )?([A-Za-z_][A-Za-z_0-9]*)(?: )?/);
    return match?{level:+match[1],tag:match[3].toUpperCase(),size:match[0].length}:null;
  };
  for(let i=1;i<lines.length;i++){
    const previous=parseHeader(lines[i-1]),current=parseHeader(lines[i]);
    if(!previous||!current||current.tag!=='CONC')continue;
    if(!(previous.level===current.level-1 ||
      (previous.level===current.level&&['CONT','CONC'].includes(previous.tag))))continue;
    const prev=lines[i-1],next=lines[i];
    const nextValue=next.slice(current.size);
    if(!nextValue.length)continue;
    for(let n=1;n<=3 && prev.length-n>=previous.size;n++){
      const suffix=prev.slice(-n),lead=suffix[0];
      const width=lead>=0xf0&&lead<=0xf4?4:lead>=0xe0&&lead<=0xef?3:lead>=0xc2&&lead<=0xdf?2:0;
      if(!width||width<=n)continue;
      if(![...suffix.slice(1)].every(b=>b>=0x80&&b<=0xbf))continue;
      const remainder=nextValue.slice(0,width-n);
      if(remainder.length!==width-n || ![...remainder].every(b=>b>=0x80&&b<=0xbf))continue;
      try{new TextDecoder('utf-8',{fatal:true}).decode(new Uint8Array([...suffix,...remainder]));}
      catch{continue;}
      lines[i-1]=prev.slice(0,-n);
      lines[i]=new Uint8Array([...next.slice(0,current.size),...suffix,...nextValue]);
      count++;break;
    }
  }
  if(!count)return {data,count};
  const result:Uint8Array[]=[];
  for(let i=0;i<lines.length;i++){
    if(i)result.push(encoder.encode('\n'));
    result.push(lines[i]);
  }
  const total=result.reduce((sum,row)=>sum+row.length,0),output=new Uint8Array(total);
  let offset=0;for(const chunk of result){output.set(chunk,offset);offset+=chunk.length;}
  return {data:output,count};
}
function charsetAlias(name:string):string|null {
  const clean=name.toLowerCase().replace(/[-_ ]/g,'');
  return ({
    utf8:'utf-8',utf8sig:'utf-8',ascii:'ascii',unicode:'utf-16le',
    utf16:'utf-16le',utf16le:'utf-16le',utf16be:'utf-16be',
    cp1251:'windows-1251',windows1251:'windows-1251'
  } as Record<string,string>)[clean] || null;
}
function decode(data:Uint8Array, override:string|undefined,warnings:string[]):string {
  if(!data.length)throw new GedcomError('Файл GEDCOM пуст.');
  if((data[0]===0&&data[1]===0&&data[2]===0xfe&&data[3]===0xff) ||
     (data[0]===0xff&&data[1]===0xfe&&data[2]===0&&data[3]===0))
    throw new GedcomError('UTF-32 не поддерживается. Пересохраните GEDCOM в UTF-8.');
  const probe=ascii.decode(data.slice(0,65536));
  const declared=probe.match(/(?:^|[\r\n])1 CHAR ([^\r\n]+)/)?.[1]?.trim().toUpperCase()||'';
  let charset:string;
  if(override){
    const value=charsetAlias(override);
    if(!value)throw new GedcomError('Кодировка '+override+' не поддерживается. Нужна UTF-8, UTF-16, ASCII или CP1251.');
    charset=value;
    warning(warnings,'ENCODING_OVERRIDE','Файл прочитан в явно выбранной кодировке '+override+'.');
  }else if(data[0]===0xef&&data[1]===0xbb&&data[2]===0xbf)charset='utf-8';
  else if(data[0]===0xff&&data[1]===0xfe)charset='utf-16le';
  else if(data[0]===0xfe&&data[1]===0xff)charset='utf-16be';
  else if(data[0]===0x30&&data[1]===0&&data[2]===0x20&&data[3]===0)charset='utf-16le';
  else if(data[0]===0&&data[1]===0x30&&data[2]===0&&data[3]===0x20)charset='utf-16be';
  else if(declared==='ASCII')charset='ascii';
  else if(!declared || declared==='UTF-8')charset='utf-8';
  else if(declared==='ANSEL')throw new GedcomError('Кодировка ANSEL не поддерживается. Выгрузите дерево в UTF-8.');
  else if(declared==='UNICODE')throw new GedcomError('Для UNICODE выберите явно UTF-16LE или UTF-16BE.');
  else throw new GedcomError('Кодировка '+declared+' не определена автоматически. Для Windows-1251 выберите CP1251.');

  let text:string;
  try{text=new TextDecoder(charset,{fatal:true}).decode(data);}
  catch{
    const fix=charset==='utf-8'?repairSplitUtf8Conc(data):{data,count:0};
    if(!fix.count)throw new GedcomError('Не удалось прочитать GEDCOM в кодировке '+charset+'. Проверьте исходный файл.');
    try{text=new TextDecoder(charset,{fatal:true}).decode(fix.data);}
    catch{throw new GedcomError('Неверная кодировка или повреждённый файл GEDCOM.');}
    warning(warnings,'SPLIT_UTF8_CONC','Исправлены разрывы UTF-8 между строками CONC: '+fix.count+'. Исходник не изменён.');
  }
  text=text.replace(/^\ufeff/,'');
  if(text.includes('\0'))throw new GedcomError('В файле есть нулевые символы. Проверьте кодировку.');
  return text;
}
function repairHtmlNotes(text:string,warnings:string[]):string {
  const lines=text.split(/\r\n|\r|\n/);
  let level:number|null=null,count=0;
  for(let i=0;i<lines.length;i++){
    const trimmed=lines[i].replace(/^[ \t]+/,'');
    const match=trimmed.match(LINE);
    if(match){
      const tag=match[3].toUpperCase(),n=+match[1];
      if(['NOTE','SNOTE'].includes(tag) && (match[4]||'').trimStart().startsWith('<'))level=n;
      else if(!(level!==null&&n===level+1&&['CONC','CONT'].includes(tag)))level=null;
    }else if(level!==null && trimmed.startsWith('<')){
      lines[i]=(level+1)+' CONT '+lines[i];count++;
    }
  }
  if(count)warning(warnings,'MULTILINE_HTML_NOTE','Восстановлены переносы в HTML-заметках: '+count+'. Исходный файл не изменён.');
  return lines.join('\n');
}
function parseNodes(text:string,warnings:string[]):GedNode[] {
  const records:GedNode[]=[],stack:GedNode[]=[],used=new Set<string>();
  let ended=false;
  for(const [index,raw] of text.split(/\r\n|\r|\n/).entries()){
    if(!raw.trim())continue;
    const match=raw.replace(/^[ \t]+/,'').match(LINE),number=index+1;
    if(!match)throw new GedcomError('Строка '+number+': неверная запись GEDCOM (уровень, тег или значение).');
    const level=Number(match[1]);
    if(match[1].length>3||level>128)throw new GedcomError('Строка '+number+': уровень вложенности превышает 128.');
    if(level>stack.length)throw new GedcomError('Строка '+number+': пропущен родительский уровень.');
    if(ended)throw new GedcomError('Строка '+number+': данные после TRLR.');
    const xref=match[2]||null,tag=match[3].toUpperCase(),value=match[4]||'';
    if(xref){
      if(level!==0)throw new GedcomError('Строка '+number+': идентификатор разрешён только на уровне 0.');
      if(used.has(xref)||xref==='@VOID@')throw new GedcomError('Строка '+number+': повторяющийся или зарезервированный '+xref+'.');
      used.add(xref);
    }
    const node=gedNode(tag,value,xref);node.line=number;
    if(level===0){records.push(node);if(tag==='TRLR')ended=true;}
    else stack[level-1].children.push(node);
    stack.length=level;stack.push(node);
  }
  if(!records.length||records[0].tag!=='HEAD')throw new GedcomError('GEDCOM должен начинаться с записи 0 HEAD.');
  if(records.slice(1).some(r=>r.tag==='HEAD'))throw new GedcomError('Файл содержит несколько HEAD.');
  if(!ended)warning(warnings,'MISSING_TRAILER','Отсутствует TRLR; при экспорте он будет восстановлен.');
  return records;
}
function noteSlots(record:GedNode,version:string) {
  const slots:Record<string,number>={},unmarked:number[]=[];
  for(const [i,child] of record.children.entries()){
    if(!['NOTE','SNOTE','_BIO','_BIOGRAPHY'].includes(child.tag))continue;
    let kind=gedValue(child,'_GEN_KIND',version).toLowerCase();
    if(['_BIO','_BIOGRAPHY'].includes(child.tag))kind='biography';
    if(kind){
      if(['biography','notes'].includes(kind)&&slots[kind]===undefined)slots[kind]=i;
    }else unmarked.push(i);
  }
  for(const key of ['biography','notes'])if(slots[key]===undefined&&unmarked.length)slots[key]=unmarked.shift()!;
  return slots;
}
function parsePerson(record:GedNode,records:Map<string,GedNode>,version:string,warnings:string[]) {
  const p:Record<string,any>=Object.fromEntries(PERSON_FIELDS.map(key=>[key,'']));
  Object.assign(p,{id:uuid(),gedcom_id:record.xref,sex:'U',is_living:true,events:[],
    photo_url:null,revision:1,updated_at:'',biography_format:'text'});
  const bindings=noteSlots(record,version);
  for(const [tag,field] of [['NAME','name'],['BIRT','birth'],['DEAT','death'],['OCCU','occupation']]){
    const i=record.children.findIndex(n=>n.tag===tag);
    if(i>=0)bindings[field]=i;
  }
  const nodes=Object.fromEntries(Object.entries(bindings).map(([key,i])=>[key,record.children[i]])) as Record<string,GedNode>;
  [p.given_name,p.surname,p.patronymic]=nameParts(nodes.name,version);
  p.patronymic ||= gedValue(record,'_PATR',version)||gedValue(record,'_PATRONYMIC',version);
  for(const [i,n] of record.children.entries()){
    if(n.tag==='NAME'&&i!==bindings.name&&['birth','maiden'].includes(gedValue(n,'TYPE',version).toLowerCase())){
      p.maiden_name=nameParts(n,version)[1];bindings.maiden=i;break;
    }
  }
  const sex=(gedValue(record,'_GEN_SEX',version)||gedValue(record,'SEX',version)).toUpperCase();
  p.sex=['M','F','U','X'].includes(sex)?sex:'U';
  for(const kind of ['birth','death']){
    if(nodes[kind]){
      p[kind+'_date']=gedValue(nodes[kind],'DATE',version);
      p[kind+'_place']=gedValue(nodes[kind],'PLAC',version);
    }
  }
  p.is_living=!nodes.death||nodes.death.value.toUpperCase()==='N';
  p.occupation=gedText(nodes.occupation,version);
  for(const kind of ['biography','notes'])p[kind]=noteText(nodes[kind],records,version,warnings);
  const event_nodes:Record<string,number>={};
  const excluded=new Set([bindings.birth,bindings.death,bindings.occupation]);
  for(const [i,n] of record.children.entries()){
    if(!EVENT_TAGS.has(n.tag)||excluded.has(i))continue;
    let description=gedText(n,version);
    if(description==='Y'&&!['EVEN','FACT'].includes(n.tag))description='';
    const event={id:uuid(),tag:n.tag,type:gedValue(n,'TYPE',version),date:gedValue(n,'DATE',version),
      place:gedValue(n,'PLAC',version),description};
    p.events.push(event);event_nodes[event.id]=i;
  }
  if(record.children.filter(n=>['NOTE','SNOTE'].includes(n.tag)).length>2)
    warning(warnings,'ADDITIONAL_NOTES','У '+record.xref+' больше двух заметок; дополнительные структуры сохранены.',record);
  if(children(record,'OBJE').length)warning(warnings,'MEDIA_REFERENCE',
    'В исходной записи '+record.xref+' есть ссылки на медиа; GEDCOM не содержит сами фотографии.',record);
  p._raw={node:cloneGed(record),bindings,event_nodes,
    baseline:cloneGed(Object.fromEntries(Object.entries(p).filter(([key])=>!key.startsWith('_'))))};
  return p;
}
function pedigree(p:GedNode,xref:string,version:string) {
  const link=children(p,'FAMC').find(n=>n.value===xref);
  const v=gedValue(link,'PEDI',version).toLowerCase();
  return PEDIGREES.has(v)?v:'unknown';
}
function parseFamilies(records:GedNode[],persons:Record<string,any>[],version:string,warnings:string[]) {
  const people=new Map(persons.filter(p=>p.gedcom_id).map(p=>[p.gedcom_id,p]));
  const result:Record<string,any>[]=[],byXref=new Map<string,Record<string,any>>();
  const recordMap=new Map(records.filter(n=>n.xref).map(n=>[n.xref!,n]));
  function personId(link:GedNode|undefined):string|null {
    if(!link||link.value==='@VOID@')return null;
    const p=people.get(link.value);
    if(!p)warning(warnings,'UNRESOLVED_REFERENCE','Человек '+link.value+' не найден; ссылка сохранена.',link);
    return p?.id||null;
  }
  for(const record of records.filter(n=>n.tag==='FAM')){
    const f:Record<string,any>={
      id:uuid(),gedcom_id:record.xref,revision:1,
      partner1_id:personId(first(record,'HUSB')),partner2_id:personId(first(record,'WIFE')),
      children:[],marriage_date:'',marriage_place:'',divorce_date:'',notes:''
    };
    if(f.partner1_id&&f.partner1_id===f.partner2_id){
      f.partner2_id=null;warning(warnings,'DUPLICATE_MEMBER','Один человек указан дважды как партнёр.',record);
    }
    for(const link of children(record,'CHIL')){
      const child=personId(link);
      if(child&&!new Set([f.partner1_id,f.partner2_id]).has(child)&&!f.children.some((c:any)=>c.person_id===child)){
        f.children.push({person_id:child,pedigree:pedigree(people.get(link.value)!._raw.node,record.xref||'',version)});
      }else if(child)warning(warnings,'DUPLICATE_MEMBER','Повторное членство сохранено в исходной структуре.',link);
    }
    const bindings:Record<string,number>={};
    for(const [tag,field] of [['MARR','marriage'],['DIV','divorce'],['NOTE','notes'],['SNOTE','notes']]){
      if(bindings[field]!==undefined)continue;
      const index=record.children.findIndex(n=>n.tag===tag);
      if(index>=0)bindings[field]=index;
    }
    for(const key of ['marriage','divorce']){
      if(bindings[key]!==undefined){
        const event=record.children[bindings[key]];
        f[key+'_date']=gedValue(event,'DATE',version);
        if(key==='marriage')f.marriage_place=gedValue(event,'PLAC',version);
      }
    }
    if(bindings.notes!==undefined)f.notes=noteText(record.children[bindings.notes],recordMap,version,warnings);
    f._raw={node:cloneGed(record),bindings};
    result.push(f);
    if(record.xref)byXref.set(record.xref,f);
  }
  if(!result.length&&persons.some(p=>p._raw.node.children.some((n:GedNode)=>
    ['FAMC','FAMS'].includes(n.tag)&&n.value!=='@VOID@')))
    warning(warnings,'MISSING_FAMILY_RECORDS','Есть ссылки на семьи, но отсутствуют записи FAM.');
  for(const p of persons){
    for(const link of p._raw.node.children as GedNode[]){
      if(!['FAMC','FAMS'].includes(link.tag)||link.value==='@VOID@')continue;
      const f=byXref.get(link.value);
      if(!f){warning(warnings,'UNRESOLVED_REFERENCE','Семья '+link.value+' не найдена.',link);continue;}
      const partners=new Set([f.partner1_id,f.partner2_id]);
      if(link.tag==='FAMC'){
        if(partners.has(p.id))warning(warnings,'SELF_PARENT','Ребёнок указан в семье как родитель.',link);
        else if(!f.children.some((c:any)=>c.person_id===p.id)){
          f.children.push({person_id:p.id,pedigree:pedigree(p._raw.node,link.value,version)});
          warning(warnings,'RECIPROCAL_LINK','Восстановлена обратная связь ребёнка '+link.value+'.',link);
        }
      }else if(!partners.has(p.id)){
        const slot=!f.partner1_id?'partner1_id':!f.partner2_id?'partner2_id':null;
        if(slot&&!f.children.some((c:any)=>c.person_id===p.id)){
          f[slot]=p.id;warning(warnings,'RECIPROCAL_LINK','Восстановлена обратная связь партнёра '+link.value+'.',link);
        }else warning(warnings,'UNREPRESENTED_PARTNER','Оба партнёра уже заняты; ссылка сохранена.',link);
      }
    }
  }
  const byId=new Map(persons.map(p=>[p.id,p]));
  for(const f of result){
    for(const id of [f.partner1_id,f.partner2_id]){
      if(!id)continue;
      const p=byId.get(id);
      if(p&&!children(p._raw.node,'FAMS').some((link:GedNode)=>link.value===f.gedcom_id))
        warning(warnings,'RECIPROCAL_LINK','Восстановлена ссылка партнёра на '+f.gedcom_id+'.');
    }
    for(const c of f.children){
      const p=byId.get(c.person_id);
      if(p&&!children(p._raw.node,'FAMC').some((link:GedNode)=>link.value===f.gedcom_id))
        warning(warnings,'RECIPROCAL_LINK','Восстановлена ссылка ребёнка на '+f.gedcom_id+'.');
    }
    f._raw.baseline=cloneGed(Object.fromEntries(Object.entries(f).filter(([key])=>!key.startsWith('_'))));
  }
  return result;
}
function warnCycles(persons:Record<string,any>[],families:Record<string,any>[],warnings:string[]) {
  const edges=new Map(persons.map(p=>[p.id,new Set<string>()]));
  const indegree=new Map(persons.map(p=>[p.id,0]));
  for(const f of families)for(const parent of [f.partner1_id,f.partner2_id])if(parent){
    for(const child of f.children){
      const id=child.person_id;
      if(!edges.get(parent)?.has(id)){
        edges.get(parent)?.add(id);indegree.set(id,(indegree.get(id)||0)+1);
      }
    }
  }
  const queue=[...indegree.entries()].filter(([,count])=>count===0).map(([id])=>id);
  let seen=0;
  for(let i=0;i<queue.length;i++){
    const id=queue[i];seen++;
    for(const child of edges.get(id)||[]){
      const remaining=(indegree.get(child)||0)-1;indegree.set(child,remaining);
      if(!remaining)queue.push(child);
    }
  }
  if(seen<persons.length)warning(warnings,'ANCESTRY_CYCLE','Исходный GEDCOM содержит цикл родительства.');
}
export function parseGedcom(bytes:Uint8Array,override?:string):GedParseResult {
  const warnings:string[]=[];
  const text=repairHtmlNotes(decode(bytes,override,warnings),warnings);
  const records=parseNodes(text,warnings);
  const head=records[0],gedc=first(head,'GEDC');
  const version=gedc?gedValue(gedc,'VERS','5.5.1'):'';
  if(version!=='5.5.1'&&!/^7\.\d+(?:\.\d+)?$/.test(version))
    throw new GedcomError('Версия GEDCOM '+(version||'(не указана)')+' не поддерживается. Нужна 5.5.1 или 7.x.');
  if(version.startsWith('7.')&&override&&charsetAlias(override)!=='utf-8')
    warning(warnings,'NONSTANDARD_ENCODING','GEDCOM 7 должен быть UTF-8; при экспорте кодировка будет исправлена.');
  const recordMap=new Map(records.filter(r=>r.xref).map(r=>[r.xref!,r]));
  const persons=records.filter(n=>n.tag==='INDI').map(n=>parsePerson(n,recordMap,version,warnings));
  const families=parseFamilies(records,persons,version,warnings);
  const lookup=new Map([...persons,...families].filter(x=>x.gedcom_id).map(x=>[x.gedcom_id,x]));
  const others:GedNode[]=[],order:Record<string,any>[]=[];
  let anonPerson=0,anonFamily=0;
  const peopleWithout=persons.filter(p=>!p.gedcom_id),familiesWithout=families.filter(f=>!f.gedcom_id);
  for(const n of records.slice(1)){
    if(n.tag==='TRLR')continue;
    if(n.tag==='INDI'||n.tag==='FAM'){
      const entity=n.xref?lookup.get(n.xref):n.tag==='INDI'?peopleWithout[anonPerson++]:familiesWithout[anonFamily++];
      if(entity)order.push({kind:n.tag,id:entity.id});
    }else{order.push({kind:'other',index:others.length});others.push(cloneGed(n));}
  }
  warnCycles(persons,families,warnings);
  return {
    persons,families,warnings,
    metadata:{
      gedcom_version:version,header:cloneGed(head),other_records:others,
      record_order:order,known_xrefs:[...persons,...families].map(e=>e.gedcom_id).filter(Boolean)
    }
  };
}
