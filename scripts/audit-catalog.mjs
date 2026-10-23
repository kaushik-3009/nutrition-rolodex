#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const valueAfter = (name) => {
  const index = args.indexOf(name);
  return index < 0 ? null : args[index + 1];
};
const catalogPath = path.resolve(root, valueAfter("--catalog") || "data/catalog-data.js");
const apiPath = valueAfter("--fdc-json") ? path.resolve(valueAfter("--fdc-json")) : null;
const reportPath = valueAfter("--out") ? path.resolve(valueAfter("--out")) : null;
const first = Number(valueAfter("--first") || 0);
const legacyBaseline = args.includes("--legacy-baseline");

const raw = await readFile(catalogPath, "utf8");
const jsonText = raw.replace(/^\s*window\.PANTRY_CATALOG\s*=\s*/, "").replace(/;\s*$/, "");
const allFoods = JSON.parse(jsonText);
const foods = first > 0 ? allFoods.slice(0, first) : allFoods;
const issues = [];
const report = {
  catalogPath,
  scope: first > 0 ? `first ${foods.length} of ${allFoods.length} rows` : `${foods.length} rows`,
  checkedAt: new Date().toISOString(),
  counts: {},
  issues,
};
const issue = (code, food, detail, severity = "review") => issues.push({ code, id: food?.id || null, detail, severity });
const expectedUnits = {
  calories: ["kcal"], protein: ["g"], fat: ["g"], carbs: ["g"], fiber: ["g"], sugars: ["g"],
  satFat: ["g"], transFat: ["g"], cholesterol: ["mg"], sodium: ["mg"], calcium: ["mg"], iron: ["mg"],
  magnesium: ["mg"], phosphorus: ["mg"], potassium: ["mg"], zinc: ["mg"], copper: ["mg"], selenium: ["mcg", "µg"],
  vitaminA: ["mcg", "µg"], vitaminE: ["mg"], vitaminD: ["mcg", "µg"], vitaminC: ["mg"], thiamin: ["mg"],
  riboflavin: ["mg"], niacin: ["mg"], vitaminB6: ["mg"], vitaminB12: ["mcg", "µg"], choline: ["mg"],
  vitaminK: ["mcg", "µg"], folate: ["mcg", "µg"], folateDFE: ["mcg", "µg"],
  iodine: ["mcg", "µg"], pantothenicAcid: ["mg"], biotin: ["mcg", "µg"], addedSugars: ["g"],
};
const ids = new Map();
const coverage = {};
const zeroCounts = {};
const nullCounts = {};
let nutrientCells = 0;
for (const food of foods) {
  if (!food.id || !food.name || !food.sourceDescription || !Number.isInteger(food.fdcId)) issue("missing-identity", food, "Expected id, name, sourceDescription, and integer fdcId", "error");
  const sameSource = ids.get(food.fdcId) || [];
  sameSource.push(food.id);
  ids.set(food.fdcId, sameSource);
  for (const [key, nutrient] of Object.entries(food.per100g || {})) {
    nutrientCells++;
    coverage[key] = (coverage[key] || 0) + 1;
    if (nutrient.value === 0) zeroCounts[key] = (zeroCounts[key] || 0) + 1;
    if (nutrient.value === null || nutrient.value === undefined) nullCounts[key] = (nullCounts[key] || 0) + 1;
    else if (!Number.isFinite(nutrient.value) || nutrient.value < 0) issue("invalid-nutrient-value", food, `per100g.${key} must be a finite non-negative number`, "error");
    const units = expectedUnits[key];
    if (!units) issue("unmapped-nutrient", food, `No expected unit registered for ${key}`);
    else if (!units.includes(nutrient.unit)) issue("unexpected-unit", food, `per100g.${key} uses ${JSON.stringify(nutrient.unit)}; expected ${units.join(" or ")}`, "error");
  }
  for (const field of ["cupGrams", "tbspGrams"]) {
    if (food[field] != null && (!Number.isFinite(food[field]) || food[field] <= 0)) issue("invalid-household-weight", food, `${field} must be positive when present`, "error");
    const sourceField = field === "cupGrams" ? "cupSource" : "tbspSource";
    if ((food[field] == null) !== (food[sourceField] == null)) issue("incomplete-household-provenance", food, `${field} and ${sourceField} should both be present or absent`);
  }
  if (food.defaultUnit && (!Number.isFinite(food.defaultAmount) || food.defaultAmount <= 0)) issue("invalid-default-amount", food, "defaultUnit requires a positive defaultAmount", "error");
  if (food.defaultUnit === "cup" && !food.cupGrams) issue("default-unit-unavailable", food, "Default is cup but cupGrams is missing", "error");
  if (food.defaultUnit === "tbsp" && !food.tbspGrams) issue("default-unit-unavailable", food, "Default is tbsp but tbspGrams is missing", "error");
  if (food.countMeasure && (!Number.isFinite(food.countMeasure.grams) || food.countMeasure.grams <= 0)) issue("invalid-count-weight", food, "countMeasure.grams must be positive", "error");
  if (!Number.isFinite(food.servingGrams) || food.servingGrams <= 0) issue("invalid-serving-weight", food, "servingGrams must be positive", "error");
}
for (const [fdcId, rowIds] of ids) if (rowIds.length > 1) issue("duplicate-fdc-id", null, `fdcId ${fdcId} is reused by ${rowIds.join(", ")}`, "error");

report.counts = {
  allCatalogRows: allFoods.length,
  auditedRows: foods.length,
  uniqueFdcIds: ids.size,
  nutrientCells,
  nutrientsPresent: coverage,
  explicitZeros: zeroCounts,
  explicitNulls: nullCounts,
  missingNutrients: Object.fromEntries(Object.entries(coverage).map(([key, count]) => [key, foods.length - count])),
  duplicateFdcIds: [...ids].filter(([, rowIds]) => rowIds.length > 1).map(([fdcId, rowIds]) => ({ fdcId, rowIds })),
};

if (apiPath) {
  const apiFoods = JSON.parse(await readFile(apiPath, "utf8"));
  const apiById = new Map(apiFoods.map((food) => [food.fdcId, food]));
  const missing = [];
  const descriptionMismatches = [];
  for (const food of foods) {
    const source = apiById.get(food.fdcId);
    if (!source) { missing.push(food.id); continue; }
    if (food.sourceDescription !== source.description) descriptionMismatches.push({ id: food.id, fdcId: food.fdcId, catalog: food.sourceDescription, api: source.description });
  }
  const sourceNutrientIds = {
    protein: [1003], fat: [1004], carbs: [1005], calories: [1008, 2047, 2048], fiber: [1079], sugars: [2000],
    satFat: [1258], transFat: [1257], cholesterol: [1253], sodium: [1093], calcium: [1087], iron: [1089],
    magnesium: [1090], phosphorus: [1091], potassium: [1092], zinc: [1095], copper: [1098], selenium: [1103],
    vitaminA: [1106], vitaminE: [1109], vitaminD: [1114], vitaminC: [1162], thiamin: [1165], riboflavin: [1166],
    niacin: [1167], vitaminB6: [1175], vitaminB12: [1178], choline: [1180], vitaminK: [1185],
    folate: [legacyBaseline ? 1190 : 1177], folateDFE: [1190], iodine: [1100], pantothenicAcid: [1170], biotin: [1176], addedSugars: [1235],
  };
  const nutrientMismatches = [];
  const nutrientSourceMissing = [];
  const folateAvailability = { total1177Rows: 0, total1177ExplicitZeroRows: 0, dfe1190Rows: 0, dfe1190ExplicitZeroRows: 0, totalOnlyRows: [] };
  let nutrientComparisons = 0;
  for (const food of foods) {
    const source = apiById.get(food.fdcId);
    if (!source) continue;
    const sourceNutrients = source.foodNutrients || [];
    for (const [key, candidateIds] of Object.entries(sourceNutrientIds)) {
      const nutrientCandidates = sourceNutrients.filter((item) => candidateIds.includes(item.nutrient?.id ?? item.nutrientId) && (item.amount ?? item.value) != null);
      const catalogNutrient = food.per100g?.[key];
      if (nutrientCandidates.length) {
        const sourceNutrient = nutrientCandidates[0];
        const sourceValue = sourceNutrient.amount ?? sourceNutrient.value;
        const sourceNutrientId = sourceNutrient.nutrient?.id ?? sourceNutrient.nutrientId;
        if (sourceNutrientId === 1190) {
          folateAvailability.dfe1190Rows++;
          if (sourceValue === 0) folateAvailability.dfe1190ExplicitZeroRows++;
        }
        if (!catalogNutrient || catalogNutrient.value == null) {
          nutrientSourceMissing.push({ id: food.id, key, sourceNutrientId, sourceValue });
          continue;
        }
        nutrientComparisons++;
        // Calories may have multiple valid USDA energy definitions. Accept a
        // catalog value matching any candidate, while keeping folate separate.
        const matchesCandidate = nutrientCandidates.some((candidate) => {
          const candidateValue = candidate.amount ?? candidate.value;
          const roundingHalfStep = candidateValue === 0 ? 0 : 0.5 * (10 ** (Math.floor(Math.log10(Math.abs(candidateValue))) - 2));
          return Math.abs(catalogNutrient.value - candidateValue) <= roundingHalfStep + Number.EPSILON;
        });
        if (!matchesCandidate) nutrientMismatches.push({ id: food.id, key, sourceNutrientIds: nutrientCandidates.map((item) => item.nutrient?.id ?? item.nutrientId), catalogValue: catalogNutrient.value, sourceValues: nutrientCandidates.map((item) => item.amount ?? item.value) });
      }
    }
    const totalFolate = sourceNutrients.find((item) => (item.nutrient?.id ?? item.nutrientId) === 1177 && (item.amount ?? item.value) != null);
    if (totalFolate) {
      folateAvailability.total1177Rows++;
      if ((totalFolate.amount ?? totalFolate.value) === 0) folateAvailability.total1177ExplicitZeroRows++;
      if (!food.per100g?.folate || food.per100g.folate.value == null) folateAvailability.totalOnlyRows.push({ id: food.id, fdcId: food.fdcId, value: totalFolate.amount ?? totalFolate.value });
    }
  }
  report.officialApiComparison = {
    endpoint: "USDA FoodData Central /food/{fdcId} or /foods",
    distinctApiRows: apiFoods.length,
    missingFdcIds: missing,
    descriptionMismatches,
    nutrientComparison: {
      comparedPresentValues: nutrientComparisons,
      mismatchesBeyondCatalogRounding: nutrientMismatches,
      sourceValuesOmittedByCatalog: nutrientSourceMissing,
      folateAvailability,
      folateTotalAndDfeAreDistinctNutrients: true,
      note: `${legacyBaseline ? "Legacy baseline mode compares folate to DFE 1190" : "Current mode compares folate to total 1177"}; folate DFE 1190 is checked under folateDFE. The comparison accepts half a unit at three significant digits and keeps the two folate measures distinct.`,
    },
  };
}

const output = `${JSON.stringify(report, null, 2)}\n`;
if (reportPath) await writeFile(reportPath, output);
const summary = {
  scope: report.scope,
  counts: {
    rows: report.counts.auditedRows,
    uniqueFdcIds: report.counts.uniqueFdcIds,
    nutrientCells: report.counts.nutrientCells,
    explicitNulls: Object.values(report.counts.explicitNulls).reduce((sum, count) => sum + count, 0),
    explicitZeros: Object.values(report.counts.explicitZeros).reduce((sum, count) => sum + count, 0),
  },
  structuralErrors: issues.filter((entry) => entry.severity === "error").length,
  sourceDescriptionMismatches: report.officialApiComparison?.descriptionMismatches.length ?? null,
  nutrientMismatches: report.officialApiComparison?.nutrientComparison.mismatchesBeyondCatalogRounding.length ?? null,
  fullReport: reportPath,
};
process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
if (summary.structuralErrors || summary.sourceDescriptionMismatches || summary.nutrientMismatches) process.exitCode = 1;
