import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import vm from "node:vm";
import crypto from "node:crypto";

// Rebuilds the catalog from USDA's official SR Legacy CSV archive. Usage:
// node scripts/import-sr-legacy.mjs /path/to/FoodData_Central_sr_legacy_food_csv_2018-04.zip
const archive = process.argv.slice(2).find((arg) => !arg.startsWith("--"));
const checkOnly = process.argv.includes("--check");
if (!archive) throw new Error("Pass the USDA SR Legacy CSV ZIP path as the first argument.");
const expectedSha256 = "b80817294b8850530aaedf2e515c02593b1824f763a0ff356e5c2081643e6fd0";
const zip = (name) => execFileSync("unzip", ["-p", archive, `*/${name}`], { maxBuffer: 128 * 1024 * 1024 }).toString("utf8");
const actualSha256 = crypto.createHash("sha256").update(await readFile(archive)).digest("hex");
if (actualSha256 !== expectedSha256) throw new Error(`Unexpected archive SHA-256 ${actualSha256}; expected ${expectedSha256}`);
const curatedSourceRaw = await readFile("data/curated-source.json");
const curatedSourceSha256 = crypto.createHash("sha256").update(curatedSourceRaw).digest("hex");
const curatedSource = JSON.parse(curatedSourceRaw);
const expectedCuratedSourceSha256 = "852e3412bbfcd1ae3dac828e6190bee03b258322abc875e9dfa87e182f567827";
if (curatedSourceSha256 !== expectedCuratedSourceSha256) throw new Error(`Unexpected curated source snapshot SHA-256 ${curatedSourceSha256}`);

function csv(text) {
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field.replace(/\r$/, "")); rows.push(row); row = []; field = ""; }
    else field += c;
  }
  if (field || row.length) { row.push(field.replace(/\r$/, "")); rows.push(row); }
  const [headers, ...records] = rows;
  return records.filter((r) => r.length).map((r) => Object.fromEntries(headers.map((h, i) => [h, r[i] ?? ""])));
}
const asIdMap = (rows) => new Map(rows.map((r) => [r.id, r]));
const numberOrNull = (value) => value === "" || value === null || value === undefined ? null : (Number.isFinite(Number(value)) ? Number(value) : null);
const amountFromLabel = (label) => {
  const match = label.match(/^\s*(\d+(?:\.\d+)?|\d+\/\d+)(?:\s+|$)/);
  if (!match) return null;
  if (!match[1].includes("/")) return Number(match[1]);
  const [numerator, denominator] = match[1].split("/").map(Number);
  return denominator ? numerator / denominator : null;
};
const unitFromLabel = (label) => label.match(/^\s*(?:\d+(?:\.\d+)?|\d+\/\d+)\s+([a-z]+)/i)?.[1]?.toLowerCase() || null;
const foods = csv(zip("food.csv"));
const nutrients = csv(zip("food_nutrient.csv"));
const categories = asIdMap(csv(zip("food_category.csv")));
const units = asIdMap(csv(zip("measure_unit.csv")));
const portionsByFood = new Map();
for (const p of csv(zip("food_portion.csv"))) {
  const portions = portionsByFood.get(p.fdc_id) || [];
  portions.push(p);
  portionsByFood.set(p.fdc_id, portions);
}

const nutrientMap = {
  1003: ["protein", "g", "Protein", "G"], 1004: ["fat", "g", "Total lipid (fat)", "G"],
  1005: ["carbs", "g", "Carbohydrate, by difference", "G"], 1008: ["calories", "kcal", "Energy", "KCAL"],
  2047: ["calories", "kcal", "Energy (Atwater General Factors)", "KCAL"], 2048: ["calories", "kcal", "Energy (Atwater Specific Factors)", "KCAL"],
  1079: ["fiber", "g", "Fiber, total dietary", "G"], 2000: ["sugars", "g", "Sugars, Total", "G"],
  1258: ["satFat", "g", "Fatty acids, total saturated", "G"], 1257: ["transFat", "g", "Fatty acids, total trans", "G"],
  1253: ["cholesterol", "mg", "Cholesterol", "MG"], 1093: ["sodium", "mg", "Sodium, Na", "MG"],
  1087: ["calcium", "mg", "Calcium, Ca", "MG"], 1089: ["iron", "mg", "Iron, Fe", "MG"],
  1090: ["magnesium", "mg", "Magnesium, Mg", "MG"], 1091: ["phosphorus", "mg", "Phosphorus, P", "MG"],
  1092: ["potassium", "mg", "Potassium, K", "MG"], 1095: ["zinc", "mg", "Zinc, Zn", "MG"],
  1098: ["copper", "mg", "Copper, Cu", "MG"], 1100: ["iodine", "mcg", "Iodine, I", "UG"],
  1103: ["selenium", "mcg", "Selenium, Se", "UG"],
  1106: ["vitaminA", "mcg", "Vitamin A, RAE", "UG"], 1109: ["vitaminE", "mg", "Vitamin E (alpha-tocopherol)", "MG"],
  1114: ["vitaminD", "mcg", "Vitamin D (D2 + D3)", "UG"], 1162: ["vitaminC", "mg", "Vitamin C, total ascorbic acid", "MG"],
  1165: ["thiamin", "mg", "Thiamin", "MG"], 1166: ["riboflavin", "mg", "Riboflavin", "MG"],
  1167: ["niacin", "mg", "Niacin", "MG"], 1170: ["pantothenicAcid", "mg", "Pantothenic acid", "MG"],
  1175: ["vitaminB6", "mg", "Vitamin B-6", "MG"], 1176: ["biotin", "mcg", "Biotin", "UG"],
  1177: ["folate", "mcg", "Folate, total", "UG"], 1190: ["folateDFE", "mcg", "Folate, DFE", "UG"],
  1178: ["vitaminB12", "mcg", "Vitamin B-12", "UG"], 1180: ["choline", "mg", "Choline, total", "MG"],
  1185: ["vitaminK", "mcg", "Vitamin K (phylloquinone)", "UG"], 1235: ["addedSugars", "g", "Sugars, added", "G"]
};
const nutrientsById = asIdMap(csv(zip("nutrient.csv")));
const sourceUnitToCatalogUnit = { G: "g", MG: "mg", UG: "mcg", KCAL: "kcal" };
for (const [id, [, unit, name, sourceUnit]] of Object.entries(nutrientMap)) {
  const nutrient = nutrientsById.get(id);
  if (!nutrient || nutrient.name !== name || nutrient.unit_name !== sourceUnit || sourceUnitToCatalogUnit[sourceUnit] !== unit) {
    throw new Error(`Nutrient map ${id} does not match nutrient.csv (${nutrient?.name ?? "missing"} / ${nutrient?.unit_name ?? "missing"})`);
  }
}
const nutrientRowsByFood = new Map();
for (const n of nutrients) {
  if (!nutrientMap[n.nutrient_id]) continue;
  const list = nutrientRowsByFood.get(n.fdc_id) || [];
  list.push(n);
  nutrientRowsByFood.set(n.fdc_id, list);
}
const allNutrientKeys = [...new Set(Object.values(nutrientMap).map(([key]) => key))];
const portionOptions = (fdcId, state) => (portionsByFood.get(fdcId) || []).map((p) => {
  const unit = units.get(p.measure_unit_id)?.name;
  const grams = numberOrNull(p.gram_weight);
  const amount = numberOrNull(p.amount);
  const description = p.portion_description.trim();
  const modifier = p.modifier.trim();
  const modifierText = modifier && !/^\d{4,}$/.test(modifier) ? modifier : "";
  const normalizedAmount = amount ?? amountFromLabel(description);
  const modifierWithAmount = modifierText && /^\d/.test(modifierText) ? modifierText : [normalizedAmount, modifierText || unit].filter((part) => part !== null && part !== undefined && part !== "").join(" ");
  return { label: description ? [description, modifierText].filter(Boolean).join(" ") : modifierWithAmount, amount: normalizedAmount, grams: grams !== null && grams > 0 ? grams : null, unit: (unit && unit !== "undetermined" ? unit : unitFromLabel(description || modifierText)) || null, source: "USDA FDC food_portion" };
}).filter((p) => p.label && p.grams).filter((p) => {
  if (["raw", "dry"].includes(state) && /\b(cooked|prepared)\b/i.test(p.label)) return false;
  if (state === "cooked" && /\b(raw|uncooked|dry|dried)\b/i.test(p.label)) return false;
  return true;
});
const nutrientUnitByKey = Object.fromEntries(allNutrientKeys.map((key) => [key, Object.values(nutrientMap).find(([mappedKey]) => mappedKey === key)[1]]));
const sourceFoods = foods.map((food) => {
  const per100g = Object.fromEntries(allNutrientKeys.map((key) => [key, { value: null, unit: Object.values(nutrientMap).find(([k]) => k === key)[1] }]));
  const selectedNutrientIds = {};
  for (const n of nutrientRowsByFood.get(food.fdc_id) || []) {
    const [key, unit] = nutrientMap[n.nutrient_id];
    const value = numberOrNull(n.amount);
    if (value !== null) {
      // Prefer Energy (1008) over its alternate Atwater calculations.
      if (key !== "calories" || selectedNutrientIds[key] === undefined || n.nutrient_id === "1008") {
        per100g[key] = { value, unit };
        selectedNutrientIds[key] = n.nutrient_id;
      }
    }
  }
  const description = food.description;
  const category = categories.get(food.food_category_id)?.description || "Other foods";
  const state = /\bfrozen\b/i.test(description) ? "frozen" : /\bcanned\b/i.test(description) ? "canned" : /\b(dried|dry)\b/i.test(description) ? "dry" : /\b(cooked|boiled|baked|fried|roasted|grilled|steamed)\b/i.test(description) ? "cooked" : /\b(raw|uncooked)\b/i.test(description) ? "raw" : "as sold";
  return {
    id: `fdc-${food.fdc_id}`, name: description, aliases: [], group: category, state, sourceType: "sr_legacy",
    source: "USDA FoodData Central SR Legacy", sourceDataset: "FoodData Central SR Legacy, 2018-04",
    fdcId: Number(food.fdc_id), sourceDescription: description, publishedDate: food.publication_date || null,
    servingGrams: 100, cupGrams: null, cupSource: null, tbspGrams: null, tbspSource: null,
    defaultUnit: "g", defaultAmount: 100, countMeasure: null,
    portionOptions: portionOptions(food.fdc_id, state), per100g
  };
});

const inferState = (description, portions = []) => /\bfrozen\b/i.test(description) ? "frozen" : /\bcanned\b/i.test(description) ? "canned" : /\b(dried|dry)\b/i.test(description) ? "dry" : /\b(cooked|boiled|baked|fried|roasted|grilled|steamed)\b/i.test(description) ? "cooked" : /\b(raw|uncooked)\b/i.test(description) ? "raw" : portions.some((p) => /\bcooked\b/i.test(p.portionDescription || "")) ? "cooked" : "as sold";
const apiPortions = (food, state) => (food.foodPortions || []).map((p) => {
  const sourceUnit = p.measureUnit?.name || null;
  const description = (p.portionDescription || "").trim();
  const modifier = (p.modifier || "").trim();
  const modifierText = modifier && !/^\d{4,}$/.test(modifier) ? modifier : "";
  const normalizedAmount = numberOrNull(p.amount) ?? amountFromLabel(description);
  const modifierWithAmount = modifierText && /^\d/.test(modifierText) ? modifierText : [normalizedAmount, modifierText || sourceUnit].filter((part) => part !== null && part !== undefined && part !== "").join(" ");
  const label = description ? [description, modifierText].filter(Boolean).join(" ") : modifierWithAmount;
  const unit = sourceUnit && sourceUnit.toLowerCase() !== "undetermined" ? sourceUnit : unitFromLabel(description || modifierText);
  const grams = numberOrNull(p.gramWeight);
  return { label, amount: normalizedAmount, grams: grams !== null && grams > 0 ? grams : null, unit: unit || null, source: "USDA FoodData Central foodPortion" };
}).filter((p) => p.label && p.grams).filter((p) => {
  if (["raw", "dry"].includes(state) && /\bcooked\b/i.test(p.label)) return false;
  if (state === "cooked" && /\b(raw|uncooked|dry|dried)\b/i.test(p.label)) return false;
  if (/quantity not specified|guideline amount|undetermined/i.test(p.label)) return false;
  return true;
});
const apiRows = [];
const archiveById = new Map(sourceFoods.map((food) => [String(food.fdcId), food]));
const curated = curatedSource.foods.map((food) => {
  const dataType = food.dataType || "Foundation";
  const archiveRecord = archiveById.get(String(food.fdcId));
  const state = archiveRecord?.state || inferState(food.description, food.foodPortions || []);
  const portionOptions = archiveRecord?.portionOptions || apiPortions(food, state);
  const per100g = archiveRecord?.per100g || Object.fromEntries(allNutrientKeys.map((key) => [key, { value: null, unit: nutrientUnitByKey[key] }]));
  if (!archiveRecord) {
    const selectedIds = {};
    for (const n of food.foodNutrients) {
      const mapped = nutrientMap[n.nutrientId];
      if (!mapped) continue;
      const [key, unit] = mapped;
      const sourceUnit = sourceUnitToCatalogUnit[String(n.unitName).toUpperCase()]
        || (String(n.unitName).toLowerCase() === "µg" ? "mcg" : String(n.unitName).toLowerCase());
      if (sourceUnit !== unit) throw new Error(`Curated nutrient unit mismatch for FDC ${food.fdcId}, nutrient ${n.nutrientId}`);
      const value = numberOrNull(n.amount);
      if (value === null) continue;
      const currentId = selectedIds[key];
      const rank = ({ 1008: 3, 2047: 2, 2048: 1 })[n.nutrientId] || 1;
      const currentRank = ({ 1008: 3, 2047: 2, 2048: 1 })[currentId] || 0;
      if (currentId === undefined || rank > currentRank) {
        per100g[key] = { value, unit };
        selectedIds[key] = n.nutrientId;
      }
    }
  }
  const sourceDescription = archiveRecord?.sourceDescription || food.description;
  const record = {
    id: food.catalogId,
    name: sourceDescription,
    aliases: food.catalogAliases || [],
    group: food.catalogGroup || archiveRecord?.group || food.foodCategory || "Other foods",
    state,
    sourceType: archiveRecord ? "sr_legacy" : food.catalogSourceType,
    source: "USDA FoodData Central",
    sourceDataset: archiveRecord ? "FoodData Central SR Legacy, 2018-04" : `FoodData Central ${dataType}`,
    sourceDataType: archiveRecord ? "SR Legacy" : dataType,
    fdcId: Number(food.fdcId),
    sourceDescription,
    publishedDate: archiveRecord?.publishedDate || food.publicationDate || null,
    servingGrams: 100,
    cupGrams: null, cupSource: null,
    tbspGrams: null, tbspSource: null,
    defaultUnit: "g", defaultAmount: 100, countMeasure: null,
    portionOptions,
    per100g
  };
  return record;
});
const curatedFdcIds = new Set(curated.map((food) => String(food.fdcId)));
const merged = [...curated, ...sourceFoods.filter((food) => !curatedFdcIds.has(String(food.fdcId)))];
const uniqueFdcIds = new Set(merged.map((food) => String(food.fdcId)));
if (uniqueFdcIds.size !== merged.length) throw new Error(`Catalog has ${merged.length - uniqueFdcIds.size} duplicate FDC IDs after canonicalization`);
const serialized = `window.PANTRY_CATALOG = [\n${merged.map((food) => `  ${JSON.stringify(food)}`).join(",\n")}\n];\n`;
const currentCatalogRaw = await readFile("data/catalog-data.js", "utf8");
if (checkOnly) {
  if (currentCatalogRaw !== serialized) throw new Error("data/catalog-data.js is stale; rerun the importer without --check");
} else {
  await writeFile("data/catalog-data.js", serialized);
}

// Read the emitted artifact back and reconcile every SR Legacy food, nutrient
// cell, and usable portion against the source tables before reporting success.
const written = { window: {} };
vm.runInNewContext(await readFile("data/catalog-data.js", "utf8"), written);
const writtenById = new Map(written.window.PANTRY_CATALOG.filter((food) => food.sourceType === "sr_legacy").map((food) => [String(food.fdcId), food]));
const curatedIds = new Set(curated.map((food) => food.id));
const writtenCuratedById = new Map(written.window.PANTRY_CATALOG.filter((food) => curatedIds.has(food.id)).map((food) => [String(food.fdcId), food]));
let nutrientValuesChecked = 0, nutrientNullsChecked = 0, portionRowsChecked = 0;
for (const expected of sourceFoods) {
  const actual = writtenById.get(String(expected.fdcId));
  if (!actual) throw new Error(`Missing generated source record for FDC ${expected.fdcId}`);
  if (actual.name !== expected.name || actual.sourceDescription !== expected.sourceDescription) {
    throw new Error(`Metadata mismatch for FDC ${expected.fdcId}`);
  }
  for (const key of allNutrientKeys) {
    const observed = actual.per100g[key];
    const value = expected.per100g[key];
    if (!observed || observed.value !== value.value || observed.unit !== value.unit) throw new Error(`Nutrient reconciliation failed for FDC ${expected.fdcId}, ${key}`);
    if (value.value === null) nutrientNullsChecked++;
    else nutrientValuesChecked++;
  }
  if (JSON.stringify(actual.portionOptions) !== JSON.stringify(expected.portionOptions)) throw new Error(`Portion reconciliation failed for FDC ${expected.fdcId}`);
  portionRowsChecked += expected.portionOptions.length;
}
if (writtenById.size !== sourceFoods.length) throw new Error(`Expected ${sourceFoods.length} SR Legacy records, found ${writtenById.size}`);
let curatedNutrientValuesChecked = 0, curatedNutrientNullsChecked = 0, curatedPortionRowsChecked = 0;
for (const expected of curated) {
  const actual = writtenCuratedById.get(String(expected.fdcId));
  if (!actual) throw new Error(`Missing generated curated record for FDC ${expected.fdcId}`);
  if (actual.sourceDescription !== expected.sourceDescription || actual.name !== expected.name) throw new Error(`Curated metadata mismatch for FDC ${expected.fdcId}`);
  for (const key of allNutrientKeys) {
    const observed = actual.per100g[key];
    const value = expected.per100g[key];
    if (!observed || observed.value !== value.value || observed.unit !== value.unit) throw new Error(`Curated nutrient reconciliation failed for FDC ${expected.fdcId}, ${key}`);
    if (value.value === null) curatedNutrientNullsChecked++;
    else curatedNutrientValuesChecked++;
  }
  if (JSON.stringify(actual.portionOptions) !== JSON.stringify(expected.portionOptions)) throw new Error(`Curated portion reconciliation failed for FDC ${expected.fdcId}`);
  curatedPortionRowsChecked += expected.portionOptions.length;
}
if (writtenCuratedById.size !== curated.length) throw new Error(`Expected ${curated.length} curated records, found ${writtenCuratedById.size}`);

const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");
const sourceTables = ["food.csv", "food_nutrient.csv", "food_portion.csv", "food_category.csv", "measure_unit.csv", "nutrient.csv"];
const tableSha256 = Object.fromEntries(sourceTables.map((name) => [name, sha256(zip(name))]));
const mappingReport = Object.entries(nutrientMap).map(([id, [key, unit, name, sourceUnit]]) => ({ nutrientId: Number(id), name, sourceUnit, catalogKey: key, catalogUnit: unit }));
const report = {
  source: "USDA FoodData Central SR Legacy CSV",
  archiveUrl: "https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_csv_2018-04.zip",
  archiveSha256: actualSha256,
  curatedSourceUrl: curatedSource.sourceUrl,
  curatedSourceApiResponseSha256: curatedSource.responseSha256,
  curatedSourceSnapshotSha256: curatedSourceSha256,
  sourceTableSha256: tableSha256,
  sourceFoodRows: foods.length,
  archiveFoodIdsRepresented: writtenById.size,
  standaloneSrLegacyRows: sourceFoods.filter((food) => !curatedFdcIds.has(String(food.fdcId))).length,
  curatedRowsRetained: curated.length,
  curatedDuplicateRowsRemoved: curatedSource.duplicateRowsRemoved || 0,
  nutrientValuesReconciled: nutrientValuesChecked,
  missingNutrientCellsReconciled: nutrientNullsChecked,
  sourcePortionRowsReconciled: portionRowsChecked,
  curatedNutrientValuesReconciled: curatedNutrientValuesChecked,
  curatedMissingNutrientCellsReconciled: curatedNutrientNullsChecked,
  curatedSourcePortionRowsReconciled: curatedPortionRowsChecked,
  nutrientMappings: mappingReport,
  verification: "passed"
};
if (checkOnly) {
  const expectedReport = `${JSON.stringify(report, null, 2)}\n`;
  const existingReport = await readFile("data/sr-legacy-reconciliation.json", "utf8").catch(() => "");
  if (existingReport !== expectedReport) throw new Error("data/sr-legacy-reconciliation.json is stale; rerun the importer without --check");
  console.log(`Verified ${merged.length} foods, ${nutrientValuesChecked} archive nutrient values, ${nutrientNullsChecked} explicit null cells, and ${portionRowsChecked} archive portions.`);
} else {
  await writeFile("data/sr-legacy-reconciliation.json", `${JSON.stringify(report, null, 2)}\n`);
  console.log(`Wrote ${merged.length} foods (${curated.length} source-curated + ${sourceFoods.filter((food) => !curatedFdcIds.has(String(food.fdcId))).length} standalone SR Legacy); reconciled ${nutrientValuesChecked} archive nutrient values, ${nutrientNullsChecked} archive null cells, and ${portionRowsChecked} archive portions.`);
}
