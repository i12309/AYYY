#!/usr/bin/env python3
"""Full-portal regression for the approved gallery/card artwork and service order.

Run: CHROME_BIN=/usr/bin/chromium python tests/service_artwork_browser.py
Set AYYY_SCREENSHOTS to save review screenshots. No external requests are needed.
"""
from pathlib import Path
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from threading import Thread
from urllib.parse import urlparse, unquote
import os, json, shutil, hashlib, mimetypes
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parent.parent
OUT=Path(os.environ['AYYY_SCREENSHOTS']) if os.getenv('AYYY_SCREENSHOTS') else None
EMBEDDED=os.getenv('AYYY_EMBEDDED_RENDER')=='1'
ORDER=['oberon','health','weather','family','games','finance','tools','mpp','search','ai']

class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self,*_): pass

def check_assets():
    manifest=json.loads((ROOT/'assets/service-art/v1/manifest.json').read_text())
    assert manifest['order']==ORDER
    for service in ORDER:
        images=manifest['services'][service]
        assert images['hero']['path']!=images['card']['path']
        for role in ('hero','card'):
            record=images[role]; data=(ROOT/record['path']).read_bytes()
            assert data[:4]==b'RIFF' and data[8:12]==b'WEBP'
            assert hashlib.sha256(data).hexdigest()==record['sha256']
            assert len(data)==record['bytes']

def snap(page,name):
    if OUT:
        OUT.mkdir(parents=True,exist_ok=True)
        page.screenshot(path=str(OUT/name))

def rect(locator):
    result=locator.bounding_box();assert result is not None
    return result

def preview(page,service,desktop=True):
    page.wait_for_function('id=>document.querySelector(".sc-gallery").dataset.scActive===id',arg=service)
    image=page.locator(f'[data-sc-picture="{service}"]')
    page.wait_for_function('id=>{let i=document.querySelector(`[data-sc-picture="${id}"]`);return i.complete&&i.naturalWidth>0}',arg=service)
    assert image.evaluate('e=>getComputedStyle(e).opacity')=='1'
    assert page.locator('.sc-gallery-image.is-visible').count()==1
    b=rect(image);assert b['width']>60 and b['height']>70,b
    if service!='default':assert f'/{service}-hero.webp' in image.get_attribute('src')
    if desktop:
        g=rect(page.locator('.sc-gallery-sticky'));c=rect(page.locator('.sc-catalog'))
        assert g['width']>=250,(g,c)
        assert g['x']+g['width']+20<=c['x'],(g,c)
        assert b['x']+b['width']<=c['x']-10,(b,c)
        assert 0<=b['y']<page.viewport_size['height']-70,b

def run(browser,url,width,height):
    page=browser.new_page(viewport={'width':width,'height':height},reduced_motion='reduce')
    page.set_default_timeout(10000)
    errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    # Serve the complete checked-out site, never a simplified layout mock.
    # Interception also makes this test work in sandboxes without localhost networking.
    def serve(route):
        parsed=urlparse(route.request.url)
        if parsed.hostname not in ('127.0.0.1','localhost'):
            route.abort();return
        rel=unquote(parsed.path).lstrip('/') or 'index.html'
        path=(ROOT/rel).resolve()
        if ROOT not in path.parents and path!=ROOT:
            route.fulfill(status=403,body='');return
        if path.is_dir():path=path/'index.html'
        if path.is_file():route.fulfill(path=str(path),content_type=mimetypes.guess_type(path.name)[0] or 'application/octet-stream')
        else:route.fulfill(status=404,body='not found')
    page.route('**/*',serve)
    try:
        if EMBEDDED:
            # Offline full-document render for environments blocking localhost navigation.
            # Only unavailable origin storage is mocked, not layout or service code.
            page.goto('about:blank#directory')
            adapter="""<script>
for(const name of ['localStorage','sessionStorage']){
 const values=new Map();Object.defineProperty(window,name,{value:{
 getItem:k=>values.has(String(k))?values.get(String(k)):null,
 setItem:(k,v)=>values.set(String(k),String(v)),removeItem:k=>values.delete(String(k)),
 clear:()=>values.clear(),key:n=>[...values.keys()][n]??null,get length(){return values.size;}
 }});
}
Object.defineProperty(window,'indexedDB',{value:undefined});
</script>"""
            html=(ROOT/'index.html').read_text()
            html=html.replace('<head>','<head><base href="'+url+'/">'+adapter,1)
            page.set_content(html,wait_until='networkidle')
        else:
            page.goto(url+'/#directory',wait_until='networkidle')
        page.wait_for_selector('.sc-row--oberon')
        assert page.locator('.sc-row').evaluate_all('es=>es.map(e=>e.dataset.serviceId)')==ORDER
        desktop=width>980
        preview(page,'default',desktop)
        if desktop:
            shell=rect(page.locator('.sc-shell'));cat=rect(page.locator('.sc-catalog'))
            assert shell['width']>=min(width,1740)-2
            assert cat['width']>shell['width']*.54
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
        for id in ORDER:
            image=page.locator(f'.sc-row--{id} .sc-card-cover img')
            assert f'/{id}-card.webp' in image.get_attribute('src')
        if width in (390,1728):snap(page,f'directory-{width}-default.png')
        if desktop:
            for id in ORDER:
                page.locator(f'.sc-row--{id}').hover()
                preview(page,id)
                image=page.locator(f'.sc-row--{id} .sc-card-cover img')
                assert image.evaluate('e=>e.complete&&e.naturalWidth===480')
                if width==1728 and id in ('oberon','health','weather','ai','family'):
                    snap(page,f'directory-{width}-{id}.png')
                page.mouse.move(2,2);preview(page,'default')
        # Expanding content must retain artwork rather than resize the bitmap out of view.
        initial=rect(page.locator('.sc-row--oberon'))['height']
        page.locator('.sc-row--oberon summary').click()
        assert rect(page.locator('.sc-row--oberon'))['height']>initial
        page.locator('.sc-row--oberon summary').click()
        page.locator('#catalog-search').fill('медкарта')
        assert page.locator('.sc-row').count()==1
        if desktop:
            page.locator('.sc-row--health').hover();preview(page,'health')
        page.locator('#catalog-search').fill('')
        page.locator('[data-category="personal"]').click()
        assert page.locator('.sc-row').evaluate_all('es=>es.map(e=>e.dataset.serviceId)')==['oberon','health','family']
        page.locator('[data-category="all"]').click()
        button=page.locator('.sc-row--oberon [data-favorite]')
        old=button.get_attribute('aria-pressed');button.click()
        assert button.get_attribute('aria-pressed')!=old
        if desktop:
            page.locator('#catalog-search').focus()
            page.locator('.sc-row--oberon summary').focus();preview(page,'oberon')
        assert not errors,errors
        return {'width':width,'height':height,'result':'PASS'}
    finally:page.close()

def main():
    check_assets()
    server=ThreadingHTTPServer(('127.0.0.1',0),partial(QuietHandler,directory=str(ROOT)))
    Thread(target=server.serve_forever,daemon=True).start()
    results=[]
    try:
        with sync_playwright() as p:
            browser=p.chromium.launch(executable_path=os.getenv('CHROME_BIN') or shutil.which('chromium'),headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
            try:
                for width,height in [(320,740),(390,844),(768,1024),(980,900),(981,900),(1024,768),(1280,900),(1440,900),(1728,960),(1920,1080)]:
                    results.append(run(browser,f'http://127.0.0.1:{server.server_port}',width,height));print(results[-1],flush=True)
            finally:browser.close()
    finally:server.shutdown();server.server_close()
    if OUT:(OUT/'results.json').write_text(json.dumps(results,indent=2))
    print('PASS: 20 asset checks; 10 responsive full-portal scenarios; hover, keyboard, filtering, favorites and details.')

if __name__=='__main__':main()
