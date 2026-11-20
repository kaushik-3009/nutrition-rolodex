"""Drive the tracker in a real browser: search, pick portions, log meals,
edit, remove/undo, goals, day navigation and persistence, on desktop and phone.

Run against a local server:  python3 tests/tracker_walkthrough.py [base-url]
Requires Python Playwright and Chromium (CHROMIUM_PATH selects a binary).
"""
import os
import sys
from playwright.sync_api import sync_playwright

BASE = (sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8000").rstrip("/")


def add(page, query, nth=0, amount=None, portion=None, meal=None):
    page.fill("#food-search", query)
    page.wait_for_selector("#results .result")
    page.locator("#results .result").nth(nth).click()
    page.wait_for_selector("#food-sheet[open]")
    if portion:
        page.click(f'[data-portion="{portion}"]')
    if amount is not None:
        page.fill("#amount", str(amount))
    if meal:
        page.click(f'[data-meal="{meal}"]')
    page.click("#sheet-submit")
    page.wait_for_selector("#food-sheet", state="hidden")


def kcal(page):
    return int(page.inner_text("#kcal-eaten").replace(",", ""))


def run(browser, viewport, label):
    context = browser.new_context(viewport=viewport)
    page = context.new_page()
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto(BASE + "/")
    page.wait_for_selector("#food-search:not([disabled])")
    assert kcal(page) == 0
    assert page.locator(".chip").count() >= 5, "everyday foods are offered on an empty search"

    # Search ranks the plain food first and never matches on group names.
    page.fill("#food-search", "eggs")
    page.wait_for_selector("#results .result")
    first = page.locator("#results .result").first.inner_text()
    assert first.startswith("Egg"), first

    # Enter opens the top result with its natural default portion.
    page.fill("#food-search", "banana")
    page.wait_for_selector("#results .result")
    page.press("#food-search", "Enter")
    page.wait_for_selector("#food-sheet[open]")
    assert page.input_value("#amount") == "1"
    assert "medium" in page.inner_text("#amount-unit")
    assert page.inner_text("#preview-kcal") == "105"
    page.click('[data-meal="breakfast"]')
    page.click("#sheet-submit")
    assert kcal(page) == 105

    # Fractions, another portion, and a different meal.
    add(page, "white rice", amount="1/2", meal="lunch")       # ½ cup cooked rice = 79 g
    assert 206 <= kcal(page) <= 209, kcal(page)
    add(page, "chicken breast", portion="oz", amount=4, meal="dinner")
    assert page.locator('.meal[aria-label="Dinner"] .log-row').count() == 1
    assert "4 oz" in page.locator('.meal[aria-label="Dinner"] .log-row').inner_text()

    # Edit an entry: switch to grams and change the amount.
    page.locator('.meal[aria-label="Breakfast"] .log-row').click()
    page.wait_for_selector("#food-sheet[open]")
    page.click('[data-portion="g"]')
    assert page.input_value("#amount") == "118"
    page.fill("#amount", "200")
    page.click("#sheet-submit")
    assert "200 g" in page.locator('.meal[aria-label="Breakfast"] .log-row').inner_text()

    # Invalid amounts are rejected without closing the sheet.
    page.locator('.meal[aria-label="Breakfast"] .log-row').click()
    page.fill("#amount", "abc")
    assert page.is_visible("#amount-error")
    page.keyboard.press("Escape")

    # Remove with undo.
    before = kcal(page)
    page.locator('.meal[aria-label="Lunch"] .row-remove').click()
    assert kcal(page) < before
    page.click("#toast-undo")
    assert kcal(page) == before

    # Full label shows ≥ where some foods don't report a nutrient.
    page.click("#nutrient-details summary")
    assert "Vitamin" in page.inner_text("#day-nutrients")

    # Goals change the summary.
    page.click("#open-goals")
    page.fill('#goals-dialog [name="calories"]', "1800")
    page.click('#goals-dialog button[value="save"]')
    assert page.inner_text("#kcal-goal") == "1,800"

    # Persistence and day navigation.
    page.reload()
    page.wait_for_selector("#food-search:not([disabled])")
    assert kcal(page) == before
    page.click("#prev-day")
    assert page.inner_text("#day-label") == "Yesterday"
    assert kcal(page) == 0
    page.click("#next-day")
    assert kcal(page) == before

    # An empty today offers to copy the most recent logged day.
    page.evaluate("""() => { const s = JSON.parse(localStorage.getItem('pantry-index-v2'));
      const today = Object.keys(s.days).sort().pop(); const d = new Date(); d.setDate(d.getDate() - 1);
      const y = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      s.days[y] = s.days[today]; delete s.days[today]; localStorage.setItem('pantry-index-v2', JSON.stringify(s)); }""")
    page.reload()
    page.wait_for_selector("#food-search:not([disabled])")
    assert kcal(page) == 0
    page.click("#copy-previous")
    assert kcal(page) == before

    width = page.evaluate("document.documentElement.scrollWidth")
    assert width <= viewport["width"], f"{label}: horizontal overflow {width}"
    assert not errors, errors
    context.close()
    print(f"{label}: ok")


with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=os.environ.get("CHROMIUM_PATH") or None)
    run(browser, {"width": 1280, "height": 900}, "desktop")
    run(browser, {"width": 390, "height": 844}, "phone")
    run(browser, {"width": 320, "height": 640}, "small phone")
    browser.close()
