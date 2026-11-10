/**
 * Three-way GEN document reconciliation. Never chooses between conflicting
 * personal records automatically; all deletions and unknown _raw fields count.
 * Field-level non-overlapping changes merge without overwriting their sibling.
 */
import {type Document,now,validate} from './browserModel.ts';

export type Side='local'|'remote';
export type MergeChoice=Record<string,Side>;
export type MergeConflict={
  id:string;label:string;field:string;local:string;remote:string;
};
export type MergeResult={
  document:Document;
  conflicts:MergeConflict[];
  unresolved:string[];
  autoChanges:number;
};
type RecordValue=Record<string,any>;
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
const clone=<T,>(value:T):T=>value===undefined?value:structuredClone(value);
function short(value:unknown):string{
  if(value===undefined)return '(удалено)';
  if(typeof value==='string')return value.length>150?value.slice(0,149)+'…':value||'(пусто)';
  const encoded=JSON.stringify(value);
  return encoded.length>150?encoded.slice(0,149)+'…':encoded;
}
const captions:Record<string,string>={
  given_name:'Имя',surname:'Фамилия',patronymic:'Отчество',maiden_name:'Девичья фамилия',
  biography:'Биография',notes:'Заметки',events:'События',children:'Дети',
  partner1_id:'Первый партнёр',partner2_id:'Второй партнёр',
  _raw:'Исходные структуры GEDCOM',_photo:'Фотография',_gallery:'Галерея',
  name:'Название дерева',description:'Описание',metadata:'Метаданные GEDCOM'
};
function label(kind:string,record:RecordValue|null|undefined,id:string):string{
  if(kind==='person')return 'Человек: '+[record?.given_name,record?.surname].filter(Boolean).join(' ')||'Человек '+id.slice(0,8);
  if(kind==='family')return 'Семья '+(record?.gedcom_id||id.slice(0,8));
  return kind==='tree'?'Настройки дерева':kind==='metadata'?'Метаданные GEDCOM':'Документ';
}
function compareField(
  key:string,description:string,field:string,
  base:any,local:any,remote:any,
  choices:MergeChoice,conflicts:MergeConflict[],auto:{value:number}
):any {
  if(same(local,remote))return clone(local);
  if(same(local,base)){auto.value++;return clone(remote);}
  if(same(remote,base)){auto.value++;return clone(local);}
  const conflictId=key+':'+field;
  conflicts.push({id:conflictId,label:description,field:captions[field]||field,
    local:short(local),remote:short(remote)});
  return clone(choices[conflictId]==='remote'?remote:local);
}
function mergeRecord(
  key:string,kind:string,id:string,
  base:RecordValue|undefined,local:RecordValue|undefined,remote:RecordValue|undefined,
  choices:MergeChoice,conflicts:MergeConflict[],auto:{value:number}
):RecordValue|undefined {
  if(same(local,remote))return clone(local);
  if(same(local,base)){auto.value++;return clone(remote);}
  if(same(remote,base)){auto.value++;return clone(local);}
  const description=label(kind,local||remote,id);
  if(!base||!local||!remote){
    const conflictId=key+':whole';
    conflicts.push({id:conflictId,label:description,field:'Запись целиком (удаление или создание)',
      local:short(local),remote:short(remote)});
    return clone(choices[conflictId]==='remote'?remote:local);
  }
  const output:RecordValue={id};
  const names=new Set([...Object.keys(base),...Object.keys(local),...Object.keys(remote)]);
  for(const field of names){
    if(field==='revision'||field==='updated_at'||field==='id')continue;
    const value=compareField(key,description,field,base[field],local[field],remote[field],choices,conflicts,auto);
    if(value!==undefined)output[field]=value;
  }
  if(kind==='person'||kind==='family'){
    const maximum=Math.max(Number(base.revision)||1,Number(local.revision)||1,Number(remote.revision)||1);
    output.revision=maximum+1;
    if(kind==='person')output.updated_at=now();
  }
  return output;
}
function mergeItems(
  kind:'person'|'family',
  base:RecordValue[],local:RecordValue[],remote:RecordValue[],
  choices:MergeChoice,conflicts:MergeConflict[],auto:{value:number}
) {
  const b=new Map(base.map(x=>[x.id,x])),l=new Map(local.map(x=>[x.id,x])),r=new Map(remote.map(x=>[x.id,x]));
  const ids=[...new Set([...base,...local,...remote].map(x=>x.id))];
  const result:RecordValue[]=[];
  for(const id of ids){
    const merged=mergeRecord(kind+':'+id,kind,id,b.get(id),l.get(id),r.get(id),choices,conflicts,auto);
    if(merged)result.push(merged);
  }
  return result;
}
export function mergeDocuments(
  baseline:Document|null,
  local:Document,
  remote:Document,
  choices:MergeChoice={}
):MergeResult {
  validate(local);validate(remote);
  if(local.tree.id!==remote.tree.id)throw new Error('Невозможно слить разные семейные деревья.');
  if(local.tree.slug!==remote.tree.slug)throw new Error('Каталог дерева в GitHub изменён. Сначала сохраните копию ZIP.');
  const conflicts:MergeConflict[]=[],auto={value:0};
  if(!baseline||baseline.tree.id!==local.tree.id){
    const conflictId='document:whole';
    if(!same(local,remote))conflicts.push({
      id:conflictId,label:'Всё дерево',field:'Нет общей базы для безопасного слияния',
      local:'Локальная версия — '+local.persons.length+' человек',
      remote:'GitHub — '+remote.persons.length+' человек'
    });
    const result=clone(choices[conflictId]==='remote'?remote:local);
    return {document:result,conflicts,unresolved:conflicts.filter(x=>!choices[x.id]).map(x=>x.id),autoChanges:0};
  }
  validate(baseline);
  const tree={...clone(local.tree)} as Document['tree'];
  for(const key of new Set([...Object.keys(baseline.tree),...Object.keys(local.tree),...Object.keys(remote.tree)])){
    if(['id','slug','revision','updated_at'].includes(key))continue;
    const value=compareField('tree','Настройки дерева',key,
      (baseline.tree as RecordValue)[key],(local.tree as RecordValue)[key],(remote.tree as RecordValue)[key],
      choices,conflicts,auto);
    if(value===undefined)delete (tree as RecordValue)[key];
    else (tree as RecordValue)[key]=value;
  }
  tree.updated_at=now();
  tree.revision=Math.max(Number(baseline.tree.revision)||1,Number(local.tree.revision)||1,Number(remote.tree.revision)||1)+1;
  const persons=mergeItems('person',baseline.persons,local.persons,remote.persons,choices,conflicts,auto);
  const families=mergeItems('family',baseline.families,local.families,remote.families,choices,conflicts,auto);
  const metadata=compareField('metadata','Метаданные GEDCOM','metadata',
    baseline.metadata,local.metadata,remote.metadata,choices,conflicts,auto);
  const document:Document={...clone(local),tree,persons,families,metadata};
  // A selected side can still create inconsistent ancestry; do not allow such a
  // conflict decision to be sent to GitHub or installed locally.
  if(!conflicts.some(x=>!choices[x.id]))validate(document);
  return {document,conflicts,unresolved:conflicts.filter(x=>!choices[x.id]).map(x=>x.id),autoChanges:auto.value};
}
