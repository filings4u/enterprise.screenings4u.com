(()=>{'use strict';
const $=s=>document.querySelector(s);
const q=new URLSearchParams(location.search);
const organizationId=q.get('organization_id')||q.get('id');
const accountId=q.get('account_id');
const action=(q.get('action')||'edit').toLowerCase();
let detail=null,snapshot={};
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function call(action,body={}){
  const sb=window.screenings4uSupabase;
  if(!sb?.functions)throw new Error('screenings4u connection unavailable.');
  const {data,error}=await sb.functions.invoke('enterprise-control-plane',{body:{action,...body}});
  if(error)throw error;
  if(data?.error)throw new Error(data.error);
  return data;
}
function notify(message,type='info'){
  if(window.S4UNotify?.show)return window.S4UNotify.show(message,type);
  console[type==='error'?'error':'log'](message);
}
function account(){return detail?.accounts?.find(x=>String(x.id)===String(accountId))||null}
function sourceLink(a){return(detail?.source_links||[]).find(x=>x.account_id===a.id&&x.entity_type==='account')||null}
function sourceRecord(a){
  const link=sourceLink(a); if(!link)return null;
  const src=snapshot?.[a.enterprise_business_units?.code]||{};
  const key=a.account_type==='ctpa'?'ctpas':a.account_type==='employer'?'employers':'owner_operators';
  return(src[key]||[]).find(x=>String(x.id)===String(link.source_id))||null;
}
function ctpaOptions(a){
  const items=snapshot?.[a.enterprise_business_units?.code]?.ctpas||[];
  return '<option value="">Direct Employer</option>'+items.map(x=>`<option value="${esc(x.id)}">${esc(x.legal_name||x.organizations?.legal_name||x.organization_name||x.email||x.id)}</option>`).join('');
}
function setLinks(){
  const back='admin-organization.html?id='+encodeURIComponent(organizationId||'');
  for(const id of ['backLink','cancelLink','archiveCancelLink'])if($('#'+id))$('#'+id).href=back;
  if($('#archiveLink'))$('#archiveLink').href='admin-organization-account.html?'+new URLSearchParams({organization_id:organizationId||'',account_id:accountId||'',action:'archive'}).toString();
}
function render(){
  const a=account(); if(!a)throw new Error('This account is not linked to the selected organization.');
  const o=detail.organization, business=a.enterprise_business_units?.name||a.enterprise_business_units?.code||'Business', link=sourceLink(a), r=sourceRecord(a)||{};
  const type=String(a.account_type||'account').replaceAll('_',' ');
  $('#pageTitle').textContent=action==='archive'?'Archive Customer Account':'Edit Customer Account';
  $('#pageSubtitle').textContent=`${o.display_name||o.legal_name} · ${business} · ${type}`;
  $('#accountSystem').textContent=business;
  $('#accountSummary').innerHTML=[['Organization',o.display_name||o.legal_name],['Business',business],['Account type',type],['Enterprise status',a.status]].map(([k,v])=>`<dt>${esc(k)}</dt><dd>${esc(v||'—')}</dd>`).join('');
  $('#sourceSummary').innerHTML=[['Source',link?.source_table||'Enterprise'],['Source ID',link?.source_id||'—'],['Relationship',a.parent_account_id?'Managed account':'Direct account'],['Last linked',link?.updated_at||link?.created_at||'—']].map(([k,v])=>`<dt>${esc(k)}</dt><dd>${esc(v||'—')}</dd>`).join('');
  const legal=r.legal_name||r.organizations?.legal_name||o.legal_name||'';
  const email=r.primary_contact_email||r.support_email||r.email||r.organizations?.email||o.email||'';
  const phone=r.phone||r.support_phone||r.organizations?.phone||o.phone||'';
  const website=r.website||r.organizations?.website||o.website||'';
  $('#legalName').value=legal; $('#email').value=email; $('#phone').value=phone; $('#website').value=website;
  const status=String(r.status||a.status||'active');
  if(![...$('#status').options].some(x=>x.value===status))$('#status').insertAdjacentHTML('beforeend',`<option value="${esc(status)}">${esc(status)}</option>`);
  $('#status').value=status;
  const employer=a.account_type==='employer'&&['workforce','dot'].includes(a.enterprise_business_units?.code);
  $('#ctpaField').hidden=!employer;
  if(employer){$('#ctpaId').innerHTML=ctpaOptions(a);$('#ctpaId').value=r.ctpa_id||''}
  $('#editSection').hidden=action==='archive';
  $('#archiveSection').hidden=action!=='archive';
}
async function load(){
  setLinks();
  if(!organizationId||!accountId){notify('Organization and account identifiers are required.','error');return}
  try{
    detail=await call('organization_detail',{organization_id:organizationId});
    try{snapshot=await call('source_snapshot')}catch(err){snapshot={};console.warn('[Account Manager] source snapshot unavailable',err)}
    render();
  }catch(err){notify(err.message||'Unable to load customer account.','error')}
}
async function save(e){
  e.preventDefault();
  const a=account(); if(!a)return;
  const btn=$('#saveBtn'); btn.disabled=true; btn.textContent='Saving…';
  const profile={legal_name:$('#legalName').value.trim(),email:$('#email').value.trim(),support_email:$('#email').value.trim(),primary_contact_email:$('#email').value.trim(),phone:$('#phone').value.trim(),support_phone:$('#phone').value.trim(),website:$('#website').value.trim(),status:$('#status').value};
  if(a.account_type==='employer')profile.ctpa_id=$('#ctpaId').value||null;
  try{
    await call('save_account',{account_id:accountId,profile});
    notify('Customer account updated in the authoritative business system.','success');
    await load();
  }catch(err){notify(err.message||'Unable to save customer account.','error')}
  finally{btn.disabled=false;btn.textContent='Save changes'}
}
async function archive(){
  const btn=$('#archiveBtn');btn.disabled=true;btn.textContent='Archiving…';
  try{
    await call('retire_account',{account_id:accountId});
    notify('Customer account archived. Historical records were retained.','success');
    setTimeout(()=>{location.href='admin-organization.html?id='+encodeURIComponent(organizationId)},800);
  }catch(err){notify(err.message||'Unable to archive customer account.','error');btn.disabled=false;btn.textContent='Archive account'}
}
$('#accountForm')?.addEventListener('submit',save);
$('#archiveConfirm')?.addEventListener('change',e=>{$('#archiveBtn').disabled=!e.target.checked});
$('#archiveBtn')?.addEventListener('click',archive);
load();
})();
