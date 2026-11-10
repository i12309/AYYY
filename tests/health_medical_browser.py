"""Synthetic rich medical-card CRUD, links, periods, validation and persistence."""
from pathlib import Path
from urllib.parse import urlsplit
import mimetypes
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1];BASE='http://localhost:8877/';checks=[]
def check(label,value):
 assert value,label
 checks.append(label);print('PASS',label,flush=True)
with sync_playwright() as pw:
 b=pw.chromium.launch();ctx=b.new_context(viewport={'width':1440,'height':1000});errors=[];remote=[]
 def serve(route):
  if not route.request.url.startswith(BASE):remote.append(route.request.url);route.abort();return
  file=(ROOT/urlsplit(route.request.url).path.lstrip('/')).resolve()
  if file.is_dir():file=file/'index.html'
  if ROOT in file.parents and file.is_file():route.fulfill(body=file.read_bytes(),content_type=mimetypes.guess_type(file)[0] or 'text/plain')
  else:route.fulfill(status=404,body='Missing')
 ctx.route('**/*',serve);p=ctx.new_page();p.on('pageerror',lambda e:errors.append(str(e)));p.on('dialog',lambda d:d.accept());p.goto(BASE+'health/')
 p.locator('[data-form=create] [name=password]').fill('synthetic-clinical-password');p.locator('[name=repeat]').fill('synthetic-clinical-password');p.locator('[data-form=create] [type=submit]').click();p.locator('.metric').first.wait_for()
 def tab(name):p.locator('.sidebar button[data-tab='+name+']').click()
 def fill(name,value):p.locator('#health-dialog [name='+name+']').fill(value)
 def choose(name,value):p.locator('#health-dialog [name='+name+']').select_option(value)
 def save():p.locator('#health-dialog [type=submit]').click();p.locator('#health-dialog').wait_for(state='hidden')
 tab('document');p.locator('[data-action=new-document]').first.click();p.locator('#health-dialog [name=file]').set_input_files({'name':'synthetic-clinical.txt','mimeType':'text/plain','buffer':b'SYNTHETIC clinical source, not a medical recommendation.'});fill('title','Synthetic source');save()
 tab('medical');p.locator('[data-action=new-medical]').click();fill('title','Synthetic allergy');choose('category','allergy');choose('status','active');choose('basis','clinician');fill('start','2020');choose('startPrecision','year');fill('end','2019');choose('endPrecision','year');fill('reaction','Synthetic severe rash');choose('severity','severe');p.locator('#health-dialog details summary').click();p.locator('#health-dialog [name=documentId]').select_option(label='Synthetic source')
 p.locator('#health-dialog [type=submit]').click();p.get_by_text('Окончание не может быть раньше начала.',exact=True).wait_for();check('invalid period leaves editor open without a saved row',p.locator('#health-dialog').is_visible() and p.locator('.medical-name').count()==0)
 fill('end','2021-02');choose('endPrecision','month');save();p.locator('.medical-name').click()
 check('rich allergy facts and partial dates visible','Synthetic severe rash' in p.locator('.medical-detail').inner_text() and 'Тяжёлая' in p.locator('.medical-detail').inner_text() and '2020 г.' in p.locator('.medical-detail').inner_text() and '02.2021' in p.locator('.medical-detail').inner_text())
 p.locator('.medical-detail [data-action=file-preview]').click();check('medical record opens linked source','SYNTHETIC clinical source' in p.locator('.health-document-preview pre').inner_text());p.locator('#health-dialog [data-action=close-dialog]').click()
 p.locator('.medical-detail [data-action=edit]').click();check('edit restores partial date precision',p.locator('#health-dialog [name=start]').input_value()=='2020' and p.locator('#health-dialog [name=startPrecision]').input_value()=='year');fill('reaction','Synthetic revised rash');choose('status','inactive');save()
 p.locator('.medical-detail details summary').click();check('correction history retains previous facts','Synthetic severe rash' in p.locator('.medical-detail pre').inner_text())
 p.locator('.medical-filters [data-search=medical]').fill('revised rash');check('search includes structured allergy facts',p.locator('.medical-name').count()==1);p.locator('.medical-filters [data-search=medical]').fill('')
 p.locator('.medical-filters [data-medical-status]').select_option('active');check('status filter excludes inactive allergy',p.locator('.medical-name').count()==0);p.locator('.medical-filters [data-medical-status]').select_option('')
 p.locator('[data-action=filter-records][data-value=vaccine]').click();p.locator('[data-action=new-medical]').click();check('new record respects selected section',p.locator('#health-dialog [name=category]').input_value()=='vaccine' and p.locator('#health-dialog [name=end]').is_disabled());fill('title','Synthetic vaccine');fill('start','2022-03');choose('startPrecision','month');fill('against','Synthetic target');fill('doseLabel','Synthetic dose');fill('lot','SYNTHETIC-LOT');fill('place','Synthetic clinic');save()
 p.locator('.medical-name').click();check('vaccination-specific details visible','SYNTHETIC-LOT' in p.locator('.medical-detail').inner_text() and 'Введена' in p.locator('.medical-detail').inner_text())
 p.locator('[data-action=filter-records][data-value=medication]').click();p.locator('[data-action=new-medication]').click();fill('name','Synthetic supplement');choose('status','planned');choose('medicationCategory','supplement');fill('dose','Synthetic dose');fill('frequency','Synthetic schedule');fill('route','Synthetic route');fill('indication','Synthetic indication');save();p.locator('.medical-name').click();check('supplement and medication scheme visible','Добавка' in p.locator('.medical-detail').inner_text() and 'Synthetic schedule' in p.locator('.medical-detail').inner_text())
 p.locator('#health-global-search').fill('Synthetic indication');check('global search indexes medication details','Synthetic supplement' in p.locator('#health-root').inner_text());p.locator('#health-global-search').fill('')
 p.locator('[data-action=filter-records][data-value=""]').click();check('category switch closes previous record detail',p.locator('.medical-detail').count()==0)
 (ROOT/'docs/health-ui').mkdir(parents=True,exist_ok=True);p.evaluate('()=>window.scrollTo(0,0)');p.screenshot(path=str(ROOT/'docs/health-ui/medical-rich-1440.png'),full_page=True)
 for width in [360,390,768,1440]:
  p.set_viewport_size({'width':width,'height':900});check('medical page fits '+str(width),p.evaluate('document.documentElement.scrollWidth<=innerWidth'))
  if width==390:p.screenshot(path=str(ROOT/'docs/health-ui/medical-rich-390.png'),full_page=True)
 p.set_viewport_size({'width':1440,'height':1000});p.reload();p.locator('[name=passphrase]').fill('synthetic-clinical-password');p.locator('[data-form=unlock] [type=submit]').click();p.locator('.metric').first.wait_for();tab('medical')
 check('all clinical records survive encrypted reload',p.locator('.medical-name').count()==3)
 p.locator('.medical-name').filter(has_text='Synthetic allergy').click();check('allergy correction survives reload','Synthetic revised rash' in p.locator('.medical-detail').inner_text() and 'Неактуально' in p.locator('.medical-detail').inner_text())
 p.locator('.medical-list tr').filter(has_text='Synthetic allergy').locator('[data-action=remove]').click();check('delete removes only selected clinical record',p.locator('.medical-name').count()==2)
 p.locator('[data-search=medical]').fill('Synthetic private query');tab('settings');p.locator('[data-action=picker]').click();p.locator('[data-form=create] [name=password]').fill('synthetic-second-password');p.locator('[name=repeat]').fill('synthetic-second-password');p.locator('[data-form=create] [type=submit]').click();p.locator('.metric').first.wait_for();tab('medical');check('new profile has isolated records and cleared search',p.locator('.medical-name').count()==0 and p.locator('[data-search=medical]').input_value()=='')
 check('clinical changes stayed local',not remote);check('no runtime errors',not errors);b.close()
print(len(checks),'medical checks PASS')
