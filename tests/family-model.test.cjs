const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

let model;
test.before(async () => {
  model = await import('../family-app/src/lib/browserModel.ts');
});

test('new GEN document uses version 1 and unique folder', () => {
  const doc = model.newTree('Семья Ивановых');
  assert.equal(doc.schema_version,1);
  assert.match(doc.tree.slug,/^semya-ivanovyh-[a-f0-9]{6}$/);
  assert.equal(doc.persons.length,0);
  assert.doesNotThrow(()=>model.validate(doc));
});
test('new relative creates a valid family', () => {
  const doc=model.newTree('Example');
  const parent=model.createPerson({given_name:'Пётр',sex:'M'});
  doc.persons.push(parent);
  const result=model.addRelative(doc,parent.id,
    {relation:'child',person:{given_name:'Анна',sex:'F',birth_date:'ABT 1990'}});
  assert.equal(doc.persons.length,2);
  assert.equal(doc.families.length,1);
  assert.equal(result.family.children[0].person_id,result.person.id);
  assert.equal(result.person.birth_date,'ABT 1990');
  assert.doesNotThrow(()=>model.validate(doc));
});
test('rejects ancestry cycles across families',()=>{
  const doc=model.newTree('Example');
  const a=model.createPerson({given_name:'A'}),b=model.createPerson({given_name:'B'});
  doc.persons.push(a,b);
  model.addRelative(doc,a.id,{relation:'child',relative_id:b.id});
  assert.throws(()=>model.addRelative(doc,b.id,{relation:'child',relative_id:a.id}),/цикл родства/);
});
test('rejects unknown person, duplicates and self-parenting',()=>{
  const doc=model.newTree('Example');
  const a=model.createPerson({given_name:'A'});
  doc.persons.push(a);
  doc.families.push(model.createFamily({partner1_id:a.id,children:[{person_id:a.id,pedigree:'birth'}]}));
  assert.throws(()=>model.validate(doc),/повторную связь/);
  doc.families[0].children=[{person_id:'unknown',pedigree:'birth'}];
  assert.throws(()=>model.validate(doc),/неизвестного/);
});
test('unknown imported GEDCOM nodes and metadata remain intact on updates',()=>{
  const doc=model.newTree('Example');
  const person=model.createPerson({given_name:'A'});
  person._raw={nodes:[{tag:'_CUSTOM',value:'keep this'}]};
  doc.metadata={gedcom:{version:'7.0'},untouched:'keep'};
  doc.persons.push(person);
  model.updatePerson(person,{given_name:'B',revision:1});
  assert.equal(person._raw.nodes[0].tag,'_CUSTOM');
  assert.equal(doc.metadata.untouched,'keep');
  assert.equal(person.revision,2);
  assert.doesNotThrow(()=>model.validate(doc));
});
test('browser build integrates GEN without including private family-data',()=>{
  const root=path.resolve(__dirname,'..');
  const compiled=path.join(root,'family/index.html');
  assert.ok(fs.existsSync(compiled),'Run npm run build --prefix family-app first.');
  const html=fs.readFileSync(compiled,'utf8');
  assert.match(html, /assets\/index-/);
  const entry=fs.readFileSync(path.join(root,'src/family-route.js'),'utf8');
  assert.match(entry,/a\.register\('family'/);
  assert.equal(fs.existsSync(path.join(root,'family-data')),false);
});

test('tutorial marker distinguishes fictional sample from personal trees',()=>{
  const ordinary=model.newTree('Моё семейное дерево','Личные сведения');
  assert.equal(model.isDemoDocument(ordinary),false);
  assert.equal(model.summary(ordinary).is_demo,false);
  const sample=model.newTree('Семья Волковых · пример','Учебное дерево. Все люди и события вымышлены.');
  assert.equal(model.isDemoDocument(sample),true,'Legacy sample is inferred from its fixed identity');
  assert.equal(model.summary(sample).is_demo,true);
  sample.tree.name='Переименованное учебное дерево';
  assert.equal(model.isDemoDocument(sample),false);
  sample.tree.is_demo=true;
  assert.equal(model.isDemoDocument(sample),true,'Permanent marker survives title edits');
  assert.equal(model.summary(sample).is_demo,true);
});
