/* screenings4u — admin-random-selections.js */
(() => {
"use strict";

const PAGE_SIZE = 20;
const QUARTERS = ["Q1","Q2","Q3","Q4"];
let client = null;

let programs = [];
let programEmployers = [];
let programYearStats = [];
let selections = [];
let selectionEmployees = [];
let employers = [];
let employees = [];

let programMap = new Map();
let employerMap = new Map();
let employeeMap = new Map();
let employeesByEmployer = new Map();
let enrollmentsByProgram = new Map();
let statsByProgramYear = new Map();
let selectedBySelection = new Map();

let filtered = [];
let page = 1;
let calculation = null;
let queryProgramId = null;

const el = {};

document.addEventListener("DOMContentLoaded", init);

async function init() {
    cache();
    bind();

    try {
        client = await waitForClient();
        if (!client) throw new Error("Supabase client was not found.");

        await requireSession();

        queryProgramId = new URLSearchParams(location.search).get("program");

        await loadAll();

        if (queryProgramId && programMap.has(queryProgramId)) {
            el.programFilter.value = queryProgramId;
            render();
        }
    } catch (error) {
        console.error(error);
        tableError(error.message || "Unable to load random selections.");
    }
}

function cache() {
    [
        "runRandomSelectionButton","refreshRandomSelectionsButton","rsSearch",
        "rsProgramFilter","rsYearFilter","rsStatusFilter","clearRsFilters",
        "rsTableBody","rsResultsCount","rsPrevious","rsNext","rsPage",
        "rsMetricTotal","rsMetricCompleted","rsMetricDrug","rsMetricAlcohol",
        "rsRunModalBackdrop","rsRunForm","rsRunMessage","rsRunProgram",
        "rsRunPeriod","rsRunSeed","rsRunProgramYear","rsRunNotes",
        "calculateRandomProgramButton","executeRandomSelectionButton",
        "rsManageEmployersLink","rsRunFooterCopy","rsCalcEmployers",
        "rsCalcEligible","rsCalcDrugAnnual","rsCalcDrugProgress",
        "rsCalcAlcoholAnnual","rsCalcAlcoholProgress","rsCalcDrugDraw",
        "rsCalcAlcoholDraw","rsCalculationNote","rsConsortiumTableBody",
        "rsDetailsModalBackdrop","rsDetailsModalTitle","rsDetailsModalSubtitle",
        "rsDetailPeriod","rsDetailDate","rsDetailEligible","rsDetailDrugTarget",
        "rsDetailDrugSelected","rsDetailAlcoholTarget","rsDetailAlcoholSelected",
        "rsDetailStatus","rsDetailSeed","rsSelectedEmployeesBody",
        "rsDetailEmployersLink"
    ].forEach(id => {
        const key = id
            .replace(/^rs/,"")
            .replace(/^./, c => c.toLowerCase());
        el[key] = document.getElementById(id);
    });

    el.runButton = document.getElementById("runRandomSelectionButton");
    el.refresh = document.getElementById("refreshRandomSelectionsButton");
    el.search = document.getElementById("rsSearch");
    el.programFilter = document.getElementById("rsProgramFilter");
    el.yearFilter = document.getElementById("rsYearFilter");
    el.statusFilter = document.getElementById("rsStatusFilter");
    el.clear = document.getElementById("clearRsFilters");
    el.body = document.getElementById("rsTableBody");
    el.results = document.getElementById("rsResultsCount");
    el.prev = document.getElementById("rsPrevious");
    el.next = document.getElementById("rsNext");
    el.page = document.getElementById("rsPage");
    el.metricTotal = document.getElementById("rsMetricTotal");
    el.metricCompleted = document.getElementById("rsMetricCompleted");
    el.metricDrug = document.getElementById("rsMetricDrug");
    el.metricAlcohol = document.getElementById("rsMetricAlcohol");

    el.runBg = document.getElementById("rsRunModalBackdrop");
    el.runForm = document.getElementById("rsRunForm");
    el.runMessage = document.getElementById("rsRunMessage");
    el.runProgram = document.getElementById("rsRunProgram");
    el.runPeriod = document.getElementById("rsRunPeriod");
    el.runSeed = document.getElementById("rsRunSeed");
    el.runYear = document.getElementById("rsRunProgramYear");
    el.runNotes = document.getElementById("rsRunNotes");
    el.calculate = document.getElementById("calculateRandomProgramButton");
    el.execute = document.getElementById("executeRandomSelectionButton");
    el.manageEmployers = document.getElementById("rsManageEmployersLink");
    el.footerCopy = document.getElementById("rsRunFooterCopy");
    el.calcEmployers = document.getElementById("rsCalcEmployers");
    el.calcEligible = document.getElementById("rsCalcEligible");
    el.calcDrugAnnual = document.getElementById("rsCalcDrugAnnual");
    el.calcDrugProgress = document.getElementById("rsCalcDrugProgress");
    el.calcAlcoholAnnual = document.getElementById("rsCalcAlcoholAnnual");
    el.calcAlcoholProgress = document.getElementById("rsCalcAlcoholProgress");
    el.calcDrugDraw = document.getElementById("rsCalcDrugDraw");
    el.calcAlcoholDraw = document.getElementById("rsCalcAlcoholDraw");
    el.calcNote = document.getElementById("rsCalculationNote");
    el.consortiumBody = document.getElementById("rsConsortiumTableBody");

    el.detailsBg = document.getElementById("rsDetailsModalBackdrop");
    el.detailsTitle = document.getElementById("rsDetailsModalTitle");
    el.detailsSubtitle = document.getElementById("rsDetailsModalSubtitle");
    el.detailPeriod = document.getElementById("rsDetailPeriod");
    el.detailDate = document.getElementById("rsDetailDate");
    el.detailEligible = document.getElementById("rsDetailEligible");
    el.detailDrugTarget = document.getElementById("rsDetailDrugTarget");
    el.detailDrugSelected = document.getElementById("rsDetailDrugSelected");
    el.detailAlcoholTarget = document.getElementById("rsDetailAlcoholTarget");
    el.detailAlcoholSelected = document.getElementById("rsDetailAlcoholSelected");
    el.detailStatus = document.getElementById("rsDetailStatus");
    el.detailSeed = document.getElementById("rsDetailSeed");
    el.selectedBody = document.getElementById("rsSelectedEmployeesBody");
    el.detailEmployers = document.getElementById("rsDetailEmployersLink");
}

function bind() {
    el.runButton?.addEventListener("click", openRun);
    el.refresh?.addEventListener("click", loadAll);

    [el.search,el.programFilter,el.yearFilter,el.statusFilter].forEach(node => {
        node?.addEventListener(node === el.search ? "input" : "change", () => {
            page = 1;
            render();
        });
    });

    el.clear?.addEventListener("click", () => {
        el.search.value = "";
        el.programFilter.value = "";
        el.yearFilter.value = "";
        el.statusFilter.value = "";
        page = 1;
        render();
    });

    el.prev?.addEventListener("click", () => {
        if (page > 1) { page--; renderPage(); }
    });

    el.next?.addEventListener("click", () => {
        const max = Math.max(1, Math.ceil(filtered.length/PAGE_SIZE));
        if (page < max) { page++; renderPage(); }
    });

    el.body?.addEventListener("click", event => {
        const notifyButton = event.target.closest("[data-rs-notify]");
        if (notifyButton) {
            openNotifyPage(notifyButton.dataset.rsNotify);
            return;
        }

        const button = event.target.closest("[data-rs-view]");
        if (button) openDetails(button.dataset.rsView);
    });

    document.querySelectorAll("[data-rs-run-close]").forEach(button =>
        button.addEventListener("click", closeRun)
    );

    document.querySelectorAll("[data-rs-details-close]").forEach(button =>
        button.addEventListener("click", closeDetails)
    );

    el.runBg?.addEventListener("click", event => {
        if (event.target === el.runBg) closeRun();
    });

    el.detailsBg?.addEventListener("click", event => {
        if (event.target === el.detailsBg) closeDetails();
    });

    el.runProgram?.addEventListener("change", () => {
        syncProgram();
        calculate();
    });

    el.runPeriod?.addEventListener("change", calculate);
    el.calculate?.addEventListener("click", calculate);
    el.runForm?.addEventListener("submit", runSelection);
}

async function waitForClient(timeout=3500) {
    const start = Date.now();
    while (Date.now()-start < timeout) {
        const c = await getClient();
        if (c?.from) return c;
        await new Promise(r => setTimeout(r,75));
    }
    return null;
}

async function getClient() {
    try {
        if (typeof window.getScreenings4uSupabase === "function") {
            const c = await window.getScreenings4uSupabase();
            if (c?.from) return c;
        }
    } catch (_) {}

    if (window.screenings4uSupabase?.from) return window.screenings4uSupabase;
    if (window.supabaseClient?.from) return window.supabaseClient;

    if (window.supabase?.createClient && window.SCREENINGS4U_SUPABASE_URL && window.SCREENINGS4U_SUPABASE_ANON_KEY) {
        window.supabaseClient = window.supabase.createClient(
            window.SCREENINGS4U_SUPABASE_URL,
            window.SCREENINGS4U_SUPABASE_ANON_KEY
        );
        return window.supabaseClient;
    }

    return null;
}

async function requireSession() {
    if (window.S4UAuth?.requireSession) {
        const session = await window.S4UAuth.requireSession("admin-login.html");
        if (!session) throw new Error("Authentication required.");
        return;
    }

    const {data,error} = await client.auth.getSession();
    if (error) throw error;
    if (!data?.session?.user) {
        location.replace("admin-login.html");
        throw new Error("Authentication required.");
    }
}

async function loadAll() {
    loading();

    const results = await Promise.all([
        client.from("dot_random_programs").select("id,name,program_year,drug_rate,alcohol_rate,status,dot_agency,program_type,pool_type,dedicated_employer_id").order("program_year",{ascending:false}),
        client.from("dot_random_program_employers").select("id,employer_id,program_id,status,drug_enrolled,alcohol_enrolled,selection_frequency,drug_rate,alcohol_rate"),
        client.from("dot_random_program_year_stats").select("program_id,program_year,eligible_employee_count,drug_annual_target,drug_selected_to_date,alcohol_annual_target,alcohol_selected_to_date,selection_periods_completed"),
        client.from("dot_random_selections").select("id,program_id,selection_period,selected_at,selection_seed,drug_target,alcohol_target,status,notes,eligible_employee_count,drug_selected_count,alcohol_selected_count,program_year").order("selected_at",{ascending:false}),
        client.from("dot_random_selection_employees").select("id,selection_id,employer_id,employee_id,selection_type,status,notified_at,completed_at,created_at").order("created_at",{ascending:true}),
        client.from("employer_profiles").select("id,employer_name,legal_name,dot_number,city,state"),
        client.from("employer_employees").select("id,employer_id,employee_number,first_name,last_name,email,cdl_number,cdl_state,employment_status,is_dot_regulated")
    ]);

    const errors = results.map(r => r.error).filter(Boolean);
    if (errors.length) throw new Error(errors[0].message);

    [programs,programEmployers,programYearStats,selections,selectionEmployees,employers,employees] =
        results.map(r => r.data || []);

    buildMaps();
    fillFilters();
    fillRunPrograms();
    updateMetrics();
    page = 1;
    render();
}

function buildMaps() {
    programMap = new Map(programs.map(x => [x.id,x]));
    employerMap = new Map(employers.map(x => [x.id,x]));
    employeeMap = new Map(employees.map(x => [x.id,x]));

    employeesByEmployer = new Map();
    employees.forEach(x => {
        const arr = employeesByEmployer.get(x.employer_id) || [];
        arr.push(x);
        employeesByEmployer.set(x.employer_id,arr);
    });

    enrollmentsByProgram = new Map();
    programEmployers.forEach(x => {
        const arr = enrollmentsByProgram.get(x.program_id) || [];
        arr.push(x);
        enrollmentsByProgram.set(x.program_id,arr);
    });

    statsByProgramYear = new Map();
    programYearStats.forEach(x =>
        statsByProgramYear.set(`${x.program_id}:${x.program_year}`,x)
    );

    selectedBySelection = new Map();
    selectionEmployees.forEach(x => {
        const arr = selectedBySelection.get(x.selection_id) || [];
        arr.push(x);
        selectedBySelection.set(x.selection_id,arr);
    });
}

function fillFilters() {
    const currentProgram = el.programFilter.value;
    el.programFilter.innerHTML =
        '<option value="">All programs</option>' +
        programs.map(p => `<option value="${esc(p.id)}">${esc(p.name)} (${esc(p.program_year)})</option>`).join("");
    if (currentProgram && programMap.has(currentProgram)) el.programFilter.value = currentProgram;

    const years = [...new Set(selections.map(x => Number(x.program_year)).filter(Number.isFinite))].sort((a,b)=>b-a);
    const currentYear = el.yearFilter.value;
    el.yearFilter.innerHTML =
        '<option value="">All years</option>' +
        years.map(y => `<option value="${y}">${y}</option>`).join("");
    if (years.includes(Number(currentYear))) el.yearFilter.value = currentYear;
}

function fillRunPrograms() {
    const active = programs.filter(p => String(p.status).toLowerCase()==="active");
    el.runProgram.innerHTML =
        '<option value="">Select active program</option>' +
        active.map(p => `<option value="${esc(p.id)}">${esc(p.name)} · ${esc(p.program_year)} · ${esc(p.program_type==="NON_DOT" ? "NON-DOT" : [p.program_type,p.dot_agency].filter(Boolean).join(" / "))}</option>`).join("");
}

function updateMetrics() {
    el.metricTotal.textContent = selections.length.toLocaleString();
    el.metricCompleted.textContent = selections.filter(x => String(x.status).toLowerCase()==="completed").length.toLocaleString();
    el.metricDrug.textContent = selections.reduce((n,x)=>n+Number(x.drug_selected_count||0),0).toLocaleString();
    el.metricAlcohol.textContent = selections.reduce((n,x)=>n+Number(x.alcohol_selected_count||0),0).toLocaleString();
}

function render() {
    const q = String(el.search.value||"").trim().toLowerCase();
    const p = el.programFilter.value;
    const y = el.yearFilter.value;
    const s = el.statusFilter.value;

    filtered = selections.filter(x => {
        const program = programMap.get(x.program_id);
        const hay = [program?.name,program?.program_type,program?.dot_agency,x.selection_period,x.program_year,x.status,x.notes]
            .filter(v => v !== null && v !== undefined).join(" ").toLowerCase();

        return (!q || hay.includes(q)) &&
            (!p || x.program_id===p) &&
            (!y || Number(x.program_year)===Number(y)) &&
            (!s || String(x.status).toLowerCase()===s);
    });

    const max = Math.max(1,Math.ceil(filtered.length/PAGE_SIZE));
    if (page > max) page = max;
    renderPage();
}

function renderPage() {
    if (!filtered.length) {
        el.body.innerHTML = '<tr><td colspan="10" class="rs-empty">No random selection runs found.</td></tr>';
        el.results.textContent = "0 selection runs";
        el.page.textContent = "1";
        el.prev.disabled = true;
        el.next.disabled = true;
        return;
    }

    const start = (page-1)*PAGE_SIZE;
    const rows = filtered.slice(start,start+PAGE_SIZE);

    el.body.innerHTML = rows.map(x => {
        const p = programMap.get(x.program_id);
        const status = String(x.status||"").toLowerCase();
        const cls = status==="completed" ? "ok" : status==="processing" ? "warn" : "info";

        return `<tr>
            <td><div class="rs-name"><strong>${esc(p?.name||"Program not found")}</strong><small>${esc([x.program_year,p?.program_type==="NON_DOT"?"NON-DOT":p?.program_type,p?.dot_agency,human(p?.pool_type)].filter(Boolean).join(" · "))}</small></div></td>
            <td><strong>${esc(x.selection_period)}</strong></td>
            <td>${esc(dateTime(x.selected_at))}</td>
            <td>${Number(x.eligible_employee_count||0).toLocaleString()}</td>
            <td>${Number(x.drug_target||0).toLocaleString()}</td>
            <td><strong>${Number(x.drug_selected_count||0).toLocaleString()}</strong></td>
            <td>${Number(x.alcohol_target||0).toLocaleString()}</td>
            <td><strong>${Number(x.alcohol_selected_count||0).toLocaleString()}</strong></td>
            <td><span class="rs-badge ${cls}">${esc(human(x.status))}</span></td>
            <td><div class="rs-actions"><button type="button" class="rs-row-button" data-rs-view="${esc(x.id)}">View Results</button><button type="button" class="rs-row-button" data-rs-notify="${esc(x.id)}">Notify</button><a class="rs-row-button" href="admin-random-program-employers.html?program=${encodeURIComponent(x.program_id)}">Employers</a></div></td>
        </tr>`;
    }).join("");

    el.results.textContent = `Showing ${start+1}–${Math.min(start+PAGE_SIZE,filtered.length)} of ${filtered.length} selection run${filtered.length===1?"":"s"}`;
    el.page.textContent = String(page);
    el.prev.disabled = page<=1;
    el.next.disabled = page>=Math.ceil(filtered.length/PAGE_SIZE);
}

function openRun() {
    el.runForm.reset();
    clearMessage();
    calculation = null;
    resetCalc();

    if (queryProgramId && programMap.has(queryProgramId)) {
        el.runProgram.value = queryProgramId;
    }

    syncProgram();
    if (el.runProgram.value) {
        el.runPeriod.value = nextQuarter(el.runProgram.value);
        calculate();
    }

    el.runBg.classList.add("open");
    el.runBg.setAttribute("aria-hidden","false");
    document.body.style.overflow = "hidden";
}

function closeRun() {
    el.runBg.classList.remove("open");
    el.runBg.setAttribute("aria-hidden","true");
    document.body.style.overflow = "";
    calculation = null;
}

function syncProgram() {
    const p = programMap.get(el.runProgram.value);
    el.runYear.value = p ? String(p.program_year) : "—";
    el.manageEmployers.href = p
        ? `admin-random-program-employers.html?program=${encodeURIComponent(p.id)}`
        : "admin-random-program-employers.html";
}

function nextQuarter(programId) {
    const p = programMap.get(programId);
    if (!p) return "";
    const done = new Set(
        selections.filter(x => x.program_id===p.id && Number(x.program_year)===Number(p.program_year))
            .map(x => x.selection_period)
    );
    return QUARTERS.find(q => !done.has(q)) || "";
}

function calculate() {
    clearMessage();
    resetCalc();

    const p = programMap.get(el.runProgram.value);
    const quarter = el.runPeriod.value;

    if (!p) {
        message("Select an active random program.","warn");
        return;
    }

    syncProgram();

    if (!QUARTERS.includes(quarter)) {
        message("Select Q1, Q2, Q3, or Q4.","warn");
        return;
    }

    const duplicate = selections.find(x =>
        x.program_id===p.id &&
        Number(x.program_year)===Number(p.program_year) &&
        x.selection_period===quarter
    );

    const activeEnrollments = (enrollmentsByProgram.get(p.id)||[])
        .filter(x => String(x.status).toLowerCase()==="active")
        .filter(x => p.pool_type!=="DEDICATED" || x.employer_id===p.dedicated_employer_id);

    let annualDrug = 0;
    let annualAlcohol = 0;
    const eligibleSet = new Set();
    const rows = [];

    activeEnrollments.forEach(enrollment => {
        const employer = employerMap.get(enrollment.employer_id);
        const eligible = (employeesByEmployer.get(enrollment.employer_id)||[]).filter(emp =>
            String(emp.employment_status||"").toLowerCase()==="active" &&
            (p.program_type==="NON_DOT" || emp.is_dot_regulated===true)
        );

        eligible.forEach(emp => eligibleSet.add(emp.id));

        const drugRate = enrollment.drug_rate ?? p.drug_rate ?? 0;
        const alcoholRate = enrollment.alcohol_rate ?? p.alcohol_rate ?? 0;
        const drugAnnual = enrollment.drug_enrolled ? Math.ceil(eligible.length*Number(drugRate)/100) : 0;
        const alcoholAnnual = enrollment.alcohol_enrolled ? Math.ceil(eligible.length*Number(alcoholRate)/100) : 0;

        annualDrug += drugAnnual;
        annualAlcohol += alcoholAnnual;

        rows.push({
            enrollment, employer,
            eligible: eligible.length,
            drugRate: Number(drugRate),
            alcoholRate: Number(alcoholRate),
            drugAnnual, alcoholAnnual
        });
    });

    const stats = statsByProgramYear.get(`${p.id}:${p.program_year}`);
    const completedRuns = selections.filter(x =>
        x.program_id===p.id &&
        Number(x.program_year)===Number(p.program_year) &&
        String(x.status).toLowerCase()==="completed"
    );

    const drugDone = stats
        ? Number(stats.drug_selected_to_date||0)
        : completedRuns.reduce((n,x)=>n+Number(x.drug_selected_count||0),0);

    const alcoholDone = stats
        ? Number(stats.alcohol_selected_to_date||0)
        : completedRuns.reduce((n,x)=>n+Number(x.alcohol_selected_count||0),0);

    const periodsDone = stats
        ? Number(stats.selection_periods_completed||0)
        : completedRuns.length;

    const periodsLeft = Math.max(1,4-periodsDone);
    const drugRemaining = Math.max(0,annualDrug-drugDone);
    const alcoholRemaining = Math.max(0,annualAlcohol-alcoholDone);

    const drugDraw = Math.min(drugRemaining,Math.ceil(drugRemaining/periodsLeft));
    const alcoholDraw = Math.min(alcoholRemaining,Math.ceil(alcoholRemaining/periodsLeft));

    calculation = {
        p, quarter, duplicate, rows,
        employerCount: rows.length,
        eligibleCount: eligibleSet.size,
        annualDrug, annualAlcohol,
        drugDone, alcoholDone,
        drugRemaining, alcoholRemaining,
        drugDraw, alcoholDraw
    };

    renderCalc();
}

function renderCalc() {
    const c = calculation;
    if (!c) return;

    el.calcEmployers.textContent = c.employerCount.toLocaleString();
    el.calcEligible.textContent = c.eligibleCount.toLocaleString();
    el.calcDrugAnnual.textContent = c.annualDrug.toLocaleString();
    el.calcDrugProgress.textContent = `Selected: ${c.drugDone.toLocaleString()} · Remaining: ${c.drugRemaining.toLocaleString()}`;
    el.calcAlcoholAnnual.textContent = c.annualAlcohol.toLocaleString();
    el.calcAlcoholProgress.textContent = `Selected: ${c.alcoholDone.toLocaleString()} · Remaining: ${c.alcoholRemaining.toLocaleString()}`;
    el.calcDrugDraw.textContent = c.drugDraw.toLocaleString();
    el.calcAlcoholDraw.textContent = c.alcoholDraw.toLocaleString();

    renderConsortium(c.rows);

    const problems = [];
    if (c.p.pool_type==="DEDICATED" && !c.p.dedicated_employer_id) problems.push("The dedicated program has no dedicated employer.");
    if (!c.employerCount) problems.push("No active employers are enrolled in this program.");
    if (!c.eligibleCount) problems.push("No eligible active employees were found.");
    if (c.duplicate) problems.push(`${c.quarter} has already been run for ${c.p.program_year}.`);
    if (!c.annualDrug && !c.annualAlcohol) problems.push("The employer enrollments produce no annual testing target.");

    if (problems.length) {
        el.calcNote.classList.add("warn");
        el.calcNote.textContent = problems.join(" ");
        el.execute.disabled = true;
        el.footerCopy.textContent = "Fix the program setup before running the draw.";
    } else {
        el.calcNote.classList.remove("warn");
        el.calcNote.textContent = `Ready to run ${c.quarter}. The final randomization is performed inside Supabase and will write the selection event, pool snapshot, selected employees, and year statistics.`;
        el.execute.disabled = false;
        el.footerCopy.textContent = `${c.employerCount} employer${c.employerCount===1?"":"s"} · ${c.eligibleCount} eligible employee${c.eligibleCount===1?"":"s"}`;
    }
}

function renderConsortium(rows) {
    if (!rows.length) {
        el.consortiumBody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:22px;color:#617087">No active employer enrollments.</td></tr>';
        return;
    }

    el.consortiumBody.innerHTML = rows.map(r => `<tr>
        <td><strong>${esc(employerName(r.employer))}</strong><span class="rs-sub">${esc(r.employer?.dot_number||"No DOT number")}</span></td>
        <td>${r.eligible.toLocaleString()}</td>
        <td>${r.enrollment.drug_enrolled ? "Enrolled" : "Off"}</td>
        <td>${r.enrollment.drug_enrolled ? esc(percent(r.drugRate)) : "—"}</td>
        <td>${r.enrollment.drug_enrolled ? r.drugAnnual.toLocaleString() : "—"}</td>
        <td>${r.enrollment.alcohol_enrolled ? "Enrolled" : "Off"}</td>
        <td>${r.enrollment.alcohol_enrolled ? esc(percent(r.alcoholRate)) : "—"}</td>
        <td>${r.enrollment.alcohol_enrolled ? r.alcoholAnnual.toLocaleString() : "—"}</td>
    </tr>`).join("");
}

function resetCalc() {
    [el.calcEmployers,el.calcEligible,el.calcDrugAnnual,el.calcAlcoholAnnual,el.calcDrugDraw,el.calcAlcoholDraw]
        .forEach(x => x.textContent = "—");
    el.calcDrugProgress.textContent = "Selected: —";
    el.calcAlcoholProgress.textContent = "Selected: —";
    el.calcNote.classList.remove("warn");
    el.calcNote.textContent = "Select a program and quarter, then calculate.";
    el.execute.disabled = true;
    el.footerCopy.textContent = "No calculation yet.";
    el.consortiumBody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:22px;color:#617087">Select a program.</td></tr>';
}

async function runSelection(event) {
    event.preventDefault();
    calculate();

    if (!calculation || el.execute.disabled) {
        message("The program must pass the calculation checks before it can run.","error");
        return;
    }

    const buttonText = el.execute.textContent;
    el.execute.disabled = true;
    el.execute.textContent = "Running Random Selection...";

    try {
        const {data,error} = await client.rpc("run_quarterly_random_selection", {
            p_program_id: calculation.p.id,
            p_selection_period: calculation.quarter,
            p_selection_seed: nullable(el.runSeed.value)
        });

        if (error) throw error;

        const selectionId = rpcId(data);
        if (!selectionId) throw new Error("The database did not return a selection ID.");

        const notes = nullable(el.runNotes.value);
        if (notes) {
            const noteResult = await client.from("dot_random_selections").update({notes}).eq("id",selectionId);
            if (noteResult.error) console.warn("Selection completed but notes were not saved:", noteResult.error);
        }

        await loadAll();
        closeRun();
        openDetails(selectionId);

    } catch (error) {
        console.error(error);
        message(readableRunError(error),"error");
        calculate();
    } finally {
        el.execute.textContent = buttonText;
    }
}

function rpcId(data) {
    if (typeof data === "string") return data;
    if (Array.isArray(data) && data.length) return typeof data[0] === "string" ? data[0] : data[0]?.id || data[0]?.run_quarterly_random_selection || null;
    if (data && typeof data === "object") return data.id || data.run_quarterly_random_selection || null;
    return null;
}

function openNotifyPage(id) {
    const selectionId = String(id || "").trim();
    if (!selectionId) return;

    // Keep multiple recovery paths so the notify page can still identify
    // the selection if a hosting/router layer strips part of the URL.
    try {
        sessionStorage.setItem("s4u_random_selection_id", selectionId);
        localStorage.setItem("s4u_random_selection_id", selectionId);
    } catch (_) {}

    const encoded = encodeURIComponent(selectionId);
    location.href = `random-selection-notify.html?selection=${encoded}#selection=${encoded}`;
}

function openDetails(id) {
    const s = selections.find(x => x.id===id);
    if (!s) return;
    const p = programMap.get(s.program_id);

    el.detailsTitle.textContent = p?.name || "Random Selection Details";
    el.detailsSubtitle.textContent = `${s.program_year} · ${s.selection_period} · ${p?.program_type==="NON_DOT"?"NON-DOT":[p?.program_type,p?.dot_agency].filter(Boolean).join(" / ")}`;
    el.detailPeriod.textContent = s.selection_period || "—";
    el.detailDate.textContent = dateTime(s.selected_at);
    el.detailEligible.textContent = Number(s.eligible_employee_count||0).toLocaleString();
    el.detailDrugTarget.textContent = Number(s.drug_target||0).toLocaleString();
    el.detailDrugSelected.textContent = `Selected: ${Number(s.drug_selected_count||0).toLocaleString()}`;
    el.detailAlcoholTarget.textContent = Number(s.alcohol_target||0).toLocaleString();
    el.detailAlcoholSelected.textContent = `Selected: ${Number(s.alcohol_selected_count||0).toLocaleString()}`;
    el.detailStatus.textContent = human(s.status);
    el.detailSeed.textContent = s.selection_seed || "—";
    el.detailEmployers.href = `admin-random-program-employers.html?program=${encodeURIComponent(s.program_id)}`;

    const rows = selectedBySelection.get(id) || [];
    el.selectedBody.innerHTML = rows.length ? rows.map(row => {
        const emp = employeeMap.get(row.employee_id);
        const employer = employerMap.get(row.employer_id);
        const name = employeeName(emp);

        return `<tr>
            <td><strong style="color:#173d78">${esc(name)}</strong><span class="rs-sub">${esc([emp?.employee_number ? `Employee ${emp.employee_number}` : "",emp?.cdl_number ? `CDL ${emp.cdl_number}${emp.cdl_state?` (${emp.cdl_state})`:""}`:"",emp?.email].filter(Boolean).join(" · "))}</span></td>
            <td>${esc(employerName(employer))}</td>
            <td><span class="rs-badge info">${esc(human(row.selection_type))}</span></td>
            <td>${esc(human(row.status))}</td>
            <td>${esc(row.notified_at ? dateTime(row.notified_at) : "—")}</td>
            <td>${esc(row.completed_at ? dateTime(row.completed_at) : "—")}</td>
        </tr>`;
    }).join("") : '<tr><td colspan="6" style="text-align:center;padding:24px;color:#617087">No selected employee rows found.</td></tr>';

    el.detailsBg.classList.add("open");
    el.detailsBg.setAttribute("aria-hidden","false");
    document.body.style.overflow = "hidden";
}

function closeDetails() {
    el.detailsBg.classList.remove("open");
    el.detailsBg.setAttribute("aria-hidden","true");
    document.body.style.overflow = "";
}

function readableRunError(error) {
    const m = String(error?.message||"");
    if (m.includes("A selection already exists") || m.includes("duplicate key")) return "That program already has a selection for this program year and quarter.";
    if (m.includes("No eligible employees")) return "No eligible employees were found. Check Program Employers and employee DOT eligibility.";
    if (m.includes("Active random program not found")) return "The program must be active before a random selection can run.";
    if (m.includes("selection_period must be")) return "Selection period must be Q1, Q2, Q3, or Q4.";
    return m || "Unable to run the random selection.";
}

function message(text,type="ok") {
    el.runMessage.textContent = text;
    el.runMessage.className = `rs-message show ${type}`;
}

function clearMessage() {
    el.runMessage.className = "rs-message";
    el.runMessage.textContent = "";
}

function loading() {
    el.body.innerHTML = '<tr><td colspan="10" class="rs-loading">Loading random selections...</td></tr>';
}

function tableError(text) {
    el.body.innerHTML = `<tr><td colspan="10" class="rs-error">${esc(text)}</td></tr>`;
}

function employerName(x) {
    return x?.employer_name || x?.legal_name || "Employer not found";
}

function employeeName(x) {
    if (!x) return "Employee not found";
    return [x.first_name,x.last_name].filter(Boolean).join(" ").trim() || x.email || x.employee_number || "Unnamed Employee";
}

function nullable(v) {
    const s = String(v||"").trim();
    return s || null;
}

function percent(v) {
    const n = Number(v);
    if (!Number.isFinite(n)) return "—";
    return Number.isInteger(n) ? `${n}%` : `${n.toFixed(2).replace(/0+$/,"").replace(/\.$/,"")}%`;
}

function human(v) {
    return String(v||"—").replace(/_/g," ").replace(/\b\w/g,c=>c.toUpperCase());
}

function dateTime(v) {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString(undefined,{year:"numeric",month:"short",day:"numeric",hour:"numeric",minute:"2-digit"});
}

function esc(v) {
    return String(v??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");
}
})();
