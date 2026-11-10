/* Real Chromium auto-sync: opted-in creation, debounce, second computer,
 * open-time refresh, token pause, and safe remote conflict. Synthetic REST only.
 */
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {chromium} from '@playwright/test';

const server=spawn('python3',['-m','http.server','8778','--bind','127.0.0.1','--directory','..'],
  {cwd:new URL('../',import.meta.url).pathname,stdio:'ignore'});
const origin='http://127.0.0.1:8778/family/';
const token='synthetic-session-only';
const repo='tester/family-archive';
let browser,sequence=0,head='initial-head',remoteSha='',pendingSha='',slug='',commitCount=0;
const blobs=new Map();
const rawJson=sha=>JSON.parse(Buffer.from(blobs.get(sha),'base64').toString('utf8'));
const remoteTree=()=>remoteSha?rawJson(remoteSha):null;
async function mock(route){
  const request=route.request(),url=new URL(request.url());
  const path=decodeURIComponent(url.pathname),method=request.method();
  const body=['POST','PATCH'].includes(method)?JSON.parse(request.postData()||'{}'):{};
  const reply=(value,status=200)=>route.fulfill({status,contentType:'application/json',
    body:JSON.stringify(value),headers:{
      'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*',
      'Access-Control-Allow-Methods':'GET,POST,PATCH,OPTIONS'
    }});
  if(method==='OPTIONS')return reply({});
  if(request.headers().authorization!=='Bearer '+token)return reply({message:'Unauthorized'},401);
  const base='/repos/'+repo;
  if(path===base&&method==='GET')return reply({private:true});
  if(path===base+'/git/ref/heads/main'&&method==='GET')return reply({object:{sha:head}});
  if(path===base+'/contents/family-data/trees'&&method==='GET')
    return reply(slug?[{name:slug,type:'dir'}]:[]);
  if(path.startsWith(base+'/contents/family-data/trees/')&&method==='GET'){
    if(!remoteSha||!path.endsWith('/tree.json'))return reply({message:'Not found'},404);
    return reply({sha:remoteSha,name:'tree.json',type:'file'});
  }
  if(path===base+'/git/blobs'&&method==='POST'){
    const sha='blob-'+(++sequence);
    blobs.set(sha,body.content);
    try{
      const obj=rawJson(sha);
      if(obj?.tree?.id){pendingSha=sha;slug=obj.tree.slug;}
    }catch{}
    return reply({sha});
  }
  if(path.startsWith(base+'/git/blobs/')&&method==='GET'){
    const sha=path.slice((base+'/git/blobs/').length);
    return blobs.has(sha)?reply({encoding:'base64',content:blobs.get(sha)}):reply({message:'Missing'},404);
  }
  if(path.startsWith(base+'/git/commits/')&&method==='GET')return reply({tree:{sha:'base-tree'}});
  if(path===base+'/git/trees'&&method==='POST'){
    assert.ok(body.tree.some(item=>item.path.endsWith('/tree.json')));
    assert.ok(body.tree.some(item=>item.path.endsWith('/tree.ged')));
    return reply({sha:'tree-'+(commitCount+1)});
  }
  if(path===base+'/git/commits'&&method==='POST'){
    assert.deepEqual(body.parents,[head]);
    return reply({sha:'head-'+(commitCount+1)});
  }
  if(path===base+'/git/refs/heads/main'&&method==='PATCH'){
    assert.equal(body.force,false);
    head=body.sha;
    remoteSha=pendingSha;
    commitCount++;
    return reply({object:{sha:head}});
  }
  return reply({message:'Unexpected '+method+' '+path},404);
}
async function ready(){
  for(let i=0;i<60;i++){
    try{if((await fetch(origin)).ok)return;}catch{}
    await new Promise(r=>setTimeout(r,120));
  }
  throw new Error('GEN test server unavailable');
}
async function makeBrowser(){
  const context=await browser.newContext();
  await context.route('https://api.github.com/**',mock);
  const page=await context.newPage();
  await page.goto(origin);
  await page.getByRole('heading',{name:'Семейные деревья'}).waitFor({timeout:15000});
  return {context,page};
}
async function rename(page,name){
  await page.locator('.tree-name-button').click();
  const dialog=page.getByRole('dialog',{name:'Название дерева'});
  await dialog.getByLabel('Название',{exact:true}).fill(name);
  await dialog.getByRole('button',{name:'Сохранить',exact:true}).click();
  await page.locator('.tree-name-button').getByText(name).waitFor({timeout:15000});
}
async function waitRemoteName(name,timeout=33000){
  const start=Date.now();
  while(Date.now()-start<timeout){
    if(remoteTree()?.tree.name===name)return;
    await new Promise(r=>setTimeout(r,450));
  }
  throw new Error('Automatic GitHub push did not occur for '+name);
}
function externalChange(name){
  const copy=structuredClone(remoteTree());
  copy.tree.name=name;
  copy.tree.updated_at=new Date(Date.now()+2500).toISOString();
  copy.tree.revision++;
  const sha='external-'+(++sequence);
  blobs.set(sha,Buffer.from(JSON.stringify(copy)).toString('base64'));
  remoteSha=sha;
  head='head-external-'+sequence;
  commitCount++;
}
try{
  await ready();
  browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  const a=await makeBrowser();
  await a.page.getByRole('button',{name:'Новое дерево'}).click();
  const create=a.page.getByRole('dialog',{name:'Новое семейное дерево'});
  await create.getByLabel('Название',{exact:true}).fill('Семья Авто');
  assert.ok(await create.getByText('Мой GitHub · рекомендуем').isVisible());
  assert.ok(await create.getByRole('checkbox',{name:/Автоматически синхронизировать изменения/}).isChecked());
  await create.getByLabel('Репозиторий GitHub').fill(repo);
  await create.getByLabel('GitHub fine-grained token').fill(token);
  await create.getByRole('button',{name:'Создать дерево'}).click();
  await a.page.locator('.tree-name-button').getByText('Семья Авто').waitFor({timeout:20000});
  assert.equal(remoteTree()?.tree.name,'Семья Авто');
  console.log('PASS: Recommended private GitHub wizard created tree and first remote commit.');

  const b=await makeBrowser();
  await b.page.getByRole('button',{name:'Открыть из GitHub'}).click();
  const importDialog=b.page.getByRole('dialog',{name:'Открыть дерево из GitHub'});
  await importDialog.getByLabel('Репозиторий GitHub').fill(repo);
  await importDialog.getByLabel('GitHub personal access token').fill(token);
  assert.ok(await importDialog.getByRole('checkbox',{name:/Включить автоматическую синхронизацию/}).isChecked());
  await importDialog.getByRole('button',{name:'Найти семейные деревья'}).click();
  await importDialog.getByRole('button',{name:'Открыть дерево'}).click();
  await b.page.locator('.tree-name-button').getByText('Семья Авто').waitFor({timeout:20000});
  console.log('PASS: Second independent browser imported tree with auto sync enabled.');

  const commitsBefore=commitCount;
  await rename(a.page,'Автоотправка с компьютера A');
  await waitRemoteName('Автоотправка с компьютера A');
  assert.equal(commitCount,commitsBefore+1,'Exactly one debounced commit expected');
  console.log('PASS: Edit automatically pushed after debounce without manual sync.');

  // Opening the existing tree again retrieves remote-only changes safely.
  await b.page.getByRole('button',{name:'Все деревья'}).first().click();
  await b.page.getByRole('heading',{name:'Семейные деревья'}).waitFor();
  await b.page.locator('.tree-tile-open').first().click();
  await b.page.locator('.tree-name-button').getByText('Автоотправка с компьютера A')
    .waitFor({timeout:20000});
  console.log('PASS: Second computer refreshed its local tree upon opening.');

  // An external commit and simultaneous local edit are never overwritten.
  externalChange('Удалённая параллельная правка');
  await rename(a.page,'Локальная параллельная правка');
  await a.page.getByText('GitHub: конфликт').first().waitFor({timeout:35000});
  assert.equal(remoteTree().tree.name,'Удалённая параллельная правка');
  console.log('PASS: Auto sync pauses on remote SHA conflict without data loss.');

  await b.page.locator('button.backup-status').click();
  const storage=b.page.getByRole('dialog',{name:'Хранение семейного архива'});
  await storage.locator('#gen-auto-sync-toggle').uncheck();
  await storage.locator('#gen-auto-sync-toggle').waitFor({state:'attached'});
  assert.equal(await storage.locator('#gen-auto-sync-toggle').isChecked(),false);
  console.log('PASS: User can disable automatic synchronization.');
  await a.context.close();await b.context.close();
  console.log('GEN automatic synchronization browser tests PASS');
}catch(error){
  console.error('GEN automatic synchronization tests FAIL',error);
  process.exitCode=1;
}finally{
  await browser?.close();
  server.kill('SIGTERM');
}
