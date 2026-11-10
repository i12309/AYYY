"""Synthetic HUMAN v2 export using the original public database schema."""
import io, json, hashlib, sqlite3, tempfile, zipfile, mimetypes
from pathlib import Path
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1];BASE='http://localhost:8877/';checks=[]
def uid(n):return f'00000000-0000-4000-8000-{n:012d}'
def archive(bad_hash=False,missing=False,future=False):
 with tempfile.TemporaryDirectory() as tmp:
  path=Path(tmp)/'human.db';db=sqlite3.connect(path)
  db.execute('CREATE TABLE schema_migrations(version TEXT PRIMARY KEY,checksum TEXT,applied_at TEXT)')
  for migration in sorted((ROOT/'tests/fixtures/human-v2-schema').glob('*.sql')):
   db.executescript(migration.read_text(encoding='utf-8'));db.execute('INSERT INTO schema_migrations VALUES(?,?,?)',(migration.name,hashlib.sha256(migration.read_bytes()).hexdigest(),'2026-11-01'))
  if future:db.execute("INSERT INTO schema_migrations VALUES('999.sql','unknown','2026-11-01')")
  def insert(table,**row):db.execute('INSERT INTO '+table+'('+','.join(row)+') VALUES('+','.join('?' for _ in row)+')',list(row.values()))
  insert('profile',id=1,payload=json.dumps({'name':'Synthetic migrated person','birth_date':'1990-02-03','sex_at_birth':'intersex','timezone':'Europe/Moscow','height_cm':170}),version=1)
  source={'id':uid(1),'type':'manual'};insert('sources',id=uid(1),type='manual',payload=json.dumps(source))
  content=b'SYNTHETIC document; no personal data';digest=hashlib.sha256(content).hexdigest();document={'id':uid(2),'title':'Synthetic attachment','source':source}
  insert('documents',id=uid(2),original_filename='synthetic.txt',mime_type='text/plain',size=len(content),sha256=digest,received_at='2026-11-01T12:00:00Z',source_id=uid(1),status='ready',payload=json.dumps(document))
  observations=[
   dict(value_kind='quantity',value=3,time_precision='exact',observed_at='2026-11-01T15:00:00+03:00',observed_date=None),
   dict(value_kind='censored',value=.1,comparator='lt',time_precision='year',observed_date='2026-01-01'),
   dict(value_kind='qualitative',value=None,qualitative_value='отрицательно',time_precision='unknown',observed_date=None,observed_at=''),
   dict(value_kind='range',value=None,range_low=1,range_high=2,time_precision='month',observed_date='2026-11-01'),
   dict(value_kind='quantity',value=99,review_status='draft'),
   dict(value_kind='quantity',value=100)
  ]
  for i,override in enumerate(observations):
   o={'id':uid(10+i),'code':'synthetic','name':'Synthetic glucose','value':3,'value_kind':'quantity','comparator':'eq','time_precision':'day','observed_date':'2026-11-01','observed_at':'2026-11-01T00:00:00Z','unit':'mg','reference_low':0,'reference_high':4,'review_status':'confirmed_manual','version':1,'created_at':'2026-11-01T12:00:00Z','source':{**source,'document_id':uid(2)},'unit_history':{'unit':'mg','observation_id':uid(10),'version':1}};o.update(override)
   insert('observations',id=o['id'],code=o['code'],name=o['name'],observed_at=o['observed_at'],unit=o['unit'],specimen='',method='',laboratory='',value_kind=o['value_kind'],value=o.get('value'),review_status=o['review_status'],version=1,source_id=uid(1),payload=json.dumps(o))
  insert('observation_deletions',observation_id=uid(15),version=1,deleted_at='2026-11-02')
  insert('observation_revisions',id=uid(30),observation_id=uid(10),version=1,snapshot=json.dumps({'id':uid(10),'value':2}),reason='Synthetic correction',changed_at='2026-11-02')
  setting={'analyte_id':'glucose','unit':'mg','reference_low':0,'reference_high':2,'note':'Synthetic reference','version':1}
  insert('analyte_settings',analyte_id='glucose',version=1,payload=json.dumps(setting))
  insert('analyte_favorites',analyte_id='glucose',favorite=1,version=1,updated_at='2026-11-01')
  insert('analyte_aliases',normalized_name='synthetic glucose',version=1,payload=json.dumps({'analyte_id':'glucose','normalized_name':'synthetic glucose','version':1}))
  insert('health_records',id=uid(40),kind='pressure',observed_at='2026-11-01T12:00:00Z',version=1,deleted=0,source_id=uid(1),payload=json.dumps({'id':uid(40),'kind':'pressure','value':120,'secondary':80,'unit':'мм рт. ст.','observed_at':'2026-11-01T12:00:00Z'}))
  insert('health_records',id=uid(41),kind='illness',observed_at='2026-11-01T12:00:00Z',version=1,deleted=0,source_id=uid(1),payload=json.dumps({'id':uid(41),'kind':'illness','title':'Synthetic episode','observed_at':'2026-11-01T12:00:00Z'}))
  insert('genetic_findings',id=uid(50),category='synthetic',title='Synthetic uninterpreted finding',status='unknown',provider='',source_id=uid(1),created_at='2026-11-01',payload='{"interpretation":null}')
  for i,kind in enumerate(['allergy','medication']):
   record={'id':uid(60+i),'kind':kind,'name':'Synthetic '+kind,'status':'active','basis':'self_reported','start':{'precision':'year','value':'2001'},'end':{'precision':'unknown','value':''},'notes':'Synthetic clinical note','allergy':{'reaction':'Synthetic reaction','severity':'unknown'} if kind=='allergy' else None,'medication':{'dose':'Synthetic dose','schedule':'Synthetic schedule','route':'oral','category':'medication','indication':''} if kind=='medication' else None}
   insert('medical_records',id=uid(60+i),kind=kind,status='active',search_text=record['name'],updated_at='2026-11-01',version=1,deleted=0,source_id=uid(1),payload=json.dumps(record))
  for i,kind in enumerate(['intake','reminder','intake']):
   record={'id':uid(80+i),'version':2,'source':source,'medication_id':uid(61),'medication_name':'Synthetic medication','notes':'Synthetic care source note'}
   if kind=='intake':record.update({'outcome':'taken','dose':'','occurred_at':'2026-11-01T12:00:00Z'})
   else:record.update({'title':'Synthetic migrated reminder','frequency':'once','date':'2026-11-01','time':'15:00','timezone':'Europe/Moscow','utc_offset':'','until_date':'','enabled':True,'scheduled_at':'2026-11-01T12:00:00Z','next_due_at':'2026-11-01T12:00:00Z'})
   insert('care_records',id=uid(80+i),kind=kind,occurred_at='2026-11-01T12:00:00Z',version=2,deleted=1 if i==2 else 0,source_id=uid(1),payload=json.dumps(record))
   if i==0:insert('care_revisions',record_id=uid(80),version=1,changed_at='2026-11-02T12:00:00Z',action='corrected',snapshot=json.dumps({**record,'version':1,'notes':'Synthetic previous care note'}))
  insert('care_preferences',id=1,browser_enabled=1,version=1)
  for kind,id,payload in [('meal',uid(70),{'description':'Synthetic meal','eaten_at':'2026-11-01T12:00:00Z','calories_kcal':0,'protein_g':None,'notes':'Synthetic meal note'}),('activity','2026-11-01',{'date':'2026-11-01','activity_type':'Synthetic activity','steps':500,'sleep_minutes':None,'exercise_minutes':None,'notes':''})]:
   insert('journal_entries',id=id,kind=kind,occurred_at='2026-11-01',title=kind,search_title=kind,version=1,deleted=0,payload=json.dumps(payload))
  db.commit();db.close();data=path.read_bytes()
 manifest={'format':'human-user','version':2,'user_id':uid(100),'created_at':'2026-11-01T00:00:00Z','entries':{'human.db':{'size':len(data),'sha256':hashlib.sha256(data).hexdigest()},'files/'+uid(2)+'/original':{'size':len(content),'sha256':'0'*64 if bad_hash else digest}}}
 output=io.BytesIO()
 with zipfile.ZipFile(output,'w',zipfile.ZIP_DEFLATED) as z:
  z.writestr('manifest.json',json.dumps(manifest));z.writestr('human.db',data)
  if not missing:z.writestr('files/'+uid(2)+'/original',content)
 return output.getvalue()
def check(label,result):
 assert result,label
 checks.append(label);print('PASS',label,flush=True)
with sync_playwright() as pw:
 browser=pw.chromium.launch();ctx=browser.new_context(viewport={'width':1440,'height':1000});external=[];errors=[]
 def serve(route):
  if not route.request.url.startswith(BASE):external.append(route.request.url);route.abort();return
  file=(ROOT/urlsplit(route.request.url).path.lstrip('/')).resolve()
  if file.is_dir():file=file/'index.html'
  if ROOT in file.parents and file.is_file():route.fulfill(body=file.read_bytes(),content_type=mimetypes.guess_type(file)[0] or 'application/octet-stream')
  else:route.fulfill(status=404,body='Missing')
 ctx.route('**/*',serve);p=ctx.new_page();p.on('pageerror',lambda e:errors.append(str(e)));p.goto(BASE+'health/')
 p.locator('[data-form=create] [name=password]').fill('synthetic-old-passphrase');p.locator('[name=repeat]').fill('synthetic-old-passphrase');p.locator('[data-form=create] [type=submit]').click();p.locator('.metric').first.wait_for();p.locator('.sidebar button[data-tab=settings]').click()
 payload=archive();p.locator('#health-notice').evaluate('(e)=>e.classList.remove("show")')
 p.locator('[data-form=human-migration-file] [name=file]').set_input_files({'name':'synthetic-human.zip','mimeType':'application/zip','buffer':payload});p.locator('[data-form=human-migration-file] [type=submit]').click();p.wait_for_function("()=>document.querySelector('[data-form=human-migration-confirm]')||document.querySelector('#health-notice.show')");assert p.locator('[data-form=human-migration-confirm]').count(),p.locator('#health-notice').inner_text()
 p.locator('[data-form=human-migration-confirm] summary').click()
 check('archive validates and reports source tables','genetic_findings' in p.locator('[data-form=human-migration-confirm]').inner_text())
 (ROOT/'docs/health-ui').mkdir(parents=True,exist_ok=True);p.locator('[data-form=human-migration-confirm] summary').click();p.screenshot(path=str(ROOT/'docs/health-ui/migration-review-1440.png'),full_page=True)
 check('migration has not replaced original profile',p.evaluate('async()=> (await HumanStore.list()).length')==1)
 p.locator('[data-form=human-migration-confirm] [name=password]').fill('synthetic-migration-passphrase');p.locator('[data-form=human-migration-confirm] [name=repeat]').fill('synthetic-migration-passphrase');p.locator('[data-form=human-migration-confirm] [type=submit]').click();p.locator('#health-dialog').wait_for(state='hidden')
 check('separate encrypted vault created',p.evaluate('async()=> (await HumanStore.list()).length')==2)
 p.locator('.sidebar button[data-tab=lab]').click();check('classification and favorites migrated','Глюкоза' in p.locator('.group-name').inner_text() and p.locator('[data-action=toggle-favorite]').get_attribute('aria-pressed')=='true')
 p.locator('.group-name').click();check('deleted observation stays out of live history',p.locator('.analyte-history tbody tr').count()==5)
 check('only confirmed exact numeric point is graphed',p.locator('.analyte-chart circle').count()==1)
 check('censored and qualitative results preserved','< 0.1' in p.locator('.analyte-history').inner_text() and 'отрицательно' in p.locator('.analyte-history').inner_text())
 p.locator('.analyte-source [data-action=file-preview]').click();check('source document restored','SYNTHETIC document' in p.locator('.health-document-preview pre').inner_text());p.locator('#health-dialog [data-action=close-dialog]').click()
 p.locator('.sidebar button[data-tab=medical]').click();check('medical records and medication schedule visible','Synthetic allergy' in p.locator('#health-root').inner_text() and 'Synthetic schedule' in p.locator('#health-root').inner_text())
 p.locator('.sidebar button[data-tab=care]').click();check('active care events migrated without deleted events',p.locator('.care-list tbody tr').count()==1 and 'Не указана' in p.locator('.care-list').inner_text())
 p.locator('[data-action=care-history]').click();check('care source revision available','Synthetic previous care note' in p.locator('.care-history').inner_text());p.locator('#health-dialog [data-action=close-dialog]').click()
 p.locator('[data-view=reminders]').click();check('migrated reminder retains the original schedule and asks for browser opt-in','Synthetic migrated reminder' in p.locator('.care-list').inner_text() and 'внутри HUMAN' in p.locator('.care-notification-options').inner_text())
 p.locator('.sidebar button[data-tab=diary]').click();check('meal and activity visible','Synthetic meal' in p.locator('#health-root').inner_text() and 'Synthetic activity' in p.locator('#health-root').inner_text())
 preserved=p.evaluate("""async()=>{const entry=await HumanStore.get(await HumanStore.current()),{doc}=await HumanCrypto.unlock(entry.envelope,'synthetic-migration-passphrase');return doc.profile.timezone==='Europe/Moscow'&&doc.profile.sex==='intersex'&&doc.profile.heightCm===170&&doc.diary.find(x=>x.kind==='food').human.calories_kcal===0&&doc.medical[0].human.allergy.reaction==='Synthetic reaction';}""")
 check('clinical detail, unknown nutrients and profile fields preserved',preserved)
 p.locator('.sidebar button[data-tab=settings]').click();p.locator('[data-action=human-raw]').click();p.locator('[aria-label="Исходная таблица"]').select_option('genetic_findings');check('additional source sections retained','Synthetic uninterpreted finding' in p.locator('.health-document-preview pre').inner_text());p.locator('#health-dialog [data-action=close-dialog]').click()
 with p.expect_download() as download:p.locator('[data-action=human-original]').click()
 check('original export roundtrip is byte exact',Path(download.value.path()).read_bytes()==payload)
 p.reload();p.locator('[name=passphrase]').fill('synthetic-migration-passphrase');p.locator('[data-form=unlock] [type=submit]').click();p.locator('.metric').first.wait_for();check('migrated identity survives encrypted reload','Synthetic migrated person' in p.locator('.sidebar').inner_text())
 p.locator('.sidebar button[data-tab=settings]').click()
 p.locator('[data-form=human-migration-file] [name=file]').set_input_files({'name':'same.zip','mimeType':'application/zip','buffer':payload});p.locator('[data-form=human-migration-file] [type=submit]').click();p.get_by_text('Этот экспорт уже перенесён в открытый журнал.',exact=True).wait_for();check('repeat import does not duplicate live journal',p.evaluate('async()=> (await HumanStore.list()).length')==2)
 for name,data in [('bad-sha',archive(bad_hash=True)),('missing',archive(missing=True)),('future-schema',archive(future=True))]:
  message=p.evaluate('''async b=>{try{await HumanMigration.inspect(new File([Uint8Array.from(atob(b),c=>c.charCodeAt(0))],'bad.zip'));return false;}catch{return true;}}''',__import__('base64').b64encode(data).decode());check('reject '+name,message)
 check('rejected archives leave vault count unchanged',p.evaluate('async()=> (await HumanStore.list()).length')==2)
 before=p.evaluate('async()=>({current:await HumanStore.current(),count:(await HumanStore.list()).length})')
 failed=p.evaluate("""async()=>{const created=await HumanCrypto.create('synthetic-rollback-passphrase'),put=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(...args){if(this.name==='meta')throw new DOMException('Synthetic storage failure','QuotaExceededError');return put.apply(this,args);};try{await HumanStore.createSelected({id:created.doc.id,envelope:created.envelope});return false;}catch{return true;}finally{IDBObjectStore.prototype.put=put;}}""")
 check('failed migration storage transaction rolls back',failed and p.evaluate('async()=>({current:await HumanStore.current(),count:(await HumanStore.list()).length})')==before)
 check('no external uploads',not external);check('no runtime errors',not errors);browser.close()
print(len(checks),'migration checks PASS')
