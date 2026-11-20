const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

global.PANTRY_HOUSEHOLD_MEASURES = require('../data/household-measures.json');
const M = require('../measures.js');
const context = { window: {} };
vm.runInNewContext(fs.readFileSync(require.resolve('../data/catalog-data.js'), 'utf8'), context);
const catalog = context.window.PANTRY_CATALOG;
const byId = id => catalog.find(food => food.id === id);
const labels = food => M.optionsFor(food).map(option => option.label);
const near = (actual, expected, tolerance = 0.01) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);

test('amount parser accepts decimals, fractions, mixed amounts and glyphs', () => {
  for (const [input, expected] of [['1.4', 1.4], ['.5', 0.5], ['1/4', 0.25], ['1 1/2', 1.5], ['1 ½', 1.5], ['½', 0.5], ['2½', 2.5], ['1,5', 1.5]]) assert.equal(M.parseAmount(input), expected, input);
  for (const input of ['', '0', '0/2', '-1', '1/0', 'one', '1..2', NaN, null]) assert.equal(M.parseAmount(input), null, String(input));
});

test('amount formatter round-trips common fractions', () => {
  assert.equal(M.formatAmount(0.25), '¼');
  assert.equal(M.formatAmount(1.5), '1 ½');
  assert.equal(M.formatAmount(2), '2');
  assert.equal(M.formatAmount(1.38), '1.38');
  for (const amount of [0.125, 1 / 3, 0.5, 2 / 3, 0.75, 1.5]) assert.equal(M.parseAmount(M.formatAmount(amount)), amount);
});

test('every food has grams and ounces and finite, unique options', () => {
  for (const food of catalog) {
    const options = M.optionsFor(food);
    assert.ok(options.some(o => o.id === 'g' && o.grams === 1), food.id);
    assert.ok(options.some(o => o.id === 'oz'), food.id);
    assert.equal(new Set(options.map(o => o.id)).size, options.length, `duplicate option ids for ${food.id}`);
    for (const option of options) assert.ok(Number.isFinite(option.grams) && option.grams > 0 && option.grams <= 5000, `${food.id} ${option.label}`);
    const { option, amount } = M.defaultFor(food);
    assert.ok(options.includes(option) && amount > 0, food.id);
  }
});

test('every USDA size of a food is offered, with the right gram weight', () => {
  const banana = byId('generic-bananas-raw');
  assert.deepEqual(labels(banana).slice(0, 5), ['medium', 'small', 'large', 'extra small', 'extra large']);
  assert.equal(M.optionsFor(banana).find(o => o.label === 'large').grams, 136);
  const chicken = byId('fdc-171477');
  near(M.optionsFor(chicken).find(o => /^breast/.test(o.label)).grams, 172); // source is "0.5 breast = 86 g"
});

test('spoons are only derived from a plain cup', () => {
  assert.ok(!labels(byId('generic-bananas-raw')).includes('tbsp'), 'no tablespoon of banana');
  assert.ok(!labels(byId('fdc-171477')).includes('tbsp'), 'no tablespoon of chopped chicken');
  const rice = M.optionsFor(byId('fdc-168878')); // cooked rice: only a plain cup in the source
  near(rice.find(o => o.id === 'tbsp').grams, rice.find(o => o.unit === 'cup').grams / 16);
});

test('defaults are a sensible single serving', () => {
  const expect = (id, text) => { const d = M.defaultFor(byId(id)); assert.equal(M.describe(d.option, d.amount), text, id); };
  expect('generic-bananas-raw', '1 medium');
  expect('generic-egg-whole-raw-fresh', '1 large');
  expect('fdc-171413', '1 tbsp');          // olive oil
  expect('fdc-172470', '1 tbsp');          // peanut butter
  expect('fdc-172688', '1 slice');         // whole-wheat bread
  expect('fdc-168878', '1 cup');           // cooked rice
  expect('fdc-174034', '3 oz');            // cooked ground beef
  expect('fdc-175168', '3 oz');            // salmon fillet is not one serving
});

test('size ranges are shortened but keep their source in the tooltip', () => {
  const medium = M.optionsFor(byId('generic-bananas-raw'))[0];
  assert.equal(medium.label, 'medium');
  assert.match(medium.source, /7" to 7 7\/8" long/);
});
