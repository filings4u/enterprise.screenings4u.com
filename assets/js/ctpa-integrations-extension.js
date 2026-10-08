import {supabase} from './supabase.js';

const esc=(v='')=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const $=(s,r=document)=>r.querySelector(s);
const surface=()=>location.hostname.startsWith('dot-workforce.')?'dot':'workforce';
const state={workspace:null,selected:new URLSearchParams(location.search).get('id')||''};

async function api(body={}){
  const membership=sessionStorage.getItem('s4u_workspace_membership')||'';
  const {data,error}=await supabase.functions.invoke('customer-integration-portal',{body:{business:surface(),membership_id:membership,...body}});
  if(error){let m=error.message;try{m=(await error.context?.clone?.().json())?.error||m}catch{}throw new Error(m)}
  if(data?.error)throw new Error(data.error);
  return data;
}
function notice(text='',error=false){const n=$('#ciStatus');if(!n)return;n.textContent=text;n.className='inline-status'+(text?(error?' error':' success'):'')}
function fieldMarkup(f){const type=f.secret?'password':f.type==='url'?'url':'text';return `<label><span>${esc(f.label||f.key)}</span><input name="${esc(f.key)}" type="${type}" autocomplete="off" required></label>`}
function shell(){
  const content=$('.content');if(!content)return null;
  content.innerHTML=`<header class="ctpa-page-header"><div class="ctpa-page-header-copy"><div class="ctpa-eyebrow">C/TPA WORKSPACE</div><h1>Integrations</h1><p>Connect only the external systems screenings4u has enabled for this account.</p></div></header><div id="ciStatus" class="inline-status" aria-live="polite"></div><div id="ciRoot"></div>`;
  return $('#ciRoot');
}
function drawList(){
  const root=$('#ciRoot');if(!root)return;
  const rows=state.workspace?.integrations||[];
  root.innerHTML=`<section class="card"><div class="card-head"><div><h2>Available Integrations</h2><span>Provider access is controlled by screenings4u Enterprise.</span></div></div><div class="card-body">${rows.map(x=>{const c=x.integration,e=x.enablement;return `<article class="status-row"><div><strong>${esc(c.name)}</strong><small>${esc(c.description||c.category||'')}</small><small>${esc((c.auth_method||'manual').replaceAll('_',' '))} · ${esc(String(e.status||'ready').replaceAll('_',' '))}</small></div><a class="btn btn-outline" href="integrations.html?id=${encodeURIComponent(e.id)}">Manage</a></article>`}).join('')||'<div class="saas-empty">No integrations are enabled for this C/TPA account.</div>'}</div></section>`;
}
function drawDetail(){
  const root=$('#ciRoot');if(!root)return;
  const row=(state.workspace?.integrations||[]).find(x=>x.enablement.id===state.selected);if(!row){drawList();return}
  const c=row.integration,e=row.enablement;
  const body=c.auth_method==='oauth2'?(row.provider_ready?`<p>Sign in on the ${esc(c.provider||c.name)} website and approve the requested access. Your provider password is never entered into screenings4u.</p><button class="btn btn-orange" id="ciConnect" type="button">${esc(c.connect_label||'Connect')}</button>`:`<div class="saas-notice">screenings4u has enabled this integration for your account, but provider application setup is still pending.</div>`):`<form id="ciConfig" class="saas-form"><div class="saas-form-grid">${(c.credential_schema||[]).map(fieldMarkup).join('')||'<p>No customer-entered configuration is required.</p>'}</div><div class="management-actions"><button class="btn btn-orange" type="submit">Save Configuration</button></div></form>`;
  root.innerHTML=`<section class="card"><div class="card-head"><div><a class="btn btn-outline" href="integrations.html">← Integrations</a><h2 style="margin-top:14px">${esc(c.name)}</h2><span>${esc(c.description||'')}</span></div><span class="ctpa-status-pill is-info">${esc(String(e.status||'ready').replaceAll('_',' '))}</span></div><div class="card-body">${body}<div class="management-actions"><button class="btn btn-outline" id="ciDisconnect" type="button">Disconnect / Disable</button></div></div></section>`;
  $('#ciConnect')?.addEventListener('click',async()=>{try{notice('Starting provider sign-in…');const r=await api({action:'begin_oauth',enablement_id:e.id,return_url:location.href});if(!r.authorization_url)throw new Error('Provider sign-in is unavailable.');location.assign(r.authorization_url)}catch(x){notice(x.message||'Unable to start provider sign-in.',true)}});
  $('#ciConfig')?.addEventListener('submit',async ev=>{ev.preventDefault();try{notice('Saving encrypted configuration…');await api({action:'submit_configuration',enablement_id:e.id,configuration:Object.fromEntries(new FormData(ev.currentTarget).entries())});state.workspace=await api({action:'workspace'});notice('Integration configuration submitted.');drawDetail()}catch(x){notice(x.message||'Unable to save integration configuration.',true)}});
  $('#ciDisconnect')?.addEventListener('click',async()=>{try{notice('Disconnecting integration…');await api({action:'disconnect',enablement_id:e.id});state.workspace=await api({action:'workspace'});notice('Integration disconnected.');drawDetail()}catch(x){notice(x.message||'Unable to disconnect integration.',true)}});
}
async function init(){if(!location.pathname.endsWith('/integrations.html')&&!location.pathname.endsWith('integrations.html'))return;const root=shell();if(!root)return;try{notice('Loading integrations…');state.workspace=await api({action:'workspace'});notice('');state.selected?drawDetail():drawList()}catch(e){notice(e.message||'Unable to load integrations.',true);root.innerHTML='<div class="saas-empty">Integration workspace is unavailable.</div>'}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(init,0),{once:true});else setTimeout(init,0);
