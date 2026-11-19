"use strict";

const isWiredDemo = new URLSearchParams(location.search).get("demo") === "wired10";
const projectStorage = isWiredDemo ? sessionStorage : localStorage;
const STORAGE_KEY = isWiredDemo ? "zum-wired-demo-v1" : "crestron-zum-system-planner-v1";

const icons = {
  check: '<path d="m5 12 4 4L19 6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 15H6L5 6M10 11v6M14 11v6"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.6v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z"/>',
  database: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/>',
  report: '<path d="M6 2h9l4 4v16H6Z"/><path d="M14 2v5h5M9 12h7M9 16h7"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  arrow: '<path d="M5 12h14M14 7l5 5-5 5"/>',
  download: '<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>',
  upload: '<path d="M12 16V4M7 9l5-5 5 5M5 21h14"/>',
  printer: '<path d="M7 8V3h10v5M7 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2"/><path d="M7 14h10v7H7Z"/>',
  bulb: '<path d="M9 18h6M10 22h4M8.5 15.5a7 7 0 1 1 7 0c-.9.7-1.5 1.5-1.5 2.5h-4c0-1-.6-1.8-1.5-2.5Z"/>',
  shade: '<path d="M4 4h16v4H4ZM6 8v12M18 8v12M9 12h6M9 16h6"/>',
  controls: '<rect x="5" y="3" width="14" height="18" rx="2"/><circle cx="12" cy="9" r="2"/><path d="M9 15h6"/>',
  equipment: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7h8M8 11h8M8 15h4M16 15h.01"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.1 0l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1M14 11a5 5 0 0 0-7.1 0l-2 2A5 5 0 0 0 12 20.1l1.1-1.1"/>',
  lineItem: '<path d="M8 6h13M8 12h13M8 18h13"/><path d="M3 6h.01M3 12h.01M3 18h.01"/>',
  area: '<path d="m3 11 9-8 9 8"/><path d="M5 10v11h14V10M9 21v-7h6v7"/>',
  scenes: '<path d="M4 19h16M6 16l3-7 3 5 3-10 3 12"/>',
  money: '<circle cx="12" cy="12" r="9"/><path d="M15 8.5c-.7-.7-1.7-1-3-1-1.7 0-3 .9-3 2s1 1.7 3 2.1 3 1 3 2.2-1.3 2.2-3 2.2c-1.4 0-2.5-.4-3.3-1.2M12 5.5v13"/>',
  layers: '<path d="m12 2 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5M3 17l9 5 9-5"/>',
  bolt: '<path d="m13 2-9 12h7l-1 8 9-12h-7Z"/>',
  file: '<path d="M6 2h9l4 4v16H6Z"/><path d="M14 2v5h5"/>',
  alert: '<path d="M12 3 2.8 20h18.4L12 3Z"/><path d="M12 9v5M12 17h.01"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/>'
};

function icon(name, label = "") {
  const aria = label ? `role="img" aria-label="${escapeHTML(label)}"` : 'aria-hidden="true"';
  return `<svg ${aria} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${icons[name] || icons.file}</svg>`;
}

const STAGES = [
  {
    id: "loads",
    label: "Define Loads & Zones",
    short: "Loads & Zones",
    icon: "bulb",
    description: "Document each controlled lighting or plug-load zone and its electrical/control requirements.",
    singular: "load zone",
    fields: [
      { key: "name", label: "Load / zone name", required: true, placeholder: "Conference downlights" },
      { key: "area", label: "Zūm space", required: true, placeholder: "Conference 201" },
      { key: "fixtureType", label: "Load type", type: "select", options: ["LED lighting", "Fluorescent lighting", "Incandescent / tungsten", "Electronic low-voltage", "Magnetic low-voltage", "HID", "Plug load", "Shade motor", "Other"] },
      { key: "controlType", label: "Control protocol", type: "select", options: ["0-10 V dimming", "DALI", "Phase control", "Switching", "Plug-load switching", "DMX", "Other"] },
      { key: "voltage", label: "Branch voltage", type: "select", options: ["100-277 VAC", "120 VAC", "208 VAC", "230 VAC", "277 VAC", "24 VDC", "Other"] },
      { key: "watts", label: "Watts each", type: "number", min: 0, placeholder: "18" },
      { key: "quantity", label: "Quantity", type: "number", min: 1, default: 1, required: true },
      { key: "emergency", label: "Emergency behavior", type: "select", options: ["Normal", "Emergency / UL 924", "Override via GLS-PLS", "To be confirmed"] },
      { key: "notes", label: "Circuit / dimming notes", type: "textarea", full: true }
    ],
    columns: ["name", "area", "fixtureType", "controlType", "voltage", "quantity"]
  },
  {
    id: "controllers",
    label: "Select Load Controllers",
    short: "Load Controllers",
    icon: "equipment",
    description: "Choose the Zūm Net, Zūm Link, or Zūm Mesh controller that serves each space and load type.",
    singular: "load controller",
    fields: [
      { key: "name", label: "Controller name", required: true, placeholder: "Conference primary controller" },
      { key: "area", label: "Zūm space", required: true, placeholder: "Conference 201" },
      { key: "model", label: "Crestron model", type: "select", required: true, options: ["ZUMNET-JBOX-16A-LV", "ZUMNET-JBOX-DALI", "ZUMNET-DIN-16A-LV", "ZUMNET-DIN-DLI", "ZUMLINK-JBOX-16A-LV", "ZUMLINK-JBOX-20A-SW", "ZUMLINK-JBOX-20A-PLUG", "ZUMLINK-EXP-16A-DIMU", "ZUMLINK-DIN-16A-LV", "ZUMLINK-DIN-20A-SW", "ZUMLINK-DIN-20A-PLUG", "ZUMLINK-DIN-DIMU", "ZUMMESH-JBOX-16A-LV", "ZUMMESH-JBOX-16A-LV-EM", "ZUMMESH-JBOX-5A-LV", "ZUMMESH-JBOX-20A-SW", "ZUMMESH-JBOX-20A-PLUG", "ZUMMESH-JBOX-DALI", "ZUMMESH-EXP-16A-DIMU", "ZUMMESH-DIM", "ZUMMESH-DELV", "ZUMMESH-5A-LV", "ZUMMESH-5A-SW"] },
      { key: "networkRole", label: "System role", type: "select", required: true, options: ["Zūm Net primary controller", "Zūm Link load controller", "Zūm Mesh load controller", "Standalone load controller"] },
      { key: "loadCapability", label: "Load capability", type: "select", options: ["16 A 0-10 V", "5 A 0-10 V", "20 A switching", "20 A plug load", "DALI - 64 addresses", "Universal phase dimming", "Other"] },
      { key: "feed", label: "Power feed", type: "select", options: ["100-277 VAC", "120 VAC", "230 VAC", "277 VAC", "Other"] },
      { key: "quantity", label: "Quantity", type: "number", min: 1, default: 1, required: true },
      { key: "notes", label: "Assignment notes", type: "textarea", full: true }
    ],
    columns: ["name", "area", "model", "networkRole", "loadCapability", "quantity"]
  },
  {
    id: "roomDevices",
    label: "Add Keypads & Sensors",
    short: "Keypads & Sensors",
    icon: "controls",
    description: "Add Zūm keypads, presence detectors, photosensors, and integration devices to each space.",
    singular: "room device",
    fields: [
      { key: "name", label: "Device name", required: true, placeholder: "Entry scene keypad" },
      { key: "area", label: "Zūm space", required: true },
      { key: "model", label: "Crestron model", type: "select", options: ["ZUMLINK-KP", "ZUMLINK-BTN2", "ZUMLINK-BTN4", "ZUMLINK-BTN6", "ZUMLINK-BTN8", "ZUMLINK-IR-QUATTRO-DLS", "ZUMLINK-DT-QUATTRO-DLS", "ZUMLINK-IR-QUATTRO-HD-DLS", "ZUMLINK-US-QUATTRO-DLS", "ZUMLINK-US-HALLWAY-DLS", "ZUMLINK-US-ONEWAY-DLS", "ZUMMESH-KP10A", "ZUMMESH-KP10B", "ZUMMESH-KP10ABATT", "ZUMMESH-KP10BBATT", "ZUMMESH-KP10CBATT", "ZUMMESH-KP10DBATT", "ZUMMESH-PIR-OCC-BATT", "ZUMMESH-PIR-VAC-BATT", "ZUMMESH-OL-PHOTOCELL-BATT", "ZUMMESH-JBOX-SIM", "ZUMMESH-CCO", "Other"] },
      { key: "deviceType", label: "Device type", type: "select", options: ["Keypad", "Occupancy sensor", "Vacancy sensor", "Presence detector", "Daylight sensor", "Integration interface", "Contact closure output", "Other"] },
      { key: "connection", label: "Connection", type: "select", options: ["Zūm Link", "Zūm Mesh", "24 VDC analog", "Contact closure", "Bluetooth setup"] },
      { key: "function", label: "Primary function", placeholder: "ON / Scene 2 / Scene 3 / OFF" },
      { key: "quantity", label: "Quantity", type: "number", min: 1, default: 1, required: true },
      { key: "notes", label: "Configuration notes", type: "textarea", full: true }
    ],
    columns: ["name", "area", "model", "deviceType", "connection", "quantity"]
  },
  {
    id: "network",
    label: "Define Network & Hubs",
    short: "Network & Hubs",
    icon: "layers",
    description: "Lay out ZUM-HUB4 processors, PoE switches, wired gateways, and wireless room bridges.",
    singular: "network component",
    fields: [
      { key: "name", label: "Component name", required: true, placeholder: "Main Zūm hub" },
      { key: "area", label: "Location", required: true, placeholder: "Electrical room 1A" },
      { key: "model", label: "Crestron model", type: "select", required: true, options: ["ZUM-HUB4", "ZUML-HUB4", "ZUML-HUB4-GW", "ZUML-HUB4-SWPOE-5", "ZUML-HUB4-SWPOE-26", "ZUML-CENCN-SWPOE-5", "ZUML-SWPOE-26", "CEN-SWPOE-5AC", "CEN-SWPOE-26", "ZUMNET-GATEWAY", "ZUMMESH-NETBRIDGE", "ZUMMESH-AVBRIDGE", "Other"] },
      { key: "equipmentType", label: "Network role", type: "select", options: ["Zūm Hub", "PoE network switch", "Zūm Net wireless gateway", "Zūm Mesh network bridge", "AV bridge", "Control subnet interface", "Other"] },
      { key: "connection", label: "Upstream connection", type: "select", options: ["Ethernet", "Ethernet / PoE", "Zūm Net wired", "Zūm Net wireless", "Zūm Mesh", "Control subnet"] },
      { key: "voltage", label: "Power", type: "select", options: ["100-240 VAC", "100-277 VAC", "24 VDC", "PoE", "Other"] },
      { key: "quantity", label: "Quantity", type: "number", min: 1, default: 1, required: true },
      { key: "notes", label: "Network notes", type: "textarea", full: true }
    ],
    columns: ["name", "area", "model", "equipmentType", "connection", "quantity"]
  },
  {
    id: "links",
    label: "Assign Wiring & Links",
    short: "Wiring & Links",
    icon: "link",
    description: "Document Zūm Net, Zūm Link, mesh, Ethernet, analog, and load-control paths.",
    singular: "connection",
    fields: [
      { key: "name", label: "Connection name", required: true, placeholder: "Zūm Net run A" },
      { key: "linkType", label: "Connection type", type: "select", required: true, options: ["Zūm Net", "Zūm Link", "Zūm Mesh", "Ethernet / PoE", "Cresnet", "0-10 V control", "DALI loop", "SW or LV load control", "24 VDC analog", "Emergency override"] },
      { key: "source", label: "Source", required: true, placeholder: "CEN-SWPOE-5AC Port 1" },
      { key: "destination", label: "Destination / scope", required: true, placeholder: "Conference 201 primary controller" },
      { key: "length", label: "Estimated length (ft)", type: "number", min: 0 },
      { key: "maxSpan", label: "Longest Zūm Net device-to-device span (ft)", type: "number", min: 0 },
      { key: "capacity", label: "Devices on run", type: "number", min: 0 },
      { key: "status", label: "Design status", type: "select", options: ["Planned", "Assigned", "Needs review"] },
      { key: "notes", label: "Cable / topology notes", type: "textarea", full: true }
    ],
    columns: ["name", "linkType", "source", "destination", "length", "status"]
  },
  {
    id: "lineItems",
    label: "Add Accessories & Services",
    short: "Accessories",
    icon: "lineItem",
    description: "Capture Zūm power supplies, cables, splitters, interfaces, enclosures, and commissioning services.",
    singular: "accessory or service",
    fields: [
      { key: "name", label: "Item name", required: true, placeholder: "Zūm Link cable" },
      { key: "category", label: "Category", type: "select", options: ["Cable", "Power supply", "Splitter / adapter", "Integration", "Enclosure", "Faceplate / buttons", "Software license", "Commissioning service", "Other"] },
      { key: "model", label: "Crestron model / reference", type: "select", options: ["CBL-CAT5E-ZUMNET-P", "CBL-CAT5E-ZUMLINK-P", "ZUMLINK-JBOX-PSU", "ZUMLINK-DIN-PSU", "ZUMLINK-SPLTR-RJ45", "ZUMLINK-CONV-CN", "ZUMLINK-JBOX-IO", "ZUMLINK-DIN-IO", "CSA-PWS2S-JBOX-ZUMLINK-CN", "SW-HUB4-PROG", "FP-G Series", "Other"] },
      { key: "unitPrice", label: "Unit price", type: "number", min: 0, step: "0.01" },
      { key: "quantity", label: "Quantity", type: "number", min: 1, default: 1, required: true },
      { key: "notes", label: "Scope notes", type: "textarea", full: true }
    ],
    columns: ["name", "category", "model", "unitPrice", "quantity", "extended"]
  },
  {
    id: "spaceBehavior",
    label: "Define Space Behavior",
    short: "Space Behavior",
    icon: "area",
    description: "Define occupancy, vacancy, daylight, emergency, and manual control behavior by Zūm space.",
    singular: "space behavior",
    fields: [
      { key: "area", label: "Zūm space", required: true, placeholder: "Conference 201" },
      { key: "roomType", label: "Room category", type: "select", options: ["Office", "Conference", "Classroom", "Corridor", "Lobby", "Restroom", "Open office", "Exterior", "Other"] },
      { key: "autoOn", label: "Occupancy behavior", type: "select", options: ["Manual on", "Occupancy to 100%", "Occupancy to 50%", "Scheduled on", "No automatic on"] },
      { key: "autoOff", label: "Vacancy behavior", type: "select", options: ["Vacancy timeout - 15 min", "Vacancy timeout - 20 min", "Vacancy timeout - 30 min", "Scheduled off", "No automatic off"] },
      { key: "manualControl", label: "Manual control", placeholder: "ZUMLINK-KP: ON / Scene 2 / Scene 3 / OFF" },
      { key: "daylighting", label: "Daylighting", type: "select", options: ["Not required", "Continuous 0-10 V dimming", "DALI daylight regulation", "Switched daylight zone", "To be confirmed"] },
      { key: "emergency", label: "Emergency override", type: "select", options: ["Not required", "GLS-PLS override", "UL 924 controller", "BMS / integration command", "To be confirmed"] },
      { key: "notes", label: "Sequence-of-operations notes", type: "textarea", full: true }
    ],
    columns: ["area", "roomType", "autoOn", "autoOff", "manualControl", "daylighting"]
  },
  {
    id: "scenes",
    label: "Define Scenes & Schedules",
    short: "Scenes & Schedules",
    icon: "scenes",
    description: "Define room presets and ZUM-HUB4 timeclock events for coordinated operation.",
    singular: "scene or schedule",
    fields: [
      { key: "name", label: "Scene / event name", required: true, placeholder: "Presentation" },
      { key: "area", label: "Zūm space", required: true, placeholder: "Conference 201" },
      { key: "lights", label: "Lighting behavior", placeholder: "Downlights 30%, perimeter off" },
      { key: "trigger", label: "Trigger", type: "select", options: ["ZUMLINK-KP", "ZUMMESH-KP", "ZUM-HUB4 timeclock", "Occupancy", "BACnet / BMS", "Contact closure", "Manual"] },
      { key: "schedule", label: "Schedule / day pattern", placeholder: "Weekdays 18:00" },
      { key: "notes", label: "Scene notes", type: "textarea", full: true }
    ],
    columns: ["name", "area", "lights", "trigger", "schedule"]
  }
];

const REPORTS = [
  { id: "takeoff", name: "Plan Takeoff Register", icon: "layers", description: "Counted drawing symbols, mapped products, spaces, quantities, and source-sheet references." },
  { id: "bom", name: "Zūm Bill of Material", icon: "layers", description: "Crestron controllers, room devices, network components, and accessories." },
  { id: "loadSchedule", name: "Load & Zone Schedule", icon: "bolt", description: "Controlled zones, protocols, branch voltage, quantities, and wattage." },
  { id: "oneLine", name: "Zūm Wiring One-Line", icon: "link", description: "Generated system wiring diagram with Zūm Net, Zūm Link, mesh, and load paths." },
  { id: "soo", name: "Sequence of Operations", icon: "file", description: "Space-by-space occupancy, vacancy, daylight, emergency, and scene behavior." },
  { id: "controlIntent", name: "Device & Control Intent", icon: "controls", description: "Keypads, sensors, and intended functions in each Zūm space." },
  { id: "projectPackage", name: "Zūm Design Package", icon: "report", description: "A combined project summary, schedules, wiring diagram, and design checks." }
];

const defaultState = () => ({
  version: 2,
  spaces: [],
  designMode: "zum",
  project: {
    id: newRecordId(),
    name: "Untitled Zūm project",
    number: "",
    location: "",
    client: "",
    workflow: "Zūm System Design",
    product: "Crestron Zūm Lighting Control",
    architecture: "Zūm Wired",
    voltage: "100-277 VAC",
    rfFrequency: "Zūm Net wired only",
    lineFrequency: "60 Hz",
    units: "Imperial",
    currency: "USD",
    notes: ""
  },
  records: Object.fromEntries(STAGES.map(stage => [stage.id, []])),
  takeoff: {
    document: null,
    activePage: 1,
    scale: null,
    markups: [],
    catalog: [],
    analysis: null,
    lastSyncAt: null
  },
  currentView: "loads",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
});

let state = loadState();
let searchTerm = "";
let wizardStep = 0;
let wizardDraft = null;

const $ = selector => document.querySelector(selector);
const appShell = $("#app-shell");
const workspace = $("#workspace");
const modalBackdrop = $("#modal-backdrop");
const modal = $("#modal");

function newRecordId() {
  if (globalThis.crypto.randomUUID) return globalThis.crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
  return [hex.slice(0,8), hex.slice(8,12), hex.slice(12,16), hex.slice(16,20), hex.slice(20)].join("-");
}

function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function titleCase(value) {
  return String(value || "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, char => char.toUpperCase());
}

function svgButtonLabel(iconName, text) {
  return `${icon(iconName)}<span>${escapeHTML(text)}</span>`;
}

function loadState() {
  try {
    const stored = projectStorage.getItem(STORAGE_KEY);
    if (!stored) return defaultState();
    const parsed = JSON.parse(stored);
    const fresh = defaultState();
    return {
      ...fresh,
      ...parsed,
      designMode: parsed.designMode || (Object.values(parsed.records || {}).some(rows => rows.length) ? "custom" : "zum"),
      project: { ...fresh.project, ...(parsed.project || {}) },
      records: { ...fresh.records, ...(parsed.records || {}) },
      takeoff: { ...fresh.takeoff, ...(parsed.takeoff || {}) }
    };
  } catch (error) {
    console.warn("Unable to load saved project", error);
    return defaultState();
  }
}

function saveState(message = "Saved locally") {
  state.updatedAt = new Date().toISOString();
  projectStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  const label = $("#save-state-text");
  if (label) label.textContent = message;
  window.setTimeout(() => {
    if (label) label.textContent = "Saved locally";
  }, 1300);
}

function hasInitializedProject() {
  return Boolean(projectStorage.getItem(STORAGE_KEY));
}

function currentStage() {
  return STAGES.find(stage => stage.id === state.currentView) || STAGES[0];
}

function recordsFor(stageId) {
  return state.records[stageId] || [];
}

function totalQuantity(stageId) {
  return recordsFor(stageId).reduce((sum, record) => sum + Number(record.quantity || 1), 0);
}

function formatCurrency(value) {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: state.project.currency || "USD", maximumFractionDigits: 2 }).format(Number(value || 0));
  } catch {
    return `$${Number(value || 0).toFixed(2)}`;
  }
}

function totalWattage() {
  return recordsFor("loads").reduce((sum, record) => sum + (Number(record.watts) || 0) * Number(record.quantity || 1), 0);
}

function wattageNote() {
  const missing = recordsFor("loads").filter(row => !String(row.watts ?? "").trim() || !Number.isFinite(Number(row.watts))).length;
  return missing ? `Partial total · watts required for ${missing} load record(s)` : "Quantity-adjusted total";
}

function materialEstimate() {
  return recordsFor("lineItems").reduce((sum, record) => sum + Number(record.unitPrice || 0) * Number(record.quantity || 1), 0);
}

function completedStages() {
  return STAGES.filter(stage => recordsFor(stage.id).length > 0).length;
}

function render() {
  renderProjectIdentity();
  renderNavigation();
  renderTopbar();
  if (state.currentView === "takeoff") {
    if (typeof window.renderPlanTakeoff === "function") window.renderPlanTakeoff();
    else workspace.innerHTML = '<div class="empty-state"><h3>Loading plan takeoff…</h3></div>';
  } else if (state.currentView === "reports") renderReports();
  else renderStage(currentStage());
}

function renderProjectIdentity() {
  $("#project-identity").innerHTML = `
    <p class="project-label">${icon("file")} Active project</p>
    <h2 title="${escapeHTML(state.project.name)}">${escapeHTML(state.project.name)}</h2>
    <p>${escapeHTML(state.project.number || "No project number")} · ${escapeHTML(state.project.location || "Location not set")}</p>
  `;
}

function renderNavigation() {
  const items = STAGES.map((stage, index) => {
    const isActive = state.currentView === stage.id;
    const completed = recordsFor(stage.id).length > 0;
    return `
      <button class="nav-item ${isActive ? "active" : ""} ${completed ? "completed" : ""}" type="button" data-view="${stage.id}">
        <span class="nav-number">${completed ? icon("check") : index + 1}</span>
        <span>${escapeHTML(stage.short)}</span>
        <span class="nav-status">${completed ? icon("check") : ""}</span>
      </button>`;
  }).join("");

  $("#workflow-nav").innerHTML = `
    <p class="nav-label">Drawing intake</p>
    <button class="nav-item ${state.currentView === "takeoff" ? "active" : ""} ${state.takeoff.markups.length ? "completed" : ""}" type="button" data-view="takeoff">
      <span class="nav-number">${state.takeoff.markups.length ? icon("check") : icon("layers")}</span>
      <span>Plan Takeoff</span>
      <span class="nav-status">${state.takeoff.markups.length ? icon("check") : ""}</span>
    </button>
    <p class="nav-label">Design sequence</p>
    ${items}
    <p class="nav-label">Documentation</p>
    <button class="nav-item ${state.currentView === "reports" ? "active" : ""}" type="button" data-view="reports">
      <span class="nav-number">${icon("report")}</span>
      <span>Reports &amp; package</span>
      <span class="nav-status"></span>
    </button>`;

  $("#project-settings-button").innerHTML = svgButtonLabel("settings", "Project settings");
  $("#design-reference-button").innerHTML = svgButtonLabel("info", "Zūm design reference");
  $("#data-tools-button").innerHTML = svgButtonLabel("database", "Project data");
  $("#mobile-menu-button").innerHTML = icon("menu");
}

function renderTopbar() {
  const isTakeoff = state.currentView === "takeoff";
  const stage = state.currentView === "reports" || isTakeoff ? null : currentStage();
  $("#breadcrumb").innerHTML = `
    <p>${escapeHTML(state.project.workflow)} / ${isTakeoff ? "Drawing intake" : stage ? `Step ${STAGES.indexOf(stage) + 1} of ${STAGES.length}` : "Documentation"}</p>
    <h2>${isTakeoff ? "Plan Takeoff" : stage ? escapeHTML(stage.label) : "Reports & package"}</h2>`;

  $("#preview-report-button").innerHTML = svgButtonLabel("report", "Preview package");
  const addButton = $("#add-record-button");
  if (stage && !isTakeoff) {
    addButton.classList.remove("hidden");
    addButton.innerHTML = svgButtonLabel("plus", state.designMode === "zum" && ["loads","controllers"].includes(stage.id) ? "Add space" : `Add ${stage.singular}`);
  } else {
    addButton.classList.add("hidden");
  }
}

function stageMetrics(stage) {
  const records = recordsFor(stage.id);
  const grouped = state.designMode === "zum" && ["loads","controllers"].includes(stage.id);
  const areaCount = new Set([...records.map(record => record.area), ...(grouped ? state.spaces.map(s => s.name) : [])].filter(Boolean)).size;
  const metrics = [
    { icon: stage.icon, label: `${stage.short} records`, value: records.length, note: `${totalQuantity(stage.id)} total units` },
    { icon: "area", label: "Areas represented", value: areaCount, note: areaCount ? "Across this design step" : "Add an area to begin" }
  ];

  if (stage.id === "loads") {
    metrics.push({ icon: "bolt", label: "Connected load", value: `${totalWattage().toLocaleString()} W`, note: wattageNote() });
    metrics.push({ icon: "layers", label: "Control methods", value: new Set(records.map(r => r.controlType).filter(Boolean)).size, note: "Unique control types" });
  } else if (stage.id === "lineItems") {
    metrics.push({ icon: "money", label: "Line item estimate", value: formatCurrency(materialEstimate()), note: "Supplemental items only" });
    metrics.push({ icon: "layers", label: "Categories", value: new Set(records.map(r => r.category).filter(Boolean)).size, note: "Service and material groups" });
  } else {
    metrics.push({ icon: "layers", label: "Project completion", value: `${completedStages()}/${STAGES.length}`, note: "Design steps with content" });
    metrics.push({ icon: "report", label: "Available reports", value: availableReportCount(), note: "Based on current project data" });
  }
  return metrics;
}

function renderStage(stage) {
  const records = recordsFor(stage.id);
  const progress = Math.round((completedStages() / STAGES.length) * 100);
  workspace.innerHTML = `
    <div class="page-heading">
      <div class="page-heading-copy">
        <p class="kicker">Step ${STAGES.indexOf(stage) + 1} · ${escapeHTML(state.project.product)}</p>
        <h2>${escapeHTML(stage.label)}</h2>
        <p>${escapeHTML(stage.description)}</p>
      </div>
      <div class="step-progress" aria-label="Design completion ${progress}%">
        <div class="step-progress-label"><span>Design completion</span><strong>${progress}%</strong></div>
        <div class="progress-track"><div class="progress-fill" style="width:${progress}%"></div></div>
      </div>
    </div>
    <div class="metric-grid">
      ${stageMetrics(stage).map(metric => `
        <article class="metric-card">
          <p class="metric-label">${icon(metric.icon)} ${escapeHTML(metric.label)}</p>
          <p class="metric-value">${escapeHTML(metric.value)}</p>
          <p class="metric-note">${escapeHTML(metric.note)}</p>
        </article>`).join("")}
    </div>
    ${workflowSwitcherHTML(stage)}
    <section class="content-card">
      <div class="card-header">
        <div>
          <h3>${escapeHTML(stage.short)} schedule</h3>
          <p>${records.length ? `${records.length} record${records.length === 1 ? "" : "s"} in this step` : "No records yet"}</p>
        </div>
        <div class="card-header-actions">
          <label class="search-field">
            ${icon("search")}
            <input type="search" id="record-search" value="${escapeHTML(searchTerm)}" placeholder="Search ${escapeHTML(stage.short.toLowerCase())}…" aria-label="Search records" />
          </label>
        </div>
      </div>
      <div id="stage-records">${groupedStageHTML(stage, records)}</div>
    </section>`;
}

function filteredRecords(records) {
  const query = searchTerm.trim().toLowerCase();
  if (!query) return records;
  return records.filter(record => Object.values(record).some(value => String(value).toLowerCase().includes(query)));
}

function renderRecordTable(stage, records) {
  if (!records.length) {
    return `
      <div class="empty-state">
        <div class="empty-icon">${icon(stage.icon)}</div>
        <h3>Start defining ${escapeHTML(stage.short.toLowerCase())}</h3>
        <p>Add the first ${escapeHTML(stage.singular)} to establish this part of the Zūm system design.</p>
        <button class="primary-button" type="button" data-action="add">${svgButtonLabel("plus", `Add ${stage.singular}`)}</button>
      </div>`;
  }

  const visible = filteredRecords(records);
  if (!visible.length) {
    return `<div class="empty-state"><div class="empty-icon">${icon("search")}</div><h3>No matching records</h3><p>Try a different search term.</p></div>`;
  }

  return `
    <div class="data-table-wrap">
      <table class="data-table">
        <thead><tr>${stage.columns.map(column => `<th>${escapeHTML(columnLabel(column))}</th>`).join("")}<th><span class="hidden">Actions</span></th></tr></thead>
        <tbody>
          ${visible.map(record => `
            <tr>
              ${stage.columns.map((column, index) => `<td>${formatCell(stage, record, column, index)}</td>`).join("")}
              <td><div class="row-actions">
                <button class="row-action" type="button" data-action="edit" data-id="${record.id}" aria-label="Edit ${escapeHTML(stage.singular)}">${icon("edit")}</button>
                ${record.configured ? "" : `<button class="row-action delete" type="button" data-action="delete" data-id="${record.id}" aria-label="Delete ${escapeHTML(stage.singular)}">${icon("trash")}</button>`}
              </div></td>
            </tr>`).join("")}
        </tbody>
      </table>
    </div>`;
}

function columnLabel(column) {
  const map = { watts: "Watts ea.", quantity: "Qty.", unitPrice: "Unit price", extended: "Extended", autoOn: "Auto on", autoOff: "Auto off", manualControl: "Manual control", linkType: "Link type" };
  return map[column] || titleCase(column);
}

function formatCell(stage, record, column, index) {
  let value = record[column];
  if (column === "extended") value = formatCurrency(Number(record.unitPrice || 0) * Number(record.quantity || 1));
  else if (column === "unitPrice") value = formatCurrency(value);
  else if (column === "watts" && value !== "") value = `${Number(value || 0).toLocaleString()} W`;
  else if ((column === "width" || column === "height") && value) value = `${value} ${state.project.units === "Metric" ? "mm" : "in"}`;

  const safeValue = escapeHTML(value || "—");
  if (index === 0) {
    const detail = [record.assignmentDetail, record.notes].filter(Boolean).join(" · ");
    const subtitle = detail ? `<span class="record-subtitle">${escapeHTML(detail)}</span>` : "";
    return `<span class="record-name">${safeValue}</span>${subtitle}`;
  }
  if (["controlType", "linkType", "status", "category", "roomType", "trigger"].includes(column) && value) {
    const colors = { "Needs review": "rust", Planned: "gold", Assigned: "blue" };
    return `<span class="pill ${colors[value] || ""}">${safeValue}</span>`;
  }
  return safeValue;
}

function reportAvailability(reportId) {
  const has = stageId => recordsFor(stageId).length > 0;
  const rules = {
    takeoff: state.takeoff.markups?.some(mark => mark.type === "stamp"),
    bom: STAGES.slice(0, 6).some(stage => has(stage.id)),
    loadSchedule: has("loads"),
    oneLine: has("controllers") || has("network") || has("links"),
    soo: has("spaceBehavior") || has("scenes"),
    controlIntent: has("roomDevices") || has("spaceBehavior"),
    projectPackage: completedStages() > 0
  };
  return Boolean(rules[reportId]);
}

function availableReportCount() {
  return REPORTS.filter(report => reportAvailability(report.id)).length;
}

function renderReports() {
  const progress = Math.round((completedStages() / STAGES.length) * 100);
  workspace.innerHTML = `
    <div class="page-heading">
      <div class="page-heading-copy">
        <p class="kicker">Documentation center</p>
        <h2>Reports &amp; project package</h2>
        <p>Generate source-informed Zūm design documentation. Availability changes with the controllers, devices, and spaces in your project.</p>
      </div>
      <div class="step-progress" aria-label="Design completion ${progress}%">
        <div class="step-progress-label"><span>Design completion</span><strong>${progress}%</strong></div>
        <div class="progress-track"><div class="progress-fill" style="width:${progress}%"></div></div>
      </div>
    </div>
    <div class="metric-grid">
      <article class="metric-card"><p class="metric-label">${icon("report")} Available reports</p><p class="metric-value">${availableReportCount()}</p><p class="metric-note">Of ${REPORTS.length} core documents</p></article>
      <article class="metric-card"><p class="metric-label">${icon("layers")} Design steps</p><p class="metric-value">${completedStages()}/${STAGES.length}</p><p class="metric-note">Steps with project content</p></article>
      <article class="metric-card"><p class="metric-label">${icon("bolt")} Connected load</p><p class="metric-value">${totalWattage().toLocaleString()} W</p><p class="metric-note">${wattageNote()}</p></article>
      <article class="metric-card"><p class="metric-label">${icon("money")} Added line items</p><p class="metric-value">${formatCurrency(materialEstimate())}</p><p class="metric-note">Supplemental estimate</p></article>
    </div>
    <div class="report-grid">
      ${REPORTS.map(report => {
        const available = reportAvailability(report.id);
        return `<article class="report-card">
          <div class="report-card-top"><div class="report-icon">${icon(report.icon)}</div><span class="pill ${available ? "" : "gray"}">${available ? "Ready" : "Needs data"}</span></div>
          <h3>${escapeHTML(report.name)}</h3>
          <p>${escapeHTML(report.description)}</p>
          <button class="${available ? "secondary-button" : "ghost-button"}" type="button" data-report="${report.id}" ${available ? "" : "disabled"}>${svgButtonLabel("report", "Preview")}</button>
        </article>`;
      }).join("")}
    </div>`;
}

let modalOpener;
function showModal(content, wide = false) {
  if (modalBackdrop.classList.contains("hidden")) modalOpener = document.activeElement;
  appShell.inert = true;
  modal.className = `modal${wide ? " wide" : ""}`;
  modal.innerHTML = content;
  modal.scrollTop = 0;
  modalBackdrop.classList.remove("hidden");
  document.body.style.overflow = "hidden";
  window.setTimeout(() => modal.querySelector("input, select, textarea, button")?.focus(), 20);
}

function closeModal() {
  appShell.inert = false;
  modalBackdrop.classList.add("hidden");
  modal.innerHTML = "";
  document.body.style.overflow = "";
  if (modalOpener?.isConnected) modalOpener.focus();
}

function modalHeader(title, description) {
  return `<header class="modal-header"><div><h2 id="modal-title">${escapeHTML(title)}</h2><p>${escapeHTML(description)}</p></div><button class="icon-button" type="button" data-modal-close aria-label="Close dialog">${icon("close")}</button></header>`;
}

function fieldHTML(field, value = "") {
  const id = `field-${field.key}`;
  const required = field.required ? "required" : "";
  const classes = `field${field.full ? " full" : ""}`;
  const label = `<label for="${id}">${escapeHTML(field.label)}${field.required ? " <span>*</span>" : ""}</label>`;
  let control;
  if (field.type === "select") {
    const options = value && !field.options.includes(value) ? [value, ...field.options] : field.options;
    control = `<select id="${id}" name="${field.key}" ${required}><option value="">Select…</option>${options.map(option => `<option value="${escapeHTML(option)}" ${String(value) === option ? "selected" : ""}>${escapeHTML(option)}</option>`).join("")}</select>`;
  } else if (field.type === "textarea") {
    control = `<textarea id="${id}" name="${field.key}" placeholder="${escapeHTML(field.placeholder || "")}" ${required}>${escapeHTML(value)}</textarea>`;
  } else {
    const finalValue = value !== "" && value != null ? value : (field.default ?? "");
    control = `<input id="${id}" name="${field.key}" type="${field.type || "text"}" value="${escapeHTML(finalValue)}" placeholder="${escapeHTML(field.placeholder || "")}" ${field.min != null ? `min="${field.min}"` : ""} ${field.step ? `step="${field.step}"` : ""} ${required} />`;
  }
  return `<div class="${classes}">${label}${control}${field.help ? `<p class="field-help">${escapeHTML(field.help)}</p>` : ""}</div>`;
}

function openRecordModal(recordId = null, spaceId = null) {
  const stage = currentStage();
  const record = recordId ? recordsFor(stage.id).find(item => item.id === recordId) : null;
  const space = state.spaces.find(s => s.id === (record?.spaceId || spaceId));
  const categories = {controllers: ["controller"], roomDevices: ["keypad", "sensor", "interface"], network: ["network"], lineItems: ["accessory"]};
  const products = (window.CRESTRON_CATALOG?.products || []).filter(p => categories[stage.id]?.includes(p.category));
  const fields = stage.fields.map(field => field.key === "model" ? {...field, options: [...new Set([...products.map(p => p.model), ...field.options])]} : field);
  showModal(`
    ${modalHeader(record ? `Edit ${stage.singular}` : `Add ${stage.singular}`, stage.description)}
    <form id="record-form">
      <div class="modal-body"><div class="form-grid">${stage.id === "controllers" && !record?.configured ? fieldHTML({key:"zoneId",label:"Served zone",type:"select",options:[]}) : ""}${fields.map(field => fieldHTML(field, record?.[field.key] ?? "")).join("")}</div><div id="model-evidence" aria-live="polite"></div></div>
      <footer class="modal-footer">
        <button class="ghost-button" type="button" data-modal-close>Cancel</button>
        <button class="primary-button" type="submit">${svgButtonLabel("check", record ? "Save changes" : `Add ${stage.singular}`)}</button>
      </footer>
    </form>`);

  recordRelations(stage, record, space);
  const model = $("#record-form [name=model]");
  if (record?.configured && model) {
    const auto = new Option("Use recommended controller", "__auto__");
    model.add(auto);
  }
  if (model) {
    const showEvidence = () => {
      const product = products.find(p => p.model === model.value);
      $("#model-evidence").innerHTML = product ? productDetails(product) : "";
    };
    model.addEventListener("change", showEvidence);
    showEvidence();
  }
  $("#record-form").addEventListener("submit", event => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget).entries());
    if (["roomDevices","spaceBehavior","scenes"].includes(stage.id)) {
      data.spaceId = state.spaces.find(s => s.name === data.area)?.id || "";
    } else if (space) {
      data.spaceId = space.id;
      data.area = space.name;
    }
    if (record?.configured && model && data.model !== record.model) {
      data.modelOverride = data.model === "__auto__" ? "" : data.model;
    }
    if (record) Object.assign(record, data, { updatedAt: new Date().toISOString() });
    else recordsFor(stage.id).push({ id: newRecordId(), ...data, createdAt: new Date().toISOString() });
    if (space && ["loads", "controllers"].includes(stage.id)) syncConfiguredSpaces();
    saveState(record ? "Changes saved" : `${titleCase(stage.singular)} added`);
    closeModal();
    searchTerm = "";
    render();
    showToast(record ? "Changes saved" : `${titleCase(stage.singular)} added`);
  });
}

function confirmDelete(recordId) {
  const stage = currentStage();
  const record = recordsFor(stage.id).find(item => item.id === recordId);
  if (!record || record.configured) return;
  showModal(`
    ${modalHeader(`Delete ${stage.singular}?`, "This removes the record from the local project.")}
    <div class="modal-body"><p>Delete <strong>${escapeHTML(record?.name || record?.area || stage.singular)}</strong>? This action cannot be undone.</p></div>
    <footer class="modal-footer"><button class="ghost-button" type="button" data-modal-close>Cancel</button><button class="danger-button" type="button" id="confirm-delete">Delete</button></footer>`);
  $("#confirm-delete").addEventListener("click", () => {
    state.records[stage.id] = recordsFor(stage.id).filter(item => item.id !== recordId);
    if (stage.id === "loads") syncConfiguredSpaces();
    saveState("Record deleted");
    closeModal();
    render();
    showToast("Record deleted");
  });
}

function openProjectSettings() {
  const fields = [
    { key: "name", label: "Project name", required: true },
    { key: "number", label: "Project number" },
    { key: "client", label: "Client / organization" },
    { key: "location", label: "Project location" },
    { key: "architecture", label: "Zūm architecture", type: "select", options: ["Zūm Wired", "Zūm Mesh Wireless", "Hybrid - Wired + Mesh", "Standalone Space"] },
    { key: "voltage", label: "System voltage", type: "select", options: ["100-277 VAC", "120 VAC", "208 VAC", "230 VAC", "277 VAC", "Other"] },
    { key: "rfFrequency", label: "Wireless network", type: "select", options: ["2.4 GHz Zūm Mesh", "Zūm Net wired only", "No wireless", "To be confirmed"] },
    { key: "lineFrequency", label: "Line frequency", type: "select", options: ["60 Hz", "50 Hz"] },
    { key: "units", label: "Measurement units", type: "select", options: ["Imperial", "Metric"] },
    { key: "currency", label: "Currency", type: "select", options: ["USD", "CAD", "EUR", "GBP", "AUD"] },
    { key: "notes", label: "Project notes", type: "textarea", full: true }
  ];
  showModal(`
    ${modalHeader("Project settings", "Edit the identity, Zūm architecture, and electrical defaults used throughout this design.")}
    <form id="project-settings-form">
      <div class="modal-body"><div class="form-grid">${fields.map(field => fieldHTML(field, state.project[field.key])).join("")}</div></div>
      <footer class="modal-footer"><button class="ghost-button" type="button" data-modal-close>Cancel</button><button class="primary-button" type="submit">${svgButtonLabel("check", "Save project")}</button></footer>
    </form>`);
  $("#project-settings-form").addEventListener("submit", event => {
    event.preventDefault();
    Object.assign(state.project, Object.fromEntries(new FormData(event.currentTarget).entries()));
    saveState("Project saved");
    closeModal();
    render();
    showToast("Project settings saved");
  });
}

function openDataTools() {
  showModal(`
    ${modalHeader("Project data", "Back up, restore, or reset the project stored in this browser.")}
    <div class="modal-body">
      <div class="tool-grid">
        <button class="tool-card" type="button" id="export-project">${icon("download")}<strong>Export project</strong><small>Download a portable JSON backup.</small></button>
        <button class="tool-card" type="button" id="import-project">${icon("upload")}<strong>Import project</strong><small>Restore a Zūm System Planner JSON file.</small></button>
        <button class="tool-card" type="button" id="seed-project">${icon("layers")}<strong>Load Zūm example</strong><small>Populate two rooms with wired Zūm equipment.</small></button>
        <button class="tool-card" type="button" id="reset-project">${icon("trash")}<strong>Reset project</strong><small>Erase local project data and start again.</small></button>
      </div>
      <input class="hidden" id="import-file" type="file" accept="application/json,.json" />
    </div>
    <footer class="modal-footer"><button class="secondary-button" type="button" data-modal-close>Done</button></footer>`);

  $("#export-project").addEventListener("click", exportProject);
  $("#import-project").addEventListener("click", () => $("#import-file").click());
  $("#import-file").addEventListener("change", importProject);
  $("#seed-project").addEventListener("click", seedExample);
  $("#reset-project").addEventListener("click", confirmReset);
}

function productDetails(product) {
  const references = product.sources.map(source => {
    const label = escapeHTML(source.url ? `${product.model} · ${source.section} · pp. ${source.page}` : source.label);
    return /^https:\/\//.test(source.url) ? `<a href="${escapeHTML(source.url)}" target="_blank" rel="noopener noreferrer">${label}</a>` : label;
  });
  return `<article class="soo-area"><strong>${escapeHTML(product.model)} · ${escapeHTML(product.name)}</strong><p>${[product.role, product.connection, product.rating].filter(Boolean).map(escapeHTML).join(" · ")}</p>${product.gaps.map(gap => `<p>${escapeHTML(gap)}</p>`).join("")}<small>${references.join(" / ")}</small></article>`;
}

function openDesignReference() {
  showModal(`
    ${modalHeader("Zūm design reference", "Source-informed planning guidance for wired, wireless, and hybrid Crestron Zūm systems.")}
    <div class="modal-body report-preview">
      <section class="report-section"><h3>Find a Crestron product</h3><p>DRAFT · Three product ratings require confirmation.</p>
        <label class="search-field">Model or function <input type="search" id="product-filter" placeholder="e.g. dimmer or ZUMMESH" /></label>
        <div id="product-results" aria-live="polite"></div></section>
      <section class="report-section">
        <h3>System topology</h3>
        <div class="soo-area"><strong>Zūm Net</strong><p>Room-to-room communications over CBL-CAT5E-ZUMNET-P. Daisy-chain up to 20 devices, with no more than 328 ft (100 m) between devices. See Crestron 9349T, p. 458.</p></div>
        <div class="soo-area"><strong>Zūm Link</strong><p>In-room 24 VDC power and communications over CBL-CAT5E-ZUMLINK-P for load controllers, keypads, sensors, power supplies, and I/O devices.</p></div>
        <div class="soo-area"><strong>Zūm Mesh</strong><p>2.4 GHz wireless room network supporting up to 32 wireless devices per room. Use a ZUMMESH-NETBRIDGE when the room must join the managed Zūm network.</p></div>
      </section>
      <section class="report-section">
        <h3>Design limits</h3>
        <table class="report-table"><tbody>
          <tr><th>Managed system</th><td>ZUM-HUB4 centralizes up to 1,000 rooms and provides timeclock and BACnet integration.</td></tr>
          <tr><th>Network path</th><td>Do not exceed three network switches between a ZUM-HUB4 and a Zūm Net device.</td></tr>
          <tr><th>Space capacity</th><td>Up to 32 zones or DALI groups, 16 keypads, and 4 daylight inputs per space.</td></tr>
          <tr><th>Wired device layouts</th><td>Published space limits vary by controller mix: 8 devices for ZUMNET-JBOX-DALI-only layouts, 15 for JBOX-only layouts, and up to 32 with supported DIN/custom-programmed layouts.</td></tr>
          <tr><th>Zūm Link power</th><td>A JBOX load controller supplies 85 mA. Up to eight controllers may be stacked; cumulative Zūm Link power must not exceed 750 mA.</td></tr>
          <tr><th>JBOX PSU</th><td>ZUMLINK-JBOX-PSU provides two independently protected 125 mA Zūm Link outputs.</td></tr>
        </tbody></table>
      </section>
      <section class="report-section">
        <h3>Product families</h3>
        <table class="report-table"><tbody>
          <tr><th>Room controllers</th><td>ZUMNET and ZUMLINK JBOX/DIN controllers support 0-10 V, switching, plug-load, DALI, and universal phase control.</td></tr>
          <tr><th>Room controls</th><td>ZUMLINK-KP accepts configurable 2-, 4-, 6-, or 8-button trees and includes two RJ45 Zūm Link ports.</td></tr>
          <tr><th>Sensors</th><td>Zūm Link presence detectors and Zūm Mesh occupancy, vacancy, and open-loop photocell devices provide room sensing.</td></tr>
          <tr><th>Gateways</th><td>ZUMNET-GATEWAY supports up to 50 ZUMMESH-NETBRIDGE devices; use one network bridge per wireless room.</td></tr>
        </tbody></table>
      </section>
      <p class="field-help">Use current Crestron product documentation and applicable electrical codes for final engineering, installation, commissioning, and code compliance.</p>
    </div>
    <footer class="modal-footer"><button class="primary-button" type="button" data-modal-close>Done</button></footer>`);
  const search = $("#product-filter");
  const update = () => {
    const term = search.value.trim().toLowerCase();
    const matches = (window.CRESTRON_CATALOG?.products || []).filter(p => [p.model,p.name,p.role,p.category,...p.aliases].join(" ").toLowerCase().includes(term));
    $("#product-results").innerHTML = matches.length ? matches.map(productDetails).join("") : "<p>No matching products.</p>";
  };
  search.addEventListener("input", update);
  update();
}

function exportProject() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  downloadBlob(blob, `${slugify(state.project.name)}-zum-design.json`);
  showToast("Project exported");
}

async function importProject(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const parsed = JSON.parse(await file.text());
    if (!parsed.project || !parsed.records) throw new Error("Invalid project structure");
    const fresh = defaultState();
    state = { ...fresh, ...parsed, designMode: parsed.designMode || (Object.values(parsed.records || {}).some(rows => rows.length) ? "custom" : "zum"), project: { ...fresh.project, ...parsed.project }, records: { ...fresh.records, ...parsed.records }, takeoff: { ...fresh.takeoff, ...(parsed.takeoff || {}) } };
    saveState("Project imported");
    closeModal();
    render();
    showToast("Project imported");
  } catch (error) {
    showToast(`Import failed: ${error.message}`);
  }
}

function seedExample() {
  state.programFiles = [];
  state.project.id = newRecordId();
  const now = new Date().toISOString();
  const make = record => ({ id: newRecordId(), createdAt: now, ...record });
  state.project = { ...state.project, name: "Example lighting design", number: "DEMO-001", client: "Example client", location: "Example site", architecture: "Zūm Wired", voltage: "100-277 VAC", rfFrequency: "Zūm Net wired only" };
  state.spaces = [];
  state.designMode = "custom";
  state.records.loads = [
    make({ name: "Conference downlights", area: "Conference 201", fixtureType: "LED lighting", controlType: "0-10 V dimming", voltage: "277 VAC", watts: "18", quantity: "12", emergency: "Normal", notes: "Daylight zone A" }),
    make({ name: "Conference perimeter", area: "Conference 201", fixtureType: "LED lighting", controlType: "0-10 V dimming", voltage: "277 VAC", watts: "32", quantity: "6", emergency: "Normal", notes: "Daylight zone B" }),
    make({ name: "Corridor fixtures", area: "Corridor 200", fixtureType: "LED lighting", controlType: "0-10 V dimming", voltage: "277 VAC", watts: "22", quantity: "10", emergency: "Override via GLS-PLS", notes: "Egress path" })
  ];
  state.records.controllers = [
    make({ name: "Conference primary", area: "Conference 201", model: "ZUMNET-JBOX-16A-LV", networkRole: "Zūm Net primary controller", loadCapability: "16 A 0-10 V", feed: "100-277 VAC", quantity: "1", notes: "Primary room controller" }),
    make({ name: "Conference perimeter controller", area: "Conference 201", model: "ZUMLINK-JBOX-16A-LV", networkRole: "Zūm Link load controller", loadCapability: "16 A 0-10 V", feed: "100-277 VAC", quantity: "1", notes: "Zūm Link daisy chain" }),
    make({ name: "Corridor primary", area: "Corridor 200", model: "ZUMNET-JBOX-16A-LV", networkRole: "Zūm Net primary controller", loadCapability: "16 A 0-10 V", feed: "100-277 VAC", quantity: "1", notes: "Receives phase-loss override" })
  ];
  state.records.roomDevices = [
    make({ name: "Conference entry keypad", area: "Conference 201", model: "ZUMLINK-KP", deviceType: "Keypad", connection: "Zūm Link", function: "ON / Scene 2 / Scene 3 / OFF", quantity: "1", notes: "ZUMLINK-BTN4 tree" }),
    make({ name: "Conference presence detector", area: "Conference 201", model: "ZUMLINK-DT-QUATTRO-DLS", deviceType: "Presence detector", connection: "Zūm Link", function: "Occupancy + daylight", quantity: "1", notes: "Ceiling mounted" }),
    make({ name: "Corridor presence detector", area: "Corridor 200", model: "ZUMLINK-US-HALLWAY-DLS", deviceType: "Presence detector", connection: "Zūm Link", function: "Bidirectional hallway detection", quantity: "1", notes: "Ceiling mounted" })
  ];
  state.records.network = [
    make({ name: "Main Zūm hub", area: "Electrical 1A", model: "ZUM-HUB4", equipmentType: "Zūm Hub", connection: "Control subnet", voltage: "100-240 VAC", quantity: "1", notes: "Central management" }),
    make({ name: "Level 2 PoE switch", area: "IDF 2A", model: "CEN-SWPOE-5AC", equipmentType: "PoE network switch", connection: "Ethernet / PoE", voltage: "100-277 VAC", quantity: "1", notes: "Zūm Net distribution" })
  ];
  state.records.links = [
    make({ name: "Zūm Net run L2-A", linkType: "Zūm Net", source: "Level 2 PoE switch", destination: "Conference 201 -> Corridor 200", length: "210", capacity: "2", status: "Assigned", notes: "CBL-CAT5E-ZUMNET-P; daisy chain" }),
    make({ name: "Conference Zūm Link", linkType: "Zūm Link", source: "Conference primary", destination: "Perimeter controller + keypad + detector", length: "145", capacity: "3", status: "Assigned", notes: "CBL-CAT5E-ZUMLINK-P" }),
    make({ name: "Corridor emergency override", linkType: "Emergency override", source: "GLS-PLS", destination: "Corridor primary", length: "60", capacity: "1", status: "Planned", notes: "Override propagates through Zūm Link" })
  ];
  state.records.lineItems = [
    make({ name: "Zūm Net plenum cable", category: "Cable", model: "CBL-CAT5E-ZUMNET-P", unitPrice: "0", quantity: "250", notes: "Final lengths by installer" }),
    make({ name: "Zūm Link plenum cable", category: "Cable", model: "CBL-CAT5E-ZUMLINK-P", unitPrice: "0", quantity: "200", notes: "Final lengths by installer" })
  ];
  state.records.spaceBehavior = [
    make({ area: "Conference 201", roomType: "Conference", autoOn: "Manual on", autoOff: "Vacancy timeout - 20 min", manualControl: "ZUMLINK-KP: ON / Scene 2 / Scene 3 / OFF", daylighting: "Continuous 0-10 V dimming", emergency: "Not required", notes: "Daylight zones trim independently while occupied." }),
    make({ area: "Corridor 200", roomType: "Corridor", autoOn: "Occupancy to 100%", autoOff: "Vacancy timeout - 20 min", manualControl: "No public manual control", daylighting: "Not required", emergency: "GLS-PLS override", notes: "Egress fixtures enter emergency override on phase loss." })
  ];
  state.records.scenes = [make({ name: "Presentation", area: "Conference 201", lights: "Downlights 30%, perimeter off", trigger: "ZUMLINK-KP", schedule: "Manual", notes: "Scene 2" })];
  saveState("Example loaded");
  closeModal();
  render();
  showToast("Example project loaded");
}

function confirmReset() {
  showModal(`
    ${modalHeader("Reset the project?", "All locally stored Zūm design data will be erased.")}
    <div class="modal-body"><p>This cannot be undone unless you exported a JSON backup first.</p></div>
    <footer class="modal-footer"><button class="ghost-button" type="button" data-modal-close>Cancel</button><button class="danger-button" id="confirm-reset" type="button">Reset project</button></footer>`);
  $("#confirm-reset").addEventListener("click", () => {
    projectStorage.removeItem(STORAGE_KEY);
    state = defaultState();
    closeModal();
    render();
    if (isWiredDemo) { populateWiredDemo(); render(); } else openWizard();
  });
}

function openWizard() {
  wizardStep = 0;
  wizardDraft = { ...state.project };
  renderWizard();
}

function renderWizard() {
  const steps = ["Workflow", "Project identity", "Design defaults"];
  let body = "";
  if (wizardStep === 0) {
    body = `
      <p class="field-help">Choose the Zūm architecture for this project.</p>
      <div class="workflow-choice">
        <button class="choice-card selected" type="button"><strong>Zūm System Design</strong><small>Plan wired, wireless, or hybrid rooms, devices, networks, and documentation.</small></button>
        <button class="choice-card" type="button" disabled><strong>Commissioning</strong><small>Live Zūm App and ZUM-HUB4 commissioning are outside this local planning tool.</small></button>
      </div>`;
  } else if (wizardStep === 1) {
    const fields = [
      { key: "name", label: "Project name", required: true, placeholder: "North campus renovation" },
      { key: "number", label: "Project number", placeholder: "24-018" },
      { key: "client", label: "Client / organization", placeholder: "Client name" },
      { key: "location", label: "Project location", required: true, placeholder: "City, state" }
    ];
    body = `<div class="form-grid">${fields.map(field => fieldHTML(field, wizardDraft[field.key])).join("")}</div>`;
  } else {
    const fields = [
      { key: "architecture", label: "Zūm architecture", type: "select", options: ["Zūm Wired", "Zūm Mesh Wireless", "Hybrid - Wired + Mesh", "Standalone Space"] },
      { key: "voltage", label: "System voltage", type: "select", options: ["100-277 VAC", "120 VAC", "208 VAC", "230 VAC", "277 VAC", "Other"] },
      { key: "rfFrequency", label: "Wireless network", type: "select", options: ["2.4 GHz Zūm Mesh", "Zūm Net wired only", "No wireless", "To be confirmed"] },
      { key: "lineFrequency", label: "Line frequency", type: "select", options: ["60 Hz", "50 Hz"] },
      { key: "units", label: "Measurement units", type: "select", options: ["Imperial", "Metric"] },
      { key: "currency", label: "Currency", type: "select", options: ["USD", "CAD", "EUR", "GBP", "AUD"] }
    ];
    body = `<div class="form-grid">${fields.map(field => fieldHTML(field, wizardDraft[field.key])).join("")}</div>`;
  }

  showModal(`
    ${modalHeader(wizardStep === 0 ? "Create a Zūm System Design" : steps[wizardStep], `Step ${wizardStep + 1} of ${steps.length} · Crestron Zūm Lighting Control`)}
    <form id="wizard-form">
      <div class="modal-body">
        <div class="wizard-progress">${steps.map((_, index) => `<span class="${index <= wizardStep ? "active" : ""}"></span>`).join("")}</div>
        ${body}
      </div>
      <footer class="modal-footer">
        ${wizardStep === 0 ? '<button id="wizard-demo" class="secondary-button" type="button">Try 10-space demo</button>' : ""}
        ${wizardStep > 0 ? '<button class="ghost-button" type="button" id="wizard-back">Back</button>' : ""}
        <button class="primary-button" type="submit">${svgButtonLabel(wizardStep === 2 ? "check" : "arrow", wizardStep === 2 ? "Create project" : "Continue")}</button>
      </footer>
    </form>`);

  $("#wizard-demo")?.addEventListener("click", switchDemo);
  $("#wizard-back")?.addEventListener("click", () => {
    collectWizardFields();
    wizardStep -= 1;
    renderWizard();
  });
  $("#wizard-form").addEventListener("submit", event => {
    event.preventDefault();
    collectWizardFields();
    if (wizardStep < 2) {
      wizardStep += 1;
      renderWizard();
    } else {
      state.project = { ...state.project, ...wizardDraft, workflow: "Zūm System Design", product: "Crestron Zūm Lighting Control" };
      state.currentView = "loads";
      if (["Zūm Mesh Wireless","Standalone Space"].includes(state.project.architecture)) state.designMode = "custom";
      saveState("Project created");
      closeModal();
      render();
      showToast("Project created — start with loads");
    }
  });
}

function collectWizardFields() {
  const form = $("#wizard-form");
  if (!form) return;
  Object.assign(wizardDraft, Object.fromEntries(new FormData(form).entries()));
}

function openReport(reportId = "projectPackage") {
  const report = REPORTS.find(item => item.id === reportId) || REPORTS.at(-1);
  showModal(`
    ${modalHeader(report.name, `${state.project.name} · Generated from current local project data`)}
    ${report.id === "projectPackage" ? '<div class="program-package-action"><button class="primary-button" type="button" id="open-programming">Custom programming</button></div>' : ""}
    <div class="modal-body report-preview" id="printable-report">${generateReport(report.id)}</div>
    <footer class="modal-footer">
      <button class="secondary-button" type="button" id="download-report">${svgButtonLabel("download", "Download HTML")}</button>
      <button class="primary-button" type="button" id="print-report">${svgButtonLabel("printer", "Print / Save PDF")}</button>
    </footer>`, true);
  $("#open-programming")?.addEventListener("click", () => openProgramming());
  $("#print-report").addEventListener("click", () => window.print());
  $("#download-report").addEventListener("click", () => {
    const html = standaloneReportHTML(report.name, generateReport(report.id));
    downloadBlob(new Blob([html], { type: "text/html" }), `${slugify(state.project.name)}-${report.id}.html`);
    showToast("Report downloaded");
  });
}

function reportMasthead(title) {
  return `<div class="report-masthead"><div><h2>${escapeHTML(title)}</h2><p>${escapeHTML(state.project.name)}</p></div><div class="report-meta">Project ${escapeHTML(state.project.number || "—")}<br>${escapeHTML(state.project.location || "Location not set")}<br>${new Date().toLocaleDateString()}</div></div>`;
}

function generateReport(reportId) {
  const sections = {
    takeoff: () => `${reportMasthead("Plan Takeoff Register")}${takeoffRegisterSection()}`,
    bom: () => `${reportMasthead("Zūm Bill of Material")}${bomSection()}`,
    loadSchedule: () => `${reportMasthead("Load & Zone Schedule")}${loadScheduleSection()}`,
    oneLine: () => `${reportMasthead("Zūm Wiring One-Line")}${oneLineSection()}`,
    soo: () => `${reportMasthead("Sequence of Operations")}${sooSection()}`,
    controlIntent: () => `${reportMasthead("Device & Control Intent")}${controlIntentSection()}`,
    projectPackage: () => `${reportMasthead("Crestron Zūm Design Package")}${projectSummarySection()}${takeoffRegisterSection()}${loadScheduleSection()}${bomSection()}${sooSection()}${controlIntentSection()}${oneLineSection()}`
  };
  return (sections[reportId] || sections.projectPackage)();
}

function projectSummarySection() {
  return `<section class="report-section"><h3>Project summary</h3><table class="report-table"><tbody>
    <tr><th>Workflow</th><td>${escapeHTML(state.project.workflow)}</td><th>Product</th><td>${escapeHTML(state.project.product)}</td></tr>
    <tr><th>Architecture</th><td>${escapeHTML(state.project.architecture)}</td><th>Voltage</th><td>${escapeHTML(state.project.voltage)}</td></tr>
    <tr><th>Wireless</th><td>${escapeHTML(state.project.rfFrequency)}</td><th>Client</th><td>${escapeHTML(state.project.client || "-")}</td></tr>
    <tr><th>Line frequency</th><td>${escapeHTML(state.project.lineFrequency)}</td><th>Units</th><td>${escapeHTML(state.project.units)}</td></tr>
  </tbody></table></section>`;
}

function takeoffRegisterSection() {
  const stamps = (state.takeoff.markups || []).filter(mark => mark.type === "stamp");
  if (!stamps.length) return "";
  const groups = new Map();
  stamps.forEach(mark => {
    const entry = (state.takeoff.catalog || []).find(item => item.id === mark.catalogId) || {};
    const area = findAreaForMarkup(mark);
    const page = state.takeoff.analysis?.pages?.find(item => item.page === Number(mark.page));
    const key = `${entry.id || mark.catalogId}|${area}|${mark.page}`;
    const current = groups.get(key) || { tag: entry.tag || "?", description: entry.name || "Unmapped symbol", model: entry.model || "—", area, quantity: 0, source: `${page?.sheet || `Page ${mark.page}`} · ${state.takeoff.document?.name || "CD set"}` };
    current.quantity += Number(mark.quantity || 1);
    groups.set(key, current);
  });
  return rowsTable("Plan takeoff register", [
    { label: "Tag", value: "tag" },
    { label: "Description", value: "description" },
    { label: "Crestron model", value: "model" },
    { label: "Space", value: "area" },
    { label: "Qty.", value: "quantity" },
    { label: "Source", value: "source" }
  ], [...groups.values()]);
}

function rowsTable(title, columns, rows) {
  if (!rows.length) return "";
  return `<section class="report-section"><h3>${escapeHTML(title)}</h3><table class="report-table"><thead><tr>${columns.map(column => `<th>${escapeHTML(column.label)}</th>`).join("")}</tr></thead><tbody>${rows.map(row => `<tr>${columns.map(column => `<td>${escapeHTML(typeof column.value === "function" ? column.value(row) : row[column.value] || "—")}</td>`).join("")}</tr>`).join("")}</tbody></table></section>`;
}

function loadScheduleSection() {
  return rowsTable("Load & zone schedule", [
    { label: "Load / zone", value: "name" }, { label: "Zūm space", value: "area" }, { label: "Load type", value: "fixtureType" },
    { label: "Controller", value: row => recordsFor("controllers").filter(c => c.zoneId === row.id).map(c => c.model || "Needs review").join(", ") || "Unassigned" },
    { label: "Control", value: "controlType" }, { label: "Voltage", value: "voltage" }, { label: "Qty", value: "quantity" },
    { label: "Connected W", value: row => String(row.watts ?? "").trim() && Number.isFinite(Number(row.watts)) ? String(Number(row.watts) * Number(row.quantity || 1)) : "REQUIRED INPUT" }
  ], recordsFor("loads"));
}

function bomSection() {
  const bomRows = [];
  ["controllers", "roomDevices", "network"].forEach(stageId => recordsFor(stageId).forEach(record => bomRows.push({ category: currentLabelFor(stageId), item: record.name, model: record.model || record.deviceType || record.equipmentType || "Needs model selection", quantity: record.quantity || 1, notes: [record.assignmentDetail, record.notes].filter(Boolean).join(" · ") })));
  recordsFor("lineItems").forEach(record => bomRows.push({ category: record.category || "Line item", item: record.name, model: record.model, quantity: record.quantity || 1, notes: record.unitPrice ? formatCurrency(Number(record.unitPrice) * Number(record.quantity || 1)) : record.notes || "" }));
  return rowsTable("Zūm bill of material", [
    { label: "Category", value: "category" }, { label: "Item", value: "item" }, { label: "Model / type", value: "model" }, { label: "Qty", value: "quantity" }, { label: "Notes / extended", value: "notes" }
  ], bomRows);
}

function sooSection() {
  const functions = recordsFor("spaceBehavior");
  const scenes = recordsFor("scenes");
  if (!functions.length && !scenes.length) return "";
  const areas = [...new Set([...functions.map(r => r.area), ...scenes.map(r => r.area)].filter(Boolean))];
  return `<section class="report-section"><h3>Sequence of operations</h3>${areas.map(area => {
    const fn = functions.find(record => record.area === area);
    const areaScenes = scenes.filter(record => record.area === area);
    const details = fn ? `${fn.autoOn || "Manual on"}; ${fn.autoOff || "no automatic off"}; ${fn.manualControl || "manual control not specified"}; daylighting: ${fn.daylighting || "not specified"}; emergency: ${fn.emergency || "not specified"}.` : "Space behavior not yet defined.";
    const sceneText = areaScenes.length ? ` Scenes/events: ${areaScenes.map(scene => `${scene.name} (${scene.lights || "lighting not specified"}; trigger: ${scene.trigger || "not specified"}${scene.schedule ? `; ${scene.schedule}` : ""})`).join("; ")}.` : "";
    return `<div class="soo-area"><strong>${escapeHTML(area)}</strong><p>${escapeHTML(details + (fn?.notes ? ` ${fn.notes}` : "") + sceneText)}</p></div>`;
  }).join("")}</section>`;
}

function controlIntentSection() {
  return rowsTable("Device & control intent", [
    { label: "Device", value: "name" }, { label: "Zūm space", value: "area" }, { label: "Model", value: "model" }, { label: "Type", value: "deviceType" }, { label: "Connection", value: "connection" }, { label: "Function", value: "function" }, { label: "Qty", value: "quantity" }
  ], recordsFor("roomDevices"));
}

function oneLineSection() {
  const controllers = recordsFor("controllers");
  const network = recordsFor("network");
  const links = recordsFor("links");
  if (!controllers.length && !network.length && !links.length) return "";
  const checks = designChecks();
  return `<section class="report-section"><h3>Zūm wiring one-line</h3>
    <p class="report-meta" style="text-align:left">Configured spaces show their assigned controller outputs. The connection schedule includes planned zone outputs and connections entered in Wiring &amp; Links.</p>
    <div class="wiring-sheet">${buildWiringDiagram()}</div>
    <div class="diagram-legend">
      <span><i class="legend-line zumnet"></i>Zūm Net - room-to-room</span>
      <span><i class="legend-line zumlink"></i>Zūm Link - in-room</span>
      <span><i class="legend-line mesh"></i>Zūm Mesh wireless</span>
      <span><i class="legend-line control"></i>SW / LV load control</span>
      <span><i class="legend-line analog"></i>24 VDC / analog</span>
      <span><i class="legend-line ethernet"></i>Ethernet / PoE</span>
    </div>
    ${scheduledPaths(links)}
    <div class="design-rules">${checks.map(check => `<div class="design-rule ${check.warning ? "warning" : ""}">${icon(check.warning ? "alert" : "info")}<span>${escapeHTML(check.text)}</span></div>`).join("")}</div>
  </section>
  ${rowsTable("Connection schedule", [{ label: "Connection", value: "name" }, { label: "Type", value: "linkType" }, { label: "Source", value: "source" }, { label: "Destination", value: "destination" }, { label: "Length (ft)", value: "length" }, { label: "Status", value: "status" }], links)}`;
}

function scheduledPaths(links) {
  if (!links.length) return "<p>Enter source and destination in Wiring &amp; Links to document a path.</p>";
  const colors = {"Zūm Net":"#6d3090","Zūm Link":"#aa6300","Zūm Mesh":"#167492","Ethernet / PoE":"#334e5a","24 VDC analog":"#197143"};
  return `<h4>Recorded connection paths</h4>${links.map(link => {
    const color = colors[link.linkType] || "#99433b";
    const border = link.status === "Assigned" ? "solid" : "dashed";
    return `<div style="display:grid;grid-template-columns:1fr 1.3fr 1fr;align-items:center;text-align:center;gap:.5em;margin:1em 0;break-inside:avoid"><strong>${escapeHTML(link.source || "REQUIRED INPUT")}</strong><span style="border-bottom:3px ${border} ${color}">${escapeHTML(link.linkType)} · ${escapeHTML(link.status || "Needs review")}</span><strong>${escapeHTML(link.destination || "REQUIRED INPUT")}</strong></div>`;
  }).join("")}`;
}

function buildWiringDiagram() {
  const controllers = recordsFor("controllers");
  const roomDevices = recordsFor("roomDevices");
  const loads = recordsFor("loads");
  const network = recordsFor("network");
  const spaces = state.spaces || [];
  const linkedToSpace = (row, space) => row.spaceId ? row.spaceId === space.id : row.area === space.name;
  const rooms = spaces.map(space => ({
    name: space.name,
    configured: true,
    controllers: controllers.filter(row => linkedToSpace(row, space)),
    loads: loads.filter(row => linkedToSpace(row, space)),
    devices: roomDevices.filter(row => linkedToSpace(row, space))
  }));
  const legacyRows = [...controllers, ...roomDevices, ...loads].filter(row => !spaces.some(space => linkedToSpace(row, space)));
  const legacyAreas = [...new Set(legacyRows.map(row => row.area || "Unassigned Zūm space"))];
  if (!rooms.length && !legacyAreas.length) legacyAreas.push("Unassigned Zūm space");
  legacyAreas.forEach(name => {
    const inArea = row => legacyRows.includes(row) && (row.area || "Unassigned Zūm space") === name;
    rooms.push({ name, controllers: controllers.filter(inArea), devices: roomDevices.filter(inArea), loads: loads.filter(inArea) });
  });

  const width = 1120;
  const top = 138;
  let nextRoomY = top;
  for (const room of rooms) {
    room.y = nextRoomY;
    room.configured = room.configured && (room.controllers.some(row => row.configured || row.zoneId) || !room.controllers.length);
    room.unassigned = room.loads.filter(load => !room.controllers.some(row => row.zoneId === load.id));
    room.height = room.configured ? 58 + 72 * Math.max(1, room.controllers.length + room.unassigned.length)
      + (room.devices.length ? 28 + 54 * Math.ceil(room.devices.length / 3) : 0) : 178;
    nextRoomY += room.height;
  }
  const height = nextRoomY + 82;
  const backboneX = 265;
  const networkNodes = network.length ? network.slice(0, 5) : [{ name: "Upstream network", model: "Hub / switch not yet selected", equipmentType: "Network" }];
  const parts = [`<svg class="wiring-diagram" viewBox="0 0 ${width} ${height}" role="img" aria-label="Generated Crestron Zūm system wiring diagram">`,
    `<defs><marker id="arrow-purple" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#6d3090"/></marker><marker id="arrow-orange" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#e78a16"/></marker><marker id="arrow-red" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#e32621"/></marker></defs>`,
    `<text x="24" y="20" class="diagram-title">CRESTRON ZŪM SYSTEM</text>`,
    `<text x="24" y="37" class="diagram-detail">${escapeHTML(state.project.architecture)} · ${escapeHTML(state.project.voltage)}</text>`
  ];

  networkNodes.forEach((item, index) => {
    const x = 25 + index * 190;
    parts.push(diagramNode(x, 50, 166, 52, item.name, item.model || item.equipmentType || "Network", "network"));
    if (index > 0) parts.push(`<path d="M ${x - 24} 76 H ${x}" class="wire-ethernet"/>`);
  });
  const lastNetworkX = 25 + (networkNodes.length - 1) * 190 + 166;
  parts.push(`<path d="M ${lastNetworkX} 102 H ${backboneX} V ${height - 48}" class="wire-zumnet" marker-end="url(#arrow-purple)"/>`);
  parts.push(`<text x="${backboneX + 8}" y="124" class="diagram-detail">Zūm Net backbone</text>`);

  rooms.forEach(room => {
    const {name: area, y, controllers: areaControllers, devices: areaDevices, loads: areaLoads} = room;
    if (room.configured) {
      parts.push(configuredRoomDiagram(room, backboneX));
      return;
    }
    const primary = areaControllers.find(record => /primary/i.test(record.networkRole || "")) || areaControllers[0];
    const secondary = areaControllers.filter(record => record !== primary);
    const isMesh = /ZUMMESH|Mesh/i.test(`${primary?.model || ""} ${primary?.networkRole || ""}`);

    parts.push(`<rect x="290" y="${y - 20}" width="805" height="154" class="room-frame" rx="10"/>`);
    parts.push(`<text x="306" y="${y + 1}" class="room-label">${escapeHTML(area)}</text>`);
    parts.push(`<path d="M ${backboneX} ${y + 48} H 323" class="${isMesh ? "wire-mesh" : "wire-zumnet"}" marker-end="url(#arrow-purple)"/>`);

    if (primary) parts.push(diagramNode(323, y + 20, 205, 48, primary.name, primary.model || primary.networkRole, "controller"));
    else parts.push(diagramNode(323, y + 20, 205, 48, "Primary controller required", "Select a ZUMNET or ZUMMESH controller", "controller"));

    const shownSecondary = secondary.slice(0, 2);
    shownSecondary.forEach((controller, index) => {
      const sy = y + 84 + index * 31;
      parts.push(`<path d="M 425 ${y + 68} V ${sy + 15} H 548" class="${/Mesh/i.test(controller.networkRole || "") ? "wire-mesh" : "wire-zumlink"}"/>`);
      parts.push(diagramNode(548, sy, 198, 28, controller.name, controller.model, "controller", true));
    });
    if (secondary.length > 2) parts.push(`<text x="552" y="${y + 147}" class="diagram-detail">+${secondary.length - 2} more controllers</text>`);

    const shownDevices = areaDevices.slice(0, 2);
    shownDevices.forEach((device, index) => {
      const dy = y + 20 + index * 57;
      const wireClass = /analog|24 VDC/i.test(device.connection || "") ? "wire-analog" : (/Mesh/i.test(device.connection || "") ? "wire-mesh" : "wire-zumlink");
      parts.push(`<path d="M 528 ${y + 44} H 765 V ${dy + 23}" class="${wireClass}"/>`);
      parts.push(diagramNode(765, dy, 145, 44, device.name, device.model || device.deviceType, "device"));
    });
    if (areaDevices.length > 2) parts.push(`<text x="768" y="${y + 145}" class="diagram-detail">+${areaDevices.length - 2} more room devices</text>`);

    const shownLoads = areaLoads.slice(0, 2);
    shownLoads.forEach((load, index) => {
      const ly = y + 20 + index * 57;
      const loadBusY = y + 125 + index * 5;
      parts.push(`<path d="M 425 ${y + 68} V ${loadBusY} H 920 V ${ly + 23} H 930" class="wire-control" marker-end="url(#arrow-red)"/>`);
      parts.push(diagramNode(930, ly, 145, 44, load.name, `${load.controlType || "Control TBD"} · Qty ${load.quantity || 1}`, "load"));
    });
    if (areaLoads.length > 2) parts.push(`<text x="933" y="${y + 145}" class="diagram-detail">+${areaLoads.length - 2} more load zones</text>`);
  });

  parts.push(`<text x="24" y="${height - 22}" class="diagram-detail">Generated design one-line - not a terminal-by-terminal installation drawing.</text>`, `</svg>`);
  return parts.join("");
}

function configuredRoomDiagram(room, backboneX) {
  const { y } = room;
  const parts = [
    `<rect x="290" y="${y - 20}" width="805" height="${room.height - 15}" class="room-frame" rx="10"/>`,
    `<text x="306" y="${y + 1}" class="room-label">${escapeHTML(room.name)}</text>`
  ];
  const ordered = [...room.controllers].sort((a, b) =>
    Number(b.assignmentRole === "primary") - Number(a.assignmentRole === "primary"));
  const linkPrimary = ordered.find(row => row.assignmentRole === "primary" && row.model?.startsWith("ZUMNET-"));
  const linkBranches = ordered.map((row, index) => ({row, index}))
    .filter(({row}) => row.assignmentRole === "secondary" && row.model?.startsWith("ZUMLINK-"));
  if (linkPrimary && linkBranches.length) {
    const startY = y + 50 + ordered.indexOf(linkPrimary) * 72;
    const lastY = y + 38 + linkBranches.at(-1).index * 72;
    parts.push(`<g class="logical-link-bus"><title>Logical Zūm Link bus. Port assignments and daisy-chain order are unspecified.</title>`,
      `<text x="730" y="${y + 1}" class="diagram-detail">Logical Zūm Link bus · port order unspecified</text>`,
      `<path d="M 320 ${startY} H 305 V ${lastY}" class="wire-zumlink"/>`);
    for (const {row, index} of linkBranches) {
      parts.push(`<path data-link-controller="${escapeHTML(row.id)}" d="M 305 ${y + 38 + index * 72} H 320" class="wire-zumlink"/>`);
    }
    parts.push("</g>");
  }
  let rowY = y + 16;
  for (const row of ordered) {
    const zone = room.loads.find(load => load.id === row.zoneId);
    const primary = row.assignmentRole === "primary";
    const side = primary ? "Primary" : row.assignmentRole === "secondary" ? "Secondary" : "Controller";
    const unresolved = row.assignmentStatus === "REQUIRED INPUT" || !row.model;
    if (row.model?.startsWith("ZUMNET-")) parts.push(`<path d="M ${backboneX} ${rowY + 21} H 320" class="wire-zumnet"/>`);
    parts.push(diagramNode(320, rowY, 264, 44, `${side} · ${row.model || "Model required"}`, row.name, "controller"));
    if (zone) {
      parts.push(`<path data-controller-id="${escapeHTML(row.id)}" data-zone-id="${escapeHTML(zone.id)}" d="M 584 ${rowY + 22} H 733" class="wire-control" ${unresolved ? 'style="stroke-dasharray:4 4"' : 'marker-end="url(#arrow-red)"'}/>`);
      parts.push(diagramNode(733, rowY, 335, 44, zone.name, `${zone.controlType || "Protocol required"} · Qty ${zone.quantity || 1}`, "load"));
    }
    const detail = row.assignmentDetail || (row.modelOverride ? "Manual model override." : !zone ? "No zone assigned." : "");
    if (detail) parts.push(`<text x="320" y="${rowY + 59}" class="diagram-detail">${escapeHTML(detail)}</text>`);
    rowY += 72;
  }
  for (const zone of room.unassigned) {
    parts.push(diagramNode(733, rowY, 335, 44, zone.name, "REQUIRED INPUT · Assign a controller", "load"));
    rowY += 72;
  }
  if (!ordered.length && !room.unassigned.length) {
    parts.push(diagramNode(320, rowY, 264, 44, "Controller assignment pending", "No linked zones", "controller"));
    rowY += 72;
  }
  if (room.devices.length) {
    parts.push(`<text x="320" y="${rowY + 4}" class="diagram-label">Room devices</text>`);
    room.devices.forEach((device, index) => {
      parts.push(diagramNode(320 + (index % 3) * 250, rowY + 14 + Math.floor(index / 3) * 54,
        236, 44, device.name, device.model || device.deviceType, "device"));
    });
  }
  return parts.join("");
}

function diagramNode(x, y, width, height, title, detail, kind, compact = false) {
  const safeTitle = escapeHTML(truncateDiagramText(title || "Unnamed", compact ? 26 : 30));
  const safeDetail = escapeHTML(truncateDiagramText(detail || "", compact ? 29 : 34));
  const titleSize = compact ? 9 : 10;
  return `<g><title>${escapeHTML(title || "Unnamed")} · ${escapeHTML(detail || "")}</title><rect x="${x}" y="${y}" width="${width}" height="${height}" class="node ${kind}"/><text x="${x + 9}" y="${y + (compact ? 12 : 17)}" class="diagram-label" style="font-size:${titleSize}px">${safeTitle}</text><text x="${x + 9}" y="${y + (compact ? 23 : 34)}" class="diagram-detail">${safeDetail}</text></g>`;
}

function truncateDiagramText(text, limit) {
  const plain = String(text || "");
  return plain.length > limit ? `${plain.slice(0, limit - 1)}…` : plain;
}

function designChecks() {
  const checks = [];
  const runs = recordsFor("links").filter(link => link.linkType === "Zūm Net");
  checks.push({text: "Zūm Net allows 20 devices per daisy chain and 328 ft between adjacent devices (Crestron 9349T, Zūm Wired System Diagram).", warning: false});
  for (const run of runs) {
    const devices = Number(run.capacity);
    const span = Number(run.maxSpan);
    const notes = [];
    if (!devices) notes.push("enter the device count");
    if (devices > 20) notes.push(`${devices} devices exceed the limit of 20`);
    if (!span) notes.push("enter the longest device-to-device span");
    if (span > 328) notes.push(`${span} ft exceeds the 328 ft span limit`);
    if (Number(run.length) > 6560) notes.push("total length exceeds 6,560 ft (9349T, p. 458)");
    if (notes.length) checks.push({text: `${run.name}: ${notes.join(", ")}.`, warning: true});
  }
  checks.push({ text: "Do not exceed three network switches between a ZUM-HUB4 and a Zūm Net device.", warning: false });

  const areas = [...new Set([...recordsFor("controllers"), ...recordsFor("roomDevices"), ...recordsFor("loads")].map(record => record.area).filter(Boolean))];
  areas.forEach(area => {
    const controllers = recordsFor("controllers").filter(record => record.area === area);
    const devices = recordsFor("roomDevices").filter(record => record.area === area);
    const loads = recordsFor("loads").filter(record => record.area === area);
    const deviceCount = [...controllers, ...devices].filter(record => /^ZUMMESH-/i.test(record.model)).reduce((sum, record) => sum + Number(record.quantity || 1), 0);
    const keypads = devices.filter(record => /keypad/i.test(record.deviceType || "")).reduce((sum, record) => sum + Number(record.quantity || 1), 0);
    const daylight = devices.filter(record => /daylight|photo/i.test(`${record.deviceType || ""} ${record.model || ""}`)).reduce((sum, record) => sum + Number(record.quantity || 1), 0);
    const warnings = [];
    const wiredControllers = controllers.filter(record => /^ZUM(?:LINK|NET)-/.test(record.model));
    if (wiredControllers.length) {
      const wired = [...wiredControllers,...devices.filter(d => /^ZUMLINK-/.test(d.model) && !/^ZUMLINK-BTN/.test(d.model))];
      const total = wired.reduce((sum, row) => sum + Number(row.quantity || 1), 0);
      const limit = wiredControllers.every(c => c.model === "ZUMNET-JBOX-DALI") ? 8 : wiredControllers.every(c => c.model.includes("-JBOX-")) ? 15 : 32;
      if (total > limit) warnings.push(`${total} wired devices exceed the standard layout's ${limit}-device limit. Review controller mix and programming (9349T, p. 457)`);
    }
    if (deviceCount > 32) warnings.push(`${deviceCount} Zūm Mesh devices (limit 32)`);
    if (loads.length > 32) warnings.push(`${loads.length} zones (limit 32)`);
    if (keypads > 16) warnings.push(`${keypads} keypads (limit 16)`);
    if (daylight > 4) warnings.push(`${daylight} daylight inputs (limit 4)`);
    if (warnings.length) checks.push({ text: `${area}: ${warnings.join("; ")}.`, warning: true });
  });
  return checks;
}

function standaloneReportHTML(title, body) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHTML(title)}</title><style>body{max-width:1100px;margin:40px auto;padding:0 24px;font:14px Arial;color:#202824}.report-masthead{display:flex;justify-content:space-between;border-bottom:3px solid #005d80;padding-bottom:20px}.report-masthead h2{font:32px Georgia;margin:0 0 7px}.report-meta{text-align:right;line-height:1.6;color:#5e6f77;font-size:12px}.report-section{margin-top:28px}.report-section h3{font:20px Georgia;border-bottom:1px solid #d8dcd5;padding-bottom:7px}.report-table{width:100%;border-collapse:collapse;font-size:12px}.report-table th,.report-table td{padding:8px;text-align:left;border-bottom:1px solid #e4e6e1}.report-table th{background:#edf4f6;text-transform:uppercase}.soo-area{padding:12px 14px;margin:10px 0;border-left:3px solid #65a8bf;background:#f4f8f9}.soo-area p{margin:5px 0 0}.wiring-sheet{margin-top:18px;padding:12px;border:1px solid #cfdde2;background:#fbfdfe}.wiring-diagram{width:100%;height:auto}.wiring-diagram .room-frame{fill:#f8fbfc;stroke:#aabac1}.wiring-diagram .node{fill:white;stroke:#254854;stroke-width:1.3}.wiring-diagram .node.network{fill:#e6f4f8;stroke:#006c94}.wiring-diagram .node.controller{fill:#f5f8fa}.wiring-diagram .node.device{fill:#fff8ec;stroke:#bd7e1d}.wiring-diagram .node.load{fill:#fff3f1;stroke:#c94436}.wiring-diagram .diagram-title{fill:#153440;font:700 13px Arial}.wiring-diagram .diagram-label{fill:#1d343d;font:600 10px Arial}.wiring-diagram .diagram-detail{fill:#62757d;font:9px Arial}.wiring-diagram .room-label{fill:#005d80;font:700 12px Arial}.wire-zumnet{fill:none;stroke:#6d3090;stroke-width:3;stroke-dasharray:8 4}.wire-zumlink{fill:none;stroke:#e78a16;stroke-width:3}.wire-control{fill:none;stroke:#e32621;stroke-width:2.5}.wire-analog{fill:none;stroke:#078044;stroke-width:2.5}.wire-mesh{fill:none;stroke:#168ab2;stroke-width:2.5;stroke-dasharray:2 5}.wire-ethernet{fill:none;stroke:#3c4e57;stroke-width:2.5;stroke-dasharray:10 3 2 3}.diagram-legend{display:flex;flex-wrap:wrap;gap:10px 18px;margin:12px 0;font-size:11px}.diagram-legend span{display:flex;align-items:center;gap:6px}.legend-line{width:24px;height:3px}.zumnet{background:#6d3090}.zumlink{background:#e78a16}.control{background:#e32621}.analog{background:#078044}.mesh{background:#168ab2}.ethernet{background:#3c4e57}.design-rules{display:grid;grid-template-columns:1fr 1fr;gap:8px}.design-rule{padding:9px;border:1px solid #d7e3e7;background:#f6fafb;font-size:11px}.design-rule svg{display:none}.design-rule.warning{border-color:#ecd5b4;background:#fff8ee}</style></head><body>${body}</body></html>`;
}

function currentLabelFor(stageId) {
  return STAGES.find(stage => stage.id === stageId)?.short || titleCase(stageId);
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function slugify(value) {
  return String(value || "project").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "project";
}

function showToast(message) {
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.innerHTML = `${icon("check")}<span>${escapeHTML(message)}</span>`;
  $("#toast-region").append(toast);
  window.setTimeout(() => toast.remove(), 2800);
}

$("#workflow-nav").addEventListener("click", event => {
  const button = event.target.closest("[data-view]");
  if (!button) return;
  state.currentView = button.dataset.view;
  searchTerm = "";
  saveState();
  appShell.classList.remove("nav-open");
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
});

workspace.addEventListener("click", event => {
  const add = event.target.closest('[data-action="add"]');
  const edit = event.target.closest('[data-action="edit"]');
  const remove = event.target.closest('[data-action="delete"]');
  const report = event.target.closest("[data-report]");
  if (add) openStageAdd();
  else if (edit) openRecordModal(edit.dataset.id);
  else if (remove) confirmDelete(remove.dataset.id);
  else if (report) openReport(report.dataset.report);
});

workspace.addEventListener("input", event => {
  if (event.target.id !== "record-search") return;
  searchTerm = event.target.value;
  $("#stage-records").innerHTML = groupedStageHTML(currentStage(), recordsFor(currentStage().id));
});

modalBackdrop.addEventListener("click", event => {
  if (event.target === modalBackdrop || event.target.closest("[data-modal-close]")) closeModal();
});

document.addEventListener("keydown", event => {
  if (event.key === "Tab" && !modalBackdrop.classList.contains("hidden")) {
    const items = [...modal.querySelectorAll("button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled)")].filter(el => el.getClientRects().length);
    const first = items[0], last = items.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }
  if (event.key === "Escape" && !modalBackdrop.classList.contains("hidden")) closeModal();
});

$("#add-record-button").addEventListener("click", openStageAdd);
$("#preview-report-button").addEventListener("click", () => {
  if (completedStages()) openReport("projectPackage");
  else showToast("Add project data before previewing the package");
});
$("#project-settings-button").addEventListener("click", openProjectSettings);
$("#design-reference-button").addEventListener("click", openDesignReference);
$("#data-tools-button").addEventListener("click", openDataTools);
$("#mobile-menu-button").addEventListener("click", () => appShell.classList.toggle("nav-open"));

$("#demo-button").innerHTML = svgButtonLabel("layers", isWiredDemo ? "Return to my project" : "Try 10-space demo");
$("#demo-button").onclick = switchDemo;
if (isWiredDemo && !hasInitializedProject()) populateWiredDemo();
initSpaceEvents();
render();
if (!hasInitializedProject()) openWizard();
