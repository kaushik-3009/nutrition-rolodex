from playwright.sync_api import sync_playwright
from pathlib import Path
import os
import sys
base=(sys.argv[1] if len(sys.argv)>1 else 'http://127.0.0.1:8000').rstrip('/')
out=Path(sys.argv[2] if len(sys.argv)>2 else '/tmp/pantry-screenshots');out.mkdir(parents=True,exist_ok=True)
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),args=['--no-sandbox'])
 for width,height in [(1440,1000),(390,844)]:
  page=b.new_page(viewport={'width':width,'height':height});page.goto(base+'/',wait_until='networkidle')
  def shot(name,selector=None):
   if selector:page.locator(selector).evaluate("el => el.scrollIntoView({block: 'start', behavior: 'instant'})");page.wait_for_timeout(150)
   page.screenshot(path=str(out/f'{width}-{name}.png'))
  shot('01-home')
  shot('02-browse','#browse')
  page.locator('#catalog-search').fill('carrots');page.locator('.result-card').first.click();shot('03-picker','#food-picker')
  page.locator('#source-portion').click();shot('04-portion-open');page.keyboard.press('Escape')
  page.locator('#group-select').scroll_into_view_if_needed();page.locator('#group-select').click();shot('05-group-open');page.keyboard.press('Escape')
  shot('06-label','#nutrition-title');shot('07-label-bottom','#food-record')
  shot('08-day-empty','#daily-menu')
  page.locator('#catalog-search').fill('carrots');page.locator('.result-card').first.click();page.locator('#amount-input').fill('200');page.locator('#add-to-menu').click()
  for q in ['chicken breast','rice','spinach']:
   page.locator('#find-next-food').click();page.locator('#catalog-search').fill(q);page.locator('.result-card').first.click();page.locator('#add-to-menu').click()
  shot('09-day-populated','#daily-menu');shot('10-day-label-bottom','#day-nutrients > div:last-child')
  page.locator('[data-menu-grams]').first.fill('-1');shot('11-day-invalid','#menu-items')
  page.locator('#catalog-search').fill('zzzz');shot('12-no-results','#food-browser')
  page.goto(base+'/about.html',wait_until='networkidle');shot('13-about-hero');shot('14-about-story','#story');shot('15-about-principles','#principles-title');shot('16-about-path','#path-title');shot('17-footer','footer')
  page.close()
 b.close()
print('Captured 34 screenshots.')
