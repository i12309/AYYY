"""Exercise catalogue, alias, unit and provenance controls through real imports."""
from pathlib import Path
from urllib.parse import unquote, urlsplit
import mimetypes

from playwright.sync_api import sync_playwright
from health_browser_support import launch_browser

ROOT = Path(__file__).resolve().parents[1]
BASE = 'http://127.0.0.1:8877/'
PHRASE = 'synthetic-catalogue-phrase'
HEADER = 'name;value;unit;material;method;date\n'


def run(page):
    def lab():
        page.locator('.sidebar button[data-tab=lab]').click()

    def import_file(name, rows, match=None):
        lab()
        with page.expect_file_chooser() as chooser:
            page.locator('[data-action=csv]').click()
        chooser.value.set_files({'name':name,'mimeType':'text/csv','buffer':(HEADER+rows).encode()})
        page.locator('[data-form=document-mapping] [type=submit]').click()
        review = page.locator('[data-form=document-review]')
        review.wait_for()
        if match:
            assert match in review.locator('.import-classification').first.inner_text()
        review.locator('[type=submit]').click()
        page.locator('#health-dialog').wait_for(state='hidden')

    def open_record(filename):
        lab()
        page.locator('#health-global-search').fill(filename)
        page.locator('#health-root [data-kind=lab][data-action=open-group]').click()
        page.locator('.analyte-page').wait_for()

    def save_settings(form):
        page.locator('#health-notice').evaluate('(notice)=>notice.textContent=""')
        form.locator('[type=submit]').click()
        page.get_by_text('Настройки показателя сохранены.',exact=True).wait_for()

    def alias(scope, target, reason, search=''):
        page.locator('.classification-settings > summary').click()
        form = page.locator('[data-form=analyte-alias]')
        form.locator('[name=scope]').select_option(scope)
        if search:
            form.locator('[name=catalogSearch]').fill(search)
            assert form.locator('[name=target] option').count() < 125
        form.locator('[name=target]').select_option(target)
        form.locator('[name=reason]').fill(reason)
        save_settings(form)

    def default_unit(unit, reason):
        page.locator('.analyte-settings > summary').click()
        form = page.locator('[data-form=analyte-default-unit]')
        form.locator('[name=unit]').fill(unit)
        form.locator('[name=reason]').fill(reason)
        save_settings(form)

    def snapshot():
        return page.evaluate("""async phrase=>{
          const entry=await HumanStore.get(await HumanStore.current());
          return (await HumanCrypto.unlock(entry.envelope,phrase)).doc;
        }""",PHRASE)

    page.goto(BASE+'health/')
    form = page.locator('[data-form=create]')
    form.locator('[name=password]').fill(PHRASE)
    form.locator('[name=repeat]').fill(PHRASE)
    form.locator('[type=submit]').click()
    page.locator('.metric').first.wait_for()
    assert page.evaluate('HumanAnalytes.catalog.length') == 125

    import_file('lab-a.csv','xy-17;4;U/L;serum;M1;2026-11-01\n','Название из бланка')
    open_record('lab-a.csv')
    alias('name','alt','Synthetic shared alias','аланин')
    assert 'АЛТ' in page.locator('.analyte-origin').inner_text()
    import_file('lab-b.csv','xy-17;5;U/L;serum;M1;2026-11-02\n','АЛТ')
    open_record('lab-a.csv')
    alias('document','ast','Synthetic document alias','аспартат')
    assert 'АСТ' in page.locator('.analyte-origin').inner_text()
    open_record('lab-b.csv')
    assert 'АЛТ' in page.locator('.analyte-origin').inner_text()
    open_record('lab-a.csv')
    alias('document','','Synthetic reset')
    assert 'АЛТ' in page.locator('.analyte-origin').inner_text()
    history = page.locator('.classification-history')
    assert 'Synthetic document alias' in history.text_content()
    saved = snapshot()
    assert saved['observations'][0]['name'] == 'xy-17'
    assert saved['observations'][0]['provenance']['classification']['basis'] == 'source'
    assert saved['observations'][1]['provenance']['classification']['id'] == 'alt'
    print('PASS scoped and shared aliases preserve original names and apply to new imports',flush=True)

    import_file('other-context.csv','ALT;6;IU/L;urine;M1;2026-11-03\nALT;7;kU/L;serum;M2;2026-11-04\n','АЛТ')
    import_file('missing-unit.csv','ALT;8;;serum;M1;2026-11-05\n','АЛТ')
    open_record('missing-unit.csv')
    choice = page.locator('[data-form=analyte-unit] [name=unit]')
    assert choice.locator('option').all_text_contents() == ['Выберите единицу','U/L · из истории']
    default_unit('U/L','Synthetic default reason')
    assert choice.locator('option').all_text_contents() == ['Выберите единицу','U/L · из настроек']
    choice.select_option('U/L')
    page.locator('[data-form=analyte-unit] [type=submit]').click()
    page.locator('[data-action=clear-history-unit]').wait_for()
    measured = snapshot()['observations'][-1]
    assert measured['unit'] == '' and measured['unitHistory']['settingsVersion'] == 1
    assert 'Synthetic default reason' in page.locator('.analyte-origin').inner_text()
    assert '8 U/L' in page.locator('.analyte-history').inner_text()
    page.locator('[data-action=clear-history-unit]').click()
    choice.wait_for()
    default_unit('','Synthetic clear default')
    choice.select_option('U/L')
    page.locator('[data-form=analyte-unit] [type=submit]').click()
    page.locator('[data-action=clear-history-unit]').wait_for()
    measured = snapshot()['observations'][-1]
    assert measured['unit'] == '' and measured['unitHistory']['observationId']
    print('PASS explicit units use compatible settings or history and leave source values untouched',flush=True)

    lab()
    page.locator('[data-search=labs]').fill('alat')
    favorites = page.locator('[data-action=toggle-favorite]')
    assert favorites.count() == 3
    favorites.first.click()
    page.wait_for_function("() => document.querySelectorAll('.favorite-toggle[aria-pressed=true]').length === 3")
    page.locator('[data-action=filter-favorites]').click()
    assert favorites.count() == 3
    page.reload()
    unlock = page.locator('[data-form=unlock]')
    unlock.locator('[name=passphrase]').fill(PHRASE)
    unlock.locator('[type=submit]').click()
    page.locator('.metric').first.wait_for()
    open_record('missing-unit.csv')
    assert 'Из измерения' in page.locator('.analyte-origin').inner_text()
    page.locator('.classification-settings > summary').click()
    page.set_viewport_size({'width':360,'height':900})
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    print('PASS search, favorites, reload and mobile review',flush=True)

    page.set_viewport_size({'width':1440,'height':900})
    import_file('date-filter.csv','Period marker;10;mg;;;2026-10-03\n'
        'Period marker;20;mg;;;2026-10\nPeriod marker;30;mg;;;2026-11-01\nPeriod marker;40;mg;;;\n')
    page.locator('[data-search=labs]').fill('Period marker')
    start, end = page.locator('[data-lab-date=labFrom]'), page.locator('[data-lab-date=labTo]')
    start.fill('2026-10-03')
    end.fill('2026-10-03')
    results = page.locator('.analyte-groups tbody tr')
    assert results.count() == 1
    assert '15' in results.locator('td').nth(2).inner_text() and '2 из 2' in results.locator('td').nth(2).inner_text()
    results.locator('.group-name').click()
    assert page.locator('.analyte-history tbody tr').count() == 4
    page.locator('[data-action=lab-results]').click()
    assert start.input_value() == end.input_value() == '2026-10-03'
    end.fill('2026-10-02')
    assert page.get_by_role('alert').filter(has_text='Конец периода').is_visible()
    page.locator('[data-action=lab-reset]').click()
    assert not start.input_value() and not end.input_value()

    import_file('pagination.csv',''.join(f'Page marker {i:02};{i};mg;;;2026-10-03\n' for i in range(51)))
    page.locator('[data-search=labs]').fill('Page marker')
    assert results.count() == 50 and '51' in page.locator('.grouped-labs .pager').inner_text()
    page.get_by_role('button',name='Далее',exact=True).click()
    assert results.count() == 1 and 'Page marker 50' in results.inner_text()
    assert page.get_by_role('button',name='Далее',exact=True).is_disabled()
    page.get_by_role('button',name='Назад',exact=True).click()
    assert results.count() == 50 and page.get_by_role('button',name='Назад',exact=True).is_disabled()
    page.set_viewport_size({'width':360,'height':900})
    assert page.locator('.labs-mode').evaluate('(e)=>e.scrollWidth<=e.clientWidth')
    print('PASS inclusive dates, partial dates, unfiltered detail, and 50-result pages',flush=True)


if __name__ == '__main__':
    with sync_playwright() as playwright:
        browser = launch_browser(playwright)
        context = browser.new_context(viewport={'width':1440,'height':1000})
        remote, errors = [], []
        def serve(route):
            if not route.request.url.startswith(BASE):
                remote.append(route.request.url)
                route.abort()
                return
            file = (ROOT/unquote(urlsplit(route.request.url).path).lstrip('/')).resolve()
            if file.is_dir():
                file /= 'index.html'
            if ROOT in file.parents and file.is_file():
                route.fulfill(body=file.read_bytes(),content_type=mimetypes.guess_type(file)[0] or 'text/plain')
            else:
                route.fulfill(status=404)
        context.route('**/*',serve)
        page = context.new_page()
        page.on('pageerror',lambda error:errors.append(str(error)))
        run(page)
        assert not remote and not errors,(remote,errors)
        browser.close()
