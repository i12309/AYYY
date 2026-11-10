// npm-free HUMAN demo tests; run locally without GitHub Actions:
// node --test tests/health_demo.test.cjs
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {TextEncoder,TextDecoder}=require('node:util');
const root=path.join(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const base64=s=>Buffer.from(s,'binary').toString('base64');
const fromBase64=s=>Buffer.from(s,'base64').toString('binary');

function makeModules(window,extras={}){
  let seq=0;
  const context=vm.createContext({
    window,TextEncoder,TextDecoder,
    btoa:base64,atob:fromBase64,
    crypto:{randomUUID:()=>('demo-test-'+(++seq))},
    ...extras
  });
  for(const file of ['health/crypto.js','health/model.js','health/demo.js'])
    vm.runInContext(read(file),context,{filename:file});
  return {window,context};
}
test('fictional dataset is complete, valid and independently regenerated',()=>{
  const {window}=makeModules({});
  const first=window.HumanDemo.create(),second=window.HumanDemo.create();
  window.HumanCrypto.assertData(first);
  assert.equal(first.schema,1);
  assert.equal(first.observations.length,68);
  assert.equal(first.vitals.length,33);
  assert.equal(first.medical.length,4);
  assert.equal(first.medications.length,2);
  assert.equal(first.diary.length,12);
  assert.equal(first.documents.length,3);
  assert.equal(window.HumanModel.groups(first.observations).length,12);
  assert.equal(window.HumanModel.status(first.observations.find(x=>x.id==='demo-lab-alt-5')),'abnormal');
  assert.equal(window.HumanModel.status(first.observations.find(x=>x.id==='demo-lab-ldl-6')),'normal');
  for(const f of first.documents){
    assert.equal(Buffer.from(f.data,'base64').byteLength,f.size);
    assert.match(f.name,/^demo-/);
  }
  first.observations[0].value='999';
  assert.notEqual(first.observations[0].value,second.observations[0].value);
  assert.match(second.profile.notes,/Вымышленный/);
});

class FakeNode {
  constructor(tag){
    this.tagName=tag;this.children=[];this.dataset={};this.attributes={};
    this.className='';this.textContent='';this.value='';this.isConnected=true;
    this.classList={add:x=>{this.className+=' '+x},remove:()=>{}};
  }
  append(...items){items.forEach(x=>this.appendChild(x));}
  appendChild(item){this.children.push(item);return item;}
  replaceChildren(...items){this.children=[];this.append(...items);}
  setAttribute(key,value){
    this.attributes[key]=value;
    if(key.startsWith('data-'))this.dataset[key.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=value;
  }
  addEventListener(){}
  querySelector(){return null;}
}
function textOf(node){
  return [node.textContent,...(node.children||[]).map(textOf)].join(' ');
}
test('deep-linked demo renders all tabs without reading personal vault or GitHub',()=>{
  const window={location:{search:'?demo=1'}};
  const nodes=new Map(),handlers={};
  for(const id of ['health-root','health-header','health-dialog','health-notice','health-dialog-body'])
    nodes.set(id,new FakeNode(id));
  const document={
    createElement:tag=>new FakeNode(tag),
    createElementNS:(ns,tag)=>new FakeNode(tag),
    createTextNode:value=>{const node=new FakeNode('#text');node.textContent=String(value);return node;},
    getElementById:id=>nodes.get(id),
    addEventListener:(type,handler)=>{handlers[type]=handler;}
  };
  let localCalls=0,remoteCalls=0;
  const {context}=makeModules(window,{
    document,Node:FakeNode,URLSearchParams,structuredClone,
    setTimeout:()=>1,clearTimeout:()=>{},
    BroadcastChannel:undefined
  });
  window.HumanStore={
    list:async()=>{localCalls++;throw new Error('demo accessed IndexedDB');},
    current:async()=>{localCalls++;throw new Error('demo accessed IndexedDB');},
    get:async()=>{localCalls++;throw new Error('demo accessed IndexedDB');},
    save:async()=>{localCalls++;throw new Error('demo accessed IndexedDB');}
  };
  window.HumanGithub={
    hasToken:()=>false,disconnect:()=>{},
    read:async()=>{remoteCalls++;throw Error('demo accessed GitHub');},
    write:async()=>{remoteCalls++;throw Error('demo accessed GitHub');}
  };
  vm.runInContext(read('health/view.js'),context,{filename:'health/view.js'});
  vm.runInContext(read('health/app.js'),context,{filename:'health/app.js'});
  const target=nodes.get('health-root');
  assert.match(textOf(target),/ДЕМО/);
  assert.match(textOf(target),/Анна Примерова/);
  assert.match(textOf(target),/Виды анализов/);
  for(const [tab,expected] of [
    ['lab','Холестерин ЛПНП'],
    ['vital','Домашние показатели'],
    ['medical','Сезонная реакция на пыльцу'],
    ['diary','Пешая прогулка'],
    ['document','Бланк анализов'],
    ['settings','Настройки демо']
  ]){
    handlers.click({target:{closest:()=>({dataset:{tab}})}});
    assert.ok(textOf(target).includes(expected),'Missing in '+tab+': '+expected);
    assert.match(textOf(target),/ДЕМО/);
  }
  handlers.click({target:{closest:()=>({dataset:{action:'reset-demo'}})}});
  assert.match(textOf(target),/Виды анализов/);
  assert.equal(localCalls,0);
  assert.equal(remoteCalls,0);
});
