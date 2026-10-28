const catalog = window.PANTRY_CATALOG || [];
const stateLabels = { raw: "Raw", dry: "Dry / uncooked", canned: "Canned", frozen: "Frozen", cooked: "Cooked", other: "Other / prepared", "as sold": "Preparation not specified" };
const dailyValues = { fat: 78, satFat: 20, cholesterol: 300, sodium: 2300, carbs: 275, fiber: 28, protein: 50, calcium: 1300, iron: 18, magnesium: 420, phosphorus: 1250, potassium: 4700, zinc: 11, copper: .9, selenium: 55, vitaminA: 900, vitaminC: 90, vitaminD: 20, vitaminE: 15, vitaminK: 120, thiamin: 1.2, riboflavin: 1.3, niacin: 16, vitaminB6: 1.7, folateDFE: 400, iodine: 150, pantothenicAcid: 5, biotin: 30, addedSugars: 50, vitaminB12: 2.4, choline: 550 };
const nutrientRows = [
  ["fat", "Total Fat", "g", true], ["satFat", "Saturated Fat", "g", true, true], ["transFat", "Trans Fat", "g", false, true], ["cholesterol", "Cholesterol", "mg", true], ["sodium", "Sodium", "mg", true],
  ["carbs", "Total Carbohydrate", "g", true], ["fiber", "Dietary Fiber", "g", true, true], ["sugars", "Total Sugars", "g", false, true], ["addedSugars", "Added Sugars", "g", true, true], ["protein", "Protein", "g", false],
  ["calcium", "Calcium", "mg", true], ["iron", "Iron", "mg", true], ["magnesium", "Magnesium", "mg", true], ["phosphorus", "Phosphorus", "mg", true], ["potassium", "Potassium", "mg", true], ["zinc", "Zinc", "mg", true], ["copper", "Copper", "mg", true], ["selenium", "Selenium", "mcg", true],
  ["vitaminA", "Vitamin A (RAE)", "mcg", true], ["vitaminC", "Vitamin C", "mg", true], ["vitaminD", "Vitamin D", "mcg", true], ["vitaminE", "Vitamin E", "mg", true], ["vitaminK", "Vitamin K", "mcg", true], ["thiamin", "Thiamin (B1)", "mg", true], ["riboflavin", "Riboflavin (B2)", "mg", true], ["niacin", "Niacin (B3)", "mg", false], ["vitaminB6", "Vitamin B6", "mg", true], ["folate", "Folate (total)", "mcg", false], ["folateDFE", "Folate (DFE)", "mcg", true], ["vitaminB12", "Vitamin B12", "mcg", true], ["choline", "Choline", "mg", true], ["iodine", "Iodine", "mcg", true], ["pantothenicAcid", "Pantothenic acid (B5)", "mg", true], ["biotin", "Biotin (B7)", "mcg", true]
];

let selectedFood = catalog.find((food) => food.id === "generic-white-rice-long-grain") || catalog[0];
let selectedGroup = "all";
let selectedState = "all";
let searchTerm = "";
let currentUnit = "g";
let currentAmount = selectedFood?.servingGrams || 100;
let currentPage = 1;
let activePortion = null;
const pageSize = 12;
const html = value => String(value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
const normalizeSearch = value => value.toLowerCase().normalize("NFKD").replace(/\p{M}/gu, "").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
const searchableFoods = new Map(catalog.map(food => [food.id, normalizeSearch([food.name, food.group, food.state, ...(food.aliases || []), food.sourceDescription].join(" ")).split(/\s+/)]));
const $ = (selector) => document.querySelector(selector);

function showToast(message) {
  const toast = $("#toast"); toast.textContent = message; toast.classList.add("visible"); window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove("visible"), 3200);
}
function titleState(state) { return stateLabels[state] || state; }
function compactState(state) { return state === "dry" ? "Dry" : titleState(state); }
function readableSourceDescription(food) {
  return (food.sourceDescription || food.name)
    .replace(/\s*\(Includes foods for USDA's Food Distribution Program\)/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}
function formatNumber(value, unit) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  if (value > 0 && value < 0.001) return `${Number(value.toPrecision(2))}${unit}`;
  const precision = unit === "kcal" || unit === "" ? 0 : value >= 10 ? 0 : value >= 1 ? 1 : 3;
  return `${Number(value.toFixed(precision))}${unit}`;
}
function nutrientValue(food, key, grams) { return PantryNutrition.nutrientValue(food, key, grams); }
function dvValue(key, value) { return !dailyValues[key] || value === null || value === undefined ? "—" : `${Math.round(value / dailyValues[key] * 100)}%`; }

function defaultMeasurement(food) {
  if (food.countMeasure?.default && food.countMeasure.grams) return { unit: "count", amount: food.countMeasure.defaultAmount || 1 };
  if (food.defaultUnit && food.defaultAmount) return { unit: food.defaultUnit, amount: food.defaultAmount };
  const cup = food.cupGrams;
  if (cup) {
    const ratio = (food.servingGrams || cup) / cup;
    const candidates = [.25, 1 / 3, .5, 2 / 3, .75, 1];
    const amount = candidates.reduce((best, candidate) => Math.abs(candidate - ratio) < Math.abs(best - ratio) ? candidate : best, candidates[0]);
    if (Math.abs(amount - ratio) < .08) return { unit: "cup", amount };
  }
  if (food.tbspGrams) {
    const ratio = (food.servingGrams || food.tbspGrams) / food.tbspGrams;
    const amount = Math.max(1, Math.round(ratio));
    if (Math.abs(amount - ratio) < .25) return { unit: "tbsp", amount };
  }
  return { unit: "g", amount: food.servingGrams || 100 };
}
function resetMeasurement(food) { const measurement = defaultMeasurement(food); currentUnit = measurement.unit; currentAmount = measurement.amount; }
function currentUnitGrams(food) {
  if (currentUnit === "g") return 1;
  if (currentUnit === "cup") return food.cupGrams;
  if (currentUnit === "tbsp") return food.tbspGrams;
  if (currentUnit === "count") return food.countMeasure?.grams;
  return 1;
}
function selectedGrams(food) { return currentUnit === "g" ? currentAmount : currentAmount * currentUnitGrams(food); }
function fractionLabel(value) { return value === .25 ? "¼" : value === 1 / 3 ? "⅓" : value === .5 ? "½" : value === 2 / 3 ? "⅔" : value === .75 ? "¾" : Number(value.toFixed(2)); }
function measurementLabel(food, includeState = false) {
  const grams = Math.round(selectedGrams(food));
  let label = `${fractionLabel(currentAmount)} g`;
  if (currentUnit === "cup") label = `${fractionLabel(currentAmount)} cup${currentAmount === 1 ? "" : "s"} [${grams} g]`;
  if (currentUnit === "tbsp") label = `${currentAmount} tbsp [${grams} g]`;
  if (currentUnit === "count" && food.countMeasure) {
    const countLabel = currentAmount === 1 ? food.countMeasure.unit : food.countMeasure.plural;
    label = `${currentAmount} ${countLabel} [${grams} g]`;
  }
  return includeState && food.state === "dry" ? `${label} dry` : label;
}

function renderGroups() {
  const counts = new Map();
  for (const food of catalog) counts.set(food.group, (counts.get(food.group) || 0) + 1);
  const groups = [...counts.keys()].sort((a, b) => a.localeCompare(b));
  $("#group-select").innerHTML = `<option value="all">All foods (${catalog.length})</option>` + groups.map(group => `<option value="${html(group)}">${html(group)} (${counts.get(group)})</option>`).join("");
  $("#group-select").value = selectedGroup;
}
function syncFilters() {
  $("#group-select").value = selectedGroup;
  document.querySelectorAll("[data-state]").forEach(button => {
    button.classList.toggle("active", button.dataset.state === selectedState);
    button.setAttribute("aria-pressed", String(button.dataset.state === selectedState));
  });
  $("#reset-filters").hidden = selectedGroup === "all" && selectedState === "all";
}
function clearFilters() { selectedGroup = "all"; selectedState = "all"; currentPage = 1; syncFilters(); renderResults(); $("#results-grid").scrollTop = 0; }
function focusSearch() {
  $("#food-browser").scrollIntoView({ behavior: "instant", block: "start" });
  $("#catalog-search").focus({ preventScroll: true }); $("#catalog-search").select();
}
function filteredFoods() {
  const query = normalizeSearch(searchTerm);
  const terms = query.split(/\s+/).filter(Boolean);
  if (searchTerm.trim() && !terms.length) return [];
  return catalog.filter((food) => { const searchable = searchableFoods.get(food.id); return (!query || terms.every(term => searchable.some(word => word.startsWith(term)))) && (selectedGroup === "all" || food.group === selectedGroup) && (selectedState === "all" || food.state === selectedState); });
}
function renderPagination(totalItems) {
  const pagination = $("#pagination");
  const totalPages = Math.ceil(totalItems / pageSize);
  if (totalPages <= 1) { pagination.innerHTML = ""; return; }
  pagination.innerHTML = `<button type="button" data-page-action="previous" ${currentPage === 1 ? "disabled" : ""}>Previous</button><span>Page ${currentPage} of ${totalPages}</span><button type="button" data-page-action="next" ${currentPage === totalPages ? "disabled" : ""}>Next</button>`;
  pagination.querySelector("[data-page-action=previous]").addEventListener("click", () => { currentPage -= 1; renderResults(); $("#results-grid").scrollTop = 0; $("#results-grid").focus({ preventScroll: true }); });
  pagination.querySelector("[data-page-action=next]").addEventListener("click", () => { currentPage += 1; renderResults(); $("#results-grid").scrollTop = 0; $("#results-grid").focus({ preventScroll: true }); });
}
function renderResults() {
  const foods = filteredFoods();
  const totalPages = Math.ceil(foods.length / pageSize);
  currentPage = totalPages ? Math.min(currentPage, totalPages) : 1;
  const pageFoods = foods.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const nextSelection = pageFoods.find(food => food.id === selectedFood?.id) || pageFoods[0] || null;
  const selectionChanged = nextSelection?.id !== selectedFood?.id;
  selectedFood = nextSelection;
  $("#result-count").textContent = `${foods.length} ${foods.length === 1 ? "entry" : "entries"}${searchTerm ? ` matching “${searchTerm}”` : " in the catalog"}${totalPages > 1 ? ` · page ${currentPage} of ${totalPages}` : ""}`;
  $("#catalog-search-count").textContent = searchTerm ? `${foods.length} found` : `${catalog.length} foods`;
  $("#results-grid").innerHTML = pageFoods.map((food) => `<button class="result-card ${selectedFood?.id === food.id ? "selected" : ""}" type="button" aria-pressed="${selectedFood?.id === food.id}" data-food-id="${html(food.id)}"><span class="card-top"><span class="card-type">${html(food.group)}</span><span class="card-state">${html(compactState(food.state))}</span></span><h3>${html(food.name)}</h3><p>${food.sourceType === "branded" ? "Branded product" : "USDA reference food"} · ${food.servingGrams}g reference</p></button>`).join("");
  renderPagination(foods.length);
  $("#empty-state").hidden = foods.length !== 0;
  document.querySelectorAll("[data-food-id]").forEach((button) => button.addEventListener("click", () => selectFood(catalog.find((food) => food.id === button.dataset.foodId))));
  if (selectionChanged) renderLabel();
}

function renderRows(food, grams) {
  const rows = nutrientRows.map(([key, label, unit, hasDV, indent]) => `<div class="${indent ? "indent" : ""}"><dt>${indent ? label : `<b>${label}</b>`} ${formatNumber(nutrientValue(food, key, grams), unit)}</dt><dd>${hasDV ? dvValue(key, nutrientValue(food, key, grams)) : "—"}</dd></div>`);
  $("#nutrients").innerHTML = `<div class="section-row"><dt>Macronutrients</dt><dd></dd></div>${rows.slice(0, 10).join("")}<div class="section-row"><dt>Vitamins & minerals</dt><dd></dd></div>${rows.slice(10).join("")}`;
}
function renderMeasure({ preserveInput = false } = {}) {
  if (!selectedFood) return;
  if (!preserveInput) $("#add-feedback").textContent = "";
  const food = selectedFood;
  const gramsPerUnit = currentUnitGrams(food);
  if (currentUnit !== "g" && !gramsPerUnit) { resetMeasurement(food); return renderMeasure(); }
  const countOption = document.querySelector("[data-unit=count]");
  if (countOption) { countOption.hidden = !food.countMeasure?.grams; if (food.countMeasure) countOption.textContent = food.countMeasure.unit; }
  document.querySelectorAll("[data-unit]").forEach((button) => { const available = button.dataset.unit === "g" || (button.dataset.unit === "cup" && food.cupGrams) || (button.dataset.unit === "tbsp" && food.tbspGrams) || (button.dataset.unit === "count" && food.countMeasure?.grams); button.disabled = !available; button.hidden = !available; button.setAttribute("aria-pressed", String(button.dataset.unit === currentUnit)); button.classList.toggle("active", button.dataset.unit === currentUnit); });
  if (!preserveInput) $("#amount-input").value = currentAmount;
  $("#amount-input").step = "any";
  $("#amount-input").max = Math.min(1000000, 1000000 / currentUnitGrams(food));
  $("#amount-input").removeAttribute("aria-invalid");
  $("#amount-error").hidden = true;
  $("#amount-unit-label").textContent = currentUnit === "g" ? "g" : currentUnit === "cup" ? (currentAmount === 1 ? "cup" : "cups") : currentUnit === "tbsp" ? "tbsp" : currentAmount === 1 ? food.countMeasure.unit : food.countMeasure.plural;
  $("#amount-equivalent").textContent = currentUnit === "g" ? "" : `[${Math.round(selectedGrams(food))} g]`;
  $(".measure-options").hidden = document.querySelectorAll("[data-unit]:not([hidden])").length <= 1;
  const grams = selectedGrams(food);
  $("#serving-size").textContent = measurementLabel(food, true);
  $("#calories").textContent = formatNumber(nutrientValue(food, "calories", grams), "");
  renderRows(food, grams);
  if (activePortion && Math.abs(grams - activePortion.grams) > 1e-9) { activePortion = null; $("#source-portion").value = ""; }
  const source = currentUnit === "cup" ? food.cupSource : currentUnit === "tbsp" ? food.tbspSource : currentUnit === "count" ? food.countMeasure?.source : null;
  $("#measure-provenance").textContent = activePortion ? `USDA reference portion: ${activePortion.label}. Weigh the edible portion for the most direct comparison.` : source ? `Measure: ${source}. For best accuracy, weigh the edible portion in grams.` : "Amounts refer to the edible portion. Weigh in grams for the most direct comparison.";
  $("#add-to-menu").disabled = !Number.isFinite(grams) || grams <= 0 || grams > 1000000;
}
function renderLabel() {
  const hasSelection = Boolean(selectedFood);
  $("#food-picker").hidden = !hasSelection;
  $("#no-selection").hidden = hasSelection;
  $("#add-feedback").textContent = "";
  document.querySelectorAll("#detail .food-context, #detail .label-panel, #detail .source-meta").forEach(element => { element.hidden = !hasSelection; });
  $("#add-to-menu").disabled = !hasSelection;
  if (!selectedFood) return;
  const food = selectedFood;
  activePortion = null;
  $("#detail-title").textContent = food.name;
  $("#food-type").textContent = `${food.group} · ${food.sourceType === "branded" ? "Grocery product" : "USDA reference food"} · ${titleState(food.state)}`;
  $("#food-description").textContent = readableSourceDescription(food);
  $("#food-source").textContent = food.sourceDataset || food.source;
  $("#food-record").textContent = food.fdcId ? `FDC ${food.fdcId}` : food.sourceId || "Source record";
  $("#food-record").href = food.sourceUrl || `https://fdc.nal.usda.gov/food-details/${food.fdcId}/nutrients`;
  const portions = (food.portionOptions || []).filter(portion => Number.isFinite(portion.grams) && portion.grams > 0);
  $("#source-portion-control").hidden = portions.length === 0;
  $("#source-portion").innerHTML = '<option value="">Choose a portion…</option>' + portions.map(portion => `<option value="${portion.grams}">${html(portion.label)} (${portion.grams} g)</option>`).join("");
  resetMeasurement(food); renderMeasure();
}
function selectFood(food) {
  if (!food) return;
  const changed = selectedFood?.id !== food.id;
  selectedFood = food; renderResults(); if (changed) renderLabel();
  const pickerBounds = $("#food-picker").getBoundingClientRect();
  if (window.matchMedia("(max-width: 780px)").matches || pickerBounds.top < 72 || pickerBounds.top > window.innerHeight - 200) $("#detail").scrollIntoView({ behavior: "instant", block: "start" });
  $("#amount-input").focus({ preventScroll: true }); $("#amount-input").select();
}
function resetToDefaultMeasure() { if (!selectedFood) return; activePortion = null; $("#source-portion").value = ""; resetMeasurement(selectedFood); renderMeasure(); }
function setUnit(unit) {
  const grams = selectedGrams(selectedFood);
  currentUnit = unit;
  const unitGrams = currentUnitGrams(selectedFood);
  currentAmount = Math.min(1000000 / unitGrams, unit === "g" ? grams : unit === "count" ? Math.max(1, Math.round(grams / unitGrams)) : grams / unitGrams);
  renderMeasure();
}

$("#lookup").addEventListener("submit", event => {
  event.preventDefault(); searchTerm = $("#food-search").value.trim(); $("#catalog-search").value = searchTerm;
  selectedGroup = "all"; selectedState = "all"; currentPage = 1; syncFilters(); renderResults(); focusSearch();
});
$("#catalog-search").addEventListener("input", () => {
  searchTerm = $("#catalog-search").value.trim(); $("#food-search").value = searchTerm; currentPage = 1; renderResults(); $("#results-grid").scrollTop = 0;
});
$("#catalog-search").addEventListener("keydown", event => {
  if (event.key === "Enter") { event.preventDefault(); const first = filteredFoods()[(currentPage - 1) * pageSize]; if (first) selectFood(first); }
  if (event.key === "Escape") { $("#catalog-search").value = ""; $("#catalog-search").dispatchEvent(new Event("input")); }
});
document.querySelectorAll("[data-search]").forEach(button => button.addEventListener("click", () => { $("#food-search").value = button.dataset.search; $("#lookup").requestSubmit(); }));
$("#group-select").addEventListener("change", event => { selectedGroup = event.target.value; currentPage = 1; syncFilters(); renderResults(); $("#results-grid").scrollTop = 0; });
document.querySelectorAll("[data-state]").forEach(button => button.addEventListener("click", () => { selectedState = button.dataset.state; currentPage = 1; syncFilters(); renderResults(); }));
$("#clear-filters").addEventListener("click", () => { clearFilters(); focusSearch(); });
$("#reset-filters").addEventListener("click", clearFilters);
$("#find-next-food").addEventListener("click", focusSearch);
document.querySelectorAll("[data-unit]").forEach((button) => button.addEventListener("click", () => setUnit(button.dataset.unit)));
$("#reset-measure").addEventListener("click", resetToDefaultMeasure);
$("#amount-input").addEventListener("input", () => {
  $("#add-feedback").textContent = "";
  const input = $("#amount-input"); const value = Number(input.value);
  const grams = value * currentUnitGrams(selectedFood);
  if (!input.validity.valid || !Number.isFinite(grams) || grams <= 0 || grams > 1000000) {
    input.setAttribute("aria-invalid", "true");
    $("#amount-error").textContent = "Enter an amount of at least 0.01 units, up to 1,000,000 g. The label still shows the last valid amount.";
    $("#amount-error").hidden = false; $("#add-to-menu").disabled = true; return;
  }
  currentAmount = value; renderMeasure({ preserveInput: true });
});
$("#increase").addEventListener("click", () => { currentAmount = Math.min(1000000 / currentUnitGrams(selectedFood), currentAmount + (currentUnit === "g" ? 5 : currentUnit === "cup" ? .25 : 1)); renderMeasure(); });
$("#decrease").addEventListener("click", () => { const step = currentUnit === "g" ? 5 : currentUnit === "cup" ? .25 : 1; currentAmount = Math.max(0.01, currentAmount - step); renderMeasure(); });
document.querySelectorAll("[data-notice]").forEach((button) => button.addEventListener("click", () => showToast(button.dataset.notice)));
$("#source-portion").addEventListener("change", event => {
  if (!event.target.value) return;
  activePortion = { grams: Number(event.target.value), label: event.target.selectedOptions[0].textContent };
  currentUnit = "g"; currentAmount = activePortion.grams; renderMeasure();
});
$("#add-to-menu").addEventListener("click", () => {
  if (!selectedFood) return;
  const inputAmount = Number($("#amount-input").value);
  if (!$("#amount-input").validity.valid || !Number.isFinite(inputAmount) || inputAmount <= 0) { showToast("Enter an amount greater than zero."); return; }
  const grams = selectedGrams(selectedFood);
  window.dispatchEvent(new CustomEvent("pantry:add-food", { detail: { foodId: selectedFood.id, grams } }));
});
$("#year").textContent = new Date().getFullYear();
renderGroups(); syncFilters();
const initialQuery = new URLSearchParams(window.location.search).get("q");
if (initialQuery) { searchTerm = initialQuery; $("#catalog-search").value = initialQuery; $("#food-search").value = initialQuery; }
renderResults(); renderLabel();

if (catalog.length) {
  document.querySelectorAll("#food-search, #lookup button, [data-search], #group-select").forEach(control => { control.disabled = false; });
  $("#catalog-loading").hidden = true;
} else {
  $("#catalog-loading").textContent = "The food catalog could not load. Reload the page to try again.";
}
