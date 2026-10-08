(() => {
  "use strict";

  let client = null;
  let employers = [];

  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    bindUi();

    client = getClient();

    if (!client) {
      showError("Supabase client was not found.");
      return;
    }

    try {
      await requireAdmin();
      await loadEmployers();
    } catch (error) {
      console.error("Employers initialization failed:", error);
      showError(error.message || "Unable to load employers.");
    }
  }

  function getClient() {
    try {
      if (typeof window.getScreenings4uSupabase === "function") {
        return window.getScreenings4uSupabase();
      }

      if (window.screenings4uSupabase?.from) {
        return window.screenings4uSupabase;
      }

      if (window.supabaseClient?.from) {
        return window.supabaseClient;
      }
    } catch (error) {
      console.error(error);
    }

    return null;
  }

  async function requireAdmin() {
    if (!window.S4UAuth?.getSession) return;

    const session = await window.S4UAuth.getSession();

    if (!session?.user) {
      window.location.replace("admin-login.html");
      throw new Error("Authentication required.");
    }

    const { data, error } = await client
      .from("user_role_assignments")
      .select("role")
      .eq("user_id", session.user.id);

    if (error) throw error;

    const allowed = (data || []).some((row) =>
      ["admin", "super_admin"].includes(
        String(row.role || "").toLowerCase()
      )
    );

    if (!allowed) {
      await client.auth.signOut();
      window.location.replace("admin-login.html");

      throw new Error(
        "This account does not have access to the admin portal."
      );
    }
  }

  function bindUi() {
    document
      .getElementById("employerSearch")
      ?.addEventListener("input", renderEmployers);

    document
      .getElementById("employerStatusFilter")
      ?.addEventListener("change", renderEmployers);

    document
      .getElementById("refreshEmployersButton")
      ?.addEventListener("click", loadEmployers);

    document
      .getElementById("addEmployerButton")
      ?.addEventListener("click", openAddEmployer);

    document
      .getElementById("sidebarToggle")
      ?.addEventListener("click", () => {
        document
          .getElementById("adminSidebar")
          ?.classList.toggle("collapsed");
      });

    document.querySelectorAll(".nav-group-toggle").forEach((button) => {
      button.addEventListener("click", () => {
        button.parentElement.classList.toggle("open");
      });
    });

    document
      .getElementById("accountMenuButton")
      ?.addEventListener("click", () => {
        document
          .getElementById("accountMenu")
          ?.classList.toggle("show");
      });

    document
      .getElementById("signOutButton")
      ?.addEventListener("click", async () => {
        await client?.auth.signOut();
        window.location.replace("admin-login.html");
      });

    /*
      Event delegation means Edit works immediately
      for every newly rendered table row.
    */
    document.addEventListener("click", handleDocumentClick);
  }

  function handleDocumentClick(event) {
    const editButton = event.target.closest("[data-edit-employer]");

    if (editButton) {
      event.preventDefault();

      const id = editButton.dataset.editEmployer;
      openEditEmployer(id);
      return;
    }
  }

  async function loadEmployers() {
    setLoading(true);

    try {
      const { data, error } = await client
        .from("employer_profiles")
        .select("*")
        .order("employer_name", {
          ascending: true
        });

      if (error) throw error;

      employers = Array.isArray(data) ? data : [];

      updateMetrics();
      renderEmployers();
    } finally {
      setLoading(false);
    }
  }

  function updateMetrics() {
    const total = employers.length;

    const active = employers.filter(
      (x) => String(x.status || "").toLowerCase() === "active"
    ).length;

    const inactive = employers.filter(
      (x) => String(x.status || "").toLowerCase() === "inactive"
    ).length;

    const dot = employers.filter(
      (x) => Boolean(x.dot_number || x.dot_agency)
    ).length;

    metric("total", total);
    metric("active", active);
    metric("inactive", inactive);
    metric("dot", dot);
  }

  function metric(name, value) {
    const el = document.querySelector(
      `[data-employer-metric="${name}"]`
    );

    if (el) {
      el.textContent = Number(value).toLocaleString();
    }
  }

  function filteredEmployers() {
    const term = (
      document.getElementById("employerSearch")?.value || ""
    )
      .trim()
      .toLowerCase();

    const status =
      document.getElementById("employerStatusFilter")?.value ||
      "all";

    return employers.filter((e) => {
      const haystack = [
        e.employer_name,
        e.legal_name,
        e.email,
        e.dot_number,
        e.city,
        e.state,
        e.industry
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch =
        !term || haystack.includes(term);

      const matchesStatus =
        status === "all" ||
        String(e.status || "").toLowerCase() === status;

      return matchesSearch && matchesStatus;
    });
  }

  function renderEmployers() {
    const body = document.getElementById(
      "employersTableBody"
    );

    if (!body) return;

    const rows = filteredEmployers();

    const resultsCount = document.getElementById(
      "employerResultsCount"
    );

    if (resultsCount) {
      resultsCount.textContent =
        `${rows.length} employer${rows.length === 1 ? "" : "s"}`;
    }

    if (!rows.length) {
      body.innerHTML = `
        <tr>
          <td colspan="7" class="empty-row">
            No employers found.
          </td>
        </tr>
      `;

      return;
    }

    body.innerHTML = rows
      .map(
        (e) => `
          <tr>
            <td>
              <strong>
                ${esc(
                  e.employer_name ||
                    "Unnamed Employer"
                )}
              </strong>

              <small>
                ${esc(e.legal_name || "")}
              </small>
            </td>

            <td>
              ${esc(e.email || "—")}

              <small>
                ${esc(e.phone || "")}
              </small>
            </td>

            <td>
              ${esc(
                [e.city, e.state]
                  .filter(Boolean)
                  .join(", ") || "—"
              )}
            </td>

            <td>
              ${esc(e.industry || "—")}
            </td>

            <td>
              ${esc(e.dot_number || "—")}
            </td>

            <td>
              <span class="status ${esc(
                String(
                  e.status || "inactive"
                ).toLowerCase()
              )}">
                ${esc(e.status || "inactive")}
              </span>
            </td>

            <td>
              <button
                class="row-action"
                data-edit-employer="${esc(e.id)}"
                type="button"
              >
                Edit
              </button>
            </td>
          </tr>
        `
      )
      .join("");
  }

  function employerFields(employer = {}) {
    return [
      {
        name: "employer_name",
        label: "Employer Name",
        value: employer.employer_name || "",
        required: true
      },

      {
        name: "legal_name",
        label: "Legal Name",
        value: employer.legal_name || ""
      },

      {
        name: "status",
        label: "Status",
        type: "select",
        value: employer.status || "active",
        options: [
          {
            value: "active",
            label: "Active"
          },
          {
            value: "inactive",
            label: "Inactive"
          }
        ]
      },

      {
        name: "email",
        label: "Email",
        type: "email",
        value: employer.email || ""
      },

      {
        name: "phone",
        label: "Phone",
        value: employer.phone || ""
      },

      {
        name: "website",
        label: "Website",
        value: employer.website || ""
      },

      {
        name: "address_line_1",
        label: "Address",
        value: employer.address_line_1 || ""
      },

      {
        name: "city",
        label: "City",
        value: employer.city || ""
      },

      {
        name: "state",
        label: "State",
        value: employer.state || ""
      },

      {
        name: "postal_code",
        label: "Postal Code",
        value: employer.postal_code || ""
      },

      {
        name: "industry",
        label: "Industry",
        value: employer.industry || ""
      },

      {
        name: "dot_number",
        label: "DOT Number",
        value: employer.dot_number || ""
      },

      {
        name: "mc_number",
        label: "MC Number",
        value: employer.mc_number || ""
      }
    ];
  }

  function openAddEmployer() {
    openEmployerModal({
      title: "Add Employer",
      message: "Create a new employer organization.",
      fields: employerFields(),
      confirmText: "Create Employer",

      onSubmit: async (values) => {
        const payload = clean(values);

        const { error } = await client
          .from("employer_profiles")
          .insert(payload);

        if (error) throw error;

        await loadEmployers();

        showToast(
          "Employer created successfully.",
          "success"
        );
      }
    });
  }

  function openEditEmployer(id) {
    const employer = employers.find(
      (e) => String(e.id) === String(id)
    );

    if (!employer) {
      console.error(
        "Employer was not found:",
        id
      );

      return;
    }

    openEmployerModal({
      title: "Edit Employer",
      message: "Update employer information.",
      fields: employerFields(employer),
      confirmText: "Save Changes",

      onSubmit: async (values) => {
        const { error } = await client
          .from("employer_profiles")
          .update(clean(values))
          .eq("id", employer.id);

        if (error) throw error;

        await loadEmployers();

        showToast(
          "Employer updated successfully.",
          "success"
        );
      }
    });
  }

  /*
    CUSTOM MODAL

    This does not depend on S4UUI.formModal,
    so the form layout and footer buttons are
    controlled directly by this page.
  */
  function openEmployerModal({
    title,
    message,
    fields,
    confirmText,
    onSubmit
  }) {
    closeEmployerModal();

    const overlay = document.createElement("div");

    overlay.id = "employerModalOverlay";

    overlay.className =
      "employer-modal-overlay";

    overlay.innerHTML = `
      <div
        class="employer-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="employerModalTitle"
      >

        <div class="employer-modal-header">
          <div>
            <h2 id="employerModalTitle">
              ${esc(title)}
            </h2>

            <p>
              ${esc(message)}
            </p>
          </div>

          <button
            type="button"
            class="employer-modal-close"
            data-close-employer-modal
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <form
          id="employerModalForm"
          class="employer-modal-form"
        >

          <div class="employer-form-grid">
            ${fields
              .map((field) =>
                renderField(field)
              )
              .join("")}
          </div>

          <div class="employer-modal-footer">
            <button
              type="button"
              class="employer-modal-cancel"
              data-close-employer-modal
            >
              Cancel
            </button>

            <button
              type="submit"
              class="employer-modal-save"
              id="employerModalSubmit"
            >
              ${esc(confirmText)}
            </button>
          </div>

        </form>

      </div>
    `;

    document.body.appendChild(overlay);

    overlay
      .querySelectorAll(
        "[data-close-employer-modal]"
      )
      .forEach((button) => {
        button.addEventListener(
          "click",
          closeEmployerModal
        );
      });

    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) {
        closeEmployerModal();
      }
    });

    const form = overlay.querySelector(
      "#employerModalForm"
    );

    form.addEventListener(
      "submit",
      async (event) => {
        event.preventDefault();

        const submitButton =
          form.querySelector(
            "#employerModalSubmit"
          );

        const values = {};

        fields.forEach((field) => {
          const input = form.elements[
            field.name
          ];

          values[field.name] =
            input?.value ?? "";
        });

        if (submitButton) {
          submitButton.disabled = true;
          submitButton.textContent = "Saving...";
        }

        try {
          await onSubmit(values);

          closeEmployerModal();
        } catch (error) {
          console.error(
            "Employer save failed:",
            error
          );

          alert(
            error.message ||
              "Unable to save employer."
          );

          if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent =
              confirmText;
          }
        }
      }
    );

    requestAnimationFrame(() => {
      overlay.classList.add("show");

      const firstInput =
        overlay.querySelector(
          "input, select, textarea"
        );

      firstInput?.focus();
    });
  }

  function renderField(field) {
    const required = field.required
      ? "required"
      : "";

    if (field.type === "select") {
      return `
        <div class="employer-form-field">
          <label for="field-${esc(field.name)}">
            ${esc(field.label)}
          </label>

          <select
            id="field-${esc(field.name)}"
            name="${esc(field.name)}"
            ${required}
          >
            ${(field.options || [])
              .map(
                (option) => `
                  <option
                    value="${esc(option.value)}"
                    ${
                      String(option.value) ===
                      String(field.value)
                        ? "selected"
                        : ""
                    }
                  >
                    ${esc(option.label)}
                  </option>
                `
              )
              .join("")}
          </select>
        </div>
      `;
    }

    return `
      <div class="employer-form-field">
        <label for="field-${esc(field.name)}">
          ${esc(field.label)}
        </label>

        <input
          id="field-${esc(field.name)}"
          name="${esc(field.name)}"
          type="${esc(field.type || "text")}"
          value="${esc(field.value || "")}"
          ${required}
        >
      </div>
    `;
  }

  function closeEmployerModal() {
    const overlay = document.getElementById(
      "employerModalOverlay"
    );

    if (!overlay) return;

    overlay.classList.remove("show");

    setTimeout(() => {
      overlay.remove();
    }, 150);
  }

  function clean(values) {
    const output = {};

    Object.entries(values).forEach(
      ([key, value]) => {
        output[key] =
          typeof value === "string"
            ? value.trim() || null
            : value;
      }
    );

    return output;
  }

  function setLoading(loading) {
    const button = document.getElementById(
      "refreshEmployersButton"
    );

    if (button) {
      button.disabled = loading;
      button.textContent = loading
        ? "Loading..."
        : "Refresh";
    }
  }

  function showError(message) {
    const body = document.getElementById(
      "employersTableBody"
    );

    if (body) {
      body.innerHTML = `
        <tr>
          <td colspan="7" class="empty-row">
            ${esc(message)}
          </td>
        </tr>
      `;
    }

    console.error(message);
  }

  function showToast(message, type = "success") {
    if (window.S4UUI?.toast) {
      window.S4UUI.toast(message, type);
      return;
    }

    console.log(`[${type}]`, message);
  }

  function esc(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
})();