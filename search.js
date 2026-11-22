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
    if (word.length > 4 && /ie$/.test(word)) return word.slice(0, -2) + "y"; // cookie ~ cookies
    if (/(oes|ches|shes|xes|sses)$/.test(word)) return word.slice(0, -2);
    if (/[^su]s$/.test(word) && !/(is|us|ss)$/.test(word)) return word.slice(0, -1);
    return word;
  }

  // Query synonyms: each (stemmed) term also matches these words.
  const SYNONYMS = {
    chickpea: ["garbanzo"], garbanzo: ["chickpea"], chana: ["chickpea"], chole: ["chickpea"],
    curd: ["yogurt"], dahi: ["yogurt"], yoghurt: ["yogurt"],
    oatmeal: ["oat"], porridge: ["oat"],
    cilantro: ["coriander"], coriander: ["cilantro"],
    aubergine: ["eggplant"], brinjal: ["eggplant"], courgette: ["zucchini"],
    capsicum: ["pepper"], prawn: ["shrimp"], scallion: ["onion"],
    dal: ["lentil"], dhal: ["lentil"], daal: ["lentil"], masoor: ["lentil"], moong: ["mung"], mung: ["moong"], rajma: ["kidney"],
    soda: ["cola", "carbonated"], pop: ["cola"], coke: ["cola"], pepsi: ["cola"],
    mince: ["ground"], minced: ["ground"], hamburger: ["ground"],
    soy: ["soya", "soybean"], soya: ["soy"],
    ladyfinger: ["okra"], bhindi: ["okra"], aloo: ["potato"], gobi: ["cauliflower"], palak: ["spinach"],
    chapati: ["roti"], roti: ["chapati"], chapatti: ["chapati"],
    pb: ["peanut"], oj: ["orange"], ketchup: ["catsup"], catsup: ["ketchup"],
    fry: ["fried"], fried: ["fry"], hotdog: ["frankfurter"], frank: ["frankfurter"],
    mayo: ["mayonnaise"], latte: ["latte", "coffee"], cappuccino: ["cappuccino", "coffee"], coca: ["cola"], doughnut: ["donut"], donut: ["doughnut"], yogourt: ["yogurt"]
  };

  // Everyday words a source name omits. Matched on the source description.
  const ALIAS_RULES = [
    [/^Butter oil, anhydrous/i, "ghee clarified butter"],
    [/^Yogurt/i, "curd dahi"],
    [/^Lentils/i, "dal dhal masoor"],
    [/^Chickpeas/i, "chana chole"],
    [/^Mung beans/i, "moong dal"],
    [/^Beans, kidney/i, "rajma"],
    [/^Pigeon peas/i, "toor dal arhar tuvar"],
    [/^Cereals, oats/i, "oatmeal porridge"],
    [/^Beverages, coffee, brewed/i, "black coffee"],
    [/^Beverages, tea, black, brewed/i, "chai"],
    [/^Oil, olive/i, "evoo"],
    [/^Flour, whole wheat|^Wheat flour, whole-grain/i, "atta"],
    [/^Wheat flour, white, all-purpose/i, "maida"],
    [/^Beverages, Protein powder/i, "protein shake"],
    [/^Beverages, Whey protein/i, "protein powder shake"],
    [/^Salad dressing, mayonnaise/i, "mayonnaise mayo"],
    [/^Pasta, cooked|^Pasta, dry/i, "spaghetti macaroni penne noodles"],
    [/^Bread, (white|whole-wheat), commercially prepared, toasted/i, "toast"],
    [/^Frankfurter/i, "hot dog hotdog"],
    [/^Jams and preserves/i, "jam jelly"],
    [/^Potatoes, french fried/i, "fries"],
    [/^Beverages, carbonated, cola/i, "coke soda pop"],
    [/^Sugars, brown/i, "jaggery"],
    [/^Pork, cured, bacon/i, "bacon"],
    [/^Beef, top sirloin, steak/i, "steak"]
  ];

  // Groups and name prefixes that are rarely what someone means by a plain
  // ingredient search. They stay findable; they just rank below staples.
  const GROUP_PENALTY = {
    "Baby Foods": 70, "American Indian/Alaska Native Foods": 45, "Fast Foods": 35,
    "Restaurant Foods": 35, "Meals, Entrees, and Side Dishes": 15
  };
  const MEAT_GROUPS = /^(Poultry Products|Beef Products|Pork Products|Lamb, Veal, and Game Products|Finfish and Shellfish Products|Proteins|Seafood)$/;

  // Everyday staples a plain search should surface first.
  const STAPLES = new Set([
    "fdc-168878", "fdc-169704", "fdc-171477", "fdc-175168", "fdc-173424", "fdc-172187", "fdc-174034",
    "fdc-173904", "fdc-169737", "fdc-170093", "fdc-168483", "fdc-172421", "fdc-173735", "fdc-173757",
    "fdc-168917", "fdc-171890", "fdc-172688", "fdc-174924", "fdc-172470", "fdc-173410", "fdc-169655",
    "fdc-169640", "fdc-170845", "fdc-171413", "fdc-173686", "fdc-170567", "fdc-171284", "fdc-169098",
    "fdc-171844", "generic-milk-whole-3-25-milkfat-with-added-vitamin-d", "generic-milk-reduced-fat-2",
    "fdc-168746", "fdc-173185", "fdc-171009", "fdc-174277", "fdc-170317", "fdc-172182", "fdc-167575",
    "fdc-173227", "fdc-174158", "fdc-169641", "fdc-174852", "fdc-167914", "fdc-172388", "fdc-173630",
    "fdc-173862", "fdc-168634", "fdc-173709", "generic-cheese-cheddar",
    "generic-oranges-raw-all-commercial-varieties", "fdc-173905"
  ]);
  // Leading category words in source names; the next segment is the food.
  const CATEGORY_HEAD = /^(beverages|snacks|spices|babyfood|restaurant|fast foods|cereals ready-to-eat|cereals|alcoholic beverage|fish|nuts|seeds|oil|sugars|crustaceans|mollusks|game meat|cheese|bread|pasta|beef|pork|lamb|veal|chicken|turkey|beans|peas|lentils|rice|flour|salad dressing)$/i;
  // Categories dropped from the title: "Nuts, almonds" shows as "Almonds".
  const DISPLAY_DROP = /^(beverages|snacks|spices|babyfood|restaurant|fast foods|cereals ready-to-eat|candies|alcoholic beverage|fish|nuts|seeds|crustaceans|mollusks|salad dressing)$/i;
  // Categories kept with the next segment: "Chicken, breast", "Beef, ground".
  const DISPLAY_JOIN = /^(beef|pork|lamb|veal|chicken|turkey|game meat|cheese|soup|sauce|bread|cookies|crackers|cereals|pasta|beans|peas|rice|oil|sugars|flour|carbonated)$/i;
  // Processed/prepared qualifiers that are rarely the plain ingredient.
  const PROCESSED = /^(deli|tender|nugget|breaded|patty|patties|stick|luncheon|loaf|roll|prepackaged|mesquite|flavor|flavored|sliced|batter|coated|imitation|substitute|replacement|custard|souffle|salad|pie|cake|candy|sweetened|mix|liquid|sprouted|spinach|fortified|glazed|skin|giblet|soft serve)$/;
  const ODD = /non-alcoholic|hydrolyzed|with vegetables|with fruit|reduced sodium|low sodium|made with tofu|meatless|lowfat, with|^Bacon, turkey/i;

  const NOISE_SEGMENTS = [
    /^broilers or fryers$/i, /^broiler or fryers$/i, /^fluid$/i, /^unenriched$/i, /^regular$/i, /^ns as to .*$/i,
    /^\(?includes foods for usda's food distribution program\)?$/i, /^usda commodity$/i,
    /^all commercial varieties$/i, /^commercial$/i, /^not further specified$/i, /^nfs$/i, /^all$/i,
    /^with added vitamin a and vitamin d$/i, /^with added vitamin d$/i, /^year round average$/i
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
  // "McDONALD'S" / "KFC, Fried Chicken" → readable case; keep short acronyms.
  const tameCaps = text => text.replace(/\b[A-Za-z][A-Za-z'’&]*\b/g, word => {
    const caps = (word.match(/[A-Z]/g) || []).length;
    if (caps < 3 || word.length <= 3 || /^(USDA|NFS|NLEA|RACC|UHT)$/.test(word)) return word;
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  });

  /** Split a source description into a short title and a detail line. */
  function displayName(food) {
    const source = tameCaps(String(food.name || "").replace(/\s*\(Includes foods for USDA's Food Distribution Program\)/gi, ""));
    const parts = splitSegments(source).filter((part, index) => index === 0 || !NOISE_SEGMENTS.some(pattern => pattern.test(part)));
    if (!parts.length) return { title: source, detail: "" };
    let title = parts[0], rest = parts.slice(1);
    if (rest.length && DISPLAY_DROP.test(title)) { title = titleCase(rest[0]); rest = rest.slice(1); }
    if (rest.length && DISPLAY_JOIN.test(title)) { title = `${titleCase(title)}, ${rest[0]}`; rest = rest.slice(1); }
    // "Pork, cured" says little; "Pork, cured, bacon" names the food.
    if (rest.length && /, (cured|fresh)$/i.test(title)) { title = `${title}, ${rest[0]}`; rest = rest.slice(1); }
    return { title, detail: rest.join(", ") };
  }

  // Damerau-free edit distance with an early exit; terms are short.
  function distance(a, b, max) {
    if (Math.abs(a.length - b.length) > max) return max + 1;
    let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      const current = [i];
      let best = i;
      for (let j = 1; j <= b.length; j++) {
        current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        if (current[j] < best) best = current[j];
      }
      if (best > max) return max + 1;
      previous = current;
    }
    return previous[b.length];
  }

  function createIndex(catalog) {
    // A curated record and its SR Legacy twin share a name; show only one.
    const curatedNames = new Set(catalog.filter(food => String(food.id).startsWith("generic-")).map(food => normalize(food.name)));
    const vocabulary = new Map();
    const entries = [];
    for (const food of catalog) {
      if (!String(food.id).startsWith("generic-") && curatedNames.has(normalize(food.name))) continue;
      const rawSegments = splitSegments(food.name).filter((part, index) => index === 0 || !NOISE_SEGMENTS.some(pattern => pattern.test(part)));
      let segments = rawSegments.map(part => normalize(part).split(/\s+/).filter(Boolean).map(stem)).filter(words => words.length);
      // "Fish, salmon, ..." / "Nuts, almonds": treat category + food as the head.
      if (segments.length > 1 && CATEGORY_HEAD.test(rawSegments[0])) segments = [[...segments[0], ...segments[1]], ...segments.slice(2)];
      const aliasWords = normalize((food.aliases || []).join(" ")).split(/\s+/).filter(Boolean).map(stem);
      // Curated everyday names ("bacon", "spaghetti", "mayo") count as the food's head.
      const aliasHead = normalize(ALIAS_RULES.filter(([pattern]) => pattern.test(food.name)).map(([, words]) => words).join(" ")).split(/\s+/).filter(Boolean).map(stem);
      for (const word of [...segments.flat(), ...aliasWords, ...aliasHead]) if (word.length > 2 && !/\d/.test(word)) vocabulary.set(word, (vocabulary.get(word) || 0) + 1);
      const stateWord = stem(normalize(food.state === "as sold" ? "" : food.state));
      const reported = Object.values(food.per100g || {}).filter(item => item && item.value != null).length;
      let prior = 0;
      prior -= GROUP_PENALTY[food.group] || 0;
      if (/^babyfood/i.test(food.name)) prior -= 70;
      // All-caps brand words (KFC, POPEYES, BOLTHOUSE FARMS) mark branded items.
      if (/\b[A-Z]{3,}\b/.test(food.name.replace(/\b(USDA|NFS|NLEA|RTE|RTF|UHT)\b/g, ""))) prior -= 25;
      if (String(food.id).startsWith("generic-")) prior += 12;
      if (STAPLES.has(food.id)) prior += 30;
      if (food.id === "fdc-168878") prior += 6; // white rice is logged more often than brown
      if (/\b(NS as to|NFS)\b/.test(food.name)) prior -= 45; // survey composites, often prepared
      if (ODD.test(food.name)) prior -= 12;
      // People log meat and fish as eaten; raw records stay one word away ("raw").
      if (food.state === "raw" && MEAT_GROUPS.test(food.group)) prior -= 12;
      prior -= Math.min(3, segments.flat().filter(word => PROCESSED.test(word)).length) * 8;
      if (food.state === "raw" || food.state === "cooked") prior += 3;
      prior += reported / 35 * 12;                       // prefer well-reported records
      prior -= Math.max(0, segments.length - 2) * 2.5;   // prefer simpler descriptions
      prior -= String(food.name).length / 40;
      if (segments[0] && segments[0].includes("with")) prior -= 6; // mixtures
      const categoryWords = CATEGORY_HEAD.test(rawSegments[0] || "") && rawSegments.length > 1 ? new Set(normalize(rawSegments[0]).split(/\s+/).map(stem)) : new Set();
      const headRaw = new Set(normalize(rawSegments.slice(0, CATEGORY_HEAD.test(rawSegments[0] || "") ? 2 : 1).join(" ")).split(/\s+/));
      entries.push({ food, segments, aliasWords, aliasHead, stateWord, prior, headRaw, categoryWords });
    }

    // Whole-word matches score far above prefix matches, and prefixes only
    // count for the word still being typed ("wat" → water; "water" ≠ watermelon).
    function termScore(entry, alternatives, allowPrefix) {
      let best = 0;
      const test = word => alternatives.includes(word) ? 2 : allowPrefix && alternatives.some(alt => alt.length >= 2 && word.startsWith(alt)) ? 1 : 0;
      entry.segments.forEach((words, index) => {
        for (const word of words) {
          const kind = test(word);
          if (!kind) continue;
          const score = index === 0 ? (kind === 2 ? 40 : 16) : (kind === 2 ? 16 : 6);
          if (score > best) best = score;
        }
      });
      for (const word of entry.aliasHead) if (test(word) === 2) best = Math.max(best, 40);
      if (best < 22) for (const word of entry.aliasWords) { const kind = test(word); if (kind) best = Math.max(best, kind === 2 ? 30 : 10); }
      if (!best && entry.stateWord && test(entry.stateWord) === 2) best = 6;
      return best;
    }

    function run(terms, rawTerms, state, prefixLast) {
      const pool = state === "all" ? entries : entries.filter(entry => entry.food.state === state);
      const alternatives = terms.map(term => [term, ...((SYNONYMS[term] || []).map(stem))]);
      const results = [];
      for (const entry of pool) {
        let score = entry.prior;
        let ok = true;
        for (let i = 0; i < alternatives.length; i++) {
          const value = termScore(entry, alternatives[i], prefixLast && i === alternatives.length - 1);
          if (!value) { ok = false; break; }
          score += value;
        }
        if (!ok) continue;
        const first = entry.segments[0] || [];
        const hits = word => alternatives.some(alts => alts.some(alt => word === alt || (prefixLast && word.startsWith(alt) && alts === alternatives[alternatives.length - 1])));
        const lead = first.find(word => !entry.categoryWords.has(word));
        if ((first[0] && alternatives[0].includes(first[0])) || (lead && alternatives[0].includes(lead)) || entry.aliasHead.some(word => alternatives[0].includes(word))) score += 25;
        if (alternatives.every(alts => first.some(word => alts.includes(word)) || entry.aliasHead.some(word => alts.includes(word)))) score += 15;
        // Head words the query did not ask for ("rice NOODLES", "pizza SAUCE") lower the rank.
        score -= Math.min(2, first.filter(word => !hits(word) && !entry.categoryWords.has(word)).length) * 10;
        score += rawTerms.filter(term => entry.headRaw.has(term)).length * 6;
        results.push({ food: entry.food, score });
      }
      results.sort((a, b) => b.score - a.score || a.food.name.length - b.food.name.length);
      return results;
    }

    // Closest known word for a likely typo ("bananna" → "banana").
    function candidates(term) {
      if (term.length < 4 || vocabulary.has(term) || SYNONYMS[term]) return [term];
      const max = term.length >= 7 ? 2 : 1;
      const found = [];
      for (const [word, count] of vocabulary) {
        const d = distance(term, word, max);
        if (d <= max) found.push({ word, d, count });
      }
      found.sort((a, b) => a.d - b.d || b.count - a.count);
      return found.length ? found.slice(0, 6).map(item => item.word) : [term];
    }

    /** Ranked matches. A trailing space means the last word is complete. */
    function search(query, options = {}) {
      const text = String(query || "");
      const rawTerms = normalize(text).split(/\s+/).filter(Boolean);
      const terms = rawTerms.map(stem);
      const state = options.state || "all";
      if (!terms.length) return Object.assign([], { corrected: null });
      const prefixLast = !/\s$/.test(text);
      let results = run(terms, rawTerms, state, prefixLast);
      let corrected = null;
      if (!results.length) {
        // Try each spelling fix and keep the one whose best match scores highest.
        let fixed = terms.slice();
        terms.forEach((term, i) => {
          const options = candidates(term);
          if (options.length === 1) { fixed[i] = options[0]; return; }
          let best = null;
          for (const option of options) {
            const trial = fixed.slice(); trial[i] = option;
            const top = run(trial, trial, state, false)[0];
            if (top && (!best || top.score > best.score)) best = { option, score: top.score };
          }
          if (best) fixed[i] = best.option;
        });
        if (fixed.some((term, i) => term !== terms[i])) {
          results = run(fixed, fixed, state, false);
          if (results.length) corrected = fixed.join(" ");
        }
      }
      const list = options.limit ? results.slice(0, options.limit) : results;
      return Object.assign(list, { corrected });
    }

    return { search };
  }

  return Object.freeze({ createIndex, displayName, normalize, stem });
});
