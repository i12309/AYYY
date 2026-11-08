"""Search integration: shared portal styling, storage, URLs and accessible layouts.
Run: python tests/search_browser.py (requires Python Playwright and Chromium).
SEARCH_ROOT optionally points to an isolated release checkout.
CHROMIUM_PATH selects a local browser; SEARCH_VISUAL_OUTPUT saves screenshots.
"""
from pathlib import Path
from urllib.parse import urlsplit, unquote, quote
import os, mimetypes
from playwright.sync_api import sync_playwright

ROOT=Path(os.environ.get('SEARCH_ROOT',Path(__file__).resolve().parents[1]))
BASE='https://ayyy.test/AYYY/'
OUT=Path(os.environ['SEARCH_VISUAL_OUTPUT']) if os.environ.get('SEARCH_VISUAL_OUTPUT') else None
CHROME=os.environ.get('CHROMIUM_PATH') or None
if OUT:OUT.mkdir(parents=True,exist_ok=True)
checks=[]
def check(name,condition,details=None):
    assert condition,(name,details) if details is not None else name
    checks.append(name)
    print('PASS',name,flush=True)


def settle(page):
    page.evaluate('''async () => {
      await document.fonts.ready;
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    }''')


def navigate(page,route):
    page.evaluate('(r)=>AYYY.navigate(r)',route)
    page.wait_for_function('(r)=>AYYY.route===r',arg=route)
    settle(page)


def portal_skin(page):
    # Compare actual shared visual properties with the other entry pages. Layout
    # widths and copy may differ; colours, shapes and typography belong together.
    page.mouse.move(0,0)
    page.evaluate('document.activeElement?.blur()')
    return page.evaluate('''() => {
      const style = (selector, properties) => {
        const element = document.querySelector(selector);
        if (!element) return null;
        const computed = getComputedStyle(element);
        return Object.fromEntries(properties.map(key => [key, computed.getPropertyValue(key).trim()]));
      };
      return {
        palette: style('body', ['--paper','--ink','--sea','--sunlight']),
        page: style('.shore-page', ['background-color','color','font-family']),
        header: style('.shore-header', ['height','padding','gap','background-color']),
        logo: style('.shore-brand', ['color','font-family','font-size','font-weight','letter-spacing','transform']),
        heading: style('.shore-page h1', ['font-family','font-weight','color']),
        footer: style('.shore-footer', ['color','font-family','font-size','border-top-color']),
        search: style('.shore-search-box', ['background-color','border-top-color','border-top-width','border-radius','box-shadow']),
        submit: style('.shore-search-submit', ['background-color','color','font-family','font-weight','border-radius'])
      };
    }''')


def reachable_controls(page):
    selectors = ['.shore-header .shore-brand', '.shore-header .shore-catalog-link',
                 '.shore-settings', '#search-query', '.sp-search-submit',
                 '[data-mode]', '[data-provider]', '.sp-history-item',
                 '#sp-clear-history:enabled', '.sp-action-ai', '.sp-action-directory',
                 '.shore-footer [data-action]']
    problems=[]
    for selector in selectors:
        for control in page.locator(selector).all():
            if not control.is_visible():
                problems.append((selector,'hidden'));continue
            control.scroll_into_view_if_needed()
            result=control.evaluate('''element => {
              const r=element.getBoundingClientRect();
              const hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);
              const overflow=element.hasAttribute('data-provider')?[...element.children].flatMap(child=>{
                const c=child.getBoundingClientRect();
                if (!c.width||!c.height) return [];
                return c.left<r.left-1||c.right>r.right+1||c.top<r.top-1||c.bottom>r.bottom+1
                  ?[{child:child.className,left:c.left-r.left,right:c.right-r.right}]:[];
              }):[];
              return {inside:r.width>0&&r.height>0&&r.left>=-1&&r.top>=-1
                &&r.right<=innerWidth+1&&r.bottom<=innerHeight+1,
                hit:!!hit&&(element===hit||element.contains(hit)),overflow};
            }''')
            if not result['inside'] or not result['hit'] or result['overflow']:problems.append((selector,result))
    page.evaluate('window.scrollTo({top:0,left:0,behavior:"instant"});document.querySelector(".sp-modes").scrollLeft=0')
    return problems


with sync_playwright() as pw:
    browser=pw.chromium.launch(executable_path=CHROME,args=['--no-sandbox','--disable-dev-shm-usage'])
    context=browser.new_context(viewport={'width':1672,'height':941},reduced_motion='reduce')
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
    check('local atlas artwork loaded',page.locator('.sp-art img').evaluate_all('(els)=>els.length>0&&els.every(e=>e.complete&&e.naturalWidth>0)'))
    check('the thought atlas replaces the old magnifier',page.locator('.sp-art img').get_attribute('src')=='assets/search/thought-atlas.svg')
    atlas_svg=(ROOT/'assets/search/thought-atlas.svg').read_text(encoding='utf-8')
    check('atlas contains dozens of small practical symbols',
          atlas_svg.count('<symbol ')>=45 and atlas_svg.count('<use ')>=120
          and '<symbol id="s-receipt"' in atlas_svg and '<symbol id="s-train"' in atlas_svg)
    check('oversized romantic washes and italic labels are gone',
          '<radialGradient ' not in atlas_svg and 'font-style="italic"' not in atlas_svg)
    check('provider controls have a tab rather than a card style',page.locator('[data-provider="Google"]').evaluate("""e=>{
      const s=getComputedStyle(e);
      return s.borderTopWidth==='0px' && s.backgroundColor==='rgba(0, 0, 0, 0)'
        && getComputedStyle(e,'::after').height==='3px';
    }"""))
    check('selected provider uses a visible underline',page.locator('[data-provider="Bing"]').evaluate("""e=>{
      return e.classList.contains('is-active') && getComputedStyle(e,'::after').opacity==='1';
    }"""))
    settle(page)
    if OUT:page.screenshot(path=str(OUT/'desktop-1672.png'),full_page=True)
    navigate(page,'home');home=portal_skin(page)
    navigate(page,'directory');directory=portal_skin(page)
    navigate(page,'search');search=portal_skin(page)
    check('shared palette is defined',all(home['palette'].values()))
    for part in ['palette','page','header','logo','footer']:
        check('shared '+part+' matches home and directory',search[part] is not None and search[part]==home[part]==directory[part],
              {'search':search[part],'home':home[part],'directory':directory[part]})
    # Home's compact h1 labels its shortcuts, while search and directory use page headings.
    check('page heading styling matches directory',search['heading'] is not None and search['heading']==directory['heading'],
          {'search':search['heading'],'directory':directory['heading']})
    for part in ['search','submit']:
        check('shared '+part+' styling matches home',search[part] is not None and search[part]==home[part],
              {'search':search[part],'home':home[part]})
    check('search action has a visible text label','Найти' in page.locator('.sp-search-submit').inner_text())
    # A full local history and a long query must fit just as the empty state does.
    page.evaluate('''AYYY.set('recentSearches',[
      'Длинный запрос '.repeat(35),...Array.from({length:9},(_,i)=>'query '+i)
    ]);AYYY.render()''')
    for width,height in [(320,740),(390,844),(768,1024),(1024,768),(1440,900),(1920,1080),(3840,2160)]:
        page.set_viewport_size({'width':width,'height':height});settle(page)
        check('no page overflow '+str(width),page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'))
        problems=reachable_controls(page)
        check('controls reachable without overlap '+str(width),not problems,problems)
        check('no horizontal page scroll after controls '+str(width),page.evaluate('scrollX===0&&document.documentElement.scrollWidth<=innerWidth+1'))
        check('decorative art does not intercept clicks '+str(width),
              page.locator('.sp-art').evaluate("e=>getComputedStyle(e).pointerEvents==='none'"))
        check('art positioning follows breakpoint '+str(width),
              page.locator('.sp-art').evaluate("e=>getComputedStyle(e).position=== (innerWidth>720?'fixed':'absolute')"))
        if width>720:
            check('illustration stays below logo '+str(width),
                  page.locator('.sp-art').evaluate("e=>e.getBoundingClientRect().top>=document.querySelector('.shore-header').getBoundingClientRect().bottom-1"))
            check('illustration uses less than 30 percent of screen width '+str(width),
                  page.locator('.sp-art').evaluate("e=>e.getBoundingClientRect().width<=innerWidth*.30+1"))
        if width>=1440:
            layout=page.evaluate('({height:innerHeight,documentHeight:document.documentElement.scrollHeight})')
            check('desktop fits one screen '+str(width),layout['documentHeight']<=layout['height']+1,layout)
        if width==3840:
            check('4K keeps the portal composition bounded',page.locator('.shore-page').evaluate('e=>e.getBoundingClientRect().width<=1841'))
        if OUT and width in [390,1440,1920,3840]:
            page.screenshot(path=str(OUT/f'{"mobile" if width==390 else "desktop"}-{width}.png'),full_page=True)
    # Desktop illustration is pinned to the viewport even when the page is long.
    page.set_viewport_size({'width':1440,'height':900})
    page.evaluate("document.body.style.minHeight='1800px'")
    settle(page)
    before=page.locator('.sp-art').evaluate("e=>e.getBoundingClientRect().top")
    page.evaluate('window.scrollTo(0,400)')
    page.wait_for_function('window.scrollY>200')
    after=page.locator('.sp-art').evaluate("e=>e.getBoundingClientRect().top")
    check('atlas stays fixed while scrolling',abs(before-after)<1,(before,after))
    page.evaluate("document.body.style.minHeight='';window.scrollTo(0,0)")
    page.evaluate('document.documentElement.dataset.theme="dark"')
    check('search keeps shared paper and ink in dark portal',portal_skin(page)['page']==home['page'] and portal_skin(page)['palette']==home['palette'])
    page.locator('.shore-footer [data-action="about"]').click()
    check('footer opens real about dialog',page.locator('#modal').is_visible())
    page.keyboard.press('Escape')
    check('footer dialog does not navigate away',page.evaluate('AYYY.route')=='search')
    check('no external requests',not external)
    check('no JavaScript errors',not errors)
    # Artwork failure must leave the working UI available.
    page.route('**/assets/search/thought-atlas.svg',lambda r:r.fulfill(status=404,body='Unavailable'))
    page.reload();page.wait_for_selector('#search-query')
    page.locator('#search-query').fill('without artwork');page.locator('#search-query').press('Enter')
    check('search works without artwork',page.evaluate('__opened.length')==1)
    browser.close()
print(len(checks),'search browser checks PASS')
