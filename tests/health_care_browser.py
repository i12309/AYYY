"""Synthetic care events, DST-aware schedules, delivery and encrypted persistence."""
from pathlib import Path
from urllib.parse import urlsplit
from datetime import datetime, timezone
import mimetypes
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1];BASE='http://localhost:8877/';checks=[]
def check(label,result):
 assert result,label
 checks.append(label);print('PASS',label,flush=True)
with sync_playwright() as pw:
 b=pw.chromium.launch();ctx=b.new_context(viewport={'width':1440,'height':1000},timezone_id='Europe/Moscow');errors=[];remote=[]
 def serve(route):
  if not route.request.url.startswith(BASE):remote.append(route.request.url);route.abort();return
  file=(ROOT/urlsplit(route.request.url).path.lstrip('/')).resolve()
  if file.is_dir():file=file/'index.html'
  if ROOT in file.parents and file.is_file():route.fulfill(body=file.read_bytes(),content_type=mimetypes.guess_type(file)[0] or 'text/plain')
  else:route.fulfill(status=404,body='Missing')
 ctx.route('**/*',serve)
 ctx.add_init_script("""window.syntheticNotices=[];window.syntheticPermissionRequests=0;window.Notification=class {
 static permission='granted';static async requestPermission(){window.syntheticPermissionRequests++;this.permission='granted';return 'granted';}
 constructor(title,options){this.title=title;this.options=options;this.closed=false;window.syntheticNotices.push(this);}close(){this.closed=true;}
 };""")
 p=ctx.new_page();p.on('pageerror',lambda e:errors.append(str(e)));p.on('dialog',lambda d:d.accept());p.clock.install(time=datetime(2026,11,10,12,tzinfo=timezone.utc));p.clock.pause_at(datetime(2026,11,10,12,tzinfo=timezone.utc));p.goto(BASE+'health/')
 p.locator('[data-form=create] [name=password]').fill('synthetic-care-passphrase');p.locator('[name=repeat]').fill('synthetic-care-passphrase');p.locator('[data-form=create] [type=submit]').click();p.locator('.metric').first.wait_for()
 def tab(name):p.locator('.sidebar button[data-tab='+name+']').click()
 def fill(name,value):p.locator('#health-dialog [name='+name+']').fill(value)
 def choose(name,value):p.locator('#health-dialog [name='+name+']').select_option(value)
 def save():p.locator('#health-dialog [type=submit]').click();p.locator('#health-dialog').wait_for(state='hidden')
 def snapshot():return p.evaluate("""async()=>{const local=await HumanStore.get(await HumanStore.current());return (await HumanCrypto.unlock(local.envelope,'synthetic-care-passphrase')).doc;}""")
 tab('medical');p.locator('[data-value=medication][data-action=filter-records]').click();p.locator('[data-action=new-medication]').click();fill('name','Synthetic care medication');fill('dose','Synthetic planned dose');fill('frequency','Synthetic planned schedule');save();p.locator('[data-action=open-medical]').click();p.locator('[data-view=intakes][data-action=care-medication]').click()
 check('medical card opens preselected intake',p.locator('#health-dialog [name=medication_id] option:checked').inner_text()=='Synthetic care medication')
 fill('at','2026-11-11T10:00');p.locator('#health-dialog [type=submit]').click();check('future intake rejected',p.locator('#health-dialog [data-form-error]').is_visible());fill('at','2026-11-10T14:00');fill('notes','Synthetic event <img src=x onerror=alert(1)>');save()
 check('unknown actual dose stays unknown','Не указана' in p.locator('.care-list').inner_text());check('event notes are DOM text',p.locator('.care-list img').count()==0 and '<img' in p.locator('.care-list').inner_text())
 d=snapshot();check('intake leaves the planned dose and schedule untouched',d['medications'][0]['dose']=='Synthetic planned dose' and d['intakes'][0]['dose']=='' and d['intakes'][0]['occurred_at']=='2026-11-10T11:00:00.000Z')
 p.locator('.care-list [data-action=edit]').click();choose('outcome','skipped');check('skipped intake has no dose input',p.locator('#health-dialog [name=dose]').is_disabled());save();check('skipped event shown explicitly','Пропуск' in p.locator('.care-list').inner_text());p.locator('[data-action=care-history]').click();check('intake correction retains previous event','Принял(а)' in p.locator('.care-history').inner_text());p.locator('#health-dialog [data-action=close-dialog]').click()
 p.locator('[data-view=reminders][data-action=care-view]').click();p.locator('[data-action=new-reminder]').click();fill('title','Synthetic private reminder');fill('date','2026-11-10');fill('time','16:00');choose('medication_id',d['medications'][0]['id']);save()
 check('notifications require explicit permission',p.evaluate('syntheticPermissionRequests===0 && syntheticNotices.length===0'))
 p.clock.fast_forward(61*60000);check('clock refresh updates the bell',p.locator('#health-reminder-bell').get_attribute('aria-label').endswith(': 1'));check('due reminder provides actions',p.locator('.care-due [data-mode=done]').count()==1)
 p.locator('.care-notification-options summary').click();p.locator('[data-action=care-notifications]').click();p.wait_for_function('()=>syntheticNotices.length===1');check('notification contains only generic content',p.evaluate("syntheticPermissionRequests===1 && !JSON.stringify(syntheticNotices).includes('Synthetic')"));p.clock.fast_forward(60000);check('same reminder is not notified repeatedly',p.evaluate('syntheticNotices.length===1'))
 p.locator('.care-due [data-mode=snooze]').click();save();check('snooze preserves original scheduled instant',snapshot()['reminders'][0]['scheduled_at']=='2026-11-10T13:00:00.000Z' and snapshot()['reminders'][0]['next_due_at']=='2026-11-10T14:02:00.000Z')
 p.clock.fast_forward(61*60000);p.locator('.care-due [data-mode=done]').evaluate('(e)=>{e.click();e.click();}');p.locator('.care-due').wait_for(state='hidden');d=snapshot();check('reminder completion never invents an intake',len(d['intakes'])==1 and not d['reminders'][0]['enabled']);check('repeated stale action changes the record once',d['reminders'][0]['version']==3)
 p.locator('.care-list [data-action=care-history]').click();check('history distinguishes snooze and completion','Отложено' in p.locator('.care-history').inner_text() and 'Выполнено' in p.locator('.care-history').inner_text());p.locator('#health-dialog [data-action=close-dialog]').click()
 p.locator('[data-action=new-reminder]').click();fill('title','Synthetic daily schedule');choose('frequency','daily');fill('date','2026-11-10');fill('time','18:30');fill('until_date','2026-11-12');save();r=snapshot()['reminders'][-1];check('daily schedule uses the reminder timezone',r['next_due_at']=='2026-11-10T15:30:00.000Z')
 row=p.locator('.care-list tr').filter(has_text='Synthetic daily schedule');row.locator('[data-action=care-toggle]').click();check('pause disables the schedule',not snapshot()['reminders'][-1]['enabled']);row.locator('[data-action=care-toggle]').click();check('schedule resumes',snapshot()['reminders'][-1]['enabled'])
 for width in [360,390,768,1440]:
  p.set_viewport_size({'width':width,'height':900});check('care workspace fits '+str(width),p.evaluate('document.documentElement.scrollWidth<=innerWidth'))
  if width<=390:check('care actions fit without internal horizontal scrolling '+str(width),p.locator('.care-list .health-table-wrap').evaluate('(e)=>e.scrollWidth<=e.clientWidth'))
  if width in [390,1440]:p.locator('#health-notice').evaluate('(e)=>e.classList.remove("show")');p.screenshot(path=str(ROOT/f'docs/health-ui/care-{width}.png'),full_page=True)
 p.set_viewport_size({'width':1440,'height':1000});p.reload();p.locator('[name=passphrase]').fill('synthetic-care-passphrase');p.locator('[data-form=unlock] [type=submit]').click();p.locator('.metric').first.wait_for();tab('care');check('encrypted reload preserves reported intake','Пропуск' in p.locator('.care-list').inner_text());p.locator('[data-view=reminders]').click();check('encrypted reload preserves both schedules',p.locator('.care-list tbody tr').count()==2)
 tab('medical');p.locator('[data-action=remove][data-kind=medication]').click();tab('care');p.locator('[data-view=intakes]').click();p.locator('.care-list [data-action=edit]').click();check('deleted medication name remains on original event','удалён' in p.locator('#health-dialog [name=medication_id] option:checked').inner_text());fill('notes','Synthetic correction after medication deletion');save();check('correction retains deleted medication reference',snapshot()['intakes'][0]['medication_name']=='Synthetic care medication')
 p.locator('.care-list [data-action=remove]').click();check('intake deletion retains audit history',snapshot()['intakes']==[] and any(x['operation']=='delete' and x['kind']=='intake' for x in snapshot()['revisions']))
 p.locator('[data-view=reminders]').click();p.locator('[data-action=new-reminder]').click();fill('title','Synthetic due before lock');fill('date','2026-11-10');fill('time','10:00');save();p.wait_for_function('()=>syntheticNotices.length>0');p.locator('.sidebar [data-action=lock]').click();check('locking closes active notification',p.evaluate('syntheticNotices.every(n=>n.closed)'));check('locked screen contains no care data','Synthetic' not in p.locator('#health-root').inner_text())
 p.locator('[data-action=picker]').click();p.locator('[data-form=create] [name=password]').fill('synthetic-other-profile');p.locator('[name=repeat]').fill('synthetic-other-profile');p.locator('[data-form=create] [type=submit]').click();p.locator('.metric').first.wait_for();tab('care');check('second profile has no prior intake or notification preference','Событий пока нет' in p.locator('.care-list').inner_text() and p.locator('#health-reminder-bell').get_attribute('aria-label').endswith(': 0'))
 check('care kept all requests local',not remote);check('care has no runtime errors',not errors);b.close()
print(len(checks),'care checks PASS')
