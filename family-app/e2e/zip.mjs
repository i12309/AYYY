/* Real Chromium: ZIP_DEFLATED (Python) -> IndexedDB -> ZIP_STORED
 * (browser) -> restore, with media and integrity rejections.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawn,spawnSync} from 'node:child_process';
import {chromium} from '@playwright/test';
const server=spawn('python3',['-m','http.server','8776','--bind','127.0.0.1','--directory','..'],
  {cwd:new URL('../',import.meta.url).pathname,stdio:'ignore'});
let browser;
const portrait=Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489','hex');
const pdf=Buffer.from('%PDF-1.4\n% synthetic\n%%EOF');
const original=Buffer.from('0 HEAD\r\n1 SOUR TEST\r\n0 TRLR\r\n');
const pid='a'.repeat(32),child='b'.repeat(32);
const tree={
  schema_version:1,
  tree:{id:'c'.repeat(32),slug:'zip-test-family',name:'ZIP тест — вымышленная семья',
    description:'Без персональных данных',revision:1,updated_at:'2026-11-10T00:00:00Z'},
  persons:[
    {id:pid,given_name:'Анна',surname:'Примерова',revision:1,
      _photo:{filename:'portrait.png',mime_type:'image/png'},
      _gallery:[{id:'m1',filename:'record.pdf',mime_type:'application/pdf',caption:'Файл'}]},
    {id:child,given_name:'Иван',surname:'Примеров',revision:1}
  ],
  families:[{id:'d'.repeat(32),partner1_id:pid,partner2_id:null,revision:1,
    children:[{person_id:child,pedigree:'birth'}]}],
  metadata:{original_custom:{kind:'synthetic'}}
};
const python=[
  'import zipfile,sys,json,io,base64',
  'files=json.loads(sys.stdin.read())',
  'out=io.BytesIO()',
  'with zipfile.ZipFile(out,"w",compression=zipfile.ZIP_DEFLATED) as z:',
  '  for name,value in files.items():',
  '    z.writestr(name,base64.b64decode(value))',
  'sys.stdout.buffer.write(out.getvalue())'
].join('\n');
function archive(extra={},omit=[]){
  const entries={
    'tree.json':JSON.stringify(tree),'tree.ged':'0 HEAD\n1 SOUR TEST\n0 TRLR\n',
    'original.ged':original,'media/portrait.png':portrait,'media/record.pdf':pdf,...extra
  };
  for(const key of omit)delete entries[key];
  const payload=Object.fromEntries(Object.entries(entries)
    .map(([name,value])=>[name,Buffer.from(value).toString('base64')]));
  const run=spawnSync('python3',['-c',python],{input:JSON.stringify(payload),encoding:null,maxBuffer:12e6});
  assert.equal(run.status,0,String(run.stderr));
  return run.stdout;
}
async function wait(){
  for(let i=0;i<60;i++){
    try{if((await fetch('http://127.0.0.1:8776/')).ok)return;}catch{}
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  throw new Error('GEN server unavailable');
}
async function importFile(frame,buffer,name){
  await frame.getByRole('button',{name:/Импорт ZIP/}).first().click();
  const dialog=frame.getByRole('dialog',{name:/Импорт ZIP/});
  await dialog.getByLabel('Файл ZIP, GEDCOM или JSON').setInputFiles({
    name,mimeType:'application/zip',buffer
  });
  await dialog.getByRole('button',{name:'Импортировать'}).click();
  return dialog;
}
async function getStored(frame){
  return frame.locator('html').evaluate(async()=>{
    const request=indexedDB.open('ayyy-family-v1');
    const db=await new Promise(resolve=>request.onsuccess=()=>resolve(request.result));
    const tx=db.transaction(['trees','files'],'readonly');
    const trees=await new Promise(resolve=>{
      const q=tx.objectStore('trees').getAll();q.onsuccess=()=>resolve(q.result);
    });
    const media=await new Promise(resolve=>{
      const q=tx.objectStore('files').getAll();q.onsuccess=()=>resolve(q.result);
    });
    const files=await Promise.all(media.map(async item=>({
      key:item.key,data:[...new Uint8Array(await item.blob.arrayBuffer())]
    })));
    db.close();
    return {trees:trees.map(row=>({id:row.id,slug:row.document.tree.slug,
      count:row.document.persons.length,metadata:row.document.metadata})),files};
  });
}
try{
  await wait();
  browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  const page=await browser.newPage({acceptDownloads:true});
  await page.goto('http://127.0.0.1:8776/#family');
  const frame=page.frameLocator('#ayyy-family-frame');
  await frame.getByRole('heading',{name:'Семейные деревья'}).waitFor();
  await importFile(frame,archive(),'python-original.zip');
  await frame.getByRole('button',{name:'Таблица',exact:true}).waitFor({timeout:15000});
  let saved=await getStored(frame);
  assert.equal(saved.trees.length,1);
  assert.equal(saved.trees[0].count,2);
  assert.equal(saved.trees[0].metadata.original_custom.kind,'synthetic');
  const files=saved.files;
  for(const [filename,expectation] of [['portrait.png',portrait],['record.pdf',pdf],['original.ged',original]]){
    assert.deepEqual(Buffer.from(files.find(f=>f.key.endsWith('/'+filename)).data),expectation);
  }
  console.log('PASS: Python DEFLATE ZIP restored JSON, photo, PDF and exact original GEDCOM.');
  await frame.locator('details.export-menu summary').click();
  const [download]=await Promise.all([
    page.waitForEvent('download'),
    frame.locator('details.export-menu a[href*="backup.zip"]').click()
  ]);
  const exported=fs.readFileSync(await download.path());
  await frame.getByRole('button',{name:'Все деревья'}).first().click();
  await frame.getByRole('heading',{name:'Семейные деревья'}).waitFor();
  await importFile(frame,exported,'browser-copy.zip');
  await frame.getByRole('button',{name:'Таблица',exact:true}).waitFor({timeout:15000});
  saved=await getStored(frame);
  assert.equal(saved.trees.length,2);
  assert.equal(new Set(saved.trees.map(x=>x.id)).size,2);
  assert.equal(new Set(saved.trees.map(x=>x.slug)).size,2);
  console.log('PASS: Browser-generated ZIP imported as a separate tree without ID collision.');
  await frame.getByRole('button',{name:'Все деревья'}).first().click();
  await frame.getByRole('heading',{name:'Семейные деревья'}).waitFor();
  const bad=await importFile(frame,archive({'../outside.txt':'NO'}),'unsafe.zip');
  await bad.locator('[role="alert"]').waitFor({timeout:15000});
  assert.equal((await getStored(frame)).trees.length,2);
  console.log('PASS: Unsafe ZIP path rejected without changing the local archive.');
  console.log('GEN ZIP browser tests PASS');
}catch(error){
  console.error('GEN ZIP browser tests FAIL',error);
  process.exitCode=1;
}finally{
  await browser?.close();
  server.kill('SIGTERM');
}
