/* ============================================================
   screenings4u — ADMIN TEST RESULTS
   Live Supabase management for:
   - public.dot_test_results
   - public.dot_tests
   - public.dot_test_result_documents
   - private Storage bucket: dot-test-results
   ============================================================ */

(() => {
    "use strict";

    const PAGE_SIZE = 25;
    const DOCUMENT_BUCKET = "dot-test-results";
    const DOCUMENT_TABLE = "dot_test_result_documents";
    const MAX_DOCUMENT_BYTES = 25 * 1024 * 1024;
    const ALLOWED_DOCUMENT_TYPES = new Set([
        "application/pdf",
        "image/jpeg",
        "image/png",
        "image/webp"
    ]);

    let client = null;
    let results = [];
    let documents = [];
    let tests = [];
    let employers = [];
    let employees = [];
    let filteredResults = [];

    let employerMap = new Map();
    let employeeMap = new Map();
    let testMap = new Map();
    let resultByTestMap = new Map();
    let documentsByResultMap = new Map();

    let currentPage = 1;
    let editingResultId = null;
    let documentsFeatureReady = true;
    let documentSetupError = "";

    const resultLabels = {
        negative: "Negative",
        positive: "Positive",
        refusal: "Refusal",
        invalid: "Invalid",
        cancelled: "Cancelled"
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

    const sourceLabels = {
        admin_portal: "Admin Portal",
        lab: "Laboratory",
        mro: "Medical Review Officer (MRO)",
        collection_site: "Collection Site",
        import: "Imported Record",
        other: "Other"
    };

    const mroLabels = {
        pending: "Pending Review",
        verified: "Verified",
        not_required: "Not Required"
    };

    const alcoholOutcomeLabels = {
        negative: "Negative",
        positive: "Positive",
        below_002: "Below 0.02",
        "002_to_0039": "0.02 – 0.039",
        "004_or_higher": "0.04 or Higher",
        refusal: "Refusal",
        invalid: "Invalid",
        cancelled: "Cancelled",
        not_reported: "Not Reported"
    };

    const dom = {};

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initialize);
    } else {
        initialize();
    }

    async function initialize() {
        cacheDom();
        bindUi();

        try {
            client = await waitForClient();

            if (!client) {
                throw new Error(
                    "Supabase client was not found. Check assets/js/supabase-config.js and make sure it loads before admin-test-results.js."
                );
            }

            await requireSession();
            await loadPageData();
            openResultFromQueryString();
        } catch (error) {
            console.error("Test results initialization failed:", error);
            showPageError(error?.message || "Unable to load test results.");
        }
    }

    function cacheDom() {
        dom.backdrop = document.getElementById("testResultModalBackdrop");
        dom.form = document.getElementById("testResultForm");
        dom.modalTitle = document.getElementById("testResultModalTitle");
        dom.formMessage = document.getElementById("testResultFormMessage");
        dom.tbody = document.getElementById("testResultsTableBody");
        dom.empty = document.getElementById("testResultsEmpty");
        dom.emptyTitle = document.getElementById("testResultsEmptyTitle");
        dom.emptyMessage = document.getElementById("testResultsEmptyMessage");

        dom.search = document.getElementById("resultSearchInput");
        dom.resultFilter = document.getElementById("resultOutcomeFilter");
        dom.typeFilter = document.getElementById("resultTypeFilter");
        dom.mroFilter = document.getElementById("resultMroFilter");
        dom.clearFilters = document.getElementById("resultClearFilters");
        dom.exportButton = document.getElementById("resultExportButton");

        dom.metricTotal = document.getElementById("resultMetricTotal");
        dom.metricNegative = document.getElementById("resultMetricNegative");
        dom.metricReview = document.getElementById("resultMetricReview");
        dom.metricAwaiting = document.getElementById("resultMetricAwaiting");

        dom.paginationCopy = document.getElementById("testResultsPaginationCopy");
        dom.prevPage = document.getElementById("testResultsPrevPage");
        dom.currentPage = document.getElementById("testResultsCurrentPage");
        dom.nextPage = document.getElementById("testResultsNextPage");

        dom.fields = {
            id: document.getElementById("testResultRecordId"),
            testId: document.getElementById("testResultTestId"),
            employee: document.getElementById("testResultEmployee"),
            employer: document.getElementById("testResultEmployer"),
            result: document.getElementById("testResultOutcome"),
            resultDate: document.getElementById("testResultDate"),
            source: document.getElementById("testResultSource"),
            mroStatus: document.getElementById("testResultMroStatus"),
            mroName: document.getElementById("testResultMroName"),
            verifiedAt: document.getElementById("testResultVerifiedAt"),
            drugPanel: document.getElementById("testResultDrugPanel"),
            drugOutcome: document.getElementById("testResultDrugOutcome"),
            drugSpecimen: document.getElementById("testResultDrugSpecimen"),
            drugLab: document.getElementById("testResultDrugLab"),
            alcoholOutcome: document.getElementById("testResultAlcoholOutcome"),
            alcoholConcentration: document.getElementById("testResultAlcoholConcentration"),
            alcoholDevice: document.getElementById("testResultAlcoholDevice"),
            alcoholConfirmation: document.getElementById("testResultAlcoholConfirmation"),
            notes: document.getElementById("testResultNotes")
        };

        dom.drugDetails = document.getElementById("testResultDrugDetails");
        dom.alcoholDetails = document.getElementById("testResultAlcoholDetails");

        dom.documentsLocked = document.getElementById("testResultDocumentsLocked");
        dom.documentManager = document.getElementById("testResultDocumentManager");
        dom.documentType = document.getElementById("testResultDocumentType");
        dom.documentVisibility = document.getElementById("testResultDocumentVisibility");
        dom.documentVisibilityHelp = document.getElementById("testResultDocumentVisibilityHelp");
        dom.documentFile = document.getElementById("testResultDocumentFile");
        dom.uploadDocument = document.getElementById("testResultUploadDocument");
        dom.documentMessage = document.getElementById("testResultDocumentMessage");
        dom.documentList = document.getElementById("testResultDocumentList");
    }

    function bindUi() {
        document.querySelectorAll("[data-test-result-open]").forEach(button => {
            button.addEventListener("click", () => openModal());
        });

        document.querySelectorAll("[data-test-result-close]").forEach(button => {
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
            const button = event.target.closest("[data-result-edit]");
            if (!button) return;
            openModal(button.dataset.resultEdit);
        });

        dom.fields.testId?.addEventListener("change", () => {
            updateSelectedTestSummary();
            updateDetailVisibility();
        });

        dom.form?.addEventListener("submit", saveResult);

        dom.search?.addEventListener("input", resetAndRender);
        dom.resultFilter?.addEventListener("change", resetAndRender);
        dom.typeFilter?.addEventListener("change", resetAndRender);
        dom.mroFilter?.addEventListener("change", resetAndRender);

        dom.clearFilters?.addEventListener("click", () => {
            dom.search.value = "";
            dom.resultFilter.value = "";
            dom.typeFilter.value = "";
            dom.mroFilter.value = "";
            currentPage = 1;
            renderTable();
        });

        dom.prevPage?.addEventListener("click", () => {
            if (currentPage <= 1) return;
            currentPage -= 1;
            renderCurrentPage();
        });

        dom.nextPage?.addEventListener("click", () => {
            const pages = Math.max(1, Math.ceil(filteredResults.length / PAGE_SIZE));
            if (currentPage >= pages) return;
            currentPage += 1;
            renderCurrentPage();
        });

        dom.exportButton?.addEventListener("click", exportCsv);
        dom.uploadDocument?.addEventListener("click", uploadResultDocument);
        dom.documentVisibility?.addEventListener("change", updateDocumentVisibilityHelp);

        dom.documentList?.addEventListener("click", event => {
            const openButton = event.target.closest("[data-document-open]");
            if (openButton) {
                openResultDocument(openButton.dataset.documentOpen);
                return;
            }

            const deleteButton = event.target.closest("[data-document-delete]");
            if (deleteButton) {
                deleteResultDocument(deleteButton.dataset.documentDelete);
            }
        });
    }

    function resetAndRender() {
        currentPage = 1;
        renderTable();
    }

    function getClient() {
        if (typeof window.getScreenings4uSupabase === "function") {
            const existing = window.getScreenings4uSupabase();
            if (existing?.from) return existing;
        }

        if (window.screenings4uSupabase?.from) return window.screenings4uSupabase;
        if (window.supabaseClient?.from) return window.supabaseClient;

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

    async function waitForClient(timeoutMs = 3500) {
        const started = Date.now();

        while (Date.now() - started < timeoutMs) {
            const found = getClient();
            if (found?.from) return found;
            await wait(80);
        }

        return getClient();
    }

    function wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
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

        if (!client?.auth?.getSession) return null;

        const { data, error } = await client.auth.getSession();
        if (error) throw error;

        if (!data?.session?.user) {
            window.location.replace("admin-login.html");
            throw new Error("Authentication required.");
        }

        return data.session;
    }

    async function loadPageData() {
        setLoading();

        await Promise.all([
            loadEmployers(),
            loadEmployees(),
            loadTests(),
            loadResults()
        ]);

        buildMaps();

        // Result documents are intentionally non-fatal. The page can still
        // manage result data if the private-document SQL has not been run yet.
        await loadDocuments();
        buildDocumentMap();

        populateTestSelect();
        updateMetrics();
        currentPage = 1;
        renderTable();
    }

    async function loadEmployers() {
        const { data, error } = await client
            .from("employer_profiles")
            .select("id, employer_name, legal_name, status, dot_number, dot_agency")
            .order("employer_name", { ascending: true });

        if (error) throw new Error(`Unable to load employers: ${error.message}`);
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
                cdl_state,
                user_id
            `)
            .order("last_name", { ascending: true })
            .order("first_name", { ascending: true });

        if (error) throw new Error(`Unable to load employees: ${error.message}`);
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

        if (error) throw new Error(`Unable to load DOT tests: ${error.message}`);
        tests = data || [];
    }

    async function loadResults() {
        const { data, error } = await client
            .from("dot_test_results")
            .select(`
                id,
                test_id,
                result,
                drug_result,
                alcohol_result,
                mro_status,
                mro_name,
                verified_at,
                result_date,
                source,
                notes,
                created_at
            `)
            .order("created_at", { ascending: false });

        if (error) throw new Error(`Unable to load test results: ${error.message}`);
        results = data || [];
    }

    async function loadDocuments() {
        const { data, error } = await client
            .from(DOCUMENT_TABLE)
            .select(`
                id,
                result_id,
                test_id,
                employer_id,
                employee_id,
                document_type,
                visibility,
                storage_bucket,
                storage_path,
                original_name,
                mime_type,
                size_bytes,
                uploaded_by,
                created_at
            `)
            .order("created_at", { ascending: false });

        if (error) {
            documents = [];
            documentsFeatureReady = false;
            documentSetupError = error.message || "Private document storage is not available.";
            console.warn(
                "Private DOT result documents are not ready. Run dot-test-results-private-storage.sql.",
                error
            );
            return;
        }

        documentsFeatureReady = true;
        documentSetupError = "";
        documents = data || [];
    }

    function buildMaps() {
        employerMap = new Map(employers.map(row => [row.id, row]));
        employeeMap = new Map(employees.map(row => [row.id, row]));
        testMap = new Map(tests.map(row => [row.id, row]));
        resultByTestMap = new Map();

        results.forEach(row => {
            if (!resultByTestMap.has(row.test_id)) {
                resultByTestMap.set(row.test_id, row);
            }
        });
    }

    function buildDocumentMap() {
        documentsByResultMap = new Map();

        documents.forEach(row => {
            const list = documentsByResultMap.get(row.result_id) || [];
            list.push(row);
            documentsByResultMap.set(row.result_id, list);
        });
    }

    function updateMetrics() {
        const total = results.length;
        const negative = results.filter(row => row.result === "negative").length;
        const review = results.filter(row => ["positive", "refusal"].includes(row.result)).length;
        const awaiting = tests.filter(test => {
            const hasResult = resultByTestMap.has(test.id);
            const finalStatus = ["negative", "positive", "refusal", "cancelled", "invalid"].includes(
                String(test.result_status || "").toLowerCase()
            );
            return !hasResult && !finalStatus;
        }).length;

        dom.metricTotal.textContent = String(total);
        dom.metricNegative.textContent = String(negative);
        dom.metricReview.textContent = String(review);
        dom.metricAwaiting.textContent = String(awaiting);
    }

    function renderTable() {
        const query = String(dom.search?.value || "").trim().toLowerCase();
        const resultFilter = dom.resultFilter?.value || "";
        const typeFilter = dom.typeFilter?.value || "";
        const mroFilter = dom.mroFilter?.value || "";

        filteredResults = results.filter(resultRow => {
            const test = testMap.get(resultRow.test_id);
            const employee = employeeMap.get(test?.employee_id);
            const employer = employerMap.get(test?.employer_id);
            const mroStatus = String(resultRow.mro_status || "").trim().toLowerCase();

            const haystack = [
                resultRow.id,
                resultRow.test_id,
                resultRow.result,
                resultLabels[resultRow.result],
                mroLabels[resultRow.mro_status],
                resultRow.mro_status,
                resultRow.mro_name,
                sourceLabels[resultRow.source],
                resultRow.source,
                resultRow.notes,
                friendlyDrugSummary(resultRow.drug_result),
                friendlyAlcoholSummary(resultRow.alcohol_result),
                test?.ccf_number,
                test?.test_type,
                typeLabels[test?.test_type],
                test?.test_reason,
                reasonLabels[test?.test_reason],
                employeeName(employee),
                employee?.email,
                employee?.employee_number,
                employee?.cdl_number,
                employer?.employer_name,
                employer?.legal_name,
                employer?.dot_number
            ].filter(Boolean).join(" ").toLowerCase();

            const matchesMro = !mroFilter || (
                mroFilter === "__blank__"
                    ? !mroStatus
                    : mroStatus === mroFilter
            );

            return (
                (!query || haystack.includes(query)) &&
                (!resultFilter || resultRow.result === resultFilter) &&
                (!typeFilter || test?.test_type === typeFilter) &&
                matchesMro
            );
        });

        const pages = Math.max(1, Math.ceil(filteredResults.length / PAGE_SIZE));
        if (currentPage > pages) currentPage = pages;
        renderCurrentPage();
    }

    function renderCurrentPage() {
        const total = filteredResults.length;
        const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
        const start = (currentPage - 1) * PAGE_SIZE;
        const pageRows = filteredResults.slice(start, start + PAGE_SIZE);

        dom.tbody.innerHTML = pageRows.map(renderRow).join("");

        const filtersActive = Boolean(
            String(dom.search?.value || "").trim() ||
            dom.resultFilter?.value ||
            dom.typeFilter?.value ||
            dom.mroFilter?.value
        );

        dom.empty.style.display = total ? "none" : "block";

        if (!total) {
            dom.emptyTitle.textContent = filtersActive
                ? "No test results match your filters"
                : "No test results found";

            dom.emptyMessage.textContent = filtersActive
                ? "Try changing the search or filters."
                : "Use Add Test Result to create the first result record.";
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

    function renderRow(resultRow) {
        const test = testMap.get(resultRow.test_id);
        const employee = employeeMap.get(test?.employee_id);
        const employer = employerMap.get(test?.employer_id);
        const name = employeeName(employee) || "Unknown Employee";
        const employerNameValue = employer?.employer_name || employer?.legal_name || "Unknown Employer";
        const testLabel = test?.ccf_number || `DOT-${String(resultRow.test_id || "").slice(0, 8).toUpperCase()}`;
        const mroStatus = mroLabels[resultRow.mro_status] || humanize(resultRow.mro_status) || "Not Set";
        const documentCount = (documentsByResultMap.get(resultRow.id) || []).length;

        return `
            <tr>
                <td>
                    <div class="s4u-results-person">
                        <span class="s4u-results-avatar">${escapeHtml(initials(name))}</span>
                        <span class="s4u-results-person-copy">
                            <strong>${escapeHtml(name)}</strong>
                            <span>${escapeHtml(employee?.email || employee?.employee_number || "No employee email")}</span>
                        </span>
                    </div>
                </td>
                <td>${escapeHtml(employerNameValue)}</td>
                <td>
                    <strong style="display:block;color:#24467f;font-size:11px;">${escapeHtml(typeLabels[test?.test_type] || humanize(test?.test_type) || "Unknown Test")}</strong>
                    <span style="display:block;margin-top:3px;color:#617087;font-size:10px;">${escapeHtml(testLabel)}</span>
                </td>
                <td>${escapeHtml(reasonLabels[test?.test_reason] || humanize(test?.test_reason) || "—")}</td>
                <td>
                    <span class="${resultBadgeClass(resultRow.result)}">
                        ${escapeHtml(resultLabels[resultRow.result] || humanize(resultRow.result))}
                    </span>
                </td>
                <td>${escapeHtml(formatDate(resultRow.result_date || resultRow.created_at))}</td>
                <td><span class="s4u-mro-badge">${escapeHtml(mroStatus)}</span></td>
                <td>
                    <span class="s4u-result-document-count" title="${documentCount} private document${documentCount === 1 ? "" : "s"}">
                        ${documentCount}
                    </span>
                </td>
                <td>
                    <div class="s4u-results-actions">
                        <button
                            type="button"
                            class="s4u-results-icon-action"
                            data-result-edit="${escapeHtml(resultRow.id)}"
                            aria-label="Edit ${escapeHtml(name)} result"
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

    function resultBadgeClass(result) {
        const normalized = String(result || "").toLowerCase();
        return `s4u-result-badge s4u-result-badge--${normalized || "cancelled"}`;
    }

    function populateTestSelect(selectedTestId = "") {
        if (!dom.fields.testId) return;

        const current = selectedTestId || dom.fields.testId.value;

        const available = tests.filter(test => {
            if (editingResultId && test.id === current) return true;
            return !resultByTestMap.has(test.id);
        });

        dom.fields.testId.innerHTML =
            '<option value="">Select DOT test</option>' +
            available.map(test => {
                const employee = employeeMap.get(test.employee_id);
                const employer = employerMap.get(test.employer_id);
                const label = [
                    employeeName(employee) || "Unknown Employee",
                    employer?.employer_name || employer?.legal_name || "Unknown Employer",
                    typeLabels[test.test_type] || humanize(test.test_type),
                    test.ccf_number || formatDateOnly(test.scheduled_at)
                ].filter(Boolean).join(" · ");

                return `<option value="${escapeHtml(test.id)}">${escapeHtml(label)}</option>`;
            }).join("");

        if (current && available.some(test => test.id === current)) {
            dom.fields.testId.value = current;
        }

        updateSelectedTestSummary();
        updateDetailVisibility();
    }

    function updateSelectedTestSummary() {
        const test = testMap.get(dom.fields.testId?.value);
        const employee = employeeMap.get(test?.employee_id);
        const employer = employerMap.get(test?.employer_id);

        dom.fields.employee.value = test
            ? employeeName(employee) || "Unknown Employee"
            : "";

        dom.fields.employer.value = test
            ? employer?.employer_name || employer?.legal_name || "Unknown Employer"
            : "";
    }

    function updateDetailVisibility() {
        const test = testMap.get(dom.fields.testId?.value);
        const type = test?.test_type || "";

        if (dom.drugDetails) {
            dom.drugDetails.hidden = type === "alcohol";
        }

        if (dom.alcoholDetails) {
            dom.alcoholDetails.hidden = type === "drug";
        }
    }

    function openModal(resultId = null, preselectedTestId = "") {
        editingResultId = resultId || null;

        dom.form.reset();
        clearFormMessage();
        resetFriendlyDetails();
        resetDocumentControls();

        dom.fields.id.value = "";
        dom.fields.source.value = "admin_portal";
        dom.fields.resultDate.value = toDateTimeLocal(new Date().toISOString());

        if (editingResultId) {
            const resultRow = results.find(row => row.id === editingResultId);
            if (!resultRow) return;

            dom.modalTitle.textContent = "Edit Test Result";
            dom.fields.id.value = resultRow.id;

            populateTestSelect(resultRow.test_id);
            dom.fields.testId.value = resultRow.test_id;
            dom.fields.testId.disabled = true;

            setSelectValue(dom.fields.result, resultRow.result || "");
            dom.fields.resultDate.value = toDateTimeLocal(resultRow.result_date || resultRow.created_at);
            setSelectValue(dom.fields.source, resultRow.source || "");
            setSelectValue(dom.fields.mroStatus, resultRow.mro_status || "");
            dom.fields.mroName.value = resultRow.mro_name || "";
            dom.fields.verifiedAt.value = toDateTimeLocal(resultRow.verified_at);
            dom.fields.notes.value = resultRow.notes || "";

            populateFriendlyDrugDetails(resultRow.drug_result);
            populateFriendlyAlcoholDetails(resultRow.alcohol_result);

            updateSelectedTestSummary();
            updateDetailVisibility();
            enableDocumentManager();
            renderResultDocuments(editingResultId);
        } else {
            dom.modalTitle.textContent = "Add Test Result";
            dom.fields.testId.disabled = false;
            populateTestSelect(preselectedTestId);

            if (preselectedTestId && testMap.has(preselectedTestId)) {
                dom.fields.testId.value = preselectedTestId;
                updateSelectedTestSummary();
                updateDetailVisibility();
            }

            disableDocumentManagerForNew();
        }

        dom.backdrop.classList.add("is-open");
        dom.backdrop.setAttribute("aria-hidden", "false");
        document.body.style.overflow = "hidden";

        setTimeout(() => {
            if (editingResultId) {
                dom.fields.result?.focus();
            } else {
                dom.fields.testId?.focus();
            }
        }, 0);
    }

    function closeModal() {
        dom.backdrop?.classList.remove("is-open");
        dom.backdrop?.setAttribute("aria-hidden", "true");
        document.body.style.overflow = "";
        dom.fields.testId.disabled = false;
        editingResultId = null;
        clearFormMessage();
        clearDocumentMessage();
    }

    async function saveResult(event) {
        event.preventDefault();
        clearFormMessage();

        const testId = dom.fields.testId.value;
        const test = testMap.get(testId);

        if (!test) {
            showFormMessage("Select a valid DOT test.", true);
            return;
        }

        if (!dom.fields.result.value) {
            showFormMessage("Select the overall test result.", true);
            return;
        }

        const existingRow = editingResultId
            ? results.find(row => row.id === editingResultId)
            : null;

        const drugResult = buildDrugResultObject(existingRow?.drug_result);
        const alcoholResult = buildAlcoholResultObject(existingRow?.alcohol_result);

        const resultDate = dom.fields.resultDate.value
            ? new Date(dom.fields.resultDate.value).toISOString()
            : new Date().toISOString();

        const verifiedAt = dom.fields.verifiedAt.value
            ? new Date(dom.fields.verifiedAt.value).toISOString()
            : null;

        const payload = {
            test_id: testId,
            result: dom.fields.result.value,
            drug_result: drugResult,
            alcohol_result: alcoholResult,
            mro_status: nullIfBlank(dom.fields.mroStatus.value),
            mro_name: nullIfBlank(dom.fields.mroName.value),
            verified_at: verifiedAt,
            result_date: resultDate,
            source: nullIfBlank(dom.fields.source.value),
            notes: nullIfBlank(dom.fields.notes.value)
        };

        const submit = dom.form.querySelector('button[type="submit"]');
        const originalHtml = submit.innerHTML;
        submit.disabled = true;
        submit.textContent = "Saving...";

        try {
            let savedId = editingResultId;

            if (editingResultId) {
                const { data, error } = await client
                    .from("dot_test_results")
                    .update(payload)
                    .eq("id", editingResultId)
                    .select("id")
                    .single();

                if (error) throw error;
                savedId = data?.id || editingResultId;
            } else {
                if (resultByTestMap.has(testId)) {
                    throw new Error("This DOT test already has a result record. Edit the existing result instead.");
                }

                const { data, error } = await client
                    .from("dot_test_results")
                    .insert(payload)
                    .select("id")
                    .single();

                if (error) throw error;
                savedId = data?.id;
            }

            const dotTestUpdate = {
                result_status: payload.result,
                result_received_at: resultDate,
                status: payload.result === "cancelled" ? "cancelled" : "completed"
            };

            const { error: testUpdateError } = await client
                .from("dot_tests")
                .update(dotTestUpdate)
                .eq("id", testId);

            if (testUpdateError) {
                throw new Error(
                    `Result saved, but DOT test status could not be synchronized: ${testUpdateError.message}`
                );
            }

            await Promise.all([
                loadTests(),
                loadResults()
            ]);

            buildMaps();
            await loadDocuments();
            buildDocumentMap();

            populateTestSelect(savedId ? testId : "");
            updateMetrics();
            renderTable();

            if (savedId) {
                editingResultId = savedId;
                dom.fields.id.value = savedId;
                dom.fields.testId.value = testId;
                dom.fields.testId.disabled = true;
                dom.modalTitle.textContent = "Edit Test Result";
                enableDocumentManager();
                renderResultDocuments(savedId);
            }

            showFormMessage(
                "Test result saved successfully. You can upload the private result document below.",
                false
            );
        } catch (error) {
            console.error("Unable to save test result:", error);
            showFormMessage(error?.message || "Unable to save test result.", true);
        } finally {
            submit.disabled = false;
            submit.innerHTML = originalHtml;
        }
    }

    function resetFriendlyDetails() {
        if (dom.fields.drugPanel) dom.fields.drugPanel.value = "";
        if (dom.fields.drugOutcome) dom.fields.drugOutcome.value = "";
        if (dom.fields.drugSpecimen) dom.fields.drugSpecimen.value = "";
        if (dom.fields.drugLab) dom.fields.drugLab.value = "";

        if (dom.fields.alcoholOutcome) dom.fields.alcoholOutcome.value = "";
        if (dom.fields.alcoholConcentration) dom.fields.alcoholConcentration.value = "";
        if (dom.fields.alcoholDevice) dom.fields.alcoholDevice.value = "";
        if (dom.fields.alcoholConfirmation) dom.fields.alcoholConfirmation.value = "";
    }

    function populateFriendlyDrugDetails(value) {
        const data = objectValue(value);

        dom.fields.drugPanel.value =
            stringValue(data.panel || data.test_panel || data.panel_name);

        setSelectValue(
            dom.fields.drugOutcome,
            stringValue(data.result || data.outcome || data.status).toLowerCase()
        );

        setSelectValue(
            dom.fields.drugSpecimen,
            normalizeSpecimen(data.specimen_type || data.specimen || data.sample_type)
        );

        dom.fields.drugLab.value =
            stringValue(data.lab_name || data.lab || data.laboratory || data.detail || data.notes);
    }

    function populateFriendlyAlcoholDetails(value) {
        const data = objectValue(value);

        const rawOutcome = stringValue(
            data.result || data.outcome || data.status || data.classification
        ).toLowerCase();

        setSelectValue(
            dom.fields.alcoholOutcome,
            normalizeAlcoholOutcome(rawOutcome)
        );

        const concentration =
            data.concentration ??
            data.bac ??
            data.alcohol_concentration ??
            data.value ??
            "";

        dom.fields.alcoholConcentration.value =
            concentration === null || concentration === undefined
                ? ""
                : String(concentration);

        dom.fields.alcoholDevice.value =
            stringValue(data.device || data.device_name || data.ebt_device || data.instrument);

        dom.fields.alcoholConfirmation.value =
            stringValue(
                data.confirmation ||
                data.confirmation_detail ||
                data.confirmation_test ||
                data.notes
            );
    }

    function buildDrugResultObject(existingValue) {
        const data = { ...objectValue(existingValue) };

        delete data.panel;
        delete data.test_panel;
        delete data.panel_name;
        delete data.result;
        delete data.outcome;
        delete data.status;
        delete data.specimen_type;
        delete data.specimen;
        delete data.sample_type;
        delete data.lab_name;
        delete data.lab;
        delete data.laboratory;
        delete data.detail;

        addIfValue(data, "panel", dom.fields.drugPanel.value);
        addIfValue(data, "result", dom.fields.drugOutcome.value);
        addIfValue(data, "specimen_type", dom.fields.drugSpecimen.value);
        addIfValue(data, "lab_name", dom.fields.drugLab.value);

        return data;
    }

    function buildAlcoholResultObject(existingValue) {
        const data = { ...objectValue(existingValue) };

        [
            "result", "outcome", "status", "classification",
            "concentration", "bac", "alcohol_concentration", "value",
            "device", "device_name", "ebt_device", "instrument",
            "confirmation", "confirmation_detail", "confirmation_test"
        ].forEach(key => delete data[key]);

        addIfValue(data, "result", dom.fields.alcoholOutcome.value);

        const concentration = String(dom.fields.alcoholConcentration.value || "").trim();
        if (concentration) {
            const numeric = Number(concentration);
            if (Number.isFinite(numeric)) data.concentration = numeric;
        }

        addIfValue(data, "device", dom.fields.alcoholDevice.value);
        addIfValue(data, "confirmation", dom.fields.alcoholConfirmation.value);

        return data;
    }

    function friendlyDrugSummary(value) {
        const data = objectValue(value);
        return [
            data.panel || data.test_panel || data.panel_name,
            resultLabels[data.result] || humanize(data.result),
            humanize(data.specimen_type || data.specimen),
            data.lab_name || data.lab || data.laboratory
        ].filter(Boolean).join(" ");
    }

    function friendlyAlcoholSummary(value) {
        const data = objectValue(value);
        const outcome = normalizeAlcoholOutcome(
            stringValue(data.result || data.outcome || data.status).toLowerCase()
        );

        return [
            alcoholOutcomeLabels[outcome] || humanize(outcome),
            data.concentration ?? data.bac ?? data.alcohol_concentration,
            data.device || data.device_name || data.ebt_device
        ].filter(value => value !== null && value !== undefined && value !== "").join(" ");
    }

    function resetDocumentControls() {
        if (dom.documentType) dom.documentType.value = "lab_result";
        if (dom.documentVisibility) dom.documentVisibility.value = "employee";
        if (dom.documentFile) dom.documentFile.value = "";
        clearDocumentMessage();
        updateDocumentVisibilityHelp();
    }

    function enableDocumentManager() {
        if (dom.documentsLocked) {
            dom.documentsLocked.style.display = "none";
        }

        if (dom.documentManager) {
            dom.documentManager.hidden = false;
            dom.documentManager.classList.toggle("is-disabled", !documentsFeatureReady);
        }

        if (dom.uploadDocument) {
            dom.uploadDocument.disabled = !documentsFeatureReady;
        }

        if (!documentsFeatureReady) {
            showDocumentMessage(
                `Private document storage is not ready yet. Run dot-test-results-private-storage.sql in Supabase. ${documentSetupError}`,
                true
            );
        }

        updateDocumentVisibilityHelp();
    }

    function disableDocumentManagerForNew() {
        if (dom.documentsLocked) {
            dom.documentsLocked.style.display = "block";
            dom.documentsLocked.textContent =
                "Save this result first. The upload controls will appear immediately after it is saved.";
        }

        if (dom.documentManager) {
            dom.documentManager.hidden = true;
        }
    }

    function updateDocumentVisibilityHelp() {
        if (!dom.documentVisibilityHelp) return;

        const value = dom.documentVisibility?.value || "employee";
        const resultRow = results.find(row => row.id === editingResultId);
        const test = testMap.get(resultRow?.test_id || dom.fields.testId?.value);
        const employee = employeeMap.get(test?.employee_id);

        if (value === "employer") {
            dom.documentVisibilityHelp.textContent =
                "Employer Only: authenticated active members of this employer can open the document.";
            return;
        }

        if (value === "both") {
            dom.documentVisibilityHelp.textContent =
                "Employee / Customer + Employer: the individual and authenticated active members of the employer can open the document.";
            return;
        }

        dom.documentVisibilityHelp.textContent = employee?.user_id
            ? "Employee / Customer Only: only the authenticated individual attached to this DOT test can open the document."
            : "Employee / Customer Only: this employee does not yet have a linked portal login, so the file stays inaccessible to the employee until user_id is linked.";
    }

    function renderResultDocuments(resultId) {
        if (!dom.documentList) return;

        if (!documentsFeatureReady) {
            dom.documentList.innerHTML =
                '<div class="s4u-result-document-empty">Private document storage needs the SQL setup before files can be loaded.</div>';
            return;
        }

        const rows = documentsByResultMap.get(resultId) || [];

        if (!rows.length) {
            dom.documentList.innerHTML =
                '<div class="s4u-result-document-empty">No documents uploaded for this result.</div>';
            return;
        }

        dom.documentList.innerHTML = rows.map(row => {
            const visibilityLabel = {
                employee: "Employee / Customer Only",
                employer: "Employer Only",
                both: "Employee / Customer + Employer"
            }[row.visibility] || humanize(row.visibility);

            const documentTypeLabel = {
                lab_result: "Lab Result",
                ccf: "CCF / Custody Form",
                mro_report: "MRO Report",
                alcohol_result: "Alcohol Result",
                other: "Other Document"
            }[row.document_type] || humanize(row.document_type);

            return `
                <div class="s4u-result-document-row">
                    <div class="s4u-result-document-copy">
                        <strong title="${escapeHtml(row.original_name)}">
                            ${escapeHtml(row.original_name)}
                        </strong>
                        <span>
                            ${escapeHtml(documentTypeLabel)}
                            · ${escapeHtml(visibilityLabel)}
                            · ${escapeHtml(formatFileSize(row.size_bytes))}
                            · ${escapeHtml(formatDate(row.created_at))}
                        </span>
                    </div>

                    <div class="s4u-result-document-actions">
                        <button
                            type="button"
                            class="s4u-result-document-button"
                            data-document-open="${escapeHtml(row.id)}"
                        >
                            Open
                        </button>

                        <button
                            type="button"
                            class="s4u-result-document-button is-danger"
                            data-document-delete="${escapeHtml(row.id)}"
                        >
                            Delete
                        </button>
                    </div>
                </div>
            `;
        }).join("");
    }

    async function uploadResultDocument() {
        clearDocumentMessage();

        if (!editingResultId) {
            showDocumentMessage("Save the test result before uploading a document.", true);
            return;
        }

        if (!documentsFeatureReady) {
            showDocumentMessage(
                `Private document storage is not ready. Run dot-test-results-private-storage.sql in Supabase. ${documentSetupError}`,
                true
            );
            return;
        }

        const resultRow = results.find(row => row.id === editingResultId);
        const test = testMap.get(resultRow?.test_id || dom.fields.testId?.value);

        if (!test) {
            showDocumentMessage("Unable to resolve the DOT test for this result.", true);
            return;
        }

        const file = dom.documentFile?.files?.[0];

        if (!file) {
            showDocumentMessage("Choose a result document to upload.", true);
            return;
        }

        if (file.size > MAX_DOCUMENT_BYTES) {
            showDocumentMessage("The selected file is larger than 25 MB.", true);
            return;
        }

        const mimeType = String(file.type || "").toLowerCase();

        if (!ALLOWED_DOCUMENT_TYPES.has(mimeType)) {
            showDocumentMessage("Only PDF, JPG, PNG, and WEBP files are allowed.", true);
            return;
        }

        const visibility = dom.documentVisibility?.value || "employee";
        const documentType = dom.documentType?.value || "lab_result";
        const documentId = makeUuid();
        const safeName = sanitizeStorageFileName(file.name);
        const storagePath =
            `results/${editingResultId}/${documentId}/${Date.now()}-${safeName}`;

        const button = dom.uploadDocument;
        const originalHtml = button.innerHTML;

        button.disabled = true;
        button.textContent = "Uploading...";

        let objectUploaded = false;

        try {
            const { error: uploadError } = await client.storage
                .from(DOCUMENT_BUCKET)
                .upload(storagePath, file, {
                    cacheControl: "3600",
                    upsert: false,
                    contentType: mimeType
                });

            if (uploadError) throw uploadError;
            objectUploaded = true;

            const { error: metadataError } = await client
                .from(DOCUMENT_TABLE)
                .insert({
                    id: documentId,
                    result_id: editingResultId,
                    document_type: documentType,
                    visibility,
                    storage_bucket: DOCUMENT_BUCKET,
                    storage_path: storagePath,
                    original_name: file.name,
                    mime_type: mimeType,
                    size_bytes: file.size
                });

            if (metadataError) throw metadataError;

            await loadDocuments();
            buildDocumentMap();
            renderResultDocuments(editingResultId);
            renderTable();

            if (dom.documentFile) dom.documentFile.value = "";

            showDocumentMessage("Private result document uploaded successfully.", false);
        } catch (error) {
            console.error("Unable to upload result document:", error);

            if (objectUploaded) {
                try {
                    await client.storage
                        .from(DOCUMENT_BUCKET)
                        .remove([storagePath]);
                } catch (cleanupError) {
                    console.warn("Unable to clean up uploaded object:", cleanupError);
                }
            }

            showDocumentMessage(
                error?.message || "Unable to upload the result document.",
                true
            );
        } finally {
            button.disabled = !documentsFeatureReady;
            button.innerHTML = originalHtml;
        }
    }

    async function openResultDocument(documentId) {
        clearDocumentMessage();

        const row = documents.find(item => item.id === documentId);

        if (!row) {
            showDocumentMessage("Document record was not found.", true);
            return;
        }

        try {
            const { data, error } = await client.storage
                .from(row.storage_bucket || DOCUMENT_BUCKET)
                .createSignedUrl(row.storage_path, 120);

            if (error) throw error;
            if (!data?.signedUrl) {
                throw new Error("A secure document URL could not be created.");
            }

            window.open(data.signedUrl, "_blank", "noopener,noreferrer");
        } catch (error) {
            console.error("Unable to open result document:", error);
            showDocumentMessage(
                error?.message || "Unable to open the private result document.",
                true
            );
        }
    }

    async function deleteResultDocument(documentId) {
        clearDocumentMessage();

        const row = documents.find(item => item.id === documentId);
        if (!row) return;

        const confirmed = window.confirm(
            `Delete "${row.original_name}" from this test result?`
        );

        if (!confirmed) return;

        try {
            const { error: metadataError } = await client
                .from(DOCUMENT_TABLE)
                .delete()
                .eq("id", row.id);

            if (metadataError) throw metadataError;

            const { error: storageError } = await client.storage
                .from(row.storage_bucket || DOCUMENT_BUCKET)
                .remove([row.storage_path]);

            if (storageError) {
                console.warn(
                    "Metadata was deleted but Storage cleanup failed:",
                    storageError
                );
            }

            await loadDocuments();
            buildDocumentMap();
            renderResultDocuments(editingResultId);
            renderTable();
            showDocumentMessage("Result document deleted.", false);
        } catch (error) {
            console.error("Unable to delete result document:", error);
            showDocumentMessage(
                error?.message || "Unable to delete the result document.",
                true
            );
        }
    }

    function openResultFromQueryString() {
        const params = new URLSearchParams(window.location.search);
        const testId = params.get("test_id");
        if (!testId || !testMap.has(testId)) return;

        const existing = resultByTestMap.get(testId);

        if (existing) {
            openModal(existing.id);
        } else {
            openModal(null, testId);
        }
    }

    function setLoading() {
        dom.tbody.innerHTML = `
            <tr>
                <td colspan="9" style="padding:36px;text-align:center;color:#617087;">
                    Loading test results...
                </td>
            </tr>
        `;
        dom.empty.style.display = "none";
        dom.paginationCopy.textContent = "Loading records...";
    }

    function showPageError(message) {
        dom.tbody.innerHTML = `
            <tr>
                <td colspan="9" style="padding:36px;text-align:center;color:#c53030;">
                    ${escapeHtml(message)}
                </td>
            </tr>
        `;
        dom.empty.style.display = "none";
        dom.paginationCopy.textContent = "Unable to load records";
    }

    function showFormMessage(message, isError) {
        dom.formMessage.textContent = message;
        dom.formMessage.classList.toggle("is-error", Boolean(isError));
        dom.formMessage.classList.add("is-visible");
    }

    function clearFormMessage() {
        dom.formMessage?.classList.remove("is-visible", "is-error");
        if (dom.formMessage) dom.formMessage.textContent = "";
    }

    function showDocumentMessage(message, isError) {
        if (!dom.documentMessage) return;

        dom.documentMessage.textContent = message;
        dom.documentMessage.classList.toggle("is-error", Boolean(isError));
        dom.documentMessage.classList.add("is-visible");
    }

    function clearDocumentMessage() {
        if (!dom.documentMessage) return;

        dom.documentMessage.textContent = "";
        dom.documentMessage.classList.remove("is-visible", "is-error");
    }

    function exportCsv() {
        const rows = hasActiveFilters() ? filteredResults : results;

        const csvRows = [
            [
                "Result ID",
                "Test ID",
                "CCF Number",
                "Employee",
                "Employee Email",
                "Employer",
                "Test Type",
                "Reason",
                "Result",
                "Result Date",
                "MRO Status",
                "MRO Name",
                "Verified At",
                "Source",
                "Documents",
                "Notes"
            ],
            ...rows.map(resultRow => {
                const test = testMap.get(resultRow.test_id);
                const employee = employeeMap.get(test?.employee_id);
                const employer = employerMap.get(test?.employer_id);

                return [
                    resultRow.id,
                    resultRow.test_id,
                    test?.ccf_number || "",
                    employeeName(employee),
                    employee?.email || "",
                    employer?.employer_name || employer?.legal_name || "",
                    typeLabels[test?.test_type] || test?.test_type || "",
                    reasonLabels[test?.test_reason] || test?.test_reason || "",
                    resultLabels[resultRow.result] || resultRow.result || "",
                    resultRow.result_date || resultRow.created_at || "",
                    mroLabels[resultRow.mro_status] || humanize(resultRow.mro_status),
                    resultRow.mro_name || "",
                    resultRow.verified_at || "",
                    sourceLabels[resultRow.source] || humanize(resultRow.source),
                    (documentsByResultMap.get(resultRow.id) || []).length,
                    resultRow.notes || ""
                ];
            })
        ];

        const csv = csvRows
            .map(row => row.map(csvCell).join(","))
            .join("\n");

        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");

        link.href = url;
        link.download = "dot-test-results.csv";

        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
    }

    function hasActiveFilters() {
        return Boolean(
            String(dom.search?.value || "").trim() ||
            dom.resultFilter?.value ||
            dom.typeFilter?.value ||
            dom.mroFilter?.value
        );
    }

    function setSelectValue(select, value) {
        if (!select) return;

        const clean = String(value || "");

        if (!clean) {
            select.value = "";
            return;
        }

        const exists = Array.from(select.options)
            .some(option => option.value === clean);

        if (!exists) {
            const option = document.createElement("option");
            option.value = clean;
            option.textContent = humanize(clean);
            select.appendChild(option);
        }

        select.value = clean;
    }

    function objectValue(value) {
        if (!value || Array.isArray(value) || typeof value !== "object") {
            return {};
        }

        return value;
    }

    function stringValue(value) {
        if (value === null || value === undefined) return "";
        return String(value).trim();
    }

    function addIfValue(object, key, value) {
        const clean = stringValue(value);
        if (clean) object[key] = clean;
    }

    function normalizeSpecimen(value) {
        const clean = stringValue(value).toLowerCase().replaceAll(" ", "_");

        if (["oral", "oral_fluid", "oralfluid"].includes(clean)) return "oral_fluid";
        if (["urine"].includes(clean)) return "urine";
        if (clean) return clean;

        return "";
    }

    function normalizeAlcoholOutcome(value) {
        const clean = stringValue(value)
            .toLowerCase()
            .replaceAll(" ", "_")
            .replaceAll("-", "_");

        const aliases = {
            "<0.02": "below_002",
            "below_0.02": "below_002",
            "below_002": "below_002",
            "0.02_0.039": "002_to_0039",
            "0.02_to_0.039": "002_to_0039",
            "002_to_0039": "002_to_0039",
            "0.04_or_higher": "004_or_higher",
            "004_or_higher": "004_or_higher"
        };

        return aliases[clean] || clean;
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
            .join("") || "TR";
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

    function formatDateOnly(value) {
        if (!value) return "No date";

        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return String(value);

        return new Intl.DateTimeFormat("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric"
        }).format(date);
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

    function sanitizeStorageFileName(name) {
        const clean = String(name || "result-document")
            .normalize("NFKD")
            .replace(/[^\w.\-]+/g, "-")
            .replace(/-+/g, "-")
            .replace(/^-|-$/g, "");

        return clean || "result-document";
    }

    function makeUuid() {
        if (window.crypto?.randomUUID) {
            return window.crypto.randomUUID();
        }

        return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, char => {
            const random = Math.random() * 16 | 0;
            const value = char === "x" ? random : (random & 0x3 | 0x8);
            return value.toString(16);
        });
    }

    function formatFileSize(bytes) {
        const size = Number(bytes || 0);

        if (!size) return "0 KB";
        if (size < 1024) return `${size} B`;
        if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;

        return `${(size / (1024 * 1024)).toFixed(1)} MB`;
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
