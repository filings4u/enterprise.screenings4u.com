/* screenings4u — admin-crm.js */
(() => {
"use strict";

let client=null, admins=[];
const el={};
document.addEventListener("DOMContentLoaded",init);

async function init(){
    cache();bind();
    try{
        client=await waitForClient();
        if(!client)throw new Error("Supabase client was not found.");
        await requireSession();
        await loadAdmins();
    }catch(error){console.error(error);show(error.message||"Unable to load administrator CRM.","error");}
}

function cache(){
    ["crmMessage","crmRefresh","crmNewAdmin","crmTotal","crmActive","crmPending","crmTerminated","crmSearch","crmStatusFilter","crmBody","crmEmpty",
     "crmInviteModal","crmInviteForm","crmFirstName","crmLastName","crmEmail","crmPhone","crmRole","crmSendInvite",
     "crmRoleModal","crmRoleForm","crmRoleUserId","crmEditRole"].forEach(id=>el[id]=document.getElementById(id));
}
function bind(){
    el.crmRefresh.addEventListener("click",loadAdmins);
    el.crmNewAdmin.addEventListener("click",()=>openModal(el.crmInviteModal));
    el.crmSearch.addEventListener("input",render);
    el.crmStatusFilter.addEventListener("change",render);
    el.crmInviteForm.addEventListener("submit",inviteAdmin);
    el.crmRoleForm.addEventListener("submit",changeRole);
    document.querySelectorAll("[data-crm-close]").forEach(b=>b.addEventListener("click",()=>closeModal(el.crmInviteModal)));
    document.querySelectorAll("[data-role-close]").forEach(b=>b.addEventListener("click",()=>closeModal(el.crmRoleModal)));
    [el.crmInviteModal,el.crmRoleModal].forEach(m=>m.addEventListener("click",e=>{if(e.target===m)closeModal(m);}));
    el.crmBody.addEventListener("click",handleTableAction);
}

async function waitForClient(timeout=3500){
    const start=Date.now();while(Date.now()-start<timeout){const c=await getClient();if(c?.functions)return c;await new Promise(r=>setTimeout(r,75));}return null;
}
async function getClient(){
    try{if(typeof window.getScreenings4uSupabase==="function"){const c=await window.getScreenings4uSupabase();if(c?.from)return c;}}catch(_){}
    if(window.screenings4uSupabase?.from)return window.screenings4uSupabase;
    if(window.supabaseClient?.from)return window.supabaseClient;
    if(window.supabase?.createClient&&window.SCREENINGS4U_SUPABASE_URL&&window.SCREENINGS4U_SUPABASE_ANON_KEY){
        window.supabaseClient=window.supabase.createClient(window.SCREENINGS4U_SUPABASE_URL,window.SCREENINGS4U_SUPABASE_ANON_KEY);return window.supabaseClient;
    }return null;
}
async function requireSession(){
    if(window.S4UAuth?.requireSession){const s=await window.S4UAuth.requireSession("admin-login.html");if(!s)throw new Error("Authentication required.");return;}
    const {data,error}=await client.auth.getSession();if(error)throw error;if(!data?.session?.user){location.replace("admin-login.html");throw new Error("Authentication required.");}
}

async function invoke(payload){
    const {data,error}=await client.functions.invoke("admin-crm-actions",{body:payload});
    if(error){
        let message=error.message||"Administrator service request failed.";
        try{if(error.context){const body=await error.context.json();if(body?.error)message=body.error;}}catch(_){}
        throw new Error(message);
    }
    if(data?.error)throw new Error(data.error);
    return data;
}

async function loadAdmins(){
    el.crmRefresh.disabled=true;
    try{
        const data=await invoke({action:"list_admins"});
        admins=data?.admins||[];
        render();renderStats();
    }catch(error){console.error(error);show(error.message||"Unable to load administrators.","error");}
    finally{el.crmRefresh.disabled=false;}
}

function statusOf(a){
    if(a.is_active===false||isBanned(a.banned_until))return"terminated";
    if(!a.last_sign_in_at)return"pending";
    return"active";
}
function isBanned(value){
    if(!value)return false;
    const d=new Date(value);return !Number.isNaN(d.getTime())&&d.getTime()>Date.now();
}
function renderStats(){
    el.crmTotal.textContent=admins.length;
    el.crmActive.textContent=admins.filter(a=>statusOf(a)==="active").length;
    el.crmPending.textContent=admins.filter(a=>statusOf(a)==="pending").length;
    el.crmTerminated.textContent=admins.filter(a=>statusOf(a)==="terminated").length;
}
function render(){
    const q=el.crmSearch.value.trim().toLowerCase();
    const filter=el.crmStatusFilter.value;
    const rows=admins.filter(a=>{
        const status=statusOf(a);
        const hay=[a.first_name,a.last_name,a.display_name,a.email,a.auth_email,...(a.roles||[])].filter(Boolean).join(" ").toLowerCase();
        return (!q||hay.includes(q))&&(filter==="all"||status===filter);
    });
    el.crmEmpty.hidden=rows.length>0;
    el.crmBody.innerHTML=rows.map(a=>{
        const status=statusOf(a), name=a.display_name||[a.first_name,a.last_name].filter(Boolean).join(" ")||"Administrator";
        const role=(a.roles||[])[0]||"admin";
        return `<tr>
          <td><div class="crm-person"><span class="crm-avatar">${esc(initials(name))}</span><div><strong>${esc(name)}</strong><small>${esc(a.auth_email||a.email||"No email")}</small></div></div></td>
          <td><span class="crm-badge">${esc(human(role))}</span></td>
          <td><span class="crm-badge ${status}">${esc(human(status))}</span></td>
          <td>${esc(a.last_sign_in_at?dateTime(a.last_sign_in_at):"Never")}</td>
          <td>${esc(dateTime(a.created_at))}</td>
          <td><div class="crm-row-actions">
            <button class="crm-row-btn" type="button" data-role="${esc(a.id)}" data-current-role="${esc(role)}">Role</button>
            ${status==="terminated"
                ?`<button class="crm-row-btn success" type="button" data-restore="${esc(a.id)}">Restore Access</button>`
                :`<button class="crm-row-btn danger" type="button" data-terminate="${esc(a.id)}">Terminate</button>`}
          </div></td>
        </tr>`;
    }).join("");
}

async function inviteAdmin(event){
    event.preventDefault();
    if(!el.crmInviteForm.reportValidity())return;
    el.crmSendInvite.disabled=true;el.crmSendInvite.textContent="Sending Invite...";
    try{
        await invoke({
            action:"invite_admin",
            first_name:el.crmFirstName.value.trim(),
            last_name:el.crmLastName.value.trim(),
            email:el.crmEmail.value.trim(),
            phone:el.crmPhone.value.trim(),
            role:el.crmRole.value
        });
        closeModal(el.crmInviteModal);el.crmInviteForm.reset();el.crmRole.value="admin";
        show("Administrator created and invitation email sent successfully.","ok");
        await loadAdmins();
    }catch(error){console.error(error);show(error.message||"Unable to create administrator.","error");}
    finally{el.crmSendInvite.disabled=false;el.crmSendInvite.textContent="Create & Send Invite";}
}

async function handleTableAction(event){
    const terminate=event.target.closest("[data-terminate]");
    const restore=event.target.closest("[data-restore]");
    const role=event.target.closest("[data-role]");
    if(role){
        el.crmRoleUserId.value=role.dataset.role;
        el.crmEditRole.value=role.dataset.currentRole||"admin";
        openModal(el.crmRoleModal);return;
    }
    if(terminate){
        const a=admins.find(x=>x.id===terminate.dataset.terminate);
        const name=a?.display_name||[a?.first_name,a?.last_name].filter(Boolean).join(" ")||a?.auth_email||"this administrator";
        if(!confirm(`Terminate ${name}? Their Supabase record will be retained, but sign-in access will be blocked until restored.`))return;
        await setAccess(terminate.dataset.terminate,false);return;
    }
    if(restore){
        const a=admins.find(x=>x.id===restore.dataset.restore);
        const name=a?.display_name||[a?.first_name,a?.last_name].filter(Boolean).join(" ")||a?.auth_email||"this administrator";
        if(!confirm(`Restore administrator access for ${name}?`))return;
        await setAccess(restore.dataset.restore,true);
    }
}

async function setAccess(userId,restore){
    try{
        await invoke({action:restore?"restore_admin":"terminate_admin",user_id:userId});
        show(restore?"Administrator access restored successfully.":"Administrator terminated. Their record was retained and access was blocked.","ok");
        await loadAdmins();
    }catch(error){console.error(error);show(error.message||"Unable to update administrator access.","error");}
}

async function changeRole(event){
    event.preventDefault();
    const userId=el.crmRoleUserId.value;
    try{
        await invoke({action:"change_role",user_id:userId,role:el.crmEditRole.value});
        closeModal(el.crmRoleModal);show("Administrator role updated successfully.","ok");await loadAdmins();
    }catch(error){console.error(error);show(error.message||"Unable to change administrator role.","error");}
}

function openModal(modal){modal.classList.add("show");modal.setAttribute("aria-hidden","false");}
function closeModal(modal){modal.classList.remove("show");modal.setAttribute("aria-hidden","true");}
function show(text,type="ok"){el.crmMessage.textContent=text;el.crmMessage.className=`crm-message show ${type}`;clearTimeout(show.timer);show.timer=setTimeout(()=>el.crmMessage.className="crm-message",6000);}
function initials(name){return String(name||"AD").split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join("").toUpperCase()||"AD";}
function human(v){return String(v||"—").replace(/_/g," ").replace(/\b\w/g,c=>c.toUpperCase());}
function dateTime(v){if(!v)return"—";const d=new Date(v);return Number.isNaN(d.getTime())?"—":d.toLocaleString(undefined,{year:"numeric",month:"short",day:"numeric",hour:"numeric",minute:"2-digit"});}
function esc(v){return String(v??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");}
})();
