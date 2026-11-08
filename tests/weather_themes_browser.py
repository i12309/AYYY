"""Actual portal, controlled API, real v5 images. No external transport."""
from pathlib import Path
from urllib.parse import urlsplit,unquote
import json,mimetypes,os,shutil
from playwright.sync_api import sync_playwright
from weather_viewport_browser import settle
from weather_test_controls import set_scene_settings
ROOT=Path(__file__).resolve().parents[1];BASE='https://ayyy.test/AYYY/'
FIX=json.loads((ROOT/'tests/forecast.fixture.json').read_text());checks=[];failures=[]
def check(name,ok):
 checks.append(name)
 if not ok:failures.append(name)
 print('PASS' if ok else 'FAIL',name,flush=True)
with sync_playwright() as pw:
 browser=pw.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium'),args=['--no-sandbox','--disable-dev-shm-usage']);p=browser.new_page(viewport={'width':1440,'height':1000});p.set_default_timeout(12000)
 errors=[];requests=[];fail={'image':False}
 p.on('pageerror',lambda e:errors.append(str(e)))
 p.add_init_script('''(()=>{window.__calls=0;window.__fixture=FIX;window.fetch=async()=>{__calls++;return new Response(JSON.stringify(__fixture))}})()'''.replace('FIX',json.dumps(FIX)))
 def serve(r):
  name=unquote(urlsplit(r.request.url).path).removeprefix('/AYYY/') or 'index.html';requests.append(name)
  file=(ROOT/name).resolve()
  if file.is_dir():file=file/'index.html'
  if fail['image'] and name.endswith('leaves-buds.png'):r.fulfill(status=503,body='unavailable');return
  if ROOT in file.parents and file.is_file():r.fulfill(body=file.read_bytes(),content_type=mimetypes.guess_type(file)[0] or 'text/plain')
  else:r.fulfill(status=404,body='missing')
 p.route(BASE+'**',serve)
 def theme(name):
  expanded=p.locator('#ww-scene-settings-toggle').get_attribute('aria-expanded')
  p.locator('[data-theme="'+name+'"]').click()
  p.wait_for_function('(t)=>document.querySelector(`[data-theme="${t}"]`).getAttribute("aria-pressed")==="true"',arg=name)
  assert p.locator('#ww-scene-settings-toggle').get_attribute('aria-expanded')==expanded,'theme switch changes panel disclosure'
 def controls_visible():
  tree=p.locator('.ww-app').get_attribute('data-scene-theme')=='tree'
  fields=['#ww-scene-controls','#ww-scene-minute','#ww-scene-intensity','#ww-scene-wind','#ww-flashes','#ww-scene-context','#ww-now-button']
  return (all(p.locator(selector).is_visible() for selector in fields)
   and p.locator('[data-scene-weather]:visible').count()==6
   and p.locator('[data-scene-phase]:visible').count()==4
   and p.locator('[data-scene-month]:visible').count()==(12 if tree else 0)
   and p.locator('[data-season]:visible').count()==(4 if tree else 0)
   and p.locator('#ww-cycle').is_visible()==tree)
 def controls_closed():
  return p.locator('#ww-scene-controls').is_hidden() and p.locator('#ww-scene-settings-toggle').get_attribute('aria-expanded')=='false'
 def slider(selector,value):
  p.locator(selector).evaluate('(input,value)=>{input.value=String(value);input.dispatchEvent(new Event("input",{bubbles:true}))}',value)
 def document_box(locator):
  return locator.evaluate('(e)=>{const r=e.getBoundingClientRect();return {x:r.x+scrollX,y:r.y+scrollY,width:r.width,height:r.height}}')
 p.goto(BASE+'#weather');p.wait_for_selector('.ww-tower');p.wait_for_function('document.querySelector("#ww-source-status").dataset.status==="live"')
 check('A01 default lighthouse',p.locator('[data-theme="lighthouse"]').get_attribute('aria-pressed')=='true')
 check('A01 scene controls collapsed on arrival',controls_closed())
 check('settings toggle beside themes in header',p.locator('.ww-theme-control #ww-scene-settings-toggle').is_visible() and p.locator('.ww-header [data-theme]').count()==2)
 check('disclosure has an accessible relationship',p.locator('#ww-scene-settings-toggle').get_attribute('aria-controls')=='ww-scene-controls' and p.locator('#ww-scene-controls').get_attribute('aria-labelledby')=='ww-scene-controls-title')
 check('tree images not loaded on lighthouse',not any('/tree/' in x for x in requests))
 temp=p.locator('.ww-temperature').inner_text();calls=p.evaluate('__calls')
 set_scene_settings(p,True)
 check('A01 lighthouse opens only useful controls',controls_visible() and p.locator('#ww-scene-controls [data-tree-settings]:visible').count()==0)
 check('disclosure focuses its first weather choice',p.locator('#ww-scene-presets button').first.evaluate('e=>e===document.activeElement'))
 check('manual adjustment sliders belong to disclosed panel',p.locator('#ww-scene-controls #ww-scene-intensity,#ww-scene-controls #ww-scene-wind,#ww-scene-controls #ww-flashes').count()==3)
 check('return and context stay outside panel',p.locator('.ww-scene-summary #ww-scene-context,.ww-scene-summary #ww-now-button').count()==2)
 tower=document_box(p.locator('.ww-tower'))
 p.locator('#ww-scene-minute').focus();p.keyboard.press('Escape')
 check('A04 Escape collapses settings and returns focus',controls_closed() and p.locator('#ww-scene-settings-toggle').evaluate('e=>e===document.activeElement'))
 set_scene_settings(p,True)
 p.keyboard.press('/')
 p.wait_for_selector('#ww-city-dialog[open]')
 check('native dialog closes the nonmodal scene panel',controls_closed())
 p.keyboard.press('Escape')
 p.wait_for_function('!document.querySelector("#ww-city-dialog").open')
 check('native Escape leaves scene settings collapsed',controls_closed())
 check('opening and closing settings preserve provider data',p.evaluate('__calls')==calls and p.locator('.ww-temperature').inner_text()==temp)
 p.locator('#ww-scene-settings-toggle').focus();p.keyboard.press('Enter')
 check('settings toggle opens from keyboard',controls_visible())
 p.locator('[data-action="close-scene-settings"]').click()
 check('panel close button returns focus',controls_closed() and p.locator('#ww-scene-settings-toggle').evaluate('e=>e===document.activeElement'))
 set_scene_settings(p,True)
 p.locator('[data-unit="C"]').click()
 check('outside pointer closes settings without a request',controls_closed() and p.evaluate('__calls')==calls)
 set_scene_settings(p,True)
 theme('tree');check('v5 uses three canvases',p.locator('.ww-tree-scene canvas').count()==3)
 check('A10 theme switch makes no request',p.evaluate('__calls')==calls)
 check('A04 open tree panel exposes seasonal controls',controls_visible() and p.locator('[data-scene-month]:enabled').count()==12)
 p.locator('[data-scene-weather="rain"]').click();slider('#ww-scene-minute',840)
 check('A05 manual keeps numeric temperature',p.locator('.ww-temperature').inner_text()==temp)
 check('A06 manual context always visible','ручной' in p.locator('#ww-scene-context').inner_text().lower())
 check('manual time has accessible value',p.locator('#ww-scene-minute').get_attribute('aria-valuetext')=='14:00')
 set_scene_settings(p,False)
 check('collapsed panel retains manual scene and accessible return',controls_closed() and p.locator('.ww-app').get_attribute('data-weather')=='rain' and p.locator('#ww-scene-minute').input_value()=='840' and p.locator('#ww-scene-context').is_visible() and p.locator('#ww-now-button').is_visible())
 check('collapsed manual preview stays explicitly labelled',p.locator('#ww-override-note').is_visible() and 'ручной' in p.locator('#ww-scene-context').inner_text().lower())
 set_scene_settings(p,True)
 check('reopening restores selected manual controls',p.locator('[data-scene-weather="rain"]').get_attribute('aria-pressed')=='true' and p.locator('#ww-scene-minute').input_value()=='840')
 p.evaluate('__fixture.current.temperature_2m+=2;__fixture.current.weather_code=3')
 p.locator('.ww-source-actions [data-action="refresh"]').click();p.wait_for_function('document.querySelector("#ww-source-status").dataset.status==="live"')
 check('A11 refresh retains manual weather and time','ручной' in p.locator('#ww-scene-context').inner_text().lower() and p.locator('.ww-app').get_attribute('data-weather')=='rain' and p.locator('#ww-scene-minute').input_value()=='840')
 check('A11 real readings still update underneath manual art',p.locator('.ww-temperature').inner_text()==p.evaluate('AYYYWeatherModel.temperature(__fixture.current.temperature_2m)'))
 check('A11 manual art never overwrites cached provider weather',p.evaluate('AYYYWeatherModel.cached(AYYY.getWeatherCity()).current.code')==3)
 set_scene_settings(p,True)
 calls=p.evaluate('__calls');theme('lighthouse');check('lighthouse hides seasons while panel stays open',controls_visible() and p.locator('#ww-scene-controls [data-tree-settings]:visible').count()==0);theme('tree')
 check('A10 themes preserve manual context without fetching',p.evaluate('__calls')==calls and 'ручной' in p.locator('#ww-scene-context').inner_text().lower() and p.locator('.ww-app').get_attribute('data-weather')=='rain' and p.locator('#ww-scene-minute').input_value()=='840')
 for month in range(12):
  p.locator('[data-scene-month="'+str(month)+'"]').click()
  check('A21 month '+str(month),p.locator('[data-scene-month="'+str(month)+'"]').get_attribute('aria-pressed')=='true' and p.locator('[data-scene-month][aria-pressed="true"]').count()==1)
  if month in [2,9,10,11] and os.environ.get('AYYY_SCREENSHOTS')=='1':
   out=ROOT/'docs/weather-scenes';out.mkdir(exist_ok=True);p.screenshot(path=str(out/f'tree-{month+1:02}.png'),full_page=True)
 p.locator('[data-action="month-next"]').click();check('month arrows wrap December to January',p.locator('[data-scene-month="0"]').get_attribute('aria-pressed')=='true')
 p.locator('[data-action="month-prev"]').click();check('month arrows wrap January to December',p.locator('[data-scene-month="11"]').get_attribute('aria-pressed')=='true')
 p.locator('[data-season="autumn"]').click();check('season thumbnail selects October',p.locator('[data-scene-month="9"]').get_attribute('aria-pressed')=='true')
 p.locator('[data-scene-weather="clear"]').click();p.locator('[data-scene-phase="night"]').click()
 colors=p.evaluate("""()=>{
  const style=getComputedStyle(document.querySelector('.ww-app'));
  const rgb=value=>value.match(/[0-9.]+/g).slice(0,3).map(Number);
  return {paper:rgb(style.getPropertyValue('--ww-paper')),wash:rgb(style.getPropertyValue('--ww-wash')),
   ink:rgb(getComputedStyle(document.querySelector('.ww-temperature')).color),
   muted:rgb(getComputedStyle(document.querySelector('.ww-local-time')).color),scheme:style.colorScheme};
 }""")
 check('night foreground follows dark tree palette',max(colors['paper'])<80 and min(colors['ink'])>180 and min(colors['muted'])>130)
 check('night transparent controls use the same dark paper',colors['wash']==colors['paper'])
 check('night native controls follow dark color scheme',colors['scheme']=='dark')
 check('no white halos or blur behind tree forecast panels',p.evaluate("""()=>['.ww-current','.ww-period','.ww-hourly'].every(selector=>{
  const el=document.querySelector(selector),style=getComputedStyle(el),before=getComputedStyle(el,'::before');
  return style.backgroundImage==='none'&&style.backgroundColor==='rgba(0, 0, 0, 0)'&&style.boxShadow==='none'
   &&style.filter==='none'&&style.backdropFilter==='none'&&(before.display==='none'||before.content==='none');
 })"""))
 check('clear night keeps all applicable panel controls visible',controls_visible())
 p.locator('[data-scene-phase="day"]').click()
 check('day foreground resets to light palette',p.evaluate("""()=>{
  const style=getComputedStyle(document.querySelector('.ww-app'));
  const rgb=value=>value.match(/[0-9.]+/g).slice(0,3).map(Number);
  return Math.min(...rgb(style.getPropertyValue('--ww-paper')))>200&&Math.max(...rgb(getComputedStyle(document.querySelector('.ww-temperature')).color))<100;
 }"""))
 p.locator('#ww-now-button').click();check('A07 returns to current provider weather','сейчас' in p.locator('#ww-scene-context').inner_text().lower() and p.locator('.ww-app').get_attribute('data-weather')=='cloudy')
 check('A07 current keeps status and return visible',p.locator('#ww-scene-context').is_visible() and p.locator('#ww-now-button').is_visible() and p.locator('#ww-override-note').evaluate('e=>e.hidden'))
 p.locator('[data-day]').nth(2).click();check('A08 forecast context labelled','прогноз' in p.locator('#ww-scene-context').inner_text().lower())
 selected_hour=p.locator('[data-hour][aria-pressed="true"]').get_attribute('data-hour')
 theme('lighthouse');check('A10 preserves selected forecast hour','прогноз' in p.locator('#ww-scene-context').inner_text().lower() and p.locator('[data-hour][aria-pressed="true"]').get_attribute('data-hour')==selected_hour)
 returned_tower=document_box(p.locator('.ww-tower'))
 check('A30 lighthouse position preserved',all(abs(tower[key]-returned_tower[key])<1 for key in tower))
 check('lighthouse removes tree palette overrides',p.locator('.ww-app').evaluate("app=>['paper','ink','muted','wash'].every(key=>app.style.getPropertyValue('--ww-'+key)==='')&&!app.hasAttribute('data-tree-dark')"))
 theme('tree');set_scene_settings(p,True);p.locator('[data-scene-weather="snow"]').click();p.reload();p.wait_for_function('document.querySelector(".ww-app")?.dataset.sceneTheme==="tree"')
 check('A02 saved tree with reset manual context','сейчас' in p.locator('#ww-scene-context').inner_text().lower())
 check('A02 reload resets disclosure to collapsed',controls_closed())
 for w in [360,390,768,1024,1440,1920]:
  p.set_viewport_size({'width':w,'height':844})
  settle(p)
  check('A28 no overflow '+str(w),p.evaluate('document.documentElement.scrollWidth<=innerWidth'))
  check('collapsed settings toggle remains visible at '+str(w),controls_closed() and p.locator('#ww-scene-settings-toggle').is_visible())
  set_scene_settings(p,True)
  check('all tree controls can be disclosed at '+str(w),controls_visible())
  check('all twelve months fit viewport at '+str(w),p.locator('[data-scene-month]').evaluate_all('(buttons)=>buttons.length===12&&buttons.every(b=>{const r=b.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth+1})'))
  set_scene_settings(p,False)
 p.set_viewport_size({'width':1440,'height':1000})
 settle(p)
 for _ in range(3):theme('lighthouse');theme('tree')
 check('A23 no duplicate tree canvases',p.locator('.ww-tree-scene canvas').count()==3)
 theme('lighthouse');fail['image']=True;p.reload();p.wait_for_selector('.ww-tower');p.locator('[data-theme="tree"]').click();p.wait_for_function('document.querySelector("#ww-theme-status").textContent.includes("изображения")')
 check('A24 image failure preserves lighthouse',p.locator('.ww-tower').is_visible())
 check('A24 image failure remains visible outside collapsed panel',controls_closed() and p.locator('#ww-theme-status').is_visible())
 set_scene_settings(p,True)
 check('A24 image failure preserves usable public controls',controls_visible())
 fail['image']=False;theme('tree');check('A24 retry restores tree',p.locator('.ww-tree-scene').count()==1)
 # A phase preset must replace the earlier slider time when playback starts.
 # Starting the cycle is also an explicit request to resume paused animation.
 slider('#ww-scene-minute',840)
 p.locator('[data-scene-phase="night"]').click()
 check('night preset after 14:00 shows midnight',p.locator('#ww-scene-minute').input_value()=='0' and p.locator('.ww-app').get_attribute('data-phase')=='night')
 if p.locator('#ww-pause-button').get_attribute('aria-pressed')!='true':p.locator('#ww-pause-button').click()
 check('cycle regression starts with persisted pause',p.locator('.ww-app').get_attribute('data-tree-motion')=='still' and p.evaluate('AYYYWeatherModel.read("weather.scene.paused")') is True)
 set_scene_settings(p,True)
 p.locator('#ww-cycle').click();before=float(p.locator('#ww-scene-minute').input_value())
 check('cycle starts near displayed midnight instead of earlier 14:00',0<=before<120 and p.locator('.ww-app').get_attribute('data-phase')=='night')
 p.wait_for_function('v=>{const minute=Number(document.querySelector("#ww-scene-minute").value);return minute>v&&minute<120}',arg=before,timeout=2000)
 check('explicit day cycle advances time',before<float(p.locator('#ww-scene-minute').input_value())<120)
 check('cycle start resumes animation and clears persisted pause',p.locator('#ww-pause-button').get_attribute('aria-pressed')=='false' and p.locator('.ww-app').get_attribute('data-tree-motion')=='animated' and p.evaluate('AYYYWeatherModel.read("weather.scene.paused")') is False)
 p.locator('.ww-brand').click();p.wait_for_selector('.shore-home');check('A25 no leftover tree',p.locator('.ww-tree-scene').count()==0)
 p.goto(BASE+'weather/');p.wait_for_function('document.querySelector(".ww-app")?.dataset.sceneTheme==="tree"');check('A29 standalone tree',p.locator('.ww-tree-scene canvas').count()==3)
 check('A29 standalone settings also start collapsed',controls_closed())
 set_scene_settings(p,True)
 check('A29 standalone settings are accessible',controls_visible())
 p.locator('.ww-brand').click();p.wait_for_selector('.shore-home');p.evaluate('AYYY.set("weather.scene.theme","invalid")');p.goto(BASE+'#weather');p.wait_for_selector('.ww-tower');check('A03 corrupt theme falls back to lighthouse',p.locator('[data-theme="lighthouse"]').get_attribute('aria-pressed')=='true')
 p.evaluate('for(const t of ["tree","lighthouse","tree"])document.querySelector(`[data-theme="${t}"]`).click()')
 p.wait_for_function('document.querySelector(".ww-app").dataset.sceneTheme==="tree"');check('A23 rapid last choice wins',p.locator('.ww-tree-scene canvas').count()==3)
 check('no runtime errors',not errors)
 browser.close()
assert not failures,'\n'.join(failures)
print(len(checks),'theme browser checks PASS')
