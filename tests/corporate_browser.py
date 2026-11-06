"""Browser checks use actual local portal files and in-memory storage. No external API."""
from pathlib import Path
from urllib.parse import urlsplit,unquote
from playwright.sync_api import sync_playwright
import mimetypes,json,shutil
ROOT=Path(__file__).resolve().parents[1];BASE='https://ayyy.test/AYYY/';checks=[]
def check(name,ok):
 assert ok,name
 checks.append(name);print('PASS',name,flush=True)
def init(browser,size=(1600,1000)):
 page=browser.new_page(viewport={'width':size[0],'height':size[1]},device_scale_factor=1);page.set_default_timeout(6000);errors=[]
 page.on('pageerror',lambda x:errors.append(str(x)))
 page.evaluate('''() => {window.__store=new Map();Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:k=>__store.get(k)||null,setItem:(k,v)=>__store.set(k,String(v)),removeItem:k=>__store.delete(k),key:i=>[...__store.keys()][i]||null,get length(){return __store.size}}});window.__network=[];window.fetch=async u=>{__network.push(String(u));throw new TypeError('Test network disabled');};}''')
 def local(route):
  p=unquote(urlsplit(route.request.url).path).removeprefix('/AYYY/');target=(ROOT/p).resolve()
  if ROOT in target.parents and target.is_file():route.fulfill(body=target.read_bytes(),content_type=mimetypes.guess_type(target)[0] or 'text/plain')
  else:route.fulfill(status=404,body='missing '+p)
 page.route(BASE+'**',local)
 page.set_content((ROOT/'index.html').read_text().replace('<head>','<head><base href="'+BASE+'">'),wait_until='load');page.wait_for_selector('.shore-home')
 return page,errors
def nav(p,tab):
 p.evaluate('(tab)=>AYYY.navigate("tools",tab)',tab);p.wait_for_selector('.city-stage')
def value(p,selector,val):
 p.locator(selector).fill(str(val));p.wait_for_timeout(270)
with sync_playwright() as pw:
 browser=pw.chromium.launch(executable_path=shutil.which('chromium'),headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 p,errs=init(browser)
 nav(p,'');check('mortgage is first default',p.locator('#loan-form').count()==1)
 check('9 redesigned tabs',p.locator('.city-nav a').count()==9)
 check('city illustrations loaded',p.locator('.city-illustration img').count()==2 and p.locator('.city-illustration img').evaluate_all('images => images.every(i => i.complete && i.naturalWidth > 0)'))
 check('unified wordmark with service dot',p.locator('.city-brand').inner_text().strip()=='ayyy.' and p.locator('.city-brand span').evaluate("e=>getComputedStyle(e).color==='rgb(53, 109, 153)'"))
 check('dense mortgage results visible above fold',p.locator('.city-events').bounding_box()['y']<700 and p.locator('.city-kpis').bounding_box()['height']<=90)
 check('first computed result',p.locator('.city-kpi').count()==4 and not p.locator('#loan-error').is_visible())
 check('no network from calculations',p.evaluate('__network.length')==0)
 check('default principal',p.locator('[name=principal]').input_value()=='9000000')
 value(p,'[name=down]',4000000);check('down payment updates principal',p.locator('[name=principal]').input_value()=='8000000')
 value(p,'[name=down]',-1);check('reject negative down payment',p.locator('#loan-error').is_visible() and not p.locator('#loan-output').is_visible())
 value(p,'[name=down]',3000000)
 p.locator('[data-city=add-extra]').click();check('add dated extra',p.locator('[data-extra]').count()==2)
 value(p,'[data-extra="1"] [data-extra-field=amount]',50000)
 p.locator('[data-extra="1"] [data-extra-field=strategy]').select_option('payment');p.wait_for_timeout(270)
 check('strategy stored',p.evaluate("AYYY.get('city.loan').extras[1].strategy")=='payment')
 p.locator('[data-remove-extra="1"]').click();check('remove extra',p.locator('[data-extra]').count()==1)
 p.locator('.city-repeat summary').click();value(p,'[data-repeat=amount]',1000);check('recurring contribution stored',p.evaluate("AYYY.get('city.loan').repeat.amount")==1000)
 p.locator('[data-loan-tab=rates]').click();p.locator('[data-city=add-rate]').click();value(p,'[data-rate-field=rate]',10);check('dated rates stored',p.evaluate("AYYY.get('city.loan').rates[0].rate")==10)
 p.locator('[data-loan-tab=schedule]').click();check('amortization table',p.locator('.city-table tbody tr').count()>10)
 p.locator('#loan-filter').select_option('extras');check('extra filter',all('is-extra' in (x.get_attribute('class') or '') for x in p.locator('.city-table tbody tr').all()))
 p.locator('#loan-filter').select_option('all');p.locator('[data-city=next]').click();check('schedule pagination',p.locator('.city-table tbody tr').first.locator('td').first.inner_text().find('№ 1\n')<0)
 with p.expect_download() as dl:p.locator('[data-city=csv]').click()
 f=dl.value.path();check('CSV includes full schedule',Path(f).read_text().count('\n')>100)
 with p.expect_download() as dl:p.locator('[data-city=export]').click()
 scenario=json.loads(Path(dl.value.path()).read_text());check('JSON export schema',scenario['app']=='AYYY.Credit' and len(scenario['data']['extras'])==1)
 p.locator('[data-loan-tab=scenarios]').click();p.locator('#loan-scenario-name').fill('<test scenario>');p.locator('[data-city=save-scenario]').click();check('saved scenario escaped',p.locator('.city-table').inner_text().find('<test scenario>')>=0 and p.locator('test').count()==0)
 check('save compare row',p.locator('[data-load-scenario]').count()==1)
 p.locator('[data-load-scenario]').click();check('load saved scenario',not p.locator('#loan-error').is_visible())
 p.locator('#loan-file').set_input_files({'name':'bad.json','mimeType':'application/json','buffer':b'{"app":"evil"}'});p.wait_for_timeout(100);check('reject wrong import without losing view',p.locator('#loan-form').count()==1)
 p.locator('#loan-file').set_input_files({'name':'credit.json','mimeType':'application/json','buffer':json.dumps(scenario).encode()});p.wait_for_timeout(300);check('valid import',p.locator('#loan-form').count()==1 and not p.locator('#loan-error').is_visible())
 p.locator('[data-mode=credit]').click();check('credit principal editable',p.locator('[name=principal]').get_attribute('readonly') is None)
 value(p,'[name=principal]',120000);value(p,'[name=rate]',0);value(p,'[name=months]',3)
 # Events beyond a shortened term must be explicitly corrected, not silently dropped.
 check('out-of-term event is rejected',p.locator('#loan-error').is_visible())
 nav(p,'science');check('engineering replaces simple calculator',p.locator('#science-result').inner_text()=='1')
 p.locator('#science-expression').fill('sin(30)');p.locator('[data-angle=DEG]').click();check('DEG computes sine',p.locator('#science-result').inner_text()=='0,5')
 p.locator('#science-expression').fill('sqrt(9)+5!');p.locator('#science-expression').press('Enter');check('function factorial arithmetic',p.locator('#science-result').inner_text()=='123')
 check('history stored',len(p.evaluate("AYYY.get('city.science.history')"))==1)
 p.locator('#science-expression').fill('window.alert(1)');p.locator('#science-expression').press('Enter');check('unsafe expression rejected',p.locator('#science-error').is_visible())
 p.locator('#science-expression').fill('2+3');p.locator('#science-expression').press('Enter')
 check('graph initially rendered',p.locator('#science-plot svg').count()==1)
 value(p,'[data-function="0"]','x^2 - 2');value(p,'[data-function="1"]','');value(p,'[data-function="2"]','')
 value(p,'#science-analysis-point',3);p.locator('[data-analysis=derivative]').click();check('numerical derivative', '6' in p.locator('#science-analysis-result').inner_text())
 value(p,'#science-analysis-from',0);value(p,'#science-analysis-to',2);p.locator('[data-analysis=root]').click();check('numerical root', '1,414' in p.locator('#science-analysis-result').inner_text())
 value(p,'[data-function="0"]','x^2');value(p,'#science-analysis-to',3);p.locator('[data-analysis=integral]').click();check('integral 0..3 x squared','≈ 9 ' in p.locator('#science-analysis-result').inner_text())
 value(p,'#science-a',2);value(p,'[data-function="0"]','a*x');p.locator('[data-plot-tab=table]').click();check('function table',p.locator('#science-plot tbody tr').count()==21)
 p.locator('[data-plot-tab=graph]').click();p.locator('[data-science=zoom-in]').click();check('zoom range',float(p.locator('#science-xmax').input_value())<10)
 with p.expect_download() as dl:p.locator('[data-city=science-svg]').click()
 check('SVG export actual chart','<svg' in Path(dl.value.path()).read_text())
 with p.expect_download() as dl:p.locator('[data-city=science-csv]').click()
 check('function CSV',Path(dl.value.path()).read_text().count('\n')==201)
 value(p,'#science-xmin',100);check('bad bounds rejected',p.locator('#science-plot-error').is_visible())
 for tool in ['percent','converter','dates','password','json','text','color']:
  nav(p,tool);check('restyled utility '+tool,p.locator('.city-legacy .tools-workspace').count()==1 and p.locator('.tools-header').count()==0)
 p.evaluate("AYYY.navigate('home')");p.wait_for_selector('.shore-home');check('return home',p.locator('.city-stage').count()==0)
 p.evaluate("AYYY.navigate('directory')");p.wait_for_selector('.shore-directory');check('loan added to catalog',p.locator('a[href="#tools/loan"]').count()>0)
 check('no browser errors',len(errs)==0);p.close()
 for width in [360,390,768,1024,1366,1600,1920]:
  q,errors=init(browser,(width,900))
  for tool in ['loan','science','percent','json']:
   nav(q,tool);q.wait_for_timeout(80);check(f'no horizontal overflow {width} {tool}',q.evaluate('document.documentElement.scrollWidth <= innerWidth+1'));check(f'no runtime errors {width} {tool}',not errors)
  q.close()
 print(f'{len(checks)} browser checks passed')
 (ROOT/'docs/corporate-browser-results.json').write_text(json.dumps({'passed':len(checks),'checks':checks,'network':'Local assets, controlled storage; no external API'},ensure_ascii=False,indent=2))
 browser.close()
