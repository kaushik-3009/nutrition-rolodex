/* Portion options for a food: grams, ounces, every usable USDA portion for
   that record, curated household measures, and spoon sizes derived from a
   plain cup only where a spoonful makes sense. */
(function (root, factory) {
  const measures = factory(root);
  if (typeof module === "object" && module.exports) module.exports = measures;
  root.PantryMeasures = measures;
})(typeof globalThis !== "undefined" ? globalThis : this, function (root) {
  "use strict";

  const OZ = 28.349523125;
  const FRACTIONS = [
    [1 / 4, "¼"], [1 / 3, "⅓"], [1 / 2, "½"], [2 / 3, "⅔"], [3 / 4, "¾"],
    [1 / 8, "⅛"], [3 / 8, "⅜"], [5 / 8, "⅝"], [7 / 8, "⅞"]
  ];
  const GLYPHS = { "¼": 1 / 4, "½": 1 / 2, "¾": 3 / 4, "⅓": 1 / 3, "⅔": 2 / 3, "⅛": 1 / 8, "⅜": 3 / 8, "⅝": 5 / 8, "⅞": 7 / 8 };

  function parseAmount(text) {
    if (typeof text === "number") return Number.isFinite(text) && text > 0 ? text : null;
    if (typeof text !== "string") return null;
    const s = text.trim().replace(/\s+/g, " ").replace(",", ".");
    if (!s) return null;
    let value = null, m;
    if ((m = s.match(/^(\d+)\s*([¼½¾⅓⅔⅛⅜⅝⅞])$/))) value = Number(m[1]) + GLYPHS[m[2]];
    else if ((m = s.match(/^(\d+)\s+(\d+)\s*\/\s*(\d+)$/))) value = Number(m[3]) ? Number(m[1]) + Number(m[2]) / Number(m[3]) : null;
    else if ((m = s.match(/^(\d+)\s*\/\s*(\d+)$/))) value = Number(m[2]) ? Number(m[1]) / Number(m[2]) : null;
    else if (GLYPHS[s]) value = GLYPHS[s];
    else if (/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(s)) value = Number(s);
    return Number.isFinite(value) && value > 0 ? value : null;
  }

  function formatAmount(value) {
    if (!Number.isFinite(value) || value <= 0) return "";
    const whole = Math.floor(value + 1e-9);
    const frac = value - whole;
    if (frac < 1e-6) return String(whole);
    for (const [n, glyph] of FRACTIONS) if (Math.abs(frac - n) < 1e-6) return whole ? `${whole} ${glyph}` : glyph;
    return String(value >= 1 ? Number(value.toFixed(value >= 10 ? 1 : 2)) : Number(value.toPrecision(2)));
  }

  const LEADING_AMOUNT = /^\s*(\d+\s+\d+\s*\/\s*\d+|\d+\s*\/\s*\d+|\d*\.?\d+\s*[¼½¾⅓⅔⅛⅜⅝⅞]?|[¼½¾⅓⅔⅛⅜⅝⅞])\s*/;

  // Kinds, in display order: natural pieces first, then spoons and cups, then
  // packaged servings. Weight units always come last.
  const KIND_ORDER = { piece: 0, volume: 1, serving: 2, weight: 3 };
  const VOLUME = /^(cup|cups|tbsp|tablespoons?|tsp|teaspoons?|fl oz|quart|pint|liter|ml)\b/i;
  const SERVING = /^(serving|nlea serving|racc|package|packet|container|can|jar|bottle|bag|box|carton|pouch|envelope|scoop|portion)\b/i;
  const DROP = [
    /^oz\b(?!.*\bfl\b)/i, /^lb\b/i, /^g\b/i, /^grams?\b/i, /^kg\b/i,          // replaced by universal g/oz
    /^cubic inch/i, /^unit \(yield/i, /^roast\b/i, /^quart\b/i, /^gallon/i,
    /^(?:cup|serving|portion).*\b(?:yields?|amount to make|reconstituted from)\b/i,
    /yields?$/i
  ];
  const PLURAL = { cup: "cups", slice: "slices", piece: "pieces", tablespoon: "tablespoons", teaspoon: "teaspoons", serving: "servings",
    breast: "breasts", thigh: "thighs", drumstick: "drumsticks", wing: "wings", fillet: "fillets", steak: "steaks", chop: "chops",
    patty: "patties", link: "links", strip: "strips", bar: "bars", cookie: "cookies", cracker: "crackers", muffin: "muffins",
    package: "packages", packet: "packets", container: "containers", can: "cans", jar: "jars", bottle: "bottles", scoop: "scoops",
    egg: "eggs", leaf: "leaves", fruit: "fruits", item: "items", roll: "rolls", sandwich: "sandwiches", biscuit: "biscuits",
    tortilla: "tortillas", clove: "cloves", stalk: "stalks", ear: "ears", pie: "pies", cake: "cakes", doughnut: "doughnuts", bun: "buns" };

  function cleanLabel(text) {
    return String(text || "")
      .replace(/\s+/g, " ")
      .replace(/\(\s+/g, "(").replace(/\s+\)/g, ")")
      .replace(/^tablespoons?\b/i, "tbsp").replace(/^teaspoons?\b/i, "tsp")
      .replace(/^cups?\b/i, "cup")
      .replace(/^nlea serving\b/i, "serving").replace(/^racc\b/i, "serving (reference amount)")
      .replace(/\(1 nlea serving\)/i, "").replace(/\s+,/g, ",")
      .replace(/(\d)-(\d)\/(\d)"/g, "$1 $2/$3\"")
      .trim();
  }

  function kindOf(label) {
    if (VOLUME.test(label)) return "volume";
    if (SERVING.test(label)) return "serving";
    return "piece";
  }

  /** "cup, chopped" + 2 → "cups, chopped"; "medium (7\" long)" + 2 → unchanged. */
  function unitText(option, amount) {
    if (option.unit === "g") return "g";
    if (option.unit === "oz") return "oz";
    const label = option.unitLabel;
    if (amount <= 1 + 1e-9) return label;
    return label.replace(/^([a-z]+)\b/i, word => PLURAL[word.toLowerCase()] || word);
  }

  function describe(option, amount) {
    if (!option) return "";
    if (option.unit === "g") return `${Number(amount.toFixed(1))} g`;
    return `${formatAmount(amount)} ${unitText(option, amount)}`;
  }

  function slug(text) { return String(text).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60); }

  function householdFor(food) {
    const household = root.PANTRY_HOUSEHOLD_MEASURES;
    if (!household || !Array.isArray(household.foods)) return null;
    return household.foods.find(m => Number(m.fdcId) === Number(food.fdcId) && (!m.id || m.id === food.id)) || null;
  }

  // A spoonful only makes sense for pourable or granular foods, which is when
  // the source gives a plain cup without a cut ("chopped", "sliced", ...).
  const PLAIN_CUP = /^cup(?:\s*\((?:\d+(?:\.\d+)?\s*fl oz|packed|unpacked|sifted|spooned|liquid|melted|ground)\))?$|^cup,\s*(?:packed|unpacked|sifted|spooned|ground|liquid|stirred|whipped)$/i;

  const cache = new Map();
  const typicalOunces = new Map();

  function optionsFor(food) {
    if (!food || typeof food !== "object") return [];
    if (food.id && cache.has(food.id)) return cache.get(food.id);
    const options = [];
    const seen = new Set();
    const add = option => {
      if (!Number.isFinite(option.grams) || option.grams <= 0 || option.grams > 5000) return;
      const key = `${option.unitLabel.toLowerCase()}|${Math.round(option.grams * 10)}`;
      const labelKey = option.unitLabel.toLowerCase();
      if (seen.has(key) || seen.has(labelKey) || options.some(existing => existing.id === option.id)) return;
      seen.add(key); seen.add(labelKey);
      options.push(option);
    };

    for (const portion of Array.isArray(food.portionOptions) ? food.portionOptions : []) {
      const rawLabel = String(portion.label || "");
      const leading = rawLabel.match(LEADING_AMOUNT);
      const amount = parseAmount(leading ? leading[1].replace(/\s+/g, " ").replace(/(\d)\s*([¼½¾⅓⅔⅛⅜⅝⅞])/, "$1 $2") : "") || Number(portion.amount) || 1;
      let label = cleanLabel(leading ? rawLabel.slice(leading[0].length) : rawLabel);
      if (/^fl\b/i.test(label) && !/^fl oz/i.test(label)) label = label.replace(/^fl\b/i, "fl oz");
      if (/^oz\b/i.test(label) && amount > 1 && amount <= 16 && food.id && !typicalOunces.has(food.id)) typicalOunces.set(food.id, amount);
      if (!label || DROP.some(pattern => pattern.test(label))) continue;
      const grams = Number(portion.grams) / amount;
      const kind = kindOf(label);
      // "medium (7\" to 7 7/8\" long)" reads as "medium"; the size stays in the tooltip.
      const short = label.replace(/\s*\([^)]*"[^)]*\)/g, "").trim();
      const display = short && !seen.has(short.toLowerCase()) ? short : label;
      add({ id: `p-${slug(label)}`, unitLabel: display, label: display, fullLabel: label, unit: kind === "volume" ? (/^tbsp/.test(label) ? "tbsp" : /^tsp/.test(label) ? "tsp" : /^cup/.test(label) ? "cup" : "volume") : kind, kind, grams, source: `${label} · ${portion.source || "USDA portion"}` });
    }

    const legacy = householdFor(food);
    if (legacy) {
      const source = text => text || "Curated household measure";
      if (legacy.cupGrams && !options.some(o => o.unit === "cup")) add({ id: "cup", unitLabel: "cup", label: "cup", unit: "cup", kind: "volume", grams: Number(legacy.cupGrams), source: source(legacy.cupSource), plain: true });
      if (legacy.tbspGrams && !options.some(o => o.unit === "tbsp")) add({ id: "tbsp", unitLabel: "tbsp", label: "tbsp", unit: "tbsp", kind: "volume", grams: Number(legacy.tbspGrams), source: source(legacy.tbspSource) });
      if (legacy.countMeasure && !options.some(o => o.kind === "piece")) {
        const c = legacy.countMeasure;
        add({ id: "count", unitLabel: c.unit, label: c.unit, unit: "piece", kind: "piece", grams: Number(c.grams), source: c.source || "Curated household measure" });
      }
    }

    const plainCup = options.find(o => o.unit === "cup" && (o.plain || PLAIN_CUP.test(o.unitLabel)));
    if (plainCup) {
      if (!options.some(o => o.unit === "tbsp")) add({ id: "tbsp", unitLabel: "tbsp", label: "tbsp", unit: "tbsp", kind: "volume", grams: plainCup.grams / 16, source: `${plainCup.source}; 1 cup = 16 tbsp` });
      if (!options.some(o => o.unit === "tsp")) add({ id: "tsp", unitLabel: "tsp", label: "tsp", unit: "tsp", kind: "volume", grams: plainCup.grams / 48, source: `${plainCup.source}; 1 cup = 48 tsp` });
    }

    const sizeRank = label => /^medium\b/i.test(label) ? 0 : /^(large|small)\b/i.test(label) ? 1 : /^(extra|jumbo|very)/i.test(label) ? 2 : 1;
    const volumeRank = unit => ({ cup: 0, tbsp: 1, tsp: 2 })[unit] ?? 3;
    options.sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind]
      || (a.kind === "piece" ? sizeRank(a.label) - sizeRank(b.label) : 0)
      || (a.kind === "volume" ? volumeRank(a.unit) - volumeRank(b.unit) : 0));

    options.push({ id: "g", unitLabel: "g", label: "grams", unit: "g", kind: "weight", grams: 1, source: "metric" });
    options.push({ id: "oz", unitLabel: "oz", label: "ounces", unit: "oz", kind: "weight", grams: OZ, source: "1 oz = 28.35 g" });
    if (food.id) cache.set(food.id, options);
    return options;
  }

  /** The measure and amount a food opens with. */
  function defaultFor(food) {
    const options = optionsFor(food);
    const legacy = householdFor(food);
    const egg = /^egg,/i.test(String(food.name || "")) && options.find(o => o.kind === "piece" && /^large\b/i.test(o.label));
    const piece = egg || options.find(o => o.kind === "piece" && /^medium\b/i.test(o.label)) || options.find(o => o.kind === "piece");
    if (legacy) {
      if (legacy.countMeasure && legacy.countMeasure.default && piece) return { option: piece, amount: Number(legacy.countMeasure.defaultAmount) || 1 };
      const unit = legacy.defaultUnit === "count" ? "piece" : legacy.defaultUnit;
      const preferred = options.find(o => o.unit === unit);
      if (preferred && unit !== "g") return { option: preferred, amount: Number(legacy.defaultAmount) || 1 };
    }
    // A whole fillet, roast or pizza is rarely one serving.
    if (piece && piece.grams > 250 && typicalOunces.has(food.id)) return { option: options.find(o => o.id === "oz"), amount: typicalOunces.get(food.id) };
    if (piece) return { option: piece, amount: 1 };
    const serving = options.find(o => o.kind === "serving" && !/reference amount/.test(o.label));
    if (serving) return { option: serving, amount: 1 };
    const tbsp = options.find(o => o.unit === "tbsp");
    const cup = options.find(o => o.unit === "cup");
    const kcal = food.per100g && food.per100g.calories && food.per100g.calories.value;
    // Oils, butter, nut butters, sugar and syrups are measured by the spoon.
    if (tbsp && (!cup || (kcal && kcal * cup.grams / 100 > 600))) return { option: tbsp, amount: 1 };
    if (cup) return { option: cup, amount: food.state === "dry" ? 0.25 : 1 };
    if (typicalOunces.has(food.id)) return { option: options.find(o => o.id === "oz"), amount: typicalOunces.get(food.id) };
    return { option: options.find(o => o.id === "g"), amount: 100 };
  }

  return Object.freeze({ optionsFor, defaultFor, parseAmount, formatAmount, describe, unitText, OZ });
});
