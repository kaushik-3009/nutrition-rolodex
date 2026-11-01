(function (root, factory) {
  const measures = factory(root);
  if (typeof module === "object" && module.exports) module.exports = measures;
  root.PantryMeasures = measures;
})(typeof globalThis !== "undefined" ? globalThis : this, function (root) {
  "use strict";

  const FRACTIONS = [
    [1 / 4, "¼"], [1 / 3, "⅓"], [1 / 2, "½"], [2 / 3, "⅔"], [3 / 4, "¾"],
    [1 / 8, "⅛"], [3 / 8, "⅜"], [5 / 8, "⅝"], [7 / 8, "⅞"]
  ];

  function parseAmount(text) {
    if (typeof text === "number") return Number.isFinite(text) && text > 0 ? text : null;
    if (typeof text !== "string") return null;
    const s = text.trim().replace(/\s+/g, " ");
    if (!s) return null;
    let value;
    const mixedGlyph = s.match(/^(\d+)\s+([¼½¾⅓⅔⅛⅜⅝⅞])$/);
    const mixed = s.match(/^(\d+)\s+(\d+)\s*\/\s*(\d+)$/);
    const fraction = s.match(/^(\d+)\s*\/\s*(\d+)$/);
    const decimal = s.match(/^(?:\d+(?:\.\d*)?|\.\d+)$/);
    const unicode = { "¼": 1 / 4, "½": 1 / 2, "¾": 3 / 4, "⅓": 1 / 3, "⅔": 2 / 3, "⅛": 1 / 8, "⅜": 3 / 8, "⅝": 5 / 8, "⅞": 7 / 8 };
    if (mixedGlyph) value = Number(mixedGlyph[1]) + unicode[mixedGlyph[2]];
    else if (mixed) {
      const den = Number(mixed[3]);
      if (!den) return null;
      value = Number(mixed[1]) + Number(mixed[2]) / den;
    } else if (fraction) {
      const den = Number(fraction[2]);
      if (!den) return null;
      value = Number(fraction[1]) / den;
    } else if (unicode[s]) value = unicode[s];
    else if (decimal) value = Number(s);
    else {
      const lead = s.match(/^(\d+)([¼½¾⅓⅔⅛⅜⅝⅞])$/);
      if (!lead) return null;
      value = Number(lead[1]) + unicode[lead[2]];
    }
    return Number.isFinite(value) && value > 0 ? value : null;
  }

  function formatAmount(value) {
    if (!Number.isFinite(value) || value <= 0) return "";
    const whole = Math.floor(value + 1e-9);
    const frac = value - whole;
    let best = null;
    for (const [n, glyph] of FRACTIONS) {
      const error = Math.abs(frac - n);
      if (!best || error < best.error) best = { error, glyph };
    }
    if (best && best.error < 1e-8) return whole ? `${whole} ${best.glyph}` : best.glyph;
    return String(Number(value.toPrecision(12)));
  }

  function amountFromLabel(label) {
    const match = String(label || "").trim().match(/^(\d+\s+(?:\d+\s*\/\s*\d+|[¼½¾⅓⅔⅛⅜⅝⅞])|\d+(?:\.\d+)?|\d+\s*\/\s*\d+|[¼½¾⅓⅔⅛⅜⅝⅞]|\d+[¼½¾⅓⅔⅛⅜⅝⅞])(?:\s+|$)/);
    return match ? parseAmount(match[1]) : null;
  }

  const COUNT_NOUNS = "egg|eggs|slice|slices|piece|pieces|item|items|link|links|patty|patties|fillet|fillets|strip|strips|wing|wings|clove|cloves|leaf|leaves|fruit|fruits|carrot|carrots|tomato|tomatoes|potato|potatoes|onion|onions|pepper|peppers|cucumber|cucumbers|banana|bananas|apple|apples|orange|oranges|berry|berries|almond|almonds|cashew|cashews|walnut|walnuts|mushroom|mushrooms|tortilla|tortillas|biscuit|biscuits|cracker|crackers";
  function unitFromPortion(p, food) {
    const raw = String(p.unit || "").toLowerCase().trim();
    const label = String(p.label || "").toLowerCase();
    const sizedCount = (label.match(/^\s*(?:\d+(?:\.\d+)?|\d+\s*\/\s*\d+)?\s*(?:small|medium|large|extra large|jumbo)\s+(egg|eggs|slice|slices|piece|pieces|item|items|link|links|patty|patties|fillet|fillets|strip|strips|wing|wings|clove|cloves|leaf|leaves|fruit|fruits|carrot|carrots|tomato|tomatoes|potato|potatoes|onion|onions|pepper|peppers|cucumber|cucumbers|banana|bananas|apple|apples|orange|oranges|berry|berries|almond|almonds|cashew|cashews|walnut|walnuts|mushroom|mushrooms|tortilla|tortillas|biscuit|biscuits|cracker|crackers)\b/) || [])[1] || "";
    const labelUnit = (label.match(/^\s*(?:\d+(?:\.\d+)?|\d+\s*\/\s*\d+|[¼½¾⅓⅔⅛⅜⅝⅞]|\d+[¼½¾⅓⅔⅛⅜⅞])?\s*(cup|cups|tbsp|tablespoon|tablespoons|tsp|teaspoon|teaspoons|egg|eggs|slice|slices|piece|pieces|item|items|link|links|patty|patties|fillet|fillets|strip|strips|wing|wings|clove|cloves|leaf|leaves|fruit|fruits|carrot|carrots|tomato|tomatoes|potato|potatoes|onion|onions|pepper|peppers|cucumber|cucumbers|banana|bananas|apple|apples|orange|oranges|berry|berries|almond|almonds|cashew|cashews|walnut|walnuts|mushroom|mushrooms|tortilla|tortillas|biscuit|biscuits|cracker|crackers)\b/) || [])[1] || "";
    const eggFood = /^egg\b/i.test(String(food && (food.sourceDescription || food.name) || ""));
    const eggSize = eggFood && (/^(small|medium|large|extra large|jumbo)$/i.test(raw) || /^\s*(?:\d+(?:\.\d+)?|\d+\s*\/\s*\d+)?\s*(?:small|medium|large|extra large|jumbo)\s*$/i.test(label));
    const unit = labelUnit || sizedCount || (eggSize ? "egg" : raw);
    if (/^(cup|cups)$/.test(unit)) return "cup";
    if (/^(tbsp|tablespoon|tablespoons)$/.test(unit)) return "tbsp";
    if (/^(tsp|teaspoon|teaspoons)$/.test(unit)) return "tsp";
    if (new RegExp(`^(?:${COUNT_NOUNS})$`).test(unit)) return "count";
    return "";
  }

  function householdFor(food) {
    const household = root.PANTRY_HOUSEHOLD_MEASURES || null;
    if (!household || !Array.isArray(household.foods)) return null;
    return household.foods.find((m) => Number(m.fdcId) === Number(food.fdcId)) || null;
  }

  function optionsFor(food) {
    if (!food || typeof food !== "object") return [];
    const options = [{ id: "g", label: "Grams", unit: "g", grams: 1, source: "metric", defaultAmount: food.defaultUnit === "g" ? Number(food.defaultAmount) || 100 : 100 }];
    const byUnit = new Map();
    const add = (option, variant = false) => {
      if (!Number.isFinite(option.grams) || option.grams <= 0) return;
      const key = variant ? `${option.unit}:${option.label}` : option.unit;
      if (byUnit.has(key)) return;
      byUnit.set(key, option);
      options.push(option);
    };
    for (const p of Array.isArray(food.portionOptions) ? food.portionOptions : []) {
      const unit = unitFromPortion(p, food);
      if (!unit) continue;
      const amount = parseAmount(p.amount) || amountFromLabel(p.label) || 1;
      const grams = Number(p.grams) / amount;
      if (!Number.isFinite(grams) || grams <= 0) continue;
      const match = String(p.label || "").match(/^\s*(?:\d+\s+(?:\d+\s*\/\s*\d+|[¼½¾⅓⅔⅛⅜⅝⅞])|\d+(?:\.\d+)?|\d+\s*\/\s*\d+|[¼½¾⅓⅔⅛⅜⅝⅞]|\d+[¼½¾⅓⅔⅛⅜⅝])\s*(.*)$/);
      let detail = (match ? match[1] : p.label || unit).trim().replace(/^[,\s]+/, "");
      const unitAliases = { cup: "cups?", tbsp: "tbsp|tablespoons?", tsp: "tsp|teaspoons?" };
      const detailUnitPattern = new RegExp(`^(?:${unit === "count" ? COUNT_NOUNS : unitAliases[unit] || unit + "s?"})\\b[,\\s]*`, "i");
      detail = detail.replace(detailUnitPattern, "").replace(/^[,\s]+/, "");
      if (unit !== "count" && new RegExp(`\\d+(?:\\.\\d+)?\\s+(?:(?:small|medium|large|extra large|jumbo)\\s+)?(?:${COUNT_NOUNS})\\b`, "i").test(detail)) detail = "";
      let label;
      if (unit === "count") {
        const sourceText = String(p.label || "").replace(/^\s*(?:\d+\s+(?:\d+\s*\/\s*\d+|[¼½¾⅓⅔⅛⅜⅝⅞])|\d+(?:\.\d+)?|\d+\s*\/\s*\d+|[¼½¾⅓⅔⅛⅜⅝⅞]|\d+[¼½¾⅓⅔⅛⅜⅝⅞])\s*/, "");
        const nounMatch = sourceText.match(new RegExp(`\\b(${COUNT_NOUNS})\\b`, "i"));
        const nounText = nounMatch ? nounMatch[1].toLowerCase() : "";
        const singular = { eggs: "egg", slices: "slice", pieces: "piece", items: "item", links: "link", patties: "patty", fillets: "fillet", strips: "strip", wings: "wing", cloves: "clove", leaves: "leaf", fruits: "fruit", carrots: "carrot", tomatoes: "tomato", potatoes: "potato", onions: "onion", peppers: "pepper", cucumbers: "cucumber", bananas: "banana", apples: "apple", oranges: "orange", berries: "berry", almonds: "almond", cashews: "cashew", walnuts: "walnut", mushrooms: "mushroom", tortillas: "tortilla", biscuits: "biscuit", crackers: "cracker" };
        const noun = nounMatch ? (singular[nounText] || nounText) : (/^egg\b/i.test(String(food.sourceDescription || food.name)) ? "egg" : unit);
        const adjectives = nounMatch ? `${sourceText.slice(0, nounMatch.index)} ${sourceText.slice(nounMatch.index + nounMatch[0].length)}`.replace(/[,\s]+/g, " ").trim() : sourceText.trim();
        label = noun[0].toUpperCase() + noun.slice(1) + (adjectives ? `, ${adjectives}` : "");
      } else {
        const unitTitle = unit === "tbsp" ? "Tablespoon" : unit === "tsp" ? "Teaspoon" : "Cup";
        label = detail ? `${unitTitle}, ${detail}` : unitTitle;
      }
      const prior = byUnit.get(unit);
      add({ id: prior ? `${unit}-${options.length}` : unit, label, unit, grams, source: p.source || "USDA source portion", defaultAmount: unit === "count" ? 1 : amount }, Boolean(prior));
    }
    const legacy = householdFor(food);
    if (legacy) {
      const src = (s) => s || "Original household measure estimate";
      if (legacy.cupGrams && !byUnit.has("cup")) add({ id: "cup", label: "Cup", unit: "cup", grams: Number(legacy.cupGrams), source: src(legacy.cupSource), defaultAmount: legacy.defaultUnit === "cup" ? Number(legacy.defaultAmount) || 1 : 1 });
      if (legacy.tbspGrams && !byUnit.has("tbsp")) add({ id: "tbsp", label: "Tablespoon", unit: "tbsp", grams: Number(legacy.tbspGrams), source: src(legacy.tbspSource), defaultAmount: legacy.defaultUnit === "tbsp" ? Number(legacy.defaultAmount) || 1 : 1 });
      if (legacy.countMeasure && !options.some((o) => o.unit === "count")) {
        const c = legacy.countMeasure;
        add({ id: "count", label: c.unit[0].toUpperCase() + c.unit.slice(1), unit: "count", grams: Number(c.grams), source: c.source || "Original household measure estimate", defaultAmount: Number(c.defaultAmount) || 1, default: Boolean(c.default) });
      }
      const legacyCountOption = options.find((o) => o.unit === "count");
      if (legacyCountOption && legacy.countMeasure && legacy.countMeasure.default) legacyCountOption.default = true;
    }
    const cup = options.find((o) => o.unit === "cup");
    if (cup && !options.some((o) => o.unit === "tbsp")) add({ id: "tbsp", label: "Tablespoon", unit: "tbsp", grams: cup.grams / 16, source: `${cup.source}; US measure conversion (1 cup = 16 tbsp)`, defaultAmount: 1 });
    if (cup && !options.some((o) => o.unit === "tsp")) add({ id: "tsp", label: "Teaspoon", unit: "tsp", grams: cup.grams / 48, source: `${cup.source}; US measure conversion (1 cup = 48 tsp)`, defaultAmount: 1 });
    const preferred = legacy && options.find((o) => o.unit === legacy.defaultUnit);
    if (preferred) preferred.defaultAmount = Number(legacy.defaultAmount) || preferred.defaultAmount || 1;
    return options;
  }

  return Object.freeze({ optionsFor, parseAmount, formatAmount });
});
