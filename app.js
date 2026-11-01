const catalog = window.PANTRY_CATALOG || [];
const stateLabels = { raw: "Raw", dry: "Dry / uncooked", canned: "Canned", frozen: "Frozen", cooked: "Cooked", other: "", "as sold": "" };
const dailyValues = { fat: 78, satFat: 20, cholesterol: 300, sodium: 2300, carbs: 275, fiber: 28, protein: 50, calcium: 1300, iron: 18, magnesium: 420, phosphorus: 1250, potassium: 4700, zinc: 11, copper: .9, selenium: 55, vitaminA: 900, vitaminC: 90, vitaminD: 20, vitaminE: 15, vitaminK: 120, thiamin: 1.2, riboflavin: 1.3, niacin: 16, vitaminB6: 1.7, folateDFE: 400, iodine: 150, pantothenicAcid: 5, biotin: 30, addedSugars: 50, vitaminB12: 2.4, choline: 550 };
const nutrientRows = [
  ["fat", "Total Fat", "g", true], ["satFat", "Saturated Fat", "g", true, true], ["transFat", "Trans Fat", "g", false, true], ["cholesterol", "Cholesterol", "mg", true], ["sodium", "Sodium", "mg", true],
  ["carbs", "Total Carbohydrate", "g", true], ["fiber", "Dietary Fiber", "g", true, true], ["sugars", "Total Sugars", "g", false, true], ["addedSugars", "Added Sugars", "g", true, true], ["protein", "Protein", "g", false],
  ["calcium", "Calcium", "mg", true], ["iron", "Iron", "mg", true], ["magnesium", "Magnesium", "mg", true], ["phosphorus", "Phosphorus", "mg", true], ["potassium", "Potassium", "mg", true], ["zinc", "Zinc", "mg", true], ["copper", "Copper", "mg", true], ["selenium", "Selenium", "mcg", true],
  ["vitaminA", "Vitamin A (RAE)", "mcg", true], ["vitaminC", "Vitamin C", "mg", true], ["vitaminD", "Vitamin D", "mcg", true], ["vitaminE", "Vitamin E", "mg", true], ["vitaminK", "Vitamin K", "mcg", true], ["thiamin", "Thiamin (B1)", "mg", true], ["riboflavin", "Riboflavin (B2)", "mg", true], ["niacin", "Niacin (B3)", "mg", false], ["vitaminB6", "Vitamin B6", "mg", true], ["folate", "Folate (total)", "mcg", false], ["folateDFE", "Folate (DFE)", "mcg", true], ["vitaminB12", "Vitamin B12", "mcg", true], ["choline", "Choline", "mg", true], ["iodine", "Iodine", "mcg", true], ["pantothenicAcid", "Pantothenic acid (B5)", "mg", true], ["biotin", "Biotin (B7)", "mcg", true]
];

const nutrientByKey = new Map(nutrientRows.map(row => [row[0], row]));
const nutrientSections = [
  { label: "Macronutrients", keys: ["fat","satFat","transFat","carbs","fiber","sugars","addedSugars","protein"] },
  { label: "Vitamins", keys: ["vitaminA","vitaminC","vitaminD","vitaminE","vitaminK","thiamin","riboflavin","niacin","vitaminB6","vitaminB12","folate","folateDFE","pantothenicAcid","biotin"] },
  { label: "Minerals", keys: ["calcium","iron","magnesium","phosphorus","potassium","sodium","zinc","copper","selenium","iodine"] },
  { label: "Other nutrients", keys: ["cholesterol","choline"] }
].map(section => ({ label: section.label, rows: section.keys.map(key => nutrientByKey.get(key)) }));

let selectedFood = catalog.find((food) => food.id === "generic-white-rice-long-grain") || catalog[0];
let selectedGroup = "all";
let selectedState = "all";
let searchTerm = "";
let currentUnit = "g";
let currentAmount = selectedFood?.servingGrams || 100;
let currentPage = 1;
const measureCache = new Map();
const pageSize = 40;
const html = value => String(value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
const normalizeSearch = value => value.toLowerCase().normalize("NFKD").replace(/\p{M}/gu, "").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
const searchableFoods = new Map(catalog.map(food => [food.id, normalizeSearch([food.name, food.group, food.state, ...(food.aliases || []), food.sourceDescription].join(" ")).split(/\s+/)]));
const $ = (selector) => document.querySelector(selector);

function showToast(message) {
  const toast = $("#toast"); toast.textContent = message; toast.classList.add("visible"); window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove("visible"), 3200);
}
function titleState(state) { return stateLabels[state] ?? state; }
function compactState(state) { return state === "dry" ? "Dry" : titleState(state); }
function readableSourceDescription(food) {
  return (food.sourceDescription || food.name)
    .replace(/\s*\(Includes foods for USDA's Food Distribution Program\)/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}
function formatNumber(value, unit) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  if (value > 0 && value < 0.001) return `${Number(value.toPrecision(2))}${unit ? " " + unit : ""}`;
  const precision = unit === "kcal" || unit === "" ? 0 : value >= 10 ? 0 : value >= 1 ? 1 : 3;
  return `${Number(value.toFixed(precision))}${unit ? " " + unit : ""}`;
}
function nutrientValue(food, key, grams) { return PantryNutrition.nutrientValue(food, key, grams); }
function dvValue(key, value) { return !dailyValues[key] || value === null || value === undefined ? "—" : `${Math.round(value / dailyValues[key] * 100)}%`; }

function measurements(food) {
  if (!measureCache.has(food.id)) measureCache.set(food.id, PantryMeasures.optionsFor(food));
  return measureCache.get(food.id);
}
function currentMeasure(food = selectedFood) { return measurements(food).find(option => option.id === currentUnit) || measurements(food)[0]; }
function resetMeasurement(food) {
  const options = measurements(food);
  const legacy = window.PANTRY_HOUSEHOLD_MEASURES?.foods.find(item => item.fdcId === food.fdcId);
  const count = options.find(option => option.unit === "count");
  const preferredUnit = legacy?.countMeasure?.default ? "count" : legacy?.defaultUnit;
  const preferred = options.find(option => option.unit === preferredUnit)
    || (/^egg[, ]/i.test(food.name) ? count : null)
    || options.find(option => option.unit === "cup") || count || options[0];
  currentUnit = preferred.id;
  currentAmount = preferredUnit === "count" && preferred.unit === "count" ? legacy.countMeasure.defaultAmount || 1 : preferred.unit === preferredUnit ? legacy.defaultAmount || preferred.defaultAmount || 1 : preferred.defaultAmount || 1;
}
function currentUnitGrams(food) { return currentMeasure(food).grams; }
function selectedGrams(food) { return currentAmount * currentUnitGrams(food); }
function fractionLabel(value) { return PantryMeasures.formatAmount(value); }
function unitLabel(option, amount) {
  if (option.unit === "g") return "g";
  if (option.unit === "cup") return amount <= 1 ? option.label.replace(/^Cup/,"cup") : option.label.replace(/^Cup/,"cups");
  if (option.unit === "tbsp") return "tbsp";
  if (option.unit === "tsp") return "tsp";
  return option.label.replace(/^Egg\b/i,amount === 1 ? "egg" : "eggs");
}
function measurementLabel(food) {
  const option = currentMeasure(food);
  return `${option.unit === "g" ? Number(currentAmount.toFixed(8)) : fractionLabel(currentAmount)} ${unitLabel(option,currentAmount)}${option.unit === "g" ? "" : ` · ${formatNumber(selectedGrams(food), "g")}`}`;
}

const groupAliases = { "Cereal Grains and Pasta": "Grains", "Fruits and Fruit Juices": "Fruit", "Vegetables and Vegetable Products": "Vegetables", "Legumes and Legume Products": "Pulses", "Dairy and Egg Products": "Dairy & eggs", "Nut and Seed Products": "Nuts & seeds", "Fats and Oils": "Oils", "Finfish and Shellfish Products": "Seafood" };
function foodGroup(food) { return groupAliases[food.group] || food.group; }
function renderGroups() {
  const counts = new Map();
  for (const food of catalog) counts.set(foodGroup(food), (counts.get(foodGroup(food)) || 0) + 1);
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
  return catalog.filter((food) => { const searchable = searchableFoods.get(food.id); return (!query || terms.every(term => searchable.some(word => word.startsWith(term)))) && (selectedGroup === "all" || foodGroup(food) === selectedGroup) && (selectedState === "all" || food.state === selectedState); });
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
  $("#result-count").textContent = `${foods.length.toLocaleString()} ${foods.length === 1 ? "food" : "foods"}${totalPages > 1 ? ` · page ${currentPage} of ${totalPages}` : ""}`;
  $("#results-grid").innerHTML = pageFoods.map((food) => `<button class="result-card ${selectedFood?.id === food.id ? "selected" : ""}" type="button" aria-pressed="${selectedFood?.id === food.id}" data-food-id="${html(food.id)}"><span class="card-top"><span class="card-type">${html(foodGroup(food))}</span><span class="card-state">${html(compactState(food.state))}</span></span><h3>${html(food.name)}</h3><p>${food.per100g.calories?.value == null ? "" : `${formatNumber(food.per100g.calories.value, "")} cal / 100 g`}</p></button>`).join("");
  renderPagination(foods.length);
  requestAnimationFrame(resizeFoodList);
  $("#empty-state").hidden = foods.length !== 0;
  document.querySelectorAll("[data-food-id]").forEach((button) => button.addEventListener("click", () => selectFood(catalog.find((food) => food.id === button.dataset.foodId))));
  if (selectionChanged) renderLabel();
}

function renderRows(food, grams) {
  $("#nutrients").innerHTML = nutrientSections.map(section => `<div class="section-row"><dt>${section.label}</dt><dd></dd></div>` + section.rows.map(([key,label,unit,hasDV,indent]) => `<div class="${indent ? "indent" : ""}"><dt>${indent ? label : `<b>${label}</b>`} ${formatNumber(nutrientValue(food,key,grams),unit)}</dt><dd>${hasDV ? dvValue(key,nutrientValue(food,key,grams)) : "—"}</dd></div>`).join("")).join("");
}
function renderMeasure({ preserveInput = false } = {}) {
  if (!selectedFood) return;
  if (!preserveInput) $("#add-feedback").textContent = "";
  const food = selectedFood, option = currentMeasure(food), grams = selectedGrams(food);
  if (!preserveInput) $("#amount-input").value = option.unit === "g" ? String(Number(currentAmount.toFixed(8))) : fractionLabel(currentAmount);
  $("#amount-input").setCustomValidity("");
  $("#amount-input").removeAttribute("aria-invalid"); $("#amount-error").hidden = true;
  $("#amount-unit-label").textContent = unitLabel(option,currentAmount);
  $("#amount-equivalent").textContent = option.unit === "g" ? "" : `= ${formatNumber(grams,"g")}`;
  document.querySelectorAll("[data-unit]").forEach(button => {
    const active = button.dataset.unit === currentUnit;
    button.classList.toggle("active",active); button.setAttribute("aria-pressed",String(active));
  });
  const amounts = option.unit === "g" ? [25,50,100,200] : option.unit === "cup" ? [.25,.5,1,2] : [1,2,3,4];
  $("#amount-presets").innerHTML = amounts.map(amount => `<button type="button" data-amount="${amount}" class="${Math.abs(currentAmount-amount)<1e-9 ? "active" : ""}" aria-pressed="${Math.abs(currentAmount-amount)<1e-9}">${fractionLabel(amount)}</button>`).join("");
  $("#serving-size").textContent = measurementLabel(food);
  $("#calories").textContent = formatNumber(nutrientValue(food,"calories",grams),"");
  renderRows(food,grams);
  $("#add-to-menu").disabled = !Number.isFinite(grams) || grams <= 0 || grams > 1000000;
  resizeFoodList();
}
function resizeFoodList() {
  const list = $("#results-grid"), browser = $("#food-browser"), detail = $("#detail");
  if (matchMedia("(min-width:781px)").matches && selectedFood) {
    const topOffset = list.getBoundingClientRect().top - browser.getBoundingClientRect().top;
    const pagination = $("#pagination");
    const paginationHeight = pagination.getBoundingClientRect().height + (parseFloat(getComputedStyle(pagination).marginTop) || 0);
    list.style.height = `${Math.max(400,detail.getBoundingClientRect().height-topOffset-paginationHeight)}px`;
  } else list.style.removeProperty("height");
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
  $("#detail-title").textContent = food.name;
  $("#food-type").textContent = [foodGroup(food), titleState(food.state)].filter(Boolean).join(" · ");
  $("#food-description").textContent = readableSourceDescription(food);
  $("#food-source").textContent = food.sourceDataset || food.source;
  $("#food-record").textContent = food.fdcId ? `FDC ${food.fdcId}` : food.sourceId || "Source record";
  $("#food-record").href = food.sourceUrl || `https://fdc.nal.usda.gov/food-details/${food.fdcId}/nutrients`;
  $("#measure-options").innerHTML = measurements(food).map(option => `<button type="button" data-unit="${html(option.id)}" title="${html(option.source || "")}">${html(option.label)}</button>`).join("");
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
function resetToDefaultMeasure() { if (!selectedFood) return; resetMeasurement(selectedFood); renderMeasure(); }
function setUnit(unit) {
  const previousGrams = selectedGrams(selectedFood);
  const option = measurements(selectedFood).find(item => item.id === unit);
  if (!option) return;
  currentUnit = unit;
  currentAmount = previousGrams / option.grams;
  renderMeasure();
}
function changeAmount(direction) {
  const option = currentMeasure(), step = option.unit === "g" ? 5 : option.unit === "cup" ? .25 : 1;
  currentAmount = Math.min(1000000/option.grams,Math.max(option.unit === "g" ? .01 : .25,currentAmount+direction*step));
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
$("#clear-filters").addEventListener("click", () => { searchTerm = ""; $("#catalog-search").value = ""; $("#food-search").value = ""; clearFilters(); focusSearch(); });
$("#reset-filters").addEventListener("click", clearFilters);
$("#find-next-food").addEventListener("click", focusSearch);
$("#measure-options").addEventListener("click", event => { const button = event.target.closest("[data-unit]"); if (button) setUnit(button.dataset.unit); });
$("#amount-presets").addEventListener("click", event => { const button = event.target.closest("[data-amount]"); if (button) { currentAmount = Number(button.dataset.amount); renderMeasure(); } });
$("#reset-measure").addEventListener("click", resetToDefaultMeasure);
$("#amount-input").addEventListener("input", () => {
  $("#add-feedback").textContent = "";
  const input = $("#amount-input"), value = PantryMeasures.parseAmount(input.value);
  const grams = value * currentUnitGrams(selectedFood);
  if (value === null || !Number.isFinite(grams) || grams <= 0 || grams > 1000000) {
    input.setCustomValidity("Enter a positive amount, such as 1/2 or 1.4."); input.setAttribute("aria-invalid","true");
    $("#amount-error").textContent = grams > 1000000 ? "Amount is too large." : "Enter an amount, like 1/2 or 1.4.";
    $("#amount-error").hidden = false; $("#add-to-menu").disabled = true; return;
  }
  currentAmount = value; renderMeasure({preserveInput:true});
});
$("#amount-input").addEventListener("keydown", event => {
  if (event.key === "ArrowUp" || event.key === "ArrowDown") { event.preventDefault(); changeAmount(event.key === "ArrowUp" ? 1 : -1); }
  if (event.key === "Enter" && !$("#add-to-menu").disabled) $("#add-to-menu").click();
});
$("#increase").addEventListener("click", () => changeAmount(1));
$("#decrease").addEventListener("click", () => changeAmount(-1));
window.addEventListener("resize",resizeFoodList);
$("#add-to-menu").addEventListener("click", () => {
  if (!selectedFood) return;
  const inputAmount = PantryMeasures.parseAmount($("#amount-input").value);
  if (!$("#amount-input").validity.valid || !Number.isFinite(inputAmount) || inputAmount <= 0) { showToast("Enter an amount greater than zero."); return; }
  const grams = selectedGrams(selectedFood);
  window.dispatchEvent(new CustomEvent("pantry:add-food", { detail: { foodId: selectedFood.id, grams, measureId: currentUnit, amount: currentAmount, measureLabel: currentMeasure().label } }));
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

if (document.fonts) document.fonts.ready.then(resizeFoodList);
new ResizeObserver(resizeFoodList).observe($("#detail"));
