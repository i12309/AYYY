#!/usr/bin/env python3
"""Render the COMPLETE portal (index.html and all its CSS/JS), not a mock layout.

  python tests/service_showcase_browser.py
  CHROME_BIN=/path/to/chrome python tests/service_showcase_browser.py

AYYY_EMBEDDED_RENDER=1 is for sandboxes that prohibit local HTTP navigation:
use set_content with the same index.html/assets; ONLY browser storage is mocked.
GitHub authorization, sync and persistence are deliberately not tested here.
AYYY_SCREENSHOTS=/path saves desktop, hovered, scrolled and mobile previews.
"""
from __future__ import annotations

from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
import json
import os
import shutil
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
EMBEDDED = os.getenv('AYYY_EMBEDDED_RENDER') == '1'
OUT = Path(os.environ['AYYY_SCREENSHOTS']) if os.getenv('AYYY_SCREENSHOTS') else None

# An opaque about:blank origin cannot use Storage or IndexedDB. This adapter
# is exclusive to embedded layout tests; regular browser tests use real storage.
STORAGE_ADAPTER = """<script>
for (const key of ['localStorage', 'sessionStorage']) {
  const values = new Map();
  Object.defineProperty(window, key, {value: {
    getItem(k) { return values.has(String(k)) ? values.get(String(k)) : null; },
    setItem(k,v) { values.set(String(k),String(v)); },
    removeItem(k) { values.delete(String(k)); }, clear() { values.clear(); },
    key(n) { return [...values.keys()][n] ?? null; }, get length() { return values.size; }
  }});
}
Object.defineProperty(window,'indexedDB',{value:undefined});
</script>"""


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_args):
        pass


def load_portal(page, url):
    if EMBEDDED:
        page.goto('about:blank#directory')
        html = (ROOT / 'index.html').read_text(encoding='utf-8')
        # The production styles and scripts stay intact, in their original order.
        html = html.replace('<head>', '<head><base href="' + url + '/">' + STORAGE_ADAPTER, 1)
        page.set_content(html, wait_until='load')
    else:
        page.goto(url + '/#directory')
    page.wait_for_selector('.sc-row--oberon')
    page.wait_for_function('document.querySelectorAll(".sc-row").length === 10')


def box(locator):
    value = locator.bounding_box()
    assert value is not None, f'No rendered box: {locator}'
    return value


def assert_preview(page, service, desktop=True):
    page.wait_for_function('(id) => document.querySelector(".sc-gallery").dataset.scActive === id', arg=service)
    image = page.locator('[data-sc-picture="' + service + '"]')
    page.wait_for_function('(id) => {const e=document.querySelector(`[data-sc-picture="${id}"]`); return e.complete && e.naturalWidth>0}', arg=service)
    # Crucial: naturalWidth > 0 is NOT enough. A loaded image can be zero pixels wide.
    image_box = box(image)
    assert image_box['width'] >= (180 if desktop else 70), image_box
    assert image_box['height'] >= (180 if desktop else 80), image_box
    assert image.evaluate('e => getComputedStyle(e).opacity') == '1'
    assert page.locator('.sc-gallery-image.is-visible').count() == 1
    if desktop:
        frame = box(page.locator('.sc-gallery-sticky'))
        catalog = box(page.locator('.sc-catalog'))
        caption = box(page.locator('.sc-gallery-caption'))
        assert frame['width'] >= 250, frame
        assert frame['x'] + frame['width'] + 20 <= catalog['x'], (frame, catalog)
        assert image_box['x'] >= frame['x'] - 1
        assert image_box['x'] + image_box['width'] <= frame['x'] + frame['width'] + 1
        assert 0 <= image_box['y'] < page.viewport_size['height'] - 100, image_box
        assert caption['x'] + caption['width'] <= catalog['x'] - 10, caption
    return image_box


def screenshot(page, name):
    if OUT:
        OUT.mkdir(parents=True, exist_ok=True)
        page.screenshot(path=str(OUT / name))


def test_directory(browser, url, width, height, *, reduced_motion='reduce'):
    page = browser.new_page(viewport={'width': width, 'height': height}, reduced_motion=reduced_motion)
    page.set_default_timeout(8000)
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    try:
        load_portal(page, url)
        desktop = width > 980
        if reduced_motion != 'reduce':
            page.wait_for_timeout(550)
        assert_preview(page, 'default', desktop)
        shell = box(page.locator('.sc-shell'))
        catalog = box(page.locator('.sc-catalog'))
        if desktop:
            # .shore-page is a flex column. Auto margins used to shrink the
            # shell to intrinsic width, leaving a 0px-wide gallery track.
            available = min(width, 1740)
            assert shell['width'] >= available - 2, shell
            assert catalog['width'] >= shell['width'] * .54, catalog
            assert catalog['x'] + catalog['width'] >= shell['x'] + shell['width'] - 80, catalog
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1'), width
        if width in (390, 1728):
            screenshot(page, f'directory-{width}-default.png')

        initial_height = box(page.locator('.sc-row--oberon'))['height']
        page.locator('.sc-row--oberon summary').click()
        assert page.locator('.sc-row--oberon details').get_attribute('open') is not None
        assert box(page.locator('.sc-row--oberon'))['height'] > initial_height
        page.locator('.sc-row--oberon summary').click()

        if desktop:
            assert page.locator('.sc-gallery-sticky').evaluate('e=>getComputedStyle(e).position') == 'sticky'
            ids = page.locator('.sc-row').evaluate_all('es=>es.map(e=>e.dataset.serviceId)')
            for service in ids:
                page.locator('.sc-row--' + service).hover()
                if reduced_motion != 'reduce':
                    page.wait_for_timeout(550)
                assert_preview(page, service)
                if width == 1728 and service in ('ai', 'games'):
                    screenshot(page, f'directory-{width}-{service}.png')
                page.mouse.move(3, 3)
                if reduced_motion != 'reduce':
                    page.wait_for_timeout(550)
                assert_preview(page, 'default')
            # Keyboard focus has the same preview behaviour.
            page.locator('#catalog-search').focus()
            page.locator('.sc-row--oberon summary').focus()
            if reduced_motion != 'reduce':
                page.wait_for_timeout(550)
            assert_preview(page, 'oberon')

        # Filtering shortens the grid; the preview must still have actual width.
        page.locator('#catalog-search').fill('медкарта')
        assert page.locator('.sc-row').count() == 1
        if desktop:
            page.locator('.sc-row--health').hover()
            if reduced_motion != 'reduce':
                page.wait_for_timeout(550)
            assert_preview(page, 'health')
        page.locator('#catalog-search').fill('')
        assert page.locator('.sc-row').count() == 10
        page.locator('[data-category="tools"]').click()
        assert page.locator('.sc-row').count() == 2
        page.locator('[data-category="all"]').click()
        assert page.locator('.sc-row').count() == 10
        assert not errors, errors
        return {'width': width, 'height': height, 'catalog': round(catalog['width']),
                'shell': round(shell['width']), 'motion': reduced_motion, 'errors': errors}
    finally:
        page.close()


def main():
    server = ThreadingHTTPServer(('127.0.0.1', 0), partial(QuietHandler, directory=str(ROOT)))
    Thread(target=server.serve_forever, daemon=True).start()
    try:
        with sync_playwright() as playwright:
            executable = os.getenv('CHROME_BIN') or shutil.which('chromium') or shutil.which('google-chrome')
            kwargs = {'headless': True, 'args': ['--no-sandbox']}
            if executable:
                kwargs['executable_path'] = executable
            browser = playwright.chromium.launch(**kwargs)
            try:
                url = 'http://127.0.0.1:' + str(server.server_port)
                results = []
                for width, height in ((320,740), (390,844), (768,1024), (980,800), (981,800),
                                      (1024,768), (1280,900), (1505,992), (1728,890),
                                      (1920,1080), (2560,1440), (1366,600)):
                    result = test_directory(browser, url, width, height)
                    results.append(result)
                    print('PASS', json.dumps(result), flush=True)
                result = test_directory(browser, url, 1440, 900, reduced_motion='no-preference')
                results.append(result)
                print('PASS', json.dumps(result), flush=True)
                if OUT:
                    (OUT / 'results.json').write_text(json.dumps(results, indent=2), encoding='utf-8')
            finally:
                browser.close()
    finally:
        server.shutdown()
        server.server_close()


if __name__ == '__main__':
    main()
