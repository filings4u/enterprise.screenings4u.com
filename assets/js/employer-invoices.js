/* ============================================================
   SCREENINGS4U — EMBEDDED EMPLOYER POPUP
   Self-contained: no HTML or extra CSS file required.
   ============================================================ */
(function () {
  "use strict";

  if (window.S4UEmployerPopup) return;

  let activeResolver = null;
  let overlay = null;

  function injectStyles() {
    if (document.getElementById("s4u-employer-popup-styles")) return;

    const style = document.createElement("style");
    style.id = "s4u-employer-popup-styles";
    style.textContent = `
      .s4u-ep[hidden]{display:none!important}
      .s4u-ep{position:fixed;z-index:30000;inset:0;display:grid;place-items:center;padding:20px;opacity:0;transition:opacity .15s ease}
      .s4u-ep.show{opacity:1}
      .s4u-ep-backdrop{position:absolute;inset:0;background:rgba(22,35,53,.52);backdrop-filter:blur(2px)}
      .s4u-ep-card{position:relative;width:min(100%,450px);padding:27px 27px 24px;border:1px solid #dbe4ef;border-radius:18px;background:#fff;box-shadow:0 25px 70px rgba(20,44,77,.28);transform:translateY(8px) scale(.985);transition:transform .15s ease}
      .s4u-ep.show .s4u-ep-card{transform:translateY(0) scale(1)}
      .s4u-ep-close{position:absolute;top:13px;right:13px;display:grid;place-items:center;width:32px;height:32px;padding:0;border:0;border-radius:8px;background:transparent;color:#8793a2;font:inherit;font-size:1.4rem;cursor:pointer}
      .s4u-ep-close:hover{background:#f4f7fb;color:#24467f}
      .s4u-ep-icon{display:grid;place-items:center;width:48px;height:48px;margin-bottom:17px;border-radius:13px;background:rgba(23,61,120,.09);color:#24467f;font-size:1.15rem;font-weight:900}
      .s4u-ep[data-type="success"] .s4u-ep-icon{background:rgba(22,128,77,.10);color:#16804d}
      .s4u-ep[data-type="warning"] .s4u-ep-icon,.s4u-ep[data-type="confirm"] .s4u-ep-icon{background:rgba(240,90,0,.11);color:#f05a00}
      .s4u-ep[data-type="error"] .s4u-ep-icon{background:rgba(179,77,77,.10);color:#b34d4d}
      .s4u-ep-kicker{display:block;margin-bottom:7px;color:#f05a00;font-size:.64rem;font-weight:850;letter-spacing:.11em}
      .s4u-ep-title{margin:0;color:#2f435e;font-size:1.08rem}
      .s4u-ep-message{margin:10px 0 0;color:#6b7b90;font-size:.72rem;line-height:1.65;white-space:pre-line}
      .s4u-ep-actions{display:flex;justify-content:flex-end;gap:9px;margin-top:24px}
      .s4u-ep-btn{min-height:40px;padding:0 16px;border-radius:8px;font:inherit;font-size:.66rem;font-weight:800;cursor:pointer}
      .s4u-ep-cancel{border:1px solid #d8e1eb;background:#fff;color:#68778a}
      .s4u-ep-ok{border:1px solid #24467f;background:#24467f;color:#fff}
      .s4u-ep[data-type="warning"] .s4u-ep-ok,.s4u-ep[data-type="confirm"] .s4u-ep-ok{border-color:#f05a00;background:#f05a00}
      .s4u-ep[data-type="error"] .s4u-ep-ok{border-color:#b34d4d;background:#b34d4d}
      body.s4u-ep-open{overflow:hidden}
      @media(max-width:520px){
        .s4u-ep{padding:16px}
        .s4u-ep-card{padding:24px 20px 20px}
        .s4u-ep-actions{flex-direction:column-reverse}
        .s4u-ep-btn{width:100%}
      }
    `;
    document.head.appendChild(style);
  }

  function ensureOverlay() {
    injectStyles();
    if (overlay) return overlay;

    overlay = document.createElement("div");
    overlay.className = "s4u-ep";
    overlay.hidden = true;
    overlay.innerHTML = `
      <div class="s4u-ep-backdrop" data-s4u-ep-close></div>
      <section class="s4u-ep-card" role="dialog" aria-modal="true" aria-labelledby="s4u-ep-title">
        <button class="s4u-ep-close" type="button" aria-label="Close" data-s4u-ep-close>×</button>
        <div class="s4u-ep-icon" id="s4u-ep-icon">i</div>
        <span class="s4u-ep-kicker" id="s4u-ep-kicker">SCREENINGS4U</span>
        <h2 class="s4u-ep-title" id="s4u-ep-title">Notice</h2>
        <p class="s4u-ep-message" id="s4u-ep-message"></p>
        <div class="s4u-ep-actions">
          <button class="s4u-ep-btn s4u-ep-cancel" type="button" id="s4u-ep-cancel">Cancel</button>
          <button class="s4u-ep-btn s4u-ep-ok" type="button" id="s4u-ep-ok">OK</button>
        </div>
      </section>
    `;
    document.body.appendChild(overlay);

    overlay.querySelectorAll("[data-s4u-ep-close]").forEach(el => {
      el.addEventListener("click", () => finish(false));
    });

    overlay.querySelector("#s4u-ep-cancel").addEventListener("click", () => finish(false));
    overlay.querySelector("#s4u-ep-ok").addEventListener("click", () => finish(true));

    document.addEventListener("keydown", event => {
      if (!overlay || overlay.hidden) return;
      if (event.key === "Escape") finish(false);
    });

    return overlay;
  }

  function finish(value) {
    if (!overlay || overlay.hidden) return;

    overlay.classList.remove("show");
    document.body.classList.remove("s4u-ep-open");

    setTimeout(() => {
      if (!overlay) return;
      overlay.hidden = true;

      const resolve = activeResolver;
      activeResolver = null;
      if (resolve) resolve(Boolean(value));
    }, 150);
  }

  function show(message, options = {}) {
    const root = ensureOverlay();
    const type = String(options.type || "info").toLowerCase();

    const defaults = {
      info:    { icon: "i", kicker: "SCREENINGS4U", title: "Notice" },
      success: { icon: "✓", kicker: "SUCCESS", title: "Success" },
      warning: { icon: "!", kicker: "ATTENTION", title: "Attention" },
      error:   { icon: "!", kicker: "SCREENINGS4U", title: "Unable to Complete" },
      confirm: { icon: "?", kicker: "CONFIRM ACTION", title: "Please Confirm" }
    };

    const d = defaults[type] || defaults.info;

    root.dataset.type = type;
    root.querySelector("#s4u-ep-icon").textContent = options.icon || d.icon;
    root.querySelector("#s4u-ep-kicker").textContent = options.kicker || d.kicker;
    root.querySelector("#s4u-ep-title").textContent = options.title || d.title;
    root.querySelector("#s4u-ep-message").textContent = String(message || "");

    const cancel = root.querySelector("#s4u-ep-cancel");
    const ok = root.querySelector("#s4u-ep-ok");

    cancel.hidden = !options.showCancel;
    cancel.textContent = options.cancelText || "Cancel";
    ok.textContent = options.confirmText || "OK";

    root.hidden = false;
    document.body.classList.add("s4u-ep-open");

    requestAnimationFrame(() => {
      root.classList.add("show");
      ok.focus();
    });

    return new Promise(resolve => {
      activeResolver = resolve;
    });
  }

  window.S4UEmployerPopup = {
    show,
    info(message, options = {}) {
      return show(message, { ...options, type: "info" });
    },
    success(message, options = {}) {
      return show(message, { ...options, type: "success" });
    },
    warning(message, options = {}) {
      return show(message, { ...options, type: "warning" });
    },
    error(message, options = {}) {
      return show(message, { ...options, type: "error" });
    },
    confirm(message, options = {}) {
      return show(message, {
        ...options,
        type: "confirm",
        showCancel: true,
        confirmText: options.confirmText || "Confirm",
        cancelText: options.cancelText || "Cancel"
      });
    }
  };
})();


/* ============================================================
   SCREENINGS4U — EMPLOYER INVOICES & PAYMENTS
   Live employer billing center
   ============================================================ */
(function () {
  "use strict";

  const state = { invoices: [], payments: [] };
  let db = null;

  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    bindEvents();
    await loadBillingData();
  }

  function bindEvents() {
    document.getElementById("invoice-search")?.addEventListener("input", renderInvoices);
    document.getElementById("invoice-status-filter")?.addEventListener("change", renderInvoices);
    document.getElementById("pay-invoices-btn")?.addEventListener("click", payOutstandingInvoices);
    document.getElementById("view-all-payments-btn")?.addEventListener("click", function () {
      document.getElementById("payment-list")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    document.querySelectorAll("[data-close-invoice-modal]").forEach(function (el) {
      el.addEventListener("click", closeInvoiceModal);
    });
  }

  async function loadBillingData() {
    try {
      db = await getScreenings4uSupabase();
      const data = await call("list");
      state.invoices = Array.isArray(data.invoices) ? data.invoices : [];
      state.payments = Array.isArray(data.payments) ? data.payments : [];
      updateSummary();
      renderInvoices();
      renderPayments();
    } catch (error) {
      console.error("[Employer Invoices Load]", error);
      showLoadError(error);
    }
  }

  async function call(action, payload = {}) {
    const { data: authData, error: sessionError } = await db.auth.getSession();
    if (sessionError) throw sessionError;
    const token = authData?.session?.access_token;
    if (!token) throw new Error("Your login session expired. Please sign in again.");

    const { data, error } = await db.functions.invoke("employer-invoice-actions", {
      headers: { Authorization: `Bearer ${token}` },
      body: { action, ...payload }
    });

    if (error) {
      let message = error.message || "Unable to load employer invoices.";
      try {
        const response = error.context;
        if (response && typeof response.json === "function") {
          const body = await response.json();
          if (body?.error) message = body.error;
        }
      } catch (_) {}
      throw new Error(message);
    }
    if (data?.error) throw new Error(data.error);
    return data || {};
  }

  function filteredInvoices() {
    const term = value("invoice-search").toLowerCase();
    const selected = value("invoice-status-filter") || "all";

    return state.invoices.filter(function (invoice) {
      const number = String(invoice.invoice_number || invoice.id || "").toLowerCase();
      const customer = String(invoice.customer_name || "").toLowerCase();
      const status = displayStatus(invoice);

      return (!term || number.includes(term) || customer.includes(term)) &&
        (selected === "all" || status === selected);
    });
  }

  function renderInvoices() {
    const tbody = document.getElementById("invoice-table-body");
    if (!tbody) return;
    const invoices = filteredInvoices();

    if (!invoices.length) {
      tbody.innerHTML = `<tr><td colspan="7"><div class="invoice-empty-state">
        <div class="invoice-empty-icon">$</div>
        <h3>${state.invoices.length ? "No invoices match your filters" : "No invoices available"}</h3>
        <p>${state.invoices.length ? "Try changing your search or status filter." : "Invoices issued to your organization will appear here."}</p>
      </div></td></tr>`;
      return;
    }

    tbody.innerHTML = invoices.map(function (invoice) {
      const status = displayStatus(invoice);
      const balance = balanceDue(invoice);
      return `<tr>
        <td>
          <span class="invoice-number">${escapeHtml(invoice.invoice_number || "Invoice")}</span>
          <span class="invoice-description">${escapeHtml(invoice.customer_name || "Screenings4u Invoice")}</span>
        </td>
        <td>${escapeHtml(formatDate(invoice.issue_date || invoice.created_at))}</td>
        <td>${escapeHtml(formatDate(invoice.due_date))}</td>
        <td class="invoice-amount">${currency(invoice.total)}</td>
        <td class="invoice-amount">${currency(balance)}</td>
        <td><span class="invoice-status invoice-status-${status}">${escapeHtml(statusLabel(status))}</span></td>
        <td><button class="invoice-view-btn" type="button" data-invoice-id="${escapeAttribute(invoice.id)}">View</button></td>
      </tr>`;
    }).join("");

    tbody.querySelectorAll("[data-invoice-id]").forEach(function (button) {
      button.addEventListener("click", function () {
        openInvoiceModal(button.dataset.invoiceId);
      });
    });
  }

  function renderPayments() {
    const list = document.getElementById("payment-list");
    if (!list) return;

    const successful = state.payments.filter(function (p) {
      return String(p.status || "").toLowerCase() === "succeeded";
    });

    if (!successful.length) {
      list.innerHTML = `<div class="payment-empty-state"><p>No payment activity is available yet.</p></div>`;
      return;
    }

    list.innerHTML = successful.slice(0, 10).map(function (payment) {
      return `<div class="payment-row">
        <div class="payment-main">
          <strong>${escapeHtml(payment.provider_payment_id || "Invoice Payment")}</strong>
          <span>${escapeHtml(formatDate(payment.paid_at || payment.created_at))}</span>
        </div>
        <div class="payment-amount">${currency(payment.amount)}</div>
      </div>`;
    }).join("");
  }

  function updateSummary() {
    const open = state.invoices.filter(isPayable);
    const pastDue = state.invoices.filter(function (i) { return displayStatus(i) === "past_due"; });
    const outstanding = open.reduce(function (sum, i) { return sum + balanceDue(i); }, 0);
    const paid = state.payments
      .filter(function (p) { return String(p.status || "").toLowerCase() === "succeeded"; })
      .reduce(function (sum, p) { return sum + Number(p.amount || 0); }, 0);

    setText("stat-outstanding", currency(outstanding));
    setText("stat-open", String(open.length));
    setText("stat-past-due", String(pastDue.length));
    setText("stat-paid", currency(paid));
  }

  function openInvoiceModal(invoiceId) {
    const invoice = state.invoices.find(function (item) {
      return String(item.id) === String(invoiceId);
    });
    if (!invoice) return;

    const modal = document.getElementById("invoice-modal");
    const title = document.getElementById("invoice-modal-title");
    const content = document.getElementById("invoice-modal-content");
    const actions = document.getElementById("invoice-modal-actions");
    if (!modal || !content || !actions) return;

    if (title) title.textContent = invoice.invoice_number || "Invoice";
    const items = Array.isArray(invoice.invoice_items) ? invoice.invoice_items : [];
    const status = displayStatus(invoice);

    content.innerHTML = `
      <div class="invoice-detail-grid">
        <div class="invoice-detail-item"><span>Status</span><strong>${escapeHtml(statusLabel(status))}</strong></div>
        <div class="invoice-detail-item"><span>Issued</span><strong>${escapeHtml(formatDate(invoice.issue_date))}</strong></div>
        <div class="invoice-detail-item"><span>Due Date</span><strong>${escapeHtml(formatDate(invoice.due_date))}</strong></div>
        <div class="invoice-detail-item"><span>Invoice Total</span><strong>${currency(invoice.total)}</strong></div>
        <div class="invoice-detail-item"><span>Paid</span><strong>${currency(invoice.amount_paid)}</strong></div>
        <div class="invoice-detail-item"><span>Balance Due</span><strong>${currency(balanceDue(invoice))}</strong></div>
      </div>
      <h3 class="invoice-items-heading">Invoice Items</h3>
      ${items.length ? items.map(function (item) {
        return `<div class="invoice-item-row">
          <span>${escapeHtml(item.description || "Invoice Item")} × ${escapeHtml(formatQuantity(item.quantity))}</span>
          <strong>${currency(item.line_total)}</strong>
        </div>`;
      }).join("") : `<div class="invoice-item-row"><span>No line items</span><strong>—</strong></div>`}
      ${invoice.notes ? `<h3 class="invoice-items-heading">Notes</h3><div class="invoice-item-row"><span>${escapeHtml(invoice.notes)}</span></div>` : ""}
      ${invoice.terms ? `<h3 class="invoice-items-heading">Terms</h3><div class="invoice-item-row"><span>${escapeHtml(invoice.terms)}</span></div>` : ""}
    `;

    actions.innerHTML = `
      <button type="button" class="invoice-secondary-btn" data-close-invoice-modal>Close</button>
      <button type="button" class="invoice-secondary-btn" id="modal-download-invoice-btn">Download / Print</button>
      ${isPayable(invoice) ? `<button type="button" class="invoice-primary-btn" id="modal-pay-invoice-btn">Pay Invoice</button>` : ""}
    `;

    actions.querySelector("[data-close-invoice-modal]")?.addEventListener("click", closeInvoiceModal);
    document.getElementById("modal-download-invoice-btn")?.addEventListener("click", function () {
      downloadInvoice(invoice);
    });
    document.getElementById("modal-pay-invoice-btn")?.addEventListener("click", function () {
      beginInvoicePayment(invoice.id);
    });

    modal.hidden = false;
  }

  function closeInvoiceModal() {
    const modal = document.getElementById("invoice-modal");
    if (modal) modal.hidden = true;
  }

  function payOutstandingInvoices() {
    const payable = state.invoices.filter(isPayable);
    if (!payable.length) {
      window.S4UEmployerPopup.info("There are currently no outstanding invoices available for payment.", { title: "No Outstanding Invoices" });
      return;
    }
    if (payable.length === 1) {
      beginInvoicePayment(payable[0].id);
      return;
    }
    const filter = document.getElementById("invoice-status-filter");
    if (filter) filter.value = "open";
    renderInvoices();
    document.querySelector(".invoice-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
    window.S4UEmployerPopup.info("Select an outstanding invoice and click View, then Pay Invoice.", { title: "Choose an Invoice" });
  }

  function beginInvoicePayment(invoiceId) {
    const invoice = state.invoices.find(function (item) { return String(item.id) === String(invoiceId); });
    if (!invoice || !isPayable(invoice)) return;

    /*
      The checkout page must recognize invoice_id and use the invoice's
      server-verified amount/items rather than the marketplace cart.
    */
    location.href = "employer-checkout.html?invoice_id=" + encodeURIComponent(invoice.id);
  }

  function downloadInvoice(invoice) {
    const items = Array.isArray(invoice.invoice_items) ? invoice.invoice_items : [];
    const popup = window.open("", "_blank", "noopener,noreferrer");
    if (!popup) {
      window.S4UEmployerPopup.warning("Your browser blocked the invoice window. Please allow pop-ups for this site, then try Download / Print again.", { title: "Pop-up Blocked" });
      return;
    }

    popup.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(invoice.invoice_number || "Invoice")}</title>
      <style>
        body{font-family:Arial,sans-serif;color:#17304f;margin:40px} .head{display:flex;justify-content:space-between;border-bottom:3px solid #24467f;padding-bottom:18px}
        h1{color:#24467f;margin:0}.brand{font-size:24px;font-weight:800;color:#24467f}.orange{color:#f05a00}
        table{width:100%;border-collapse:collapse;margin-top:30px}th{background:#24467f;color:white}th,td{padding:12px;border-bottom:1px solid #dbe4ef;text-align:left}
        th:nth-child(n+2),td:nth-child(n+2){text-align:right}.totals{width:320px;margin:25px 0 0 auto}.totals div{display:flex;justify-content:space-between;padding:7px 0}
        .due{border-top:2px solid #f05a00;font-size:18px;font-weight:800}.muted{color:#6b7b90}.toolbar{margin-bottom:20px}@media print{.toolbar{display:none}}
      </style></head><body>
      <div class="toolbar"><button onclick="window.print()">Print / Save PDF</button></div>
      <div class="head"><div><div class="brand">screenings<span class="orange">4</span>u</div><div class="muted">Employer Invoice</div></div>
      <div><h1>${escapeHtml(invoice.invoice_number || "Invoice")}</h1><div>${escapeHtml(statusLabel(displayStatus(invoice)))}</div></div></div>
      <p><strong>Issued:</strong> ${escapeHtml(formatDate(invoice.issue_date))}<br><strong>Due:</strong> ${escapeHtml(formatDate(invoice.due_date))}</p>
      <table><thead><tr><th>Service</th><th>Qty</th><th>Unit Price</th><th>Total</th></tr></thead><tbody>
      ${items.map(function (item) { return `<tr><td>${escapeHtml(item.description || "Service")}</td><td>${escapeHtml(formatQuantity(item.quantity))}</td><td>${currency(item.unit_price)}</td><td>${currency(item.line_total)}</td></tr>`; }).join("")}
      </tbody></table>
      <div class="totals"><div><span>Subtotal</span><strong>${currency(invoice.subtotal)}</strong></div><div><span>Paid</span><strong>${currency(invoice.amount_paid)}</strong></div><div class="due"><span>Balance Due</span><strong>${currency(balanceDue(invoice))}</strong></div></div>
      ${invoice.terms ? `<p><strong>Terms:</strong> ${escapeHtml(invoice.terms)}</p>` : ""}
      </body></html>`);
    popup.document.close();
  }

  function isPayable(invoice) {
    const status = displayStatus(invoice);
    return ["open", "past_due"].includes(status) && balanceDue(invoice) > 0;
  }

  function displayStatus(invoice) {
    const raw = String(invoice?.status || "open").toLowerCase().trim().replace(/\s+/g, "_").replace(/-/g, "_");
    if (balanceDue(invoice) <= 0 || raw === "paid") return "paid";
    if (raw === "void") return "void";
    if (raw === "past_due") return "past_due";
    if (invoice?.due_date) {
      const due = new Date(invoice.due_date + "T23:59:59");
      if (!Number.isNaN(due.getTime()) && due.getTime() < Date.now()) return "past_due";
    }
    // draft/sent/partially_paid are customer-facing as an open balance.
    return "open";
  }

  function balanceDue(invoice) {
    const value = invoice?.amount_due;
    if (value != null && Number.isFinite(Number(value))) return Math.max(0, Number(value));
    return Math.max(0, Number(invoice?.total || 0) - Number(invoice?.amount_paid || 0));
  }

  function statusLabel(status) {
    return { open:"Open", paid:"Paid", past_due:"Past Due", void:"Void" }[status] || "Open";
  }

  function showLoadError(error) {
    const tbody = document.getElementById("invoice-table-body");
    if (tbody) tbody.innerHTML = `<tr><td colspan="7"><div class="invoice-empty-state"><h3>Unable to load invoices</h3><p>${escapeHtml(error?.message || "Please try again.")}</p></div></td></tr>`;
    setText("stat-outstanding", "—");
    setText("stat-open", "—");
    setText("stat-past-due", "—");
    setText("stat-paid", "—");
  }

  function formatDate(value) {
    if (!value) return "—";
    const date = /^\d{4}-\d{2}-\d{2}$/.test(String(value)) ? new Date(value + "T12:00:00") : new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat("en-US", { month:"short", day:"numeric", year:"numeric" }).format(date);
  }

  function formatQuantity(value) {
    const n = Number(value || 0);
    return Number.isInteger(n) ? String(n) : String(n);
  }

  function currency(value) {
    const amount = Number(value || 0);
    return new Intl.NumberFormat("en-US", { style:"currency", currency:"USD" }).format(Number.isFinite(amount) ? amount : 0);
  }

  function value(id) {
    const el = document.getElementById(id);
    return el ? String(el.value || "").trim() : "";
  }

  function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text == null ? "" : text;
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g,"&amp;").replace(/</g,"&lt;")
      .replace(/>/g,"&gt;").replace(/"/g,"&quot;")
      .replace(/'/g,"&#039;");
  }

  function escapeAttribute(value) { return escapeHtml(value); }
})();