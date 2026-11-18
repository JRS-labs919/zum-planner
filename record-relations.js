"use strict";

function attachSuggestions(input, values) {
  if (!input || input.tagName !== "INPUT") return;
  document.getElementById(input.id + "-suggestions")?.remove();
  const list = document.createElement("datalist");
  list.id = input.id + "-suggestions";
  for (const value of new Set(values.filter(Boolean))) list.append(new Option(value));
  input.after(list);
  input.setAttribute("list", list.id);
}

function recordRelations(stage, record, space) {
  const form = document.querySelector("#record-form");
  const field = key => form.elements.namedItem(key);
  const all = Object.values(state.records).flat();
  const area = field("area");
  attachSuggestions(area, [...state.spaces.map(s => s.name), ...all.map(r => r.area)]);
  if (["spaceBehavior","scenes","roomDevices"].includes(stage.id) && !record && !area.value && state.spaces.length === 1) area.value = state.spaces[0].name;
  if (["spaceBehavior","scenes"].includes(stage.id)) {
    const updateRoomOptions = () => {
      const devices = recordsFor("roomDevices").filter(d => d.area === area.value);
      const zones = recordsFor("loads").filter(z => z.area === area.value);
      attachSuggestions(field("manualControl"), devices.filter(d => d.deviceType === "Keypad").map(d => d.name));
      attachSuggestions(field("lights"), zones.map(z => z.name));
    };
    area.addEventListener("input",updateRoomOptions);
    updateRoomOptions();
  }
  if (space && area && ["loads","controllers"].includes(stage.id)) {
    area.value = space.name;
    area.readOnly = true;
  }
  if (stage.id === "loads" && space && !record) {
    field("name").value = "Zone " + (recordsFor("loads").filter(r => r.spaceId === space.id).length + 1);
    field("controlType").value = "0-10 V dimming";
  }
  if (stage.id === "loads") {
    const protocol = field("controlType");
    const phase = [...protocol.options].find(o => o.value === "Phase control");
    if (phase) phase.textContent = "Phase control · universal dimming (DIMU)";
    if (space) {
      const hint = document.createElement("p");
      hint.className = "field-help";
      hint.setAttribute("aria-live","polite");
      protocol.after(hint);
      const update = () => {
        const roles = rankedControllerModels(protocol.value, "primary");
        const primary = state.records.controllers.find(c => c.spaceId === space.id && c.assignmentRole === "primary");
        const ownsPrimary = roles.length && (!primary?.zoneId || primary.zoneId === record?.id);
        const suggested = protocol.value && rankedControllerModels(protocol.value, ownsPrimary ? "primary" : "secondary")[0];
        hint.textContent = suggested ? "Suggested controller · " + suggested : "Controller selection needs review.";
      };
      protocol.addEventListener("change",update);
      update();
    }
  }
  if (stage.id === "links") {
    if (record?.generatedBy === "zone-assignment") {
      for (const key of ["source","destination","name"]) field(key).readOnly = true;
      field("linkType").disabled = true;
    }
    const names = ["controllers", "network", "roomDevices", "loads"].flatMap(key => recordsFor(key).map(r => r.name));
    attachSuggestions(field("source"), names);
    attachSuggestions(field("destination"), names);
  }
  const model = field("model");
  if (stage.id === "controllers") {
    const zoneSelect = field("zoneId");
    const zones = recordsFor("loads");
    const models = [...model.options].map(o => o.value).filter(Boolean);
    function rank(zone, choose) {
      const value = model.value;
      const ranked = rankedControllerModels(zone?.controlType || "", record?.assignmentRole || "", models);
      const sameProtocol = zone?.controlType ? rankedControllerModels(zone.controlType, "", models) : [];
      const ordered = [...new Set([...ranked, ...sameProtocol, ...models])];
      model.replaceChildren(new Option("Select…", ""), ...ordered.map(m => new Option(m,m)));
      model.value = choose ? ranked[0] || "" : value;
      if (choose) model.dispatchEvent(new Event("change"));
    }
    if (zoneSelect) {
      for (const zone of zones) zoneSelect.add(new Option([zone.area, zone.name].filter(Boolean).join(" · "), zone.id));
      zoneSelect.value = record?.zoneId || "";
      zoneSelect.addEventListener("change", () => {
        const zone = zones.find(z => z.id === zoneSelect.value);
        if (zone) {
          area.value = zone.area;
          if (!field("name").value) field("name").value = zone.name + " controller";
        }
        rank(zone, Boolean(zone));
      });
    }
    rank(zones.find(z => z.id === record?.zoneId), false);
    if (record?.configured) {
      for (const key of ["networkRole","loadCapability","quantity","name"]) {
        const input = field(key);
        if (input.tagName === "SELECT") input.disabled = true;
        else input.readOnly = true;
      }
    }
  }
  if (!model) return;
  model.addEventListener("change", () => {
    const m = model.value;
    if (!m) return;
    if (stage.id === "controllers") {
      const traits = controllerTraits(m);
      for (const key of ["loadCapability","networkRole"]) {
        const select = field(key);
        const value = traits?.[key] || "";
        if (value && ![...select.options].some(o => o.value === value)) select.add(new Option(value,value));
        select.value = value;
      }
    } else if (stage.id === "roomDevices") {
      const product = window.CRESTRON_CATALOG.products.find(p => p.model === m);
      const type = /-KP/.test(m) ? "Keypad" : /VAC-BATT/.test(m) ? "Vacancy sensor" : /OCC/.test(m) ? "Occupancy sensor" : /PHOTOCELL/.test(m) ? "Daylight sensor" : /QUATTRO|HALLWAY|ONEWAY/.test(m) ? "Presence detector" : /-CCO$/.test(m) ? "Contact closure output" : /-SIM$|-IO$/.test(m) ? "Integration interface" : "";
      field("deviceType").value = type;
      field("connection").value = m.startsWith("ZUMLINK-") ? "Zūm Link" : m.startsWith("ZUMMESH-") ? "Zūm Mesh" : "";
      if (product && !field("name").value) field("name").value = product.name;
    } else if (stage.id === "network") {
      field("equipmentType").value = /SWPOE/.test(m) ? "PoE network switch" : /NETBRIDGE/.test(m) ? "Zūm Mesh network bridge" : /AVBRIDGE/.test(m) ? "AV bridge" : /GATEWAY|-GW$/.test(m) ? "Zūm Net wireless gateway" : /HUB4$/.test(m) ? "Zūm Hub" : "";
    } else if (stage.id === "lineItems") {
      field("category").value = /^CBL-/.test(m) ? "Cable" : /PSU|PWS/.test(m) ? "Power supply" : /SPLTR/.test(m) ? "Splitter / adapter" : /^FP-/.test(m) ? "Faceplate / buttons" : /-IO$|CONV/.test(m) ? "Integration" : "";
    }
  });
}

// One logical controller output per configured zone. Cable routes, lengths,
// and installation status remain project inputs.
function syncZonePaths() {
  const old = state.records.links;
  const managed = [];
  for (const controller of state.records.controllers.filter(c => c.configured && c.zoneId && c.model && c.assignmentStatus !== "REQUIRED INPUT")) {
    const zone = state.records.loads.find(load => load.id === controller.zoneId);
    if (!zone) continue;
    const types = { "0-10 V dimming": "0-10 V control", "DALI": "DALI loop", "Phase control": "Phase-dimmed load", "Switching": "Switched load", "Plug-load switching": "Switched plug load" };
    const linkType = types[zone.controlType];
    if (!linkType) continue;
    const previous = old.find(link => link.generatedBy === "zone-assignment" && link.zoneId === zone.id);
    const connection = { source: controller.name + " (" + controller.model + ")", destination: zone.area + " · " + zone.name, linkType };
    const changed = previous && Object.entries(connection).some(([key,value]) => previous[key] !== value);
    managed.push({ id: previous?.id || newRecordId(), status: "Planned", ...previous, ...connection,
      ...(changed ? { status: "Needs review" } : {}),
      generatedBy: "zone-assignment", configured: true, controllerId: controller.id, zoneId: zone.id,
      spaceId: zone.spaceId, name: zone.area + " · " + zone.name + " output" });
  }
  state.records.links = [...old.filter(link => link.generatedBy !== "zone-assignment"), ...managed];
}
