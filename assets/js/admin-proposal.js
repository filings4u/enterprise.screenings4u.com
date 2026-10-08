(()=>{"use strict";

let db=null,current=null;
let services=[],prices=[],employers=[],profiles=[],items=[],milestones=[];
const E={};

document.addEventListener("DOMContentLoaded",init);

function cache(){
  [
    "message","pageTitle","recipientType","recipient","validUntil","customerName","customerEmail","customerPhone","title",
    "executiveSummary","clientNeeds","proposedSolution","valueProposition","scopeOfWork","deliverables","qualifications",
    "implementationPlan","timelineSummary","addMilestone","milestones","service","price","qty","discount","addItem","items",
    "subtotal","discountTotal","total","terms","nextSteps","internalNotes","statusText","cancel","duplicate","save","markSent"
  ].forEach(id=>E[id]=document.getElementById(id));
}

function bind(){
  E.recipientType?.addEventListener("change",recipients);
  E.recipient?.addEventListener("change",recipientChanged);
  E.service?.addEventListener("change",serviceChanged);
  E.addItem?.addEventListener("click",addItem);
  E.items?.addEventListener("click",itemClick);
  E.items?.addEventListener("change",itemChange);
  E.addMilestone?.addEventListener("click",()=>{
    milestones.push({title:"",target_date:"",description:""});
    drawMilestones();
  });
  E.milestones?.addEventListener("input",milestoneInput);
  E.milestones?.addEventListener("click",milestoneClick);
  E.save?.addEventListener("click",()=>save(false));
  E.markSent?.addEventListener("click",()=>save(true));
  E.cancel?.addEventListener("click",cancelProposal);
  E.duplicate?.addEventListener("click",duplicateProposal);
}

async function client(){
  for(let i=0;i<40;i++){
    try{
      if(typeof window.getScreenings4uSupabase==="function"){
        const c=await window.getScreenings4uSupabase();
        if(c?.functions)return c;
      }
      if(window.screenings4uSupabase?.functions)return window.screenings4uSupabase;
      if(window.supabaseClient?.functions)return window.supabaseClient;
    }catch(_){}
    await new Promise(r=>setTimeout(r,75));
  }
  return null;
}

async function call(body){
  const {data,error}=await db.functions.invoke("proposal-actions",{body});
  if(error){
    let m=error.message||"Proposal action failed.";
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
  bind();
  try{
    db=await client();
    if(!db)throw Error("Supabase client not found.");

    const {data}=await db.auth.getSession();
    if(!data?.session?.user){
      location.replace("admin-login.html");
      return;
    }

    const d=await call({action:"list"});
    services=Array.isArray(d.services)?d.services:[];
    prices=Array.isArray(d.prices)?d.prices:[];
    employers=Array.isArray(d.employers)?d.employers:[];
    profiles=Array.isArray(d.profiles)?d.profiles:[];

    populateServices();
    recipients();

    const id=new URLSearchParams(location.search).get("id");
    if(id){
      current=(d.proposals||[]).find(x=>x.id===id);
      if(!current)throw Error("Proposal not found.");
      fill(current);
    }else{
      E.validUntil.value=new Date(Date.now()+30*86400000).toISOString().slice(0,10);
      drawItems();
      drawMilestones();
    }

    if(!services.length){
      msg("No active services were returned from Supabase.","error");
    }
  }catch(e){
    console.error("admin-proposal init",e);
    msg(e.message||"Unable to load proposal.","error");
  }
}

function populateServices(){
  if(!E.service)return;
  const active=services.filter(x=>x.active!==false);
  E.service.innerHTML=active.length
    ? active.map(x=>`<option value="${esc(x.id)}">${esc(x.name)}${x.sku?` — ${esc(x.sku)}`:""}</option>`).join("")
    : '<option value="">No active services available</option>';
  serviceChanged();
}

function getPrice(serviceId){
  const p=prices
    .filter(x=>x.service_id===serviceId && x.active!==false)
    .sort((a,b)=>new Date(b.effective_from||0)-new Date(a.effective_from||0))[0];
  return Number(p?.amount||0);
}

function serviceChanged(){
  if(!E.price)return;
  const id=E.service?.value||"";
  E.price.value=id?getPrice(id).toFixed(2):"0.00";
}

function recipients(){
  if(!E.recipient)return;
  if(E.recipientType?.value==="employer"){
    E.recipient.innerHTML='<option value="">Select employer...</option>'+
      employers.map(x=>`<option value="${esc(x.id)}">${esc(x.employer_name)}${x.billing_email||x.email?` — ${esc(x.billing_email||x.email)}`:""}</option>`).join("");
  }else{
    E.recipient.innerHTML='<option value="">Manual / new customer</option>'+
      profiles.filter(x=>x.is_active!==false&&x.email).map(x=>{
        const name=x.display_name||[x.first_name,x.last_name].filter(Boolean).join(" ")||x.email;
        return `<option value="${esc(x.id)}">${esc(name)} — ${esc(x.email)}</option>`;
      }).join("");
  }
}

function recipientChanged(){
  if(!E.recipient?.value)return;
  if(E.recipientType.value==="employer"){
    const x=employers.find(e=>e.id===E.recipient.value);
    if(x){
      E.customerName.value=x.employer_name||"";
      E.customerEmail.value=x.billing_email||x.email||"";
      E.customerPhone.value=x.phone||"";
    }
  }else{
    const x=profiles.find(p=>p.id===E.recipient.value);
    if(x){
      E.customerName.value=x.display_name||[x.first_name,x.last_name].filter(Boolean).join(" ");
      E.customerEmail.value=x.email||"";
      E.customerPhone.value=x.phone||"";
    }
  }
}

function fill(p){
  E.pageTitle.textContent=`${p.proposal_number} — ${p.title}`;
  E.recipientType.value=p.recipient_type||"customer";
  recipients();
  E.recipient.value=p.employer_id||p.customer_user_id||"";
  E.validUntil.value=p.valid_until||"";
  E.customerName.value=p.customer_name||"";
  E.customerEmail.value=p.customer_email||"";
  E.customerPhone.value=p.customer_phone||"";
  E.title.value=p.title||"";

  const map={
    executiveSummary:"executive_summary",
    clientNeeds:"client_needs",
    proposedSolution:"proposed_solution",
    valueProposition:"value_proposition",
    scopeOfWork:"scope_of_work",
    deliverables:"deliverables",
    qualifications:"qualifications",
    implementationPlan:"implementation_plan",
    timelineSummary:"timeline_summary",
    terms:"terms",
    nextSteps:"next_steps",
    internalNotes:"internal_notes"
  };
  Object.entries(map).forEach(([id,key])=>{ if(E[id])E[id].value=p[key]||""; });

  items=(p.items||[]).map(x=>({
    ...x,
    quantity:Number(x.quantity||1),
    unit_price:Number(x.unit_price||0),
    discount_amount:Number(x.discount_amount||0),
    tax_rate:0
  }));
  milestones=(p.milestones||[]).map(x=>({...x}));

  E.statusText.textContent=human(p.status).toUpperCase();
  E.cancel.hidden=["cancelled","accepted","declined"].includes(p.status);
  E.duplicate.hidden=false;

  drawItems();
  drawMilestones();
}

function addItem(){
  const s=services.find(x=>x.id===E.service?.value);
  if(!s){
    msg("Select a service before adding it.","error");
    return;
  }
  items.push({
    service_id:s.id,
    description:s.name,
    quantity:Math.max(.01,Number(E.qty?.value)||1),
    unit_price:Math.max(0,Number(E.price?.value)||0),
    discount_amount:Math.max(0,Number(E.discount?.value)||0),
    tax_rate:0
  });
  E.qty.value="1";
  E.discount.value="0";
  drawItems();
}

function itemClick(e){
  const b=e.target.closest("[data-remove]");
  if(!b)return;
  items.splice(Number(b.dataset.remove),1);
  drawItems();
}

function itemChange(e){
  const i=Number(e.target.dataset.i),key=e.target.dataset.k;
  if(!Number.isInteger(i)||!items[i]||!key)return;
  items[i][key]=key==="description"?e.target.value:Math.max(0,Number(e.target.value)||0);
  drawItems();
}

function totals(){
  let sub=0,disc=0,total=0;
  for(const x of items){
    const base=x.quantity*x.unit_price;
    const d=Math.min(base,x.discount_amount||0);
    x.tax_rate=0;
    sub+=base;disc+=d;total+=base-d;
  }
  return{sub,disc,tax:0,total};
}

function drawItems(){
  if(!E.items)return;
  E.items.innerHTML=items.length?items.map((x,i)=>{
    const base=x.quantity*x.unit_price;
    const d=Math.min(base,x.discount_amount||0);
    x.tax_rate=0;
    const line=base-d;
    return `<tr>
      <td><input style="width:240px" data-i="${i}" data-k="description" value="${esc(x.description)}"></td>
      <td><input style="width:70px" data-i="${i}" data-k="quantity" type="number" min=".01" step=".01" value="${x.quantity}"></td>
      <td><input style="width:90px" data-i="${i}" data-k="unit_price" type="number" min="0" step=".01" value="${x.unit_price}"></td>
      <td><input style="width:90px" data-i="${i}" data-k="discount_amount" type="number" min="0" step=".01" value="${x.discount_amount||0}"></td>
      <td>${money(line)}</td>
      <td><button class="remove" type="button" data-remove="${i}">Remove</button></td>
    </tr>`;
  }).join(""):'<tr><td colspan="6" style="text-align:center;color:#748196">No commercial services added yet.</td></tr>';

  const t=totals();
  E.subtotal.textContent=money(t.sub);
  E.discountTotal.textContent=money(t.disc);
  E.total.textContent=money(t.total);
}

function drawMilestones(){
  if(!E.milestones)return;
  E.milestones.innerHTML=milestones.map((x,i)=>`<div class="milestone">
    <input data-mi="${i}" data-mk="title" placeholder="Milestone" value="${esc(x.title||"")}">
    <input data-mi="${i}" data-mk="target_date" type="date" value="${esc(x.target_date||"")}">
    <input data-mi="${i}" data-mk="description" placeholder="Outcome / checkpoint" value="${esc(x.description||"")}">
    <button class="remove" type="button" data-mremove="${i}">Remove</button>
  </div>`).join("");
}

function milestoneInput(e){
  const i=Number(e.target.dataset.mi),key=e.target.dataset.mk;
  if(Number.isInteger(i)&&milestones[i]&&key)milestones[i][key]=e.target.value;
}

function milestoneClick(e){
  const b=e.target.closest("[data-mremove]");
  if(!b)return;
  milestones.splice(Number(b.dataset.mremove),1);
  drawMilestones();
}

function payload(){
  return{
    action:current?"update":"create",
    id:current?.id||null,
    title:E.title.value.trim(),
    recipient_type:E.recipientType.value,
    customer_user_id:E.recipientType.value==="customer"?E.recipient.value||null:null,
    employer_id:E.recipientType.value==="employer"?E.recipient.value||null:null,
    customer_name:E.customerName.value.trim(),
    customer_email:E.customerEmail.value.trim(),
    customer_phone:E.customerPhone.value.trim(),
    valid_until:E.validUntil.value||null,
    executive_summary:E.executiveSummary.value,
    client_needs:E.clientNeeds.value,
    proposed_solution:E.proposedSolution.value,
    value_proposition:E.valueProposition.value,
    scope_of_work:E.scopeOfWork.value,
    deliverables:E.deliverables.value,
    qualifications:E.qualifications.value,
    implementation_plan:E.implementationPlan.value,
    timeline_summary:E.timelineSummary.value,
    terms:E.terms.value,
    next_steps:E.nextSteps.value,
    internal_notes:E.internalNotes.value,
    status:current?.status||"draft",
    items,
    milestones
  };
}

function valid(){
  if(!E.title.value.trim()){
    msg("Proposal title is required.","error"); E.title.focus(); return false;
  }
  if(!E.customerName.value.trim()){
    msg("Client name is required.","error"); E.customerName.focus(); return false;
  }
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(E.customerEmail.value.trim())){
    msg("A valid client email is required.","error"); E.customerEmail.focus(); return false;
  }
  return true;
}

async function save(markSent){
  if(!valid())return;
  E.save.disabled=true;
  E.markSent.disabled=true;
  try{
    msg(markSent?"Saving proposal before marking sent…":"Saving proposal…","ok");
    const d=await call(payload());
    current=d.proposal;
    history.replaceState(null,"",`admin-proposal.html?id=${encodeURIComponent(current.id)}`);

    if(markSent){
      const s=await call({action:"status",id:current.id,status:"sent"});
      current=s.proposal;
    }

    fill(current);
    msg(markSent
      ?`Proposal ${current.proposal_number} saved and marked sent.`
      :`Proposal ${current.proposal_number} saved.`,"ok");
  }catch(e){
    console.error("proposal save",e);
    msg(e.message||"Unable to save proposal.","error");
  }finally{
    E.save.disabled=false;
    E.markSent.disabled=false;
  }
}

async function cancelProposal(){
  if(!current||!confirm(`Cancel proposal ${current.proposal_number}?`))return;
  try{
    const d=await call({action:"status",id:current.id,status:"cancelled"});
    current=d.proposal;
    fill(current);
    msg("Proposal cancelled.","ok");
  }catch(e){msg(e.message||"Unable to cancel proposal.","error");}
}

async function duplicateProposal(){
  if(!current)return;
  try{
    const d=await call({action:"duplicate",id:current.id});
    location.href=`admin-proposal.html?id=${encodeURIComponent(d.proposal.id)}`;
  }catch(e){msg(e.message||"Unable to duplicate proposal.","error");}
}

function msg(t,type="ok"){
  if(!E.message)return;
  E.message.textContent=t;
  E.message.className=`message show ${type}`;
}
function money(v){return new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(Number(v||0));}
function human(v){return String(v||"—").replace(/_/g," ").replace(/\b\w/g,c=>c.toUpperCase());}
function esc(v){return String(v??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");}

})();