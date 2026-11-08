"""Both weather compositions fit the viewport without clipping controls.

The fixture and local routes are shared with the artwork parity test. These are
layout tests, not screenshot goldens: hiding overflow cannot make out-of-bounds
controls pass. The hourly strip may scroll horizontally and the 14-day list may
scroll internally, as before. Small screens must retain usable document scroll.
Set CHROMIUM_PATH for a custom browser and AYYY_VISUAL_OUTPUT for screenshots.
"""
import json
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright
from weather_v5_visual_browser import BASE, CHROME, OUT, ROOT, attach


def settle(page):
    """Wait for layout/ResizeObserver work, including a fit after fonts load."""
    page.evaluate("""async () => {
      await document.fonts.ready;
      let previous = '', stable = 0;
      for (let frame = 0; frame < 120; frame++) {
        await new Promise(requestAnimationFrame);
        const signature = JSON.stringify([
          document.documentElement.scrollWidth, document.documentElement.scrollHeight,
          ...['.ww-page', '.ww-scene-controls', '.ww-hourly', '.ww-footer'].map(selector => {
            const r = document.querySelector(selector).getBoundingClientRect();
            return [r.x, r.y, r.width, r.height];
          })
        ]);
        stable = signature === previous ? stable + 1 : 0;
        if (stable >= 5) return;
        previous = signature;
      }
      throw new Error('Weather layout did not settle after viewport change');
    }""")


def inspect(page):
    return page.evaluate("""() => {
      const problems = [], bounds = {}, app = document.querySelector('.ww-app');
      const inside = r => r.width > 0 && r.height > 0 && r.left >= -1 && r.top >= -1
        && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1;
      const name = e => e.id ? '#' + e.id : e.outerHTML.slice(0, 140);
      const rect = e => {
        const r = e.getBoundingClientRect();
        return {x:r.x, y:r.y, width:r.width, height:r.height, right:r.right, bottom:r.bottom};
      };
      const visible = e => {
        const s = getComputedStyle(e), r = e.getBoundingClientRect();
        return s.display !== 'none' && s.visibility === 'visible' && Number(s.opacity) > 0
          && r.width > 0 && r.height > 0;
      };
      for (const selector of ['.ww-header', '.ww-topline', '.ww-current', '.ww-period',
        '.ww-scene-controls', '.ww-hourly', '.ww-scene-adjustments', '.ww-hourly-foot', '.ww-footer']) {
        const e = document.querySelector(selector);
        bounds[selector] = e && rect(e);
        if (!e || !visible(e) || !inside(e.getBoundingClientRect()))
          problems.push({selector, reason:'section outside viewport or hidden', rect:bounds[selector]});
      }
      for (const [selector, count] of [['[data-theme]', 2], ['[data-scene-weather]', 6],
        ['[data-scene-phase]', 4], ['[data-scene-month]', 12], ['[data-season]', 4]]) {
        if (app.querySelectorAll(selector).length !== count)
          problems.push({selector, reason:'missing public controls'});
      }
      const controls = app.querySelectorAll('[data-theme], [data-scene-weather], '
        + '[data-scene-phase], [data-scene-month], [data-season], [data-period], '
        + '#ww-scene-minute, #ww-cycle, #ww-scene-intensity, #ww-scene-wind, #ww-flashes, '
        + '#ww-now-button, #ww-pause-button, .ww-units button, .ww-city-search, '
        + '.ww-chart-tabs button, .ww-chart-arrows button, [data-action="about"]');
      for (const e of controls) {
        const r = e.getBoundingClientRect();
        if (!visible(e) || !inside(r)) {
          problems.push({selector:name(e), reason:'control outside viewport or hidden', rect:rect(e)});
          continue;
        }
        const target = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
        if (!target || !(e === target || e.contains(target)))
          problems.push({selector:name(e), reason:'control occluded', target:target && name(target)});
        // A visible rectangle can still be clipped by an ancestor. Exclude the
        // intentionally horizontal hourly chart; none of these controls live in it.
        for (let ancestor = e.parentElement; ancestor; ancestor = ancestor.parentElement) {
          const s = getComputedStyle(ancestor), a = ancestor.getBoundingClientRect();
          if (['hidden', 'clip', 'auto', 'scroll'].includes(s.overflowY)
            && (r.top < a.top - 1 || r.bottom > a.bottom + 1)) {
            problems.push({selector:name(e), reason:'control vertically clipped', ancestor:name(ancestor)});
            break;
          }
        }
      }
      const root = document.documentElement, theme = app.dataset.sceneTheme || 'lighthouse';
      const scene = app.querySelector(theme === 'tree' ? '.ww-tree-scene' : '#ww-scene');
      const tower = scene?.querySelector('.ww-tower');
      const canvas = [...(scene?.querySelectorAll('canvas') || [])].map(c => ({
        width:c.width, height:c.height, rect:rect(c)
      }));
      return {viewport:[innerWidth, innerHeight], dpr:devicePixelRatio,
        document:[root.scrollWidth, root.scrollHeight], scroll:[scrollX, scrollY],
        theme, fitMode:app.dataset.viewportFit, uiScale:Number(app.style.getPropertyValue('--ww-ui-scale')) || 1,
        scene:scene && rect(scene), sceneVisible:!!scene && visible(scene),
        tower:tower && {rect:rect(tower), visible:visible(tower), naturalWidth:tower.naturalWidth, source:tower.currentSrc},
        treeLayers:app.querySelectorAll('.ww-tree-scene').length,
        problems, bounds, canvas, geometry:theme === 'tree' ? window.__tree?.inspect().treeGeometry : null};
    }""")


def check_fit(page, label):
    settle(page)
    result = inspect(page)
    if OUT:
        page.screenshot(path=str(OUT / f'viewport-{label}.png'), full_page=True)
        (OUT / f'viewport-{label}.json').write_text(json.dumps(result, ensure_ascii=False, indent=2))
    width, height = result['viewport']
    assert result['document'][0] <= width + 1, (label, 'horizontal document overflow', result)
    assert result['document'][1] <= height + 1, (label, 'vertical document overflow', result)
    assert not result['problems'], (label, result['problems'])
    assert result['fitMode'] == 'fit', (label, 'desktop fitting did not activate')
    assert result['sceneVisible'], (label, 'active scene is hidden')
    scene = result['scene']
    assert scene['x'] <= 0 and scene['right'] >= width - 1 and scene['y'] <= 0 and scene['bottom'] >= height - 1, (label, 'scene leaves viewport uncovered', scene)
    assert len(result['canvas']) == (3 if result['theme'] == 'tree' else 1), (label, 'missing scene layers')
    if result['theme'] == 'lighthouse':
        tower = result['tower']
        assert result['treeLayers'] == 0, (label, 'tree scene remains after switching to lighthouse')
        assert tower and tower['visible'] and tower['naturalWidth'] > 0, (label, 'lighthouse image is missing or undecoded')
        assert urlsplit(tower['source']).path.endswith('/assets/lighthouse.avif'), (label, 'original lighthouse image replaced', tower['source'])
        r = tower['rect']
        assert r['x'] >= -1 and r['y'] >= -1 and r['right'] <= width + 1 and r['bottom'] <= height + 1, (label, 'lighthouse is cropped outside viewport', r)
    for canvas in result['canvas']:
        r = canvas['rect']
        assert r['x'] <= 0 and r['right'] >= width - 1, (label, 'canvas leaves a side uncovered', canvas)
        assert r['y'] <= 0 and r['bottom'] >= height - 1, (label, 'canvas does not cover viewport', canvas)
        # Every case is at or below 4K physical pixels. In particular a
        # 1920x1080 CSS viewport at DPR 2 must have a real 3840x2160 backing.
        assert canvas['width'] >= int(width * min(result['dpr'], 2)) - 1, (label, 'canvas is a low-resolution scaled bitmap', canvas)
        assert canvas['height'] >= int(height * min(result['dpr'], 2)) - 1, (label, 'canvas is vertically undersampled', canvas)
    # A real attempt to scroll also catches a stale document height after zoom.
    page.evaluate('scrollTo(0, innerHeight)')
    assert page.evaluate('scrollY') == 0, (label, 'desktop still scrolls')
    print('PASS viewport', label, result['theme'], result['viewport'], 'canvas', result['canvas'][0]['width'], flush=True)
    return result


def wait_theme(page, theme):
    page.wait_for_function("""theme => {
      const button = document.querySelector('.ww-theme-switch [data-theme="' + theme + '"]');
      const tower = document.querySelector('#ww-scene .ww-tower');
      return button?.getAttribute('aria-pressed') === 'true'
        && document.querySelector('#ww-source-status')?.dataset.status === 'live'
        && (theme === 'tree' ? window.__tree?.ready : tower?.complete && tower.naturalWidth > 0);
    }""", arg=theme)


def open_weather(page, standalone=False, theme='tree'):
    attach(page, ROOT, theme=theme)
    page.goto(BASE + ('weather/' if standalone else '#weather'))
    wait_theme(page, theme)


def switch_theme(page, theme):
    page.locator('.ww-theme-switch [data-theme="' + theme + '"]').click()
    wait_theme(page, theme)


def check_small_scroll(page, label):
    settle(page)
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1'), (label, 'small-screen horizontal overflow')
    assert page.evaluate('document.documentElement.scrollHeight > innerHeight'), (label, 'small-screen content was clipped instead of scrollable')
    assert page.locator('.ww-app').get_attribute('data-viewport-fit') == 'scroll', (label, 'desktop fit remained active')
    assert page.locator('.ww-app').evaluate("e => (Number(e.style.getPropertyValue('--ww-ui-scale')) || 1) === 1"), (label, 'small screen retained desktop scale')
    for selector in ['.ww-theme-switch [data-theme="lighthouse"]', '.ww-theme-switch [data-theme="tree"]',
                     '#ww-scene-minute', '[data-scene-month="11"]', '#ww-scene-wind', '#ww-now-button',
                     '#ww-pause-button', '.ww-footer [data-action="about"]']:
        page.locator(selector).scroll_into_view_if_needed()
        assert page.locator(selector).is_visible(), (label, 'control missing', selector)
        assert page.locator(selector).evaluate('''e => {
          const r=e.getBoundingClientRect(), target=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
          return r.top >= -1 && r.bottom <= innerHeight + 1 && !!target && (e===target || e.contains(target));
        }'''), (label, 'control unreachable or occluded', selector)
    print('PASS small-screen scrolling and lower controls', label, flush=True)


def check_lighthouse_viewports(browser, errors):
    cases = [('desktop', 1920, 940, 1), ('compact', 1024, 768, 1),
             ('4k', 3840, 2160, 1), ('hidpi', 1920, 1080, 2)]
    for label, width, height, dpr in cases:
        context = browser.new_context(viewport={'width':width, 'height':height}, device_scale_factor=dpr, reduced_motion='reduce')
        page = context.new_page()
        page.set_default_timeout(30000)
        page.on('pageerror', lambda error: errors.append(str(error)))
        open_weather(page, standalone=label == 'compact', theme='lighthouse')
        check_fit(page, 'lighthouse-' + label)
        if label == 'desktop':
            switch_theme(page, 'tree')
            check_fit(page, 'lighthouse-to-tree')
            switch_theme(page, 'lighthouse')
            check_fit(page, 'tree-to-lighthouse')
            for width, height in [(959, 768), (960, 539), (390, 844)]:
                page.set_viewport_size({'width':width, 'height':height})
                check_small_scroll(page, f'lighthouse-{width}x{height}')
            switch_theme(page, 'tree')
            check_small_scroll(page, 'lighthouse-to-tree-mobile')
            page.set_viewport_size({'width':1920, 'height':940})
            check_fit(page, 'mobile-to-desktop-tree')
            switch_theme(page, 'lighthouse')
            check_fit(page, 'mobile-to-desktop-lighthouse')
        context.close()


def check_cloud_continuity(page, label):
    # The old third cloud texture began at CSS y=24 with an opaque first row.
    # Read the rendered sky layer, independent of foreground text and panels.
    # Rain/day produces the high cloud opacity that made this line conspicuous.
    result = page.evaluate("""() => {
      __tree.time = 0;
      __tree.draw(0);
      const canvas = document.querySelector('.ww-tree-scene [data-layer="sky"]');
      const dpr = canvas.width / canvas.getBoundingClientRect().width;
      const w = canvas.width, h = Math.ceil(96 * dpr);
      const pixels = canvas.getContext('2d').getImageData(0, 0, w, h).data;
      let maxJump = 0, row = 0;
      for (let y = 1; y < h; y++) {
        let jump = 0;
        for (let x = 0; x < w; x++) for (let c = 0; c < 3; c++)
          jump += Math.abs(pixels[(y * w + x) * 4 + c] - pixels[((y - 1) * w + x) * 4 + c]);
        jump /= w * 3;
        if (jump > maxJump) { maxJump = jump; row = y / dpr; }
      }
      const uiScale = __tree.g.uiScale || 1;
      // Downscaling compresses a smooth ramp into fewer pixels. Upscaling
      // cannot remove 8-bit RGB quantization, which may still step by one.
      return {maxJump, row, uiScale, dpr, normalized:maxJump * Math.min(1, uiScale * dpr)};
    }""")
    assert result['normalized'] < 1.25, (label, 'horizontal cloud strip is visible', result)
    print('PASS rendered sky continuity', label, result, flush=True)


def check_panorama_continuity(page, label):
    # Both original panoramas contain baked joins at source x=150 and x=1300.
    # Measure the final world layer so this also catches accidentally rendering
    # the original PNGs even while the preparation helper itself still works.
    scores = page.evaluate("""() => {
      const r = __tree, g = r.g, envScale = Math.max(g.w / 1450, g.scale);
      const envX = Math.max(g.w - 1672 * envScale, Math.min(0, g.rootX - 736 * envScale));
      const envY = g.baseY - 578 * envScale, canvas = r.canvases[1];
      const dpr = canvas.width / g.w;
      const low = Math.max(0, Math.floor((envY + 434 * envScale) * dpr));
      const high = Math.min(canvas.height, Math.ceil((envY + 719 * envScale) * dpr), Math.floor((g.artBottom + 40) * dpr));
      return [150, 1300].map(join => {
        const cx = Math.floor((envX + join * envScale) * dpr), radius = Math.ceil(envScale * dpr);
        const left = cx - radius - 1, width = 2 * radius + 3, height = high - low;
        if (left < 0 || left + width > canvas.width || height <= 0)
          throw new Error('Panorama join is outside its expected visible sampling region');
        const pixels = r.ctx[1].getImageData(left, low, width, height).data;
        let maxDelta = 0;
        for (let x = 1; x < width; x++) {
          let delta = 0;
          for (let y = 0; y < height; y++) {
            const a = (y * width + x - 1) * 4, b = a + 4;
            for (let channel = 0; channel < 3; channel++)
              delta += Math.abs(pixels[a + channel] * pixels[a + 3] / 255 - pixels[b + channel] * pixels[b + 3] / 255);
            delta += Math.abs(pixels[a + 3] - pixels[b + 3]);
          }
          maxDelta = Math.max(maxDelta, delta / (height * 4));
        }
        return {join, normalized:maxDelta * envScale * dpr};
      });
    }""")
    assert all(score['normalized'] < 1 for score in scores), (label, 'panorama join is visible', scores)
    print('PASS rendered panorama continuity', label, scores, flush=True)


if __name__ == '__main__':
    # DPR is separate from CSS width. The last two cases model the CSS viewport
    # and device scale produced by desktop browser zoom / a high-DPI 4K display.
    cases = [
        ('compact-desktop', 1024, 768, 1),
        ('short-desktop', 1280, 600, 1),
        ('laptop-720', 1280, 720, 1),
        ('laptop-768', 1366, 768, 1),
        ('laptop-chrome', 1366, 650, 1),
        ('desktop-900', 1440, 900, 1),
        ('full-hd', 1920, 1080, 1),
        ('full-hd-chrome', 1920, 940, 1),
        ('wide-1050', 2048, 1050, 1),
        ('qhd', 2560, 1440, 1),
        ('4k', 3840, 2160, 1),
        ('zoom-125', 1536, 864, 1.25),
        ('zoom-125-chrome', 1536, 752, 1.25),
        ('zoom-150-chrome', 1280, 627, 1.5),
        ('4k-hidpi', 1920, 1080, 2),
    ]
    errors = []
    with sync_playwright() as pw:
        browser = pw.chromium.launch(executable_path=CHROME, args=['--no-sandbox', '--disable-dev-shm-usage'])
        for label, width, height, dpr in cases:
            context = browser.new_context(viewport={'width':width, 'height':height}, device_scale_factor=dpr, reduced_motion='reduce')
            page = context.new_page()
            page.set_default_timeout(30000)
            page.on('pageerror', lambda error: errors.append(str(error)))
            open_weather(page, standalone=label == 'qhd')
            check_fit(page, label)
            if label == 'full-hd':
                page.locator('[data-scene-weather="rain"]').click()
                page.locator('[data-scene-phase="day"]').click()
                page.locator('[data-period="14"]').click()
                check_fit(page, label + '-manual-14-days')
                check_cloud_continuity(page, label)
                check_panorama_continuity(page, label)
                page.locator('[data-period="7"]').click()
                # Resize in one live session to exercise fitting and renderer
                # resizes, not just the initial mount at a lucky screen size.
                for new_width, new_height in [(3840, 2160), (1366, 768), (1920, 1080)]:
                    page.set_viewport_size({'width':new_width, 'height':new_height})
                    check_fit(page, f'resize-{new_width}x{new_height}')
                    check_cloud_continuity(page, f'resize-{new_width}x{new_height}')
                    if new_width == 3840:
                        check_panorama_continuity(page, '4k')
            context.close()

        check_lighthouse_viewports(browser, errors)

        # On genuinely small screens nothing is cropped to force a one-screen
        # dashboard. The bottom settings and footer remain reachable by scroll.
        context = browser.new_context(viewport={'width':390, 'height':844}, reduced_motion='reduce')
        page = context.new_page()
        page.set_default_timeout(30000)
        page.on('pageerror', lambda error: errors.append(str(error)))
        open_weather(page)
        check_small_scroll(page, 'tree-mobile')
        context.close()
        browser.close()
    assert not errors, errors
    print('Viewport fit, 4K resolution, live resizing and small-screen reachability PASS')
