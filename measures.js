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
    let s = text.trim().replace(/\s+/g, " ");
    // "1,000" is a thousands separator; "1,5" is a decimal comma.
    s = /^\d{1,3}(,\d{3})+(\.\d+)?$/.test(s) ? s.replace(/,/g, "") : s.replace(",", ".");
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
  const SERVING = /^(reference serving|serving|nlea serving|racc|package|packet|container|can|jar|bottle|bag|box|carton|pouch|envelope|scoop|portion)\b/i;
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
      .replace(/^nlea serving\b/i, "serving").replace(/^racc\b/i, "reference serving")
      .replace(/\(1 nlea serving\)/i, "").replace(/,?\s*NS as to [^,)]*/gi, "").replace(/\s+,/g, ",")
      .replace(/(\d)-(\d)\/(\d)"/g, "$1 $2/$3\"")
      .trim();
  }

  function kindOf(label) {
    if (VOLUME.test(label)) return "volume";
    if (SERVING.test(label)) return "serving";
    return "piece";
  }

  /** "cup, chopped" + 2 → "cups, chopped"; "medium (7\" long)" + 2 → unchanged. */
  // Words that never take a plural ("2 medium", "3 fl oz", "2 extra large").
  const NO_PLURAL = /^(small|medium|large|extra|jumbo|very|thin|thick|whole|half|individual|regular|miniature|mini|fl|oz|nlea|racc|each|order|tbsp|tsp|frozen|baby|cooked|raw|dry|single|double|one|two|regular)$/i;
  const SINGULAR = Object.fromEntries(Object.entries(PLURAL).map(([one, many]) => [many, one]));
  function pluralWord(word) {
    const lower = word.toLowerCase();
    if (NO_PLURAL.test(lower) || lower.length < 3) return word;
    if (PLURAL[lower]) return PLURAL[lower];
    if (SINGULAR[lower] || /[^s]s$/.test(lower)) return word; // already plural
    if (/(s|x|ch|sh)$/.test(lower) || /^(potato|tomato|mango)$/.test(lower)) return word + "es";
    if (/[^aeiou]y$/.test(lower)) return word.slice(0, -1) + "ies";
    return word + "s";
  }
  function singularWord(word) {
    const lower = word.toLowerCase();
    if (NO_PLURAL.test(lower) || lower.length < 4) return word;
    if (SINGULAR[lower]) return SINGULAR[lower];
    if (/ies$/.test(lower)) return word.slice(0, -3) + "y";
    if (/(ches|shes|xes|oes)$/.test(lower)) return word.slice(0, -2);
    if (/[^su]s$/.test(lower)) return word.slice(0, -1);
    return word;
  }
  function unitText(option, amount) {
    if (option.unit === "g") return "g";
    if (option.unit === "oz") return "oz";
    return option.unitLabel.replace(/^([a-z]+)\b/i, word => amount > 1 + 1e-9 ? pluralWord(word) : singularWord(word));
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
      // Same kind of portion at (nearly) the same weight: keep the first.
      const head = option.unitLabel.toLowerCase().split(/[ ,(]/)[0];
      if (options.some(existing => existing.unitLabel.toLowerCase().split(/[ ,(]/)[0] === head && Math.abs(existing.grams - option.grams) / option.grams < 0.03)) return;
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
      let label = cleanLabel(leading ? rawLabel.slice(leading[0].length) : rawLabel)
        .replace(/\s*\((?:includes?|include) [^)]*\)/gi, "").trim();
      if (/^fl\b/i.test(label) && !/^fl oz/i.test(label)) label = label.replace(/^fl\b/i, "fl oz");
      // Some records give the unit separately: "1 chopped" with unit "cup".
      const sourceUnit = String(portion.unit || "").toLowerCase();
      if (/^(cup|tbsp|tsp|tablespoon|teaspoon)$/.test(sourceUnit) && !VOLUME.test(label)) label = `${sourceUnit.replace("tablespoon", "tbsp").replace("teaspoon", "tsp")}, ${label}`;
      // "0.5 container (4 oz)": the weight describes the half, not one container.
      if (Math.abs(amount - 1) > 1e-9) label = label.replace(/\s*\([\d.\/ ]+\s*(?:fl oz|oz|g)\)/i, "").trim();
      if (/^oz\b/i.test(label) && amount >= 1 && amount <= 16 && food.id && !(typicalOunces.get(food.id) > 1)) typicalOunces.set(food.id, amount);
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

  // Foods measured by the spoon whatever portions the source lists.
  const SPOON_FOOD = /\b(oil|butter|margarine|mayonnaise|dressing|sauce|syrup|honey|jams?|jelly|preserves|marmalade|catsup|ketchup|mustard|sugars?|cream cheese|ghee|lard|shortening|vinegar|spread|salsa|relish|hummus|cream, (?:sour|heavy|light|half)|sour cream|^cheese, cream|molasses|tahini)\b/i;

  /** The measure and amount a food opens with: one ordinary serving. */
  function defaultFor(food) {
    const options = optionsFor(food);
    const find = test => options.find(test);
    const legacy = householdFor(food);
    const name = String(food.name || "");
    const kcal100 = food.per100g && food.per100g.calories && food.per100g.calories.value || 0;
    const kcal = (option, amount = 1) => kcal100 * option.grams * amount / 100;
    const reasonable = (option, amount = 1) => option.grams * amount >= 5 && option.grams * amount <= 300 && kcal(option, amount) <= 450;
    const g = find(o => o.id === "g"), oz = find(o => o.id === "oz");
    const tbsp = find(o => o.unit === "tbsp"), tsp = find(o => o.unit === "tsp");
    const cup = find(o => o.unit === "cup");
    const pieces = options.filter(o => o.kind === "piece");
    const sizeRank = o => /^egg,/i.test(name) ? (/\blarge\b/i.test(o.label) && !/extra/i.test(o.label) ? 0 : 3)
      : /\bmedium\b/i.test(o.label) ? 0 : /^(slice|piece)\b/i.test(o.label) ? 1 : 2;
    const piece = pieces.filter(o => reasonable(o)).sort((a, b) => sizeRank(a) - sizeRank(b))[0];

    if (legacy) {
      if (legacy.countMeasure && legacy.countMeasure.default && piece) return { option: piece, amount: Number(legacy.countMeasure.defaultAmount) || 1 };
      const unit = legacy.defaultUnit === "count" ? "piece" : legacy.defaultUnit;
      const preferred = find(o => o.unit === unit);
      if (preferred && unit !== "g") return { option: preferred, amount: Number(legacy.defaultAmount) || 1 };
    }
    if (food.group === "Spices and Herbs" && tsp) return { option: tsp, amount: 1 };
    if (SPOON_FOOD.test(name) && !/^(Nuts|Peanuts|Seeds)/i.test(name) && tbsp && !/^(Beverages|Soup)/i.test(name)) return { option: tbsp, amount: 1 };
    if (food.group === "Nut and Seed Products" && !/butter|milk|flour|oil|paste/i.test(name)) return { option: oz, amount: 1 };
    if (piece) return { option: piece, amount: 1 };
    const serving = find(o => o.kind === "serving" && !/reference/.test(o.label) && reasonable(o));
    if (serving) return { option: serving, amount: 1 };
    if (cup) {
      const amount = food.state === "dry" ? 0.25 : reasonable(cup) && cup.grams <= 250 ? 1 : reasonable(cup, 0.5) ? 0.5 : 0;
      if (amount) return { option: cup, amount };
    }
    if (tbsp && kcal(tbsp) > 40) return { option: tbsp, amount: 1 };
    const floz = find(o => /^fl oz/.test(o.unitLabel));
    if (floz) return { option: floz, amount: 8 };
    if (typicalOunces.has(food.id)) return { option: oz, amount: typicalOunces.get(food.id) };
    const reference = find(o => /reference/.test(o.label) && reasonable(o));
    if (reference) return { option: reference, amount: 1 };
    // Energy-dense foods without portions (chips, ghee, nuts) start at 1 oz, not 100 g.
    if (kcal100 > 350) return { option: oz, amount: 1 };
    return { option: g, amount: 100 };
  }

  return Object.freeze({ optionsFor, defaultFor, parseAmount, formatAmount, describe, unitText, OZ });
});
