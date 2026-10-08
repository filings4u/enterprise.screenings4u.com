/* ============================================================
   screenings4u —UI
   Replaces browser alert()/confirm() for application actions.
   ============================================================ */

(() => {
  "use strict";

  function ensureModalStyles() {
    const existing = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
      .some((link) => String(link.getAttribute("href") || "").includes("lms-ui-modals.css"));

    if (!existing) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "assets/css/lms-ui-modals.css?v=20260918-modal-fix-1";
      link.dataset.s4uModalStyles = "true";
      document.head.appendChild(link);
    }
  }

  ensureModalStyles();

  let activeModal = null;

  function ensureRoot() {
    let root = document.getElementById("s4uModalRoot");

    if (!root) {
      root = document.createElement("div");
      root.id = "s4uModalRoot";
      root.className = "s4u-modal-root";
      document.body.appendChild(root);
    }

    return root;
  }

  function close() {
    if (!activeModal) return;

    activeModal.remove();
    activeModal = null;
    document.body.classList.remove("s4u-modal-open");
  }

  function modal({
    title = "screenings4u",
    message = "",
    type = "info",
    confirmText = "Continue",
    cancelText = "Cancel",
    showCancel = false,
    onConfirm = null,
    onCancel = null
  } = {}) {
    close();

    const root = ensureRoot();
    const wrapper = document.createElement("div");

    wrapper.className = `s4u-modal ${type}`;
    wrapper.setAttribute("role", "dialog");
    wrapper.setAttribute("aria-modal", "true");

    wrapper.innerHTML = `
      <div class="s4u-modal-backdrop" data-modal-close></div>
      <section class="s4u-modal-panel">
        <div class="s4u-modal-brand"><img src="images/logo.png" alt="screenings4u"></div>
        <div class="s4u-modal-icon" aria-hidden="true"></div>
        <div class="s4u-modal-content">
          <h2>${escapeHtml(title)}</h2>
          <p>${escapeHtml(message)}</p>
        </div>
        <div class="s4u-modal-actions">
          ${showCancel ? `<button class="s4u-modal-button secondary" type="button" data-modal-cancel>${escapeHtml(cancelText)}</button>` : ""}
          <button class="s4u-modal-button primary" type="button" data-modal-confirm>${escapeHtml(confirmText)}</button>
        </div>
      </section>
    `;

    root.appendChild(wrapper);
    activeModal = wrapper;
    document.body.classList.add("s4u-modal-open");

    const cancel = () => {
      if (typeof onCancel === "function") onCancel();
      close();
    };
    wrapper.querySelector("[data-modal-close]")?.addEventListener("click", cancel);
    wrapper.querySelector("[data-modal-cancel]")?.addEventListener("click", cancel);

    wrapper.querySelector("[data-modal-confirm]")?.addEventListener("click", async () => {
      const button = wrapper.querySelector("[data-modal-confirm]");
      button.disabled = true;

      try {
        if (typeof onConfirm === "function") {
          await onConfirm();
        }
        close();
      } catch (error) {
        button.disabled = false;
        toast(error?.message || "Unable to complete this action.", "error");
      }
    });

    return { close };
  }

  function toast(message, type = "info") {
    let root = document.getElementById("s4uToastRoot");

    if (!root) {
      root = document.createElement("div");
      root.id = "s4uToastRoot";
      root.className = "s4u-toast-root";
      document.body.appendChild(root);
    }

    const item = document.createElement("div");
    item.className = `s4u-toast ${type}`;
    item.textContent = message;
    root.appendChild(item);

    requestAnimationFrame(() => item.classList.add("show"));

    setTimeout(() => {
      item.classList.remove("show");
      setTimeout(() => item.remove(), 180);
    }, 4200);
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function formModal({
    title = "screenings4u",
    message = "",
    fields = [],
    confirmText = "Save",
    cancelText = "Cancel",
    onSubmit = null,
    onCancel = null
  } = {}) {
    close();
    const root = ensureRoot();
    const wrapper = document.createElement("div");
    wrapper.className = "s4u-modal info";
    wrapper.setAttribute("role", "dialog");
    wrapper.setAttribute("aria-modal", "true");
    wrapper.innerHTML = `
      <div class="s4u-modal-backdrop" data-modal-close></div>
      <section class="s4u-modal-panel s4u-form-modal-panel">
        <div class="s4u-modal-brand"><img src="images/logo.png" alt="screenings4u"></div>
        <div class="s4u-modal-content">
          <h2>${escapeHtml(title)}</h2>
          ${message ? `<p>${escapeHtml(message)}</p>` : ""}
          <form class="s4u-form-modal-form">
            ${fields.map((field, index) => `
              <label class="s4u-form-modal-field">
                <span>${escapeHtml(field.label || field.name)}</span>
                ${field.type === "textarea"
                  ? `<textarea name="${escapeHtml(field.name)}" rows="4">${escapeHtml(field.value ?? "")}</textarea>`
                  : field.type === "select"
                    ? `<select name="${escapeHtml(field.name)}">${(field.options || []).map(o => `<option value="${escapeHtml(o.value)}" ${String(o.value) === String(field.value) ? "selected" : ""}>${escapeHtml(o.label)}</option>`).join("")}</select>`
                    : `<input type="${escapeHtml(field.type || "text")}" name="${escapeHtml(field.name)}" value="${escapeHtml(field.value ?? "")}" ${field.required ? "required" : ""} ${field.min !== undefined ? `min="${escapeHtml(field.min)}"` : ""} ${field.max !== undefined ? `max="${escapeHtml(field.max)}"` : ""}>`}
              </label>
            `).join("")}
            <div class="s4u-modal-actions">
              <button class="s4u-modal-button secondary" type="button" data-modal-cancel>${escapeHtml(cancelText)}</button>
              <button class="s4u-modal-button primary" type="submit">${escapeHtml(confirmText)}</button>
            </div>
          </form>
        </div>
      </section>
    `;
    root.appendChild(wrapper);
    activeModal = wrapper;
    document.body.classList.add("s4u-modal-open");
    const cancel = () => {
      if (typeof onCancel === "function") onCancel();
      close();
    };
    wrapper.querySelector("[data-modal-close]")?.addEventListener("click", cancel);
    wrapper.querySelector("[data-modal-cancel]")?.addEventListener("click", cancel);
    wrapper.querySelector("form")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const button = wrapper.querySelector('button[type="submit"]');
      button.disabled = true;
      const formData = new FormData(event.currentTarget);
      const values = Object.fromEntries(formData.entries());
      try {
        if (typeof onSubmit === "function") await onSubmit(values);
        close();
      } catch (error) {
        button.disabled = false;
        toast(error?.message || "Unable to complete this action.", "error");
      }
    });
    wrapper.querySelector("input, select, textarea")?.focus();
    return { close };
  }

  function confirm(message, options = {}) {
    return new Promise((resolve) => {
      modal({
        title: options.title || "Please Confirm",
        message,
        type: options.type || "info",
        confirmText: options.confirmText || "Continue",
        cancelText: options.cancelText || "Cancel",
        showCancel: true,
        onConfirm: () => resolve(true),
        onCancel: () => resolve(false)
      });
    });
  }

  function prompt(message, options = {}) {
    return new Promise((resolve) => {
      formModal({
        title: options.title || "screenings4u",
        message,
        fields: [{
          name: "value",
          label: options.label || "Details",
          type: options.type || "text",
          value: options.value || "",
          required: Boolean(options.required)
        }],
        confirmText: options.confirmText || "Continue",
        cancelText: options.cancelText || "Cancel",
        onSubmit: ({ value }) => resolve(String(value || "")),
        onCancel: () => resolve(null)
      });
    });
  }

  window.S4UUI = Object.freeze({
    modal,
    formModal,
    confirm,
    prompt,
    toast,
    closeModal: close
  });
})();
