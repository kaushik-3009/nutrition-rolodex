"""Run against a local static server: python3 tests/browser_smoke.py [base-url].
Requires Python Playwright and Chromium. No service is started or stopped here.
"""
import json
import os
import sys
from playwright.sync_api import sync_playwright

base = (sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:8000').rstrip('/')
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH', '/usr/bin/chromium'), args=['--no-sandbox'])
    page = browser.new_page(viewport={'width': 1440, 'height': 1000})
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    assert page.goto(base + '/', wait_until='networkidle').status == 200
    records = page.evaluate('window.PANTRY_CATALOG.length')
    assert records > 7000
    assert page.locator('.result-card').count() > 0
    # Exercise normal UI addition, merging, quantity editing, reload and undo.
    page.locator('[data-unit=g]').click()
    page.locator('#amount-input').fill('100')
    food_id = page.evaluate('selectedFood.id')
    expected = page.evaluate('selectedFood.per100g.calories.value')
    page.locator('#add-to-menu').click()
    assert float(page.locator('#day-calories').inner_text()) == round(expected)
    page.locator('#amount-input').fill('200')
    page.locator('#add-to-menu').click()
    assert page.locator('.menu-item').count() == 1
    assert float(page.locator('#day-calories').inner_text()) == round(expected * 3)
    page.reload(wait_until='networkidle')
    assert page.locator('[data-menu-grams]').input_value() == '300'
    page.locator('[data-menu-grams]').fill('100')
    page.locator('[data-menu-grams]').press('Tab')
    assert float(page.locator('#day-calories').inner_text()) == round(expected)
    page.locator('#clear-menu').click()
    assert page.locator('#day-calories').inner_text() == '—'
    page.locator('#undo-menu').click()
    assert page.locator('.menu-item').count() == 1
    with page.expect_download() as download_info:
        page.locator('#export-menu').click()
    with open(download_info.value.path()) as f:
        exported = json.load(f)
    assert exported['entries'][0]['foodId'] == food_id
    assert exported['entries'][0]['grams'] == 100
    # Invalid input must not corrupt saved totals; fix the input before proceeding.
    page.locator('[data-menu-grams]').fill('-10')
    page.locator('[data-menu-grams]').press('Tab')
    assert not page.locator('[data-menu-grams]').evaluate('(el) => el.validity.valid')
    assert float(page.locator('#day-calories').inner_text()) == round(expected)
    page.locator('[data-menu-grams]').fill('100')
    page.locator('[data-menu-grams]').press('Tab')
    # Invalid or huge single-food amounts cannot overflow arithmetic or add stale data.
    page.locator('#amount-input').fill('1e300')
    assert page.locator('#add-to-menu').is_disabled()
    assert page.locator('#amount-error').is_visible()
    page.locator('#amount-input').fill('100')
    assert not page.locator('#add-to-menu').is_disabled()
    # Search and source portions work on the large catalog.
    page.locator('#catalog-search').fill('rice')
    assert page.locator('.result-card').count() > 0
    page.locator('.result-card').first.click()
    assert 'rice' in page.locator('#detail-title').inner_text().lower()
    page.locator('#catalog-search').fill('zzzz-no-food-match')
    assert page.locator('#empty-state').is_visible()
    page.locator('#catalog-search').fill('')
    page.locator('[data-state=cooked]').click()
    assert page.locator('.result-card').count() > 0
    assert all('cooked' in s.lower() for s in page.locator('.card-state').all_inner_texts())
    page.locator('[data-state=all]').click()
    portion_food = page.evaluate('window.PANTRY_CATALOG.find(f => f.portionOptions?.length > 0).id')
    page.evaluate('(id) => selectFood(catalog.find(f => f.id === id))', portion_food)
    portion = page.locator('#source-portion option').nth(1)
    grams = portion.get_attribute('value')
    page.locator('#source-portion').select_option(grams)
    assert float(page.locator('#amount-input').input_value()) == float(grams)
    # Real source data with incomplete nutrient coverage: never show partial %DV.
    pair = page.evaluate('''() => {
      const a = window.PANTRY_CATALOG.find(f => f.per100g.vitaminK?.value != null);
      const b = window.PANTRY_CATALOG.find(f => f.per100g.vitaminK?.value == null);
      return [a.id, b.id];
    }''')
    page.locator('#clear-menu').click()
    for item in pair:
        page.evaluate('(id) => window.dispatchEvent(new CustomEvent("pantry:add-food", { detail: { foodId: id, grams: 100 } }))', item)
    vitamin_row = page.locator('#day-nutrients > div').filter(has=page.locator('dt', has_text='Vitamin K'))
    assert '≥' in vitamin_row.inner_text()
    assert '1/2 foods report' in vitamin_row.inner_text()
    assert vitamin_row.locator('dd').inner_text() == '—'
    # Remove, recover from unavailable IDs, and escape invalid/corrupt storage.
    page.locator('[data-remove]').first.click()
    assert page.locator('.menu-item').count() == 1
    page.evaluate('localStorage.setItem("pantry-index-day-v1", JSON.stringify({version:1,entries:[{foodId:"not-a-food",grams:100}]}))')
    page.reload(wait_until='networkidle')
    assert page.locator('.menu-item').count() == 0
    assert 'unavailable' in page.locator('#menu-storage-status').inner_text()
    page.evaluate('localStorage.setItem("pantry-index-day-v1", "broken-json")')
    page.reload(wait_until='networkidle')
    assert page.locator('.menu-item').count() == 0
    assert 'could not be read' in page.locator('#menu-storage-status').inner_text()
    page.set_viewport_size({'width': 390, 'height': 844})
    assert not page.evaluate('document.documentElement.scrollWidth > innerWidth')
    assert page.locator('a[href="#daily-menu"]').first.is_visible()
    assert page.goto(base + '/about.html', wait_until='networkidle').status == 200
    assert not errors, errors
    browser.close()
    print(f'Browser checks passed: {records} records; menu totals, editing, persistence, undo, export, missing data, search, filters, mobile layout, About; no JS errors.')
