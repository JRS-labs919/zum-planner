"use strict";

// Zūm wiring one-line drawing (spec rev 2): records -> model -> layout -> SVG string.
// Everything except printOneLine() is pure and runs in the console: no DOM, no state read (the caller
// passes state), nothing executes at load except the constants below. Geometry is in SVG user units.
// Authority: jrs/software-engineering/inputs-2026-11-23/ZUM_ONE_LINE_SPEC.md (cited as §n below).
// Device symbols come from the ONE_LINE_SYMBOLS bundle (one-line-symbols.js, generated, loaded first).
const ONE_LINE = Object.freeze({
  W: 1400, BORDER: 20, HEAD_X: 200, HEAD_Y: 175, HEAD_SLOTS: [200, 500, 800], HEAD_SLOTS_LOW: [200, 500, 800, 1100], HEAD_ROW: 180,
  BAND_X: 100, BAND_W: 1250, BAND_H: 250, BAND_GAP: 20, FIRST_BAND: 300, ROW_PITCH: 180,
  X0: 200, STEP: 145, ONE_ROW_MAX: 7, PER_ROW: 6, TURN_RIGHT: 1040, TURN_LEFT: 116,
  ROOM_X: 1260, DIVIDER_X: 1170, GUTTERS: [70, 50], ARROW_X: 112, CHAIN_MAX: 20,
  LABEL_DY: 66, HEAD_LABEL_DY: 62, LABEL_W: 140, QTY_CAP: 99, FOOT: 300, STRIP_ADD: 250,
  LEGEND: { x: 50, w: 800, h: 195 }, TITLE: { x: 870, w: 480, h: 195 },
  // Landscape sheet: bands flow into columns 1340 apart; the sheet is padded to 17:11 (ANSI B / D).
  COL_PITCH: 1340, COL_TOP: 120, COL_GUTTER: 30, ASPECT: 17 / 11, RESERVE: 250, TAIL: 50
});

// §4 tokens. Inline presentation attributes only (no <style>, no classes), so the old styles.css
// rules for .wiring-diagram .node / .wire-* can never restyle this drawing.
const ONE_LINE_SVG_STYLE = Object.freeze({
  ink: "#1d2a33", muted: "#6b7780", zumNet: "#6b2fa0", zumLink: "#e07b10", alert: "#d62828", dc: "#2a9d5c",
  ethernet: "#5b6670", space: "#2f6f8f", band: "#c3d1db", paper: "#ffffff",
  font: "Helvetica Neue, Helvetica, Arial, sans-serif"
});

/* ------------------------------------------------------------------ small pure helpers */
function oneLineRound(value) {
  return Math.round(value * 10) / 10;
}

// Helvetica/Arial advance widths in 1/1000 em. Lowercase has its own table; anything else is 556.
const ONE_LINE_W_REG = { " ": 278, "-": 333, ".": 278, ",": 278, "/": 278, ":": 278, "(": 333, ")": 333, "·": 278, "—": 1000, "–": 556, "…": 1000,
  A: 667, B: 667, C: 722, D: 722, E: 667, F: 611, G: 778, H: 722, I: 278, J: 500, K: 667, L: 556, M: 833, N: 722, O: 778, P: 667, Q: 778, R: 722, S: 667, T: 611, U: 722, V: 667, W: 944, X: 667, Y: 667, Z: 611,
  a: 556, b: 556, c: 500, d: 556, e: 556, f: 278, g: 556, h: 556, i: 222, j: 222, k: 500, l: 222, m: 833, n: 556, o: 556, p: 556, q: 556, r: 333, s: 500, t: 278, u: 556, v: 500, w: 722, x: 500, y: 500, z: 500 };
const ONE_LINE_W_BOLD = { " ": 278, "-": 333, ".": 278, ",": 278, "/": 278, ":": 333, "(": 333, ")": 333, "·": 278, "—": 1000, "–": 556, "…": 1000,
  A: 722, B: 722, C: 722, D: 722, E: 667, F: 611, G: 778, H: 722, I: 278, J: 556, K: 722, L: 611, M: 833, N: 722, O: 778, P: 667, Q: 778, R: 722, S: 667, T: 611, U: 722, V: 667, W: 944, X: 667, Y: 667, Z: 611,
  a: 556, b: 611, c: 556, d: 611, e: 556, f: 333, g: 611, h: 611, i: 278, j: 278, k: 556, l: 278, m: 889, n: 611, o: 611, p: 611, q: 611, r: 389, s: 556, t: 333, u: 611, v: 556, w: 778, x: 556, y: 556, z: 500 };

// Deterministic width estimate (no DOM measuring), used to truncate and to compress text.
function oneLineTextWidth(text, size, bold) {
  const table = bold ? ONE_LINE_W_BOLD : ONE_LINE_W_REG;
  let sum = 0;
  for (const char of String(text == null ? "" : text)) sum += table[char] || 556;
  return oneLineRound(sum * size / 1000);
}

// Shortens text with "…" until it fits maxW. Returns { text, cut }.
function oneLineFit(text, size, bold, maxW) {
  const plain = String(text == null ? "" : text);
  if (oneLineTextWidth(plain, size, bold) <= maxW) return { text: plain, cut: false };
  const chars = Array.from(plain);
  let n = chars.length;
  while (n > 1 && oneLineTextWidth(`${chars.slice(0, n).join("").trimEnd()}…`, size, bold) > maxW) n -= 1;
  return { text: `${chars.slice(0, n).join("").trimEnd()}…`, cut: true };
}

function oneLineQty(row) {
  const raw = String(row && row.quantity != null ? row.quantity : "").trim();
  const n = /^\d+$/.test(raw) ? Number(raw) : 1;
  return Math.min(Math.max(n, 1), ONE_LINE.QTY_CAP);
}

function oneLineNum(value) {
  return String(oneLineRound(value));
}

/* ------------------------------------------------------------------ symbol lookup */
let oneLineCatalogMaps = null;
function oneLineCatalog() {
  if (oneLineCatalogMaps) return oneLineCatalogMaps;
  const maps = { models: new Map(), aliases: new Map() };
  const products = (typeof window !== "undefined" && window.CRESTRON_CATALOG && window.CRESTRON_CATALOG.products) || [];
  products.forEach(product => {
    maps.models.set(String(product.model).toUpperCase(), product);
    (product.aliases || []).forEach(alias => maps.aliases.set(String(alias).toUpperCase(), product));
  });
  if (products.length) oneLineCatalogMaps = maps;
  return maps;
}

function oneLineCatalogProduct(part) {
  const key = String(part || "").trim().toUpperCase();
  const maps = oneLineCatalog();
  return maps.models.get(key) || maps.aliases.get(key) || null;
}

function oneLineBundle() {
  if (typeof ONE_LINE_SYMBOLS === "undefined") throw new Error("one-line-symbols.js is not loaded");
  return ONE_LINE_SYMBOLS;
}

// Contract lookup: parts[key]; then the catalog alias resolved to its model; then the first generic[]
// rule with (re === "" || re matches) && (category === null || category === the part's category).
function oneLineSymbolId(part, category) {
  const bundle = oneLineBundle();
  const key = String(part == null ? "" : part).trim().toUpperCase();
  if (key && bundle.parts[key]) return bundle.parts[key];
  const product = key ? oneLineCatalogProduct(key) : null;
  if (product && bundle.parts[String(product.model).toUpperCase()]) return bundle.parts[String(product.model).toUpperCase()];
  const cat = category || (product && product.category) || null;
  const rule = bundle.generic.find(item => (item.re === "" || new RegExp(item.re, "i").test(key)) && (item.category === null || item.category === cat));
  return rule ? rule.id : "generic-device";
}

// Display size (§6 table): hub width 220, switch width 140, jbox height 104, ceiling height 92, else fit 110 x 104.
function oneLineSymbolSize(symbol, kind) {
  const w0 = Number(symbol.w) || Number(String(symbol.viewBox).split(/\s+/)[2]);
  const h0 = Number(symbol.h) || Number(String(symbol.viewBox).split(/\s+/)[3]);
  const fit = (bw, bh) => {
    const scale = Math.min(bw / w0, bh / h0);
    return { w: oneLineRound(w0 * scale), h: oneLineRound(h0 * scale) };
  };
  if (kind === "hub") return fit(220, 104);
  if (kind === "switch") return fit(140, 104);
  if (symbol.family === "jbox") return { w: oneLineRound(w0 * 104 / h0), h: 104 };
  if (symbol.family === "ceiling") return { w: oneLineRound(w0 * 92 / h0), h: 92 };
  return fit(110, 104);
}

/* ------------------------------------------------------------------ model */
function oneLineHasContent(st) {
  const rows = id => (st.records && st.records[id]) || [];
  return Boolean(rows("controllers").length || rows("network").length || rows("links").length);
}

const ONE_LINE_CATEGORY_WORD = { keypad: "Keypad", sensor: "Sensor", controller: "Controller", network: "Network device", interface: "Interface", accessory: "Accessory" };

// Role word for a room device: deviceType text, with the sensor family folded to "Sensor" (brief B2).
function oneLineTypeWord(row, part) {
  const type = String(row.deviceType || "").trim();
  if (/^keypad$/i.test(type)) return "Keypad";
  if (/sensor|detector/i.test(type)) return "Sensor";
  if (type) return type;
  const product = oneLineCatalogProduct(part);
  if (product && product.category) return ONE_LINE_CATEGORY_WORD[product.category] || product.category.charAt(0).toUpperCase() + product.category.slice(1);
  return "Device";
}

function oneLineDeviceCategory(row, part, stage) {
  const product = oneLineCatalogProduct(part);
  if (product && product.category) return product.category;
  const type = String(row.deviceType || "");
  if (/keypad/i.test(type)) return "keypad";
  if (/sensor|detector/i.test(type)) return "sensor";
  return stage === "controllers" ? "controller" : null;
}

const ONE_LINE_HUB_RE = /^(ZUM-HUB4|ZUML-HUB4)/i;
const ONE_LINE_SWITCH_RE = /^CEN-SW|SWPOE/i;

// Model (spec §10 shape): { project, head_end[], chains[{hub, spaces[]}], spaces[{name, type, primary, link[], room[]}] }.
// Each device: { part, space, role, zone, zoneAlert, partAlert, kind, recordId, unit, symbol, title }.
function oneLineModelFromState(st) {
  const rows = id => (st.records && st.records[id]) || [];
  const controllers = rows("controllers");
  const roomDevices = rows("roomDevices");
  const loads = rows("loads");
  const network = rows("network");
  const behavior = rows("spaceBehavior");
  const spaces = st.spaces || [];
  const project = st.project || {};
  const linkedToSpace = (row, space) => row.spaceId ? row.spaceId === space.id : row.area === space.name;
  const isNet = row => /^ZUMNET-/i.test(String(row.model || "").trim());
  const isLink = row => /^ZUMLINK-/i.test(String(row.model || "").trim()) && !/^ZUMLINK-BTN/i.test(String(row.model || "").trim());

  const device = (row, stage, unit, spaceName, props) => {
    const part = String(row.model || "").trim();
    const category = oneLineDeviceCategory(row, part, stage);
    const symbolPart = part || (props.kind === "primary" ? "ZUMNET-" : "");
    const dev = Object.assign({ part: part || "REQUIRED INPUT", space: spaceName, role: "", zone: "Zone: —", zoneAlert: false, partAlert: !part,
      kind: "room", stage, recordId: row.id || "", unit, symbol: oneLineSymbolId(symbolPart, category) }, props);
    dev.title = [dev.part, dev.space, dev.role, dev.zone].join(" · ");
    return dev;
  };
  const zoneOf = row => {
    const load = row.zoneId ? loads.find(item => item.id === row.zoneId) : null;
    return load ? { zone: `Zone: ${load.name || "Unnamed"}`, zoneAlert: false, load } : { zone: "Zone: none", zoneAlert: true, load: null };
  };
  const expand = (row, stage, spaceName, props) => Array.from({ length: oneLineQty(row) }, (_, i) => device(row, stage, i + 1, spaceName, typeof props === "function" ? props(i) : props));

  const buildSpace = (name, roomType, ctl, devices, zones, legacy) => {
    const primaryRow = ctl.find(row => isNet(row) && row.assignmentRole === "primary")
      || ctl.find(row => !String(row.model || "").trim() && row.assignmentRole === "primary")
      || ctl.find(isNet);
    let primary = null;
    const link = [];
    const room = [];
    const served = new Set();
    let controllerNo = 0;
    const typeNo = {};
    const controllerProps = (row, extra) => { const z = zoneOf(row); if (z.load) served.add(z.load.id); return Object.assign({ zone: z.zone, zoneAlert: z.zoneAlert }, extra); };
    ctl.forEach(row => {
      expand(row, "controllers", name, i => {
        if (row === primaryRow && i === 0) return controllerProps(row, { kind: "primary", role: "Primary" });
        if (isLink(row)) { controllerNo += 1; return controllerProps(row, { kind: "controller", role: `Controller ${controllerNo}` }); }
        return controllerProps(row, { kind: "room", role: "Controller (wiring TBD)" });
      }).forEach(dev => {
        if (dev.kind === "primary") primary = dev;
        else if (dev.kind === "controller") link.push(dev);
        else room.push(dev);
      });
    });
    let linkDevices = 0;
    devices.forEach(row => {
      const part = String(row.model || "").trim();
      const word = oneLineTypeWord(row, part);
      expand(row, "roomDevices", name, () => {
        if (isLink(row)) { typeNo[word] = (typeNo[word] || 0) + 1; return { kind: "device", role: `${word} ${typeNo[word]}` }; }
        return { kind: "room", role: `${word} (wiring TBD)` };
      }).forEach(dev => {
        if (dev.kind === "device") { link.push(dev); linkDevices += 1; } else room.push(dev);
      });
    });
    const controllerCount = link.filter(dev => dev.kind === "controller").length;
    return { name, type: roomType || "", primary, link, room, legacy: Boolean(legacy), controllerCount, linkDevices,
      loadCount: zones.length, served: served.size, unassigned: Math.max(0, zones.filter(load => !served.has(load.id)).length) };
  };

  const built = spaces.map(space => {
    const note = behavior.find(row => linkedToSpace(row, space));
    return buildSpace(space.name || "Unnamed Zūm space", (note && note.roomType) || "", controllers.filter(row => linkedToSpace(row, space)),
      roomDevices.filter(row => linkedToSpace(row, space)), loads.filter(row => linkedToSpace(row, space)), false);
  });
  const legacyRows = [...controllers, ...roomDevices, ...loads].filter(row => !spaces.some(space => linkedToSpace(row, space)));
  const legacyAreas = [...new Set(legacyRows.map(row => row.area || "Unassigned Zūm space"))];
  if (!built.length && !legacyAreas.length) legacyAreas.push("Unassigned Zūm space");
  legacyAreas.forEach(name => {
    const inArea = row => legacyRows.includes(row) && (row.area || "Unassigned Zūm space") === name;
    built.push(buildSpace(name, "", controllers.filter(inArea), roomDevices.filter(inArea), loads.filter(inArea), true));
  });

  // Head end: hubs, then switches, then everything else, record order within each (brief B2).
  const units = [];
  network.forEach(row => {
    const part = String(row.model || "").trim();
    const kind = ONE_LINE_HUB_RE.test(part) ? "hub" : ONE_LINE_SWITCH_RE.test(part) ? "switch" : "network";
    for (let i = 0; i < oneLineQty(row); i += 1) {
      const role = kind === "hub" ? "Zūm hub" : kind === "switch" ? "Network switch" : String(row.equipmentType || "").trim() || "Network equipment";
      const dev = device(row, "network", i + 1, String(row.area || "").trim() || "—", { kind, role });
      units.push(dev);
    }
  });
  const hubs = units.filter(dev => dev.kind === "hub");
  const switches = units.filter(dev => dev.kind === "switch");
  const others = units.filter(dev => dev.kind === "network");

  // Zūm Net chains: bands that have a primary, in band order, up to 20 per hub (§2.1).
  const withPrimary = built.filter(space => space.primary);
  const chainCount = Math.max(1, Math.ceil(withPrimary.length / ONE_LINE.CHAIN_MAX));
  const chains = Array.from({ length: chainCount }, (_, c) => ({ hub: hubs[c] || null,
    spaces: withPrimary.slice(c * ONE_LINE.CHAIN_MAX, (c + 1) * ONE_LINE.CHAIN_MAX) }));
  const head_end = [...(hubs[0] ? [hubs[0]] : []), ...switches, ...hubs.slice(chainCount), ...others];
  return { project, head_end, chains, spaces: built };
}

/* ------------------------------------------------------------------ layout */
function oneLineSummary(model) {
  const spaces = model.spaces;
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  const primaries = spaces.filter(space => space.primary).length;
  const controllers = spaces.reduce((sum, space) => sum + space.controllerCount, 0);
  const roomDevices = spaces.reduce((sum, space) => sum + [...space.link, ...space.room].filter(dev => dev.stage === "roomDevices").length, 0);
  const zones = spaces.reduce((sum, space) => sum + space.served, 0);
  return { spaces: spaces.length, primaries, controllers, roomDevices, zones,
    lines: [`${plural(spaces.length, "space", "spaces")} · ${plural(primaries, "room primary", "room primaries")} · ${plural(controllers, "Zūm Link controller", "Zūm Link controllers")}`,
      `${plural(roomDevices, "room device", "room devices")} · ${plural(zones, "load zone", "load zones")} assigned`] };
}

function layoutOneLine(model) {
  const K = ONE_LINE;
  const S = ONE_LINE_SVG_STYLE;
  const spaces = model.spaces && model.spaces.length ? model.spaces
    : [{ name: "Unassigned Zūm space", type: "", primary: null, link: [], room: [], legacy: true, controllerCount: 0, linkDevices: 0, loadCount: 0, served: 0, unassigned: 0 }];
  const chains = model.chains && model.chains.length ? model.chains : [{ hub: null, spaces: [] }];
  const headEnd = model.head_end || [];
  const els = [];
  const devices = [];
  const wires = [];
  const used = [];
  const bands = [];
  const strips = [];
  const T = (x, y, size, fill, text, o = {}) => {
    let shown = String(text == null ? "" : text);
    let title = "";
    if (o.maxW) {
      const fit = oneLineFit(shown, size, o.bold, o.maxW);
      if (fit.cut) { title = shown; shown = fit.text; }
    }
    return Object.assign({ t: "text", x, y, size, fill, text: shown, title }, o);
  };

  // A device symbol plus its four-line label (§6): part (bold), space, role, zone.
  const place = (dev, cx, cy, labelY) => {
    const bundle = oneLineBundle();
    const id = bundle.symbols[dev.symbol] ? dev.symbol : "generic-device";
    const symbol = bundle.symbols[id];
    if (!symbol) throw new Error(`one-line symbol ${dev.symbol} missing from ONE_LINE_SYMBOLS`);
    if (!used.includes(id)) used.push(id);
    const size = oneLineSymbolSize(symbol, dev.kind);
    const x = oneLineRound(cx - size.w / 2);
    const y = oneLineRound(cy - size.h / 2);
    els.push({ t: "use", id, x, y, w: size.w, h: size.h, attrs: { "data-dev": `${dev.recordId}#${dev.unit}`, "data-kind": dev.kind } });
    const part = dev.partAlert ? "REQUIRED INPUT" : dev.part;
    const wide = oneLineTextWidth(part, 11, true) > K.LABEL_W;
    els.push(T(cx, labelY, 11, dev.partAlert ? S.alert : S.ink, part, { bold: true, anchor: "middle", textLength: wide ? K.LABEL_W : 0, attrs: { "data-label": "part" } }));
    els.push(T(cx, labelY + 15, 10.5, S.ink, dev.space, { anchor: "middle", maxW: K.LABEL_W, attrs: { "data-label": "space" } }));
    els.push(T(cx, labelY + 29, 10.5, S.muted, dev.role, { anchor: "middle", maxW: K.LABEL_W, attrs: { "data-label": "role" } }));
    els.push(T(cx, labelY + 43, 10.5, dev.zoneAlert ? S.alert : S.muted, dev.zone, { anchor: "middle", maxW: K.LABEL_W, attrs: { "data-label": "zone" } }));
    const rec = { dev, cx, cy, x, y, w: size.w, h: size.h, left: x, right: oneLineRound(x + size.w), top: y, bottom: oneLineRound(y + size.h), labelY };
    devices.push(rec);
    return rec;
  };

  // §5 head end: hub, switch, ... at cy 175, extra rows at 175 + 180 r when more than three devices.
  const summary = oneLineSummary(model);
  const noHub0 = !chains[0].hub;
  const items = noHub0 ? [{ callout: true }, ...headEnd] : headEnd;
  const slotOf = i => {
    if (i < K.HEAD_SLOTS.length) return { cx: K.HEAD_SLOTS[i], cy: K.HEAD_Y, row: 0 };
    const j = i - K.HEAD_SLOTS.length;
    const row = 1 + Math.floor(j / K.HEAD_SLOTS_LOW.length);
    return { cx: K.HEAD_SLOTS_LOW[j % K.HEAD_SLOTS_LOW.length], cy: K.HEAD_Y + K.HEAD_ROW * row, row };
  };
  const headRows = items.length ? slotOf(items.length - 1).row + 1 : 1;
  const calloutText = "ZUM-HUB4 - REQUIRED INPUT";
  const calloutEl = (cx, cy) => Object.assign(T(cx, cy + 4, 12, S.alert, calloutText, { bold: true, anchor: "middle", attrs: { "data-callout": "hub" } }), {});
  els.push(T(100, 130, 10, S.muted, "HEAD END", { bold: true, spacing: 0.8 }));
  const sizeOf = dev => {
    const bundle = oneLineBundle();
    return oneLineSymbolSize(bundle.symbols[bundle.symbols[dev.symbol] ? dev.symbol : "generic-device"], dev.kind);
  };
  // Ethernet / PoE: hub 1 to the switch in slot 1 (straight) or slot 2 (elbow over the top). Further switches have no line (open item).
  const eth = { stroke: S.ethernet, width: 2, dash: "10 4 2 4" };
  const hubItem = !noHub0 ? items[0] : null;
  if (hubItem) {
    const hubSize = sizeOf(hubItem);
    const second = items[1] && items[1].kind === "switch" ? items[1] : null;
    const third = items[2] && items[2].kind === "switch" ? items[2] : null;
    if (second) {
      const x1 = oneLineRound(slotOf(0).cx + hubSize.w / 2);
      const x2 = oneLineRound(slotOf(1).cx - sizeOf(second).w / 2);
      els.push({ t: "line", x1, y1: K.HEAD_Y, x2, y2: K.HEAD_Y, ...eth, attrs: { "data-wire": "eth", "data-from": `${hubItem.recordId}#${hubItem.unit}`, "data-to": `${second.recordId}#${second.unit}` } });
      els.push(T(oneLineRound((x1 + x2) / 2), K.HEAD_Y - 8, 9, S.ethernet, "ETHERNET / PoE", { bold: true, anchor: "middle" }));
      wires.push({ type: "eth", from: hubItem.recordId, to: second.recordId });
    }
    if (third) {
      const px = oneLineRound(slotOf(0).cx + 60);
      const top = oneLineRound(K.HEAD_Y - hubSize.h / 2);
      const swTop = oneLineRound(K.HEAD_Y - sizeOf(third).h / 2);
      els.push({ t: "path", d: `M${px},${top} V114 H${slotOf(2).cx} V${swTop}`, ...eth, attrs: { "data-wire": "eth", "data-from": `${hubItem.recordId}#${hubItem.unit}`, "data-to": `${third.recordId}#${third.unit}` } });
      els.push(T(oneLineRound((px + slotOf(2).cx) / 2), 128, 9, S.ethernet, "ETHERNET / PoE", { bold: true, anchor: "middle" }));
      wires.push({ type: "eth", from: hubItem.recordId, to: third.recordId });
    }
  }
  let hubRef = null;
  items.forEach((item, i) => {
    const slot = slotOf(i);
    if (item.callout) {
      els.push(calloutEl(slot.cx, slot.cy));
      hubRef = { left: oneLineRound(slot.cx - oneLineTextWidth(calloutText, 12, true) / 2 - 8), cy: slot.cy };
    } else {
      const rec = place(item, slot.cx, slot.cy, slot.cy + K.HEAD_LABEL_DY);
      if (i === 0 && item.kind === "hub") hubRef = { left: rec.left, cy: slot.cy };
    }
  });

  els.push(T(1340, 130, 10, S.muted, "SYSTEM SUMMARY", { bold: true, spacing: 0.8, anchor: "end" }));
  summary.lines.forEach((line, i) => els.push(T(1340, 156 + i * 18, 11.5, S.ink, line, { anchor: "end", attrs: { "data-summary": String(i) } })));

  // Bands and chains.
  const chainOf = space => chains.findIndex(chain => chain.spaces.includes(space));
  const chainState = chains.map(() => ({ prims: [], hubLeft: null, hubCy: null, endY: null }));
  chainState[0].hubLeft = hubRef ? hubRef.left : null;
  chainState[0].hubCy = K.HEAD_Y;
  let y = K.FIRST_BAND + K.HEAD_ROW * (headRows - 1);
  const blocks = [];
  spaces.forEach((space, index) => {
    const elStart = els.length;
    const devStart = devices.length;
    const c = space.primary ? chainOf(space) : -1;
    if (c > 0 && !chainState[c].prims.length) {
      // New hub chain (§2.1): arrow ends the previous chain, then an inline hub strip.
      const spanBottom = y - K.BAND_GAP;
      chainState[c - 1].endY = spanBottom + 35;
      chainState[c - 1].endBand = index;
      chainState[c].hubBand = index;
      const hubCy = spanBottom + 130;
      const hub = chains[c].hub;
      if (hub) {
        const rec = place(hub, K.HEAD_X, hubCy, hubCy + K.HEAD_LABEL_DY);
        chainState[c].hubLeft = rec.left;
      } else {
        els.push(calloutEl(K.HEAD_X, hubCy));
        chainState[c].hubLeft = oneLineRound(K.HEAD_X - oneLineTextWidth(calloutText, 12, true) / 2 - 8);
      }
      chainState[c].hubCy = hubCy;
      strips.push({ chain: c, y: hubCy });
      y = spanBottom + 270;
    }
    const chain = [...(space.primary ? [space.primary] : []), ...space.link];
    const n = chain.length;
    const wrap = n > K.ONE_ROW_MAX;
    const rows = wrap ? Math.ceil(n / K.PER_ROW) : 1;
    const h = K.BAND_H + K.ROW_PITCH * (Math.max(rows, space.room.length, 1) - 1);
    const by = y;
    const cy0 = by + 115;
    els.push({ t: "rect", x: K.BAND_X, y: by, w: K.BAND_W, h, rx: 4, fill: S.paper, stroke: S.band, sw: 1.2, attrs: { "data-band": String(index) } });
    // Header: name + type on the left, counts on the right (§5).
    const parts = [];
    const ctlText = `${space.controllerCount} ${space.controllerCount === 1 ? "controller" : "controllers"}`;
    parts.push(space.primary ? { text: "1 primary", fill: S.muted } : { text: "no primary - REQUIRED INPUT", fill: S.alert });
    parts.push({ text: ` · ${ctlText} · load zones: ${space.served > 0 ? `${space.served} assigned` : "none assigned"}`, fill: S.muted });
    if (space.unassigned > 0) parts.push({ text: ` · ${space.unassigned} unassigned`, fill: S.alert });
    const rightWidth = oneLineTextWidth(parts.map(part => part.text).join(""), 10.5, false);
    const avail = Math.max(60, K.BAND_X + K.BAND_W - 20 - rightWidth - 120 - 24);
    const typeFit = space.type ? oneLineFit(space.type, 12, false, Math.min(120, avail / 2)) : { text: "", cut: false };
    const typeW = typeFit.text ? oneLineTextWidth(typeFit.text, 12, false) + 8 : 0;
    const nameFit = oneLineFit(space.name, 16, true, Math.max(40, avail - typeW));
    els.push({ t: "text", x: 120, y: by + 28, size: 16, bold: true, fill: S.space, text: nameFit.text, title: nameFit.cut ? space.name : "",
      tspan: typeFit.text ? { text: typeFit.text, size: 12, fill: S.muted, dx: 8, title: typeFit.cut ? space.type : "" } : null, attrs: { "data-band-name": "1" } });
    els.push({ t: "text", x: 1330, y: by + 28, size: 10.5, fill: S.muted, anchor: "end", text: "", spans: parts, attrs: { "data-band-counts": "1" } });

    // Chain positions: one row of up to 7, else serpentine at 6 per row (rows run left-right, right-left, ...).
    const pos = chain.map((dev, i) => {
      const row = wrap ? Math.floor(i / K.PER_ROW) : 0;
      const s = wrap ? i % K.PER_ROW : i;
      const slot = row % 2 === 0 ? s : K.PER_ROW - 1 - s;
      return { dev, row, cx: K.X0 + K.STEP * slot, cy: by + 115 + K.ROW_PITCH * row };
    });
    // Zūm Link segments need the symbol edges, so sizes are computed ahead of placement.
    const bundle = oneLineBundle();
    const sizes = pos.map(p => oneLineSymbolSize(bundle.symbols[bundle.symbols[p.dev.symbol] ? p.dev.symbol : "generic-device"], p.dev.kind));
    const edge = (p, size, side) => oneLineRound(side === "l" ? p.cx - size.w / 2 : p.cx + size.w / 2);
    const link = { stroke: S.zumLink, width: 2.4 };
    for (let i = 0; i + 1 < pos.length; i += 1) {
      const a = pos[i];
      const b = pos[i + 1];
      const attrs = { "data-wire": "link", "data-from": `${a.dev.recordId}#${a.dev.unit}`, "data-to": `${b.dev.recordId}#${b.dev.unit}`, "data-band": String(index) };
      if (a.row === b.row) {
        const forward = a.row % 2 === 0;
        const x1 = forward ? edge(a, sizes[i], "r") : edge(a, sizes[i], "l");
        const x2 = forward ? edge(b, sizes[i + 1], "l") : edge(b, sizes[i + 1], "r");
        els.push({ t: "line", x1, y1: a.cy, x2, y2: a.cy, ...link, attrs });
        wires.push({ type: "link", band: index, from: i, to: i + 1 });
      } else if (a.row % 2 === 0) {
        els.push({ t: "path", d: `M${edge(a, sizes[i], "r")},${a.cy} H${K.TURN_RIGHT} V${b.cy} H${edge(b, sizes[i + 1], "r")}`, ...link, attrs });
        wires.push({ type: "link", band: index, from: i, to: i + 1, turn: true });
      } else {
        els.push({ t: "path", d: `M${edge(a, sizes[i], "l")},${a.cy} H${K.TURN_LEFT} V${b.cy} H${edge(b, sizes[i + 1], "l")}`, ...link, attrs });
        wires.push({ type: "link", band: index, from: i, to: i + 1, turn: true });
      }
    }
    pos.forEach(p => place(p.dev, p.cx, p.cy, p.cy + K.LABEL_DY));
    const primaryRec = space.primary ? devices.find(rec => rec.dev === space.primary) : null;

    // Room devices column (§5): divider, label, devices stacked in 180 px steps, unconnected.
    els.push({ t: "line", x1: K.DIVIDER_X, y1: by + 50, x2: K.DIVIDER_X, y2: by + h - 15, stroke: S.band, width: null, dash: "4 4", attrs: { "data-divider": "1" } });
    els.push(T(K.ROOM_X, by + 54, 9.5, S.muted, "ROOM DEVICES", { bold: true, spacing: 0.6, anchor: "middle" }));
    if (space.room.length) space.room.forEach((dev, m) => place(dev, K.ROOM_X, cy0 + K.ROW_PITCH * m, cy0 + K.ROW_PITCH * m + K.LABEL_DY));
    else els.push(T(K.ROOM_X, cy0 + 4, 14, S.muted, "—", { anchor: "middle", attrs: { "data-empty": "room" } }));
    if (primaryRec) {
      els.push(T(106, cy0 - 22, 8, S.zumNet, "NET IN", { bold: true }));
      els.push(T(106, cy0 + 30, 8, S.zumNet, "NET OUT", { bold: true }));
      chainState[c].prims.push({ space, index, cy: cy0, lx: oneLineRound(primaryRec.left + 2), rec: primaryRec });
    }
    bands.push({ index, name: space.name, x: K.BAND_X, y: by, w: K.BAND_W, h, rows, cy: cy0, chain: c });
    blocks.push({ start: index ? y - K.BAND_GAP / 2 : by - K.BAND_GAP / 2, end: by + h + K.BAND_GAP / 2, elStart, elEnd: els.length, devStart, devEnd: devices.length });
    y = by + h + K.BAND_GAP;
  });
  const lastBottom = y - K.BAND_GAP;
  blocks[blocks.length - 1].end = lastBottom + K.TAIL;
  chains.forEach((chain, c) => {
    if (chainState[c].prims.length && chainState[c].endY == null) { chainState[c].endY = lastBottom + 35; chainState[c].endBand = blocks.length - 1; }
  });

  // Landscape sheet: pack the bands top to bottom into columns, choosing the shortest sheet whose
  // columns fit inside a 17:11 page. The first band stays under the head end; later columns start at COL_TOP.
  const pack = Hs => {
    const limit = Hs - K.RESERVE;
    const out = [];
    let col = 0;
    let dy = 0;
    for (let i = 0; i < blocks.length; i += 1) {
      if (blocks[i].end + dy > limit) {
        if (!i) return null;
        col += 1;
        dy = K.COL_TOP - blocks[i].start;
        if (blocks[i].end + dy > limit) return null;
      }
      out.push({ col, dx: col * K.COL_PITCH, dy });
    }
    return { cols: col + 1, place: out };
  };
  const tallH = lastBottom + K.FOOT;
  let H = tallH;
  let packing = pack(tallH);
  for (let Hs = 600; Hs < tallH; Hs += 10) {
    const p = pack(Hs);
    if (p && K.W + (p.cols - 1) * K.COL_PITCH <= Hs * K.ASPECT) { H = Hs; packing = p; break; }
  }
  const W = Math.max(K.W + (packing.cols - 1) * K.COL_PITCH, Math.round(H * K.ASPECT));
  if (W > H * K.ASPECT) H = Math.round(W / K.ASPECT);
  const at = i => packing.place[i] || { col: 0, dx: 0, dy: 0 };
  const shiftD = (d, dx, dy) => d.replace(/([MLHV])\s*(-?[\d.]+)(?:,(-?[\d.]+))?/g, (m, cmd, a, b) =>
    cmd === "H" ? `H${oneLineRound(+a + dx)}` : cmd === "V" ? `V${oneLineRound(+a + dy)}` : `${cmd}${oneLineRound(+a + dx)},${oneLineRound(+b + dy)}`);
  blocks.forEach((block, i) => {
    const { dx, dy } = at(i);
    if (!dx && !dy) return;
    for (let e = block.elStart; e < block.elEnd; e += 1) {
      const el = els[e];
      if (el.t === "line") { el.x1 += dx; el.x2 += dx; el.y1 += dy; el.y2 += dy; }
      else if (el.t === "path") el.d = shiftD(el.d, dx, dy);
      else { el.x += dx; el.y += dy; }
    }
    for (let d = block.devStart; d < block.devEnd; d += 1) {
      const rec = devices[d];
      ["cx", "x", "left", "right"].forEach(key => { rec[key] = oneLineRound(rec[key] + dx); });
      ["cy", "y", "top", "bottom", "labelY"].forEach(key => { rec[key] = oneLineRound(rec[key] + dy); });
    }
    bands[i].x += dx; bands[i].y += dy; bands[i].cy += dy; bands[i].col = at(i).col;
  });
  chainState.forEach(st => {
    st.prims.forEach(p => { p.cy += at(p.index).dy; p.lx = oneLineRound(p.lx + at(p.index).dx); p.col = at(p.index).col; });
    if (st.hubBand != null) { st.hubLeft = oneLineRound(st.hubLeft + at(st.hubBand).dx); st.hubCy += at(st.hubBand).dy; }
    if (st.endBand != null && st.endY != null) st.endY += at(st.endBand).dy;
  });
  strips.forEach(strip => { const st = chainState[strip.chain]; if (st.hubBand != null) strip.y += at(st.hubBand).dy; });

  // Zūm Net (§2.1, §5): one daisy chain per hub, hub -> Net In / Net Out of each primary -> "To next space".
  // A segment that continues in the next column runs along the bottom channel and up that column's outer gutter.
  const net = { stroke: S.zumNet, width: 2.2, dash: "8 5" };
  const channelY = H - 240;
  const route = (x1, y1, col1, g, x2, y2, col2) => col1 === col2
    ? `M${x1},${y1} H${col1 * K.COL_PITCH + g} V${y2} H${x2}`
    : `M${x1},${y1} H${col1 * K.COL_PITCH + g} V${channelY} H${col2 * K.COL_PITCH + K.COL_GUTTER} V${y2} H${x2}`;
  chains.forEach((chain, c) => {
    const st = chainState[c];
    const list = st.prims;
    if (!list.length || st.hubLeft == null) return;
    const gutter = j => K.GUTTERS[j % 2];
    const first = list[0];
    const hubCol = st.hubBand != null ? at(st.hubBand).col : 0;
    els.push({ t: "path", d: route(st.hubLeft, st.hubCy, hubCol, gutter(0), first.lx, oneLineRound(first.cy - 16), first.col), ...net,
      attrs: { "data-wire": "net", "data-chain": String(c), "data-seg": "0", "data-from": "hub", "data-to": `${first.rec.dev.recordId}#${first.rec.dev.unit}` } });
    wires.push({ type: "net", chain: c, seg: 0 });
    for (let j = 1; j < list.length; j += 1) {
      const a = list[j - 1];
      const b = list[j];
      els.push({ t: "path", d: route(a.lx, oneLineRound(a.cy + 16), a.col, gutter(j), b.lx, oneLineRound(b.cy - 16), b.col), ...net,
        attrs: { "data-wire": "net", "data-chain": String(c), "data-seg": String(j), "data-from": `${a.rec.dev.recordId}#${a.rec.dev.unit}`, "data-to": `${b.rec.dev.recordId}#${b.rec.dev.unit}` } });
      wires.push({ type: "net", chain: c, seg: j });
    }
    const last = list[list.length - 1];
    const endCol = at(st.endBand).col;
    const endDx = endCol * K.COL_PITCH;
    els.push({ t: "path", d: route(last.lx, oneLineRound(last.cy + 16), last.col, gutter(list.length), endDx + K.ARROW_X, st.endY, endCol), ...net, marker: "ol-parr",
      attrs: { "data-wire": "netend", "data-chain": String(c), "data-seg": String(list.length), "data-from": `${last.rec.dev.recordId}#${last.rec.dev.unit}` } });
    wires.push({ type: "netend", chain: c, seg: list.length });
    const labelX = hubCol * K.COL_PITCH + 62;
    els.push({ t: "text", x: labelX, y: 0, size: 9, bold: true, fill: S.zumNet, anchor: "middle", spacing: 0.4, text: "ZŪM NET",
      rotate: `translate(${labelX},${oneLineRound((st.hubCy + first.cy) / 2)}) rotate(-90)`, attrs: { "data-chain": String(c) } });
    els.push(T(endDx + 122, st.endY + 4, 10, S.zumNet, "To next space", { bold: true }));
    els.push(T(endDx + 206, st.endY + 4, 10, S.muted, "— Zūm Net daisy chain continues, up to 20 spaces per ZUM-HUB4"));
  });

  return {
    W, H, columns: packing.cols, summary, els, used, devices, wires, bands, strips, chains: chainState.map(s => ({ endY: s.endY, hubCy: s.hubCy, hubLeft: s.hubLeft, primaries: s.prims.length })),
    legend: { x: K.LEGEND.x, y: H - 230, w: K.LEGEND.w, h: K.LEGEND.h },
    titleBlock: { x: W - (K.W - K.TITLE.x), y: H - 230, w: K.TITLE.w, h: K.TITLE.h },
    border: { x: K.BORDER, y: K.BORDER, w: W - 2 * K.BORDER, h: H - 2 * K.BORDER },
    model: { head: items.length, chains: chains.length }
  };
}

/* ------------------------------------------------------------------ render */
function oneLineAttrs(attrs) {
  return Object.entries(attrs || {}).map(([key, value]) => ` ${key}="${escapeHTML(value)}"`).join("");
}

function oneLineTextMarkup(el) {
  const a = [`x="${oneLineNum(el.x)}"`, `y="${oneLineNum(el.y)}"`, `font-size="${el.size}"`];
  if (el.bold) a.push('font-weight="700"');
  a.push(`fill="${el.fill}"`);
  if (el.anchor) a.push(`text-anchor="${el.anchor}"`);
  if (el.spacing) a.push(`letter-spacing="${el.spacing}"`);
  if (el.italic) a.push('font-style="italic"');
  if (el.textLength) a.push(`textLength="${el.textLength}" lengthAdjust="spacingAndGlyphs"`);
  if (el.rotate) { a.shift(); a.shift(); a.unshift(`transform="${el.rotate}"`); }
  const title = el.title ? `<title>${escapeHTML(el.title)}</title>` : "";
  let inner = `${title}${escapeHTML(el.text)}`;
  if (el.tspan) inner += `<tspan font-size="${el.tspan.size}" font-weight="400" fill="${el.tspan.fill}" dx="${el.tspan.dx}">${el.tspan.title ? `<title>${escapeHTML(el.tspan.title)}</title>` : ""}${escapeHTML(el.tspan.text)}</tspan>`;
  if (el.spans) inner += el.spans.map(span => `<tspan fill="${span.fill}">${escapeHTML(span.text)}</tspan>`).join("");
  return `<text ${a.join(" ")}${oneLineAttrs(el.attrs)}>${inner}</text>`;
}

function oneLineElMarkup(el) {
  if (el.t === "text") return oneLineTextMarkup(el);
  if (el.t === "use") return `<use href="#sym-${el.id}" xlink:href="#sym-${el.id}" x="${oneLineNum(el.x)}" y="${oneLineNum(el.y)}" width="${oneLineNum(el.w)}" height="${oneLineNum(el.h)}"${oneLineAttrs(el.attrs)}/>`;
  const dash = el.dash ? ` stroke-dasharray="${el.dash}"` : "";
  if (el.t === "line") return `<line x1="${oneLineNum(el.x1)}" y1="${oneLineNum(el.y1)}" x2="${oneLineNum(el.x2)}" y2="${oneLineNum(el.y2)}" stroke="${el.stroke}"${el.width ? ` stroke-width="${el.width}"` : ""}${dash}${oneLineAttrs(el.attrs)}/>`;
  if (el.t === "path") return `<path d="${el.d}" fill="none" stroke="${el.stroke}" stroke-width="${el.width}"${dash}${el.marker ? ` marker-end="url(#${el.marker})"` : ""}${oneLineAttrs(el.attrs)}/>`;
  if (el.t === "rect") return `<rect x="${oneLineNum(el.x)}" y="${oneLineNum(el.y)}" width="${oneLineNum(el.w)}" height="${oneLineNum(el.h)}"${el.rx ? ` rx="${el.rx}"` : ""} fill="${el.fill}" stroke="${el.stroke}" stroke-width="${el.sw}"${oneLineAttrs(el.attrs)}/>`;
  return "";
}

// §8 legend, geometry relative to its box.
function oneLineLegendMarkup(box) {
  const S = ONE_LINE_SVG_STYLE;
  const { x: LX, y: LY, w: LW, h: LH } = box;
  const c1 = LX + 20, c2 = LX + 300, c3 = LX + 590, r0 = LY + 60, st = 28;
  const text = (x, y, size, fill, value, extra = "") => `<text x="${x}" y="${y}" font-size="${size}" ${extra}fill="${fill}">${escapeHTML(value)}</text>`;
  const sample = (x, y, style, label, extra = "") => `<line x1="${x}" y1="${y}" x2="${x + 46}" y2="${y}" ${style}${extra}/>${text(x + 58, y + 4, 11, S.ink, label)}`;
  const out = [
    `<rect x="${LX}" y="${LY}" width="${LW}" height="${LH}" fill="#fff" stroke="${S.ink}" stroke-width="1.2"/>`,
    text(LX + 16, LY + 24, 12, S.ink, "LEGEND", 'font-weight="700" letter-spacing="0.6" '),
    `<line x1="${LX}" y1="${LY + 34}" x2="${LX + LW}" y2="${LY + 34}" stroke="${S.band}"/>`,
    sample(c1, r0, `stroke="${S.zumNet}" stroke-width="2.2" stroke-dasharray="8 5"`, "Zūm Net — daisy chain, space to space"),
    sample(c1, r0 + st, `stroke="${S.zumLink}" stroke-width="2.4"`, "Zūm Link — daisy chain, out → in"),
    sample(c1, r0 + 2 * st, `stroke="${S.ethernet}" stroke-width="2" stroke-dasharray="2 5" stroke-linecap="round"`, "Zūm Mesh — wireless"),
    sample(c1, r0 + 3 * st, `stroke="${S.ethernet}" stroke-width="2" stroke-dasharray="10 4 2 4"`, "Ethernet / PoE"),
    sample(c2, r0, `stroke="${S.alert}" stroke-width="2" marker-end="url(#ol-arr)"`, "SW / LV load control"),
    sample(c2, r0 + st, `stroke="${S.alert}" stroke-width="2" stroke-dasharray="6 4"`, "Zone output — required input"),
    sample(c2, r0 + 2 * st, `stroke="${S.dc}" stroke-width="2"`, "24 VDC / analog"),
    `<line x1="${c2}" y1="${r0 + 3 * st}" x2="${c2 + 46}" y2="${r0 + 3 * st}" stroke="${S.ethernet}" stroke-width="2"/><circle cx="${c2 + 23}" cy="${r0 + 3 * st}" r="4" fill="${S.ethernet}"/>`,
    text(c2 + 58, r0 + 3 * st + 4, 11, S.ink, "Junction = connection"),
    text(c3, r0 - 4, 9.5, S.muted, "DEVICE LABEL", 'font-weight="700" letter-spacing="0.6" ')
  ];
  [["PART NUMBER", S.ink, true], ["Space", S.ink, false], ["Role", S.muted, false], ["Zone", S.alert, false]].forEach(([label, fill, bold], i) => {
    out.push(text(c3, r0 + 14 + i * 15, bold ? 11 : 10.5, fill, label, `font-weight="${bold ? 700 : 400}" `));
  });
  out.push(text(LX + 16, LY + LH - 12, 10, S.muted, "ZUMLINK keypads and sensors join the Zūm Link daisy chain. Link order shown is not a port assignment.", 'font-style="italic" '));
  return `<g data-part="legend">${out.join("")}</g>`;
}

// §9 title block. Empty values print "—"; user text is escaped and truncated to its slot.
function oneLineTitleBlockMarkup(box, project) {
  const S = ONE_LINE_SVG_STYLE;
  const { x: TX, y: TY, w: TW, h: TH } = box;
  const rows = [TY, TY + 50, TY + 88, TY + 126, TY + 164];
  const out = [`<rect x="${TX}" y="${TY}" width="${TW}" height="${TH}" fill="#fff" stroke="${S.ink}" stroke-width="1.2"/>`];
  rows.slice(1).forEach(row => out.push(`<line x1="${TX}" y1="${row}" x2="${TX + TW}" y2="${row}" stroke="${S.ink}" stroke-width="0.8"/>`));
  out.push(`<line x1="${TX + 300}" y1="${rows[2]}" x2="${TX + 300}" y2="${rows[4]}" stroke="${S.ink}" stroke-width="0.8"/>`);
  out.push(`<text x="${TX + 16}" y="${TY + 33}" font-size="19" font-weight="700" fill="${S.ink}" letter-spacing="1.5">ZŪM WIRING ONE-LINE</text>`);
  const field = (x, y, label, value, width) => {
    const full = String(value == null ? "" : value).trim() || "—";
    const fit = oneLineFit(full, 12, true, width);
    out.push(`<text x="${x}" y="${y + 13}" font-size="8.5" font-weight="700" fill="${S.muted}" letter-spacing="0.6">${label}</text>`);
    out.push(`<text x="${x}" y="${y + 29}" font-size="12" font-weight="700" fill="${S.ink}">${fit.cut ? `<title>${escapeHTML(full)}</title>` : ""}${escapeHTML(fit.text)}</text>`);
  };
  field(TX + 12, rows[1], "PROJECT", project.name, 456);
  field(TX + 12, rows[2], "PROJECT NO.", project.number, 276);
  field(TX + 312, rows[2], "DATE", project.date || new Date().toLocaleDateString(), 156);
  field(TX + 12, rows[3], "LOCATION", project.location, 276);
  field(TX + 312, rows[3], "CLIENT", project.client, 156);
  out.push(`<text x="${TX + 12}" y="${rows[4] + 20}" font-size="9.5" fill="${S.muted}">Generated design one-line · not a terminal-by-terminal installation drawing.</text>`);
  return `<g data-part="titleblock">${out.join("")}</g>`;
}

function renderOneLineSVG(layout, project) {
  const S = ONE_LINE_SVG_STYLE;
  const info = project || {};
  const { W, H } = layout;
  const bundle = oneLineBundle();
  const subtitle = [info.architecture, info.voltage, "system one-line"].map(part => String(part == null ? "" : part).trim()).filter(Boolean).join(" · ");
  const marker = (id, color) => `<marker id="${id}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="${color}"/></marker>`;
  const symbols = layout.used.map(id => `<symbol id="sym-${id}" viewBox="${bundle.symbols[id].viewBox}">${bundle.symbols[id].body}</symbol>`).join("");
  const b = layout.border;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" class="wiring-diagram" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="${S.font}" role="img" aria-label="Zūm wiring one-line diagram" data-sheet-w="${W}" data-sheet-h="${H}">`,
    `<defs>${marker("ol-arr", S.alert)}${marker("ol-parr", S.zumNet)}${symbols}</defs>`,
    `<rect width="100%" height="100%" fill="${S.paper}"/>`,
    `<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" fill="none" stroke="${S.ink}" stroke-width="1.5"/>`,
    `<text x="50" y="62" font-size="22" font-weight="700" fill="${S.ink}" letter-spacing="0.5">CRESTRON ZŪM SYSTEM</text>`,
    `<text x="50" y="84" font-size="12" fill="${S.muted}">${escapeHTML(subtitle)}</text>`,
    `<line x1="20" y1="104" x2="${W - 20}" y2="104" stroke="${S.ink}" stroke-width="1"/>`,
    ...layout.els.map(oneLineElMarkup),
    oneLineLegendMarkup(layout.legend),
    oneLineTitleBlockMarkup(layout.titleBlock, info),
    `</svg>`
  ].join("\n");
}

// The full XML document for Download SVG. The SVG is self-contained and carries its own xmlns.
function oneLineSVGDocument() {
  return `<?xml version="1.0" encoding="UTF-8"?>\n${renderOneLineSVG(layoutOneLine(oneLineModelFromState(state)), state.project)}\n`;
}

// Print / Save PDF for the one-line report: a throwaway same-origin iframe holds the drawing and a
// page rule sized to it (one 17:11 landscape page), so the main document's print CSS and
// every other report are untouched.
function printOneLine() {
  const layout = layoutOneLine(oneLineModelFromState(state));
  const svg = renderOneLineSVG(layout, state.project);
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.tabIndex = -1;
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
  let timer = 0;
  const cleanup = () => {
    window.clearTimeout(timer);
    frame.remove();
  };
  frame.addEventListener("load", () => {
    const view = frame.contentWindow;
    view.addEventListener("afterprint", cleanup);
    timer = window.setTimeout(cleanup, 60000);
    view.focus();
    view.print();
  });
  frame.srcdoc = `<!doctype html><html><head><meta charset="utf-8"><title>Zūm Wiring One-Line</title><style>@page{size:${layout.W}px ${layout.H}px;margin:0}html,body{margin:0;padding:0;background:#fff}svg{display:block}</style></head><body>${svg}</body></html>`;
  document.body.append(frame);
}
