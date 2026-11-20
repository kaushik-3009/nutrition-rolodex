/* Ranked food search and friendly display names. Pure functions; runs in the
   browser (window.PantrySearch) and in Node (module.exports) for tests. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.PantrySearch = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const normalize = value => String(value || "").toLowerCase().normalize("NFKD")
    .replace(/\p{M}/gu, "").replace(/[^\p{L}\p{N}%]+/gu, " ").trim();

  // Light English singularization so "eggs" finds "Egg" and "potatoes" finds
  // "Potato". Applied identically to indexed words and query terms.
  function stem(word) {
    if (word.length <= 3 || /\d/.test(word)) return word;
    if (/ies$/.test(word)) return word.slice(0, -3) + "y";
    if (/(oes|ches|shes|xes|sses)$/.test(word)) return word.slice(0, -2);
    if (/[^su]s$/.test(word) && !/(is|us|ss)$/.test(word)) return word.slice(0, -1);
    return word;
  }

  // Query synonyms: each term also matches any of these (stemmed) prefixes.
  const SYNONYMS = {
    chickpea: ["garbanzo", "chana"], garbanzo: ["chickpea"], chana: ["chickpea", "garbanzo"],
    curd: ["yogurt"], dahi: ["yogurt"], yoghurt: ["yogurt"],
    oatmeal: ["oat"], porridge: ["oat"],
    cilantro: ["coriander"], coriander: ["cilantro"],
    aubergine: ["eggplant"], brinjal: ["eggplant"], courgette: ["zucchini"],
    capsicum: ["pepper"], prawn: ["shrimp"], scallion: ["onion"],
    dal: ["lentil"], dhal: ["lentil"], daal: ["lentil"], masoor: ["lentil"], moong: ["mung"], mung: ["moong"], rajma: ["kidney"],
    ghee: ["anhydrous"], curds: ["yogurt"],
    soda: ["carbonated"], pop: ["carbonated"],
    mince: ["ground"], minced: ["ground"], hamburger: ["ground"],
    soy: ["soya", "soybean"], soya: ["soy"],
    whey: ["whey"], coffee: ["coffee"], tea: ["tea"],
    ladyfinger: ["okra"], bhindi: ["okra"], aloo: ["potato"], gobi: ["cauliflower"], palak: ["spinach"],
    atta: ["wheat"], maida: ["wheat"], besan: ["chickpea"], jaggery: ["sugar"],
    chapati: ["chapati", "roti", "tortilla"], roti: ["chapati", "roti"],
    pb: ["peanut"], oj: ["orange"], ketchup: ["catsup"], catsup: ["ketchup"], fries: ["french"], zucchini: ["zucchini"]
  };

  // Everyday words a source name omits. Matched on the source description.
  const ALIAS_RULES = [
    [/^Butter oil, anhydrous/i, "ghee clarified butter"],
    [/^Yogurt/i, "curd dahi"],
    [/^Lentils/i, "dal dhal masoor"],
    [/^Chickpeas/i, "chana chole"],
    [/^Mung beans/i, "moong dal"],
    [/^Beans, kidney/i, "rajma"],
    [/^Peas, green, split/i, "chana dal matar"],
    [/^Pigeon peas/i, "toor dal arhar tuvar"],
    [/^Cereals, oats/i, "oatmeal porridge"],
    [/^Beverages, coffee, brewed/i, "black coffee"],
    [/^Beverages, tea, black, brewed/i, "chai"],
    [/^Oil, olive/i, "evoo"],
    [/^Beverages, Protein powder/i, "protein shake"],
    [/^Beverages, Whey protein/i, "protein powder shake"]
  ];

  // Groups and name prefixes that are rarely what someone means by a plain
  // ingredient search. They stay findable; they just rank below staples.
  const GROUP_PENALTY = {
    "Baby Foods": 70, "American Indian/Alaska Native Foods": 45, "Fast Foods": 35,
    "Restaurant Foods": 35, "Meals, Entrees, and Side Dishes": 15
  };

  // Everyday staples a plain search should surface first.
  const STAPLES = new Set([
    "fdc-168878", "fdc-169704", "fdc-171477", "fdc-175168", "fdc-173424", "fdc-172187", "fdc-174034",
    "fdc-173904", "fdc-169737", "fdc-170093", "fdc-168483", "fdc-172421", "fdc-173735", "fdc-173757",
    "fdc-168917", "fdc-171890", "fdc-172688", "fdc-174924", "fdc-172470", "fdc-173410", "fdc-169655",
    "fdc-169640", "fdc-170845", "fdc-171413", "fdc-173686", "fdc-170567", "fdc-171284", "fdc-169098",
    "fdc-171844", "generic-milk-whole-3-25-milkfat-with-added-vitamin-d", "generic-milk-reduced-fat-2"
  ]);
  // Leading category words in source names; the next segment is the food.
  const CATEGORY_HEAD = /^(beverages|snacks|spices|babyfood|restaurant|fast foods|cereals ready-to-eat|cereals|candies|cookies|crackers|alcoholic beverage|fish|nuts|seeds|oil|sugars|crustaceans|mollusks|sauce|soup|game meat|cheese|bread|pasta|beef|pork|lamb|veal|chicken|turkey|beans|peas|lentils|rice|flour)$/i;
  const DISPLAY_HEAD = /^(beverages|snacks|spices|babyfood|restaurant|fast foods|cereals ready-to-eat|candies|cookies|crackers|alcoholic beverage|fish|nuts|seeds|crustaceans|mollusks)$/i;
  // Processed/prepared qualifiers that are rarely the plain ingredient.
  const PROCESSED = /^(deli|tender|nugget|breaded|patty|patties|stick|luncheon|loaf|roll|prepackaged|mesquite|flavor|flavored|sliced|batter|coated|imitation|substitute|replacement|custard|souffle|salad|pie|cake|candies|sweetened|mix|liquid|sprouted)$/;

  const NOISE_SEGMENTS = [
    /^broilers or fryers$/i, /^fluid$/i, /^unenriched$/i, /^regular$/i, /^ns as to .*$/i,
    /^\(?includes foods for usda's food distribution program\)?$/i, /^usda commodity$/i,
    /^all commercial varieties$/i, /^commercial$/i, /^not further specified$/i, /^nfs$/i,
    /^with added vitamin a and vitamin d$/i, /^with added vitamin d$/i, /^without salt$/i
  ];

  // Split on commas that are not inside parentheses.
  function splitSegments(text) {
    const parts = []; let depth = 0, current = "";
    for (const char of String(text)) {
      if (char === "(") depth += 1;
      if (char === ")") depth = Math.max(0, depth - 1);
      if (char === "," && depth === 0) { parts.push(current.trim()); current = ""; } else current += char;
    }
    parts.push(current.trim());
    return parts.filter(Boolean);
  }

  const titleCase = text => text.charAt(0).toUpperCase() + text.slice(1);

  /** Split a source description into a short title and a detail line. */
  function displayName(food) {
    const source = String(food.name || "").replace(/\s*\(Includes foods for USDA's Food Distribution Program\)/gi, "");
    let parts = splitSegments(source);
    if (!parts.length) return { title: source, detail: "" };
    // "Beverages, coffee" / "Snacks, rice cakes" / "Spices, cumin": the leading
    // category word is less useful than the food itself.
    if (parts.length > 1 && DISPLAY_HEAD.test(parts[0])) {
      parts = [titleCase(parts[1]), ...parts.slice(2), parts[0].toLowerCase()];
    }
    const [title, ...rest] = parts;
    const detail = rest.filter(part => !NOISE_SEGMENTS.some(pattern => pattern.test(part))).join(", ");
    return { title, detail };
  }

  function createIndex(catalog) {
    // A curated record and its SR Legacy twin share a name; rank the twin lower.
    const curatedNames = new Set(catalog.filter(food => String(food.id).startsWith("generic-")).map(food => normalize(food.name)));
    const entries = catalog.map(food => {
      const rawSegments = splitSegments(food.name);
      let segments = rawSegments.map(part => normalize(part).split(/\s+/).filter(Boolean).map(stem)).filter(words => words.length);
      // "Fish, salmon, ..." / "Nuts, almonds": treat category + food as the head.
      if (segments.length > 1 && CATEGORY_HEAD.test(rawSegments[0])) segments = [[...segments[0], ...segments[1]], ...segments.slice(2)];
      const aliasText = [...(food.aliases || []), ...ALIAS_RULES.filter(([pattern]) => pattern.test(food.name)).map(([, words]) => words)].join(" ");
      const aliasWords = normalize(aliasText).split(/\s+/).filter(Boolean).map(stem);
      const stateWord = stem(normalize(food.state === "as sold" ? "" : food.state));
      const reported = Object.values(food.per100g || {}).filter(item => item && item.value != null).length;
      let prior = 0;
      prior -= GROUP_PENALTY[food.group] || 0;
      if (/^babyfood/i.test(food.name)) prior -= 70;
      // All-caps brand words (KFC, POPEYES, BOLTHOUSE FARMS) mark branded items.
      if (/\b[A-Z]{3,}\b/.test(food.name.replace(/\b(USDA|NFS|NLEA|RTE|RTF|UHT)\b/g, ""))) prior -= 25;
      if (String(food.id).startsWith("generic-")) prior += 20;
      if (STAPLES.has(food.id)) prior += 28;
      if (!String(food.id).startsWith("generic-") && curatedNames.has(normalize(food.name))) prior -= 30;
      if (/\b(NS as to|NFS)\b/.test(food.name)) prior -= 45; // survey composites, often prepared
      prior -= Math.min(3, segments.flat().filter(word => PROCESSED.test(word)).length) * 8;
      if (food.state === "raw" || food.state === "cooked") prior += 3;
      prior += reported / 35 * 12;                       // prefer well-reported records
      prior -= Math.max(0, segments.length - 2) * 2.5;   // prefer simpler descriptions
      prior -= String(food.name).length / 40;
      if (segments[0] && segments[0].includes("with")) prior -= 6; // mixtures
      const headRaw = new Set(normalize(rawSegments.slice(0, CATEGORY_HEAD.test(rawSegments[0] || "") ? 2 : 1).join(" ")).split(/\s+/));
      return { food, segments, aliasWords, stateWord, prior, headRaw };
    });

    function termScore(entry, alternatives) {
      const match = word => alternatives.some(alt => word.startsWith(alt));
      const exact = word => alternatives.includes(word);
      let best = 0;
      entry.segments.forEach((words, index) => {
        for (const word of words) {
          if (!match(word)) continue;
          const score = (index === 0 ? 30 : 12) + (exact(word) ? 8 : 0);
          if (score > best) best = score;
        }
      });
      if (!best && entry.aliasWords.some(match)) best = 22;
      if (!best && entry.stateWord && match(entry.stateWord)) best = 6;
      return best;
    }

    function search(query, options = {}) {
      const rawTerms = normalize(query).split(/\s+/).filter(Boolean);
      const terms = rawTerms.map(stem);
      const state = options.state || "all";
      const pool = state === "all" ? entries : entries.filter(entry => entry.food.state === state);
      if (!terms.length) return [];
      const alternatives = terms.map(term => [term, ...((SYNONYMS[term] || []).map(stem))]);
      const results = [];
      for (const entry of pool) {
        let score = entry.prior;
        let ok = true;
        for (const alts of alternatives) {
          const value = termScore(entry, alts);
          if (!value) { ok = false; break; }
          score += value;
        }
        if (!ok) continue;
        const first = entry.segments[0] || [];
        if (first[0] && alternatives[0].some(alt => first[0].startsWith(alt))) score += 25;
        if (alternatives.every(alts => first.some(word => alts.some(alt => word.startsWith(alt))))) score += 15;
        // Head words the query did not ask for ("rice NOODLES") lower the rank.
        const unmatched = first.filter(word => !alternatives.some(alts => alts.some(alt => word.startsWith(alt))) && !CATEGORY_HEAD.test(word)).length;
        score -= unmatched * 7;
        score += rawTerms.filter(term => entry.headRaw.has(term)).length * 6;
        results.push({ food: entry.food, score });
      }
      results.sort((a, b) => b.score - a.score || a.food.name.length - b.food.name.length);
      return options.limit ? results.slice(0, options.limit) : results;
    }

    return { search };
  }

  return Object.freeze({ createIndex, displayName, normalize, stem });
});
