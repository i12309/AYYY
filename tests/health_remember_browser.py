"""HUMAN temporary unlock: opt-in, reload, expiry, manual revoke and key rotation.

Run with the same local server fixture as the other browser tests. No GitHub calls,
real patient data, passphrases in repository archives or external requests.
"""
from pathlib import Path
from urllib.parse import urlsplit,unquote
import mimetypes
from playwright.sync_api import sync_playwright
from health_browser_support import launch_browser

ROOT=Path(__file__).resolve().parents[1]
BASE='http://127.0.0.1:8877/'
PHRASE='synthetic-temporary-passphrase'
NEXT='synthetic-rotated-passphrase'
SESSION='ayyy-human-unlock-lease-v1'

with sync_playwright() as pw:
    browser=launch_browser(pw)
    ctx=browser.new_context(viewport={'width':1440,'height':940})
    failures=[]
    def serve(route):
        if not route.request.url.startswith(BASE):
            failures.append('Unexpected remote URL: '+route.request.url)
            route.abort()
            return
        file=(ROOT/unquote(urlsplit(route.request.url).path).lstrip('/')).resolve()
        if file.is_dir():
            file=file/'index.html'
        if ROOT in file.parents and file.is_file():
            route.fulfill(body=file.read_bytes(),
                content_type=mimetypes.guess_type(file)[0] or 'text/plain')
        else:
            route.fulfill(status=404,body='missing')
    ctx.route('**/*',serve)
    p=ctx.new_page()
    p.on('pageerror',lambda e:failures.append(str(e)))
    p.on('dialog',lambda d:d.accept())
    p.goto(BASE+'health/')
    p.locator('[data-form=create]').wait_for()
    assert p.locator('.health-marketing').is_visible()
    assert 'Данные остаются под вашим контролем' in p.locator('.health-marketing').inner_text()
    assert '30 минут' in p.locator('[data-form=create]').inner_text()
    assert not p.locator('[data-form=create] [name=remember]').is_checked()
    create=p.locator('[data-form=create]')
    create.locator('[name=password]').fill(PHRASE)
    create.locator('[name=repeat]').fill(PHRASE)
    create.locator('[type=submit]').click()
    p.locator('.metric').first.wait_for()
    assert not p.evaluate('(k)=>sessionStorage.getItem(k)',SESSION)
    p.reload()
    p.locator('[data-form=unlock]').wait_for()
    print('PASS consent is disabled by default and reload requires the phrase',flush=True)

    unlock=p.locator('[data-form=unlock]')
    unlock.locator('[name=passphrase]').fill('synthetic-wrong-passphrase')
    unlock.locator('[name=remember]').check()
    unlock.locator('[type=submit]').click()
    p.get_by_text('Неверная фраза доступа либо повреждён архив.',exact=True).wait_for()
    assert not p.evaluate('(k)=>sessionStorage.getItem(k)',SESSION)
    print('PASS wrong passphrase never grants temporary access',flush=True)
    unlock.locator('[name=passphrase]').fill(PHRASE)
    unlock.locator('[type=submit]').click()
    p.locator('.metric').first.wait_for()
    p.wait_for_function('(key)=>!!sessionStorage.getItem(key)',arg=SESSION)
    assert p.evaluate("""async()=>{
      const request=indexedDB.open('ayyy-human-temporary-unlock-v1');
      const db=await new Promise(resolve=>request.onsuccess=()=>resolve(request.result));
      const tx=db.transaction('leases','readonly');
      const leases=tx.objectStore('leases').getAll();
      const entries=await new Promise(resolve=>leases.onsuccess=()=>resolve(leases.result));
      return entries.length===1&&entries[0].key.extractable===false&&
        entries[0].key.algorithm.name==='AES-GCM'&&
        !JSON.stringify(entries).includes('synthetic-temporary-passphrase');
    }""")
    p.reload()
    p.locator('.metric').first.wait_for()
    assert p.locator('[data-form=unlock]').count()==0
    # Leaving the module for another AYYY route should behave like reloading it.
    p.goto(BASE+'help/github/')
    p.get_by_text('GitHub',exact=False).first.wait_for()
    p.goto(BASE+'health/')
    p.locator('.metric').first.wait_for()
    assert p.locator('[data-form=unlock]').count()==0
    print('PASS consent permits reload and same-tab return without typing the phrase',flush=True)

    p.locator('.sidebar [data-action=lock]').click()
    p.locator('[data-form=unlock]').wait_for()
    assert not p.evaluate('(k)=>sessionStorage.getItem(k)',SESSION)
    p.reload()
    p.locator('[data-form=unlock]').wait_for()
    print('PASS explicit lock revokes the remembered key',flush=True)

    unlock=p.locator('[data-form=unlock]')
    unlock.locator('[name=passphrase]').fill(PHRASE)
    unlock.locator('[name=remember]').check()
    unlock.locator('[type=submit]').click()
    p.locator('.metric').first.wait_for()
    p.wait_for_function('(key)=>!!sessionStorage.getItem(key)',arg=SESSION)
    # Simulate 31 minutes without sleeping.
    p.evaluate("""key=>{
      const lease=JSON.parse(sessionStorage.getItem(key));
      lease.expiresAt=Date.now()-60_000;
      sessionStorage.setItem(key,JSON.stringify(lease));
    }""",SESSION)
    p.reload()
    p.locator('[data-form=unlock]').wait_for()
    assert not p.evaluate('(k)=>sessionStorage.getItem(k)',SESSION)
    print('PASS expired temporary access does not auto-open the vault',flush=True)

    unlock=p.locator('[data-form=unlock]')
    unlock.locator('[name=passphrase]').fill(PHRASE)
    unlock.locator('[name=remember]').check()
    unlock.locator('[type=submit]').click()
    p.locator('.metric').first.wait_for()
    p.wait_for_function('(key)=>!!sessionStorage.getItem(key)',arg=SESSION)
    p.locator('.profile-entry').click()
    p.locator('[data-action=change-passphrase]').click()
    form=p.locator('[data-form=change-passphrase]')
    form.locator('[name=current]').fill(PHRASE)
    form.locator('[name=next]').fill(NEXT)
    form.locator('[name=repeat]').fill(NEXT)
    form.locator('[type=submit]').click()
    p.locator('#health-dialog').wait_for(state='hidden')
    assert not p.evaluate('(k)=>sessionStorage.getItem(k)',SESSION)
    p.reload()
    p.locator('[data-form=unlock]').wait_for()
    p.locator('[data-form=unlock] [name=passphrase]').fill(NEXT)
    p.locator('[data-form=unlock] [name=remember]').check()
    p.locator('[data-form=unlock] [type=submit]').click()
    p.locator('.metric').first.wait_for()
    p.wait_for_function('(key)=>!!sessionStorage.getItem(key)',arg=SESSION)
    p.locator('.profile-entry').click()
    p.locator('.health-remember-status').wait_for()
    p.locator('[data-action=forget-remember]').click()
    assert not p.evaluate('(k)=>sessionStorage.getItem(k)',SESSION)
    p.reload()
    p.locator('[data-form=unlock]').wait_for()
    print('PASS changing the phrase and the profile revoke control both work',flush=True)

    assert not failures,failures
    ctx.close()
    browser.close()
