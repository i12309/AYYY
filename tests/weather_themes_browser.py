"""Actual portal, controlled API, real v5 images. No external transport."""
from pathlib import Path
from urllib.parse import urlsplit,unquote
import json,mimetypes,os
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1];BASE='https://ayyy.test/AYYY/'
FIX=json.loads((ROOT/'tests/forecast.fixture.json').read_text());checks=[]
def check(name,ok):
 assert ok,name
 checks.append(name);print('PASS',name,flush=True)
with sync_playwright() as pw:
 browser=pw.chromium.launch();p=browser.new_page(viewport={'width':1440,'height':1000});p.set_default_timeout(12000)
 errors=[];requests=[];fail={'image':False}
 p.on('pageerror',lambda e:errors.append(str(e)))
 p.add_init_script('''(()=>{window.__calls=0;const fixture=FIX;window.fetch=async()=>{__calls++;return new Response(JSON.stringify(fixture))}})()'''.replace('FIX',json.dumps(FIX)))
 def serve(r):
  name=unquote(urlsplit(r.request.url).path).removeprefix('/AYYY/') or 'index.html';requests.append(name)
  file=(ROOT/name).resolve()
  if file.is_dir():file=file/'index.html'
  if fail['image'] and name.endswith('leaves-buds.png'):r.fulfill(status=503,body='unavailable');return
  if ROOT in file.parents and file.is_file():r.fulfill(body=file.read_bytes(),content_type=mimetypes.guess_type(file)[0] or 'text/plain')
  else:r.fulfill(status=404,body='missing')
 p.route(BASE+'**',serve)
 def theme(name):
  p.locator('[data-theme="'+name+'"]').click()
  p.wait_for_function('(t)=>document.querySelector(`[data-theme="${t}"]`).getAttribute("aria-pressed")==="true"',arg=name)
 def panel():
  if not p.locator('#ww-settings-dialog').is_visible():p.locator('#ww-scenes-button').click()
 def close():
  if p.locator('#ww-settings-dialog').is_visible():p.keyboard.press('Escape')
 p.goto(BASE+'#weather');p.wait_for_selector('.ww-tower');p.wait_for_function('document.querySelector("#ww-source-status").dataset.status==="live"')
 check('A01 default lighthouse and closed panel',p.locator('[data-theme="lighthouse"]').get_attribute('aria-pressed')=='true' and not p.locator('#ww-settings-dialog').is_visible())
 check('tree images not loaded on lighthouse',not any('/tree/' in x for x in requests))
 tower=p.locator('.ww-tower').bounding_box();temp=p.locator('.ww-temperature').inner_text();calls=p.evaluate('__calls')
 panel();close();check('A04 panel preserves forecast without request',p.evaluate('__calls')==calls and p.locator('.ww-temperature').inner_text()==temp)
 theme('tree');check('v5 uses three canvases',p.locator('.ww-tree-scene canvas').count()==3)
 check('A10 theme switch makes no request',p.evaluate('__calls')==calls)
 panel();p.locator('[data-scene-weather="rain"]').click();p.locator('#ww-scene-minute').fill('840');p.locator('#ww-scene-minute').dispatch_event('input');close()
 check('A05 manual keeps numeric temperature',p.locator('.ww-temperature').inner_text()==temp)
 check('A06 manual label outside panel','ручной' in p.locator('#ww-scene-context').inner_text().lower())
 p.locator('.ww-source-actions [data-action="refresh"]').click();p.wait_for_function('document.querySelector("#ww-source-status").dataset.status==="live"')
 check('A11 refresh retains manual context','ручной' in p.locator('#ww-scene-context').inner_text().lower())
 for month in range(12):
  panel();p.locator('#ww-scene-month').select_option(str(month));close()
  check('A21 month '+str(month),p.locator('#ww-scene-month').input_value()==str(month))
  if month in [2,9,10,11] and os.environ.get('AYYY_SCREENSHOTS')=='1':
   out=ROOT/'docs/weather-scenes';out.mkdir(exist_ok=True);p.screenshot(path=str(out/f'tree-{month+1:02}.png'),full_page=True)
 p.locator('#ww-now-button').click();check('A07 returns to current','сейчас' in p.locator('#ww-scene-context').inner_text().lower())
 p.locator('[data-day]').nth(2).click();check('A08 forecast context labelled','прогноз' in p.locator('#ww-scene-context').inner_text().lower())
 theme('lighthouse');check('A10 preserves selected forecast','прогноз' in p.locator('#ww-scene-context').inner_text().lower())
 check('A30 lighthouse position preserved',p.locator('.ww-tower').bounding_box()==tower)
 theme('tree');p.reload();p.wait_for_function('document.querySelector(".ww-app")?.dataset.sceneTheme==="tree"')
 check('A02 saved tree with reset manual context','сейчас' in p.locator('#ww-scene-context').inner_text().lower())
 for w in [360,390,768,1024,1440,1920]:
  p.set_viewport_size({'width':w,'height':844});panel()
  check('A28 no overflow '+str(w),p.evaluate('document.documentElement.scrollWidth<=innerWidth'))
  check('panel fits viewport '+str(w),p.locator('#ww-settings-dialog').evaluate('(e)=>{const r=e.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight+1}'))
  close()
 p.set_viewport_size({'width':1440,'height':1000})
 for _ in range(3):theme('lighthouse');theme('tree')
 check('A23 no duplicate tree canvases',p.locator('.ww-tree-scene canvas').count()==3)
 theme('lighthouse');fail['image']=True;p.reload();p.wait_for_selector('.ww-tower');p.locator('[data-theme="tree"]').click();p.wait_for_function('document.querySelector("#ww-theme-status").textContent.includes("изображения")')
 check('A24 image failure preserves lighthouse',p.locator('.ww-tower').is_visible())
 fail['image']=False;theme('tree');check('A24 retry restores tree',p.locator('.ww-tree-scene').count()==1)
 panel();p.locator('#ww-cycle').click();before=p.locator('#ww-scene-minute').input_value();p.wait_for_timeout(500);check('explicit day cycle advances time',p.locator('#ww-scene-minute').input_value()!=before);close()
 p.locator('.ww-brand').click();p.wait_for_selector('.shore-home');check('A25 no leftover tree',p.locator('.ww-tree-scene').count()==0)
 p.goto(BASE+'weather/');p.wait_for_function('document.querySelector(".ww-app")?.dataset.sceneTheme==="tree"');check('A29 standalone tree',p.locator('.ww-tree-scene canvas').count()==3)
 p.locator('.ww-brand').click();p.wait_for_selector('.shore-home');p.evaluate('AYYY.set("weather.scene.theme","invalid")');p.goto(BASE+'#weather');p.wait_for_selector('.ww-tower');check('A03 corrupt theme falls back to lighthouse',p.locator('[data-theme="lighthouse"]').get_attribute('aria-pressed')=='true')
 p.evaluate('for(const t of ["tree","lighthouse","tree"])document.querySelector(`[data-theme="${t}"]`).click()')
 p.wait_for_function('document.querySelector(".ww-app").dataset.sceneTheme==="tree"');check('A23 rapid last choice wins',p.locator('.ww-tree-scene canvas').count()==3)
 check('no runtime errors',not errors)
 browser.close()
print(len(checks),'theme browser checks PASS')
