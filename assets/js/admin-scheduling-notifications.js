(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  let data = {};
  const ENTITY = "notification";
  const ARRAY_KEY = "notifications";
  const SINGULAR = "Notification Rule";
  const FIELDS = ["event_type_id", "event_name", "recipient_type", "enabled", "subject_template", "body_template"];

  const EVENT_LABELS = {
    booking_created: "Booking created",
    booking_confirmed: "Booking confirmed",
    booking_rescheduled: "Booking rescheduled",
    booking_cancelled: "Booking cancelled",
    booking_reminder: "Booking reminder",
    booking_completed: "Booking completed",
    booking_no_show: "No show"
  };

  const RECIPIENT_LABELS = {
    customer: "Customer",
    admin: "Administrator",
    staff: "Staff",
    additional_attendees: "Additional attendees"
  };

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

  function humanOffset(minutes) {
    const n = Number(minutes);
    if (!Number.isFinite(n) || n <= 0) return "At event time";
    if (n % 10080 === 0) { const v = n / 10080; return `${v} week${v === 1 ? "" : "s"} before`; }
    if (n % 1440 === 0) { const v = n / 1440; return `${v} day${v === 1 ? "" : "s"} before`; }
    if (n % 60 === 0) { const v = n / 60; return `${v} hour${v === 1 ? "" : "s"} before`; }
    return `${Math.round((n / 60) * 10) / 10} hours before`;
  }

  function render() {
    const rows = data[ARRAY_KEY] || [];
    const cards = $("cards");
    cards.innerHTML = rows.map((r) => {
      const service = (data.services || []).find((x) => x.id === r.event_type_id);
      const timing = r.event_name === "booking_reminder" ? ` • ${humanOffset(r.minutes_before)}` : "";
      return `<article class="card"><div><span class="badge ${r.enabled === false ? "off" : ""}">${r.enabled === false ? "INACTIVE" : "ACTIVE"}</span><h3>${escapeHtml(`${EVENT_LABELS[r.event_name] || r.event_name || "Event"} → ${RECIPIENT_LABELS[r.recipient_type] || r.recipient_type || "Recipient"}`)}</h3><div class="muted">${escapeHtml(service?.name || "All appointment types")}${escapeHtml(timing)}</div></div><div class="actions"><button type="button" data-edit="${r.id}">Edit</button><button type="button" data-delete="${r.id}">Delete</button></div></article>`;
    }).join("");
    $("empty").hidden = rows.length > 0;
    cards.hidden = rows.length === 0;
  }

  function offsetToForm(minutes) {
    const n = Number(minutes);
    if (!Number.isFinite(n) || n <= 0) return { amount: 1, unit: "hours" };
    if (n % 10080 === 0) return { amount: n / 10080, unit: "weeks" };
    if (n % 1440 === 0) return { amount: n / 1440, unit: "days" };
    return { amount: Math.max(1, n / 60), unit: "hours" };
  }

  function formToMinutes() {
    const eventName = document.querySelector('[name="event_name"]')?.value;
    if (eventName !== "booking_reminder") return null;
    const amount = Number(document.querySelector('[name="reminder_amount"]')?.value || 0);
    const unit = document.querySelector('[name="reminder_unit"]')?.value || "hours";
    if (!Number.isFinite(amount) || amount <= 0) throw new Error("Enter a reminder amount greater than zero.");
    const multipliers = { hours: 60, days: 1440, weeks: 10080 };
    return Math.round(amount * (multipliers[unit] || 60));
  }

  function updateReminderFields() {
    const isReminder = document.querySelector('[name="event_name"]')?.value === "booking_reminder";
    ["reminder_amount", "reminder_unit"].forEach((name) => {
      const el = document.querySelector(`[name="${name}"]`);
      if (!el) return;
      el.disabled = !isReminder;
      const field = el.closest(".field");
      if (field) field.style.opacity = isReminder ? "1" : ".55";
    });
  }

  function populate(row = {}) {
    $("rowId").value = row.id || "";
    FIELDS.forEach((field) => {
      const el = document.querySelector(`[name="${field}"]`);
      if (!el) return;
      if (el.type === "checkbox") el.checked = row[field] ?? (field === "enabled");
      else el.value = row[field] ?? "";
    });
    const offset = offsetToForm(row.minutes_before);
    document.querySelector('[name="reminder_amount"]').value = offset.amount;
    document.querySelector('[name="reminder_unit"]').value = offset.unit;
    $("modalTitle").textContent = `${row.id ? "Edit" : "New"} ${SINGULAR}`;
    updateReminderFields();
    openModal();
  }

  function collect() {
    const payload = {};
    FIELDS.forEach((field) => {
      const el = document.querySelector(`[name="${field}"]`);
      if (!el) return;
      payload[field] = el.type === "checkbox" ? el.checked : (el.value || null);
    });
    payload.minutes_before = formToMinutes();
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
    if (!window.confirm("Delete this notification rule? This cannot be undone.")) return;
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
    document.querySelector('[name="event_name"]').addEventListener("change", updateReminderFields);
    $("cards").addEventListener("click", (event) => {
      const edit = event.target.closest("[data-edit]");
      const del = event.target.closest("[data-delete]");
      if (edit) populate((data[ARRAY_KEY] || []).find((row) => row.id === edit.dataset.edit) || {});
      if (del) remove(del.dataset.delete);
    });
    load();
  });
})();
