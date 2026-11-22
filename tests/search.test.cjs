const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const S = require('../search.js');
const context = { window: {} };
vm.runInNewContext(fs.readFileSync(require.resolve('../data/catalog-data.js'), 'utf8'), context);
const index = S.createIndex(context.window.PANTRY_CATALOG);
const top = (query, n = 3) => index.search(query).slice(0, n).map(result => result.food.name);

test('everyday foods rank first', () => {
  const cases = {
    banana: /^Bananas, raw/, eggs: /^Egg, whole/, 'white rice': /^Rice, white/, 'chicken breast': /^Chicken, .*breast/,
    milk: /^Milk, whole/, 'peanut butter': /^Peanut butter/, 'olive oil': /olive/i, lentils: /^Lentils/, oats: /oats/i, pizza: /^Pizza, cheese/, steak: /steak/, bacon: /bacon/i, almonds: /^Nuts, almonds/, water: /^Water/, peas: /^Peas/,
    'chicken thigh': /thigh, meat only, cooked/, spaghetti: /^Pasta, cooked/, mayo: /mayonnaise, regular/, toast: /toasted/, 'hot dog': /^Frankfurter/,
    salmon: /salmon/i, coffee: /coffee, brewed/i, broccoli: /^Broccoli, raw/, 'ground beef': /^Beef, ground/
  };
  for (const [query, pattern] of Object.entries(cases)) assert.match(top(query, 1)[0], pattern, query);
});

test('group names do not cause matches', () => {
  // "Dairy and Egg Products" used to make every milk match "egg".
  assert.ok(index.search('egg').every(result => /egg/i.test(result.food.name) || (result.food.aliases || []).some(a => /egg/i.test(a))));
});

test('plurals and synonyms', () => {
  assert.match(top('chickpeas', 1)[0], /Chickpeas/);
  assert.match(top('garbanzo', 1)[0], /garbanzo/i);
  assert.match(top('curd', 1)[0], /^Yogurt/);
  assert.match(top('dal', 1)[0], /^Lentils/);
  assert.match(top('ketchup', 1)[0], /^Catsup/);
  assert.match(top('potatoes', 1)[0], /^Potato/);
});

test('display names drop source noise', () => {
  assert.deepEqual(S.displayName({ name: 'Chicken, broilers or fryers, breast, meat only, cooked, roasted' }), { title: 'Chicken, breast', detail: 'meat only, cooked, roasted' });
  assert.deepEqual(S.displayName({ name: 'Nuts, almonds' }), { title: 'Almonds', detail: '' });
  assert.equal(S.displayName({ name: "McDONALD'S, Hamburger" }).title, "Mcdonald's");
});

test('typos fall back to the closest spelling', () => {
  for (const [typo, pattern] of [['bananna', /^Bananas/], ['brocoli', /^Broccoli/], ['chicken breat', /breast/], ['avacado', /^Avocados/]]) {
    const results = index.search(typo);
    assert.ok(results.corrected, typo);
    assert.match(results[0].food.name, pattern, typo);
  }
});

test('a finished word does not prefix-match longer words', () => {
  assert.ok(!index.search('water ').some(result => /^Watermelon/.test(result.food.name)));
  assert.ok(index.search('wat').some(result => /^Watermelon/.test(result.food.name)), 'still typing: prefixes allowed');
});
