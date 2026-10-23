const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { aggregateMenu, units } = require('../nutrition.js');
const text = fs.readFileSync(path.join(__dirname, '../data/catalog-data.js'), 'utf8');
const foods = JSON.parse(text.replace(/^\s*window\.PANTRY_CATALOG\s*=\s*/, '').replace(/;\s*$/, ''));

test('catalog keeps unique source identities and exact source names', () => {
  assert.ok(foods.length > 7000, 'the complete SR Legacy catalog must be present');
  assert.equal(new Set(foods.map(food => food.id)).size, foods.length);
  assert.equal(new Set(foods.map(food => food.fdcId)).size, foods.length);
  for (const food of foods) {
    assert.equal(food.name, food.sourceDescription, `unsupported name for ${food.id}`);
    assert.ok(Number.isInteger(food.fdcId) && food.fdcId > 0);
    assert.ok(food.group && food.sourceDataset, `source metadata for ${food.id}`);
    for (const portion of food.portionOptions || []) {
      assert.ok(portion.grams > 0 && Number.isFinite(portion.grams), food.id);
      assert.ok(portion.label && portion.source, `portion provenance for ${food.id}`);
    }
  }
});

test('every food can contribute to a menu without invalid values or incompatible units', () => {
  const result = aggregateMenu(foods, foods.map(food => ({ foodId: food.id, grams: 100 })));
  assert.equal(result.itemCount, foods.length);
  for (const [key, unit] of Object.entries(units)) {
    const reported = foods.filter(food => food.per100g?.[key]?.value != null);
    assert.equal(result.totals[key].unit, unit);
    assert.equal(result.totals[key].known, reported.length);
    assert.equal(result.totals[key].complete, reported.length === foods.length);
  }
  assert.ok(result.totals.calories.value > 0);
  assert.equal(result.totals.iodine.complete, false, 'iodine gaps must remain visible');
});
