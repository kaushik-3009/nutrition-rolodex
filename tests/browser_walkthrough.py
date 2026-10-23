"""Repeat the real search/quantity/day workflow at desktop and phone sizes.

Requires a running static server, Python Playwright and Chromium.
Usage: python3 tests/browser_walkthrough.py [base-url]
"""
import json
import math
import os
import sys
from playwright.sync_api import sync_playwright

base = (sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:8000').rstrip('/')
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH', '/usr/bin/chromium'), args=['--no-sandbox'])
    for width, height in [(1440, 900), (1024, 768), (768, 1024), (390, 844), (320, 740)]:
        context = browser.new_context(viewport={'width': width, 'height': height})
        page = context.new_page()
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        assert page.goto(base + '/', wait_until='networkidle').status == 200
        # A global search must escape earlier group/preparation restrictions.
        page.locator('#group-select').select_option('Pulses')
        page.locator('[data-state=dry]').click()
        page.locator('#food-search').fill('chicken')
        page.locator('#lookup button').click()
        assert page.locator('#group-select').input_value() == 'all'
        assert page.locator('[data-state=all]').get_attribute('aria-pressed') == 'true'
        assert page.locator('.result-card').count() > 0
        # An empty result set cannot leave an old add action active.
        page.locator('#catalog-search').fill('zzzz-unmatched-food')
        assert page.locator('#empty-state').is_visible()
        assert not page.locator('#food-picker').is_visible()
        assert not page.locator('#add-to-menu').is_visible()
        assert page.locator('#add-to-menu').is_disabled()
        # Search, select, type and add five foods without direct JS action calls.
        planned = []
        for query, grams in [('oats', 1.25), ('lentils', 150), ('chicken breast', 175), ('spinach', 80), ('salmon', 125)]:
            page.locator('#catalog-search').fill(query)
            card = page.locator('.result-card').first
            food_id = card.get_attribute('data-food-id')
            card.click()
            amount = page.locator('#amount-input')
            assert amount.evaluate('(input) => input === document.activeElement')
            amount.press_sequentially(str(grams), delay=20)
            assert math.isclose(float(amount.input_value()), grams)
            amount_box = amount.bounding_box()
            add_box = page.locator('#add-to-menu').bounding_box()
            assert abs(amount_box['y'] - add_box['y']) < 10, (width, amount_box, add_box)
            if width <= 780:
                assert 72 <= add_box['y'] < height - add_box['height'], (width, add_box)
                assert add_box['height'] >= 44
            page.locator('#add-to-menu').click()
            assert 'Added' in page.locator('#add-feedback').inner_text()
            assert page.locator('.menu-item').count() == len(planned) + 1
            planned.append({'foodId': food_id, 'grams': grams})
            page.locator('#find-next-food').click()
            assert page.locator('#catalog-search').evaluate('(input) => input === document.activeElement')
            search_box = page.locator('#catalog-search').bounding_box()
            assert 72 <= search_box['y'] < height - 35
        # Verify what the actual exported UI plan contains and its source-derived calorie sum.
        page.locator('.picker-shortcuts a[href="#daily-menu"]').click()
        assert page.locator('.menu-item').count() == 5
        assert '531.25 g' in page.locator('#day-serving').inner_text()
        with page.expect_download() as download:
            page.locator('#export-menu').click()
        with open(download.value.path(), encoding='utf-8') as f:
            exported = json.load(f)
        assert [{'foodId': row['foodId'], 'grams': row['grams']} for row in exported['entries']] == planned
        source_calories = page.evaluate('(entries) => entries.map(e => window.PANTRY_CATALOG.find(f => f.id === e.foodId).per100g.calories.value * e.grams / 100)', planned)
        assert math.isclose(exported['totals']['calories']['value'], sum(source_calories))
        assert float(page.locator('#day-calories').inner_text()) == round(sum(source_calories))
        # Committing a changed amount must not swallow the very next button click.
        page.locator('[data-menu-grams]').first.fill('200')
        page.locator('[data-remove]').nth(1).click()
        assert page.locator('.menu-item').count() == 4
        page.locator('#undo-menu').click()
        assert page.locator('.menu-item').count() == 5
        assert page.locator('[data-menu-grams]').first.input_value() == '200'
        page.reload(wait_until='networkidle')
        assert page.locator('.menu-item').count() == 5
        assert page.locator('[data-menu-grams]').first.input_value() == '200'
        # Decimal editing and small amounts must not be normalized mid-keystroke.
        page.locator('#catalog-search').fill('oats')
        page.locator('.result-card').first.click()
        page.locator('#amount-input').press_sequentially('1.25', delay=20)
        assert page.locator('#amount-input').input_value() == '1.25'
        page.locator('#amount-input').press('Backspace')
        assert page.locator('#amount-input').input_value() == '1.2'
        page.locator('#decrease').click()
        assert 0 < float(page.locator('#amount-input').input_value()) < 1.2
        assert not page.evaluate('document.documentElement.scrollWidth > innerWidth'), width
        assert not errors, errors
        # URL-based searches behave like catalog searches on a fresh page.
        page.goto(base + '/?q=salmon', wait_until='networkidle')
        assert page.locator('#catalog-search').input_value() == 'salmon'
        assert page.locator('.result-card').count() > 0
        context.close()
        print(f'Walkthrough passed at {width}×{height}: 5-food add loop, totals/export, edit/remove/undo, reload, search/filter recovery, decimal keyboard input and layout.', flush=True)
    browser.close()
