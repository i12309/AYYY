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

    def select_files(entries,header=HEADER):
        lab()
        with page.expect_file_chooser() as chooser:
            page.locator('[data-action=csv]').click()
        chooser.value.set_files([{'name':name,'mimeType':'text/csv','buffer':(header+rows).encode()} for name,rows in entries])

    def prepare_review():
        page.locator('[data-form=document-mapping] [type=submit]').click()
        review = page.locator('[data-form=document-review]')
        review.wait_for()
        return review

    def confirm_review(review):
        review.locator('[name=profileConfirmed]').check()
        review.locator('[type=submit]').click()

    def import_file(name, rows, match=None):
        select_files([(name,rows)])
        review = prepare_review()
        if match:
            assert match in review.locator('.import-classification').first.inner_text()
        confirm_review(review)
        page.wait_for_function("()=>!document.querySelector('#health-import-page') || !!document.querySelector('[data-form=document-review] [role=alert]:not([hidden])')")
        assert not page.locator('#health-import-page').count(), review.inner_text()

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
    measured = snapshot()['observations'][-1]
    assert measured['unit']=='' and measured['unitHistory']['unit']=='U/L' and measured['unitHistory']['observationId']
    assert measured['provenance']['originalUnit']==''
    open_record('missing-unit.csv')
    assert 'Единица в источнике' in page.locator('.analyte-origin').inner_text()
    page.locator('[data-action=clear-history-unit]').click()
    choice = page.locator('[data-form=analyte-unit] [name=unit]')
    choice.wait_for()
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
    assert page.locator('.health-import-resume').evaluate('(e)=>e.scrollWidth<=e.clientWidth')
    print('PASS inclusive dates, partial dates, unfiltered detail, and 50-result pages',flush=True)

    page.set_viewport_size({'width':1440,'height':1000})
    import_file('unit-source-a.csv','Synthetic unit match;10;U-A;serum;M1;2026-11-01\n')
    import_file('unit-source-b.csv','Synthetic unit match;20;U-B;serum;M1;2026-11-02\n')
    select_files([('unit-choice.csv','Synthetic unit match;30;;serum;M1;2026-11-03\n'
        'Synthetic unit match;31;;urine;M1;2026-11-04\nSynthetic unit match;qualitative;;serum;M1;2026-11-05\n'
        'Synthetic unit match;32;U-original;serum;M1;2026-11-06\n'),('other-draft.csv','Other marker;33;mg;;;2026-11-07\n')])
    unit_tab=page.get_by_role('tab',name='unit-choice.csv',exact=True)
    other_tab=page.get_by_role('tab',name='other-draft.csv',exact=True)
    unit_tab.click();review=prepare_review()
    hints=review.locator('[data-import-unit-info]')
    assert review.locator('[name="0:unit"]').input_value()==''
    assert hints.locator('[data-action=import-choose-unit]').all_text_contents()==['U-A','U-B']
    page.set_viewport_size({'width':360,'height':900})
    assert page.locator('#health-import-page').evaluate('(e)=>e.scrollWidth<=e.clientWidth')
    page.set_viewport_size({'width':1440,'height':1000})
    hints.get_by_role('button',name='U-B',exact=True).click()
    for row,expected in [(1,''),(2,''),(3,'U-original')]:
        review.locator(f'[data-import-row="{row}"]').click()
        assert review.locator(f'[name="{row}:unit"]').input_value()==expected and not hints.is_visible()
    review.locator('[data-import-row="0"]').click()
    page.locator('[data-action=save-import-draft]').click()
    page.get_by_text('Черновик зашифрован и сохранён на этом устройстве.',exact=True).wait_for()
    other_tab.click();page.locator('[data-form=document-mapping]').wait_for()
    page.reload();unlock.locator('[name=passphrase]').fill(PHRASE);unlock.locator('[type=submit]').click()
    page.locator('.metric').first.wait_for();lab();page.locator('[data-action=open-import-draft]').click()
    unit_tab.click()
    assert review.locator('[name="0:unit"]').input_value()=='U-B' and 'Из истории' in hints.inner_text()
    assert not review.locator('[name=profileConfirmed]').is_checked()
    confirm_review(review);page.get_by_text('Сохранено результатов: 4',exact=True).wait_for()
    imported={row['value']:row for row in snapshot()['observations'] if row.get('provenance',{}).get('filename')=='unit-choice.csv'}
    assert imported['30']['unit']=='' and imported['30']['unitHistory']['unit']=='U-B'
    assert all('unitHistory' not in imported[key] for key in ['31','qualitative','32'])
    assert imported['32']['unit']==imported['32']['provenance']['originalUnit']=='U-original'
    other_tab.click();confirm_review(prepare_review());page.get_by_text('Сохранено результатов: 1',exact=True).wait_for()
    page.locator('[data-action=close-import]').click()
    print('PASS compatible unit choices and explicit source units survive encrypted draft reload and import',flush=True)

    open_record('unit-source-a.csv');default_unit('U-setting','Synthetic preferred unit')
    select_files([('unit-settings.csv','Synthetic unit match;40;;serum;M1;2026-11-08\n')])
    review=prepare_review()
    unit=review.locator('[name="0:unit"]')
    assert unit.input_value()=='U-setting' and 'Из настроек показателя' in hints.inner_text()
    hints.locator('[data-action=import-clear-unit]').click()
    assert unit.input_value()==''
    page.locator('[data-action=save-import-draft]').click()
    page.get_by_text('Черновик зашифрован и сохранён на этом устройстве.',exact=True).wait_for()
    page.reload();unlock.locator('[name=passphrase]').fill(PHRASE);unlock.locator('[type=submit]').click()
    page.locator('.metric').first.wait_for();lab();page.locator('[data-action=open-import-draft]').click()
    assert unit.input_value()==''
    hints.get_by_role('button',name='U-setting',exact=True).click()
    review.get_by_text('Референс, лаборатория и дополнительные поля',exact=True).click()
    material=review.locator('[name="0:material"]')
    material.fill('urine')
    assert unit.input_value()=='' and not hints.is_visible()
    material.fill('serum')
    assert unit.input_value()==''
    hints.get_by_role('button',name='U-setting',exact=True).click()
    open_record('unit-source-a.csv');default_unit('U-new','Synthetic updated preferred unit')
    lab();page.locator('[data-action=continue-import]').click()
    confirm_review(review)
    review.locator('.health-import-row-editor .import-row-warning').filter(has_text='Единица из истории или настроек изменилась').wait_for()
    assert unit.input_value()=='' and not any(row['value']=='40' and row['name']=='Synthetic unit match' for row in snapshot()['observations'])
    hints.get_by_role('button',name='U-new',exact=True).click();confirm_review(review)
    page.locator('#health-import-page').wait_for(state='hidden')
    measured=snapshot()['observations'][-1]
    assert measured['value']=='40' and measured['unit']=='' and measured['unitHistory']['unit']=='U-new'
    assert measured['unitHistory']['settingsVersion']==2 and measured['provenance']['originalUnit']==''
    print('PASS settings take priority, clearing is respected, and a stale assignment requires a fresh choice',flush=True)

    simple='U/L 1,0 – 3,0 Оборудование Synthetic analyser'
    conditional='Группа A: 1–3.\nГруппа B: 4–6.'
    edited='5 - 9 Оборудование Synthetic edited'
    rows=(f'Synthetic reference simple;2;U/L;;;2026-11-01;"{simple}";;\n'
          f'Synthetic reference conditional;5;U/L;;;2026-11-02;"{conditional}";;\n'
          'Synthetic reference explicit;6;U/L;;;2026-11-03;2 - 4;0;10\n'
          'Synthetic reference edited;8;U/L;;;2026-11-04;7 - 9;;\n')
    select_files([('reference-source.csv',rows)],header=HEADER.rstrip('\n')+';Референсные значения;low;high\n')
    mapping=page.locator('[data-form=document-mapping]')
    assert mapping.locator('[name=referenceText]').input_value()=='6'
    review=prepare_review()

    def reference_fields(index):
        review.locator(f'[data-import-row="{index}"]').click()
        review.locator('.health-import-row-extra summary').click()
        return [review.locator(f'[name="{index}:{key}"]') for key in ('low','high','referenceText')]

    low,high,reference=reference_fields(0)
    assert [field.input_value() for field in (low,high,reference)]==['1,0','3,0',simple]
    review.locator('[name="0:unit"]').fill('U-X')
    assert low.input_value()==high.input_value()=='' and reference.input_value()==simple
    review.locator('[name="0:unit"]').fill('U/L')
    assert [low.input_value(),high.input_value()]==['1,0','3,0']
    low,high,reference=reference_fields(1)
    assert low.input_value()==high.input_value()=='' and reference.input_value()==conditional
    low,high,reference=reference_fields(2)
    assert [field.input_value() for field in (low,high,reference)]==['0','10','2 - 4']
    low,high,reference=reference_fields(3)
    low.fill('6');reference.fill(edited)
    assert high.input_value()=='9'
    page.locator('[data-action=save-import-draft]').click()
    page.get_by_text('Черновик зашифрован и сохранён на этом устройстве.',exact=True).wait_for()
    page.reload();unlock.locator('[name=passphrase]').fill(PHRASE);unlock.locator('[type=submit]').click()
    page.locator('.metric').first.wait_for();lab();page.locator('[data-action=open-import-draft]').click()
    assert review.locator('[data-import-row="3"]').get_attribute('aria-pressed')=='true'
    low,high,reference=reference_fields(3)
    assert [field.input_value() for field in (low,high,reference)]==['6','9',edited]
    confirm_review(review);page.locator('#health-import-page').wait_for(state='hidden')
    imported={row['name']:row for row in snapshot()['observations'] if row.get('provenance',{}).get('filename')=='reference-source.csv'}
    saved=imported['Synthetic reference conditional']
    assert saved['referenceText']==saved['provenance']['originalReference']==conditional and saved['low']==saved['high']==''
    assert imported['Synthetic reference simple']['low']=='1,0' and imported['Synthetic reference simple']['high']=='3,0'
    assert imported['Synthetic reference explicit']['low']=='0' and imported['Synthetic reference explicit']['high']=='10'
    saved_edit=imported['Synthetic reference edited']
    assert saved_edit['referenceText']==edited and saved_edit['provenance']['originalReference']=='7 - 9' and saved_edit['low']=='6'
    assert page.evaluate('''async phrase=>{
      const {envelope}=await HumanStore.get(await HumanStore.current()),{doc}=await HumanCrypto.unlock(envelope,phrase);
      return HumanRecommendations.data(doc).observations.find(row=>row.name==='Synthetic reference conditional').referenceText;
    }''',PHRASE)==conditional
    page.locator('[data-search=labs]').fill('Synthetic reference conditional')
    details=page.locator('.analyte-groups .measurement-reference-text')
    details.locator('summary').click()
    assert details.locator('p').text_content()==conditional and 'Без оценки' in page.locator('.analyte-groups').inner_text()
    page.locator('.group-name').click()
    panel=page.locator('.analyte-source')
    assert panel.locator('dd.preserve').text_content()==conditional
    page.set_viewport_size({'width':360,'height':900})
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    page.set_viewport_size({'width':1440,'height':1000})
    panel.locator('[data-action=edit]').click()
    form=page.locator('#health-dialog [data-form=record]')
    assert form.locator('[name=referenceText]').input_value()==conditional
    form.locator('[name=referenceText]').fill(conditional+'\nSynthetic clarification')
    form.locator('[type=submit]').click();page.locator('#health-dialog').wait_for(state='hidden')
    assert panel.locator('dd.preserve').text_content()==conditional+'\nSynthetic clarification'
    assert panel.locator('.analyte-origin .preserve').text_content()==conditional
    print('PASS source reference conditions, reviewed bounds and original wording survive import and journal editing',flush=True)


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
