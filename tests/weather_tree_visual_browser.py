"""Browser regression for seasonal tree, lighthouse and weather controls.

Run: python tests/weather_tree_visual_browser.py
Uses real checked-in UI files with inline CSS/JS and SVG data URLs, without
requiring a weather API or network connection.
"""
from pathlib import Path
from base64 import b64encode
import json
import re
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
WEATHER = ROOT / 'weather'
checks = []

def check(name, ok):
    assert ok, name
    checks.append(name)

def inline_fixture():
    html = (WEATHER / 'index.html').read_text(encoding='utf-8')
    for name in ['style.css', 'seamless.css', 'landscape.css', 'tree.css']:
        value = (WEATHER / name).read_text(encoding='utf-8')
        pattern = r'<link rel="stylesheet" href="' + re.escape(name) + r'[^"]*">'
        html, count = re.subn(pattern, lambda _: '<style>' + value + '</style>', html)
        check('Inline CSS ' + name, count == 1)
    for name in ['model.js', 'tree-art.js', 'scene.js', 'view.js']:
        value = (WEATHER / name).read_text(encoding='utf-8').replace('</script', '<\\/script')
        pattern = r'<script src="' + re.escape(name) + r'[^"]*"></script>'
        html, count = re.subn(pattern, lambda _: '<script>' + value + '</script>', html)
        check('Inline JS ' + name, count == 1)
    assets = {
        name: 'data:image/svg+xml;base64,' + b64encode((WEATHER / 'assets' / name).read_bytes()).decode()
        for name in ['tree-trunk.svg', 'tree-mountains.svg', 'tree-hill.svg']
    }
    html = html.replace("assetURL:'assets/lighthouse.avif'",
                        "assetURL:'https://assets.invalid/lighthouse.avif'")
    html = html.replace('const asset=name=>new URL(name,base).href;',
                        'const asset=name=>globalThis.__treeAssets[name] || new URL(name,base).href;')
    setup = '<script>window.__treeAssets=' + json.dumps(assets) + ';window.fetch=()=>Promise.reject(new TypeError("offline fixture"));</script>'
    return html.replace('</head>', setup + '</head>')

def run():
    html = inline_fixture()
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True)
        for width in [360, 390, 768, 1024, 1600]:
            page = browser.new_page(viewport={'width': width, 'height': 900}, reduced_motion='reduce')
            errors = []
            page.on('pageerror', lambda e: errors.append(str(e)))
            page.set_content(html, wait_until='domcontentloaded')
            page.wait_for_selector('.ww-app')
            page.locator('[data-subject="tree"]').click()
            check(f'{width}: switched to tree', page.locator('.ww-scene').get_attribute('data-subject') == 'tree')
            original_temp = page.locator('.ww-temperature').inner_text()
            for month, season in [(1,'winter'), (4,'spring'), (7,'summer'), (10,'autumn'), (11,'autumn')]:
                page.locator(f'[data-preview-month="{month}"]').click()
                check(f'{width}: month {month} season', page.locator('.ww-scene').get_attribute('data-season') == season)
                check(f'{width}: month {month} preserves forecast', page.locator('.ww-temperature').inner_text() == original_temp)
            page.locator('[data-preview-month="1"]').click()
            check(f'{width}: winter without leaves', page.locator('.ww-tree-leaves').count() == 0)
            page.locator('[data-preview-month="10"]').click()
            check(f'{width}: autumn leaves visible', page.locator('.ww-tree-leaves g').count() > 600)
            page.locator('.ww-tree-preview [data-scene-weather="snow"]').click()
            check(f'{width}: snow weather', page.locator('.ww-app').get_attribute('data-weather') == 'snow')
            page.locator('.ww-tree-preview [data-scene-phase="night"]').click()
            check(f'{width}: night phase', page.locator('.ww-app').get_attribute('data-phase') == 'night')
            check(f'{width}: reduced motion stops leaves',
                  page.locator('.ww-tree-falling-leaf').first.evaluate('e=>getComputedStyle(e).animationName') == 'none')
            page.locator('[data-subject="lighthouse"]').click()
            check(f'{width}: switch back to lighthouse',
                  page.locator('.ww-scene').get_attribute('data-subject') == 'lighthouse')
            check(f'{width}: lighthouse not hidden',
                  page.locator('.ww-tower-wrap').evaluate('e=>getComputedStyle(e).display') != 'none')
            check(f'{width}: no document horizontal overflow',
                  page.evaluate('document.documentElement.scrollWidth <= document.documentElement.clientWidth + 2'))
            check(f'{width}: no runtime errors', not errors)
            page.close()
        browser.close()
    print(len(checks), 'weather tree browser checks PASS')

if __name__ == '__main__':
    run()
