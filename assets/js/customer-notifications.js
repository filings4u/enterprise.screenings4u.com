(() => {
"use strict";
const state={db:null,user:null,notifications:[],activeCategory:"all",activeType:"all"};
const $=id=>document.getElementById(id);
document.addEventListener("DOMContentLoaded",init);
async function init(){bind();await load();}
function bind(){
 document.querySelectorAll("[data-notification-filter]").forEach(b=>b.addEventListener("click",()=>{state.activeCategory=b.dataset.notificationFilter||"all";document.querySelectorAll("[data-notification-filter]").forEach(x=>x.classList.toggle("active",x===b));render();}));
 $("notifications-type-filter")?.addEventListener("change",e=>{state.activeType=e.target.value||"all";render();});
 $("mark-all-read")?.addEventListener("click",markAll);
 $("notifications-refresh")?.addEventListener("click",load);
}
async function load(){
 setLoading(true);
 try{
  state.db=await getScreenings4uSupabase();
  const {data:{user},error:ue}=await state.db.auth.getUser();if(ue||!user)throw ue||new Error("Not signed in");state.user=user;
  const [{data:notes,error:ne},{data:reads,error:re}]=await Promise.all([
   state.db.from("notifications").select("id,recipient_user_id,channel,status,subject,body,metadata,scheduled_for,sent_at,delivered_at,created_at").eq("recipient_user_id",user.id).order("created_at",{ascending:false}).limit(250),
   state.db.from("customer_notification_reads").select("notification_id,read_at").eq("user_id",user.id)
  ]);
  if(ne)throw ne;if(re)throw re;
  const readMap=new Map((reads||[]).map(r=>[r.notification_id,r.read_at]));
  state.notifications=(notes||[]).map(n=>normalize(n,readMap.get(n.id)));
  counts();render();
 }catch(e){console.error("[Customer Notifications]",e);state.notifications=[];counts();render();toast("Unable to load notifications.","error");}
 finally{setLoading(false);}
}
function normalize(n,readAt){
 const m=n.metadata||{}; const type=typeOf(n);
 const support=type==="support"||Boolean(m.requires_response||m.requires_reply||m.thread_id||m.support_ticket_id);
 return {...n,title:n.subject||m.title||"Account Update",message:n.body||"You have a new update.",type,read_at:readAt||null,is_read:Boolean(readAt),requiresResponse:Boolean(m.requires_response||m.requires_reply),supportAction:support,threadId:m.thread_id||m.communication_thread_id||"",ticketId:m.support_ticket_id||m.ticket_id||"",actionUrl:safeAction(m.action_url||m.actionUrl||"")};
}
function typeOf(n){
 const m=n.metadata||{};let t=String(m.notification_type||m.type||m.category||"").toLowerCase();
 if(["order","orders"].includes(t))return"orders";if(["result","results","testing_result"].includes(t))return"results";if(["document","documents"].includes(t))return"documents";if(["billing","invoice","payment"].includes(t))return"billing";if(["support","message","messages","chat","ticket"].includes(t)||m.thread_id||m.support_ticket_id)return"support";return"account";
}
function filtered(){return state.notifications.filter(n=>{let c=state.activeCategory==="all"||(state.activeCategory==="unread"?!n.is_read:n.type===state.activeCategory);return c&&(state.activeType==="all"||n.type===state.activeType);});}
function render(){
 const list=$("notifications-list"),empty=$("notifications-empty"),rc=$("notifications-result-count");if(!list||!empty)return;const rows=filtered();list.innerHTML="";
 if(!rows.length){list.hidden=true;empty.hidden=false;if(rc)rc.textContent=state.notifications.length?"No notifications match your current filters.":"You are all caught up.";return;}
 empty.hidden=true;list.hidden=false;if(rc)rc.textContent=`${rows.length} notification${rows.length===1?"":"s"}`;rows.forEach(n=>list.appendChild(row(n)));
}
function row(n){
 const el=document.createElement("article");el.className="customer-notification-row"+(!n.is_read?" is-unread":"");
 el.innerHTML=`<div class="customer-notification-indicator is-${esc(n.type)}">${icon(n.type)}${!n.is_read?'<span class="customer-notification-dot"></span>':""}</div><div class="customer-notification-details"><div class="customer-notification-title">${esc(n.title)}${n.requiresResponse?'<span class="customer-notification-response-badge">Response requested</span>':""}</div><div class="customer-notification-message">${esc(n.message)}</div><div class="customer-notification-links"></div></div><div class="customer-notification-actions-inline"><span class="customer-notification-date">${esc(date(n.created_at))}</span>${!n.is_read?'<button type="button" class="customer-notification-read">Mark read</button>':""}</div>`;
 const links=el.querySelector(".customer-notification-links");
 if(n.supportAction){
  const a=document.createElement("a");a.className="customer-notification-reply";a.textContent=n.requiresResponse?"Respond in Support":"Open Support";a.href=supportUrl(n);links.appendChild(a);
 }else if(n.actionUrl){const a=document.createElement("a");a.className="customer-notification-reply";a.textContent="View Update";a.href=n.actionUrl;links.appendChild(a);}
 el.querySelector(".customer-notification-read")?.addEventListener("click",()=>markRead(n.id));
 return el;
}
async function markRead(id){
 if(!id||!state.user)return;
 try{const now=new Date().toISOString();const {error}=await state.db.from("customer_notification_reads").upsert({notification_id:id,user_id:state.user.id,read_at:now},{onConflict:"notification_id,user_id"});if(error)throw error;const n=state.notifications.find(x=>x.id===id);if(n){n.is_read=true;n.read_at=now;}counts();render();}
 catch(e){console.error(e);toast("Unable to mark notification as read.","error");}
}
async function markAll(){
 if(!state.user)return;const unread=state.notifications.filter(n=>!n.is_read);if(!unread.length)return;
 const now=new Date().toISOString();const rows=unread.map(n=>({notification_id:n.id,user_id:state.user.id,read_at:now}));
 try{const {error}=await state.db.from("customer_notification_reads").upsert(rows,{onConflict:"notification_id,user_id"});if(error)throw error;unread.forEach(n=>{n.is_read=true;n.read_at=now;});counts();render();}
 catch(e){console.error(e);toast("Unable to mark all notifications as read.","error");}
}
function counts(){set("notifications-total",state.notifications.length);set("notifications-unread",state.notifications.filter(n=>!n.is_read).length);set("notifications-orders",state.notifications.filter(n=>n.type==="orders").length);set("notifications-account",state.notifications.filter(n=>n.type==="account").length);}
function supportUrl(n){const p=new URLSearchParams();if(n.threadId)p.set("thread",n.threadId);if(n.ticketId)p.set("ticket",n.ticketId);p.set("notification",n.id);return"customer-support.html?"+p.toString();}
function safeAction(v){if(!v)return"";try{const u=new URL(v,location.href);if(u.origin!==location.origin)return"";return u.href;}catch{return"";}}
function setLoading(v){if($("notifications-loading"))$("notifications-loading").hidden=!v;if(v){if($("notifications-list"))$("notifications-list").hidden=true;if($("notifications-empty"))$("notifications-empty").hidden=true;}const r=$("notifications-refresh");if(r){r.classList.toggle("is-loading",v);r.disabled=v;}}
function icon(t){if(t==="orders")return'<svg viewBox="0 0 24 24"><path d="M4 7h16l-1 13H5zM9 7a3 3 0 0 1 6 0"></path></svg>';if(t==="results")return'<svg viewBox="0 0 24 24"><path d="M7 3h7l4 4v14H7zM14 3v5h5m-5 6-2 2-2-2"></path></svg>';if(t==="support")return'<svg viewBox="0 0 24 24"><path d="M4 5h16v12H8l-4 4z"></path></svg>';return'<svg viewBox="0 0 24 24"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"></path></svg>';}
function date(v){const d=new Date(v);if(isNaN(d))return"Just now";const diff=Date.now()-d.getTime();if(diff<60000)return"Just now";if(diff<3600000)return Math.floor(diff/60000)+"m ago";if(diff<86400000)return Math.floor(diff/3600000)+"h ago";return new Intl.DateTimeFormat("en-US",{month:"short",day:"numeric",year:"numeric"}).format(d);}
function set(id,v){if($(id))$(id).textContent=String(v);}function esc(v){const d=document.createElement("div");d.textContent=String(v??"");return d.innerHTML;}function toast(m,t){if(window.Screenings4uUI?.toast)return Screenings4uUI.toast(m,t);if(window.showToast)return showToast(m,t);alert(m);}
})();