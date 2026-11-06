"""Actual local app files, controlled reference-rate fixture, no internet required."""
from pathlib import Path
from urllib.parse import urlsplit,unquote
from playwright.sync_api import sync_playwright
import mimetypes,json,shutil,datetime,math
ROOT=Path(__file__).resolve().parents[1];BASE='https://ayyy.test/AYYY/';checks=[]
def check(name,ok):
 assert ok,name
 checks.append(name);print('PASS',name,flush=True)
def fixture():
 now=datetime.datetime.now(datetime.timezone.utc);days=[]
 for i in range(431):
  dt=(now-datetime.timedelta(days=430-i)).date()
  if dt.weekday()>4:continue
  usd=91+(i-430)*.018+math.sin(i*.12)*1.9+math.sin(i*.51)*.4
  days.append({'date':dt.isoformat(),'rates':{'RUB':1,'USD':usd,'EUR':usd*1.088,'GBP':usd*1.29,'CNY':usd/7.21,'CHF':usd*1.14,'JPY':usd/153}})
 return {'version':1,'source':'Frankfurter','updatedAt':int(now.timestamp()*1000),'days':days}
def init(browser,width=1600,cache=True,fail=False):
 p=browser.new_page(viewport={'width':width,'height':1000});p.set_default_timeout(6000);errors=[]
 p.on('pageerror',lambda x:errors.append(str(x)))
 p.evaluate('''o=>{const data=o.data,m=new Map();if(o.cache)m.set('ayyy:v1:markets.history.v1',JSON.stringify(data));Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k),key:i=>[...m.keys()][i]||null,get length(){return m.size}}});window.__net=[];window.fetch=async (u,opts)=>{__net.push({url:String(u),method:opts?.method||'GET'});if(o.fail)throw new TypeError('Offline fixture');const rows=[];for(const d of data.days)for(const [q,r] of Object.entries(d.rates))if(q!=='RUB')rows.push({date:d.date,base:'RUB',quote:q,rate:1/r});return {ok:true,json:async()=>rows};};}''',{'data':fixture(),'cache':cache,'fail':fail})
 def local(r):
  path=unquote(urlsplit(r.request.url).path).removeprefix('/AYYY/');f=(ROOT/path).resolve()
  if ROOT in f.parents and f.is_file():r.fulfill(body=f.read_bytes(),content_type=mimetypes.guess_type(f)[0] or 'text/plain')
  else:r.fulfill(status=404,body='missing '+path)
 p.route(BASE+'**',local)
 p.set_content((ROOT/'index.html').read_text().replace('<head>','<head><base href="'+BASE+'">'),wait_until='load');p.wait_for_selector('.shore-home');p.evaluate("AYYY.navigate('finance')");p.wait_for_selector('.fm-page');p.wait_for_timeout(100)
 return p,errors
with sync_playwright() as pw:
 browser=pw.chromium.launch(executable_path=shutil.which('chromium'),headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 p,errors=init(browser)
 check('new standalone finance shell',p.evaluate('document.body.dataset.shell')=='markets')
 check('five real reference cards',p.locator('.fm-rate').count()==5)
 check('two sparse decorative paintings',p.locator('.fm-art img').count()==2 and p.locator('.fm-art img').evaluate_all('xs=>xs.every(x=>x.complete&&x.naturalWidth>0)'))
 check('no decorative candle chart',p.locator('.fm-art svg path').count()==2)
 check('native graph rendered',p.locator('#fm-plot svg .fm-line.primary').count()==1)
 check('fresh cache avoids fetch',p.evaluate('__net.length')==0)
 check('no invented live label', 'Дневные курсы' in p.locator('#fm-status').inner_text())
 check('five historical sparklines',p.locator('.fm-rate .fm-spark').count()==5)
 check('SMA20 initially visible',p.locator('#fm-plot .sma20').count()==1)
 p.locator('[data-indicator=sma50]').check();check('SMA50 computes',p.locator('#fm-plot .sma50').count()==1)
 p.locator('[data-indicator=bb]').check();check('bands compute',p.locator('#fm-plot .fm-band').count()==1)
 p.locator('[data-period="30"]').click();check('period controls select correctly',p.locator('[data-period="30"]').get_attribute('aria-pressed')=='true')
 p.locator('[data-rate=EUR]').click();check('currency changes graph','EUR / RUB' in p.locator('#fm-quote').inner_text())
 p.locator('#fm-plot').focus();p.keyboard.press('End');check('keyboard chart cursor',p.locator('#fm-cursor').inner_text().startswith(datetime.datetime.now().strftime('%-d')) or '1 EUR' in p.locator('#fm-cursor').inner_text())
 p.keyboard.press('Home');check('crosshair shown',not p.locator('#fm-crosshair').get_attribute('hidden'))
 svg=p.locator('#fm-plot svg');svg.hover(position={'x':200,'y':70});check('pointer chart cursor','1 EUR' in p.locator('#fm-cursor').inner_text())
 p.locator('#fm-amount').fill('1 000,50');check('conversion populated','1000,50' not in p.locator('#fm-conversion').inner_text() and '—' not in p.locator('#fm-conversion strong').inner_text())
 p.locator('#fm-amount').fill('-5');check('invalid amount rejected',p.locator('#fm-amount').get_attribute('aria-invalid')=='true')
 p.locator('#fm-amount').fill('0');check('zero amount works','0,00' in p.locator('#fm-conversion strong').inner_text())
 p.locator('#fm-amount').fill('100');p.locator('[data-fm=swap]').click();check('swap currencies',p.locator('#fm-from').input_value()=='RUB' and p.locator('#fm-to').input_value()=='USD')
 p.locator('[data-fm=pair]').click();check('inverse pair graph','RUB / USD' in p.locator('#fm-quote').inner_text())
 check('amounts never sent',p.evaluate('__net.length')==0)
 with p.expect_download() as dl:p.locator('[data-fm=csv]').click()
 check('real history CSV',Path(dl.value.path()).read_text().startswith('date,reference_rate') and Path(dl.value.path()).read_text().count('\n')>10)
 text='<img src=x onerror=alert(1)> observation';p.locator('#fm-note').fill(text);p.wait_for_timeout(350)
 check('note saved locally',p.evaluate("AYYY.get('markets.note')")==text)
 p.evaluate("AYYY.navigate('home')");check('home layout preserved',p.locator('.shore-home').count()==1)
 p.evaluate("AYYY.navigate('finance')");p.wait_for_selector('#fm-note');check('note restored as text',p.locator('#fm-note').input_value()==text and p.locator('.fm-observations img').count()==0)
 p.locator('[data-fm=clear-note]').click();check('clear notes',p.evaluate("AYYY.get('markets.note')")=='')
 p.locator('[data-instrument=gold]').click();p.wait_for_selector('#fm-plot iframe');p.wait_for_timeout(500)
 frame=p.locator('#fm-plot iframe');check('widget uses remote source, never srcdoc',frame.get_attribute('src').startswith('https://s.tradingview.com/widgetembed/') and frame.get_attribute('srcdoc') is None)
 check('provider origin allowed', 'allow-same-origin' in frame.get_attribute('sandbox'))
 check('no provider script executes in portal origin',p.locator('script[src*=tradingview]').count()==0)
 check('remote frame has a non-portal origin',urlsplit(frame.get_attribute('src')).netloc=='s.tradingview.com')
 p.locator('[data-period="180"]').click();check('six-month widget range','range=6M' in p.locator('#fm-plot iframe').get_attribute('src'))
 p.locator('[data-fm=chart-style]').click();check('external area style','style=3' in p.locator('#fm-plot iframe').get_attribute('src'))
 p.locator('[data-fm=retry-widget]').click();check('one external frame after retry',p.locator('#fm-plot iframe').count()==1)
 p.locator('[data-mode=rates]').first.click();check('return to native chart removes iframe',p.locator('#fm-plot iframe').count()==0 and p.locator('#fm-plot svg').count()==1)
 p.locator('[data-fm=sources]').click();check('data source disclosure','не рекомендация' in p.locator('#modal-body').inner_text());p.locator('[data-close-modal]').first.click()
 p.evaluate("AYYY.navigate('tools','loan')");check('mortgage unchanged',p.locator('#loan-form').count()==1)
 p.evaluate("AYYY.navigate('finance')");check('no duplicate workspace',p.locator('.fm-page').count()==1)
 check('no runtime errors',not errors);p.close()
 p,errors=init(browser,cache=False)
 p.wait_for_selector('#fm-plot svg');check('autoloads API on first entry',p.evaluate('__net.length')==1)
 check('loads and validates API history',p.evaluate("AYYY.get('markets.history.v1').days.length")>300)
 p.evaluate("()=>{window.fetch=async()=>{throw new TypeError('Provider offline')};}");p.locator('[data-fm=refresh]').first.click();p.wait_for_timeout(100)
 check('provider failure keeps graph',p.locator('#fm-plot svg').count()==1 and p.locator('#fm-error').is_visible())
 check('cached data explicitly identified','Сохранённые' in p.locator('#fm-status').inner_text())
 check('no errors after failed update',not errors);p.close()
 p,errors=init(browser,cache=False,fail=True)
 check('no-data error actionable',p.locator('.fm-empty button').is_visible() and p.locator('#fm-error').is_visible())
 check('does not invent rates when offline',all('—' in x.inner_text() for x in p.locator('.fm-rate-data>strong').all()))
 p.evaluate("AYYY.navigate('home');AYYY.set('markets.preferences',null);AYYY.navigate('finance')");check('corrupt preferences handled',p.locator('.fm-page').count()==1 and not errors);p.close()
 for w in [360,390,768,1024,1366,1600,1920]:
  p,errors=init(browser,w);check('no page overflow '+str(w),p.evaluate('document.documentElement.scrollWidth<=innerWidth+1'))
  check('converter visible '+str(w),p.locator('#fm-amount').is_visible())
  check('chart renders '+str(w),p.locator('#fm-plot svg').count()==1)
  check('no errors '+str(w),not errors)
  if w in [390,1600]:p.screenshot(path=str(ROOT/'docs'/f'markets-{w}.png'),full_page=True)
  p.close()
 browser.close();print(str(len(checks))+' market browser checks passed')
 (ROOT/'docs/markets-test-results.json').write_text(json.dumps({'passed':len(checks),'checks':checks,'data':'controlled historical fixtures, not live market quotes'},ensure_ascii=False,indent=2))
