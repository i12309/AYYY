"""Crash a dedicated Chromium process and reopen the same synthetic journal."""
from contextlib import contextmanager
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from tempfile import TemporaryDirectory
from threading import Thread
import os
import signal
import subprocess
import time

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OLD = 'synthetic-original-crash-phrase'
NEW = 'synthetic-rotated-crash-phrase'
FILES = {
    'before.txt': b'Synthetic document before the operation.\n',
    'after.txt': b'Synthetic document accepted after retry.\n',
}


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_):
        pass


@contextmanager
def serve():
    with ThreadingHTTPServer(('127.0.0.1', 0), partial(QuietHandler, directory=ROOT)) as server:
        thread = Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            yield f'http://127.0.0.1:{server.server_port}/'
        finally:
            server.shutdown()
            thread.join()


class ChromiumProcess:
    def __init__(self, chromium, profile, base):
        self.chromium, self.profile, self.base = chromium, profile, base
        self.process = None
        self.log = profile.parent / 'chromium.log'

    def open(self):
        assert self.process is None
        endpoint_file = self.profile / 'DevToolsActivePort'
        endpoint_file.unlink(missing_ok=True)
        platform_options = (
            {'creationflags': subprocess.CREATE_NO_WINDOW} if os.name == 'nt'
            else {'start_new_session': True}
        )
        with self.log.open('ab') as log:
            self.process = subprocess.Popen(
                [self.chromium.executable_path, '--headless=new', '--no-first-run',
                 '--disable-background-networking', '--disable-dev-shm-usage',
                 '--disable-crash-reporter', '--disable-breakpad', '--no-sandbox',
                 '--window-size=1440,1000', '--remote-debugging-port=0',
                 f'--user-data-dir={self.profile}', 'about:blank'],
                stdout=subprocess.DEVNULL, stderr=log, **platform_options,
            )
        deadline = time.monotonic() + 15
        while time.monotonic() < deadline:
            assert self.process.poll() is None, 'Dedicated Chromium exited during startup'
            if endpoint_file.is_file():
                lines = endpoint_file.read_text(encoding='utf-8').splitlines()
                if len(lines) == 2:
                    break
            time.sleep(.05)
        else:
            raise AssertionError('Dedicated Chromium did not expose its debugger')
        self.browser = self.chromium.connect_over_cdp(f'http://127.0.0.1:{lines[0]}')
        context = self.browser.contexts[0]
        context.route('**/*', lambda route: route.continue_() if route.request.url.startswith(self.base) else route.abort())
        page = context.pages[0]
        page.set_viewport_size({'width':1440,'height':1000})
        page.on('dialog', lambda dialog: dialog.accept())
        page.goto(self.base + 'health/')
        return page

    def kill(self):
        if self.process is None:
            return
        if self.process.poll() is None:
            if os.name == 'nt':
                # The PID belongs to this test's dedicated Chromium instance.
                result = subprocess.run(
                    ['taskkill.exe', '/F', '/T', '/PID', str(self.process.pid)],
                    capture_output=True, timeout=15,
                )
                if result.returncode:
                    self.process.wait(timeout=3)
            else:
                os.killpg(self.process.pid, signal.SIGKILL)
        self.process.wait(timeout=15)
        self.process = None

    def restart(self):
        self.kill()
        return self.open()


# Keep the real IndexedDB transaction alive after successful requests, so the
# process is killed after the changes have been staged and before commit.
HOLD_TRANSACTION = """expected => {
    const seen = new Set();
    let transaction;
    window.crashCheckpoint = {ready:false, committed:false};
    for (const method of ['put','add','delete']) {
      const original = IDBObjectStore.prototype[method];
      IDBObjectStore.prototype[method] = function(...args) {
        const request = original.apply(this,args), step = method + ':' + this.name;
        if (!expected.includes(step)) return request;
        if (!transaction) {
          transaction = this.transaction;
          const store = transaction.objectStore('vaults');
          const hold = () => { store.getKey('synthetic-crash-gate').onsuccess = hold; };
          hold();
          transaction.addEventListener('complete',()=>{window.crashCheckpoint.committed=true;});
        }
        if (this.transaction === transaction) request.addEventListener('success', () => {
          seen.add(step);
          window.crashCheckpoint.ready = expected.every(step => seen.has(step));
          window.crashCheckpoint.durability = transaction.durability;
        });
        return request;
      };
    }
}"""


def hold(page, *steps):
    page.evaluate(HOLD_TRANSACTION, list(steps))


def staged(page):
    page.wait_for_function('() => window.crashCheckpoint.ready')
    checkpoint = page.evaluate('window.crashCheckpoint')
    assert not checkpoint['committed'] and checkpoint['durability'] == 'strict', checkpoint


def unlock(page, phrase, rejected=False):
    form = page.locator('[data-form=unlock]')
    form.locator('[name=passphrase]').fill(phrase)
    form.locator('[type=submit]').click()
    if rejected:
        page.locator('#health-notice.show').wait_for()
        assert form.is_visible()
    else:
        page.locator('.metric').first.wait_for()


def settings(page):
    page.locator('.sidebar button[data-tab=settings]').click()


def attach(page, name):
    page.locator('.sidebar button[data-tab=document]').click()
    page.locator('[data-action=new-document].primary').click()
    page.locator('#health-dialog [name=file]').set_input_files(
        {'name':name, 'mimeType':'text/plain', 'buffer':FILES[name]},
    )
    page.locator('#health-dialog [type=submit]').click()


def rotate(page):
    settings(page)
    page.locator('[data-action=change-passphrase]').click()
    for name, value in [('current',OLD),('next',NEW),('repeat',NEW)]:
        page.locator(f'#health-dialog [name={name}]').fill(value)
    page.locator('#health-dialog [type=submit]').click()


def inventory(page):
    return page.evaluate("""async () => {
      const request = value => new Promise((resolve,reject)=>{
        value.onsuccess=()=>resolve(value.result);
        value.onerror=()=>reject(value.error);
      });
      const db=await request(indexedDB.open(HumanCrypto.FORMAT));
      const tx=db.transaction(['meta','vaults','objects']);
      const [current,vaults,objects]=await Promise.all([
        request(tx.objectStore('meta').get('current')),
        request(tx.objectStore('vaults').getAllKeys()),
        request(tx.objectStore('objects').getAllKeys()),
      ]);
      db.close();
      return {current:current??null,vaults,objects};
    }""")


def verify_files(page, phrase, names, vault_id=None):
    result = page.evaluate("""async phrase => {
      const id=await HumanStore.current(), local=await HumanStore.get(id);
      const {doc,key}=await HumanCrypto.unlock(local.envelope,phrase);
      const files={};
      for(const file of doc.documents){
        const object=await HumanStore.getObject(id,file.objectId);
        files[file.name]=Array.from(await HumanCrypto.openFile(id,file,object,key));
      }
      return {id,files};
    }""", phrase)
    assert not vault_id or result['id'] == vault_id
    assert {name:bytes(data) for name,data in result['files'].items()} == {name:FILES[name] for name in names}
    return result['id']


def start_restore(page, archive):
    settings(page)
    with page.expect_file_chooser() as chooser:
        page.locator('[data-action=restore-file]').click()
    chooser.value.set_files(archive)
    form = page.locator('[data-form=restore-unlock]')
    form.locator('[name=passphrase]').fill(NEW)
    form.locator('[type=submit]').click()
    page.locator('[data-form=restore-confirm]').wait_for()


def main(chrome, backup_path):
    page = chrome.open()
    form = page.locator('[data-form=create]')
    form.locator('[name=password]').fill(OLD)
    form.locator('[name=repeat]').fill(OLD)
    form.locator('[type=submit]').click()
    page.locator('.metric').first.wait_for()
    attach(page,'before.txt')
    page.locator('#health-dialog').wait_for(state='hidden')
    vault = verify_files(page,OLD,['before.txt'])
    before = inventory(page)
    backed_up = page.evaluate('async id => (await HumanStore.get(id)).envelope',vault)

    hold(page,'put:objects','put:vaults')
    attach(page,'after.txt')
    staged(page)
    page = chrome.restart()
    unlock(page,OLD)
    assert inventory(page) == before
    verify_files(page,OLD,['before.txt'],vault)
    attach(page,'after.txt')
    page.locator('#health-dialog').wait_for(state='hidden')
    page = chrome.restart()
    unlock(page,OLD)
    verify_files(page,OLD,FILES,vault)
    latest = inventory(page)
    stale_rejected = page.evaluate("""async ([id,old])=>{
      try{await HumanStore.remove(id,old);return false;}
      catch(error){return error.message.includes('после подготовки копии');}
    }""", [vault,backed_up])
    assert stale_rejected and inventory(page) == latest
    print('PASS attachment write rolls back before commit and survives after acknowledgment',flush=True)

    before = inventory(page)
    hold(page,'put:objects','delete:objects','put:vaults')
    rotate(page)
    staged(page)
    page = chrome.restart()
    unlock(page,NEW,rejected=True)
    unlock(page,OLD)
    assert inventory(page) == before
    verify_files(page,OLD,FILES,vault)
    rotate(page)
    page.locator('#health-dialog').wait_for(state='hidden')
    page = chrome.restart()
    unlock(page,OLD,rejected=True)
    unlock(page,NEW)
    verify_files(page,NEW,FILES,vault)
    rotated = inventory(page)
    assert len(rotated['objects']) == len(FILES)
    assert not any(key in rotated['objects'] for key in before['objects'])
    print('PASS interrupted rekey keeps old bytes and committed rekey removes old ciphertext',flush=True)

    settings(page)
    with page.expect_download() as saved:
        page.locator('[data-action=backup]').first.click()
    saved.value.save_as(backup_path)
    start_restore(page,backup_path)
    hold(page,'put:objects','add:vaults','put:meta')
    page.locator('[data-form=restore-confirm] [type=submit]').click()
    staged(page)
    page = chrome.restart()
    unlock(page,NEW)
    assert inventory(page) == rotated
    start_restore(page,backup_path)
    page.locator('[data-form=restore-confirm] [type=submit]').click()
    page.locator('.profile-page').wait_for()
    page = chrome.restart()
    unlock(page,NEW)
    restored = verify_files(page,NEW,FILES)
    assert restored != vault
    copies = inventory(page)
    assert len(copies['vaults']) == 2 and len(copies['objects']) == 2 * len(FILES)
    print('PASS restore rolls back selection and files together, then survives restart',flush=True)

    settings(page)
    hold(page,'delete:objects','delete:vaults','delete:meta')
    with page.expect_download():
        page.locator('[data-action=delete-local]').click()
    staged(page)
    page = chrome.restart()
    unlock(page,NEW)
    assert inventory(page) == copies
    verify_files(page,NEW,FILES,restored)
    peer = page.context.new_page()
    peer.set_viewport_size({'width':1440,'height':1000})
    peer.goto(chrome.base+'health/')
    unlock(peer,NEW)
    settings(page)
    with page.expect_download():
        page.locator('[data-action=delete-local]').click()
    page.locator('[data-action=select-profile]').wait_for()
    peer.locator('[data-action=select-profile]').wait_for()
    page = chrome.restart()
    surviving = inventory(page)
    assert surviving['vaults'] == [vault] and surviving['objects'] == rotated['objects']
    assert surviving['current'] is None
    unlock(page,NEW)
    print('PASS deletion is atomic, clears its files and locks the same journal in another tab',flush=True)


if __name__ == '__main__':
    with sync_playwright() as playwright, TemporaryDirectory(prefix='ayyy-crash-') as temp, serve() as base:
        directory = Path(temp)
        chrome = ChromiumProcess(playwright.chromium,directory/'profile',base)
        try:
            main(chrome,directory/'synthetic.human')
        except Exception:
            if chrome.log.is_file():
                print(chrome.log.read_text(encoding='utf-8',errors='replace')[-3500:],flush=True)
            raise
        finally:
            chrome.kill()
