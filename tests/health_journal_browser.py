"""Synthetic current profile, timeline, backup restore and atomic passphrase changes."""
from pathlib import Path
from urllib.parse import urlsplit
import mimetypes
import os
from playwright.sync_api import sync_playwright
from health_browser_support import fill_home_value

ROOT=Path(__file__).resolve().parents[1];BASE='http://localhost:8877/';checks=[]
ENGINE=os.getenv('HEALTH_BROWSER','chromium')
OLD='synthetic-journal-original';NEW='synthetic-journal-changed'
def check(label,result):
 assert result,label
 checks.append(label);print('PASS',label,flush=True)

with sync_playwright() as pw:
 b=getattr(pw,ENGINE).launch();errors=[];remote=[]
 def context():
  c=b.new_context(viewport={'width':1440,'height':1000})
  def serve(route):
   if not route.request.url.startswith(BASE):remote.append(route.request.url);route.abort();return
   file=(ROOT/urlsplit(route.request.url).path.lstrip('/')).resolve()
   if file.is_dir():file=file/'index.html'
   if ROOT in file.parents and file.is_file():route.fulfill(body=file.read_bytes(),content_type=mimetypes.guess_type(file)[0] or 'text/plain')
   else:route.fulfill(status=404,body='Missing')
  c.route('**/*',serve);return c
 def page(c):
  p=c.new_page();p.on('pageerror',lambda e:errors.append(str(e)));p.on('dialog',lambda d:d.accept());p.goto(BASE+'health/');return p
 def snap(p,phrase=OLD):return p.evaluate("""async phrase=>{const local=await HumanStore.get(await HumanStore.current());return (await HumanCrypto.unlock(local.envelope,phrase)).doc;}""",phrase)
 def stored(p):return p.evaluate('async()=>await HumanStore.get(await HumanStore.current())')
 def original_bytes(p,phrase=OLD):
  return bytes(p.evaluate("""async phrase=>{
    const entry=await HumanStore.get(await HumanStore.current());
    const {doc,key}=await HumanCrypto.unlock(entry.envelope,phrase),file=doc.documents[0];
    const object=await HumanStore.getObject(doc.id,file.objectId);
    return Array.from(await HumanCrypto.openFile(doc.id,file,object,key));
  }""",phrase))
 def tab(p,name):p.locator('.sidebar button[data-tab='+name+']').click()
 def fill(p,name,value):
  if name=='value' and '/' in value:fill_home_value(p,value)
  else:p.locator('#health-dialog [name='+name+']').fill(value)
 def submit(p):p.locator('#health-dialog [type=submit]').click()
 def save(p):submit(p);p.locator('#health-dialog').wait_for(state='hidden')
 def close(p):p.locator('#health-dialog [data-action=close-dialog]').click();p.locator('#health-dialog').wait_for(state='hidden')
 def unlock(p,phrase=OLD):p.locator('[data-form=unlock] [name=passphrase]').fill(phrase);p.locator('[data-form=unlock] [type=submit]').click();p.locator('.metric').first.wait_for()
 def restore(p,payload):
  p.locator('[data-form=import-vault] [name=file]').set_input_files({'name':'synthetic-current.human','mimeType':'application/octet-stream','buffer':payload});p.locator('[data-form=import-vault] [type=submit]').click()
 def rotate(p,current=OLD,new=NEW):
  tab(p,'profile');p.locator('[data-action=change-passphrase]').click();fill(p,'current',current);fill(p,'next',new);fill(p,'repeat',new)
 ctx=context();p=page(ctx);p.locator('[data-form=create] [name=password]').fill(OLD);p.locator('[name=repeat]').fill(OLD);p.locator('[data-form=create] [type=submit]').click();p.locator('.metric').first.wait_for()
 p.locator('.profile-entry').click();check('sidebar profile opens native profile cards',p.locator('.profile-page .settings').count()==1 and p.locator('.profile-panel-github').count()==1 and p.locator('.profile-panel-backups').count()==1 and p.locator('.profile-page [data-tab=medical]').count()==0)
 p.locator('[data-action=edit-profile]').click();check('unknown age hides adult height input',not p.locator('[name=heightCm]').is_visible());fill(p,'name','Synthetic Profile');fill(p,'birthDate','2000-01-01');fill(p,'timezone','Europe/Moscow');check('adult birthday exposes height input',p.locator('[name=heightCm]').is_visible());fill(p,'heightCm','170,5');fill(p,'notes','<script>Synthetic note</script>');save(p)
 d=snap(p);check('profile persists fractional height and notes as text',d['profile']['heightCm']==170.5 and p.locator('.profile-page script').count()==0 and '<script>Synthetic note</script>' in p.locator('.profile-page').inner_text());check('profile save creates an action-history event',d['timeline'][-1]['kind']=='profile')
 p.locator('[data-action=edit-profile]').click();fill(p,'birthDate','2015-01-01');check('child age hides and disables fixed height',not p.locator('[name=heightCm]').is_visible() and p.locator('[name=heightCm]').is_disabled());save(p);check('child profile retains hidden height and links to dated measurements',snap(p)['profile']['heightCm']==170.5 and p.locator('[data-action=profile-growth]').count()==1)
 p.locator('[data-action=profile-growth]').click();check('growth history opens measurements',p.locator('.health-vital-summary').count()==1)
 p.locator('.profile-entry').click();p.locator('[data-action=edit-profile]').click();before=stored(p);fill(p,'timezone','Invalid/Zone');submit(p);p.locator('[data-form-error]').wait_for();check('invalid profile stays reviewable without a write',stored(p)==before and p.locator('[name=timezone]').input_value()=='Invalid/Zone');close(p)
 for width in [360,390,768,1440]:
  p.set_viewport_size({'width':width,'height':900});check('profile cards fit '+str(width),p.evaluate('document.documentElement.scrollWidth<=innerWidth'))
  if width in [390,1440] and ENGINE=='chromium':p.locator('#health-notice').evaluate('(e)=>e.classList.remove("show")');p.screenshot(path=str(ROOT/f'docs/health-ui/profile-{width}.png'),full_page=True)
 p.set_viewport_size({'width':1440,'height':1000});tab(p,'document');p.locator('[data-action=new-document]').first.click();source=b'Synthetic backup attachment\n';p.locator('#health-dialog [name=file]').set_input_files({'name':'synthetic-backup.txt','mimeType':'text/plain','buffer':source});save(p)
 tab(p,'vital');p.locator('.health-vital-summary [data-action=new-vital]').click();p.locator('#health-dialog [name=type]').select_option('Давление');fill(p,'value','120/80');save(p);tab(p,'timeline');check('timeline contains actual new actions',p.locator('.timeline li').count()==4);p.locator('[data-timeline-kind]').select_option('document');check('timeline kind filters without altering stored actions',p.locator('.timeline li').count()==1 and len(snap(p)['timeline'])==4);p.locator('.timeline-open').click();p.locator('.health-document-preview').wait_for();check('document event opens its original file','Synthetic backup attachment' in p.locator('#health-dialog').inner_text());close(p)
 tab(p,'timeline');p.locator('[data-timeline-kind]').select_option('');p.locator('[data-search=timeline]').fill('Synthetic Profile');check('timeline search filters by recorded title',p.locator('.timeline li').count()==0);p.locator('[data-search=timeline]').fill('')
 for width in [360,390,768,1440]:
  p.set_viewport_size({'width':width,'height':900});check('timeline fits '+str(width),p.evaluate('document.documentElement.scrollWidth<=innerWidth'))
  if width in [390,1440] and ENGINE=='chromium':p.locator('#health-notice').evaluate('(e)=>e.classList.remove("show")');p.screenshot(path=str(ROOT/f'docs/health-ui/timeline-{width}.png'),full_page=True)
 p.set_viewport_size({'width':1440,'height':1000});p.reload();unlock(p);tab(p,'timeline');check('action history survives encrypted reload',p.locator('.timeline li').count()==4)
 # A real browser download is then restored in an independent browser context.
 tab(p,'profile')
 with p.expect_download() as download:p.locator('[data-action=backup]').first.click()
 backup=Path(download.value.path()).read_bytes();original=stored(p)
 check('download contains ciphertext without personal field names',b'ciphertext' in backup and b'Synthetic Profile' not in backup and source not in backup and b'synthetic-backup.txt' not in backup)
 other=context();q=page(other);restore(q,backup);fill(q,'passphrase','synthetic-wrong-phrase');submit(q);q.locator('[data-form-error]').wait_for();check('wrong backup phrase cannot create or select any vault',q.evaluate('async()=>(await HumanStore.list()).length')==0 and q.evaluate('async()=>await HumanStore.current()') is None)
 fill(q,'passphrase',OLD);submit(q);q.locator('[data-form=restore-confirm]').wait_for();check('decrypted backup is reviewable before any write',q.evaluate('async()=>(await HumanStore.list()).length')==0 and 'Synthetic Profile' in q.locator('#health-dialog').inner_text());q.evaluate("""()=>{window.syntheticPut=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(...args){if(this.name==='meta')throw new DOMException('Synthetic restore selection failure','QuotaExceededError');return syntheticPut.apply(this,args);};}""");submit(q);q.locator('[data-form-error]').wait_for();check('failed restore selection rolls back the new vault',q.evaluate('async()=>(await HumanStore.list()).length')==0 and q.evaluate('async()=>await HumanStore.current()') is None);q.evaluate('()=>{IDBObjectStore.prototype.put=syntheticPut;}');save(q);restored=snap(q);check('backup restores the current profile and exact attached bytes',restored['profile']==snap(p)['profile'] and original_bytes(q)==source and 'data' not in restored['documents'][0] and len(restored['timeline'])==5);check('restore has no implicit GitHub connection',stored(q)['repo'] is None)
 tab(q,'profile')
 with q.expect_file_chooser() as chooser:q.locator('[data-action=restore-file]').click()
 chooser.value.set_files({'name':'synthetic-current.human','mimeType':'application/octet-stream','buffer':backup});fill(q,'passphrase',OLD);submit(q);q.locator('[data-form=restore-confirm]').wait_for();check('duplicate restore explicitly offers a separate copy','отдельная копия' in q.locator('#health-dialog').inner_text());old_id=restored['id'];save(q);check('duplicate restore preserves the original and gives the copy a new vault id',snap(q)['id']!=old_id and q.evaluate('async()=>(await HumanStore.list()).length')==2 and q.evaluate('async id=>!!(await HumanStore.get(id))',old_id) and original_bytes(q)==source)
 # A corrupted encrypted file is rejected before storage, even with the right phrase.
 bad=context();r=page(bad);tampered=backup[:-1]+bytes([backup[-1]^1]);restore(r,tampered);fill(r,'passphrase',OLD);submit(r);r.locator('[data-form-error]').wait_for();check('tampered backup never reaches IndexedDB',r.evaluate('async()=>(await HumanStore.list()).length')==0);close(r);bad.close()
 # Authentication or storage failures cannot partially rotate encryption.
 rotate(p,current='synthetic-wrong-phrase');submit(p);p.locator('[data-form-error]').wait_for();check('wrong current phrase preserves original envelope',stored(p)==original);fill(p,'current',OLD)
 p.evaluate("""()=>{window.syntheticPut=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(...args){if(this.name==='vaults')throw new DOMException('Synthetic quota failure','QuotaExceededError');return syntheticPut.apply(this,args);};}""");submit(p);p.locator('[data-form-error]').wait_for();check('failed passphrase save rolls back and keeps the form',stored(p)==original and p.locator('[name=next]').input_value()==NEW);p.evaluate('()=>{IDBObjectStore.prototype.put=syntheticPut;}')
 peer=page(ctx);unlock(peer);save(p);peer.locator('[data-form=unlock]').wait_for();changed=stored(p);newdoc=snap(p,NEW);check('successful rekey keeps vault id, records and attachment',newdoc['id']==original['id'] and newdoc['documents'][0]['objectId']!=restored['documents'][0]['objectId'] and original_bytes(p,NEW)==source and newdoc['vitals']==restored['vitals']);check('rekey replaces salt and IV atomically',changed['envelope']['salt']!=original['envelope']['salt'] and changed['envelope']['iv']!=original['envelope']['iv']);check('rekey locks another open tab and records the security action',peer.locator('[data-form=unlock]').is_visible() and newdoc['timeline'][-1]['kind']=='security');check('closed dialog clears phrase fields from DOM',p.locator('#health-dialog input[type=password]').count()==0)
 check('old phrase cannot decrypt the newly encrypted journal',p.evaluate("""async phrase=>{try{await HumanCrypto.unlock((await HumanStore.get(await HumanStore.current())).envelope,phrase);return false;}catch{return true;}}""",OLD));check('downloaded original backup keeps its original phrase',p.evaluate("""async ({backup,phrase})=>{
   const archive=await HumanBackup.open(new Blob([new Uint8Array(backup)]));
   const {doc,key}=await HumanCrypto.unlock(archive.envelope,phrase),file=doc.documents[0];
   const bytes=await HumanCrypto.openFile(doc.id,file,await archive.readObject(file.objectId),key);
   return doc.id===archive.envelope.vaultId&&bytes.length===file.size;
 }""",{'backup':list(backup),'phrase':OLD}))
 p.reload();unlock(p,NEW);check('new phrase works after reload',original_bytes(p,NEW)==source)
 # The journal may be locked while expensive key derivation/encryption is in flight.
 rotate(p,current=NEW,new='synthetic-third-passphrase');p.evaluate("""()=>{const newKey=HumanCrypto.newKey;HumanCrypto.newKey=async(...args)=>{const result=await newKey(...args);await new Promise(resolve=>window.syntheticRelease=()=>{HumanCrypto.newKey=newKey;resolve();});return result;};}""");submit(p);p.wait_for_function('()=>typeof syntheticRelease==="function"');p.evaluate("document.querySelector('.sidebar [data-action=lock]').click()");p.locator('[data-form=unlock]').wait_for();p.evaluate('syntheticRelease()');p.wait_for_function('()=>!document.querySelector("#health-dialog form")');check('locking during rekey cancels the pending save and never reopens the journal',stored(p)==changed and p.locator('[data-form=unlock]').is_visible());unlock(p,NEW)
 # Real event navigation, deleted-source history and bounded pagination.
 tab(p,'timeline');p.locator('[data-timeline-kind]').select_option('health_created');p.locator('.timeline-open').click();check('measurement event opens its original recorded detail',p.locator('.health-details').count()==1 and '120/80' in p.locator('.health-details').inner_text())
 tab(p,'document');p.locator('.documents-table [data-action=remove]').click();p.locator('.documents-table [data-action=remove]').wait_for(state='hidden');tab(p,'timeline');p.locator('[data-timeline-kind]').select_option('document');p.locator('.timeline-open').click();check('deleted document event retains history without resurrecting its file','Запись удалена' in p.locator('#health-dialog').inner_text() and snap(p,NEW)['documents']==[]);close(p)
 p.evaluate("""async phrase=>{const local=await HumanStore.get(await HumanStore.current()),{doc,key}=await HumanCrypto.unlock(local.envelope,phrase);for(let i=0;i<45;i++)doc.timeline.push(HumanJournal.event('profile',doc.profile,'edit',new Date(1700000000000+i)));const envelope=await HumanCrypto.seal(doc,key,local.envelope);await HumanStore.save({...local,envelope,dirty:true},local);}""",NEW);p.reload();unlock(p,NEW);tab(p,'timeline');check('timeline limits a page to 50 actions',p.locator('.timeline li').count()==50);p.locator('[data-action=timeline-page][data-offset="50"]').click();check('next timeline page shows the remaining action',p.locator('.timeline li').count()==1);p.locator('[data-timeline-kind]').select_option('security');check('timeline filtering resets pagination',p.locator('.timeline li').count()==1 and 'Фраза доступа изменена' in p.locator('.timeline').inner_text())
 p.locator('.sidebar [data-action=lock]').click();p.locator('[data-action=picker]').click();p.locator('[data-form=create] [name=password]').fill('synthetic-isolated-journal');p.locator('[name=repeat]').fill('synthetic-isolated-journal');p.locator('[data-form=create] [type=submit]').click();p.locator('.metric').first.wait_for();tab(p,'timeline');check('new profile has an empty history and cleared filters',p.locator('.timeline li').count()==0 and p.locator('[data-timeline-kind]').input_value()=='')
 check('journal tests made no external requests',not remote);check('journal tests have no runtime errors',not errors);b.close()
print(len(checks),'journal checks PASS')
