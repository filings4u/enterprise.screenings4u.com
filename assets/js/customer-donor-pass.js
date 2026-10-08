(() => {
"use strict";
const state={db:null,passes:[],search:"",filter:"all"};
const $=id=>document.getElementById(id);
document.addEventListener("DOMContentLoaded",init);
async function init(){bind();await load();}
function bind(){
 $("donor-pass-search")?.addEventListener("input",e=>{state.search=e.target.value.trim().toLowerCase();render();});
 $("donor-pass-filter")?.addEventListener("change",e=>{state.filter=e.target.value;render();});
}
async function load(){
 loading(true);
 try{
  state.db=await getScreenings4uSupabase();
  const {data:{user},error:ue}=await state.db.auth.getUser(); if(ue||!user) throw ue||new Error("Not signed in");
  const {data:orders,error:oe}=await state.db.from("orders").select("id,order_number,customer_first_name,customer_last_name,status,fulfillment_status,created_at").eq("user_id",user.id).order("created_at",{ascending:false});
  if(oe) throw oe;
  const ids=(orders||[]).map(o=>o.id);
  if(!ids.length){state.passes=[];summary();render();return;}
  const [{data:locations,error:le},{data:items,error:ie}]=await Promise.all([
   state.db.from("order_donor_locations").select("id,order_id,status,location_name,address_line_1,address_line_2,city,state,postal_code,country,phone,instructions,assigned_at,created_at,metadata").in("order_id",ids),
   state.db.from("order_items").select("order_id,service_id,metadata,services(name,sku,product_type)").in("order_id",ids)
  ]);
  if(le) throw le; if(ie) throw ie;
  const orderMap=new Map((orders||[]).map(o=>[o.id,o]));
  const itemMap=new Map();
  (items||[]).forEach(i=>{if(!itemMap.has(i.order_id)) itemMap.set(i.order_id,[]);itemMap.get(i.order_id).push(i);});
  state.passes=(locations||[]).map(loc=>normalize(loc,orderMap.get(loc.order_id),itemMap.get(loc.order_id)||[]));
  summary();render();
 }catch(e){console.error("[Customer Donor Pass]",e);state.passes=[];summary();render();toast("Unable to load your donor passes.","error");}
 finally{loading(false);}
}
function normalize(loc,order,items){
 const m=loc.metadata||{}; const om=(items[0]?.metadata)||{};
 const service=items.map(i=>i.services?.name).filter(Boolean).join(", ")||m.service_name||"Testing Service";
 const expires=m.expires_at||m.expiration_date||om.expires_at||null;
 const status=deriveStatus(loc.status,expires,order?.fulfillment_status);
 const address=[loc.address_line_1,loc.address_line_2,loc.city,[loc.state,loc.postal_code].filter(Boolean).join(" ")].filter(Boolean).join(", ");
 return {id:loc.id,orderId:loc.order_id,orderNumber:order?.order_number||"—",customerName:[order?.customer_first_name,order?.customer_last_name].filter(Boolean).join(" ")||"Customer",passNumber:m.pass_number||m.donor_pass_number||loc.external_location_id||shortId(loc.id),service,status,expiresAt:expires,collectionStatus:pretty(loc.status||order?.fulfillment_status||"pending"),locationName:loc.location_name||"No location assigned",address:address||"Collection location details are not yet available.",phone:loc.phone||"",instructions:loc.instructions||"",createdAt:loc.assigned_at||loc.created_at,mapsUrl:address?"https://www.google.com/maps/search/?api=1&query="+encodeURIComponent(address):""};
}
function deriveStatus(s,expires,fulfill){
 const v=String(s||"").toLowerCase();
 if(expires&&new Date(expires).getTime()<Date.now()) return "expired";
 if(["completed","collected","fulfilled"].includes(v)||String(fulfill||"").toLowerCase()==="completed") return "completed";
 if(["cancelled","expired"].includes(v)) return v==="cancelled"?"expired":v;
 return "active";
}
function render(){
 const list=$("donor-pass-list"),empty=$("donor-pass-empty");if(!list||!empty)return;
 let rows=state.passes.filter(p=>{
  const matchFilter=state.filter==="all"||p.status===state.filter;
  const hay=[p.passNumber,p.orderNumber,p.service,p.locationName,p.address,p.status].join(" ").toLowerCase();
  return matchFilter&&(!state.search||hay.includes(state.search));
 });
 list.innerHTML="";
 if(!rows.length){list.hidden=true;empty.hidden=false;return;}
 empty.hidden=true;list.hidden=false;rows.forEach(p=>list.appendChild(card(p)));
}
function card(p){
 const el=document.createElement("article");el.className="customer-donor-pass-card customer-donor-pass-record";
 el.innerHTML=`<div class="customer-donor-pass-card-top"><div class="customer-donor-pass-brand"><div class="customer-donor-pass-logo-mark">S4U</div><div><strong>screenings4u</strong><span>Testing Authorization</span></div></div><span class="customer-donor-pass-status is-${esc(p.status)}">${esc(pretty(p.status))}</span></div>
 <div class="customer-donor-pass-card-body"><div class="customer-donor-pass-id-block"><span>DONOR PASS</span><strong>${esc(p.passNumber)}</strong></div><div class="customer-donor-pass-person"><span>AUTHORIZED FOR</span><strong>${esc(p.customerName)}</strong></div>
 <div class="customer-donor-pass-service-grid"><div class="customer-donor-pass-detail"><span>Service</span><strong>${esc(p.service)}</strong></div><div class="customer-donor-pass-detail"><span>Order Number</span><strong>${esc(p.orderNumber)}</strong></div><div class="customer-donor-pass-detail"><span>Valid Through</span><strong>${esc(p.expiresAt?date(p.expiresAt):"See authorization")}</strong></div><div class="customer-donor-pass-detail"><span>Collection Status</span><strong>${esc(p.collectionStatus)}</strong></div></div></div>
 <div class="customer-donor-pass-card-footer"><div><strong>${esc(p.locationName)}</strong><br><span>${esc(p.address)}</span></div><div class="customer-donor-pass-record-actions"><button type="button" data-download>Download Pass</button><button type="button" data-print>Print</button>${p.mapsUrl?`<a href="${esc(p.mapsUrl)}" target="_blank" rel="noopener">Directions ↗</a>`:""}</div></div>`;
 el.querySelector("[data-download]")?.addEventListener("click",()=>download(p));
 el.querySelector("[data-print]")?.addEventListener("click",()=>printPass(p));
 return el;
}
function download(p){
 const w=window.open("","_blank"); if(!w){toast("Please allow pop-ups to download your donor pass.","error");return;}
 w.document.write(passDocument(p,true));w.document.close();
}
function printPass(p){
 const w=window.open("","_blank");if(!w)return;w.document.write(passDocument(p,false));w.document.close();w.onload=()=>w.print();
}
function passDocument(p,download){
 const title=`Screenings4u Donor Pass ${p.passNumber}`;
 const body=`<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>body{font-family:Arial,sans-serif;margin:40px;color:#24364f}.pass{max-width:760px;margin:auto;border:2px solid #24467f;border-radius:18px;overflow:hidden}.head{background:#24467f;color:white;padding:24px}.body{padding:28px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:20px}.label{font-size:11px;color:#748196;text-transform:uppercase}.value{font-weight:700;margin-top:5px}.site{margin-top:28px;padding-top:20px;border-top:1px solid #ddd}.foot{padding:18px 28px;background:#f5f7fb;font-size:12px}@media print{body{margin:0}.pass{border-width:1px}}</style></head><body><div class="pass"><div class="head"><h1>screenings4u</h1><div>Testing Authorization · ${esc(p.passNumber)}</div></div><div class="body"><div class="grid"><div><div class="label">Authorized For</div><div class="value">${esc(p.customerName)}</div></div><div><div class="label">Order</div><div class="value">${esc(p.orderNumber)}</div></div><div><div class="label">Service</div><div class="value">${esc(p.service)}</div></div><div><div class="label">Status</div><div class="value">${esc(pretty(p.status))}</div></div><div><div class="label">Valid Through</div><div class="value">${esc(p.expiresAt?date(p.expiresAt):"See authorization")}</div></div><div><div class="label">Collection Status</div><div class="value">${esc(p.collectionStatus)}</div></div></div><div class="site"><div class="label">Collection Location</div><div class="value">${esc(p.locationName)}</div><div>${esc(p.address)}</div>${p.phone?`<div>${esc(p.phone)}</div>`:""}${p.instructions?`<p>${esc(p.instructions)}</p>`:""}</div></div><div class="foot">Bring a valid government-issued photo ID and present this authorization at the collection site.</div></div>${download?`<script>window.onload=()=>window.print()<\/script>`:""}</body></html>`;
 return body;
}
function summary(){set("donor-pass-total",state.passes.length);set("donor-pass-active-count",state.passes.filter(p=>p.status==="active").length);set("donor-pass-completed-count",state.passes.filter(p=>p.status==="completed").length);}
function loading(v){if($("donor-pass-loading"))$("donor-pass-loading").hidden=!v;}
function set(id,v){if($(id))$(id).textContent=String(v);}
function shortId(v){return "DP-"+String(v||"").replace(/-/g,"").slice(0,10).toUpperCase();}
function date(v){const d=new Date(v);return isNaN(d)?"—":new Intl.DateTimeFormat("en-US",{month:"short",day:"numeric",year:"numeric"}).format(d);}
function pretty(v){return String(v||"").replace(/[_-]+/g," ").replace(/\b\w/g,c=>c.toUpperCase());}
function esc(v){const d=document.createElement("div");d.textContent=String(v??"");return d.innerHTML;}
function toast(m,t){if(window.Screenings4uUI?.toast)return Screenings4uUI.toast(m,t);if(window.showToast)return showToast(m,t);alert(m);}
})();