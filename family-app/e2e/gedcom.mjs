/* Browser GEDCOM import/export and two-theme regression, using only synthetic people. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawn} from 'node:child_process';
import {chromium} from '@playwright/test';

const server=spawn('python3',['-m','http.server','8767','--bind','127.0.0.1','--directory','..'],
  {cwd:new URL('../',import.meta.url).pathname,stdio:'ignore'});
const url='http://127.0.0.1:8767/#family';
let browser;
async function waitServer(){
  for(let i=0;i<50;i++){
    try{const r=await fetch('http://127.0.0.1:8767/');if(r.ok)return;}catch{}
    await new Promise(resolve=>setTimeout(resolve,120));
  }
  throw new Error('Static server unavailable');
}
try{
  await waitServer();
  browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  const context=await browser.newContext({acceptDownloads:true});
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',err=>errors.push(err.message));
  await page.goto(url);
  const frame=page.frameLocator('iframe#ayyy-family-frame');
  await frame.getByRole('heading',{name:'Семейные деревья'}).waitFor({timeout:15000});

  await frame.getByRole('button',{name:/Импорт GEDCOM/}).first().click();
  const ged=[
    '0 HEAD','1 SOUR GEN-TEST','1 GEDC','2 VERS 5.5.1',
    '2 FORM LINEAGE-LINKED','1 CHAR UTF-8',
    '0 @I1@ INDI','1 NAME Анна /Иванова/','1 SEX F','1 FAMS @F1@',
    '1 NOTE Вымышленная семейная история.',
    '1 _CUSTOM Сохранить!',
    '0 @I2@ INDI','1 NAME Пётр /Иванов/','1 SEX M','1 FAMS @F1@',
    '0 @F1@ FAM','1 HUSB @I2@','1 WIFE @I1@','1 MARR Y',
    '2 DATE 12 MAY 2001','0 @S1@ SOUR','1 TITL Синтетическая запись',
    '0 TRLR',''
  ].join('\r\n');
  await frame.getByLabel('Файл GEDCOM или JSON').setInputFiles({
    name:'synthetic.ged',mimeType:'text/plain',buffer:Buffer.from(ged,'utf8')
  });
  await frame.getByRole('button',{name:'Импортировать'}).click();
  await frame.getByRole('button',{name:'Таблица',exact:true}).waitFor({timeout:15000});
  await frame.getByRole('button',{name:'Таблица',exact:true}).click();
  assert.equal(await frame.locator('.people-table tbody tr').count(),2);
  console.log('PASS: browser imports GEDCOM 5.5.1 and builds persons/families.');

  await frame.locator('details.export-menu summary').click();
  const [exported]=await Promise.all([
    page.waitForEvent('download'),
    frame.locator('details.export-menu a[href*="export.ged"]').click()
  ]);
  const data=fs.readFileSync(await exported.path()).toString('utf8');
  assert.match(data,/0 @I1@ INDI/);
  assert.match(data,/1 _CUSTOM Сохранить!/);
  assert.match(data,/0 @S1@ SOUR/);
  console.log('PASS: browser exports GEDCOM preserving unmodeled source records.');

  const [backup]=await Promise.all([
    page.waitForEvent('download'),
    frame.locator('details.export-menu a[href*="backup.zip"]').click()
  ]);
  const zip=fs.readFileSync(await backup.path());
  for(const name of ['tree.json','tree.ged','original.ged'])
    assert.ok(zip.includes(Buffer.from(name)),name+' absent from backup');
  assert.ok(zip.includes(Buffer.from(ged,'utf8')),'Original GED bytes not preserved in ZIP.');
  console.log('PASS: ZIP includes generated GEDCOM and identical original input.');

  await page.reload();
  await frame.getByRole('button',{name:'Таблица',exact:true}).waitFor({timeout:15000});
  assert.equal(await frame.locator('.gen-theme-switch').count(),0);
  assert.equal(await frame.locator('#back-ayyy').count(),0);
  assert.equal(await frame.locator('html').getAttribute('data-gen-theme'),null);
  console.log('PASS: single Classic GEN theme, no floating AYYY button.');

  assert.deepEqual(errors,[],'Unexpected JS errors');
  await context.close();
  console.log('GEN GEDCOM browser tests PASS');
}catch(error){
  console.error('GEN GEDCOM browser tests FAIL',error);
  process.exitCode=1;
}finally{
  await browser?.close();
  server.kill('SIGTERM');
}
