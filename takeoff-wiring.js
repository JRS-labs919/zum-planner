"use strict";

// Plan wiring: pure derivation, geometry and SVG-string builders for the
// takeoff overlay. Nothing here reads `state` or the DOM; it calls existing
// pure globals (takeoffProduct, toolboxStampLabel, orderedSpaceBoundaries,
// spaceContainsPoint, rankedControllerModels, escapeHTML) at call time only.
// Derived wires use ONLY rules R1-R6 of the spec; anything else gets no wire.

// Manual wire types: the Wiring & Links connection types minus Zūm Mesh.
const PLAN_WIRE_TYPES = ["Zūm Net", "Zūm Link", "Ethernet / PoE", "Cresnet", "0-10 V control", "DALI loop", "SW or LV load control", "24 VDC analog", "Emergency override"];

const PLAN_WIRE_CLASS = {
  "Zūm Net": "wire-zumnet", "Zūm Link": "wire-zumlink", "Ethernet / PoE": "wire-ethernet",
  "Cresnet": "wire-cresnet", "Emergency override": "wire-emergency", "24 VDC analog": "wire-analog",
  "0-10 V control": "wire-control", "DALI loop": "wire-control", "SW or LV load control": "wire-control",
  "Phase-dimmed load": "wire-control", "Switched load": "wire-control", "Switched plug load": "wire-control"
};

// Order of the legend rows in the Plan wiring panel.
const PLAN_WIRE_ORDER = ["Zūm Net", "Zūm Link", "Ethernet / PoE", "Cresnet", "0-10 V control", "DALI loop", "Phase-dimmed load", "Switched load", "Switched plug load", "SW or LV load control", "24 VDC analog", "Emergency override"];

// Same control-type -> wire-type map as syncZonePaths (record-relations.js).
const PLAN_WIRE_LOAD_TYPES = { "0-10 V dimming": "0-10 V control", "DALI": "DALI loop", "Phase control": "Phase-dimmed load", "Switching": "Switched load", "Plug-load switching": "Switched plug load" };

// 20 devices per Zūm Net daisy chain (designChecks in app.js).
const PLAN_WIRE_RUN_LIMIT = 20;

function planWireStampInfo(mark, catalog, index = -1) {
  const entry = (catalog || []).find(item => item.id === mark.catalogId) || {};
  const product = typeof takeoffProduct === "function" ? takeoffProduct(entry.model) : null;
  const model = String(product?.model || entry.model || "").trim().toUpperCase();
  const category = entry.category || "";
  let kind = "other";
  if (/SWPOE/.test(model)) kind = "switch";
  else if (model === "ZUM-HUB4" || model.startsWith("ZUML-HUB4")) kind = "hub";
  else if (category === "fixture") kind = "fixture";
  else if (category === "controller" && model.startsWith("ZUMNET-")) kind = "net";
  else if (model.startsWith("ZUMLINK-") && !model.startsWith("ZUMLINK-BTN") && ["controller", "keypad", "sensor", "interface"].includes(category)) kind = "link";
  else if (category === "controller") kind = "controller";
  const label = typeof toolboxStampLabel === "function" ? toolboxStampLabel(entry) : String(entry.tag || entry.name || "?");
  return { id: mark.id, x: mark.x, y: mark.y, createdAt: mark.createdAt || "", index, catalogId: mark.catalogId, category, model, label, name: entry.name || "", controlType: entry.controlType || "", kind };
}

function planWireCompare(a, b) {
  return a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : a.index - b.index;
}

function planWireDistance(a, b, width, height) {
  return Math.hypot((a.x - b.x) * width, (a.y - b.y) * height);
}

// L-shaped route between two points: horizontal leg first, then vertical.
function planWireOrthogonal(a, b) {
  const same = (p, q) => Math.abs(p - q) < 1e-9;
  if (same(a.x, b.x) || same(a.y, b.y)) return [{ x: a.x, y: a.y }, { x: b.x, y: b.y }];
  return [{ x: a.x, y: a.y }, { x: b.x, y: a.y }, { x: b.x, y: b.y }];
}

// Nearest-neighbour pairs [from, to] starting at `start`; ties keep the
// earlier-placed node because `nodes` arrive in placement order.
function planWireChainPairs(start, nodes, width, height) {
  const remaining = nodes.filter(node => node !== start);
  const pairs = [];
  let current = start;
  while (remaining.length) {
    let best = 0, bestDistance = Infinity;
    remaining.forEach((node, i) => {
      const distance = planWireDistance(current, node, width, height);
      if (distance < bestDistance - 1e-9) { bestDistance = distance; best = i; }
    });
    const next = remaining.splice(best, 1)[0];
    pairs.push([current, next]);
    current = next;
  }
  return pairs;
}

function planWireMake(rule, linkType, from, to, chainId, extra = {}) {
  return { id: `${rule}:${from.id}:${to.id}`, rule, linkType, cls: PLAN_WIRE_CLASS[linkType] || "wire-control", fromId: from.id, toId: to.id, chainId, ...extra, points: planWireOrthogonal(from, to) };
}

function derivePlanWires({ markups, catalog, page, width = 1, height = 1 }) {
  const pageNumber = Number(page);
  const wires = [];
  const messages = [];
  const stamps = [];
  (markups || []).forEach((mark, index) => {
    if (mark.type === "stamp" && Number(mark.page) === pageNumber) stamps.push(planWireStampInfo(mark, catalog, index));
  });
  stamps.sort(planWireCompare);
  const boundaries = orderedSpaceBoundaries(markups || [], pageNumber);

  // Smallest containing boundary per stamp (areaOverride is ignored: geometry only).
  const groups = new Map();
  for (const info of stamps) {
    const space = boundaries.find(boundary => spaceContainsPoint(boundary, info.x, info.y));
    if (!space) continue;
    if (!groups.has(space.id)) groups.set(space.id, { space, stamps: [] });
    groups.get(space.id).stamps.push(info);
  }
  const spaceName = space => space.name || "Unnamed space";

  // R1 Zūm Link, in-room: one chain per space from its first-placed Zūm Net controller.
  for (const { space, stamps: inSpace } of groups.values()) {
    const nets = inSpace.filter(info => info.kind === "net");
    const links = inSpace.filter(info => info.kind === "link");
    if (!links.length) continue;
    if (!nets.length) { messages.push({ rule: "R1a", text: `REQUIRED INPUT · ${spaceName(space)}: no Zūm Net controller placed` }); continue; }
    for (const [from, to] of planWireChainPairs(nets[0], [nets[0], ...links], width, height)) {
      wires.push(planWireMake("R1", "Zūm Link", from, to, `R1:${space.id}`, { spaceId: space.id }));
    }
  }

  // R2 Zūm Net, room-to-room, and R3 Ethernet / PoE (hub to switch), whole sheet.
  const nets = stamps.filter(info => info.kind === "net");
  const switches = stamps.filter(info => info.kind === "switch");
  const hubs = stamps.filter(info => info.kind === "hub");
  const headEnd = switches[0] || hubs[0] || null;
  if (nets.length) {
    if (headEnd) {
      const order = planWireChainPairs(headEnd, [headEnd, ...nets], width, height).map(pair => pair[1]);
      for (let start = 0; start < order.length; start += PLAN_WIRE_RUN_LIMIT) {
        let previous = headEnd;
        for (const net of order.slice(start, start + PLAN_WIRE_RUN_LIMIT)) {
          wires.push(planWireMake("R2", "Zūm Net", previous, net, `R2:${start / PLAN_WIRE_RUN_LIMIT}`));
          previous = net;
        }
      }
    } else {
      messages.push({ rule: "R2", text: "Zūm Net head-end not placed on this sheet" });
      const order = [nets[0], ...planWireChainPairs(nets[0], nets, width, height).map(pair => pair[1])];
      for (let start = 0; start < order.length; start += PLAN_WIRE_RUN_LIMIT) {
        const run = order.slice(start, start + PLAN_WIRE_RUN_LIMIT);
        for (let i = 1; i < run.length; i++) wires.push(planWireMake("R2", "Zūm Net", run[i - 1], run[i], `R2:${start / PLAN_WIRE_RUN_LIMIT}`));
      }
    }
  }
  if (switches.length) {
    for (const hub of hubs) {
      if (hub === headEnd) continue;
      let nearest = switches[0];
      for (const candidate of switches) {
        if (planWireDistance(hub, candidate, width, height) < planWireDistance(hub, nearest, width, height) - 1e-9) nearest = candidate;
      }
      wires.push(planWireMake("R3", "Ethernet / PoE", hub, nearest, `R3:${hub.id}`));
    }
  }

  // R4 load wiring: per space and fixture mapping, nearest compatible controller then a chain.
  for (const { space, stamps: inSpace } of groups.values()) {
    const mappings = new Map();
    for (const info of inSpace.filter(item => item.kind === "fixture")) {
      if (!mappings.has(info.catalogId)) mappings.set(info.catalogId, []);
      mappings.get(info.catalogId).push(info);
    }
    for (const [catalogId, fixtures] of mappings) {
      const { controlType, label } = fixtures[0];
      if (!controlType) { messages.push({ rule: "R4", text: `REQUIRED INPUT · ${label} in ${spaceName(space)}: control type not set` }); continue; }
      const linkType = PLAN_WIRE_LOAD_TYPES[controlType];
      const models = linkType ? rankedControllerModels(controlType) : [];
      const controllers = inSpace.filter(info => ["net", "link", "controller"].includes(info.kind) && models.includes(info.model));
      if (!controllers.length) { messages.push({ rule: "R4", text: `REQUIRED INPUT · ${label} in ${spaceName(space)}: no compatible controller placed` }); continue; }
      const reach = controller => Math.min(...fixtures.map(fixture => planWireDistance(controller, fixture, width, height)));
      let controller = controllers[0];
      for (const candidate of controllers) if (reach(candidate) < reach(controller) - 1e-9) controller = candidate;
      for (const [from, to] of planWireChainPairs(controller, [controller, ...fixtures], width, height)) {
        wires.push(planWireMake("R4", linkType, from, to, `R4:${space.id}:${catalogId}`, { spaceId: space.id }));
      }
    }
  }
  return { wires, messages };
}

// Drawn wire ends follow their stamps by id; a missing stamp keeps the stored point.
function planWireResolvedPoints(wire, markups) {
  const points = (wire.points || []).map(point => ({ x: point.x, y: point.y }));
  const find = id => (markups || []).find(mark => mark.id === id && mark.type === "stamp");
  const from = find(wire.fromMarkupId), to = find(wire.toMarkupId);
  if (from && points.length) points[0] = { x: from.x, y: from.y };
  if (to && points.length) points[points.length - 1] = { x: to.x, y: to.y };
  return { points, missing: !from || !to };
}

// Length in rendered-pixel space: x scaled by width 1, y by the sheet aspect
// (height / width), for the wire and the calibration line alike.
function planWireLengthFeet(points, scale, page, aspect) {
  if (!scale || Number(scale.page) !== Number(page) || !(Number(aspect) > 0) || !Array.isArray(points)) return null;
  const calibration = Math.hypot(scale.x2 - scale.x1, (scale.y2 - scale.y1) * aspect);
  const feet = Number(scale.distanceFeet);
  if (!(calibration > 0) || !(feet > 0)) return null;
  let length = 0;
  for (let i = 1; i < points.length; i++) length += Math.hypot(points[i].x - points[i - 1].x, (points[i].y - points[i - 1].y) * aspect);
  return Math.ceil(Number((length / calibration * feet).toFixed(6)));
}

function planWireLengthText(feet) {
  return feet == null ? "Not calibrated" : `${feet} ft`;
}

// Geometric stamp hit test (nearest centre inside the radius), not event.target.
function planWireHitStamp(markups, page, point, width, height, radiusPx = 15) {
  let best = null, bestDistance = radiusPx;
  for (const mark of markups || []) {
    if (mark.type !== "stamp" || Number(mark.page) !== Number(page)) continue;
    const distance = planWireDistance(mark, point, width, height);
    if (distance <= bestDistance) { best = mark; bestDistance = distance; }
  }
  return best;
}

// Label on the longest segment (the longest one that fits, else the longest anyway).
function planWireLabelAnchor(points, width, height, text) {
  const needed = String(text).length * 5.8 + 6;
  let best = null;
  for (let i = 1; i < points.length; i++) {
    const a = { x: points[i - 1].x * width, y: points[i - 1].y * height }, b = { x: points[i].x * width, y: points[i].y * height };
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    if (!best || length > best.length) best = { a, b, length };
  }
  if (!best) return null;
  const mid = { x: (best.a.x + best.b.x) / 2, y: (best.a.y + best.b.y) / 2 };
  const horizontal = Math.abs(best.b.x - best.a.x) >= Math.abs(best.b.y - best.a.y);
  return horizontal
    ? { x: mid.x, y: mid.y - 6, anchor: "middle", length: best.length, fits: best.length >= needed }
    : { x: mid.x + 7, y: mid.y + 3, anchor: "start", length: best.length, fits: best.length >= needed };
}

// End dots sit `offsetPx` out from each stamp centre along the first/last segment.
function planWireEndDots(points, width, height, offsetPx = 15) {
  if (points.length < 2) return [];
  const px = point => ({ x: point.x * width, y: point.y * height });
  const along = (from, to) => {
    const a = px(from), b = px(to), length = Math.hypot(b.x - a.x, b.y - a.y);
    if (!length) return a;
    const d = Math.min(offsetPx, length / 2);
    return { x: a.x + (b.x - a.x) / length * d, y: a.y + (b.y - a.y) / length * d };
  };
  return [along(points[0], points[1]), along(points.at(-1), points.at(-2))];
}

function planWireNumber(value) {
  return String(Number(value.toFixed(2)));
}

// M/H/V where consecutive points share an axis (always true for derived wires), L otherwise.
function planWirePath(points, width, height) {
  return points.map((point, i) => {
    const x = planWireNumber(point.x * width), y = planWireNumber(point.y * height);
    if (!i) return `M${x},${y}`;
    const previous = points[i - 1];
    if (Math.abs(previous.y - point.y) < 1e-9) return `H${x}`;
    if (Math.abs(previous.x - point.x) < 1e-9) return `V${y}`;
    return `L${x},${y}`;
  }).join("");
}

function planWiresSVG({ derived = [], drawn = [], markups = [], catalog = [], width, height, scale = null, page, visible = true, selectedId = "" }) {
  if (!visible) return "";
  const infos = new Map();
  (markups || []).forEach((mark, index) => { if (mark.type === "stamp") infos.set(mark.id, planWireStampInfo(mark, catalog, index)); });
  const labelOf = id => infos.get(id)?.label || "?";

  // One label per derived chain, on the longest segment of the chain.
  const chainLabel = new Map();
  for (const wire of derived) {
    const anchor = planWireLabelAnchor(wire.points, width, height, wire.linkType);
    const current = chainLabel.get(wire.chainId);
    if (anchor && (!current || anchor.length > current.anchor.length)) chainLabel.set(wire.chainId, { wireId: wire.id, anchor });
  }
  const labelText = (anchor, text) => `<text class="plan-wire-label" x="${planWireNumber(anchor.x)}" y="${planWireNumber(anchor.y)}" text-anchor="${anchor.anchor}">${escapeHTML(text)}</text>`;

  const derivedSVG = derived.map(wire => {
    const d = planWirePath(wire.points, width, height);
    const title = `${wire.linkType} · derived · ${labelOf(wire.fromId)} to ${labelOf(wire.toId)}`;
    const chain = chainLabel.get(wire.chainId);
    return `<g class="plan-wire derived" data-wire-id="${escapeHTML(wire.id)}" data-rule="${escapeHTML(wire.rule)}" data-wire-type="${escapeHTML(wire.linkType)}" data-from="${escapeHTML(wire.fromId)}" data-to="${escapeHTML(wire.toId)}"><title>${escapeHTML(title)}</title><path class="plan-wire-halo" d="${d}"/><path class="${escapeHTML(wire.cls)}" d="${d}"/>${chain?.wireId === wire.id ? labelText(chain.anchor, wire.linkType) : ""}</g>`;
  }).join("");

  const drawnSVG = drawn.map(wire => {
    const { points } = planWireResolvedPoints(wire, markups);
    if (points.length < 2) return "";
    const d = planWirePath(points, width, height);
    const cls = PLAN_WIRE_CLASS[wire.linkType] || "wire-control";
    const feet = planWireLengthFeet(points, scale, page ?? wire.page, wire.sheetAspect || height / width);
    const title = `${wire.linkType} · drawn · ${labelOf(wire.fromMarkupId)} to ${labelOf(wire.toMarkupId)} · ${planWireLengthText(feet)}`;
    const anchor = planWireLabelAnchor(points, width, height, wire.linkType);
    const dots = planWireEndDots(points, width, height).map(dot => `<circle class="plan-wire-end ${cls}" cx="${planWireNumber(dot.x)}" cy="${planWireNumber(dot.y)}" r="3.5"/>`).join("");
    return `<g class="plan-wire drawn" data-wire-id="${escapeHTML(wire.id)}" data-wire-type="${escapeHTML(wire.linkType)}" data-from="${escapeHTML(wire.fromMarkupId)}" data-to="${escapeHTML(wire.toMarkupId)}"><title>${escapeHTML(title)}</title>${wire.id === selectedId ? `<path class="plan-wire-select" d="${d}"/>` : ""}<path class="plan-wire-hit" d="${d}"/><path class="plan-wire-halo" d="${d}"/><path class="${cls}" d="${d}"/>${anchor ? labelText(anchor, wire.linkType) : ""}${dots}</g>`;
  }).join("");
  return derivedSVG + drawnSVG;
}

// Inner markup for #plan-wire-draft: committed segments, rubber band, vertices and rings.
function planWireDraftSVG(draft, pointer, hoverStamp, width, height) {
  const points = draft?.points || [];
  const cls = PLAN_WIRE_CLASS[draft?.linkType] || "wire-control";
  const parts = [];
  if (points.length > 1) parts.push(`<path class="plan-wire-draft-line ${cls}" d="${planWirePath(points, width, height)}"/>`);
  if (points.length && pointer) parts.push(`<path class="plan-wire-rubber ${cls}" d="${planWirePath([points.at(-1), pointer], width, height)}"/>`);
  points.forEach((point, i) => {
    if (!i) parts.push(`<circle class="plan-wire-ring" cx="${planWireNumber(point.x * width)}" cy="${planWireNumber(point.y * height)}" r="15"/>`);
    else parts.push(`<circle class="plan-wire-vertex" cx="${planWireNumber(point.x * width)}" cy="${planWireNumber(point.y * height)}" r="3.5"/>`);
  });
  if (hoverStamp && hoverStamp.id !== draft?.fromId) parts.push(`<circle class="plan-wire-ring" cx="${planWireNumber(hoverStamp.x * width)}" cy="${planWireNumber(hoverStamp.y * height)}" r="15"/>`);
  return parts.join("");
}

// Wiring & Links record fields for a manual wire (all strings, like the demo's rows).
function planWireLinkRecord(wire, { markups, catalog, scale, areaOf }) {
  const { points } = planWireResolvedPoints(wire, markups);
  const describe = id => {
    const mark = (markups || []).find(item => item.id === id && item.type === "stamp");
    if (!mark) return null;
    const info = planWireStampInfo(mark, catalog);
    return { info, text: `${areaOf ? areaOf(mark) : ""} · ${info.label}${info.model ? ` ${info.model}` : ""}` };
  };
  const from = describe(wire.fromMarkupId), to = describe(wire.toMarkupId);
  const feet = planWireLengthFeet(points, scale, wire.page, wire.sheetAspect);
  return {
    linkType: wire.linkType,
    name: `${from?.info.label || "?"} to ${to?.info.label || "?"}`,
    source: from?.text || "REQUIRED INPUT · endpoint missing",
    destination: to?.text || "REQUIRED INPUT · endpoint missing",
    length: feet == null ? "" : String(feet),
    status: "Planned"
  };
}
