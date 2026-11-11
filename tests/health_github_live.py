"""Opt-in real encrypted GitHub roundtrip. Uses gh credentials in memory only.

Set HEALTH_GITHUB_TEST_REPO=i12309/TEST_TREE to explicitly authorize a temporary
branch. Existing branches/data are untouched. No token or plaintext is published.
"""
import hashlib, json, os, subprocess, uuid, mimetypes, time
from pathlib import Path
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
REPO=os.environ.get('HEALTH_GITHUB_TEST_REPO','')
assert REPO=='i12309/TEST_TREE','Explicit test-repository opt-in required'

def gh(path, payload=None, method=None):
    args=['gh','api',path]
    if method: args+=['--method',method]
    if payload is not None: args+=['--input','-']
    result=subprocess.run(args,input=json.dumps(payload) if payload is not None else None,capture_output=True,text=True,encoding='utf-8')
    if result.returncode: raise RuntimeError('GitHub test setup/cleanup failed: '+path)
    return json.loads(result.stdout) if result.stdout.strip() else None

assert gh('repos/'+REPO)['private'] is True
credential=subprocess.run(['gh','auth','token'],capture_output=True,text=True,check=True).stdout.strip()
branch='test/health-browser-'+uuid.uuid4().hex[:12]
# An independent root tree avoids inheriting any real vault from the default branch.
tree=gh('repos/'+REPO+'/git/trees',{'tree':[{'path':'family-data/TEST.txt','mode':'100644','type':'blob','content':'Unrelated synthetic file'}]})
commit=gh('repos/'+REPO+'/git/commits',{'message':'test: synthetic health browser roundtrip','tree':tree['sha']})
gh('repos/'+REPO+'/git/refs',{'ref':'refs/heads/'+branch,'sha':commit['sha']})
print('Temporary branch:',branch,flush=True)
try:
 with sync_playwright() as pw:
  browser=pw.chromium.launch();runtime_errors=[]
  def context():
   ctx=browser.new_context()
   def serve(route):
    if route.request.url.startswith('https://api.github.com/'):
     route.continue_();return
    name=urlsplit(route.request.url).path.lstrip('/') or 'index.html';file=(ROOT/name).resolve()
    if file.is_dir():file=file/'index.html'
    if ROOT in file.parents and file.is_file():route.fulfill(body=file.read_bytes(),content_type=mimetypes.guess_type(file)[0] or 'text/plain')
    else:route.abort()
   ctx.route('**/*',serve)
   page=ctx.new_page();page.on('pageerror',lambda e:runtime_errors.append(str(e)));page.goto('http://localhost:8877/health/');page.wait_for_function('()=>!!window.HumanGithub')
   return ctx,page
  a,pa=context();b,pb=context()
  repo={'owner':'i12309','repo':'TEST_TREE','branch':branch}
  params={'token':credential,'repo':repo,'passphrase':'synthetic-roundtrip-passphrase'}
  result=pa.evaluate('''async p=>{
   const C=HumanCrypto,G=HumanGithub,M=HumanModel,A=HumanAnalytes;G.token(p.token);await G.verify(p.repo);
   const created=await C.create(p.passphrase);created.doc.profile.name='Synthetic roundtrip';
   const record=M.checkLab({name:'Synthetic marker',date:'2026',datePrecision:'year',value:'< 0,1',unit:'mg'});
   created.doc.observations.push(record);
   A.applyAlias(created.doc,record,{scope:'name',target:'alt',reason:'Synthetic alias',expected:0});
   const match=A.classify(record,created.doc.analyteAliases);
   created.doc.analytePreferences={[A.favoriteKey(match)]:{favorite:true}};
   A.setDefault(created.doc,record,'mg','Synthetic unit preference',0);
   created.doc.findings.push(HumanGenetics.checkFinding({title:'Synthetic reported finding',result:'Synthetic report only',category:'other',test_date:'2025',date_precision:'year',genes:'demoGene',variants:'SYNTHETIC:./.'},{},created.doc));
   HumanRecommendations.saveIntake(created.doc,{smoking:'Synthetic unknown'},0);
   const snapshot=await HumanRecommendations.snapshot(created.doc,'Synthetic review packet');
   HumanRecommendations.addReport(created.doc,{context_id:snapshot.id,request_id:crypto.randomUUID(),title:'Synthetic saved review',author:'Synthetic author',model:'synthetic/1',prompt_version:snapshot.prompt_version,sections:[{kind:'assessment',title:'Synthetic section',body:'Synthetic source text, not medical advice.',observation_ids:[record.id],evidence_urls:['https://example.org/evidence']}],limitations:['Synthetic context'],evidence:[{title:'Synthetic evidence',url:'https://example.org/evidence',accessed_on:'2026-01-01'}]});
   window.testVault={...created,envelope:await C.seal(created.doc,created.key,created.envelope)};
   return await G.write(p.repo,testVault.envelope,null);
  }''',params)
  print('PASS first browser wrote encrypted vault',result,flush=True)
  restored=pb.evaluate('''async p=>{
   HumanGithub.token(p.token);
   const r=await HumanGithub.read(p.repo),v=await HumanCrypto.unlock(r.envelope,p.passphrase);
   window.testRemote=r;window.testOpened=v;
   const A=HumanAnalytes,d=v.doc,row=d.observations[0],group=HumanModel.groups(d.observations,d.analytePreferences,d.analyteAliases)[0];
   return {name:d.profile.name,value:row.value,date:row.date,favorite:group.preferences.favorite,
    alias:group.match.id,unit:d.analytePreferences[A.defaultKey(row,d.analyteAliases)].unit,
    findingDate:d.findings[0].test_date,variants:d.findings[0].variants,genes:d.findings[0].genes,
    questionnaire:d.recommendationIntakes[0].answers.smoking,review:d.recommendationReports[0].title,
    snapshot:d.recommendationReports[0].context_hash===d.recommendationContexts[0].hash};
  }''',params)
  assert restored=={'name':'Synthetic roundtrip','value':'< 0,1','date':'2026','favorite':True,'alias':'alt','unit':'mg','findingDate':'2025','variants':'SYNTHETIC:./.','genes':['demoGene'],'questionnaire':'Synthetic unknown','review':'Synthetic saved review','snapshot':True}
  print('PASS second browser restored source values, catalogue mapping, settings and favorite',flush=True)
  print('PASS second browser restored reported finding without an inferred genotype',flush=True)
  print('PASS second browser restored questionnaire, immutable snapshot and review',flush=True)
  await_update=pb.evaluate('''async p=>{testOpened.doc.profile.notes='Synthetic second device update';const env=await HumanCrypto.seal(testOpened.doc,testOpened.key,testRemote.envelope);return HumanGithub.write(p.repo,env,testRemote.sha);}''',params)
  conflict=pa.evaluate('''async p=>{try{await HumanGithub.write(p.repo,testVault.envelope,p.sha);return false;}catch(e){return e.message.includes('Конфликт');}}''',{**params,'sha':result})
  assert conflict,'Stale SHA must not overwrite the other browser'
  print('PASS stale first browser write rejected',flush=True)
  item=gh('repos/'+REPO+'/contents/health-data/v2/vault.json?ref='+branch)
  import base64
  envelope=json.loads(base64.b64decode(item['content']))
  assert envelope['format']=='ayyy-health-v2' and 'observations' not in envelope and 'profile' not in envelope
  assert 'Synthetic' not in json.dumps(envelope)
  print('PASS remote contains only encrypted envelope',flush=True)
  # Exercise the real controller as well as the transport API.
  def open_ui(page,phrase=None):
   form=page.locator('[data-form=download]')
   form.locator('[name=repo]').fill(REPO)
   form.locator('[name=branch]').fill(branch)
   form.locator('[name=token]').fill(credential)
   form.locator('[type=submit]').click()
   page.wait_for_function("""() => document.querySelector('[data-form=unlock]') ||
       document.querySelector('#health-notice').textContent.trim()""",timeout=60000)
   unlock=page.locator('[data-form=unlock]')
   assert unlock.count(),page.locator('#health-notice').text_content()
   unlock.locator('[name=passphrase]').fill(phrase or params['passphrase'])
   unlock.locator('[type=submit]').click()
   page.locator('.metric').first.wait_for()
  def reminders(page):page.locator('.sidebar button[data-tab=care]').click();page.locator('[data-view=reminders]').click()
  def new_reminder(page,title):
   page.locator('[data-action=new-reminder]').click();page.locator('#health-dialog [name=title]').fill(title);page.locator('#health-dialog [name=date]').fill('2026-11-10');page.locator('#health-dialog [name=time]').fill('10:00');page.locator('#health-dialog [type=submit]').click();page.locator('#health-dialog').wait_for(state='hidden')
  def synced(page):
   # wait_for_function treats a Promise as truthy; await IndexedDB in evaluate instead.
   deadline=time.monotonic()+60
   while time.monotonic()<deadline:
    if page.evaluate('async()=>{const x=await HumanStore.get(await HumanStore.current());return x&&!x.dirty&&!!x.lastSyncAt;}'):return
    time.sleep(.25)
   raise AssertionError('Controller did not confirm synchronization')
  open_ui(pa);reminders(pa);new_reminder(pa,'Synthetic UI schedule');synced(pa)
  print('PASS controller saved and synchronized a reminder',flush=True)
  open_ui(pb);reminders(pb)
  if 'Synthetic UI schedule' not in pb.locator('.care-list').inner_text():
   for label,page in [('first',pa),('second',pb)]:
    detail=page.evaluate('''async p=>{const local=await HumanStore.get(await HumanStore.current()),opened=await HumanCrypto.unlock(local.envelope,p.passphrase),remote=await HumanGithub.read(p.repo),other=await HumanCrypto.unlock(remote.envelope,p.passphrase);return {localSHA:local.remoteSha,dirty:local.dirty,localReminders:opened.doc.reminders?.length||0,remoteSHA:remote.sha,remoteReminders:other.doc.reminders?.length||0};}''',params)
    print('Controller diagnostic:',label,detail,flush=True)
   raise AssertionError('Second controller did not restore the synchronized reminder')
  print('PASS independent browser UI restored the synchronized schedule',flush=True)
  def edit_reminder(page, title, next_title):
   row=page.locator('.care-list tr').filter(has_text=title)
   row.locator('[data-action=edit]').click()
   page.locator('#health-dialog [name=title]').fill(next_title)
   page.locator('#health-dialog [type=submit]').click()
   page.locator('#health-dialog').wait_for(state='hidden')
  def merge_review(page):
   form=page.locator('[data-form=sync-merge]')
   form.wait_for(timeout=60000)
   return form
  def pull(page):
   page.locator('.sidebar button[data-tab=profile]').click()
   page.locator('#health-notice').evaluate('(e)=>e.textContent=""')
   page.locator('[data-action=sync]').click()
   page.wait_for_function("() => document.querySelector('#health-notice').textContent.trim() !== ''",timeout=60000)
   assert page.locator('#health-notice').text_content()=='Загружены изменения из GitHub.',page.locator('#health-notice').text_content()
  edit_reminder(pb,'Synthetic UI schedule','Synthetic second UI revision');synced(pb)
  new_reminder(pa,'Synthetic first UI pending draft');review=merge_review(pa)
  kept=pa.evaluate('''async p=>{const local=await HumanStore.get(await HumanStore.current()),opened=await HumanCrypto.unlock(local.envelope,p.passphrase),remote=await HumanGithub.read(p.repo),other=await HumanCrypto.unlock(remote.envelope,p.passphrase);return local.dirty&&opened.doc.reminders.length===2&&other.doc.reminders.length===1&&other.doc.reminders[0].title==='Synthetic second UI revision';}''',params)
  assert kept,'Controller conflict must retain both independent versions'
  assert review.locator('fieldset').count()==0
  new_reminder(pb,'Synthetic update during merge review');synced(pb)
  previous_form=review.element_handle()
  review.locator('[type=submit]').click()
  previous_form.wait_for_element_state('hidden')
  # A newer server head must be compared again against the newly recorded base.
  next_review=merge_review(pa)
  assert next_review.locator('fieldset').count()==0
  next_review.locator('[type=submit]').click();synced(pa)
  pull(pb);reminders(pb)
  assert all(title in pb.locator('.care-list').inner_text() for title in [
   'Synthetic first UI pending draft','Synthetic second UI revision','Synthetic update during merge review'])
  print('PASS controller merged independent edits and detected a newer server head during review',flush=True)
  edit_reminder(pb,'Synthetic second UI revision','Synthetic GitHub version');synced(pb)
  reminders(pa);edit_reminder(pa,'Synthetic second UI revision','Synthetic local version')
  review=merge_review(pa)
  assert review.locator('fieldset').count()==1
  assert 'Synthetic local version' in review.inner_text() and 'Synthetic GitHub version' in review.inner_text()
  assert not review.locator('input:checked').count()
  review.locator('[value=remote]').check()
  review.locator('[type=submit]').click();synced(pa)
  pull(pb);reminders(pb)
  assert 'Synthetic GitHub version' in pb.locator('.care-list').inner_text()
  assert 'Synthetic local version' not in pb.locator('.care-list').inner_text()
  print('PASS simultaneous edits to one reminder required a choice and kept the chosen value',flush=True)
  def add_document(page,name,contents):
   page.locator('.sidebar button[data-tab=document]').click()
   page.locator('[data-action=new-document].primary').click()
   page.locator('#health-dialog [name=file]').set_input_files({'name':name,'mimeType':'text/plain','buffer':contents})
   page.locator('#health-dialog [name=title]').fill(name)
   page.locator('#health-dialog [type=submit]').click()
   page.locator('#health-dialog').wait_for(state='hidden')
  large=(b'remote synthetic contents\n' * 150_000)
  small=b'local contents\n'
  add_document(pb,'remote-synthetic.txt',large);synced(pb)
  add_document(pa,'local-synthetic.txt',small)
  review=merge_review(pa);assert review.locator('fieldset').count()==0
  review.locator('[type=submit]').click();synced(pa)
  pull(pb)
  attached=pb.evaluate('''async p=>{
   const r=await HumanGithub.read(p.repo),v=await HumanCrypto.unlock(r.envelope,p.passphrase),verified={};
   for(const file of v.doc.documents){
    if('data' in file)throw Error('Plain bytes included in journal metadata');
    const object=await HumanGithub.readObject(p.repo,file.objectId,r.commit);
    const bytes=await HumanCrypto.openFile(v.doc.id,file,object,v.key);
    verified[file.name]=[bytes.length,file.sha256];
   }
   return verified;
  }''',params)
  assert attached=={name:[len(data),hashlib.sha256(data).hexdigest()] for name,data in [
   ('remote-synthetic.txt',large),('local-synthetic.txt',small)]}
  print('PASS independently uploaded documents, including a multi-megabyte file, retained exact bytes after merging',flush=True)
  reminders(pb);edit_reminder(pb,'Synthetic first UI pending draft','Synthetic edited before deletion');synced(pb)
  reminders(pa);pa.once('dialog',lambda dialog:dialog.accept())
  pa.locator('.care-list tr').filter(has_text='Synthetic first UI pending draft').locator('[data-action=remove]').click()
  review=merge_review(pa)
  assert review.locator('fieldset').count()==1 and 'Записи нет' in review.inner_text()
  review.locator('[value=local]').check();review.locator('[type=submit]').click();synced(pa)
  pull(pb);reminders(pb)
  assert 'Synthetic first UI pending draft' not in pb.locator('.care-list').inner_text()
  assert 'Synthetic edited before deletion' not in pb.locator('.care-list').inner_text()
  print('PASS edit versus delete stayed unresolved until the local deletion was selected',flush=True)
  rotated='synthetic-rotated-roundtrip-phrase'
  pb.locator('.sidebar button[data-tab=profile]').click();pb.locator('[data-action=change-passphrase]').click()
  for field,value in [('current',params['passphrase']),('next',rotated),('repeat',rotated)]:pb.locator('#health-dialog [name='+field+']').fill(value)
  pb.locator('#health-dialog [type=submit]').click();pb.locator('#health-dialog').wait_for(state='hidden');synced(pb)
  rekeyed=pb.evaluate('''async p=>{const remote=await HumanGithub.read(p.repo),opened=await HumanCrypto.unlock(remote.envelope,p.rotated);let oldRejected=false;try{await HumanCrypto.unlock(remote.envelope,p.passphrase);}catch{oldRejected=true;}return oldRejected&&opened.doc.reminders.some(r=>r.title==='Synthetic GitHub version')&&opened.doc.timeline.some(x=>x.kind==='security');}''',{**params,'rotated':rotated})
  assert rekeyed,'Rekey must synchronize the new envelope with the expected remote SHA'
  print('PASS controller synchronized changed passphrase and action history',flush=True)
  c,pc=context();open_ui(pc,rotated);reminders(pc)
  assert 'Synthetic GitHub version' in pc.locator('.care-list').inner_text()
  recovered=pc.evaluate('''async phrase=>{
   const entry=await HumanStore.get(await HumanStore.current());
   const {doc,key}=await HumanCrypto.unlock(entry.envelope,phrase),result={};
   for(const file of doc.documents){
    const object=await HumanStore.getObject(doc.id,file.objectId);
    result[file.name]=(await HumanCrypto.openFile(doc.id,file,object,key)).length;
   }
   return result;
  }''',rotated)
  assert recovered=={'remote-synthetic.txt':len(large),'local-synthetic.txt':len(small)}
  pc.locator('.sidebar button[data-tab=timeline]').click();assert pc.locator('.timeline li').count()>=3
  print('PASS another browser reopened the synchronized journal with the new phrase',flush=True)
  pc.locator('.sidebar button[data-tab=recommendations]').click();pc.locator('.recommendation-report').wait_for();assert 'Synthetic saved review' in pc.locator('.recommendation-report h2').inner_text()
  print('PASS review UI survives GitHub synchronization and changed passphrase',flush=True)
  assert not runtime_errors,'Runtime error in GitHub UI roundtrip'
  unrelated=gh('repos/'+REPO+'/contents/family-data/TEST.txt?ref='+branch)
  assert base64.b64decode(unrelated['content'])==b'Unrelated synthetic file'
  browser.close()
finally:
 gh('repos/'+REPO+'/git/refs/heads/'+branch,method='DELETE')
 print('Temporary test branch removed; existing repository data unchanged',flush=True)
