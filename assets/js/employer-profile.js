(function () {
  "use strict";

  let initialData = {};
  let db = null;
  let primaryUserId = null;
  let canWrite = false;

  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    bind();

    const initialTab =
      document.querySelector(".profile-tab.active")?.getAttribute("data-tab") ||
      document.querySelector(".profile-tab")?.getAttribute("data-tab");

    if (initialTab) {
      openTab(initialTab);
    }
    try {
      db = await getScreenings4uSupabase();
      await loadProfile();
    } catch (error) {
      console.error("Employer profile load failed:", error);
      show("Unable to Load Profile", error?.message || "The company profile could not be loaded.");
    }
  }

  function bind() {
    document.querySelectorAll(".profile-tab").forEach((button) => {
      button.setAttribute("type", "button");

      button.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopPropagation();

        const tab = button.getAttribute("data-tab");
        if (tab) {
          openTab(tab);
        }
      });
    });

    document.getElementById("employer-profile-form")?.addEventListener("submit", saveProfile);
    document.getElementById("profile-save-top")?.addEventListener("click", saveProfile);
    document.getElementById("profile-reset")?.addEventListener("click", resetProfile);
    document.getElementById("same-as-company")?.addEventListener("change", copyCompanyAddress);
    document.getElementById("profile-modal-close")?.addEventListener("click", closeModal);
    document.querySelector("#profile-modal .profile-modal-backdrop")?.addEventListener("click", closeModal);

    document.getElementById("add-contact")?.addEventListener("click", () => {
      window.location.href = "employer-users.html";
    });

    document.getElementById("manage-members")?.addEventListener("click", () => {
      window.location.href = "employer-users.html";
    });
  }

  function openTab(tab) {
    if (!tab) return;

    document.querySelectorAll(".profile-tab").forEach((button) => {
      const isActive = button.getAttribute("data-tab") === tab;
      button.classList.toggle("active", isActive);
      button.setAttribute("aria-selected", isActive ? "true" : "false");
    });

    document.querySelectorAll(".profile-panel").forEach((panel) => {
      const isActive = panel.getAttribute("data-panel") === tab;
      panel.classList.toggle("active", isActive);
      panel.hidden = !isActive;
    });
  }

  async function call(body) {
    const { data, error } = await db.functions.invoke("employer-profile-actions", { body });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data;
  }

  async function loadProfile() {
    const data = await call({ action: "get" });
    const profile = data.profile || {};
    const billing = data.billing || {};
    const billingMeta = billing.metadata || {};
    const employerMeta = profile.metadata || {};
    const prefs = employerMeta.account_preferences || {};
    const primary = data.primary_contact || {};
    const user = primary.user_profile || {};

    primaryUserId = primary.user_id || null;
    canWrite = data.canWrite === true;

    writeForm({
      "legal-name": profile.legal_name || "",
      "dba-name": employerMeta.dba_name || profile.employer_name || "",
      "industry": profile.industry || "",
      "company-phone": profile.phone || "",
      "company-email": profile.email || "",
      "company-website": profile.website || "",
      "business-address": profile.address_line_1 || "",
      "business-city": profile.city || "",
      "business-state": profile.state || "",
      "business-zip": profile.postal_code || "",
      "business-country": profile.country || "United States",

      "contact-first-name": user.first_name || "",
      "contact-last-name": user.last_name || "",
      "primary-email": user.email || "",
      "primary-phone": user.phone || "",
      "primary-title": primary.title || "",
      "contact-method": employerMeta.preferred_contact_method || "email",

      "same-as-company": billingMeta.same_as_company === true,
      "billing-address": billingMeta.address_line_1 || "",
      "billing-city": billingMeta.city || "",
      "billing-state": billingMeta.state || "",
      "billing-zip": billingMeta.postal_code || "",
      "billing-country": billingMeta.country || "United States",
      "billing-contact-name": billing.billing_name || "",
      "billing-email": billing.billing_email || profile.billing_email || "",

      "pref-orders": prefs.orders !== false,
      "pref-invoices": prefs.invoices !== false,
      "pref-training": prefs.training !== false
    });

    renderContacts(data.members || [], primaryUserId);

    initialData = readForm();
    setWritable(canWrite);
  }

  function renderContacts(members, primaryId) {
    const target = document.getElementById("additional-contacts");
    if (!target) return;

    const extra = members.filter((m) => m.user_id !== primaryId && m.status === "active");
    if (!extra.length) {
      target.textContent = "No additional contacts have been added.";
      return;
    }

    target.innerHTML = extra.map((m) => {
      const p = m.user_profile || {};
      const name = p.display_name || [p.first_name, p.last_name].filter(Boolean).join(" ") || p.email || "Employer Member";
      return `<div class="additional-contact-row"><strong>${esc(name)}</strong><span>${esc(m.title || m.department || "")}</span><small>${esc(p.email || "")}</small></div>`;
    }).join("");
  }

  function setWritable(enabled) {
    document.querySelectorAll("#employer-profile-form input,#employer-profile-form select").forEach((el) => {
      el.disabled = !enabled;
    });
    ["profile-save-top", "profile-reset"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.disabled = !enabled;
    });
    const submit = document.querySelector('#employer-profile-form button[type="submit"]');
    if (submit) submit.disabled = !enabled;
  }

  function readForm() {
    const data = {};
    document.querySelectorAll("#employer-profile-form input,#employer-profile-form select").forEach((el) => {
      data[el.id] = el.type === "checkbox" ? el.checked : el.value;
    });
    return data;
  }

  function writeForm(data) {
    Object.keys(data || {}).forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      if (el.type === "checkbox") el.checked = !!data[id];
      else el.value = data[id] ?? "";
    });
  }

  function copyCompanyAddress() {
    if (!document.getElementById("same-as-company")?.checked) return;
    [
      ["business-address", "billing-address"],
      ["business-city", "billing-city"],
      ["business-state", "billing-state"],
      ["business-zip", "billing-zip"],
      ["business-country", "billing-country"]
    ].forEach(([from, to]) => {
      document.getElementById(to).value = document.getElementById(from).value;
    });
  }

  async function saveProfile(event) {
    if (event?.preventDefault) event.preventDefault();
    if (!canWrite) {
      show("Read Only", "Your employer role does not allow company profile changes.");
      return;
    }

    const d = readForm();
    if (!String(d["legal-name"] || "").trim()) {
      show("Legal Name Required", "Enter the legal business name before saving.");
      openTab("company");
      document.getElementById("legal-name")?.focus();
      return;
    }

    if (d["same-as-company"]) copyCompanyAddress();
    const current = readForm();

    const buttons = [
      document.getElementById("profile-save-top"),
      document.querySelector('#employer-profile-form button[type="submit"]')
    ].filter(Boolean);
    buttons.forEach((b) => { b.disabled = true; });

    try {
      await call({
        action: "save",
        company: {
          legal_name: current["legal-name"],
          dba_name: current["dba-name"],
          industry: current["industry"],
          phone: current["company-phone"],
          email: current["company-email"],
          website: current["company-website"],
          address_line_1: current["business-address"],
          city: current["business-city"],
          state: current["business-state"],
          postal_code: current["business-zip"],
          country: current["business-country"]
        },
        primary_contact: {
          user_id: primaryUserId,
          first_name: current["contact-first-name"],
          last_name: current["contact-last-name"],
          email: current["primary-email"],
          phone: current["primary-phone"],
          title: current["primary-title"]
        },
        billing: {
          same_as_company: current["same-as-company"],
          address_line_1: current["billing-address"],
          city: current["billing-city"],
          state: current["billing-state"],
          postal_code: current["billing-zip"],
          country: current["billing-country"],
          billing_name: current["billing-contact-name"],
          billing_email: current["billing-email"]
        },
        preferences: {
          orders: current["pref-orders"],
          invoices: current["pref-invoices"],
          training: current["pref-training"]
        }
      });

      await loadProfile();
      show("Profile Updated", "Your employer company profile has been saved.");
    } catch (error) {
      console.error("Employer profile save failed:", error);
      show("Unable to Save Profile", error?.message || "The company profile could not be saved.");
    } finally {
      buttons.forEach((b) => { b.disabled = !canWrite; });
    }
  }

  function resetProfile() {
    writeForm(initialData);
    show("Changes Discarded", "The form has been restored to the last saved values.");
  }

  function show(title, message) {
    document.getElementById("profile-modal-title").textContent = title;
    document.getElementById("profile-modal-message").textContent = message;
    document.getElementById("profile-modal").hidden = false;
  }

  function closeModal() {
    document.getElementById("profile-modal").hidden = true;
  }

  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
  }
})();