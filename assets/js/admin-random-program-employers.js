/* ============================================================
   screenings4u — ADMIN RANDOM PROGRAM EMPLOYERS
   assets/js/admin-random-program-employers.js

   LIVE DATA ONLY

   Tables:
   - dot_random_program_employers
   - dot_random_programs
   - employer_profiles
   - employer_employees
   - dot_random_employer_year_stats

   Important existing DB behavior:
   - (employer_id, program_id) is unique.
   - At least drug_enrolled OR alcohol_enrolled must be true.
   - selection_frequency allows monthly, quarterly,
     semi_annually, annually.
   - drug_rate/alcohol_rate are optional overrides.
   - The random-selection function COALESCEs employer override
     rates with the parent program rates.
   - Dedicated programs can contain only one enrolled employer.
   ============================================================ */

(() => {
    "use strict";

    const PAGE_SIZE = 20;

    let client = null;

    let programs = [];
    let employers = [];
    let enrollments = [];
    let employees = [];
    let employerYearStats = [];

    let programMap = new Map();
    let employerMap = new Map();
    let employeesByEmployer = new Map();
    let employerStatsMap = new Map();

    let enrichedEnrollments = [];
    let filteredEnrollments = [];

    let currentPage = 1;
    let editingEnrollmentId = null;
    let queryProgramId = null;
    let testingEnrollmentTouched = false;

    const dom = {};

    document.addEventListener(
        "DOMContentLoaded",
        initializeProgramEmployers
    );

    async function initializeProgramEmployers() {
        cacheDom();
        bindUi();

        try {
            client = await waitForSupabaseClient();

            if (!client) {
                throw new Error(
                    "Supabase client was not found. Confirm that supabase-config.js loads before admin-random-program-employers.js."
                );
            }

            await requireAdminSession();

            queryProgramId =
                new URLSearchParams(window.location.search).get("program");

            await loadPageData();

            if (queryProgramId && programMap.has(queryProgramId)) {
                dom.programFilter.value = queryProgramId;
                resetAndRender();
            }
        } catch (error) {
            console.error(
                "Program employer initialization failed:",
                error
            );

            showTableError(
                error?.message ||
                "Unable to load random program employers."
            );
        }
    }

    function cacheDom() {
        dom.enrollButton =
            document.getElementById("enrollEmployerButton");

        dom.refreshButton =
            document.getElementById("refreshProgramEmployersButton");

        dom.search =
            document.getElementById("rpeSearch");

        dom.programFilter =
            document.getElementById("rpeProgramFilter");

        dom.statusFilter =
            document.getElementById("rpeStatusFilter");

        dom.testingFilter =
            document.getElementById("rpeTestingFilter");

        dom.clearFilters =
            document.getElementById("clearRpeFilters");

        dom.tbody =
            document.getElementById("rpeTableBody");

        dom.resultsCount =
            document.getElementById("rpeResultsCount");

        dom.previous =
            document.getElementById("rpePrevious");

        dom.next =
            document.getElementById("rpeNext");

        dom.page =
            document.getElementById("rpePage");

        dom.metricTotal =
            document.getElementById("rpeMetricTotal");

        dom.metricActive =
            document.getElementById("rpeMetricActive");

        dom.metricEligible =
            document.getElementById("rpeMetricEligible");

        dom.metricDedicatedMissing =
            document.getElementById("rpeMetricDedicatedMissing");

        dom.backdrop =
            document.getElementById("rpeModalBackdrop");

        dom.form =
            document.getElementById("rpeForm");

        dom.modalKicker =
            document.getElementById("rpeModalKicker");

        dom.modalTitle =
            document.getElementById("rpeModalTitle");

        dom.modalSubtitle =
            document.getElementById("rpeModalSubtitle");

        dom.formMessage =
            document.getElementById("rpeFormMessage");

        dom.saveButton =
            document.getElementById("saveRpeButton");

        dom.deleteButton =
            document.getElementById("deleteRpeButton");

        dom.programId =
            document.getElementById("rpeProgramId");

        dom.employerId =
            document.getElementById("rpeEmployerId");

        dom.employerHelp =
            document.getElementById("rpeEmployerHelp");

        dom.status =
            document.getElementById("rpeStatus");

        dom.frequency =
            document.getElementById("rpeFrequency");

        dom.drugEnrolled =
            document.getElementById("rpeDrugEnrolled");

        dom.alcoholEnrolled =
            document.getElementById("rpeAlcoholEnrolled");

        dom.drugRate =
            document.getElementById("rpeDrugRate");

        dom.alcoholRate =
            document.getElementById("rpeAlcoholRate");

        dom.notes =
            document.getElementById("rpeNotes");

        dom.programSummary =
            document.getElementById("rpeProgramSummary");

        dom.summaryType =
            document.getElementById("rpeSummaryType");

        dom.summaryPool =
            document.getElementById("rpeSummaryPool");

        dom.summaryDrug =
            document.getElementById("rpeSummaryDrug");

        dom.summaryAlcohol =
            document.getElementById("rpeSummaryAlcohol");

        dom.rateHelp =
            document.getElementById("rpeRateHelp");
    }

    function bindUi() {
        dom.enrollButton?.addEventListener(
            "click",
            () => openEnrollmentModal()
        );

        dom.refreshButton?.addEventListener(
            "click",
            loadPageData
        );

        document
            .querySelectorAll("[data-rpe-close]")
            .forEach(button => {
                button.addEventListener(
                    "click",
                    closeEnrollmentModal
                );
            });

        dom.backdrop?.addEventListener("click", event => {
            if (event.target === dom.backdrop) {
                closeEnrollmentModal();
            }
        });

        document.addEventListener("keydown", event => {
            if (
                event.key === "Escape" &&
                dom.backdrop?.classList.contains("is-open")
            ) {
                closeEnrollmentModal();
            }
        });

        dom.search?.addEventListener(
            "input",
            resetAndRender
        );

        dom.programFilter?.addEventListener(
            "change",
            resetAndRender
        );

        dom.statusFilter?.addEventListener(
            "change",
            resetAndRender
        );

        dom.testingFilter?.addEventListener(
            "change",
            resetAndRender
        );

        dom.clearFilters?.addEventListener("click", () => {
            dom.search.value = "";
            dom.programFilter.value = "";
            dom.statusFilter.value = "";
            dom.testingFilter.value = "";
            currentPage = 1;
            renderEnrollments();
        });

        dom.previous?.addEventListener("click", () => {
            if (currentPage <= 1) return;
            currentPage -= 1;
            renderCurrentPage();
        });

        dom.next?.addEventListener("click", () => {
            const pages = getTotalPages();
            if (currentPage >= pages) return;
            currentPage += 1;
            renderCurrentPage();
        });

        dom.tbody?.addEventListener("click", event => {
            const editButton =
                event.target.closest("[data-rpe-edit]");

            if (editButton) {
                openEnrollmentModal(
                    editButton.dataset.rpeEdit
                );
                return;
            }

            const configureButton =
                event.target.closest("[data-rpe-configure-program]");

            if (configureButton) {
                openEnrollmentModal(
                    null,
                    configureButton.dataset.rpeConfigureProgram
                );
            }
        });

        dom.programId?.addEventListener(
            "change",
            () => {
                testingEnrollmentTouched = false;
                syncProgramSelection();
                applyProgramTestingDefaults();
            }
        );

        dom.drugEnrolled?.addEventListener(
            "change",
            () => {
                testingEnrollmentTouched = true;
                clearTestingEnrollmentValidation();
                syncRateHelp();
            }
        );

        dom.alcoholEnrolled?.addEventListener(
            "change",
            () => {
                testingEnrollmentTouched = true;
                clearTestingEnrollmentValidation();
                syncRateHelp();
            }
        );

        dom.drugRate?.addEventListener(
            "input",
            syncRateHelp
        );

        dom.alcoholRate?.addEventListener(
            "input",
            syncRateHelp
        );

        dom.form?.addEventListener(
            "submit",
            saveEnrollment
        );

        dom.deleteButton?.addEventListener(
            "click",
            deleteEnrollment
        );
    }

    async function waitForSupabaseClient(timeoutMs = 3500) {
        const started = Date.now();

        while (Date.now() - started < timeoutMs) {
            const found = await getSupabaseClient();

            if (found?.from) {
                return found;
            }

            await new Promise(resolve => {
                setTimeout(resolve, 75);
            });
        }

        return null;
    }

    async function getSupabaseClient() {
        try {
            if (
                typeof window.getScreenings4uSupabase ===
                "function"
            ) {
                const result =
                    await window.getScreenings4uSupabase();

                if (result?.from) {
                    return result;
                }
            }
        } catch (error) {
            console.warn(
                "getScreenings4uSupabase() was not ready:",
                error
            );
        }

        if (window.screenings4uSupabase?.from) {
            return window.screenings4uSupabase;
        }

        if (window.supabaseClient?.from) {
            return window.supabaseClient;
        }

        if (
            window.supabase?.createClient &&
            window.SCREENINGS4U_SUPABASE_URL &&
            window.SCREENINGS4U_SUPABASE_ANON_KEY
        ) {
            window.supabaseClient =
                window.supabase.createClient(
                    window.SCREENINGS4U_SUPABASE_URL,
                    window.SCREENINGS4U_SUPABASE_ANON_KEY
                );

            return window.supabaseClient;
        }

        if (
            window.supabase?.createClient &&
            window.SUPABASE_URL &&
            window.SUPABASE_ANON_KEY
        ) {
            window.supabaseClient =
                window.supabase.createClient(
                    window.SUPABASE_URL,
                    window.SUPABASE_ANON_KEY
                );

            return window.supabaseClient;
        }

        return null;
    }

    async function requireAdminSession() {
        if (window.S4UAuth?.requireSession) {
            const session =
                await window.S4UAuth.requireSession(
                    "admin-login.html"
                );

            if (!session) {
                throw new Error(
                    "Authentication required."
                );
            }

            return;
        }

        const { data, error } =
            await client.auth.getSession();

        if (error) {
            throw error;
        }

        if (!data?.session?.user) {
            window.location.replace(
                "admin-login.html"
            );

            throw new Error(
                "Authentication required."
            );
        }
    }

    async function loadPageData() {
        setTableLoading();

        try {
            await Promise.all([
                loadPrograms(),
                loadEmployers(),
                loadEnrollments(),
                loadEmployees(),
                loadEmployerYearStats()
            ]);

            buildMaps();
            populateFilters();
            populateProgramSelect();

            enrichedEnrollments =
                buildEnrichedEnrollments();

            updateMetrics();

            currentPage = 1;
            renderEnrollments();
        } catch (error) {
            console.error(
                "Unable to load program employers:",
                error
            );

            showTableError(
                error?.message ||
                "Unable to load program employers."
            );
        }
    }

    async function loadPrograms() {
        const { data, error } =
            await client
                .from("dot_random_programs")
                .select(`
                    id,
                    name,
                    program_year,
                    drug_rate,
                    alcohol_rate,
                    status,
                    dot_agency,
                    program_type,
                    pool_type,
                    dedicated_employer_id
                `)
                .order(
                    "program_year",
                    { ascending: false }
                )
                .order(
                    "name",
                    { ascending: true }
                );

        if (error) {
            throw new Error(
                `Unable to load random programs: ${error.message}`
            );
        }

        programs = data || [];
    }

    async function loadEmployers() {
        const { data, error } =
            await client
                .from("employer_profiles")
                .select(`
                    id,
                    employer_name,
                    legal_name,
                    status,
                    email,
                    phone,
                    city,
                    state,
                    dot_number,
                    dot_agency
                `)
                .order(
                    "employer_name",
                    { ascending: true }
                );

        if (error) {
            throw new Error(
                `Unable to load employers: ${error.message}`
            );
        }

        employers = data || [];
    }

    async function loadEnrollments() {
        const { data, error } =
            await client
                .from("dot_random_program_employers")
                .select(`
                    id,
                    employer_id,
                    program_id,
                    enrolled_at,
                    status,
                    notes,
                    created_at,
                    updated_at,
                    drug_enrolled,
                    alcohol_enrolled,
                    selection_frequency,
                    drug_rate,
                    alcohol_rate
                `)
                .order(
                    "created_at",
                    { ascending: false }
                );

        if (error) {
            throw new Error(
                `Unable to load random program employer enrollments: ${error.message}`
            );
        }

        enrollments = data || [];
    }

    async function loadEmployees() {
        const { data, error } =
            await client
                .from("employer_employees")
                .select(`
                    id,
                    employer_id,
                    employment_status,
                    is_dot_regulated
                `)
                .eq(
                    "employment_status",
                    "active"
                );

        if (error) {
            throw new Error(
                `Unable to load active employees: ${error.message}`
            );
        }

        employees = data || [];
    }

    async function loadEmployerYearStats() {
        const { data, error } =
            await client
                .from("dot_random_employer_year_stats")
                .select(`
                    id,
                    employer_id,
                    program_id,
                    program_year,
                    eligible_employee_count,
                    drug_annual_target,
                    alcohol_annual_target,
                    drug_selected_total,
                    alcohol_selected_total,
                    created_at,
                    updated_at
                `);

        if (error) {
            throw new Error(
                `Unable to load employer year statistics: ${error.message}`
            );
        }

        employerYearStats = data || [];
    }

    function buildMaps() {
        programMap =
            new Map(
                programs.map(program => [
                    program.id,
                    program
                ])
            );

        employerMap =
            new Map(
                employers.map(employer => [
                    employer.id,
                    employer
                ])
            );

        employeesByEmployer =
            new Map();

        employees.forEach(employee => {
            const list =
                employeesByEmployer.get(
                    employee.employer_id
                ) || [];

            list.push(employee);

            employeesByEmployer.set(
                employee.employer_id,
                list
            );
        });

        employerStatsMap =
            new Map();

        employerYearStats.forEach(stat => {
            employerStatsMap.set(
                `${stat.program_id}:${stat.employer_id}`,
                stat
            );
        });
    }

    function buildEnrichedEnrollments() {
        const realRows =
            enrollments.map(enrollment => {
                const program =
                    programMap.get(
                        enrollment.program_id
                    ) || null;

                const employer =
                    employerMap.get(
                        enrollment.employer_id
                    ) || null;

                const stats =
                    employerStatsMap.get(
                        `${enrollment.program_id}:${enrollment.employer_id}`
                    ) || null;

                const eligibleCount =
                    countEligibleEmployees(
                        enrollment.employer_id,
                        program
                    );

                return {
                    ...enrollment,
                    program,
                    employer,
                    stats,
                    eligible_employee_count:
                        eligibleCount,
                    missing_setup: false
                };
            });

        /*
         * Dedicated programs require an enrollment row too because
         * the selection function joins dot_random_program_employers
         * to resolve testing eligibility and rate overrides.
         *
         * If the dedicated employer has no enrollment row, show a
         * derived "Needs Setup" row. It is not fake data; it reflects
         * a real program configuration gap.
         */
        const missingDedicatedRows = [];

        programs.forEach(program => {
            if (
                program.pool_type !== "DEDICATED" ||
                !program.dedicated_employer_id
            ) {
                return;
            }

            const existing =
                enrollments.find(row =>
                    row.program_id === program.id &&
                    row.employer_id ===
                        program.dedicated_employer_id
                );

            if (existing) {
                return;
            }

            const employer =
                employerMap.get(
                    program.dedicated_employer_id
                ) || null;

            missingDedicatedRows.push({
                id: `missing:${program.id}`,
                employer_id:
                    program.dedicated_employer_id,
                program_id:
                    program.id,
                enrolled_at: null,
                status: "needs_setup",
                notes: null,
                drug_enrolled: false,
                alcohol_enrolled: false,
                selection_frequency: null,
                drug_rate: null,
                alcohol_rate: null,
                program,
                employer,
                stats: null,
                eligible_employee_count:
                    countEligibleEmployees(
                        program.dedicated_employer_id,
                        program
                    ),
                missing_setup: true
            });
        });

        return [
            ...missingDedicatedRows,
            ...realRows
        ];
    }

    function countEligibleEmployees(
        employerId,
        program
    ) {
        if (!employerId || !program) {
            return 0;
        }

        const rows =
            employeesByEmployer.get(employerId) || [];

        if (program.program_type === "DOT") {
            return rows.filter(
                employee =>
                    employee.is_dot_regulated === true
            ).length;
        }

        return rows.length;
    }

    function populateFilters() {
        if (!dom.programFilter) return;

        const current =
            dom.programFilter.value;

        dom.programFilter.innerHTML =
            '<option value="">All programs</option>' +
            programs.map(program => `
                <option value="${escapeHtml(program.id)}">
                    ${escapeHtml(program.name)}
                    (${escapeHtml(String(program.program_year))})
                </option>
            `).join("");

        if (
            current &&
            programMap.has(current)
        ) {
            dom.programFilter.value =
                current;
        }
    }

    function populateProgramSelect() {
        if (!dom.programId) return;

        const current =
            dom.programId.value;

        dom.programId.innerHTML =
            '<option value="">Select program</option>' +
            programs.map(program => {
                const status =
                    program.status
                        ? ` · ${humanize(program.status)}`
                        : "";

                const pool =
                    program.pool_type === "DEDICATED"
                        ? "Dedicated"
                        : "Consortium";

                return `
                    <option value="${escapeHtml(program.id)}">
                        ${escapeHtml(program.name)}
                        · ${escapeHtml(String(program.program_year))}
                        · ${escapeHtml(pool + status)}
                    </option>
                `;
            }).join("");

        if (
            current &&
            programMap.has(current)
        ) {
            dom.programId.value =
                current;
        }
    }

    function populateEmployerSelect(
        selectedProgram,
        preferredEmployerId = ""
    ) {
        if (!dom.employerId) return;

        const current =
            preferredEmployerId ||
            dom.employerId.value;

        if (
            selectedProgram?.pool_type ===
            "DEDICATED"
        ) {
            const employerId =
                selectedProgram.dedicated_employer_id;

            const employer =
                employerMap.get(employerId);

            dom.employerId.innerHTML =
                employer
                    ? `
                        <option value="${escapeHtml(employer.id)}">
                            ${escapeHtml(getEmployerName(employer))}
                        </option>
                    `
                    : '<option value="">Dedicated employer not found</option>';

            dom.employerId.value =
                employer?.id || "";

            dom.employerId.disabled =
                true;

            dom.employerHelp.textContent =
                "This is a dedicated program. The employer is controlled by dot_random_programs.dedicated_employer_id.";

            return;
        }

        const existingEmployerIds =
            new Set(
                enrollments
                    .filter(row =>
                        row.program_id ===
                        selectedProgram?.id &&
                        row.id !==
                            editingEnrollmentId
                    )
                    .map(row =>
                        row.employer_id
                    )
            );

        const candidates =
            employers.filter(employer => {
                if (
                    employer.id ===
                    current
                ) {
                    return true;
                }

                if (
                    existingEmployerIds.has(
                        employer.id
                    )
                ) {
                    return false;
                }

                return true;
            });

        dom.employerId.innerHTML =
            '<option value="">Select employer</option>' +
            candidates.map(employer => {
                const dotNumber =
                    employer.dot_number
                        ? ` · ${employer.dot_number}`
                        : "";

                const status =
                    employer.status
                        ? ` · ${humanize(employer.status)}`
                        : "";

                return `
                    <option value="${escapeHtml(employer.id)}">
                        ${escapeHtml(
                            getEmployerName(employer) +
                            dotNumber +
                            status
                        )}
                    </option>
                `;
            }).join("");

        dom.employerId.disabled =
            false;

        if (
            current &&
            employerMap.has(current)
        ) {
            dom.employerId.value =
                current;
        }

        dom.employerHelp.textContent =
            "Employers already enrolled in this program are removed from this list.";
    }

    function updateMetrics() {
        const realEnrollments =
            enrichedEnrollments.filter(
                row => !row.missing_setup
            );

        const active =
            realEnrollments.filter(
                row =>
                    String(row.status || "")
                        .toLowerCase() ===
                    "active"
            );

        const eligibleKeys =
            new Set();

        active.forEach(row => {
            const program =
                row.program;

            const employeeRows =
                employeesByEmployer.get(
                    row.employer_id
                ) || [];

            employeeRows.forEach(employee => {
                if (
                    program?.program_type ===
                    "DOT" &&
                    employee.is_dot_regulated !== true
                ) {
                    return;
                }

                eligibleKeys.add(
                    `${row.program_id}:${employee.id}`
                );
            });
        });

        const missingDedicated =
            enrichedEnrollments.filter(
                row => row.missing_setup
            ).length;

        dom.metricTotal.textContent =
            realEnrollments.length
                .toLocaleString();

        dom.metricActive.textContent =
            active.length
                .toLocaleString();

        dom.metricEligible.textContent =
            eligibleKeys.size
                .toLocaleString();

        dom.metricDedicatedMissing.textContent =
            missingDedicated
                .toLocaleString();
    }

    function resetAndRender() {
        currentPage = 1;
        renderEnrollments();
    }

    function renderEnrollments() {
        const query =
            String(
                dom.search?.value || ""
            )
                .trim()
                .toLowerCase();

        const programFilter =
            dom.programFilter?.value || "";

        const statusFilter =
            dom.statusFilter?.value || "";

        const testingFilter =
            dom.testingFilter?.value || "";

        filteredEnrollments =
            enrichedEnrollments.filter(row => {
                const program =
                    row.program || {};

                const employer =
                    row.employer || {};

                const haystack = [
                    getEmployerName(employer),
                    employer.legal_name,
                    employer.email,
                    employer.dot_number,
                    employer.city,
                    employer.state,
                    program.name,
                    program.program_year,
                    program.program_type,
                    program.pool_type,
                    program.dot_agency,
                    row.selection_frequency,
                    row.status,
                    row.notes
                ]
                    .filter(value =>
                        value !== null &&
                        value !== undefined
                    )
                    .join(" ")
                    .toLowerCase();

                const matchesSearch =
                    !query ||
                    haystack.includes(query);

                const matchesProgram =
                    !programFilter ||
                    row.program_id ===
                        programFilter;

                const normalizedStatus =
                    row.missing_setup
                        ? "needs_setup"
                        : String(
                            row.status || ""
                        ).toLowerCase();

                const matchesStatus =
                    !statusFilter ||
                    normalizedStatus ===
                        statusFilter;

                let matchesTesting =
                    true;

                if (testingFilter === "drug") {
                    matchesTesting =
                        row.drug_enrolled === true;
                }

                if (
                    testingFilter ===
                    "alcohol"
                ) {
                    matchesTesting =
                        row.alcohol_enrolled === true;
                }

                if (testingFilter === "both") {
                    matchesTesting =
                        row.drug_enrolled === true &&
                        row.alcohol_enrolled === true;
                }

                return (
                    matchesSearch &&
                    matchesProgram &&
                    matchesStatus &&
                    matchesTesting
                );
            });

        const pages =
            getTotalPages();

        if (currentPage > pages) {
            currentPage =
                pages;
        }

        renderCurrentPage();
    }

    function renderCurrentPage() {
        if (!dom.tbody) return;

        if (!filteredEnrollments.length) {
            dom.tbody.innerHTML = `
                <tr>
                    <td colspan="10" class="rpe-empty">
                        No program employer enrollments match the current filters.
                    </td>
                </tr>
            `;

            updatePagination(
                0,
                0
            );

            return;
        }

        const start =
            (currentPage - 1) *
            PAGE_SIZE;

        const end =
            start +
            PAGE_SIZE;

        const rows =
            filteredEnrollments.slice(
                start,
                end
            );

        dom.tbody.innerHTML =
            rows
                .map(buildEnrollmentRow)
                .join("");

        updatePagination(
            start + 1,
            Math.min(
                end,
                filteredEnrollments.length
            )
        );
    }

    function buildEnrollmentRow(row) {
        const program =
            row.program || {};

        const employer =
            row.employer || {};

        const programRateDrug =
            numberOrNull(
                program.drug_rate
            );

        const programRateAlcohol =
            numberOrNull(
                program.alcohol_rate
            );

        const overrideDrug =
            numberOrNull(
                row.drug_rate
            );

        const overrideAlcohol =
            numberOrNull(
                row.alcohol_rate
            );

        const effectiveDrug =
            overrideDrug !== null
                ? overrideDrug
                : programRateDrug;

        const effectiveAlcohol =
            overrideAlcohol !== null
                ? overrideAlcohol
                : programRateAlcohol;

        const stats =
            row.stats;

        const yearProgress =
            stats
                ? `Drug ${Number(stats.drug_selected_total || 0).toLocaleString()} / ${Number(stats.drug_annual_target || 0).toLocaleString()} · Alcohol ${Number(stats.alcohol_selected_total || 0).toLocaleString()} / ${Number(stats.alcohol_annual_target || 0).toLocaleString()}`
                : "No stored employer-year statistics";

        const statusLabel =
            row.missing_setup
                ? "Needs Setup"
                : humanize(
                    row.status ||
                    "inactive"
                );

        const statusClass =
            row.missing_setup
                ? "rpe-badge--inactive"
                : String(
                    row.status || ""
                ).toLowerCase() ===
                    "active"
                    ? "rpe-badge--active"
                    : "rpe-badge--inactive";

        return `
            <tr>
                <td>
                    <div class="rpe-name">
                        <strong>
                            ${escapeHtml(
                                getEmployerName(employer)
                            )}
                        </strong>
                        <small>
                            ${escapeHtml(
                                [
                                    employer.dot_number,
                                    [
                                        employer.city,
                                        employer.state
                                    ]
                                        .filter(Boolean)
                                        .join(", ")
                                ]
                                    .filter(Boolean)
                                    .join(" · ") ||
                                "Employer profile"
                            )}
                        </small>
                    </div>
                </td>

                <td>
                    <div class="rpe-name">
                        <strong>
                            ${escapeHtml(
                                program.name ||
                                "Program not found"
                            )}
                        </strong>
                        <small>
                            ${escapeHtml(
                                [
                                    program.program_year,
                                    program.program_type === "NON_DOT"
                                        ? "NON-DOT"
                                        : program.program_type,
                                    program.dot_agency,
                                    humanize(program.pool_type)
                                ]
                                    .filter(Boolean)
                                    .join(" · ")
                            )}
                        </small>
                    </div>
                </td>

                <td>
                    <div class="rpe-testing">
                        <span class="rpe-testing-chip ${row.drug_enrolled ? "" : "is-off"}">
                            Drug ${row.drug_enrolled ? "On" : "Off"}
                        </span>
                        <span class="rpe-testing-chip ${row.alcohol_enrolled ? "" : "is-off"}">
                            Alcohol ${row.alcohol_enrolled ? "On" : "Off"}
                        </span>
                    </div>
                </td>

                <td>
                    <strong>
                        ${escapeHtml(
                            row.selection_frequency
                                ? humanize(
                                    row.selection_frequency
                                )
                                : row.missing_setup
                                    ? "Not configured"
                                    : "—"
                        )}
                    </strong>
                </td>

                <td>
                    <div class="rpe-testing">
                        <span class="rpe-testing-chip">
                            Drug ${escapeHtml(
                                effectiveDrug === null
                                    ? "—"
                                    : formatPercent(effectiveDrug)
                            )}
                        </span>
                        <span class="rpe-testing-chip">
                            Alcohol ${escapeHtml(
                                effectiveAlcohol === null
                                    ? "—"
                                    : formatPercent(effectiveAlcohol)
                            )}
                        </span>
                    </div>
                    <span class="rpe-subtext">
                        ${escapeHtml(
                            [
                                overrideDrug !== null
                                    ? "Drug override"
                                    : "Drug program rate",
                                overrideAlcohol !== null
                                    ? "Alcohol override"
                                    : "Alcohol program rate"
                            ].join(" · ")
                        )}
                    </span>
                </td>

                <td>
                    <strong>
                        ${Number(
                            row.eligible_employee_count || 0
                        ).toLocaleString()}
                    </strong>
                    <span class="rpe-subtext">
                        active ${program.program_type === "DOT" ? "DOT-regulated " : ""}employees
                    </span>
                </td>

                <td>
                    <span class="rpe-subtext" style="margin-top:0;">
                        ${escapeHtml(yearProgress)}
                    </span>
                </td>

                <td>
                    <span class="rpe-badge ${statusClass}">
                        ${escapeHtml(statusLabel)}
                    </span>
                </td>

                <td>
                    ${escapeHtml(
                        row.enrolled_at
                            ? formatDate(row.enrolled_at)
                            : "—"
                    )}
                </td>

                <td>
                    <div class="rpe-actions">
                        ${
                            row.missing_setup
                                ? `
                                    <button
                                        type="button"
                                        class="rpe-row-button"
                                        data-rpe-configure-program="${escapeHtml(row.program_id)}"
                                    >
                                        Configure
                                    </button>
                                `
                                : `
                                    <button
                                        type="button"
                                        class="rpe-row-button"
                                        data-rpe-edit="${escapeHtml(row.id)}"
                                    >
                                        Edit
                                    </button>
                                `
                        }

                        <a
                            class="rpe-row-button"
                            href="admin-random-selections.html?program=${encodeURIComponent(row.program_id)}"
                            style="text-decoration:none;"
                        >
                            Selections
                        </a>
                    </div>
                </td>
            </tr>
        `;
    }

    function updatePagination(
        start,
        end
    ) {
        const total =
            filteredEnrollments.length;

        const pages =
            getTotalPages();

        dom.resultsCount.textContent =
            total === 0
                ? "0 enrollments"
                : `Showing ${start}–${end} of ${total} program employer record${total === 1 ? "" : "s"}`;

        dom.page.textContent =
            String(currentPage);

        dom.previous.disabled =
            currentPage <= 1;

        dom.next.disabled =
            currentPage >= pages;
    }

    function getTotalPages() {
        return Math.max(
            1,
            Math.ceil(
                filteredEnrollments.length /
                PAGE_SIZE
            )
        );
    }

    function openEnrollmentModal(
        enrollmentId = null,
        forcedProgramId = null
    ) {
        editingEnrollmentId =
            enrollmentId || null;

        testingEnrollmentTouched = false;

        dom.form.reset();
        clearFormMessage();

        dom.status.value =
            "active";

        dom.frequency.value =
            "";

        dom.drugEnrolled.checked =
            false;

        dom.alcoholEnrolled.checked =
            false;

        dom.drugRate.value =
            "";

        dom.alcoholRate.value =
            "";

        dom.notes.value =
            "";

        dom.deleteButton.style.display =
            editingEnrollmentId
                ? "inline-flex"
                : "none";

        dom.modalKicker.textContent =
            editingEnrollmentId
                ? "EDIT ENROLLMENT"
                : "ENROLL EMPLOYER";

        dom.modalTitle.textContent =
            editingEnrollmentId
                ? "Edit Program Employer"
                : "Enroll Employer";

        dom.modalSubtitle.textContent =
            editingEnrollmentId
                ? "Update testing participation, frequency, rate overrides, or status."
                : "Add an employer to an existing random testing program.";

        let programId =
            forcedProgramId ||
            queryProgramId ||
            "";

        let employerId =
            "";

        if (editingEnrollmentId) {
            const row =
                enrollments.find(
                    item =>
                        item.id ===
                        editingEnrollmentId
                );

            if (!row) {
                return;
            }

            programId =
                row.program_id;

            employerId =
                row.employer_id;

            dom.status.value =
                row.status ||
                "active";

            ensureSelectValue(
                dom.status,
                row.status
            );

            dom.frequency.value =
                row.selection_frequency ||
                "";

            dom.drugEnrolled.checked =
                row.drug_enrolled === true;

            dom.alcoholEnrolled.checked =
                row.alcohol_enrolled === true;

            dom.drugRate.value =
                row.drug_rate ?? "";

            dom.alcoholRate.value =
                row.alcohol_rate ?? "";

            dom.notes.value =
                row.notes || "";
        }

        dom.programId.value =
            programId;

        syncProgramSelection(
            employerId
        );

        if (!editingEnrollmentId) {
            applyProgramTestingDefaults();
        }

        if (editingEnrollmentId) {
            /*
             * Preserve the unique program/employer identity when editing.
             * Changing either would effectively move the enrollment and
             * can collide with the unique pair constraint.
             */
            dom.programId.disabled =
                true;

            dom.employerId.disabled =
                true;

            dom.employerHelp.textContent =
                "Program and employer are locked while editing this enrollment. Remove it and create a new enrollment to move the employer.";
        } else {
            dom.programId.disabled =
                false;
        }

        dom.backdrop.classList.add(
            "is-open"
        );

        dom.backdrop.setAttribute(
            "aria-hidden",
            "false"
        );

        document.body.style.overflow =
            "hidden";
    }

    function closeEnrollmentModal() {
        dom.backdrop.classList.remove(
            "is-open"
        );

        dom.backdrop.setAttribute(
            "aria-hidden",
            "true"
        );

        document.body.style.overflow =
            "";

        dom.programId.disabled =
            false;

        dom.employerId.disabled =
            false;

        editingEnrollmentId =
            null;

        clearFormMessage();
    }

    function syncProgramSelection(
        preferredEmployerId = ""
    ) {
        const program =
            programMap.get(
                dom.programId.value
            );

        if (!program) {
            dom.programSummary.classList.remove(
                "is-visible"
            );

            populateEmployerSelect(
                null,
                preferredEmployerId
            );

            syncRateHelp();

            return;
        }

        dom.programSummary.classList.add(
            "is-visible"
        );

        dom.summaryType.textContent =
            program.program_type ===
            "NON_DOT"
                ? "NON-DOT"
                : [
                    program.program_type,
                    program.dot_agency
                ]
                    .filter(Boolean)
                    .join(" / ");

        dom.summaryPool.textContent =
            humanize(
                program.pool_type
            );

        dom.summaryDrug.textContent =
            formatPercent(
                program.drug_rate
            );

        dom.summaryAlcohol.textContent =
            formatPercent(
                program.alcohol_rate
            );

        populateEmployerSelect(
            program,
            preferredEmployerId
        );

        syncRateHelp();
    }

    function applyProgramTestingDefaults() {
        /*
         * Only seed defaults on NEW enrollments.
         * Never change saved enrollment values while editing.
         */
        if (
            editingEnrollmentId ||
            testingEnrollmentTouched
        ) {
            return;
        }

        const program =
            programMap.get(
                dom.programId.value
            );

        if (!program) {
            return;
        }

        const programDrugRate =
            numberOrNull(
                program.drug_rate
            );

        const programAlcoholRate =
            numberOrNull(
                program.alcohol_rate
            );

        dom.drugEnrolled.checked =
            programDrugRate !== null &&
            programDrugRate > 0;

        dom.alcoholEnrolled.checked =
            programAlcoholRate !== null &&
            programAlcoholRate > 0;

        /*
         * If the program somehow has neither positive rate,
         * leave both unchecked so the existing DB validation
         * correctly forces an explicit selection.
         */
        clearTestingEnrollmentValidation();
        syncRateHelp();
    }

    function clearTestingEnrollmentValidation() {
        if (!dom.formMessage) {
            return;
        }

        const currentMessage =
            String(
                dom.formMessage.textContent || ""
            );

        if (
            currentMessage.includes(
                "Select Drug Testing, Alcohol Testing, or both"
            ) ||
            currentMessage.includes(
                "At least one testing category"
            )
        ) {
            clearFormMessage();
        }
    }

    function syncRateHelp() {
        const program =
            programMap.get(
                dom.programId.value
            );

        if (!program) {
            dom.rateHelp.textContent =
                "Select a random program to see its stored rates.";

            return;
        }

        const drugOverride =
            numberOrNull(
                dom.drugRate.value
            );

        const alcoholOverride =
            numberOrNull(
                dom.alcoholRate.value
            );

        const effectiveDrug =
            drugOverride !== null
                ? drugOverride
                : numberOrNull(
                    program.drug_rate
                );

        const effectiveAlcohol =
            alcoholOverride !== null
                ? alcoholOverride
                : numberOrNull(
                    program.alcohol_rate
                );

        const parts = [];

        if (dom.drugEnrolled.checked) {
            parts.push(
                `Drug effective rate: ${
                    effectiveDrug === null
                        ? "not set"
                        : formatPercent(
                            effectiveDrug
                        )
                }`
            );
        }

        if (dom.alcoholEnrolled.checked) {
            parts.push(
                `Alcohol effective rate: ${
                    effectiveAlcohol === null
                        ? "not set"
                        : formatPercent(
                            effectiveAlcohol
                        )
                }`
            );
        }

        if (!parts.length) {
            dom.rateHelp.textContent =
                "Select Drug Testing and/or Alcohol Testing. At least one is required.";

            dom.rateHelp.classList.add(
                "is-warning"
            );

            return;
        }

        dom.rateHelp.classList.remove(
            "is-warning"
        );

        dom.rateHelp.textContent =
            parts.join(" · ") +
            ". Blank overrides use the parent program rate.";
    }

    async function saveEnrollment(event) {
        event.preventDefault();
        clearFormMessage();

        const programId =
            dom.programId.value;

        const program =
            programMap.get(
                programId
            );

        if (!program) {
            showFormMessage(
                "Select a valid random program.",
                true
            );

            return;
        }

        let employerId =
            dom.employerId.value;

        if (
            program.pool_type ===
            "DEDICATED"
        ) {
            employerId =
                program.dedicated_employer_id;
        }

        if (
            !employerId ||
            !employerMap.has(employerId)
        ) {
            showFormMessage(
                "Select a valid employer.",
                true
            );

            return;
        }

        const drugEnrolled =
            dom.drugEnrolled.checked ===
            true;

        const alcoholEnrolled =
            dom.alcoholEnrolled.checked ===
            true;

        if (
            !drugEnrolled &&
            !alcoholEnrolled
        ) {
            showFormMessage(
                "Select Drug Testing, Alcohol Testing, or both. The database requires at least one testing category.",
                true
            );

            return;
        }

        if (!dom.frequency.value) {
            showFormMessage(
                "Select the employer's selection frequency.",
                true
            );

            return;
        }

        const drugRate =
            optionalRate(
                dom.drugRate.value
            );

        if (drugRate.error) {
            showFormMessage(
                drugRate.error,
                true
            );

            dom.drugRate.focus();
            return;
        }

        const alcoholRate =
            optionalRate(
                dom.alcoholRate.value
            );

        if (alcoholRate.error) {
            showFormMessage(
                alcoholRate.error,
                true
            );

            dom.alcoholRate.focus();
            return;
        }

        /*
         * DB constraint:
         * if an enrolled testing category has a non-null override,
         * that override must be > 0.
         */
        if (
            drugEnrolled &&
            drugRate.value !== null &&
            drugRate.value <= 0
        ) {
            showFormMessage(
                "Drug rate override must be greater than 0 when Drug Testing is enabled, or leave it blank to use the program rate.",
                true
            );

            return;
        }

        if (
            alcoholEnrolled &&
            alcoholRate.value !== null &&
            alcoholRate.value <= 0
        ) {
            showFormMessage(
                "Alcohol rate override must be greater than 0 when Alcohol Testing is enabled, or leave it blank to use the program rate.",
                true
            );

            return;
        }

        const duplicate =
            enrollments.find(row =>
                row.program_id ===
                    programId &&
                row.employer_id ===
                    employerId &&
                row.id !==
                    editingEnrollmentId
            );

        if (duplicate) {
            showFormMessage(
                "This employer is already enrolled in the selected program. Edit the existing enrollment instead.",
                true
            );

            return;
        }

        const payload = {
            employer_id:
                employerId,

            program_id:
                programId,

            status:
                dom.status.value ||
                "active",

            notes:
                nullableText(
                    dom.notes.value
                ),

            drug_enrolled:
                drugEnrolled,

            alcohol_enrolled:
                alcoholEnrolled,

            selection_frequency:
                dom.frequency.value,

            drug_rate:
                drugRate.value,

            alcohol_rate:
                alcoholRate.value
        };

        const originalHtml =
            dom.saveButton.innerHTML;

        dom.saveButton.disabled =
            true;

        dom.saveButton.textContent =
            editingEnrollmentId
                ? "Saving Changes..."
                : "Enrolling Employer...";

        try {
            let result;

            if (editingEnrollmentId) {
                /*
                 * Identity fields remain in payload but are unchanged.
                 * This keeps the write explicit and allows the DB
                 * trigger to validate dedicated program membership.
                 */
                result =
                    await client
                        .from(
                            "dot_random_program_employers"
                        )
                        .update(payload)
                        .eq(
                            "id",
                            editingEnrollmentId
                        )
                        .select("id")
                        .single();
            } else {
                result =
                    await client
                        .from(
                            "dot_random_program_employers"
                        )
                        .insert(payload)
                        .select("id")
                        .single();
            }

            if (result.error) {
                throw result.error;
            }

            showFormMessage(
                editingEnrollmentId
                    ? "Program employer enrollment updated."
                    : "Employer enrolled in the random program.",
                false
            );

            await loadPageData();

            setTimeout(
                closeEnrollmentModal,
                650
            );
        } catch (error) {
            console.error(
                "Unable to save program employer enrollment:",
                error
            );

            showFormMessage(
                readableDatabaseError(
                    error
                ),
                true
            );
        } finally {
            dom.saveButton.disabled =
                false;

            dom.saveButton.innerHTML =
                originalHtml;
        }
    }

    async function deleteEnrollment() {
        if (!editingEnrollmentId) {
            return;
        }

        const row =
            enrollments.find(
                item =>
                    item.id ===
                    editingEnrollmentId
            );

        if (!row) {
            return;
        }

        const employer =
            employerMap.get(
                row.employer_id
            );

        const program =
            programMap.get(
                row.program_id
            );

        const confirmed =
            window.confirm(
                `Remove ${getEmployerName(employer)} from "${program?.name || "this random program"}"?`
            );

        if (!confirmed) {
            return;
        }

        dom.deleteButton.disabled =
            true;

        try {
            const { error } =
                await client
                    .from(
                        "dot_random_program_employers"
                    )
                    .delete()
                    .eq(
                        "id",
                        editingEnrollmentId
                    );

            if (error) {
                throw error;
            }

            await loadPageData();
            closeEnrollmentModal();
        } catch (error) {
            console.error(
                "Unable to remove program employer enrollment:",
                error
            );

            showFormMessage(
                error?.message ||
                "Unable to remove this enrollment.",
                true
            );
        } finally {
            dom.deleteButton.disabled =
                false;
        }
    }

    function readableDatabaseError(error) {
        const message =
            String(
                error?.message || ""
            );

        if (
            message.includes(
                "dot_random_program_employers_unique"
            ) ||
            message.includes(
                "duplicate key value"
            )
        ) {
            return "This employer is already enrolled in this random program.";
        }

        if (
            message.includes(
                "dot_random_program_employers_testing_check"
            )
        ) {
            return "At least one testing category must be enabled.";
        }

        if (
            message.includes(
                "dot_random_program_employers_frequency_check"
            )
        ) {
            return "Selection frequency must be Monthly, Quarterly, Semi-Annually, or Annually.";
        }

        if (
            message.includes(
                "dot_random_program_employers_rates_check"
            )
        ) {
            return "Drug and alcohol rate overrides must be between 0 and 100.";
        }

        if (
            message.includes(
                "dot_random_program_employers_enrollment_rate_check"
            )
        ) {
            return "An enabled testing category cannot use a 0% override. Leave the override blank to use the program rate.";
        }

        if (
            message.includes(
                "DEDICATED program"
            )
        ) {
            return "A dedicated random program can contain only its single configured employer.";
        }

        return (
            message ||
            "Unable to save this program employer enrollment."
        );
    }

    function setTableLoading() {
        if (!dom.tbody) return;

        dom.tbody.innerHTML = `
            <tr>
                <td colspan="10" class="rpe-loading">
                    Loading program employers...
                </td>
            </tr>
        `;
    }

    function showTableError(message) {
        if (!dom.tbody) return;

        dom.tbody.innerHTML = `
            <tr>
                <td colspan="10" class="rpe-error">
                    ${escapeHtml(message)}
                </td>
            </tr>
        `;

        if (dom.resultsCount) {
            dom.resultsCount.textContent =
                "Unable to load enrollments";
        }
    }

    function showFormMessage(
        message,
        isError
    ) {
        if (!dom.formMessage) return;

        dom.formMessage.textContent =
            message;

        dom.formMessage.classList.toggle(
            "is-error",
            Boolean(isError)
        );

        dom.formMessage.classList.add(
            "is-visible"
        );
    }

    function clearFormMessage() {
        if (!dom.formMessage) return;

        dom.formMessage.textContent =
            "";

        dom.formMessage.classList.remove(
            "is-visible",
            "is-error"
        );
    }

    function getEmployerName(employer) {
        return (
            employer?.employer_name ||
            employer?.legal_name ||
            "Employer not found"
        );
    }

    function ensureSelectValue(
        select,
        value
    ) {
        if (!select || !value) {
            return;
        }

        const exists =
            Array.from(select.options)
                .some(
                    option =>
                        option.value ===
                        value
                );

        if (!exists) {
            const option =
                document.createElement(
                    "option"
                );

            option.value =
                value;

            option.textContent =
                humanize(value);

            select.appendChild(option);
        }

        select.value =
            value;
    }

    function optionalRate(value) {
        const text =
            String(
                value ?? ""
            ).trim();

        if (text === "") {
            return {
                value: null,
                error: null
            };
        }

        const number =
            Number(text);

        if (
            !Number.isFinite(number) ||
            number < 0 ||
            number > 100
        ) {
            return {
                value: null,
                error: "Rate overrides must be between 0 and 100."
            };
        }

        return {
            value: number,
            error: null
        };
    }

    function numberOrNull(value) {
        if (
            value === null ||
            value === undefined ||
            value === ""
        ) {
            return null;
        }

        const number =
            Number(value);

        return Number.isFinite(number)
            ? number
            : null;
    }

    function nullableText(value) {
        const text =
            String(
                value || ""
            ).trim();

        return text || null;
    }

    function formatPercent(value) {
        const number =
            Number(value);

        if (!Number.isFinite(number)) {
            return "—";
        }

        return (
            Number.isInteger(number)
                ? `${number}%`
                : `${number
                    .toFixed(2)
                    .replace(/0+$/,"")
                    .replace(/\.$/,"")}%`
        );
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

        return date.toLocaleDateString(
            undefined,
            {
                year: "numeric",
                month: "short",
                day: "numeric"
            }
        );
    }

    function humanize(value) {
        return String(
            value || ""
        )
            .replace(/_/g," ")
            .replace(
                /\b\w/g,
                char =>
                    char.toUpperCase()
            );
    }

    function escapeHtml(value) {
        return String(
            value ?? ""
        )
            .replace(/&/g,"&amp;")
            .replace(/</g,"&lt;")
            .replace(/>/g,"&gt;")
            .replace(/"/g,"&quot;")
            .replace(/'/g,"&#039;");
    }
})();
