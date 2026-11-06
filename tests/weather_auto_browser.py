"""Automatic weather refresh with controlled transport and time; no live requests.
Run node tests/model.test.cjs --fixture before this test.
"""
from pathlib import Path
from urllib.parse import urlsplit,unquote
import json,mimetypes
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
BASE='https://ayyy.test/AYYY/'
FIXTURE=json.loads((ROOT/'tests/forecast.fixture.json').read_text())
checks=[]
def check(name,ok):
    assert ok,name
    checks.append(name);print('PASS',name,flush=True)

with sync_playwright() as pw:
    browser=pw.chromium.launch()
    def init(failure=False,offline=False,defer=False):
        page=browser.new_page();page.set_default_timeout(6000)
        page.clock.install()
        errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
        page.add_init_script('''(()=>{
          const f=FIXTURE;
          window.__now=Date.now();Date.now=()=>__now;
          window.__calls=[];window.__failure=FAILURE;window.__offline=OFFLINE;window.__defer=DEFER;
          Object.defineProperty(navigator,'onLine',{configurable:true,get:()=>!__offline});
          window.fetch=async(url,{signal}={})=>{
            __calls.push(String(url));
            if(__failure)throw new TypeError('Fixture offline');
            if(__defer)await new Promise((resolve,reject)=>{window.__release=resolve;signal?.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')),{once:true})});
            return new Response(JSON.stringify(f),{status:200});
          };
        })()'''.replace('FIXTURE',json.dumps(FIXTURE)).replace('FAILURE',json.dumps(failure)).replace('OFFLINE',json.dumps(offline)).replace('DEFER',json.dumps(defer)))
        def local(route):
            path=unquote(urlsplit(route.request.url).path).removeprefix('/AYYY/') or 'index.html'
            file=(ROOT/path).resolve()
            if file.is_dir():file=file/'index.html'
            if ROOT in file.parents and file.is_file():route.fulfill(body=file.read_bytes(),content_type=mimetypes.guess_type(file)[0] or 'text/plain')
            else:route.fulfill(status=404,body='Missing')
        page.route(BASE+'**',local)
        page.goto(BASE+'#weather');page.wait_for_selector('.ww-app')
        return page,errors
    def settled(page,status='live'):
        page.wait_for_function('(s)=>document.querySelector("#ww-source-status")?.dataset.status===s',arg=status)
    def advance(page,minutes):
        page.evaluate('(m)=>{__now+=m*60000;document.dispatchEvent(new Event("visibilitychange"))}',minutes)
    def count(page):return page.evaluate('__calls.length')

    p,errors=init();settled(p)
    check('first visit fetches automatically',count(p)==1)
    check('automatic update stores full forecast',p.evaluate('!!AYYYWeatherModel.cached(AYYY.getWeatherCity())'))
    p.evaluate('AYYY.navigate("home")');p.wait_for_selector('.shore-home')
    check('automatic update reaches home widget',p.locator('[data-home-weather="status"]').get_attribute('data-state')=='live')
    p.evaluate('AYYY.navigate("weather")');settled(p)
    check('fresh cache avoids another fetch',count(p)==1)
    advance(p,14);check('no request before 15 minutes',count(p)==1)
    advance(p,1);settled(p);check('15 minute old forecast refreshes',count(p)==2)
    p.evaluate("Object.defineProperty(document,'hidden',{configurable:true,get:()=>true})")
    advance(p,16);check('hidden tab does not fetch',count(p)==2)
    p.evaluate("delete document.hidden;document.dispatchEvent(new Event('visibilitychange'))")
    settled(p);check('returning tab refreshes stale data',count(p)==3)
    p.evaluate('__failure=true');advance(p,15);settled(p,'error')
    check('failed update tries fallback',count(p)==5)
    check('failed update retains real data', 'Сохранённый прогноз' in p.locator('#ww-source-text').inner_text())
    p.evaluate("document.dispatchEvent(new Event('visibilitychange'))")
    check('failure does not cause immediate retry',count(p)==5)
    advance(p,5);settled(p,'error');check('failure retry after five minutes',count(p)==7)
    p.evaluate("__failure=false;window.dispatchEvent(new Event('online'))")
    settled(p);check('network recovery retries immediately',count(p)==8)
    # Exercise the existing 30-second clock, not only visibility events.
    p.evaluate('__now+=15*60000');p.clock.fast_forward(30000)
    settled(p);check('visible page clock refreshes stale data',count(p)==9)
    p.evaluate('AYYY.navigate("home")');p.wait_for_selector('.shore-home')
    advance(p,20);p.evaluate("window.dispatchEvent(new Event('online'))")
    check('route cleanup removes automatic refresh listeners',count(p)==9)
    check('no runtime errors',not errors);p.close()

    p,errors=init(failure=True);settled(p,'error')
    check('first failure keeps explicitly labelled demo','Демо-прогноз' in p.locator('#ww-source-text').inner_text())
    check('demo no longer demands manual refresh','нажмите' not in p.locator('#ww-source-text').inner_text())
    p.close()
    p,errors=init(offline=True)
    check('offline visit does not make futile requests',count(p)==0)
    p.evaluate("__offline=false;window.dispatchEvent(new Event('online'))");settled(p)
    check('online event loads missing forecast',count(p)==1);p.close()
    p,errors=init(defer=True);settled(p,'pending')
    p.evaluate("document.dispatchEvent(new Event('visibilitychange'));window.dispatchEvent(new Event('online'))")
    check('in-flight request is not duplicated',count(p)==1)
    p.evaluate('AYYY.navigate("home")');p.wait_for_selector('.shore-home')
    p.wait_for_timeout(50)
    check('leaving cancels without launching proxy',count(p)==1)
    check('cancelled request does not overwrite home',p.locator('[data-home-weather="status"]').get_attribute('data-state')=='demo')
    check('no cancellation errors',not errors);p.close()
    browser.close()
print(len(checks),'automatic refresh checks PASS')
