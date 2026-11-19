"use strict";

function programRooms() {
  const names = new Set(state.spaces.map(s => s.name));
  for (const key of ["loads", "controllers", "roomDevices", "spaceBehavior", "scenes"]) {
    for (const r of recordsFor(key)) names.add(r.area || "Unassigned");
  }
  return [...names].map(name => {
    const room = { name };
    for (const key of ["loads", "controllers", "roomDevices", "spaceBehavior", "scenes"])
      room[key] = recordsFor(key).filter(r => (r.area || "Unassigned") === name);
    return room;
  });
}

function zoneSignalKind(zone) {
  if (["Switching", "Plug-load switching"].includes(zone.controlType)) return "DIGITAL";
  if (["0-10 V dimming","Phase control","DALI"].includes(zone.controlType)) return "ANALOG";
  return "";
}

function scenePercent(scene, zone) {
  const p = scene.programLevels?.[zone.id];
  if (!Number.isInteger(p) || p < 0 || p > 100) return null;
  if (zoneSignalKind(zone) === "DIGITAL" && p !== 0 && p !== 100) return null;
  return p;
}

// Stable names preserve existing SIMPL wiring when room or scene names change.
function signalTag(prefix, id) {
  let hash = 2166136261;
  for (const ch of String(id)) hash = Math.imul(hash ^ ch.charCodeAt(0), 16777619);
  return prefix + (hash >>> 0).toString(16).toUpperCase();
}

function starterSource(room) {
  const declarations = [], events = [], outputs = [], comments = [];
  const clean = v => String(v || "").replace(/[^a-z0-9 .,():_%+-]/gi," ");
  for (const zone of room.loads) {
    const kind = zoneSignalKind(zone);
    if (!kind) continue;
    const tag = signalTag("Z",zone.id);
    comments.push("// " + tag + " = " + clean(zone.name) + " (" + clean(zone.controlType) + ")");
    outputs.push(kind + "_OUTPUT " + tag + "_Command;");
    if (kind === "ANALOG") {
      declarations.push("ANALOG_INPUT " + tag + "_Level;");
      events.push("CHANGE " + tag + "_Level\r\n{\r\n    " + tag + "_Command = " + tag + "_Level;\r\n}");
    } else {
      declarations.push("DIGITAL_INPUT " + tag + "_On, " + tag + "_Off;");
      events.push("PUSH " + tag + "_On\r\n{\r\n    " + tag + "_Command = 1;\r\n}", "PUSH " + tag + "_Off\r\n{\r\n    " + tag + "_Command = 0;\r\n}");
    }
  }
  if (!outputs.length) return "";
  for (const scene of room.scenes) {
    const actions = [];
    for (const zone of room.loads) {
      const kind = zoneSignalKind(zone), p = scenePercent(scene, zone);
      if (!kind || p === null) continue;
      const raw = kind === "DIGITAL" ? Number(p === 100) : Math.round(p * 65535 / 100);
      actions.push("    " + signalTag("Z", zone.id) + "_Command = " + raw + ";");
    }
    if (!actions.length) continue;
    const trigger = signalTag("S",scene.id) + "_Recall";
    comments.push("// " + trigger + " = " + clean(scene.name));
    declarations.push("DIGITAL_INPUT " + trigger + ";");
    events.push("PUSH " + trigger + "\r\n{\r\n" + actions.join("\r\n") + "\r\n}");
  }
  const moduleId = signalTag("Room",room.loads.find(z => zoneSignalKind(z)).id);
  return ['#SYMBOL_NAME "Zum_' + moduleId + '"', "#DEFAULT_VOLATILE",
    "// " + clean(room.name) + " - review and compile in SIMPL Windows.",
    ...comments,"",...declarations,...outputs,"",...events,""].join("\r\n");
}

function roomDesign(room) {
  const detail = values => values.filter(Boolean).join(" | ");
  const lines = [state.project.name, "Custom programming design — " + room.name, "", "Zones and outputs"];
  for (const z of room.loads) {
    const assigned = room.controllers.filter(c => c.zoneId === z.id);
    lines.push(detail([z.name,z.controlType || "Protocol needed",assigned.map(c => c.model).filter(Boolean).join(", ") || "Controller assignment needed",zoneSignalKind(z) ? signalTag("Z",z.id) + "_Command" : "Signal mapping needed",z.programBinding || "Physical output pending",z.emergency,z.notes]));
  }
  for (const [title,records] of [["Controllers",room.controllers],["Devices and inputs",room.roomDevices],["Sequence of operations",room.spaceBehavior],["Scenes and schedules",room.scenes]]) {
    lines.push("", title);
    if (!records.length) lines.push("No entries");
    for (const r of records) {
      lines.push(detail([r.name,r.model,r.networkRole,r.assignmentDetail,r.programBinding,r.function,r.autoOn,r.autoOff,r.manualControl,r.daylighting,r.emergency,r.trigger,r.lights,r.schedule,r.notes]));
      if (title === "Scenes and schedules") for (const z of room.loads) {
        const level = scenePercent(r,z);
        if (level !== null) lines.push("  " + z.name + " = " + level + "%");
      }
    }
  }
  lines.push("", "Hardware binding", "Confirm processor, device symbols, addresses, physical outputs and input joins in SIMPL Windows. Implement sensor timers, schedules, daylight and emergency sequences separately. Compile and field-test the completed project.");
  return lines.join("\n");
}

function openProgramming() {
  const rooms = programRooms();
  showModal(`${modalHeader("Custom programming",state.project.name)}
    <div class="modal-body programming-body">
    <section><h3>Program design by space</h3>
    ${rooms.length ? '<label class="field">Space<select id="program-space">' + rooms.map((r,i) => '<option value="'+i+'">'+escapeHTML(r.name)+'</option>').join("") + '</select></label><div id="program-detail"></div>' : '<p>Add a space or load zone to generate room logic.</p>'}</section>
    ${programmingFilesHTML()}</div>
    <footer class="modal-footer"><button type="button" class="secondary-button" id="back-to-package">Back to package</button></footer>`,true);
  $("#back-to-package").onclick = () => openReport("projectPackage");
  bindProgrammingFiles();
  const select = $("#program-space");
  if (!select) return;
  function draw() {
    const room = rooms[Number(select.value)];
    const fields = room.scenes.map((sc,i) => {
      const inputs = room.loads.map((z,j) => {
        if (!zoneSignalKind(z)) return "";
        const step = zoneSignalKind(z) === "DIGITAL" ? 100 : 1;
        return `<label class="field">${escapeHTML(z.name)} (${step === 100 ? "0 or 100%" : "%"})<input type="number" class="program-level" min="0" max="100" step="${step}" data-scene="${i}" data-zone="${j}" value="${scenePercent(sc,z) ?? ""}"></label>`;
      }).join("");
      return inputs ? '<fieldset><legend>'+escapeHTML(sc.name)+'</legend><div class="form-grid">'+inputs+'</div></fieldset>' : "";
    }).join("");
    const bindings = [...room.controllers, ...room.roomDevices, ...room.loads];
    const bindingFields = bindings.map((r,i) => `<label class="field">${escapeHTML(r.name || r.model)}
      <input type="text" data-program-binding="${i}" placeholder="Device address, output or SIMPL join" value="${escapeHTML(r.programBinding || "")}"></label>`).join("");
    $("#program-detail").innerHTML = `<details open><summary>Equipment and sequence</summary><pre id="program-design"></pre></details>
      ${bindingFields ? '<details><summary>Device addresses and signal bindings</summary><p>Record field-confirmed device IDs, outputs, and keypad or sensor joins for the programmer.</p><div class="form-grid">'+bindingFields+'</div></details>' : ''}
      ${fields ? '<h4>Scene levels</h4><p>Enter percentages to generate a scene recall input. A blank leaves that zone at its current level.</p>'+fields : ''}
      <details><summary>Preview SIMPL+ starter source</summary><pre id="program-source"></pre></details>
      <p>The module supplies zone commands and recorded scene levels. Bind device symbols and implement field sequences in SIMPL Windows before compilation.</p>
      <div class="program-actions"><button type="button" class="secondary-button" id="download-design">Download design</button><button type="button" class="primary-button" id="download-usp">Download starter (.usp)</button></div>`;
    function refresh() {
      const source = starterSource(room);
      $("#program-source").textContent = source || "Add a zone with a supported dimming or switching protocol.";
      $("#program-design").textContent = roomDesign(room);
      $("#download-usp").disabled = !source;
    }
    refresh();
    for (const input of document.querySelectorAll("[data-program-binding]")) input.onchange = () => {
      bindings[Number(input.dataset.programBinding)].programBinding = input.value.trim();
      saveState("Binding saved"); refresh(); refreshProgramFiles();
    };
    for (const input of document.querySelectorAll(".program-level")) input.onchange = () => {
      const sc = room.scenes[Number(input.dataset.scene)], z = room.loads[Number(input.dataset.zone)];
      if (!input.validity.valid) { input.reportValidity(); input.value = scenePercent(sc,z) ?? ""; return; }
      sc.programLevels ||= {};
      if (input.value === "") delete sc.programLevels[z.id]; else sc.programLevels[z.id] = input.valueAsNumber;
      saveState("Scene levels saved"); refresh(); refreshProgramFiles();
    };
    const base = slugify(state.project.name) + "-" + slugify(room.name);
    $("#download-usp").onclick = () => downloadBlob(new Blob([starterSource(room)],{type:"text/plain"}),base+".usp");
    $("#download-design").onclick = () => downloadBlob(new Blob([roomDesign(room)],{type:"text/plain;charset=utf-8"}),base+"-program-design.txt");
  }
  select.onchange = draw;
  draw();
}
