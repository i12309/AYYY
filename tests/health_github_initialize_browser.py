"""Offline HUMAN UI regression: connect an existing GitHub repository without a vault."""
from pathlib import Path
from urllib.parse import urlsplit,unquote
import mimetypes
from playwright.sync_api import sync_playwright
from health_browser_support import launch_browser

ROOT=Path(__file__).resolve().parents[1]
BASE='http://127.0.0.1:8877/'
PHRASE='synthetic-new-health-passphrase'

with sync_playwright() as pw:
    browser=launch_browser(pw)
    context=browser.new_context(viewport={'width':1440,'height':900})
    errors=[]
    def serve(route):
        if not route.request.url.startswith(BASE):
            route.abort()
            return
        name=unquote(urlsplit(route.request.url).path).lstrip('/') or 'index.html'
        file=(ROOT/name).resolve()
        if file.is_dir():
            file=file/'index.html'
        if ROOT in file.parents and file.is_file():
            route.fulfill(body=file.read_bytes(),
                content_type=mimetypes.guess_type(file)[0] or 'text/plain')
        else:
            route.fulfill(status=404,body='missing')
    context.route('**/*',serve)
    page=context.new_page()
    page.on('pageerror',lambda error:errors.append(str(error)))
    page.goto(BASE+'health/')
    page.locator('[data-form=create]').wait_for()
    assert 'Фраза шифрования' in page.locator('[data-form=create]').inner_text()
    assert page.locator('[data-form=download]').count()==0
    page.locator('[data-action=onboarding-tab][data-mode=github]').click()
    page.locator('[data-form=download]').wait_for()
    assert page.locator('[data-form=create]').count()==0

    # The transport is mocked; the test does not read tokens or contact GitHub.
    page.evaluate("""() => {
      window.syntheticWrites=0;
      HumanGithub.verify=async()=>true;
      HumanGithub.read=async()=>null;
      HumanGithub.write=async()=>{window.syntheticWrites++;return 'a'.repeat(40)};
    }""")

    def connect():
        form=page.locator('[data-form=download]')
        form.locator('[name=repo]').fill('https://github.com/example/TEST_TREE.git')
        form.locator('[name=branch]').fill('main')
        form.locator('[name=token]').fill('synthetic-invalid-token')
        form.locator('[type=submit]').click()
        page.locator('[data-form=initialize-remote]').wait_for()
        assert 'В репозитории пока нет журнала' in page.locator('.health-github-setup').inner_text()
        assert page.locator('.health-onboarding [role=tabpanel]').count()==1
        assert page.locator('[data-action=onboarding-tab][data-mode=github]').get_attribute('aria-selected')=='true'
        assert page.locator('[data-form=create]').count()==0
        assert page.locator('[data-form=download]').count()==0

    connect()
    assert page.evaluate('HumanGithub.hasToken()')
    page.locator('[data-action=cancel-remote-setup]').click()
    page.locator('[data-form=download]').wait_for()
    assert not page.evaluate('HumanGithub.hasToken()')
    assert page.evaluate('window.syntheticWrites===0')

    connect()
    new=page.locator('[data-form=initialize-remote]')
    new.locator('[name=password]').fill(PHRASE)
    new.locator('[name=repeat]').fill(PHRASE+'-typo')
    new.locator('[type=submit]').click()
    assert page.evaluate('window.syntheticWrites===0')
    new.locator('[name=repeat]').fill(PHRASE)
    new.locator('[type=submit]').click()
    page.locator('.metric').first.wait_for()
    assert page.evaluate('window.syntheticWrites===1')
    record=page.evaluate("""async() => {
      const data=await HumanStore.get(await HumanStore.current());
      return {repo:data.repo,dirty:data.dirty,remoteSha:data.remoteSha,
        lastSyncAt:data.lastSyncAt,format:data.envelope.format};
    }""")
    assert record['repo']=={'owner':'example','repo':'TEST_TREE','branch':'main'},record
    assert not record['dirty'] and record['remoteSha']=='a'*40
    assert record['lastSyncAt'] and record['format']=='ayyy-health-v2'
    assert 'проверено записью' in page.locator('#health-notice').inner_text()

    page.reload()
    page.locator('[data-form=unlock]').wait_for()
    page.locator('[data-form=unlock] [name=passphrase]').fill(PHRASE)
    page.locator('[data-form=unlock] [type=submit]').click()
    page.locator('.metric').first.wait_for()
    assert not errors,errors
    browser.close()
    print('PASS HUMAN initializes an absent GitHub vault, keeps local encrypted data and reopens after reload',flush=True)
