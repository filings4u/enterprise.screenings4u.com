(() => {
"use strict";

let db = null;
let codes = [];
let services = [];
const E = {};

document.addEventListener("DOMContentLoaded", init);

async function init() {
  cache();
  bind();
  try {
    db = await getClient();
    if (!db) throw new Error("Supabase client not found.");
    const { data } = await db.auth.getSession();
    if (!data?.session?.user) {
      location.replace("admin-login.html");
      return;
    }
    await Promise.all([loadCodes(), loadCatalog()]);
  } catch (error) {
    showMessage(error?.message || "Unable to load discount codes.", "error");
  }
}

function cache() {
  ["refresh","newCode","message","totalCodes","activeCodes","redemptions","discountValue","search","statusFilter","body","empty",
   "modal","modalTitle","closeModal","cancelModal","form","saveCode","codeId","code","name","discountType","discountValueInput",
   "minimumSubtotal","maximumDiscount","maxRedemptions","maxPerCustomer","startsAt","endsAt","description","active","allServices",
   "serviceField","serviceList","channels"].forEach(id => E[id] = document.getElementById(id));
}

function bind() {
  E.refresh?.addEventListener("click", loadCodes);
  E.newCode?.addEventListener("click", () => openEditor());
  E.closeModal?.addEventListener("click", closeEditor);
  E.cancelModal?.addEventListener("click", closeEditor);
  E.modal?.addEventListener("click", event => { if (event.target === E.modal) closeEditor(); });
  E.form?.addEventListener("submit", saveCode);
  E.search?.addEventListener("input", render);
  E.statusFilter?.addEventListener("change", render);
  E.allServices?.addEventListener("change", updateServiceVisibility);
  E.body?.addEventListener("click", handleRowAction);
  document.addEventListener("keydown", event => { if (event.key === "Escape" && !E.modal?.hidden) closeEditor(); });
}

async function getClient() {
  for (let i = 0; i < 40; i += 1) {
    try {
      if (typeof window.getScreenings4uSupabase === "function") {
        const instance = await window.getScreenings4uSupabase();
        if (instance?.functions) return instance;
      }
      if (window.screenings4uSupabase?.functions) return window.screenings4uSupabase;
      if (window.supabaseClient?.functions) return window.supabaseClient;
    } catch (_) {}
    await new Promise(resolve => setTimeout(resolve, 75));
  }
  return null;
}

async function call(body) {
  const { data, error } = await db.functions.invoke("admin-discount-actions", { body });
  if (error) {
    let message = error.message || "Discount action failed.";
    try {
      const response = error.context;
      if (response && typeof response.clone === "function") {
        const payload = await response.clone().json();
        if (payload?.error) message = payload.error;
      }
    } catch (_) {}
    throw new Error(message);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

async function loadCodes() {
  if (E.refresh) E.refresh.disabled = true;
  try {
    const data = await call({ action: "list" });
    codes = data.codes || [];
    updateStats();
    render();
  } catch (error) {
    showMessage(error?.message || "Unable to load discount codes.", "error");
  } finally {
    if (E.refresh) E.refresh.disabled = false;
  }
}

async function loadCatalog() {
  const data = await call({ action: "catalog" });
  services = data.services || [];
  renderServices([]);
}

function updateStats() {
  const redemptionCount = codes.reduce((sum, code) => sum + Number(code.redemption_count || 0), 0);
  const discountTotal = codes.reduce((sum, code) => sum + Number(code.redeemed_amount || 0), 0);
  if (E.totalCodes) E.totalCodes.textContent = String(codes.length);
  if (E.activeCodes) E.activeCodes.textContent = String(codes.filter(code => statusOf(code) === "active").length);
  if (E.redemptions) E.redemptions.textContent = String(redemptionCount);
  if (E.discountValue) E.discountValue.textContent = money(discountTotal);
}

function statusOf(code) {
  if (!code.active) return "inactive";
  const now = Date.now();
  const starts = code.starts_at ? new Date(code.starts_at).getTime() : null;
  const ends = code.ends_at ? new Date(code.ends_at).getTime() : null;
  if (starts && starts > now) return "scheduled";
  if (ends && ends < now) return "expired";
  return "active";
}

function render() {
  if (!E.body) return;
  const query = String(E.search?.value || "").trim().toLowerCase();
  const statusFilter = E.statusFilter?.value || "all";
  const filtered = codes.filter(code => {
    const searchable = [code.code, code.name, code.description].filter(Boolean).join(" ").toLowerCase();
    return (!query || searchable.includes(query)) && (statusFilter === "all" || statusOf(code) === statusFilter);
  });

  if (E.empty) E.empty.hidden = filtered.length > 0;
  E.body.innerHTML = filtered.map(code => {
    const status = statusOf(code);
    const serviceText = code.applies_to_all_services ? "All services" : (code.services || []).map(s => s.name).join(", ") || "No services";
    const discount = code.discount_type === "percent"
      ? `${trimNumber(code.discount_value)}%`
      : money(code.discount_value);
    const limit = code.max_redemptions ? `${code.redemption_count || 0} / ${code.max_redemptions}` : `${code.redemption_count || 0} / Unlimited`;
    const schedule = [code.starts_at ? `Starts ${formatDateTime(code.starts_at)}` : "Starts now", code.ends_at ? `Ends ${formatDateTime(code.ends_at)}` : "No end date"].join("<br>");
    return `
      <tr>
        <td><div class="code"><strong>${escapeHtml(code.code)}</strong><small>${escapeHtml(code.name || "—")}</small></div></td>
        <td><strong>${escapeHtml(discount)}</strong>${Number(code.minimum_subtotal || 0) > 0 ? `<br><small>Min ${money(code.minimum_subtotal)}</small>` : ""}</td>
        <td><span class="badge ${status}">${human(status)}</span></td>
        <td>${escapeHtml(serviceText)}</td>
        <td>${escapeHtml((code.channels || []).map(human).join(", "))}</td>
        <td>${escapeHtml(limit)}</td>
        <td class="money">${money(code.redeemed_amount || 0)}</td>
        <td>${schedule}</td>
        <td><div class="row-actions">
          <button class="row-btn" data-action="edit" data-id="${escapeHtml(code.id)}">Edit</button>
          <button class="row-btn" data-action="toggle" data-id="${escapeHtml(code.id)}">${code.active ? "Deactivate" : "Activate"}</button>
          <button class="row-btn danger" data-action="remove" data-id="${escapeHtml(code.id)}">Delete</button>
        </div></td>
      </tr>`;
  }).join("");
}

async function handleRowAction(event) {
  const button = event.target.closest("[data-action][data-id]");
  if (!button) return;
  const code = codes.find(item => item.id === button.dataset.id);
  if (!code) return;

  if (button.dataset.action === "edit") {
    openEditor(code);
    return;
  }
  if (button.dataset.action === "toggle") {
    button.disabled = true;
    try {
      await call({ action: "toggle", id: code.id, active: !code.active });
      showMessage(`${code.code} ${code.active ? "deactivated" : "activated"}.`, "success");
      await loadCodes();
    } catch (error) {
      showMessage(error?.message || "Unable to update discount code.", "error");
    } finally {
      button.disabled = false;
    }
    return;
  }
  if (button.dataset.action === "remove") {
    if (!confirm(`Delete discount code ${code.code}? Codes with redemption history cannot be deleted.`)) return;
    button.disabled = true;
    try {
      await call({ action: "remove", id: code.id });
      showMessage(`${code.code} deleted.`, "success");
      await loadCodes();
    } catch (error) {
      showMessage(error?.message || "Unable to delete discount code.", "error");
    } finally {
      button.disabled = false;
    }
  }
}

function openEditor(code = null) {
  E.form?.reset();
  if (E.codeId) E.codeId.value = code?.id || "";
  if (E.modalTitle) E.modalTitle.textContent = code ? `Edit ${code.code}` : "New Discount Code";
  if (E.code) E.code.value = code?.code || "";
  if (E.name) E.name.value = code?.name || "";
  if (E.discountType) E.discountType.value = code?.discount_type || "percent";
  if (E.discountValueInput) E.discountValueInput.value = code?.discount_value ?? "";
  if (E.minimumSubtotal) E.minimumSubtotal.value = code?.minimum_subtotal ?? 0;
  if (E.maximumDiscount) E.maximumDiscount.value = code?.maximum_discount_amount ?? "";
  if (E.maxRedemptions) E.maxRedemptions.value = code?.max_redemptions ?? "";
  if (E.maxPerCustomer) E.maxPerCustomer.value = code?.max_redemptions_per_customer ?? "";
  if (E.startsAt) E.startsAt.value = toLocalInput(code?.starts_at);
  if (E.endsAt) E.endsAt.value = toLocalInput(code?.ends_at);
  if (E.description) E.description.value = code?.description || "";
  if (E.active) E.active.checked = code ? code.active !== false : true;
  if (E.allServices) E.allServices.checked = code ? code.applies_to_all_services !== false : true;
  const selectedServices = (code?.services || []).map(service => service.id);
  renderServices(selectedServices);
  const selectedChannels = new Set(code?.channels || ["website","customer","employer","employee","admin","training"]);
  E.channels?.querySelectorAll('input[type="checkbox"]').forEach(box => box.checked = selectedChannels.has(box.value));
  updateServiceVisibility();
  if (E.modal) E.modal.hidden = false;
  setTimeout(() => E.code?.focus(), 0);
}

function closeEditor() {
  if (E.modal) E.modal.hidden = true;
}

function updateServiceVisibility() {
  if (E.serviceField) E.serviceField.hidden = !!E.allServices?.checked;
}

function renderServices(selectedIds = []) {
  if (!E.serviceList) return;
  const selected = new Set(selectedIds);
  E.serviceList.innerHTML = services.map(service => `
    <label class="check-row">
      <input type="checkbox" value="${escapeHtml(service.id)}" ${selected.has(service.id) ? "checked" : ""}>
      <span>${escapeHtml(service.name)}${service.sku ? ` <small>(${escapeHtml(service.sku)})</small>` : ""}</span>
    </label>`).join("") || "<span class='hint'>No active services found.</span>";
}

async function saveCode(event) {
  event.preventDefault();
  if (!E.saveCode) return;
  const channels = [...(E.channels?.querySelectorAll('input[type="checkbox"]:checked') || [])].map(box => box.value);
  const serviceIds = [...(E.serviceList?.querySelectorAll('input[type="checkbox"]:checked') || [])].map(box => box.value);
  const payload = {
    action: "save",
    id: E.codeId?.value || null,
    code: E.code?.value || "",
    name: E.name?.value || "",
    description: E.description?.value || "",
    discount_type: E.discountType?.value || "percent",
    discount_value: E.discountValueInput?.value || "",
    minimum_subtotal: E.minimumSubtotal?.value || 0,
    maximum_discount_amount: E.maximumDiscount?.value || null,
    max_redemptions: E.maxRedemptions?.value || null,
    max_redemptions_per_customer: E.maxPerCustomer?.value || null,
    starts_at: fromLocalInput(E.startsAt?.value),
    ends_at: fromLocalInput(E.endsAt?.value),
    active: !!E.active?.checked,
    applies_to_all_services: !!E.allServices?.checked,
    service_ids: serviceIds,
    channels
  };
  const numericDiscountValue = Number(payload.discount_value);
  if (!Number.isFinite(numericDiscountValue) || numericDiscountValue <= 0) {
    showMessage("Discount value must be greater than zero.", "error");
    return;
  }
  if (payload.discount_type === "percent" && numericDiscountValue > 100) {
    showMessage("Percentage discounts cannot exceed 100%.", "error");
    return;
  }
  if (!payload.applies_to_all_services && serviceIds.length === 0) {
    showMessage("Select at least one service or enable Apply to all services.", "error");
    return;
  }
  if (channels.length === 0) {
    showMessage("Select at least one allowed channel / portal.", "error");
    return;
  }
  if (payload.starts_at && payload.ends_at && new Date(payload.ends_at) <= new Date(payload.starts_at)) {
    showMessage("End date must be after the start date.", "error");
    return;
  }
  E.saveCode.disabled = true;
  E.saveCode.textContent = "Saving...";
  try {
    await call(payload);
    closeEditor();
    showMessage(`${String(payload.code).trim().toUpperCase()} saved.`, "success");
    await loadCodes();
  } catch (error) {
    showMessage(error?.message || "Unable to save discount code.", "error");
  } finally {
    E.saveCode.disabled = false;
    E.saveCode.textContent = "Save Discount Code";
  }
}

function showMessage(text, type = "error") {
  if (!E.message) return;
  E.message.textContent = text;
  E.message.className = `message show ${type}`;
}

function money(value) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(value || 0));
}

function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

function toLocalInput(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const pad = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInput(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function trimNumber(value) {
  const number = Number(value || 0);
  return Number.isInteger(number) ? String(number) : String(number).replace(/0+$/, "").replace(/\.$/, "");
}

function human(value) {
  return String(value || "—").replace(/_/g, " ").replace(/\b\w/g, character => character.toUpperCase());
}

function escapeHtml(value) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}
})();