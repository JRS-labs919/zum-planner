"use strict";

let programmingDatabase;

function fileDatabase() {
  if (!programmingDatabase) programmingDatabase = new Promise((resolve,reject) => {
    const request = indexedDB.open("zum-planner-program-files",1);
    request.onupgradeneeded = () => {
      const db = request.result;
      db.createObjectStore("info",{keyPath:"id"}).createIndex("project","project");
      db.createObjectStore("bytes");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => { programmingDatabase = null; reject(request.error); };
  });
  return programmingDatabase;
}

// Compare authored design fields, excluding navigation, timestamps and cached takeoff metadata.
function programRevision() {
  const records = {};
  for (const key of ["loads","controllers","roomDevices","network","links","scenes","spaceBehavior"]) {
    records[key] = recordsFor(key).map(row => Object.fromEntries(Object.entries(row).filter(([k]) =>
      !["createdAt","updatedAt","sourceRef","takeoffSnapshot","takeoffMarkupIds"].includes(k))));
  }
  return JSON.stringify([state.spaces, state.project.name, state.project.architecture, records]);
}

function programmingFilesHTML() {
  return `<section><h3>Native SIMPL project and compiled files</h3>
    <p>Attach the programmer’s editable project (.smw), project archive with dependencies (.zip), or compiled processor file (.lpz). Keep the originals for backup. Attachments stay in this browser and are downloaded separately from the project JSON.</p>
    <label class="field">Attach program files<input id="attach-program" type="file" accept=".smw,.zip,.lpz" multiple></label>
    <p role="status" id="program-file-status"></p><div id="program-file-list"></div></section>`;
}

async function refreshProgramFiles() {
  const list = $("#program-file-list");
  if (!list) return;
  const id = state.project.id;
  try {
    const db = await fileDatabase();
    const req = db.transaction("info").objectStore("info").index("project").getAll(id);
    req.onsuccess = () => {
      if (!list.isConnected || id !== state.project.id) return;
      const revision = programRevision();
      list.innerHTML = req.result.length ? req.result.map(f => `<article class="soo-area">
        <strong>${escapeHTML(f.name)}</strong><p>${escapeHTML(f.kind)} · ${Number(f.size).toLocaleString()} bytes · ${f.revision === revision ? "Design matches attachment time" : "Design changed · review file"}</p>
        ${/\.smw$/i.test(f.name) ? '<button class="secondary-button" type="button" data-program-view="'+escapeHTML(f.id)+'">View source file</button>' : ''}
        <button class="secondary-button" type="button" data-program-download="${escapeHTML(f.id)}">Download original</button>
        <button class="ghost-button" type="button" data-program-remove="${escapeHTML(f.id)}">Remove attachment</button><pre hidden class="attached-source"></pre></article>`).join("") : "<p>No native files attached to this project.</p>";
    };
    req.onerror = () => { list.textContent = "Could not read attached files."; };
  } catch (error) { list.textContent = "File storage unavailable: " + error.message; }
}

function runFileTransaction(db, work) {
  return new Promise((resolve,reject) => {
    const tx = db.transaction(["info","bytes"],"readwrite");
    tx.oncomplete = resolve;
    tx.onabort = () => reject(tx.error || new Error("File operation interrupted"));
    try { work(tx.objectStore("info"),tx.objectStore("bytes")); }
    catch (error) { tx.abort(); reject(error); }
  });
}

function bindProgrammingFiles() {
  const input = $("#attach-program"), status = $("#program-file-status"), list = $("#program-file-list");
  const project = state.project.id;
  input.onchange = async () => {
    const files = Array.from(input.files);
    if (!files.length) return;
    try {
      if (files.some(f => !/\.(smw|zip|lpz)$/i.test(f.name) || !f.size)) throw new Error("Choose a nonempty .smw, .zip, or .lpz file.");
      // Persist any ID assigned when opening a project from an older release.
      saveState();
      const revision = programRevision();
      input.disabled = true;
      const db = await fileDatabase();
      await runFileTransaction(db,(info,bytes) => {
        for (const f of files) {
          const id = newRecordId();
          const kind = /\.lpz$/i.test(f.name) ? "Programmer-supplied compiled file" : /\.zip$/i.test(f.name) ? "Project archive" : "Editable SIMPL Windows source";
          info.add({id,project,name:f.name,kind,size:f.size,revision});
          bytes.add(f,id);
        }
      });
      status.textContent = "Original files saved in this browser.";
      if (list.isConnected) refreshProgramFiles();
    } catch (error) { status.textContent = "Attachment failed. " + error.message; }
    finally { input.disabled = false; input.value = ""; }
  };
  list.onclick = async event => {
    const btn = event.target.closest("[data-program-view],[data-program-download],[data-program-remove]");
    if (!btn) return;
    const id = btn.dataset.programView || btn.dataset.programDownload || btn.dataset.programRemove;
    try {
      const db = await fileDatabase();
      const get = store => new Promise((resolve,reject) => {
        const r = db.transaction(store).objectStore(store).get(id);
        r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error);
      });
      const meta = await get("info");
      if (!meta || meta.project !== project) throw new Error("Attachment unavailable.");
      if (btn.dataset.programDownload || btn.dataset.programView) {
        const blob = await get("bytes");
        if (!blob) throw new Error("Original bytes are unavailable.");
        if (btn.dataset.programView) {
          const pre = btn.closest("article").querySelector("pre");
          const sample = await blob.slice(0,65536).text();
          pre.textContent = /[\u0000-\u0008]/.test(sample) ? "Binary content. Open the original file in SIMPL Windows." :
            sample + (blob.size > 65536 ? "\n[Preview limited to the first 64 KiB]" : "");
          pre.hidden = false;
        } else downloadBlob(blob,meta.name);
      } else if (window.confirm("Remove " + meta.name + " from this browser?")) {
        await runFileTransaction(db,(info,bytes) => { info.delete(id); bytes.delete(id); });
        if (list.isConnected) refreshProgramFiles();
      }
    } catch (error) { status.textContent = error.message; }
  };
  refreshProgramFiles();
}
