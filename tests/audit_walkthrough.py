"""Regression coverage for the second, detailed UI audit (real browser controls)."""
import os
import sys
from playwright.sync_api import sync_playwright
base = (sys.argv[1] if len(sys.argv)>1 else 'http://127.0.0.1:8000').rstrip('/')
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':390,'height':844})
    errors=[]; failed=[]; external=[]
    page.on('pageerror',lambda error:errors.append(str(error)))
    page.on('requestfailed',lambda request:failed.append(request.url))
    page.on('request',lambda request:external.append(request.url) if not request.url.startswith(base) else None)
    page.goto(base,wait_until='networkidle')
    page.evaluate('document.fonts.ready')
    assert not page.locator('#catalog-loading').is_visible()
    assert not external, external
    assert not failed, failed
    assert page.evaluate('document.fonts.check("400 16px DM Sans")')
    # Pointer clicks have no extra focus box; Tab still exposes keyboard focus.
    page.locator('#group-select').click(); page.keyboard.press('Escape')
    assert page.locator('#group-select').evaluate('e=>getComputedStyle(e).outlineStyle')=='none'
    page.locator('#catalog-search').click()
    assert page.locator('#catalog-search').evaluate('e=>getComputedStyle(e).boxShadow')=='none'
    page.keyboard.press('Tab')
    assert page.evaluate('getComputedStyle(document.activeElement).outlineStyle')=='solid'
    page.reload(wait_until='networkidle')
    # Desktop column eyebrows share the same top line.
    page.set_viewport_size({'width':1440,'height':1000})
    left=page.locator('.catalog-heading .eyebrow').bounding_box()
    right=page.locator('#food-picker > .eyebrow').bounding_box()
    assert abs(left['y']-right['y'])<1
    page.set_viewport_size({'width':390,'height':844})
    # The skip link must transfer keyboard focus into the catalog.
    page.keyboard.press('Tab'); assert page.locator('.skip-link').evaluate('(el)=>el===document.activeElement')
    page.keyboard.press('Enter'); assert page.evaluate('document.activeElement.id')=='browse'
    # Page two must select a visible food when the user presses Enter.
    page.locator('[data-page-action=next]').click()
    visible_id=page.locator('.result-card').first.get_attribute('data-food-id')
    page.locator('#catalog-search').focus(); page.keyboard.press('Enter')
    assert page.locator('.result-card[aria-pressed=true]').get_attribute('data-food-id')==visible_id
    assert page.locator('#amount-input').evaluate('(el)=>el===document.activeElement')
    # A punctuation-only or non-Latin query must not expose the entire catalog.
    for query in ['!!!','—','不存在的食品']:
        page.locator('#catalog-search').fill(query)
        assert page.locator('#empty-state').is_visible(),query
        assert not page.locator('#food-picker').is_visible()
    page.locator('#clear-filters').click()
    assert page.locator('#catalog-search').input_value()==''
    assert page.locator('.result-card').count()>0
    assert not page.locator('.daily-label').is_visible()
    assert page.locator('#empty-day-preview').is_visible()
    values=page.locator('#group-select option').evaluate_all('(options)=>options.map(o=>o.value)')
    assert 'Pulses' in values and 'Legumes and Legume Products' not in values
    # Native portions retain their selected description until the amount changes.
    page.locator('#catalog-search').fill('carrots')
    page.locator('.result-card').first.click()
    option=page.locator('#source-portion option').nth(1)
    grams=option.get_attribute('value')
    page.locator('#source-portion').select_option(grams)
    assert page.locator('#source-portion').input_value()==grams
    assert float(page.locator('#amount-input').input_value())==float(grams)
    assert 'USDA reference portion:' in page.locator('#measure-provenance').inner_text()
    page.locator('#increase').click()
    assert page.locator('#source-portion').input_value()==''
    page.locator('#source-portion').select_option(grams)
    page.locator('#reset-measure').click()
    assert page.locator('#source-portion').input_value()==''
    assert page.locator('#amount-input').input_value()=='100'
    page.locator('#add-to-menu').click()
    assert page.locator('.daily-label').is_visible()
    assert not page.locator('#empty-day-preview').is_visible()
    page.locator('[data-menu-grams]').fill('-1')
    assert page.locator('.menu-item .row-error').is_visible()
    assert 'last valid' in page.locator('.menu-item .row-error').inner_text()
    page.locator('#clear-menu').click()
    assert page.locator('#empty-day-preview').is_visible()
    assert not page.locator('.daily-label').is_visible()
    assert not errors,errors
    # Failed data loading must explain itself and keep the main action disabled.
    broken=browser.new_page()
    broken.route('**/data/catalog-data.js',lambda route:route.abort())
    broken.goto(base,wait_until='networkidle')
    assert 'could not load' in broken.locator('#catalog-loading').inner_text()
    assert broken.locator('#lookup button').is_disabled()
    assert broken.locator('#add-to-menu').is_disabled()
    browser.close()
print('Detailed audit checks passed: local fonts, skip focus, page-aware Enter, query recovery, retained portions/reset, and failed catalog loading.')
