/* ============================================================
   screenings4u — ADMIN RANDOM PROGRAMS
   assets/js/admin-random-programs.js

   LIVE DATA ONLY.

   Supabase tables used:
   - dot_random_programs
   - dot_random_program_employers
   - dot_random_program_year_stats
   - employer_profiles
   - employer_employees

   No sample program rows, fake metrics, estimated selection totals,
   or hardcoded annual testing percentages are used in the page data.
   ============================================================ */

(() => {
    "use strict";

    const PAGE_SIZE = 20;

    let client = null;

    let programs = [];
    let employers = [];
    let programEmployers = [];
    let employees = [];
    let programYearStats = [];

    let enrichedPrograms = [];
    let filteredPrograms = [];

    let employerMap = new Map();
    let programEmployersMap = new Map();
    let employeesByEmployerMap = new Map();
    let yearStatsMap = new Map();

    let currentPage = 1;
    let editingProgramId = null;

    const dom = {};

    document.addEventListener("DOMContentLoaded", initializeRandomPrograms);

    async function initializeRandomPrograms() {
        cacheDom();
        bindUi();
        setDefaultYear();

        try {
            client = await waitForSupabaseClient();

            if (!client) {
                throw new Error(
                    "Supabase client was not found. Confirm that supabase-config.js loads before admin-random-programs.js."
                );
            }

            await requireAdminSession();
            await loadPageData();
        } catch (error) {
            console.error("Random program initialization failed:", error);
            showTableError(error?.message || "Unable to load random programs.");
        }
    }

    function cacheDom() {
        dom.createButton = document.getElementById("createRandomProgramButton");
        dom.refreshButton = document.getElementById("refreshRandomProgramsButton");
        dom.search = document.getElementById("randomProgramSearch");
        dom.programTypeFilter = document.getElementById("randomProgramTypeFilter");
        dom.poolTypeFilter = document.getElementById("randomPoolTypeFilter");
        dom.statusFilter = document.getElementById("randomStatusFilter");
        dom.clearFilters = document.getElementById("clearRandomProgramFilters");

        dom.tbody = document.getElementById("randomProgramsTableBody");
        dom.resultsCount = document.getElementById("randomProgramResultsCount");
        dom.previous = document.getElementById("randomProgramsPrevious");
        dom.next = document.getElementById("randomProgramsNext");
        dom.page = document.getElementById("randomProgramsPage");

        dom.metricTotal = document.getElementById("randomMetricTotal");
        dom.metricActive = document.getElementById("randomMetricActive");
        dom.metricEnrolledEmployers = document.getElementById("randomMetricEnrolledEmployers");
        dom.metricSelectionPeriods = document.getElementById("randomMetricSelectionPeriods");
        dom.metricSelectionPeriodsCopy = document.getElementById("randomMetricSelectionPeriodsCopy");

        dom.liveStatsTitle = document.getElementById("randomLiveStatsTitle");
        dom.liveEligible = document.getElementById("randomLiveEligible");
        dom.liveDrugProgress = document.getElementById("randomLiveDrugProgress");
        dom.liveAlcoholProgress = document.getElementById("randomLiveAlcoholProgress");
        dom.livePeriods = document.getElementById("randomLivePeriods");

        dom.backdrop = document.getElementById("randomProgramModalBackdrop");
        dom.form = document.getElementById("randomProgramForm");
        dom.modalKicker = document.getElementById("randomProgramModalKicker");
        dom.modalTitle = document.getElementById("randomProgramModalTitle");
        dom.modalSubtitle = document.getElementById("randomProgramModalSubtitle");
        dom.formMessage = document.getElementById("randomProgramFormMessage");
        dom.saveButton = document.getElementById("saveRandomProgramButton");

        dom.fields = {
            id: document.getElementById("randomProgramId"),
            name: document.getElementById("randomProgramName"),
            year: document.getElementById("randomProgramYear"),
            status: document.getElementById("randomProgramStatus"),
            agency: document.getElementById("randomDotAgency"),
            dedicatedEmployer: document.getElementById("randomDedicatedEmployer"),
            drugRate: document.getElementById("randomDrugRate"),
            alcoholRate: document.getElementById("randomAlcoholRate"),
            notes: document.getElementById("randomProgramNotes")
        };

        dom.agencyField = document.getElementById("randomAgencyField");
        dom.dedicatedEmployerField = document.getElementById("randomDedicatedEmployerField");
        dom.rateNote = document.getElementById("randomRateComplianceNote");
    }

    function bindUi() {
        dom.createButton?.addEventListener("click", () => openProgramModal());
        dom.refreshButton?.addEventListener("click", loadPageData);

        document.querySelectorAll("[data-random-program-close]").forEach(button => {
            button.addEventListener("click", closeProgramModal);
        });

        dom.backdrop?.addEventListener("click", event => {
            if (event.target === dom.backdrop) {
                closeProgramModal();
            }
        });

        document.addEventListener("keydown", event => {
            if (
                event.key === "Escape" &&
                dom.backdrop?.classList.contains("is-open")
            ) {
                closeProgramModal();
            }
        });

        dom.search?.addEventListener("input", resetAndRender);
        dom.programTypeFilter?.addEventListener("change", resetAndRender);
        dom.poolTypeFilter?.addEventListener("change", resetAndRender);
        dom.statusFilter?.addEventListener("change", resetAndRender);

        dom.clearFilters?.addEventListener("click", () => {
            dom.search.value = "";
            dom.programTypeFilter.value = "";
            dom.poolTypeFilter.value = "";
            dom.statusFilter.value = "";
            resetAndRender();
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
            const editButton = event.target.closest("[data-edit-random-program]");
            if (!editButton) return;
            openProgramModal(editButton.dataset.editRandomProgram);
        });

        document
            .querySelectorAll('input[name="randomProgramType"]')
            .forEach(input => input.addEventListener("change", syncFormControls));

        document
            .querySelectorAll('input[name="randomPoolType"]')
            .forEach(input => input.addEventListener("change", syncFormControls));

        dom.fields.agency?.addEventListener("change", syncRateCompliance);
        dom.fields.drugRate?.addEventListener("input", syncRateCompliance);
        dom.fields.alcoholRate?.addEventListener("input", syncRateCompliance);

        dom.form?.addEventListener("submit", saveProgram);
    }

    async function waitForSupabaseClient(timeoutMs = 3500) {
        const started = Date.now();

        while (Date.now() - started < timeoutMs) {
            const found = await getSupabaseClient();
            if (found?.from) return found;

            await new Promise(resolve => setTimeout(resolve, 75));
        }

        return null;
    }

    async function getSupabaseClient() {
        try {
            if (typeof window.getScreenings4uSupabase === "function") {
                const result = await window.getScreenings4uSupabase();
                if (result?.from) return result;
            }
        } catch (error) {
            console.warn("getScreenings4uSupabase() was not ready:", error);
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
            window.supabaseClient = window.supabase.createClient(
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
            window.supabaseClient = window.supabase.createClient(
                window.SUPABASE_URL,
                window.SUPABASE_ANON_KEY
            );
            return window.supabaseClient;
        }

        return null;
    }

    async function requireAdminSession() {
        if (window.S4UAuth?.requireSession) {
            const session = await window.S4UAuth.requireSession("admin-login.html");
            if (!session) {
                throw new Error("Authentication required.");
            }
            return;
        }

        const { data, error } = await client.auth.getSession();

        if (error) throw error;

        if (!data?.session?.user) {
            window.location.replace("admin-login.html");
            throw new Error("Authentication required.");
        }
    }

    async function loadPageData() {
        setTableLoading(true);

        try {
            await Promise.all([
                loadEmployers(),
                loadPrograms(),
                loadProgramEmployers(),
                loadEmployees(),
                loadProgramYearStats()
            ]);

            buildDataMaps();
            populateEmployerSelect();

            enrichedPrograms = buildEnrichedPrograms();

            updateMetrics();
            currentPage = 1;
            renderPrograms();
        } catch (error) {
            console.error("Unable to load random programs:", error);
            showTableError(error?.message || "Unable to load random programs.");
        } finally {
            setTableLoading(false, true);
        }
    }

    async function loadEmployers() {
        const { data, error } = await client
            .from("employer_profiles")
            .select(`
                id,
                employer_name,
                legal_name,
                status,
                dot_number,
                dot_agency
            `)
            .order("employer_name", { ascending: true });

        if (error) {
            throw new Error(`Unable to load employers: ${error.message}`);
        }

        employers = data || [];
    }

    async function loadPrograms() {
        const { data, error } = await client
            .from("dot_random_programs")
            .select(`
                id,
                name,
                program_year,
                drug_rate,
                alcohol_rate,
                status,
                notes,
                created_at,
                updated_at,
                dot_agency,
                program_type,
                pool_type,
                dedicated_employer_id
            `)
            .order("program_year", { ascending: false })
            .order("created_at", { ascending: false });

        if (error) {
            throw new Error(`Unable to load random programs: ${error.message}`);
        }

        programs = data || [];
    }

    async function loadProgramEmployers() {
        const { data, error } = await client
            .from("dot_random_program_employers")
            .select(`
                id,
                program_id,
                employer_id,
                enrolled_at,
                status,
                notes,
                drug_enrolled,
                alcohol_enrolled,
                selection_frequency,
                drug_rate,
                alcohol_rate
            `);

        if (error) {
            throw new Error(`Unable to load random program employers: ${error.message}`);
        }

        programEmployers = data || [];
    }

    async function loadEmployees() {
        const { data, error } = await client
            .from("employer_employees")
            .select(`
                id,
                employer_id,
                employment_status,
                is_dot_regulated
            `)
            .eq("employment_status", "active");

        if (error) {
            throw new Error(`Unable to load active employees: ${error.message}`);
        }

        employees = data || [];
    }

    async function loadProgramYearStats() {
        const { data, error } = await client
            .from("dot_random_program_year_stats")
            .select(`
                id,
                program_id,
                program_year,
                eligible_employee_count,
                drug_annual_target,
                drug_selected_to_date,
                alcohol_annual_target,
                alcohol_selected_to_date,
                selection_periods_completed,
                created_at,
                updated_at
            `);

        if (error) {
            throw new Error(`Unable to load random program year statistics: ${error.message}`);
        }

        programYearStats = data || [];
    }

    function buildDataMaps() {
        employerMap = new Map(
            employers.map(employer => [employer.id, employer])
        );

        programEmployersMap = new Map();

        programEmployers.forEach(row => {
            const list = programEmployersMap.get(row.program_id) || [];
            list.push(row);
            programEmployersMap.set(row.program_id, list);
        });

        employeesByEmployerMap = new Map();

        employees.forEach(employee => {
            const list = employeesByEmployerMap.get(employee.employer_id) || [];
            list.push(employee);
            employeesByEmployerMap.set(employee.employer_id, list);
        });

        yearStatsMap = new Map();

        programYearStats.forEach(row => {
            yearStatsMap.set(
                `${row.program_id}:${row.program_year}`,
                row
            );
        });
    }

    function buildEnrichedPrograms() {
        return programs.map(program => {
            const activeEnrollmentRows =
                (programEmployersMap.get(program.id) || [])
                    .filter(row =>
                        String(row.status || "").toLowerCase() === "active"
                    );

            let employerIds = [];

            if (
                program.pool_type === "DEDICATED" &&
                program.dedicated_employer_id
            ) {
                employerIds = [program.dedicated_employer_id];
            } else {
                employerIds = [
                    ...new Set(
                        activeEnrollmentRows
                            .map(row => row.employer_id)
                            .filter(Boolean)
                    )
                ];
            }

            const eligibleIds = new Set();

            employerIds.forEach(employerId => {
                const employerEmployees =
                    employeesByEmployerMap.get(employerId) || [];

                employerEmployees.forEach(employee => {
                    if (
                        program.program_type === "DOT" &&
                        employee.is_dot_regulated !== true
                    ) {
                        return;
                    }

                    eligibleIds.add(employee.id);
                });
            });

            const stats =
                yearStatsMap.get(
                    `${program.id}:${program.program_year}`
                ) || null;

            return {
                ...program,
                employer_count: employerIds.length,
                eligible_employee_count: eligibleIds.size,
                active_enrollments: activeEnrollmentRows,
                year_stats: stats
            };
        });
    }

    function populateEmployerSelect() {
        if (!dom.fields.dedicatedEmployer) return;

        const current = dom.fields.dedicatedEmployer.value;

        const activeEmployers = employers.filter(employer =>
            String(employer.status || "").toLowerCase() === "active"
        );

        dom.fields.dedicatedEmployer.innerHTML =
            '<option value="">Select employer</option>' +
            activeEmployers.map(employer => {
                const name =
                    employer.employer_name ||
                    employer.legal_name ||
                    "Unnamed Employer";

                const dot =
                    employer.dot_number
                        ? ` · ${employer.dot_number}`
                        : "";

                return `
                    <option value="${escapeHtml(employer.id)}">
                        ${escapeHtml(name + dot)}
                    </option>
                `;
            }).join("");

        if (current && employerMap.has(current)) {
            dom.fields.dedicatedEmployer.value = current;
        }
    }

    function updateMetrics() {
        const currentYear = new Date().getFullYear();

        const activePrograms = enrichedPrograms.filter(
            program => String(program.status || "").toLowerCase() === "active"
        );

        const uniqueEmployerIds = new Set();

        activePrograms.forEach(program => {
            if (
                program.pool_type === "DEDICATED" &&
                program.dedicated_employer_id
            ) {
                uniqueEmployerIds.add(program.dedicated_employer_id);
                return;
            }

            (program.active_enrollments || []).forEach(row => {
                if (row.employer_id) {
                    uniqueEmployerIds.add(row.employer_id);
                }
            });
        });

        const currentYearStats = programYearStats.filter(
            row => Number(row.program_year) === currentYear
        );

        const totals = currentYearStats.reduce(
            (acc, row) => {
                acc.eligible += Number(row.eligible_employee_count || 0);
                acc.drugTarget += Number(row.drug_annual_target || 0);
                acc.drugSelected += Number(row.drug_selected_to_date || 0);
                acc.alcoholTarget += Number(row.alcohol_annual_target || 0);
                acc.alcoholSelected += Number(row.alcohol_selected_to_date || 0);
                acc.periods += Number(row.selection_periods_completed || 0);
                return acc;
            },
            {
                eligible: 0,
                drugTarget: 0,
                drugSelected: 0,
                alcoholTarget: 0,
                alcoholSelected: 0,
                periods: 0
            }
        );

        dom.metricTotal.textContent =
            enrichedPrograms.length.toLocaleString();

        dom.metricActive.textContent =
            activePrograms.length.toLocaleString();

        dom.metricEnrolledEmployers.textContent =
            uniqueEmployerIds.size.toLocaleString();

        dom.metricSelectionPeriods.textContent =
            totals.periods.toLocaleString();

        dom.metricSelectionPeriodsCopy.textContent =
            `Completed across ${currentYear} program-year records`;

        dom.liveStatsTitle.textContent =
            `${currentYear} program-year statistics`;

        dom.liveEligible.textContent =
            totals.eligible.toLocaleString();

        dom.liveDrugProgress.textContent =
            `${totals.drugSelected.toLocaleString()} / ${totals.drugTarget.toLocaleString()}`;

        dom.liveAlcoholProgress.textContent =
            `${totals.alcoholSelected.toLocaleString()} / ${totals.alcoholTarget.toLocaleString()}`;

        dom.livePeriods.textContent =
            totals.periods.toLocaleString();
    }

    function resetAndRender() {
        currentPage = 1;
        renderPrograms();
    }

    function renderPrograms() {
        const query = String(dom.search?.value || "")
            .trim()
            .toLowerCase();

        const programType = dom.programTypeFilter?.value || "";
        const poolType = dom.poolTypeFilter?.value || "";
        const status = dom.statusFilter?.value || "";

        filteredPrograms = enrichedPrograms.filter(program => {
            const employer = employerMap.get(program.dedicated_employer_id);

            const haystack = [
                program.name,
                program.program_year,
                program.program_type,
                program.pool_type,
                program.dot_agency,
                program.status,
                program.notes,
                employer?.employer_name,
                employer?.legal_name,
                employer?.dot_number
            ]
                .filter(value => value !== null && value !== undefined)
                .join(" ")
                .toLowerCase();

            const matchesSearch =
                !query || haystack.includes(query);

            const matchesProgramType =
                !programType ||
                program.program_type === programType;

            const matchesPoolType =
                !poolType ||
                program.pool_type === poolType;

            const matchesStatus =
                !status ||
                String(program.status || "").toLowerCase() === status;

            return (
                matchesSearch &&
                matchesProgramType &&
                matchesPoolType &&
                matchesStatus
            );
        });

        const pages = getTotalPages();

        if (currentPage > pages) {
            currentPage = pages;
        }

        renderCurrentPage();
    }

    function renderCurrentPage() {
        if (!dom.tbody) return;

        if (!filteredPrograms.length) {
            dom.tbody.innerHTML = `
                <tr>
                    <td colspan="9" class="random-empty">
                        No random programs match the current filters.
                    </td>
                </tr>
            `;
            updatePagination(0, 0);
            return;
        }

        const start = (currentPage - 1) * PAGE_SIZE;
        const end = start + PAGE_SIZE;
        const pageRows = filteredPrograms.slice(start, end);

        dom.tbody.innerHTML = pageRows
            .map(buildProgramRow)
            .join("");

        updatePagination(start + 1, Math.min(end, filteredPrograms.length));
    }

    function buildProgramRow(program) {
        const dedicatedEmployer =
            employerMap.get(program.dedicated_employer_id);

        const employerName =
            dedicatedEmployer?.employer_name ||
            dedicatedEmployer?.legal_name ||
            "";

        const typeLabel =
            program.program_type === "DOT"
                ? "DOT"
                : "NON-DOT";

        const poolLabel =
            program.pool_type === "DEDICATED"
                ? "Dedicated Employer"
                : "Consortium";

        const drugRate = Number(program.drug_rate || 0);
        const alcoholRate = Number(program.alcohol_rate || 0);
        const livePoolSize = Number(program.eligible_employee_count || 0);
        const stats = program.year_stats;

        const poolSubtext =
            program.pool_type === "DEDICATED"
                ? employerName || "Employer not found"
                : `${program.employer_count || 0} active enrolled employer${Number(program.employer_count) === 1 ? "" : "s"}`;

        const programSubtext = [
            program.dot_agency || "",
            program.pool_type === "DEDICATED"
                ? employerName
                : "Multi-employer pool"
        ]
            .filter(Boolean)
            .join(" · ");

        const statsCopy = stats
            ? `Drug ${Number(stats.drug_selected_to_date || 0).toLocaleString()} / ${Number(stats.drug_annual_target || 0).toLocaleString()} · Alcohol ${Number(stats.alcohol_selected_to_date || 0).toLocaleString()} / ${Number(stats.alcohol_annual_target || 0).toLocaleString()} · ${Number(stats.selection_periods_completed || 0).toLocaleString()} period${Number(stats.selection_periods_completed || 0) === 1 ? "" : "s"}`
            : "No stored program-year statistics yet";

        const poolStatsCopy = stats
            ? `year stats: ${Number(stats.eligible_employee_count || 0).toLocaleString()}`
            : "no year-stat snapshot yet";

        return `
            <tr>
                <td>
                    <div class="random-program-name">
                        <strong>${escapeHtml(program.name || "Unnamed Program")}</strong>
                        <small>${escapeHtml(programSubtext || "Random testing program")}</small>
                    </div>
                </td>

                <td>
                    <strong>${escapeHtml(String(program.program_year || "—"))}</strong>
                </td>

                <td>
                    <span class="random-badge ${
                        program.program_type === "DOT"
                            ? "random-badge--dot"
                            : "random-badge--nondot"
                    }">
                        ${escapeHtml(typeLabel)}
                    </span>
                    <span class="random-cell-subtext">
                        ${escapeHtml(program.dot_agency || "Company Policy")}
                    </span>
                </td>

                <td>
                    <span class="random-badge ${
                        program.pool_type === "DEDICATED"
                            ? "random-badge--dedicated"
                            : "random-badge--consortium"
                    }">
                        ${escapeHtml(poolLabel)}
                    </span>
                    <span class="random-cell-subtext">
                        ${escapeHtml(poolSubtext)}
                    </span>
                </td>

                <td>
                    <div class="random-rates">
                        <span class="random-rate-chip">
                            Drug ${escapeHtml(formatPercent(drugRate))}
                        </span>
                        <span class="random-rate-chip">
                            Alcohol ${escapeHtml(formatPercent(alcoholRate))}
                        </span>
                    </div>
                    <span class="random-cell-subtext">
                        ${escapeHtml(statsCopy)}
                    </span>
                </td>

                <td>
                    <strong>${Number(program.employer_count || 0).toLocaleString()}</strong>
                </td>

                <td>
                    <strong>${livePoolSize.toLocaleString()}</strong>
                    <span class="random-cell-subtext">
                        live active pool · ${escapeHtml(poolStatsCopy)}
                    </span>
                </td>

                <td>
                    <span class="random-badge ${
                        String(program.status).toLowerCase() === "active"
                            ? "random-badge--active"
                            : "random-badge--inactive"
                    }">
                        ${escapeHtml(humanize(program.status || "inactive"))}
                    </span>
                </td>

                <td>
                    <div class="random-actions">
                        <button
                            type="button"
                            class="random-row-button is-primary"
                            data-edit-random-program="${escapeHtml(program.id)}"
                        >
                            Edit
                        </button>

                        ${
                            program.pool_type === "CONSORTIUM"
                                ? `
                                    <a
                                        class="random-row-button"
                                        href="admin-random-program-employers.html?program=${encodeURIComponent(program.id)}"
                                    >
                                        Employers
                                    </a>
                                `
                                : ""
                        }

                        <a
                            class="random-row-button"
                            href="admin-random-selections.html?program=${encodeURIComponent(program.id)}"
                        >
                            Selections
                        </a>
                    </div>
                </td>
            </tr>
        `;
    }

    function updatePagination(start, end) {
        const total = filteredPrograms.length;
        const pages = getTotalPages();

        dom.resultsCount.textContent =
            total === 0
                ? "0 programs"
                : `Showing ${start}–${end} of ${total} program${total === 1 ? "" : "s"}`;

        dom.page.textContent = String(currentPage);
        dom.previous.disabled = currentPage <= 1;
        dom.next.disabled = currentPage >= pages;
    }

    function getTotalPages() {
        return Math.max(
            1,
            Math.ceil(filteredPrograms.length / PAGE_SIZE)
        );
    }

    function openProgramModal(programId = null) {
        editingProgramId = programId || null;

        dom.form.reset();
        clearFormMessage();

        setDefaultYear();
        dom.fields.status.value = "active";
        setRadioValue("randomProgramType", "DOT");
        setRadioValue("randomPoolType", "CONSORTIUM");
        dom.fields.agency.value = "FMCSA";
        dom.fields.drugRate.value = "";
        dom.fields.alcoholRate.value = "";
        dom.fields.dedicatedEmployer.value = "";
        dom.fields.notes.value = "";
        dom.fields.id.value = "";

        if (editingProgramId) {
            const program = enrichedPrograms.find(
                item => item.id === editingProgramId
            );

            if (!program) {
                return;
            }

            dom.modalKicker.textContent = "EDIT PROGRAM";
            dom.modalTitle.textContent = "Edit Random Program";
            dom.modalSubtitle.textContent =
                "Update program structure, rates, status, and internal notes.";

            dom.fields.id.value = program.id;
            dom.fields.name.value = program.name || "";
            dom.fields.year.value = program.program_year || "";
            dom.fields.status.value = program.status || "active";

            setRadioValue(
                "randomProgramType",
                program.program_type || "DOT"
            );

            setRadioValue(
                "randomPoolType",
                program.pool_type || "CONSORTIUM"
            );

            dom.fields.agency.value =
                program.dot_agency || "FMCSA";

            dom.fields.dedicatedEmployer.value =
                program.dedicated_employer_id || "";

            dom.fields.drugRate.value =
                program.drug_rate ?? "";

            dom.fields.alcoholRate.value =
                program.alcohol_rate ?? "";

            dom.fields.notes.value =
                program.notes || "";
        } else {
            dom.modalKicker.textContent = "CREATE PROGRAM";
            dom.modalTitle.textContent = "Create Random Program";
            dom.modalSubtitle.textContent =
                "Configure a DOT or NON-DOT random testing program.";
        }

        syncFormControls();

        dom.backdrop.classList.add("is-open");
        dom.backdrop.setAttribute("aria-hidden", "false");
        document.body.style.overflow = "hidden";

        setTimeout(() => dom.fields.name?.focus(), 0);
    }

    function closeProgramModal() {
        dom.backdrop.classList.remove("is-open");
        dom.backdrop.setAttribute("aria-hidden", "true");
        document.body.style.overflow = "";
        editingProgramId = null;
        clearFormMessage();
    }

    function syncFormControls() {
        const programType = getRadioValue("randomProgramType");
        const poolType = getRadioValue("randomPoolType");

        const isDot = programType === "DOT";
        const isDedicated = poolType === "DEDICATED";

        dom.agencyField.hidden = !isDot;
        dom.fields.agency.disabled = !isDot;
        dom.fields.agency.required = isDot;

        dom.dedicatedEmployerField.hidden = !isDedicated;
        dom.fields.dedicatedEmployer.disabled = !isDedicated;
        dom.fields.dedicatedEmployer.required = isDedicated;

        if (!isDedicated) {
            dom.fields.dedicatedEmployer.value = "";
        }

        syncRateCompliance();
    }

    function syncRateCompliance() {
        const programType = getRadioValue("randomProgramType");
        const agency = dom.fields.agency.value;

        dom.rateNote.classList.remove("is-warning");

        if (programType === "DOT") {
            dom.rateNote.textContent =
                `Enter the annual drug and alcohol rates that apply to this ${agency || "DOT"} program. Existing records load their exact stored Supabase values.`;
            return;
        }

        dom.rateNote.textContent =
            "Enter the annual NON-DOT rates used by this program. These values are stored exactly as entered and are not mixed with DOT programs.";
    }

    async function saveProgram(event) {
        event.preventDefault();
        clearFormMessage();

        const programType = getRadioValue("randomProgramType");
        const poolType = getRadioValue("randomPoolType");

        const name = String(dom.fields.name.value || "").trim();
        const programYear = Number(dom.fields.year.value);
        const rawDrugRate = String(dom.fields.drugRate.value || "").trim();
        const rawAlcoholRate = String(dom.fields.alcoholRate.value || "").trim();

        const drugRate = rawDrugRate === "" ? NaN : Number(rawDrugRate);
        const alcoholRate = rawAlcoholRate === "" ? NaN : Number(rawAlcoholRate);

        if (!name) {
            showFormMessage("Program name is required.", true);
            dom.fields.name.focus();
            return;
        }

        if (
            !Number.isInteger(programYear) ||
            programYear < 2020 ||
            programYear > 2100
        ) {
            showFormMessage("Enter a valid program year.", true);
            dom.fields.year.focus();
            return;
        }

        if (
            !Number.isFinite(drugRate) ||
            drugRate < 0 ||
            drugRate > 100
        ) {
            showFormMessage("Drug rate must be between 0 and 100.", true);
            dom.fields.drugRate.focus();
            return;
        }

        if (
            !Number.isFinite(alcoholRate) ||
            alcoholRate < 0 ||
            alcoholRate > 100
        ) {
            showFormMessage("Alcohol rate must be between 0 and 100.", true);
            dom.fields.alcoholRate.focus();
            return;
        }

        if (
            programType === "DOT" &&
            !dom.fields.agency.value
        ) {
            showFormMessage("Select the DOT agency.", true);
            dom.fields.agency.focus();
            return;
        }

        if (
            poolType === "DEDICATED" &&
            !dom.fields.dedicatedEmployer.value
        ) {
            showFormMessage(
                "Select the employer for this dedicated pool.",
                true
            );
            dom.fields.dedicatedEmployer.focus();
            return;
        }

        const payload = {
            name,
            program_year: programYear,
            drug_rate: drugRate,
            alcohol_rate: alcoholRate,
            status: dom.fields.status.value || "active",
            notes: nullableText(dom.fields.notes.value),
            dot_agency:
                programType === "DOT"
                    ? dom.fields.agency.value
                    : null,
            program_type: programType,
            pool_type: poolType,
            dedicated_employer_id:
                poolType === "DEDICATED"
                    ? dom.fields.dedicatedEmployer.value
                    : null
        };

        const originalText = dom.saveButton.innerHTML;
        dom.saveButton.disabled = true;
        dom.saveButton.textContent =
            editingProgramId
                ? "Saving Changes..."
                : "Creating Program...";

        try {
            let result;

            if (editingProgramId) {
                result = await client
                    .from("dot_random_programs")
                    .update(payload)
                    .eq("id", editingProgramId)
                    .select("id")
                    .single();
            } else {
                result = await client
                    .from("dot_random_programs")
                    .insert(payload)
                    .select("id")
                    .single();
            }

            if (result.error) {
                throw result.error;
            }

            const savedId = result.data?.id || editingProgramId;

            showFormMessage(
                editingProgramId
                    ? "Random program updated successfully."
                    : "Random program created successfully.",
                false
            );

            await loadPageData();

            if (!editingProgramId && savedId) {
                editingProgramId = savedId;
                dom.fields.id.value = savedId;
                dom.modalKicker.textContent = "PROGRAM CREATED";
                dom.modalTitle.textContent = "Edit Random Program";
                dom.modalSubtitle.textContent =
                    "The program is saved. You can make additional changes or manage employers after closing.";
            }

            setTimeout(() => {
                closeProgramModal();
            }, 650);
        } catch (error) {
            console.error("Unable to save random program:", error);

            showFormMessage(
                readableDatabaseError(error),
                true
            );
        } finally {
            dom.saveButton.disabled = false;
            dom.saveButton.innerHTML = originalText;
        }
    }

    function readableDatabaseError(error) {
        const message = String(error?.message || "");

        if (
            message.includes("dot_random_programs_pool_type_employer_check")
        ) {
            return "Dedicated programs require an employer, while consortium programs cannot have a dedicated employer.";
        }

        if (
            message.includes("dot_random_programs_type_agency_check")
        ) {
            return "DOT programs require a DOT agency. NON-DOT programs must not have a DOT agency.";
        }

        if (
            message.includes("dot_random_programs_type_check")
        ) {
            return "Program type must be DOT or NON-DOT.";
        }

        if (
            message.includes("dot_random_programs_pool_type_check")
        ) {
            return "Pool type must be Consortium or Dedicated.";
        }

        return message || "Unable to save the random program.";
    }

    function setDefaultYear() {
        if (!dom.fields?.year) return;

        if (!dom.fields.year.value) {
            dom.fields.year.value =
                String(new Date().getFullYear());
        }
    }

    function setTableLoading(isLoading, preserve = false) {
        if (!dom.tbody || !isLoading || preserve) return;

        dom.tbody.innerHTML = `
            <tr>
                <td colspan="9" class="random-loading">
                    Loading random programs...
                </td>
            </tr>
        `;
    }

    function showTableError(message) {
        if (!dom.tbody) return;

        dom.tbody.innerHTML = `
            <tr>
                <td colspan="9" class="random-error-row">
                    ${escapeHtml(message)}
                </td>
            </tr>
        `;

        if (dom.resultsCount) {
            dom.resultsCount.textContent = "Unable to load programs";
        }
    }

    function showFormMessage(message, isError) {
        if (!dom.formMessage) return;

        dom.formMessage.textContent = message;
        dom.formMessage.classList.toggle("is-error", Boolean(isError));
        dom.formMessage.classList.add("is-visible");
    }

    function clearFormMessage() {
        if (!dom.formMessage) return;

        dom.formMessage.textContent = "";
        dom.formMessage.classList.remove("is-visible", "is-error");
    }

    function getRadioValue(name) {
        return (
            document.querySelector(
                `input[name="${CSS.escape(name)}"]:checked`
            )?.value || ""
        );
    }

    function setRadioValue(name, value) {
        const input = document.querySelector(
            `input[name="${CSS.escape(name)}"][value="${CSS.escape(value)}"]`
        );

        if (input) {
            input.checked = true;
        }
    }

    function nullableText(value) {
        const text = String(value || "").trim();
        return text || null;
    }

    function formatPercent(value) {
        const number = Number(value || 0);

        return Number.isInteger(number)
            ? `${number}%`
            : `${number.toFixed(2).replace(/0+$/, "").replace(/\.$/, "")}%`;
    }

    function humanize(value) {
        return String(value || "")
            .replace(/_/g, " ")
            .replace(/\b\w/g, char => char.toUpperCase());
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
