"""HUMAN appearance and existing encrypted vault flows. All fixtures synthetic."""
from pathlib import Path
from urllib.parse import urlsplit,unquote
import mimetypes
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1];BASE='http://127.0.0.1:8877/';checks=[]
OUT=ROOT/'docs/health-ui'
def check(name,ok):
 assert ok,name
 checks.append(name);print('PASS',name,flush=True)
with sync_playwright() as pw:
 browser=pw.chromium.launch();context=browser.new_context(viewport={'width':1440,'height':1000})
 errors=[];external=[]
 def serve(r):
  if not r.request.url.startswith(BASE):external.append(r.request.url);r.abort();return
  name=unquote(urlsplit(r.request.url).path).lstrip('/') or 'index.html';file=(ROOT/name).resolve()
  if file.is_dir():file=file/'index.html'
  if ROOT in file.parents and file.is_file():r.fulfill(body=file.read_bytes(),content_type=mimetypes.guess_type(file)[0] or 'text/plain')
  else:r.fulfill(status=404,body='missing')
 context.route('**/*',serve)
 p=context.new_page();p.on('pageerror',lambda e:errors.append(str(e)))
 # Demo must not access personal storage or external services.
 p.add_init_script('''(()=>{if(location.search.includes('demo=1'))Object.defineProperty(window,'indexedDB',{get(){throw new Error('Demo accessed personal IndexedDB')}})})()''')
 p.goto(BASE+'health/?demo=1');p.wait_for_selector('.metric')
 check('HUMAN brand and original icon',p.locator('.sidebar .brand-copy>span').inner_text()=='HUMAN')
 check('original sidebar width',p.locator('.sidebar').bounding_box()['width']==208)
 check('original header height',p.locator('.topbar').bounding_box()['height']==58)
 check('original paper color',p.locator('body').evaluate('(e)=>getComputedStyle(e).backgroundColor')=='rgb(247, 248, 250)')
 check('four real metrics',p.locator('.metric').count()==4)
 check('demo clearly labelled',p.locator('.health-demo-tag').inner_text()=='ДЕМО')
 check('overview matches HUMAN composition',p.locator('.overview-main .overview-latest').count()==1 and p.locator('.overview-aside .overview-attention').count()==1)
 p.locator('.overview-latest [data-action=edit]').first.click();p.locator('[data-form=record] [name=value]').fill('3.14');p.locator('[data-form=record] [type=submit]').click();p.locator('#health-dialog').wait_for(state='hidden')
 check('edit existing observation works','3.14' in p.locator('.overview-latest').inner_text())
 p.locator('#health-header [data-action=quick-add]').click();p.locator('#health-dialog [data-action=new-lab]').click();p.locator('[name=name]').fill('Синтетическая проверка UI');p.locator('[name=value]').fill('42');p.locator('[data-form=record] [type=submit]').click();p.locator('#health-dialog').wait_for(state='hidden')
 p.locator('.sidebar [data-tab=lab]').click();p.wait_for_selector('.analyte-groups')
 check('grouped table replaces old two-column landing',p.locator('.analyte-groups').count()==1)
 p.locator('[data-search=labs]').fill('Синтетическая проверка UI');check('lab search works',p.locator('.analyte-groups tbody tr').count()==1)
 p.locator('.group-name').click();check('group opens history',p.locator('.health-two-panel').count()==1)
 p.locator('#health-global-search').fill('3.14');check('global search finds edited result','Холестерин ЛПНП' in p.locator('#health-root').inner_text())
 p.locator('#health-global-search').fill('')
 for tab in ['overview','vital','medical','diary','document','settings']:
  p.locator('.sidebar [data-tab='+tab+']').click();check('tab '+tab,p.locator('.health-heading h1').is_visible())
 p.locator('.sidebar [data-tab=vital]').click()
 p.locator('[data-action=filter-records][data-value="Давление"]').click()
 check('measurement kind filters history',p.locator('.health-table tbody tr').count()==10 and p.locator('.health-vital-summary strong').inner_text().endswith('мм рт. ст.') and p.locator('.health-kind-tabs [aria-pressed=true]').inner_text()=='Давление')
 p.locator('[data-action=filter-records][data-value="Масса"]').click();p.locator('.health-vital-summary [data-action=new-vital]').click()
 check('measurement add keeps selected kind',p.locator('#health-dialog [name=type]').input_value()=='Масса');p.locator('#health-dialog [data-action=close-dialog]').click()
 p.locator('.sidebar [data-tab=medical]').click();p.locator('[data-action=filter-records][data-value=allergy]').click()
 check('medical category filters records','Сезонная реакция на пыльцу' in p.locator('.health-table').first.inner_text() and 'Удаление аппендикса' not in p.locator('.health-table').first.inner_text())
 p.locator('.sidebar [data-tab=diary]').click();p.locator('[data-action=filter-records][data-value=food]').click()
 check('diary kind filters records',p.locator('.health-table tbody tr').count()==4)
 p.locator('.sidebar [data-tab=document]').click()
 check('documents use original table with real metadata',p.locator('.documents-table tbody tr').count()==3 and 'КБ' in p.locator('.documents-table').inner_text())
 p.reload();p.wait_for_selector('.metric')
 check('demo edits reset on reload',p.locator('.metric-number').first.inner_text()=='68' and '3.14' not in p.locator('.overview-latest').inner_text())
 check('overview value cells preserve table layout',p.locator('.overview-table td.observation-value').first.evaluate('(e)=>getComputedStyle(e).display')=='table-cell')
 OUT.mkdir(parents=True,exist_ok=True);p.screenshot(path=str(OUT/'overview-1440.png'),full_page=True)
 for width in [360,390,768,1024,1440,1920]:
  p.set_viewport_size({'width':width,'height':844})
  if width<768:
   p.locator('[data-action=toggle-menu]').click();check('mobile drawer '+str(width),p.locator('.sidebar').is_visible());p.keyboard.press('Escape')
  for tab in ['overview','lab','vital','medical','diary','document','settings']:
   if width<768:p.locator('[data-action=toggle-menu]').click()
   p.locator('.sidebar [data-tab='+tab+']').click()
   check('no page overflow '+str(width)+' '+tab,p.evaluate('document.documentElement.scrollWidth<=innerWidth'))
  if width==390:
   p.locator('[data-action=toggle-menu]').click();p.locator('.sidebar [data-tab=overview]').click();p.screenshot(path=str(OUT/'overview-390.png'),full_page=True)
 p.set_viewport_size({'width':1440,'height':1000});p.locator('.sidebar [data-tab=lab]').click();p.screenshot(path=str(OUT/'analyses-1440.png'),full_page=True)
 for tab in ['vital','medical','document']:
  p.locator('.sidebar [data-tab='+tab+']').click();p.screenshot(path=str(OUT/(tab+'-1440.png')),full_page=True)
 check('demo never used remote services',not external)
 # A separate page exercises an actual encrypted browser vault.
 v=context.new_page();v.on('pageerror',lambda e:errors.append(str(e)));v.goto(BASE+'health/')
 v.locator('[data-form=create] [name=password]').fill('synthetic-ui-passphrase');v.locator('[data-form=create] [name=repeat]').fill('synthetic-ui-passphrase');v.locator('[data-form=create] [type=submit]').click();v.wait_for_selector('.metric')
 v.locator('#health-header [data-action=quick-add]').click();v.locator('#health-dialog [data-action=new-vital]').click();v.locator('[name=value]').fill('120/80');v.locator('[data-form=record] [type=submit]').click();v.locator('#health-dialog').wait_for(state='hidden')
 v.reload();v.wait_for_selector('[data-form=unlock]');v.locator('[data-form=unlock] [name=passphrase]').fill('synthetic-ui-passphrase');v.locator('[data-form=unlock] [type=submit]').click();v.wait_for_selector('.metric')
 v.locator('.sidebar [data-tab=vital]').click();check('encrypted record survives reload','120/80' in v.locator('#health-root').inner_text())
 p.goto(BASE+'#health/demo');frame=p.frame_locator('#ayyy-health-frame');frame.locator('.metric').first.wait_for()
 check('portal route uses HUMAN workspace',frame.locator('.sidebar .brand-copy>span').inner_text()=='HUMAN')
 check('health styles remain inside iframe',p.locator('#health-sidebar').count()==0)
 check('no runtime errors',not errors);browser.close()
print(len(checks),'HUMAN browser checks PASS')
