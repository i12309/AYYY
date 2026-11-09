/* Browser smoke checks for the no-backend GEN implementation in AYYY. */
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {chromium} from '@playwright/test';

const server=spawn('python3',['-m','http.server','8765','--bind','127.0.0.1','--directory','..'],
  {cwd:process.cwd().endsWith('family-app')?process.cwd():new URL('../',import.meta.url).pathname,
   stdio:'ignore'});
let browser;
async function ready() {
  for(let i=0;i<50;i++){
    try {const response=await fetch('http://127.0.0.1:8765/');if(response.ok)return;}
    catch{}
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  throw new Error('HTTP server did not start.');
}
try {
  await ready();
  browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  const context=await browser.newContext({acceptDownloads:true});
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',error=>errors.push('portal: '+error.message));
  await page.goto('http://127.0.0.1:8765/#family');
  const frame=page.frameLocator('iframe#ayyy-family-frame');
  await frame.getByRole('heading',{name:'Семейные деревья'}).waitFor({timeout:15000});
  console.log('PASS: Family route opens inside AYYY.');

  await frame.getByRole('button',{name:'Открыть пример'}).click();
  await frame.getByRole('button',{name:'Таблица',exact:true}).waitFor({timeout:15000});
  await frame.getByRole('button',{name:'Таблица',exact:true}).click();
  await frame.locator('.people-table tbody tr').first().waitFor();
  assert.equal(await frame.locator('.people-table tbody tr').count(),6);
  console.log('PASS: Sample tree, genealogy and table.');

  await frame.getByRole('button',{name:'Карта поколений'}).click();
  await frame.getByRole('button',{name:'Дерево',exact:true}).click();
  console.log('PASS: Switch graph and generation map.');

  await frame.getByRole('button',{name:'Все деревья'}).first().click();
  await frame.getByRole('heading',{name:'Семейные деревья'}).waitFor();
  await page.reload();
  await frame.getByRole('heading',{name:'Семейные деревья'}).waitFor({timeout:15000});
  await frame.getByText('Семья Волковых · пример').first().waitFor();
  console.log('PASS: IndexedDB persists after full reload.');

  await frame.getByRole('button',{name:'Открыть из GitHub'}).click();
  await frame.getByRole('dialog',{name:'Открыть дерево из GitHub'}).waitFor();
  await frame.getByPlaceholder('username/family-archive').waitFor();
  console.log('PASS: GitHub connection and import UI.');

  assert.deepEqual(errors,[],'Unexpected page JavaScript errors: '+errors.join('; '));
  await context.close();
  console.log('GEN browser smoke PASS');
} catch (error) {
  console.error('GEN browser smoke FAIL',error);
  process.exitCode=1;
} finally {
  await browser?.close();
  server.kill('SIGTERM');
}
