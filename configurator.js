"use strict";

// Crestron specification reference, individual model sections. The wireless
// J-Box family is also covered on pages 473–479 of Product Manual 9349T.
// Ordering prefers the J-Box form before DIN rail within the same network.
const roomControllerFamilies = [
  ["0-10 V dimming", "16 A 0-10 V", ["ZUMNET-JBOX-16A-LV", "ZUMNET-DIN-16A-LV", "ZUMLINK-JBOX-16A-LV", "ZUMLINK-DIN-16A-LV", "ZUMMESH-JBOX-16A-LV", "ZUMMESH-JBOX-16A-LV-EM"]],
  ["0-10 V dimming", "5 A 0-10 V", ["ZUMMESH-JBOX-5A-LV", "ZUMMESH-5A-LV"]],
  ["DALI", "DALI - 64 addresses", ["ZUMNET-JBOX-DALI", "ZUMNET-DIN-DLI", "ZUMMESH-JBOX-DALI"]],
  ["Phase control", "Universal phase dimming", ["ZUMLINK-EXP-16A-DIMU", "ZUMLINK-DIN-DIMU", "ZUMMESH-EXP-16A-DIMU"]],
  ["Phase control", "Forward-phase dimming", ["ZUMMESH-DIM"]],
  ["Phase control", "Reverse-phase dimming", ["ZUMMESH-DELV"]],
  ["Switching", "20 A switching", ["ZUMLINK-JBOX-20A-SW", "ZUMLINK-DIN-20A-SW", "ZUMMESH-JBOX-20A-SW"]],
  ["Switching", "5 A switching", ["ZUMMESH-5A-SW"]],
  ["Plug-load switching", "20 A plug load", ["ZUMLINK-JBOX-20A-PLUG", "ZUMLINK-DIN-20A-PLUG", "ZUMMESH-JBOX-20A-PLUG"]]
];

function controllerTraits(model) {
  const family = roomControllerFamilies.find(([, , models]) => models.includes(model));
  if (!family) return { networkRole: "", loadCapability: "" };
  const networkRole = model.startsWith("ZUMNET-") ? "Zūm Net primary controller"
    : model.startsWith("ZUMLINK-") ? "Zūm Link load controller" : "Zūm Mesh load controller";
  return { networkRole, loadCapability: family[1] };
}

function rankedControllerModels(protocol, role = "", options) {
  const candidates = roomControllerFamilies.filter(([method]) => !protocol || protocol === method)
    .flatMap(([, , models]) => models);
  const roleText = String(role).toLowerCase();
  const prefixes = roleText.includes("net") || roleText === "primary" ? ["ZUMNET-"]
    : roleText.includes("link") ? ["ZUMLINK-"] : roleText.includes("mesh") ? ["ZUMMESH-"]
    : roleText === "secondary" ? ["ZUMLINK-", "ZUMNET-"] : ["ZUMNET-", "ZUMLINK-", "ZUMMESH-"];
  return prefixes.flatMap(prefix => candidates.filter(model => model.startsWith(prefix)
    && (!Array.isArray(options) || options.includes(model))));
}

function placedControllersForSpace(rows, zoneCount) {
  const previousUnits = rows.filter(row => row.generatedBy === "takeoff-unit");
  const equipment = [];
  for (const row of rows.filter(item => item.generatedBy !== "takeoff-unit")) {
    equipment.push(row);
    if (row.generatedBy !== "plan-takeoff") continue;
    const count = Math.max(1, Number(row.takeoffSnapshot?.quantity || row.quantity) || 1);
    // Split enough physical units to allocate outputs. A single spare row
    // retains any surplus quantity from a counted plan mark.
    const slots = Math.min(count, zoneCount + 2);
    row.quantity = "1";
    for (let unit = 1; unit < slots; unit++) {
      const previous = previousUnits.find(r => r.parentControllerId === row.id && r.placementUnit === unit);
      equipment.push({ ...row, id: previous?.id || newRecordId(), generatedBy: "takeoff-unit",
        parentControllerId: row.id, placementUnit: unit, quantity: String(unit === slots - 1 ? count - unit : 1),
        zoneId: previous?.zoneId || "", assignmentRole: previous?.assignmentRole || "",
        configured: false, modelOverride: previous?.modelOverride || "", name: row.name + " · unit " + (unit + 1) });
    }
  }
  return equipment;
}

function syncConfiguredSpaces() {
  const current = state.records.controllers;
  const reserved = new Set();
  const planned = [];
  for (const space of state.spaces || []) {
    const zones = state.records.loads.filter(load => load.spaceId === space.id);
    const rows = placedControllersForSpace(current.filter(row => row.spaceId === space.id), zones.length);
    const stamped = rows.filter(row => ["plan-takeoff","takeoff-unit"].includes(row.generatedBy));
    const markedNet = stamped.filter(row => row.model?.startsWith("ZUMNET-"));
    const meshOnly = stamped.length > 0 && stamped.every(row => row.model?.startsWith("ZUMMESH-"));
    const primaryRow = markedNet.find(row => row.assignmentRole === "primary") || markedNet[0] || rows.find(row => row.assignmentRole === "primary" || /primary/i.test(row.networkRole));
    // A net controller serves a compatible zone itself. With only Link
    // loads, retain a room primary and allocate each load to its own output.
    const primaryZones = zones.filter(zone => zone.controlType && rankedControllerModels(zone.controlType, "primary").length);
    const eligiblePrimary = markedNet.length ? primaryZones.filter(z => rankedControllerModels(z.controlType, "primary").includes(primaryRow.model)) : primaryZones;
    const primaryZone = eligiblePrimary.find(zone => zone.id === primaryRow?.zoneId) || eligiblePrimary[0];
    const slots = [...(meshOnly ? [] : [{ zone: primaryZone, role: "primary" }]),
      ...zones.filter(zone => zone !== primaryZone).map(zone => ({ zone, role: "secondary" }))];
    for (const { zone, role } of slots) {
      const zoneId = zone?.id || "";
      const protocol = zone ? zone.controlType : "0-10 V dimming";
      const candidates = protocol ? rankedControllerModels(protocol, role) : [];
      const available = stamped.filter(row => !reserved.has(row) && candidates.includes(row.model));
      const marked = role === "primary" && markedNet.length ? primaryRow :
        available.find(row => row.zoneId === zoneId) || available[0];
      if (meshOnly) continue;
      const existing = marked || rows.find(row => row.generatedBy !== "plan-takeoff" && !reserved.has(row) && zoneId && row.zoneId === zoneId)
        || (role === "primary" && primaryRow && !reserved.has(primaryRow) && (!primaryRow.zoneId || !zones.some(load => load.id === primaryRow.zoneId)) ? primaryRow : null)
        || rows.find(row => !reserved.has(row) && !row.zoneId && !row.configured && candidates.includes(row.model));
      const row = existing || { id: newRecordId(), notes: "", quantity: "1" };
      reserved.add(row);
      const override = stamped.includes(row) ? row.modelOverride || row.takeoffSnapshot?.model || row.model : typeof row.modelOverride === "string" ? row.modelOverride
        : row.modelOverride || (existing && !existing.configured && existing.model) ? row.model : "";
      const model = override || candidates[0] || "";
      const traits = controllerTraits(model);
      const name = zone ? `${space.name} · ${zone.name}` : `${space.name} · Primary controller`;
      const networkRole = role === "secondary" && model.startsWith("ZUMNET-")
        ? "Zūm Net secondary controller" : traits.networkRole;
      const detail = !model ? `REQUIRED INPUT · Confirm the controller for ${protocol || "the unspecified protocol"}.`
        : override && !(role === "primary" && !zone && model.startsWith("ZUMNET-")) && !candidates.includes(model) ? "REQUIRED INPUT · Verify the manual model against the zone protocol and room role."
        : zone && protocol === "DALI" && role === "secondary"
          ? "Conservative allowance of one controller per DALI zone. Review driver addressing and grouping for consolidation."
        : zone ? "" : "Room primary with no assigned load zone.";
      planned.push({ ...row, id: row.id, name: !row.name || row.name === row.configuredName ? name : row.name,
        configuredName: name, configured: true, spaceId: space.id, area: space.name, zoneId,
        assignmentRole: role, modelOverride: stamped.includes(row) ? row.modelOverride || "" : override, model, networkRole, loadCapability: traits.loadCapability,
        quantity: row.quantity || "1", assignmentStatus: detail.startsWith("REQUIRED INPUT") ? "REQUIRED INPUT" : "Configured",
        assignmentDetail: detail });
    }
    // Stamped equipment stays on the bill even without a compatible zone.
    for (const row of stamped.filter(item => !reserved.has(item))) {
      reserved.add(row);
      planned.push({ ...row, configured: false, zoneId: "", assignmentRole: "",
        assignmentStatus: "Unassigned", assignmentDetail: "Placed on drawing · no zone assignment.",
        networkRole: row.model?.startsWith("ZUMNET-") ? "Zūm Net secondary controller" : controllerTraits(row.model).networkRole || row.networkRole });
    }
  }
  // Keep independent user records. Only the configurator's obsolete slots
  // retire when a space or zone is removed.
  const independent = current.filter(row => !reserved.has(row) && row.generatedBy !== "takeoff-unit" && (!row.configured || row.generatedBy === "plan-takeoff"));
  for (const row of independent.filter(r => r.configured && r.generatedBy === "plan-takeoff")) {
    Object.assign(row, { configured: false, assignmentRole: "", assignmentStatus: "Unassigned", zoneId: "",
      quantity: row.takeoffSnapshot?.quantity || row.quantity, assignmentDetail: "Placed on drawing · no zone assignment." });
  }
  state.records.controllers = [...independent, ...planned];
  syncZonePaths();
}
