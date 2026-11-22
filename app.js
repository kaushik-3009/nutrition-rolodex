/* Pantry Index: search a food, pick a portion, log it to a dated day, and see
   the day's totals against goals. Arithmetic lives in nutrition.js, portions
   in measures.js and ranking in search.js. */
(() => {
  "use strict";
  const catalog = window.PANTRY_CATALOG || [];
  const byId = new Map(catalog.map(food => [food.id, food]));
  const M = window.PantryMeasures, N = window.PantryNutrition, S = window.PantrySearch;
  const $ = selector => document.querySelector(selector);
  const esc = value => String(value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);

  // ---------- reference values ----------
  const FDA = { calories: 2000, protein: 50, carbs: 275, fat: 78, fiber: 28 };
  const DV = { fat: 78, satFat: 20, cholesterol: 300, sodium: 2300, carbs: 275, fiber: 28, protein: 50, calcium: 1300, iron: 18, magnesium: 420, phosphorus: 1250, potassium: 4700, zinc: 11, copper: .9, selenium: 55, vitaminA: 900, vitaminC: 90, vitaminD: 20, vitaminE: 15, vitaminK: 120, thiamin: 1.2, riboflavin: 1.3, niacin: 16, vitaminB6: 1.7, folateDFE: 400, pantothenicAcid: 5, vitaminB12: 2.4, choline: 550 };
  // [key, label, unit, show %DV, indented]. Added sugars, iodine and biotin are
  // omitted: the USDA sources report them for almost no foods.
  const SECTIONS = [
    ["Macronutrients", [["fat", "Total Fat", "g", 1], ["satFat", "Saturated Fat", "g", 1, 1], ["transFat", "Trans Fat", "g", 0, 1], ["cholesterol", "Cholesterol", "mg", 1], ["sodium", "Sodium", "mg", 1], ["carbs", "Total Carbohydrate", "g", 1], ["fiber", "Dietary Fiber", "g", 1, 1], ["sugars", "Total Sugars", "g", 0, 1], ["protein", "Protein", "g", 0]]],
    ["Vitamins", [["vitaminA", "Vitamin A (RAE)", "mcg", 1], ["vitaminC", "Vitamin C", "mg", 1], ["vitaminD", "Vitamin D", "mcg", 1], ["vitaminE", "Vitamin E", "mg", 1], ["vitaminK", "Vitamin K", "mcg", 1], ["thiamin", "Thiamin (B1)", "mg", 1], ["riboflavin", "Riboflavin (B2)", "mg", 1], ["niacin", "Niacin (B3)", "mg", 0], ["vitaminB6", "Vitamin B6", "mg", 1], ["folateDFE", "Folate (DFE)", "mcg", 1], ["folate", "Folate (total)", "mcg", 0, 1], ["vitaminB12", "Vitamin B12", "mcg", 1], ["pantothenicAcid", "Pantothenic acid (B5)", "mg", 1], ["choline", "Choline", "mg", 1]]],
    ["Minerals", [["calcium", "Calcium", "mg", 1], ["iron", "Iron", "mg", 1], ["magnesium", "Magnesium", "mg", 1], ["phosphorus", "Phosphorus", "mg", 1], ["potassium", "Potassium", "mg", 1], ["zinc", "Zinc", "mg", 1], ["copper", "Copper", "mg", 1], ["selenium", "Selenium", "mcg", 1]]]
  ];
  const KEY_NUTRIENTS = [ ["satFat", "Sat. fat", "g", "limit"], ["sodium", "Sodium", "mg", "limit"], ["potassium", "Potassium", "mg"], ["calcium", "Calcium", "mg"], ["iron", "Iron", "mg"], ["magnesium", "Magnesium", "mg"], ["vitaminD", "Vitamin D", "mcg"], ["vitaminC", "Vitamin C", "mg"], ["vitaminB12", "Vitamin B12", "mcg"], ["folateDFE", "Folate", "mcg"], ["vitaminK", "Vitamin K", "mcg"], ["zinc", "Zinc", "mg"]];
  const MEALS = [["breakfast", "Breakfast"], ["lunch", "Lunch"], ["dinner", "Dinner"], ["snacks", "Snacks"]];
  const STATE_LABEL = { raw: "Raw", dry: "Dry", cooked: "Cooked", canned: "Canned", frozen: "Frozen", "as sold": "" };

  // ---------- formatting ----------
  const int = value => Math.round(value).toLocaleString();
  function fmt(value, unit) {
    if (value === null || value === undefined || Number.isNaN(value)) return "—";
    if (value > 0 && value < 0.01) return `${Number(value.toPrecision(1))}${unit ? " " + unit : ""}`;
    const digits = unit === "kcal" || !unit ? 0 : value >= 10 ? 0 : value >= 1 ? 1 : 2;
    return `${Number(value.toFixed(digits)).toLocaleString()}${unit ? " " + unit : ""}`;
  }
  const grams = value => `${Number(value.toFixed(value >= 100 ? 0 : 1))} g`;
  const dayKey = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  const parseDay = key => { const [y, m, d] = key.split("-").map(Number); return new Date(y, m - 1, d); };
  const shiftDay = (key, delta) => { const date = parseDay(key); date.setDate(date.getDate() + delta); return dayKey(date); };
  const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  function defaultMeal(date = new Date()) {
    const h = date.getHours() + date.getMinutes() / 60;
    return h < 10.5 ? "breakfast" : h < 15 ? "lunch" : h < 17.5 ? "snacks" : "dinner";
  }
  function stateText(food) { return STATE_LABEL[food.state] ?? food.state; }
  // Add the state only when the source wording doesn't already say how it's prepared.
  function detailLine(food) {
    const { detail } = names(food);
    const prepared = /\b(raw|dry|dried|uncooked|cooked|boiled|baked|roasted|fried|canned|frozen|steamed|grilled|broiled|braised|stewed|scrambled|poached|prepared)\b/i.test(food.name);
    return [detail, prepared ? "" : stateText(food)].filter(Boolean).join(" · ");
  }
  function fitAmount() { const input = $("#amount"); input.style.width = `${Math.max(2, input.value.length) + 0.6}ch`; }
  function names(food) { return S.displayName(food); }

  // ---------- persistence ----------
  const KEY = "pantry-index-v2", LEGACY_KEY = "pantry-index-day-v1";
  let store = { version: 2, days: {}, goals: { ...FDA }, recent: [] };
  let storageOk = true;
  let storageNotice = "";
  function validEntry(entry) {
    return entry && byId.has(entry.foodId) && Number.isFinite(entry.grams) && entry.grams > 0 && entry.grams <= 100000;
  }
  function normalizeStore(raw) {
    const result = { version: 2, days: {}, goals: { ...FDA }, recent: [] };
    if (!raw || typeof raw !== "object") return result;
    for (const [key, list] of Object.entries(raw.days || {})) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(key) || !Array.isArray(list)) continue;
      const clean = list.filter(validEntry).slice(0, 300).map(entry => ({
        id: typeof entry.id === "string" ? entry.id.slice(0, 40) : uid(), foodId: entry.foodId, grams: entry.grams,
        measureId: typeof entry.measureId === "string" ? entry.measureId.slice(0, 80) : "g",
        amount: Number.isFinite(entry.amount) && entry.amount > 0 ? entry.amount : entry.grams,
        meal: MEALS.some(([id]) => id === entry.meal) ? entry.meal : "snacks"
      }));
      if (clean.length) result.days[key] = clean;
    }
    for (const goal of Object.keys(FDA)) if (Number.isFinite(raw.goals?.[goal]) && raw.goals[goal] >= 0) result.goals[goal] = raw.goals[goal];
    if (Array.isArray(raw.recent)) result.recent = raw.recent.filter(item => item && byId.has(item.foodId)).slice(0, 12);
    return result;
  }
  function load() {
    try {
      const saved = localStorage.getItem(KEY);
      if (saved) {
        try { store = normalizeStore(JSON.parse(saved)); }
        catch {
          // Keep the unreadable copy instead of silently overwriting it.
          localStorage.setItem(`${KEY}-unreadable-${Date.now()}`, saved);
          storageNotice = "Your saved log couldn't be read, so a backup copy was kept and a new log started.";
        }
        return;
      }
      // One-time move of the old single "day plan" into today's log.
      const legacy = JSON.parse(localStorage.getItem(LEGACY_KEY) || "null");
      if (legacy && Array.isArray(legacy.entries) && legacy.entries.length) {
        const kept = legacy.entries.filter(validEntry);
        store.days[dayKey(new Date())] = kept.map(entry => ({ id: uid(), foodId: entry.foodId, grams: entry.grams, measureId: "g", amount: entry.grams, meal: "snacks" }));
        storageNotice = `Moved ${kept.length} ${kept.length === 1 ? "food" : "foods"} from your old day plan into today’s Snacks${kept.length < legacy.entries.length ? ` (${legacy.entries.length - kept.length} couldn’t be matched)` : ""}.`;
        save();
      }
    } catch { storageOk = false; }
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(store)); storageOk = true; } catch { storageOk = false; }
    $("#storage-note").textContent = !storageOk ? "This browser is not saving. Download your day to keep it." : storageNotice || "Saved in this browser only.";
  }

  // ---------- state ----------
  let currentDay = dayKey(new Date());
  let stateFilter = "all";
  let resultLimit = 12;
  let lastResults = [];
  let undoSnapshot = null;
  let followToday = true;
  const index = S.createIndex(catalog);
  const entriesFor = key => store.days[key] || (store.days[key] = []);
  const dayEntries = () => store.days[currentDay] || [];

  function measureFor(food, measureId) {
    const options = M.optionsFor(food);
    return options.find(option => option.id === measureId) || options.find(option => option.id === "g");
  }
  function entryText(entry) {
    const food = byId.get(entry.foodId);
    const option = measureFor(food, entry.measureId);
    const amount = option.id === entry.measureId ? entry.amount : entry.grams / option.grams;
    return option.unit === "g" ? grams(entry.grams) : `${M.describe(option, amount)} · ${grams(entry.grams)}`;
  }
  const value = (food, key, g) => N.nutrientValue(food, key, g);
  function totals(entries) {
    const foods = [...new Set(entries.map(entry => entry.foodId))].map(id => byId.get(id));
    return N.aggregateMenu(foods, entries.map(entry => ({ foodId: entry.foodId, grams: entry.grams })));
  }

  // ---------- toast ----------
  function hideToast() { $("#toast").classList.remove("visible"); undoSnapshot = null; }
  function armToast() { clearTimeout(toast.timer); toast.timer = setTimeout(hideToast, undoSnapshot ? 8000 : 3200); }
  function toast(message, undo) {
    $("#toast-text").textContent = message;
    // Several removals in a row undo together: keep the oldest snapshot.
    if (undo) undoSnapshot = undoSnapshot && undoSnapshot.day === undo.day ? undoSnapshot : undo;
    else undoSnapshot = null;
    $("#toast-undo").hidden = !undoSnapshot;
    $("#toast").classList.add("visible");
    armToast();
  }
  function undo() {
    if (!undoSnapshot) return false;
    store.days[undoSnapshot.day] = undoSnapshot.entries;
    currentDay = undoSnapshot.day;
    hideToast(); save(); renderDay();
    toast("Restored");
    return true;
  }
  $("#toast-undo").addEventListener("click", () => { if (undo()) focusAfterChange(); });
  // Hovering or focusing the toast keeps it open.
  for (const type of ["mouseenter", "focusin"]) $("#toast").addEventListener(type, () => clearTimeout(toast.timer));
  for (const type of ["mouseleave", "focusout"]) $("#toast").addEventListener(type, () => { if ($("#toast").classList.contains("visible")) armToast(); });
  document.addEventListener("keydown", event => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z" && !event.target.closest("input, textarea") && undoSnapshot) { event.preventDefault(); if (undo()) focusAfterChange(); }
  });
  function snapshot() { return { day: currentDay, entries: dayEntries().map(entry => ({ ...entry })) }; }

  // ---------- nutrition label ----------
  function labelRows(result) {
    return SECTIONS.map(([title, rows]) => `<div class="section-row"><dt>${title}</dt><dd></dd></div>` + rows.map(([key, label, unit, hasDV, indent]) => {
      const total = result.totals[key];
      const known = total.value !== null;
      const prefix = known && !total.complete ? "≥ " : "";
      const dv = hasDV && known && DV[key] ? `${prefix}${Math.round(total.value / DV[key] * 100)}%` : "";
      const coverage = known && !total.complete ? ` title="${total.known} of ${total.total} foods report ${esc(label.toLowerCase())}; the total is a known minimum"` : "";
      return `<div class="${indent ? "indent" : ""}"${coverage}><dt>${indent ? esc(label) : `<b>${esc(label)}</b>`} ${prefix}${fmt(total.value, unit)}</dt><dd>${dv}</dd></div>`;
    }).join("")).join("");
  }

  // ---------- day summary ----------
  function bar(label, valueText, goalText, ratio, extraClass = "") {
    const pct = Math.max(0, Math.min(1, ratio || 0)) * 100;
    return `<div class="macro ${extraClass}"><div class="macro-top"><span>${label}</span><span><b>${valueText}</b>${goalText ? ` / ${goalText}` : ""}</span></div><div class="meter" aria-hidden="true"><span style="width:${pct}%"></span></div></div>`;
  }
  function renderSummary() {
    const entries = dayEntries();
    const result = totals(entries);
    const t = result.totals, goals = store.goals;
    const kcal = t.calories.value || 0;
    $("#kcal-eaten").textContent = int(kcal);
    $("#kcal-goal").textContent = int(goals.calories);
    $("#kcal-meter").style.width = `${Math.min(100, kcal / (goals.calories || 1) * 100)}%`;
    $("#kcal-meter").classList.toggle("over", kcal > goals.calories);
    const left = goals.calories - kcal;
    $("#kcal-remaining").textContent = entries.length ? (left >= 0 ? `${int(left)} kcal left` : `${int(-left)} kcal over goal`) : `${int(goals.calories)} kcal goal`;
    $("#summary-sub").textContent = entries.length ? `${entries.length} ${entries.length === 1 ? "food" : "foods"} · ${grams(result.totalGrams)}` : "Nothing logged yet";
    const macro = (key, label) => {
      const total = t[key];
      const prefix = total.value !== null && !total.complete ? "≥" : "";
      return bar(label, `${prefix}${fmt(total.value || 0, "")} g`, goals[key] ? `${int(goals[key])} g` : "", goals[key] ? (total.value || 0) / goals[key] : 0, `macro-${key}`);
    };
    $("#macro-grid").innerHTML = macro("protein", "Protein") + macro("carbs", "Carbs") + macro("fat", "Fat") + macro("fiber", "Fiber");
    $("#key-nutrients").innerHTML = KEY_NUTRIENTS.map(([key, label, unit, limit]) => {
      const total = t[key];
      const reference = key === "fiber" ? goals.fiber : DV[key];
      const prefix = total.value !== null && !total.complete ? "≥" : "";
      const ratio = (total.value || 0) / reference;
      return bar(label, `${prefix}${fmt(total.value || 0, unit)}`, `${prefix}${Math.round(ratio * 100)}%`, ratio, limit ? "limit" + (ratio > 1 ? " over" : "") : "");
    }).join("") + `<p class="key-note">% of the FDA Daily Value. “≥” means some foods don’t report it, so the total is a minimum.${t.sugars.value !== null ? ` Total sugars: ${t.sugars.complete ? "" : "≥"}${fmt(t.sugars.value, "g")}.` : ""}</p>`;
    $("#summary").classList.toggle("empty", !entries.length);
    $("#kcal-pill").textContent = `${int(kcal)} / ${int(goals.calories)} kcal`;
    $("#day-serving").textContent = `${result.itemCount} ${result.itemCount === 1 ? "food" : "foods"} · ${grams(result.totalGrams)}`;
    $("#day-calories").textContent = int(kcal);
    $("#day-nutrients").innerHTML = labelRows(result);
  }

  // ---------- food log ----------
  function renderLog() {
    const entries = dayEntries();
    const isToday = currentDay === dayKey(new Date());
    $("#meals").innerHTML = MEALS.map(([meal, title]) => {
      const list = entries.filter(entry => entry.meal === meal);
      const kcal = list.reduce((sum, entry) => sum + (value(byId.get(entry.foodId), "calories", entry.grams) || 0), 0);
      const rows = list.map(entry => {
        const food = byId.get(entry.foodId), name = names(food);
        const p = value(food, "protein", entry.grams), c = value(food, "carbs", entry.grams), f = value(food, "fat", entry.grams);
        return `<li><button type="button" class="log-row" data-entry="${esc(entry.id)}"><span class="log-name"><b>${esc(name.title)}</b>${name.detail ? `<span>${esc(name.detail)}</span>` : ""}<small>${esc(entryText(entry))}</small></span><span class="log-nums"><b>${fmt(value(food, "calories", entry.grams), "")}</b><small title="Protein, carbs, fat">P ${Math.round(p || 0)}g · C ${Math.round(c || 0)}g · F ${Math.round(f || 0)}g</small></span></button><button type="button" class="row-remove" data-remove="${esc(entry.id)}" aria-label="Remove ${esc(name.title)}">✕</button></li>`;
      }).join("");
      return `<section class="meal" aria-label="${title}"><div class="meal-head"><h3>${title}</h3><span>${list.length ? `${int(kcal)} kcal` : ""}</span><button type="button" class="link-button" data-add-meal="${meal}">+ Add</button></div>${rows ? `<ul class="log-list">${rows}</ul>` : ""}</section>`;
    }).join("");
    const empty = entries.length === 0;
    const previous = Object.keys(store.days).filter(key => key < currentDay && store.days[key].length).sort().pop();
    $("#copy-previous").hidden = !empty || !previous;
    $("#copy-previous").dataset.from = previous || "";
    $("#copy-previous").textContent = previous === shiftDay(currentDay, -1) ? "Copy yesterday" : previous ? `Copy ${parseDay(previous).toLocaleDateString(undefined, { month: "short", day: "numeric" })}` : "";
    $("#export-day").hidden = empty;
    $("#clear-day").hidden = empty;
    $("#day-label").textContent = isToday ? "Today" : currentDay === shiftDay(dayKey(new Date()), -1) ? "Yesterday" : parseDay(currentDay).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
    $("#next-day").disabled = isToday;
    $("#day-label").disabled = isToday;
    $("#day-label").title = isToday ? "" : "Back to today";
    $("#log-title").textContent = isToday ? "Food log" : `Food log · ${$("#day-label").textContent}`;
    $("#summary-title").textContent = isToday ? "Today" : $("#day-label").textContent;
  }
  function renderDay() { renderLog(); renderSummary(); }

  // ---------- search ----------
  function portionHint(food) {
    const { option, amount } = M.defaultFor(food);
    const g = option.grams * amount;
    const kcal = value(food, "calories", g);
    return `${option.unit === "g" ? grams(g) : `${M.describe(option, amount)}`} · ${fmt(kcal, "")} kcal`;
  }
  function resultRow(food) {
    const name = names(food);
    return `<li><button type="button" class="result" data-food="${esc(food.id)}"><span class="result-name"><b>${esc(name.title)}</b><span>${esc(detailLine(food))}</span></span><span class="result-hint">${esc(portionHint(food))}</span></button></li>`;
  }
  function renderResults() {
    const query = $("#food-search").value.trim();
    const quick = $("#quick-picks");
    if (!query) {
      lastResults = [];
      $("#results").innerHTML = "";
      $("#more-results").hidden = true;
      $("#result-count").textContent = "";
      const recent = store.recent.filter(item => byId.has(item.foodId)).slice(0, 8);
      const staples = ["generic-bananas-raw", "generic-egg-whole-raw-fresh", "fdc-168878", "generic-rolled-oats", "fdc-171477", "generic-milk-reduced-fat-2", "fdc-172688", "generic-apples-raw-with-skin", "generic-yogurt-greek-plain-whole-milk", "fdc-172470"].filter(id => byId.has(id));
      quick.innerHTML = (recent.length ? `<p class="quick-title">Recent</p><div class="chip-row">${recent.map(item => `<button type="button" class="chip" data-food="${esc(item.foodId)}" data-measure="${esc(item.measureId)}" data-amount="${item.amount}" title="${esc(byId.get(item.foodId).name)}">${esc(names(byId.get(item.foodId)).title)} <small>${esc(M.describe(measureFor(byId.get(item.foodId), item.measureId), item.amount))}</small></button>`).join("")}</div>` : "")
        + `<p class="quick-title">${recent.length ? "Everyday foods" : "Start with an everyday food"}</p><div class="chip-row">${staples.map(id => `<button type="button" class="chip" data-food="${esc(id)}" title="${esc(byId.get(id).name)}">${esc(names(byId.get(id)).title)}</button>`).join("")}</div>`;
      quick.hidden = false;
      return;
    }
    quick.hidden = true;
    lastResults = index.search(query, { state: stateFilter });
    const shown = lastResults.slice(0, resultLimit);
    $("#results").innerHTML = shown.map(({ food }) => resultRow(food)).join("");
    const hiddenByFilter = !lastResults.length && stateFilter !== "all" ? index.search(query).length : 0;
    $("#result-count").innerHTML = lastResults.length
      ? `${lastResults.length.toLocaleString()} ${lastResults.length === 1 ? "match" : "matches"}${lastResults.corrected ? ` for <b>${esc(lastResults.corrected)}</b> <span class="muted">(no matches for “${esc(query)}”)</span>` : ""}`
      : hiddenByFilter
        ? `No ${esc(stateFilter)} foods match “${esc(query)}”. <button type="button" class="link-button" data-clear-filter>Show ${hiddenByFilter.toLocaleString()} in any preparation</button>`
        : `No foods match “${esc(query)}”. Try a shorter or different word, like “chicken” or “rice”.`;
    $("#more-results").hidden = lastResults.length <= resultLimit;
  }
  $("#food-search").addEventListener("input", () => { resultLimit = 12; renderResults(); });
  $("#search-form").addEventListener("submit", event => {
    event.preventDefault(); renderResults();
    if (lastResults[0]) openSheet({ food: lastResults[0].food });
  });
  $("#food-search").addEventListener("keydown", event => {
    if (event.key === "ArrowDown") { const first = $("#results .result"); if (first) { event.preventDefault(); first.focus(); } }
    if (event.key === "Escape") { $("#food-search").value = ""; pendingMeal = null; renderResults(); }
  });
  $("#results").addEventListener("keydown", event => {
    const buttons = [...document.querySelectorAll("#results .result")];
    const i = buttons.indexOf(document.activeElement);
    if (event.key === "ArrowDown" && i < buttons.length - 1) { event.preventDefault(); buttons[i + 1].focus(); }
    if (event.key === "ArrowUp") { event.preventDefault(); (i > 0 ? buttons[i - 1] : $("#food-search")).focus(); }
  });
  $("#more-results").addEventListener("click", () => { resultLimit += 24; renderResults(); });
  function setStateFilter(state) {
    stateFilter = state;
    document.querySelectorAll("[data-state]").forEach(other => other.setAttribute("aria-pressed", String(other.dataset.state === state)));
    resultLimit = 12; renderResults();
  }
  $("#result-count").addEventListener("click", event => { if (event.target.closest("[data-clear-filter]")) setStateFilter("all"); });
  document.querySelectorAll("[data-state]").forEach(button => button.addEventListener("click", () => setStateFilter(button.dataset.state)));
  document.addEventListener("click", event => {
    const pick = event.target.closest("[data-food]");
    if (!pick) return;
    const food = byId.get(pick.dataset.food);
    if (food) openSheet({ food, measureId: pick.dataset.measure, amount: Number(pick.dataset.amount) || undefined });
  });
  document.addEventListener("keydown", event => {
    if (event.key === "/" && !event.target.closest("input, textarea, select, dialog[open]")) { event.preventDefault(); focusSearch(); }
  });
  const coarse = () => matchMedia("(pointer: coarse)").matches;
  function clearSearch() { $("#food-search").value = ""; resultLimit = 12; renderResults(); }
  // After the log re-renders, put focus somewhere sensible instead of <body>.
  function focusAfterChange(entryId, fallbackIndex = 0) {
    if (coarse()) return;
    const target = (entryId && document.querySelector(`[data-entry="${CSS.escape(entryId)}"]`))
      || document.querySelectorAll("#meals .log-row")[fallbackIndex]
      || document.querySelectorAll("#meals .log-row")[fallbackIndex - 1]
      || $("#food-search");
    target.focus({ preventScroll: false });
  }
  function focusSearch() { $("#add").scrollIntoView({ block: "start", behavior: "smooth" }); $("#food-search").focus({ preventScroll: true }); $("#food-search").select(); }

  // ---------- food sheet ----------
  const sheet = $("#food-sheet");
  let draft = null; // { food, option, amount, meal, entryId }
  function openSheet({ food, measureId, amount, meal, entryId }) {
    const fallback = M.defaultFor(food);
    const option = measureId ? measureFor(food, measureId) : fallback.option;
    draft = { food, option, amount: amount && option.id === measureId ? amount : (measureId ? fallback.amount : fallback.amount), meal: meal || pendingMeal || defaultMeal(), entryId };
    if (measureId && option.id !== measureId) draft.option = fallback.option;
    pendingMeal = null;
    const name = names(food);
    $("#sheet-title").textContent = name.title;
    $("#sheet-detail").textContent = detailLine(food);
    $("#meal-picker").innerHTML = MEALS.map(([id, label]) => `<button type="button" data-meal="${id}" aria-pressed="${id === draft.meal}">${label}</button>`).join("");
    $("#portion-chips").innerHTML = M.optionsFor(food).map(option => `<button type="button" role="radio" tabindex="-1" data-portion="${esc(option.id)}" title="${esc(option.source)}"><span>${esc(option.unit === "g" ? "grams" : option.unit === "oz" ? "ounces" : option.label)}</span>${option.kind === "weight" ? "" : `<small>${grams(option.grams)}</small>`}</button>`).join("");
    const source = food.backfill
      ? `Source: USDA ${esc(food.sourceDataset.replace("FoodData Central ", ""))}, FDC ${food.fdcId}. Missing values (${food.backfill.keys.length} nutrients) filled from SR Legacy FDC ${food.backfill.fdcId}.`
      : `Source: USDA ${esc(food.sourceDataset.replace("FoodData Central ", ""))}, FDC ${food.fdcId}.`;
    $("#sheet-source").innerHTML = `${source} <a href="https://fdc.nal.usda.gov/food-details/${food.fdcId}/nutrients" target="_blank" rel="noopener noreferrer">View record ↗</a> · <span title="${esc(food.name)}">${esc(food.name)}</span>`;
    $("#sheet-remove").hidden = !entryId;
    $("#amount-error").hidden = true; $("#amount").removeAttribute("aria-invalid");
    $("#amount").value = M.formatAmount(draft.amount);
    renderSheet();
    if (!sheet.open) sheet.showModal();
    // On phones, don't pop the keyboard over the portions; tap the amount to type.
    requestAnimationFrame(() => {
      if (coarse()) $("#sheet-title").focus({ preventScroll: true });
      else { $("#amount").focus(); $("#amount").select(); }
    });
  }
  function renderSheet({ keepInput = true } = {}) {
    const { food, option, amount } = draft;
    const g = option.grams * amount;
    if (!keepInput) $("#amount").value = option.unit === "g" ? String(Number(amount.toFixed(1))) : M.formatAmount(amount);
    fitAmount();
    $("#amount-unit").textContent = M.unitText(option, amount) + (option.unit === "g" ? "" : ` · ${grams(g)}`);
    document.querySelectorAll("[data-portion]").forEach(button => {
      const checked = button.dataset.portion === option.id;
      button.setAttribute("aria-checked", String(checked));
      button.tabIndex = checked ? 0 : -1;
    });
    $("#sheet-submit").disabled = false;
    $(".preview").classList.remove("stale");
    document.querySelectorAll("[data-meal]").forEach(button => button.setAttribute("aria-pressed", String(button.dataset.meal === draft.meal)));
    const pastDay = currentDay !== dayKey(new Date()) ? ` · ${$("#day-label").textContent}` : "";
    $("#sheet-submit").textContent = draft.entryId ? "Save" : `Add to ${MEALS.find(([id]) => id === draft.meal)[1]}${pastDay}`;
    const result = N.aggregateMenu([food], [{ foodId: food.id, grams: g }]);
    $("#preview-kcal").textContent = fmt(result.totals.calories.value, "");
    $("#preview-macros").innerHTML = [["protein", "Protein"], ["carbs", "Carbs"], ["fat", "Fat"], ["fiber", "Fiber"]].map(([key, label]) => `<span><b>${fmt(result.totals[key].value, "g")}</b>${label}</span>`).join("");
    $("#sheet-serving").textContent = option.unit === "g" ? grams(g) : `${M.describe(option, amount)} (${grams(g)})`;
    $("#sheet-calories").textContent = fmt(result.totals.calories.value, "");
    $("#sheet-nutrients").innerHTML = labelRows(result);
  }
  function setAmount(next) {
    if (!Number.isFinite(next) || next <= 0) return;
    draft.amount = next;
    $("#amount-error").hidden = true; $("#amount").removeAttribute("aria-invalid");
    renderSheet({ keepInput: false });
  }
  // Step to the next "nice" value in the direction pressed, never skipping one.
  function stepSize(option, amount, direction) {
    const at = direction > 0 ? amount : amount - 1e-9;
    if (option.unit === "g") return at < 20 ? 5 : at < 200 ? 10 : 25;
    if (option.unit === "cup") return 0.25;
    return at < 2 ? 0.5 : 1;
  }
  function step(direction) {
    const { option, amount } = draft;
    const size = stepSize(option, amount, direction);
    const units = amount / size;
    const next = (direction > 0 ? Math.floor(units + 1e-9) + 1 : Math.ceil(units - 1e-9) - 1) * size;
    const min = option.unit === "g" ? 5 : option.unit === "cup" ? 0.25 : 0.5;
    setAmount(Math.max(Math.min(min, amount), next));
  }
  $("#amount-up").addEventListener("click", () => step(1));
  $("#amount-down").addEventListener("click", () => step(-1));
  $("#amount").addEventListener("input", () => {
    const parsed = M.parseAmount($("#amount").value);
    if (parsed === null || parsed * draft.option.grams > 20000 || parsed * draft.option.grams < 0.1) {
      const text = $("#amount").value.trim();
      $("#amount-error").textContent = !text ? "Enter an amount." : /^-|^[0.,\s]+$/.test(text) || (parsed !== null && parsed * draft.option.grams < 0.1) ? "Enter an amount greater than zero." : parsed !== null ? "That amount is too large." : "Enter a number like 2, 1.5, 1/2 or 1 1/2.";
      $("#amount-error").hidden = false; $("#amount").setAttribute("aria-invalid", "true");
      $("#sheet-submit").disabled = true; $(".preview").classList.add("stale");
      $("#preview-kcal").textContent = "—";
      $("#preview-macros").querySelectorAll("b").forEach(b => { b.textContent = "—"; });
      return;
    }
    $("#amount-error").hidden = true; $("#amount").removeAttribute("aria-invalid");
    draft.amount = parsed; renderSheet();
  });
  $("#amount").addEventListener("input", fitAmount);
  $("#amount").addEventListener("keydown", event => {
    if (event.key === "ArrowUp" || event.key === "ArrowDown") { event.preventDefault(); step(event.key === "ArrowUp" ? 1 : -1); }
  });
  $("#portion-chips").addEventListener("click", event => {
    const button = event.target.closest("[data-portion]");
    if (!button) return;
    const option = M.optionsFor(draft.food).find(item => item.id === button.dataset.portion);
    if (!option || option.id === draft.option.id) return;
    selectPortion(option);
  });
  // Switching units keeps roughly the same amount of food.
  function selectPortion(option) {
    const valid = $("#amount").getAttribute("aria-invalid") !== "true";
    const previousGrams = draft.option.grams * draft.amount;
    draft.option = option;
    const exact = previousGrams / option.grams;
    if (!valid) draft.amount = option.kind === "weight" ? (option.unit === "g" ? 100 : 1) : 1;
    else if (option.unit === "g") draft.amount = Math.max(1, Math.round(exact));
    else if (option.unit === "oz") draft.amount = Math.max(0.1, Number(exact.toFixed(1)));
    else { const quarter = Math.round(exact * 4) / 4; draft.amount = quarter >= 0.25 && quarter <= 50 ? quarter : 1; }
    $("#amount-error").hidden = true; $("#amount").removeAttribute("aria-invalid");
    renderSheet({ keepInput: false });
  }
  $("#portion-chips").addEventListener("keydown", event => {
    const keys = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
    if (!(event.key in keys)) return;
    event.preventDefault();
    const buttons = [...document.querySelectorAll("[data-portion]")];
    const i = buttons.findIndex(button => button.dataset.portion === draft.option.id);
    const next = buttons[(i + keys[event.key] + buttons.length) % buttons.length];
    selectPortion(M.optionsFor(draft.food).find(item => item.id === next.dataset.portion));
    next.focus();
  });
  $("#meal-picker").addEventListener("click", event => {
    const button = event.target.closest("[data-meal]");
    if (button) { draft.meal = button.dataset.meal; renderSheet(); }
  });
  $("#sheet-close").addEventListener("click", () => sheet.close());
  sheet.addEventListener("click", event => { if (event.target === sheet) sheet.close(); });
  $("#sheet-form").addEventListener("submit", event => {
    event.preventDefault();
    const parsed = M.parseAmount($("#amount").value);
    if (parsed === null) { $("#amount").focus(); return; }
    draft.amount = parsed;
    const { food, option, amount, meal, entryId } = draft;
    const g = option.grams * amount;
    if (!(g > 0 && g <= 20000)) return;
    const record = { foodId: food.id, grams: g, measureId: option.id, amount, meal };
    const list = entriesFor(currentDay);
    const existing = entryId && list.find(item => item.id === entryId);
    let savedId = entryId;
    if (existing) Object.assign(existing, record);
    else { savedId = uid(); list.push({ id: savedId, ...record }); }
    store.recent = [{ foodId: food.id, measureId: option.id, amount }, ...store.recent.filter(item => item.foodId !== food.id)].slice(0, 12);
    save(); sheet.close(); renderDay();
    const dayKcal = int(totals(dayEntries()).totals.calories.value || 0);
    if (existing) { toast(`Updated ${names(food).title} · day ${dayKcal} kcal`); focusAfterChange(savedId); }
    else {
      toast(`${entryId ? "Saved again (it was removed elsewhere)" : `Added ${names(food).title}`} · ${fmt(value(food, "calories", g), "")} kcal · day ${dayKcal} kcal`);
      clearSearch();
      if (!coarse()) $("#food-search").focus({ preventScroll: true });
    }
  });
  $("#sheet-remove").addEventListener("click", () => {
    if (!draft?.entryId) return;
    removeEntry(draft.entryId); sheet.close();
  });

  // ---------- log interactions ----------
  let pendingMeal = null;
  function removeEntry(id) {
    const before = snapshot();
    const rows = [...document.querySelectorAll("#meals .log-row")];
    const position = Math.max(0, rows.findIndex(row => row.dataset.entry === id));
    const entry = dayEntries().find(item => item.id === id);
    store.days[currentDay] = dayEntries().filter(item => item.id !== id);
    save(); renderDay();
    if (entry) toast(`Removed ${names(byId.get(entry.foodId)).title}`, before);
    focusAfterChange(null, position);
  }
  $("#meals").addEventListener("click", event => {
    const row = event.target.closest("[data-entry]");
    const remove = event.target.closest("[data-remove]");
    const add = event.target.closest("[data-add-meal]");
    if (remove) removeEntry(remove.dataset.remove);
    else if (row) {
      const entry = dayEntries().find(item => item.id === row.dataset.entry);
      if (entry) openSheet({ food: byId.get(entry.foodId), measureId: entry.measureId, amount: entry.measureId === measureFor(byId.get(entry.foodId), entry.measureId).id ? entry.amount : entry.grams, meal: entry.meal, entryId: entry.id });
    } else if (add) { pendingMeal = add.dataset.addMeal; focusSearch(); }
  });
  $("#clear-day").addEventListener("click", () => {
    const before = snapshot();
    store.days[currentDay] = []; save(); renderDay();
    toast("Cleared the day", before);
    focusAfterChange();
  });
  $("#copy-previous").addEventListener("click", () => {
    const from = $("#copy-previous").dataset.from;
    if (!from || !store.days[from]) return;
    store.days[currentDay] = store.days[from].map(entry => ({ ...entry, id: uid() }));
    save(); renderDay(); toast(`Copied ${store.days[currentDay].length} foods`, { day: currentDay, entries: [] });
    focusAfterChange();
  });
  $("#export-day").addEventListener("click", () => {
    const entries = dayEntries();
    const result = totals(entries);
    const data = { date: currentDay, goals: store.goals, entries: entries.map(entry => { const food = byId.get(entry.foodId); return { meal: entry.meal, food: food.name, fdcId: food.fdcId, amount: entryText(entry), grams: entry.grams, calories: value(food, "calories", entry.grams) }; }), totals: result.totals, note: "Totals marked complete:false are known minimums. Daily Values are general references." };
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
    const link = document.createElement("a"); link.href = url; link.download = `pantry-index-${currentDay}.json`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  function goToDay(key) {
    currentDay = key; followToday = key === dayKey(new Date());
    clearSearch(); renderDay();
  }
  $("#prev-day").addEventListener("click", () => goToDay(shiftDay(currentDay, -1)));
  $("#next-day").addEventListener("click", () => { if (currentDay < dayKey(new Date())) goToDay(shiftDay(currentDay, 1)); });
  $("#day-label").addEventListener("click", () => goToDay(dayKey(new Date())));
  // A tab left open past midnight moves on to the new day.
  function checkDate() { if (followToday && currentDay !== dayKey(new Date()) && !sheet.open) goToDay(dayKey(new Date())); }
  document.addEventListener("visibilitychange", () => { if (!document.hidden) checkDate(); });
  setInterval(checkDate, 60000);

  // ---------- goals ----------
  const goalsDialog = $("#goals-dialog");
  function fillGoals(values) { for (const [key, val] of Object.entries(values)) goalsDialog.querySelector(`[name=${key}]`).value = Math.round(val); }
  $("#open-goals").addEventListener("click", () => { fillGoals(store.goals); goalsDialog.showModal(); goalsDialog.querySelector("[name=calories]").focus(); });
  $("#goals-reset").addEventListener("click", () => fillGoals(FDA));
  goalsDialog.querySelector("[data-close]").addEventListener("click", () => goalsDialog.close());
  goalsDialog.addEventListener("click", event => { if (event.target === goalsDialog) goalsDialog.close(); });
  $("#goals-form").addEventListener("submit", event => {
    event.preventDefault();
    if (!$("#goals-form").reportValidity()) return;
    for (const key of Object.keys(FDA)) store.goals[key] = Number(goalsDialog.querySelector(`[name=${key}]`).value);
    save(); goalsDialog.close(); renderSummary(); toast("Goals saved");
  });

  $("#kcal-pill").addEventListener("click", () => $("#summary").scrollIntoView({ behavior: "smooth", block: "start" }));

  // ---------- cross-tab sync ----------
  window.addEventListener("storage", event => {
    if (event.key !== KEY) return;
    try { store = normalizeStore(JSON.parse(event.newValue || "null")); } catch { return; }
    renderDay(); if (!$("#food-search").value) renderResults();
  });

  // ---------- start ----------
  if (!catalog.length) { $("#catalog-status").textContent = "The food catalog could not load. Reload the page to try again."; return; }
  load(); save();
  $("#catalog-status").hidden = true;
  $("#food-search").disabled = false;
  const initial = new URLSearchParams(location.search).get("q");
  if (initial) $("#food-search").value = initial;
  renderDay(); renderResults();
  window.PantryApp = { openSheet, store: () => store, dayKey };
})();
