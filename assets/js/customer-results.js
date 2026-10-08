(() => {
"use strict";

const state = { db:null, filter:"all", search:"", newestFirst:true, results:[] };
const $ = id => document.getElementById(id);

document.addEventListener("DOMContentLoaded", initialize);

async function initialize(){
  bindControls();
  await loadResults();
}

function bindControls(){
  document.querySelectorAll(".customer-results-filter").forEach(button => {
    button.addEventListener("click", () => {
      state.filter = button.dataset.resultFilter || "all";
      document.querySelectorAll(".customer-results-filter").forEach(item => {
        const active = item === button;
        item.classList.toggle("is-active", active);
        item.setAttribute("aria-selected", active ? "true" : "false");
      });
      renderResults();
    });
  });

  $("customer-results-search-input")?.addEventListener("input", e => {
    state.search = e.target.value.trim().toLowerCase();
    renderResults();
  });

  $("customer-results-sort")?.addEventListener("click", () => {
    state.newestFirst = !state.newestFirst;
    const label = $("customer-results-sort")?.querySelector("span");
    if (label) label.textContent = state.newestFirst ? "Newest First" : "Oldest First";
    renderResults();
  });
}

async function loadResults(){
  showLoading(true);
  try{
    state.db = state.db || await getScreenings4uSupabase();
    const { data, error } = await state.db.functions.invoke("customer-documents-actions", { body:{ action:"list" } });
    if(error) throw error;
    if(data?.error) throw new Error(data.error);

    const docs = data?.documents || [];
    state.results = docs.map(doc => {
      const test = doc.test || {};
      const testDate = test.collected_at || test.scheduled_at || test.created_at || doc.created_at;
      const releasedAt = test.result_received_at || doc.created_at;
      const rawStatus = String(test.result_status || test.status || "").toLowerCase();
      const status = doc.storage_path ? "available" : (rawStatus.includes("complete") || rawStatus.includes("result") ? "available" : "pending");
      const service = pretty(test.test_type || doc.document_type || "Drug Test");
      return {
        id: doc.id,
        document_id: doc.id,
        service,
        status,
        test_date: testDate,
        released_at: releasedAt,
        ccf_number: test.ccf_number || "",
        test_reason: test.test_reason || "",
        collection_site: test.collection_site_name || "",
        title: doc.title || `${service} Result`
      };
    });

    updateSummary();
    renderResults();
  } catch(error){
    console.error("[Customer Results]", error);
    state.results = [];
    updateSummary();
    renderResults();
    notify("Unable to load your results.", "error");
  } finally {
    showLoading(false);
  }
}

function updateSummary(){
  const available = state.results.filter(r => r.status === "available").length;
  const pending = state.results.filter(r => r.status === "pending").length;
  setText("results-available-count", available);
  setText("results-pending-count", pending);
  setText("results-total-count", state.results.length);
}

function renderResults(){
  const list = $("customer-results-list");
  const empty = $("customer-results-empty");
  if(!list || !empty) return;

  let filtered = state.results.slice();

  if(state.filter !== "all") filtered = filtered.filter(r => r.status === state.filter);

  if(state.search){
    filtered = filtered.filter(r => [
      r.id, r.service, r.status, r.ccf_number, r.test_reason, r.collection_site, r.title
    ].filter(Boolean).join(" ").toLowerCase().includes(state.search));
  }

  filtered.sort((a,b) => {
    const first = new Date(a.test_date || 0).getTime();
    const second = new Date(b.test_date || 0).getTime();
    return state.newestFirst ? second - first : first - second;
  });

  if(!filtered.length){
    list.hidden = true;
    list.innerHTML = "";
    empty.hidden = false;
    return;
  }

  empty.hidden = true;
  list.hidden = false;
  list.innerHTML = "";
  filtered.forEach(result => list.appendChild(createResultRow(result)));
}

function createResultRow(result){
  const row = document.createElement("article");
  row.className = "customer-result-row";

  row.innerHTML = `
    <div class="customer-result-service">
      <div class="customer-result-service-icon">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="5" y="3" width="14" height="18" rx="2"></rect>
          <path d="M9 8h6"></path>
          <path d="M9 12h6"></path>
        </svg>
      </div>
      <div class="customer-result-service-copy">
        <strong></strong>
        <span></span>
      </div>
    </div>

    <div class="customer-result-meta">
      <span class="customer-result-meta-label">Test Date</span>
      <span class="customer-result-meta-value"></span>
    </div>

    <div class="customer-result-meta">
      <span class="customer-result-meta-label">Status</span>
      <span class="customer-result-status"></span>
    </div>

    <button type="button" class="customer-result-view"></button>
  `;

  row.querySelector(".customer-result-service-copy strong").textContent = result.title;
  const details = [result.service, result.ccf_number ? `CCF ${result.ccf_number}` : "", result.collection_site].filter(Boolean).join(" · ");
  row.querySelector(".customer-result-service-copy span").textContent = details || result.service;
  row.querySelector(".customer-result-meta-value").textContent = formatDate(result.test_date);

  const status = row.querySelector(".customer-result-status");
  status.textContent = formatStatus(result.status);
  status.classList.add(result.status);

  const button = row.querySelector(".customer-result-view");
  if(result.status === "available"){
    button.innerHTML = `Download Result <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12"></path><path d="m7 10 5 5 5-5"></path><path d="M5 21h14"></path></svg>`;
    button.addEventListener("click", () => downloadResult(result, button));
  } else {
    button.textContent = "Processing";
    button.disabled = true;
    button.setAttribute("aria-disabled", "true");
  }

  return row;
}

async function downloadResult(result, button){
  const old = button.innerHTML;
  button.disabled = true;
  button.textContent = "Preparing...";
  try{
    const { data, error } = await state.db.functions.invoke("customer-documents-actions", {
      body:{ action:"download", id:result.document_id }
    });
    if(error) throw error;
    if(!data?.url) throw new Error(data?.error || "Download unavailable");

    const a = document.createElement("a");
    a.href = data.url;
    a.rel = "noopener";
    a.download = result.title || "screenings4u-result.pdf";
    document.body.appendChild(a);
    a.click();
    a.remove();
  } catch(error){
    console.error("[Customer Results] download", error);
    notify("Unable to download this result.", "error");
  } finally {
    button.disabled = false;
    button.innerHTML = old;
  }
}

function showLoading(value){ if($("customer-results-loading")) $("customer-results-loading").hidden = !value; }
function setText(id,value){ if($(id)) $(id).textContent = String(value); }
function formatDate(value){ const d=new Date(value); return Number.isNaN(d.getTime()) ? "—" : new Intl.DateTimeFormat("en-US",{month:"short",day:"numeric",year:"numeric"}).format(d); }
function formatStatus(value){ return pretty(value); }
function pretty(value){ return String(value||"").replace(/[_-]+/g," ").replace(/\b\w/g,c=>c.toUpperCase()); }
function notify(message,type){ if(window.Screenings4uUI?.toast) return window.Screenings4uUI.toast(message,type); if(window.showToast) return window.showToast(message,type); alert(message); }

})();