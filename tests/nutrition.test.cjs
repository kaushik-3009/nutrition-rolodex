const test = require('node:test');
const assert = require('node:assert/strict');
const { aggregateMenu, nutrientValue } = require('../nutrition.js');

const rice = {
  id: 'rice',
  per100g: {
    calories: { value: 360, unit: 'kcal' },
    protein: { value: 7, unit: 'g' },
    iron: { value: 1.2, unit: 'mg' },
  },
};
const beans = {
  id: 'beans',
  per100g: {
    calories: { value: 125, unit: 'kcal' },
    protein: { value: 8, unit: 'g' },
    // Iron is deliberately absent: it must stay visibly incomplete.
  },
};

test('nutrientValue scales a per-100g value', () => {
  assert.equal(nutrientValue(rice, 'protein', 50), 3.5);
  assert.equal(nutrientValue(rice, 'calories', 200), 720);
});

test('nutrientValue returns null for missing data and accepts zero as known', () => {
  assert.equal(nutrientValue(beans, 'iron', 100), null);
  assert.equal(nutrientValue({ per100g: { folate: { value: null, unit: 'mcg' } } }, 'folate', 100), null);
  assert.equal(nutrientValue({ per100g: { folateDFE: { value: undefined, unit: 'mcg' } } }, 'folateDFE', 100), null);
  assert.equal(nutrientValue({ per100g: { sodium: { value: 0, unit: 'mg' } } }, 'sodium', 0), 0);
});

test('supports folate DFE separately from total folate', () => {
  const food = { per100g: {
    folate: { value: 100, unit: 'mcg' },
    folateDFE: { value: 150, unit: 'mcg' },
  } };
  assert.equal(nutrientValue(food, 'folate', 50), 50);
  assert.equal(nutrientValue(food, 'folateDFE', 50), 75);
});

test('supports added sugars, iodine, pantothenic acid, and biotin with canonical units', () => {
  const food = { per100g: {
    addedSugars: { value: 2, unit: 'g' },
    iodine: { value: 4, unit: 'mcg' },
    pantothenicAcid: { value: 0.5, unit: 'mg' },
    biotin: { value: 3, unit: 'mcg' },
  } };
  assert.equal(nutrientValue(food, 'addedSugars', 50), 1);
  assert.equal(nutrientValue(food, 'iodine', 50), 2);
  assert.equal(nutrientValue(food, 'pantothenicAcid', 50), 0.25);
  assert.equal(nutrientValue(food, 'biotin', 50), 1.5);
});

test('aggregateMenu sums scaled nutrients, including duplicate foods', () => {
  const result = aggregateMenu([rice, beans], [
    { foodId: 'rice', grams: 50 },
    { foodId: 'rice', grams: 50 },
    { foodId: 'beans', grams: 100 },
  ]);
  assert.equal(result.totalGrams, 200);
  assert.equal(result.itemCount, 3);
  assert.deepEqual(result.totals.calories, { value: 485, unit: 'kcal', known: 3, total: 3, complete: true });
  assert.deepEqual(result.totals.protein, { value: 15, unit: 'g', known: 3, total: 3, complete: true });
  assert.deepEqual(result.totals.iron, { value: 1.2, unit: 'mg', known: 2, total: 3, complete: false });
});

test('aggregateMenu preserves wholly unknown nutrients as null', () => {
  const result = aggregateMenu([beans], [{ foodId: 'beans', grams: 25 }]);
  assert.deepEqual(result.totals.fiber, { value: null, unit: 'g', known: 0, total: 1, complete: false });
});

test('aggregateMenu with no entries reports empty complete totals', () => {
  const result = aggregateMenu([rice], []);
  assert.equal(result.totalGrams, 0);
  assert.equal(result.itemCount, 0);
  assert.deepEqual(result.totals.calories, { value: null, unit: 'kcal', known: 0, total: 0, complete: true });
});

test('rejects unknown food IDs, malformed IDs, and invalid gram amounts', () => {
  assert.throws(() => aggregateMenu([rice], [{ foodId: 'missing', grams: 1 }]), /unknown food id/);
  assert.throws(() => aggregateMenu([rice], [{ foodId: '', grams: 1 }]), /foodId/);
  for (const grams of [-1, NaN, Infinity, '10']) {
    assert.throws(() => aggregateMenu([rice], [{ foodId: 'rice', grams }]), /finite, nonnegative/);
  }
});

test('rejects invalid nutrient values, incompatible units, and unknown nutrient names', () => {
  assert.throws(() => nutrientValue({ per100g: { protein: { value: -1, unit: 'g' } } }, 'protein', 100), /finite, nonnegative/);
  assert.throws(() => nutrientValue({ per100g: { calories: { value: 2, unit: 'g' } } }, 'calories', 100), /must use kcal/);
  assert.throws(() => nutrientValue(rice, 'sodiumIsh', 10), /unknown nutrient/);
});

test('rejects overflow during scaling and total gram accumulation', () => {
  assert.throws(() => nutrientValue({ per100g: { protein: { value: Number.MAX_VALUE, unit: 'g' } } }, 'protein', Number.MAX_VALUE), /not finite/);
  assert.throws(() => aggregateMenu([{ id: 'empty', per100g: {} }], [
    { foodId: 'empty', grams: Number.MAX_VALUE },
    { foodId: 'empty', grams: Number.MAX_VALUE },
  ]), /total grams is not finite/);
});
