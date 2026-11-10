"""Synthetic episodes, review actions, linked measurements and clinical records."""
from pathlib import Path
from urllib.parse import urlsplit
from datetime import datetime,timezone
import mimetypes
from playwright.sync_api import sync_playwright
from health_browser_support import launch_browser,capture,fill_home_value
ROOT=Path(__file__).resolve().parents[1];BASE='http://localhost:8877/';checks=[]
def check(label,result):
 assert result,label
 checks.append(label);print('PASS',label,flush=True)
with sync_playwright() as pw:
 b=launch_browser(pw);ctx=b.new_context(viewport={'width':1440,'height':1000},timezone_id='Europe/Moscow');errors=[];remote=[]
 def serve(route):
  if not route.request.url.startswith(BASE):remote.append(route.request.url);route.abort();return
  file=(ROOT/urlsplit(route.request.url).path.lstrip('/')).resolve()
  if file.is_dir():file=file/'index.html'
  if ROOT in file.parents and file.is_file():route.fulfill(body=file.read_bytes(),content_type=mimetypes.guess_type(file)[0] or 'text/plain')
  else:route.fulfill(status=404,body='Missing')
 ctx.route('**/*',serve);p=ctx.new_page();p.on('pageerror',lambda e:errors.append(str(e)));p.on('dialog',lambda d:d.accept());p.clock.install(time=datetime(2026,11,10,12,tzinfo=timezone.utc));p.goto(BASE+'health/')
 p.locator('[data-form=create] [name=password]').fill('synthetic-episode-passphrase');p.locator('[name=repeat]').fill('synthetic-episode-passphrase');p.locator('[data-form=create] [type=submit]').click();p.locator('.metric').first.wait_for()
 def tab(name):p.locator('.sidebar button[data-tab='+name+']').click()
 def fill(name,value):
  if name=='value' and '/' in value:fill_home_value(p,value)
  else:p.locator('#health-dialog [name='+name+']').fill(value)
 def choose(name,value):p.locator('#health-dialog [name='+name+']').select_option(value)
 def save():p.locator('#health-dialog [type=submit]').click();p.locator('#health-dialog').wait_for(state='hidden')
 tab('vital');p.locator('[data-action=filter-records][data-value=illness]').click();p.locator('[data-action=new-episode]').click();fill('title','Synthetic illness episode');fill('date','2026-11-01');fill('localTime','10:30');fill('symptoms','Synthetic reported symptoms');fill('treatments','Synthetic reported treatment, not a recommendation');save()
 p.locator('.health-list [data-action=open-episode]').click()
 check('unknown episode is not inferred ongoing','Нужно уточнить' in p.locator('.episode-review').inner_text())
 check('unknown episode has no null text placeholders',p.locator('.health-details').evaluate('(e)=>Array.from(e.childNodes).filter(n=>n.nodeType===Node.TEXT_NODE).every(n=>!n.textContent.trim())'))
 check('episode time uses profile timezone','10:30' in p.locator('.health-details').inner_text())
 p.locator('.episode-review [data-mode=snooze]').click();save();check('snooze keeps uncertainty','Нужно уточнить' in p.locator('.episode-review').inner_text() and 'подтверждено' not in p.locator('.episode-review').inner_text())
 p.locator('.episode-review [data-mode=ongoing]').click();choose('days','3');save();check('ongoing needs explicit confirmation','Ещё болею · подтверждено' in p.locator('.episode-review').inner_text())
 p.locator('.episode-measurements [data-action=new-vital]').click();fill('value','120/80');p.locator('[data-vital-notes] summary').click();fill('context','Synthetic rest measurement');save()
 p.locator('.health-details [data-action=open-episode]').click()
 check('measurement linked to episode','120/80' in p.locator('.episode-measurements').inner_text())
 p.locator('.episode-measurements [data-action=open-vital]').click();check('pressure graph contains two series',p.locator('.health-chart polyline').count()==2)
 check('measurement detail retains episode link','Synthetic illness episode' in p.locator('.health-details').inner_text())
 tab('medical');p.locator('[data-action=new-medical]').click();fill('title','Synthetic associated allergy');p.locator('#health-dialog .medical-relations summary').click();p.locator('#health-dialog [name=episodeId]').select_option(label='Synthetic illness episode');save()
 tab('vital');p.locator('[data-action=filter-records][data-value=illness]').click();p.locator('.health-list [data-action=open-episode]').click();check('episode shows linked clinical record','Synthetic associated allergy' in p.locator('.episode-measurements').last.inner_text())
 p.locator('[data-action=open-linked-medical]').click();check('linked medical record opens detail','Synthetic associated allergy' in p.locator('.medical-detail').inner_text());p.locator('.medical-detail [data-action=open-episode]').click()
 p.clock.fast_forward(4*86400000);tab('vital');check('old confirmation expires without automatic recovery','Нужно уточнить' in p.locator('.episode-review').inner_text() and 'Завершён' not in p.locator('.episode-review').inner_text())
 p.locator('.episode-review [data-mode=ended]').click();fill('endDate','2026-10-01');p.locator('#health-dialog [type=submit]').click();check('invalid recovery date rejected',p.locator('#health-dialog [data-form-error]').is_visible());fill('endDate','2026-11-12');save();check('explicit recovery records end date','Завершён' in p.locator('.episode-review').inner_text() and '12.11.2026' in p.locator('.health-details').inner_text())
 p.locator('.health-details details summary').click();check('episode review history retained',p.locator('.health-revision').count()>=3)
 (ROOT/'docs/health-ui').mkdir(parents=True,exist_ok=True);p.evaluate('()=>window.scrollTo(0,0)');capture(p,path=str(ROOT/'docs/health-ui/episode-1440.png'),full_page=True)
 for width in [360,390,768,1440]:
  p.set_viewport_size({'width':width,'height':900});check('episode workspace fits '+str(width),p.evaluate('document.documentElement.scrollWidth<=innerWidth'))
  if width==390:capture(p,path=str(ROOT/'docs/health-ui/episode-390.png'),full_page=True)
 p.set_viewport_size({'width':1440,'height':1000});p.locator('.health-details [data-action=new-vital]').click();choose('type','Глюкоза');choose('unit','мг/дл');fill('value','100');save();p.locator('[data-action=filter-records][data-value="Глюкоза"]').click();check('glucose unit not silently converted','100 мг/дл' in p.locator('.health-vital-summary').inner_text())
 p.locator('.health-vital-summary [data-action=new-vital]').click();choose('type','Сатурация');fill('value','101');p.locator('#health-dialog [type=submit]').click();check('invalid saturation remains unsaved',p.locator('#health-dialog [name=value]').evaluate('(e)=>!e.checkValidity()') and p.locator('#health-dialog').is_visible());fill('value','98');save()
 p.reload();p.locator('[name=passphrase]').fill('synthetic-episode-passphrase');p.locator('[data-form=unlock] [type=submit]').click();p.locator('.metric').first.wait_for();tab('vital');p.locator('[data-action=filter-records][data-value=illness]').click();p.locator('.health-list [data-action=open-episode]').click();check('episode state and links survive encrypted reload','Завершён' in p.locator('.episode-review').inner_text() and '120/80' in p.locator('.episode-measurements').first.inner_text())
 p.locator('.health-list [data-action=remove]').click();p.locator('.health-list [data-action=open-episode]').wait_for(state='hidden');check('deleted episode removed without deleting measurements',p.locator('.health-list [data-action=open-episode]').count()==0);p.locator('[data-action=filter-records][data-value="Давление"]').click();p.locator('.health-list [data-action=open-vital]').click();check('measurement retains unavailable episode reference','недоступен' in p.locator('.health-details').inner_text())
 p.locator('.health-details [data-action=edit]').click();p.evaluate("""async()=>{const peer=new BroadcastChannel('ayyy-health-v1');peer.postMessage({client:'synthetic-other-tab',vaultId:await HumanStore.current()});peer.close();}""");p.locator('[data-form=unlock]').wait_for();check('cross-tab lock closes and clears the patient editor',not p.locator('#health-dialog').is_visible() and p.locator('#health-dialog-body').inner_text()=='')
 p.goto(BASE+'health/?demo=1');p.locator('.metric').first.wait_for();tab('vital');p.locator('[data-action=filter-records][data-value="Давление"]').click();check('demonstration has both pressure series',p.locator('.health-chart polyline').count()==2);capture(p,path=str(ROOT/'docs/health-ui/pressure-1440.png'),full_page=True)
 check('all data stayed local',not remote);check('no runtime errors',not errors);b.close()
print(len(checks),'episode checks PASS')
