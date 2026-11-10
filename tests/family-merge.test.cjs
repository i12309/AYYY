/* Safe, explicit GitHub three-way merge: synthetic data only. */
const test=require('node:test');
const assert=require('node:assert/strict');
const {mergeDocuments}=require('../family-app/src/lib/browserMerge.ts');
function doc(){
  return {schema_version:1,tree:{id:'a'.repeat(32),name:'Семья',slug:'family',description:'',revision:1,updated_at:'2026-01-01'},
    persons:[
      {id:'b'.repeat(32),given_name:'Анна',surname:'Примерова',notes:'',biography:'Старый текст',
        events:[],revision:1,updated_at:'2026-01-01',_raw:{nodes:[{tag:'_CUSTOM',value:'keep'}]}},
      {id:'c'.repeat(32),given_name:'Иван',surname:'Примеров',notes:'',biography:'',
        events:[],revision:1,updated_at:'2026-01-01'}
    ],families:[{id:'d'.repeat(32),partner1_id:'b'.repeat(32),partner2_id:'c'.repeat(32),
      children:[],notes:'',revision:1}],metadata:{gedcom_version:'5.5.1'}};
}
const copy=x=>structuredClone(x);
const base=()=>doc();
test('different person edits automatically merge',()=>{
  const b=base(),l=copy(b),r=copy(b);
  l.persons[0].biography='Локальная биография';
  r.persons[1].notes='GitHub заметки';
  const result=mergeDocuments(b,l,r);
  assert.equal(result.unresolved.length,0);
  assert.equal(result.document.persons[0].biography,'Локальная биография');
  assert.equal(result.document.persons[1].notes,'GitHub заметки');
  assert.equal(result.document.persons[0]._raw.nodes[0].tag,'_CUSTOM');
});
test('same field conflict requires explicit user choice',()=>{
  const b=base(),l=copy(b),r=copy(b);
  l.persons[0].biography='Локальный текст';r.persons[0].biography='Удалённый текст';
  const result=mergeDocuments(b,l,r);
  assert.equal(result.conflicts.length,1);
  assert.equal(result.unresolved.length,1);
  const id=result.conflicts[0].id;
  assert.equal(mergeDocuments(b,l,r,{[id]:'local'}).document.persons[0].biography,'Локальный текст');
  assert.equal(mergeDocuments(b,l,r,{[id]:'remote'}).document.persons[0].biography,'Удалённый текст');
});
test('remote delete versus local modification conflicts',()=>{
  const b=base(),l=copy(b),r=copy(b);
  l.persons[0].biography='Новый текст';
  r.families=[];r.persons=r.persons.filter(x=>x.id!==b.persons[0].id);
  const result=mergeDocuments(b,l,r);
  assert.ok(result.conflicts.some(x=>x.field.includes('Запись целиком')));
  assert.ok(result.unresolved.length);
});
test('one-sided addition is included',()=>{
  const b=base(),l=copy(b),r=copy(b);
  r.persons.push({id:'f'.repeat(32),given_name:'Новый',surname:'Участник',revision:1,events:[]});
  const merged=mergeDocuments(b,l,r);
  assert.equal(merged.unresolved.length,0);
  assert.equal(merged.document.persons.length,3);
});
test('two different edits in one entity are field merged',()=>{
  const b=base(),l=copy(b),r=copy(b);
  l.persons[0].surname='Другая фамилия';r.persons[0].biography='GitHub текст';
  const merged=mergeDocuments(b,l,r);
  assert.equal(merged.conflicts.length,0);
  assert.equal(merged.document.persons[0].surname,'Другая фамилия');
  assert.equal(merged.document.persons[0].biography,'GitHub текст');
});
test('unknown GEDCOM source is retained and can conflict',()=>{
  const b=base(),l=copy(b),r=copy(b);
  l.persons[0]._raw.nodes[0].value='local';
  r.persons[0]._raw.nodes[0].value='remote';
  assert.equal(mergeDocuments(b,l,r).conflicts[0].field,'Исходные структуры GEDCOM');
});
test('metadata conflicts are not silently dropped',()=>{
  const b=base(),l=copy(b),r=copy(b);
  l.metadata.vendor='left';r.metadata.vendor='right';
  const result=mergeDocuments(b,l,r);
  assert.equal(result.conflicts[0].field,'Метаданные GEDCOM');
});
test('legacy without baseline does not guess merge',()=>{
  const l=base(),r=copy(l);
  r.persons[0].biography='Удалённая запись';
  const plan=mergeDocuments(null,l,r);
  assert.deepEqual(plan.unresolved,['document:whole']);
  assert.equal(mergeDocuments(null,l,r,{'document:whole':'remote'}).document.persons[0].biography,'Удалённая запись');
});
test('invalid choice creating ancestry cycle fails validation',()=>{
  const b=base(),l=copy(b),r=copy(b);
  const parent=b.persons[0].id,child=b.persons[1].id;
  l.families[0].children=[{person_id:child,pedigree:'birth'}];
  l.families[0].partner2_id=null;
  r.families.push({id:'e'.repeat(32),partner1_id:child,partner2_id:null,
    children:[{person_id:parent,pedigree:'birth'}],revision:1});
  assert.throws(()=>mergeDocuments(b,l,r),/цикл|повторную связь/);
});
test('merge rejects different tree identities',()=>{
  const l=base(),r=copy(l);r.tree.id='f'.repeat(32);
  assert.throws(()=>mergeDocuments(l,l,r),/разные семейные деревья/);
});
