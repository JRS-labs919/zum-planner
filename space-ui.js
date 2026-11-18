"use strict";

function workflowSwitcherHTML(stage) {
  if (!["loads", "controllers"].includes(stage.id)) return "";
  const mode = state.designMode || "zum";
  return `<div class="space-workflow" role="group" aria-label="Design workflow">
    <span>Design workflow</span>
    <div class="space-mode-options">
      <button type="button" data-design-mode="zum" aria-pressed="${mode === "zum"}">Zūm configurator</button>
      <button type="button" data-design-mode="custom" aria-pressed="${mode === "custom"}">Custom</button>
    </div></div>`;
}

function groupedStageHTML(stage, records) {
  if (state.designMode === "custom" || !["loads", "controllers"].includes(stage.id)) return renderRecordTable(stage, records);
  const spaces = state.spaces || [];
  const visible = new Set(filteredRecords(records));
  const spaceIds = new Set(spaces.map(space => space.id));
  const groups = [];
  for (const space of spaces) {
    const rows = records.filter(record => record.spaceId === space.id && visible.has(record));
    if (searchTerm.trim() && !rows.length && !space.name.toLowerCase().includes(searchTerm.trim().toLowerCase())) continue;
    const id = escapeHTML(space.id);
    const otherStage = stage.id === "loads" ? "controllers" : "loads";
    const otherLabel = stage.id === "loads" ? "View controllers" : "View zones";
    const notes = stage.id === "controllers" ? rows.filter(row => row.assignmentDetail) : [];
    const primary = recordsFor("controllers").find(row => row.spaceId === space.id && row.assignmentRole === "primary");
    const unmanaged = recordsFor("controllers").filter(row => !row.spaceId && row.area === space.name).length;
    groups.push(`<section class="configured-space" tabindex="-1" id="configured-space-${id}">
      <header class="space-heading"><div><h4>${escapeHTML(space.name)}</h4>
        ${stage.id === "loads" ? `<p class="space-primary">Primary controller · ${escapeHTML(primary?.model || "REQUIRED INPUT")}</p>` : ""}</div>
        <div class="card-header-actions">
          <button type="button" class="ghost-button" data-space-edit="${id}">Edit space</button>
          <button type="button" class="ghost-button" data-space-jump="${id}" data-space-stage="${otherStage}">${otherLabel}</button>
          <button type="button" class="secondary-button" data-space-zone="${id}">${svgButtonLabel("plus", "Add zone")}</button>
        </div>
      </header>
      ${unmanaged ? `<p class="space-empty" role="note">Review ${unmanaged} separately entered controller record${unmanaged === 1 ? "" : "s"} for this area before totaling equipment.</p>` : ""}
      ${rows.length ? renderRecordTable(stage, rows) : `<p class="space-empty">${searchTerm.trim() ? "No matching records in this space." : stage.id === "loads" ? "Add the first lighting zone for this space." : "Configured controllers appear here as zones are added."}</p>`}
      ${notes.length ? `<ul class="space-assignment-notes">${notes.map(row => `<li><strong>${escapeHTML(row.name)}</strong> · ${escapeHTML(row.assignmentDetail)}</li>`).join("")}</ul>` : ""}
    </section>`);
  }
  const unassigned = records.filter(record => !spaceIds.has(record.spaceId) && visible.has(record));
  if (unassigned.length) groups.push(`<section class="configured-space"><header class="space-heading"><h4>Custom and unassigned</h4></header>${renderRecordTable(stage, unassigned)}</section>`);
  if (groups.length) return groups.join("");
  if (searchTerm.trim()) return '<div class="empty-state"><h3>No matching spaces or records</h3></div>';
  return `<div class="empty-state"><div class="empty-icon">${icon("area")}</div><h3>Create your first space</h3>
    <p>Group lighting zones and their controls by room or area.</p>
    <button class="primary-button" type="button" data-new-space>${svgButtonLabel("plus", "Add space")}</button></div>`;
}

function hasSpaceContents(spaceId) {
  if (state.takeoff.markups.some(mark => mark.type === "room" && mark.spaceId === spaceId)) return true;
  return Object.entries(state.records).some(([key, rows]) => rows.some(row =>
    row.spaceId === spaceId && (key !== "controllers" || !row.configured || row.zoneId)));
}

function openSpaceEditor(spaceId = null) {
  const spaces = state.spaces ||= [];
  const existing = spaces.find(space => space.id === spaceId);
  const existingNames = new Set(spaces.map(space => space.name.trim().toLowerCase()));
  let number = spaces.length + 1;
  while (existingNames.has(`space ${number}`)) number++;
  showModal(`${modalHeader(existing ? "Edit space" : "Add space", existing ? "Linked records use this space name." : "Name this room or area, then add its first lighting zone.")}
    <form id="space-form"><div class="modal-body">${fieldHTML({ key: "name", label: "Space name", required: true }, existing?.name || `Space ${number}`)}
    ${existing ? "" : `<datalist id="existing-space-areas">${[...new Set([...recordsFor("loads"), ...recordsFor("controllers")].filter(row => !row.spaceId && row.area).map(row => row.area))].sort().map(area => `<option value="${escapeHTML(area)}"></option>`).join("")}</datalist>
      <div class="space-adoption" id="space-adoption" hidden><label><input type="checkbox" id="adopt-space-zones"> <span></span></label></div>
      <p class="field-help" id="unmanaged-area-controllers" aria-live="polite"></p>`}</div>
    <footer class="modal-footer">${existing && !hasSpaceContents(existing.id) ? '<button type="button" id="remove-empty-space" class="danger-button">Remove empty space</button>' : ""}
    <button type="button" class="ghost-button" data-modal-close>Cancel</button>
    <button class="primary-button" type="submit">${existing ? "Save space" : "Save space and add zone"}</button></footer></form>`);
  const form = $("#space-form");
  const input = form.elements.namedItem("name");
  if (!existing) {
    input.setAttribute("list", "existing-space-areas");
    function updateAdoption() {
      const name = input.value.trim();
      const loads = recordsFor("loads").filter(row => !row.spaceId && row.area === name);
      const controllers = recordsFor("controllers").filter(row => !row.spaceId && row.area === name);
      $("#adopt-space-zones").checked = false;
      $("#space-adoption").hidden = !loads.length;
      $("#space-adoption span").textContent = `Include ${loads.length} existing zone record${loads.length === 1 ? "" : "s"} from this area.`;
      $("#unmanaged-area-controllers").textContent = controllers.length ? `${controllers.length} existing controller record(s) will stay separate. Review them alongside the configured controllers for duplicate equipment.` : "";
    }
    input.addEventListener("input", updateAdoption);
    updateAdoption();
  }
  input.addEventListener("input", () => input.setCustomValidity(""));
  input.focus();
  input.select();
  $("#remove-empty-space")?.addEventListener("click", () => confirmRemoveEmptySpace(existing));
  form.addEventListener("submit", event => {
    event.preventDefault();
    const name = input.value.trim();
    if (!name || spaces.some(space => space !== existing && space.name.trim().toLowerCase() === name.toLowerCase())) {
      input.setCustomValidity(name ? "A space with this name already exists." : "Enter a space name.");
      input.reportValidity();
      return;
    }
    if (existing) {
      existing.name = name;
      for (const mark of state.takeoff.markups) {
        if (mark.type === "room" && mark.spaceId === existing.id) mark.name = name;
      }
      for (const rows of Object.values(state.records)) {
        for (const row of rows) if (row.spaceId === existing.id) row.area = name;
      }
      syncConfiguredSpaces();
      saveState("Space renamed");
      closeModal();
      render();
      return;
    }
    const space = { id: newRecordId(), name };
    spaces.push(space);
    if ($("#adopt-space-zones")?.checked) {
      for (const row of recordsFor("loads")) if (!row.spaceId && row.area === name) row.spaceId = space.id;
    }
    syncConfiguredSpaces();
    saveState("Space added");
    closeModal();
    openZoneForSpace(space.id);
  });
}

function confirmRemoveEmptySpace(space) {
  if (!space || hasSpaceContents(space.id)) return;
  showModal(`${modalHeader("Remove empty space?", `Remove ${space.name} and its configured primary controller from the project?`)}
    <footer class="modal-footer"><button class="ghost-button" type="button" data-modal-close>Cancel</button>
    <button class="danger-button" type="button" id="confirm-remove-space">Remove space</button></footer>`);
  $("#confirm-remove-space").addEventListener("click", () => {
    if (hasSpaceContents(space.id)) return;
    state.spaces = state.spaces.filter(item => item.id !== space.id);
    syncConfiguredSpaces();
    saveState("Empty space removed");
    closeModal();
    render();
  });
}

function openZoneForSpace(spaceId) {
  if (!state.spaces?.some(space => space.id === spaceId)) return;
  state.currentView = "loads";
  searchTerm = "";
  saveState();
  render();
  openRecordModal(null, spaceId);
}

function openStageAdd() {
  if (state.designMode !== "custom" && ["loads", "controllers"].includes(currentStage().id)) openSpaceEditor();
  else openRecordModal();
}

function initSpaceEvents() {
  workspace.addEventListener("click", event => {
    const mode = event.target.closest("[data-design-mode]")?.dataset.designMode;
    if (mode === "custom" || mode === "zum") {
      if (mode === state.designMode) return;
      state.designMode = mode;
      searchTerm = "";
      if (mode === "zum") syncConfiguredSpaces();
      saveState("Design workflow saved");
      render();
      workspace.querySelector(`[data-design-mode="${mode}"]`)?.focus();
      return;
    }
    if (event.target.closest("[data-new-space]")) { openSpaceEditor(); return; }
    const edit = event.target.closest("[data-space-edit]");
    if (edit) { openSpaceEditor(edit.dataset.spaceEdit); return; }
    const jump = event.target.closest("[data-space-jump]");
    if (jump && ["loads", "controllers"].includes(jump.dataset.spaceStage)) {
      state.currentView = jump.dataset.spaceStage;
      searchTerm = "";
      saveState();
      render();
      document.getElementById(`configured-space-${jump.dataset.spaceJump}`)?.focus();
      return;
    }
    const zone = event.target.closest("[data-space-zone]");
    if (zone) openZoneForSpace(zone.dataset.spaceZone);
  });
}
