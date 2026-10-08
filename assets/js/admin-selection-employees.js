/* screenings4u — admin-selection-employees.js */
(() => {
"use strict";

const PAGE_SIZE = 25;
let client = null;
let rows = [], selections = [], programs = [], employers = [], employees = [];
let selectionMap = new Map(), programMap = new Map(), employerMap = new Map(), employeeMap = new Map();
let filtered = [], page = 1;
const el = {};

document.addEventListener("DOMContentLoaded", init);

async function init() {
    cache();
    bind();
    try {
        client = await waitForClient();
        if (!client) throw new Error("Supabase client was not found.");
        await requireSession();
        await loadAll();
    } catch (error) {
        console.error(error);
        tableError(error.message || "Unable to load selection employees.");
    }
}

function cache() {
    [
        "seRefresh","seSearch","seProgram","seYear","sePeriod","seType","seStatus","seClear",
        "seMetricTotal","seMetricPending","seMetricCompleted","seMetricNotified",
        "seTableBody","seResults","sePrevious","seNext","sePage","seDetailsBackdrop",
        "seDetailsTitle","seDetailEmployee","seDetailNumber","seDetailEmployer","seDetailProgram",
        "seDetailPeriod","seDetailType","seDetailStatus","seDetailSelected","seDetailNotified",
        "seDetailCompleted","seViewSelection","seNotifyEmployer"
    ].forEach(id => el[id.replace(/^se/,"").replace(/^./, c => c.toLowerCase())] = document.getElementById(id));
}

function bind() {
    el.refresh?.addEventListener("click", loadAll);
    [el.search,el.program,el.year,el.period,el.type,el.status].forEach(node => {
        node?.addEventListener(node === el.search ? "input" : "change", () => { page = 1; render(); });
    });
    el.clear?.addEventListener("click", () => {
        el.search.value = ""; el.program.value = ""; el.year.value = ""; el.period.value = ""; el.type.value = ""; el.status.value = "";
        page = 1; render();
    });
    el.previous?.addEventListener("click", () => { if (page > 1) { page--; renderPage(); }});
    el.next?.addEventListener("click", () => { const max=Math.max(1,Math.ceil(filtered.length/PAGE_SIZE)); if(page<max){page++;renderPage();}});
    el.tableBody?.addEventListener("click", event => {
        const button = event.target.closest("[data-se-view]");
        if (button) openDetails(button.dataset.seView);
    });
    document.querySelectorAll("[data-se-close]").forEach(x => x.addEventListener("click", closeDetails));
    el.detailsBackdrop?.addEventListener("click", event => { if(event.target===el.detailsBackdrop) closeDetails(); });
}

async function waitForClient(timeout=3500) {
    const start=Date.now();
    while(Date.now()-start<timeout){
        const c=await getClient();
        if(c?.from)return c;
        await new Promise(r=>setTimeout(r,75));
    }
    return null;
}

async function getClient() {
    try {
        if(typeof window.getScreenings4uSupabase==="function"){
            const c=await window.getScreenings4uSupabase();
            if(c?.from)return c;
        }
    } catch(_){}
    if(window.screenings4uSupabase?.from)return window.screenings4uSupabase;
    if(window.supabaseClient?.from)return window.supabaseClient;
    if(window.supabase?.createClient && window.SCREENINGS4U_SUPABASE_URL && window.SCREENINGS4U_SUPABASE_ANON_KEY){
        window.supabaseClient=window.supabase.createClient(window.SCREENINGS4U_SUPABASE_URL,window.SCREENINGS4U_SUPABASE_ANON_KEY);
        return window.supabaseClient;
    }
    return null;
}

async function requireSession() {
    if(window.S4UAuth?.requireSession){
        const session=await window.S4UAuth.requireSession("admin-login.html");
        if(!session)throw new Error("Authentication required.");
        return;
    }
    const {data,error}=await client.auth.getSession();
    if(error)throw error;
    if(!data?.session?.user){location.replace("admin-login.html");throw new Error("Authentication required.");}
}

async function loadAll() {
    loading();
    const result = await Promise.all([
        client.from("dot_random_selection_employees").select("id,selection_id,employer_id,employee_id,selection_type,status,notified_at,completed_at,created_at").order("created_at",{ascending:false}),
        client.from("dot_random_selections").select("id,program_id,selection_period,selected_at,status,program_year").order("selected_at",{ascending:false}),
        client.from("dot_random_programs").select("id,name,program_year,program_type,dot_agency,pool_type"),
        client.from("employer_profiles").select("id,employer_name,legal_name,dot_number,city,state"),
        client.from("employer_employees").select("id,employer_id,employee_number,first_name,last_name,email,cdl_number,cdl_state")
    ]);
    const errors=result.map(x=>x.error).filter(Boolean);
    if(errors.length)throw new Error(errors[0].message);
    [rows,selections,programs,employers,employees]=result.map(x=>x.data||[]);
    buildMaps();
    fillFilters();
    updateMetrics();
    page=1;
    render();
}

function buildMaps() {
    selectionMap=new Map(selections.map(x=>[x.id,x]));
    programMap=new Map(programs.map(x=>[x.id,x]));
    employerMap=new Map(employers.map(x=>[x.id,x]));
    employeeMap=new Map(employees.map(x=>[x.id,x]));
}

function fillFilters() {
    const programIds=[...new Set(rows.map(r=>selectionMap.get(r.selection_id)?.program_id).filter(Boolean))];
    el.program.innerHTML='<option value="">All programs</option>'+programIds.map(id=>`<option value="${esc(id)}">${esc(programMap.get(id)?.name||"Program")}</option>`).join("");
    const years=[...new Set(rows.map(r=>Number(selectionMap.get(r.selection_id)?.program_year)).filter(Number.isFinite))].sort((a,b)=>b-a);
    el.year.innerHTML='<option value="">All years</option>'+years.map(y=>`<option value="${y}">${y}</option>`).join("");
    const periods=[...new Set(rows.map(r=>selectionMap.get(r.selection_id)?.selection_period).filter(Boolean))].sort();
    el.period.innerHTML='<option value="">All periods</option>'+periods.map(p=>`<option value="${esc(p)}">${esc(p)}</option>`).join("");
    const statuses=[...new Set(rows.map(r=>String(r.status||"").toLowerCase()).filter(Boolean))].sort();
    el.status.innerHTML='<option value="">All statuses</option>'+statuses.map(s=>`<option value="${esc(s)}">${esc(human(s))}</option>`).join("");
}

function updateMetrics() {
    el.metricTotal.textContent=rows.length.toLocaleString();
    el.metricPending.textContent=rows.filter(r=>String(r.status).toLowerCase()!=="completed").length.toLocaleString();
    el.metricCompleted.textContent=rows.filter(r=>String(r.status).toLowerCase()==="completed").length.toLocaleString();
    el.metricNotified.textContent=rows.filter(r=>r.notified_at).length.toLocaleString();
}

function render() {
    const q=String(el.search.value||"").trim().toLowerCase();
    const programId=el.program.value, year=el.year.value, period=el.period.value, type=el.type.value, status=el.status.value;
    filtered=rows.filter(r=>{
        const s=selectionMap.get(r.selection_id), p=programMap.get(s?.program_id), employer=employerMap.get(r.employer_id), employee=employeeMap.get(r.employee_id);
        const hay=[employeeName(employee),employee?.employee_number,employee?.email,employee?.cdl_number,employerName(employer),employer?.dot_number,p?.name,s?.selection_period,s?.program_year,r.selection_type,r.status].filter(Boolean).join(" ").toLowerCase();
        return (!q||hay.includes(q)) &&
            (!programId||s?.program_id===programId) &&
            (!year||Number(s?.program_year)===Number(year)) &&
            (!period||s?.selection_period===period) &&
            (!type||String(r.selection_type).toLowerCase()===type) &&
            (!status||String(r.status).toLowerCase()===status);
    });
    const max=Math.max(1,Math.ceil(filtered.length/PAGE_SIZE)); if(page>max)page=max;
    renderPage();
}

function renderPage() {
    if(!filtered.length){
        el.tableBody.innerHTML='<tr><td colspan="9" class="se-empty">No selected employees match these filters.</td></tr>';
        el.results.textContent="0 selected employees";el.page.textContent="1";el.previous.disabled=true;el.next.disabled=true;return;
    }
    const start=(page-1)*PAGE_SIZE, view=filtered.slice(start,start+PAGE_SIZE);
    el.tableBody.innerHTML=view.map(r=>{
        const s=selectionMap.get(r.selection_id), p=programMap.get(s?.program_id), employer=employerMap.get(r.employer_id), employee=employeeMap.get(r.employee_id);
        const status=String(r.status||"").toLowerCase(), statusClass=status==="completed"?"ok":status==="selected"?"warn":"gray";
        const typeClass=String(r.selection_type).toLowerCase()==="alcohol"?"orange":"";
        const encoded=encodeURIComponent(r.selection_id);
        return `<tr>
        <td><div class="se-name"><strong>${esc(employeeName(employee))}</strong><small>${esc([employee?.employee_number?`Employee ${employee.employee_number}`:"",employee?.cdl_number?`CDL ${employee.cdl_number}${employee.cdl_state?` (${employee.cdl_state})`:""}`:"",employee?.email].filter(Boolean).join(" · "))}</small></div></td>
        <td><strong>${esc(employerName(employer))}</strong><span class="se-sub">${esc(employer?.dot_number?`DOT ${employer.dot_number}`:[employer?.city,employer?.state].filter(Boolean).join(", "))}</span></td>
        <td><strong>${esc(p?.name||"Program not found")}</strong><span class="se-sub">${esc([s?.selection_period,s?.program_year].filter(Boolean).join(" · "))}</span></td>
        <td><span class="se-badge ${typeClass}">${esc(human(r.selection_type))}</span></td>
        <td><span class="se-badge ${statusClass}">${esc(human(r.status))}</span></td>
        <td>${esc(dateTime(s?.selected_at))}</td>
        <td>${r.notified_at?esc(dateTime(r.notified_at)):'<span class="se-badge warn">Not Sent</span>'}</td>
        <td>${r.completed_at?esc(dateTime(r.completed_at)):"—"}</td>
        <td><div class="se-row-actions"><button class="se-row-btn" type="button" data-se-view="${esc(r.id)}">Details</button><a class="se-row-btn notify" href="random-selection-notify.html?selection=${encoded}#selection=${encoded}">Notify</a></div></td>
        </tr>`;
    }).join("");
    el.results.textContent=`Showing ${start+1}–${Math.min(start+PAGE_SIZE,filtered.length)} of ${filtered.length} selected employee${filtered.length===1?"":"s"}`;
    el.page.textContent=String(page);el.previous.disabled=page<=1;el.next.disabled=page>=Math.ceil(filtered.length/PAGE_SIZE);
}

function openDetails(id) {
    const r=rows.find(x=>x.id===id); if(!r)return;
    const s=selectionMap.get(r.selection_id), p=programMap.get(s?.program_id), employer=employerMap.get(r.employer_id), employee=employeeMap.get(r.employee_id);
    el.detailsTitle.textContent=employeeName(employee);
    el.detailEmployee.textContent=employeeName(employee);
    el.detailNumber.textContent=employee?.employee_number||"—";
    el.detailEmployer.textContent=employerName(employer);
    el.detailProgram.textContent=p?.name||"—";
    el.detailPeriod.textContent=[s?.selection_period,s?.program_year].filter(Boolean).join(" · ")||"—";
    el.detailType.textContent=human(r.selection_type);
    el.detailStatus.textContent=human(r.status);
    el.detailSelected.textContent=dateTime(s?.selected_at);
    el.detailNotified.textContent=r.notified_at?dateTime(r.notified_at):"Not notified";
    el.detailCompleted.textContent=r.completed_at?dateTime(r.completed_at):"—";
    el.viewSelection.href=`admin-dot-selections.html?selection=${encodeURIComponent(r.selection_id)}`;
    const encoded=encodeURIComponent(r.selection_id);
    el.notifyEmployer.href=`random-selection-notify.html?selection=${encoded}#selection=${encoded}`;
    try{sessionStorage.setItem("s4u_random_selection_id",r.selection_id);localStorage.setItem("s4u_random_selection_id",r.selection_id);}catch(_){}
    el.detailsBackdrop.classList.add("open");el.detailsBackdrop.setAttribute("aria-hidden","false");document.body.style.overflow="hidden";
}

function closeDetails(){el.detailsBackdrop.classList.remove("open");el.detailsBackdrop.setAttribute("aria-hidden","true");document.body.style.overflow="";}
function loading(){el.tableBody.innerHTML='<tr><td colspan="9" class="se-loading">Loading selected employees...</td></tr>';}
function tableError(text){el.tableBody.innerHTML=`<tr><td colspan="9" class="se-error">${esc(text)}</td></tr>`;}
function employeeName(x){if(!x)return"Employee not found";return [x.first_name,x.last_name].filter(Boolean).join(" ").trim()||x.email||x.employee_number||"Unnamed Employee";}
function employerName(x){return x?.employer_name||x?.legal_name||"Employer not found";}
function human(v){return String(v||"—").replace(/_/g," ").replace(/\b\w/g,c=>c.toUpperCase());}
function dateTime(v){if(!v)return"—";const d=new Date(v);return Number.isNaN(d.getTime())?"—":d.toLocaleString(undefined,{year:"numeric",month:"short",day:"numeric",hour:"numeric",minute:"2-digit"});}
function esc(v){return String(v??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");}
})();
