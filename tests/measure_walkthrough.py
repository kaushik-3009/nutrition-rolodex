"""Food-specific measurement buttons, fractions, counts and daily totals through the UI."""
import os,sys,math,json
from playwright.sync_api import sync_playwright
base=(sys.argv[1] if len(sys.argv)>1 else 'http://127.0.0.1:8000').rstrip('/')
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),args=['--no-sandbox'])
 for width,height in [(1440,1000),(390,844)]:
  page=b.new_page(viewport={'width':width,'height':height});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto(base,wait_until='networkidle')
  assert page.locator('#source-portion').count()==0
  def choose(query):
   page.locator('#catalog-search').fill(query);page.locator('.result-card').first.click()
  choose('white rice')
  assert page.locator('#amount-input').input_value()=='¼'
  assert page.locator('[data-unit=cup]').get_attribute('aria-pressed')=='true'
  page.locator('[data-unit=cup]').click()
  for text,value in [('1/4',.25),('1/2',.5),('1.4',1.4),('2',2),('1 1/2',1.5),('¼',.25)]:
   page.locator('#amount-input').fill(text)
   assert page.locator('#amount-input').input_value()==text
   grams=page.evaluate('selectedGrams(selectedFood)')
   assert math.isclose(grams,180*value), (text,grams)
   assert not page.locator('#add-to-menu').is_disabled()
  page.locator('[data-amount="0.5"]').click()
  assert page.locator('#amount-input').input_value()=='½'
  page.locator('#add-to-menu').click()
  assert '90 g' in page.locator('#day-serving').inner_text()
  assert '½ cup' in page.locator('.menu-measure').inner_text()
  page.locator('[data-unit=tbsp]').click();page.locator('#amount-input').fill('2')
  assert math.isclose(page.evaluate('selectedGrams(selectedFood)'),22.5)
  for bad in ['0','-1','1/0','no','']:
   page.locator('#amount-input').fill(bad);assert page.locator('#add-to-menu').is_disabled()
  page.locator('#amount-input').fill('1.4');assert not page.locator('#add-to-menu').is_disabled()
  choose('lentils dry');page.locator('[data-unit=cup]').click();page.locator('[data-amount="0.25"]').click()
  assert math.isclose(page.evaluate('selectedGrams(selectedFood)'),48)
  choose('egg whole raw');page.locator('[data-unit=count]').click();page.locator('[data-amount="2"]').click()
  assert math.isclose(page.evaluate('selectedGrams(selectedFood)'),100)
  assert 'eggs' in page.locator('#serving-size').inner_text()
  page.locator('#add-to-menu').click()
  assert '2 eggs' in page.locator('.menu-measure').last.inner_text()
  assert '190 g' in page.locator('#day-serving').inner_text()
  assert page.locator('#nutrients .section-row').all_inner_texts()==['Macronutrients','Vitamins','Minerals','Other nutrients']
  assert page.locator('#day-nutrients .section-row').all_inner_texts()==['Macronutrients','Vitamins','Minerals','Other nutrients']
  choose('olive oil');page.locator('[data-unit=tbsp]').click();page.locator('[data-amount="2"]').click()
  assert 'tbsp' in page.locator('#serving-size').inner_text()
  oil_grams=page.evaluate('selectedGrams(selectedFood)')
  page.locator('[data-unit=g]').click()
  page.locator('[data-unit=tbsp]').click()
  assert page.locator('#amount-input').input_value()=='2'
  assert math.isclose(page.evaluate('selectedGrams(selectedFood)'),oil_grams)
  if width>780:
   choose('')
   page.wait_for_timeout(150)
   browser_box=page.locator('#food-browser').bounding_box();detail_box=page.locator('#detail').bounding_box()
   assert abs(browser_box['height']-detail_box['height'])<3, (browser_box,detail_box)
   assert page.locator('.result-card').count()==40
  assert not page.evaluate('document.documentElement.scrollWidth>innerWidth')
  page.reload(wait_until='networkidle')
  assert '½ cup' in page.locator('.menu-measure').first.inner_text()
  assert '2 eggs' in page.locator('.menu-measure').last.inner_text()
  with page.expect_download() as download:page.locator('#export-menu').click()
  with open(download.value.path()) as f:data=json.load(f)
  assert data['entries'][0]['grams']==90
  assert data['entries'][0]['measureId']=='cup'
  assert not errors,errors
  page.close()
  print(f'Measure walkthrough passed at {width}px: fractions, decimals, presets, cups/spoons/eggs, exact grams, saved menu, nutrient groups, list height.',flush=True)
 b.close()
