/* GEN responsive regression: compact Classic UI at three practical widths. */
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {chromium} from '@playwright/test';

const server=spawn('python3',['-m','http.server','8774','--bind','127.0.0.1','--directory','..'],
  {cwd:new URL('../',import.meta.url).pathname,stdio:'ignore'});
let browser;
async function ready(){
  for(let i=0;i<55;i++){
    try{const response=await fetch('http://127.0.0.1:8774/');if(response.ok)return;}catch{}
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  throw new Error('Server did not start.');
}
async function geometry(frame,selector){
  return frame.locator(selector).first().evaluate(el=>{
    const r=el.getBoundingClientRect();
    return {x:r.x,width:r.width,right:r.right,height:r.height,viewport:innerWidth};
  });
}
try{
  await ready();
  browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  for(const width of [390,768,1440]){
    const context=await browser.newContext({viewport:{width,height:880}});
    const page=await context.newPage();
    const errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto('http://127.0.0.1:8774/#family');
    const frame=page.frameLocator('#ayyy-family-frame');
    await frame.getByRole('heading',{name:'Семейные деревья'}).waitFor();
    const brand=frame.getByRole('link',{name:'AYYY, главная портала'});
    assert.equal(await brand.getAttribute('target'),'_top');
    assert.equal(await brand.getAttribute('href'),'../#home');
    const logo=await geometry(frame,'.ayyy-brand-mark');
    assert.ok(logo.x>=0&&logo.right<=width+1,'AYYY brand must fit the header at '+width);
    assert.ok(await frame.getByRole('heading',{name:'Семейный архив принадлежит вам'}).isVisible());
    const header=await geometry(frame,'.library-top');
    assert.ok(header.height<=65,'Library top must remain compact at '+width);
    // A desktop Chromium scroll bar can make clientWidth 17-18px smaller
    // than the viewport; only scrollWidth beyond innerWidth is real overflow.
    const pageOverflow=await frame.locator('html').evaluate(el=>el.scrollWidth-innerWidth);
    assert.ok(pageOverflow<=4,'Library horizontal overflow '+pageOverflow+' at '+width);
    await frame.getByRole('button',{name:'Открыть пример'}).click();
    await frame.getByRole('button',{name:'Таблица',exact:true}).waitFor();
    const editor=await geometry(frame,'.app-header');
    assert.ok(editor.x>=-1 && editor.right<=width+1,'Editor header must fit '+width);
    const primary=await geometry(frame,'.header-actions .button.primary');
    assert.ok(primary.x>=-1 && primary.right<=width+1,'Add-person action clipped '+width);
    const graph=await frame.locator('.react-flow__node-person').first().waitFor({timeout:15000});
    const size=await geometry(frame,'.react-flow__node-person');
    assert.ok(size.width<=201,'Compact graph card must be <=200px nominal width '+width);
    assert.deepEqual(errors,[],'Unexpected JavaScript errors: '+errors.join('; '));
    console.log('PASS: Compact GEN library, AYYY logo, editor and graph at '+width+'px.');
    await context.close();
  }
  console.log('GEN responsive checks PASS');
}catch(error){
  console.error('GEN responsive checks FAIL',error);
  process.exitCode=1;
}finally{
  await browser?.close();
  server.kill('SIGTERM');
}