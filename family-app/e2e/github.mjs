/* Simulated private GitHub storage, no real token or network write. */
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {chromium} from '@playwright/test';

const server=spawn('python3',['-m','http.server','8766','--bind','127.0.0.1','--directory','..'],
  {cwd:new URL('../',import.meta.url).pathname,stdio:'ignore'});
let browser;
const root='http://127.0.0.1:8766/family/';
const fakeToken='mock-only-fine-grained-token';
let branchHead='head-initial';
let remoteSlug='';
let payload='';
let writes=0, refusedPublic=0;
async function mock(route) {
  const request=route.request();
  const url=new URL(request.url());
  const path=decodeURIComponent(url.pathname);
  const method=request.method();
  const body=method==='POST'||method==='PATCH'?JSON.parse(request.postData()||'{}'):null;
  const reply=(json,status=200)=>route.fulfill({
    status,contentType:'application/json',body:JSON.stringify(json),
    headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'GET,POST,PATCH,OPTIONS'}
  });
  if(request.headers().authorization!=='Bearer '+fakeToken && method!=='OPTIONS'){
    return reply({message:'Unauthorized'},401);
  }
  if(method==='OPTIONS')return reply({},200);
  if(path==='/repos/tester/public-archive') {refusedPublic++;return reply({private:false});}
  if(path==='/repos/tester/family-archive')return reply({private:true});
  if(!path.startsWith('/repos/tester/family-archive/'))return reply({message:'not found'},404);
  if(path==='/repos/tester/family-archive/git/ref/heads/main' && method==='GET'){
    return reply({object:{sha:branchHead}});
  }
  if(path==='/repos/tester/family-archive/contents/family-data/trees' && method==='GET'){
    return reply(remoteSlug?[{name:remoteSlug,type:'dir'}]:[],200);
  }
  if(path.startsWith('/repos/tester/family-archive/contents/family-data/trees/') && method==='GET'){
    if(!payload || !path.endsWith('/tree.json'))return reply({message:'not found'},404);
    return reply({sha:'json-blob',name:'tree.json',type:'file'});
  }
  if(path==='/repos/tester/family-archive/git/blobs' && method==='POST'){
    writes++;
    let document=null;
    try { document=JSON.parse(Buffer.from(body.content,'base64').toString('utf8')); } catch {}
    if(document?.tree?.id){
      payload=body.content;
      remoteSlug=document.tree.slug;
      return reply({sha:'json-blob'});
    }
    return reply({sha:'gedcom-blob'});
  }
  if(path==='/repos/tester/family-archive/git/blobs/json-blob' && method==='GET'){
    return reply({encoding:'base64',content:payload});
  }
  if(path.startsWith('/repos/tester/family-archive/git/commits/') && method==='GET'){
    return reply({tree:{sha:'tree-initial'}});
  }
  if(path==='/repos/tester/family-archive/git/trees' && method==='POST'){
    writes++;
    assert.ok(body.tree.some(t=>t.path.endsWith('/tree.json')));
    assert.ok(body.tree.some(t=>t.path.endsWith('/tree.ged')));
    return reply({sha:'tree-new'});
  }
  if(path==='/repos/tester/family-archive/git/commits' && method==='POST'){
    writes++;
    assert.deepEqual(body.parents,[branchHead]);
    return reply({sha:'head-new'});
  }
  if(path==='/repos/tester/family-archive/git/refs/heads/main' && method==='PATCH'){
    assert.equal(body.force,false);
    writes++;
    branchHead=body.sha;
    return reply({object:{sha:branchHead}});
  }
  return reply({message:'unexpected '+method+' '+path},404);
}

async function connect(page,repo) {
  await page.getByLabel('Репозиторий').fill(repo);
  await page.getByLabel('GitHub personal access token').fill(fakeToken);
}
async function ready() {
  for(let i=0;i<50;i++){
    try{const r=await fetch(root);if(r.ok)return;}catch{}
    await new Promise(r=>setTimeout(r,100));
  }
  throw new Error('Server did not become ready');
}
try {
  await ready();
  browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  const first=await browser.newContext();
  await first.route('https://api.github.com/**',mock);
  const page=await first.newPage();
  await page.goto(root);
  await page.getByRole('heading',{name:'Семейные деревья'}).waitFor();
  await page.getByRole('button',{name:'Открыть пример'}).click();
  await page.getByRole('button',{name:'Локальное дерево'}).click();
  await connect(page,'tester/family-archive');
  await page.getByRole('button',{name:'Синхронизировать'}).click();
  await page.getByText('Дерево, GEDCOM и фотографии сохранены в приватном репозитории.').waitFor();
  assert.ok(writes>=4);
  assert.ok(remoteSlug && payload);
  assert.ok(!JSON.stringify(await page.evaluate(()=>Object.values(localStorage))).includes(fakeToken));
  console.log('PASS: private GitHub multi-file commit without persisting token.');

  // A second browser profile has its own empty IndexedDB.
  const second=await browser.newContext();
  await second.route('https://api.github.com/**',mock);
  const another=await second.newPage();
  await another.goto(root);
  await another.getByRole('button',{name:'Открыть из GitHub'}).click();
  await connect(another,'tester/family-archive');
  await another.getByRole('button',{name:'Найти семейные деревья'}).click();
  await another.getByRole('button',{name:'Открыть дерево'}).click();
  await another.getByRole('button',{name:'Таблица',exact:true}).waitFor();
  await another.getByRole('button',{name:'Таблица',exact:true}).click();
  assert.equal(await another.locator('.people-table tbody tr').count(),6);
  console.log('PASS: restore tree from private GitHub on separate browser device.');

  const third=await browser.newContext();
  await third.route('https://api.github.com/**',mock);
  const publicPage=await third.newPage();
  await publicPage.goto(root);
  await publicPage.getByRole('button',{name:'Открыть пример'}).click();
  await publicPage.getByRole('button',{name:'Локальное дерево'}).click();
  await connect(publicPage,'tester/public-archive');
  const prevWrites=writes;
  await publicPage.getByRole('button',{name:'Синхронизировать'}).click();
  await publicPage.getByText(/Открытый репозиторий запрещён/).waitFor();
  assert.ok(refusedPublic>0);
  assert.equal(writes,prevWrites);
  console.log('PASS: refuse publishing family data in public repositories.');

  await first.close();await second.close();await third.close();
  console.log('GEN GitHub browser smoke PASS');
} catch(error) {
  console.error('GEN GitHub browser smoke FAIL',error);
  process.exitCode=1;
} finally{
  await browser?.close();
  server.kill('SIGTERM');
}
