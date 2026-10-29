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
  let editSession = null;
  const invalidDrafts = new Map();
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
    try {
      localStorage.setItem(storageKey, JSON.stringify({ version: 1, entries }));
      if (!storageMessage.startsWith("Some saved foods")) storageMessage = "Saved in this browser on this device. This is a reusable day plan, not a dated food log.";
    } catch { storageMessage = "Browser storage is unavailable. Download your day to keep a copy; it may be lost on reload."; }
    find("#menu-storage-status").textContent = storageMessage;
  }
  window.addEventListener("storage", event => {
    if (event.key !== storageKey && event.key !== null) return;
    try {
      const saved = event.newValue === null ? null : JSON.parse(event.newValue);
      if (saved !== null && (saved.version !== 1 || !Array.isArray(saved.entries))) throw new Error("Unrecognized saved day");
      const source = saved?.entries || [];
      entries = source.filter(entry => entry && byId.has(entry.foodId) && Number.isFinite(entry.grams) && entry.grams > 0 && entry.grams <= maxGrams).slice(0, 500).map(entry => ({ foodId: entry.foodId, grams: entry.grams }));
      storageMessage = entries.length === source.length
        ? "Updated from another tab. Saved in this browser on this device."
        : "Some saved foods were unavailable or invalid and were left out. Review your day before using the totals.";
    } catch {
      entries = [];
      storageMessage = "The saved day changed in another tab but could not be read. Reload to review it.";
    }
    previous = null;
    editSession = null;
    invalidDrafts.clear();
    render();
  });
  function checkpoint() {
    previous = entries.map(entry => ({ ...entry }));
    find("#undo-menu").hidden = false;
  }
  function beginEdit(input) { editSession = { input, initial: input.value, checkpointed: false }; }
  function commitInput(input) {
    const grams = Number(input.value);
    if (!input.validity.valid || !Number.isFinite(grams) || grams <= 0 || grams > maxGrams) {
      const index = Number(input.dataset.menuGrams);
      if (entries[index]) invalidDrafts.set(entries[index].foodId, input.value);
      input.setCustomValidity("Enter a gram amount greater than zero, up to 1,000,000.");
      input.setAttribute("aria-invalid", "true");
      updateRowError(input, true);
      find("#menu-input-status").hidden = false;
      find("#menu-input-status").textContent = "This amount is invalid. Daily totals still use the last valid amount; correct the grams to update them.";
      return false;
    }
    input.setCustomValidity(""); input.removeAttribute("aria-invalid"); updateRowError(input, false);
    const index = Number(input.dataset.menuGrams);
    if (!entries[index]) return false;
    invalidDrafts.delete(entries[index].foodId);
    if (grams !== entries[index].grams) {
      if (editSession?.input === input && !editSession.checkpointed) {
        if (input.value !== editSession.initial) checkpoint();
        editSession.checkpointed = true;
      } else if (editSession?.input !== input) checkpoint();
      entries[index].grams = grams;
      save();
      notify(`${entries.length} ${entries.length === 1 ? "food" : "foods"} in your day`);
      renderTotals();
    }
    const invalid = find("#menu-items [data-menu-grams]:invalid");
    if (!invalid) find("#menu-input-status").hidden = true;
    return true;
  }
  function notify(message) { find("#menu-summary").textContent = message; }
  function gramsText(grams) { return `${Number(grams.toFixed(2))} g`; }
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
  function updateRowError(input, invalid) {
    const row = input.closest(".menu-item");
    let message = row.querySelector(".row-error");
    if (!message) { message = document.createElement("small"); message.className = "row-error"; message.id = `menu-error-${input.dataset.menuGrams}`; row.append(message); }
    message.textContent = invalid ? "Enter 0.01–1,000,000 g. Totals use the last valid amount." : "";
    message.hidden = !invalid;
    if (invalid) input.setAttribute("aria-describedby", message.id); else input.removeAttribute("aria-describedby");
  }
  function render() {
    find("#menu-input-status").hidden = invalidDrafts.size === 0;
    find("#menu-items").innerHTML = entries.map((entry, index) => {
      const food = byId.get(entry.foodId);
      const draft = invalidDrafts.get(entry.foodId);
      return `<li class="menu-item"><div><strong>${escape(food.name)}</strong><p>${escape(foodGroup(food))} · ${escape(titleState(food.state))}</p></div><label>Edible portion (g)<input type="number" min="0.01" max="${maxGrams}" step="any" value="${draft === undefined ? entry.grams : escape(draft)}" data-menu-grams="${index}" aria-label="Grams of ${escape(food.name)}" ${draft === undefined ? "" : 'aria-invalid="true"'} required></label><button type="button" class="remove-menu" data-remove="${index}" aria-label="Remove ${escape(food.name)}">Remove</button></li>`;
    }).join("");
    document.querySelectorAll("[data-menu-grams][aria-invalid=true]").forEach(input => updateRowError(input, true));
    find("#menu-empty").hidden = true;
    find("#menu-storage-status").hidden = entries.length === 0 && storageMessage.startsWith("Saved in this browser");
    find(".daily-label").hidden = entries.length === 0;
    find("#empty-day-preview").hidden = entries.length > 0;
    find("#clear-menu").hidden = entries.length === 0;
    find("#export-menu").hidden = entries.length === 0;
    find("#clear-menu").disabled = entries.length === 0;
    find("#export-menu").disabled = entries.length === 0;
    find("#undo-menu").hidden = previous === null;
    find("#menu-nav-count").textContent = entries.length ? `(${entries.length})` : "";
    find("#picker-menu-count").textContent = entries.length ? `(${entries.length})` : "";
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
    save(); render();
    const total = entries.find(entry => entry.foodId === foodId).grams;
    find("#add-feedback").textContent = `Added ${gramsText(grams)}. Food now totals ${gramsText(total)} in your day.`;
    // The nearby inline status confirms success without covering the nutrition label.
  });
  find("#menu-items").addEventListener("change", event => {
    const input = event.target.closest("[data-menu-grams]");
    if (!input) return;
    if (!commitInput(input)) input.reportValidity();
  });
  find("#menu-items").addEventListener("focusin", event => {
    const input = event.target.closest("[data-menu-grams]");
    if (input) beginEdit(input);
  });
  find("#menu-items").addEventListener("focusout", event => {
    if (editSession?.input === event.target) editSession = null;
  });
  find("#menu-items").addEventListener("input", event => {
    if (!event.target.matches("[data-menu-grams]")) return;
    const input = event.target;
    input.setCustomValidity("");
    commitInput(input);
  });
  find("#menu-items").addEventListener("click", event => {
    const button = event.target.closest("[data-remove]");
    if (!button) return;
    const index = Number(button.dataset.remove);
    checkpoint(); invalidDrafts.delete(entries[index]?.foodId); entries.splice(index, 1); save(); render();
    (find(`[data-remove="${Math.min(index, entries.length - 1)}"]`) || find("#menu-title")).focus();
  });
  find("#clear-menu").addEventListener("click", () => { checkpoint(); entries = []; invalidDrafts.clear(); save(); render(); find("#undo-menu").focus(); });
  find("#undo-menu").addEventListener("click", () => { if (previous === null) return; entries = previous; previous = null; invalidDrafts.clear(); save(); render(); (entries.length ? find("#clear-menu") : find("#menu-title")).focus(); });
  find("#export-menu").addEventListener("click", () => {
    const invalidDraft = find('#menu-items [data-menu-grams]:invalid');
    if (invalidDraft) {
      find("#menu-input-status").hidden = false;
      find("#menu-input-status").textContent = "Correct the invalid gram amount before exporting your day.";
      invalidDraft.focus();
      invalidDraft.reportValidity();
      return;
    }
    const result = PantryNutrition.aggregateMenu(foods, entries);
    const output = { version: 1, note: "Known subtotals only where complete is false. Daily Values are general references, not personalized targets.", entries: entries.map(entry => ({ ...entry, name: byId.get(entry.foodId).name, source: byId.get(entry.foodId).source, sourceId: byId.get(entry.foodId).fdcId || byId.get(entry.foodId).sourceId })), ...result };
    const url = URL.createObjectURL(new Blob([JSON.stringify(output, null, 2)], { type: "application/json" }));
    const link = document.createElement("a"); link.href = url; link.download = "pantry-index-day.json"; link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  render();
})();
