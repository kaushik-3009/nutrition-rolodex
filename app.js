const catalog = window.PANTRY_CATALOG || [];
const groupOrder = ["Grains", "Pulses", "Vegetables", "Fruit", "Proteins", "Seafood", "Dairy & eggs", "Milk & alternatives", "Nuts & seeds", "Oils", "Canned", "Frozen", "Walmart / Great Value"];
const stateLabels = { raw: "Raw", dry: "Dry / uncooked", canned: "Canned", frozen: "Frozen" };
const dailyValues = { fat: 78, satFat: 20, cholesterol: 300, sodium: 2300, carbs: 275, fiber: 28, protein: 50, calcium: 1300, iron: 18, magnesium: 420, phosphorus: 1250, potassium: 4700, zinc: 11, copper: .9, selenium: 55, vitaminA: 900, vitaminC: 90, vitaminD: 20, vitaminE: 15, vitaminK: 120, thiamin: 1.2, riboflavin: 1.3, niacin: 16, vitaminB6: 1.7, folate: 400, vitaminB12: 2.4, choline: 550 };
const nutrientRows = [
  ["fat", "Total Fat", "g", true], ["satFat", "Saturated Fat", "g", true, true], ["transFat", "Trans Fat", "g", false, true], ["cholesterol", "Cholesterol", "mg", true], ["sodium", "Sodium", "mg", true],
  ["carbs", "Total Carbohydrate", "g", true], ["fiber", "Dietary Fiber", "g", true, true], ["sugars", "Total Sugars", "g", false, true], ["protein", "Protein", "g", false],
  ["calcium", "Calcium", "mg", true], ["iron", "Iron", "mg", true], ["magnesium", "Magnesium", "mg", true], ["phosphorus", "Phosphorus", "mg", true], ["potassium", "Potassium", "mg", true], ["zinc", "Zinc", "mg", true], ["copper", "Copper", "mg", true], ["selenium", "Selenium", "mcg", true],
  ["vitaminA", "Vitamin A", "mcg", true], ["vitaminC", "Vitamin C", "mg", true], ["vitaminD", "Vitamin D", "mcg", true], ["vitaminE", "Vitamin E", "mg", true], ["vitaminK", "Vitamin K", "mcg", true], ["thiamin", "Thiamin (B1)", "mg", true], ["riboflavin", "Riboflavin (B2)", "mg", true], ["niacin", "Niacin (B3)", "mg", true], ["vitaminB6", "Vitamin B6", "mg", true], ["folate", "Folate", "mcg", true], ["vitaminB12", "Vitamin B12", "mcg", true], ["choline", "Choline", "mg", true]
];

let selectedFood = catalog.find((food) => food.name.toLowerCase().includes("white rice")) || catalog[0];
let selectedGroup = "all";
let selectedState = "all";
let searchTerm = "";
let currentUnit = "g";
let currentAmount = selectedFood?.servingGrams || 100;
let currentPage = 1;
const pageSize = 12;
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
  const precision = unit === "kcal" ? 0 : value >= 10 ? 0 : 1;
  return `${Number(value.toFixed(precision))}${unit}`;
}
function nutrientValue(food, key, grams) {
  const nutrient = food?.per100g?.[key];
  return nutrient?.value === null || nutrient?.value === undefined ? null : nutrient.value * grams / 100;
}
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
  let label = `${Math.round(currentAmount)} g`;
  if (currentUnit === "cup") label = `${fractionLabel(currentAmount)} cup${currentAmount === 1 ? "" : "s"} [${grams} g]`;
  if (currentUnit === "tbsp") label = `${currentAmount} tbsp [${grams} g]`;
  if (currentUnit === "count" && food.countMeasure) {
    const countLabel = currentAmount === 1 ? food.countMeasure.unit : food.countMeasure.plural;
    label = `${currentAmount} ${countLabel} [${grams} g]`;
  }
  return includeState && food.state === "dry" ? `${label} dry` : label;
}

function renderGroups() {
  const groups = [...new Set(catalog.map((food) => food.group))].sort((a, b) => groupOrder.indexOf(a) - groupOrder.indexOf(b));
  $("#group-filters").innerHTML = [{ name: "All foods", value: "all", count: catalog.length }, ...groups.map((group) => ({ name: group, value: group, count: catalog.filter((food) => food.group === group).length }))].map((group) => `<button type="button" class="${selectedGroup === group.value ? "active" : ""}" data-group="${group.value}">${group.name}<span>${group.count}</span></button>`).join("");
  document.querySelectorAll("[data-group]").forEach((button) => button.addEventListener("click", () => { selectedGroup = button.dataset.group; currentPage = 1; renderGroups(); renderResults(); }));
}
function filteredFoods() {
  const query = searchTerm.trim().toLowerCase();
  return catalog.filter((food) => { const searchable = [food.name, food.group, food.state, ...(food.aliases || []), food.sourceDescription].join(" ").toLowerCase(); return (!query || searchable.includes(query)) && (selectedGroup === "all" || food.group === selectedGroup) && (selectedState === "all" || food.state === selectedState); });
}
function renderPagination(totalItems) {
  const pagination = $("#pagination");
  const totalPages = Math.ceil(totalItems / pageSize);
  if (totalPages <= 1) { pagination.innerHTML = ""; return; }
  pagination.innerHTML = `<button type="button" data-page-action="previous" ${currentPage === 1 ? "disabled" : ""}>Previous</button><span>Page ${currentPage} of ${totalPages}</span><button type="button" data-page-action="next" ${currentPage === totalPages ? "disabled" : ""}>Next</button>`;
  pagination.querySelector("[data-page-action=previous]").addEventListener("click", () => { currentPage -= 1; renderResults(); });
  pagination.querySelector("[data-page-action=next]").addEventListener("click", () => { currentPage += 1; renderResults(); });
}
function renderResults() {
  const foods = filteredFoods();
  const selectionChanged = Boolean(foods.length && !foods.some((food) => food.id === selectedFood?.id));
  if (selectionChanged) selectedFood = foods[0];
  const totalPages = Math.ceil(foods.length / pageSize);
  currentPage = totalPages ? Math.min(currentPage, totalPages) : 1;
  const pageFoods = foods.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  $("#result-count").textContent = `${foods.length} ${foods.length === 1 ? "entry" : "entries"}${searchTerm ? ` matching “${searchTerm}”` : " in the catalog"}${totalPages > 1 ? ` · page ${currentPage} of ${totalPages}` : ""}`;
  $("#catalog-search-count").textContent = searchTerm ? `${foods.length} found` : `${catalog.length} foods`;
  $("#results-grid").innerHTML = pageFoods.map((food) => `<button class="result-card ${selectedFood?.id === food.id ? "selected" : ""}" type="button" data-food-id="${food.id}"><span class="card-top"><span class="card-type">${food.group}</span><span class="card-state">${compactState(food.state)}</span></span><h3>${food.name}</h3><p>${food.sourceType === "branded" ? "Great Value label" : "Generic ingredient"} · ${food.servingGrams}g reference</p></button>`).join("");
  renderPagination(foods.length);
  $("#empty-state").hidden = foods.length !== 0;
  document.querySelectorAll("[data-food-id]").forEach((button) => button.addEventListener("click", () => selectFood(catalog.find((food) => food.id === button.dataset.foodId))));
  if (selectionChanged) renderLabel();
}

function renderRows(food, grams) {
  const rows = nutrientRows.map(([key, label, unit, hasDV, indent]) => `<div class="${indent ? "indent" : ""}"><dt>${indent ? label : `<b>${label}</b>`} ${formatNumber(nutrientValue(food, key, grams), unit)}</dt><dd>${hasDV ? dvValue(key, nutrientValue(food, key, grams)) : "—"}</dd></div>`);
  $("#nutrients").innerHTML = `<div class="section-row"><dt>Macronutrients</dt><dd></dd></div>${rows.slice(0, 9).join("")}<div class="section-row"><dt>Vitamins & minerals</dt><dd></dd></div>${rows.slice(9).join("")}`;
}
function renderMeasure() {
  if (!selectedFood) return;
  const food = selectedFood;
  const gramsPerUnit = currentUnitGrams(food);
  if (currentUnit !== "g" && !gramsPerUnit) { resetMeasurement(food); return renderMeasure(); }
  const countOption = document.querySelector("[data-unit=count]");
  if (countOption) { countOption.hidden = !food.countMeasure?.grams; if (food.countMeasure) countOption.textContent = food.countMeasure.unit; }
  document.querySelectorAll("[data-unit]").forEach((button) => { const available = button.dataset.unit === "g" || (button.dataset.unit === "cup" && food.cupGrams) || (button.dataset.unit === "tbsp" && food.tbspGrams) || (button.dataset.unit === "count" && food.countMeasure?.grams); button.disabled = !available; button.classList.toggle("active", button.dataset.unit === currentUnit); });
  $("#amount-input").value = currentAmount;
  $("#amount-input").step = currentUnit === "g" ? "1" : currentUnit === "cup" ? "0.25" : "1";
  $("#amount-unit-label").textContent = currentUnit === "g" ? "g" : currentUnit === "cup" ? (currentAmount === 1 ? "cup" : "cups") : currentUnit === "tbsp" ? "tbsp" : currentAmount === 1 ? food.countMeasure.unit : food.countMeasure.plural;
  $("#amount-equivalent").textContent = currentUnit === "g" ? "" : `[${Math.round(selectedGrams(food))} g]`;
  const grams = selectedGrams(food);
  $("#serving-size").textContent = measurementLabel(food, true);
  $("#calories").textContent = formatNumber(nutrientValue(food, "calories", grams), "");
  renderRows(food, grams);
}
function renderLabel() {
  if (!selectedFood) return;
  const food = selectedFood;
  $("#detail-title").textContent = food.name;
  $("#food-type").textContent = `${food.group} · ${food.sourceType === "branded" ? "Grocery product" : "Generic ingredient"} · ${titleState(food.state)}`;
  $("#food-description").textContent = readableSourceDescription(food);
  $("#food-source").textContent = food.source; $("#food-record").textContent = `FDC ${food.fdcId}`;
  resetMeasurement(food); renderMeasure();
}
function selectFood(food) { if (!food) return; selectedFood = food; renderResults(); renderLabel(); }
function resetToDefaultMeasure() { if (!selectedFood) return; resetMeasurement(selectedFood); renderMeasure(); }
function setUnit(unit) {
  const grams = selectedGrams(selectedFood);
  currentUnit = unit;
  const unitGrams = currentUnitGrams(selectedFood);
  currentAmount = unit === "g" ? grams : unit === "count" ? Math.max(1, Math.round(grams / unitGrams)) : grams / unitGrams;
  renderMeasure();
}

$("#lookup").addEventListener("submit", (event) => { event.preventDefault(); searchTerm = $("#food-search").value.trim(); $("#catalog-search").value = searchTerm; currentPage = 1; renderResults(); const match = filteredFoods()[0]; if (match) selectFood(match); else showToast(`No catalog entry matches “${searchTerm}”.`); $("#browse").scrollIntoView({ behavior: "smooth", block: "start" }); });
$("#catalog-search").addEventListener("input", () => { searchTerm = $("#catalog-search").value.trim(); $("#food-search").value = searchTerm; currentPage = 1; renderResults(); });
document.querySelectorAll("[data-search]").forEach((button) => button.addEventListener("click", () => { $("#food-search").value = button.dataset.search; $("#lookup").requestSubmit(); }));
document.querySelectorAll("[data-state]").forEach((button) => button.addEventListener("click", () => { selectedState = button.dataset.state; currentPage = 1; document.querySelectorAll("[data-state]").forEach((item) => item.classList.toggle("active", item === button)); renderResults(); }));
document.querySelectorAll("[data-unit]").forEach((button) => button.addEventListener("click", () => setUnit(button.dataset.unit)));
$("#reset-measure").addEventListener("click", resetToDefaultMeasure);
$("#amount-input").addEventListener("input", () => { const value = Number($("#amount-input").value); if (Number.isFinite(value) && value > 0) { currentAmount = value; renderMeasure(); } });
$("#increase").addEventListener("click", () => { currentAmount += currentUnit === "g" ? 5 : currentUnit === "cup" ? .25 : 1; renderMeasure(); });
$("#decrease").addEventListener("click", () => { const step = currentUnit === "g" ? 5 : currentUnit === "cup" ? .25 : 1; currentAmount = Math.max(step, currentAmount - step); renderMeasure(); });
document.querySelectorAll("[data-notice]").forEach((button) => button.addEventListener("click", () => showToast(button.dataset.notice)));
$("#year").textContent = new Date().getFullYear();
renderGroups(); renderResults(); renderLabel();
