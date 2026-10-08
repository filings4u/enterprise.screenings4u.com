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
   SCREENINGS4U — EMPLOYER EMPLOYEES
   employer-employees.js

   Ready for Supabase wiring.

   Primary tables already identified:
   - employer_profiles
   - employer_members
   - employer_employees
   - lms_enrollments
   ============================================================ */

(function () {
  "use strict";

  const state = {
    employees: [],
    filteredEmployees: [],
    selectedEmployeeId: null,
    canWrite: true
  };


  document.addEventListener(
    "DOMContentLoaded",
    initializeEmployerEmployees
  );


  async function initializeEmployerEmployees() {
    bindControls();
    await loadEmployees();
  }


  function bindControls() {
    const search =
      document.getElementById(
        "employee-search"
      );

    const statusFilter =
      document.getElementById(
        "employee-status-filter"
      );

    const trainingFilter =
      document.getElementById(
        "employee-training-filter"
      );

    const addButton =
      document.getElementById(
        "employer-add-employee-btn"
      );

    const form =
      document.getElementById(
        "employee-form"
      );


    if (search) {
      search.addEventListener(
        "input",
        applyFilters
      );
    }


    if (statusFilter) {
      statusFilter.addEventListener(
        "change",
        applyFilters
      );
    }


    if (trainingFilter) {
      trainingFilter.addEventListener(
        "change",
        applyFilters
      );
    }


    if (addButton) {
      addButton.addEventListener(
        "click",
        function () {
          openEmployeeModal();
        }
      );
    }


    if (form) {
      form.addEventListener(
        "submit",
        handleEmployeeSave
      );
    }


    bindModalControls();
  }


  function bindModalControls() {
    bindClick(
      "employee-modal-close",
      closeEmployeeModal
    );

    bindClick(
      "employee-modal-cancel",
      closeEmployeeModal
    );

    bindClick(
      "employee-modal-backdrop",
      closeEmployeeModal
    );

    bindClick(
      "employee-details-close",
      closeEmployeeDetails
    );

    bindClick(
      "employee-details-done",
      closeEmployeeDetails
    );

    bindClick(
      "employee-details-backdrop",
      closeEmployeeDetails
    );

    bindClick(
      "employee-details-edit",
      editSelectedEmployee
    );
  }


  async function loadEmployees() {
    const body = document.getElementById("employee-table-body");

    try {
      if (body) {
        body.innerHTML =
          '<tr><td colspan="6"><div class="employer-table-empty">Loading employees…</div></td></tr>';
      }

      const db = await getScreenings4uSupabase();
      const {
        data: { session },
        error: sessionError
      } = await db.auth.getSession();

      if (sessionError) throw sessionError;
      if (!session?.access_token) {
        throw new Error("Your login session expired. Please sign in again.");
      }

      const { data, error } = await db.functions.invoke(
        "employer-employee-actions",
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`
          },
          body: { action: "list" }
        }
      );

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      state.employees = Array.isArray(data?.employees)
        ? data.employees
        : [];

      state.canWrite = data?.canWrite !== false;

      const addButton = document.getElementById("employer-add-employee-btn");
      if (addButton && !state.canWrite) {
        addButton.hidden = true;
      }

      updateMetrics();
      applyFilters();
    } catch (error) {
      console.error("[Employer Employees Load]", error);
      state.employees = [];
      updateMetrics();
      applyFilters();

      if (body) {
        body.innerHTML =
          '<tr><td colspan="6"><div class="employer-table-empty">' +
          escapeHtml(error?.message || "Unable to load employees.") +
          "</div></td></tr>";
      }
    }
  }

  function applyFilters() {
    const searchTerm =
      getValue(
        "employee-search"
      ).toLowerCase();

    const status =
      getValue(
        "employee-status-filter"
      ) || "all";

    const training =
      getValue(
        "employee-training-filter"
      ) || "all";


    state.filteredEmployees =
      state.employees.filter(
        function (employee) {

          const name =
            (
              String(
                employee.first_name || ""
              ) +
              " " +
              String(
                employee.last_name || ""
              )
            ).toLowerCase();

          const email =
            String(
              employee.email || ""
            ).toLowerCase();


          const matchesSearch =
            !searchTerm ||
            name.includes(searchTerm) ||
            email.includes(searchTerm);


          const matchesStatus =
            status === "all" ||
            String(
              employee.status || employee.employment_status || "active"
            ).toLowerCase() === status;


          const hasTraining =
            Number(
              employee.training_count || 0
            ) > 0;


          const matchesTraining =
            training === "all" ||
            (
              training === "assigned" &&
              hasTraining
            ) ||
            (
              training === "none" &&
              !hasTraining
            );


          return (
            matchesSearch &&
            matchesStatus &&
            matchesTraining
          );
        }
      );


    renderEmployees();
    updateResultCount();
  }


  function renderEmployees() {
    const body =
      document.getElementById(
        "employee-table-body"
      );


    if (!body) {
      return;
    }


    if (
      state.filteredEmployees.length === 0
    ) {
      body.innerHTML =
        '<tr><td colspan="6">' +
        '<div class="employer-table-empty">' +
        (
          state.employees.length === 0
            ? "Employee records will appear here once connected to your organization."
            : "No employees match your current filters."
        ) +
        "</div></td></tr>";

      return;
    }


    body.innerHTML =
      state.filteredEmployees
        .map(
          function (employee) {

            const fullName =
              getEmployeeName(employee);

            const initials =
              getInitials(employee);

            const status =
              String(
                employee.status || employee.employment_status || "active"
              ).toLowerCase();

            const trainingCount =
              Number(
                employee.training_count || 0
              );


            return `
              <tr>
                <td>
                  <div class="employer-table-employee">
                    <div class="employer-table-avatar">
                      ${escapeHtml(initials)}
                    </div>

                    <div>
                      <strong>
                        ${escapeHtml(fullName)}
                      </strong>

                      <span>
                        ${escapeHtml(
                          employee.employee_number ||
                          "Employee"
                        )}
                      </span>
                    </div>
                  </div>
                </td>

                <td>
                  ${escapeHtml(
                    employee.email || "—"
                  )}
                </td>

                <td>
                  <span class="employer-status-badge ${
                    status === "active"
                      ? "employer-status-active"
                      : "employer-status-inactive"
                  }">
                    ${escapeHtml(
                      capitalize(status)
                    )}
                  </span>
                </td>

                <td>
                  <span class="employer-training-label">
                    ${
                      trainingCount > 0
                        ? trainingCount + " assigned"
                        : "No training"
                    }
                  </span>
                </td>

                <td>
                  ${escapeHtml(
                    formatDate(
                      employee.created_at
                    )
                  )}
                </td>

                <td>
                  <div class="employer-row-actions">
                    <button
                      type="button"
                      class="employer-row-action"
                      data-action="view"
                      data-id="${escapeAttribute(employee.id)}"
                    >
                      View
                    </button>

                    <button
                      type="button"
                      class="employer-row-action"
                      data-action="edit"
                      data-id="${escapeAttribute(employee.id)}"
                    >
                      Edit
                    </button>
                  </div>
                </td>
              </tr>
            `;
          }
        )
        .join("");


    body
      .querySelectorAll(
        "[data-action]"
      )
      .forEach(
        function (button) {
          button.addEventListener(
            "click",
            handleRowAction
          );
        }
      );
  }


  function handleRowAction(event) {
    const button =
      event.currentTarget;

    const employeeId =
      button.dataset.id;

    const action =
      button.dataset.action;


    if (action === "view") {
      openEmployeeDetails(
        employeeId
      );
    }


    if (action === "edit") {
      openEmployeeModal(
        employeeId
      );
    }
  }


  function openEmployeeModal(employeeId) {
    const modal =
      document.getElementById(
        "employee-modal"
      );

    const title =
      document.getElementById(
        "employee-modal-title"
      );

    const form =
      document.getElementById(
        "employee-form"
      );


    if (!modal || !form) {
      return;
    }


    form.reset();

    setValue(
      "employee-id",
      ""
    );


    if (employeeId) {
      const employee =
        findEmployee(
          employeeId
        );

      if (employee) {
        if (title) {
          title.textContent =
            "Edit Employee";
        }

        populateEmployeeForm(
          employee
        );
      }
    } else {
      if (title) {
        title.textContent =
          "Add Employee";
      }
    }


    modal.hidden = false;
  }


  function closeEmployeeModal() {
    const modal =
      document.getElementById(
        "employee-modal"
      );

    if (modal) {
      modal.hidden = true;
    }
  }


  async function handleEmployeeSave(event) {
    event.preventDefault();

    const saveButton = event.currentTarget.querySelector(
      ".employer-modal-save-btn"
    );

    const employeeData = {
      id: getValue("employee-id") || null,
      first_name: getValue("employee-first-name"),
      last_name: getValue("employee-last-name"),
      email: getValue("employee-email"),
      phone: getValue("employee-phone"),
      status: getValue("employee-status") || "active"
    };

    if (!employeeData.first_name || !employeeData.last_name || !employeeData.email) {
      window.S4UEmployerPopup.warning("First name, last name, and email are required.", { title: "Missing Employee Information" });
      return;
    }

    try {
      if (saveButton) {
        saveButton.disabled = true;
        saveButton.textContent = employeeData.id
          ? "Saving…"
          : "Adding…";
      }

      const db = await getScreenings4uSupabase();
      const {
        data: { session },
        error: sessionError
      } = await db.auth.getSession();

      if (sessionError) throw sessionError;
      if (!session?.access_token) {
        throw new Error("Your login session expired. Please sign in again.");
      }

      const { data, error } = await db.functions.invoke(
        "employer-employee-actions",
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`
          },
          body: {
            action: "save",
            ...employeeData
          }
        }
      );

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      closeEmployeeModal();
      await loadEmployees();
    } catch (error) {
      console.error("[Employer Employee Save]", error);
      window.S4UEmployerPopup.error(
        error?.message || "Unable to save employee.",
        { title: "Employee Could Not Be Saved" }
      );
    } finally {
      if (saveButton) {
        saveButton.disabled = false;
        saveButton.textContent = "Save Employee";
      }
    }
  }

  function openEmployeeDetails(employeeId) {
    const employee =
      findEmployee(
        employeeId
      );


    if (!employee) {
      return;
    }


    state.selectedEmployeeId =
      employeeId;


    setText(
      "employee-details-name",
      getEmployeeName(employee)
    );

    setText(
      "employee-details-email",
      employee.email || "—"
    );

    setText(
      "employee-details-status",
      capitalize(
        employee.status || employee.employment_status || "active"
      )
    );

    setText(
      "employee-details-phone",
      employee.phone || "—"
    );

    setText(
      "employee-details-training",
      Number(
        employee.training_count || 0
      ) > 0
        ? employee.training_count +
          " assigned"
        : "No training assigned"
    );

    setText(
      "employee-details-added",
      formatDate(
        employee.created_at
      )
    );


    const modal =
      document.getElementById(
        "employee-details-modal"
      );

    if (modal) {
      modal.hidden = false;
    }
  }


  function closeEmployeeDetails() {
    const modal =
      document.getElementById(
        "employee-details-modal"
      );

    if (modal) {
      modal.hidden = true;
    }
  }


  function editSelectedEmployee() {
    const employeeId =
      state.selectedEmployeeId;


    closeEmployeeDetails();


    if (employeeId) {
      openEmployeeModal(
        employeeId
      );
    }
  }


  function populateEmployeeForm(employee) {
    setValue(
      "employee-id",
      employee.id || ""
    );

    setValue(
      "employee-first-name",
      employee.first_name || ""
    );

    setValue(
      "employee-last-name",
      employee.last_name || ""
    );

    setValue(
      "employee-email",
      employee.email || ""
    );

    setValue(
      "employee-phone",
      employee.phone || ""
    );

    setValue(
      "employee-status",
      employee.status || employee.employment_status || "active"
    );
  }


  function updateMetrics() {
    const total =
      state.employees.length;

    const active =
      state.employees.filter(
        function (employee) {
          return (
            String(
              employee.status || employee.employment_status || "active"
            ).toLowerCase() ===
            "active"
          );
        }
      ).length;

    const training =
      state.employees.filter(
        function (employee) {
          return (
            Number(
              employee.training_count || 0
            ) > 0
          );
        }
      ).length;

    const attention =
      state.employees.filter(
        function (employee) {
          return Boolean(
            employee.needs_attention
          );
        }
      ).length;


    setText(
      "employee-total-count",
      total
    );

    setText(
      "employee-active-count",
      active
    );

    setText(
      "employee-training-count",
      training
    );

    setText(
      "employee-attention-count",
      attention
    );
  }


  function updateResultCount() {
    const element =
      document.getElementById(
        "employee-results-count"
      );

    if (!element) {
      return;
    }


    const count =
      state.filteredEmployees.length;


    element.textContent =
      count +
      " employee" +
      (count === 1 ? "" : "s");
  }


  function findEmployee(employeeId) {
    return state.employees.find(
      function (employee) {
        return String(
          employee.id
        ) === String(
          employeeId
        );
      }
    );
  }


  function getEmployeeName(employee) {
    const name =
      [
        employee.first_name,
        employee.last_name
      ]
        .filter(Boolean)
        .join(" ")
        .trim();


    return name ||
      employee.email ||
      "Employee";
  }


  function getInitials(employee) {
    const initials =
      [
        employee.first_name,
        employee.last_name
      ]
        .filter(Boolean)
        .map(
          function (value) {
            return String(value)
              .trim()
              .charAt(0)
              .toUpperCase();
          }
        )
        .join("");


    return initials || "EM";
  }


  function formatDate(value) {
    if (!value) {
      return "—";
    }


    const date =
      new Date(value);


    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return "—";
    }


    return new Intl.DateTimeFormat(
      "en-US",
      {
        month: "short",
        day: "numeric",
        year: "numeric"
      }
    ).format(date);
  }


  function capitalize(value) {
    const text =
      String(value || "");


    return (
      text.charAt(0).toUpperCase() +
      text.slice(1)
    );
  }


  function bindClick(id, handler) {
    const element =
      document.getElementById(id);

    if (element) {
      element.addEventListener(
        "click",
        handler
      );
    }
  }


  function getValue(id) {
    const element =
      document.getElementById(id);

    return element
      ? String(
          element.value || ""
        ).trim()
      : "";
  }


  function setValue(id, value) {
    const element =
      document.getElementById(id);

    if (element) {
      element.value =
        value == null
          ? ""
          : value;
    }
  }


  function setText(id, value) {
    const element =
      document.getElementById(id);

    if (element) {
      element.textContent =
        value == null
          ? ""
          : value;
    }
  }


  function escapeHtml(value) {
    return String(
      value == null
        ? ""
        : value
    )
      .replace(
        /&/g,
        "&amp;"
      )
      .replace(
        /</g,
        "&lt;"
      )
      .replace(
        />/g,
        "&gt;"
      )
      .replace(
        /"/g,
        "&quot;"
      )
      .replace(
        /'/g,
        "&#039;"
      );
  }


  function escapeAttribute(value) {
    return escapeHtml(value);
  }

})();
