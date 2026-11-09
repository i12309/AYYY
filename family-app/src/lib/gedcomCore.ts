/** GEDCOM primitives shared by the browser importer and exporter.
 * Source node trees use exactly the same {tag,value,xref,children} representation
 * as GEN/api/gen/gedcom.py, so imported _raw and metadata survive ordinary edits.
 */
export interface GedNode {
  tag: string;
  value: string;
  xref: string | null;
  children: GedNode[];
  line?: number;
}
export interface GedParseResult {
  persons: Record<string, any>[];
  families: Record<string, any>[];
  metadata: Record<string, any>;
  warnings: string[];
}
export class GedcomError extends Error {
  constructor(message: string) { super(message); this.name = 'GedcomError'; }
}
export const EVENT_TAGS = new Set(
  'ADOP BAPM BARM BASM BIRT BLES BURI CAST CENS CHR CHRA CONF CREM DEAT DSCR EDUC EMIG EVEN FACT FCOM GRAD IDNO IMMI NATI NATU NCHI NMR OCCU ORDN PROB PROP RELI RESI RETI SSN TITL WILL'.split(' ')
);
export const PERSON_FIELDS = [
  'given_name','surname','patronymic','maiden_name','birth_date','birth_place',
  'death_date','death_place','occupation','biography','notes'
];
export const PEDIGREES = new Set(['birth','adopted','foster']);

export function gedNode(tag: string, value = '', xref: string | null = null): GedNode {
  return {tag, value, xref, children: []};
}
export function cloneGed<T>(value: T): T { return structuredClone(value); }
export function children(node: GedNode | null | undefined, tag: string): GedNode[] {
  return (node?.children || []).filter(child=>child.tag === tag);
}
export function first(node: GedNode | null | undefined, tag: string): GedNode | undefined {
  return (node?.children || []).find(child=>child.tag === tag);
}
export function isXref(value: string): boolean { return /^@[^@\s]+@$/.test(value); }
export function isTag(value: string): boolean { return /^[A-Z_][A-Z_0-9]*$/.test(value); }
export function unescapeGed(value: string, version: string) {
  return version.startsWith('7.') ? value.startsWith('@@') ? value.slice(1) : value
    : value.replace(/@@/g,'@');
}
export function escapeGed(value: string, version: string) {
  return version.startsWith('7.') ? value.startsWith('@') ? '@'+value : value.replace(/@/g,'@@');
}
export function gedText(node: GedNode | null | undefined, version: string): string {
  if(!node) return '';
  let result = unescapeGed(node.value || '',version);
  for(const item of node.children || []){
    if(item.tag === 'CONT' || item.tag === 'CONC'){
      result += (item.tag === 'CONT' ? '\n' : '') + gedText(item,version);
    }
  }
  return result;
}
export function gedValue(parent: GedNode | null | undefined,tag: string,version:string):string {
  return gedText(first(parent,tag),version);
}
export function warning(list: string[],code: string,message: string,record?: GedNode) {
  const where=record?.line ? 'Строка '+record.line+': ' : '';
  list.push('['+code+'] '+where+message);
}
export function setGedText(n: GedNode,value:string,version:string) {
  const lines=String(value).split(/\r\n|\r|\n/);
  n.value=escapeGed(lines[0]||'',version);
  n.children=[
    ...lines.slice(1).map(line=>gedNode('CONT',escapeGed(line,version))),
    ...n.children.filter(child=>child.tag!=='CONT'&&child.tag!=='CONC')
  ];
}
export function setGedChild(parent:GedNode,tag:string,value:string,version:string) {
  const found=first(parent,tag);
  if(!value){
    if(found)parent.children.splice(parent.children.indexOf(found),1);
    return;
  }
  const node=found||gedNode(tag);
  if(!found)parent.children.push(node);
  setGedText(node,value,version);
}
export function baselineChanged(entity:Record<string,any>,...fields:string[]):boolean {
  const base=entity._raw?.baseline || {};
  return fields.some(field=>!(field in base) ||
    JSON.stringify(entity[field]??'')!==JSON.stringify(base[field]??''));
}
export function namedBindings(entity:Record<string,any>,n:GedNode):Record<string,GedNode> {
  const result:Record<string,GedNode>={};
  const raw=entity._raw?.bindings||{};
  for(const [key,index] of Object.entries(raw)){
    if(Number.isInteger(index) && (index as number)>=0 && (index as number)<n.children.length)
      result[key]=n.children[index as number];
  }
  return result;
}
export function plainHtmlNote(value:string):string {
  // Never run embedded HTML, scripts or styles from user-owned GEDCOM.
  const plain=value.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,'')
    .replace(/<(p|div|br|li)\b[^>]*>/gi,'\n').replace(/<[^>]+>/g,'');
  const entity:Record<string,string>={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' '};
  return plain.replace(/&(#x[0-9a-f]+|#[0-9]+|amp|lt|gt|quot|apos|nbsp);/gi,(_,key:string)=>{
    if(key[0]==='#'){
      const code=key[1]?.toLowerCase()==='x'?parseInt(key.slice(2),16):parseInt(key.slice(1),10);
      return code>0&&code<=0x10ffff?String.fromCodePoint(code):'';
    }
    return entity[key.toLowerCase()]??'';
  }).trim();
}
export function noteText(note:GedNode|undefined,records:Map<string,GedNode>,version:string,warnings:string[]):string {
  if(!note)return '';
  let item=note;
  if(isXref(item.value)){
    const target=records.get(item.value);
    if(!target || !['NOTE','SNOTE'].includes(target.tag)){
      warning(warnings,'UNRESOLVED_NOTE','Заметка '+item.value+' не найдена; ссылка сохранена.',item);
      return '';
    }
    item=target;
  }
  const value=gedText(item,version);
  return gedValue(item,'MIME',version)==='text/html' ? plainHtmlNote(value) : value;
}
export function nameParts(n:GedNode|undefined,version:string):[string,string,string] {
  if(!n)return ['','',''];
  const raw=gedText(n,version);
  const pieces=raw.split('/');
  const patronymic=gedValue(n,'_PATR',version)||gedValue(n,'_PATRONYMIC',version);
  const givenNode=first(n,'GIVN');
  let given=givenNode?gedText(givenNode,version):pieces[0]?.trim()||'';
  if(!givenNode&&patronymic&&(given===patronymic||given.endsWith(' '+patronymic)))
    given=given.slice(0,-patronymic.length).trimEnd();
  const surname=gedValue(n,'SURN',version)||pieces[1]?.trim()||'';
  return [given,surname,patronymic];
}
