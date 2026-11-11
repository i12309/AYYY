"""Synthetic browser tests for encrypted, device-local import checkpoints."""
from pathlib import Path
from tempfile import TemporaryDirectory
from urllib.parse import urlsplit
import mimetypes

from playwright.sync_api import sync_playwright
from health_browser_support import launch_browser

ROOT=Path(__file__).resolve().parents[1]
BASE='http://localhost:8877/'
OLD='synthetic-local-draft-old'
NEW='synthetic-local-draft-new'
SOURCE=b'name;value;date;unit\nSynthetic first draft marker;15;2026-10-06;mg'
NEXT=b'name;value;date;unit\nSynthetic waiting draft marker;18;2026-10-07;mg'


def run(browser, directory):
    context=browser.new_context(viewport={'width':1440,'height':900})
    remote,errors=[],[]

    def serve(route):
        url=route.request.url
        if not url.startswith(BASE):
            remote.append(url)
            route.abort()
            return
        if url==BASE+'synthetic-old-store':
            route.fulfill(content_type='text/html',body='<!doctype html><title>Synthetic store setup</title>')
            return
        file=(ROOT/urlsplit(url).path.lstrip('/')).resolve()
        if file.is_dir():file/='index.html'
        if ROOT in file.parents and file.is_file():
            route.fulfill(body=file.read_bytes(),content_type=mimetypes.guess_type(file)[0] or 'application/octet-stream')
        else:route.fulfill(status=404,body='Missing')

    context.route('**/*',serve)

    def page():
        instance=context.new_page()
        instance.on('pageerror',lambda error:errors.append(str(error)))
        instance.on('dialog',lambda dialog:dialog.accept())
        return instance

    def unlock(instance,phrase):
        form=instance.locator('[data-form=unlock]')
        form.locator('[name=passphrase]').fill(phrase)
        form.locator('[type=submit]').click()
        instance.locator('.metric').first.wait_for()

    def lab(instance):instance.locator('.sidebar button[data-tab=lab]').click()
    def close(instance):instance.locator('[data-action=close-import]').click()
    def resume(instance):instance.locator('[data-action=open-import-draft]').click()
    def entry(instance,name):return instance.locator('.health-import-queue li').filter(has=instance.get_by_text(name,exact=True))
    def review(instance):return instance.locator('[data-form=document-review]')
    def confirm_review(instance):
        review(instance).locator('[name=profileConfirmed]').check()
        review(instance).locator('[type=submit]').click()

    def checkpoint(instance):
        instance.locator('[data-action=save-import-draft]').click()
        instance.get_by_text('Черновик зашифрован и сохранён на этом устройстве.',exact=True).wait_for()

    p=page()
    p.goto(BASE+'synthetic-old-store')
    p.add_script_tag(url=BASE+'health/crypto.js')
    p.evaluate('''async phrase=>{
      const created=await HumanCrypto.create(phrase);
      const request=indexedDB.open(HumanCrypto.FORMAT,1);
      request.onupgradeneeded=()=>{
       const db=request.result;
       db.createObjectStore('vaults',{keyPath:'id'});
       db.createObjectStore('meta');
       db.createObjectStore('objects',{keyPath:['vaultId','id']}).createIndex('vault','vaultId');
      };
      const db=await new Promise((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
      const tx=db.transaction(['vaults','meta'],'readwrite');
      tx.objectStore('vaults').put({id:created.doc.id,envelope:created.envelope,dirty:true});
      tx.objectStore('meta').put(created.doc.id,'current');
      await new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});db.close();
    }''',OLD)
    p.goto(BASE+'health/');unlock(p,OLD);lab(p)
    panel=directory/'synthetic-panel'
    first_path='synthetic-panel/first/pending.csv'
    next_path='synthetic-panel/nested/later/pending.csv'
    for path,contents in [(first_path,SOURCE),(next_path,NEXT),('synthetic-panel/ignored/readme.txt',b'Not an import document')]:
        file=directory/path
        file.parent.mkdir(parents=True,exist_ok=True)
        file.write_bytes(contents)
    with p.expect_file_chooser() as choose:p.locator('[data-action=import-folder]').click()
    assert choose.value.element.get_attribute('webkitdirectory') is not None
    choose.value.set_files(panel/'ignored')
    p.get_by_text('В папке нет файлов PDF, XLSX, CSV, PNG или JPEG.',exact=True).wait_for()
    assert not p.locator('#health-import-page').is_visible()
    with p.expect_file_chooser() as choose:p.locator('[data-action=import-folder]').click()
    choose.value.set_files(panel)
    p.get_by_text('Пропущено файлов неподдерживаемых форматов: 1',exact=True).wait_for()
    assert p.locator('.health-import-queue li').count()==2
    assert entry(p,next_path).count()==1
    entry(p,first_path).locator('[data-action=import-open-file]').click()
    p.locator('[data-form=document-mapping] [type=submit]').click()
    review(p).locator('[name="0:value"]').fill('15.25')
    review(p).locator('[name=selected]').uncheck()
    p.set_viewport_size({'width':390,'height':840})
    assert p.locator('[data-action=save-import-draft]').is_visible()
    assert p.locator('#health-import-page').evaluate('(page)=>page.scrollWidth<=page.clientWidth')
    checkpoint(p)
    p.set_viewport_size({'width':1440,'height':900})
    proof=p.evaluate('''async phrase=>{
      const id=await HumanStore.current(),draft=await HumanStore.importDraft(id),vault=await HumanStore.snapshot(id);
      const plain=await HumanCrypto.unlock(vault.envelope,phrase),objects=[draft.metadata,...draft.files.map(file=>file.bytes)];
      draft.files[0].bytes[15]^=1;
      const rejected=await HumanImportDraft.open(draft,plain.key).then(()=>false,()=>true);
      return {encrypted:objects.every(bytes=>bytes instanceof Uint8Array&&!/Synthetic|synthetic-panel/.test(new TextDecoder().decode(bytes))),rejected,
        files:draft.files.length, count:plain.doc.observations.length, attachments:vault.objects.length,
        noNames:!Object.keys(draft).includes('entries')&&!Object.keys(draft.files[0]).includes('name'),salt:draft.salt};
    }''',OLD)
    assert proof['encrypted'] and proof['rejected'] and proof['noNames'] and proof['files']==2 and proof['count']==proof['attachments']==0,proof
    review(p).locator('[name="0:value"]').fill('15.50')
    p.get_by_role('tab',name=next_path,exact=True).click()
    p.locator('[data-form=document-mapping]').wait_for()
    p.reload();unlock(p,OLD);lab(p);resume(p)
    p.get_by_role('tab',name=first_path,exact=True).click()
    assert review(p).locator('[name="0:value"]').input_value()=='15.50' and not review(p).locator('[name=selected]').is_checked()
    print('PASS switching updates the encrypted checkpoint and retains relative paths and edits after reload',flush=True)

    peer=page();peer.goto(BASE+'health/');unlock(peer,OLD);lab(peer);resume(peer)
    entry(peer,first_path).locator('[data-action=import-open-file]').click()
    review(peer).locator('[name="0:value"]').fill('15.75');review(peer).locator('[name=selected]').check();checkpoint(peer)
    review(p).locator('[name="0:value"]').fill('999')
    p.locator('[data-action=save-import-draft]').click()
    p.get_by_text('Черновик изменился в другом окне. Откройте сохранённый черновик заново.',exact=True).wait_for()
    close(p);peer.close()
    print('PASS concurrent edits cannot overwrite a newer checkpoint',flush=True)

    p.locator('.sidebar button[data-tab=settings]').click()
    p.locator('[data-action=change-passphrase]').click()
    form=p.locator('[data-form=change-passphrase]')
    for name,value in [('current',OLD),('next',NEW),('repeat',NEW)]:form.locator(f'[name={name}]').fill(value)
    form.locator('[type=submit]').click();p.get_by_text('Журнал зашифрован новой фразой доступа.',exact=True).wait_for()
    salt=p.evaluate('async()=>(await HumanStore.importDraft(await HumanStore.current())).salt')
    assert salt!=proof['salt']
    p.reload();unlock(p,NEW);lab(p);resume(p)
    entry(p,first_path).locator('[data-action=import-open-file]').click()
    assert review(p).locator('[name="0:value"]').input_value()=='15.75' and review(p).locator('[name=selected]').is_checked()
    confirm_review(p);p.get_by_text('Сохранено результатов: 1',exact=True).wait_for()
    entry(p,next_path).locator('[data-action=import-open-file]').click()
    p.locator('[data-form=document-mapping] [type=submit]').click()
    assert not review(p).locator('[name=profileConfirmed]').is_checked() and review(p).locator('[type=submit]').is_disabled()
    close(p)
    resume(p)
    mapping=p.locator('[data-form=document-mapping]')
    assert next_path in mapping.inner_text() and first_path not in mapping.inner_text()
    mapping.locator('[type=submit]').click();confirm_review(p);p.locator('#health-import-page').wait_for(state='hidden')
    assert p.evaluate('async()=>!(await HumanStore.importDraft(await HumanStore.current()))')
    assert p.locator('.group-name').filter(has_text='Synthetic waiting draft marker').count()==1
    assert p.evaluate('''async phrase=>{
      const {envelope}=await HumanStore.snapshot(await HumanStore.current());
      const {doc}=await HumanCrypto.unlock(envelope,phrase);
      return doc.documents.length===2&&doc.documents.every(file=>file.name==='pending.csv')&&
        !JSON.stringify(doc).includes('synthetic-panel');
    }''',NEW)
    print('PASS rekey preserves the latest edits and successful imports remove only their completed files',flush=True)

    partial=b'name;value;date;unit\nSynthetic accepted marker;10;2026-10-06;mg\nSynthetic pending marker;20;2026-10-06;mg'
    with p.expect_file_chooser() as choose:p.locator('[data-action=csv]').click()
    choose.value.set_files({'name':'partial.csv','mimeType':'text/csv','buffer':partial})
    checkpoint(p)
    draft_state='''async()=>{
      const draft=await HumanStore.importDraft(await HumanStore.current());
      const hash=new Uint8Array(await crypto.subtle.digest('SHA-256',draft.files[0].bytes));
      return {revision:draft.revision,hash:Array.from(hash)};
    }'''
    before=p.evaluate(draft_state)
    mapping.locator('[type=submit]').click()
    review(p).locator('[name=selected]').last.uncheck()
    review(p).locator('[name="1:value"]').fill('20.25')
    confirm_review(p)
    p.get_by_text('Сохранено результатов: 1 · Осталось строк: 1',exact=True).wait_for()
    after=p.evaluate(draft_state)
    assert before['revision']!=after['revision'] and before['hash']==after['hash']
    p.reload();unlock(p,NEW);lab(p);resume(p)
    assert review(p).locator('[name=selected]').first.is_disabled() and not review(p).locator('[name=selected]').last.is_checked()
    assert not review(p).locator('[name=profileConfirmed]').is_checked()
    assert review(p).locator('[name="1:value"]').input_value()=='20.25'
    assert p.locator('.group-name').filter(has_text='Synthetic pending marker').count()==0
    review(p).locator('[name=selected]').last.check();confirm_review(p)
    p.locator('#health-import-page').wait_for(state='hidden')
    assert p.evaluate('async()=>!(await HumanStore.importDraft(await HumanStore.current()))')
    assert p.locator('.group-name').filter(has_text='Synthetic accepted marker').count()==1
    assert p.locator('.group-name').filter(has_text='Synthetic pending marker').count()==1
    print('PASS partial confirmation updates the encrypted checkpoint and retains unsaved edits without re-encrypting the file',flush=True)

    with p.expect_file_chooser() as choose:p.locator('[data-action=csv]').click()
    choose.value.set_files({'name':'delete-draft.csv','mimeType':'text/csv','buffer':SOURCE})
    mapping.locator('[name=date]').select_option('-1')
    mapping.locator('[name=fallbackDate]').fill('2026-10-08')
    checkpoint(p);close(p);resume(p)
    assert mapping.locator('[name=date]').input_value()=='-1' and mapping.locator('[name=fallbackDate]').input_value()=='2026-10-08'
    p.locator('[data-action=discard-import-draft]').click()
    p.get_by_text('Сохранённый черновик удалён.',exact=True).wait_for()
    assert p.evaluate('async()=>!(await HumanStore.importDraft(await HumanStore.current()))') and mapping.is_visible()
    checkpoint(p)
    p.locator('.sidebar button[data-tab=overview]').click()
    p.locator('.sidebar [data-action=lock]').click()
    assert not p.locator('#health-import-page').count()
    unlock(p,NEW);lab(p)
    assert not p.locator('[data-action=continue-import]').count()
    resume(p)
    assert mapping.locator('[name=fallbackDate]').input_value()=='2026-10-08'
    close(p)
    assert p.evaluate('''async()=>{
      const id=await HumanStore.current(),local=await HumanStore.get(id);
      await HumanStore.remove(id,local.envelope);
      return !(await HumanStore.importDraft(id));
    }''')
    assert not remote and not errors,(remote,errors)
    print('PASS deleting the local journal deletes its draft and produces no external requests',flush=True)
    context.close()


with TemporaryDirectory() as directory, sync_playwright() as playwright:
    browser=launch_browser(playwright)
    run(browser, Path(directory))
    browser.close()
