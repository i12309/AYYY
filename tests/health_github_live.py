"""Opt-in real encrypted GitHub roundtrip. Uses gh credentials in memory only.

Set HEALTH_GITHUB_TEST_REPO=i12309/TEST_TREE to explicitly authorize a temporary
branch. Existing branches/data are untouched. No token or plaintext is published.
"""
import json, os, subprocess, uuid, mimetypes, time
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
tree=gh('repos/'+REPO+'/git/trees',{'tree':[{'path':'HEALTH_TEST.md','mode':'100644','type':'blob','content':'Temporary synthetic encrypted health roundtrip. No personal data.'}]})
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
   const C=HumanCrypto,G=HumanGithub,M=HumanModel;G.token(p.token);await G.verify(p.repo);
   const created=await C.create(p.passphrase);created.doc.profile.name='Synthetic roundtrip';
   const record=M.checkLab({name:'Synthetic marker',date:'2026',datePrecision:'year',value:'< 0,1',unit:'mg'});
   created.doc.observations.push(record);created.doc.analytePreferences={[M.groupKey(record)]:{favorite:true}};
   window.testVault={...created,envelope:await C.seal(created.doc,created.key,created.envelope)};
   return await G.write(p.repo,testVault.envelope,null);
  }''',params)
  print('PASS first browser wrote encrypted vault',result,flush=True)
  restored=pb.evaluate('''async p=>{HumanGithub.token(p.token);const r=await HumanGithub.read(p.repo),v=await HumanCrypto.unlock(r.envelope,p.passphrase);window.testRemote=r;window.testOpened=v;return {name:v.doc.profile.name,value:v.doc.observations[0].value,date:v.doc.observations[0].date,favorite:Object.values(v.doc.analytePreferences)[0].favorite};}''',params)
  assert restored=={'name':'Synthetic roundtrip','value':'< 0,1','date':'2026','favorite':True}
  print('PASS second browser restored dates, source values and favorites',flush=True)
  await_update=pb.evaluate('''async p=>{testOpened.doc.profile.notes='Synthetic second device update';const env=await HumanCrypto.seal(testOpened.doc,testOpened.key,testRemote.envelope);return HumanGithub.write(p.repo,env,testRemote.sha);}''',params)
  conflict=pa.evaluate('''async p=>{try{await HumanGithub.write(p.repo,testVault.envelope,p.sha);return false;}catch(e){return e.message.includes('Конфликт');}}''',{**params,'sha':result})
  assert conflict,'Stale SHA must not overwrite the other browser'
  print('PASS stale first browser write rejected',flush=True)
  item=gh('repos/'+REPO+'/contents/health-data/v1/vault.json?ref='+branch)
  import base64
  envelope=json.loads(base64.b64decode(item['content']))
  assert envelope['format']=='ayyy-health-v1' and 'observations' not in envelope and 'profile' not in envelope
  assert 'Synthetic' not in json.dumps(envelope)
  print('PASS remote contains only encrypted envelope',flush=True)
  # Exercise the real controller as well as the transport API.
  def open_ui(page):
   form=page.locator('[data-form=download]');form.locator('[name=repo]').fill(REPO);form.locator('[name=branch]').fill(branch);form.locator('[name=token]').fill(credential);form.locator('[type=submit]').click();page.locator('[data-form=unlock]').wait_for();page.locator('[name=passphrase]').fill(params['passphrase']);page.locator('[data-form=unlock] [type=submit]').click();page.locator('.metric').first.wait_for()
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
  pb.locator('.care-list [data-action=edit]').click();pb.locator('#health-dialog [name=title]').fill('Synthetic second UI revision');pb.locator('#health-dialog [type=submit]').click();pb.locator('#health-dialog').wait_for(state='hidden');synced(pb)
  new_reminder(pa,'Synthetic first UI pending draft');pa.get_by_text('Конфликт версий',exact=True).wait_for(timeout=60000)
  kept=pa.evaluate('''async p=>{const local=await HumanStore.get(await HumanStore.current()),opened=await HumanCrypto.unlock(local.envelope,p.passphrase),remote=await HumanGithub.read(p.repo),other=await HumanCrypto.unlock(remote.envelope,p.passphrase);return local.dirty&&opened.doc.reminders.length===2&&other.doc.reminders.length===1&&other.doc.reminders[0].title==='Synthetic second UI revision';}''',params)
  assert kept,'Controller conflict must retain both independent versions'
  print('PASS controller conflict preserves the local draft and remote revision',flush=True)
  assert not runtime_errors,'Runtime error in GitHub UI roundtrip'
  browser.close()
finally:
 gh('repos/'+REPO+'/git/refs/heads/'+branch,method='DELETE')
 print('Temporary test branch removed; existing repository data unchanged',flush=True)
