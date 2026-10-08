(()=>{
  "use strict";
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const state={db:null,invoices:[],services:[]};
  const money=v=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(Number(v||0));
  const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[c]));
  const human=v=>String(v||"").replaceAll("_"," ").replace(/\b\w/g,c=>c.toUpperCase());
  const today=()=>new Date().toISOString().slice(0,10);

  document.addEventListener("DOMContentLoaded",init,{once:true});

  async function client(){
    for(let i=0;i<50;i++){
      try{
        if(typeof window.getScreenings4uSupabase==="function"){
          const c=await window.getScreenings4uSupabase(); if(c?.functions)return c;
        }
        if(window.screenings4uSupabase?.functions)return window.screenings4uSupabase;
      }catch(_){ }
      await new Promise(r=>setTimeout(r,60));
    }
    throw Error("Supabase client is unavailable.");
  }

  async function waitForAdmin(){
    if(window.S4UPortalGuard?.waitForAdmin){const s=await window.S4UPortalGuard.waitForAdmin();if(s?.user?.id)return s;}
    if(window.S4UAuth?.requireAuth){const s=await window.S4UAuth.requireAuth({portal:"admin",loginPage:"admin-login.html"});if(s?.user?.id)return s;}
    throw Error("Training administrator authentication is required.");
  }

  async function api(body){
    const {data,error}=await state.db.functions.invoke("lms-admin-billing",{body});
    if(error){
      let message=error.message||"Training billing request failed.";
      try{const r=error.context;if(r?.clone){const j=await r.clone().json();if(j?.error)message=j.error}}catch(_){ }
      throw Error(message);
    }
    if(data?.error)throw Error(data.error);
    return data||{};
  }

  async function init(){
    bind();
    try{
      state.db=await client();
      await waitForAdmin();
      await load();
    }catch(e){fail(e);}
  }

  function bind(){
    $("#refreshBilling")?.addEventListener("click",async e=>{const b=e.currentTarget;b.disabled=true;try{await load();message("Training billing refreshed.");}catch(err){fail(err)}finally{b.disabled=false}});
    $("#createInvoice")?.addEventListener("click",()=>{location.href="admin-lms-invoice.html"});
    $("#exportInvoices")?.addEventListener("click",exportCsv);
    $("#invoiceSearch")?.addEventListener("input",render);
    $("#invoiceStatusFilter")?.addEventListener("change",render);
    $("#invoiceBalanceFilter")?.addEventListener("change",render);
    $("#clearInvoiceFilters")?.addEventListener("click",()=>{$("#invoiceSearch").value="";$("#invoiceStatusFilter").value="all";$("#invoiceBalanceFilter").value="all";render()});
    $("#invoiceRows")?.addEventListener("click",tableClick);
  }

  async function load(){
    const d=await api({action:"bootstrap"});
    state.invoices=Array.isArray(d.invoices)?d.invoices:[];
    state.services=Array.isArray(d.services)?d.services:[];
    stats();
    render();
  }

  function displayStatus(x){
    const raw=String(x?.status||"draft").toLowerCase();
    if(Number(x?.amount_due||0)<=0||raw==="paid")return "paid";
    if(["void","uncollectible"].includes(raw))return raw;
    if(x?.due_date && x.due_date<today())return "past_due";
    return raw;
  }

  function stats(){
    const invoices=state.invoices;
    const open=invoices.filter(x=>Number(x.amount_due||0)>0&&!["void","uncollectible"].includes(displayStatus(x)));
    const past=invoices.filter(x=>displayStatus(x)==="past_due");
    $("#metricTotal").textContent=String(invoices.length);
    $("#metricOutstanding").textContent=money(open.reduce((a,x)=>a+Number(x.amount_due||0),0));
    $("#metricOutstandingCount").textContent=`${open.length} open invoice${open.length===1?"":"s"}`;
    $("#metricPastDue").textContent=money(past.reduce((a,x)=>a+Number(x.amount_due||0),0));
    $("#metricPastDueCount").textContent=`${past.length} past due`;
    $("#metricCollected").textContent=money(invoices.reduce((a,x)=>a+Number(x.amount_paid||0),0));
    $("#metricDrafts").textContent=String(invoices.filter(x=>String(x.status)==="draft").length);
  }

  function filtered(){
    const q=String($("#invoiceSearch")?.value||"").trim().toLowerCase();
    const st=$("#invoiceStatusFilter")?.value||"all";
    const bal=$("#invoiceBalanceFilter")?.value||"all";
    return state.invoices.filter(x=>{
      const hay=[x.invoice_number,x.customer_name,x.customer_email].filter(Boolean).join(" ").toLowerCase();
      const ds=displayStatus(x),due=Number(x.amount_due||0)>0;
      return (!q||hay.includes(q))&&(st==="all"||ds===st)&&(bal==="all"||(bal==="due"&&due)||(bal==="paid"&&!due));
    });
  }

  function render(){
    const rows=filtered();
    $("#invoiceCount").textContent=`${rows.length} invoice${rows.length===1?"":"s"}`;
    $("#invoiceRows").innerHTML=rows.length?rows.map(x=>{
      const st=displayStatus(x);
      return `<tr>
        <td><strong>${esc(x.invoice_number)}</strong><span class="sub">${esc(x.id.slice(0,8))}</span></td>
        <td><strong>${esc(x.customer_name||"—")}</strong><span class="sub">${esc(x.customer_email||"")}</span></td>
        <td><span class="lms-status ${esc(st)}">${esc(human(st))}</span></td>
        <td>${esc(x.issue_date||"—")}</td><td>${esc(x.due_date||"—")}</td>
        <td class="lms-money">${money(x.total)}</td><td class="lms-money">${money(x.amount_paid)}</td><td class="lms-money"><strong>${money(x.amount_due)}</strong></td>
        <td><div class="lms-row-actions"><a class="lms-row-btn primary" href="admin-lms-invoice.html?id=${encodeURIComponent(x.id)}">Open Invoice</a><button class="lms-row-btn" type="button" data-pdf="${esc(x.id)}">PDF</button></div></td>
      </tr>`;
    }).join(""):`<tr><td colspan="9"><div class="lms-empty">No Training invoices match these filters.</div></td></tr>`;
  }

  function tableClick(e){
    const pdf=e.target.closest("[data-pdf]");if(pdf){const x=state.invoices.find(v=>v.id===pdf.dataset.pdf);if(x)downloadPdf(x)}
  }

  async function downloadPdf(x){
    try{
      if(!window.S4UDocuments)throw Error("Training invoice PDF service is unavailable.");
      await window.S4UDocuments.download(state.db,x,"invoice");
    }catch(e){fail(e)}
  }

  function exportCsv(){
    const rows=[["Invoice","Customer","Email","Status","Issue Date","Due Date","Total","Paid","Balance Due"]].concat(filtered().map(x=>[x.invoice_number,x.customer_name,x.customer_email,displayStatus(x),x.issue_date,x.due_date,x.total,x.amount_paid,x.amount_due]));
    const csv=rows.map(r=>r.map(v=>`"${String(v??"").replaceAll('"','""')}"`).join(",")).join("\n");const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"}));a.download=`training-invoices-${today()}.csv`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1000)
  }

  function message(text,type="ok"){const e=$("#billingMessage");if(!e)return;e.textContent=text;e.className=`lms-billing-message show ${type}`;clearTimeout(message.t);message.t=setTimeout(()=>{e.className="lms-billing-message"},7000)}
  function fail(e){console.error("[Training Billing]",e);message(e?.message||String(e),"error")}
})();
