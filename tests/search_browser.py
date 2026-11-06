"""Search integration: real hash links, shared storage, URLs and reference geometry.
Run: python tests/search_browser.py (requires Python Playwright and Chromium).
SEARCH_ROOT optionally points to an isolated release checkout.
"""
from pathlib import Path
from urllib.parse import urlsplit, unquote, quote
import os, mimetypes
from playwright.sync_api import sync_playwright

ROOT=Path(os.environ.get('SEARCH_ROOT',Path(__file__).resolve().parents[1]))
BASE='https://ayyy.test/AYYY/'
OUT=Path(__file__).resolve().parents[1]/'docs/search'
checks=[]
def check(name,condition):
    assert condition,name
    checks.append(name)
    print('PASS',name,flush=True)

with sync_playwright() as pw:
    browser=pw.chromium.launch()
    context=browser.new_context(viewport={'width':1672,'height':941})
    page=context.new_page()
    errors=[];external=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    def serve(route):
        url=route.request.url
        if not url.startswith(BASE):
            external.append(url);route.abort();return
        path=(ROOT/(unquote(urlsplit(url).path).removeprefix('/AYYY/') or 'index.html')).resolve()
        if ROOT.resolve() in path.parents and path.is_file():
            route.fulfill(body=path.read_bytes(),content_type=mimetypes.guess_type(path)[0] or 'text/plain')
        else:route.fulfill(status=404,body='Missing local asset')
    page.route('**/*',serve)
    page.add_init_script('window.__opened=[];window.open=(...args)=>{__opened.push(args);return null}')
    page.goto(BASE+'#search')
    page.wait_for_selector('#search-query')
    check('no sidebar',not page.locator('body>.sidebar').is_visible())
    check('no invented history',page.evaluate('AYYY.get("recentSearches",[]).length')==0)
    text='тест & a+b / ?'
    encoded=quote(text,safe="~()*!.'")
    providers={'Google':'https://www.google.com/search?q=','Яндекс':'https://yandex.ru/search/?text=',
               'DuckDuckGo':'https://duckduckgo.com/?q=','Bing':'https://www.bing.com/search?q='}
    for provider,url in providers.items():
        page.locator('[data-provider="'+provider+'"]').click()
        page.locator('#search-query').fill(text);page.locator('#search-query').press('Enter')
        check('encoded URL '+provider,page.evaluate('__opened.at(-1)')==[url+encoded,'_blank','noopener,noreferrer'])
    modes={'images':'https://www.google.com/search?tbm=isch&q=',
           'video':'https://www.youtube.com/results?search_query=',
           'maps':'https://www.google.com/maps/search/?api=1&query=',
           'wiki':'https://ru.wikipedia.org/w/index.php?search=',
           'code':'https://github.com/search?type=code&q='}
    for mode,url in modes.items():
        page.locator('[data-mode="'+mode+'"]').click()
        check('provider disabled '+mode,page.locator('[data-provider]:disabled').count()==4)
        check('mode announced '+mode,page.locator('[data-mode="'+mode+'"]').get_attribute('aria-pressed')=='true')
        page.locator('#search-query').press('Enter')
        check('encoded URL '+mode,page.evaluate('__opened.at(-1)[0]')==url+encoded)
    page.locator('[data-mode="web"]').click()
    check('web keeps provider',page.locator('[data-provider="Bing"]').get_attribute('aria-pressed')=='true')
    check('history deduplicated',page.evaluate('AYYY.get("recentSearches").length')==1)
    page.reload();page.wait_for_selector('#search-query')
    check('provider survives reload',page.locator('[data-provider="Bing"]').get_attribute('aria-pressed')=='true')
    page.locator('.sp-history-item').first.click()
    check('history fills query',page.locator('#search-query').input_value()==text)
    check('history does not launch search',page.evaluate('__opened.length')==0)
    page.evaluate('AYYY.set("recentSearches",["<img src=x onerror=alert(1)>",...Array.from({length:9},(_,i)=>"query "+i)]);AYYY.render()')
    check('history displays six of ten',page.locator('.sp-history-item').count()==6)
    check('history HTML escaped',page.locator('.sp-history-list img').count()==0)
    page.locator('#sp-clear-history').click()
    check('history cleared in storage',page.evaluate('AYYY.get("recentSearches").length')==0)
    page.locator('#search-query').fill('  ');page.locator('#search-query').press('Enter')
    check('empty query does not open window',page.evaluate('__opened.length')==0)
    page.locator('[data-mode="web"]').focus();page.keyboard.press('/')
    page.wait_for_function('document.activeElement?.id==="search-query"')
    check('slash focuses search',page.locator('#search-query').evaluate('(e)=>e===document.activeElement'))
    page.keyboard.press('Control+k')
    check('Ctrl K opens portal palette',page.locator('#command-search').is_visible())
    page.keyboard.press('Escape')
    page.locator('.sp-action-ai').click();page.wait_for_function('AYYY.route==="ai"')
    check('AI link works',page.evaluate('AYYY.route')=='ai')
    page.evaluate('AYYY.navigate("search")');page.wait_for_selector('.sp-action-directory')
    page.locator('.sp-action-directory').click();page.wait_for_function('AYYY.route==="directory"')
    check('directory link works',page.locator('.shore-directory').count()==1)
    for _ in range(3):
        for route in ['home','search','directory','search']:
            page.evaluate('(r)=>AYYY.navigate(r)',route);page.wait_for_function('(r)=>AYYY.route===r',arg=route)
    page.evaluate('__opened=[]')
    page.locator('#search-query').fill('single submit');page.locator('#search-query').press('Enter')
    check('navigation does not duplicate submit handlers',page.evaluate('__opened.length')==1)
    page.locator('#sp-clear-history').click();page.locator('#search-query').fill('')
    page.reload();page.wait_for_selector('#search-query')
    page.wait_for_function('Array.from(document.querySelectorAll(".sp-art img")).every(e=>e.complete)')
    check('local artwork loaded',page.locator('.sp-art img').evaluate_all('(els)=>els.every(e=>e.complete&&e.naturalWidth>0)'))
    # Compare key rectangles against the provided 1672 x 941 reference.
    box=page.locator('.sp-search-box').bounding_box()
    check('reference search placement',abs(box['x']-360)<4 and abs(box['y']-267)<8 and abs(box['width']-952)<5)
    box=page.locator('.sp-content-grid').bounding_box()
    check('reference lower panels placement',abs(box['x']-348)<4 and abs(box['y']-536)<8)
    OUT.mkdir(parents=True,exist_ok=True)
    page.screenshot(path=str(OUT/'desktop-1672.png'),full_page=True)
    for width in [360,390,768,1024,1440,1672,1920]:
        page.set_viewport_size({'width':width,'height':844 if width<630 else 900})
        check('no page overflow '+str(width),page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
        check('submit accessible '+str(width),page.locator('.sp-search-submit').is_visible())
        if width in [390,1440]:page.screenshot(path=str(OUT/f'{"mobile" if width==390 else "desktop"}-{width}.png'),full_page=True)
    page.evaluate('document.documentElement.dataset.theme="dark"')
    check('search remains light in dark portal',page.locator('.sp-app').evaluate('(e)=>getComputedStyle(e).color')=='rgb(36, 49, 61)')
    page.locator('.sp-footer [data-action="about"]').click()
    check('footer opens real about dialog',page.locator('#modal').is_visible())
    page.keyboard.press('Escape')
    check('footer dialog does not navigate away',page.evaluate('AYYY.route')=='search')
    check('no external requests',not external)
    check('no JavaScript errors',not errors)
    # Artwork failure must leave the working UI available.
    page.route('**/assets/search/*.webp',lambda r:r.fulfill(status=404,body='Unavailable'))
    page.reload();page.wait_for_selector('#search-query')
    page.locator('#search-query').fill('without artwork');page.locator('#search-query').press('Enter')
    check('search works without artwork',page.evaluate('__opened.length')==1)
    browser.close()
print(len(checks),'search browser checks PASS')
