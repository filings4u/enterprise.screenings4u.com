/* SCREENINGS4U — EMPLOYER PROPOSALS — LIVE */
(function(){
"use strict";
const state={proposals:[],current:null}; let db;
document.addEventListener("DOMContentLoaded",init);
async function init(){bind();try{db=await getScreenings4uSupabase();await load();}catch(e){fail(await msg(e));}}
function bind(){
  q("proposal-search")?.addEventListener("input",render); q("proposal-status-filter")?.addEventListener("change",render);
  ["request-proposal-btn","empty-request-proposal-btn","custom-proposal-btn"].forEach(id=>q(id)?.addEventListener("click",requestProposal));
  document.querySelectorAll("[data-close-proposal-modal]").forEach(x=>x.addEventListener("click",close));
}
async function call(body){
 const action=String(body?.action||"");
 if(action==="list"){
  const {data,error}=await db.from("testing_proposals").select("*,testing_proposal_items(*),testing_proposal_change_requests(*)").order("created_at",{ascending:false});
  if(error)throw error;
  return {proposals:(data||[]).map(p=>({...p,proposal_items:p.testing_proposal_items||[],change_requests:p.testing_proposal_change_requests||[]}))};
 }
 const id=String(body?.proposal_id||"");
 const {data:{user}}=await db.auth.getUser();if(!user)throw new Error("Your employer session has expired.");
 const current=state.proposals.find(x=>x.id===id);if(!current)throw new Error("Proposal not found.");
 const now=new Date().toISOString();
 if(action==="mark_viewed"&&current.status==="sent"){
  const {error}=await db.from("testing_proposals").update({status:"viewed",updated_at:now}).eq("id",id);if(error)throw error;
  await db.from("testing_proposal_events").insert({id:crypto.randomUUID(),proposal_id:id,event_type:"viewed",actor_user_id:user.id,metadata:{},created_at:now});
 }
 if(action==="accept"){
  const {error}=await db.from("testing_proposals").update({status:"accepted",accepted_at:now,updated_at:now}).eq("id",id);if(error)throw error;
  await db.from("testing_proposal_events").insert({id:crypto.randomUUID(),proposal_id:id,event_type:"accepted",actor_user_id:user.id,metadata:{},created_at:now});
 }
 if(action==="decline"){
  const reason=String(body?.reason||"").trim();if(!reason)throw new Error("A decline reason is required.");
  const {error}=await db.from("testing_proposals").update({status:"declined",declined_at:now,updated_at:now}).eq("id",id);if(error)throw error;
  await db.from("testing_proposal_events").insert({id:crypto.randomUUID(),proposal_id:id,event_type:"declined",actor_user_id:user.id,metadata:{reason},created_at:now});
 }
 if(action==="request_changes"){
  const changes=Array.isArray(body?.changes)?body.changes:[];if(!changes.length)throw new Error("Describe the requested change.");
  const {error:ce}=await db.from("testing_proposal_change_requests").insert({id:crypto.randomUUID(),proposal_id:id,employer_id:current.employer_id,requested_by:user.id,status:"pending",summary:String(body?.summary||"").trim()||null,changes,created_at:now,updated_at:now});if(ce)throw ce;
  const {error}=await db.from("testing_proposals").update({status:"changes_requested",updated_at:now}).eq("id",id);if(error)throw error;
  await db.from("testing_proposal_events").insert({id:crypto.randomUUID(),proposal_id:id,event_type:"changes_requested",actor_user_id:user.id,metadata:{},created_at:now});
 }
 const {data,error}=await db.from("testing_proposals").select("*,testing_proposal_items(*),testing_proposal_change_requests(*)").eq("id",id).single();if(error)throw error;
 return {proposal:{...data,proposal_items:data.testing_proposal_items||[],change_requests:data.testing_proposal_change_requests||[]}};
}
async function load(){const x=await call({action:"list"});state.proposals=x.proposals||[];summary();render();}
function filtered(){const s=val("proposal-search").toLowerCase(), f=val("proposal-status-filter")||"all";return state.proposals.filter(p=>(!s||`${p.proposal_number||""} ${p.title||""}`.toLowerCase().includes(s))&&(f==="all"||status(p)===f));}
function status(p){let s=String(p.status||"draft").toLowerCase();if(s==="in_review"||s==="changes_requested")return "in_review";return ["draft","sent","viewed","accepted","declined","expired","cancelled"].includes(s)?s:"draft";}
function render(){
 const body=q("proposal-table-body");if(!body)return;const rows=filtered();
 if(!rows.length){body.innerHTML=`<tr><td colspan="7"><div class="proposal-empty-state"><div class="proposal-empty-icon">▤</div><h3>${state.proposals.length?"No proposals match your filters":"No proposals available"}</h3><p>${state.proposals.length?"Try changing your search or status filter.":"Proposals prepared for your organization will appear here."}</p>${state.proposals.length?"":'<button type="button" class="proposal-secondary-btn" id="empty-request-proposal-btn">Request a Proposal</button>'}</div></td></tr>`;q("empty-request-proposal-btn")?.addEventListener("click",requestProposal);return;}
 body.innerHTML=rows.map(p=>`<tr><td><span class="proposal-number">${esc(p.proposal_number||"Proposal")}</span><span class="proposal-name">${esc(p.title||"Service Proposal")}</span></td><td>${date(p.created_at)}</td><td>${date(p.valid_until)}</td><td>${(p.proposal_items||[]).length||"—"}</td><td class="proposal-total">${money(p.total)}</td><td><span class="proposal-status proposal-status-${attr(status(p))}">${label(status(p))}</span></td><td><button type="button" class="proposal-view-btn" data-proposal="${attr(p.id)}">View</button></td></tr>`).join("");
 body.querySelectorAll("[data-proposal]").forEach(b=>b.addEventListener("click",()=>open(b.dataset.proposal)));
}
function summary(){
 const active=state.proposals.filter(p=>["sent","viewed","in_review"].includes(status(p))).length;
 const accepted=state.proposals.filter(p=>status(p)==="accepted").length;
 const pending=active;
 const totalValue=state.proposals.reduce((n,p)=>n+Number(p.total||0),0);

 set("proposal-stat-active",String(active));
 set("proposal-stat-accepted",String(accepted));
 set("proposal-stat-pending",String(pending));
 set("proposal-stat-value",money(totalValue));
}
async function open(id){
 let p=state.proposals.find(x=>x.id===id);if(!p)return;state.current=p;
 if(status(p)==="sent"){try{const x=await call({action:"mark_viewed",proposal_id:id});p=x.proposal;replace(p);}catch(e){console.warn(e);}}
 drawModal(p);q("proposal-modal").hidden=false;
}
function drawModal(p){
 q("proposal-modal-title").textContent=p.proposal_number||p.title||"Proposal";const items=p.proposal_items||[], changes=p.change_requests||[];
 q("proposal-modal-content").innerHTML=`<div class="proposal-detail-grid"><div class="proposal-detail-item"><span>Status</span><strong>${esc(label(status(p)))}</strong></div><div class="proposal-detail-item"><span>Created</span><strong>${date(p.created_at)}</strong></div><div class="proposal-detail-item"><span>Expires</span><strong>${date(p.valid_until)}</strong></div><div class="proposal-detail-item"><span>Total</span><strong>${money(p.total)}</strong></div></div>
 ${p.introduction?`<div class="proposal-copy"><h3>Proposal Overview</h3><p>${esc(p.introduction)}</p></div>`:""}
 <h3 class="proposal-items-heading">Services & Pricing</h3>
 <div class="proposal-live-items">${items.length?items.map((i,n)=>`<div class="proposal-item-row"><div><strong>${esc(i.description)}</strong><small>Qty ${esc(i.quantity)} × ${money(i.unit_price)}</small></div><strong>${money(i.line_total)}</strong><button type="button" class="proposal-text-btn" data-change-item="${n}">Request change</button></div>`).join(""):'<div class="proposal-item-row"><span>No line items.</span><strong>—</strong></div>'}</div>
 ${p.terms?`<div class="proposal-copy"><h3>Terms</h3><p>${esc(p.terms)}</p></div>`:""}
 ${changes.length?`<div class="proposal-change-history"><h3>Requested Changes</h3>${changes.map(c=>`<div class="proposal-change-highlight"><strong>${esc(c.status==="pending"?"Pending admin review":"Change request")}</strong>${c.summary?`<p>${esc(c.summary)}</p>`:""}${(c.changes||[]).map(x=>`<p><b>${esc(x.item||"Proposal")}:</b> ${esc(x.requested)}</p>`).join("")}</div>`).join("")}</div>`:""}`;
 const actionable=["sent","viewed","in_review"].includes(status(p));
 q("proposal-modal-actions").innerHTML=`<button class="proposal-secondary-btn" data-close>Close</button>${actionable?`<button class="proposal-secondary-btn" data-changes>Request Changes</button><button class="proposal-secondary-btn proposal-deny-btn" data-decline>Decline</button><button class="proposal-primary-btn" data-accept>Accept Proposal</button>`:""}`;
 q("proposal-modal-actions").querySelector("[data-close]")?.addEventListener("click",close);
 q("proposal-modal-actions").querySelector("[data-accept]")?.addEventListener("click",accept);
 q("proposal-modal-actions").querySelector("[data-decline]")?.addEventListener("click",declinePopup);
 q("proposal-modal-actions").querySelector("[data-changes]")?.addEventListener("click",()=>changesPopup());
 document.querySelectorAll("[data-change-item]").forEach(b=>b.addEventListener("click",()=>changesPopup(Number(b.dataset.changeItem))));
}
function overlay(title,html,buttons){let x=document.createElement("div");x.className="proposal-response-overlay";x.innerHTML=`<div class="proposal-response-backdrop"></div><div class="proposal-response-card"><div class="proposal-modal-header"><div><span class="proposal-eyebrow">YOUR RESPONSE</span><h2>${esc(title)}</h2></div><button class="proposal-modal-close" data-x>×</button></div><div class="proposal-response-body">${html}</div><div class="proposal-modal-actions">${buttons}</div></div>`;document.body.appendChild(x);x.querySelector("[data-x]").onclick=()=>x.remove();x.querySelector(".proposal-response-backdrop").onclick=()=>x.remove();return x;}
function declinePopup(){const x=overlay("Decline Proposal",`<p>Please tell us why this proposal does not work for your organization. Your explanation will be visible to the admin team.</p><label class="proposal-response-label">Reason for declining<textarea id="decline-reason" rows="5" placeholder="Explain why you are declining this proposal..."></textarea></label>`,`<button class="proposal-secondary-btn" data-cancel>Cancel</button><button class="proposal-deny-confirm" data-submit>Decline Proposal</button>`);x.querySelector("[data-cancel]").onclick=()=>x.remove();x.querySelector("[data-submit]").onclick=async()=>{const reason=x.querySelector("#decline-reason").value.trim();if(!reason)return note(x,"Please enter a reason.");await act(x,{action:"decline",proposal_id:state.current.id,reason});};}
function changesPopup(itemIndex){
 const items=state.current.proposal_items||[];const selected=Number.isInteger(itemIndex)?items[itemIndex]:null;
 const x=overlay("Request Proposal Changes",`<p>Describe exactly what you want changed. Requested changes are stored separately from the original proposal and highlighted for the admin team.</p>${selected?`<div class="proposal-change-original"><span>Original item</span><strong>${esc(selected.description)}</strong><small>${money(selected.line_total)}</small></div>`:""}<label class="proposal-response-label">Requested change<textarea id="change-request" rows="5" placeholder="Example: Change quantity to 25, revise pricing, replace this service..."></textarea></label><label class="proposal-response-label">Additional notes<textarea id="change-summary" rows="3" placeholder="Optional overall notes for the admin team"></textarea></label>`,`<button class="proposal-secondary-btn" data-cancel>Cancel</button><button class="proposal-primary-btn" data-submit>Send Change Request</button>`);
 x.querySelector("[data-cancel]").onclick=()=>x.remove();x.querySelector("[data-submit]").onclick=async()=>{const requested=x.querySelector("#change-request").value.trim(),summary=x.querySelector("#change-summary").value.trim();if(!requested)return note(x,"Describe the change you want.");const changes=[{item_id:selected?.id||null,item:selected?.description||"General proposal",original:selected?{description:selected.description,quantity:selected.quantity,unit_price:selected.unit_price,line_total:selected.line_total}:null,requested}];await act(x,{action:"request_changes",proposal_id:state.current.id,summary,changes});};}
function accept(){
 const x=overlay("Accept Proposal",`<p>You are accepting this proposal as presented, including its services, pricing, and terms.</p><div class="proposal-change-original"><span>Proposal</span><strong>${esc(state.current?.proposal_number||state.current?.title||"Proposal")}</strong><small>${money(state.current?.total)}</small></div>`,`<button class="proposal-secondary-btn" data-cancel>Cancel</button><button class="proposal-primary-btn" data-submit>Accept Proposal</button>`);
 x.querySelector("[data-cancel]").onclick=()=>x.remove();
 x.querySelector("[data-submit]").onclick=()=>act(x,{action:"accept",proposal_id:state.current.id});
}
async function act(pop,body){try{const x=await call(body);if(pop)pop.remove();replace(x.proposal);state.current=x.proposal;drawModal(x.proposal);summary();render();}catch(e){const m=await msg(e);if(pop)note(pop,m);else errorPopup(m);}}
function replace(p){const i=state.proposals.findIndex(x=>x.id===p.id);if(i>=0)state.proposals[i]=p;}
function requestProposal(){
 const x=overlay("Request a Proposal",`<p>Tell the Screenings4u team what your organization needs. This will take you to employer support with the proposal request selected.</p>`,`<button class="proposal-secondary-btn" data-cancel>Cancel</button><button class="proposal-primary-btn" data-submit>Continue</button>`);
 x.querySelector("[data-cancel]").onclick=()=>x.remove();
 x.querySelector("[data-submit]").onclick=()=>{window.location.href="employer-support.html?request=proposal";};
}
function errorPopup(message){
 const x=overlay("Unable to Complete Request",`<div class="proposal-response-error">${esc(message)}</div>`,`<button class="proposal-primary-btn" data-submit>Done</button>`);
 x.querySelector("[data-submit]").onclick=()=>x.remove();
}
function close(){q("proposal-modal").hidden=true;}
function note(x,m){let n=x.querySelector(".proposal-response-error");if(!n){n=document.createElement("div");n.className="proposal-response-error";x.querySelector(".proposal-response-body").appendChild(n);}n.textContent=m;}
async function msg(e){try{if(e?.context?.json){const d=await e.context.json();if(d?.error)return d.error;}}catch(_){}return e?.message||"The proposal request could not be completed.";}
function fail(m){const b=q("proposal-table-body");if(b)b.innerHTML=`<tr><td colspan="7"><div class="proposal-empty-state"><div class="proposal-empty-icon">!</div><h3>Unable to load proposals</h3><p>${esc(m)}</p></div></td></tr>`;}
function label(s){return {draft:"Draft",sent:"Sent",viewed:"Viewed",in_review:"Changes Requested",accepted:"Accepted",declined:"Declined",expired:"Expired",cancelled:"Cancelled"}[s]||"Draft";}
function date(v){if(!v)return"—";const d=new Date(v);return isNaN(d)?esc(v):new Intl.DateTimeFormat("en-US",{month:"short",day:"numeric",year:"numeric"}).format(d);}
function money(v){const n=Number(v);return Number.isFinite(n)?new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(n):"—";}
function q(id){return document.getElementById(id)} function val(id){return q(id)?String(q(id).value||"").trim():""} function set(id,v){if(q(id))q(id).textContent=v}
function esc(v){return String(v??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;")} function attr(v){return esc(v)}
})();