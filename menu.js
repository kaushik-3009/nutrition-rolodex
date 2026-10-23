/* A local, reusable daily plan. Nutrient arithmetic lives in nutrition.js. */
(() => {
  "use strict";
  const foods = window.PANTRY_CATALOG || [];
  const byId = new Map(foods.map(food => [food.id, food]));
  const storageKey = "pantry-index-day-v1";
  const maxGrams = 1000000;
  const find = selector => document.querySelector(selector);
  const escape = value => String(value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  let entries = [];
  let previous = null;
  let storageMessage = "Saved in this browser on this device. This is a reusable day plan, not a dated food log.";
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || "null");
    if (saved !== null) {
      if (saved.version !== 1 || !Array.isArray(saved.entries)) throw new Error("Unrecognized saved day");
      entries = saved.entries.filter(entry => entry && byId.has(entry.foodId) && Number.isFinite(entry.grams) && entry.grams > 0 && entry.grams <= maxGrams).slice(0, 500).map(entry => ({ foodId: entry.foodId, grams: entry.grams }));
      if (entries.length !== saved.entries.length) storageMessage = "Some saved foods were unavailable or invalid and were left out. Review your day before using the totals.";
    }
  } catch {
    storageMessage = "Your saved day could not be read. Changes work for this session; download a copy to keep them.";
  }

  function save() {
    try { localStorage.setItem(storageKey, JSON.stringify({ version: 1, entries })); }
    catch { storageMessage = "Browser storage is unavailable. Download your day to keep a copy; it may be lost on reload."; }
  }
  function checkpoint() { previous = entries.map(entry => ({ ...entry })); }
  function notify(message) { find("#menu-summary").textContent = message; }
  function amount(summary) {
    if (summary.value === null) return "—";
    const precision = summary.unit === "kcal" ? 0 : summary.value >= 10 ? 0 : summary.value >= 1 ? 1 : 3;
    // Preserve a nonzero trace instead of rounding it down to a reported zero.
    const number = summary.value > 0 && summary.value < 0.001 ? String(Number(summary.value.toPrecision(2))) : String(Number(summary.value.toFixed(precision)));
    return `${summary.complete ? "" : "≥ "}${number}${summary.unit === "kcal" ? "" : ` ${summary.unit}`}`;
  }
  function coverage(summary) {
    return summary.total === 0 ? "" : summary.complete ? "" : `${summary.known}/${summary.total} foods report this nutrient`;
  }
  function renderTotals() {
    const result = PantryNutrition.aggregateMenu(foods, entries);
    find("#day-serving").textContent = `${result.itemCount} ${result.itemCount === 1 ? "food" : "foods"} · ${Number(result.totalGrams.toFixed(2))} g`;
    find("#day-calories").textContent = amount(result.totals.calories);
    find("#day-calorie-coverage").textContent = coverage(result.totals.calories);
    find("#menu-nutrition-status").textContent = `${result.itemCount} foods, ${Number(result.totalGrams.toFixed(2))} grams. Daily calories: ${amount(result.totals.calories)}. ${coverage(result.totals.calories)}`;
    find("#day-nutrients").innerHTML = nutrientRows.map(([key, label, , hasDV, indent], index) => {
      const summary = result.totals[key];
      const daily = summary.complete && hasDV ? dvValue(key, summary.value) : "—";
      const section = index === 0 ? '<div class="section-row"><dt>Macronutrients</dt><dd></dd></div>' : index === 10 ? '<div class="section-row"><dt>Vitamins &amp; minerals</dt><dd></dd></div>' : "";
      return `${section}<div class="${indent ? "indent" : ""}"><dt>${indent ? escape(label) : `<b>${escape(label)}</b>`} ${amount(summary)}${coverage(summary) ? `<small class="coverage-note">${coverage(summary)}</small>` : ""}</dt><dd>${daily}</dd></div>`;
    }).join("");
  }
  function render() {
    find("#menu-input-status").hidden = true;
    find("#menu-items").innerHTML = entries.map((entry, index) => {
      const food = byId.get(entry.foodId);
      return `<li class="menu-item"><div><strong>${escape(food.name)}</strong><p>${escape(food.group)} · ${escape(titleState(food.state))}</p></div><label>Edible portion (g)<input type="number" min="0.01" max="${maxGrams}" step="any" value="${entry.grams}" data-menu-grams="${index}" aria-label="Grams of ${escape(food.name)}" required></label><button type="button" class="remove-menu" data-remove="${index}" aria-label="Remove ${escape(food.name)}">Remove</button></li>`;
    }).join("");
    find("#menu-empty").hidden = entries.length > 0;
    find("#clear-menu").disabled = entries.length === 0;
    find("#export-menu").disabled = entries.length === 0;
    find("#undo-menu").hidden = previous === null;
    find("#menu-nav-count").textContent = entries.length ? `(${entries.length})` : "";
    find("#menu-storage-status").textContent = storageMessage;
    notify(entries.length ? `${entries.length} ${entries.length === 1 ? "food" : "foods"} in your day` : "No foods added yet");
    renderTotals();
  }
  window.addEventListener("pantry:add-food", event => {
    const { foodId, grams } = event.detail || {};
    if (!byId.has(foodId) || !Number.isFinite(grams) || grams <= 0 || grams > maxGrams) { showToast("Choose a valid food amount before adding it."); return; }
    const existing = entries.find(entry => entry.foodId === foodId);
    if (existing && existing.grams + grams > maxGrams) { showToast("That amount is too large. Review the grams in your day."); return; }
    if (!existing && entries.length >= 500) { showToast("Your day has reached the 500 food limit."); return; }
    checkpoint();
    if (existing) existing.grams += grams;
    else entries.push({ foodId, grams });
    save(); render(); showToast(`Added ${byId.get(foodId).name} to your day.`);
  });
  find("#menu-items").addEventListener("change", event => {
    const input = event.target.closest("[data-menu-grams]");
    if (!input) return;
    const grams = Number(input.value);
    if (!input.validity.valid || !Number.isFinite(grams) || grams <= 0 || grams > maxGrams) { input.setCustomValidity("Enter a gram amount greater than zero, up to 1,000,000."); input.setAttribute("aria-invalid", "true");
      find("#menu-input-status").hidden = false;
      find("#menu-input-status").textContent = "This amount is invalid. Daily totals still use the last saved amount; correct the grams to update them.";
      input.reportValidity(); return; }
    input.setCustomValidity(""); input.removeAttribute("aria-invalid"); checkpoint(); entries[Number(input.dataset.menuGrams)].grams = grams; save(); render();
  });
  find("#menu-items").addEventListener("input", event => {
    if (event.target.matches("[data-menu-grams]")) event.target.setCustomValidity("");
  });
  find("#menu-items").addEventListener("click", event => {
    const button = event.target.closest("[data-remove]");
    if (!button) return;
    const index = Number(button.dataset.remove);
    checkpoint(); entries.splice(index, 1); save(); render();
    (find(`[data-remove="${Math.min(index, entries.length - 1)}"]`) || find("#menu-title")).focus();
  });
  find("#clear-menu").addEventListener("click", () => { checkpoint(); entries = []; save(); render(); find("#undo-menu").focus(); });
  find("#undo-menu").addEventListener("click", () => { if (previous === null) return; entries = previous; previous = null; save(); render(); find("#clear-menu").focus(); });
  find("#export-menu").addEventListener("click", () => {
    const result = PantryNutrition.aggregateMenu(foods, entries);
    const output = { version: 1, note: "Known subtotals only where complete is false. Daily Values are general references, not personalized targets.", entries: entries.map(entry => ({ ...entry, name: byId.get(entry.foodId).name, source: byId.get(entry.foodId).source, sourceId: byId.get(entry.foodId).fdcId || byId.get(entry.foodId).sourceId })), ...result };
    const url = URL.createObjectURL(new Blob([JSON.stringify(output, null, 2)], { type: "application/json" }));
    const link = document.createElement("a"); link.href = url; link.download = "pantry-index-day.json"; link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  render();
})();
