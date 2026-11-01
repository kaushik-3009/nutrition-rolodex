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
  let storageMessage = "Saved on this device.";
  function measureOptions(food) {
    try { return window.PantryMeasures?.optionsFor(food) || []; } catch { return []; }
  }
  function findMeasure(food, id) {
    if (typeof id !== "string" || id.length > 80) return null;
    return measureOptions(food).find(option => option && option.id === id) || null;
  }
  function cleanLabel(label) {
    return typeof label === "string" ? label.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 120) : "";
  }
  function formatMeasureAmount(value) {
    const formatted = window.PantryMeasures?.formatAmount?.(value);
    return typeof formatted === "string" && formatted ? formatted : String(Number(value.toFixed(2)));
  }
  function describeMeasure(option, amount, labelHint = "") {
    if (option?.unit === "g") return `${Number(amount.toFixed(8))} g`;
    const optionLabel = cleanLabel(option ? unitLabel(option,amount) : "");
    if (optionLabel) return `${formatMeasureAmount(amount)} ${optionLabel}`;
    const unit = cleanLabel(option?.unit || "");
    if (unit) return `${formatMeasureAmount(amount)} ${unit}`;
    const label = cleanLabel(labelHint || "");
    if (!label) return "";
    return label.replace(/^[\d./¼½⅓⅔¾]+/, formatMeasureAmount(amount));
  }
  function measureData(food, id, amount, label) {
    const option = findMeasure(food, id);
    if (!option || !Number.isFinite(amount) || amount <= 0 || amount > maxGrams) return null;
    return { measureId: option.id, amount, measureLabel: describeMeasure(option, amount, label) };
  }
  function setMeasureFromGrams(entry) {
    const food = byId.get(entry.foodId);
    const option = findMeasure(food, entry.measureId) || findMeasure(food, "g");
    const gramsPerUnit = Number(option?.grams);
    if (!option || !Number.isFinite(gramsPerUnit) || gramsPerUnit <= 0) {
      delete entry.measureId; delete entry.amount; delete entry.measureLabel;
      return;
    }
    const amount = entry.grams / gramsPerUnit;
    entry.measureId = option.id;
    entry.amount = amount;
    entry.measureLabel = describeMeasure(option, amount);
  }
  function sanitizeEntry(entry) {
    if (!entry || !byId.has(entry.foodId) || !Number.isFinite(entry.grams) || entry.grams <= 0 || entry.grams > maxGrams) return null;
    const food = byId.get(entry.foodId);
    const option = findMeasure(food, entry.measureId);
    const measure = option ? measureData(food, option.id, entry.grams / option.grams, entry.measureLabel) : null;
    return { foodId: entry.foodId, grams: entry.grams, ...(measure || {}) };
  }
  function sanitizeEntries(source) { return source.map(sanitizeEntry).filter(Boolean).slice(0, 500); }
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || "null");
    if (saved !== null) {
      if (saved.version !== 1 || !Array.isArray(saved.entries)) throw new Error("Unrecognized saved day");
      entries = sanitizeEntries(saved.entries);
      if (entries.length !== saved.entries.length) storageMessage = "Some saved foods were unavailable.";
    }
  } catch {
    storageMessage = "Saved day could not be read.";
  }

  function save() {
    try {
      localStorage.setItem(storageKey, JSON.stringify({ version: 1, entries }));
      if (!storageMessage.startsWith("Some saved foods")) storageMessage = "Saved on this device.";
    } catch { storageMessage = "Storage unavailable. Download a copy."; }
    find("#menu-storage-status").textContent = storageMessage;
  }
  window.addEventListener("storage", event => {
    if (event.key !== storageKey && event.key !== null) return;
    try {
      const saved = event.newValue === null ? null : JSON.parse(event.newValue);
      if (saved !== null && (saved.version !== 1 || !Array.isArray(saved.entries))) throw new Error("Unrecognized saved day");
      const source = saved?.entries || [];
      entries = sanitizeEntries(source);
      storageMessage = entries.length === source.length
        ? "Updated from another tab."
        : "Some saved foods were unavailable.";
    } catch {
      entries = [];
      storageMessage = "Saved day could not be read.";
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
      find("#menu-input-status").textContent = "Invalid amount. Totals use the last valid value.";
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
      setMeasureFromGrams(entries[index]);
      const measureText = input.closest(".menu-item").querySelector(".menu-measure");
      if (measureText) measureText.textContent = entryMeasureText(entries[index]);
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
  function entryMeasureText(entry) { return entry.measureLabel ? `${entry.measureLabel} · ${gramsText(entry.grams)}` : gramsText(entry.grams); }
  function amount(summary) {
    if (summary.value === null) return "—";
    const precision = summary.unit === "kcal" ? 0 : summary.value >= 10 ? 0 : summary.value >= 1 ? 1 : 3;
    // Preserve a nonzero trace instead of rounding it down to a reported zero.
    const number = summary.value > 0 && summary.value < 0.001 ? String(Number(summary.value.toPrecision(2))) : String(Number(summary.value.toFixed(precision)));
    return `${summary.complete ? "" : "≥ "}${number}${summary.unit === "kcal" ? "" : ` ${summary.unit}`}`;
  }
  function coverage(summary) {
    return summary.total === 0 || summary.known === 0 || summary.complete ? "" : `${summary.known}/${summary.total} foods`;
  }
  function renderTotals() {
    const result = PantryNutrition.aggregateMenu(foods, entries);
    find("#day-serving").textContent = `${result.itemCount} ${result.itemCount === 1 ? "food" : "foods"} · ${Number(result.totalGrams.toFixed(2))} g`;
    find("#day-calories").textContent = amount(result.totals.calories);
    find("#day-calorie-coverage").textContent = coverage(result.totals.calories);
    find("#menu-nutrition-status").textContent = `${result.itemCount} foods, ${Number(result.totalGrams.toFixed(2))} grams. Daily calories: ${amount(result.totals.calories)}. ${coverage(result.totals.calories)}`;
    const sections = typeof nutrientSections !== "undefined" ? nutrientSections : [{ label: "Macronutrients", rows: nutrientRows.slice(0, 10) }, { label: "Vitamins & minerals", rows: nutrientRows.slice(10) }];
    find("#day-nutrients").innerHTML = sections.map(section => {
      const heading = `<div class="section-row"><dt>${escape(section.label)}</dt><dd></dd></div>`;
      const rows = section.rows.map(([key, label, , hasDV, indent]) => {
        const summary = result.totals[key];
        const daily = summary.complete && hasDV ? dvValue(key, summary.value) : "—";
        const note = coverage(summary);
        return `<div class="${indent ? "indent" : ""}"><dt>${indent ? escape(label) : `<b>${escape(label)}</b>`} ${amount(summary)}${note ? `<small class="coverage-note">${note}</small>` : ""}</dt><dd>${daily}</dd></div>`;
      }).join("");
      return heading + rows;
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
      const measure = entryMeasureText(entry);
      return `<li class="menu-item"><div><strong>${escape(food.name)}</strong><p>${escape([foodGroup(food),titleState(food.state)].filter(Boolean).join(" · "))}</p><small class="menu-measure">${escape(measure)}</small></div><label>Edible portion (g)<input type="number" min="0.01" max="${maxGrams}" step="any" value="${draft === undefined ? entry.grams : escape(draft)}" data-menu-grams="${index}" aria-label="Grams of ${escape(food.name)}" ${draft === undefined ? "" : 'aria-invalid="true"'} required></label><button type="button" class="remove-menu" data-remove="${index}" aria-label="Remove ${escape(food.name)}">Remove</button></li>`;
    }).join("");
    document.querySelectorAll("[data-menu-grams][aria-invalid=true]").forEach(input => updateRowError(input, true));
    find("#menu-empty").hidden = true;
    find("#menu-storage-status").hidden = entries.length === 0 && storageMessage.startsWith("Saved on this device");
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
    const { foodId, grams, measureId, amount: selectedAmount, measureLabel } = event.detail || {};
    if (!byId.has(foodId) || !Number.isFinite(grams) || grams <= 0 || grams > maxGrams) { showToast("Choose a valid food amount before adding it."); return; }
    const existing = entries.find(entry => entry.foodId === foodId);
    if (existing && existing.grams + grams > maxGrams) { showToast("That amount is too large. Review the grams in your day."); return; }
    if (!existing && entries.length >= 500) { showToast("Your day has reached the 500 food limit."); return; }
    checkpoint();
    const selectedMeasure = measureData(byId.get(foodId), measureId, selectedAmount, measureLabel);
    if (existing) {
      existing.grams += grams;
      if (selectedMeasure && selectedMeasure.measureId === existing.measureId) {
        existing.amount += selectedMeasure.amount;
        existing.measureLabel = describeMeasure(findMeasure(byId.get(foodId), existing.measureId), existing.amount, selectedMeasure.measureLabel);
      } else setMeasureFromGrams(existing);
    } else entries.push({ foodId, grams, ...(selectedMeasure || {}) });
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
      find("#menu-input-status").textContent = "Fix the invalid amount before downloading.";
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
