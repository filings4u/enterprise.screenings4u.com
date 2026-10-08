/* ============================================================
   screenings4u — ADMIN DOT TESTS
   Live Supabase management for public.dot_tests
   ============================================================ */

(() => {
    "use strict";

    const PAGE_SIZE = 25;

    let client = null;
    let tests = [];
    let employers = [];
    let employees = [];
    let results = [];
    let employerMap = new Map();
    let employeeMap = new Map();
    let resultMap = new Map();
    let filteredTests = [];
    let currentPage = 1;
    let editingTestId = null;

    const statusLabels = {
        scheduled: "Scheduled",
        notified: "Notified",
        collected: "Collected",
        pending_result: "Pending Result",
        completed: "Completed",
        cancelled: "Cancelled",
        no_show: "No Show"
    };

    const typeLabels = {
        drug: "Drug Test",
        alcohol: "Alcohol Test",
        drug_and_alcohol: "Drug + Alcohol"
    };

    const reasonLabels = {
        pre_employment: "Pre-Employment",
        random: "Random",
        post_accident: "Post-Accident",
        reasonable_suspicion: "Reasonable Suspicion",
        return_to_duty: "Return-to-Duty",
        follow_up: "Follow-Up",
        other: "Other"
    };

    const resultLabels = {
        pending: "Pending",
        negative: "Negative",
        positive: "Positive",
        refusal: "Refusal",
        cancelled: "Cancelled",
        invalid: "Invalid",
        not_reported: "Not Reported"
    };

    const finalResults = new Set([
        "negative",
        "positive",
        "refusal",
        "invalid",
        "cancelled"
    ]);

    const pendingStatuses = new Set([
        "scheduled",
        "notified",
        "collected",
        "pending_result"
    ]);

    const dom = {};

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initialize);
    } else {
        initialize();
    }

    async function initialize() {
        cacheDom();
        bindUi();

        client = getClient();

        if (!client) {
            showPageError("Supabase client was not found. Check assets/js/supabase-config.js.");
            return;
        }

        try {
            await requireSession();
            await loadPageData();
        } catch (error) {
            console.error("DOT tests initialization failed:", error);
            showPageError(error?.message || "Unable to load DOT testing records.");
        }
    }

    function cacheDom() {
        dom.backdrop = document.getElementById("dotTestModalBackdrop");
        dom.form = document.getElementById("dotTestForm");
        dom.modalTitle = document.getElementById("dotTestModalTitle");
        dom.formMessage = document.getElementById("dotFormMessage");
        dom.tbody = document.getElementById("dotTestsTableBody");
        dom.emptyState = document.getElementById("dotTableEmpty");
        dom.emptyTitle = document.getElementById("dotEmptyTitle");
        dom.emptyMessage = document.getElementById("dotEmptyMessage");
        dom.paginationCopy = document.getElementById("dotPaginationCopy");
        dom.prevPage = document.getElementById("dotPrevPage");
        dom.currentPage = document.getElementById("dotCurrentPage");
        dom.nextPage = document.getElementById("dotNextPage");

        dom.search = document.getElementById("dotSearchInput");
        dom.statusFilter = document.getElementById("dotStatusFilter");
        dom.typeFilter = document.getElementById("dotTypeFilter");
        dom.reasonFilter = document.getElementById("dotReasonFilter");
        dom.clearFilters = document.getElementById("dotClearFilters");
        dom.exportButton = document.getElementById("dotExportButton");

        dom.metricTotal = document.getElementById("dotMetricTotal");
        dom.metricPending = document.getElementById("dotMetricPending");
        dom.metricComplete = document.getElementById("dotMetricComplete");
        dom.metricReview = document.getElementById("dotMetricReview");

        dom.fields = {
            id: document.getElementById("dotRecordId"),
            employer: document.getElementById("dotEmployer"),
            employee: document.getElementById("dotEmployee"),
            email: document.getElementById("dotEmployeeEmail"),
            type: document.getElementById("dotTestType"),
            reason: document.getElementById("dotReason"),
            date: document.getElementById("dotScheduledDate"),
            site: document.getElementById("dotCollectionSite"),
            status: document.getElementById("dotStatus"),
            result: document.getElementById("dotResult"),
            notes: document.getElementById("dotNotes")
        };
    }

    function bindUi() {
        document.querySelectorAll("[data-dot-test-open]").forEach(button => {
            button.addEventListener("click", () => openModal());
        });

        document.querySelectorAll("[data-dot-test-close]").forEach(button => {
            button.addEventListener("click", closeModal);
        });

        dom.backdrop?.addEventListener("click", event => {
            if (event.target === dom.backdrop) closeModal();
        });

        document.addEventListener("keydown", event => {
            if (event.key === "Escape" && dom.backdrop?.classList.contains("is-open")) {
                closeModal();
            }
        });

        dom.tbody?.addEventListener("click", event => {
            const button = event.target.closest("[data-dot-edit]");
            if (!button) return;
            openModal(button.dataset.dotEdit);
        });

        dom.search?.addEventListener("input", () => {
            currentPage = 1;
            renderTable();
        });

        [dom.statusFilter, dom.typeFilter, dom.reasonFilter].forEach(control => {
            control?.addEventListener("change", () => {
                currentPage = 1;
                renderTable();
            });
        });

        dom.clearFilters?.addEventListener("click", () => {
            dom.search.value = "";
            dom.statusFilter.value = "";
            dom.typeFilter.value = "";
            dom.reasonFilter.value = "";
            currentPage = 1;
            renderTable();
        });

        dom.prevPage?.addEventListener("click", () => {
            if (currentPage > 1) {
                currentPage -= 1;
                renderCurrentPage();
            }
        });

        dom.nextPage?.addEventListener("click", () => {
            const pages = Math.max(1, Math.ceil(filteredTests.length / PAGE_SIZE));
            if (currentPage < pages) {
                currentPage += 1;
                renderCurrentPage();
            }
        });

        dom.fields.employer?.addEventListener("change", () => {
            populateEmployeeSelect(dom.fields.employer.value, "");
        });

        dom.fields.employee?.addEventListener("change", updateEmployeeEmail);
        dom.form?.addEventListener("submit", saveTest);
        dom.exportButton?.addEventListener("click", exportCsv);
    }

    function getClient() {
        if (typeof window.getScreenings4uSupabase === "function") {
            return window.getScreenings4uSupabase();
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

        return null;
    }

    async function requireSession() {
        if (window.S4UAuth?.getSession) {
            const session = await window.S4UAuth.getSession();
            if (!session?.user) {
                window.location.replace("admin-login.html");
                throw new Error("Authentication required.");
            }
            return session;
        }

        const { data, error } = await client.auth.getSession();
        if (error) throw error;

        if (!data?.session?.user) {
            window.location.replace("admin-login.html");
            throw new Error("Authentication required.");
        }

        return data.session;
    }

    async function loadPageData() {
        setTableLoading();

        await Promise.all([
            loadEmployers(),
            loadEmployees()
        ]);

        buildMaps();
        populateEmployerSelect();

        await loadTests();
        await loadResults();
        buildResultMap();

        updateMetrics();
        currentPage = 1;
        renderTable();
    }

    async function loadEmployers() {
        const { data, error } = await client
            .from("employer_profiles")
            .select("id, employer_name, legal_name, status, dot_number, dot_agency")
            .order("employer_name", { ascending: true });

        if (error) throw error;
        employers = data || [];
    }

    async function loadEmployees() {
        const { data, error } = await client
            .from("employer_employees")
            .select(`
                id,
                employer_id,
                first_name,
                middle_name,
                last_name,
                email,
                employee_number,
                employment_status,
                is_dot_regulated,
                cdl_number,
                cdl_state
            `)
            .order("last_name", { ascending: true })
            .order("first_name", { ascending: true });

        if (error) throw error;
        employees = data || [];
    }

    async function loadTests() {
        const { data, error } = await client
            .from("dot_tests")
            .select(`
                id,
                employer_id,
                employee_id,
                test_reason,
                test_type,
                scheduled_at,
                collected_at,
                collection_site_name,
                collection_site_address,
                collector_name,
                ccf_number,
                status,
                result_status,
                result_received_at,
                notes,
                created_at,
                updated_at
            `)
            .order("created_at", { ascending: false });

        if (error) throw error;
        tests = data || [];
    }

    async function loadResults() {
        results = [];
        if (!tests.length) return;

        const testIds = tests.map(test => test.id);
        const { data, error } = await client
            .from("dot_test_results")
            .select(`
                id,
                test_id,
                result,
                mro_status,
                mro_name,
                verified_at,
                result_date,
                source,
                notes,
                created_at
            `)
            .in("test_id", testIds);

        if (error) {
            console.warn("DOT result details could not be loaded:", error);
            return;
        }

        results = data || [];
    }

    function buildMaps() {
        employerMap = new Map(employers.map(row => [row.id, row]));
        employeeMap = new Map(employees.map(row => [row.id, row]));
    }

    function buildResultMap() {
        resultMap = new Map();
        results.forEach(row => {
            if (!resultMap.has(row.test_id)) {
                resultMap.set(row.test_id, row);
                return;
            }

            const current = resultMap.get(row.test_id);
            if (new Date(row.created_at || 0) > new Date(current.created_at || 0)) {
                resultMap.set(row.test_id, row);
            }
        });
    }

    function populateEmployerSelect(selectedId = "") {
        if (!dom.fields.employer) return;

        const active = employers.filter(row => row.status === "active");
        const current = selectedId || dom.fields.employer.value;

        dom.fields.employer.innerHTML =
            '<option value="">Select employer</option>' +
            active.map(row => `
                <option value="${escapeHtml(row.id)}">
                    ${escapeHtml(row.employer_name || row.legal_name || "Unnamed Employer")}
                </option>
            `).join("");

        if (current && active.some(row => row.id === current)) {
            dom.fields.employer.value = current;
        }
    }

    function populateEmployeeSelect(employerId, selectedId = "") {
        if (!dom.fields.employee) return;

        if (!employerId) {
            dom.fields.employee.disabled = true;
            dom.fields.employee.innerHTML = '<option value="">Select employer first</option>';
            dom.fields.email.value = "";
            return;
        }

        const available = employees.filter(row =>
            row.employer_id === employerId &&
            row.employment_status === "active"
        );

        dom.fields.employee.disabled = false;
        dom.fields.employee.innerHTML =
            '<option value="">Select employee</option>' +
            available.map(row => {
                const dotNote = row.is_dot_regulated ? " · DOT" : "";
                const number = row.employee_number ? ` · ${row.employee_number}` : "";
                return `
                    <option value="${escapeHtml(row.id)}">
                        ${escapeHtml(employeeName(row))}${escapeHtml(number)}${escapeHtml(dotNote)}
                    </option>
                `;
            }).join("");

        if (selectedId && available.some(row => row.id === selectedId)) {
            dom.fields.employee.value = selectedId;
        }

        updateEmployeeEmail();
    }

    function updateEmployeeEmail() {
        const employee = employeeMap.get(dom.fields.employee?.value);
        if (dom.fields.email) {
            dom.fields.email.value = employee?.email || "";
        }
    }

    function updateMetrics() {
        const total = tests.length;
        const pending = tests.filter(test => pendingStatuses.has(test.status)).length;
        const complete = tests.filter(test => test.status === "completed").length;
        const review = tests.filter(test => {
            const result = effectiveResult(test);
            return ["positive", "refusal", "invalid"].includes(result);
        }).length;

        dom.metricTotal.textContent = String(total);
        dom.metricPending.textContent = String(pending);
        dom.metricComplete.textContent = String(complete);
        dom.metricReview.textContent = String(review);
    }

    function renderTable() {
        const query = (dom.search?.value || "").trim().toLowerCase();
        const status = dom.statusFilter?.value || "";
        const type = dom.typeFilter?.value || "";
        const reason = dom.reasonFilter?.value || "";

        filteredTests = tests.filter(test => {
            const employee = employeeMap.get(test.employee_id);
            const employer = employerMap.get(test.employer_id);
            const result = effectiveResult(test);

            const haystack = [
                test.id,
                test.ccf_number,
                employeeName(employee),
                employee?.email,
                employee?.employee_number,
                employee?.cdl_number,
                employer?.employer_name,
                employer?.legal_name,
                employer?.dot_number,
                typeLabels[test.test_type],
                reasonLabels[test.test_reason],
                statusLabels[test.status],
                resultLabels[result],
                test.collection_site_name,
                test.collection_site_address,
                test.collector_name,
                test.notes
            ].filter(Boolean).join(" ").toLowerCase();

            return (
                (!query || haystack.includes(query)) &&
                (!status || test.status === status) &&
                (!type || test.test_type === type) &&
                (!reason || test.test_reason === reason)
            );
        });

        const pages = Math.max(1, Math.ceil(filteredTests.length / PAGE_SIZE));
        if (currentPage > pages) currentPage = pages;
        renderCurrentPage();
    }

    function renderCurrentPage() {
        const total = filteredTests.length;
        const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
        const start = (currentPage - 1) * PAGE_SIZE;
        const pageRows = filteredTests.slice(start, start + PAGE_SIZE);

        dom.tbody.innerHTML = pageRows.map(renderRow).join("");

        const filtersActive = Boolean(
            (dom.search?.value || "").trim() ||
            dom.statusFilter?.value ||
            dom.typeFilter?.value ||
            dom.reasonFilter?.value
        );

        dom.emptyState.style.display = total ? "none" : "block";
        if (!total) {
            dom.emptyTitle.textContent = filtersActive
                ? "No DOT tests match your filters"
                : "No DOT tests found";
            dom.emptyMessage.textContent = filtersActive
                ? "Try changing your search or filters."
                : "Use Add DOT Test to create the first testing record.";
        }

        const shownStart = total ? start + 1 : 0;
        const shownEnd = Math.min(start + PAGE_SIZE, total);
        dom.paginationCopy.textContent = total
            ? `Showing ${shownStart}–${shownEnd} of ${total} record${total === 1 ? "" : "s"}`
            : "Showing 0 records";

        dom.currentPage.textContent = String(currentPage);
        dom.prevPage.disabled = currentPage <= 1;
        dom.nextPage.disabled = currentPage >= pages;
    }

    function renderRow(test) {
        const employee = employeeMap.get(test.employee_id);
        const employer = employerMap.get(test.employer_id);
        const result = effectiveResult(test);
        const employeeDisplay = employeeName(employee) || "Unknown Employee";
        const employerDisplay = employer?.employer_name || employer?.legal_name || "Unknown Employer";
        const recordLabel = test.ccf_number || `DOT-${String(test.id || "").slice(0, 8).toUpperCase()}`;

        return `
            <tr data-dot-row data-id="${escapeHtml(test.id)}">
                <td>
                    <div class="s4u-dot-person">
                        <span class="s4u-dot-person-avatar">${escapeHtml(initials(employeeDisplay))}</span>
                        <span class="s4u-dot-person-copy">
                            <strong>${escapeHtml(employeeDisplay)}</strong>
                            <span>${escapeHtml(recordLabel)}</span>
                        </span>
                    </div>
                </td>
                <td>${escapeHtml(employerDisplay)}</td>
                <td>${escapeHtml(typeLabels[test.test_type] || humanize(test.test_type))}</td>
                <td>${escapeHtml(reasonLabels[test.test_reason] || humanize(test.test_reason))}</td>
                <td>${escapeHtml(formatDate(test.scheduled_at))}</td>
                <td>
                    <span class="${statusClass(test.status)}">
                        ${escapeHtml(statusLabels[test.status] || humanize(test.status))}
                    </span>
                </td>
                <td>
                    <span class="${resultClass(result)}">
                        ${escapeHtml(resultLabels[result] || humanize(result))}
                    </span>
                </td>
                <td>
                    <div class="s4u-dot-actions">
                        <button
                            type="button"
                            class="s4u-dot-icon-action"
                            data-dot-edit="${escapeHtml(test.id)}"
                            aria-label="Edit ${escapeHtml(employeeDisplay)} test"
                        >
                            <svg viewBox="0 0 24 24" aria-hidden="true">
                                <path d="M12 20h9"></path>
                                <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4z"></path>
                            </svg>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }

    function statusClass(status) {
        let visual = "pending";
        if (status === "scheduled") visual = "scheduled";
        if (["notified", "collected", "pending_result"].includes(status)) visual = "pending";
        if (status === "completed") visual = "complete";
        if (["cancelled", "no_show"].includes(status)) visual = "cancelled";
        return `s4u-dot-status s4u-dot-status--${visual}`;
    }

    function resultClass(result) {
        if (result === "negative") return "s4u-dot-result s4u-dot-result--negative";
        if (["positive", "refusal", "invalid"].includes(result)) {
            return "s4u-dot-result s4u-dot-result--positive";
        }
        return "s4u-dot-result s4u-dot-result--pending";
    }

    function effectiveResult(test) {
        const detailed = resultMap.get(test.id)?.result;
        return test.result_status || detailed || "pending";
    }

    function openModal(testId = null) {
        editingTestId = testId || null;
        dom.form.reset();
        clearFormMessage();
        populateEmployerSelect();

        if (editingTestId) {
            const test = tests.find(row => row.id === editingTestId);
            if (!test) return;

            const employee = employeeMap.get(test.employee_id);
            const result = effectiveResult(test);

            dom.modalTitle.textContent = "Edit DOT Test";
            dom.fields.id.value = test.id;
            dom.fields.employer.value = test.employer_id || "";
            populateEmployeeSelect(test.employer_id, test.employee_id);
            dom.fields.email.value = employee?.email || "";
            dom.fields.type.value = test.test_type || "";
            dom.fields.reason.value = test.test_reason || "";
            dom.fields.date.value = toDateTimeLocal(test.scheduled_at);
            dom.fields.site.value = test.collection_site_name || "";
            dom.fields.status.value = test.status || "scheduled";
            dom.fields.result.value = result || "pending";
            dom.fields.notes.value = test.notes || "";
        } else {
            dom.modalTitle.textContent = "Add DOT Test";
            dom.fields.id.value = "";
            dom.fields.employer.value = "";
            populateEmployeeSelect("", "");
            dom.fields.status.value = "scheduled";
            dom.fields.result.value = "pending";
            dom.fields.date.value = "";
        }

        dom.backdrop.classList.add("is-open");
        dom.backdrop.setAttribute("aria-hidden", "false");
        document.body.style.overflow = "hidden";
        setTimeout(() => dom.fields.employer.focus(), 0);
    }

    function closeModal() {
        dom.backdrop?.classList.remove("is-open");
        dom.backdrop?.setAttribute("aria-hidden", "true");
        document.body.style.overflow = "";
        editingTestId = null;
        clearFormMessage();
    }

    async function saveTest(event) {
        event.preventDefault();
        clearFormMessage();

        const employerId = dom.fields.employer.value;
        const employeeId = dom.fields.employee.value;
        const employee = employeeMap.get(employeeId);

        if (!employee || employee.employer_id !== employerId) {
            showFormMessage("The selected employee does not belong to the selected employer.", true);
            return;
        }

        const scheduledAt = dom.fields.date.value
            ? new Date(dom.fields.date.value).toISOString()
            : null;

        const resultStatus = dom.fields.result.value || "pending";

        const payload = {
            employer_id: employerId,
            employee_id: employeeId,
            test_reason: dom.fields.reason.value,
            test_type: dom.fields.type.value,
            scheduled_at: scheduledAt,
            collection_site_name: nullIfBlank(dom.fields.site.value),
            status: dom.fields.status.value,
            result_status: resultStatus,
            notes: nullIfBlank(dom.fields.notes.value)
        };

        if (finalResults.has(resultStatus)) {
            payload.result_received_at = new Date().toISOString();
        } else {
            payload.result_received_at = null;
        }

        const submit = dom.form.querySelector('button[type="submit"]');
        const originalText = submit.innerHTML;
        submit.disabled = true;
        submit.textContent = "Saving...";

        try {
            let testId = editingTestId;

            if (editingTestId) {
                const { error } = await client
                    .from("dot_tests")
                    .update(payload)
                    .eq("id", editingTestId);

                if (error) throw error;
            } else {
                const { data, error } = await client
                    .from("dot_tests")
                    .insert(payload)
                    .select("id")
                    .single();

                if (error) throw error;
                testId = data.id;
            }

            if (finalResults.has(resultStatus)) {
                await saveResultRecord(testId, resultStatus, payload.notes);
            }

            await loadTests();
            await loadResults();
            buildResultMap();
            updateMetrics();
            renderTable();

            showFormMessage("DOT test saved successfully.", false);
            setTimeout(closeModal, 700);
        } catch (error) {
            console.error("Unable to save DOT test:", error);
            showFormMessage(error?.message || "Unable to save DOT test.", true);
        } finally {
            submit.disabled = false;
            submit.innerHTML = originalText;
        }
    }

    async function saveResultRecord(testId, result, notes) {
        const payload = {
            test_id: testId,
            result,
            notes,
            result_date: new Date().toISOString(),
            source: "admin_portal"
        };

        const existing = results.find(row => row.test_id === testId);

        if (existing) {
            const { error } = await client
                .from("dot_test_results")
                .update(payload)
                .eq("id", existing.id);

            if (error) throw error;
            return;
        }

        const { error } = await client
            .from("dot_test_results")
            .insert(payload);

        if (error) throw error;
    }

    function showFormMessage(message, isError) {
        dom.formMessage.textContent = message;
        dom.formMessage.classList.toggle("is-error", Boolean(isError));
        dom.formMessage.classList.add("is-visible");
    }

    function clearFormMessage() {
        dom.formMessage?.classList.remove("is-visible", "is-error");
    }

    function setTableLoading() {
        dom.tbody.innerHTML = `
            <tr>
                <td colspan="8" style="padding:36px;text-align:center;color:#617087;">
                    Loading DOT testing records...
                </td>
            </tr>
        `;
        dom.emptyState.style.display = "none";
        dom.paginationCopy.textContent = "Loading records...";
    }

    function showPageError(message) {
        dom.tbody.innerHTML = `
            <tr>
                <td colspan="8" style="padding:36px;text-align:center;color:#c53030;">
                    ${escapeHtml(message)}
                </td>
            </tr>
        `;
        dom.emptyState.style.display = "none";
        dom.paginationCopy.textContent = "Unable to load records";
    }

    function exportCsv() {
        const rows = filteredTests.length || hasActiveFilters()
            ? filteredTests
            : tests;

        const csvRows = [
            [
                "Record ID",
                "CCF Number",
                "Employee",
                "Employee Email",
                "Employee Number",
                "Employer",
                "Test Type",
                "Reason",
                "Scheduled",
                "Collection Site",
                "Status",
                "Result",
                "Notes"
            ],
            ...rows.map(test => {
                const employee = employeeMap.get(test.employee_id);
                const employer = employerMap.get(test.employer_id);
                const result = effectiveResult(test);

                return [
                    test.id,
                    test.ccf_number || "",
                    employeeName(employee),
                    employee?.email || "",
                    employee?.employee_number || "",
                    employer?.employer_name || employer?.legal_name || "",
                    typeLabels[test.test_type] || test.test_type || "",
                    reasonLabels[test.test_reason] || test.test_reason || "",
                    test.scheduled_at || "",
                    test.collection_site_name || "",
                    statusLabels[test.status] || test.status || "",
                    resultLabels[result] || result || "",
                    test.notes || ""
                ];
            })
        ];

        const csv = csvRows
            .map(values => values.map(csvCell).join(","))
            .join("\n");

        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = "dot-tests.csv";
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
    }

    function hasActiveFilters() {
        return Boolean(
            (dom.search?.value || "").trim() ||
            dom.statusFilter?.value ||
            dom.typeFilter?.value ||
            dom.reasonFilter?.value
        );
    }

    function employeeName(employee) {
        if (!employee) return "";
        return [employee.first_name, employee.middle_name, employee.last_name]
            .filter(Boolean)
            .join(" ")
            .replace(/\s+/g, " ")
            .trim();
    }

    function initials(name) {
        return String(name || "")
            .trim()
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .map(part => part.charAt(0).toUpperCase())
            .join("") || "DT";
    }

    function formatDate(value) {
        if (!value) return "—";
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return String(value);

        return new Intl.DateTimeFormat("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
            hour: "numeric",
            minute: "2-digit"
        }).format(date).replace(",", " ·");
    }

    function toDateTimeLocal(value) {
        if (!value) return "";
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return "";

        const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
        return local.toISOString().slice(0, 16);
    }

    function humanize(value) {
        return String(value || "")
            .replaceAll("_", " ")
            .replace(/\b\w/g, char => char.toUpperCase());
    }

    function nullIfBlank(value) {
        const clean = String(value || "").trim();
        return clean || null;
    }

    function csvCell(value) {
        return `"${String(value ?? "").replaceAll('"', '""')}"`;
    }

    function escapeHtml(value) {
        return String(value ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }
})();
