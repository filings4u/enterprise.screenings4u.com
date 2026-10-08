/* ============================================================
   screenings4u — ADMIN EMPLOYEES

   Workforce management.

   Confirmed tables:
   - employer_employees
   - employer_profiles

   Important:
   This page loads employees and employers separately instead of
   relying on a PostgREST embedded relationship. That avoids the
   schema-cache relationship problem encountered on Employer Users.
   ============================================================ */

(() => {
    "use strict";


    /* ========================================================
       STATE
       ======================================================== */

    let client = null;

    let employees = [];
    let employers = [];
    let employerNameMap = new Map();


    /* ========================================================
       INITIALIZATION
       ======================================================== */

    document.addEventListener(
        "DOMContentLoaded",
        initializeEmployees
    );


    async function initializeEmployees() {

        bindUi();

        client = getClient();

        if (!client) {
            showError("Supabase client was not found.");
            return;
        }

        try {

            await requireAdmin();

            await loadPageData();

        } catch (error) {

            console.error(
                "Employees initialization failed:",
                error
            );

            showError(
                error?.message ||
                "Unable to load employees."
            );

        }

    }


    /* ========================================================
       SUPABASE CLIENT
       ======================================================== */

    function getClient() {

        if (
            typeof window.getScreenings4uSupabase ===
            "function"
        ) {
            return window.getScreenings4uSupabase();
        }

        if (window.screenings4uSupabase?.from) {
            return window.screenings4uSupabase;
        }

        if (window.supabaseClient?.from) {
            return window.supabaseClient;
        }

        return null;

    }


    /* ========================================================
       ADMIN AUTHORIZATION
       ======================================================== */

    async function requireAdmin() {

        if (!window.S4UAuth?.getSession) {
            return;
        }

        const session =
            await window.S4UAuth.getSession();

        if (!session?.user) {

            window.location.replace(
                "admin-login.html"
            );

            throw new Error(
                "Authentication required."
            );

        }


        const { data, error } =
            await client
                .from("user_role_assignments")
                .select("role")
                .eq(
                    "user_id",
                    session.user.id
                );

        if (error) {
            throw error;
        }


        const allowed =
            (data || []).some(row => {

                const role =
                    String(row.role || "")
                        .trim()
                        .toLowerCase();

                return (
                    role === "admin" ||
                    role === "super_admin"
                );

            });


        if (!allowed) {

            await client.auth.signOut();

            window.location.replace(
                "admin-login.html"
            );

            throw new Error(
                "This account does not have access to the admin portal."
            );

        }

    }


    /* ========================================================
       UI EVENTS
       ======================================================== */

    function bindUi() {

        document
            .getElementById("employeeSearch")
            ?.addEventListener(
                "input",
                renderEmployees
            );


        document
            .getElementById("employeeEmployerFilter")
            ?.addEventListener(
                "change",
                renderEmployees
            );


        document
            .getElementById("employeeStatusFilter")
            ?.addEventListener(
                "change",
                renderEmployees
            );


        document
            .getElementById("employeeDotFilter")
            ?.addEventListener(
                "change",
                renderEmployees
            );


        document
            .getElementById("refreshEmployeesButton")
            ?.addEventListener(
                "click",
                loadPageData
            );


        document
            .getElementById("addEmployeeButton")
            ?.addEventListener(
                "click",
                openAddEmployee
            );


        document
            .getElementById("employeesTableBody")
            ?.addEventListener(
                "click",
                event => {

                    const button =
                        event.target.closest(
                            "[data-edit-employee]"
                        );

                    if (!button) return;

                    openEditEmployee(
                        button.dataset.editEmployee
                    );

                }
            );

    }


    /* ========================================================
       PAGE DATA
       ======================================================== */

    async function loadPageData() {

        setLoading(true);

        try {

            await Promise.all([
                loadEmployers(),
                loadEmployees()
            ]);

            buildEmployerMap();
            populateEmployerFilter();
            updateMetrics();
            renderEmployees();

        } finally {

            setLoading(false);

        }

    }


    /* ========================================================
       LOAD EMPLOYERS
       ======================================================== */

    async function loadEmployers() {

        const { data, error } =
            await client
                .from("employer_profiles")
                .select(
                    "id, employer_name, status"
                )
                .order(
                    "employer_name",
                    {
                        ascending: true
                    }
                );

        if (error) {
            throw error;
        }

        employers = data || [];

    }


    /* ========================================================
       LOAD EMPLOYEES
       ======================================================== */

    async function loadEmployees() {

        const { data, error } =
            await client
                .from("employer_employees")
                .select(`
                    id,
                    employer_id,
                    first_name,
                    last_name,
                    middle_name,
                    email,
                    phone,
                    employee_number,
                    employment_status,
                    job_title,
                    department,
                    hire_date,
                    termination_date,
                    is_dot_regulated,
                    cdl_number,
                    cdl_state,
                    cdl_class,
                    cdl_expiration_date
                `)
                .order(
                    "last_name",
                    {
                        ascending: true
                    }
                )
                .order(
                    "first_name",
                    {
                        ascending: true
                    }
                );

        if (error) {
            throw error;
        }

        employees = data || [];

    }


    /* ========================================================
       EMPLOYER MAP
       ======================================================== */

    function buildEmployerMap() {

        employerNameMap =
            new Map(
                employers.map(
                    employer => [
                        employer.id,
                        employer.employer_name ||
                        "Unnamed Employer"
                    ]
                )
            );

    }


    function employerName(employee) {

        return (
            employerNameMap.get(
                employee.employer_id
            ) ||
            "Unassigned Employer"
        );

    }


    /* ========================================================
       FILTER OPTIONS
       ======================================================== */

    function populateEmployerFilter() {

        const select =
            document.getElementById(
                "employeeEmployerFilter"
            );

        if (!select) return;

        const currentValue =
            select.value;

        select.innerHTML =
            `<option value="">All Employers</option>` +
            employers.map(
                employer => `
                    <option
                        value="${escapeHtml(employer.id)}"
                    >
                        ${escapeHtml(
                            employer.employer_name ||
                            "Unnamed Employer"
                        )}
                    </option>
                `
            ).join("");


        if (
            employers.some(
                employer =>
                    employer.id ===
                    currentValue
            )
        ) {
            select.value =
                currentValue;
        }

    }


    /* ========================================================
       FILTERING
       ======================================================== */

    function getFilteredEmployees() {

        const search =
            String(
                document
                    .getElementById(
                        "employeeSearch"
                    )
                    ?.value ||
                ""
            )
            .trim()
            .toLowerCase();


        const employerId =
            document
                .getElementById(
                    "employeeEmployerFilter"
                )
                ?.value ||
            "";


        const status =
            document
                .getElementById(
                    "employeeStatusFilter"
                )
                ?.value ||
            "";


        const dot =
            document
                .getElementById(
                    "employeeDotFilter"
                )
                ?.value ||
            "";


        return employees.filter(
            employee => {

                const searchable = [
                    employee.first_name,
                    employee.last_name,
                    employee.middle_name,
                    employee.email,
                    employee.phone,
                    employee.employee_number,
                    employee.job_title,
                    employee.department,
                    employee.cdl_number,
                    employerName(employee)
                ]
                    .filter(Boolean)
                    .join(" ")
                    .toLowerCase();


                const matchesSearch =
                    !search ||
                    searchable.includes(search);


                const matchesEmployer =
                    !employerId ||
                    employee.employer_id ===
                    employerId;


                const matchesStatus =
                    !status ||
                    String(
                        employee.employment_status ||
                        "active"
                    )
                    .toLowerCase() ===
                    status.toLowerCase();


                const matchesDot =
                    dot === "" ||
                    String(
                        Boolean(
                            employee.is_dot_regulated
                        )
                    ) === dot;


                return (
                    matchesSearch &&
                    matchesEmployer &&
                    matchesStatus &&
                    matchesDot
                );

            }
        );

    }


    /* ========================================================
       RENDER
       ======================================================== */

    function renderEmployees() {

        const body =
            document.getElementById(
                "employeesTableBody"
            );

        if (!body) return;


        const filtered =
            getFilteredEmployees();


        if (!filtered.length) {

            body.innerHTML = `
                <tr>
                    <td
                        colspan="7"
                        class="employees-empty"
                    >
                        No employees match the current filters.
                    </td>
                </tr>
            `;

            updateResultsCount(0);

            return;

        }


        body.innerHTML =
            filtered.map(
                employee => {

                    const fullName =
                        [
                            employee.first_name,
                            employee.middle_name,
                            employee.last_name
                        ]
                            .filter(Boolean)
                            .join(" ");


                    const position =
                        [
                            employee.job_title,
                            employee.department
                        ]
                            .filter(Boolean);


                    const status =
                        normalizeStatus(
                            employee.employment_status
                        );


                    const dotClass =
                        employee.is_dot_regulated
                            ? "dot"
                            : "non-dot";


                    const dotLabel =
                        employee.is_dot_regulated
                            ? "DOT Regulated"
                            : "Non-DOT";


                    const cdlText =
                        employee.cdl_number
                            ? [
                                employee.cdl_number,
                                employee.cdl_state
                            ]
                                .filter(Boolean)
                                .join(" · ")
                            : "No CDL on file";


                    return `
                        <tr>

                            <td>
                                <strong>
                                    ${escapeHtml(
                                        fullName ||
                                        "Unnamed Employee"
                                    )}
                                </strong>

                                <small>
                                    ${escapeHtml(
                                        employee.email ||
                                        "No email"
                                    )}
                                </small>
                            </td>


                            <td>
                                <strong>
                                    ${escapeHtml(
                                        employerName(employee)
                                    )}
                                </strong>

                                <small>
                                    ${escapeHtml(
                                        employee.phone ||
                                        "No phone"
                                    )}
                                </small>
                            </td>


                            <td>
                                ${
                                    escapeHtml(
                                        employee.employee_number ||
                                        "—"
                                    )
                                }
                            </td>


                            <td>
                                <strong>
                                    ${escapeHtml(
                                        position[0] ||
                                        "—"
                                    )}
                                </strong>

                                <small>
                                    ${escapeHtml(
                                        position[1] ||
                                        "No department"
                                    )}
                                </small>
                            </td>


                            <td>
                                <span
                                    class="employee-dot-badge ${dotClass}"
                                >
                                    ${dotLabel}
                                </span>

                                <small>
                                    ${escapeHtml(
                                        cdlText
                                    )}
                                </small>
                            </td>


                            <td>
                                <span
                                    class="employee-status ${status.css}"
                                >
                                    ${escapeHtml(
                                        status.label
                                    )}
                                </span>
                            </td>


                            <td>
                                <button
                                    type="button"
                                    class="employees-action-button"
                                    data-edit-employee="${escapeHtml(
                                        employee.id
                                    )}"
                                >
                                    Edit
                                </button>
                            </td>

                        </tr>
                    `;

                }
            )
            .join("");


        updateResultsCount(
            filtered.length
        );

    }


    /* ========================================================
       METRICS
       ======================================================== */

    function updateMetrics() {

        const total =
            employees.length;


        const active =
            employees.filter(
                employee =>
                    String(
                        employee.employment_status ||
                        "active"
                    )
                    .toLowerCase() ===
                    "active"
            )
            .length;


        const dot =
            employees.filter(
                employee =>
                    Boolean(
                        employee.is_dot_regulated
                    )
            )
            .length;


        const inactive =
            total - active;


        setMetric(
            "total",
            total
        );

        setMetric(
            "active",
            active
        );

        setMetric(
            "dot",
            dot
        );

        setMetric(
            "inactive",
            inactive
        );

    }


    function setMetric(
        name,
        value
    ) {

        const metric =
            document.querySelector(
                `[data-employee-metric="${name}"]`
            );

        if (metric) {
            metric.textContent = String(value);
        }

    }


    function updateResultsCount(
        count
    ) {

        const target =
            document.getElementById(
                "employeesResultsCount"
            );

        if (!target) return;

        target.textContent =
            `${count} ${
                count === 1
                    ? "employee"
                    : "employees"
            }`;

    }


    /* ========================================================
       ADD EMPLOYEE
       ======================================================== */

    function openAddEmployee() {

        if (!window.S4UUI?.formModal) {

            window.S4UUI?.toast(
                "UI modal system is not loaded.",
                "error"
            );

            return;

        }


        if (!employers.length) {

            window.S4UUI?.toast(
                "Create an employer before adding an employee.",
                "error"
            );

            return;

        }


        window.S4UUI.formModal({

            title:
                "Add Employee",

            message:
                "Create a workforce record for an employer.",

            fields:
                getEmployeeFields(),

            confirmText:
                "Create Employee",

            onSubmit:
                async values => {

                    await createEmployee(
                        values
                    );

                }

        });

    }


    /* ========================================================
       EDIT EMPLOYEE
       ======================================================== */

    function openEditEmployee(
        employeeId
    ) {

        const employee =
            employees.find(
                item =>
                    item.id ===
                    employeeId
            );


        if (!employee) return;


        if (!window.S4UUI?.formModal) {

            window.S4UUI?.toast(
                "UI modal system is not loaded.",
                "error"
            );

            return;

        }


        window.S4UUI.formModal({

            title:
                "Edit Employee",

            message:
                "Update employee and DOT workforce information.",

            fields:
                getEmployeeFields(
                    employee
                ),

            confirmText:
                "Save Changes",

            onSubmit:
                async values => {

                    await updateEmployee(
                        employee.id,
                        values
                    );

                }

        });

    }


    /* ========================================================
       CREATE / UPDATE
       ======================================================== */

    async function createEmployee(
        values
    ) {

        const payload =
            employeePayload(
                values
            );


        const { error } =
            await client
                .from(
                    "employer_employees"
                )
                .insert(
                    payload
                );


        if (error) {
            throw error;
        }


        window.S4UUI?.toast(
            "Employee created.",
            "success"
        );


        await loadPageData();

    }


    async function updateEmployee(
        employeeId,
        values
    ) {

        const payload =
            employeePayload(
                values
            );


        const { error } =
            await client
                .from(
                    "employer_employees"
                )
                .update(
                    payload
                )
                .eq(
                    "id",
                    employeeId
                );


        if (error) {
            throw error;
        }


        window.S4UUI?.toast(
            "Employee updated.",
            "success"
        );


        await loadPageData();

    }


    /* ========================================================
       FORM FIELDS
       ======================================================== */

    function getEmployeeFields(
        employee = {}
    ) {

        const employerOptions =
            employers.map(
                employer => ({

                    value:
                        employer.id,

                    label:
                        employer.employer_name ||
                        "Unnamed Employer"

                })
            );


        return [

            {
                name:
                    "employer_id",

                label:
                    "Employer",

                type:
                    "select",

                required:
                    true,

                value:
                    employee.employer_id ||
                    employerOptions[0]?.value ||
                    "",

                options:
                    employerOptions
            },


            {
                name:
                    "first_name",

                label:
                    "First Name",

                required:
                    true,

                value:
                    employee.first_name ||
                    ""
            },


            {
                name:
                    "last_name",

                label:
                    "Last Name",

                required:
                    true,

                value:
                    employee.last_name ||
                    ""
            },


            {
                name:
                    "middle_name",

                label:
                    "Middle Name",

                value:
                    employee.middle_name ||
                    ""
            },


            {
                name:
                    "email",

                label:
                    "Email",

                type:
                    "email",

                value:
                    employee.email ||
                    ""
            },


            {
                name:
                    "phone",

                label:
                    "Phone",

                type:
                    "tel",

                value:
                    employee.phone ||
                    ""
            },


            {
                name:
                    "employee_number",

                label:
                    "Employee Number",

                value:
                    employee.employee_number ||
                    ""
            },


            {
                name:
                    "employment_status",

                label:
                    "Employment Status",

                type:
                    "select",

                value:
                    employee.employment_status ||
                    "active",

                options: [
                    {
                        value:
                            "active",

                        label:
                            "Active"
                    },
                    {
                        value:
                            "inactive",

                        label:
                            "Inactive"
                    },
                    {
                        value:
                            "leave",

                        label:
                            "On Leave"
                    },
                    {
                        value:
                            "terminated",

                        label:
                            "Terminated"
                    }
                ]
            },


            {
                name:
                    "job_title",

                label:
                    "Job Title",

                value:
                    employee.job_title ||
                    ""
            },


            {
                name:
                    "department",

                label:
                    "Department",

                value:
                    employee.department ||
                    ""
            },


            {
                name:
                    "hire_date",

                label:
                    "Hire Date",

                type:
                    "date",

                value:
                    employee.hire_date ||
                    ""
            },


            {
                name:
                    "is_dot_regulated",

                label:
                    "DOT Regulated",

                type:
                    "select",

                value:
                    String(
                        Boolean(
                            employee.is_dot_regulated
                        )
                    ),

                options: [
                    {
                        value:
                            "false",

                        label:
                            "No"
                    },
                    {
                        value:
                            "true",

                        label:
                            "Yes"
                    }
                ]
            },


            {
                name:
                    "cdl_number",

                label:
                    "CDL Number",

                value:
                    employee.cdl_number ||
                    ""
            },


            {
                name:
                    "cdl_state",

                label:
                    "CDL State",

                value:
                    employee.cdl_state ||
                    ""
            },


            {
                name:
                    "cdl_class",

                label:
                    "CDL Class",

                value:
                    employee.cdl_class ||
                    ""
            },


            {
                name:
                    "cdl_expiration_date",

                label:
                    "CDL Expiration Date",

                type:
                    "date",

                value:
                    employee.cdl_expiration_date ||
                    ""
            }

        ];

    }


    /* ========================================================
       PAYLOAD
       ======================================================== */

    function employeePayload(
        values
    ) {

        return {

            employer_id:
                values.employer_id,

            first_name:
                requiredValue(
                    values.first_name,
                    "First name is required."
                ),

            last_name:
                requiredValue(
                    values.last_name,
                    "Last name is required."
                ),

            middle_name:
                cleanValue(
                    values.middle_name
                ),

            email:
                cleanValue(
                    values.email
                ),

            phone:
                cleanValue(
                    values.phone
                ),

            employee_number:
                cleanValue(
                    values.employee_number
                ),

            employment_status:
                cleanValue(
                    values.employment_status
                ) ||
                "active",

            job_title:
                cleanValue(
                    values.job_title
                ),

            department:
                cleanValue(
                    values.department
                ),

            hire_date:
                cleanValue(
                    values.hire_date
                ),

            is_dot_regulated:
                String(
                    values.is_dot_regulated
                ) === "true",

            cdl_number:
                cleanValue(
                    values.cdl_number
                ),

            cdl_state:
                cleanValue(
                    values.cdl_state
                ),

            cdl_class:
                cleanValue(
                    values.cdl_class
                ),

            cdl_expiration_date:
                cleanValue(
                    values.cdl_expiration_date
                )

        };

    }


    function requiredValue(
        value,
        message
    ) {

        const cleaned =
            cleanValue(value);

        if (!cleaned) {
            throw new Error(message);
        }

        return cleaned;

    }


    function cleanValue(
        value
    ) {

        if (
            value === null ||
            value === undefined
        ) {
            return null;
        }

        const cleaned =
            String(value).trim();

        return cleaned || null;

    }


    /* ========================================================
       HELPERS
       ======================================================== */

    function normalizeStatus(
        value
    ) {

        const raw =
            String(
                value ||
                "active"
            )
            .trim()
            .toLowerCase();


        const map = {

            active: {
                css:
                    "active",

                label:
                    "Active"
            },

            inactive: {
                css:
                    "inactive",

                label:
                    "Inactive"
            },

            leave: {
                css:
                    "leave",

                label:
                    "On Leave"
            },

            terminated: {
                css:
                    "terminated",

                label:
                    "Terminated"
            }

        };


        return (
            map[raw] ||
            {
                css:
                    "inactive",

                label:
                    value ||
                    "Unknown"
            }
        );

    }


    function setLoading(
        loading
    ) {

        const button =
            document.getElementById(
                "refreshEmployeesButton"
            );

        if (button) {
            button.disabled =
                Boolean(loading);
        }

    }


    function showError(
        message
    ) {

        const body =
            document.getElementById(
                "employeesTableBody"
            );

        if (body) {

            body.innerHTML = `
                <tr>
                    <td
                        colspan="7"
                        class="employees-empty"
                    >
                        ${escapeHtml(message)}
                    </td>
                </tr>
            `;

        }


        updateResultsCount(0);

        window.S4UUI?.toast(
            message,
            "error"
        );

    }


    function escapeHtml(
        value
    ) {

        return String(
            value ??
            ""
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

})();
