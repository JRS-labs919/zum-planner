"use strict";

let takeoffPdf = null;
let takeoffRenderTask = null;
let renderedSheet = null;
let takeoffMode = "select";
let takeoffZoom = 1;
let takeoffRoomDrag = null;
let takeoffPolylineDraft = null;
let takeoffCalibrationPoint = null;
let takeoffActiveCatalogId = "";

let takeoffDocumentOwner = null;
let takeoffUploadToken = 0;
let takeoffLabelPreview = null;

// Plan wiring (takeoff-wiring.js holds the pure derivation and SVG builders).
let takeoffWireDraft = null;
let takeoffWireType = "";
let planWiringVisible = true;
let planWireCache = null;
let planWireSelectedId = "";
let planWirePointer = null;
let planWiringPanelRendered = "";
let planSheetSize = { width: 1000, height: 773 };

function ensureTakeoffState() {
  state.takeoff ||= {};
  state.takeoff.document ||= null;
  state.takeoff.activePage ||= 1;
  state.takeoff.scale ||= null;
  state.takeoff.markups ||= [];
  state.takeoff.catalog ||= [];
  state.takeoff.analysis ||= null;
  state.takeoff.lastSyncAt ||= null;
  state.takeoff.recentCatalogIds ||= [];
}

window.renderPlanTakeoff = function renderPlanTakeoff() {
  ensureTakeoffState();
  // Coming from another view: toolbox state and any wire draft start fresh.
  if (!document.getElementById("takeoff-toolbox")) { resetToolboxUiState(); takeoffWireDraft = null; }
  const documentInfo = state.takeoff.document;
  const marks = state.takeoff.markups;
  const roomCount = marks.filter(mark => mark.type === "room").length;
  const stampCount = marks.filter(mark => mark.type === "stamp").reduce((sum, mark) => sum + Number(mark.quantity || 1), 0);
  const attached = Boolean(takeoffPdf && takeoffDocumentOwner === state.takeoff.document);
  const scroll = $("#plan-scroll");
  const reuseSheet = attached && scroll && renderedSheet?.element === scroll &&
    renderedSheet.pdf === takeoffPdf && renderedSheet.page === state.takeoff.activePage &&
    renderedSheet.zoom === takeoffZoom && renderedSheet.width === scroll.clientWidth;
  const offset = reuseSheet && { left: scroll.scrollLeft, top: scroll.scrollTop };
  const syncStatus = state.takeoff.lastSyncAt ? `Last populated ${new Date(state.takeoff.lastSyncAt).toLocaleString()}` : "Not yet populated";

  workspace.innerHTML = `
    <div class="page-heading takeoff-heading">
      <div class="page-heading-copy">
        <p class="kicker">Construction-document intake</p>
        <h2>Plan markup &amp; automated takeoff</h2>
        <p>Attach an electrical PDF, select the lighting-plan sheet, draw space boundaries, stamp mapped symbols, and populate the Zūm designer with traceable records.</p>
      </div>
      <div class="takeoff-heading-actions">
        <input class="hidden" id="takeoff-file-input" type="file" accept="application/pdf,.pdf" />
        <button class="secondary-button" id="takeoff-upload" type="button">${svgButtonLabel("upload", documentInfo ? "Reattach PDF" : "Attach CD PDF")}</button>
        <button class="primary-button" id="takeoff-sync" type="button" ${marks.length || state.takeoff.lastSyncAt ? "" : "disabled"}>${svgButtonLabel("arrow", "Populate designer")}</button>
      </div>
    </div>
    <div class="metric-grid takeoff-metrics">
      <article class="metric-card"><p class="metric-label">${icon("file")} Drawing set</p><p class="metric-value">${documentInfo ? escapeHTML(documentInfo.pageCount || "—") : "0"}</p><p class="metric-note">${documentInfo ? `${escapeHTML(documentInfo.name)} · ${attached ? "Attached" : "Reattach to render"}` : "No PDF attached"}</p></article>
      <article class="metric-card"><p class="metric-label">${icon("area")} Defined spaces</p><p class="metric-value">${roomCount}</p><p class="metric-note">Spatial containers for assignment</p></article>
      <article class="metric-card"><p class="metric-label">${icon("layers")} Counted symbols</p><p class="metric-value">${stampCount}</p><p class="metric-note">Quantity-adjusted plan marks</p></article>
      <article class="metric-card"><p class="metric-label">${icon("check")} Designer sync</p><p class="metric-value">${state.takeoff.lastSyncAt ? "Ready" : "Pending"}</p><p class="metric-note">${escapeHTML(syncStatus)}</p></article>
    </div>
    ${documentInfo ? takeoffWorkspaceHTML(attached) : takeoffEmptyHTML()}`;

  bindTakeoffEvents();
  if (reuseSheet) {
    $("#plan-scroll").replaceWith(scroll);
    scroll.scrollTo(offset.left, offset.top);
    const bounds = $("#takeoff-overlay").viewBox.baseVal;
    renderTakeoffOverlay(bounds.width, bounds.height);
  } else if (attached) {
    renderTakeoffPdfPage();
  }
  if ($("#plan-stage")) $("#plan-stage").style.touchAction = takeoffMode === "select" ? "pan-x pan-y" : "none";
};

function takeoffEmptyHTML() {
  return `<section class="content-card takeoff-empty">
    <div class="empty-state">
      <div class="empty-icon">${icon("layers")}</div>
      <h3>Start with the electrical CD set</h3>
      <p>PDF bytes stay in this browser session. Markups, mappings, and source references are saved locally; reopen the same PDF to continue after a browser restart.</p>
      <button class="primary-button" type="button" id="takeoff-empty-upload">${svgButtonLabel("upload", "Choose PDF")}</button>
    </div>
    <div class="takeoff-flow">
      <div><span>1</span><strong>Attach &amp; scan</strong><small>Find sheets, fixture tags, and Crestron models.</small></div>
      <div><span>2</span><strong>Outline spaces</strong><small>Create spatial areas on the plan.</small></div>
      <div><span>3</span><strong>Stamp symbols</strong><small>Count mapped fixtures and devices.</small></div>
      <div><span>4</span><strong>Populate</strong><small>Create designer records with source traceability.</small></div>
    </div>
  </section>`;
}

function takeoffWorkspaceHTML(attached) {
  const pages = state.takeoff.analysis?.pages || Array.from({ length: state.takeoff.document?.pageCount || 1 }, (_, index) => ({ page: index + 1, sheet: "", title: "" }));
  const activePage = Number(state.takeoff.activePage || 1);
  const catalog = state.takeoff.catalog;
  if (!catalog.some(entry => entry.id === takeoffActiveCatalogId) && catalog.length) takeoffActiveCatalogId = catalog[0].id;
  const activeEntry = catalog.find(entry => entry.id === takeoffActiveCatalogId) || catalog[0];
  const pageMarks = state.takeoff.markups.filter(mark => Number(mark.page) === activePage);
  const preview = activeLabelPreview();
  const groups = groupedTakeoffCounts(activePage);
  const stampsOnPage = pageMarks.filter(mark => mark.type === "stamp");
  const markCount = pageMarks.filter(mark => mark.type !== "wire").length;
  const wiringPanel = planWiringPanelHTML(derivedPlanWires(activePage, planSheetSize.width, planSheetSize.height), pageMarks);
  planWiringPanelRendered = wiringPanel;

  return `<section class="takeoff-shell content-card">
    <div class="takeoff-toolbar">
      <div class="takeoff-page-controls">
        <label>Sheet<select id="takeoff-page" ${attached ? "" : "disabled"}>${pages.map(page => `<option value="${page.page}" ${page.page === activePage ? "selected" : ""}>${escapeHTML(`p.${page.page}${page.sheet ? ` · ${page.sheet}` : ""}${page.title ? ` · ${page.title}` : ""}`)}</option>`).join("")}</select></label>
        <button class="icon-button" id="takeoff-zoom-out" type="button" aria-label="Zoom out">−</button>
        <span class="zoom-readout">${Math.round(takeoffZoom * 100)}%</span>
        <button class="icon-button" id="takeoff-zoom-in" type="button" aria-label="Zoom in">+</button>
        ${state.takeoff.analysis?.suggestedPage ? `<span class="pill blue">Suggested plan: p.${state.takeoff.analysis.suggestedPage}</span>` : ""}
      </div>
      <div class="takeoff-status">${attached ? "PDF attached for this session" : "PDF metadata loaded — reattach the source file to render"}</div>
    </div>
    <div class="takeoff-layout">
      <div class="takeoff-main">
        <div class="takeoff-tools" role="toolbar" aria-label="Plan markup tools">
          ${takeoffToolButton("select", "controls", "Select")}
          ${takeoffToolButton("room", "area", "Rectangle space")}
          ${takeoffToolButton("polyline", "link", "Polyline space")}
          ${takeoffToolButton("stamp", "plus", "Place component")}
          ${takeoffToolButton("wire", typeof icons !== "undefined" && icons.wire ? "wire" : "link", "Draw wire")}
          ${takeoffToolButton("calibrate", "link", "Calibrate")}
          <button class="secondary-button" id="takeoff-find-tags" type="button" ${attached && pageMarks.some(mark => mark.type === "room") ? "" : "disabled"}>Find fixture tags in spaces</button>
          <span class="takeoff-tools-end" role="group" aria-label="Wiring and undo">
            <button class="tool-toggle ${planWiringVisible ? "active" : ""}" type="button" id="takeoff-show-wiring" aria-pressed="${planWiringVisible}" aria-label="Show wiring">${icon("layers")}<span>Show wiring</span></button>
            <button class="secondary-button" id="takeoff-undo-mark" type="button" aria-keyshortcuts="Control+Z Meta+Z" title="${stampsOnPage.length ? "Undo last mark (Ctrl+Z)" : "No marks on this sheet"}" ${stampsOnPage.length ? "" : "disabled"}>Undo last mark</button>
          </span>
        </div>
        <div class="takeoff-mode-slot">
        ${takeoffMode === "polyline" ? `<div class="space-draft-tools" aria-label="Polyline controls"><span id="takeoff-point-count" aria-live="polite">${spaceDraftPoints().length} vertices</span><button type="button" class="secondary-button" id="takeoff-undo-point" ${spaceDraftPoints().length ? "" : "disabled"}>Undo point</button><button type="button" class="primary-button" id="takeoff-finish-space" ${spaceDraftPoints().length < 3 ? "disabled" : ""}>Finish space</button><button type="button" class="ghost-button" id="takeoff-cancel-space">Cancel</button></div>` : ""}
        ${takeoffMode === "wire" ? takeoffWireDraftRowHTML(activePage) : ""}
        ${takeoffMode === "wire" || takeoffMode === "polyline" ? "" : `<p class="takeoff-help" id="takeoff-help">${takeoffHelpText()}</p>`}
        </div>
        ${attached ? takeoffRecentStripHTML(takeoffActiveCatalogId) : ""}
        ${takeoffToolboxHTML(activeEntry)}
        <div class="plan-scroll" id="plan-scroll">
          ${attached ? `<div class="plan-stage" id="plan-stage"><canvas id="takeoff-pdf-canvas"></canvas><svg id="takeoff-overlay" aria-label="Plan markup overlay"></svg></div>` : `<div class="plan-reattach"><div>${icon("file")}</div><h3>Reattach ${escapeHTML(state.takeoff.document?.name || "the PDF")}</h3><p>For privacy and browser storage limits, the original PDF is not saved in localStorage.</p><button class="primary-button" id="takeoff-reattach" type="button">Choose source PDF</button></div>`}
        </div>
        ${takeoffMode === "wire" || takeoffMode === "polyline" ? `<p class="takeoff-help" id="takeoff-help">${takeoffHelpText()}</p>` : ""}
      </div>
      <aside class="takeoff-panel">
        <div class="panel-section">
          <div class="panel-section-header"><div><p class="kicker">Active mapping</p><h3>${activeEntry ? escapeHTML(activeEntry.tag || activeEntry.name) : "No mapping"}</h3></div><button class="row-action" id="takeoff-add-mapping" type="button" aria-label="Add mapping">${icon("plus")}</button></div>
          ${catalog.length ? "" : `<p class="field-help">Scan the PDF or add a mapping before stamping.</p>`}
          ${activeEntry ? `<div class="mapping-card"><span class="markup-chip ${escapeHTML(activeEntry.category)}">${escapeHTML(activeEntry.category)}</span><strong>${escapeHTML(activeEntry.name)}</strong><small>${escapeHTML(activeEntry.model || activeEntry.controlType || "Designer mapping pending")}</small>${mappingEvidenceHTML(activeEntry)}<button class="text-button" id="takeoff-edit-mapping" type="button">Edit mapping</button></div>` : ""}
        </div>
        ${preview ? labelPreviewHTML(preview) : ""}
        <div class="panel-section">
          <p class="kicker">Sheet takeoff</p><h3>${markCount} mark${markCount === 1 ? "" : "s"} on this page</h3>
          <div class="takeoff-counts">${groups.length ? groups.map(group => `<button type="button" data-edit-catalog="${group.catalogId}"><span class="markup-chip ${escapeHTML(group.category)}">${escapeHTML(group.tag || group.category)}</span><strong>${group.quantity}</strong><small>${escapeHTML(group.name)}</small></button>`).join("") : '<p class="field-help">Stamped quantities will appear here.</p>'}</div>
        </div>
        ${wiringPanel}
        <div class="panel-section">
          <p class="kicker">Source &amp; scale</p>
          <dl class="takeoff-source"><dt>File</dt><dd>${escapeHTML(state.takeoff.document?.name || "—")}</dd><dt>Page</dt><dd>${activePage}</dd><dt>Scale</dt><dd>${state.takeoff.scale ? `${Number(state.takeoff.scale.distanceFeet).toLocaleString()} ft calibration` : "Not calibrated"}</dd></dl>
          <button class="secondary-button full-button" id="takeoff-review-marks" type="button">Review all markups</button>
        </div>
      </aside>
    </div>
  </section>`;
}

function takeoffToolButton(mode, iconName, label) {
  return `<button class="tool-toggle ${takeoffMode === mode ? "active" : ""}" type="button" aria-label="${label}" aria-pressed="${takeoffMode === mode}" data-takeoff-mode="${mode}">${icon(iconName)}<span>${label}</span></button>`;
}

function takeoffHelpText() {
  const active = state.takeoff.catalog.find(entry => entry.id === takeoffActiveCatalogId);
  const messages = {
    select: "Select mode: click a mark or a drawn wire to review or edit it. Ctrl+Z undoes the last mark.",
    room: "Drag across opposite corners of the space, then enter its name. Esc returns to Select.",
    polyline: "Tap each corner in order. Choose Finish space to close the boundary. Ctrl+Z removes the last point. Esc cancels.",
    stamp: active
      ? `Placing ${toolboxStampLabel(active)} · ${active.model || active.tag || active.name}. Click each matching symbol on the plan. Ctrl+Z undoes the last mark. Esc stops placing.`
      : "Stamp symbol: pick a product from Recent or the Component toolbox, then click each matching symbol on the plan. Esc returns to Select.",
    wire: "Draw wire: click a device to start, click empty plan to add bends, click another device to finish. Ctrl+Z removes the last point. Esc cancels.",
    calibrate: "Calibrate: click two known points and enter their real-world distance. Esc cancels."
  };
  return escapeHTML(messages[takeoffMode]);
}

function bindTakeoffEvents() {
  bindTakeoffToolbox();
  $("#takeoff-show-wiring")?.addEventListener("click", () => {
    planWiringVisible = !planWiringVisible;
    if (!planWiringVisible) takeoffWireDraft = null;
    window.renderPlanTakeoff();
  });
  $("#takeoff-undo-mark")?.addEventListener("click", undoLastTakeoffMark);
  $("#takeoff-wire-type")?.addEventListener("change", event => { takeoffWireType = event.target.value; refreshPlanWireDraft(); });
  $("#takeoff-wire-undo-point")?.addEventListener("click", () => { const draft = wireDraft(); if (draft && draft.points.length > 1) draft.points.pop(); refreshPlanWireDraft(); });
  $("#takeoff-wire-cancel")?.addEventListener("click", () => cancelPlanWireDraft());
  document.querySelectorAll("[data-recent-catalog]").forEach(button => button.addEventListener("click", () => {
    const id = button.dataset.recentCatalog;
    cancelPlanWireDraft();
    takeoffActiveCatalogId = id;
    takeoffLabelPreview = null;
    takeoffCalibrationPoint = null;
    takeoffRoomDrag = takeoffPolylineDraft = null;
    takeoffMode = "stamp";
    window.renderPlanTakeoff();
    document.querySelector(`[data-recent-catalog="${CSS.escape(id)}"]`)?.focus({ preventScroll: true });
  }));
  $("#takeoff-undo-point")?.addEventListener("click", () => { spaceDraftPoints().pop(); refreshSpaceDraft(); });
  $("#takeoff-finish-space")?.addEventListener("click", finishSpaceDraft);
  $("#takeoff-cancel-space")?.addEventListener("click", () => {
    takeoffPolylineDraft = null;
    takeoffMode = "select";
    window.renderPlanTakeoff();
  });
  const fileInput = $("#takeoff-file-input");
  const triggerUpload = () => fileInput?.click();
  $("#takeoff-upload")?.addEventListener("click", triggerUpload);
  $("#takeoff-empty-upload")?.addEventListener("click", triggerUpload);
  $("#takeoff-reattach")?.addEventListener("click", triggerUpload);
  fileInput?.addEventListener("change", event => attachTakeoffPdf(event.target.files?.[0]));
  $("#takeoff-find-tags")?.addEventListener("click", previewRoomFixtureLabels);
  $("#takeoff-cancel-tags")?.addEventListener("click", () => { takeoffLabelPreview = null; window.renderPlanTakeoff(); });
  $("#takeoff-accept-tags")?.addEventListener("click", acceptRoomFixtureLabels);
  document.querySelectorAll("[data-preview-tag]").forEach(input => input.addEventListener("change", () => {
    const candidate = activeLabelPreview()?.candidates[Number(input.dataset.previewTag)];
    if (!candidate) return;
    candidate.selected = input.checked;
    const marker = document.getElementById(`takeoff-preview-${input.dataset.previewTag}`);
    if (marker) marker.style.opacity = input.checked ? "1" : ".25";
  }));
  $("#takeoff-sync")?.addEventListener("click", populateDesignerFromTakeoff);
  $("#takeoff-page")?.addEventListener("change", event => {
    takeoffRoomDrag = takeoffPolylineDraft = takeoffWireDraft = null;
    takeoffLabelPreview = null;
    state.takeoff.activePage = Number(event.target.value);
    saveState("Sheet changed");
    window.renderPlanTakeoff();
  });
  $("#takeoff-zoom-in")?.addEventListener("click", () => { takeoffZoom = Math.min(3, takeoffZoom + 0.25); window.renderPlanTakeoff(); });
  $("#takeoff-zoom-out")?.addEventListener("click", () => { takeoffZoom = Math.max(0.5, takeoffZoom - 0.25); window.renderPlanTakeoff(); });
  document.querySelectorAll("[data-takeoff-mode]").forEach(button => button.addEventListener("click", () => {
    if (takeoffMode !== button.dataset.takeoffMode) takeoffRoomDrag = takeoffPolylineDraft = takeoffWireDraft = null;
    takeoffLabelPreview = null;
    takeoffMode = button.dataset.takeoffMode;
    if (takeoffMode === "wire") planWiringVisible = true;
    takeoffCalibrationPoint = null;
    window.renderPlanTakeoff();
    if (takeoffMode === "stamp") {
      document.getElementById("takeoff-toolbox").open = true;
      document.getElementById("takeoff-toolbox-search").focus();
    }
  }));
  $("#takeoff-add-mapping")?.addEventListener("click", () => openTakeoffCatalogEditor());
  $("#takeoff-edit-mapping")?.addEventListener("click", () => openTakeoffCatalogEditor(takeoffActiveCatalogId));
  $("#takeoff-review-marks")?.addEventListener("click", openTakeoffMarkupReview);
  document.querySelectorAll("[data-edit-catalog]").forEach(button => button.addEventListener("click", () => {
    takeoffActiveCatalogId = button.dataset.editCatalog;
    touchRecentCatalog(takeoffActiveCatalogId);
    saveState("Component selected");
    openTakeoffCatalogEditor(takeoffActiveCatalogId);
  }));
}

async function attachTakeoffPdf(file) {
  if (!file) return;
  if (file.type && file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    showToast("Choose a PDF construction-document set");
    return;
  }
  const owner = state.takeoff;
  const token = ++takeoffUploadToken;
  try {
    showToast("Opening and scanning the drawing set…");
    const pdfjs = await import("./vendor/pdf.min.mjs");
    pdfjs.GlobalWorkerOptions.workerSrc = new URL("./vendor/pdf.worker.min.mjs", window.location.href).href;
    const bytes = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data: bytes }).promise;
    const fingerprint = pdf.fingerprints?.[0];
    const previous = owner.document;
    if (previous && (previous.fingerprint ? previous.fingerprint !== fingerprint : previous.name !== file.name || previous.size !== file.size || (previous.lastModified && previous.lastModified !== file.lastModified))) {
      await pdf.destroy();
      showToast("Choose the original PDF, or clear this takeoff before starting a different drawing set.");
      return;
    }
    const analysis = await analyzeTakeoffPdf(pdf);
    if (owner !== state.takeoff || token !== takeoffUploadToken) { await pdf.destroy(); return; }
    takeoffPdf = pdf;
    owner.document = { name: file.name, size: file.size, lastModified: file.lastModified, pageCount: pdf.numPages, fingerprint };
    takeoffDocumentOwner = owner.document;
    owner.activePage = previous ? Math.min(Number(owner.activePage || 1), pdf.numPages) : analysis.suggestedPage;
    owner.analysis = analysis;
    mergeDetectedCatalog(state.takeoff.analysis);
    saveState("Drawing set scanned");
    window.renderPlanTakeoff();
    showToast(`${takeoffPdf.numPages} sheets scanned`);
  } catch (error) {
    console.error(error);
    showToast(`Unable to open PDF: ${error.message}`);
  }
}

async function analyzeTakeoffPdf(pdf) {
  const pages = [];
  const models = new Set();
  const catalogTokens = new Set((window.CRESTRON_CATALOG?.products || []).flatMap(product => [product.model, ...(product.aliases || [])]).map(token => token.toUpperCase()));
  const fixtures = new Set();
  const occurrences = {};
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const text = content.items.map(item => item.str).join(" ").replace(/\s+/g, " ");
    const normalizedText = text.replace(/\s*-\s*/g, "-");
    const sheetMatches = [...normalizedText.matchAll(/\bE(?:\d+\.\d{1,2}|\d{3})\b/gi)].map(match => match[0]);
    const sheet = sheetMatches[0] || "";
    const title = inferDrawingTitle(text);
    const kind = /FLOOR PLANS?\s*-?\s*LIGHTING|NEW WORK\s*-?\s*LIGHTING/i.test(text) ? "lighting-plan" : /LIGHT FIXTURE SCHEDULE|ELECTRICAL SCHEDULES/i.test(text) ? "schedule" : /POWER/i.test(title) ? "power" : "reference";
    function note(token, collection) {
      collection.add(token);
      const locations = occurrences[token] ||= [];
      if (!locations.includes(pageNumber)) locations.push(pageNumber);
    }
    for (const match of normalizedText.toUpperCase().matchAll(/\b(?:ZUM(?:LINK|MESH|NET)?|GLA|GLS)-[A-Z0-9]+(?:-[A-Z0-9]+)*\b/g)) note(match[0], models);
    for (const match of normalizedText.toUpperCase().matchAll(/\b[A-Z0-9]+(?:-[A-Z0-9]+)+\b/g)) {
      if (catalogTokens.has(match[0])) note(match[0], models);
    }
    if (/LIGHT(?:ING)? FIXTURE SCHEDULE|LUMINAIRE SCHEDULE/i.test(text)) {
      for (const match of text.toUpperCase().matchAll(/\bL[0-9]+[A-Z]?\b/g)) note(match[0], fixtures);
    }
    pages.push({ page: pageNumber, sheet, title, kind });
  }
  const suggestedPage = pages.find(page => page.kind === "lighting-plan" && /NEW WORK/i.test(page.title))?.page || pages.find(page => page.kind === "lighting-plan")?.page || 1;
  return { pages, occurrences, models: [...models].sort(), fixtures: [...fixtures].sort(naturalTagSort), suggestedPage, scannedAt: new Date().toISOString() };
}

function inferDrawingTitle(text) {
  const candidates = [
    "ELECTRICAL FLOOR PLANS - NEW WORK - LIGHTING",
    "ELECTRICAL FLOOR PLANS - LIGHTING",
    "ELECTRICAL FLOOR PLANS - NEW WORK - POWER",
    "ELECTRICAL FLOOR PLANS - POWER",
    "ELECTRICAL FIRST FLOOR PLAN - DEMOLITION - LIGHTING",
    "ELECTRICAL FIRST FLOOR PLAN - DEMOLITION - POWER",
    "ELECTRICAL SCHEDULES",
    "ELECTRICAL SPECIFICATIONS",
    "ELECTRICAL"
  ];
  return candidates.find(candidate => text.toUpperCase().includes(candidate)) || "Drawing sheet";
}

function naturalTagSort(a, b) {
  return Number(a.replace(/\D/g, "")) - Number(b.replace(/\D/g, ""));
}

function takeoffProduct(model) {
  const token = String(model || "").trim().toUpperCase();
  return window.CRESTRON_CATALOG?.products.find(product => [product.model, ...(product.aliases || [])].some(alias => String(alias).toUpperCase() === token));
}

function mergeDetectedCatalog(analysis) {
  for (const tag of [...analysis.fixtures, ...analysis.models]) {
    if (state.takeoff.catalog.some(entry => entry.detectedTag === tag || entry.tag === tag || entry.model === tag)) continue;
    const isFixture = analysis.fixtures.includes(tag);
    const product = isFixture ? null : takeoffProduct(tag);
    state.takeoff.catalog.push({
      id: newRecordId(), tag, detectedTag: tag, name: product?.name || (isFixture ? `Fixture ${tag}` : tag),
      model: isFixture ? "" : tag, category: isFixture ? "fixture" : takeoffCategory(product),
      verifiedMapping: Boolean(product || isFixture), watts: "", voltage: "", controlType: ""
    });
  }
  takeoffActiveCatalogId = state.takeoff.catalog[0]?.id || "";
}

function takeoffCategory(product) {
  const category = product?.category?.toLowerCase();
  return ["controller", "keypad", "sensor", "network", "interface", "accessory", "fixture"].includes(category) ? category : "unresolved";
}

function mappingEvidenceHTML(entry) {
  const product = takeoffProduct(entry.model);
  const pages = state.takeoff.analysis?.occurrences?.[entry.detectedTag || entry.tag] || [];
  const details = [pages.length && `Drawing pages ${pages.join(", ")}`, product?.role, product?.connection, product?.rating, ...(product?.gaps || []), entry.evidence].filter(Boolean);
  const sources = (product?.sources || []).map(source => {
    const label = escapeHTML([source.file, source.section, source.page && `p. ${source.page}`].filter(Boolean).join(" · ") || source.label);
    return source.url ? `<a href="${escapeHTML(source.url)}" target="_blank" rel="noopener">${label}</a>` : label;
  });
  if (!entry.verifiedMapping || entry.category === "unresolved") details.unshift("Review and save this mapping before populating the designer.");
  return [...details.map(detail => escapeHTML(detail)), ...sources].map(html => `<small>${html}</small>`).join("");
}

async function renderTakeoffPdfPage() {
  if (!takeoffPdf || takeoffDocumentOwner !== state.takeoff.document || state.currentView !== "takeoff") return;
  const canvas = $("#takeoff-pdf-canvas");
  const overlay = $("#takeoff-overlay");
  const stage = $("#plan-stage");
  if (!canvas || !overlay || !stage) return;
  try {
    if (takeoffRenderTask) takeoffRenderTask.cancel();
    const page = await takeoffPdf.getPage(Number(state.takeoff.activePage || 1));
    const base = page.getViewport({ scale: 1 });
    if (!canvas.isConnected) return;
    const available = Math.max(1, Math.min(1240, $("#plan-scroll").clientWidth - 28));
    const displayScale = (available / base.width) * takeoffZoom;
    const viewport = page.getViewport({ scale: displayScale });
    const outputScale = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(viewport.width * outputScale);
    canvas.height = Math.floor(viewport.height * outputScale);
    canvas.style.width = `${viewport.width}px`;
    canvas.style.height = `${viewport.height}px`;
    stage.style.width = `${viewport.width}px`;
    stage.style.height = `${viewport.height}px`;
    overlay.setAttribute("viewBox", `0 0 ${viewport.width} ${viewport.height}`);
    overlay.setAttribute("width", viewport.width);
    overlay.setAttribute("height", viewport.height);
    const context = canvas.getContext("2d", { alpha: false });
    takeoffRenderTask = page.render({ canvasContext: context, viewport, transform: outputScale === 1 ? null : [outputScale, 0, 0, outputScale, 0, 0] });
    const task = takeoffRenderTask;
    await task.promise;
    if (task !== takeoffRenderTask || !canvas.isConnected) return;
    takeoffRenderTask = null;
    const element = $("#plan-scroll");
    renderedSheet = { element, pdf: takeoffPdf, page: state.takeoff.activePage, zoom: takeoffZoom, width: element.clientWidth };
    renderTakeoffOverlay(viewport.width, viewport.height);
    bindOverlayEvents();
  } catch (error) {
    if (error?.name !== "RenderingCancelledException") console.error(error);
  }
}

function activeLabelPreview() {
  return takeoffLabelPreview?.owner === state.takeoff && takeoffLabelPreview.page === Number(state.takeoff.activePage) ? takeoffLabelPreview : null;
}

function fixtureLabelCandidates(content, viewport, page, catalog, marks) {
  const boundaries = orderedSpaceBoundaries(marks, page);
  const stamps = marks.filter(mark => mark.type === "stamp" && Number(mark.page) === page);
  const tags = new Map();
  for (const entry of catalog.filter(item => item.category === "fixture")) {
    const tag = entry.tag?.trim().toUpperCase();
    if (tag) tags.set(tag, tags.has(tag) ? null : entry);
  }
  const candidates = [];
  let duplicates = 0;
  for (const item of content.items) {
    const entry = tags.get(item.str?.trim().toUpperCase());
    if (!entry || !item.transform) continue;
    const [a, b, , , tx, ty] = item.transform;
    const length = Math.hypot(a, b);
    if (!length) continue;
    const center = viewport.convertToViewportPoint(tx + (a * item.width - b * item.height) / (2 * length), ty + (b * item.width + a * item.height) / (2 * length));
    const x = center[0] / viewport.width, y = center[1] / viewport.height;
    const room = boundaries.find(boundary => spaceContainsPoint(boundary, x, y));
    if (!room) continue;
    const nearby = mark => mark.catalogId === entry.id && Math.hypot((mark.x - x) * viewport.width, (mark.y - y) * viewport.height) <= Math.max(2, item.height * 0.7);
    if (stamps.some(nearby) || candidates.some(nearby)) { duplicates++; continue; }
    candidates.push({ x, y, catalogId: entry.id, tag: entry.tag, room: room.name, page, selected: true });
  }
  return { candidates, duplicates };
}

async function previewRoomFixtureLabels() {
  const owner = state.takeoff, page = Number(owner.activePage);
  if (!takeoffPdf || takeoffDocumentOwner !== owner.document) return;
  try {
    const sourcePage = await takeoffPdf.getPage(page);
    const content = await sourcePage.getTextContent();
    if (owner !== state.takeoff || page !== Number(owner.activePage) || state.currentView !== "takeoff") return;
    const result = fixtureLabelCandidates(content, sourcePage.getViewport({scale: 1}), page, owner.catalog, owner.markups);
    takeoffLabelPreview = { ...result, owner, page };
    takeoffMode = "select";
    window.renderPlanTakeoff();
  } catch (error) { showToast(`Could not read fixture labels: ${error.message}`); }
}

function labelPreviewHTML(preview) {
  const counts = new Map();
  preview.candidates.forEach(item => counts.set(item.tag, (counts.get(item.tag) || 0) + 1));
  const heading = `<h3>Review ${preview.candidates.length} fixture label${preview.candidates.length === 1 ? "" : "s"}</h3>`;
  const summary = [...counts].map(([tag, count]) => `${tag} × ${count}`).join(" · ");
  return `<section class="panel-section" aria-label="Proposed fixture marks">${heading}
    <p class="field-help">${preview.candidates.length ? "Compare each numbered circle with its fixture symbol. Deselect any labels that do not represent fixtures." : "No new standalone text labels match fixture mappings inside this sheet’s spaces. Stamp graphic symbols manually."} ${preview.duplicates ? `${preview.duplicates} matching locations already counted.` : ""}</p>
    <p>${escapeHTML(summary)}</p>
    <details ${preview.candidates.length <= 12 ? "open" : ""}><summary>Individual labels</summary>${preview.candidates.map((item, index) => `<label style="display:block"><input type="checkbox" data-preview-tag="${index}" ${item.selected ? "checked" : ""}> ${index + 1}. ${escapeHTML(item.tag)} · ${escapeHTML(item.room)}</label>`).join("")}</details>
    ${preview.candidates.length ? '<button class="primary-button" id="takeoff-accept-tags" type="button">Add selected marks</button>' : ""}
    <button class="ghost-button" id="takeoff-cancel-tags" type="button">Close preview</button></section>`;
}

function acceptRoomFixtureLabels() {
  const preview = activeLabelPreview();
  if (!preview) return;
  const selected = preview.candidates.filter(item => item.selected);
  if (!selected.length) { showToast("Select a label to add"); return; }
  for (const { x, y, catalogId, page } of selected) {
    state.takeoff.markups.push({ id: newRecordId(), type: "stamp", page, x, y, catalogId, quantity: 1,
      detection: "Reviewed PDF fixture label", createdAt: new Date().toISOString() });
  }
  takeoffLabelPreview = null;
  saveState("Reviewed fixture marks added");
  window.renderPlanTakeoff();
  showToast(`${selected.length} reviewed marks added`);
}

function renderTakeoffOverlay(width, height) {
  const overlay = $("#takeoff-overlay");
  if (!overlay) return;
  planSheetSize = { width, height };
  overlay.dataset.mode = takeoffMode;
  const page = Number(state.takeoff.activePage);
  const marks = state.takeoff.markups.filter(mark => Number(mark.page) === page);
  const proposals = activeLabelPreview()?.candidates || [];
  const calibration = state.takeoff.scale?.page === page ? state.takeoff.scale : null;
  const derived = derivedPlanWires(page, width, height);
  const wiring = planWiresSVG({ derived: derived.wires, drawn: marks.filter(mark => mark.type === "wire"), markups: marks, catalog: state.takeoff.catalog, width, height,
    scale: state.takeoff.scale, page, visible: planWiringVisible, selectedId: planWireSelectedId });
  // Layer order, bottom to top: spaces, derived and drawn wires, calibration, stamps, proposals, drafts.
  overlay.innerHTML = `${marks.filter(mark => mark.type === "room").map(mark => markupSVG(mark, width, height)).join("")}${wiring}${calibration ? `<line class="calibration-line" x1="${calibration.x1 * width}" y1="${calibration.y1 * height}" x2="${calibration.x2 * width}" y2="${calibration.y2 * height}"/><text class="calibration-label" x="${((calibration.x1 + calibration.x2) / 2) * width}" y="${((calibration.y1 + calibration.y2) / 2) * height - 8}">${escapeHTML(`${calibration.distanceFeet} ft`)}</text>` : ""}${marks.filter(mark => mark.type === "stamp").map(mark => markupSVG(mark, width, height)).join("")}${proposals.map((p, i) => `<g id="takeoff-preview-${i}" transform="translate(${p.x * width} ${p.y * height})" opacity="${p.selected ? 1 : 0.25}" pointer-events="none"><circle r="10" fill="#fff4cc" stroke="#764900" stroke-dasharray="2 2"/><text text-anchor="middle" y="4" fill="#322100" font-size="10">${i + 1}</text></g>`).join("")}`;
  paintSpaceDraft(overlay, width, height);
  overlay.insertAdjacentHTML("beforeend", '<g id="plan-wire-draft" pointer-events="none"></g>');
  paintWireDraft();
  const panel = $("#plan-wiring-panel");
  const panelHTML = planWiringPanelHTML(derived, marks);
  if (panel && panelHTML !== planWiringPanelRendered) { panel.outerHTML = panelHTML; planWiringPanelRendered = panelHTML; }
}

// Derived wires are not stored; this memo keeps the per-pointermove overlay redraw cheap.
function derivedPlanWires(page, width, height) {
  const marks = state.takeoff.markups.filter(mark => Number(mark.page) === Number(page) && (mark.type === "room" || mark.type === "stamp"));
  const key = JSON.stringify([page, width, height, marks.map(mark => [mark.id, mark.type, mark.x, mark.y, mark.w, mark.h, mark.points, mark.catalogId, mark.createdAt, mark.name]),
    state.takeoff.catalog.map(entry => [entry.id, entry.model, entry.category, entry.controlType, entry.tag, entry.name, entry.stampCode])]);
  if (planWireCache?.key === key) return planWireCache.result;
  const result = derivePlanWires({ markups: state.takeoff.markups, catalog: state.takeoff.catalog, page, width, height });
  planWireCache = { key, result };
  return result;
}

function planWiringPanelHTML(derived, pageMarks) {
  const drawn = pageMarks.filter(mark => mark.type === "wire");
  const counts = new Map();
  const bump = (type, key) => counts.set(type, { derived: 0, drawn: 0, ...counts.get(type), [key]: (counts.get(type)?.[key] || 0) + 1 });
  derived.wires.forEach(wire => bump(wire.linkType, "derived"));
  drawn.forEach(wire => bump(wire.linkType, "drawn"));
  const total = derived.wires.length + drawn.length;
  const types = [...PLAN_WIRE_ORDER.filter(type => counts.has(type)), ...[...counts.keys()].filter(type => !PLAN_WIRE_ORDER.includes(type))];
  const rows = types.map(type => {
    const row = counts.get(type);
    const parts = [row.derived && `${row.derived} derived`, row.drawn && `${row.drawn} drawn`].filter(Boolean).join(" · ");
    return `<div class="wire-legend-row"><svg width="28" height="10" viewBox="0 0 28 10" aria-hidden="true"><path d="M1 5H27" class="${escapeHTML(PLAN_WIRE_CLASS[type] || "wire-control")}"/></svg><strong>${escapeHTML(type)}</strong><small>${parts}</small></div>`;
  }).join("");
  const warning = text => `<div class="design-rule warning">${icon("alert")}<span>${escapeHTML(text)}</span></div>`;
  const texts = derived.messages.map(message => message.text);
  const messages = texts.slice(0, 4).map(warning).join("") + (texts.length > 4 ? `<details><summary>Show all ${texts.length} messages</summary>${texts.slice(4).map(warning).join("")}</details>` : "");
  let empty = "";
  if (!total && !texts.length) {
    if (!pageMarks.some(mark => mark.type === "stamp")) empty = "Wires appear automatically as you place controllers and devices inside spaces.";
    else if (!pageMarks.some(mark => mark.type === "room")) empty = "Draw space boundaries so in-room wiring can be derived.";
  }
  return `<div class="panel-section" id="plan-wiring-panel">
    <div class="panel-section-header"><div><p class="kicker">PLAN WIRING</p><h3>${total ? `${total} wire${total === 1 ? "" : "s"}` : "No wires"} on this sheet</h3></div>${planWiringVisible ? "" : '<span class="pill gray">Hidden on plan</span>'}</div>
    ${rows}${messages}${empty ? `<p class="field-help">${escapeHTML(empty)}</p>` : ""}
    <p class="field-help">Derived wires update automatically. Drawn wires have end dots.</p>
  </div>`;
}

function spaceDraftPoints() {
  if (!takeoffPolylineDraft || takeoffPolylineDraft.owner !== state.takeoff || takeoffPolylineDraft.page !== state.takeoff.activePage) {
    takeoffPolylineDraft = { owner: state.takeoff, page: state.takeoff.activePage, points: [] };
  }
  return takeoffPolylineDraft.points;
}

function svgSpacePoints(points, width, height) {
  return points.map(p => `${p.x * width},${p.y * height}`).join(" ");
}

function paintSpaceDraft(overlay, width, height) {
  if (takeoffMode !== "polyline") return;
  const points = spaceDraftPoints();
  if (!points.length) return;
  overlay.insertAdjacentHTML("beforeend", `<g class="space-polyline-draft" pointer-events="none"><polyline points="${svgSpacePoints(points, width, height)}"/>${points.map((p, index) => `<circle cx="${p.x * width}" cy="${p.y * height}" r="${index ? 4 : 6}"/>`).join("")}</g>`);
}

function refreshSpaceDraft() {
  const overlay = $("#takeoff-overlay");
  if (overlay) renderTakeoffOverlay(overlay.viewBox.baseVal.width, overlay.viewBox.baseVal.height);
  if (takeoffMode !== "polyline") return;
  const count = spaceDraftPoints().length;
  $("#takeoff-point-count").textContent = `${count} ${count === 1 ? "vertex" : "vertices"}`;
  $("#takeoff-undo-point").disabled = !count;
  $("#takeoff-finish-space").disabled = count < 3;
}

function signedTurn(a, b, p) {
  return (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
}

function onSpaceEdge(a, b, p) {
  const e = 1e-10;
  return Math.abs(signedTurn(a, b, p)) <= e && p.x >= Math.min(a.x, b.x) - e && p.x <= Math.max(a.x, b.x) + e &&
    p.y >= Math.min(a.y, b.y) - e && p.y <= Math.max(a.y, b.y) + e;
}

function edgesIntersect(a, b, c, d) {
  if (onSpaceEdge(a, b, c) || onSpaceEdge(a, b, d) || onSpaceEdge(c, d, a) || onSpaceEdge(c, d, b)) return true;
  return signedTurn(a, b, c) * signedTurn(a, b, d) < 0 && signedTurn(c, d, a) * signedTurn(c, d, b) < 0;
}

function boundaryArea(mark) {
  if (!Array.isArray(mark.points)) return mark.w * mark.h;
  const points = mark.points;
  return Math.abs(points.reduce((sum, a, index) => {
    const b = points[(index + 1) % points.length];
    return sum + a.x * b.y - a.y * b.x;
  }, 0)) / 2;
}

function validSpacePolygon(points) {
  if (points.length < 3 || boundaryArea({ points }) < 0.000001) return false;
  for (let i = 0; i < points.length; i++) {
    const next = (i + 1) % points.length;
    for (let j = i + 1; j < points.length; j++) {
      const after = (j + 1) % points.length;
      if (j !== next && after !== i && edgesIntersect(points[i], points[next], points[j], points[after])) return false;
    }
  }
  return true;
}

function finishSpaceDraft() {
  const points = [...spaceDraftPoints()];
  if (points.length > 3 && Math.hypot(points.at(-1).x - points[0].x, points.at(-1).y - points[0].y) <= 0.0005) points.pop();
  if (!validSpacePolygon(points)) { showToast("Use three or more corners enclosing an area, with no crossing edges."); return; }
  openTakeoffRoomEditor({ shape: "polygon", points });
}

function spaceContainsPoint(mark, x, y) {
  if (!Array.isArray(mark.points)) return x >= mark.x && x <= mark.x + mark.w && y >= mark.y && y <= mark.y + mark.h;
  let inside = false;
  const points = mark.points;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[j], b = points[i];
    if (onSpaceEdge(a, b, { x, y })) return true;
    if ((a.y > y) !== (b.y > y) && x < a.x + (y - a.y) * (b.x - a.x) / (b.y - a.y)) inside = !inside;
  }
  return inside;
}

function orderedSpaceBoundaries(marks, page) {
  return marks.filter(mark => mark.type === "room" && Number(mark.page) === Number(page)).sort((a, b) => boundaryArea(a) - boundaryArea(b));
}

function containingTakeoffSpace(marks, page, x, y) {
  return orderedSpaceBoundaries(marks, page).find(mark => spaceContainsPoint(mark, x, y));
}

function markupSVG(mark, width, height) {
  if (mark.type === "room") {
    if (Array.isArray(mark.points) && mark.points.length >= 3) {
      const first = mark.points[0];
      return `<g class="takeoff-mark room-mark" data-markup-id="${escapeHTML(mark.id)}"><polygon points="${svgSpacePoints(mark.points, width, height)}"/><text x="${first.x * width + 6}" y="${first.y * height + 15}">${escapeHTML(mark.name)}</text></g>`;
    }
    return `<g class="takeoff-mark room-mark" data-markup-id="${mark.id}"><rect x="${mark.x * width}" y="${mark.y * height}" width="${mark.w * width}" height="${mark.h * height}"/><text x="${mark.x * width + 8}" y="${mark.y * height + 18}">${escapeHTML(mark.name)}</text></g>`;
  }
  if (mark.type !== "stamp") return "";
  const entry = state.takeoff.catalog.find(item => item.id === mark.catalogId) || {};
  const x = mark.x * width;
  const y = mark.y * height;
  const label = toolboxStampLabel(entry);
  return `<g class="takeoff-mark stamp-mark ${escapeHTML(entry.category || "fixture")}" data-markup-id="${mark.id}" transform="translate(${x} ${y})"><title>${escapeHTML([label, entry.model, entry.name].filter(Boolean).join(" · "))}</title><circle r="11"/><text text-anchor="middle" y="3">${escapeHTML(label)}</text>${Number(mark.quantity || 1) > 1 ? `<text class="quantity-badge" x="9" y="-9">×${Number(mark.quantity)}</text>` : ""}</g>`;
}

function bindOverlayEvents() {
  const overlay = $("#takeoff-overlay");
  if (!overlay) return;
  overlay.addEventListener("pointerdown", handleOverlayPointerDown);
  overlay.addEventListener("pointermove", handleOverlayPointerMove);
  overlay.addEventListener("pointerup", handleOverlayPointerUp);
  overlay.addEventListener("pointerleave", () => { planWirePointer = null; paintWireDraft(); });
  overlay.addEventListener("pointercancel", () => { takeoffRoomDrag = null; refreshSpaceDraft(); });
}

function normalizedOverlayPoint(event) {
  const rect = event.currentTarget.getBoundingClientRect();
  return { x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)), y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)) };
}

function handleOverlayPointerDown(event) {
  if (!event.isPrimary || event.button !== 0) return;
  const point = normalizedOverlayPoint(event);
  if (takeoffMode === "room") {
    takeoffRoomDrag = { start: point };
    event.currentTarget.setPointerCapture(event.pointerId);
  }
}

function handleOverlayPointerMove(event) {
  if (takeoffMode === "wire") {
    // Only the draft group repaints: rubber band and hover ring.
    planWirePointer = normalizedOverlayPoint(event);
    paintWireDraft();
    return;
  }
  if (takeoffMode !== "room" || !takeoffRoomDrag) return;
  const point = normalizedOverlayPoint(event);
  const x = Math.min(point.x, takeoffRoomDrag.start.x);
  const y = Math.min(point.y, takeoffRoomDrag.start.y);
  const w = Math.abs(point.x - takeoffRoomDrag.start.x);
  const h = Math.abs(point.y - takeoffRoomDrag.start.y);
  renderTakeoffOverlay(event.currentTarget.viewBox.baseVal.width, event.currentTarget.viewBox.baseVal.height);
  event.currentTarget.insertAdjacentHTML("beforeend", `<rect class="room-draft" x="${x * event.currentTarget.viewBox.baseVal.width}" y="${y * event.currentTarget.viewBox.baseVal.height}" width="${w * event.currentTarget.viewBox.baseVal.width}" height="${h * event.currentTarget.viewBox.baseVal.height}"/>`);
}

function handleOverlayPointerUp(event) {
  if (!event.isPrimary || event.button !== 0) return;
  if (activeLabelPreview()) return;
  const clickedWire = event.target.closest?.("[data-wire-id]");
  if (takeoffMode === "select" && clickedWire?.classList.contains("drawn")) {
    openPlanWireEditor(clickedWire.dataset.wireId);
    return;
  }
  const clickedMark = event.target.closest?.("[data-markup-id]");
  if (takeoffMode === "select" && clickedMark) {
    openTakeoffMarkupEditor(clickedMark.dataset.markupId);
    return;
  }
  const point = normalizedOverlayPoint(event);
  if (takeoffMode === "wire") {
    handlePlanWireClick(point, event.currentTarget);
    return;
  }
  if (takeoffMode === "polyline") {
    const points = spaceDraftPoints();
    const last = points.at(-1);
    if (!last || Math.hypot(point.x - last.x, point.y - last.y) > 0.0005) points.push(point);
    refreshSpaceDraft();
    return;
  }
  if (takeoffMode === "stamp") {
    if (!takeoffActiveCatalogId) { showToast("Add or select a catalog mapping first"); return; }
    state.takeoff.markups.push({ id: newRecordId(), type: "stamp", page: Number(state.takeoff.activePage), x: point.x, y: point.y, catalogId: takeoffActiveCatalogId, quantity: 1, createdAt: new Date().toISOString() });
    if (!state.takeoff.recentCatalogIds.includes(takeoffActiveCatalogId)) touchRecentCatalog(takeoffActiveCatalogId);
    saveState("Symbol counted");
    window.renderPlanTakeoff();
    const count = state.takeoff.markups.filter(mark => Number(mark.page) === Number(state.takeoff.activePage) && mark.type !== "wire").length;
    takeoffAnnounce(`${count} marks on this page`);
    return;
  }
  if (takeoffMode === "room" && takeoffRoomDrag) {
    const start = takeoffRoomDrag.start;
    takeoffRoomDrag = null;
    const rect = { x: Math.min(point.x, start.x), y: Math.min(point.y, start.y), w: Math.abs(point.x - start.x), h: Math.abs(point.y - start.y) };
    if (rect.w < 0.015 || rect.h < 0.015) { window.renderPlanTakeoff(); return; }
    openTakeoffRoomEditor({ ...rect, shape: "rectangle" });
    return;
  }
  if (takeoffMode === "calibrate") {
    if (!takeoffCalibrationPoint) {
      takeoffCalibrationPoint = point;
      showToast("Select the second calibration point");
    } else {
      const first = takeoffCalibrationPoint;
      takeoffCalibrationPoint = null;
      openTakeoffCalibrationEditor(first, point);
    }
  }
}

function openTakeoffRoomEditor(rect, markup = null) {
  showModal(`
    ${modalHeader(markup ? "Edit space boundary" : "Name this space", "Marks inside this boundary inherit the space name when the designer is populated.")}
    <form id="takeoff-room-form"><div class="modal-body"><div class="form-grid">
      ${fieldHTML({ key: "name", label: "Space name", required: true, placeholder: "Dining 101" }, markup?.name || "")}
      ${fieldHTML({ key: "roomType", label: "Space category", type: "select", options: ["Office", "Conference", "Classroom", "Corridor", "Lobby", "Restroom", "Open office", "Other"] }, markup?.roomType || "Other")}
    </div></div><footer class="modal-footer"><button class="ghost-button" type="button" data-modal-close>Cancel</button><button class="primary-button" type="submit">Save space</button></footer></form>`);
  $("#takeoff-room-form").addEventListener("submit", event => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    values.name = values.name.trim();
    if (!values.name) { showToast("Enter a space name"); return; }
    const mark = markup || { id: newRecordId(), type: "room", page: Number(state.takeoff.activePage), ...rect, createdAt: new Date().toISOString() };
    Object.assign(mark, values);
    if (!markup) state.takeoff.markups.push(mark);
    linkTakeoffSpace(mark);
    takeoffPolylineDraft = null;
    takeoffLabelPreview = null;
    saveState("Space saved"); closeModal(); window.renderPlanTakeoff();
  });
}

function openTakeoffCalibrationEditor(first, second) {
  showModal(`
    ${modalHeader("Calibrate drawing scale", "Enter the real-world distance between the two selected points.")}
    <form id="takeoff-calibration-form"><div class="modal-body"><div class="form-grid">${fieldHTML({ key: "distanceFeet", label: "Known distance (feet)", type: "number", min: 0.1, step: "0.1", required: true, placeholder: "20" }, "")}</div></div><footer class="modal-footer"><button class="ghost-button" type="button" data-modal-close>Cancel</button><button class="primary-button" type="submit">Set scale</button></footer></form>`);
  $("#takeoff-calibration-form").addEventListener("submit", event => {
    event.preventDefault();
    const distanceFeet = Number(new FormData(event.currentTarget).get("distanceFeet"));
    state.takeoff.scale = { page: Number(state.takeoff.activePage), x1: first.x, y1: first.y, x2: second.x, y2: second.y, distanceFeet };
    saveState("Scale calibrated"); closeModal(); window.renderPlanTakeoff();
  });
}

function openTakeoffCatalogEditor(entryId = null) {
  const entry = state.takeoff.catalog.find(item => item.id === entryId);
  const fields = [
    { key: "category", label: "Designer category", type: "select", required: true, options: ["unresolved", "fixture", "controller", "keypad", "sensor", "network", "interface", "accessory"] },
    { key: "tag", label: "Drawing tag / symbol", required: true, placeholder: "L10" },
    { key: "name", label: "Description", required: true, placeholder: "3-inch downlight" },
    { key: "model", label: "Crestron model", placeholder: "ZUMNET-JBOX-16A-LV" },
    { key: "controlType", label: "Control type", type: "select", options: ["0-10 V dimming", "DALI", "Phase control", "Switching", "Plug-load switching", "Other"] },
    { key: "watts", label: "Watts each", type: "number", min: 0, step: "0.1" },
    { key: "connection", label: "Connection / medium" },
    { key: "evidence", label: "Drawing or submittal reference" },
    { key: "voltage", label: "Verified supply voltage", placeholder: "120 VAC" },
    { key: "deviceType", label: "Device type", type: "select", options: ["Keypad", "Occupancy sensor", "Vacancy sensor", "Presence detector", "Daylight sensor", "Integration interface", "Network bridge", "Other"] },
    { key: "networkRole", label: "Controller role", type: "select", options: ["Zūm Net primary controller", "Zūm Link load controller", "Zūm Mesh load controller", "Standalone load controller"] }
  ];
  showModal(`
    ${modalHeader(entry ? "Edit symbol mapping" : "Add symbol mapping", "Map a drawing symbol to the record that will be created in the Zūm designer.")}
    <form id="takeoff-catalog-form"><div class="modal-body"><div class="form-grid">${fields.map(field => fieldHTML(field, entry?.[field.key] ?? (field.key === "category" ? "unresolved" : ""))).join("")}</div></div><footer class="modal-footer">${entry ? '<button class="danger-button" type="button" id="delete-catalog-entry">Delete mapping</button>' : ""}<button class="ghost-button" type="button" data-modal-close>Cancel</button><button class="primary-button" type="submit">Save mapping</button></footer></form>`);
  $("#takeoff-catalog-form").addEventListener("submit", event => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    values.verifiedMapping = values.category !== "unresolved";
    if (entry) Object.assign(entry, values);
    else { const created = { id: newRecordId(), ...values }; state.takeoff.catalog.push(created); takeoffActiveCatalogId = created.id; }
    takeoffLabelPreview = null;
    saveState("Mapping saved"); closeModal(); window.renderPlanTakeoff();
  });
  $("#delete-catalog-entry")?.addEventListener("click", () => {
    const used = state.takeoff.markups.some(mark => mark.catalogId === entry.id);
    if (used) { showToast("Delete or remap its plan marks first"); return; }
    state.takeoff.catalog = state.takeoff.catalog.filter(item => item.id !== entry.id);
    takeoffActiveCatalogId = state.takeoff.catalog[0]?.id || "";
    takeoffLabelPreview = null;
    saveState("Mapping deleted"); closeModal(); window.renderPlanTakeoff();
  });
}

function openTakeoffMarkupEditor(markupId) {
  const markup = state.takeoff.markups.find(mark => mark.id === markupId);
  if (!markup) return;
  if (markup.type === "room") { openTakeoffRoomEditor(null, markup); return; }
  if (markup.type === "wire") { openPlanWireEditor(markup.id); return; }
  const entry = state.takeoff.catalog.find(item => item.id === markup.catalogId);
  showModal(`
    ${modalHeader("Review plan mark", `${entry?.tag || "Symbol"} · page ${markup.page} · ${findAreaForMarkup(markup)}`)}
    <form id="takeoff-mark-form"><div class="modal-body"><div class="form-grid">
      ${fieldHTML({ key: "catalogId", label: "Mapped item", type: "select", options: state.takeoff.catalog.map(item => item.id) }, markup.catalogId).replaceAll(/<option value="([^"]+)"([^>]*)>([^<]*)<\/option>/g, (match, value, attrs) => { const item = state.takeoff.catalog.find(candidate => candidate.id === value); return `<option value="${value}" ${value === markup.catalogId ? "selected" : ""}>${escapeHTML(`${item?.tag || ""} · ${item?.name || ""}`)}</option>`; })}
      ${fieldHTML({ key: "quantity", label: "Quantity at this mark", type: "number", min: 1, required: true }, markup.quantity || 1)}
      ${fieldHTML({ key: "areaOverride", label: "Space override", placeholder: "Leave blank to use space boundary" }, markup.areaOverride || "")}
    </div></div><footer class="modal-footer"><button class="danger-button" type="button" id="delete-takeoff-mark">Delete mark</button><button class="ghost-button" type="button" data-modal-close>Cancel</button><button class="primary-button" type="submit">Save mark</button></footer></form>`);
  $("#takeoff-mark-form").addEventListener("submit", event => {
    takeoffLabelPreview = null;
    event.preventDefault(); Object.assign(markup, Object.fromEntries(new FormData(event.currentTarget).entries())); saveState("Mark updated"); closeModal(); window.renderPlanTakeoff();
  });
  $("#delete-takeoff-mark").addEventListener("click", () => {
    takeoffLabelPreview = null;
    if (planWiresAttachedTo(markup.id).length) { confirmDeleteStampWithWires(markup.id); return; }
    state.takeoff.markups = state.takeoff.markups.filter(mark => mark.id !== markup.id);
    saveState("Mark deleted"); closeModal(); window.renderPlanTakeoff();
  });
}

function openTakeoffMarkupReview() {
  const rows = state.takeoff.markups.map(mark => {
    if (mark.type === "wire") {
      const [from, to] = [mark.fromMarkupId, mark.toMarkupId].map(id => planWireEndInfo(id)?.label || "?");
      return `<tr><td>${escapeHTML(`${mark.linkType}: ${from} to ${to}`)}</td><td>Wire</td><td>${mark.page}</td><td>—</td><td>—</td><td><button class="row-action" type="button" data-review-mark="${mark.id}">${icon("edit")}</button></td></tr>`;
    }
    const entry = state.takeoff.catalog.find(item => item.id === mark.catalogId);
    return `<tr><td>${escapeHTML(mark.type === "room" ? mark.name : entry?.tag || "?")}</td><td>${escapeHTML(mark.type === "room" ? "Space" : entry?.category || "Symbol")}</td><td>${mark.page}</td><td>${escapeHTML(mark.type === "room" ? mark.roomType : findAreaForMarkup(mark))}</td><td>${mark.type === "stamp" ? Number(mark.quantity || 1) : "—"}</td><td><button class="row-action" type="button" data-review-mark="${mark.id}">${icon("edit")}</button></td></tr>`;
  }).join("");
  showModal(`${modalHeader("Plan markup register", "Every generated designer record retains its drawing-set, page, and mark reference.")}<div class="modal-body"><div class="data-table-wrap"><table class="data-table"><thead><tr><th>Mark</th><th>Type</th><th>Page</th><th>Space</th><th>Qty.</th><th></th></tr></thead><tbody>${rows || '<tr><td colspan="6">No markups yet.</td></tr>'}</tbody></table></div></div><footer class="modal-footer"><button class="danger-button" type="button" id="clear-takeoff">Clear takeoff</button><button class="secondary-button" type="button" data-modal-close>Done</button></footer>`, true);
  document.querySelectorAll("[data-review-mark]").forEach(button => button.addEventListener("click", () => openTakeoffMarkupEditor(button.dataset.reviewMark)));
  $("#clear-takeoff").addEventListener("click", confirmClearTakeoff);
}

function confirmClearTakeoff() {
  showModal(`${modalHeader("Clear the plan takeoff?", "This removes the attached-document metadata, mappings, markups (including drawn wires), and records generated from them.")}<div class="modal-body"><p>Manually entered designer records will be preserved. Export the project first if you need a backup.</p></div><footer class="modal-footer"><button class="ghost-button" type="button" data-modal-close>Cancel</button><button class="danger-button" type="button" id="confirm-clear-takeoff">Clear takeoff</button></footer>`);
  $("#confirm-clear-takeoff").addEventListener("click", () => {
    Object.keys(state.records).forEach(stageId => { state.records[stageId] = recordsFor(stageId).filter(record => record.generatedBy !== "plan-takeoff" || record.updatedAt); });
    state.takeoff = { document: null, activePage: 1, scale: null, markups: [], catalog: [], analysis: null, lastSyncAt: null, recentCatalogIds: [] };
    resetToolboxUiState();
    takeoffWireDraft = null;
    planWireCache = null;
    planWireSelectedId = "";
    pruneTakeoffSpaces();
    syncConfiguredSpaces();
    takeoffPdf = null;
    takeoffActiveCatalogId = "";
    takeoffMode = "select";
    saveState("Plan takeoff cleared");
    closeModal();
    render();
    showToast("Plan takeoff cleared");
  });
}

function groupedTakeoffCounts(page) {
  const groups = new Map();
  state.takeoff.markups.filter(mark => mark.type === "stamp" && Number(mark.page) === page).forEach(mark => {
    const entry = state.takeoff.catalog.find(item => item.id === mark.catalogId);
    if (!entry) return;
    const current = groups.get(entry.id) || { catalogId: entry.id, category: entry.category, tag: entry.tag, name: entry.name, quantity: 0 };
    current.quantity += Number(mark.quantity || 1);
    groups.set(entry.id, current);
  });
  return [...groups.values()].sort((a, b) => a.category.localeCompare(b.category) || a.tag.localeCompare(b.tag));
}

function findAreaForMarkup(markup) {
  if (markup.areaOverride) return markup.areaOverride;
  return containingTakeoffSpace(state.takeoff.markups, markup.page, markup.x, markup.y)?.name || `Unassigned - page ${markup.page}`;
}

function takeoffSource(markup) {
  const page = state.takeoff.analysis?.pages?.find(item => item.page === Number(markup.page));
  return `${state.takeoff.document?.name || "CD set"} · ${page?.sheet || `page ${markup.page}`} · mark ${markup.id.slice(0, 8)}`;
}

// Boundary IDs survive sheet changes and designer renames. Repeated outlines
// with the same space name may represent the same space on different sheets.
function linkTakeoffSpace(mark, refresh = true) {
  const name = mark.name.trim();
  const bound = state.spaces.find(s => s.id === mark.spaceId);
  const matching = state.spaces.find(s => s.name.toLowerCase() === name.toLowerCase());
  const space = matching || bound || { id: newRecordId(), name, fromTakeoff: true };
  if (!matching && !bound) state.spaces.push(space);
  if (space === bound && space.name !== name) {
    space.name = name;
    for (const other of state.takeoff.markups) {
      if (other.type === "room" && other.spaceId === space.id) other.name = name;
    }
    for (const rows of Object.values(state.records)) {
      for (const row of rows) if (row.spaceId === space.id) row.area = name;
    }
  }
  mark.spaceId = space.id;
  mark.name = space.name;
  if (refresh) syncConfiguredSpaces();
  return space;
}

function pruneTakeoffSpaces() {
  const inUse = new Set(state.takeoff.markups.filter(m => m.type === "room").map(m => m.spaceId));
  for (const rows of Object.values(state.records)) {
    for (const row of rows) {
      if (row.generatedBy !== "takeoff-unit" && (!row.configured || row.updatedAt)) inUse.add(row.spaceId);
    }
  }
  state.spaces = state.spaces.filter(s => !s.fromTakeoff || inUse.has(s.id));
}

function populateDesignerFromTakeoff() {
  const stamps = state.takeoff.markups.filter(mark => mark.type === "stamp");
  if (!state.takeoff.markups.length && !state.takeoff.lastSyncAt) { showToast("Add plan marks before populating the designer"); return; }

  const rooms = state.takeoff.markups.filter(mark => mark.type === "room");
  rooms.forEach(room => linkTakeoffSpace(room, false));
  const grouped = new Map();
  stamps.forEach(mark => {
    const entry = state.takeoff.catalog.find(item => item.id === mark.catalogId);
    if (!entry?.verifiedMapping || entry.category === "unresolved") return;
    const area = findAreaForMarkup(mark);
    const spaceId = state.spaces.find(s => s.name === area)?.id || "";
    // Keep physical controller placements distinct for assigning zone outputs.
    const key = JSON.stringify([entry.id, spaceId || area, mark.page, entry.category === "controller" ? mark.id : ""]);
    const current = grouped.get(key) || { entry, area, spaceId, page: mark.page, quantity: 0, markups: [] };
    current.quantity += Number(mark.quantity || 1);
    current.markups.push(mark);
    grouped.set(key, current);
  });

  if (stamps.length && !grouped.size && !rooms.length) { showToast("Review and save the stamped symbol mappings first"); return; }
  const incoming = [...grouped.values()].map(designerRecordFromTakeoff);
  rooms.forEach(room => incoming.push(["spaceBehavior", {
    ...baseGeneratedRecord({quantity: 1, markups: [room]}), area: room.name, spaceId: room.spaceId, roomType: room.roomType || "",
    notes: "Confirm the sequence of operations against the project drawings."
  }]));
  // Manual wires become one Wiring & Links record each; derived wires never do.
  state.takeoff.markups.filter(mark => mark.type === "wire").forEach(wire => incoming.push(["links", {
    ...baseGeneratedRecord({ quantity: 1, markups: [wire] }),
    ...planWireLinkRecord(wire, { markups: state.takeoff.markups, catalog: state.takeoff.catalog, scale: state.takeoff.scale, areaOf: findAreaForMarkup })
  }]));
  const retained = new Set();
  const skippedIds = new Set(stamps.filter(mark => !state.takeoff.catalog.find(entry => entry.id === mark.catalogId)?.verifiedMapping).map(mark => mark.id));
  for (const [stage, record] of incoming) {
    const rows = recordsFor(stage);
    const snapshot = { ...record };
    delete snapshot.id;
    delete snapshot.createdAt;
    const existing = rows.find(row => row.generatedBy === "plan-takeoff" && !retained.has(row.id) &&
      row.takeoffMarkupIds?.some(id => record.takeoffMarkupIds.includes(id)));
    if (existing) {
      retained.add(existing.id);
      for (const [field, value] of Object.entries(snapshot)) {
        if (!existing.updatedAt || (existing.takeoffSnapshot && JSON.stringify(existing[field]) === JSON.stringify(existing.takeoffSnapshot[field]))) existing[field] = value;
      }
      if (!existing.updatedAt || existing.takeoffSnapshot) existing.takeoffSnapshot = snapshot;
    } else {
      rows.push({ ...record, takeoffSnapshot: snapshot });
      retained.add(record.id);
    }
  }
  Object.keys(state.records).forEach(stage => {
    state.records[stage] = recordsFor(stage).filter(row => row.generatedBy !== "plan-takeoff" || row.updatedAt || retained.has(row.id) || row.takeoffMarkupIds?.some(id => skippedIds.has(id)));
  });
  pruneTakeoffSpaces();
  syncConfiguredSpaces();
  state.takeoff.lastSyncAt = new Date().toISOString();
  saveState("Designer populated");
  render();
  const skipped = stamps.length - [...grouped.values()].reduce((n, group) => n + group.markups.length, 0);
  showToast(`${stamps.length - skipped} plan marks populated${skipped ? ` · ${skipped} need mapping review` : ""}`);
}

function baseGeneratedRecord(group) {
  return { id: newRecordId(), quantity: String(group.quantity), generatedBy: "plan-takeoff", takeoffMarkupIds: group.markups.map(mark => mark.id), sourceRef: group.markups.map(takeoffSource).join("; "), createdAt: new Date().toISOString() };
}

function designerRecordFromTakeoff(group) {
  const { entry, area } = group;
  const product = takeoffProduct(entry.model);
  const sourceProduct = product && takeoffCategory(product) === entry.category ? product : null;
  const base = baseGeneratedRecord(group);
  const references = (sourceProduct?.sources || []).map(source => [source.file, source.section, source.page && `p. ${source.page}`].filter(Boolean).join(" · ") || source.label);
  const record = {
    ...base, model: entry.model || "", area, spaceId: group.spaceId || "", name: `${area} · ${entry.name}`,
    notes: [`Generated from ${base.sourceRef}`, entry.evidence, ...references].filter(Boolean).join(" · ")
  };
  const connection = entry.connection || sourceProduct?.connection || "";
  if (entry.category === "fixture") {
    return ["loads", { ...record, name: `${entry.tag} · ${entry.name}`, controlType: entry.controlType || "", voltage: entry.voltage || "", watts: String(entry.watts ?? "") }];
  }
  if (entry.category === "controller") {
    return ["controllers", { ...record, networkRole: entry.networkRole || "", loadCapability: sourceProduct?.rating || "", feed: entry.voltage || "" }];
  }
  if (entry.category === "network") {
    return ["network", { ...record, equipmentType: sourceProduct?.name || entry.name, connection, voltage: entry.voltage || "" }];
  }
  if (entry.category === "accessory") {
    return ["lineItems", { ...record, category: "Accessory", unitPrice: "" }];
  }
  return ["roomDevices", { ...record, deviceType: entry.deviceType || ({keypad:"Keypad",interface:"Integration interface"})[entry.category] || sourceProduct?.name || entry.category, connection, function: sourceProduct?.role || "" }];
}

// ---- Placement helpers: live region, undo, keyboard ----

function takeoffAnnounce(text) {
  let region = document.getElementById("takeoff-announce");
  if (!region) {
    region = document.createElement("div");
    region.id = "takeoff-announce";
    region.className = "visually-hidden";
    region.setAttribute("aria-live", "polite");
    document.body.append(region);
  }
  // Alternate a trailing space so a repeated message is announced again.
  region.textContent = region.textContent === text ? `${text} ` : text;
}

function planWireEndInfo(markupId) {
  const mark = state.takeoff.markups.find(item => item.id === markupId && item.type === "stamp");
  return mark ? planWireStampInfo(mark, state.takeoff.catalog) : null;
}

function planWiresAttachedTo(stampId) {
  return state.takeoff.markups.filter(mark => mark.type === "wire" && (mark.fromMarkupId === stampId || mark.toMarkupId === stampId));
}

function planWireDescribe(wire) {
  const [from, to] = [wire.fromMarkupId, wire.toMarkupId].map(id => planWireEndInfo(id)?.label || "?");
  return `${wire.linkType}: ${from} to ${to}`;
}

// Removes a stamp and the manual wires attached to it.
function removeTakeoffStamp(stampId) {
  const stamp = state.takeoff.markups.find(mark => mark.id === stampId);
  if (!stamp) return;
  const info = planWireStampInfo(stamp, state.takeoff.catalog);
  const wires = planWiresAttachedTo(stampId);
  const ids = new Set([stampId, ...wires.map(wire => wire.id)]);
  state.takeoff.markups = state.takeoff.markups.filter(mark => !ids.has(mark.id));
  if (takeoffWireDraft?.fromId === stampId) takeoffWireDraft = null;
  takeoffLabelPreview = null;
  saveState("Mark deleted");
  window.renderPlanTakeoff();
  const text = `Removed ${info.label} · ${info.model || info.name}${wires.length ? ` and ${wires.length} wire${wires.length === 1 ? "" : "s"}` : ""}`;
  showToast(text);
  takeoffAnnounce(text);
}

function confirmDeleteStampWithWires(stampId) {
  const stamp = state.takeoff.markups.find(mark => mark.id === stampId);
  if (!stamp) return;
  const info = planWireStampInfo(stamp, state.takeoff.catalog);
  const wires = planWiresAttachedTo(stampId);
  showModal(`${modalHeader(`Delete ${info.label} and ${wires.length} attached wire${wires.length === 1 ? "" : "s"}?`, "These wires connect to this mark and are deleted with it.")}<div class="modal-body"><ul>${wires.map(wire => `<li>${escapeHTML(planWireDescribe(wire))}</li>`).join("")}</ul></div><footer class="modal-footer"><button class="secondary-button" type="button" id="cancel-delete-stamp" data-modal-close>Cancel</button><button class="danger-button" type="button" id="confirm-delete-stamp">Delete mark and wires</button></footer>`);
  window.setTimeout(() => $("#cancel-delete-stamp")?.focus(), 40);
  $("#confirm-delete-stamp").addEventListener("click", () => { closeModal(); removeTakeoffStamp(stampId); });
}

// Newest stamp on this sheet by createdAt (array order breaks ties).
function undoLastTakeoffMark() {
  const page = Number(state.takeoff.activePage);
  let newest = null;
  for (const mark of state.takeoff.markups) {
    if (mark.type === "stamp" && Number(mark.page) === page && (!newest || (mark.createdAt || "") >= (newest.createdAt || ""))) newest = mark;
  }
  if (!newest) { showToast("Nothing to undo on this sheet"); return; }
  if (planWiresAttachedTo(newest.id).length) { confirmDeleteStampWithWires(newest.id); return; }
  removeTakeoffStamp(newest.id);
}

// One capture-phase listener, registered once. It runs before app.js's bubble
// Esc-closes-modal handler, and ignores keys while a modal is open.
function handleTakeoffKeydown(event) {
  if (state.currentView !== "takeoff" || !modalBackdrop.classList.contains("hidden")) return;
  const typing = element => element?.closest?.("input, select, textarea") || element?.isContentEditable;
  // Esc leaves stamp mode even from the toolbox search box (focus lands there on entry); Ctrl+Z stays with the field.
  const inToolboxSearch = event.key === "Escape" && takeoffMode === "stamp" && event.target?.id === "takeoff-toolbox-search";
  if (!inToolboxSearch && (typing(event.target) || typing(document.activeElement))) return;
  if (event.key === "Escape") {
    const hadDraft = Boolean(wireDraft()?.points.length || takeoffPolylineDraft?.points?.length || takeoffCalibrationPoint || takeoffRoomDrag);
    if (!hadDraft && takeoffMode === "select") return;
    cancelPlanWireDraft();
    takeoffPolylineDraft = null;
    takeoffCalibrationPoint = null;
    takeoffRoomDrag = null;
    takeoffMode = "select";
    event.preventDefault();
    window.renderPlanTakeoff();
    return;
  }
  if ((event.ctrlKey || event.metaKey) && !event.shiftKey && !event.altKey && event.key.toLowerCase() === "z") {
    if (takeoffMode === "wire" && wireDraft()?.points.length) {
      const draft = wireDraft();
      if (draft.points.length > 1) draft.points.pop();
      refreshPlanWireDraft();
    } else if (takeoffMode === "polyline" && spaceDraftPoints().length) {
      spaceDraftPoints().pop();
      refreshSpaceDraft();
    } else undoLastTakeoffMark();
    event.preventDefault();
  }
}
document.addEventListener("keydown", handleTakeoffKeydown, true);

// ---- Draw wire ----

function currentWireType() {
  return PLAN_WIRE_TYPES.includes(takeoffWireType) ? takeoffWireType : PLAN_WIRE_TYPES[0];
}

function wireDraft() {
  return takeoffWireDraft && takeoffWireDraft.owner === state.takeoff && takeoffWireDraft.page === Number(state.takeoff.activePage) ? takeoffWireDraft : null;
}

function planSheetAspect() {
  return planSheetSize.height / planSheetSize.width;
}

function planWireDraftInfo(page = Number(state.takeoff.activePage)) {
  const draft = wireDraft();
  if (!draft?.points.length) {
    const any = state.takeoff.markups.some(mark => mark.type === "stamp" && Number(mark.page) === page);
    return { status: any ? "Click a device to start" : "Place devices on the plan first", length: "", canUndo: false };
  }
  const count = draft.points.length;
  const feet = planWireLengthFeet(draft.points, state.takeoff.scale, page, planSheetAspect());
  return { status: `From ${planWireEndInfo(draft.fromId)?.label || "?"} · ${count} point${count === 1 ? "" : "s"}`, length: `Length so far: ${planWireLengthText(feet)}`, canUndo: count > 1 };
}

function takeoffWireDraftRowHTML(page) {
  const info = planWireDraftInfo(page);
  return `<div class="space-draft-tools wire-draft-tools" aria-label="Wire controls"><label class="compact-field">Wire type<select id="takeoff-wire-type">${PLAN_WIRE_TYPES.map(type => `<option value="${escapeHTML(type)}" ${type === currentWireType() ? "selected" : ""}>${escapeHTML(type)}</option>`).join("")}</select></label><span id="takeoff-wire-status" aria-live="polite">${escapeHTML(info.status)}</span><span id="takeoff-wire-length" ${info.length ? "" : "hidden"}>${escapeHTML(info.length)}</span><button type="button" class="secondary-button" id="takeoff-wire-undo-point" ${info.canUndo ? "" : "disabled"}>Undo point</button><button type="button" class="ghost-button" id="takeoff-wire-cancel">Cancel</button></div>`;
}

// Repaints only #plan-wire-draft: committed segments, rubber band, rings.
function paintWireDraft() {
  const group = $("#plan-wire-draft");
  const overlay = $("#takeoff-overlay");
  if (!group || !overlay) return;
  if (takeoffMode !== "wire" || !planWiringVisible) { group.innerHTML = ""; return; }
  const width = overlay.viewBox.baseVal.width, height = overlay.viewBox.baseVal.height;
  const draft = wireDraft();
  const hover = planWirePointer ? planWireHitStamp(state.takeoff.markups, state.takeoff.activePage, planWirePointer, width, height) : null;
  group.innerHTML = planWireDraftSVG(draft && { points: draft.points, fromId: draft.fromId, linkType: currentWireType() }, draft ? planWirePointer : null, hover, width, height);
}

function refreshPlanWireDraft() {
  paintWireDraft();
  if (takeoffMode !== "wire") return;
  const info = planWireDraftInfo();
  const status = $("#takeoff-wire-status"), length = $("#takeoff-wire-length"), undo = $("#takeoff-wire-undo-point");
  if (status) status.textContent = info.status;
  if (length) { length.textContent = info.length; length.hidden = !info.length; }
  if (undo) undo.disabled = !info.canUndo;
}

function cancelPlanWireDraft(silent = false) {
  const hadClick = Boolean(wireDraft()?.points.length);
  takeoffWireDraft = null;
  if (hadClick && !silent) showToast("Wire draft cancelled");
  refreshPlanWireDraft();
}

function handlePlanWireClick(point, overlay) {
  const width = overlay.viewBox.baseVal.width, height = overlay.viewBox.baseVal.height;
  const page = Number(state.takeoff.activePage);
  const hit = planWireHitStamp(state.takeoff.markups, page, point, width, height);
  const draft = wireDraft();
  if (!draft?.points.length) {
    if (!hit) { showToast("Start the wire on a device stamp"); return; }
    takeoffWireDraft = { owner: state.takeoff, page, fromId: hit.id, points: [{ x: hit.x, y: hit.y }], aspect: height / width };
    if (planWiringVisible) refreshPlanWireDraft();
    else { planWiringVisible = true; window.renderPlanTakeoff(); }
    return;
  }
  if (hit) {
    if (hit.id === draft.fromId) { showToast("Choose a different device to end the wire"); return; }
    draft.points.push({ x: hit.x, y: hit.y });
    savePlanWireDraft(hit, height / width);
    return;
  }
  const last = draft.points.at(-1);
  if (Math.hypot(point.x - last.x, point.y - last.y) > 0.0005) draft.points.push(point);
  refreshPlanWireDraft();
}

function savePlanWireDraft(endStamp, aspect) {
  const draft = wireDraft();
  if (!draft) return;
  const wire = { id: newRecordId(), type: "wire", page: draft.page, linkType: currentWireType(), points: draft.points.map(point => ({ x: point.x, y: point.y })),
    fromMarkupId: draft.fromId, toMarkupId: endStamp.id, sheetAspect: aspect, createdAt: new Date().toISOString() };
  state.takeoff.markups.push(wire);
  takeoffWireDraft = null;
  saveState("Wire saved");
  window.renderPlanTakeoff();
  showToast(`${wire.linkType} wire saved · ${planWireEndInfo(wire.fromMarkupId)?.label || "?"} to ${planWireEndInfo(wire.toMarkupId)?.label || "?"}`);
  takeoffAnnounce("Wire saved");
}

function openPlanWireEditor(wireId) {
  const wire = state.takeoff.markups.find(mark => mark.id === wireId && mark.type === "wire");
  if (!wire) return;
  const { points, missing } = planWireResolvedPoints(wire, state.takeoff.markups);
  const [from, to] = [wire.fromMarkupId, wire.toMarkupId].map(id => planWireEndInfo(id));
  const end = info => info ? `${info.label} · ${info.model || info.name}` : "?";
  const feet = planWireLengthFeet(points, state.takeoff.scale, wire.page, wire.sheetAspect || planSheetAspect());
  planWireSelectedId = wire.id;
  const overlay = $("#takeoff-overlay");
  if (overlay) renderTakeoffOverlay(overlay.viewBox.baseVal.width, overlay.viewBox.baseVal.height);
  // The halo stays while the modal is open; app.js owns closeModal, so watch the backdrop.
  const watcher = new MutationObserver(() => {
    if (!modalBackdrop.classList.contains("hidden")) return;
    watcher.disconnect();
    planWireSelectedId = "";
    const current = $("#takeoff-overlay");
    if (current) renderTakeoffOverlay(current.viewBox.baseVal.width, current.viewBox.baseVal.height);
  });
  watcher.observe(modalBackdrop, { attributes: true, attributeFilter: ["class"] });
  showModal(`
    ${modalHeader("Edit wire", `${end(from)} to ${end(to)} · page ${wire.page}`)}
    <form id="takeoff-wire-form"><div class="modal-body"><div class="form-grid">
      ${fieldHTML({ key: "linkType", label: "Wire type", type: "select", required: true, options: PLAN_WIRE_TYPES }, wire.linkType)}
    </div>
    <dl class="takeoff-source"><dt>Length</dt><dd>${escapeHTML(planWireLengthText(feet))}</dd><dt>Points</dt><dd>${points.length} points</dd></dl>
    <p class="field-help">${feet == null ? "Calibrate this sheet to see a length." : "Length follows the sheet calibration, rounded up to a whole foot."}</p>
    ${missing ? `<div class="design-rule warning">${icon("alert")}<span>Endpoint missing: a device on this wire was deleted. The wire follows its stored points. Delete it or draw a new one.</span></div>` : ""}
    </div><footer class="modal-footer"><button class="danger-button" type="button" id="delete-plan-wire">${svgButtonLabel("trash", "Delete wire")}</button><button class="secondary-button" type="button" data-modal-close>Cancel</button><button class="primary-button" type="submit">Save</button></footer></form>`);
  $("#takeoff-wire-form").addEventListener("submit", event => {
    event.preventDefault();
    const linkType = new FormData(event.currentTarget).get("linkType");
    if (!linkType) return;
    wire.linkType = linkType;
    saveState("Wire updated"); closeModal(); window.renderPlanTakeoff();
  });
  $("#delete-plan-wire").addEventListener("click", () => {
    state.takeoff.markups = state.takeoff.markups.filter(mark => mark.id !== wire.id);
    saveState("Wire deleted"); closeModal(); window.renderPlanTakeoff();
    showToast("Wire deleted");
  });
}

ensureTakeoffState();
if (state.currentView === "takeoff") render();
