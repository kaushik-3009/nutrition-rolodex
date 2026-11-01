const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

global.PANTRY_HOUSEHOLD_MEASURES = require('../data/household-measures.json');
const { optionsFor, parseAmount, formatAmount } = require('../measures.js');
const catalogContext = { window: {} };
vm.runInNewContext(fs.readFileSync(require.resolve('../data/catalog-data.js'), 'utf8'), catalogContext);
const catalog = catalogContext.window.PANTRY_CATALOG;
const food = (fdcId) => catalog.find((entry) => entry.fdcId === fdcId);

test('amount parser accepts decimals, fractions, mixed amounts, and fraction glyphs', () => {
  for (const [input, expected] of [['1.4', 1.4], ['.5', 0.5], ['1.', 1], ['1/4', 0.25], ['1/2', 0.5], ['1 1/2', 1.5], ['1 ½', 1.5], ['¼', 0.25], ['½', 0.5], ['¾', 0.75], ['2½', 2.5]]) {
    assert.equal(parseAmount(input), expected, input);
  }
  for (const input of ['', '0', '0/2', '-1', '-1/2', '1/0', 'one', '1..2', 'NaN', Infinity, NaN, null]) {
    assert.equal(parseAmount(input), null, String(input));
  }
});

test('amount formatter uses readable fractions and stable decimals', () => {
  assert.equal(formatAmount(0.25), '¼');
  assert.equal(formatAmount(0.5), '½');
  assert.equal(formatAmount(1.5), '1 ½');
  assert.equal(formatAmount(1.4), '1.4');
  assert.equal(formatAmount(1.38), '1.38');
  assert.equal(formatAmount(0.001), '0.001');
  for (const amount of [0.125, 1 / 3, 0.375, 0.5, 0.625, 2 / 3, 0.75, 0.875, 1.5]) {
    assert.equal(parseAmount(formatAmount(amount)), amount);
  }
  assert.equal(formatAmount(0), '');
});

test('restores dry rice and quarter-cup dry bean measures without reusing dry quinoa', () => {
  const riceOptions = optionsFor(food(2512381));
  assert(riceOptions.some((o) => o.id === 'cup' && o.grams === 180));
  assert.equal(riceOptions.find((o) => o.id === 'cup').defaultAmount, 0.25);
  const beans = optionsFor(food(2644283));
  assert(beans.some((o) => o.id === 'cup' && o.grams === 192));
  assert.equal(beans.find((o) => o.id === 'cup').defaultAmount, 0.25);
  const quinoa = optionsFor(food(2708399));
  assert(!quinoa.some((o) => o.id === 'cup' && o.source === 'Curated household default'));
  assert(quinoa.some((o) => o.unit === 'cup' && /USDA/.test(o.source)));
});

test('source egg count portions are available and cup conversions use exact ratios', () => {
  const eggs = catalog.filter((f) => /egg.*whole|whole.*egg/i.test(f.sourceDescription || f.name));
  const egg = eggs.find((f) => /Egg, whole/i.test(f.sourceDescription || '') && optionsFor(f).some((o) => o.unit === 'count'));
  assert(egg, 'expected a source-backed whole egg count');
  const count = optionsFor(egg).find((o) => o.unit === 'count');
  assert.equal(count.id, 'count');
  assert.equal(count.grams, 50);
  assert.equal(count.defaultAmount, 1);
  assert.equal(count.default, true);
  assert.equal(count.label, 'Egg, large');
  assert(!/^\d/.test(count.label), count.label);
  const milk = catalog.find((f) => /Milk, whole, 3\.25% milkfat/i.test(f.sourceDescription || ''));
  const milkOptions = optionsFor(milk);
  const cup = milkOptions.find((o) => o.id === 'cup');
  assert(cup);
  assert.equal(milkOptions.find((o) => o.id === 'tbsp').grams, cup.grams / 16);
  assert.equal(milkOptions.find((o) => o.id === 'tsp').grams, cup.grams / 48);

  const oil = optionsFor(food(2710186));
  assert.equal(oil.find((o) => o.id === 'tbsp').label, 'Tablespoon');
  assert.equal(oil.find((o) => o.id === 'tsp').label, 'Teaspoon');
});

test('normalizes source portion labels and per-piece count weights', () => {
  const egg = optionsFor({
    id: 'two-eggs',
    name: 'Egg, whole, raw',
    sourceDescription: 'Egg, whole, raw',
    portionOptions: [{ label: '2 large eggs', amount: 2, grams: 100, unit: 'large', source: 'USDA FDC food_portion' }],
  }).find((o) => o.id === 'count');
  assert.equal(egg.grams, 50);
  assert.equal(egg.defaultAmount, 1);
  assert.equal(egg.label, 'Egg, large');

  const cup = optionsFor({
    id: 'chopped-food',
    portionOptions: [{ label: '1 cup, chopped', amount: 1, grams: 140, unit: 'cup', source: 'USDA FDC food_portion' }],
  }).find((o) => o.id === 'cup');
  assert.equal(cup.label, 'Cup, chopped');

  const eggCup = optionsFor(food(171287)).find((o) => o.unit === 'cup');
  assert.equal(eggCup.label, 'Cup');
});

test('every catalog food has a finite grams option and valid unique option identifiers', () => {
  assert.equal(catalog.length, 7857);
  for (const item of catalog) {
    const options = optionsFor(item);
    assert.equal(options[0].id, 'g', item.id);
    assert(options.every((o) => Number.isFinite(o.grams) && o.grams > 0), item.id);
    assert.equal(new Set(options.map((o) => o.id)).size, options.length, item.id);
  }
});
