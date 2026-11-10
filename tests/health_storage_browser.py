"""Synthetic IndexedDB failure and interleaving checks. No personal fixtures or network."""
from pathlib import Path
from urllib.parse import urlsplit
import mimetypes
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1];BASE='http://localhost:8877/';checks=[]
def check(label,result):
 assert result,label
 checks.append(label);print('PASS',label,flush=True)
with sync_playwright() as pw:
 b=pw.chromium.launch();ctx=b.new_context(viewport={'width':1440,'height':1000});errors=[];remote=[]
 def serve(route):
  if not route.request.url.startswith(BASE):remote.append(route.request.url);route.abort();return
  file=(ROOT/urlsplit(route.request.url).path.lstrip('/')).resolve()
  if file.is_dir():file=file/'index.html'
  if ROOT in file.parents and file.is_file():route.fulfill(body=file.read_bytes(),content_type=mimetypes.guess_type(file)[0] or 'text/plain')
  else:route.fulfill(status=404,body='Missing')
 ctx.route('**/*',serve)
 def page():
  p=ctx.new_page();p.on('pageerror',lambda e:errors.append(str(e)));p.on('dialog',lambda d:d.accept());return p
 p=page();p.goto(BASE+'health/');p.locator('[data-form=create] [name=password]').fill('synthetic-storage-passphrase');p.locator('[name=repeat]').fill('synthetic-storage-passphrase');p.locator('[data-form=create] [type=submit]').click();p.locator('.metric').first.wait_for()
 before_create=p.evaluate('async()=>({count:(await HumanStore.list()).length,current:await HumanStore.current()})')
 failed_create=p.evaluate("""async()=>{const created=await HumanCrypto.create('synthetic-atomic-profile'),put=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(...args){if(this.name==='meta')throw new DOMException('Synthetic selection failure','QuotaExceededError');return put.apply(this,args);};try{await HumanStore.createSelected({id:created.doc.id,envelope:created.envelope,dirty:true});return false;}catch{return true;}finally{IDBObjectStore.prototype.put=put;}}""")
 check('failed new-profile selection leaves no partial vault',failed_create and p.evaluate('async()=>({count:(await HumanStore.list()).length,current:await HumanStore.current()})')==before_create)
 def snapshot(p):return p.evaluate("""async()=>{const local=await HumanStore.get(await HumanStore.current());return (await HumanCrypto.unlock(local.envelope,'synthetic-storage-passphrase')).doc;}""")
 def unlock(p):
  p.locator('[name=passphrase]').fill('synthetic-storage-passphrase');p.locator('[data-form=unlock] [type=submit]').click();p.locator('.metric').first.wait_for()
 def add(p,value):
  p.locator('.sidebar button[data-tab=vital]').click();p.locator('.health-vital-summary [data-action=new-vital]').click();p.locator('#health-dialog [name=type]').select_option('Давление');p.locator('#health-dialog [name=value]').fill(value)
 def gate(p):p.evaluate("""()=>{const seal=HumanCrypto.seal;HumanCrypto.seal=async(...args)=>{const result=await seal(...args);await new Promise(resolve=>window.syntheticRelease=()=>{HumanCrypto.seal=seal;resolve();});return result;};}""")
 def savePending(p):p.locator('#health-dialog [type=submit]').click();p.wait_for_function('()=>typeof syntheticRelease==="function"')
 # A locked journal must never be reopened by a late encryption result.
 add(p,'120/80');gate(p);savePending(p);p.evaluate("document.querySelector('.sidebar [data-action=lock]').click()");p.locator('[data-form=unlock]').wait_for();p.evaluate('syntheticRelease()');p.locator('[data-form=unlock]').wait_for();check('lock during encryption leaves stored data unchanged',snapshot(p)['vitals']==[]);check('late result cannot reopen editor or journal',not p.locator('#health-dialog').is_visible() and not p.locator('.sidebar').is_visible())
 unlock(p)
 # Failed writes are atomic and retryable; the form remains reviewable.
 add(p,'121/81');p.evaluate("""()=>{window.syntheticPut=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(...args){if(this.name==='vaults')throw new DOMException('Synthetic quota failure','QuotaExceededError');return syntheticPut.apply(this,args);};}""");p.locator('#health-dialog [type=submit]').click();p.locator('#health-dialog [data-form-error]').wait_for();check('quota error does not mutate the encrypted journal',snapshot(p)['vitals']==[]);check('quota error keeps the editor and input',p.locator('#health-dialog [name=value]').input_value()=='121/81');p.evaluate('()=>{IDBObjectStore.prototype.put=syntheticPut;}');p.locator('#health-dialog [type=submit]').click();p.locator('#health-dialog').wait_for(state='hidden');check('retry after quota failure writes once',len(snapshot(p)['vitals'])==1)
 # Both tabs derive from the same envelope and finish encryption together.
 q=page();q.goto(BASE+'health/');unlock(q)
 add(p,'122/82');add(q,'123/83');gate(p);gate(q);savePending(p);savePending(q)
 p.evaluate('syntheticRelease()');q.evaluate('syntheticRelease()')
 # A successful writer broadcasts a lock; the losing writer cannot overwrite it.
 p.wait_for_function("()=>!document.querySelector('#health-dialog [type=submit]:disabled')");q.wait_for_function("()=>!document.querySelector('#health-dialog [type=submit]:disabled')")
 d=snapshot(p);check('concurrent writes preserve the previous record',d['vitals'][0]['value']=='121/81');check('concurrent writers cannot overwrite each other',len(d['vitals'])==2 and d['vitals'][1]['value'] in ['122/82','123/83']);check('other tab is locked on a committed write',p.locator('[data-form=unlock]').count()+q.locator('[data-form=unlock]').count()>=1)
 q.close();p.reload();unlock(p)
 # Store-level CAS also works without relying on delivery of BroadcastChannel.
 cas=p.evaluate("""async()=>{const old=await HumanStore.get(await HumanStore.current()),a=structuredClone(old),b=structuredClone(old);a.lastSyncAt='2026-11-01T01:00:00Z';b.lastSyncAt='2026-11-01T02:00:00Z';const results=await Promise.allSettled([HumanStore.save(a,old),HumanStore.save(b,old)]);const current=await HumanStore.get(old.id);return {statuses:results.map(x=>x.status),intact:HumanStore.sameEnvelope(current.envelope,old.envelope),failure:results.find(x=>x.status==='rejected')?.reason.message};}""");check('IndexedDB atomically accepts one expected revision',sorted(cas['statuses'])==['fulfilled','rejected'] and cas['intact']);check('CAS error tells user to reopen', 'заново' in cas['failure'])
 p.reload();unlock(p)
 # An in-flight GitHub read is bound to its session, even if the journal is locked.
 p.evaluate("""()=>{HumanGithub.verify=async()=>true;HumanGithub.read=()=>new Promise(resolve=>window.syntheticRemoteRelease=()=>resolve(null));window.syntheticWrites=0;HumanGithub.write=async()=>{syntheticWrites++;return 'synthetic-sha';};}""")
 p.locator('.sidebar button[data-tab=settings]').click();p.locator('[data-form=connect] [name=repo]').fill('synthetic-owner/synthetic-repo');p.locator('[data-form=connect] [name=token]').fill('synthetic-not-a-real-token');p.locator('[data-form=connect] [type=submit]').click();p.wait_for_function('()=>typeof syntheticRemoteRelease==="function"');p.locator('.sidebar [data-action=lock]').click();p.locator('[data-form=unlock]').wait_for();p.evaluate('syntheticRemoteRelease()');p.locator('[data-form=unlock]').wait_for();check('late GitHub response cannot reopen a locked session',not p.locator('.sidebar').is_visible());check('lock stops the next GitHub request',p.evaluate('syntheticWrites===0'))
 # Offline delivery leaves the accepted local edit dirty and available.
 unlock(p);p.evaluate("""()=>{HumanGithub.token('synthetic-not-a-real-token');HumanGithub.verify=async()=>{throw Error('Synthetic offline');};}""");add(p,'124/84');p.locator('#health-dialog [type=submit]').click();p.locator('#health-dialog').wait_for(state='hidden');p.get_by_text('Synthetic offline',exact=True).wait_for();check('offline sync keeps locally accepted edits',len(snapshot(p)['vitals'])==3 and p.evaluate('async()=>(await HumanStore.get(await HumanStore.current())).dirty'));check('offline sync does not issue a remote write',p.evaluate('syntheticWrites===0'))
 p.locator('.sidebar [data-action=lock]').click();p.locator('[data-form=unlock]').wait_for()
 # No create-only operation can overwrite an existing journal.
 check('create-only save rejects an existing vault',p.evaluate("""async()=>{const old=await HumanStore.get(await HumanStore.current());try{await HumanStore.save(old,null);return false;}catch{return true;}}"""))
 # A file still being read belongs only to the session that selected it.
 unlock(p);p.locator('.sidebar button[data-tab=document]').click();p.locator('[data-action=new-document]').first.click();p.locator('#health-dialog [name=file]').set_input_files({'name':'synthetic-delayed.txt','mimeType':'text/plain','buffer':b'Synthetic delayed source document'})
 p.evaluate("""()=>{const read=File.prototype.arrayBuffer;File.prototype.arrayBuffer=async function(){const result=await read.call(this);await new Promise(resolve=>window.syntheticFileRelease=()=>{File.prototype.arrayBuffer=read;resolve();});return result;};}""");p.locator('#health-dialog [type=submit]').click();p.wait_for_function('()=>typeof syntheticFileRelease==="function"');p.evaluate("document.querySelector('.sidebar [data-action=lock]').click()");p.locator('[data-action=open-demo]').click();p.locator('.health-demo-strip').wait_for();p.evaluate('syntheticFileRelease()');p.locator('.sidebar button[data-tab=document]').click();check('late file read cannot attach a previous profile file to demo','synthetic-delayed.txt' not in p.locator('#health-root').inner_text());check('cancelled file read leaves the real journal unchanged',snapshot(p)['documents']==[])
 p.locator('.sidebar [data-action=exit-demo]').click();p.locator('[data-form=unlock]').wait_for()
 # A delayed unlock cannot replace a demo explicitly opened in the meantime.
 p.evaluate("""()=>{const unlock=HumanCrypto.unlock;HumanCrypto.unlock=async(...args)=>{const result=await unlock(...args);await new Promise(resolve=>window.syntheticUnlockRelease=()=>{HumanCrypto.unlock=unlock;resolve();});return result;};}""");p.locator('[name=passphrase]').fill('synthetic-storage-passphrase');p.locator('[data-form=unlock] [type=submit]').click();p.wait_for_function('()=>typeof syntheticUnlockRelease==="function"');p.locator('[data-action=open-demo]').click();p.locator('.health-demo-strip').wait_for();p.evaluate('syntheticUnlockRelease()');check('late unlock cannot replace explicitly opened demo',p.locator('.health-demo-strip').count()==1 and 'Анна Примерова' in p.locator('.sidebar').inner_text())
 p.locator('.sidebar [data-action=exit-demo]').click();p.locator('[data-form=unlock]').wait_for();p.locator('[data-action=picker]').click();before=p.evaluate('async()=>(await HumanStore.list()).length')
 p.evaluate("""()=>{const create=HumanCrypto.create;HumanCrypto.create=async(...args)=>{const result=await create(...args);await new Promise(resolve=>window.syntheticCreateRelease=()=>{HumanCrypto.create=create;resolve();});return result;};}""");p.locator('[data-form=create] [name=password]').fill('synthetic-cancelled-profile');p.locator('[name=repeat]').fill('synthetic-cancelled-profile');p.locator('[data-form=create] [type=submit]').click();p.wait_for_function('()=>typeof syntheticCreateRelease==="function"');p.locator('[data-action=open-demo]').click();p.locator('.health-demo-strip').wait_for();p.evaluate('syntheticCreateRelease()');check('late create cannot select a profile over the demo',p.locator('.health-demo-strip').count()==1);check('cancelled create leaves existing vaults intact',p.evaluate('async()=>(await HumanStore.list()).length')==before)
 check('failure checks used no external requests',not remote);check('failure checks have no runtime errors',not errors);b.close()
print(len(checks),'storage checks PASS')
