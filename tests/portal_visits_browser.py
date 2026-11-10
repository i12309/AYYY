"""Verify portal visits on the production origin without writing live statistics."""
from argparse import ArgumentParser
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
SITE = 'https://i12309.github.io/AYYY/'
FRAME = SITE + 'assets/portal-visit-frame.html'
PRIVATE = 'DO-NOT-SEND-THIS'
WATCH = '/watch/114172368'

# Reproduce the public init/hit API offline; --real-sdk tests the actual transport.
SDK = """for (const [id,method,arg,options] of ym.a) send(id,method,arg,options);
window.ym = send;
function send(id, method, arg, options) {
  const init = method === 'init';
  const url = init ? arg.url : arg;
  if (init && (arg.webvisor || arg.clickmap || arg.ecommerce || arg.trackLinks ||
               arg.trackHash || arg.childIframe || !arg.disableYtm)) throw Error('Unexpected tracking');
  const data = new URLSearchParams({'page-url':url, 'page-ref': init ? arg.referrer : options.referer});
  fetch('https://mc.yandex.ru/watch/' + id + '?' + data);
}"""


def run(engine, real_sdk, root):
    browser = engine.launch()
    page = browser.new_page()
    hits = []
    requests = []

    def respond(route):
        request = route.request
        url = urlsplit(request.url)
        if request.url.startswith(SITE):
            file = root / url.path.removeprefix('/AYYY/')
            if file.is_dir():
                file /= 'index.html'
            if file.is_file() and request.resource_type not in ('image', 'font', 'media'):
                route.fulfill(path=file)
            else:
                route.abort()
            return
        if url.hostname == 'mc.yandex.ru' and url.path == '/metrika/tag.js':
            if real_sdk:
                route.continue_()
            else:
                route.fulfill(content_type='text/javascript', body=SDK)
            return
        if url.hostname == 'mc.yandex.ru':
            requests.append((request.url, request.post_data or '', request.headers.get('referer', '')))
            if url.path == WATCH:
                query = parse_qs(url.query)
                hits.extend(query.get('page-url', []))
            route.fulfill(
                content_type='application/json', body='{"settings":{}}',
                headers={'Access-Control-Allow-Origin': 'null', 'Access-Control-Allow-Credentials': 'true'},
            )
            return
        if url.hostname == 'localhost' and url.path == '/AYYY/':
            route.fulfill(path=root / 'index.html')
            return
        if url.hostname == 'localhost' and url.path == '/AYYY/assets/portal-visits.js':
            route.fulfill(path=root / 'assets/portal-visits.js')
            return
        route.abort()

    page.route('**/*', respond)

    def expect_visit(destination, action):
        def matches(request):
            url = urlsplit(request.url)
            return url.path == WATCH and parse_qs(url.query).get('page-url') == [SITE + destination]
        with page.expect_response(lambda response: matches(response.request), timeout=15000) as response:
            action()
        assert response.value.ok

    def open_page(path, destination):
        expect_visit(destination, lambda: page.goto(SITE + path, wait_until='domcontentloaded'))

    def navigate(section, param, destination):
        expect_visit(destination, lambda: page.evaluate('(args) => AYYY.navigate(...args)', [section, param]))

    open_page('?secret=' + PRIVATE + '#health/' + PRIVATE, '#health')
    frame = page.frame(url=FRAME)
    assert frame is not None and frame.evaluate('window.origin') == 'null'
    assert frame.evaluate("""() => {
      try { parent.document.body; return false; }
      catch (error) { return error.name === 'SecurityError'; }
    }""")
    assert frame.evaluate('document.referrer') == ''
    page.evaluate("() => { AYYY.render(); AYYY.navigate('health', 'demo'); }")
    page.wait_for_function("AYYY.param === 'demo'")
    navigate('search', PRIVATE, '#search')
    navigate('health', '', '#health')
    open_page('health/?demo=1&record=' + PRIVATE, '#health')
    page.wait_for_timeout(350)
    assert hits == [SITE + item for item in ('#health', '#search', '#health', '#health')], hits

    if not real_sdk:
        # Verify every deployed HTML entry and the embedded game navigation.
        open_page('index.html', '')
        for section in ('directory', 'weather', 'finance', 'mpp', 'ai', 'family'):
            navigate(section, '', '#' + section)
        navigate('tools', 'calc', '#tools/science')
        page.evaluate("AYYY.navigate('tools', 'science')")
        page.wait_for_function("AYYY.param === 'science'")
        navigate('tools', 'loan', '#tools/loan')
        navigate('games', '', '#games')
        navigate('games', 'coloring', '#games/coloring-gallery')
        page.frame_locator('.gp-game-frame').locator('body').wait_for()
        with page.expect_response(
            lambda r: parse_qs(urlsplit(r.url).query).get('page-url') == [SITE + '#games/coloring'],
        ):
            page.locator('.gp-game-frame').evaluate(
                "(frame) => frame.src = 'games/runtime/games/coloring/index.html?work=' + " + repr(PRIVATE)
            )
        page.wait_for_function("AYYY.param.startsWith('coloring@work:')")
        assert hits.count(SITE + '#tools/science') == 1 and hits.count(SITE + '#games/coloring') == 1
        for path, destination in {
            'weather/': '#weather', 'terminal/': '#ai', 'family/': '#family',
            'family/help/': 'family/help/', 'games/runtime/index.html': '#games',
            'games/runtime/works.html': '#games/works',
            'games/runtime/games/coloring/gallery.html': '#games/coloring-gallery',
        }.items():
            open_page(path, destination)
        for file in sorted((root / 'games/runtime/games').glob('*/index.html')):
            open_page(file.relative_to(root).as_posix() + '?work=' + PRIVATE, '#games/' + file.parent.name)

        before = len(requests)
        page.goto('http://localhost/AYYY/', wait_until='domcontentloaded')
        assert page.locator('iframe[sandbox]').count() == 0 and len(requests) == before
        page.route('**/metrika/tag.js?*', lambda r: r.abort())
        page.goto(SITE + '#search', wait_until='domcontentloaded')
        assert page.locator('#search-page').is_visible()

    assert all(PRIVATE not in value for request in requests for value in request), requests
    print(f'{engine.name}: verified {len(hits)} page views without private parameters')
    browser.close()


if __name__ == '__main__':
    parser = ArgumentParser(description=__doc__)
    parser.add_argument('--real-sdk', action='store_true')
    parser.add_argument('--browser', choices=['all', 'chromium', 'firefox', 'webkit'], default='all')
    parser.add_argument('--root', type=Path, default=ROOT)
    args = parser.parse_args()
    with sync_playwright() as playwright:
        for name in ('chromium', 'firefox', 'webkit') if args.browser == 'all' else (args.browser,):
            run(getattr(playwright, name), args.real_sdk, args.root.resolve())
