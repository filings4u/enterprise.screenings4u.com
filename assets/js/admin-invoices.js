(()=>{"use strict";
  async function waitForAdminAuth(){
    if(window.S4UPortalGuard?.waitForAdmin){
      const state=await window.S4UPortalGuard.waitForAdmin();
      if(!state?.user?.id)throw Error("Authentication required.");
      return state;
    }
    if(window.S4UAuth?.requireAuth){
      const state=await window.S4UAuth.requireAuth({portal:"admin",loginPage:"admin-login.html"});
      if(!state?.user?.id)throw Error("Authentication required.");
      return state;
    }
    throw Error("Admin authentication service is unavailable.");
  }


let db=null;
let invoices=[];
const E={};

document.addEventListener("DOMContentLoaded",init);

function cache(){
  [
    "refresh","message","sTotal","sOutstanding","sPastDue",
    "sDue","sPaid","search","statusFilter","body","empty"
  ].forEach(id=>E[id]=document.getElementById(id));
}

async function client(){
  for(let i=0;i<40;i++){
    try{
      if(typeof window.getScreenings4uSupabase==="function"){
        const c=await window.getScreenings4uSupabase();
        if(c?.functions)return c;
      }
      if(window.screenings4uSupabase?.functions)return window.screenings4uSupabase;
    }catch(_){}
    await new Promise(r=>setTimeout(r,75));
  }
  return null;
}

async function call(body){
  const {data,error}=await db.functions.invoke("invoice-actions",{body});
  if(error){
    let m=error.message||"Invoice action failed.";
    try{
      const r=error.context;
      if(r?.clone){
        const j=await r.clone().json();
        if(j?.error)m=j.error;
      }
    }catch(_){}
    throw Error(m);
  }
  if(data?.error)throw Error(data.error);
  return data;
}

async function init(){
  cache();

  E.refresh?.addEventListener("click",load);
  E.search?.addEventListener("input",render);
  E.statusFilter?.addEventListener("change",render);

  try{
    db=await client();
    if(!db)throw Error("Supabase client not found.");

    await waitForAdminAuth();
    await load();
  }catch(e){
    console.error("admin-invoices init",e);
    msg(e.message||"Unable to load invoices.","error");
  }
}

async function load(){
  if(E.refresh)E.refresh.disabled=true;

  try{
    const d=await call({action:"list"});
    invoices=Array.isArray(d.invoices)?d.invoices:[];
    stats();
    render();
  }catch(e){
    console.error("admin-invoices load",e);
    msg(e.message||"Unable to load invoices.","error");
  }finally{
    if(E.refresh)E.refresh.disabled=false;
  }
}

function stats(){
  if(!E.sTotal)return;

  const outstanding=invoices.filter(x=>
    Number(x.amount_due||0)>0 &&
    !["void","uncollectible"].includes(String(x.status||""))
  );

  const now=new Date();

  const pastDue=invoices.filter(x=>{
    if(x.status==="past_due")return true;
    if(!x.due_date||Number(x.amount_due||0)<=0)return false;
    return new Date(`${x.due_date}T23:59:59`)<now;
  });

  E.sTotal.textContent=String(invoices.length);
  E.sOutstanding.textContent=String(outstanding.length);
  E.sPastDue.textContent=String(pastDue.length);
  E.sDue.textContent=money(outstanding.reduce((s,x)=>s+Number(x.amount_due||0),0));
  E.sPaid.textContent=money(invoices.reduce((s,x)=>s+Number(x.amount_paid||0),0));
}

function render(){
  if(!E.body)return;

  const q=String(E.search?.value||"").toLowerCase().trim();
  const st=E.statusFilter?.value||"all";

  const rows=invoices.filter(x=>{
    const hay=[
      x.invoice_number,
      x.customer_name,
      x.customer_email
    ].filter(Boolean).join(" ").toLowerCase();

    return (!q||hay.includes(q)) && (st==="all"||x.status===st);
  });

  if(E.empty)E.empty.hidden=rows.length>0;

  E.body.innerHTML=rows.map(x=>`
    <tr>
      <td>
        <div class="main">
          <strong>${esc(x.invoice_number)}</strong>
          <small>${esc(x.customer_email||"")}</small>
        </div>
      </td>
      <td>${esc(x.customer_name||"—")}</td>
      <td><span class="badge ${esc(x.status)}">${human(x.status)}</span></td>
      <td>${esc(x.issue_date||"—")}</td>
      <td>${esc(x.due_date||"—")}</td>
      <td class="money">${money(x.total)}</td>
      <td>${money(x.amount_paid)}</td>
      <td class="money">${money(x.amount_due)}</td>
      <td>
        <div class="row-actions">
          <a class="row-btn" href="admin-invoice.html?id=${encodeURIComponent(x.id)}">Open</a>
          <button class="row-btn" type="button" data-pdf="${esc(x.id)}">PDF</button>
        </div>
      </td>
    </tr>
  `).join("");

  E.body.querySelectorAll("[data-pdf]").forEach(btn=>{
    btn.addEventListener("click",()=>downloadById(btn.dataset.pdf));
  });
}

async function downloadById(id){
  const invoice=invoices.find(x=>x.id===id);
  if(!invoice)return;

  try{
    if(!window.S4UDocuments?.download){
      throw Error("Document generator is not loaded.");
    }
    await window.S4UDocuments.download(db,invoice,"invoice");
  }catch(e){
    console.error("invoice pdf",e);
    msg(e.message||"Unable to download invoice.","error");
  }
}

function msg(text,type="ok"){
  if(!E.message)return;
  E.message.textContent=text;
  E.message.className=`message show ${type}`;
}

function money(v){
  return new Intl.NumberFormat("en-US",{
    style:"currency",
    currency:"USD"
  }).format(Number(v||0));
}

function human(v){
  return String(v||"")
    .replace(/_/g," ")
    .replace(/\b\w/g,c=>c.toUpperCase());
}

function esc(v){
  return String(v??"")
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;")
    .replace(/'/g,"&#039;");
}

})();