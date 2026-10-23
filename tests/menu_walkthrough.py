"""Exercise menu editing through real browser controls against a local server.

Run: python3 tests/menu_walkthrough.py [base-url]
Requires Python Playwright and Chromium (or CHROMIUM_PATH).
"""
import json
import os
import sys
from playwright.sync_api import sync_playwright

base = (sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8010").rstrip("/")
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=os.environ.get("CHROMIUM_PATH", "/usr/bin/chromium"), args=["--no-sandbox"])
    page = browser.new_page(viewport={"width": 1280, "height": 900})
    errors = []
    downloads = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.on("download", lambda download: downloads.append(download.suggested_filename))
    page.goto(base + "/", wait_until="networkidle")
    page.evaluate("""() => {
      const foods = window.PANTRY_CATALOG.slice(0, 2);
      localStorage.setItem("pantry-index-day-v1", JSON.stringify({version: 1, entries: foods.map(food => ({foodId: food.id, grams: 100}))}));
    }""")
    page.reload(wait_until="networkidle")
    assert page.locator("#picker-menu-count").inner_text() == "(2)"

    # A valid edit updates totals while the field keeps focus. Its undo point
    # is the quantity from before the edit session.
    first_input = page.locator("[data-menu-grams]").first
    first_input.fill("125")
    assert "225 g" in page.locator("#day-serving").inner_text()
    page.locator("#undo-menu").click()
    assert page.locator("[data-menu-grams]").first.input_value() == "100"

    # Editing commits on blur without detaching the control clicked next.
    page.locator("[data-menu-grams]").first.fill("125")
    page.locator("[data-remove]").nth(1).click()
    assert page.locator(".menu-item").count() == 1
    assert page.locator("[data-menu-grams]").input_value() == "125"
    assert page.locator("#picker-menu-count").inner_text() == "(1)"

    # Tab commits, and clear/undo preserves the edited value.
    page.locator("[data-menu-grams]").fill("150")
    page.locator("[data-menu-grams]").press("Tab")
    assert page.locator("[data-menu-grams]").input_value() == "150"
    page.locator("#clear-menu").click()
    page.locator("#undo-menu").click()
    assert page.locator("[data-menu-grams]").input_value() == "150"

    # Invalid drafts cannot be exported as the old saved quantity. Correcting
    # and blurring clears the error and exports the new quantity.
    page.locator("[data-menu-grams]").fill("-10")
    page.locator("#export-menu").click()
    page.wait_for_timeout(150)
    assert "invalid" in page.locator("#menu-input-status").inner_text().lower()
    assert page.locator("[data-menu-grams]").get_attribute("aria-invalid") == "true"
    assert downloads == []
    assert page.locator(".menu-item").count() == 1
    page.locator("[data-menu-grams]").fill("175")
    with page.expect_download() as download:
        page.locator("#export-menu").click()
    with open(download.value.path(), encoding="utf-8") as f:
        exported = json.load(f)
    assert exported["entries"][0]["grams"] == 175
    assert page.locator("[data-menu-grams]").input_value() == "175"

    # A successful add reports concise grams in the inline status and toast.
    page.locator("#clear-menu").click()
    page.locator("#catalog-search").fill("rice")
    page.locator(".result-card").first.click()
    page.locator("#amount-input").fill("100")
    page.locator("#add-to-menu").click()
    assert "Added 100 g." in page.locator("#add-feedback").inner_text()
    assert "Food now totals 100 g" in page.locator("#add-feedback").inner_text()
    assert "100 g added to your day." in page.locator("#toast").inner_text()
    page.locator("#amount-input").fill("125")
    assert page.locator("#add-feedback").inner_text() == ""
    page.locator("#undo-menu").click()
    assert page.locator(".menu-item").count() == 0
    assert page.evaluate("document.activeElement.id") == "menu-title"
    assert not errors, errors
    browser.close()
print("Menu walkthrough passed: edit/click, Tab, clear/undo, invalid export guard, corrected draft, inline add feedback.")
