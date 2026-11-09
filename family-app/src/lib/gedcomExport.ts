/** Browser GEDCOM exporter. Edits only modeled fields of imported source nodes. */
import {
  GedcomError, type GedNode, gedNode, first, children, gedText, gedValue,
  nameParts, cloneGed, baselineChanged, namedBindings, setGedText, setGedChild,
  EVENT_TAGS, PEDIGREES, isTag, isXref
} from './gedcomCore';

function removeChild(parent:GedNode,node:GedNode|undefined) {
  if(!node)return;
  const index=parent.children.indexOf(node);
  if(index!==-1)parent.children.splice(index,1);
}
function rewriteName(name:GedNode,given:string,surname:string,patronymic:string,
  version:string,keepGiven=false) {
  const pieces=gedText(name,version).split('/');
  const suffix=pieces.length===3 ? pieces[2] :
    gedValue(name,'NSFX',version) ? ' '+gedValue(name,'NSFX',version) : '';
  let givenText=[given,patronymic].filter(Boolean).join(' ');
  let prefix=gedValue(name,'NPFX',version);
  let surnamePrefix=gedValue(name,'SPFX',version);
  if(pieces.length===3){
    const [oldGiven,oldSurname,oldPatronymic]=nameParts(name,version);
    const oldGivenText=[oldGiven,oldPatronymic].filter(Boolean).join(' ');
    if(!prefix&&oldGivenText&&pieces[0].trimEnd().endsWith(oldGivenText))
      prefix=pieces[0].trimEnd().slice(0,-oldGivenText.length).trim();
    if(!surnamePrefix&&oldSurname&&pieces[1].endsWith(oldSurname))
      surnamePrefix=pieces[1].slice(0,-oldSurname.length).trim();
  }
  if(prefix&&givenText!==prefix&&!givenText.startsWith(prefix+' '))
    givenText=[prefix,givenText].filter(Boolean).join(' ');
  if(surnamePrefix&&surname!==surnamePrefix&&!surname.startsWith(surnamePrefix+' '))
    surname=[surnamePrefix,surname].filter(Boolean).join(' ');
  const left=keepGiven&&pieces.length===3?pieces[0]:givenText+(givenText?' ':'');
  setGedText(name,left+'/'+surname+'/'+suffix,version);
}
function updateNote(parent:GedNode,old:GedNode|undefined,value:string,kind:string,version:string) {
  if(!value){removeChild(parent,old);return;}
  let item=old;
  if(!item){item=gedNode('NOTE');parent.children.push(item);}
  item.tag='NOTE';
  setGedText(item,value,version);
  setGedChild(item,'_GEN_KIND',kind.toUpperCase(),version);
  if(first(item,'MIME'))setGedChild(item,'MIME','text/plain',version);
}
function markNotes(parent:GedNode,bindings:Record<string,GedNode>,version:string) {
  for(const child of parent.children){
    if(!['NOTE','SNOTE','_BIO','_BIOGRAPHY'].includes(child.tag))continue;
    const kind=child===bindings.biography?'biography':
      child===bindings.notes?'notes':'additional';
    if(kind!=='additional'||!gedValue(child,'_GEN_KIND',version))
      setGedChild(child,'_GEN_KIND',kind.toUpperCase(),version);
  }
}
function updateEvent(item:GedNode,event:Record<string,any>,version:string) {
  const tag=String(event.tag||'EVEN').toUpperCase();
  if(!isTag(tag)||(!EVENT_TAGS.has(tag)&&!tag.startsWith('_')))
    throw new GedcomError('Недопустимый тег события '+tag+'.');
  item.tag=tag;
  let description=String(event.description||'');
  if(!description&&!['EVEN','FACT','OCCU','RESI'].includes(tag))description='Y';
  setGedText(item,description,version);
  for(const [field,key] of [['TYPE','type'],['DATE','date'],['PLAC','place']]){
    setGedChild(item,field,String(event[key]||''),version);
  }
}
function editPerson(person:Record<string,any>,xref:string,version:string):GedNode {
  const raw=person._raw||{};
  const node:GedNode=cloneGed(raw.node||gedNode('INDI'));
  node.xref=xref;
  const bindings=namedBindings(person,node);
  const events=new Map<string,GedNode>();
  for(const [id,index] of Object.entries(raw.event_nodes||{})){
    if(Number.isInteger(index) && (index as number)>=0&&(index as number)<node.children.length)
      events.set(id,node.children[index as number]);
  }
  if(baselineChanged(person,'given_name','surname','patronymic')){
    let name=bindings.name;
    if(!name){name=gedNode('NAME');node.children.unshift(name);}
    const given=String(person.given_name||''),surname=String(person.surname||'');
    const patronymic=String(person.patronymic||'');
    rewriteName(name,given,surname,patronymic,version,
      !baselineChanged(person,'given_name','patronymic'));
    setGedChild(name,'GIVN',given,version);
    setGedChild(name,'SURN',surname,version);
    setGedChild(name,'_PATR',patronymic,version);
    for(const tag of ['_PATR','_PATRONYMIC']){
      for(const item of [...children(node,tag)])removeChild(node,item);
    }
    if(first(name,'_PATRONYMIC'))
      setGedChild(name,'_PATRONYMIC',patronymic,version);
  }
  if(baselineChanged(person,'maiden_name')){
    let maiden=bindings.maiden;
    if(person.maiden_name){
      if(!maiden){maiden=gedNode('NAME');node.children.push(maiden);}
      rewriteName(maiden,String(person.given_name||''),String(person.maiden_name||''),
        String(person.patronymic||''),version,true);
      setGedChild(maiden,'SURN',String(person.maiden_name),version);
      setGedChild(maiden,'TYPE',version.startsWith('7.')?'BIRTH':'birth',version);
    }else removeChild(node,maiden);
  }
  if(baselineChanged(person,'sex')){
    const sex=String(person.sex||'U');
    if(!['M','F','U','X'].includes(sex))throw new GedcomError('Недопустимое значение пола '+sex+'.');
    setGedChild(node,'SEX',sex==='X'&&!version.startsWith('7.')?'U':sex,version);
    setGedChild(node,'_GEN_SEX',sex==='X'&&!version.startsWith('7.')?'X':'',version);
  }
  for(const [kind,tag] of [['birth','BIRT'],['death','DEAT']]){
    const fields=[kind+'_date',kind+'_place',...(kind==='death'?['is_living']:[])];
    if(!baselineChanged(person,...fields))continue;
    let event=bindings[kind];
    if(kind==='death'&&person.is_living){removeChild(node,event);continue;}
    const date=String(person[kind+'_date']||''),place=String(person[kind+'_place']||'');
    if(!event&&(date||place||(kind==='death'&&!person.is_living))){
      event=gedNode(tag,'Y');node.children.push(event);
    }
    if(event){
      setGedChild(event,'DATE',date,version);
      setGedChild(event,'PLAC',place,version);
      if(kind==='death'&&event.value==='N')event.value='Y';
    }
  }
  if(baselineChanged(person,'occupation'))
    setGedChild(node,'OCCU',String(person.occupation||''),version);
  for(const kind of ['biography','notes']){
    if(baselineChanged(person,kind))
      updateNote(node,bindings[kind],String(person[kind]||''),kind,version);
  }
  if(baselineChanged(person,'biography','notes'))markNotes(node,bindings,version);
  if(baselineChanged(person,'events')){
    const newEvents=Array.isArray(person.events)?person.events:[];
    const baseline=new Map((raw.baseline?.events||[]).map((e:any)=>[e.id,e]));
    const wanted=new Set(newEvents.map((e:any)=>e.id));
    for(const [id,old] of events)if(!wanted.has(id))removeChild(node,old);
    for(const event of newEvents){
      let original=events.get(event.id);
      if(!original){original=gedNode('EVEN');node.children.push(original);}
      if(JSON.stringify(event)!==JSON.stringify(baseline.get(event.id)))
        updateEvent(original,event,version);
    }
  }
  return node;
}
function editFamily(family:Record<string,any>,xref:string,version:string):GedNode {
  const n:GedNode=cloneGed(family._raw?.node||gedNode('FAM'));
  n.xref=xref;
  const bindings=namedBindings(family,n);
  for(const [kind,tag] of [['marriage','MARR'],['divorce','DIV']]){
    const fields=[kind+'_date',...(kind==='marriage'?['marriage_place']:[])];
    if(!baselineChanged(family,...fields))continue;
    let event=bindings[kind];
    const date=String(family[kind+'_date']||'');
    const place=kind==='marriage'?String(family.marriage_place||''):'';
    if(!event&&(date||place)){
      event=gedNode(tag,tag==='MARR'?'Y':'');n.children.push(event);
    }
    if(event){
      setGedChild(event,'DATE',date,version);
      if(kind==='marriage')setGedChild(event,'PLAC',place,version);
    }
  }
  if(baselineChanged(family,'notes'))
    updateNote(n,bindings.notes,String(family.notes||''),'notes',version);
  return n;
}
function syncLinks(n:GedNode,tag:string,desired:Map<string,string|null>,
  known:Set<string>,version:string) {
  const present=new Set<string>();
  for(const link of [...children(n,tag)]){
    const xref=link.value;
    if(!desired.has(xref)){
      if(known.has(xref))removeChild(n,link);
      continue;
    }
    if(present.has(xref)){removeChild(n,link);continue;}
    present.add(xref);
    if(tag==='FAMC'){
      const old=gedValue(link,'PEDI',version).toLowerCase();
      const normalized=PEDIGREES.has(old)?old:'unknown';
      const pedigree=desired.get(xref)||'unknown';
      if(normalized!==pedigree)
        setGedChild(link,'PEDI',PEDIGREES.has(pedigree)
          ?version.startsWith('7.')?pedigree.toUpperCase():pedigree:'',version);
    }
  }
  for(const [xref,pedigree] of desired){
    if(present.has(xref))continue;
    const link=gedNode(tag,xref);
    if(tag==='FAMC'&&pedigree&&PEDIGREES.has(pedigree))
      setGedChild(link,'PEDI',version.startsWith('7.')?pedigree.toUpperCase():pedigree,version);
    n.children.push(link);
  }
}
function removeEventFamilyLinks(n:GedNode,removed:Set<string>) {
  for(const event of [...n.children]){
    if(!['BIRT','CHR','ADOP','SLGC'].includes(event.tag))continue;
    const before=event.children.length;
    event.children=event.children.filter(child=>!(child.tag==='FAMC'&&removed.has(child.value)));
    if(before!==event.children.length&&!event.children.length&&!event.value){
      if(event.tag==='SLGC')removeChild(n,event);
      else event.value='Y';
    }
  }
}
function allocateXrefs(items:Record<string,any>[],prefix:string,used:Set<string>) {
  const result=new Map<string,string>();
  for(const item of items){
    let xref=item.gedcom_id as string|null;
    if(xref&&!isXref(xref))throw new GedcomError('Недопустимый идентификатор GEDCOM '+xref+'.');
    if(xref&&used.has(xref))throw new GedcomError('Повторяющийся идентификатор '+xref+'.');
    if(!xref){
      // New IDs use UUID-derived stable references. Imported XREFs are retained.
      const id=String(item.id).toUpperCase().replace(/[^A-Z0-9]/g,'');
      const stem=prefix+(id||'NEW').slice(0,20);
      xref='@'+stem+'@';
      let number=1;
      while(used.has(xref))xref='@'+stem+'_'+(number++)+'@';
    }
    used.add(xref);result.set(item.id,xref);
  }
  return result;
}
function mediaName(filename:string):string {
  if(!/^[A-Za-z0-9_.-]+$/.test(filename)||filename.startsWith('.')||filename.includes('..'))
    throw new GedcomError('Небезопасное имя файла семейного архива.');
  return 'media/'+filename;
}
function appendMedia(person:Record<string,any>,n:GedNode,others:GedNode[],
  used:Set<string>,version:string) {
  const media:{path:string;mime:string;id:string;caption?:string;description?:string;date?:string;place?:string}[]=[];
  if(person._photo?.filename)media.push({
    path:mediaName(person._photo.filename),mime:person._photo.mime_type||'image/jpeg',
    id:'portrait'
  });
  for(const item of person._gallery||[]){
    if(!item.filename)continue;
    media.push({path:mediaName(item.filename),mime:item.mime_type||'application/octet-stream',
      id:String(item.id||item.filename),caption:item.caption,description:item.description,
      date:item.date,place:item.place});
  }
  for(const item of media){
    const token=(String(person.id)+item.id).toUpperCase().replace(/[^A-Z0-9]/g,'');
    const stem='O'+token.slice(0,20);
    let xref='@'+stem+'@',counter=1;
    while(used.has(xref))xref='@'+stem+'_'+(counter++)+'@';
    used.add(xref);
    const mediaNode=gedNode('OBJE','',xref),file=gedNode('FILE',item.path);
    const ext=item.path.split('.').pop()?.toLowerCase()||'';
    const fmt=version.startsWith('7.')?item.mime:(ext==='jpg'?'jpeg':ext);
    file.children.push(gedNode('FORM',fmt));
    if(item.caption)setGedChild(file,'TITL',item.caption,version);
    mediaNode.children.push(file);
    for(const [key,tag] of [['description','NOTE'],['date','_DATE'],['place','_PLAC']]){
      if(item[key as keyof typeof item])setGedChild(mediaNode,tag,String(item[key as keyof typeof item]),version);
    }
    others.push(mediaNode);
    if(item.id==='portrait')n.children.unshift(gedNode('OBJE',xref));
    else n.children.push(gedNode('OBJE',xref));
  }
}
function emit(n:GedNode,level:number,version:string,lines:string[],continuation=false) {
  const prefix=level+' '+(n.xref?n.xref+' ':'')+n.tag;
  const value=n.value||'';
  if(/[\r\n]/.test(value))throw new GedcomError('Неэкранированный перевод строки в GEDCOM.');
  if(!value){lines.push(prefix);}
  else if(version.startsWith('7.')){
    lines.push(prefix+' '+value);
  }else{
    // 5.5.1 line limit is 255 bytes, including CRLF.
    const encoder=new TextEncoder(),safeLength=253;
    let segmentPrefix=prefix+' ';
    let part='';
    const codePoints=[...value];
    for(let i=0;i<codePoints.length;i++){
      const char=codePoints[i];
      if(encoder.encode(segmentPrefix+part+char).length>safeLength){
        if(!part)throw new GedcomError('Недостаточно места в строке GEDCOM 5.5.1.');
        // Do not split escaped @@ in half: two @ encode one literal @.
        if(part.endsWith('@')&&char==='@'&&part.length>1){
          part=part.slice(0,-1);i--; // The remaining @ will be retried after moving the pair.
          // Emit prefix up to pair, then restart with the pair on CONC.
          lines.push(segmentPrefix+part);
          segmentPrefix=(continuation?level:level+1)+' CONC ';
          part='';continue;
        }
        lines.push(segmentPrefix+part);
        segmentPrefix=(continuation?level:level+1)+' CONC ';
        part='';
      }
      part+=char;
    }
    if(part)lines.push(segmentPrefix+part);
  }
  for(const child of n.children)
    emit(child,level+1,version,lines,child.tag==='CONT'||child.tag==='CONC');
}

export function exportGedcom(persons:Record<string,any>[],families:Record<string,any>[],
  metadata:Record<string,any>={}):Uint8Array {
  const version=metadata.gedcom_version||'5.5.1';
  if(version!=='5.5.1'&&!/^7\.\d+(?:\.\d+)?$/.test(version))
    throw new GedcomError('Версия GEDCOM '+version+' не поддерживается.');
  const others:GedNode[]=cloneGed(metadata.other_records||[]);
  const used=new Set(others.map(node=>node.xref).filter(Boolean) as string[]);
  const people=allocateXrefs(persons,'I',used),familyRefs=allocateXrefs(families,'F',used);
  const known=new Set<string>([...(metadata.known_xrefs||[]),...people.values(),...familyRefs.values()]);
  const currentRefs=new Set([...people.values(),...familyRefs.values()]);
  const deleted=new Set([...known].filter(ref=>!currentRefs.has(ref)));
  const nodes=new Map<string,GedNode>();
  for(const person of persons)nodes.set(person.id,editPerson(person,people.get(person.id)!,version));
  for(const family of families)nodes.set(family.id,editFamily(family,familyRefs.get(family.id)!,version));
  const spouseLinks=new Map(persons.map(p=>[p.id,new Map<string,string|null>()]));
  const childLinks=new Map(persons.map(p=>[p.id,new Map<string,string|null>()]));
  const originalChildLinks=new Map(persons.map(p=>[p.id,new Set<string>()]));
  for(const family of families){
    const ref=familyRefs.get(family.id)!,n=nodes.get(family.id)!;
    for(const child of family._raw?.baseline?.children||[]){
      if(originalChildLinks.has(child.person_id))originalChildLinks.get(child.person_id)!.add(ref);
    }
    for(const [field,tag] of [['partner1_id','HUSB'],['partner2_id','WIFE']]){
      const id=family[field];
      if(id&&!people.has(id))throw new GedcomError('Семья ссылается на отсутствующего родителя.');
      syncLinks(n,tag,new Map(id?[[people.get(id)!,null]]:[]),known,version);
      if(id)spouseLinks.get(id)?.set(ref,null);
    }
    const desired=new Map<string,string|null>();
    for(const child of family.children||[]){
      if(!people.has(child.person_id))throw new GedcomError('Семья ссылается на отсутствующего ребёнка.');
      desired.set(people.get(child.person_id)!,null);
      childLinks.get(child.person_id)?.set(ref,child.pedigree||'unknown');
    }
    syncLinks(n,'CHIL',desired,known,version);
  }
  for(const p of persons){
    const n=nodes.get(p.id)!;
    syncLinks(n,'FAMS',spouseLinks.get(p.id)!,known,version);
    syncLinks(n,'FAMC',childLinks.get(p.id)!,known,version);
    const removed=new Set<string>(deleted);
    for(const xref of originalChildLinks.get(p.id) || [])if(!childLinks.get(p.id)!.has(xref))removed.add(xref);
    removeEventFamilyLinks(n,removed);
    appendMedia(p,n,others,used,version);
  }
  const header:GedNode=cloneGed(metadata.header||gedNode('HEAD'));
  if(!first(header,'SOUR'))header.children.unshift(gedNode('SOUR','GEN'));
  let gedc=first(header,'GEDC');
  if(!gedc){gedc=gedNode('GEDC');header.children.push(gedc);}
  setGedChild(gedc,'VERS',version,version);
  if(version.startsWith('7.'))header.children=header.children.filter(child=>child.tag!=='CHAR');
  else{
    setGedChild(gedc,'FORM','LINEAGE-LINKED',version);
    setGedChild(header,'CHAR','UTF-8',version);
    if(!first(header,'SUBM')){
      const stem='GEN_SUBMITTER';
      let xref='@'+stem+'@',number=1;
      while(used.has(xref))xref='@'+stem+'_'+(number++)+'@';
      used.add(xref);
      header.children.push(gedNode('SUBM',xref));
      const submitter=gedNode('SUBM','',xref);
      submitter.children.push(gedNode('NAME','GEN'));
      others.push(submitter);
    }
  }
  const output:GedNode[]=[header];
  const emitted=new Set<string>(),extra=new Set<number>();
  for(const entry of metadata.record_order||[]){
    if(entry.kind==='other'){
      const index=entry.index;
      if(Number.isInteger(index)&&index>=0&&index<others.length){
        output.push(others[index]);extra.add(index);
      }
    }else if(nodes.has(entry.id)){
      output.push(nodes.get(entry.id)!);emitted.add(entry.id);
    }
  }
  for(const [id,node] of nodes)if(!emitted.has(id))output.push(node);
  for(const [i,node] of others.entries())if(!extra.has(i))output.push(node);
  output.push(gedNode('TRLR'));
  const lines:string[]=[];
  for(const n of output)emit(n,0,version,lines);
  return new TextEncoder().encode('\ufeff'+lines.join('\r\n')+'\r\n');
}
