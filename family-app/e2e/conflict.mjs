/* Browser-level Github token test and conflict resolution against mock REST.
 * No production repositories or family data; all records are fictitious.
 */
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {chromium} from '@playwright/test';
const server=spawn('python3',['-m','http.server','8777','--bind','127.0.0.1','--directory','..'],
  {cwd:new URL('../',import.meta.url).pathname,stdio:'ignore'});
let browser,blobIndex=0,commitIndex=0,branchHead='head-original',remoteSha='',pendingSha='',slug='';
const blobs=new Map();
const token='synthetic-test-token-only',repo='tester/family-archive';
async function mock(route){
  const req=route.request(),url=new URL(req.url()),p=decodeURIComponent(url.pathname);
  const method=req.method(),body=['POST','PATCH'].includes(method)?JSON.parse(req.postData()||'{}'):{};
  const reply=(data,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data),
    headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*',
      'Access-Control-Allow-Methods':'GET,POST,PATCH,OPTIONS'}});
  if(method==='OPTIONS')return reply({});
  if(req.headers().authorization!=='Bearer '+token)return reply({message:'Unauthorized'},401);
  const base='/repos/'+repo;
  if(p===base&&method==='GET')return reply({private:true});
  if(p===base+'/git/ref/heads/main'&&method==='GET')return reply({object:{sha:branchHead}});
  if(p===base+'/contents/family-data/trees'&&method==='GET')
    return reply(slug?[{name:slug,type:'dir'}]:[]);
  if(p.startsWith(base+'/contents/family-data/trees/')&&method==='GET'){
    if(!p.endsWith('/tree.json')||!remoteSha)return reply({message:'Missing'},404);
    return reply({sha:remoteSha,name:'tree.json',type:'file'});
  }
  if(p===base+'/git/blobs'&&method==='POST'){
    const sha='blob-'+(++blobIndex);
    blobs.set(sha,body.content);
    let data=null;
    try{data=JSON.parse(Buffer.from(body.content,'base64').toString('utf8'));}catch{}
    if(data?.tree?.id){pendingSha=sha;slug=data.tree.slug;}
    return reply({sha});
  }
  if(p.startsWith(base+'/git/blobs/')&&method==='GET'){
    const sha=p.slice((base+'/git/blobs/').length);
    return blobs.has(sha)?reply({encoding:'base64',content:blobs.get(sha)}):reply({message:'No blob'},404);
  }
  if(p.startsWith(base+'/git/commits/')&&method==='GET')return reply({tree:{sha:'previous-tree'}});
  if(p===base+'/git/trees'&&method==='POST')
    return reply({sha:'tree-'+(++commitIndex)});
  if(p===base+'/git/commits'&&method==='POST'){
    assert.deepEqual(body.parents,[branchHead]);
    return reply({sha:'head-'+commitIndex});
  }
  if(p===base+'/git/refs/heads/main'&&method==='PATCH'){
    assert.equal(body.force,false);
    branchHead=body.sha;
    if(pendingSha)remoteSha=pendingSha;
    return reply({object:{sha:branchHead}});
  }
  return reply({message:'Unexpected '+method+' '+p},404);
}
async function ready(){
  for(let i=0;i<60;i++){
    try{if((await fetch('http://127.0.0.1:8777/family/')).ok)return;}catch{}
    await new Promise(resolve=>setTimeout(resolve,120));
  }
  throw new Error('Server unavailable');
}
async function newBrowser(){
  const context=await browser.newContext();
  await context.route('https://api.github.com/**',mock);
  const page=await context.newPage();
  await page.goto('http://127.0.0.1:8777/family/');
  await page.getByRole('heading',{name:'Семейные деревья'}).waitFor();
  return {context,page};
}
async function rename(page,name){
  await page.locator('.tree-name-button').click();
  const dialog=page.getByRole('dialog',{name:'Название дерева'});
  await dialog.getByLabel('Название',{exact:true}).fill(name);
  await dialog.getByRole('button',{name:'Сохранить',exact:true}).click();
  await page.locator('.tree-name-button').getByText(name).waitFor();
}
async function sync(page){
  await page.locator('button.backup-status').click();
  const dialog=page.getByRole('dialog',{name:'Хранение семейного архива'});
  if(await dialog.getByLabel('Репозиторий').isEnabled())
    await dialog.getByLabel('Репозиторий').fill(repo);
  await dialog.getByLabel('GitHub personal access token').fill(token);
  await dialog.getByRole('button',{name:'Синхронизировать'}).click();
  return dialog;
}
function remoteName(){
  const document=JSON.parse(Buffer.from(blobs.get(remoteSha),'base64').toString('utf8'));
  return document.tree.name;
}
try{
  await ready();
  browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  const a=await newBrowser();
  await a.page.getByRole('button',{name:'Открыть пример'}).click();
  await a.page.locator('button.backup-status').click();
  const d=a.page.getByRole('dialog',{name:'Хранение семейного архива'});
  await d.getByLabel('Репозиторий').fill(repo);
  await d.getByLabel('GitHub personal access token').fill(token);
  await d.getByRole('button',{name:'Проверить подключение и запись'}).click();
  await d.getByText(/приватный репозиторий · чтение и запись разрешены/).waitFor();
  console.log('PASS: Browser checked token against repo and Git Data write permission.');
  await d.getByRole('button',{name:'Синхронизировать'}).click();
  await d.getByText(/сохранены в приватном репозитории/).waitFor();
  await d.getByRole('button',{name:'Закрыть'}).click();
  console.log('PASS: First profile pushed synthetic family.');

  const b=await newBrowser();
  await b.page.getByRole('button',{name:'Открыть из GitHub'}).click();
  const imp=b.page.getByRole('dialog',{name:'Открыть дерево из GitHub'});
  await imp.getByLabel('Репозиторий GitHub').fill(repo);
  await imp.getByLabel('GitHub personal access token').fill(token);
  await imp.getByRole('button',{name:'Найти семейные деревья'}).click();
  await imp.getByRole('button',{name:'Открыть дерево'}).click();
  await b.page.locator('.tree-name-button').waitFor();
  await rename(a.page,'Локальное изменение');
  await rename(b.page,'Версия GitHub');
  const bpanel=await sync(b.page);
  await bpanel.getByText(/сохранены в приватном репозитории/).waitFor();
  await bpanel.getByRole('button',{name:'Закрыть'}).click();
  assert.equal(remoteName(),'Версия GitHub');

  const apanel=await sync(a.page);
  await apanel.getByText(/Сравнение локальной версии и GitHub/).waitFor();
  const select=apanel.locator('.gen-conflict-item select').first();
  assert.ok(await apanel.locator('.gen-conflict-item').count()>0);
  await select.selectOption('remote');
  await apanel.getByLabel(/Я сохранил локальную резервную копию/).check();
  await apanel.getByRole('button',{name:'Объединить и сохранить'}).click();
  await apanel.getByText(/Изменения объединены и сохранены/).waitFor({timeout:30000});
  assert.equal(remoteName(),'Версия GitHub');
  console.log('PASS: Conflicting field explicitly resolved with remote version.');
  assert.ok(!JSON.stringify(await a.page.evaluate(()=>Object.values(localStorage))).includes(token));
  console.log('PASS: Token not stored in localStorage.');
  await a.context.close();await b.context.close();
  console.log('GEN GitHub conflict browser tests PASS');
}catch(error){
  console.error('GEN GitHub conflict browser tests FAIL',error);
  process.exitCode=1;
}finally{await browser?.close();server.kill('SIGTERM');}
