"""Exercise menu editing through real browser controls against a local server.

Run: python3 tests/menu_walkthrough.py [base-url]
Requires Python Playwright and Chromium (or CHROMIUM_PATH).
"""
import json
import os
import sys
from playwright.sync_api import sync_playwright

base = (sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8000").rstrip("/")
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=os.environ.get("CHROMIUM_PATH", "/usr/bin/chromium"), args=["--no-sandbox"])
    context = browser.new_context(viewport={"width": 1280, "height": 900})
    page = context.new_page()
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
    assert not page.locator("#toast").evaluate("el => el.classList.contains('visible')")
    page.locator("#amount-input").fill("125")
    assert page.locator("#add-feedback").inner_text() == ""
    page.locator("#undo-menu").click()
    assert page.locator(".menu-item").count() == 0
    assert page.evaluate("document.activeElement.id") == "menu-title"

    # Repeated adds merge quantities. Invalid drafts stay visible when another
    # food is removed, and export cannot bypass either a blank or negative edit.
    page.locator("#catalog-search").fill("rice")
    page.locator(".result-card").first.click()
    page.locator("#amount-input").fill("100")
    page.locator("#add-to-menu").click()
    page.locator("#amount-input").fill("125")
    page.locator("#add-to-menu").click()
    assert page.locator(".menu-item").count() == 1
    assert page.locator("[data-menu-grams]").input_value() == "225"
    page.locator("#catalog-search").fill("beans")
    page.locator(".result-card").first.click()
    page.locator("#add-to-menu").click()
    assert page.locator(".menu-item").count() == 2
    first_name = page.locator(".menu-item strong").first.inner_text()
    page.locator("[data-menu-grams]").first.fill("")
    page.locator("[data-menu-grams]").nth(1).fill("-5")
    page.locator("#catalog-search").fill("milk")
    page.locator(".result-card").first.click()
    page.locator("#add-to-menu").click()
    assert page.locator(".menu-item").count() == 3
    assert page.locator(".menu-item strong").first.inner_text() == first_name
    assert page.locator("[data-menu-grams]").first.input_value() == ""
    assert page.locator("[data-menu-grams]").first.get_attribute("aria-invalid") == "true"
    assert page.locator("[data-menu-grams]").nth(1).input_value() == "-5"
    assert page.locator("[data-menu-grams]").nth(1).get_attribute("aria-invalid") == "true"
    assert not page.locator("#menu-input-status").is_hidden()
    page.locator("[data-remove]").nth(2).click()
    assert page.locator(".menu-item").count() == 2
    assert [page.locator("[data-menu-grams]").nth(i).input_value() for i in range(2)] == ["", "-5"]
    download_count = len(downloads)
    page.locator("#export-menu").click()
    assert len(downloads) == download_count
    assert "invalid" in page.locator("#menu-input-status").inner_text().lower()
    page.locator("[data-menu-grams]").first.fill("250")
    page.locator("[data-menu-grams]").nth(1).fill("75")
    assert [page.locator("[data-menu-grams]").nth(i).input_value() for i in range(2)] == ["250", "75"]

    # Storage changes from a second tab replace stale state and invalidate undo.
    peer = context.new_page()
    peer.goto(base + "/", wait_until="networkidle")
    peer.locator("#clear-menu").click()
    assert page.locator(".menu-item").count() == 0
    assert page.locator("#undo-menu").is_hidden()
    peer.locator("#catalog-search").fill("rice")
    peer.locator(".result-card").first.click()
    peer.locator("#add-to-menu").click()
    assert page.locator(".menu-item").count() == 1
    assert len(page.locator(".menu-item strong").inner_text()) > 20
    assert "g" in page.locator("#day-serving").inner_text()

    # Long mobile item labels and the daily serving total remain in the viewport.
    page.set_viewport_size({"width": 390, "height": 844})
    page.locator("#daily-menu").scroll_into_view_if_needed()
    assert page.evaluate("document.documentElement.scrollWidth === innerWidth")
    assert "food" in page.locator("#day-serving").inner_text()
    page.reload(wait_until="networkidle")
    assert page.locator(".menu-item strong").inner_text() == "Rice, white, long grain, unenriched, raw"
    assert page.locator("#day-serving").inner_text().endswith("g")
    peer.close()
    assert not errors, errors
    browser.close()
print("Menu walkthrough passed: editing, invalid draft preservation, repeated adds, export guard, undo, cross-tab sync, mobile totals.")
