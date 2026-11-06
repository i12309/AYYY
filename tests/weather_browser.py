"""Browser regression of the assembled portal with local assets and API fixtures.
No live provider or GitHub Pages availability is claimed by this suite.
Run node tests/model.test.cjs --fixture first; then python tests/weather_browser.py.
"""
from pathlib import Path
from urllib.parse import urlsplit, unquote
import json, mimetypes, os, shutil
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT/'docs'
FIXTURE = json.loads((ROOT/'tests/forecast.fixture.json').read_text())
BASE = 'https://ayyy.test/AYYY/'
results = []

def check(name, condition):
    assert condition, name
    results.append(name)
    print('PASS', name, flush=True)


def init(browser, size=(1600,950), reduced=False, fail_resource=None):
    page = browser.new_page(viewport={'width':size[0],'height':size[1]},
                            reduced_motion='reduce' if reduced else 'no-preference')
    page.set_default_timeout(6000)
    errors=[];requests=[]
    page.on('pageerror', lambda e: errors.append(str(e)))
    # Isolated storage and transport fixtures, installed before application scripts.
    page.add_init_script('''(() => {
      window.__store=new Map();
      Object.defineProperty(window,'localStorage',{configurable:true,value:{
        getItem:k=>__store.get(k)||null,setItem:(k,v)=>__store.set(k,String(v)),removeItem:k=>__store.delete(k),
        key:i=>[...__store.keys()][i]||null,get length(){return __store.size}}});
      window.__api=[];window.fetch=async u=>{__api.push(String(u));throw new TypeError('Offline fixture')};
      window.__intervals=new Set();window.__rafs=new Set();
      const si=setInterval,ci=clearInterval,raf=requestAnimationFrame,caf=cancelAnimationFrame;
      window.setInterval=(...a)=>{const id=si(...a);__intervals.add(id);return id};
      window.clearInterval=id=>{__intervals.delete(id);ci(id)};
      window.requestAnimationFrame=f=>{let id=raf(t=>{__rafs.delete(id);f(t)});__rafs.add(id);return id};
      window.cancelAnimationFrame=id=>{__rafs.delete(id);caf(id)};
    })()''')
    def local(route):
        parsed=urlsplit(route.request.url)
        path=unquote(parsed.path).removeprefix('/AYYY/') or 'index.html'
        requests.append(path)
        target=(ROOT/path).resolve()
        if fail_resource and path==fail_resource and requests.count(path)==1:
            route.fulfill(status=503,body='Resource unavailable');return
        if ROOT in target.parents and target.is_file():
            route.fulfill(body=target.read_bytes(),content_type=mimetypes.guess_type(target)[0] or 'text/plain')
        else:
            route.fulfill(status=404,body='Resource missing')
    page.route(BASE+'**',local)
    # A real document URL also exercises ordinary hash links, not just app.navigate.
    page.goto(BASE,wait_until='load')
    page.wait_for_selector('.shore-home')
    return page,errors,requests


def nav(page, route):
    page.evaluate('(r)=>AYYY.navigate(r)',route)
    page.wait_for_function('(r)=>AYYY.route===r',arg=route)
    if route=='weather':
        page.wait_for_function('!!document.querySelector(".ww-tower")?.naturalWidth')
        page.wait_for_function('document.querySelector("#ww-source-status")?.dataset.status!=="pending"')


def mode(page,weather='',phase=''):
    page.locator('#ww-scenes-button').click()
    page.locator('[data-scene-weather="'+weather+'"]').click()
    page.locator('[data-scene-phase="'+phase+'"]').click()
    page.locator('#ww-settings-dialog [data-close]').last.click()


with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium'),
                              args=['--no-sandbox','--disable-dev-shm-usage'])
    # First-visit navigation and refresh must already use the new shared model.
    page,errors,requests=init(browser)
    initial_city=page.locator('[data-home-weather="city"]').inner_text()
    page.locator('.shore-widget-title[data-action="city"]').click()
    page.wait_for_selector('#ww-city-dialog[open]')
    check('home city opens new weather picker on first visit',page.locator('#ww-city-dialog').is_visible())
    check('first weather visit preserves home city',page.locator('.ww-place').inner_text()==initial_city)
    page.close()
    page,errors,requests=init(browser)
    page.evaluate('''f=>{window.fetch=async(u,o)=>{__api.push(String(u));return new Response(JSON.stringify(f),{status:200})}}''',FIXTURE)
    page.evaluate('AYYY.refreshWeather()')
    check('first home refresh uses full forecast model','forecast_days=14' in page.evaluate('__api.at(-1)'))
    check('first home refresh stores detailed forecast',page.evaluate('[...__store.keys()].some(k=>k.includes("weather.scene.cache."))'))
    page.locator('.shore-weather-now').click()
    page.wait_for_selector('.ww-app')
    check('temperature link opens weather',page.evaluate('AYYY.route')=='weather')
    check('home refresh available in detailed weather',page.locator('#ww-source-status').get_attribute('data-status')=='live')
    check('no first-visit runtime errors',not errors)
    page.close()
    page,errors,requests=init(browser)
    check('only weather model loads on home',[r for r in requests if r.startswith('weather/')]==['weather/model.js'])
    nav(page,'weather')
    check('weather route replaces service shell',page.locator('body').get_attribute('data-shell')=='weather')
    check('old sidebar hidden',not page.locator('body>.sidebar').is_visible())
    check('all three weather styles load',all('weather/'+n in requests for n in ['style.css','seamless.css','landscape.css']))
    check('weather automatically attempts direct and proxy requests',page.evaluate('__api.length')==2)
    check('demo labelled', 'Демо' in page.locator('#ww-source-text').inner_text())
    check('lighthouse decoded',page.locator('.ww-tower').evaluate('(e)=>e.naturalWidth')==560)
    check('full bleed scenery',page.locator('#ww-scene').evaluate('(e)=>Math.abs(e.getBoundingClientRect().width-innerWidth)<2'))
    check('today lighthouse forecast order',page.evaluate('''() => {
      const l=document.querySelector('#ww-current').getBoundingClientRect(),m=document.querySelector('.ww-tower-wrap').getBoundingClientRect(),r=document.querySelector('#ww-period').getBoundingClientRect();
      return l.left<m.left && m.left<r.left;
    }'''))
    check('no central scene border',page.locator('#ww-scene').evaluate('(e)=>getComputedStyle(e).borderTopWidth')=='0px')
    check('7 days fully visible',page.locator('#ww-days').evaluate('(e)=>e.scrollHeight<=e.clientHeight+2'))
    check('24 hourly cells',page.locator('[data-hour]').count()==24)
    check('hourly values fit scroll area',page.locator('.ww-hour').first.evaluate('(e)=>e.scrollHeight<=e.clientHeight+2'))
    check('line does not cross temperature',page.evaluate('''() => {
      const t=document.querySelector('.ww-hour-temp').getBoundingClientRect(),g=document.querySelector('.ww-hour-line').getBoundingClientRect();return t.bottom<=g.top;
    }'''))
    original=page.locator('.ww-temperature').inner_text()
    for w in ['clear','partly','cloudy','rain','snow','storm','fog']:
        mode(page,w,'day');check('weather '+w,page.locator('.ww-app').get_attribute('data-weather')==w)
    for phase in ['dawn','day','dusk','night']:
        mode(page,'',phase);check('phase '+phase,page.locator('.ww-app').get_attribute('data-phase')==phase)
    check('scene presets preserve readings',page.locator('.ww-temperature').inner_text()==original)
    check('preset label visible',page.locator('#ww-override-note').is_visible())
    page.locator('#ww-now-button').click()
    check('now removes presets',not page.locator('#ww-override-note').is_visible())
    page.locator('[data-period="14"]').click();check('14 days selectable',page.locator('[data-day]').count()==14)
    page.locator('[data-period="7"]').click()
    page.locator('[data-day]').nth(3).click()
    check('forecast selection labelled','прогноз' in page.locator('.ww-observation-label').inner_text())
    page.locator('[data-hour]').first.click()
    check('forecast night driven by timestamp',page.locator('.ww-app').get_attribute('data-phase')=='night')
    page.locator('[data-hour]').first.focus();page.keyboard.press('ArrowRight')
    check('keyboard changes selected hour',page.locator('[data-hour]').nth(1).get_attribute('aria-pressed')=='true')
    before=page.locator('.ww-temperature').inner_text();page.locator('[data-unit="F"]').click()
    check('unit changes actual readings',page.locator('.ww-temperature').inner_text()!=before)
    page.locator('[data-unit="C"]').click()
    for metric in ['pop','wind','temp']:
        page.locator('[data-metric="'+metric+'"]').click()
        check('chart '+metric,page.locator('[data-metric="'+metric+'"]').get_attribute('aria-pressed')=='true')
    page.locator('#ww-now-button').click()
    mode(page,'rain','day')
    pixels='''() => {const c=document.querySelector('.ww-precipitation');return c.toDataURL()}'''
    first=page.evaluate(pixels);page.wait_for_timeout(150)
    check('rain is animated',first!=page.evaluate(pixels))
    page.locator('#ww-pause-button').click();first=page.evaluate(pixels);page.wait_for_timeout(150)
    check('pause freezes rain',first==page.evaluate(pixels))
    page.locator('#ww-pause-button').click()
    page.evaluate('''() => {Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));}''')
    check('hidden tab stops scene',page.locator('#ww-scene').get_attribute('data-still')=='true')
    page.evaluate("() => {delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));}")
    page.locator('#ww-now-button').click()
    # Real request shape, deterministic transport; no claim of a live provider response.
    page.evaluate('''f=>{window.fetch=async(u,o)=>{__api.push(String(u));return new Response(JSON.stringify(f),{status:200})}}''',FIXTURE)
    page.locator('.ww-source-actions [data-action="refresh"]').click()
    page.wait_for_function('document.querySelector("#ww-source-status").dataset.status==="live"')
    check('fixture replaces demo',page.locator('#ww-source-status').get_attribute('data-status')=='live')
    check('request asks for 14 days',page.evaluate('__api.at(-1).includes("forecast_days=14")'))
    check('home snapshot written',page.evaluate('[...__store.keys()].some(k=>k.includes("weather.cache."))'))
    nav(page,'home')
    check('home shares city',page.locator('[data-home-weather="city"]').inner_text()=='Москва')
    check('home receives live-shaped data',page.locator('[data-home-weather="status"]').get_attribute('data-state')=='live')
    nav(page,'weather')
    check('weather cache restored',page.locator('#ww-source-status').get_attribute('data-status')=='live')
    page.evaluate('() => {fetch=async()=>{throw new TypeError("fixture offline")}}')
    page.locator('.ww-source-actions [data-action="refresh"]').click();page.wait_for_selector('#ww-error:not([hidden])')
    check('network failure retains cached forecast','Данные на' in page.locator('.ww-observation-label').inner_text())
    check('failed refresh does not claim freshness',page.locator('#ww-source-status').get_attribute('data-status')=='error')
    optional=json.loads(json.dumps(FIXTURE));optional['current']['pressure_msl']=None
    page.evaluate('f=>{fetch=async()=>new Response(JSON.stringify(f),{status:200})}',optional)
    page.locator('.ww-source-actions [data-action="refresh"]').click();page.wait_for_function('document.querySelector("#ww-source-status").dataset.status==="live"')
    check('missing pressure is not invented','—' in page.locator('.ww-metric').filter(has=page.locator('label',has_text='Давление')).inner_text())
    page.evaluate('''() => {fetch=async()=>new Response(JSON.stringify({results:[{name:'<img onerror=alert(1)>',country:'Test',latitude:10,longitude:10,timezone:'UTC'}]}),{status:200})}''')
    page.locator('.ww-city-search').click();page.locator('#ww-city-input').fill('test');page.locator('#ww-city-form button').click()
    page.wait_for_function('document.querySelector("#ww-city-options").textContent.includes("<img")')
    check('API strings escaped',page.locator('#ww-city-options img').count()==0)
    page.keyboard.press('Escape')
    nav(page,'home');base_intervals=page.evaluate('__intervals.size')
    for i in range(3):
        nav(page,'weather');check('weather interval '+str(i),page.evaluate('__intervals.size')==base_intervals)
        nav(page,'directory');check('weather removed '+str(i),page.locator('.ww-app').count()==0)
        check('no leftover scene animation '+str(i),page.evaluate('__rafs.size')==0)
        check('23 services remain including credit '+str(i),page.locator('.shore-service-card').count()==23)
    nav(page,'tools');check('credit-first workspace available',page.locator('#loan-form').count()==1)
    check('no runtime errors',not errors)
    page.close()
    # Clean page for screenshots and responsive measurements.
    page,errors,_=init(browser);nav(page,'weather')
    for w,h in [(360,800),(390,844),(768,1024),(1024,768),(1366,768),(1600,950),(1920,1080)]:
        page.set_viewport_size({'width':w,'height':h});page.wait_for_timeout(80)
        check('no overflow '+str(w),page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'))
        check('tower visible '+str(w),page.locator('.ww-tower').is_visible())
        check('hour labels contained '+str(w),page.locator('.ww-hour').first.evaluate('(e)=>e.scrollHeight<=e.clientHeight+2'))
    if os.environ.get('AYYY_SCREENSHOTS')=='1':
        page.set_viewport_size({'width':1600,'height':950});page.locator('#ww-pause-button').click();page.wait_for_timeout(100)
        page.screenshot(path=str(OUT/'weather-day.png'),full_page=True,animations='disabled',timeout=15000)
        mode(page,'','night');page.wait_for_timeout(2100);page.screenshot(path=str(OUT/'weather-night.png'),full_page=True,animations='disabled',timeout=15000)
        mode(page,'rain','day');page.wait_for_timeout(2100);page.screenshot(path=str(OUT/'weather-rain.png'),full_page=True,animations='disabled',timeout=15000)
        page.locator('#ww-now-button').click();page.set_viewport_size({'width':390,'height':844});page.wait_for_timeout(2100)
        page.screenshot(path=str(OUT/'weather-mobile.png'),full_page=True,animations='disabled',timeout=15000)
    check('no responsive runtime errors',not errors);page.close()
    page,errors,_=init(browser,reduced=True);nav(page,'weather')
    check('reduced motion honored',page.locator('#ww-scene').get_attribute('data-still')=='true')
    mode(page,'snow','night');a=page.evaluate(pixels);page.wait_for_timeout(180)
    check('reduced motion snow static',a==page.evaluate(pixels));page.close()
    page,errors,_=init(browser,fail_resource='weather/scene.js');page.evaluate("AYYY.navigate('weather')")
    page.wait_for_selector('#ww-retry');check('failed lazy asset shows retry',page.locator('#ww-retry').is_visible())
    page.locator('#ww-retry').click();page.wait_for_selector('.ww-app');check('retry recovers route',page.locator('.ww-app').count()==1)
    page.close();browser.close()
OUT.mkdir(exist_ok=True)
(OUT/'WEATHER_BROWSER_RESULTS.json').write_text(json.dumps({'checks':len(results),'passed':results,'network':'Offline local files and controlled API fixtures, not a live provider check.'},ensure_ascii=False,indent=2)+'\n')
print(len(results),'browser checks PASS')
