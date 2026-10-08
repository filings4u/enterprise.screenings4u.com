(()=>{"use strict";
const state={db:null,user:null,notifications:[],reads:new Set(),filter:"all"};
const $=id=>document.getElementById(id);
document.addEventListener("DOMContentLoaded",init);

async function init(){
  $("notification-filter")?.addEventListener("change",e=>{state.filter=e.target.value;render()});
  $("refresh-notifications")?.addEventListener("click",load);
  $("mark-all-read")?.addEventListener("click",markAllRead);
  try{
    state.db=window.getScreenings4uSupabase?await window.getScreenings4uSupabase():window.screenings4uSupabase;
    if(!state.db) throw new Error("Supabase client is unavailable.");
    await load();
  }catch(error){showError(error)}
}

async function load(){
  const {data:{user},error:userError}=await state.db.auth.getUser();
  if(userError) throw userError;
  if(!user) throw new Error("Your employee session has expired. Please sign in again.");
  state.user=user;

  const [notificationsResult,readsResult]=await Promise.all([
    state.db.from("notifications")
      .select("id,recipient_user_id,template_id,channel,status,subject,body,metadata,scheduled_for,sent_at,delivered_at,created_at,employer_id")
      .eq("recipient_user_id",user.id)
      .order("created_at",{ascending:false})
      .limit(200),
    state.db.from("employee_notification_reads")
      .select("notification_id,read_at")
      .eq("user_id",user.id)
  ]);
  if(notificationsResult.error) throw notificationsResult.error;
  if(readsResult.error) throw readsResult.error;

  state.notifications=notificationsResult.data||[];
  state.reads=new Set((readsResult.data||[]).map(r=>String(r.notification_id)));
  $("notifications-loading").hidden=true;
  render();
}

function render(){
  const normalized=state.notifications.map(normalize);
  const unread=normalized.filter(n=>!n.read).length;
  setText("count-all",normalized.length);
  setText("count-unread",unread);
  setText("count-training",normalized.filter(n=>n.type==="training").length);
  setText("count-certificates",normalized.filter(n=>n.type==="certificates").length);

  const list=normalized.filter(n=>state.filter==="all"||(state.filter==="unread"?!n.read:n.type===state.filter));
  const box=$("notifications-list"),empty=$("notifications-empty");
  box.innerHTML=list.map(card).join("");
  box.hidden=!list.length; empty.hidden=!!list.length;

  box.querySelectorAll("[data-read]").forEach(btn=>btn.addEventListener("click",()=>markRead(btn.dataset.read)));
  window.updateEmployeeNotificationCount?.(unread);
}

function normalize(row){
  const meta=row.metadata&&typeof row.metadata==="object"?row.metadata:{};
  const haystack=[meta.type,meta.category,meta.event,row.subject,row.body].filter(Boolean).join(" ").toLowerCase();
  let type="account";
  if(/certificate|credential/.test(haystack)) type="certificates";
  else if(/training|course|lesson|quiz|assessment|lms|enrollment/.test(haystack)) type="training";
  else if(/employer|workforce|assignment/.test(haystack)) type="employer";

  return {...row,type,read:state.reads.has(String(row.id)),actionUrl:safeUrl(meta.action_url||meta.actionUrl)||defaultUrl(type)};
}

function card(n){
  return `<article class="employee-notification-item ${n.read?"":"unread"}">
    <div class="employee-notification-icon">${icon(n.type)}</div>
    <div class="employee-notification-copy">
      <h3>${esc(n.subject||"Notification")}</h3>
      <p>${esc(n.body||"You have a new employee account update.")}</p>
      <div class="employee-notification-meta"><span>${esc(label(n.type))}</span><span>•</span><span>${esc(formatDate(n.created_at))}</span></div>
    </div>
    <div class="employee-notification-actions">
      ${n.read?"":`<button type="button" data-read="${esc(n.id)}">Mark Read</button>`}
      ${n.actionUrl?`<a href="${esc(n.actionUrl)}">View</a>`:""}
    </div>
  </article>`;
}

async function markRead(id){
  const {error}=await state.db.from("employee_notification_reads").upsert({
    notification_id:id,user_id:state.user.id,read_at:new Date().toISOString()
  },{onConflict:"notification_id,user_id"});
  if(error){showError(error);return}
  state.reads.add(String(id));render();
}

async function markAllRead(){
  const unread=state.notifications.filter(n=>!state.reads.has(String(n.id)));
  if(!unread.length) return;
  const now=new Date().toISOString();
  const rows=unread.map(n=>({notification_id:n.id,user_id:state.user.id,read_at:now}));
  const {error}=await state.db.from("employee_notification_reads").upsert(rows,{onConflict:"notification_id,user_id"});
  if(error){showError(error);return}
  unread.forEach(n=>state.reads.add(String(n.id)));render();
}

function defaultUrl(type){
  return type==="training"?"employee-courses.html":
    type==="certificates"?"employee-certificates.html":
    type==="employer"?"employee-contact-employer.html":
    "employee-account.html";
}
function safeUrl(v){if(!v||typeof v!=="string")return "";const s=v.trim();return /^[a-zA-Z0-9_./?=&%-]+\.html(?:[?#][^\s]*)?$/.test(s)?s:""}
function icon(t){return t==="certificates"?"✓":t==="training"?"T":t==="employer"?"E":"A"}
function label(t){return t==="certificates"?"Certificate":t==="training"?"Training":t==="employer"?"Employer":"Account"}
function formatDate(v){if(!v)return "Recently";const d=new Date(v);return Number.isNaN(d.getTime())?"Recently":d.toLocaleDateString(undefined,{month:"short",day:"numeric",year:"numeric"})}
function setText(id,v){const el=$(id);if(el)el.textContent=String(v)}
function showError(error){console.error("[Employee Notifications]",error);$("notifications-loading").hidden=true;$("notifications-list").hidden=true;const e=$("notifications-empty");e.hidden=false;e.innerHTML=`<div class="employee-notifications-empty-icon">!</div><h2>Unable to load notifications</h2><p>${esc(error?.message||"Please try again.")}</p>`}
function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
})();