"""Check the primary picker and About page across Playwright browsers.

Usage: BROWSERS=chromium,firefox,webkit python3 tests/cross_browser.py [base-url]
Browser executable overrides: CHROMIUM_PATH, FIREFOX_PATH, WEBKIT_PATH.
Firefox and WebKit binaries can be installed with ``playwright install firefox webkit``.
"""
import os
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

BASE = (sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8000").rstrip("/")
NAMES = [name.strip().lower() for name in os.environ.get("BROWSERS", "chromium").split(",") if name.strip()]
EXECUTABLES = {
    "chromium": os.environ.get("CHROMIUM_PATH", "/usr/bin/chromium"),
    "firefox": os.environ.get("FIREFOX_PATH"),
    "webkit": os.environ.get("WEBKIT_PATH"),
}


def run(browser_type, name):
    executable = EXECUTABLES[name]
    opts = {"executable_path": executable} if executable else {}
    if name == "chromium":
        opts["args"] = ["--no-sandbox"]
    browser = browser_type.launch(**opts)
    try:
        for width, height in ((1280, 900), (390, 844)):
            context = browser.new_context(viewport={"width": width, "height": height})
            page = context.new_page()
            errors = []
            page.on("pageerror", lambda error: errors.append(str(error)))
            response = page.goto(BASE + "/", wait_until="networkidle")
            assert response and response.status == 200, f"{name}: home returned {response.status if response else 'no response'}"

            # Native select keyboard input and a result-card selection.
            group = page.locator("#group-select")
            group.focus()
            group.press("Home")
            group.press("ArrowDown")
            group.press("Enter")
            assert group.input_value() != "all", f"{name}: native select did not change by keyboard"
            group.press("Home")
            group.press("Enter")
            assert group.input_value() == "all", f"{name}: native select could not return to all foods"
            search = page.locator("#catalog-search")
            search.fill("oats")
            card = page.locator(".result-card").first
            assert card.count() > 0, f"{name}: oats search returned no cards"
            card.click()

            amount = page.locator("#amount-input")
            amount.focus()
            amount.fill("1.25")
            amount.press("ArrowUp")
            assert float(amount.input_value()) > 1.25, f"{name}: quantity keyboard increment failed"
            page.locator("#add-to-menu").click()
            assert page.locator(".menu-item").count() == 1, f"{name}: add action did not create menu item"
            if width <= 600:
                box = page.locator("#add-to-menu").bounding_box()
                assert box and 0 <= box["y"] < height and box["height"] >= 40, f"{name}: mobile add control is misplaced: {box}"
            assert not page.evaluate("document.documentElement.scrollWidth > innerWidth"), f"{name}: horizontal overflow at {width}px"
            assert not errors, f"{name}: page errors: {errors}"

            about = page.goto(BASE + "/about.html", wait_until="networkidle")
            assert about and about.status == 200, f"{name}: About page failed to load"
            assert page.locator("#about-title").is_visible(), f"{name}: About title is not visible"
            if width == 390:
                output = Path(os.environ.get("CROSS_BROWSER_SCREENSHOT_DIR", "/tmp"))
                output.mkdir(parents=True, exist_ok=True)
                page.screenshot(path=str(output / f"pantry-about-{name}-mobile.png"), full_page=True)
            context.close()
            print(f"{name}: passed picker, native-select keyboard, quantity keyboard, add flow, {width}×{height} layout and About page", flush=True)
    finally:
        browser.close()


with sync_playwright() as playwright:
    for browser_name in NAMES:
        if browser_name not in EXECUTABLES:
            raise SystemExit(f"Unsupported browser {browser_name!r}; choose chromium, firefox, webkit")
        run(getattr(playwright, browser_name), browser_name)
