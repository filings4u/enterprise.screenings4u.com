(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  let data = {};
  const ENTITY = 'resource';
  const ARRAY_KEY = 'resources';
  const SINGULAR = 'Resource';
  const FIELDS = ["name", "resource_type", "capacity", "location_id", "active"];

  async function getClient() {
    for (let i = 0; i < 40; i += 1) {
      try {
        if (typeof window.getScreenings4uSupabase === "function") {
          const client = await window.getScreenings4uSupabase();
          if (client?.auth?.getSession) return client;
        }
        const client = window.screenings4uSupabase || window.supabaseClient || window.supabaseClientInstance || window.SUPABASE_CLIENT || window.sb;
        if (client?.auth?.getSession) return client;
      } catch (_) {}
      await new Promise((resolve) => setTimeout(resolve, 75));
    }
    return null;
  }

  async function api(action, payload = {}) {
    const client = await getClient();
    if (!client?.auth?.getSession) throw new Error("Supabase client not found.");
    const { data: sessionData, error: sessionError } = await client.auth.getSession();
    if (sessionError) throw sessionError;
    const token = sessionData?.session?.access_token;
    if (!token) throw new Error("No active admin login session.");
    const response = await fetch(`${client.supabaseUrl || "https://rgsrubdtljyxmnihwlah.supabase.co"}/functions/v1/scheduling-admin-config`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(client.supabaseKey ? { apikey: client.supabaseKey } : {}) },
      body: JSON.stringify({ action, ...payload })
    });
    const text = await response.text();
    let body = {};
    try { body = JSON.parse(text); } catch { body = { error: text }; }
    if (!response.ok || body.error) throw new Error(body.error || `HTTP ${response.status}`);
    return body;
  }

  const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);
  function message(text) { const el = $("pageMessage"); if (el) { el.textContent = text || ""; el.hidden = !text; } }
  function openModal() { $("backdrop").hidden = false; $("editor").hidden = false; }
  function closeModal() { $("backdrop").hidden = true; $("editor").hidden = true; }

  function setSelectOptions() {
    document.querySelectorAll("[data-options]").forEach((select) => {
      const type = select.dataset.options;
      let rows = [];
      let label = (row) => row.name;
      if (type === "staff") { rows = data.staff || []; label = (row) => row.display_name; }
      if (type === "schedules") rows = data.schedules || [];
      if (type === "locations") rows = data.locations || [];
      if (type === "services") rows = data.services || [];
      select.innerHTML = `<option value="">${escapeHtml(select.dataset.blank || "Select…")}</option>` + rows.map((row) => `<option value="${row.id}">${escapeHtml(label(row))}</option>`).join("");
    });
  }

  function render() {
    const rows = data[ARRAY_KEY] || [];
    const cards = $("cards");
    cards.innerHTML = rows.map((r) => `<article class="card"><div><span class="badge ${r.active === false || r.enabled === false ? "off" : ""}">${r.status ? escapeHtml(r.status) : r.active === false || r.enabled === false ? "INACTIVE" : "ACTIVE"}</span><h3>${escapeHtml(r.name)}</h3><div class="muted">${escapeHtml(`${r.resource_type || "Resource"} · Capacity ${r.capacity ?? 1}`)}</div></div><div class="actions"><button type="button" data-edit="${r.id}">Edit</button><button type="button" data-delete="${r.id}">Delete</button></div></article>`).join("");
    $("empty").hidden = rows.length > 0;
    cards.hidden = rows.length === 0;
  }

  function populate(row = {}) {
    $("rowId").value = row.id || "";
    FIELDS.forEach((field) => {
      const el = document.querySelector(`[name="${field}"]`);
      if (!el) return;
      if (el.type === "checkbox") el.checked = row[field] ?? (field === "active" || field === "enabled");
      else if (el.type === "datetime-local" && row[field]) el.value = new Date(row[field]).toISOString().slice(0, 16);
      else if (field === "options") el.value = Array.isArray(row[field]) ? row[field].join("\n") : "";
      else el.value = row[field] ?? "";
    });
    $("modalTitle").textContent = `${row.id ? "Edit" : "New"} ${SINGULAR}`;
    openModal();
  }

  function collect() {
    const payload = {};
    FIELDS.forEach((field) => {
      const el = document.querySelector(`[name="${field}"]`);
      if (!el) return;
      if (el.type === "checkbox") payload[field] = el.checked;
      else if (el.type === "number") payload[field] = el.value === "" ? null : Number(el.value);
      else if (el.type === "datetime-local") payload[field] = el.value ? new Date(el.value).toISOString() : null;
      else if (field === "options") payload[field] = el.value.split("\n").map((value) => value.trim()).filter(Boolean);
      else payload[field] = el.value || null;
    });
    return payload;
  }

  async function save(event) {
    event.preventDefault();
    try {
      await api("save_entity", { entity_type: ENTITY, id: $("rowId").value || null, data: collect() });
      closeModal();
      await load();
    } catch (error) { message(error.message); }
  }

  async function remove(id) {
    if (!window.confirm("Delete this scheduling item? This cannot be undone.")) return;
    try { await api("delete_entity", { entity_type: ENTITY, id }); await load(); }
    catch (error) { message(error.message); }
  }

  async function load() {
    message("");
    $("loading").hidden = false;
    try { data = await api("bootstrap"); setSelectOptions(); render(); }
    catch (error) { message(error.message); }
    finally { $("loading").hidden = true; }
  }

  document.addEventListener("DOMContentLoaded", () => {
    $("backdrop").addEventListener("click", closeModal);
    document.querySelectorAll("[data-close]").forEach((button) => button.addEventListener("click", closeModal));
    $("newBtn").addEventListener("click", () => populate());
    $("editorForm").addEventListener("submit", save);
    $("cards").addEventListener("click", (event) => {
      const edit = event.target.closest("[data-edit]");
      const del = event.target.closest("[data-delete]");
      if (edit) populate((data[ARRAY_KEY] || []).find((row) => row.id === edit.dataset.edit) || {});
      if (del) remove(del.dataset.delete);
    });
    load();
  });
})();
