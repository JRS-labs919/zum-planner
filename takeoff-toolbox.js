"use strict";

const toolboxGroups = {
  fixture: "Fixtures", controller: "Load controllers", keypad: "Keypads", sensor: "Sensors",
  interface: "Interfaces", network: "Network equipment", accessory: "Accessories",
  buttons: "Buttons and faceplates", cable: "Cable", power: "Power supplies",
  service: "Software and services", unresolved: "Mappings to review"
};

function toolboxGroup(model, category) {
  if (/^ZUMLINK-BTN|^FP-G /.test(model)) return "buttons";
  if (/^CBL-/.test(model)) return "cable";
  if (/-PSU$|^CSA-PWS/.test(model)) return "power";
  if (/^SW-/.test(model)) return "service";
  return category;
}

function toolboxStageCategory(stageId, model) {
  if (stageId === "controllers") return "controller";
  if (stageId === "network") return "network";
  if (/-(?:IO|SIM|CCO)$/.test(model)) return "interface";
  if (stageId === "lineItems" || /^ZUMLINK-BTN/.test(model)) return "accessory";
  if (/^ZUM(?:LINK|MESH)-KP/.test(model)) return "keypad";
  return "sensor";
}

function toolboxParts() {
  const parts = new Map();
  const add = (model, category, stageName = "") => {
    const product = takeoffProduct(model);
    const canonical = product?.model || model;
    if (parts.has(canonical)) return;
    const name = product?.name || canonical;
    const mappedCategory = product?.category || category;
    const group = toolboxGroup(canonical, mappedCategory);
    parts.set(canonical, { model: canonical, name, category: mappedCategory, group,
      aliases: product?.aliases || [], evidence: product ? "Reviewed Crestron catalog mapping."
        : `Designer model list · ${stageName}. Product ratings require verification.` });
  };
  for (const product of window.CRESTRON_CATALOG?.products || []) add(product.model, product.category);
  for (const stage of STAGES) {
    const options = stage.fields.find(field => field.key === "model")?.options || [];
    for (const model of options) {
      if (model && model !== "Other") add(model, toolboxStageCategory(stage.id, model), stage.label);
    }
  }
  return Array.from(parts.values());
}

let toolboxModelsForStamps;
function toolboxStampLabel(entry) {
  if (!entry.model || (entry.tag && entry.tag !== entry.model)) return String(entry.tag || entry.name || "?").slice(0, 8);
  const codes = { controller: "C", network: "N", keypad: "K", sensor: "S", interface: "I", accessory: "A" };
  if (!toolboxModelsForStamps) toolboxModelsForStamps = toolboxParts().map(item => item.model).sort();
  const canonical = takeoffProduct(entry.model)?.model || entry.model;
  const index = toolboxModelsForStamps.indexOf(canonical);
  return entry.stampCode || (index === -1 ? entry.model.slice(-6) : `${codes[entry.category] || "P"}${index + 1}`);
}

function toolboxItems() {
  const saved = state.takeoff.catalog;
  const parts = toolboxParts();
  const items = saved.map(entry => ({
    ...entry, group: toolboxGroup(entry.model || "", entry.category), entryId: entry.id,
    aliases: takeoffProduct(entry.model)?.aliases || []
  }));
  for (const part of parts) {
    if (!items.some(entry => entry.model === part.model && entry.category === part.category
      && entry.verifiedMapping && (!entry.tag || entry.tag === entry.model))) items.push(part);
  }
  return items.sort((a, b) => (toolboxGroups[a.group] || "").localeCompare(toolboxGroups[b.group] || "")
    || String(a.tag || a.model || a.name).localeCompare(String(b.tag || b.model || b.name), undefined, {numeric:true}));
}

// Toolbox open state, search text, category and results scroll survive
// re-renders while the user stays on the takeoff view (reset in renderPlanTakeoff).
const toolboxUiState = { open: false, search: "", category: "", scrollTop: 0 };

function resetToolboxUiState() {
  Object.assign(toolboxUiState, { open: false, search: "", category: "", scrollTop: 0 });
}

// Most recently used catalog entries, front-inserted, at most 8.
function touchRecentCatalog(id) {
  if (!id) return;
  ensureTakeoffState();
  state.takeoff.recentCatalogIds = [id, ...state.takeoff.recentCatalogIds.filter(item => item !== id)].slice(0, 8);
}

function takeoffRecentStripHTML(activeId) {
  ensureTakeoffState();
  const chips = state.takeoff.recentCatalogIds.map(id => state.takeoff.catalog.find(entry => entry.id === id)).filter(Boolean).slice(0, 8).map(entry => {
    const label = toolboxStampLabel(entry);
    const text = entry.model || entry.tag || entry.name;
    const active = takeoffMode === "stamp" && entry.id === activeId;
    const description = `Place ${label} · ${text} · ${entry.name}`;
    return `<button type="button" class="tool-toggle recent-chip ${active ? "active" : ""}" data-recent-catalog="${escapeHTML(entry.id)}" aria-pressed="${active}" aria-label="${escapeHTML(description)}" title="${escapeHTML(description)}"><span class="markup-chip ${escapeHTML(entry.category)}">${escapeHTML(label)}</span><span class="recent-chip-text">${escapeHTML(text)}</span></button>`;
  });
  return `<div class="recent-strip" role="group" aria-label="Recent products"><span class="recent-strip-label">Recent</span>${chips.length ? chips.join("") : '<span class="field-help">Products you place appear here</span>'}</div>`;
}

function takeoffToolboxHTML(activeEntry) {
  return `<details id="takeoff-toolbox" class="component-toolbox" ${toolboxUiState.open ? "open" : ""}><summary>Component toolbox
    ${activeEntry && takeoffMode === "stamp" ? `<small>${escapeHTML(toolboxStampLabel(activeEntry))} · ${escapeHTML(activeEntry.model || activeEntry.tag)}</small>` : ""}
    </summary><div class="toolbox-body"><div class="toolbox-filters">
    <label>Search components<input type="search" id="takeoff-toolbox-search" placeholder="Model, fixture tag or function"></label>
    <label>Category<select id="takeoff-toolbox-category"><option value="">All categories</option>${Object.entries(toolboxGroups).sort((a,b) => a[1].localeCompare(b[1])).map(([key, name]) => `<option value="${key}">${name}</option>`).join("")}</select></label></div>
    <div id="takeoff-toolbox-results" class="toolbox-results"></div>
    <button type="button" class="text-button" id="toolbox-custom">Add fixture or custom mapping</button>
    </div></details>`;
}

function bindTakeoffToolbox() {
  const box = document.getElementById("takeoff-toolbox");
  if (!box) return;
  const items = toolboxItems();
  const search = box.querySelector("#takeoff-toolbox-search");
  const category = box.querySelector("#takeoff-toolbox-category");
  const results = box.querySelector("#takeoff-toolbox-results");
  function filter() {
    const terms = search.value.toLowerCase().trim().split(/\s+/);
    const groups = new Map();
    items.forEach((item, index) => {
      const groupName = toolboxGroups[item.group] || "Custom mappings";
      const product = takeoffProduct(item.model);
      const text = [item.model, item.name, item.tag, item.category, groupName, product?.role,
        item.category === "controller" && controllerTraits(item.model).loadCapability,
        ...(item.aliases || [])].filter(Boolean).join(" ").toLowerCase();
      if ((category.value && category.value !== item.group) || !terms.every(term => text.includes(term))) return;
      if (!groups.has(groupName)) groups.set(groupName, []);
      groups.get(groupName).push(`<button type="button" data-toolbox-index="${index}"
        ${item.model ? `data-toolbox-model="${escapeHTML(item.model)}"` : ""}
        ${item.entryId ? `data-toolbox-entry="${escapeHTML(item.entryId)}"` : ""}>
        <strong>${escapeHTML(item.tag || item.model || item.name)}</strong>
        ${item.name !== (item.tag || item.model) ? `<small>${escapeHTML(item.name)}</small>` : ""}</button>`);
    });
    results.innerHTML = groups.size ? Array.from(groups, ([name, buttons]) =>
      `<section><h4>${name}</h4><div>${buttons.join("")}</div></section>`).join("") : "<p>No matching components.</p>";
  }
  search.value = toolboxUiState.search;
  category.value = toolboxUiState.category;
  box.addEventListener("toggle", () => { toolboxUiState.open = box.open; });
  results.addEventListener("scroll", () => { toolboxUiState.scrollTop = results.scrollTop; });
  search.addEventListener("input", () => { toolboxUiState.search = search.value; filter(); });
  category.addEventListener("change", () => { toolboxUiState.category = category.value; filter(); });
  box.querySelector("#toolbox-custom").addEventListener("click", () => openTakeoffCatalogEditor());
  results.addEventListener("click", event => {
    const button = event.target.closest("[data-toolbox-index]");
    if (!button) return;
    const item = items[Number(button.dataset.toolboxIndex)];
    let entry = state.takeoff.catalog.find(row => row.id === item.entryId);
    if (!entry) {
      entry = { id: newRecordId(), model: item.model, tag: item.model, category: item.category,
        name: item.name, verifiedMapping: true, evidence: item.evidence, controlType: "", voltage: "", watts: "" };
      if (entry.category === "controller") entry.networkRole = controllerTraits(entry.model).networkRole;
      state.takeoff.catalog.push(entry);
      entry.stampCode = toolboxStampLabel(entry);
      saveState("Component mapping added");
    }
    toolboxUiState.open = box.open;
    takeoffActiveCatalogId = entry.id;
    touchRecentCatalog(entry.id);
    saveState("Component selected");
    takeoffLabelPreview = null;
    takeoffCalibrationPoint = null;
    takeoffRoomDrag = takeoffPolylineDraft = takeoffWireDraft = null;
    takeoffMode = "stamp";
    window.renderPlanTakeoff();
    document.querySelector("#takeoff-toolbox summary")?.focus({preventScroll:true});
  });
  filter();
  results.scrollTop = toolboxUiState.scrollTop;
}
