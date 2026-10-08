(() => {
  "use strict";

  let db = null;
  let settings = [];
  let activeCategory = "all";
  let trainingPackages = [];
  let trainingCourses = [];

  const byId = (...ids) => {
    for (const id of ids) {
      const node = document.getElementById(id);
      if (node) return node;
    }
    return null;
  };

  const ui = {};

  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    cacheDom();
    bindEvents();

    try {
      if (typeof window.getScreenings4uSupabase !== "function") {
        throw new Error("Supabase client helper was not found.");
      }

      db = await window.getScreenings4uSupabase();

      if (!db?.functions) {
        throw new Error("Supabase client could not be initialized.");
      }

      await loadSettings();
    } catch (error) {
      showError(error);
    }
  }

  function cacheDom() {
    ui.save = byId(
      "save",
      "saveSettings",
      "save-settings",
      "btnSaveSettings"
    ) || document.querySelector(
      '[data-action="save-settings"], [data-save-settings]'
    );

    ui.count = byId("count", "settingsCount", "sTotal");
    ui.categories = byId("cats", "categoryCount", "sCategories");
    ui.publicCount = byId("public", "publicCount", "sPublic");

    ui.tabs = byId(
      "tabs",
      "settingsTabs",
      "categoryTabs",
      "settings-tabs"
    );

    ui.settings = byId(
      "settings",
      "settingsList",
      "settingsContainer",
      "settings-container"
    );

    ui.message = byId("message", "settingsMessage", "globalSettingsMessage");
  }

  function bindEvents() {
    ui.save?.addEventListener("click", saveSettings);
  }

  async function callFunction(body) {
    const { data, error } = await db.functions.invoke(
      "admin-system-management",
      { body }
    );

    if (error) {
      let message = error.message || "Global settings request failed.";

      try {
        const payload = await error.context?.clone?.().json();
        if (payload?.error) message = payload.error;
      } catch (_) {}

      throw new Error(message);
    }

    if (data?.error) {
      throw new Error(data.error);
    }

    return data || {};
  }

  async function loadSettings() {
    try {
      setBusy(true);

      const data = await callFunction({
        scope: "settings",
        action: "list"
      });

      settings = Array.isArray(data.settings) ? data.settings : [];
      trainingPackages = Array.isArray(data.training_packages) ? data.training_packages : [];
      trainingCourses = Array.isArray(data.training_courses) ? data.training_courses : [];

      if (ui.count) {
        ui.count.textContent = String(settings.length);
      }

      if (ui.categories) {
        ui.categories.textContent = String(
          new Set(settings.map((item) => item.category).filter(Boolean)).size
        );
      }

      if (ui.publicCount) {
        ui.publicCount.textContent = String(
          settings.filter((item) => item.is_public).length
        );
      }

      drawTabs();
      drawSettings();
      clearMessage();
    } catch (error) {
      showError(error);
    } finally {
      setBusy(false);
    }
  }

  function settingValue(setting) {
    switch (setting.value_type) {
      case "boolean":
        return Boolean(setting.value_boolean);

      case "integer":
      case "decimal":
        return setting.value_number ?? "";

      case "json":
        return JSON.stringify(setting.value_json ?? {}, null, 2);

      default:
        return setting.value_text ?? "";
    }
  }

  function drawTabs() {
    if (!ui.tabs) return;

    const categories = [
      "all",
      ...new Set(
        settings
          .map((item) => item.category)
          .filter(Boolean)
      )
    ];

    ui.tabs.innerHTML = categories
      .map((category) => {
        const active = category === activeCategory ? " on" : "";
        return `
          <button
            type="button"
            class="tab${active}"
            data-settings-category="${escapeHtml(category)}"
          >
            ${escapeHtml(humanize(category))}
          </button>
        `;
      })
      .join("");

    ui.tabs
      .querySelectorAll("[data-settings-category]")
      .forEach((button) => {
        button.addEventListener("click", () => {
          activeCategory = button.dataset.settingsCategory || "all";
          drawTabs();
          drawSettings();
        });
      });
  }

  function drawSettings() {
    if (!ui.settings) {
      console.error(
        "admin-global-settings: settings container is missing. " +
        "Expected #settings, #settingsList, #settingsContainer, or #settings-container."
      );
      return;
    }

    const visible = activeCategory === "all"
      ? settings
      : settings.filter((item) => item.category === activeCategory);

    if (!visible.length) {
      ui.settings.innerHTML =
        '<div class="empty">No settings are available in this category.</div>';
      return;
    }

    ui.settings.innerHTML = visible.map(renderSetting).join("") + renderTrainingCatalog();
    bindTrainingCatalog();
  }

  function renderSetting(setting) {
    const key = escapeHtml(setting.key);
    const label = escapeHtml(setting.label || setting.key);
    const description = escapeHtml(setting.description || "");
    const unit = setting.unit
      ? ` <span class="setting-unit">• ${escapeHtml(setting.unit)}</span>`
      : "";

    let control = "";

    if (setting.value_type === "boolean") {
      control = `
        <label class="setting-toggle">
          <input
            type="checkbox"
            class="switch"
            data-setting-key="${key}"
            data-setting-type="boolean"
            ${settingValue(setting) ? "checked" : ""}
            ${setting.is_editable === false ? "disabled" : ""}
          >
          <span>${settingValue(setting) ? "Enabled" : "Disabled"}</span>
        </label>
      `;
    } else if (setting.value_type === "json") {
      control = `
        <textarea
          class="input"
          rows="4"
          data-setting-key="${key}"
          data-setting-type="json"
          ${setting.is_editable === false ? "disabled" : ""}
        >${escapeHtml(settingValue(setting))}</textarea>
      `;
    } else {
      const numberType = ["integer", "decimal"].includes(setting.value_type);
      const min = setting.min_value != null
        ? ` min="${escapeHtml(setting.min_value)}"`
        : "";
      const max = setting.max_value != null
        ? ` max="${escapeHtml(setting.max_value)}"`
        : "";
      const step = setting.value_type === "decimal"
        ? ' step="any"'
        : "";

      control = `
        <input
          class="input"
          type="${numberType ? "number" : "text"}"
          data-setting-key="${key}"
          data-setting-type="${escapeHtml(setting.value_type)}"
          value="${escapeHtml(settingValue(setting))}"
          ${min}${max}${step}
          ${setting.is_editable === false ? "disabled" : ""}
        >
      `;
    }

    return `
      <div class="setting" data-setting-row="${key}">
        <div class="setting-copy">
          <h4>${label}</h4>
          <p>${description}${unit}</p>
          <small>${key}</small>
        </div>

        <div class="value">
          ${control}
        </div>
      </div>
    `;
  }

  async function saveSettings() {
    try {
      const controls = Array.from(
        document.querySelectorAll("[data-setting-key]")
      ).filter((node) => !node.disabled);

      if (!controls.length) {
        throw new Error(
          "No editable settings were found on this page."
        );
      }

      const updates = controls.map((control) => {
        const key = control.dataset.settingKey;
        const valueType = control.dataset.settingType ||
          settings.find((item) => item.key === key)?.value_type ||
          "string";

        let value;

        if (valueType === "boolean") {
          value = control.checked;
        } else if (valueType === "integer") {
          value = control.value === "" ? null : parseInt(control.value, 10);
        } else if (valueType === "decimal") {
          value = control.value === "" ? null : Number(control.value);
        } else if (valueType === "json") {
          try {
            value = control.value.trim()
              ? JSON.parse(control.value)
              : {};
          } catch (_) {
            throw new Error(`Invalid JSON for setting: ${key}`);
          }
        } else {
          value = control.value;
        }

        return {
          key,
          value_type: valueType,
          value
        };
      });

      setBusy(true);

      await callFunction({
        scope: "settings",
        action: "save",
        settings: updates
      });

      showMessage("Global settings saved.", "ok");
      await loadSettings();
    } catch (error) {
      showError(error);
    } finally {
      setBusy(false);
    }
  }

  function renderTrainingCatalog() {
    if (activeCategory !== "training_credits") return "";
    const packages = trainingPackages.map(p => `
      <tr>
        <td><input class="input" data-training-package="${escapeHtml(p.id)}" data-field="name" value="${escapeHtml(p.name)}"></td>
        <td><input class="input" type="number" min="1" data-training-package="${escapeHtml(p.id)}" data-field="credits" value="${escapeHtml(p.credits)}"></td>
        <td><input class="input" type="number" min="0" step="0.01" data-training-package="${escapeHtml(p.id)}" data-field="price" value="${escapeHtml(p.price)}"></td>
        <td><input type="checkbox" class="switch" data-training-package="${escapeHtml(p.id)}" data-field="active" ${p.active?"checked":""}></td>
      </tr>`).join("");
    const courses = trainingCourses.map(c => `
      <tr><td>${escapeHtml(c.title)}</td><td>${escapeHtml(humanize(c.status))}</td>
      <td><input class="input" type="number" min="1" data-training-course="${escapeHtml(c.id)}" value="${escapeHtml(c.training_credit_cost||1)}"></td></tr>`).join("");
    return `<div class="training-settings-extra">
      <h3>Training Credit Packages</h3><p class="muted">Employer-only packages. These values do not use test-pricing.js.</p>
      <div class="tablewrap"><table class="table"><thead><tr><th>Package</th><th>Credits</th><th>Price</th><th>Active</th></tr></thead><tbody>${packages||'<tr><td colspan="4">No packages configured.</td></tr>'}</tbody></table></div>
      <h3 style="margin-top:24px">Course Credit Costs</h3><p class="muted">Set how many employer training credits are consumed when one person is assigned each LMS course.</p>
      <div class="tablewrap"><table class="table"><thead><tr><th>Course</th><th>Status</th><th>Credits</th></tr></thead><tbody>${courses||'<tr><td colspan="3">No LMS courses found.</td></tr>'}</tbody></table></div>
      <div class="actions"><button type="button" class="btn primary" id="save-training-catalog">Save Training Catalog</button></div>
    </div>`;
  }

  function bindTrainingCatalog() {
    document.getElementById("save-training-catalog")?.addEventListener("click", saveTrainingCatalog);
  }

  async function saveTrainingCatalog() {
    try {
      const packages = trainingPackages.map(p => {
        const nodes = [...document.querySelectorAll(`[data-training-package="${p.id}"]`)];
        const out = {id:p.id,name:p.name,credits:p.credits,price:p.price,active:p.active,sort_order:p.sort_order||0};
        nodes.forEach(n => { const f=n.dataset.field; out[f]=f==="active"?n.checked:(["credits","price"].includes(f)?Number(n.value):n.value); });
        return out;
      });
      const courses = trainingCourses.map(c => {
        const n=document.querySelector(`[data-training-course="${c.id}"]`);
        return {id:c.id,training_credit_cost:Math.max(1,Number(n?.value||c.training_credit_cost||1))};
      });
      setBusy(true);
      await callFunction({scope:"settings",action:"save_training_catalog",packages,courses});
      showMessage("Training credit packages and course costs saved.","ok");
      await loadSettings();
    } catch(error) { showError(error); } finally { setBusy(false); }
  }

  function setBusy(busy) {
    if (!ui.save) return;

    ui.save.disabled = busy;

    if (!ui.save.dataset.originalText) {
      ui.save.dataset.originalText = ui.save.textContent || "Save Changes";
    }

    ui.save.textContent = busy
      ? "Saving..."
      : ui.save.dataset.originalText;
  }

  function showMessage(text, type = "ok") {
    if (ui.message) {
      ui.message.textContent = text;
      ui.message.className = `message show ${type}`;
      return;
    }

    if (type === "error") {
      console.error(text);
    } else {
      console.log(text);
    }
  }

  function clearMessage() {
    if (!ui.message) return;
    ui.message.textContent = "";
    ui.message.className = "message";
  }

  function showError(error) {
    const message = error?.message || String(error);

    showMessage(message, "error");

    if (ui.settings && !settings.length) {
      ui.settings.innerHTML = `
        <div class="notice">
          <strong>Unable to load global settings.</strong><br>
          ${escapeHtml(message)}
        </div>
      `;
    }

    console.error("admin-global-settings:", error);
  }

  function humanize(value) {
    return String(value || "")
      .replace(/_/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
})();
