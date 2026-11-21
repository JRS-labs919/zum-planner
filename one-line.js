"use strict";

// One-line wiring drawing: records -> model -> layout -> SVG string.
// Everything except printOneLine() is pure and runs in the console: no DOM, no state read
// (the caller passes state), nothing executes at load except the constants below.
// Geometry is in SVG user units (px). The sheet is always landscape (W > H).
const ONE_LINE = {
  PAD: 40, HEAD_Y: 92, HEAD_PITCH: 60, HEAD_ROWS: 6, NET_W: 200, NET_H: 44, COL_GAP: 24,
  SUB_W: 288, HC: 456, HDR: 26, TOP_PAD: 10, BOT_PAD: 12, BLOCK_GAP: 12, LABEL_H: 16,
  CTRL_W: 236, CTRL_H: 40, ZONE_W: 208, ZONE_H: 36, ZONE_GAP: 8, DEV_GAP: 8, NODE_H: 36,
  GAP: 20, RISER: 28, TIERGAP: 60, BAND: 172, MINW: 1124, RATIO: 1.5,
  LINK_MIN: 52, NET_MIN: 88, TB_W: 420, TB_H: 132, LG_W: 600, LG_H: 108
};

const ONE_LINE_COLOR = {
  "wire-zumnet": "#6d3090", "wire-zumlink": "#e78a16", "wire-control": "#e32621",
  "wire-analog": "#078044", "wire-mesh": "#168ab2", "wire-ethernet": "#3c4e57"
};

const ONE_LINE_LINK_TITLE = "Logical Zūm Link bus. Port assignments and daisy-chain order are unspecified.";

// Embedded in every one-line SVG so the in-app view, Download SVG, Download HTML and the
// Design Package render identically. Selectors are all `.wiring-diagram ...`; nothing sets
// the root's own width/height, so page CSS can still scale the drawing.
const ONE_LINE_SVG_STYLE = [
  ".wiring-diagram .ol-bg{fill:#fff}",
  ".wiring-diagram .ol-border{fill:none;stroke:#13232a;stroke-width:2}",
  ".wiring-diagram .room-frame{fill:#f8fbfc;stroke:#aabac1;stroke-width:1.2;rx:2}",
  ".wiring-diagram .node{fill:#fff;stroke:#254854;stroke-width:1.3;rx:2}",
  ".wiring-diagram .node.network{fill:#e6f4f8;stroke:#006c94}",
  ".wiring-diagram .node.controller{fill:#f5f8fa;stroke:#294e5b}",
  ".wiring-diagram .node.device{fill:#fff8ec;stroke:#bd7e1d}",
  ".wiring-diagram .node.load{fill:#fff3f1;stroke:#c94436}",
  ".wiring-diagram .node.pending{stroke-dasharray:4 3}",
  ".wiring-diagram .diagram-title{fill:#153440;font:700 13px Inter,Arial,sans-serif}",
  ".wiring-diagram .diagram-label{fill:#1d343d;font:600 10px Inter,Arial,sans-serif}",
  ".wiring-diagram .diagram-detail{fill:#62757d;font:9px Inter,Arial,sans-serif}",
  ".wiring-diagram .room-label{fill:#005d80;font:700 12px Inter,Arial,sans-serif;letter-spacing:.04em;text-transform:uppercase}",
  ".wiring-diagram .ol-roomtype{fill:#62757d;font:9px Inter,Arial,sans-serif;letter-spacing:0;text-transform:none}",
  ".wiring-diagram .diagram-wire{fill:#13232a;font:700 9px Inter,Arial,sans-serif;letter-spacing:.04em;text-transform:uppercase}",
  ".wiring-diagram .ol-caption{fill:#566a73;font:700 9px Inter,Arial,sans-serif;letter-spacing:.04em;text-transform:uppercase}",
  ".wiring-diagram .wire-zumnet{fill:none;stroke:#6d3090;stroke-width:3;stroke-dasharray:8 4}",
  ".wiring-diagram .wire-zumlink{fill:none;stroke:#e78a16;stroke-width:3}",
  ".wiring-diagram .wire-control{fill:none;stroke:#e32621;stroke-width:2.5}",
  ".wiring-diagram .wire-analog{fill:none;stroke:#078044;stroke-width:2.5}",
  ".wiring-diagram .wire-mesh{fill:none;stroke:#168ab2;stroke-width:2.5;stroke-dasharray:2 5}",
  ".wiring-diagram .wire-ethernet{fill:none;stroke:#3c4e57;stroke-width:2.5;stroke-dasharray:10 3 2 3}",
  ".wiring-diagram .wire-cresnet{fill:none;stroke:#13232a;stroke-width:2.5;stroke-dasharray:14 4}",
  ".wiring-diagram .wire-emergency{fill:none;stroke:#13232a;stroke-width:2.5;stroke-dasharray:3 3}",
  ".wiring-diagram .junction{fill:#fff;stroke-width:2}",
  ".wiring-diagram .ol-frame-line{fill:#fff;stroke:#13232a;stroke-width:1}",
  ".wiring-diagram .ol-rule{fill:none;stroke:#13232a;stroke-width:1}",
  ".wiring-diagram .ol-tb-title{fill:#13232a;font:700 16px Inter,Arial,sans-serif;letter-spacing:.06em;text-transform:uppercase}",
  ".wiring-diagram .ol-tb-label{fill:#566a73;font:700 8px Inter,Arial,sans-serif;letter-spacing:.04em;text-transform:uppercase}",
  ".wiring-diagram .ol-tb-value{fill:#13232a;font:600 11px Inter,Arial,sans-serif}",
  ".wiring-diagram .ol-tb-note{fill:#566a73;font:9px Inter,Arial,sans-serif}",
  ".wiring-diagram .ol-lg-head{fill:#13232a;font:700 10px Inter,Arial,sans-serif}",
  ".wiring-diagram .ol-lg-note{fill:#566a73;font:9px Inter,Arial,sans-serif}",
  ".wiring-diagram .ol-lg-text{fill:#1d343d;font:9px Inter,Arial,sans-serif}"
].join("");

function oneLineHasContent(st) {
  const rows = id => (st.records && st.records[id]) || [];
  return Boolean(rows("controllers").length || rows("network").length || rows("links").length);
}

// Moves the grouping the old buildWiringDiagram did, unchanged in meaning: spaces first, then
// legacy areas; a space with controllers but none configured keeps the legacy relations.
function oneLineModelFromState(st) {
  const rows = id => (st.records && st.records[id]) || [];
  const controllers = rows("controllers");
  const roomDevices = rows("roomDevices");
  const loads = rows("loads");
  const network = rows("network");
  const behavior = rows("spaceBehavior");
  const spaces = st.spaces || [];
  const linkedToSpace = (row, space) => row.spaceId ? row.spaceId === space.id : row.area === space.name;
  const buildRoom = (name, roomType, ctrl, devices, zones, spaceFlag) => {
    const configured = Boolean(spaceFlag) && (ctrl.some(row => row.configured || row.zoneId) || !ctrl.length);
    const unassigned = zones.filter(load => !ctrl.some(row => row.zoneId === load.id));
    if (configured) {
      const ordered = [...ctrl].sort((a, b) => Number(b.assignmentRole === "primary") - Number(a.assignmentRole === "primary"));
      const primary = ordered.find(row => row.assignmentRole === "primary" && row.model?.startsWith("ZUMNET-"));
      const branches = ordered.filter(row => row.assignmentRole === "secondary" && row.model?.startsWith("ZUMLINK-"));
      return { name, roomType, configured: true, legacy: false, isMesh: false, controllers: ordered, loads: zones, unassigned, devices,
        linkPrimaryId: primary ? primary.id : "", linkBranchIds: branches.map(row => row.id) };
    }
    const primary = ctrl.find(row => /primary/i.test(row.networkRole || "")) || ctrl[0];
    const secondary = ctrl.filter(row => row !== primary);
    const isMesh = /ZUMMESH|Mesh/i.test(`${primary?.model || ""} ${primary?.networkRole || ""}`);
    return { name, roomType, configured: false, legacy: true, isMesh, controllers: primary ? [primary, ...secondary] : [], loads: zones, unassigned, devices,
      linkPrimaryId: primary ? primary.id : "", linkBranchIds: secondary.map(row => row.id) };
  };
  const rooms = spaces.map(space => {
    const note = behavior.find(row => linkedToSpace(row, space));
    return buildRoom(space.name, (note && note.roomType) || "", controllers.filter(row => linkedToSpace(row, space)),
      roomDevices.filter(row => linkedToSpace(row, space)), loads.filter(row => linkedToSpace(row, space)), true);
  });
  const legacyRows = [...controllers, ...roomDevices, ...loads].filter(row => !spaces.some(space => linkedToSpace(row, space)));
  const legacyAreas = [...new Set(legacyRows.map(row => row.area || "Unassigned Zūm space"))];
  if (!rooms.length && !legacyAreas.length) legacyAreas.push("Unassigned Zūm space");
  legacyAreas.forEach(name => {
    const inArea = row => legacyRows.includes(row) && (row.area || "Unassigned Zūm space") === name;
    rooms.push(buildRoom(name, "", controllers.filter(inArea), roomDevices.filter(inArea), loads.filter(inArea), false));
  });
  return { project: st.project || {}, network, rooms };
}

function oneLineTrunc(text, limit) {
  const plain = String(text == null ? "" : text);
  return plain.length > limit ? `${plain.slice(0, Math.max(0, limit - 1))}…` : plain;
}

// Deterministic truncation by character count (no DOM measuring): 5.8 px/char at 10 px, 5.0 at 9 px.
function oneLineLimit(width, size) {
  return Math.floor((width - 18) / (size >= 10 ? 5.8 : 5.0));
}

// Frames are partitioned over T tiers by cumulative width so tiers come out near equal.
function oneLinePartition(u, T) {
  const N = u.length;
  const tiers = [];
  let start = 0;
  let remaining = u.reduce((sum, value) => sum + value, 0);
  for (let k = 1; k <= T; k++) {
    if (k === T) {
      tiers.push(Array.from({ length: N - start }, (_, i) => start + i));
      break;
    }
    const target = remaining / (T - k + 1);
    let cum = 0;
    let end = start;
    while (end <= N - 1 - (T - k)) {
      if (end === start || Math.abs(cum + u[end] - target) < Math.abs(cum - target)) {
        cum += u[end];
        end += 1;
      } else break;
    }
    tiers.push(Array.from({ length: end - start }, (_, i) => start + i));
    remaining -= cum;
    start = end;
  }
  return tiers;
}

// Stacks a room's blocks top-down into 288-wide sub-columns, capped at HC. A block is never
// split (an oversized legacy block simply overshoots HC). Returns positions relative to the
// content origin (10 below the frame header).
function oneLineFlow(room) {
  const K = ONE_LINE;
  const items = [];
  const sideOf = (row, index) => room.legacy ? (index === 0 ? "Primary" : "Secondary")
    : row.assignmentRole === "primary" ? "Primary" : row.assignmentRole === "secondary" ? "Secondary" : "Controller";
  if (!room.legacy) {
    room.controllers.forEach((row, index) => {
      const zone = room.loads.find(load => load.id === row.zoneId);
      const detail = row.assignmentDetail || (row.modelOverride ? "Manual model override." : !zone ? "No zone assigned." : "");
      items.push({ t: "ctrl", row, side: sideOf(row, index), zones: zone ? [zone] : [], detail, gap: K.BLOCK_GAP });
    });
    room.unassigned.forEach(zone => items.push({ t: "unz", zone, h: K.NODE_H, gap: K.BLOCK_GAP }));
    if (!room.controllers.length && !room.unassigned.length) {
      items.push({ t: "pend", h: K.NODE_H, gap: K.BLOCK_GAP, line1: "Controller assignment pending", line2: "No linked zones" });
    }
  } else {
    const [primary, ...secondary] = room.controllers;
    items.push(primary ? { t: "ctrl", row: primary, side: "Primary", zones: room.loads, detail: "", gap: K.BLOCK_GAP, legacyPrimary: true }
      : { t: "ctrl", row: null, pending: true, side: "Primary", zones: room.loads, detail: "", gap: K.BLOCK_GAP, legacyPrimary: true,
        line1: "Primary controller required", line2: "Select a ZUMNET or ZUMMESH controller" });
    secondary.forEach(row => items.push({ t: "ctrl", row, side: "Secondary", zones: [], detail: "", gap: K.BLOCK_GAP }));
  }
  room.devices.forEach((device, index) => items.push({ t: "dev", device, h: K.NODE_H, gap: index === 0 ? K.BLOCK_GAP : K.DEV_GAP, label: index === 0 }));
  items.forEach(item => {
    if (item.t === "ctrl") {
      item.base = item.pending ? K.NODE_H : K.CTRL_H;
      item.h = item.base + item.zones.length * (K.ZONE_GAP + K.ZONE_H) + (item.detail ? 14 : 0);
    }
  });
  const placed = [];
  const colEnd = [0];
  let col = 0;
  let y = 0;
  let first = true;
  items.forEach(item => {
    let gap = first ? 0 : item.gap;
    let label = item.t === "dev" && (item.label || first) ? K.LABEL_H : 0;
    if (!first && y + gap + label + item.h > K.HC) {
      col += 1;
      y = 0;
      first = true;
      gap = 0;
      label = item.t === "dev" ? K.LABEL_H : 0;
      colEnd[col] = 0;
    }
    const top = y + gap + label;
    placed.push({ item, col, top, labelTop: label ? y + gap : null });
    y = top + item.h;
    colEnd[col] = y;
    first = false;
  });
  const contentH = Math.max(0, ...colEnd);
  return { placed, colEnd, subcols: col + 1, contentH, w: K.SUB_W * (col + 1), h: K.HDR + K.TOP_PAD + contentH + K.BOT_PAD };
}

// Emits one frame's nodes, wires, junctions and labels at (fx, fy) with height fh. Returns the
// Zūm Net / Mesh drops the tier backbone must feed.
function oneLineEmitFrame(room, flow, fx, fy, out) {
  const K = ONE_LINE;
  const contentTop = fy + K.HDR + K.TOP_PAD;
  const colX = c => fx + K.SUB_W * c;
  const netDrops = new Map();
  const addNet = (c, cy, cls) => {
    const drop = netDrops.get(c) || { col: c, cls, cys: [] };
    drop.cys.push(cy);
    netDrops.set(c, drop);
  };
  const node = (kind, x, y, w, h, line1, line2, pending) => out.nodes.push({ kind, x, y, w, h, line1, line2, title: line2 ? `${line1} · ${line2}` : line1, pending: Boolean(pending) });
  let source = null;
  const members = [];
  flow.placed.forEach(({ item, col, top: relTop, labelTop }) => {
    const sx = colX(col);
    const top = contentTop + relTop;
    const x = sx + 28;
    if (item.t === "ctrl") {
      const row = item.row;
      const line1 = item.pending ? item.line1 : `${item.side} · ${row.model || "Model required"}`;
      const line2 = item.pending ? item.line2 : (row.name || "");
      node("controller", x, top, K.CTRL_W, item.base, line1, line2, item.pending);
      const cy = top + item.base / 2;
      if (room.legacy ? item.legacyPrimary : Boolean(row.model?.startsWith("ZUMNET-"))) {
        const cls = room.legacy && room.isMesh ? "wire-mesh" : "wire-zumnet";
        out.wires.push({ cls, d: `M${sx + 264},${cy} H${sx + 274}` });
        addNet(col, cy, cls);
      }
      if (room.legacy ? item.legacyPrimary : row.id === room.linkPrimaryId) source = { col, cy, sx };
      if (room.legacy && !item.legacyPrimary) {
        members.push({ col, cy, cls: /Mesh/i.test(row.networkRole || "") ? "wire-mesh" : "wire-zumlink" });
      } else if (!room.legacy && room.linkBranchIds.includes(row.id)) {
        members.push({ col, cy, cls: "wire-zumlink", attrs: { "data-link-controller": row.id } });
      }
      item.zones.forEach((zone, k) => {
        const zy = top + item.base + K.ZONE_GAP + k * (K.ZONE_GAP + K.ZONE_H);
        node("load", sx + 56, zy, K.ZONE_W, K.ZONE_H, zone.name || "Unnamed", `${zone.controlType || "Protocol required"} · Qty ${zone.quantity || 1}`);
        const unresolved = room.legacy ? !zone.controlType : (row.assignmentStatus === "REQUIRED INPUT" || !row.model);
        const wire = { cls: "wire-control", d: `M${sx + 44},${top + item.base} V${zy + 18} H${sx + 56}` };
        if (!room.legacy) wire.attrs = { "data-controller-id": row.id, "data-zone-id": zone.id };
        if (unresolved) wire.dashed = true; else wire.marker = "arrow-red";
        out.wires.push(wire);
        if (k < item.zones.length - 1) out.junctions.push({ x: sx + 44, y: zy + 18, stroke: ONE_LINE_COLOR["wire-control"] });
      });
      if (item.detail) out.labels.push({ x, y: top + item.h - 4, text: item.detail, cls: "diagram-detail", limit: oneLineLimit(K.CTRL_W, 9), title: item.detail });
    } else if (item.t === "unz") {
      node("load", x, top, K.CTRL_W, K.NODE_H, item.zone.name || "Unnamed", "REQUIRED INPUT · Assign a controller");
    } else if (item.t === "pend") {
      node("controller", x, top, K.CTRL_W, K.NODE_H, item.line1, item.line2, true);
    } else if (item.t === "dev") {
      const device = item.device;
      if (labelTop != null) out.labels.push({ x, y: contentTop + labelTop + 11, text: "ROOM DEVICES", cls: "ol-caption" });
      node("device", x, top, K.CTRL_W, K.NODE_H, device.name || "Unnamed", device.model || device.deviceType || "");
      if (room.legacy) {
        const cls = /analog|24 VDC/i.test(device.connection || "") ? "wire-analog" : (/Mesh/i.test(device.connection || "") ? "wire-mesh" : "wire-zumlink");
        members.push({ col, cy: top + K.NODE_H / 2, cls });
      }
    }
  });

  // Logical Zūm Link bus: stub from the primary's left edge into the lane, lane down to the last
  // member, stub into each. A bus that continues into the next sub-column runs across the bottom.
  if (source && members.length) {
    const lastCol = Math.max(...members.map(member => member.col));
    const classes = [...new Set(members.map(member => member.cls))];
    const laneCls = classes.length === 1 ? classes[0] : "wire-zumlink";
    const laneName = { "wire-zumlink": "ZŪM LINK", "wire-mesh": "ZŪM MESH", "wire-analog": "24 VDC" }[laneCls];
    let arrival = null;
    for (let c = source.col; c <= lastCol; c++) {
      const lx = colX(c) + 14;
      const ys = [c === source.col ? source.cy : arrival];
      const here = members.filter(member => member.col === c);
      here.forEach(member => ys.push(member.cy));
      let dep = null;
      if (c < lastCol) {
        dep = contentTop + flow.colEnd[c] + 6;
        ys.push(dep);
      }
      const ymin = Math.min(...ys);
      const ymax = Math.max(Math.max(...ys), ymin + K.LINK_MIN);
      out.wires.push({ cls: laneCls, d: `M${lx},${ymin} V${ymax}`, title: ONE_LINE_LINK_TITLE });
      out.labels.push({ x: colX(c) + 10, y: (ymin + ymax) / 2, text: laneName, rotate: true });
      if (c === source.col) out.wires.push({ cls: laneCls, d: `M${source.sx + 28},${source.cy} H${lx}`, title: ONE_LINE_LINK_TITLE });
      here.forEach(member => {
        out.wires.push({ cls: member.cls, d: `M${lx},${member.cy} H${lx + 14}`, attrs: member.attrs, title: ONE_LINE_LINK_TITLE });
        if (member.cy > ymin && member.cy < ymax) out.junctions.push({ x: lx, y: member.cy, stroke: ONE_LINE_COLOR[member.cls] });
      });
      if (dep != null) {
        out.wires.push({ cls: laneCls, d: `M${lx},${dep} H${colX(c + 1) + 14}`, title: ONE_LINE_LINK_TITLE });
        arrival = dep;
      }
    }
  }

  // Zūm Net (or Mesh) lane per sub-column, labelled; the tier backbone feeds the top of it.
  return [...netDrops.values()].map(drop => {
    const laneX = colX(drop.col) + 274;
    const bottom = Math.max(Math.max(...drop.cys), fy + K.HDR + K.NET_MIN);
    drop.cys.forEach(cy => {
      if (cy < bottom) out.junctions.push({ x: laneX, y: cy, stroke: ONE_LINE_COLOR[drop.cls] });
    });
    out.labels.push({ x: laneX + 10, y: (fy + K.HDR + bottom) / 2, text: drop.cls === "wire-mesh" ? "ZŪM MESH" : "ZŪM NET", rotate: true });
    return { laneX, bottom, cls: drop.cls };
  });
}

function layoutOneLine(model) {
  const K = ONE_LINE;
  const rooms = model.rooms && model.rooms.length ? model.rooms
    : [{ name: "Unassigned Zūm space", roomType: "", configured: false, legacy: true, isMesh: false, controllers: [], loads: [], unassigned: [], devices: [], linkPrimaryId: "", linkBranchIds: [] }];
  const network = model.network && model.network.length ? model.network
    : [{ name: "Upstream network", model: "Hub / switch not yet selected", equipmentType: "Network" }];
  const out = { nodes: [], wires: [], junctions: [], labels: [] };

  // Head-end: network equipment in columns of 6, top-left.
  const n = network.length;
  const cols = Math.ceil(n / K.HEAD_ROWS);
  const r = (n - 1) % K.HEAD_ROWS;
  const headRight = K.PAD + K.NET_W * cols + K.COL_GAP * (cols - 1);
  const X1 = headRight + 56;
  const XR = X1 - K.RISER;
  const B = K.HEAD_Y + K.HEAD_PITCH * r + 22;
  // Bottom of the whole head-end block (its first column is the tallest): the sheet, legend and
  // title block are placed below it as well as below the last tier.
  const headBottom = K.HEAD_Y + K.HEAD_PITCH * (Math.min(n, K.HEAD_ROWS) - 1) + K.NET_H;
  network.forEach((item, i) => {
    const c = Math.floor(i / K.HEAD_ROWS);
    const row = i % K.HEAD_ROWS;
    const x = K.PAD + c * (K.NET_W + K.COL_GAP);
    const y = K.HEAD_Y + K.HEAD_PITCH * row;
    const line1 = item.name || "Unnamed";
    const line2 = item.model || item.equipmentType || "Network";
    out.nodes.push({ kind: "network", x, y, w: K.NET_W, h: K.NET_H, line1, line2, title: `${line1} · ${line2}`, pending: false });
    if (i === n - 1) return;
    if (Math.floor((i + 1) / K.HEAD_ROWS) === c) {
      out.wires.push({ cls: "wire-ethernet", d: `M${x + 100},${y + K.NET_H} V${y + K.HEAD_PITCH}` });
      out.labels.push({ x: x + 108, y: y + K.NET_H + 12, text: "ETHERNET / POE" });
    } else {
      const cy = y + 22;
      const ncy = K.HEAD_Y + 22;
      out.wires.push({ cls: "wire-ethernet", d: `M${x + K.NET_W},${cy} H${x + K.NET_W + 12} V${ncy} H${x + K.NET_W + K.COL_GAP}` });
    }
  });

  const flows = rooms.map(oneLineFlow);
  const N = flows.length;
  const u = flows.map(flow => flow.w + K.GAP);
  const measure = T => {
    const tiers = oneLinePartition(u, T);
    let top = B + 32;
    let bottom = top;
    let widest = 0;
    tiers.forEach(list => {
      bottom = top + Math.max(...list.map(i => flows[i].h));
      top = bottom + K.TIERGAP;
      widest = Math.max(widest, list.reduce((sum, i) => sum + flows[i].w, 0) + K.GAP * (list.length - 1));
    });
    const H = Math.max(bottom, headBottom) + K.BAND;
    const W = Math.max(X1 + widest + 24 + 16, K.MINW);
    return { T, tiers, H, W, feasible: W > H, score: Math.abs(W / H - K.RATIO) };
  };
  let best = null;
  for (let T = 1; T <= N; T++) {
    const option = measure(T);
    if (option.feasible && (!best || option.score < best.score)) best = option;
  }
  // Only reachable with oversized legacy blocks: keep one tier and widen the (empty) sheet.
  if (!best) best = measure(1);
  const T = best.T;
  const H = best.H;
  const W = Math.max(best.W, H + 1);

  const frames = [];
  const tiers = [];
  const drops = [];
  let top = B + 32;
  best.tiers.forEach((list, k) => {
    const height = Math.max(...list.map(i => flows[i].h));
    const backboneY = k === 0 ? B : top - 32;
    const tierDrops = [];
    let x = X1;
    list.forEach(i => {
      const room = rooms[i];
      frames.push({ index: i, name: room.name, roomType: room.roomType || "", x, y: top, w: flows[i].w, h: height, subcols: flows[i].subcols, tier: k });
      tierDrops.push(...oneLineEmitFrame(room, flows[i], x, top, out));
      x += flows[i].w + K.GAP;
    });
    tiers.push({ backboneY, top, height, frames: list.slice() });
    drops.push(tierDrops);
    top += height + K.TIERGAP;
  });

  // Backbone per tier (the riser joins them). The last drop of a tier is folded into the backbone
  // path, which ends with the arrow; every other drop is a T off the backbone.
  tiers.forEach((tier, k) => {
    const y = tier.backboneY;
    const x0 = k === 0 ? headRight : XR;
    const list = drops[k].slice().sort((a, b) => a.laneX - b.laneX);
    if (!list.length) {
      out.wires.push({ cls: "wire-zumnet", d: `M${x0},${y} H${X1 + 24}`, attrs: { "data-backbone": String(k) } });
    } else {
      const last = list[list.length - 1];
      const folded = last.cls === "wire-zumnet";
      out.wires.push({ cls: "wire-zumnet", d: `M${x0},${y} H${last.laneX}${folded ? ` V${last.bottom}` : ""}`, marker: "arrow-purple", attrs: { "data-backbone": String(k) } });
      list.forEach(drop => {
        if (drop === last && folded) return;
        out.wires.push({ cls: drop.cls, d: `M${drop.laneX},${y} V${drop.bottom}` });
        if (drop !== last) out.junctions.push({ x: drop.laneX, y, stroke: ONE_LINE_COLOR["wire-zumnet"] });
      });
    }
    out.labels.push({ x: X1, y: y - 6, text: "ZŪM NET" });
  });
  if (T > 1) {
    const lastY = tiers[T - 1].backboneY;
    out.wires.push({ cls: "wire-zumnet", d: `M${XR},${B} V${lastY}`, attrs: { "data-riser": "1" } });
    out.junctions.push({ x: XR, y: B, stroke: ONE_LINE_COLOR["wire-zumnet"] });
    for (let k = 1; k < T - 1; k++) out.junctions.push({ x: XR, y: tiers[k].backboneY, stroke: ONE_LINE_COLOR["wire-zumnet"] });
    out.labels.push({ x: XR - 8, y: (B + lastY) / 2, text: "ZŪM NET", rotate: true });
  }

  return {
    W, H, T, X1, B, XR, headRight, tiers, frames,
    nodes: out.nodes, wires: out.wires, junctions: out.junctions, labels: out.labels,
    titleBlock: { x: W - 16 - K.TB_W, y: H - 16 - K.TB_H },
    legend: { x: K.PAD, y: H - 148 }
  };
}

function oneLineWireMarkup(wire) {
  const attrs = Object.entries(wire.attrs || {}).map(([key, value]) => ` ${key}="${escapeHTML(value)}"`).join("");
  const marker = wire.marker ? ` marker-end="url(#${wire.marker})"` : "";
  const dashed = wire.dashed ? ' style="stroke-dasharray:4 4"' : "";
  const title = wire.title ? `<title>${escapeHTML(wire.title)}</title>` : "";
  return `<path${attrs} d="${wire.d}" class="${wire.cls}"${marker}${dashed}>${title}</path>`;
}

function oneLineNodeMarkup(item) {
  const [y1, y2] = item.h >= 44 ? [17, 34] : item.h === 40 ? [16, 30] : [15, 28];
  const line1 = escapeHTML(oneLineTrunc(item.line1, oneLineLimit(item.w, 10)));
  const line2 = escapeHTML(oneLineTrunc(item.line2, oneLineLimit(item.w, 9)));
  return `<g><title>${escapeHTML(item.title)}</title><rect x="${item.x}" y="${item.y}" width="${item.w}" height="${item.h}" class="node ${item.kind}${item.pending ? " pending" : ""}"/>`
    + `<text x="${item.x + 9}" y="${item.y + y1}" class="diagram-label">${line1}</text><text x="${item.x + 9}" y="${item.y + y2}" class="diagram-detail">${line2}</text></g>`;
}

function oneLineLabelMarkup(label) {
  const cls = label.cls || "diagram-wire";
  const spin = label.rotate ? ` transform="rotate(-90 ${label.x} ${label.y})" text-anchor="middle"` : "";
  const text = label.limit ? oneLineTrunc(label.text, label.limit) : label.text;
  const title = label.title ? `<title>${escapeHTML(label.title)}</title>` : "";
  return `<text x="${label.x}" y="${label.y}" class="${cls}"${spin}>${title}${escapeHTML(text)}</text>`;
}

function oneLineTitleBlockMarkup(box, project) {
  const K = ONE_LINE;
  const { x, y } = box;
  const field = (label, value, limit, cx, cy) => {
    const text = String(value || "").trim() || "—";
    const cut = oneLineTrunc(text, limit);
    return `<text x="${cx + 6}" y="${cy + 9}" class="ol-tb-label">${label}</text>`
      + `<text x="${cx + 6}" y="${cy + 20}" class="ol-tb-value">${cut !== text ? `<title>${escapeHTML(text)}</title>` : ""}${escapeHTML(cut)}</text>`;
  };
  return `<g class="ol-titleblock"><rect x="${x}" y="${y}" width="${K.TB_W}" height="${K.TB_H}" class="ol-frame-line"/>`
    + [36, 60, 84, 108].map(dy => `<path d="M${x},${y + dy} H${x + K.TB_W}" class="ol-rule"/>`).join("")
    + `<path d="M${x + 260},${y + 60} V${y + 84}" class="ol-rule"/><path d="M${x + 210},${y + 84} V${y + 108}" class="ol-rule"/>`
    + `<text x="${x + 10}" y="${y + 23}" class="ol-tb-title">Zūm Wiring One-Line</text>`
    + field("PROJECT", project.name, 68, x, y + 36)
    + field("PROJECT NO.", project.number, 41, x, y + 60)
    + field("DATE", new Date().toLocaleDateString(), 25, x + 260, y + 60)
    + field("LOCATION", project.location, 33, x, y + 84)
    + field("CLIENT", project.client, 33, x + 210, y + 84)
    + `<text x="${x + 10}" y="${y + 123}" class="ol-tb-note">Generated design one-line - not a terminal-by-terminal installation drawing.</text></g>`;
}

function oneLineLegendMarkup(box) {
  const K = ONE_LINE;
  const { x, y } = box;
  const col = [x + 8, x + 208, x + 408];
  const row = i => y + 31 + 22 * i;
  const sample = (cls, cx, cy, extra = "") => `<path d="M${cx},${cy} H${cx + 28}" class="${cls}"${extra}/>`;
  const text = (cx, cy, value) => `<text x="${cx + 36}" y="${cy + 3}" class="ol-lg-text">${escapeHTML(value)}</text>`;
  const swatch = (kind, cx, cy) => `<rect x="${cx}" y="${cy - 6}" width="24" height="12" class="node ${kind}"/>`;
  const cells = [
    [sample("wire-zumnet", col[0], row(0)), text(col[0], row(0), "Zūm Net - room-to-room")],
    [sample("wire-zumlink", col[0], row(1)), text(col[0], row(1), "Zūm Link - in-room (logical)")],
    [sample("wire-mesh", col[0], row(2)), text(col[0], row(2), "Zūm Mesh - wireless")],
    [sample("wire-ethernet", col[0], row(3)), text(col[0], row(3), "Ethernet / PoE")],
    [sample("wire-control", col[1], row(0), ' marker-end="url(#arrow-red)"'), text(col[1], row(0), "SW / LV load control")],
    [sample("wire-control", col[1], row(1), ' style="stroke-dasharray:4 4"'), text(col[1], row(1), "Zone output - REQUIRED INPUT")],
    [sample("wire-analog", col[1], row(2)), text(col[1], row(2), "24 VDC / analog")],
    [`<path d="M${col[1]},${row(3)} H${col[1] + 28}" class="ol-rule"/><circle cx="${col[1] + 14}" cy="${row(3)}" r="4" class="junction" stroke="#13232a"/>`, text(col[1], row(3), "Junction = connection")],
    [swatch("network", col[2], row(0)), text(col[2], row(0), "Network equipment")],
    [swatch("controller", col[2], row(1)), text(col[2], row(1), "Controller")],
    [swatch("device", col[2], row(2)), text(col[2], row(2), "Room device")],
    [swatch("load", col[2], row(3)), text(col[2], row(3), "Load zone")]
  ];
  return `<g class="ol-legend"><rect x="${x}" y="${y}" width="${K.LG_W}" height="${K.LG_H}" class="ol-frame-line"/>`
    + `<text x="${x + 8}" y="${y + 14}" class="ol-lg-head">LEGEND</text>`
    + `<text x="${x + 592}" y="${y + 14}" text-anchor="end" class="ol-lg-note">Zūm Link port order is unspecified. A crossing without a dot is not a connection.</text>`
    + `<path d="M${x},${y + 20} H${x + K.LG_W}" class="ol-rule"/>${cells.map(cell => cell.join("")).join("")}</g>`;
}

function renderOneLineSVG(layout, project) {
  const K = ONE_LINE;
  const info = project || {};
  const { W, H } = layout;
  const arrow = (id, color) => `<marker id="${id}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="${color}"/></marker>`;
  const frames = layout.frames.map(frame => {
    const room = String(frame.name || "Unnamed Zūm space");
    const type = frame.roomType ? ` <tspan class="ol-roomtype">· ${escapeHTML(oneLineTrunc(frame.roomType, 12))}</tspan>` : "";
    const full = frame.roomType ? `${room} · ${frame.roomType}` : room;
    return `<g class="ol-frame" data-space="${escapeHTML(room)}"><title>${escapeHTML(full)}</title>`
      + `<rect x="${frame.x}" y="${frame.y}" width="${frame.w}" height="${frame.h}" class="room-frame"/>`
      + `<text x="${frame.x + 14}" y="${frame.y + 17}" class="room-label">${escapeHTML(oneLineTrunc(room, 22))}${type}</text></g>`;
  });
  const junctions = layout.junctions.map(dot => `<circle cx="${dot.x}" cy="${dot.y}" r="4" class="junction" stroke="${dot.stroke}"/>`);
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" class="wiring-diagram" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Generated Crestron Zūm system wiring diagram" data-sheet-w="${W}" data-sheet-h="${H}" data-tiers="${layout.T}">`,
    `<title>${escapeHTML(`Zūm Wiring One-Line - ${info.name || ""}`)}</title>`,
    `<desc>${escapeHTML(`Wiring one-line, ${layout.frames.length} ${layout.frames.length === 1 ? "space" : "spaces"} in ${layout.T} ${layout.T === 1 ? "tier" : "tiers"}. Zūm Net backbone runs left to right.`)}</desc>`,
    `<style>${ONE_LINE_SVG_STYLE}</style>`,
    `<defs>${arrow("arrow-purple", "#6d3090")}${arrow("arrow-orange", "#e78a16")}${arrow("arrow-red", "#e32621")}</defs>`,
    `<rect x="0" y="0" width="${W}" height="${H}" class="ol-bg"/>`,
    `<text x="${K.PAD}" y="58" class="diagram-title">CRESTRON ZŪM SYSTEM</text>`,
    `<text x="${K.PAD}" y="74" class="diagram-detail">${escapeHTML(info.architecture || "")} · ${escapeHTML(info.voltage || "")}</text>`,
    ...frames,
    ...layout.wires.map(oneLineWireMarkup),
    ...layout.nodes.map(oneLineNodeMarkup),
    ...junctions,
    ...layout.labels.map(oneLineLabelMarkup),
    oneLineLegendMarkup(layout.legend),
    oneLineTitleBlockMarkup(layout.titleBlock, info),
    `<rect x="16" y="16" width="${W - 32}" height="${H - 32}" class="ol-border"/>`,
    `</svg>`
  ].join("");
}

// The full XML document for Download SVG. The SVG already embeds its own style and xmlns.
function oneLineSVGDocument() {
  return `<?xml version="1.0" encoding="UTF-8"?>\n${renderOneLineSVG(layoutOneLine(oneLineModelFromState(state)), state.project)}\n`;
}

// Print / Save PDF for the one-line report: a throwaway same-origin iframe holds the drawing and a
// page rule sized to it, so the main document's print CSS (and every other report) is untouched.
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
