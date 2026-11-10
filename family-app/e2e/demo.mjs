/* Tutorial demo must be idempotent, including legacy duplicates and 2 tabs. */
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {chromium} from '@playwright/test';

const server=spawn('python3',['-m','http.server','8782','--bind','127.0.0.1','--directory','..'],
  {cwd:new URL('../',import.meta.url).pathname,stdio:'ignore'});
let browser;
const root='http://127.0.0.1:8782/family/';
async function ready(){
  for(let i=0;i<55;i++){
    try{if((await fetch(root)).ok)return;}catch{}
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  throw new Error('GEN demo server did not start.');
}
async function openLibrary(page){
  if(await page.locator('.breadcrumb').count()){
    await page.getByRole('button',{name:'Все деревья'}).first().click();
  }
  await page.getByRole('heading',{name:'Семейные деревья'}).waitFor({timeout:15000});
}
const treeId=page=>page.evaluate(()=>new URL(location.href).searchParams.get('tree'));
async function stored(page){
  return page.evaluate(async()=>{
    const request=indexedDB.open('ayyy-family-v1');
    const db=await new Promise((resolve,reject)=>{
      request.onsuccess=()=>resolve(request.result);
      request.onerror=()=>reject(request.error);
    });
    const q=db.transaction('trees','readonly').objectStore('trees').getAll();
    const rows=await new Promise((resolve,reject)=>{
      q.onsuccess=()=>resolve(q.result);
      q.onerror=()=>reject(q.error);
    });
    db.close();
    return rows.map(row=>({
      id:row.id,slug:row.document.tree.slug,
      is_demo:row.document.tree.is_demo===true,
      name:row.document.tree.name
    }));
  });
}
async function insertLegacyCopies(page,originalId){
  await page.evaluate(async originalId=>{
    const request=indexedDB.open('ayyy-family-v1');
    const db=await new Promise(resolve=>request.onsuccess=()=>resolve(request.result));
    const originalReq=db.transaction('trees','readonly').objectStore('trees').get(originalId);
    const original=await new Promise(resolve=>originalReq.onsuccess=()=>resolve(originalReq.result));
    const transaction=db.transaction('trees','readwrite'),table=transaction.objectStore('trees');
    for(let i=0;i<2;i++){
      const doc=structuredClone(original.document);
      doc.tree.id=crypto.randomUUID().replace(/-/g,'');
      doc.tree.slug='legacy-demo-copy-'+i;
      doc.tree.updated_at=new Date(Date.now()+10000+i*1000).toISOString();
      delete doc.tree.is_demo;
      table.put({id:doc.tree.id,document:doc});
    }
    await new Promise((resolve,reject)=>{
      transaction.oncomplete=resolve;
      transaction.onabort=()=>reject(transaction.error);
    });
    db.close();
  },originalId);
}
try{
  await ready();
  browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  const context=await browser.newContext();
  const page=await context.newPage();
  await page.goto(root);
  await openLibrary(page);
  await page.getByRole('button',{name:'Открыть пример'}).click();
  await page.locator('.tree-name-button').waitFor({timeout:15000});
  const firstId=await treeId(page);
  assert.ok(firstId);
  assert.equal((await stored(page)).length,1);
  await openLibrary(page);
  assert.equal(await page.locator('.tree-demo-badge').count(),1);
  await page.getByText('Учебный пример уже есть').waitFor();
  await page.getByRole('button',{name:'Открыть пример'}).click();
  assert.equal(await treeId(page),firstId,'Button should open same ID');
  assert.equal((await stored(page)).length,1);
  console.log('PASS: Reopening tutorial never creates a new tree.');

  // Simulate the two old sample copies seen by existing users before the fix.
  await openLibrary(page);
  await insertLegacyCopies(page,firstId);
  await page.reload();
  await openLibrary(page);
  assert.equal(await page.locator('.tree-demo-badge').count(),3);
  await page.getByText('Учебных деревьев в браузере: 3').waitFor();
  await page.getByRole('button',{name:'Открыть пример'}).click();
  assert.equal((await stored(page)).length,3,'Existing duplicates must never be deleted or multiplied');
  const chosenId=await treeId(page);
  const after=await stored(page);
  assert.ok(after.every(item=>item.is_demo),'All legacy samples should receive durable marker');
  console.log('PASS: Three legacy copies labelled, preserved and reused.');

  // The explicit marker stays even when a user learns to rename the tutorial.
  await page.locator('.tree-name-button').click();
  const edit=page.getByRole('dialog',{name:'Название дерева'});
  await edit.getByLabel('Название',{exact:true}).fill('Мой изменённый учебный пример');
  await edit.getByRole('button',{name:'Сохранить',exact:true}).click();
  await page.locator('.tree-name-button').getByText('Мой изменённый учебный пример').waitFor();
  await openLibrary(page);
  await page.getByRole('button',{name:'Открыть пример'}).click();
  assert.equal(await treeId(page),chosenId);
  assert.equal((await stored(page)).length,3);
  console.log('PASS: Tutorial marker survives rename, and no duplicate is created.');

  // A fresh browser profile with two tabs races their first click.
  const fresh=await browser.newContext();
  const a=await fresh.newPage(),b=await fresh.newPage();
  await Promise.all([a.goto(root),b.goto(root)]);
  await Promise.all([openLibrary(a),openLibrary(b)]);
  await Promise.all([
    a.getByRole('button',{name:'Открыть пример'}).click(),
    b.getByRole('button',{name:'Открыть пример'}).click()
  ]);
  await Promise.all([a.locator('.tree-name-button').waitFor(),b.locator('.tree-name-button').waitFor()]);
  assert.equal(await treeId(a),await treeId(b),'Two tabs should open the same document');
  assert.equal((await stored(a)).length,1);
  console.log('PASS: Concurrent first creation in two tabs uses one IDB transaction.');
  await fresh.close();await context.close();
  console.log('GEN tutorial idempotency tests PASS');
}catch(error){
  console.error('GEN tutorial idempotency tests FAIL',error);
  process.exitCode=1;
}finally{
  await browser?.close();
  server.kill('SIGTERM');
}
