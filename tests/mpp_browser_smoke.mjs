/* Browser smoke test against a real static AYYY server.
 * Requires playwright-core and a local Chrome/Chromium binary.
 */
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.dirname(fileURLToPath(new URL('../index.html',import.meta.url)));
const port=Number(process.env.AYYY_TEST_PORT||8765);
const url='http://127.0.0.1:'+port+'/#mpp';
const binary=process.env.CHROME_PATH||'/usr/bin/google-chrome';
const browser=await chromium.launch({headless:true,executablePath:binary,args:['--no-sandbox']});
const errors=[];
try{
  const page=await browser.newPage({viewport:{width:1440,height:900},acceptDownloads:true});
  page.on('pageerror',error=>errors.push(error.message));
  const response=await page.goto(url,{waitUntil:'domcontentloaded'});
  assert.equal(response.status(),200,'portal should be served by the local server');
  await page.waitForSelector('.pv-empty [data-pv-action="demo"]',{timeout:20000});
  assert.equal(await page.locator('.pv-root .pv-brand').count(),1);
  await page.locator('.pv-empty [data-pv-action="demo"]').click();
  await page.waitForSelector('.pv-file-banner');
  assert.match(await page.locator('.pv-file-banner h1').innerText(),/Пример проекта/);
  assert.equal(await page.locator('.pv-list-row').count(),9);
  assert.ok(await page.locator('.pv-task-bar').count()>4);
  assert.ok(await page.locator('.pv-task-diamond').count()>0);
  await page.locator('#pv-search').fill('Интеграции');
  assert.equal(await page.locator('.pv-list-row').count(),2);
  await page.locator('#pv-search').fill('');
  await page.locator('[data-pv-action="collapse"]').click();
  assert.ok(await page.locator('.pv-list-row').count()<9);
  await page.locator('[data-pv-action="expand"]').click();
  assert.equal(await page.locator('.pv-list-row').count(),9);
  await page.locator('[data-pv-task="6"]').first().click();
  await page.waitForSelector('#pv-details');
  assert.match(await page.locator('#pv-details').innerText(),/Реализация интерфейса/);
  await page.locator('[data-pv-action="close-details"]').click();
  assert.equal(await page.locator('#pv-details').count(),0);
  await page.locator('[data-pv-tab="resources"]').click();
  assert.equal(await page.locator('.pv-resource-table tbody tr').count(),2);
  await page.locator('[data-pv-tab="gantt"]').click();
  const [download]=await Promise.all([
    page.waitForEvent('download'),
    page.locator('[data-pv-action="export"]').click()
  ]);
  assert.match(download.suggestedFilename(),/\.csv$/);
  const fixture=path.join(root,'tests/fixtures/ayyy-project-sample.xml');
  await page.locator('#pv-file-input').setInputFiles(fixture);
  await page.waitForFunction(()=>document.querySelector('.pv-file-banner h1')?.textContent.includes('Тестовый проект AYYY'),{timeout:20000});
  assert.equal(await page.locator('.pv-list-row').count(),3);
  assert.match(await page.locator('.pv-list-scroll').innerText(),/Анализ требований/);
  const success=await page.locator('[data-pv-status]').innerText();
  assert.match(success,/прочитан локально/);
  if(process.env.MPP_FIXTURES_DIR){
    const mpp=path.join(process.env.MPP_FIXTURES_DIR,'mpp14resource.mpp');
    await page.locator('#pv-file-input').setInputFiles(mpp);
    await page.waitForFunction(()=>document.querySelector('.pv-file-meta')?.textContent.includes('mpp14resource.mpp'));
    assert.ok(await page.locator('.pv-list-row').count()>0,'binary MPP has visible tasks');
    assert.ok(await page.locator('.pv-task-bar').count()>0,'binary MPP has Gantt bars');
    await page.locator('[data-pv-tab="resources"]').click();
    assert.ok(await page.locator('.pv-resource-table tbody tr').count()>0,'binary MPP has resources');
    await page.locator('[data-pv-tab="gantt"]').click();
  }
  await page.setViewportSize({width:390,height:844});
  assert.ok(await page.locator('.pv-task-bar').count()>0);
  assert.equal(await page.locator('.pv-private-dot').count(),1);
  assert.deepEqual(errors,[],'browser must not emit uncaught errors');
  console.log('MPP browser smoke: PASS (demo, hierarchy, search, resources, CSV, XML, real binary MPP, mobile)');
}finally{
  await browser.close();
}
