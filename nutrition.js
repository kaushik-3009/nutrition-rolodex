(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.PantryNutrition = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  // These are the canonical units used by the pantry catalog. The module does
  // not convert units: a different unit for a known nutrient is a data error.
  const UNITS = Object.freeze({
    calories: "kcal", carbs: "g", protein: "g", fat: "g", fiber: "g",
    sugars: "g", addedSugars: "g", satFat: "g", transFat: "g", calcium: "mg", iron: "mg",
    magnesium: "mg", phosphorus: "mg", potassium: "mg", sodium: "mg",
    zinc: "mg", copper: "mg", thiamin: "mg", riboflavin: "mg", niacin: "mg",
    vitaminB6: "mg", vitaminB12: "mcg", pantothenicAcid: "mg", biotin: "mcg",
    iodine: "mcg", vitaminA: "mcg", vitaminC: "mg",
    vitaminD: "mcg", vitaminE: "mg", vitaminK: "mcg", selenium: "mcg",
    folate: "mcg", folateDFE: "mcg", choline: "mg", cholesterol: "mg"
  });

  function assertFiniteNonnegative(value, label) {
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
      throw new TypeError(label + " must be a finite, nonnegative number");
    }
  }

  function nutrientAmount(food, key) {
    if (!food || typeof food !== "object") throw new TypeError("food must be an object");
    if (typeof key !== "string" || !Object.prototype.hasOwnProperty.call(UNITS, key)) {
      throw new RangeError("unknown nutrient: " + String(key));
    }
    const raw = food.per100g && food.per100g[key];
    if (raw == null) return null;
    if (typeof raw !== "object") throw new TypeError("invalid " + key + " nutrient record");
    if (raw.value == null) return null;
    assertFiniteNonnegative(raw.value, key + " value");
    if (raw.unit !== UNITS[key]) {
      throw new RangeError(key + " must use " + UNITS[key] + " units (got " + String(raw.unit) + ")");
    }
    return raw.value;
  }

  function nutrientValue(food, key, grams) {
    assertFiniteNonnegative(grams, "grams");
    const amountPer100g = nutrientAmount(food, key);
    if (amountPer100g === null) return null;
    const value = amountPer100g * grams / 100;
    if (!Number.isFinite(value)) throw new RangeError("calculated " + key + " value is not finite");
    return value;
  }

  function aggregateMenu(catalog, entries) {
    if (!Array.isArray(catalog)) throw new TypeError("catalog must be an array");
    if (!Array.isArray(entries)) throw new TypeError("entries must be an array");
    const foods = new Map();
    for (const food of catalog) {
      if (!food || typeof food.id !== "string" || food.id.trim() === "") {
        throw new TypeError("each catalog food must have a nonempty string id");
      }
      if (foods.has(food.id)) throw new RangeError("duplicate food id: " + food.id);
      foods.set(food.id, food);
    }

    const totals = Object.create(null);
    for (const key of Object.keys(UNITS)) {
      totals[key] = { value: null, unit: UNITS[key], known: 0, total: entries.length, complete: entries.length === 0 };
    }

    let totalGrams = 0;
    for (const entry of entries) {
      if (!entry || typeof entry.foodId !== "string" || entry.foodId.trim() === "") {
        throw new TypeError("each entry must have a nonempty foodId");
      }
      assertFiniteNonnegative(entry.grams, "grams");
      const food = foods.get(entry.foodId);
      if (!food) throw new RangeError("unknown food id: " + entry.foodId);
      totalGrams += entry.grams;
      if (!Number.isFinite(totalGrams)) throw new RangeError("total grams is not finite");

      for (const key of Object.keys(UNITS)) {
        const amount = nutrientValue(food, key, entry.grams);
        if (amount === null) continue;
        const summary = totals[key];
        summary.value = (summary.value === null ? 0 : summary.value) + amount;
        if (!Number.isFinite(summary.value)) throw new RangeError("calculated " + key + " total is not finite");
        summary.known += 1;
      }
    }
    for (const summary of Object.values(totals)) summary.complete = summary.known === summary.total;
    return { totals, totalGrams, itemCount: entries.length };
  }

  return Object.freeze({ nutrientValue, aggregateMenu, units: UNITS });
});
