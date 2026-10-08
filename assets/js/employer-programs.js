/* ============================================================
   SCREENINGS4U — EMPLOYER PROGRAMS
   employer-programs.js — LIVE SUPABASE WIRING
   ============================================================ */
(function () {
  "use strict";

  const state = { programs: [], filteredPrograms: [], canWrite: false };
  let db = null;

  document.addEventListener("DOMContentLoaded", initializePrograms);

  async function initializePrograms() {
    bindControls();
    try {
      db = await getScreenings4uSupabase();
      await loadPrograms();
    } catch (error) {
      console.error("Employer programs load failed:", error);
      renderError(await getErrorMessage(error));
    }
  }

  function bindControls() {
    bindClick("create-program-btn", () => openProgramModal());
    bindClick("empty-create-program-btn", () => openProgramModal());
    bindClick("program-modal-close", closeProgramModal);
    bindClick("program-modal-cancel", closeProgramModal);
    bindClick("program-modal-backdrop", closeProgramModal);
    document.getElementById("program-search")?.addEventListener("input", applyFilters);
    document.getElementById("program-status-filter")?.addEventListener("change", applyFilters);
    document.getElementById("program-form")?.addEventListener("submit", saveProgram);
  }

  async function call(body) {
    const { data, error } = await db.functions.invoke("employer-program-actions", { body });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data;
  }

  async function loadPrograms() {
    const data = await call({ action: "list" });
    state.programs = Array.isArray(data.programs) ? data.programs : [];
    state.canWrite = data.canWrite === true;
    const create = document.getElementById("create-program-btn");
    if (create) {
      create.disabled = !state.canWrite;
      create.title = state.canWrite ? "Create Program" : "Your employer role has read-only program access.";
    }
    updateMetrics();
    applyFilters();
  }

  function applyFilters() {
    const term = getValue("program-search").toLowerCase();
    const status = getValue("program-status-filter") || "all";
    state.filteredPrograms = state.programs.filter((program) => {
      const name = String(program.name || "").toLowerCase();
      const type = String(program.type || "").toLowerCase();
      const programStatus = String(program.status || "active").toLowerCase();
      return (!term || name.includes(term) || type.includes(term) || String(program.dot_agency || "").toLowerCase().includes(term))
        && (status === "all" || programStatus === status);
    });
    renderPrograms();
  }

  function renderPrograms() {
    const grid = document.getElementById("program-grid");
    if (!grid) return;
    if (!state.filteredPrograms.length) {
      grid.innerHTML = `<div class="program-empty-state"><div class="program-empty-icon">▦</div><h3>${state.programs.length ? "No programs match your filters" : "No programs are assigned to your company"}</h3><p>${state.programs.length ? "Try changing your search or status filter." : "Programs assigned to this employer will appear here."}</p>${!state.programs.length && state.canWrite ? '<button type="button" class="programs-secondary-btn" id="empty-create-program-btn">Create Program</button>' : ""}</div>`;
      bindClick("empty-create-program-btn", () => openProgramModal());
      return;
    }
    grid.innerHTML = state.filteredPrograms.map((program) => {
      const status = String(program.status || "active").toLowerCase();
      const detail = [program.dot_agency, program.pool_type, program.selection_frequency].filter(Boolean).join(" • ");
      return `<article class="program-card">
        <div class="program-card-top"><div><span class="program-card-type">${escapeHtml(formatProgramType(program.type))}</span><h3>${escapeHtml(program.name || "Untitled Program")}</h3></div>
        <span class="program-status ${status === "active" ? "program-status-active" : "program-status-inactive"}">${escapeHtml(capitalize(status))}</span></div>
        ${detail ? `<p class="program-card-detail">${escapeHtml(detail)}</p>` : ""}
        <div class="program-card-stats"><div><span>Employees</span><strong>${Number(program.employee_count || 0)}</strong></div><div><span>Selections</span><strong>${Number(program.selection_count || 0)}</strong></div></div>
        <div class="program-card-footer"><span>${escapeHtml(program.year ? "Program year " + program.year : "Program")}</span><button type="button" class="program-card-action" data-program-id="${escapeAttribute(program.id)}">${state.canWrite ? "Manage" : "View"}</button></div>
      </article>`;
    }).join("");
    grid.querySelectorAll("[data-program-id]").forEach((button) => button.addEventListener("click", () => openProgramModal(button.dataset.programId)));
  }

  function openProgramModal(programId) {
    const modal = document.getElementById("program-modal"), form = document.getElementById("program-form"), title = document.getElementById("program-modal-title");
    if (!modal || !form) return;
    form.reset(); setValue("program-id", "");
    if (programId) {
      const program = state.programs.find((item) => String(item.id) === String(programId));
      if (program) {
        if (title) title.textContent = state.canWrite ? "Edit Program" : "Program Details";
        setValue("program-id", program.id); setValue("program-name", program.name); setValue("program-type", program.type);
        setValue("program-status", program.status || "active"); setValue("program-year", program.year); setValue("program-notes", program.notes);
      }
    } else {
      if (!state.canWrite) return;
      if (title) title.textContent = "Create Program";
      setValue("program-year", new Date().getFullYear());
    }
    form.querySelectorAll("input,select,textarea").forEach(el => { if (el.id !== "program-id") el.disabled = !state.canWrite; });
    const save = form.querySelector('button[type="submit"]'); if (save) save.hidden = !state.canWrite;
    modal.hidden = false;
  }

  function closeProgramModal() { const modal = document.getElementById("program-modal"); if (modal) modal.hidden = true; }

  async function saveProgram(event) {
    event.preventDefault();
    if (!state.canWrite) return;
    const program = { id:getValue("program-id")||null, name:getValue("program-name"), type:getValue("program-type"), status:getValue("program-status")||"active", year:getValue("program-year")||null, notes:getValue("program-notes") };
    if (!program.name || !program.type) return showFormMessage("Enter a program name and select a program type.", true);
    const save = document.querySelector('#program-form button[type="submit"]');
    if (save) { save.disabled = true; save.textContent = "Saving…"; }
    try {
      await call({ action:"save", program });
      closeProgramModal();
      await loadPrograms();
    } catch (error) {
      console.error("Program save failed:", error);
      showFormMessage(await getErrorMessage(error), true);
    } finally {
      if (save) { save.disabled = false; save.textContent = "Save Program"; }
    }
  }

  function showFormMessage(message, error) {
    let box = document.getElementById("program-live-message");
    if (!box) {
      box = document.createElement("div"); box.id = "program-live-message"; box.className = "program-form-note";
      document.querySelector(".program-modal-actions")?.before(box);
    }
    box.innerHTML = `<strong>${error ? "Unable to Save Program" : "Program Updated"}</strong><p>${escapeHtml(message)}</p>`;
  }

  async function getErrorMessage(error) {
    try { if (error?.context?.json) { const x = await error.context.json(); if (x?.error) return x.error; } } catch (_) {}
    return error?.message || "The program request could not be completed.";
  }

  function renderError(message) {
    const grid = document.getElementById("program-grid");
    if (grid) grid.innerHTML = `<div class="program-empty-state"><div class="program-empty-icon">!</div><h3>Unable to load programs</h3><p>${escapeHtml(message)}</p></div>`;
    ["stat-active-programs","stat-enrolled-employees","stat-year-selections","stat-attention-programs"].forEach(id => setText(id,"—"));
  }

  function updateMetrics() {
    const active=state.programs.filter(p=>String(p.status||"active").toLowerCase()==="active").length;
    const employees=state.programs.reduce((n,p)=>n+Number(p.employee_count||0),0);
    const selections=state.programs.reduce((n,p)=>n+Number(p.selection_count||0),0);
    const attention=state.programs.filter(p=>Boolean(p.needs_attention)).length;
    setText("stat-active-programs",active); setText("stat-enrolled-employees",employees); setText("stat-year-selections",selections); setText("stat-attention-programs",attention);
  }

  function formatProgramType(type){return ({dot_random:"DOT RANDOM PROGRAM",workplace_testing:"WORKPLACE TESTING",custom:"CUSTOM PROGRAM"})[type]||String(type||"PROGRAM").toUpperCase();}
  function capitalize(v){const t=String(v||"");return t.charAt(0).toUpperCase()+t.slice(1);}
  function bindClick(id,fn){document.getElementById(id)?.addEventListener("click",fn);}
  function getValue(id){const e=document.getElementById(id);return e?String(e.value||"").trim():"";}
  function setValue(id,v){const e=document.getElementById(id);if(e)e.value=v==null?"":v;}
  function setText(id,v){const e=document.getElementById(id);if(e)e.textContent=v==null?"":v;}
  function escapeHtml(v){return String(v==null?"":v).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");}
  function escapeAttribute(v){return escapeHtml(v);}
})();