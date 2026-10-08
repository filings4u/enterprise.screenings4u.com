import {supabase} from './supabase.js';
import {portalReady} from './portal.js';
const $=s=>document.querySelector(s), esc=(v='')=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const fmt=d=>d?new Date(d).toLocaleDateString():'—';
const money=v=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(v||0));
async function api(body={}){const params=new URLSearchParams(location.search);if(params.get('ctpa'))body.ctpa_id=params.get('ctpa');const fn=['import_employers','save_onboarding'].includes(body.action)?'workforce-ctpa-actions':'workforce-ctpa-portal';const{data,error}=await supabase.functions.invoke(fn,{body});if(error){let m=error.message;try{m=(await error.context.clone().json()).error||m}catch{}throw new Error(m)}if(data?.error)throw new Error(data.error);return data}
async function employerApi(body={}){
  const params=new URLSearchParams(location.search);
  if(params.get('ctpa'))body.ctpa_id=params.get('ctpa');
  const{data,error}=await supabase.functions.invoke('workforce-ctpa-employers',{body});
  if(error){let m=error.message;try{m=(await error.context?.clone?.().json())?.error||m}catch{}throw new Error(m)}
  if(data?.error)throw new Error(data.error);
  return data;
}

async function workforceApi(body={}){
  const params=new URLSearchParams(location.search);
  if(params.get('ctpa'))body.ctpa_id=params.get('ctpa');
  const{data,error}=await supabase.functions.invoke('workforce-ctpa-employees-programs',{body});
  if(error){let m=error.message;try{m=(await error.context?.clone?.().json())?.error||m}catch{}throw new Error(m)}
  if(data?.error)throw new Error(data.error);
  return data;
}

async function poolApi(body={}){
  const params=new URLSearchParams(location.search);
  if(params.get('ctpa'))body.ctpa_id=params.get('ctpa');
  const{data,error}=await supabase.functions.invoke('workforce-ctpa-pools',{body});
  if(error){let m=error.message;try{m=(await error.context?.clone?.().json())?.error||m}catch{}throw new Error(m)}
  if(data?.error)throw new Error(data.error);
  return data;
}

async function selectionApi(body={}){
  const params=new URLSearchParams(location.search);
  if(params.get('ctpa'))body.ctpa_id=params.get('ctpa');
  const{data,error}=await supabase.functions.invoke('workforce-ctpa-selections',{body});
  if(error){let m=error.message;try{m=(await error.context?.clone?.().json())?.error||m}catch{}throw new Error(m)}
  if(data?.error)throw new Error(data.error);
  return data;
}

async function testingApi(body={}){
  const params=new URLSearchParams(location.search);
  if(params.get('ctpa'))body.ctpa_id=params.get('ctpa');
  const{data,error}=await supabase.functions.invoke('workforce-ctpa-testing',{body});
  if(error){let m=error.message;try{m=(await error.context?.clone?.().json())?.error||m}catch{}throw new Error(m)}
  if(data?.error)throw new Error(data.error);
  return data;
}

async function resultsApi(body={}){
  const params=new URLSearchParams(location.search);
  if(params.get('ctpa'))body.ctpa_id=params.get('ctpa');
  const{data,error}=await supabase.functions.invoke('workforce-ctpa-results',{body});
  if(error){let m=error.message;try{m=(await error.context?.clone?.().json())?.error||m}catch{}throw new Error(m)}
  if(data?.error)throw new Error(data.error);
  return data;
}

async function complianceApi(body={}){
  const params=new URLSearchParams(location.search);
  if(params.get('ctpa'))body.ctpa_id=params.get('ctpa');
  const{data,error}=await supabase.functions.invoke('workforce-ctpa-compliance',{body});
  if(error){let m=error.message;try{m=(await error.context?.clone?.().json())?.error||m}catch{}throw new Error(m)}
  if(data?.error)throw new Error(data.error);
  return data;
}

async function documentsApi(body={}){
  const params=new URLSearchParams(location.search);
  if(params.get('ctpa'))body.ctpa_id=params.get('ctpa');
  const{data,error}=await supabase.functions.invoke('workforce-ctpa-documents',{body});
  if(error){let m=error.message;try{m=(await error.context?.clone?.().json())?.error||m}catch{}throw new Error(m)}
  if(data?.error)throw new Error(data.error);
  return data;
}

async function notificationsApi(body={}){
  const params=new URLSearchParams(location.search);
  if(params.get('ctpa'))body.ctpa_id=params.get('ctpa');
  const{data,error}=await supabase.functions.invoke('workforce-ctpa-notifications',{body});
  if(error){let m=error.message;try{m=(await error.context?.clone?.().json())?.error||m}catch{}throw new Error(m)}
  if(data?.error)throw new Error(data.error);
  return data;
}
async function reportingApi(body={}){
  const params=new URLSearchParams(location.search);
  if(params.get('ctpa'))body.ctpa_id=params.get('ctpa');
  const{data,error}=await supabase.functions.invoke('workforce-ctpa-reporting',{body});
  if(error){let m=error.message;try{m=(await error.context?.clone?.().json())?.error||m}catch{}throw new Error(m)}
  if(data?.error)throw new Error(data.error);
  return data;
}
function downloadBase64File(base64,name,type='application/pdf'){
  const raw=atob(base64),bytes=new Uint8Array(raw.length);
  for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);
  const url=URL.createObjectURL(new Blob([bytes],{type}));
  const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
}

async function ctpaAdminApi(body={}){
  const params=new URLSearchParams(location.search);
  if(params.get('ctpa'))body.ctpa_id=params.get('ctpa');
  const{data,error}=await supabase.functions.invoke('workforce-ctpa-admin',{body});
  if(error){let m=error.message;try{m=(await error.context?.clone?.().json())?.error||m}catch{}throw new Error(m)}
  if(data?.error)throw new Error(data.error);
  return data;
}
async function supportApi(body={}){
  const{data,error}=await supabase.functions.invoke('workforce-support',{body});
  if(error){let m=error.message;try{m=(await error.context?.clone?.().json())?.error||m}catch{}throw new Error(m)}
  if(data?.error)throw new Error(data.error);
  return data;
}


const S4U_SURFACE_HOSTS={workforce:'app-workforce.screenings4u.com',dot:'dot-workforce.screenings4u.com'};
function currentSurface(){return location.hostname.startsWith('dot-workforce.')?'dot':'workforce'}
async function loadSurfaceContext(){
  const membership=sessionStorage.getItem('s4u_workspace_membership')||'';
  const {data,error}=await supabase.functions.invoke('workforce-session-context',{body:{requested_portal:'ctpa',requested_surface:currentSurface(),membership_id:membership}});
  if(error){let m=error.message;try{m=(await error.context?.clone?.().json())?.error||m}catch{}throw new Error(m||'Unable to verify portal access.')}
  if(data?.error)throw new Error(data.error);
  if(!data?.has_access)throw new Error('This C/TPA account is not authorized for this portal.');
  if(data?.membership?.id)sessionStorage.setItem('s4u_workspace_membership',data.membership.id);
  return data;
}
async function switchBusinessSurface(target){
  target=String(target||'').toLowerCase();
  if(!['workforce','dot'].includes(target)||target===currentSurface())return;
  const portalCode=target==='dot'?'ctpa_dot':'ctpa_workforce';
  const {data,error}=await supabase.functions.invoke('portal-session-handoff',{body:{action:'create',surface:target,portal_code:portalCode,next:'/ctpa/'+(location.pathname.split('/').pop()||'dashboard.html')}});
  if(error){let m=error.message;try{m=(await error.context?.clone?.().json())?.error||m}catch{}throw new Error(m||'Unable to switch portals.')}
  if(!data?.redirect_url)throw new Error(data?.error||'Unable to create portal handoff.');
  location.assign(data.redirect_url);
}
function installBusinessSwitcher(ctx){
  const surfaces=Array.isArray(ctx?.business_surfaces)?ctx.business_surfaces:[];
  if(!surfaces.includes('workforce')||!surfaces.includes('dot'))return;
  const host=document.querySelector('.topbar-actions')||document.querySelector('.topbar')||document.body;
  if(document.getElementById('s4uBusinessSwitcher'))return;
  const wrap=document.createElement('div');wrap.id='s4uBusinessSwitcher';wrap.style.cssText='display:flex;align-items:center;gap:6px;margin-right:8px';
  const label=document.createElement('span');label.textContent='Portal';label.style.cssText='font-size:11px;font-weight:800;color:#66758a';
  const select=document.createElement('select');select.setAttribute('aria-label','Switch business portal');select.style.cssText='height:36px;border:1px solid #d7e0ea;border-radius:8px;padding:0 30px 0 10px;background:#fff;color:#173d78;font-size:12px;font-weight:800';
  select.innerHTML='<option value="workforce">Workforce</option><option value="dot">DOT Compliance</option>';select.value=currentSurface();
  select.addEventListener('change',async()=>{const prior=currentSurface();select.disabled=true;try{await switchBusinessSurface(select.value)}catch(e){select.value=prior;select.disabled=false;status(e.message||'Unable to switch portals.','error')}});
  wrap.append(label,select);host.prepend(wrap);
}

let portalCtx=null;
function portalRole(){return portalCtx?.membership?.role_code||''}
function portalPermissions(){return new Set(portalCtx?.permissions||[])}
function isCtpaAdmin(){return ['ctpa_admin','platform_admin'].includes(portalRole())}

const PAGE_FEATURE={
'employers.html':'employer_management','employees.html':'employee_management','programs.html':'programs','random-pools.html':'consortium_pools','selections.html':'random_selections','testing-orders.html':'testing_orders','results.html':'results_summary','compliance.html':'compliance','documents.html':'documents','reports.html':'standard_reports','billing.html':'billing_tools','clearinghouse.html':'clearinghouse_tools','policies.html':'policy_builder','employer-controls.html':'employer_settings','employer-import.html':'employer_import','enrollment.html':'enrollment_documents','integrations.html':'integrations','notifications.html':'notifications','branding.html':'white_label','audit.html':'audit_history','staff.html':'team_users','rtd-follow-up.html':'rtd_follow_up'};
const NAV=[['Workspace',[['▦','Dashboard','dashboard.html',null],['B','Employer Clients','employers.html','employer_management'],['👥','Employees & Drivers','employees.html','employee_management'],['P','Programs','programs.html','programs'],['R','Consortium Pools','random-pools.html','consortium_pools'],['S','Random Selections','selections.html','random_selections'],['T','Testing Orders','testing-orders.html','testing_orders'],['✓','Results','results.html','results_summary'],['!','Compliance','compliance.html','compliance'],['↺','RTD / Follow-Up','rtd-follow-up.html','rtd_follow_up'],['D','Documents','documents.html','documents'],['↗','Reports / Audit Packet','reports.html','standard_reports']]],['C/TPA Administration',[['C','Clearinghouse','clearinghouse.html','clearinghouse_tools'],['A','Client Service Scope','employer-controls.html','employer_settings'],['I','Employer Import','employer-import.html','employer_import'],['E','Enrollment Agreements','enrollment.html','enrollment_documents'],['Y','Policy Builder','policies.html','policy_builder'],['↔','Integrations','integrations.html','integrations'],['N','Notifications / Action Center','notifications.html','notifications'],['U','Staff & Access','staff.html','team_users'],['W','White Label','branding.html','white_label'],['H','Audit History','audit.html','audit_history'],['?','Support','support.html',null],['$','Plan & Billing','billing.html','billing_tools']]]];
function ent(d,k){return !k||d.entitlements?.[k]===true}
function nav(d){const n=$('.sidebar-nav');if(!n)return;const perms=portalPermissions(),role=portalRole(),allowed=x=>{if(!ent(d,x[3]))return false;if(x[2]==='billing.html'&&role!=='platform_admin'&&!perms.has('billing.read')&&!perms.has('billing.manage'))return false;return true};n.innerHTML=NAV.map(([section,items])=>`<div class="nav-section">${section}</div>${items.filter(allowed).map(([i,l,h])=>`<a class="nav-link ${location.pathname.endsWith('/'+h)?'active':''}" data-nav href="${h}"><span class="nav-icon">${i}</span><span>${l}</span></a>`).join('')}`).join('')}
function empty(msg='No records found.'){return `<div class="saas-empty">${esc(msg)}</div>`}
function table(headings,rows){
  const body=rows||`<tr><td colspan="${headings.length}">${empty()}</td></tr>`;
  return `<section class="ctpa-table-shell" data-ctpa-table-shell>
    <div class="ctpa-table-toolbar">
      <input class="ctpa-table-search" data-ctpa-table-search type="search" placeholder="Search records…" autocomplete="off">
      <span class="ctpa-table-count" data-ctpa-table-count></span>
    </div>
    <div class="management-table-wrap">
      <table class="management-table">
        <thead><tr>${headings.map(x=>`<th>${x}</th>`).join('')}</tr></thead>
        <tbody>${body}</tbody>
      </table>
    </div>
  </section>`;
}
function employerName(d,id){return d.employers.find(x=>x.id===id)?.legal_name||'—'} 
function employeeName(d,id){const x=d.employees.find(x=>x.id===id);return x?`${x.first_name||''} ${x.last_name||''}`.trim():'—'}
function head(title,sub,action=''){
  return `<header class="ctpa-page-header">
    <div class="ctpa-page-header-copy">
      <div class="ctpa-eyebrow">C/TPA WORKSPACE</div>
      <h1>${title}</h1>
      <p>${sub}</p>
    </div>
    ${action?`<div class="ctpa-page-actions">${action}</div>`:''}
  </header><div id="pageStatus" class="inline-status" aria-live="polite"></div>`;
}
function status(m,t='success'){const x=$('#pageStatus');if(x){x.textContent=m;x.className=`inline-status ${t}`}}
function dashboard(d){
  const open=d.testing_orders.filter(x=>!['closed','cancelled','final_result'].includes(x.status)).length;
  const exceptions=d.compliance_cases.filter(x=>!['closed','resolved'].includes(x.status)).length;
  const dot=d.employees.filter(x=>x.dot_covered).length;
  const activePools=d.pools.filter(x=>x.status==='active').length;
  const action=`${isCtpaAdmin()&&ent(d,'employer_import')?'<a class="btn btn-orange" href="employer-import.html">Import Employers</a>':''}<a class="btn btn-outline" href="reports.html">Run Reports</a>`;
  return `${head('C/TPA Dashboard','Multi-client compliance, testing, consortium, and delegated-service overview.',action)}
  <section class="metrics">
    <article class="metric-card"><div class="metric-label">Employer Clients</div><div class="metric-value">${d.employers.length}</div><div class="metric-note">${d.employers.filter(x=>x.status==='active').length} active</div></article>
    <article class="metric-card"><div class="metric-label">Covered Employees</div><div class="metric-value">${d.employees.length}</div><div class="metric-note">${dot} DOT-covered</div></article>
    <article class="metric-card"><div class="metric-label">Open Tests</div><div class="metric-value">${open}</div><div class="metric-note">${d.testing_orders.length} total loaded</div></article>
    <article class="metric-card"><div class="metric-label">Compliance Exceptions</div><div class="metric-value">${exceptions}</div><div class="metric-note">${activePools} active consortium pools</div></article>
  </section>
  <div class="grid grid-2">
    <section class="card">
      <div class="card-head"><div><h2>Employer Attention Queue</h2><span>Open compliance activity by client</span></div><a class="btn btn-outline" href="compliance.html">View Compliance</a></div>
      <div class="card-body">${d.compliance_cases.filter(x=>!['closed','resolved'].includes(x.status)).slice(0,8).map(x=>`<div class="status-row"><div><strong>${esc(employerName(d,x.employer_id))}</strong><small>${esc(x.event_type||'Compliance case')}</small></div><span class="ctpa-status-pill is-warn">${esc(x.status)}</span></div>`).join('')||empty('No open compliance activity.')}</div>
    </section>
    <section class="card">
      <div class="card-head"><div><h2>Consortium Pool Activity</h2><span>Current pools and eligible population</span></div><a class="btn btn-outline" href="random-pools.html">Manage Pools</a></div>
      <div class="card-body">${d.pools.slice(0,8).map(x=>`<div class="status-row"><div><strong>${esc(x.name)}</strong><small>${esc(x.dot_agency||x.program_type||'Program')} • ${d.pool_memberships.filter(m=>m.pool_id===x.id).length} members</small></div><span class="ctpa-status-pill ${x.status==='active'?'is-good':'is-info'}">${esc(x.status)}</span></div>`).join('')||empty('No consortium pools yet.')}</div>
    </section>
  </div>
  <div class="grid grid-2" style="margin-top:16px">
    <section class="card">
      <div class="card-head"><div><h2>Recent Testing Orders</h2><span>Latest testing activity across employer clients</span></div><a class="btn btn-outline" href="testing-orders.html">View Orders</a></div>
      <div class="card-body">${d.testing_orders.slice(0,6).map(x=>`<div class="status-row"><div><strong>${esc(x.order_number||'Testing order')}</strong><small>${esc(employerName(d,x.employer_id))} • ${esc(x.reason||x.test_type||'Test')}</small></div><span class="ctpa-status-pill is-info">${esc(x.status)}</span></div>`).join('')||empty('No testing orders yet.')}</div>
    </section>
    <section class="card">
      <div class="card-head"><div><h2>Quick Actions</h2><span>Common C/TPA workflows</span></div></div>
      <div class="card-body quick-grid">
        <a class="quick" href="employers.html"><b>Employer Clients</b><span>Review assigned organizations</span></a>
        <a class="quick" href="employees.html"><b>Employees & Drivers</b><span>Review covered workforce</span></a>
        <a class="quick" href="selections.html"><b>Random Selections</b><span>Review certified selections</span></a>
        <a class="quick" href="reports.html"><b>Reports / Audit Packet</b><span>Export C/TPA-scoped compliance records</span></a>
      </div>
    </section>
  </div>`;
}

async function renderEmployerClients(d){
  const c=$('.content');if(!c)return;
  c.innerHTML=head('Employer Clients','Loading Employer account management…');
  try{
    let w=await employerApi({action:'workspace'});
    const draw=()=>{
      const employers=w.employers||[],roles=w.roles||[];
      c.innerHTML=head('Employer Clients','Create, edit, and manage Employer client accounts assigned to this C/TPA.',`${w.can_manage?'<button class="btn btn-orange" id="addEmployerClient" type="button">Add Employer</button>':''}${isCtpaAdmin()&&ent(d,'employer_import')?'<a class="btn btn-outline" href="employer-import.html">Import Employers</a>':''}<a class="btn btn-outline" href="employer-controls.html">Service Scope</a>`)
      +`<section class="metrics">
        <article class="metric-card"><div class="metric-label">Employer Clients</div><div class="metric-value">${employers.length}</div><div class="metric-note">${employers.filter(x=>x.status==='active').length} active</div></article>
        <article class="metric-card"><div class="metric-label">Employees / Drivers</div><div class="metric-value">${employers.reduce((n,x)=>n+Number(x.employee_count_live||0),0)}</div><div class="metric-note">Across assigned clients</div></article>
        <article class="metric-card"><div class="metric-label">Account Users</div><div class="metric-value">${employers.reduce((n,x)=>n+(x.account_members||[]).length,0)}</div><div class="metric-note">Employer staff memberships</div></article>
        <article class="metric-card"><div class="metric-label">Management</div><div class="metric-value" style="font-size:18px">${w.can_manage?'Enabled':'Read Only'}</div><div class="metric-note">${w.can_manage_users?'User access enabled':'No user-management access'}</div></article>
      </section>
      ${table(['Employer','USDOT','State','Employees','Primary Contact','Status','Actions'],employers.map(x=>`<tr>
        <td><strong>${esc(x.legal_name)}</strong><br><small>${esc(x.dba_name||'')}</small></td>
        <td>${esc(x.dot_number||'—')}</td><td>${esc(x.state||'—')}</td><td>${x.employee_count_live??0}</td>
        <td>${esc(x.primary_contact_name||'—')}<br><small>${esc(x.primary_contact_email||'')}</small></td>
        <td>${esc(x.status)}</td>
        <td><div class="row-actions"><button class="org-action" type="button" data-manage-employer="${esc(x.id)}">Manage</button>${w.can_manage_users?`<button class="org-action" type="button" data-access-employer="${esc(x.id)}">Account Access</button>`:''}</div></td>
      </tr>`).join(''),'No Employer clients assigned to this C/TPA.')}
      <section id="employerClientPanel" class="card" style="display:none;margin-top:18px"><div class="card-body" id="employerClientPanelBody"></div></section>`;
      wireRenderedPage();

      const panel=$('#employerClientPanel'),body=$('#employerClientPanelBody');

      const employerForm=(x={})=>`<div class="management-section-head"><div><h3>${x.id?'Edit Employer Client':'Add Employer Client'}</h3><p>Employer profile and organization identity remain synchronized.</p></div></div>
        <form id="ctpaEmployerForm" class="saas-form"><input type="hidden" name="id" value="${esc(x.id||'')}"><div class="saas-form-grid">
          <label><span>Legal Name *</span><input name="legal_name" required value="${esc(x.legal_name||'')}"></label>
          <label><span>DBA</span><input name="dba_name" value="${esc(x.dba_name||'')}"></label>
          <label><span>EIN</span><input name="ein" value="${esc(x.ein||'')}"></label>
          <label><span>USDOT Number</span><input name="dot_number" value="${esc(x.dot_number||'')}"></label>
          <label><span>MC Number</span><input name="mc_number" value="${esc(x.mc_number||'')}"></label>
          <label><span>Business Type</span><input name="business_type" value="${esc(x.business_type||'')}"></label>
          <label><span>Phone</span><input name="phone" value="${esc(x.phone||'')}"></label>
          <label><span>Website</span><input name="website" value="${esc(x.website||'')}"></label>
          <label><span>Primary Contact</span><input name="primary_contact_name" value="${esc(x.primary_contact_name||'')}"></label>
          <label><span>Primary Email</span><input name="primary_contact_email" type="email" value="${esc(x.primary_contact_email||'')}"></label>
          <label><span>Safety Manager</span><input name="safety_manager_name" value="${esc(x.safety_manager_name||'')}"></label>
          <label><span>Safety Email</span><input name="safety_manager_email" type="email" value="${esc(x.safety_manager_email||'')}"></label>
          <label><span>HR Contact</span><input name="hr_contact_name" value="${esc(x.hr_contact_name||'')}"></label>
          <label><span>HR Email</span><input name="hr_contact_email" type="email" value="${esc(x.hr_contact_email||'')}"></label>
          <label><span>Billing Contact</span><input name="billing_contact_name" value="${esc(x.billing_contact_name||'')}"></label>
          <label><span>Billing Email</span><input name="billing_contact_email" type="email" value="${esc(x.billing_contact_email||'')}"></label>
          <label><span>DOT Agency</span><select name="applicable_dot_agency"><option value="">Not set</option>${['FMCSA','FAA','FRA','FTA','PHMSA','USCG'].map(v=>`<option value="${v}" ${x.applicable_dot_agency===v?'selected':''}>${v}</option>`).join('')}</select></label>
          <label><span>Status</span><select name="status">${['onboarding','active','suspended','inactive','closed'].map(v=>`<option value="${v}" ${String(x.status||'onboarding')===v?'selected':''}>${esc(v.replaceAll('_',' '))}</option>`).join('')}</select></label>
          <label><span>Address</span><input name="address_line1" value="${esc(x.address_line1||'')}"></label>
          <label><span>Address 2</span><input name="address_line2" value="${esc(x.address_line2||'')}"></label>
          <label><span>City</span><input name="city" value="${esc(x.city||'')}"></label>
          <label><span>State</span><input name="state" value="${esc(x.state||'')}"></label>
          <label><span>Postal Code</span><input name="postal_code" value="${esc(x.postal_code||'')}"></label>
          <label><span>Timezone</span><input name="timezone" value="${esc(x.timezone||'America/Chicago')}"></label>
        </div><div class="management-actions"><button class="btn btn-outline" type="button" id="closeEmployerPanel">Cancel</button>${w.can_manage?'<button class="btn btn-orange">Save Employer</button>':''}</div></form>`;

      const showEmployer=x=>{
        panel.style.display='block';body.innerHTML=employerForm(x);
        $('#closeEmployerPanel').onclick=()=>panel.style.display='none';
        const f=$('#ctpaEmployerForm');
        if(w.can_manage)f.onsubmit=async ev=>{ev.preventDefault();try{const fd=new FormData(f),obj=Object.fromEntries(fd.entries());status('Saving Employer client…');await employerApi({action:'save_employer',employer:obj});w=await employerApi({action:'workspace'});status('Employer client saved.');draw()}catch(e){status(e.message,'error')}};
        panel.scrollIntoView({behavior:'smooth',block:'center'});
      };

      $('#addEmployerClient')?.addEventListener('click',()=>showEmployer({status:'onboarding',timezone:'America/Chicago'}));
      document.querySelectorAll('[data-manage-employer]').forEach(btn=>btn.onclick=()=>showEmployer(employers.find(x=>x.id===btn.dataset.manageEmployer)||{}));

      document.querySelectorAll('[data-access-employer]').forEach(btn=>btn.onclick=()=>{
        const e=employers.find(x=>x.id===btn.dataset.accessEmployer);if(!e)return;
        const members=e.account_members||[];
        panel.style.display='block';
        body.innerHTML=`<div class="management-section-head"><div><h3>${esc(e.legal_name)} · Account Access</h3><p>Employer staff accounts are separate from Employee / Driver portal accounts.</p></div></div>
        <form id="inviteEmployerUser" class="saas-form"><div class="saas-form-grid">
          <label><span>First Name</span><input name="first_name"></label><label><span>Last Name</span><input name="last_name"></label>
          <label><span>Email *</span><input name="email" type="email" required></label>
          <label><span>Role *</span><select name="role_code">${roles.map(r=>`<option value="${esc(r.code)}">${esc(r.name)}</option>`).join('')}</select></label>
        </div><div class="management-actions"><button class="btn btn-orange">Send / Add Account Access</button></div></form>
        ${table(['User','Email','Role','Status','Primary','Action'],members.map(m=>`<tr>
          <td>${esc(m.profiles?.full_name||'Account User')}</td><td>${esc(m.profiles?.email||'—')}</td>
          <td><select data-member-role="${esc(m.id)}">${roles.map(r=>`<option value="${esc(r.id)}" ${r.id===m.role_id?'selected':''}>${esc(r.name)}</option>`).join('')}</select></td>
          <td><select data-member-status="${esc(m.id)}">${['active','suspended','revoked'].map(v=>`<option value="${v}" ${v===m.status?'selected':''}>${esc(v)}</option>`).join('')}</select></td>
          <td>${m.is_primary?'Yes':'No'}</td><td><button class="org-action" data-save-employer-member="${esc(m.id)}" type="button">Save</button></td>
        </tr>`).join(''),'No Employer staff accounts.')}
        <div class="management-actions"><button class="btn btn-outline" id="closeEmployerPanel" type="button">Close</button></div>`;
        wireRenderedPage();
        $('#closeEmployerPanel').onclick=()=>panel.style.display='none';
        $('#inviteEmployerUser').onsubmit=async ev=>{ev.preventDefault();try{status('Creating Employer account access…');const member=Object.fromEntries(new FormData(ev.currentTarget).entries());await employerApi({action:'invite_member',employer_id:e.id,member});w=await employerApi({action:'workspace'});status('Employer account access updated.');draw()}catch(err){status(err.message,'error')}};
        document.querySelectorAll('[data-save-employer-member]').forEach(save=>save.onclick=async()=>{const id=save.dataset.saveEmployerMember;try{await employerApi({action:'save_member',employer_id:e.id,member:{id,role_id:document.querySelector(`[data-member-role="${id}"]`).value,status:document.querySelector(`[data-member-status="${id}"]`).value}});w=await employerApi({action:'workspace'});status('Employer account user updated.');draw()}catch(err){status(err.message,'error')}});
        panel.scrollIntoView({behavior:'smooth',block:'center'});
      });
    };
    draw();
  }catch(e){c.innerHTML=head('Employer Clients','Unable to load Employer account management.')+`<div class="saas-notice">${esc(e.message)}</div>`}
}

async function renderEmployeesDrivers(){
  const c=$('.content');if(!c)return;
  c.innerHTML=head('Employees & Drivers','Loading client workforce…');
  try{
    let w=await workforceApi({action:'workspace'});
    const draw=()=>{
      const employers=w.employers||[],employees=w.employees||[],locations=w.locations||[],programs=w.programs||[],enrollments=w.enrollments||[];
      const empMap=new Map(employers.map(x=>[x.id,x]));
      const active=employees.filter(x=>x.employment_status==='active').length;
      const dot=employees.filter(x=>x.dot_covered).length;
      const linked=employees.filter(x=>x.auth_user_id).length;
      c.innerHTML=head('Employees & Drivers','Manage workforce records across C/TPA client Employers.',w.can_manage_employees?`<button class="btn btn-orange" id="addCtpaEmployee" type="button">Add Employee / Driver</button><a class="btn btn-outline" href="programs.html">Program Enrollment</a>`:`<a class="btn btn-outline" href="programs.html">Program Enrollment</a>`)
      +`<section class="metrics">
        <article class="metric-card"><div class="metric-label">Employees / Drivers</div><div class="metric-value">${employees.length}</div><div class="metric-note">${active} active</div></article>
        <article class="metric-card"><div class="metric-label">DOT Covered</div><div class="metric-value">${dot}</div><div class="metric-note">Across client Employers</div></article>
        <article class="metric-card"><div class="metric-label">Portal Linked</div><div class="metric-value">${linked}</div><div class="metric-note">Linked auth accounts</div></article>
        <article class="metric-card"><div class="metric-label">Management</div><div class="metric-value" style="font-size:18px">${w.can_manage_employees?'Enabled':'Read Only'}</div><div class="metric-note">Based on C/TPA permissions</div></article>
      </section>
      ${table(['Employee / Driver','Employer','Employee #','Job Title','DOT','Agency','Status','Programs','Portal','Actions'],employees.map(x=>{
        const current=enrollments.filter(ep=>ep.employee_id===x.id&&!['ended'].includes(ep.status));
        return `<tr>
          <td><strong>${esc(`${x.first_name||''} ${x.last_name||''}`.trim())}</strong><br><small>${esc(x.email||'')}</small></td>
          <td>${esc(empMap.get(x.employer_id)?.legal_name||'—')}</td><td>${esc(x.employee_number||'—')}</td><td>${esc(x.job_title||'—')}</td>
          <td>${x.dot_covered?'Yes':'No'}</td><td>${esc(x.dot_agency||'—')}</td><td>${esc(x.employment_status)}</td><td>${current.length}</td>
          <td>${x.auth_user_id?'<span class="badge success">Linked</span>':'<span class="badge neutral">Not Linked</span>'}</td>
          <td>${w.can_manage_employees?`<button class="org-action" type="button" data-edit-ctpa-employee="${esc(x.id)}">Edit</button>`:'—'}</td>
        </tr>`;
      }).join(''),'No employees / drivers across the assigned client Employers.')}
      <section id="ctpaEmployeePanel" class="card" style="display:none;margin-top:18px"><div class="card-body" id="ctpaEmployeePanelBody"></div></section>`;
      wireRenderedPage();

      const panel=$('#ctpaEmployeePanel'),body=$('#ctpaEmployeePanelBody');
      const show=(x={})=>{
        panel.style.display='block';
        body.innerHTML=`<div class="management-section-head"><div><h3>${x.id?'Edit Employee / Driver':'Add Employee / Driver'}</h3><p>The employee must stay attached to one of this C/TPA's client Employers.</p></div></div>
          <form id="ctpaEmployeeForm" class="saas-form"><input type="hidden" name="id" value="${esc(x.id||'')}"><div class="saas-form-grid">
            <label><span>Employer *</span><select name="employer_id" required><option value="">Choose Employer</option>${employers.map(e=>`<option value="${esc(e.id)}" ${x.employer_id===e.id?'selected':''}>${esc(e.legal_name)}</option>`).join('')}</select></label>
            <label><span>Location</span><select name="location_id"><option value="">Not assigned</option>${locations.filter(l=>!x.employer_id||l.employer_id===x.employer_id).map(l=>`<option value="${esc(l.id)}" ${x.location_id===l.id?'selected':''}>${esc(l.name)}</option>`).join('')}</select></label>
            <label><span>First Name *</span><input name="first_name" required value="${esc(x.first_name||'')}"></label>
            <label><span>Last Name *</span><input name="last_name" required value="${esc(x.last_name||'')}"></label>
            <label><span>Middle Name</span><input name="middle_name" value="${esc(x.middle_name||'')}"></label>
            <label><span>Employee Number</span><input name="employee_number" value="${esc(x.employee_number||'')}"></label>
            <label><span>Email</span><input name="email" type="email" value="${esc(x.email||'')}"></label>
            <label><span>Mobile</span><input name="mobile" value="${esc(x.mobile||'')}"></label>
            <label><span>Job Title</span><input name="job_title" value="${esc(x.job_title||'')}"></label>
            <label><span>Hire Date</span><input name="hire_date" type="date" value="${esc(x.hire_date||'')}"></label>
            <label><span>Employment Status</span><select name="employment_status">${['invited','pending_enrollment','active','suspended','leave','inactive','terminated','compliance_hold'].map(v=>`<option value="${v}" ${String(x.employment_status||'active')===v?'selected':''}>${esc(v.replaceAll('_',' '))}</option>`).join('')}</select></label>
            <label><span>DOT Agency</span><select name="dot_agency"><option value="">Not DOT</option>${['FMCSA','FAA','FRA','FTA','PHMSA','USCG'].map(v=>`<option value="${v}" ${x.dot_agency===v?'selected':''}>${v}</option>`).join('')}</select></label>
            <label><span>CDL Number</span><input name="cdl_number" value="${esc(x.cdl_number||'')}"></label>
            <label><span>CDL State</span><input name="cdl_state" maxlength="2" value="${esc(x.cdl_state||'')}"></label>
            <label class="config-choice"><span>DOT Covered</span><input name="dot_covered" type="checkbox" ${x.dot_covered?'checked':''}></label>
            <label class="config-choice"><span>Safety Sensitive</span><input name="safety_sensitive" type="checkbox" ${x.safety_sensitive?'checked':''}></label>
          </div><div class="management-actions"><button class="btn btn-outline" type="button" id="closeCtpaEmployeePanel">Cancel</button><button class="btn btn-orange">Save Employee / Driver</button></div></form>`;
        wireRenderedPage();
        const f=$('#ctpaEmployeeForm'),employerSelect=f.elements.employer_id,locationSelect=f.elements.location_id;
        const rebuildLocations=()=>{const prior=locationSelect.value,rows=locations.filter(l=>l.employer_id===employerSelect.value);locationSelect.innerHTML='<option value="">Not assigned</option>'+rows.map(l=>`<option value="${esc(l.id)}">${esc(l.name)}</option>`).join('');if(prior&&rows.some(l=>l.id===prior))locationSelect.value=prior};
        employerSelect.onchange=rebuildLocations;
        $('#closeCtpaEmployeePanel').onclick=()=>panel.style.display='none';
        f.onsubmit=async ev=>{ev.preventDefault();try{const obj=Object.fromEntries(new FormData(f).entries());obj.dot_covered=f.elements.dot_covered.checked;obj.safety_sensitive=f.elements.safety_sensitive.checked;status('Saving employee / driver…');await workforceApi({action:'save_employee',employee:obj});w=await workforceApi({action:'workspace'});status('Employee / driver saved.');draw()}catch(e){status(e.message,'error')}};
        panel.scrollIntoView({behavior:'smooth',block:'center'});
      };
      $('#addCtpaEmployee')?.addEventListener('click',()=>show({employment_status:'active'}));
      document.querySelectorAll('[data-edit-ctpa-employee]').forEach(btn=>btn.onclick=()=>show(employees.find(x=>x.id===btn.dataset.editCtpaEmployee)||{}));
    };
    draw();
  }catch(e){c.innerHTML=head('Employees & Drivers','Unable to load client workforce.')+`<div class="saas-notice">${esc(e.message)}</div>`}
}

async function renderProgramsEnrollment(){
  const c=$('.content');if(!c)return;
  c.innerHTML=head('Programs','Loading Employer programs and enrollment…');
  try{
    let w=await workforceApi({action:'workspace'});
    const draw=()=>{
      const employers=w.employers||[],employees=w.employees||[],programs=w.programs||[],enrollments=w.enrollments||[];
      const empMap=new Map(employers.map(x=>[x.id,x]));
      c.innerHTML=head('Programs & Program Enrollment','Manage DOT / Non-DOT programs and assign employees / drivers to the correct Employer program.',w.can_manage_programs?`<button class="btn btn-orange" id="addCtpaProgram" type="button">Add Program</button><button class="btn btn-outline" id="addCtpaEnrollment" type="button">Enroll Employee / Driver</button>`:'')
      +`<section class="metrics">
        <article class="metric-card"><div class="metric-label">Programs</div><div class="metric-value">${programs.length}</div><div class="metric-note">${programs.filter(x=>x.program_type==='DOT').length} DOT</div></article>
        <article class="metric-card"><div class="metric-label">Active Enrollments</div><div class="metric-value">${enrollments.filter(x=>x.status==='active').length}</div><div class="metric-note">Across client Employers</div></article>
        <article class="metric-card"><div class="metric-label">Pending</div><div class="metric-value">${enrollments.filter(x=>x.status==='pending').length}</div><div class="metric-note">Program enrollment</div></article>
        <article class="metric-card"><div class="metric-label">Management</div><div class="metric-value" style="font-size:18px">${w.can_manage_programs?'Enabled':'Read Only'}</div><div class="metric-note">Based on C/TPA permissions</div></article>
      </section>
      <section class="card"><div class="card-head"><div><h2>Employer Programs</h2><span>Programs remain owned by the individual Employer client.</span></div></div><div class="card-body">
      ${table(['Program','Employer','Type','Agency','Panel','Method','Effective','Status','Action'],programs.map(p=>`<tr>
        <td><strong>${esc(p.name)}</strong></td><td>${esc(empMap.get(p.employer_id)?.legal_name||'—')}</td><td>${esc(p.program_type)}</td><td>${esc(p.dot_agency||'—')}</td>
        <td>${esc(p.testing_panel||'—')}</td><td>${esc(p.testing_method||'—')}</td><td>${fmt(p.effective_date)}</td><td>${esc(p.status)}</td>
        <td>${w.can_manage_programs?`<button class="org-action" type="button" data-edit-ctpa-program="${esc(p.id)}">Edit</button>`:'—'}</td>
      </tr>`).join(''),'No Employer programs.')}</div></section>
      <section class="card" style="margin-top:18px"><div class="card-head"><div><h2>Program Enrollment</h2><span>Employee and program must belong to the same client Employer.</span></div></div><div class="card-body">
      ${table(['Employee / Driver','Employer','Program','Type','Effective','End','Status','Action'],enrollments.map(ep=>`<tr>
        <td><strong>${esc(`${ep.employees?.first_name||''} ${ep.employees?.last_name||''}`.trim())}</strong><br><small>${esc(ep.employees?.employee_number||'')}</small></td>
        <td>${esc(empMap.get(ep.employees?.employer_id)?.legal_name||'—')}</td><td>${esc(ep.programs?.name||'—')}</td><td>${esc(ep.programs?.program_type||'—')}</td>
        <td>${fmt(ep.effective_date)}</td><td>${fmt(ep.end_date)}</td><td>${esc(ep.status)}</td>
        <td>${w.can_manage_programs?`<button class="org-action" type="button" data-edit-ctpa-enrollment="${esc(ep.id)}">Edit</button>`:'—'}</td>
      </tr>`).join(''),'No program enrollments.')}</div></section>
      <section id="ctpaProgramPanel" class="card" style="display:none;margin-top:18px"><div class="card-body" id="ctpaProgramPanelBody"></div></section>`;
      wireRenderedPage();

      const panel=$('#ctpaProgramPanel'),body=$('#ctpaProgramPanelBody');

      const showProgram=(p={})=>{
        panel.style.display='block';body.innerHTML=`<div class="management-section-head"><div><h3>${p.id?'Edit Program':'Add Program'}</h3><p>Program ownership stays with the selected Employer client.</p></div></div>
        <form id="ctpaProgramForm" class="saas-form"><input type="hidden" name="id" value="${esc(p.id||'')}"><div class="saas-form-grid">
          <label><span>Employer *</span><select name="employer_id" required><option value="">Choose Employer</option>${employers.map(e=>`<option value="${esc(e.id)}" ${p.employer_id===e.id?'selected':''}>${esc(e.legal_name)}</option>`).join('')}</select></label>
          <label><span>Program Name *</span><input name="name" required value="${esc(p.name||'')}"></label>
          <label><span>Program Type *</span><select name="program_type"><option value="DOT" ${p.program_type==='DOT'?'selected':''}>DOT</option><option value="NON_DOT" ${p.program_type==='NON_DOT'?'selected':''}>Non-DOT</option></select></label>
          <label><span>DOT Agency</span><select name="dot_agency"><option value="">Not applicable</option>${['FMCSA','FAA','FRA','FTA','PHMSA','USCG'].map(v=>`<option value="${v}" ${p.dot_agency===v?'selected':''}>${v}</option>`).join('')}</select></label>
          <label><span>Regulatory Authority</span><input name="regulatory_authority" value="${esc(p.regulatory_authority||'')}"></label>
          <label><span>Testing Panel</span><input name="testing_panel" value="${esc(p.testing_panel||'')}"></label>
          <label><span>Testing Method</span><input name="testing_method" value="${esc(p.testing_method||'')}"></label>
          <label><span>Testing Frequency</span><input name="testing_frequency" value="${esc(p.testing_frequency||'')}"></label>
          <label><span>Effective Date</span><input name="effective_date" type="date" value="${esc(p.effective_date||'')}"></label>
          <label><span>Status</span><select name="status"><option value="active" ${String(p.status||'active')==='active'?'selected':''}>Active</option><option value="inactive" ${p.status==='inactive'?'selected':''}>Inactive</option></select></label>
        </div><div class="management-actions"><button class="btn btn-outline" type="button" id="closeCtpaProgramPanel">Cancel</button><button class="btn btn-orange">Save Program</button></div></form>`;
        wireRenderedPage();$('#closeCtpaProgramPanel').onclick=()=>panel.style.display='none';
        const f=$('#ctpaProgramForm');f.onsubmit=async ev=>{ev.preventDefault();try{status('Saving Employer program…');await workforceApi({action:'save_program',program:Object.fromEntries(new FormData(f).entries())});w=await workforceApi({action:'workspace'});status('Employer program saved.');draw()}catch(e){status(e.message,'error')}};
        panel.scrollIntoView({behavior:'smooth',block:'center'});
      };

      const showEnrollment=(ep={})=>{
        const employerId=ep.employees?.employer_id||ep.programs?.employer_id||'';
        panel.style.display='block';body.innerHTML=`<div class="management-section-head"><div><h3>${ep.id?'Edit Program Enrollment':'Enroll Employee / Driver'}</h3><p>Only programs belonging to the selected employee's Employer are available.</p></div></div>
        <form id="ctpaEnrollmentForm" class="saas-form"><input type="hidden" name="id" value="${esc(ep.id||'')}"><div class="saas-form-grid">
          <label><span>Employer *</span><select id="enrollEmployer" required><option value="">Choose Employer</option>${employers.map(e=>`<option value="${esc(e.id)}" ${employerId===e.id?'selected':''}>${esc(e.legal_name)}</option>`).join('')}</select></label>
          <label><span>Employee / Driver *</span><select name="employee_id" id="enrollEmployee" required></select></label>
          <label><span>Program *</span><select name="program_id" id="enrollProgram" required></select></label>
          <label><span>Effective Date</span><input name="effective_date" type="date" value="${esc(ep.effective_date||'')}"></label>
          <label><span>End Date</span><input name="end_date" type="date" value="${esc(ep.end_date||'')}"></label>
          <label><span>Status</span><select name="status">${['pending','active','suspended','ended'].map(v=>`<option value="${v}" ${String(ep.status||'active')===v?'selected':''}>${esc(v)}</option>`).join('')}</select></label>
        </div><div class="management-actions"><button class="btn btn-outline" type="button" id="closeCtpaProgramPanel">Cancel</button><button class="btn btn-orange">Save Enrollment</button></div></form>`;
        wireRenderedPage();$('#closeCtpaProgramPanel').onclick=()=>panel.style.display='none';
        const f=$('#ctpaEnrollmentForm'),employer=$('#enrollEmployer'),employee=$('#enrollEmployee'),program=$('#enrollProgram');
        const rebuild=()=>{const eid=employer.value,es=employees.filter(x=>x.employer_id===eid),ps=programs.filter(x=>x.employer_id===eid&&x.status==='active');employee.innerHTML='<option value="">Choose employee</option>'+es.map(x=>`<option value="${esc(x.id)}">${esc(`${x.first_name||''} ${x.last_name||''}`.trim())}</option>`).join('');program.innerHTML='<option value="">Choose program</option>'+ps.map(x=>`<option value="${esc(x.id)}">${esc(x.name)} · ${esc(x.program_type)}${x.dot_agency?` · ${esc(x.dot_agency)}`:''}</option>`).join('');if(ep.employee_id&&es.some(x=>x.id===ep.employee_id))employee.value=ep.employee_id;if(ep.program_id&&ps.some(x=>x.id===ep.program_id))program.value=ep.program_id};
        employer.onchange=rebuild;rebuild();
        f.onsubmit=async ev=>{ev.preventDefault();try{status('Saving program enrollment…');await workforceApi({action:'save_enrollment',enrollment:Object.fromEntries(new FormData(f).entries())});w=await workforceApi({action:'workspace'});status('Program enrollment saved.');draw()}catch(e){status(e.message,'error')}};
        panel.scrollIntoView({behavior:'smooth',block:'center'});
      };

      $('#addCtpaProgram')?.addEventListener('click',()=>showProgram({program_type:'DOT',status:'active'}));
      $('#addCtpaEnrollment')?.addEventListener('click',()=>showEnrollment({status:'active'}));
      document.querySelectorAll('[data-edit-ctpa-program]').forEach(btn=>btn.onclick=()=>showProgram(programs.find(x=>x.id===btn.dataset.editCtpaProgram)||{}));
      document.querySelectorAll('[data-edit-ctpa-enrollment]').forEach(btn=>btn.onclick=()=>showEnrollment(enrollments.find(x=>x.id===btn.dataset.editCtpaEnrollment)||{}));
    };
    draw();
  }catch(e){c.innerHTML=head('Programs & Program Enrollment','Unable to load Employer programs.')+`<div class="saas-notice">${esc(e.message)}</div>`}
}

async function renderConsortiumPools(){
  const c=$('.content');if(!c)return;
  c.innerHTML=head('Consortium Pools','Loading C/TPA consortium pools and membership…');
  try{
    let w=await poolApi({action:'workspace'});
    const draw=()=>{
      const employers=w.employers||[],employees=w.employees||[],programs=w.programs||[],enrollments=w.enrollments||[],pools=w.pools||[],memberships=w.memberships||[],rules=w.regulatory_rules||[];
      const employerMap=new Map(employers.map(x=>[x.id,x])),employeeMap=new Map(employees.map(x=>[x.id,x])),programMap=new Map(programs.map(x=>[x.id,x])),enrollMap=new Map(enrollments.map(x=>[x.id,x]));
      const current=memberships.filter(x=>!x.removed_at),eligible=current.filter(x=>x.eligibility_status==='eligible'),removed=memberships.filter(x=>x.removed_at);
      const activePools=pools.filter(x=>x.status==='active').length;
      const poolMembers=id=>current.filter(x=>x.pool_id===id);
      const currentRule=p=>rules.find(r=>r.program_type===p.program_type&&(p.program_type!=='DOT'||r.dot_agency===p.dot_agency)&&String(r.effective_date||'')<=String(p.effective_date||new Date().toISOString().slice(0,10))&&(!r.end_date||String(r.end_date)>=String(p.effective_date||new Date().toISOString().slice(0,10))));
      c.innerHTML=head('Consortium Pools & Pool Membership','Manage C/TPA-owned consortium pools across assigned Employer clients. Pool membership is tied to each employee’s active Employer program enrollment.',w.can_manage?`<button class="btn btn-orange" id="newConsortiumPool" type="button">New Consortium Pool</button><button class="btn btn-outline" id="addConsortiumMember" type="button">Add Pool Member</button><a class="btn btn-outline" href="selections.html">Random Selections</a>`:`<a class="btn btn-outline" href="selections.html">Random Selections</a>`)
      +`<section class="metrics">
        <article class="metric-card"><div class="metric-label">Consortium Pools</div><div class="metric-value">${pools.length}</div><div class="metric-note">${activePools} active</div></article>
        <article class="metric-card"><div class="metric-label">Current Members</div><div class="metric-value">${current.length}</div><div class="metric-note">Across all pools</div></article>
        <article class="metric-card"><div class="metric-label">Eligible Population</div><div class="metric-value">${eligible.length}</div><div class="metric-note">Available for selection when pool is active</div></article>
        <article class="metric-card"><div class="metric-label">Management</div><div class="metric-value" style="font-size:18px">${w.can_manage?'Enabled':'Read Only'}</div><div class="metric-note">${removed.length} historical removals retained</div></article>
      </section>
      <section class="card"><div class="card-head"><div><h2>Consortium Pools</h2><span>DOT pools use the active regulatory rate when a matching rule exists.</span></div></div><div class="card-body">
      ${table(['Pool','Program','Members','Eligible','Drug Rate','Alcohol Rate','Schedule','Status','Actions'],pools.map(p=>{const members=poolMembers(p.id),rule=currentRule(p);return `<tr>
        <td><strong>${esc(p.name)}</strong><br><small>${fmt(p.effective_date)}</small></td>
        <td>${esc(p.program_type)}${p.dot_agency?` · ${esc(p.dot_agency)}`:''}${rule?`<br><small>${esc(rule.rule_name||'Current regulatory rule')}</small>`:''}</td>
        <td>${members.length}</td><td>${members.filter(x=>x.eligibility_status==='eligible').length}</td>
        <td>${p.drug_testing_rate==null?'—':`${Number(p.drug_testing_rate)}%`}</td><td>${p.alcohol_testing_rate==null?'—':`${Number(p.alcohol_testing_rate)}%`}</td>
        <td>${esc(p.selection_schedule||'—')}</td><td>${esc(p.status)}</td>
        <td><div class="row-actions"><button class="org-action" type="button" data-view-pool-members="${esc(p.id)}">Members</button>${w.can_manage?`<button class="org-action" type="button" data-edit-consortium-pool="${esc(p.id)}">Edit</button>`:''}</div></td>
      </tr>`}).join(''),'No consortium pools configured.')}</div></section>
      <section id="consortiumPoolPanel" class="card" style="display:none;margin-top:18px"><div class="card-body" id="consortiumPoolPanelBody"></div></section>`;
      wireRenderedPage();
      const panel=$('#consortiumPoolPanel'),body=$('#consortiumPoolPanelBody');

      const showPool=(p={})=>{
        panel.style.display='block';
        body.innerHTML=`<div class="management-section-head"><div><h3>${p.id?'Edit Consortium Pool':'New Consortium Pool'}</h3><p>Consortium pools belong to the C/TPA. Individual members remain linked to their Employer-owned program enrollment.</p></div></div>
        <form id="consortiumPoolForm" class="saas-form"><input type="hidden" name="id" value="${esc(p.id||'')}"><div class="saas-form-grid">
          <label><span>Pool Name *</span><input name="name" required value="${esc(p.name||'')}"></label>
          <label><span>Program Type *</span><select name="program_type"><option value="DOT" ${String(p.program_type||'DOT')==='DOT'?'selected':''}>DOT</option><option value="NON_DOT" ${p.program_type==='NON_DOT'?'selected':''}>Non-DOT</option></select></label>
          <label><span>DOT Agency</span><select name="dot_agency"><option value="">Not applicable</option>${['FMCSA','FAA','FRA','FTA','PHMSA','USCG'].map(v=>`<option value="${v}" ${p.dot_agency===v?'selected':''}>${v}</option>`).join('')}</select></label>
          <label><span>Effective Date *</span><input name="effective_date" type="date" required value="${esc(p.effective_date||new Date().toISOString().slice(0,10))}"></label>
          <label><span>Drug Random Rate %</span><input name="drug_testing_rate" type="number" min="0" max="100" step="0.01" value="${esc(p.drug_testing_rate??'')}"></label>
          <label><span>Alcohol Random Rate %</span><input name="alcohol_testing_rate" type="number" min="0" max="100" step="0.01" value="${esc(p.alcohol_testing_rate??'')}"></label>
          <label><span>Selection Schedule *</span><select name="selection_schedule">${['monthly','quarterly','semiannual','annual'].map(v=>`<option value="${v}" ${String(p.selection_schedule||'quarterly').toLowerCase()===v?'selected':''}>${esc(v)}</option>`).join('')}</select></label>
          <label><span>Status</span><select name="status">${['draft','active','suspended','inactive','archived'].map(v=>`<option value="${v}" ${String(p.status||'draft')===v?'selected':''}>${esc(v)}</option>`).join('')}</select></label>
        </div><div id="poolRuleNotice" class="saas-notice" style="margin-top:14px"></div><div class="management-actions"><button class="btn btn-outline" type="button" id="closeConsortiumPoolPanel">Cancel</button><button class="btn btn-orange">Save Consortium Pool</button></div></form>`;
        wireRenderedPage();
        const f=$('#consortiumPoolForm'),type=f.elements.program_type,agency=f.elements.dot_agency,effective=f.elements.effective_date,drug=f.elements.drug_testing_rate,alcohol=f.elements.alcohol_testing_rate,notice=$('#poolRuleNotice');
        const updateRule=()=>{const date=effective.value||new Date().toISOString().slice(0,10),rule=rules.find(r=>r.program_type===type.value&&(type.value!=='DOT'||r.dot_agency===agency.value)&&String(r.effective_date||'')<=date&&(!r.end_date||String(r.end_date)>=date));agency.disabled=type.value!=='DOT';if(type.value==='DOT'&&rule){drug.value=rule.drug_rate??'';alcohol.value=rule.alcohol_rate??'';drug.readOnly=true;alcohol.readOnly=true;notice.innerHTML=`<strong>${esc(rule.rule_name||'Current DOT regulatory rule')}</strong><br>Drug ${rule.drug_rate??'—'}% · Alcohol ${rule.alcohol_rate??'—'}% · effective ${fmt(rule.effective_date)}. These rates are applied server-side.`}else{drug.readOnly=false;alcohol.readOnly=false;notice.textContent=type.value==='DOT'?'No matching active regulatory rate is stored for this agency/effective date. Enter the configured rate carefully.':'Non-DOT pool rates are configured by the C/TPA / Employer policy.'}};
        type.onchange=updateRule;agency.onchange=updateRule;effective.onchange=updateRule;updateRule();
        $('#closeConsortiumPoolPanel').onclick=()=>panel.style.display='none';
        f.onsubmit=async ev=>{ev.preventDefault();try{const obj=Object.fromEntries(new FormData(f).entries());status('Saving consortium pool…');await poolApi({action:'save_pool',pool:obj});w=await poolApi({action:'workspace'});status('Consortium pool saved.');draw()}catch(e){status(e.message,'error')}};
        panel.scrollIntoView({behavior:'smooth',block:'center'});
      };

      const showMembership=(membership={},presetPool='')=>{
        const poolId=membership.pool_id||presetPool||'',p=pools.find(x=>x.id===poolId)||null,employee=employeeMap.get(membership.employee_id),employerId=employee?.employer_id||'';
        panel.style.display='block';
        body.innerHTML=`<div class="management-section-head"><div><h3>${membership.id?'Edit Pool Membership':'Add Consortium Pool Member'}</h3><p>Eligibility requires an active employee program enrollment matching the consortium pool’s program type and DOT agency.</p></div></div>
        <form id="consortiumMemberForm" class="saas-form"><input type="hidden" name="id" value="${esc(membership.id||'')}"><div class="saas-form-grid">
          <label><span>Consortium Pool *</span><select name="pool_id" id="memberPool" required><option value="">Choose pool</option>${pools.filter(x=>x.status!=='archived').map(x=>`<option value="${esc(x.id)}" ${x.id===poolId?'selected':''}>${esc(x.name)} · ${esc(x.program_type)}${x.dot_agency?` · ${esc(x.dot_agency)}`:''}</option>`).join('')}</select></label>
          <label><span>Employer *</span><select id="memberEmployer" required><option value="">Choose Employer</option>${employers.map(e=>`<option value="${esc(e.id)}" ${e.id===employerId?'selected':''}>${esc(e.legal_name)}</option>`).join('')}</select></label>
          <label><span>Employee / Driver *</span><select name="employee_id" id="memberEmployee" required></select></label>
          <label><span>Active Program Enrollment *</span><select name="employee_program_id" id="memberEnrollment" required></select></label>
          <label><span>Effective Date *</span><input name="effective_date" type="date" required value="${esc(membership.effective_date||new Date().toISOString().slice(0,10))}"></label>
          <label><span>Eligibility</span><select name="eligibility_status" id="memberEligibility">${['pending','eligible','ineligible'].map(v=>`<option value="${v}" ${String(membership.eligibility_status||'eligible')===v?'selected':''}>${esc(v)}</option>`).join('')}</select></label>
          <label id="ineligibleReasonWrap" style="grid-column:1/-1"><span>Ineligible Reason</span><input name="ineligible_reason" value="${esc(membership.ineligible_reason||'')}"></label>
        </div><div id="memberEligibilityNotice" class="saas-notice" style="margin-top:14px"></div><div class="management-actions"><button class="btn btn-outline" type="button" id="closeConsortiumPoolPanel">Cancel</button><button class="btn btn-orange">Save Membership</button></div></form>`;
        wireRenderedPage();
        const f=$('#consortiumMemberForm'),poolSel=$('#memberPool'),empSel=$('#memberEmployer'),employeeSel=$('#memberEmployee'),enrollSel=$('#memberEnrollment'),elig=$('#memberEligibility'),reason=$('#ineligibleReasonWrap'),eligNotice=$('#memberEligibilityNotice');
        if(membership.id){poolSel.disabled=true;empSel.disabled=true;employeeSel.disabled=true;enrollSel.disabled=true}
        const rebuildEmployees=()=>{const rows=employees.filter(x=>x.employer_id===empSel.value);employeeSel.innerHTML='<option value="">Choose employee / driver</option>'+rows.map(x=>`<option value="${esc(x.id)}">${esc(`${x.first_name||''} ${x.last_name||''}`.trim())}${x.employee_number?` · ${esc(x.employee_number)}`:''}</option>`).join('');if(membership.employee_id&&rows.some(x=>x.id===membership.employee_id))employeeSel.value=membership.employee_id;rebuildEnrollments()};
        const rebuildEnrollments=()=>{const pool=pools.find(x=>x.id===poolSel.value),emp=employeeMap.get(employeeSel.value);let eps=enrollments.filter(ep=>ep.employee_id===employeeSel.value&&ep.status==='active');eps=eps.filter(ep=>{const pr=programMap.get(ep.program_id);return pr&&pr.status==='active'&&pool&&pr.program_type===pool.program_type&&(pool.program_type!=='DOT'||pr.dot_agency===pool.dot_agency)});enrollSel.innerHTML='<option value="">Choose matching enrollment</option>'+eps.map(ep=>{const pr=programMap.get(ep.program_id);return `<option value="${esc(ep.id)}">${esc(pr?.name||'Program')} · ${esc(pr?.program_type||'')}${pr?.dot_agency?` · ${esc(pr.dot_agency)}`:''}</option>`}).join('');if(membership.employee_program_id&&eps.some(x=>x.id===membership.employee_program_id))enrollSel.value=membership.employee_program_id;const poolText=pool?`${pool.program_type}${pool.dot_agency?` · ${pool.dot_agency}`:''}`:'select a pool';eligNotice.textContent=eps.length?`Matching active enrollment found for ${poolText}.`:`No matching active program enrollment is available for this employee and ${poolText}.`};
        const updateReason=()=>{reason.style.display=elig.value==='ineligible'?'block':'none'};
        poolSel.onchange=()=>{rebuildEnrollments()};empSel.onchange=rebuildEmployees;employeeSel.onchange=rebuildEnrollments;elig.onchange=updateReason;rebuildEmployees();if(membership.id){poolSel.value=membership.pool_id;empSel.value=employerId;rebuildEmployees();employeeSel.value=membership.employee_id;rebuildEnrollments();enrollSel.value=membership.employee_program_id}updateReason();
        $('#closeConsortiumPoolPanel').onclick=()=>panel.style.display='none';
        f.onsubmit=async ev=>{ev.preventDefault();try{const obj=Object.fromEntries(new FormData(f).entries());if(membership.id){obj.id=membership.id;obj.pool_id=membership.pool_id;obj.employee_id=membership.employee_id;obj.employee_program_id=membership.employee_program_id}status('Saving pool membership…');await poolApi({action:'save_membership',membership:obj});w=await poolApi({action:'workspace'});status('Pool membership saved.');draw()}catch(e){status(e.message,'error')}};
        panel.scrollIntoView({behavior:'smooth',block:'center'});
      };

      const showMembers=poolId=>{
        const p=pools.find(x=>x.id===poolId);if(!p)return;const rows=current.filter(x=>x.pool_id===poolId);
        panel.style.display='block';body.innerHTML=`<div class="management-section-head"><div><h3>${esc(p.name)} · Pool Membership</h3><p>${esc(p.program_type)}${p.dot_agency?` · ${esc(p.dot_agency)}`:''} · ${rows.filter(x=>x.eligibility_status==='eligible').length} eligible of ${rows.length} current members.</p></div>${w.can_manage?`<button class="btn btn-orange" id="addMemberToThisPool" type="button">Add Member</button>`:''}</div>
        ${table(['Employee / Driver','Employer','Program Enrollment','Effective','Eligibility','Reason','Actions'],rows.map(m=>{const e=employeeMap.get(m.employee_id),ep=enrollMap.get(m.employee_program_id),pr=programMap.get(ep?.program_id);return `<tr><td><strong>${esc(e?`${e.first_name||''} ${e.last_name||''}`.trim():'Employee')}</strong><br><small>${esc(e?.employee_number||'')}</small></td><td>${esc(employerMap.get(e?.employer_id)?.legal_name||'—')}</td><td>${esc(pr?.name||'—')}${pr?.dot_agency?`<br><small>${esc(pr.dot_agency)}</small>`:''}</td><td>${fmt(m.effective_date)}</td><td>${esc(m.eligibility_status)}</td><td>${esc(m.ineligible_reason||'—')}</td><td>${w.can_manage?`<div class="row-actions"><button class="org-action" data-edit-pool-member="${esc(m.id)}" type="button">Edit</button><button class="org-action" data-remove-pool-member="${esc(m.id)}" type="button">Remove</button></div>`:'—'}</td></tr>`}).join(''),'No current members in this consortium pool.')}
        <div class="management-actions"><button class="btn btn-outline" id="closeConsortiumPoolPanel" type="button">Close</button></div>`;
        wireRenderedPage();$('#closeConsortiumPoolPanel').onclick=()=>panel.style.display='none';$('#addMemberToThisPool')?.addEventListener('click',()=>showMembership({},poolId));
        document.querySelectorAll('[data-edit-pool-member]').forEach(btn=>btn.onclick=()=>showMembership(current.find(x=>x.id===btn.dataset.editPoolMember)||{},poolId));
        document.querySelectorAll('[data-remove-pool-member]').forEach(btn=>btn.onclick=async()=>{const m=current.find(x=>x.id===btn.dataset.removePoolMember);if(!m)return;const e=employeeMap.get(m.employee_id),reason=prompt(`Removal reason for ${e?`${e.first_name||''} ${e.last_name||''}`.trim():'this member'}:`,'No longer eligible');if(!reason)return;try{status('Removing pool member…');await poolApi({action:'remove_membership',membership_id:m.id,removal_reason:reason});w=await poolApi({action:'workspace'});status('Pool member removed. Membership history was retained.');draw()}catch(err){status(err.message,'error')}});
        panel.scrollIntoView({behavior:'smooth',block:'center'});
      };

      $('#newConsortiumPool')?.addEventListener('click',()=>showPool({program_type:'DOT',dot_agency:'FMCSA',selection_schedule:'quarterly',status:'draft'}));
      $('#addConsortiumMember')?.addEventListener('click',()=>showMembership({eligibility_status:'eligible'}));
      document.querySelectorAll('[data-edit-consortium-pool]').forEach(btn=>btn.onclick=()=>showPool(pools.find(x=>x.id===btn.dataset.editConsortiumPool)||{}));
      document.querySelectorAll('[data-view-pool-members]').forEach(btn=>btn.onclick=()=>showMembers(btn.dataset.viewPoolMembers));
    };
    draw();
  }catch(e){c.innerHTML=head('Consortium Pools & Pool Membership','Unable to load consortium pool management.')+`<div class="saas-notice">${esc(e.message)}</div>`}
}


async function renderRandomSelections(){
  const c=$('.content');if(!c)return;
  c.innerHTML=head('Random Selections','Loading consortium selection workspace…');
  try{
    let w=await selectionApi({action:'workspace'});
    const draw=()=>{
      const pools=w.pools||[],summary=w.pool_summary||[],events=w.events||[],selected=w.selected||[],orders=w.orders||[],notices=w.notices||[];
      const poolMap=new Map(pools.map(x=>[x.id,x])),sumMap=new Map(summary.map(x=>[x.pool_id,x]));
      const selectedByEvent=new Map();
      selected.forEach(x=>{if(!selectedByEvent.has(x.selection_event_id))selectedByEvent.set(x.selection_event_id,[]);selectedByEvent.get(x.selection_event_id).push(x)});
      const orderByMember=new Map(orders.map(x=>[x.selection_member_id,x]));
      const noticesByEvent=new Map();
      notices.forEach(x=>{if(!noticesByEvent.has(x.related_id))noticesByEvent.set(x.related_id,[]);noticesByEvent.get(x.related_id).push(x)});
      const activePools=pools.filter(x=>x.status==='active');
      const totalSelected=selected.length;
      const orderCount=orders.length;
      const queued=notices.filter(x=>x.status==='queued').length;

      c.innerHTML=head('Random Selections','Execute and review locked consortium selections. Randomization is performed only on the server using Web Crypto.',w.can_execute?`<button class="btn btn-orange" id="runCtpaSelection" type="button">Run Selection</button><a class="btn btn-outline" href="random-pools.html">Manage Pools</a>`:`<a class="btn btn-outline" href="random-pools.html">View Pools</a>`)
      +`<section class="metrics">
        <article class="metric-card"><div class="metric-label">Selection Events</div><div class="metric-value">${events.length}</div><div class="metric-note">${events.filter(x=>x.status==='locked').length} locked</div></article>
        <article class="metric-card"><div class="metric-label">Selected Members</div><div class="metric-value">${totalSelected}</div><div class="metric-note">Across consortium events</div></article>
        <article class="metric-card"><div class="metric-label">Testing Orders</div><div class="metric-value">${orderCount}</div><div class="metric-note">Created from selected members</div></article>
        <article class="metric-card"><div class="metric-label">Queued Notices</div><div class="metric-value">${queued}</div><div class="metric-note">Employer notices pending delivery</div></article>
      </section>
      <div class="saas-notice"><strong>Selection integrity:</strong> the browser never chooses employees. The server snapshots the eligible population, uses unbiased Web Crypto randomization, locks the event, and records the selection in the audit trail.</div>
      <section class="card" style="margin-top:18px"><div class="card-head"><div><h2>Selection History</h2><span>Locked selection events and downstream testing-order status.</span></div></div><div class="card-body">
      ${table(['Date','Pool','Population','Drug','Alcohol','Selected','Orders','Notices','Status','Actions'],events.map(ev=>{
        const p=poolMap.get(ev.pool_id),members=selectedByEvent.get(ev.id)||[],eventOrders=members.map(m=>orderByMember.get(m.id)).filter(Boolean),ns=noticesByEvent.get(ev.id)||[];
        return `<tr>
          <td>${fmt(ev.selection_date)}</td>
          <td><strong>${esc(p?.name||'Pool')}</strong><br><small>${esc(p?.program_type||'—')}${p?.dot_agency?` · ${esc(p.dot_agency)}`:''}</small></td>
          <td>${ev.population_size??0}</td><td>${ev.drug_selection_count??0}</td><td>${ev.alcohol_selection_count??0}</td>
          <td>${members.length}</td><td>${eventOrders.length}/${members.length}</td><td>${ns.length}</td><td>${esc(ev.status)}</td>
          <td><div class="row-actions"><button class="org-action" type="button" data-view-selection="${esc(ev.id)}">View</button>${w.can_execute&&ev.status==='locked'?`<button class="org-action" type="button" data-create-selection-orders="${esc(ev.id)}">Create Orders</button><button class="org-action" type="button" data-queue-selection-notices="${esc(ev.id)}">Queue Notices</button>`:''}</div></td>
        </tr>`;
      }).join(''),'No consortium selection events.')}</div></section>
      <section id="ctpaSelectionPanel" class="card" style="display:none;margin-top:18px"><div class="card-body" id="ctpaSelectionPanelBody"></div></section>`;
      wireRenderedPage();

      const panel=$('#ctpaSelectionPanel'),body=$('#ctpaSelectionPanelBody');

      const showRun=()=>{
        panel.style.display='block';
        body.innerHTML=`<div class="management-section-head"><div><h3>Run Consortium Random Selection</h3><p>Choose an active consortium pool and the number of drug/alcohol selections for this event. Counts are validated against the live eligible population.</p></div></div>
          <form id="ctpaSelectionForm" class="saas-form"><div class="saas-form-grid">
            <label><span>Consortium Pool *</span><select name="pool_id" required><option value="">Choose pool</option>${activePools.map(p=>{const s=sumMap.get(p.id)||{};return `<option value="${esc(p.id)}">${esc(p.name)} · ${esc(p.program_type)}${p.dot_agency?` · ${esc(p.dot_agency)}`:''} · ${s.eligible_members||0} eligible</option>`}).join('')}</select></label>
            <label><span>Drug Selection Count</span><input name="drug_count" type="number" min="0" step="1" value="0"></label>
            <label><span>Alcohol Selection Count</span><input name="alcohol_count" type="number" min="0" step="1" value="0"></label>
          </div>
          <div id="selectionPoolSummary" class="saas-notice">Choose a consortium pool to review its population and configured rates.</div>
          <div class="management-actions"><button class="btn btn-outline" type="button" id="closeCtpaSelectionPanel">Cancel</button><button class="btn btn-orange">Run & Lock Selection</button></div></form>`;
        wireRenderedPage();
        const f=$('#ctpaSelectionForm'),sel=f.elements.pool_id,summaryBox=$('#selectionPoolSummary');
        const updateSummary=()=>{const p=poolMap.get(sel.value),s=sumMap.get(sel.value);if(!p){summaryBox.textContent='Choose a consortium pool to review its population and configured rates.';return}summaryBox.innerHTML=`<strong>${esc(p.name)}</strong> · Current members: ${s?.current_members||0} · Eligible today: ${s?.eligible_members||0} · Drug rate: ${p.drug_testing_rate??'—'}% · Alcohol rate: ${p.alcohol_testing_rate??'—'}% · Schedule: ${esc(p.selection_schedule||'—')}`};
        sel.onchange=updateSummary;updateSummary();
        $('#closeCtpaSelectionPanel').onclick=()=>panel.style.display='none';
        f.onsubmit=async ev=>{ev.preventDefault();if(!window.confirm('Run and permanently lock this random selection event? The selected population and results cannot be re-randomized in the browser.'))return;try{const x=Object.fromEntries(new FormData(f).entries());status('Running server-side random selection…');const r=await selectionApi({action:'run_selection',pool_id:x.pool_id,drug_count:Number(x.drug_count||0),alcohol_count:Number(x.alcohol_count||0)});status(`Selection locked with ${(r.selected||[]).length} selected employee(s) / driver(s).`);w=await selectionApi({action:'workspace'});draw()}catch(e){status(e.message,'error')}};
        panel.scrollIntoView({behavior:'smooth',block:'center'});
      };

      $('#runCtpaSelection')?.addEventListener('click',showRun);

      document.querySelectorAll('[data-view-selection]').forEach(btn=>btn.onclick=()=>{
        const ev=events.find(x=>x.id===btn.dataset.viewSelection),p=poolMap.get(ev.pool_id),members=selectedByEvent.get(ev.id)||[],ns=noticesByEvent.get(ev.id)||[];
        panel.style.display='block';
        body.innerHTML=`<div class="management-section-head"><div><h3>${esc(p?.name||'Consortium Pool')} · ${fmt(ev.selection_date)}</h3><p>Locked ${esc(ev.randomization_version||'selection')} event · population ${ev.population_size||0}</p></div></div>
          ${table(['#','Employee / Driver','Employer','Test Type','Testing Order','Order Status'],members.map(m=>{const o=orderByMember.get(m.id);return `<tr><td>${m.ordinal??'—'}</td><td><strong>${esc(`${m.employees?.first_name||''} ${m.employees?.last_name||''}`.trim())}</strong><br><small>${esc(m.employees?.employee_number||'')}</small></td><td>${esc(m.employers?.legal_name||'—')}</td><td>${esc(m.test_type)}</td><td>${esc(o?.order_number||'Not created')}</td><td>${esc(o?.status||'—')}</td></tr>`}).join(''),'No selected members.')}
          <div style="margin-top:18px"><h4>Employer Notice Queue</h4>${table(['Recipient','Status','Queued','Delivered','Failure'],ns.map(n=>`<tr><td>${esc(n.recipient_address||'—')}</td><td>${esc(n.status)}</td><td>${fmt(n.queued_at)}</td><td>${fmt(n.delivered_at)}</td><td>${esc(n.failure_reason||'—')}</td></tr>`).join(''),'No notices queued for this selection.')}</div>
          <div class="management-actions"><button class="btn btn-outline" type="button" id="closeCtpaSelectionPanel">Close</button></div>`;
        wireRenderedPage();$('#closeCtpaSelectionPanel').onclick=()=>panel.style.display='none';panel.scrollIntoView({behavior:'smooth',block:'center'});
      });

      document.querySelectorAll('[data-create-selection-orders]').forEach(btn=>btn.onclick=async()=>{try{status('Creating testing orders from locked selection…');const r=await selectionApi({action:'create_testing_orders',selection_event_id:btn.dataset.createSelectionOrders});status(`${r.created_count||0} testing order(s) created; ${r.existing_count||0} already existed.`);w=await selectionApi({action:'workspace'});draw()}catch(e){status(e.message,'error')}});

      document.querySelectorAll('[data-queue-selection-notices]').forEach(btn=>btn.onclick=async()=>{try{status('Queueing Employer random-selection notices…');const r=await selectionApi({action:'queue_employer_notices',selection_event_id:btn.dataset.queueSelectionNotices});status(`${r.queued_count||0} Employer notice(s) queued; ${r.skipped_count||0} skipped/already queued.`);w=await selectionApi({action:'workspace'});draw()}catch(e){status(e.message,'error')}});
    };
    draw();
  }catch(e){c.innerHTML=head('Random Selections','Unable to load consortium random selections.')+`<div class="saas-notice">${esc(e.message)}</div>`}
}

async function renderTestingOrders(){
  const c=$('.content');if(!c)return;
  c.innerHTML=head('Testing Orders','Loading C/TPA testing workspace…');
  try{
    let w=await testingApi({action:'workspace'});
    const draw=()=>{
      const employers=w.employers||[],orders=w.orders||[],employees=w.employees||[],programs=w.programs||[],enrollments=w.enrollments||[],sites=w.sites||[],results=w.results||[],statuses=w.statuses||[];
      const empMap=new Map(employers.map(x=>[x.id,x])),resultByOrder=new Map();
      results.forEach(x=>{if(!resultByOrder.has(x.testing_order_id))resultByOrder.set(x.testing_order_id,x)});
      const open=orders.filter(x=>!['final_result','closed','cancelled','refused','no_show','unable_to_collect','invalid_specimen'].includes(x.status)).length;
      const random=orders.filter(x=>x.reason==='random').length;
      const awaiting=orders.filter(x=>['created','assigned','employee_notified','scheduled','at_collection'].includes(x.status)).length;
      const lab=orders.filter(x=>['collected','laboratory','mro_review'].includes(x.status)).length;

      c.innerHTML=head('Testing Orders','Create and manage testing orders across assigned Employer clients. Random testing orders stay tied to locked consortium selections.',w.can_manage?`<button class="btn btn-orange" id="addCtpaTestingOrder" type="button">New Testing Order</button><a class="btn btn-outline" href="selections.html">Random Selections</a><a class="btn btn-outline" href="results.html">Results</a>`:`<a class="btn btn-outline" href="results.html">Results</a>`)
      +`<section class="metrics">
        <article class="metric-card"><div class="metric-label">Testing Orders</div><div class="metric-value">${orders.length}</div><div class="metric-note">${open} open</div></article>
        <article class="metric-card"><div class="metric-label">Awaiting Collection</div><div class="metric-value">${awaiting}</div><div class="metric-note">Created through at-collection</div></article>
        <article class="metric-card"><div class="metric-label">Lab / MRO</div><div class="metric-value">${lab}</div><div class="metric-note">Collected through MRO review</div></article>
        <article class="metric-card"><div class="metric-label">Random Orders</div><div class="metric-value">${random}</div><div class="metric-note">Selection-generated</div></article>
      </section>
      <div class="saas-notice"><strong>Order controls:</strong> manual Random orders are blocked. Random orders are created only from locked C/TPA Random Selection events and their employee/program identity cannot be changed later.</div>
      <section class="card" style="margin-top:18px"><div class="card-head"><div><h2>Testing Order History</h2><span>Employer, employee, program, collection and result workflow status.</span></div></div><div class="card-body">
      ${table(['Order','Employer','Employee / Driver','Program','Reason','Test','Collection Site','Deadline','Status','Result','Actions'],orders.map(o=>{
        const r=resultByOrder.get(o.id);
        return `<tr>
          <td><strong>${esc(o.order_number)}</strong><br><small>${fmt(o.created_at)}</small></td>
          <td>${esc(empMap.get(o.employer_id)?.legal_name||'—')}</td>
          <td><strong>${esc(`${o.employees?.first_name||''} ${o.employees?.last_name||''}`.trim())}</strong><br><small>${esc(o.employees?.employee_number||'')}</small></td>
          <td>${esc(o.programs?.name||'—')}<br><small>${esc(o.program_type||'—')}${o.programs?.dot_agency?` · ${esc(o.programs.dot_agency)}`:''}</small></td>
          <td>${esc(String(o.reason||'').replaceAll('_',' '))}</td><td>${esc(String(o.test_type||'').replaceAll('_',' '))}</td>
          <td>${esc(o.collection_sites?.name||'—')}</td><td>${fmt(o.collection_deadline)}</td><td>${esc(String(o.status||'').replaceAll('_',' '))}</td>
          <td>${esc(r?.final_status&&r.final_status!=='pending'?r.final_status:r?.preliminary_status||'—')}</td>
          <td><button class="org-action" type="button" data-manage-testing-order="${esc(o.id)}">${w.can_manage?'Manage':'View'}</button></td>
        </tr>`;
      }).join(''),'No testing orders across assigned Employer clients.')}</div></section>
      <section id="ctpaTestingPanel" class="card" style="display:none;margin-top:18px"><div class="card-body" id="ctpaTestingPanelBody"></div></section>`;
      wireRenderedPage();

      const panel=$('#ctpaTestingPanel'),body=$('#ctpaTestingPanelBody');
      const reasonOptions=['pre_employment','reasonable_suspicion','post_accident','return_to_duty','follow_up','other'];
      const testOptions=['drug','alcohol','drug_and_alcohol'];

      const renderForm=(o={})=>{
        const locked=!!o.selection_member_id,editing=!!o.id;
        const employerId=o.employer_id||'',employeeId=o.employee_id||'',programId=o.program_id||'';
        const relevantEmployees=employees.filter(x=>!employerId||x.employer_id===employerId);
        const relevantPrograms=programs.filter(x=>!employerId||x.employer_id===employerId);
        const relevantSites=sites.filter(x=>!employerId||x.employer_id===employerId);
        panel.style.display='block';
        body.innerHTML=`<div class="management-section-head"><div><h3>${editing?`Manage ${esc(o.order_number)}`:'Create Testing Order'}</h3><p>${locked?'Selection-generated order: Employer, employee, program, reason and test type are locked.':'Manual C/TPA testing order for an assigned Employer client.'}</p></div></div>
        <form id="ctpaTestingForm" class="saas-form"><input type="hidden" name="id" value="${esc(o.id||'')}"><div class="saas-form-grid">
          <label><span>Employer *</span><select name="employer_id" id="testEmployer" ${locked?'disabled':''} required><option value="">Choose Employer</option>${employers.map(e=>`<option value="${esc(e.id)}" ${employerId===e.id?'selected':''}>${esc(e.legal_name)}</option>`).join('')}</select></label>
          <label><span>Employee / Driver *</span><select name="employee_id" id="testEmployee" ${locked?'disabled':''} required><option value="">Choose employee</option>${relevantEmployees.map(e=>`<option value="${esc(e.id)}" ${employeeId===e.id?'selected':''}>${esc(`${e.first_name||''} ${e.last_name||''}`.trim())}</option>`).join('')}</select></label>
          <label><span>Program *</span><select name="program_id" id="testProgram" ${locked?'disabled':''} required><option value="">Choose program</option>${relevantPrograms.map(p=>`<option value="${esc(p.id)}" ${programId===p.id?'selected':''}>${esc(p.name)} · ${esc(p.program_type)}${p.dot_agency?` · ${esc(p.dot_agency)}`:''}</option>`).join('')}</select></label>
          <label><span>Reason *</span><select name="reason" ${locked?'disabled':''}>${reasonOptions.map(v=>`<option value="${v}" ${String(o.reason||'pre_employment')===v?'selected':''}>${esc(v.replaceAll('_',' '))}</option>`).join('')}</select></label>
          <label><span>Test Type *</span><select name="test_type" ${locked?'disabled':''}>${testOptions.map(v=>`<option value="${v}" ${String(o.test_type||'drug')===v?'selected':''}>${esc(v.replaceAll('_',' '))}</option>`).join('')}</select></label>
          <label><span>Collection Site</span><select name="collection_site_id" id="testSite"><option value="">Not assigned</option>${relevantSites.map(s=>`<option value="${esc(s.collection_site_id)}" ${o.collection_site_id===s.collection_site_id?'selected':''}>${esc(s.collection_sites?.name||'Collection Site')} · ${esc([s.collection_sites?.city,s.collection_sites?.state].filter(Boolean).join(', '))}</option>`).join('')}</select></label>
          <label><span>Collection Deadline</span><input name="collection_deadline" type="datetime-local" value="${o.collection_deadline?new Date(o.collection_deadline).toISOString().slice(0,16):''}"></label>
          <label><span>Testing Panel</span><input name="testing_panel" value="${esc(o.testing_panel||o.programs?.testing_panel||'')}"></label>
          <label><span>Collection Method</span><select name="collection_type"><option value="">Program Default</option><option value="urine" ${String(o.collection_type||'').toLowerCase()==='urine'?'selected':''}>Urine</option><option value="oral_fluid" ${['oral_fluid','oral fluid'].includes(String(o.collection_type||'').toLowerCase())?'selected':''}>Oral Fluid</option></select></label>
          ${editing?`<label><span>Status</span><select name="status">${statuses.map(v=>`<option value="${v}" ${o.status===v?'selected':''}>${esc(v.replaceAll('_',' '))}</option>`).join('')}</select></label>`:''}
        </div>
        <div class="management-actions"><button class="btn btn-outline" type="button" id="closeCtpaTestingPanel">Close</button>${w.can_manage?`<button class="btn btn-orange">${editing?'Save Testing Order':'Create Testing Order'}</button>`:''}</div></form>`;
        wireRenderedPage();

        const f=$('#ctpaTestingForm'),employerSelect=$('#testEmployer'),employeeSelect=$('#testEmployee'),programSelect=$('#testProgram'),siteSelect=$('#testSite');
        const rebuild=()=>{
          if(locked)return;
          const eid=employerSelect.value,es=employees.filter(x=>x.employer_id===eid),ps=programs.filter(x=>x.employer_id===eid),ss=sites.filter(x=>x.employer_id===eid);
          const ev=employeeSelect.value,pv=programSelect.value,sv=siteSelect.value;
          employeeSelect.innerHTML='<option value="">Choose employee</option>'+es.map(e=>`<option value="${esc(e.id)}">${esc(`${e.first_name||''} ${e.last_name||''}`.trim())}</option>`).join('');
          programSelect.innerHTML='<option value="">Choose program</option>'+ps.map(p=>`<option value="${esc(p.id)}">${esc(p.name)} · ${esc(p.program_type)}${p.dot_agency?` · ${esc(p.dot_agency)}`:''}</option>`).join('');
          siteSelect.innerHTML='<option value="">Not assigned</option>'+ss.map(s=>`<option value="${esc(s.collection_site_id)}">${esc(s.collection_sites?.name||'Collection Site')} · ${esc([s.collection_sites?.city,s.collection_sites?.state].filter(Boolean).join(', '))}</option>`).join('');
          if(es.some(x=>x.id===ev))employeeSelect.value=ev;if(ps.some(x=>x.id===pv))programSelect.value=pv;if(ss.some(x=>x.collection_site_id===sv))siteSelect.value=sv;
        };
        if(employerSelect)employerSelect.onchange=rebuild;
        $('#closeCtpaTestingPanel').onclick=()=>panel.style.display='none';
        if(w.can_manage)f.onsubmit=async ev=>{
          ev.preventDefault();
          try{
            const obj=Object.fromEntries(new FormData(f).entries());
            if(locked){obj.employer_id=o.employer_id;obj.employee_id=o.employee_id;obj.program_id=o.program_id;obj.reason=o.reason;obj.test_type=o.test_type}
            status(editing?'Saving testing order…':'Creating testing order…');
            if(editing){
              const newStatus=obj.status;delete obj.status;
              await testingApi({action:'save',test:obj});
              if(newStatus&&newStatus!==o.status)await testingApi({action:'update_status',test:{id:o.id,status:newStatus}});
              status('Testing order updated.');
            }else{
              await testingApi({action:'create',test:obj});status('Testing order created.');
            }
            w=await testingApi({action:'workspace'});draw();
          }catch(e){status(e.message,'error')}
        };
        panel.scrollIntoView({behavior:'smooth',block:'center'});
      };

      $('#addCtpaTestingOrder')?.addEventListener('click',()=>renderForm({reason:'pre_employment',test_type:'drug',status:'created'}));
      document.querySelectorAll('[data-manage-testing-order]').forEach(btn=>btn.onclick=()=>renderForm(orders.find(x=>x.id===btn.dataset.manageTestingOrder)||{}));
    };
    draw();
  }catch(e){c.innerHTML=head('Testing Orders','Unable to load C/TPA testing orders.')+`<div class="saas-notice">${esc(e.message)}</div>`}
}

async function renderResultsMro(){
  const c=$('.content');if(!c)return;
  c.innerHTML=head('Results / MRO','Loading C/TPA results workspace…');
  try{
    let w=await resultsApi({action:'workspace'});
    const draw=()=>{
      const employers=w.employers||[],orders=w.orders||[],results=w.results||[],reports=w.reports||[],mros=w.mros||[],labs=w.laboratories||[],docs=w.documents||[];
      const empMap=new Map(employers.map(x=>[x.id,x])),resultByOrder=new Map(),reportByOrder=new Map();
      results.forEach(x=>{if(!resultByOrder.has(x.testing_order_id))resultByOrder.set(x.testing_order_id,x)});
      reports.forEach(x=>{if(!reportByOrder.has(x.testing_order_id))reportByOrder.set(x.testing_order_id,x)});
      const eligible=orders.filter(x=>['collected','laboratory','mro_review','final_result'].includes(x.status));
      const pendingMro=results.filter(x=>['pending_assignment','pending_review'].includes(x.mro_status)).length;
      const final=results.filter(x=>x.final_status&&!['pending','mro_pending'].includes(x.final_status)).length;
      const sensitiveText=w.can_sensitive?'Sensitive MRO access enabled':'Summary-only access';

      c.innerHTML=head('Results / MRO','Review verified result summaries across Employer clients. Sensitive MRO workflow is restricted to authorized C/TPA Administrators.',`<a class="btn btn-outline" href="testing-orders.html">Testing Orders</a>${w.can_manage?'<button class="btn btn-orange" id="recordCtpaResult" type="button">Record Result</button>':''}`)
      +`<section class="metrics">
        <article class="metric-card"><div class="metric-label">Result Records</div><div class="metric-value">${results.length}</div><div class="metric-note">Across client Employers</div></article>
        <article class="metric-card"><div class="metric-label">Finalized</div><div class="metric-value">${final}</div><div class="metric-note">Verified outcomes</div></article>
        <article class="metric-card"><div class="metric-label">MRO Pending</div><div class="metric-value">${pendingMro}</div><div class="metric-note">Assignment / review</div></article>
        <article class="metric-card"><div class="metric-label">Access</div><div class="metric-value" style="font-size:18px">${sensitiveText}</div><div class="metric-note">Role + subscription enforced</div></article>
      </section>
      <div class="saas-notice"><strong>Privacy control:</strong> C/TPA Staff receive result summaries only. MRO identity, sensitive source documents, specimen details, and result-management controls are returned only when the account has Sensitive Results enabled and the signed-in role has <code>results.sensitive</code>.</div>
      ${w.can_manage&&mros.length===0?'<div class="saas-notice"><strong>MRO configuration needed:</strong> none of the assigned Employer clients currently has an active Employer-MRO assignment. Drug results can be recorded preliminarily, but a qualifying drug result cannot be finalized until an active MRO is assigned to that Employer.</div>':''}
      <section class="card" style="margin-top:18px"><div class="card-head"><div><h2>Results & Verified Reports</h2><span>Testing-order result state, MRO workflow, and screenings4u Result Reports.</span></div></div><div class="card-body">
      ${table(['Date','Employer','Order','Employee / Driver','Test','Preliminary','MRO','Final','Report','Actions'],eligible.map(o=>{
        const r=resultByOrder.get(o.id),rp=reportByOrder.get(o.id),mroName=w.can_sensitive?(r?.mros?.name||'—'):(r?.mro_status?String(r.mro_status).replaceAll('_',' '):'—');
        return `<tr>
          <td>${fmt(r?.result_date||o.created_at)}</td><td>${esc(empMap.get(o.employer_id)?.legal_name||'—')}</td>
          <td><strong>${esc(o.order_number)}</strong><br><small>${esc(String(o.reason||'').replaceAll('_',' '))}</small></td>
          <td>${esc(`${o.employees?.first_name||''} ${o.employees?.last_name||''}`.trim())}<br><small>${esc(o.employees?.employee_number||'')}</small></td>
          <td>${esc(String(o.test_type||'').replaceAll('_',' '))}</td><td>${esc(r?.preliminary_status||'—')}</td><td>${esc(mroName)}</td><td><strong>${esc(r?.final_status||'—')}</strong></td>
          <td>${rp?`<a class="org-action" target="_blank" href="../result-report.html?mode=ctpa&report=${encodeURIComponent(rp.id)}${new URLSearchParams(location.search).get('ctpa')?`&ctpa=${encodeURIComponent(new URLSearchParams(location.search).get('ctpa'))}`:''}">View Report</a>`:'—'}</td>
          <td><button class="org-action" type="button" data-manage-ctpa-result="${esc(o.id)}">${w.can_manage?'Manage':'View'}</button></td>
        </tr>`;
      }).join(''),'No collected testing orders or result records.')}</div></section>
      <section id="ctpaResultPanel" class="card" style="display:none;margin-top:18px"><div class="card-body" id="ctpaResultPanelBody"></div></section>`;
      wireRenderedPage();

      const panel=$('#ctpaResultPanel'),body=$('#ctpaResultPanelBody');
      const show=(orderId='')=>{
        const o=orderId?orders.find(x=>x.id===orderId):null;
        if(!o){
          const choices=orders.filter(x=>['collected','laboratory','mro_review'].includes(x.status)&&!resultByOrder.get(x.id)?.finalized_at);
          panel.style.display='block';body.innerHTML=`<div class="management-section-head"><div><h3>Record Result</h3><p>Choose a collected testing order. Result entry is never allowed against an order outside this C/TPA's assigned Employers.</p></div></div><label><span>Testing Order</span><select id="chooseCtpaResultOrder"><option value="">Choose testing order</option>${choices.map(x=>`<option value="${esc(x.id)}">${esc(empMap.get(x.employer_id)?.legal_name||'Employer')} · ${esc(x.order_number)} · ${esc(`${x.employees?.first_name||''} ${x.employees?.last_name||''}`.trim())}</option>`).join('')}</select></label><div class="management-actions"><button class="btn btn-outline" id="closeCtpaResultPanel" type="button">Close</button><button class="btn btn-orange" id="continueCtpaResult" type="button">Continue</button></div>`;
          wireRenderedPage();$('#closeCtpaResultPanel').onclick=()=>panel.style.display='none';$('#continueCtpaResult').onclick=()=>{const id=$('#chooseCtpaResultOrder').value;if(!id)return status('Choose a collected testing order.','error');show(id)};panel.scrollIntoView({behavior:'smooth',block:'center'});return;
        }
        const r=resultByOrder.get(o.id),rp=reportByOrder.get(o.id),employerMros=mros.filter(x=>x.employer_id===o.employer_id&&x.mros?.status==='active'),orderDocs=docs.filter(x=>x.testing_order_id===o.id);
        const finalized=!!r?.finalized_at;
        panel.style.display='block';
        body.innerHTML=`<div class="management-section-head"><div><h3>${esc(o.order_number)} · ${esc(`${o.employees?.first_name||''} ${o.employees?.last_name||''}`.trim())}</h3><p>${esc(empMap.get(o.employer_id)?.legal_name||'Employer')} · ${esc(String(o.test_type||'').replaceAll('_',' '))} · ${esc(String(o.status||'').replaceAll('_',' '))}</p></div></div>
        ${!w.can_manage?`<div class="saas-notice">Summary-only view. Sensitive MRO identity and source documents are not exposed to this role.</div>`:''}
        ${w.can_manage?`<form id="ctpaPreliminaryForm" class="saas-form"><div class="saas-form-grid">
          <label><span>Preliminary Status</span><select name="preliminary_status">${['pending','negative','positive','cancelled','invalid','refusal','mro_pending'].map(v=>`<option value="${v}" ${String(r?.preliminary_status||'pending')===v?'selected':''}>${esc(v.replaceAll('_',' '))}</option>`).join('')}</select></label>
          <label><span>Laboratory</span><select name="laboratory_id"><option value="">Not assigned</option>${labs.map(l=>`<option value="${esc(l.id)}" ${r?.laboratory_id===l.id?'selected':''}>${esc(l.name)}</option>`).join('')}</select></label>
          <label><span>Specimen ID</span><input name="specimen_external_id"></label><label><span>Specimen Type</span><input name="specimen_type" value="${esc(o.collection_type||'')}"></label>
          <label><span>Result Date</span><input name="result_date" type="datetime-local" value="${r?.result_date?new Date(r.result_date).toISOString().slice(0,16):''}"></label>
          <label style="grid-column:1/-1"><span>Laboratory Notes</span><textarea name="lab_notes" rows="3"></textarea></label>
        </div><div class="management-actions"><button class="btn btn-outline" id="closeCtpaResultPanel" type="button">Close</button>${!finalized?'<button class="btn btn-orange">Save Preliminary Result</button>':''}</div></form>
        <section class="admin-inline-editor" style="margin-top:18px"><div class="management-section-head"><div><h3>MRO Review & Finalization</h3><p>Drug results that require MRO review can only use an active MRO assigned to this Employer.</p></div></div>
          <div class="saas-form-grid"><label><span>Employer MRO</span><select id="ctpaResultMro"><option value="">Choose MRO</option>${employerMros.map(x=>`<option value="${esc(x.mro_id)}" ${r?.mro_id===x.mro_id?'selected':''}>${esc(x.mros?.name||'MRO')} · ${esc(x.mros?.license_number||'')}</option>`).join('')}</select></label>
          <label><span>Final Outcome</span><select id="ctpaFinalStatus">${['negative','positive','cancelled','invalid','refusal'].map(v=>`<option value="${v}" ${r?.final_status===v?'selected':''}>${esc(v)}</option>`).join('')}</select></label></div>
          <div class="management-actions">${r&&!finalized&&['drug','drug_and_alcohol'].includes(o.test_type)?'<button class="btn btn-outline" id="assignCtpaMro" type="button">Assign MRO</button>':''}${r&&!finalized?'<button class="btn btn-orange" id="finalizeCtpaResult" type="button">Finalize Result</button>':''}</div>
        </section>
        <section class="admin-inline-editor" style="margin-top:18px"><div class="management-section-head"><div><h3>Official MRO / Laboratory Source Document</h3><p>Sensitive documents stay in the private workforce-documents bucket and are opened only through short-lived signed URLs.</p></div></div>
          ${!finalized?'<input id="ctpaResultSourceFile" type="file" accept="application/pdf,image/png,image/jpeg">':''}
          <div style="margin-top:12px">${orderDocs.length?orderDocs.map(d=>`<button class="org-action" data-open-result-doc="${esc(d.id)}" type="button">${esc(d.file_name)}</button>`).join(' '):'<span class="saas-empty">No official source document registered.</span>'}</div>
        </section>`:`<div class="feature-grid"><div class="feature-row"><div><strong>Preliminary</strong><span>${esc(r?.preliminary_status||'—')}</span></div></div><div class="feature-row"><div><strong>MRO Status</strong><span>${esc(String(r?.mro_status||'—').replaceAll('_',' '))}</span></div></div><div class="feature-row"><div><strong>Final Outcome</strong><span>${esc(r?.final_status||'—')}</span></div></div><div class="feature-row"><div><strong>Finalized</strong><span>${fmt(r?.finalized_at)}</span></div></div></div>`}
        ${rp?`<div class="management-actions" style="margin-top:18px"><a class="btn btn-outline" target="_blank" href="../result-report.html?mode=ctpa&report=${encodeURIComponent(rp.id)}${new URLSearchParams(location.search).get('ctpa')?`&ctpa=${encodeURIComponent(new URLSearchParams(location.search).get('ctpa'))}`:''}">View screenings4u Result Report</a></div>`:''}`;
        wireRenderedPage();
        $('#closeCtpaResultPanel')?.addEventListener('click',()=>panel.style.display='none');
        $('#ctpaPreliminaryForm')?.addEventListener('submit',async ev=>{ev.preventDefault();try{const x=Object.fromEntries(new FormData(ev.currentTarget).entries());x.testing_order_id=o.id;status('Saving preliminary result…');await resultsApi({action:'save_preliminary',result:x});w=await resultsApi({action:'workspace'});status('Preliminary result saved.');draw()}catch(e){status(e.message,'error')}});
        $('#assignCtpaMro')?.addEventListener('click',async()=>{const mid=$('#ctpaResultMro').value;if(!mid)return status('Choose an active Employer MRO.','error');try{status('Assigning MRO…');await resultsApi({action:'assign_mro',result_id:r.id,mro_id:mid});w=await resultsApi({action:'workspace'});status('MRO assigned.');draw()}catch(e){status(e.message,'error')}});
        document.querySelectorAll('[data-open-result-doc]').forEach(btn=>btn.onclick=async()=>{try{const x=await resultsApi({action:'signed_document',document_id:btn.dataset.openResultDoc});window.open(x.url,'_blank','noopener')}catch(e){status(e.message,'error')}});
        $('#finalizeCtpaResult')?.addEventListener('click',async()=>{
          if(!r)return status('Save a preliminary result before finalizing.','error');
          if(!window.confirm('Finalize this verified result? Finalized results are locked and the Employer will receive an in-app result notification.'))return;
          const file=$('#ctpaResultSourceFile')?.files?.[0];let docId=orderDocs[0]?.id||null;
          try{
            if(file){if(file.size>10*1024*1024)throw new Error('Source document must be 10 MB or smaller.');if(!['application/pdf','image/png','image/jpeg'].includes(file.type))throw new Error('Upload a PDF, PNG, or JPG source document.');status('Uploading official source document…');const ticket=await resultsApi({action:'create_upload',document:{testing_order_id:o.id,file_name:file.name}});const up=await supabase.storage.from(ticket.bucket).uploadToSignedUrl(ticket.path,ticket.token,file,{contentType:file.type});if(up.error)throw up.error;try{const reg=await resultsApi({action:'register_source_document',document:{testing_order_id:o.id,file_name:file.name,storage_bucket:ticket.bucket,storage_path:ticket.path,mime_type:file.type,size_bytes:file.size}});docId=reg.document.id}catch(err){await supabase.storage.from(ticket.bucket).remove([ticket.path]);throw err}}
            status('Finalizing verified result…');await resultsApi({action:'finalize_result',result_id:r.id,final_status:$('#ctpaFinalStatus').value,mro_id:$('#ctpaResultMro')?.value||null,official_mro_document_id:docId});w=await resultsApi({action:'workspace'});status('Verified result finalized and Employer notification queued.');draw();
          }catch(e){status(e.message,'error')}
        });
        panel.scrollIntoView({behavior:'smooth',block:'center'});
      };

      $('#recordCtpaResult')?.addEventListener('click',()=>show(''));
      document.querySelectorAll('[data-manage-ctpa-result]').forEach(btn=>btn.onclick=()=>show(btn.dataset.manageCtpaResult));
    };
    draw();
  }catch(e){c.innerHTML=head('Results / MRO','Unable to load C/TPA results.')+`<div class="saas-notice">${esc(e.message)}</div>`}
}

async function renderCompliance(){
  const c=$('.content');if(!c)return;
  c.innerHTML=head('Compliance','Loading C/TPA compliance workspace…');
  try{
    let w=await complianceApi({action:'workspace'});
    const draw=()=>{
      const employers=w.employers||[],cases=w.cases||[],tasks=w.tasks||[],saps=w.sap_cases||[],followups=w.follow_up_tests||[];
      const empMap=new Map(employers.map(x=>[x.id,x])),tasksByCase=new Map(),sapByCase=new Map();
      tasks.forEach(x=>{if(!tasksByCase.has(x.compliance_case_id))tasksByCase.set(x.compliance_case_id,[]);tasksByCase.get(x.compliance_case_id).push(x)});
      saps.forEach(x=>{if(!sapByCase.has(x.compliance_case_id))sapByCase.set(x.compliance_case_id,x)});
      const open=cases.filter(x=>!['resolved','closed'].includes(x.status)).length,critical=cases.filter(x=>x.priority==='critical'&&!['resolved','closed'].includes(x.status)).length;
      const fm=cases.filter(x=>x.clearinghouse_status).length,sapOpen=saps.filter(x=>!['completed','closed'].includes(x.status)).length;

      c.innerHTML=head('Compliance','Manage positive-result and refusal compliance cases across assigned Employer clients. DOT agency scope and sensitive SAP details are enforced server-side.',
        `<a class="btn btn-outline" href="results.html">Results</a><a class="btn btn-outline" href="rtd-follow-up.html">RTD / Follow-Up</a>${w.can_manage?'<button class="btn btn-orange" id="syncCtpaViolations" type="button">Sync Finalized Violations</button>':''}`)
      +`<section class="metrics">
        <article class="metric-card"><div class="metric-label">Compliance Cases</div><div class="metric-value">${cases.length}</div><div class="metric-note">${open} open / active</div></article>
        <article class="metric-card"><div class="metric-label">Critical</div><div class="metric-value">${critical}</div><div class="metric-note">Immediate attention</div></article>
        <article class="metric-card"><div class="metric-label">SAP / RTD Cases</div><div class="metric-value">${saps.length}</div><div class="metric-note">${sapOpen} still active</div></article>
        <article class="metric-card"><div class="metric-label">Clearinghouse Review</div><div class="metric-value">${fm}</div><div class="metric-note">FMCSA-scoped cases only</div></article>
      </section>
      <div class="saas-notice"><strong>Regulatory scope:</strong> FMCSA Clearinghouse fields are shown only for FMCSA DOT cases. Other DOT agencies remain DOT compliance cases without being mislabeled as FMCSA Clearinghouse events. Non-DOT cases are not automatically treated as federally mandated SAP/RTD cases.</div>
      ${w.can_sensitive?'':'<div class="saas-notice"><strong>Restricted details:</strong> your role can manage compliance tasks and case status, but SAP recommendations and other sensitive result details are not returned to this account.</div>'}
      <section class="card" style="margin-top:18px"><div class="card-head"><div><h2>Compliance Cases</h2><span>Finalized positive results and refusals, case tasks, and regulatory follow-up.</span></div></div><div class="card-body">
      ${table(['Case','Employer','Employee / Driver','Event','Program','Priority','Status','Tasks','SAP / RTD','Clearinghouse','Actions'],cases.map(x=>{
        const ts=tasksByCase.get(x.id)||[],sap=sapByCase.get(x.id),program=x.testing_orders?.programs;
        return `<tr>
          <td><strong>${esc(x.case_number||'—')}</strong><br><small>${fmt(x.opened_at)}</small></td>
          <td>${esc(empMap.get(x.employer_id)?.legal_name||'—')}</td>
          <td>${esc(`${x.employees?.first_name||''} ${x.employees?.last_name||''}`.trim())}<br><small>${esc(x.employees?.employee_number||'')}</small></td>
          <td>${esc(String(x.event_type||'').replaceAll('_',' '))}</td>
          <td>${esc(program?.name||'—')}<br><small>${esc(x.testing_orders?.program_type||'—')}${program?.dot_agency?` · ${esc(program.dot_agency)}`:''}</small></td>
          <td>${esc(x.priority)}</td><td>${esc(x.status)}</td><td>${ts.filter(t=>t.status!=='complete'&&t.status!=='cancelled').length}/${ts.length}</td>
          <td>${sap?esc(String(sap.return_to_duty_status||sap.status||'open').replaceAll('_',' ')):'—'}</td>
          <td>${x.clearinghouse_status?esc(String(x.clearinghouse_status).replaceAll('_',' ')):'—'}</td>
          <td><button class="org-action" type="button" data-manage-compliance="${esc(x.id)}">${w.can_manage?'Manage':'View'}</button></td>
        </tr>`;
      }).join(''),'No compliance cases. Use Sync Finalized Violations after positive/refusal results are finalized.')}</div></section>
      <section id="ctpaCompliancePanel" class="card" style="display:none;margin-top:18px"><div class="card-body" id="ctpaCompliancePanelBody"></div></section>`;
      wireRenderedPage();

      const panel=$('#ctpaCompliancePanel'),body=$('#ctpaCompliancePanelBody');

      const showCase=(id)=>{
        const x=cases.find(c=>c.id===id);if(!x)return;
        const ts=tasksByCase.get(x.id)||[],sap=sapByCase.get(x.id),program=x.testing_orders?.programs,isFmcsa=x.testing_orders?.program_type==='DOT'&&program?.dot_agency==='FMCSA';
        panel.style.display='block';
        body.innerHTML=`<div class="management-section-head"><div><h3>${esc(x.case_number)} · ${esc(`${x.employees?.first_name||''} ${x.employees?.last_name||''}`.trim())}</h3><p>${esc(empMap.get(x.employer_id)?.legal_name||'Employer')} · ${esc(String(x.event_type||'').replaceAll('_',' '))} · ${esc(x.testing_orders?.order_number||'')}</p></div></div>
        <form id="ctpaCaseForm" class="saas-form"><div class="saas-form-grid">
          <label><span>Case Status</span><select name="status">${['open','in_progress','pending','resolved','closed'].map(v=>`<option value="${v}" ${x.status===v?'selected':''}>${esc(v.replaceAll('_',' '))}</option>`).join('')}</select></label>
          <label><span>Priority</span><select name="priority">${['low','normal','high','critical'].map(v=>`<option value="${v}" ${x.priority===v?'selected':''}>${esc(v)}</option>`).join('')}</select></label>
          <label><span>Compliance Due</span><input name="compliance_due_at" type="datetime-local" value="${x.compliance_due_at?new Date(x.compliance_due_at).toISOString().slice(0,16):''}"></label>
          ${isFmcsa&&w.can_sensitive?`<label><span>FMCSA Clearinghouse Status</span><input name="clearinghouse_status" value="${esc(x.clearinghouse_status||'')}"></label><label><span>Reported At</span><input name="clearinghouse_reported_at" type="datetime-local" value="${x.clearinghouse_reported_at?new Date(x.clearinghouse_reported_at).toISOString().slice(0,16):''}"></label><label><span>Reference</span><input name="clearinghouse_reference" value="${esc(x.clearinghouse_reference||'')}"></label>`:''}
          <label style="grid-column:1/-1"><span>Resolution</span><textarea name="resolution" rows="3">${esc(x.resolution||'')}</textarea></label>
        </div><div class="management-actions"><button class="btn btn-outline" id="closeCtpaCompliancePanel" type="button">Close</button>${w.can_manage?'<button class="btn btn-orange">Save Case</button>':''}</div></form>
        <section class="admin-inline-editor" style="margin-top:18px"><div class="management-section-head"><div><h3>Compliance Tasks</h3><p>Operational tasks are separate from sensitive SAP recommendations.</p></div></div>
          ${table(['Task','Due','Status','Action'],ts.map(t=>`<tr><td><strong>${esc(t.title)}</strong><br><small>${esc(t.description||'')}</small></td><td>${fmt(t.due_at)}</td><td>${esc(t.status)}</td><td>${w.can_manage?`<button class="org-action" data-edit-compliance-task="${esc(t.id)}" type="button">Edit</button>`:'—'}</td></tr>`).join(''),'No compliance tasks.')}
          ${w.can_manage?`<form id="ctpaTaskForm" class="saas-form" style="margin-top:14px"><input type="hidden" name="id"><input type="hidden" name="compliance_case_id" value="${esc(x.id)}"><div class="saas-form-grid"><label><span>Task Title</span><input name="title" required></label><label><span>Status</span><select name="status">${['open','in_progress','complete','cancelled'].map(v=>`<option value="${v}">${esc(v.replaceAll('_',' '))}</option>`).join('')}</select></label><label><span>Due At</span><input name="due_at" type="datetime-local"></label><label style="grid-column:1/-1"><span>Description</span><textarea name="description" rows="2"></textarea></label></div><div class="management-actions"><button class="btn btn-outline" id="clearCtpaTask" type="button">Clear</button><button class="btn btn-orange">Save Task</button></div></form>`:''}
        </section>
        <section class="admin-inline-editor" style="margin-top:18px"><div class="management-section-head"><div><h3>SAP / Return-to-Duty</h3><p>${sap?'A SAP / RTD case is linked to this compliance event.':'No SAP / RTD case is currently linked.'}</p></div></div>
          ${sap?`<div class="feature-grid"><div class="feature-row"><div><strong>Status</strong><span>${esc(sap.status||'—')}</span></div></div><div class="feature-row"><div><strong>RTD Status</strong><span>${esc(String(sap.return_to_duty_status||'—').replaceAll('_',' '))}</span></div></div><div class="feature-row"><div><strong>Evaluation</strong><span>${fmt(sap.evaluation_date)}</span></div></div>${w.can_sensitive?`<div class="feature-row"><div><strong>SAP</strong><span>${esc(sap.organizations?.legal_name||'Not assigned')}</span></div></div>`:''}</div><div class="management-actions"><a class="btn btn-outline" href="rtd-follow-up.html">Open RTD / Follow-Up</a></div>`:`<div class="saas-notice">${x.testing_orders?.program_type==='DOT'?'DOT violations synced from finalized results automatically create the SAP case shell.':'Non-DOT SAP/RTD is not created automatically; applicable Employer policy or rules must be confirmed first.'}</div>`}
        </section>`;
        wireRenderedPage();

        $('#closeCtpaCompliancePanel').onclick=()=>panel.style.display='none';
        $('#ctpaCaseForm')?.addEventListener('submit',async ev=>{ev.preventDefault();try{const obj=Object.fromEntries(new FormData(ev.currentTarget).entries());obj.id=x.id;status('Saving compliance case…');await complianceApi({action:'save_case',case:obj});w=await complianceApi({action:'workspace'});status('Compliance case saved.');draw()}catch(e){status(e.message,'error')}});
        const tf=$('#ctpaTaskForm'),clearTask=()=>{if(!tf)return;tf.reset();tf.elements.id.value='';tf.elements.compliance_case_id.value=x.id};
        $('#clearCtpaTask')?.addEventListener('click',clearTask);
        document.querySelectorAll('[data-edit-compliance-task]').forEach(btn=>btn.onclick=()=>{const t=ts.find(q=>q.id===btn.dataset.editComplianceTask);if(!t||!tf)return;tf.elements.id.value=t.id;tf.elements.title.value=t.title||'';tf.elements.status.value=t.status||'open';tf.elements.due_at.value=t.due_at?new Date(t.due_at).toISOString().slice(0,16):'';tf.elements.description.value=t.description||''});
        tf?.addEventListener('submit',async ev=>{ev.preventDefault();try{status('Saving compliance task…');await complianceApi({action:'save_task',task:Object.fromEntries(new FormData(tf).entries())});w=await complianceApi({action:'workspace'});status('Compliance task saved.');draw()}catch(e){status(e.message,'error')}});
        panel.scrollIntoView({behavior:'smooth',block:'center'});
      };

      $('#syncCtpaViolations')?.addEventListener('click',async()=>{try{status('Syncing finalized positive results and refusals…');const r=await complianceApi({action:'sync_finalized_violations'});w=await complianceApi({action:'workspace'});status(`${r.created||0} compliance case(s) created; ${r.existing||0} already existed.`);draw()}catch(e){status(e.message,'error')}});
      document.querySelectorAll('[data-manage-compliance]').forEach(btn=>btn.onclick=()=>showCase(btn.dataset.manageCompliance));
    };
    draw();
  }catch(e){c.innerHTML=head('Compliance','Unable to load C/TPA compliance.')+`<div class="saas-notice">${esc(e.message)}</div>`}
}

async function renderRtdFollowUp(){
  const c=$('.content');if(!c)return;
  c.innerHTML=head('RTD / Follow-Up','Loading SAP / return-to-duty workflow…');
  try{
    let w=await complianceApi({action:'workspace'});
    const draw=()=>{
      const employers=w.employers||[],cases=w.cases||[],saps=w.sap_cases||[],followups=w.follow_up_tests||[],results=w.results||[];
      const empMap=new Map(employers.map(x=>[x.id,x])),caseMap=new Map(cases.map(x=>[x.id,x])),fusBySap=new Map();
      followups.forEach(x=>{if(!fusBySap.has(x.sap_case_id))fusBySap.set(x.sap_case_id,[]);fusBySap.get(x.sap_case_id).push(x)});
      const active=saps.filter(x=>!['completed','closed'].includes(x.status)).length,rtdPending=saps.filter(x=>['eligible_for_rtd_test','rtd_test_ordered','rtd_test_failed'].includes(x.return_to_duty_status)).length,fuActive=followups.filter(x=>!['completed','cancelled'].includes(x.status)).length;
      c.innerHTML=head('RTD / Follow-Up','Manage SAP evaluation, RTD eligibility, RTD testing and follow-up plans for C/TPA client Employers.',`<a class="btn btn-outline" href="compliance.html">Compliance Cases</a><a class="btn btn-outline" href="testing-orders.html">Testing Orders</a>`)
      +`<section class="metrics">
        <article class="metric-card"><div class="metric-label">SAP Cases</div><div class="metric-value">${saps.length}</div><div class="metric-note">${active} active</div></article>
        <article class="metric-card"><div class="metric-label">RTD Pending</div><div class="metric-value">${rtdPending}</div><div class="metric-note">Eligibility / order / failure</div></article>
        <article class="metric-card"><div class="metric-label">Follow-Up Active</div><div class="metric-value">${fuActive}</div><div class="metric-note">Outstanding requirements</div></article>
        <article class="metric-card"><div class="metric-label">Sensitive Access</div><div class="metric-value" style="font-size:18px">${w.can_sensitive?'Enabled':'Restricted'}</div><div class="metric-note">SAP details and release controls</div></article>
      </section>
      ${w.sap_organizations?.length===0&&w.can_sensitive?'<div class="saas-notice"><strong>No SAP organizations configured.</strong> SAP case tracking can continue, but a provider cannot be assigned until screenings4u Admin configures an active SAP organization.</div>':''}
      <div class="saas-notice"><strong>RTD safeguards:</strong> an RTD order cannot be created until a SAP evaluation date and recommendations are recorded and the SAP status is explicitly set to Eligible for RTD Test. A finalized negative RTD result is required before release. Positive/refusal follow-up results are treated as new violations, not completed follow-up tests.</div>
      <section class="card" style="margin-top:18px"><div class="card-head"><div><h2>SAP / RTD Cases</h2><span>Return-to-duty state and follow-up testing by Employer client.</span></div></div><div class="card-body">
      ${table(['Employer','Employee / Driver','Case','SAP','Evaluation','RTD Status','Follow-Up','Status','Actions'],saps.map(s=>{
        const cc=caseMap.get(s.compliance_case_id),fus=fusBySap.get(s.id)||[];
        return `<tr><td>${esc(empMap.get(cc?.employer_id)?.legal_name||'—')}</td><td>${esc(`${cc?.employees?.first_name||''} ${cc?.employees?.last_name||''}`.trim())}</td><td>${esc(cc?.case_number||'—')}</td><td>${w.can_sensitive?esc(s.organizations?.legal_name||'Unassigned'):'Restricted'}</td><td>${fmt(s.evaluation_date)}</td><td>${esc(String(s.return_to_duty_status||'—').replaceAll('_',' '))}</td><td>${fus.filter(x=>x.status==='completed').length}/${fus.length}</td><td>${esc(s.status)}</td><td><button class="org-action" data-manage-rtd="${esc(s.id)}" type="button">${w.can_sensitive?'Manage':'View'}</button></td></tr>`;
      }).join(''),'No SAP / RTD cases. Sync finalized DOT violations from Compliance first.')}</div></section>
      <section id="ctpaRtdPanel" class="card" style="display:none;margin-top:18px"><div class="card-body" id="ctpaRtdPanelBody"></div></section>`;
      wireRenderedPage();

      const panel=$('#ctpaRtdPanel'),body=$('#ctpaRtdPanelBody');

      const show=(id)=>{
        const s=saps.find(x=>x.id===id),cc=caseMap.get(s?.compliance_case_id);if(!s||!cc)return;
        const fus=fusBySap.get(s.id)||[],source=cc.testing_orders,program=source?.programs;
        panel.style.display='block';
        body.innerHTML=`<div class="management-section-head"><div><h3>${esc(cc.case_number)} · ${esc(`${cc.employees?.first_name||''} ${cc.employees?.last_name||''}`.trim())}</h3><p>${esc(empMap.get(cc.employer_id)?.legal_name||'Employer')} · ${esc(source?.program_type||'—')}${program?.dot_agency?` · ${esc(program.dot_agency)}`:''}</p></div></div>
        ${w.can_sensitive?`<form id="ctpaSapForm" class="saas-form"><input type="hidden" name="id" value="${esc(s.id)}"><input type="hidden" name="compliance_case_id" value="${esc(cc.id)}"><div class="saas-form-grid">
          <label><span>SAP Organization</span><select name="sap_organization_id"><option value="">Not assigned</option>${(w.sap_organizations||[]).map(o=>`<option value="${esc(o.id)}" ${s.sap_organization_id===o.id?'selected':''}>${esc(o.legal_name)}</option>`).join('')}</select></label>
          <label><span>Evaluation Date</span><input name="evaluation_date" type="date" value="${esc(s.evaluation_date||'')}"></label>
          <label><span>SAP Case Status</span><select name="status">${['open','in_progress','completed','closed'].map(v=>`<option value="${v}" ${s.status===v?'selected':''}>${esc(v.replaceAll('_',' '))}</option>`).join('')}</select></label>
          <label><span>RTD Status</span><select name="return_to_duty_status">${['sap_referral_required','sap_evaluation_scheduled','sap_evaluation_complete','eligible_for_rtd_test','rtd_test_ordered','rtd_test_passed','rtd_test_failed','follow_up_active','follow_up_complete','completed'].map(v=>`<option value="${v}" ${s.return_to_duty_status===v?'selected':''}>${esc(v.replaceAll('_',' '))}</option>`).join('')}</select></label>
          <label style="grid-column:1/-1"><span>SAP Recommendations *</span><textarea name="recommendations" rows="4">${esc(s.recommendations||'')}</textarea></label>
          <label><span>Follow-Up Plan Total Tests</span><input name="follow_up_total" type="number" min="0" step="1" value="${esc(String(s.follow_up_plan?.total_tests??''))}"></label>
          <label><span>Follow-Up Plan Months</span><input name="follow_up_months" type="number" min="0" step="1" value="${esc(String(s.follow_up_plan?.months??''))}"></label>
        </div><div class="management-actions"><button class="btn btn-outline" id="closeCtpaRtdPanel" type="button">Close</button><button class="btn btn-orange">Save SAP / RTD</button></div></form>
        <div class="management-actions" style="margin-top:14px"><button class="btn btn-outline" id="syncCtpaRtd" type="button">Sync Results</button><button class="btn btn-outline" id="createCtpaRtdOrder" type="button">Create RTD Order</button><button class="btn btn-orange" id="releaseCtpaRtd" type="button">Release to Duty</button></div>`:`<div class="saas-notice">SAP recommendations, provider details, and RTD release controls are restricted to a C/TPA Administrator with Sensitive Results access.</div><div class="feature-grid"><div class="feature-row"><div><strong>Evaluation</strong><span>${fmt(s.evaluation_date)}</span></div></div><div class="feature-row"><div><strong>RTD Status</strong><span>${esc(String(s.return_to_duty_status||'—').replaceAll('_',' '))}</span></div></div><div class="feature-row"><div><strong>Follow-Up Plan</strong><span>${s.follow_up_plan?.configured?'Configured':'Not disclosed'}</span></div></div></div>`}
        <section class="admin-inline-editor" style="margin-top:18px"><div class="management-section-head"><div><h3>Follow-Up Testing</h3><p>Follow-up requirements create regular Testing Orders with reason = follow_up. Positive/refusal results remain violations and are never counted as completed follow-up tests.</p></div></div>
          ${table(['Sequence','Required By','Testing Order','Order Status','Status','Action'],fus.map(f=>`<tr><td>${f.sequence_number}</td><td>${fmt(f.required_by)}</td><td>${esc(f.testing_orders?.order_number||'Not created')}</td><td>${esc(f.testing_orders?.status||'—')}</td><td>${esc(f.status)}</td><td>${w.can_sensitive?`<div class="row-actions"><button class="org-action" data-edit-follow-up="${esc(f.id)}" type="button">Edit</button>${!f.testing_order_id&&f.status!=='cancelled'?`<button class="org-action" data-order-follow-up="${esc(f.id)}" type="button">Create Order</button>`:''}</div>`:'—'}</td></tr>`).join(''),'No follow-up requirements defined.')}
          ${w.can_sensitive?`<form id="ctpaFollowUpForm" class="saas-form" style="margin-top:14px"><input type="hidden" name="id"><input type="hidden" name="sap_case_id" value="${esc(s.id)}"><div class="saas-form-grid"><label><span>Sequence #</span><input name="sequence_number" type="number" min="1" step="1" required></label><label><span>Required By</span><input name="required_by" type="date"></label><label><span>Status</span><select name="status">${['required','ordered','completed','cancelled'].map(v=>`<option value="${v}">${esc(v)}</option>`).join('')}</select></label></div><div class="management-actions"><button class="btn btn-outline" id="clearCtpaFollowUp" type="button">Clear</button><button class="btn btn-orange">Save Follow-Up Requirement</button></div></form>`:''}
        </section>`;
        wireRenderedPage();

        $('#closeCtpaRtdPanel')?.addEventListener('click',()=>panel.style.display='none');
        $('#ctpaSapForm')?.addEventListener('submit',async ev=>{ev.preventDefault();try{const obj=Object.fromEntries(new FormData(ev.currentTarget).entries());obj.follow_up_plan={total_tests:obj.follow_up_total===''?null:Number(obj.follow_up_total),months:obj.follow_up_months===''?null:Number(obj.follow_up_months)};delete obj.follow_up_total;delete obj.follow_up_months;status('Saving SAP / RTD case…');await complianceApi({action:'save_sap',sap:obj});w=await complianceApi({action:'workspace'});status('SAP / RTD case saved.');draw()}catch(e){status(e.message,'error')}});
        $('#syncCtpaRtd')?.addEventListener('click',async()=>{try{status('Syncing RTD and follow-up results…');const r=await complianceApi({action:'sync_workflow',sap_case_id:s.id});w=await complianceApi({action:'workspace'});status(`${r.follow_up_completed||0}/${r.follow_up_total||0} follow-up tests complete${r.follow_up_violations?`; ${r.follow_up_violations} violation(s) require review`:''}.`,r.follow_up_violations?'error':'success');draw()}catch(e){status(e.message,'error')}});
        $('#createCtpaRtdOrder')?.addEventListener('click',async()=>{try{status('Creating return-to-duty testing order…');const r=await complianceApi({action:'create_rtd_order',sap_case_id:s.id});w=await complianceApi({action:'workspace'});status(r.already_exists?'An active RTD order already exists.':'Return-to-duty testing order created.');draw()}catch(e){status(e.message,'error')}});
        $('#releaseCtpaRtd')?.addEventListener('click',async()=>{if(!window.confirm('Release this employee / driver to duty? A finalized negative RTD result is required, and unresolved follow-up violations block release.'))return;try{status('Validating RTD release…');await complianceApi({action:'release_to_duty',sap_case_id:s.id});w=await complianceApi({action:'workspace'});status('Return-to-duty release recorded.');draw()}catch(e){status(e.message,'error')}});
        const ff=$('#ctpaFollowUpForm'),clearFu=()=>{if(!ff)return;ff.reset();ff.elements.id.value='';ff.elements.sap_case_id.value=s.id};
        $('#clearCtpaFollowUp')?.addEventListener('click',clearFu);
        document.querySelectorAll('[data-edit-follow-up]').forEach(btn=>btn.onclick=()=>{const f=fus.find(x=>x.id===btn.dataset.editFollowUp);if(!f||!ff)return;ff.elements.id.value=f.id;ff.elements.sequence_number.value=f.sequence_number;ff.elements.required_by.value=f.required_by||'';ff.elements.status.value=f.status||'required'});
        ff?.addEventListener('submit',async ev=>{ev.preventDefault();try{status('Saving follow-up requirement…');await complianceApi({action:'save_follow_up',follow_up:Object.fromEntries(new FormData(ff).entries())});w=await complianceApi({action:'workspace'});status('Follow-up requirement saved.');draw()}catch(e){status(e.message,'error')}});
        document.querySelectorAll('[data-order-follow-up]').forEach(btn=>btn.onclick=async()=>{try{status('Creating follow-up testing order…');const r=await complianceApi({action:'create_follow_up_order',follow_up_test_id:btn.dataset.orderFollowUp});w=await complianceApi({action:'workspace'});status(r.already_exists?'Follow-up order already exists.':'Follow-up testing order created.');draw()}catch(e){status(e.message,'error')}});
        panel.scrollIntoView({behavior:'smooth',block:'center'});
      };

      document.querySelectorAll('[data-manage-rtd]').forEach(btn=>btn.onclick=()=>show(btn.dataset.manageRtd));
    };
    draw();
  }catch(e){c.innerHTML=head('RTD / Follow-Up','Unable to load SAP / RTD workflow.')+`<div class="saas-notice">${esc(e.message)}</div>`}
}

async function renderDocuments(){
  const c=$('.content');if(!c)return;
  c.innerHTML=head('Documents & Compliance Records','Loading C/TPA document workspace…');
  try{
    let w=await documentsApi({action:'workspace'});
    const draw=()=>{
      const employers=w.employers||[],docs=w.documents||[],links=w.links||[],employees=w.employees||[],programs=w.programs||[],orders=w.testing_orders||[],cases=w.compliance_cases||[];
      const empMap=new Map(employers.map(x=>[x.id,x])),linksByDoc=new Map();
      links.forEach(x=>{if(!linksByDoc.has(x.document_id))linksByDoc.set(x.document_id,[]);linksByDoc.get(x.document_id).push(x)});
      const restricted=docs.filter(x=>x.access_level==='restricted').length,sensitive=docs.filter(x=>x.access_level==='sensitive').length,expiring=docs.filter(x=>x.expires_at&&new Date(x.expires_at).getTime()>Date.now()&&new Date(x.expires_at).getTime()<=Date.now()+30*86400000).length,holds=docs.filter(x=>x.legal_hold).length;
      c.innerHTML=head('Documents & Compliance Records','Secure Employer documents, certificates, testing records, compliance records, retention controls, and linked record context.',w.can_manage?'<button class="btn btn-orange" id="uploadCtpaDocument" type="button">Upload Document</button>':'')
      +`<section class="metrics">
        <article class="metric-card"><div class="metric-label">Documents</div><div class="metric-value">${docs.length}</div><div class="metric-note">Across assigned Employers</div></article>
        <article class="metric-card"><div class="metric-label">Restricted / Sensitive</div><div class="metric-value">${restricted+sensitive}</div><div class="metric-note">${sensitive} sensitive visible to this role</div></article>
        <article class="metric-card"><div class="metric-label">Expiring ≤ 30 Days</div><div class="metric-value">${expiring}</div><div class="metric-note">Active document records</div></article>
        <article class="metric-card"><div class="metric-label">Legal Hold</div><div class="metric-value">${holds}</div><div class="metric-note">Archive blocked</div></article>
      </section>
      <div class="saas-notice"><strong>Privacy:</strong> C/TPA Staff can manage standard and restricted records because the current role has Documents Manage, but sensitive result documents are never returned unless the account also has Sensitive Results access. Files are stored in the private Workforce Documents bucket and opened through short-lived signed URLs.</div>
      <section class="card" style="margin-top:18px"><div class="card-head"><div><h2>Document Library</h2><span>Document metadata uses the existing documents schema; title and description are stored in metadata.</span></div></div><div class="card-body">
      ${table(['Document','Employer','Type','Access','Linked Records','Uploaded','Expires','Retention / Hold','Actions'],docs.map(d=>{
        const ls=linksByDoc.get(d.id)||[];
        const linked=ls.length?ls.map(l=>`${String(l.target_type||'').replaceAll('_',' ')}: ${targetLabel(d.employer_id,l.target_type,l.target_id)}`).join(' · '):directLabel(d);
        return `<tr>
          <td><strong>${esc(d.metadata?.title||d.file_name)}</strong><br><small>${esc(d.file_name)}</small>${d.metadata?.description?`<br><small>${esc(d.metadata.description)}</small>`:''}</td>
          <td>${esc(empMap.get(d.employer_id)?.legal_name||'—')}</td><td>${esc(String(d.document_type||'other').replaceAll('_',' '))}</td><td>${esc(d.access_level)}</td>
          <td>${esc(linked||'—')}</td><td>${fmt(d.uploaded_at)}</td><td>${fmt(d.expires_at)}</td>
          <td>${d.legal_hold?'Legal hold':d.retention_until?`Retain until ${fmt(d.retention_until)}`:'—'}</td>
          <td><div class="row-actions"><button class="org-action" type="button" data-open-ctpa-document="${esc(d.id)}">Open</button>${w.can_manage?`<button class="org-action" type="button" data-edit-ctpa-document="${esc(d.id)}">Manage</button>`:''}</div></td>
        </tr>`;
      }).join(''),'No documents across assigned Employer clients.')}</div></section>
      <section id="ctpaDocumentPanel" class="card" style="display:none;margin-top:18px"><div class="card-body" id="ctpaDocumentPanelBody"></div></section>`;
      wireRenderedPage();

      const panel=$('#ctpaDocumentPanel'),body=$('#ctpaDocumentPanelBody');
      function targetLabel(employerId,type,id){
        if(type==='employee'){const x=employees.find(q=>q.id===id&&q.employer_id===employerId);return x?`${x.first_name||''} ${x.last_name||''}`.trim():id}
        if(type==='program')return programs.find(q=>q.id===id&&q.employer_id===employerId)?.name||id;
        if(type==='testing_order')return orders.find(q=>q.id===id&&q.employer_id===employerId)?.order_number||id;
        if(type==='compliance_case')return cases.find(q=>q.id===id&&q.employer_id===employerId)?.case_number||id;
        return id;
      }
      function directLabel(d){if(d.employee_id)return `employee: ${targetLabel(d.employer_id,'employee',d.employee_id)}`;if(d.program_id)return `program: ${targetLabel(d.employer_id,'program',d.program_id)}`;if(d.testing_order_id)return `testing order: ${targetLabel(d.employer_id,'testing_order',d.testing_order_id)}`;if(d.compliance_case_id)return `compliance case: ${targetLabel(d.employer_id,'compliance_case',d.compliance_case_id)}`;return ''}
      const types=['consortium_certificate','policy','training_record','testing_record','collection_record','laboratory_record','mro_result','compliance_record','sap_record','return_to_duty','follow_up_record','driver_qualification','other'];
      const targetOptions=(employerId,type)=>{
        let rows=[];
        if(type==='employee')rows=employees.filter(x=>x.employer_id===employerId).map(x=>[x.id,`${x.first_name||''} ${x.last_name||''}`.trim()]);
        if(type==='program')rows=programs.filter(x=>x.employer_id===employerId).map(x=>[x.id,`${x.name} · ${x.program_type}`]);
        if(type==='testing_order')rows=orders.filter(x=>x.employer_id===employerId).map(x=>[x.id,`${x.order_number} · ${String(x.reason||'').replaceAll('_',' ')}`]);
        if(type==='compliance_case')rows=cases.filter(x=>x.employer_id===employerId).map(x=>[x.id,`${x.case_number} · ${String(x.event_type||'').replaceAll('_',' ')}`]);
        return rows;
      };

      const showUpload=()=>{
        panel.style.display='block';body.innerHTML=`<div class="management-section-head"><div><h3>Upload Employer Document</h3><p>Upload a PDF, PNG, or JPG up to 10 MB, then register it against the selected Employer and optional compliance record.</p></div></div>
          <form id="ctpaDocumentUploadForm" class="saas-form"><div class="saas-form-grid">
            <label><span>Employer *</span><select name="employer_id" id="docEmployer" required><option value="">Choose Employer</option>${employers.map(e=>`<option value="${esc(e.id)}">${esc(e.legal_name)}</option>`).join('')}</select></label>
            <label><span>Document Type *</span><select name="document_type">${types.map(v=>`<option value="${v}">${esc(v.replaceAll('_',' '))}</option>`).join('')}</select></label>
            <label><span>Title</span><input name="title"></label><label><span>Access Level</span><select name="access_level"><option value="standard">Standard</option><option value="restricted">Restricted</option>${w.can_sensitive?'<option value="sensitive">Sensitive</option>':''}</select></label>
            <label><span>Linked Record Type</span><select name="target_type" id="docTargetType"><option value="">No initial link</option><option value="employee">Employee / Driver</option><option value="program">Program</option><option value="testing_order">Testing Order</option><option value="compliance_case">Compliance Case</option></select></label>
            <label><span>Linked Record</span><select name="target_id" id="docTarget"><option value="">Choose record</option></select></label>
            <label><span>Expires At</span><input name="expires_at" type="datetime-local"></label><label><span>Retention Until</span><input name="retention_until" type="datetime-local"></label>
            <label class="config-choice"><span>Legal Hold</span><input name="legal_hold" type="checkbox"></label>
            <label><span>File *</span><input name="file" type="file" accept="application/pdf,image/png,image/jpeg" required></label>
            <label style="grid-column:1/-1"><span>Description</span><textarea name="description" rows="3"></textarea></label>
          </div><div class="management-actions"><button class="btn btn-outline" id="closeCtpaDocumentPanel" type="button">Cancel</button><button class="btn btn-orange">Upload & Register</button></div></form>`;
        wireRenderedPage();const f=$('#ctpaDocumentUploadForm'),emp=$('#docEmployer'),tt=$('#docTargetType'),target=$('#docTarget');
        const rebuild=()=>{const rows=targetOptions(emp.value,tt.value);target.innerHTML='<option value="">Choose record</option>'+rows.map(([id,label])=>`<option value="${esc(id)}">${esc(label)}</option>`).join('')};emp.onchange=rebuild;tt.onchange=rebuild;
        $('#closeCtpaDocumentPanel').onclick=()=>panel.style.display='none';
        f.onsubmit=async ev=>{ev.preventDefault();const file=f.elements.file.files?.[0];if(!file)return status('Choose a file.','error');if(file.size>10*1024*1024)return status('Document must be 10 MB or smaller.','error');if(!['application/pdf','image/png','image/jpeg'].includes(file.type))return status('Upload a PDF, PNG, or JPG file.','error');const x=Object.fromEntries(new FormData(f).entries());delete x.file;x.legal_hold=f.elements.legal_hold.checked;let ticket=null;try{status('Preparing secure document upload…');ticket=await documentsApi({action:'create_upload',document:{employer_id:x.employer_id,file_name:file.name,mime_type:file.type,size_bytes:file.size,access_level:x.access_level}});const up=await supabase.storage.from(ticket.bucket).uploadToSignedUrl(ticket.path,ticket.token,file,{contentType:file.type});if(up.error)throw up.error;status('Registering document record…');await documentsApi({action:'register',document:{...x,file_name:file.name,mime_type:file.type,size_bytes:file.size,storage_path:ticket.path,storage_bucket:ticket.bucket}});w=await documentsApi({action:'workspace'});status('Document uploaded and registered.');draw()}catch(e){if(ticket?.path){try{await documentsApi({action:'discard_upload',employer_id:x.employer_id,storage_path:ticket.path})}catch{}}status(e.message,'error')}};
        panel.scrollIntoView({behavior:'smooth',block:'center'});
      };

      const showManage=(id)=>{
        const d=docs.find(x=>x.id===id);if(!d)return;const ls=linksByDoc.get(d.id)||[];
        panel.style.display='block';body.innerHTML=`<div class="management-section-head"><div><h3>${esc(d.metadata?.title||d.file_name)}</h3><p>${esc(empMap.get(d.employer_id)?.legal_name||'Employer')} · ${esc(d.file_name)}</p></div></div>
          <form id="ctpaDocumentEditForm" class="saas-form"><div class="saas-form-grid">
            <label><span>Document Type</span><select name="document_type">${types.map(v=>`<option value="${v}" ${d.document_type===v?'selected':''}>${esc(v.replaceAll('_',' '))}</option>`).join('')}</select></label>
            <label><span>Title</span><input name="title" value="${esc(d.metadata?.title||d.file_name)}"></label>
            <label><span>Access Level</span><select name="access_level"><option value="standard" ${d.access_level==='standard'?'selected':''}>Standard</option><option value="restricted" ${d.access_level==='restricted'?'selected':''}>Restricted</option>${w.can_sensitive?`<option value="sensitive" ${d.access_level==='sensitive'?'selected':''}>Sensitive</option>`:''}</select></label>
            <label><span>Expires At</span><input name="expires_at" type="datetime-local" value="${d.expires_at?new Date(d.expires_at).toISOString().slice(0,16):''}"></label>
            <label><span>Retention Until</span><input name="retention_until" type="datetime-local" value="${d.retention_until?new Date(d.retention_until).toISOString().slice(0,16):''}"></label>
            <label class="config-choice"><span>Legal Hold</span><input name="legal_hold" type="checkbox" ${d.legal_hold?'checked':''}></label>
            <label style="grid-column:1/-1"><span>Description</span><textarea name="description" rows="3">${esc(d.metadata?.description||'')}</textarea></label>
          </div><div class="management-actions"><button class="btn btn-outline" id="closeCtpaDocumentPanel" type="button">Close</button><button class="btn btn-outline" id="openCtpaDocumentFromPanel" type="button">Open File</button><button class="btn btn-orange">Save Metadata</button></div></form>
          <section class="admin-inline-editor" style="margin-top:18px"><div class="management-section-head"><div><h3>Linked Records</h3><p>A document can be linked to multiple Employer records. Direct document foreign keys stay synchronized with the first surviving link of each type.</p></div></div>
            ${table(['Type','Record','Linked','Action'],ls.map(l=>`<tr><td>${esc(String(l.target_type).replaceAll('_',' '))}</td><td>${esc(targetLabel(d.employer_id,l.target_type,l.target_id))}</td><td>${fmt(l.created_at)}</td><td><button class="org-action" data-unlink-ctpa-document="${esc(l.id)}" type="button">Unlink</button></td></tr>`).join(''),'No linked records.')}
            <form id="ctpaDocumentLinkForm" class="saas-form" style="margin-top:14px"><div class="saas-form-grid"><label><span>Target Type</span><select name="target_type" id="manageDocTargetType"><option value="employee">Employee / Driver</option><option value="program">Program</option><option value="testing_order">Testing Order</option><option value="compliance_case">Compliance Case</option></select></label><label><span>Target</span><select name="target_id" id="manageDocTarget"></select></label></div><div class="management-actions"><button class="btn btn-outline">Add Link</button></div></form>
          </section>
          <div class="management-actions" style="margin-top:18px"><button class="btn btn-outline" id="archiveCtpaDocument" type="button">Archive Document</button></div>`;
        wireRenderedPage();
        const ef=$('#ctpaDocumentEditForm'),lt=$('#manageDocTargetType'),lv=$('#manageDocTarget'),rebuild=()=>{lv.innerHTML=targetOptions(d.employer_id,lt.value).map(([id,label])=>`<option value="${esc(id)}">${esc(label)}</option>`).join('')};rebuild();lt.onchange=rebuild;
        $('#closeCtpaDocumentPanel').onclick=()=>panel.style.display='none';
        $('#openCtpaDocumentFromPanel').onclick=()=>openDocument(d.id);
        ef.onsubmit=async ev=>{ev.preventDefault();try{const x=Object.fromEntries(new FormData(ef).entries());x.id=d.id;x.legal_hold=ef.elements.legal_hold.checked;status('Saving document metadata…');await documentsApi({action:'update_document',document:x});w=await documentsApi({action:'workspace'});status('Document metadata saved.');draw()}catch(e){status(e.message,'error')}};
        $('#ctpaDocumentLinkForm').onsubmit=async ev=>{ev.preventDefault();if(!lv.value)return status('Choose a record to link.','error');try{await documentsApi({action:'link',document_id:d.id,target_type:lt.value,target_id:lv.value});w=await documentsApi({action:'workspace'});status('Document link added.');draw()}catch(e){status(e.message,'error')}};
        document.querySelectorAll('[data-unlink-ctpa-document]').forEach(btn=>btn.onclick=async()=>{if(!window.confirm('Remove this document link? The file and other links will remain.'))return;try{await documentsApi({action:'unlink',link_id:btn.dataset.unlinkCtpaDocument});w=await documentsApi({action:'workspace'});status('Document link removed.');draw()}catch(e){status(e.message,'error')}});
        $('#archiveCtpaDocument').onclick=async()=>{if(!window.confirm('Archive this document record? Legal hold and active retention periods prevent archival.'))return;try{await documentsApi({action:'archive',document_id:d.id});w=await documentsApi({action:'workspace'});status('Document archived.');draw()}catch(e){status(e.message,'error')}};
        panel.scrollIntoView({behavior:'smooth',block:'center'});
      };
      const openDocument=async id=>{try{status('Creating secure document link…');const r=await documentsApi({action:'signed_url',document_id:id});window.open(r.url,'_blank','noopener');status('Secure document link created.')}catch(e){status(e.message,'error')}};

      $('#uploadCtpaDocument')?.addEventListener('click',showUpload);
      document.querySelectorAll('[data-open-ctpa-document]').forEach(btn=>btn.onclick=()=>openDocument(btn.dataset.openCtpaDocument));
      document.querySelectorAll('[data-edit-ctpa-document]').forEach(btn=>btn.onclick=()=>showManage(btn.dataset.editCtpaDocument));
    };
    draw();
  }catch(e){c.innerHTML=head('Documents & Compliance Records','Unable to load C/TPA documents.')+`<div class="saas-notice">${esc(e.message)}</div>`}
}

async function renderNotificationsActionCenter(){
  const c=$('.content');if(!c)return;
  c.innerHTML=head('Notifications / Action Center','Loading C/TPA action center…');
  try{
    let w=await notificationsApi({action:'workspace'});
    const draw=()=>{
      const actions=w.actions||[],notifications=w.notifications||[],employers=w.employers||[],emMap=new Map(employers.map(x=>[x.id,x]));
      c.innerHTML=head('Notifications / Action Center','Prioritized operational work and notification history across assigned Employer clients.',
        `${w.can_queue?'<button class="btn btn-orange" id="queueCtpaNotice" type="button">Queue Employer Notice</button>':''}<a class="btn btn-outline" href="compliance.html">Compliance</a><a class="btn btn-outline" href="testing-orders.html">Testing Orders</a>`)
      +`<section class="metrics">
        <article class="metric-card"><div class="metric-label">Critical Actions</div><div class="metric-value">${w.counts?.critical||0}</div><div class="metric-note">Immediate attention</div></article>
        <article class="metric-card"><div class="metric-label">High Priority</div><div class="metric-value">${w.counts?.high||0}</div><div class="metric-note">Open action items</div></article>
        <article class="metric-card"><div class="metric-label">Queued Notices</div><div class="metric-value">${w.counts?.queued_notifications||0}</div><div class="metric-note">Queue status only</div></article>
        <article class="metric-card"><div class="metric-label">Failed Notices</div><div class="metric-value">${w.counts?.failed_notifications||0}</div><div class="metric-note">Delivery/workflow failures</div></article>
      </section>
      <div class="saas-notice"><strong>Notification status:</strong> a queued row means the notice entered the notification queue. It does not mean an email or in-app notice was delivered. Delivery is shown only when the stored notification status reaches sent/delivered.</div>
      ${w.can_sensitive?'':'<div class="saas-notice"><strong>Privacy:</strong> sensitive result/MRO notifications are filtered from this account because it does not have Sensitive Results access.</div>'}
      <section class="card" style="margin-top:18px"><div class="card-head"><div><h2>Action Center</h2><span>Testing, compliance, SAP/RTD, expiring records and notification failures.</span></div></div><div class="card-body">
      ${table(['Priority','Employer','Action','Details','Due','Status','Open'],actions.map(a=>`<tr>
        <td><span class="badge ${a.priority==='critical'?'danger':a.priority==='high'?'warning':'neutral'}">${esc(a.priority)}</span></td>
        <td>${esc(emMap.get(a.employer_id)?.legal_name||'C/TPA')}</td>
        <td><strong>${esc(a.title)}</strong><br><small>${esc(String(a.type||'').replaceAll('_',' '))}</small></td>
        <td>${esc(a.detail||'—')}</td><td>${fmt(a.due_at)}</td><td>${esc(String(a.status||'').replaceAll('_',' '))}</td>
        <td><a class="org-action" href="${esc(a.url||'#')}">Open</a></td>
      </tr>`).join(''),'No current action-center items.')}</div></section>
      <section class="card" style="margin-top:18px"><div class="card-head"><div><h2>Notification History</h2><span>Recent C/TPA and Employer-related notification queue activity.</span></div></div><div class="card-body">
      ${table(['Queued','Employer','Event','Channel','Recipient','Subject','Status','Actions'],notifications.map(n=>`<tr>
        <td>${fmt(n.queued_at)}</td><td>${esc(emMap.get(String(n.metadata?.employer_id||''))?.legal_name||'C/TPA')}</td>
        <td>${esc(String(n.event_type||'').replaceAll('_',' '))}</td><td>${esc(n.channel)}</td><td>${esc(n.recipient_address||n.recipient_user_id||'—')}</td>
        <td>${esc(n.subject||'—')}</td><td>${esc(n.status)}</td>
        <td>${w.can_queue&&n.status==='queued'&&String(n.metadata?.ctpa_id||'')===String(new URLSearchParams(location.search).get('ctpa')||w.ctpa_id||n.metadata?.ctpa_id||'')?`<button class="org-action" data-cancel-ctpa-notice="${esc(n.id)}" type="button">Cancel</button>`:'—'}</td>
      </tr>`).join(''),'No notification activity.')}</div></section>
      <section id="ctpaNotificationPanel" class="card" style="display:none;margin-top:18px"><div class="card-body" id="ctpaNotificationPanelBody"></div></section>`;
      wireRenderedPage();

      const panel=$('#ctpaNotificationPanel'),body=$('#ctpaNotificationPanelBody');
      $('#queueCtpaNotice')?.addEventListener('click',()=>{
        panel.style.display='block';
        body.innerHTML=`<div class="management-section-head"><div><h3>Queue Employer Notice</h3><p>This creates notification queue records. Email delivery depends on the configured notification delivery workflow.</p></div></div>
          <form id="ctpaNoticeForm" class="saas-form"><div class="saas-form-grid">
            <label><span>Employer *</span><select name="employer_id" required><option value="">Choose Employer</option>${employers.map(e=>`<option value="${esc(e.id)}">${esc(e.legal_name)}</option>`).join('')}</select></label>
            <label><span>Channel</span><select name="channel" id="ctpaNoticeChannel"><option value="in_app">In-App</option><option value="email">Email</option></select></label>
            <label><span>Recipients</span><select name="recipient_kind" id="ctpaNoticeRecipient"><option value="employer_admins">Employer Admins</option><option value="ders">DERs</option><option value="all_staff">All Employer Staff</option></select></label>
            <label><span>Subject *</span><input name="subject" maxlength="180" required></label>
            <label style="grid-column:1/-1"><span>Message *</span><textarea name="body" rows="5" maxlength="5000" required></textarea></label>
          </div><div class="management-actions"><button class="btn btn-outline" id="closeCtpaNotificationPanel" type="button">Cancel</button><button class="btn btn-orange">Queue Notice</button></div></form>`;
        wireRenderedPage();const f=$('#ctpaNoticeForm'),ch=$('#ctpaNoticeChannel'),rk=$('#ctpaNoticeRecipient');
        const rebuild=()=>{rk.innerHTML=ch.value==='email'?'<option value="primary">Primary Contact</option><option value="safety">Safety Contact</option><option value="hr">HR Contact</option><option value="billing">Billing Contact</option>':'<option value="employer_admins">Employer Admins</option><option value="ders">DERs</option><option value="all_staff">All Employer Staff</option>'};ch.onchange=rebuild;rebuild();
        $('#closeCtpaNotificationPanel').onclick=()=>panel.style.display='none';
        f.onsubmit=async ev=>{ev.preventDefault();try{status('Queueing Employer notice…');const notice=Object.fromEntries(new FormData(f).entries());const r=await notificationsApi({action:'queue_notice',notice});w=await notificationsApi({action:'workspace'});status(`${r.count||0} notification record(s) queued.`);draw()}catch(e){status(e.message,'error')}};
        panel.scrollIntoView({behavior:'smooth',block:'center'});
      });
      document.querySelectorAll('[data-cancel-ctpa-notice]').forEach(btn=>btn.onclick=async()=>{if(!window.confirm('Cancel this queued C/TPA notice?'))return;try{await notificationsApi({action:'cancel_notification',notification_id:btn.dataset.cancelCtpaNotice});w=await notificationsApi({action:'workspace'});status('Queued notification cancelled.');draw()}catch(e){status(e.message,'error')}});
    };
    draw();
  }catch(e){c.innerHTML=head('Notifications / Action Center','Unable to load notification workspace.')+`<div class="saas-notice">${esc(e.message)}</div>`}
}

function dateInputValue(d){const x=new Date(d);return Number.isNaN(x.getTime())?'':x.toISOString().slice(0,10)}
async function renderReportsAudit(){
  const c=$('.content');if(!c)return;
  const end=new Date(),start=new Date(end.getTime()-365*86400000);
  c.innerHTML=head('Reports / Audit Packet','Loading C/TPA reporting workspace…');
  try{
    let w=await reportingApi({action:'reports',start_date:dateInputValue(start),end_date:dateInputValue(end)});
    const draw=()=>{
      const s=w.summary||{},orders=w.testing_orders||[],cases=w.compliance_cases||[],sels=w.selections||[],docs=w.documents||[];
      c.innerHTML=head('Reports / Audit Packet','C/TPA-scoped operational reporting plus a server-generated compliance record packet.',
        `<button class="btn btn-orange" id="downloadCtpaPacket" type="button">Download Compliance Record Packet</button><a class="btn btn-outline" href="audit.html">Audit History</a>`)
      +`<section class="card"><div class="card-body"><form id="ctpaReportRange" class="saas-form"><div class="saas-form-grid">
        <label><span>Start Date</span><input name="start_date" type="date" value="${dateInputValue(w.range?.start||start)}"></label>
        <label><span>End Date</span><input name="end_date" type="date" value="${dateInputValue(w.range?.end||end)}"></label>
      </div><div class="management-actions"><button class="btn btn-outline">Run Reports</button></div></form></div></section>
      <div class="saas-notice"><strong>Count definitions:</strong> Employers, Employees / Drivers, and Programs are current counts. Testing Orders, finalized Results, Compliance Cases, Documents, Consortium Selections, and Audit Events are counts within the selected reporting period.</div>
      <section class="metrics">
        <article class="metric-card"><div class="metric-label">Current Employers</div><div class="metric-value">${s.current_employers||0}</div></article>
        <article class="metric-card"><div class="metric-label">Current Employees</div><div class="metric-value">${s.current_employees||0}</div></article>
        <article class="metric-card"><div class="metric-label">Current Programs</div><div class="metric-value">${s.current_programs||0}</div></article>
        <article class="metric-card"><div class="metric-label">Testing Orders · Period</div><div class="metric-value">${s.testing_orders||0}</div></article>
        <article class="metric-card"><div class="metric-label">Finalized Results · Period</div><div class="metric-value">${s.finalized_results||0}</div></article>
        <article class="metric-card"><div class="metric-label">Compliance Cases · Period</div><div class="metric-value">${s.compliance_cases||0}</div></article>
        <article class="metric-card"><div class="metric-label">Documents · Period</div><div class="metric-value">${s.documents||0}</div></article>
        <article class="metric-card"><div class="metric-label">Selections · Period</div><div class="metric-value">${s.selections||0}</div></article>
      </section>
      <section class="card" style="margin-top:18px"><div class="card-head"><div><h2>Testing Activity</h2><span>Orders created during the selected period.</span></div></div><div class="card-body">${table(['Created','Employer','Order','Employee / Driver','Reason','Test','Status'],orders.map(o=>`<tr><td>${fmt(o.created_at)}</td><td>${esc(o.employer_name||'—')}</td><td><strong>${esc(o.order_number)}</strong></td><td>${esc(`${o.employees?.first_name||''} ${o.employees?.last_name||''}`.trim())}</td><td>${esc(String(o.reason||'').replaceAll('_',' '))}</td><td>${esc(String(o.test_type||'').replaceAll('_',' '))}</td><td>${esc(o.status)}</td></tr>`).join(''),'No testing orders in this period.')}</div></section>
      <section class="card" style="margin-top:18px"><div class="card-head"><div><h2>Compliance Cases</h2><span>Cases opened during the selected period.</span></div></div><div class="card-body">${table(['Opened','Employer','Case','Employee / Driver','Event','Priority','Status'],cases.map(x=>`<tr><td>${fmt(x.opened_at)}</td><td>${esc(x.employer_name||'—')}</td><td>${esc(x.case_number)}</td><td>${esc(`${x.employees?.first_name||''} ${x.employees?.last_name||''}`.trim())}</td><td>${esc(String(x.event_type||'').replaceAll('_',' '))}</td><td>${esc(x.priority)}</td><td>${esc(x.status)}</td></tr>`).join(''),'No compliance cases in this period.')}</div></section>
      <section class="card" style="margin-top:18px"><div class="card-head"><div><h2>Consortium Selection History</h2><span>Server-locked C/TPA consortium selection events.</span></div></div><div class="card-body">${table(['Date','Pool','Population','Drug','Alcohol','Status'],sels.map(x=>`<tr><td>${fmt(x.selection_date)}</td><td>${esc(x.random_pools?.name||'Consortium Pool')}</td><td>${x.population_size||0}</td><td>${x.drug_selection_count||0}</td><td>${x.alcohol_selection_count||0}</td><td>${esc(x.status)}</td></tr>`).join(''),'No consortium selections in this period.')}</div></section>
      <section class="card" style="margin-top:18px"><div class="card-head"><div><h2>Document Activity</h2><span>Visible documents uploaded during the selected period.</span></div></div><div class="card-body">${table(['Uploaded','Employer','File','Type','Access','Legal Hold'],docs.map(x=>`<tr><td>${fmt(x.uploaded_at)}</td><td>${esc(x.employer_name||'—')}</td><td>${esc(x.file_name)}</td><td>${esc(String(x.document_type||'').replaceAll('_',' '))}</td><td>${esc(x.access_level)}</td><td>${x.legal_hold?'Yes':'No'}</td></tr>`).join(''),'No documents in this period.')}</div></section>`;
      wireRenderedPage();
      $('#ctpaReportRange').onsubmit=async ev=>{ev.preventDefault();try{const x=Object.fromEntries(new FormData(ev.currentTarget).entries());status('Running C/TPA reports…');w=await reportingApi({action:'reports',...x});status('Reports updated.');draw()}catch(e){status(e.message,'error')}};
      $('#downloadCtpaPacket').onclick=async()=>{const form=$('#ctpaReportRange'),x=form?Object.fromEntries(new FormData(form).entries()):{};try{status('Generating C/TPA compliance record packet…');const r=await reportingApi({action:'audit_packet',...x});downloadBase64File(r.base64,r.filename,r.mime_type);status('Compliance record packet generated.')}catch(e){status(e.message,'error')}};
    };
    draw();
  }catch(e){c.innerHTML=head('Reports / Audit Packet','Unable to load C/TPA reports.')+`<div class="saas-notice">${esc(e.message)}</div>`}
}

async function renderAuditHistory(){
  const c=$('.content');if(!c)return;
  const end=new Date(),start=new Date(end.getTime()-90*86400000);
  c.innerHTML=head('Audit History','Loading C/TPA audit history…');
  try{
    let w=await reportingApi({action:'audit_history',start_date:dateInputValue(start),end_date:dateInputValue(end)});
    const draw=()=>{
      const rows=w.audit_events||[];
      const actors=new Set(rows.map(x=>x.actor_name).filter(Boolean)),resources=new Set(rows.map(x=>x.resource_type).filter(Boolean));
      c.innerHTML=head('Audit History','C/TPA workspace audit events for the selected period. Sensitive before/after payloads, IP addresses, and user agents are not exposed here.',
        `<a class="btn btn-outline" href="reports.html">Reports / Audit Packet</a>`)
      +`<section class="card"><div class="card-body"><form id="ctpaAuditRange" class="saas-form"><div class="saas-form-grid">
        <label><span>Start Date</span><input name="start_date" type="date" value="${dateInputValue(w.range?.start||start)}"></label>
        <label><span>End Date</span><input name="end_date" type="date" value="${dateInputValue(w.range?.end||end)}"></label>
      </div><div class="management-actions"><button class="btn btn-outline">Run Audit History</button></div></form></div></section>
      <section class="metrics">
        <article class="metric-card"><div class="metric-label">Audit Events</div><div class="metric-value">${rows.length}</div></article>
        <article class="metric-card"><div class="metric-label">Actors</div><div class="metric-value">${actors.size}</div></article>
        <article class="metric-card"><div class="metric-label">Resource Types</div><div class="metric-value">${resources.size}</div></article>
      </section>
      <section class="card" style="margin-top:18px"><div class="card-head"><div><h2>Audit Event History</h2><span>Actions performed through the C/TPA workspace.</span></div></div><div class="card-body">
      ${table(['Date / Time','Actor','Employer Context','Action','Resource','Resource ID'],rows.map(a=>`<tr><td>${a.event_at?new Date(a.event_at).toLocaleString():'—'}</td><td>${esc(a.actor_name||'System')}</td><td>${esc(a.employer_name||'C/TPA')}</td><td><strong>${esc(a.action)}</strong></td><td>${esc(a.resource_type)}</td><td>${esc(a.resource_id||'—')}</td></tr>`).join(''),'No audit events in this period.')}</div></section>`;
      wireRenderedPage();
      $('#ctpaAuditRange').onsubmit=async ev=>{ev.preventDefault();try{const x=Object.fromEntries(new FormData(ev.currentTarget).entries());status('Loading audit history…');w=await reportingApi({action:'audit_history',...x});status('Audit history updated.');draw()}catch(e){status(e.message,'error')}};
    };
    draw();
  }catch(e){c.innerHTML=head('Audit History','Unable to load C/TPA audit history.')+`<div class="saas-notice">${esc(e.message)}</div>`}
}

async function renderCtpaStaff(){
  const c=$('.content');if(!c)return;c.innerHTML=head('Staff & Account Access','Loading C/TPA staff access…');
  try{
    let w=await ctpaAdminApi({action:'workspace',scope:'staff'});
    const draw=()=>{
      const members=w.members||[],roles=w.roles||[];
      c.innerHTML=head('Staff & Account Access','Invite and manage C/TPA Administrators and Staff. Employee / Driver and Employer client accounts remain separate.',w.can_manage?'<button class="btn btn-orange" id="inviteCtpaStaff" type="button">Invite Staff User</button>':'')
      +`<section class="metrics"><article class="metric-card"><div class="metric-label">Account Users</div><div class="metric-value">${members.length}</div><div class="metric-note">${members.filter(x=>x.status==='active').length} active</div></article><article class="metric-card"><div class="metric-label">Administrators</div><div class="metric-value">${members.filter(x=>x.roles?.code==='ctpa_admin'&&x.status==='active').length}</div></article><article class="metric-card"><div class="metric-label">Staff</div><div class="metric-value">${members.filter(x=>x.roles?.code==='ctpa_staff'&&x.status==='active').length}</div></article><article class="metric-card"><div class="metric-label">Management</div><div class="metric-value" style="font-size:18px">${w.can_manage?'Enabled':'Read Only'}</div></article></section>
      ${table(['User','Email','Role','Status','Primary','Actions'],members.map(m=>`<tr><td><strong>${esc(m.profile?.full_name||'Account User')}</strong></td><td>${esc(m.profile?.email||'—')}</td><td>${esc(m.roles?.name||m.roles?.code||'—')}</td><td>${esc(m.status)}</td><td>${m.is_primary?'Yes':'No'}</td><td>${w.can_manage&&m.user_id!==w.current_user_id?`<button class="org-action" data-edit-ctpa-staff="${esc(m.id)}" type="button">Manage</button>`:m.user_id===w.current_user_id?'Current User':'—'}</td></tr>`).join(''),'No C/TPA staff accounts.')}
      <section id="ctpaStaffPanel" class="card" style="display:none;margin-top:18px"><div class="card-body" id="ctpaStaffPanelBody"></div></section>`;wireRenderedPage();
      const panel=$('#ctpaStaffPanel'),body=$('#ctpaStaffPanelBody');
      $('#inviteCtpaStaff')?.addEventListener('click',()=>{panel.style.display='block';body.innerHTML=`<div class="management-section-head"><div><h3>Invite C/TPA Staff User</h3><p>An existing screenings4u user can be attached to this C/TPA; otherwise Supabase Auth sends an invitation.</p></div></div><form id="ctpaStaffInviteForm" class="saas-form"><div class="saas-form-grid"><label><span>First Name</span><input name="first_name"></label><label><span>Last Name</span><input name="last_name"></label><label><span>Email *</span><input name="email" type="email" required></label><label><span>Role *</span><select name="role_code">${roles.map(r=>`<option value="${esc(r.code)}">${esc(r.name)}</option>`).join('')}</select></label></div><div class="management-actions"><button class="btn btn-outline" id="closeCtpaStaffPanel" type="button">Cancel</button><button class="btn btn-orange">Send Invite</button></div></form>`;wireRenderedPage();$('#closeCtpaStaffPanel').onclick=()=>panel.style.display='none';$('#ctpaStaffInviteForm').onsubmit=async ev=>{ev.preventDefault();try{status('Inviting C/TPA user…');await ctpaAdminApi({action:'invite_staff',member:Object.fromEntries(new FormData(ev.currentTarget).entries())});w=await ctpaAdminApi({action:'workspace',scope:'staff'});status('C/TPA account access updated.');draw()}catch(e){status(e.message,'error')}};panel.scrollIntoView({behavior:'smooth',block:'center'})});
      document.querySelectorAll('[data-edit-ctpa-staff]').forEach(btn=>btn.onclick=()=>{const m=members.find(x=>x.id===btn.dataset.editCtpaStaff);if(!m)return;panel.style.display='block';body.innerHTML=`<div class="management-section-head"><div><h3>Manage ${esc(m.profile?.full_name||'Account User')}</h3><p>Role and membership status apply only to this C/TPA workspace.</p></div></div><form id="ctpaStaffEditForm" class="saas-form"><div class="saas-form-grid"><label><span>Role</span><select name="role_id">${roles.map(r=>`<option value="${esc(r.id)}" ${r.id===m.role_id?'selected':''}>${esc(r.name)}</option>`).join('')}</select></label><label><span>Status</span><select name="status">${['active','suspended','revoked'].map(v=>`<option value="${v}" ${v===m.status?'selected':''}>${esc(v)}</option>`).join('')}</select></label></div><div class="management-actions"><button class="btn btn-outline" id="closeCtpaStaffPanel" type="button">Cancel</button><button class="btn btn-orange">Save Access</button></div></form>`;wireRenderedPage();$('#closeCtpaStaffPanel').onclick=()=>panel.style.display='none';$('#ctpaStaffEditForm').onsubmit=async ev=>{ev.preventDefault();try{const x=Object.fromEntries(new FormData(ev.currentTarget).entries());x.id=m.id;await ctpaAdminApi({action:'save_staff',member:x});w=await ctpaAdminApi({action:'workspace',scope:'staff'});status('C/TPA staff access saved.');draw()}catch(e){status(e.message,'error')}};panel.scrollIntoView({behavior:'smooth',block:'center'})});
    };draw();
  }catch(e){c.innerHTML=head('Staff & Account Access','Unable to load staff access.')+`<div class="saas-notice">${esc(e.message)}</div>`}
}

async function renderCtpaPolicies(){
  const c=$('.content');if(!c)return;c.innerHTML=head('Policy Builder','Loading Employer policy records…');
  try{let w=await ctpaAdminApi({action:'workspace',scope:'policies'});const draw=()=>{const employers=w.employers||[],policies=w.policies||[],em=new Map(employers.map(x=>[x.id,x]));c.innerHTML=head('Policy Builder','Create and maintain Employer drug and alcohol policy records. These records document the policy content managed in screenings4u; they are not legal advice.',w.can_manage?'<button class="btn btn-orange" id="addCtpaPolicy" type="button">Create Policy Record</button>':'')+table(['Employer','Policy','Version','Program','Agency','Effective','Status','Actions'],policies.map(p=>`<tr><td>${esc(em.get(p.employer_id)?.legal_name||'—')}</td><td><strong>${esc(p.title)}</strong></td><td>${esc(p.version)}</td><td>${esc(p.program_type)}</td><td>${esc(p.dot_agency||'—')}</td><td>${fmt(p.policy_data?.effective_date)}</td><td>${esc(p.status)}</td><td>${w.can_manage?`<button class="org-action" data-edit-ctpa-policy="${esc(p.id)}" type="button">Edit</button> <button class="org-action" data-archive-ctpa-policy="${esc(p.id)}" type="button">Archive</button>`:'—'}</td></tr>`).join(''),'No policy records.')+`<section id="ctpaPolicyPanel" class="card" style="display:none;margin-top:18px"><div class="card-body" id="ctpaPolicyPanelBody"></div></section>`;wireRenderedPage();const panel=$('#ctpaPolicyPanel'),body=$('#ctpaPolicyPanelBody');const show=(p={program_type:'DOT',status:'draft',version:'1.0'})=>{panel.style.display='block';body.innerHTML=`<div class="management-section-head"><div><h3>${p.id?'Edit Policy Record':'Create Policy Record'}</h3><p>Policy text and notes are stored inside the existing policy_data record.</p></div></div><form id="ctpaPolicyForm" class="saas-form"><input type="hidden" name="id" value="${esc(p.id||'')}"><div class="saas-form-grid"><label><span>Employer *</span><select name="employer_id" required><option value="">Choose Employer</option>${employers.map(e=>`<option value="${esc(e.id)}" ${e.id===p.employer_id?'selected':''}>${esc(e.legal_name)}</option>`).join('')}</select></label><label><span>Title *</span><input name="title" required value="${esc(p.title||'')}"></label><label><span>Version</span><input name="version" value="${esc(p.version||'1.0')}"></label><label><span>Program Type</span><select name="program_type">${['DOT','NON_DOT'].map(v=>`<option value="${v}" ${p.program_type===v?'selected':''}>${v==='NON_DOT'?'Non-DOT':'DOT'}</option>`).join('')}</select></label><label><span>DOT Agency</span><select name="dot_agency"><option value="">Not applicable</option>${['FMCSA','FAA','FRA','FTA','PHMSA','USCG'].map(v=>`<option value="${v}" ${p.dot_agency===v?'selected':''}>${v}</option>`).join('')}</select></label><label><span>Status</span><select name="status">${['draft','active','suspended','inactive'].map(v=>`<option value="${v}" ${p.status===v?'selected':''}>${esc(v)}</option>`).join('')}</select></label><label><span>Effective Date</span><input name="effective_date" type="date" value="${esc(p.policy_data?.effective_date||'')}"></label><label style="grid-column:1/-1"><span>Policy Content</span><textarea name="content_html" rows="12">${esc(p.policy_data?.content_html||'')}</textarea></label><label style="grid-column:1/-1"><span>Internal Notes</span><textarea name="notes" rows="3">${esc(p.policy_data?.notes||'')}</textarea></label></div><div class="management-actions"><button class="btn btn-outline" id="closeCtpaPolicyPanel" type="button">Cancel</button><button class="btn btn-orange">Save Policy</button></div></form>`;wireRenderedPage();$('#closeCtpaPolicyPanel').onclick=()=>panel.style.display='none';$('#ctpaPolicyForm').onsubmit=async ev=>{ev.preventDefault();try{status('Saving policy record…');await ctpaAdminApi({action:'save_policy',policy:Object.fromEntries(new FormData(ev.currentTarget).entries())});w=await ctpaAdminApi({action:'workspace',scope:'policies'});status('Policy record saved.');draw()}catch(e){status(e.message,'error')}};panel.scrollIntoView({behavior:'smooth',block:'center'})};$('#addCtpaPolicy')?.addEventListener('click',()=>show());document.querySelectorAll('[data-edit-ctpa-policy]').forEach(b=>b.onclick=()=>show(policies.find(x=>x.id===b.dataset.editCtpaPolicy)||{}));document.querySelectorAll('[data-archive-ctpa-policy]').forEach(b=>b.onclick=async()=>{if(!window.confirm('Archive this policy record?'))return;try{await ctpaAdminApi({action:'archive_policy',policy_id:b.dataset.archiveCtpaPolicy});w=await ctpaAdminApi({action:'workspace',scope:'policies'});status('Policy archived.');draw()}catch(e){status(e.message,'error')}})};draw()}catch(e){c.innerHTML=head('Policy Builder','Unable to load policy records.')+`<div class="saas-notice">${esc(e.message)}</div>`}
}

async function renderCtpaEnrollment(){
  const c=$('.content');if(!c)return;c.innerHTML=head('Enrollment Agreements & Certificates','Loading C/TPA enrollment documents…');
  try{let w=await ctpaAdminApi({action:'workspace',scope:'enrollment'});const draw=()=>{const employers=w.employers||[],docs=w.documents||[],em=new Map(employers.map(x=>[x.id,x]));c.innerHTML=head('Enrollment Agreements & Certificates','Issue tracked Employer enrollment agreements, enrollment certificates, and consortium agreements.',w.can_manage?'<button class="btn btn-orange" id="issueCtpaEnrollment" type="button">Issue Document</button>':'')+table(['Tracking','Employer','Type','Title','Validity','Issued','Status','Actions'],docs.map(d=>`<tr><td><strong>${esc(d.tracking_number)}</strong></td><td>${esc(em.get(d.employer_id)?.legal_name||'—')}</td><td>${esc(String(d.document_type).replaceAll('_',' '))}</td><td>${esc(d.title)}</td><td>${d.document_data?.valid_from?`${fmt(d.document_data.valid_from)} – ${fmt(d.document_data.valid_until)}`:'—'}</td><td>${fmt(d.issued_at)}</td><td>${d.revoked_at?'revoked':esc(d.status)}</td><td>${w.can_manage&&!d.revoked_at?`<button class="org-action" data-revoke-ctpa-enrollment="${esc(d.id)}" type="button">Revoke</button>`:'—'}</td></tr>`).join(''),'No enrollment documents issued.')+`<section id="ctpaEnrollmentPanel" class="card" style="display:none;margin-top:18px"><div class="card-body" id="ctpaEnrollmentPanelBody"></div></section>`;wireRenderedPage();$('#issueCtpaEnrollment')?.addEventListener('click',()=>{const panel=$('#ctpaEnrollmentPanel'),body=$('#ctpaEnrollmentPanelBody');panel.style.display='block';body.innerHTML=`<div class="management-section-head"><div><h3>Issue Enrollment Document</h3><p>A unique tracking number is generated server-side.</p></div></div><form id="ctpaEnrollmentForm" class="saas-form"><div class="saas-form-grid"><label><span>Employer *</span><select name="employer_id" required><option value="">Choose Employer</option>${employers.map(e=>`<option value="${esc(e.id)}">${esc(e.legal_name)}</option>`).join('')}</select></label><label><span>Document Type *</span><select name="document_type"><option value="enrollment_agreement">Enrollment Agreement</option><option value="enrollment_certificate">Enrollment Certificate</option><option value="consortium_agreement">Consortium Agreement</option></select></label><label><span>Title *</span><input name="title" required></label><label><span>Valid From</span><input name="valid_from" type="date"></label><label><span>Valid Until</span><input name="valid_until" type="date"></label><label style="grid-column:1/-1"><span>Document Content</span><textarea name="content_html" rows="10"></textarea></label><label style="grid-column:1/-1"><span>Notes</span><textarea name="notes" rows="3"></textarea></label></div><div class="management-actions"><button class="btn btn-outline" id="closeCtpaEnrollmentPanel" type="button">Cancel</button><button class="btn btn-orange">Issue Document</button></div></form>`;wireRenderedPage();$('#closeCtpaEnrollmentPanel').onclick=()=>panel.style.display='none';$('#ctpaEnrollmentForm').onsubmit=async ev=>{ev.preventDefault();try{status('Issuing enrollment document…');await ctpaAdminApi({action:'issue_enrollment',document:Object.fromEntries(new FormData(ev.currentTarget).entries())});w=await ctpaAdminApi({action:'workspace',scope:'enrollment'});status('Enrollment document issued.');draw()}catch(e){status(e.message,'error')}};panel.scrollIntoView({behavior:'smooth',block:'center'})});document.querySelectorAll('[data-revoke-ctpa-enrollment]').forEach(b=>b.onclick=async()=>{if(!window.confirm('Revoke this issued enrollment document?'))return;try{await ctpaAdminApi({action:'revoke_enrollment',document_id:b.dataset.revokeCtpaEnrollment});w=await ctpaAdminApi({action:'workspace',scope:'enrollment'});status('Enrollment document revoked.');draw()}catch(e){status(e.message,'error')}})};draw()}catch(e){c.innerHTML=head('Enrollment Agreements & Certificates','Unable to load enrollment documents.')+`<div class="saas-notice">${esc(e.message)}</div>`}
}

async function renderCtpaBilling(){
  const c=$('.content');if(!c)return;c.innerHTML=head('Plan & Billing','Loading C/TPA billing workspace…');
  try{let w=await ctpaAdminApi({action:'workspace',scope:'billing'});const draw=()=>{const s=w.subscription||{},p=s.plans||{},invoices=w.invoices||[],employers=w.employers||[],em=new Map(employers.map(x=>[x.id,x])),remit=w.remittance||{};c.innerHTML=head('Plan & Client Billing','Review the screenings4u C/TPA plan and manage C/TPA-to-Employer client invoices when Client Invoicing is enabled.',w.can_manage&&w.client_invoicing?'<button class="btn btn-orange" id="newCtpaClientInvoice" type="button">Create Client Invoice</button>':'')+`<section class="metrics"><article class="metric-card"><div class="metric-label">screenings4u Plan</div><div class="metric-value" style="font-size:18px">${esc(p.name||'No plan')}</div><div class="metric-note">${money(p.monthly_price||0)} / month</div></article><article class="metric-card"><div class="metric-label">Subscription Status</div><div class="metric-value" style="font-size:18px">${esc(s.status||'—')}</div></article><article class="metric-card"><div class="metric-label">Client Invoices</div><div class="metric-value">${invoices.length}</div><div class="metric-note">${invoices.filter(x=>x.status==='open'||x.status==='past_due').length} open / past due</div></article><article class="metric-card"><div class="metric-label">Integrated Client Payments</div><div class="metric-value" style="font-size:18px">${w.client_payments?'Entitled':'Not Enabled'}</div><div class="metric-note">Payment links display only when an actual payment_url exists</div></article></section><div class="saas-notice"><strong>Billing scope:</strong> this page does not fabricate screenings4u subscription invoices or client payment links. Client invoices use the dedicated C/TPA invoice ledger. A notice marked queued is not proof of email delivery.</div><section class="card" style="margin-top:18px"><div class="card-head"><div><h2>Enabled C/TPA Capabilities</h2><span>Current plan plus Admin overrides</span></div></div><div class="card-body"><div class="feature-grid">${Object.entries(w.entitlements||{}).filter(([,v])=>v).map(([k])=>`<div class="feature-row"><strong>${esc(k.replaceAll('_',' '))}</strong><span class="badge success">Enabled</span></div>`).join('')||empty('No capabilities enabled.')}</div></div></section>${w.client_invoicing?`<section class="card" style="margin-top:18px"><div class="card-head"><div><h2>Employer Client Invoices</h2><span>Draft, open, externally paid, past-due, and void records.</span></div></div><div class="card-body">${table(['Invoice','Employer','Issued','Due','Total','Paid','Status','Recipient','Actions'],invoices.map(i=>`<tr><td><strong>${esc(i.invoice_number)}</strong></td><td>${esc(em.get(i.employer_id)?.legal_name||'—')}</td><td>${fmt(i.issued_at)}</td><td>${fmt(i.due_at)}</td><td>${money(i.total)}</td><td>${money(i.amount_paid)}</td><td>${esc(i.status)}</td><td>${esc(i.recipient_email||'—')}</td><td><div class="row-actions">${i.view_url?`<a class="org-action" href="${esc(i.view_url)}" target="_blank">View</a>`:''}${i.payment_url?`<a class="org-action" href="${esc(i.payment_url)}" target="_blank">Pay</a>`:''}${w.can_manage&&i.status==='draft'?`<button class="org-action" data-send-ctpa-invoice="${esc(i.id)}" type="button">Open / Queue Notice</button>`:''}${w.can_manage&&!['paid_external','void'].includes(i.status)?`<button class="org-action" data-paid-ctpa-invoice="${esc(i.id)}" type="button">Mark Paid External</button><button class="org-action" data-void-ctpa-invoice="${esc(i.id)}" type="button">Void</button>`:''}</div></td></tr>`).join(''),'No C/TPA client invoices.')}</div></section>${w.can_manage?`<section class="card" style="margin-top:18px"><div class="card-head"><div><h2>Remittance Profile</h2><span>Snapshot copied into new client invoices.</span></div></div><div class="card-body"><form id="ctpaRemittanceForm" class="saas-form"><div class="saas-form-grid"><label><span>Remit Name</span><input name="remit_name" value="${esc(remit.remit_name||'')}"></label><label><span>Email</span><input name="remit_email" type="email" value="${esc(remit.remit_email||'')}"></label><label><span>Phone</span><input name="remit_phone" value="${esc(remit.remit_phone||'')}"></label><label><span>Address</span><input name="remit_address1" value="${esc(remit.remit_address1||'')}"></label><label><span>Address 2</span><input name="remit_address2" value="${esc(remit.remit_address2||'')}"></label><label><span>City</span><input name="remit_city" value="${esc(remit.remit_city||'')}"></label><label><span>State</span><input name="remit_state" value="${esc(remit.remit_state||'')}"></label><label><span>Postal Code</span><input name="remit_postal_code" value="${esc(remit.remit_postal_code||'')}"></label><label><span>Check Payable To</span><input name="check_payable_to" value="${esc(remit.check_payable_to||'')}"></label><label style="grid-column:1/-1"><span>Payment Instructions</span><textarea name="payment_instructions" rows="2">${esc(remit.payment_instructions||'')}</textarea></label><label style="grid-column:1/-1"><span>ACH Instructions</span><textarea name="ach_instructions" rows="2">${esc(remit.ach_instructions||'')}</textarea></label><label style="grid-column:1/-1"><span>Memo Instructions</span><textarea name="memo_instructions" rows="2">${esc(remit.memo_instructions||'')}</textarea></label></div><div class="management-actions"><button class="btn btn-outline">Save Remittance</button></div></form></div></section>`:''}`:''}<section id="ctpaBillingPanel" class="card" style="display:none;margin-top:18px"><div class="card-body" id="ctpaBillingPanelBody"></div></section>`;wireRenderedPage();$('#ctpaRemittanceForm')?.addEventListener('submit',async ev=>{ev.preventDefault();try{await ctpaAdminApi({action:'save_remittance',remittance:Object.fromEntries(new FormData(ev.currentTarget).entries())});w=await ctpaAdminApi({action:'workspace',scope:'billing'});status('Remittance profile saved.');draw()}catch(e){status(e.message,'error')}});$('#newCtpaClientInvoice')?.addEventListener('click',()=>{const panel=$('#ctpaBillingPanel'),body=$('#ctpaBillingPanelBody');panel.style.display='block';body.innerHTML=`<div class="management-section-head"><div><h3>Create Employer Client Invoice</h3><p>Create a draft invoice in the C/TPA client ledger. Payment status is never assumed.</p></div></div><form id="ctpaClientInvoiceForm" class="saas-form"><div class="saas-form-grid"><label><span>Employer *</span><select name="employer_id" required><option value="">Choose Employer</option>${employers.map(e=>`<option value="${esc(e.id)}">${esc(e.legal_name)}</option>`).join('')}</select></label><label><span>Recipient Email</span><input name="recipient_email" type="email"></label><label><span>Due At</span><input name="due_at" type="datetime-local"></label><label><span>Tax</span><input name="tax" type="number" min="0" step="0.01" value="0"></label><label><span>Credits</span><input name="credits" type="number" min="0" step="0.01" value="0"></label><label style="grid-column:1/-1"><span>Notes</span><textarea name="notes" rows="2"></textarea></label></div><div id="ctpaInvoiceItems"><div class="saas-form-grid invoice-item-row"><label><span>Description *</span><input data-item="description" required></label><label><span>Quantity</span><input data-item="quantity" type="number" min="0.01" step="0.01" value="1"></label><label><span>Unit Amount</span><input data-item="unit_amount" type="number" min="0" step="0.01" value="0"></label></div></div><div class="management-actions"><button class="btn btn-outline" id="addCtpaInvoiceItem" type="button">Add Line Item</button><button class="btn btn-outline" id="closeCtpaBillingPanel" type="button">Cancel</button><button class="btn btn-orange">Create Draft Invoice</button></div></form>`;wireRenderedPage();$('#closeCtpaBillingPanel').onclick=()=>panel.style.display='none';$('#addCtpaInvoiceItem').onclick=()=>$('#ctpaInvoiceItems').insertAdjacentHTML('beforeend','<div class="saas-form-grid invoice-item-row"><label><span>Description *</span><input data-item="description" required></label><label><span>Quantity</span><input data-item="quantity" type="number" min="0.01" step="0.01" value="1"></label><label><span>Unit Amount</span><input data-item="unit_amount" type="number" min="0" step="0.01" value="0"></label></div>');$('#ctpaClientInvoiceForm').onsubmit=async ev=>{ev.preventDefault();try{const f=ev.currentTarget,x=Object.fromEntries(new FormData(f).entries()),items=[...f.querySelectorAll('.invoice-item-row')].map(r=>({description:r.querySelector('[data-item="description"]').value,quantity:Number(r.querySelector('[data-item="quantity"]').value||1),unit_amount:Number(r.querySelector('[data-item="unit_amount"]').value||0)}));await ctpaAdminApi({action:'create_client_invoice',invoice:{...x,tax:Number(x.tax||0),credits:Number(x.credits||0),items}});w=await ctpaAdminApi({action:'workspace',scope:'billing'});status('Draft client invoice created.');draw()}catch(e){status(e.message,'error')}};panel.scrollIntoView({behavior:'smooth',block:'center'})});document.querySelectorAll('[data-send-ctpa-invoice]').forEach(b=>b.onclick=async()=>{try{const r=await ctpaAdminApi({action:'send_client_invoice',invoice_id:b.dataset.sendCtpaInvoice});w=await ctpaAdminApi({action:'workspace',scope:'billing'});status(r.notification_queued?'Invoice opened and notification queued.':'Invoice opened; no recipient notification was queued.');draw()}catch(e){status(e.message,'error')}});document.querySelectorAll('[data-paid-ctpa-invoice]').forEach(b=>b.onclick=async()=>{if(!window.confirm('Mark this invoice paid externally? Use this only when payment was verified outside screenings4u.'))return;try{await ctpaAdminApi({action:'mark_client_invoice_paid',invoice_id:b.dataset.paidCtpaInvoice});w=await ctpaAdminApi({action:'workspace',scope:'billing'});status('Invoice marked paid externally.');draw()}catch(e){status(e.message,'error')}});document.querySelectorAll('[data-void-ctpa-invoice]').forEach(b=>b.onclick=async()=>{if(!window.confirm('Void this client invoice?'))return;try{await ctpaAdminApi({action:'void_client_invoice',invoice_id:b.dataset.voidCtpaInvoice});w=await ctpaAdminApi({action:'workspace',scope:'billing'});status('Client invoice voided.');draw()}catch(e){status(e.message,'error')}})};draw()}catch(e){c.innerHTML=head('Plan & Billing','This C/TPA role does not have Billing access or Billing Tools are unavailable.')+`<div class="saas-notice">${esc(e.message)}</div>`}
}

async function renderCtpaBranding(){
  const c=$('.content');if(!c)return;c.innerHTML=head('White Label','Loading C/TPA branding…');
  try{let w=await ctpaAdminApi({action:'workspace',scope:'branding'});const draw=()=>{const x=w.branding||{};c.innerHTML=head('White Label','Configure the C/TPA portal identity when White Label is enabled.',w.can_manage?'':'')+`<section class="card"><div class="card-body">${x.logo_path?`<div style="margin-bottom:18px"><img src="${esc(x.logo_path)}" alt="C/TPA logo" style="max-height:80px;max-width:260px"></div>`:''}<form id="ctpaBrandingForm" class="saas-form"><div class="saas-form-grid"><label><span>Portal Name</span><input name="portal_name" value="${esc(x.portal_name||'')}"></label><label><span>Primary Color</span><input name="primary_color" type="color" value="${esc(x.primary_color||'#24467f')}"></label><label><span>Accent Color</span><input name="accent_color" type="color" value="${esc(x.accent_color||'#ff6b00')}"></label>${w.can_manage?'<label><span>Logo File</span><input id="ctpaLogoFile" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml"></label>':''}<label style="grid-column:1/-1"><span>Current Logo URL</span><input name="logo_path" value="${esc(x.logo_path||'')}" readonly></label><label style="grid-column:1/-1"><span>Custom Domain</span><input value="${esc(x.custom_domain||'Not configured')}" readonly></label></div><div class="saas-notice">Custom-domain provisioning is not self-service in this build. Existing verified domain information is displayed only; DNS verification and certificate provisioning remain a screenings4u Admin/provider setup.</div>${w.can_manage?'<div class="management-actions"><button class="btn btn-orange">Save Branding</button></div>':''}</form></div></section>`;wireRenderedPage();if(w.can_manage){$('#ctpaBrandingForm').onsubmit=async ev=>{ev.preventDefault();try{const f=ev.currentTarget,file=$('#ctpaLogoFile').files?.[0];let logo=x.logo_path||null;if(file){if(file.size>5*1024*1024)throw new Error('Logo must be 5 MB or smaller.');const base64=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result||''));r.onerror=()=>reject(new Error('Unable to read logo file.'));r.readAsDataURL(file)});status('Uploading logo…');const up=await ctpaAdminApi({action:'upload_logo',mime_type:file.type,base64});logo=up.url}const b=Object.fromEntries(new FormData(f).entries());status('Saving branding…');await ctpaAdminApi({action:'save_branding',branding:{portal_name:b.portal_name,primary_color:b.primary_color,accent_color:b.accent_color,logo_path:logo}});w=await ctpaAdminApi({action:'workspace',scope:'branding'});status('C/TPA branding saved.');draw()}catch(e){status(e.message,'error')}}}};draw()}catch(e){c.innerHTML=head('White Label','Unable to load White Label configuration.')+`<div class="saas-notice">${esc(e.message)}</div>`}
}

async function renderCtpaIntegrations(){
  const c=$('.content');if(!c)return;c.innerHTML=head('Integrations','Loading C/TPA integrations…');
  try{let w=await ctpaAdminApi({action:'workspace',scope:'integrations'});const draw=()=>{const rows=w.integrations||[];c.innerHTML=head('Integrations','Review provider integrations associated with this C/TPA tenant. Credentials and provider-specific configuration are never exposed in this workspace.')+`<div class="saas-notice">Provider credentials and connection provisioning are configured through screenings4u Admin/provider setup. C/TPA Administrators can only enable, disable, or deactivate existing configured integrations here.</div>`+table(['Name','Provider','Type','Status','Last Sync','Actions'],rows.map(x=>`<tr><td><strong>${esc(x.name)}</strong></td><td>${esc(x.provider)}</td><td>${esc(x.integration_type)}</td><td>${esc(x.status)}</td><td>${fmt(x.last_sync_at)}</td><td>${w.can_manage?`<select data-ctpa-integration-status="${esc(x.id)}">${['active','inactive','disabled'].map(v=>`<option value="${v}" ${x.status===v?'selected':''}>${esc(v)}</option>`).join('')}</select> <button class="org-action" data-save-ctpa-integration="${esc(x.id)}" type="button">Save</button>`:'—'}</td></tr>`).join(''),'No integrations are currently configured for this C/TPA tenant.');wireRenderedPage();document.querySelectorAll('[data-save-ctpa-integration]').forEach(b=>b.onclick=async()=>{const id=b.dataset.saveCtpaIntegration,sel=document.querySelector(`[data-ctpa-integration-status="${id}"]`);try{await ctpaAdminApi({action:'save_integration_status',integration:{id,status:sel.value}});w=await ctpaAdminApi({action:'workspace',scope:'integrations'});status('Integration status updated.');draw()}catch(e){status(e.message,'error')}})};draw()}catch(e){c.innerHTML=head('Integrations','Unable to load integrations.')+`<div class="saas-notice">${esc(e.message)}</div>`}
}

async function renderCtpaClearinghouse(){
  const c=$('.content');if(!c)return;c.innerHTML=head('FMCSA Clearinghouse','Loading Clearinghouse setup record…');
  try{let w=await ctpaAdminApi({action:'workspace',scope:'clearinghouse'});const draw=()=>{const x=w.clearinghouse||{};c.innerHTML=head('FMCSA Clearinghouse','Track C/TPA Clearinghouse setup and delegated functions. Employers must designate the C/TPA in the federal Clearinghouse before delegated work is performed.')+`<div class="saas-notice"><strong>Important:</strong> this page records setup/delegation information only. It does not connect to, query, or submit data to the FMCSA Drug & Alcohol Clearinghouse.</div><section class="card"><div class="card-body"><form id="ctpaClearinghouseForm" class="saas-form"><div class="saas-form-grid"><label><span>Setup Status</span><select name="setup_status">${['not_started','assistance_requested','in_progress','active','declined'].map(v=>`<option value="${v}" ${x.setup_status===v?'selected':''}>${esc(v.replaceAll('_',' '))}</option>`).join('')}</select></label><label><span>Account Name</span><input name="clearinghouse_account_name" value="${esc(x.clearinghouse_account_name||'')}"></label><label><span>Account Identifier</span><input name="clearinghouse_account_identifier" value="${esc(x.clearinghouse_account_identifier||'')}"></label><label><span>Registered Email</span><input name="registered_email" type="email" value="${esc(x.registered_email||'')}"></label><label class="config-choice"><span>Query Management Delegated</span><input name="query_management_enabled" type="checkbox" ${x.query_management_enabled?'checked':''}></label><label class="config-choice"><span>Violation Management Delegated</span><input name="violation_management_enabled" type="checkbox" ${x.violation_management_enabled?'checked':''}></label><label class="config-choice"><span>RTD Management Delegated</span><input name="rtd_management_enabled" type="checkbox" ${x.rtd_management_enabled?'checked':''}></label><label class="config-choice"><span>Setup Assistance Requested</span><input name="setup_assistance_requested" type="checkbox" ${x.setup_assistance_requested?'checked':''}></label><label style="grid-column:1/-1"><span>Notes</span><textarea name="notes" rows="4">${esc(x.notes||'')}</textarea></label></div>${w.can_manage?'<div class="management-actions"><button class="btn btn-orange">Save Clearinghouse Setup</button></div>':''}</form></div></section>`;wireRenderedPage();if(w.can_manage)$('#ctpaClearinghouseForm').onsubmit=async ev=>{ev.preventDefault();const f=ev.currentTarget,b=Object.fromEntries(new FormData(f).entries());for(const k of ['query_management_enabled','violation_management_enabled','rtd_management_enabled','setup_assistance_requested'])b[k]=f.elements[k].checked;try{await ctpaAdminApi({action:'save_clearinghouse',clearinghouse:b});w=await ctpaAdminApi({action:'workspace',scope:'clearinghouse'});status('Clearinghouse setup record saved.');draw()}catch(e){status(e.message,'error')}}};draw()}catch(e){c.innerHTML=head('FMCSA Clearinghouse','Unable to load Clearinghouse setup.')+`<div class="saas-notice">${esc(e.message)}</div>`}
}

async function renderCtpaSupport(){
  const c=$('.content');if(!c)return;c.innerHTML=head('Support','Loading support tickets…');
  try{let w=await supportApi({action:'list'});const draw=()=>{const tickets=w.tickets||[];c.innerHTML=head('Support','Create and review screenings4u support requests for this C/TPA workspace.','<button class="btn btn-orange" id="newCtpaSupportTicket" type="button">New Support Ticket</button>')+table(['Created','Ticket','Category','Priority','Status','Subject'],tickets.map(t=>`<tr><td>${fmt(t.created_at)}</td><td>${esc(t.ticket_number||t.id)}</td><td>${esc(String(t.category||'general').replaceAll('_',' '))}</td><td>${esc(t.priority||'normal')}</td><td>${esc(t.status||'open')}</td><td><strong>${esc(t.subject)}</strong></td></tr>`).join(''),'No support tickets.')+`<section id="ctpaSupportPanel" class="card" style="display:none;margin-top:18px"><div class="card-body" id="ctpaSupportPanelBody"></div></section>`;wireRenderedPage();$('#newCtpaSupportTicket').onclick=()=>{const panel=$('#ctpaSupportPanel'),body=$('#ctpaSupportPanelBody');panel.style.display='block';body.innerHTML=`<div class="management-section-head"><div><h3>New Support Ticket</h3><p>Use this for account, technical, billing, or feature-access assistance.</p></div></div><form id="ctpaSupportForm" class="saas-form"><div class="saas-form-grid"><label><span>Category</span><select name="category"><option value="general">General</option><option value="technical">Technical</option><option value="billing">Billing</option><option value="account">Account</option><option value="feature_access">Feature Access</option></select></label><label><span>Priority</span><select name="priority"><option value="low">Low</option><option value="normal" selected>Normal</option><option value="high">High</option><option value="urgent">Urgent</option></select></label><label style="grid-column:1/-1"><span>Subject *</span><input name="subject" maxlength="180" required></label><label style="grid-column:1/-1"><span>Message *</span><textarea name="message" rows="7" maxlength="10000" required></textarea></label></div><div class="management-actions"><button class="btn btn-outline" id="closeCtpaSupportPanel" type="button">Cancel</button><button class="btn btn-orange">Submit Ticket</button></div></form>`;wireRenderedPage();$('#closeCtpaSupportPanel').onclick=()=>panel.style.display='none';$('#ctpaSupportForm').onsubmit=async ev=>{ev.preventDefault();try{status('Submitting support ticket…');await supportApi({action:'create',...Object.fromEntries(new FormData(ev.currentTarget).entries())});w=await supportApi({action:'list'});status('Support ticket submitted.');draw()}catch(e){status(e.message,'error')}};panel.scrollIntoView({behavior:'smooth',block:'center'})}};draw()}catch(e){c.innerHTML=head('Support','Unable to load support tickets.')+`<div class="saas-notice">${esc(e.message)}</div>`}
}
function render(d,file){const c=$('.content');if(!c)return;if(file==='dashboard.html'){c.innerHTML=dashboard(d);return}if(file==='employers.html'){renderEmployerClients(d);return}if(file==='employees.html'){renderEmployeesDrivers();return}if(file==='programs.html'){renderProgramsEnrollment();return}if(file==='random-pools.html'){renderConsortiumPools();return}if(file==='selections.html'){renderRandomSelections();return}if(file==='testing-orders.html'){renderTestingOrders();return}if(file==='results.html'){renderResultsMro();return}if(file==='compliance.html'){renderCompliance();return}if(file==='rtd-follow-up.html'){renderRtdFollowUp();return}if(file==='documents.html'){renderDocuments();return}if(file==='reports.html'){renderReportsAudit();return}if(file==='clearinghouse.html'){renderCtpaClearinghouse();return}if(file==='employer-controls.html'){const sm=new Map(d.employer_settings.filter(x=>x.setting_key==='service_scope').map(x=>[x.employer_id,x.configuration||{}]));c.innerHTML=head('Client Service Scope','Document what each employer has delegated to this C/TPA. This does not replace federal Clearinghouse designation.')+table(['Employer','Clearinghouse','Queries','Violations','RTD','Random','Records','Action'],d.employers.map(e=>{const x=sm.get(e.id)||{};return `<tr><td><strong>${esc(e.legal_name)}</strong></td>${['clearinghouse_designated','conduct_queries','report_violations','report_rtd','manage_random_program','maintain_records'].map(k=>`<td>${x[k]?'Yes':'—'}</td>`).join('')}<td>${isCtpaAdmin()?`<button class="org-action" data-scope="${e.id}">Edit</button>`:'Read Only'}</td></tr>`}).join(''))+`<section id="scopeEditor" class="card" style="display:none;margin-top:18px"><div class="card-body"><h3 id="scopeName"></h3><div class="config-choice-grid">${[['scDesignation','clearinghouse_designated','Designated in FMCSA Clearinghouse'],['scQueries','conduct_queries','Conduct queries'],['scViolations','report_violations','Report violations'],['scRtd','report_rtd','Report RTD / negative-test'],['scRandom','manage_random_program','Manage random program'],['scRecords','maintain_records','Maintain testing records'],['scOwner','owner_operator_client','Owner-operator client']].map(([id,k,n])=>`<label class="config-choice"><span>${n}</span><input id="${id}" data-scope-key="${k}" type="checkbox"></label>`).join('')}</div><label><span>Designation / agreement date</span><input id="scDate" type="date"></label><label><span>Notes</span><textarea id="scNotes"></textarea></label><div class="management-actions"><button id="saveScope" class="btn btn-orange">Save Service Scope</button></div></div></section>`;let eid='';document.querySelectorAll('[data-scope]').forEach(b=>b.onclick=()=>{eid=b.dataset.scope;const x=sm.get(eid)||{};$('#scopeName').textContent=employerName(d,eid);document.querySelectorAll('[data-scope-key]').forEach(i=>i.checked=!!x[i.dataset.scopeKey]);$('#scDate').value=x.designation_date||'';$('#scNotes').value=x.notes||'';$('#scopeEditor').style.display='block'});$('#saveScope').onclick=async()=>{const configuration={};document.querySelectorAll('[data-scope-key]').forEach(i=>configuration[i.dataset.scopeKey]=i.checked);configuration.designation_date=$('#scDate').value||null;configuration.notes=$('#scNotes').value;try{await api({action:'save_service_scope',employer_id:eid,configuration});status('Client service scope saved.');await refreshWorkspace()}catch(e){status(e.message,'error')}};return}if(file==='policies.html'){renderCtpaPolicies();return}if(file==='enrollment.html'){renderCtpaEnrollment();return}if(file==='employer-import.html'){c.innerHTML=head('Employer Import','Import employer clients from CSV when this capability is enabled by Admin.')+(isCtpaAdmin()?`<section class="card"><div class="card-body"><input id="csvFile" type="file" accept=".csv,text/csv"><div class="management-actions"><button id="runImport" class="btn btn-orange">Import Employers</button></div></div></section>`:`<div class="saas-notice">Your C/TPA role can review import history but cannot run Employer imports.</div>`)+table(['File','Rows','Imported','Updated','Rejected','Uploaded'],d.employer_imports.map(x=>`<tr><td>${esc(x.original_file_name)}</td><td>${x.row_count}</td><td>${x.imported_count}</td><td>${x.updated_count}</td><td>${x.rejected_count}</td><td>${fmt(x.uploaded_at)}</td></tr>`).join(''));$('#runImport')?.addEventListener('click',async()=>{const f=$('#csvFile').files[0];if(!f)return status('Choose a CSV file.','error');try{await api({action:'import_employers',file_name:f.name,csv:await f.text()});status('Employer import completed.');await refreshWorkspace()}catch(e){status(e.message,'error')}});return}if(file==='integrations.html'){renderCtpaIntegrations();return}if(file==='notifications.html'){renderNotificationsActionCenter();return}if(file==='audit.html'){renderAuditHistory();return}if(file==='staff.html'){renderCtpaStaff();return}if(file==='branding.html'){renderCtpaBranding();return}if(file==='billing.html'){renderCtpaBilling();return}if(file==='support.html'){renderCtpaSupport();return}}

function classifyStatus(value=''){
  const v=String(value||'').trim().toLowerCase().replace(/\s+/g,'_');
  if(['active','completed','complete','current','paid','final_result','eligible','issued','locked','success','resolved','closed'].includes(v))return 'is-good';
  if(['warning','pending','pending_enrollment','draft','onboarding','in_progress','executing','assigned','scheduled','laboratory','mro_review','assistance_requested'].includes(v))return 'is-warn';
  if(['cancelled','canceled','failed','rejected','suspended','inactive','terminated','refused','no_show','unable_to_collect','invalid_specimen','collection_issue'].includes(v))return 'is-danger';
  return 'is-info';
}

function wireTableTools(){
  document.querySelectorAll('[data-ctpa-table-shell]').forEach(shell=>{
    const input=shell.querySelector('[data-ctpa-table-search]');
    const count=shell.querySelector('[data-ctpa-table-count]');
    const rows=Array.from(shell.querySelectorAll('tbody tr')).filter(row=>!row.querySelector('.saas-empty'));
    const refreshCount=()=>{
      const visible=rows.filter(row=>row.style.display!=='none').length;
      if(count)count.textContent=`${visible} record${visible===1?'':'s'}`;
    };
    if(input){
      input.addEventListener('input',()=>{
        const term=input.value.trim().toLowerCase();
        rows.forEach(row=>{
          row.style.display=!term||row.textContent.toLowerCase().includes(term)?'':'none';
        });
        refreshCount();
      });
    }
    refreshCount();
  });
}

function decorateStatuses(){
  const known=/^(active|completed|complete|current|paid|final result|final_result|eligible|issued|locked|success|resolved|closed|warning|pending|pending enrollment|pending_enrollment|draft|onboarding|in progress|in_progress|executing|assigned|scheduled|laboratory|mro review|mro_review|assistance requested|assistance_requested|cancelled|canceled|failed|rejected|suspended|inactive|terminated|refused|no show|no_show|unable to collect|unable_to_collect|invalid specimen|invalid_specimen|collection issue|collection_issue)$/i;
  document.querySelectorAll('.management-table td').forEach(cell=>{
    if(cell.children.length)return;
    const text=cell.textContent.trim();
    if(!known.test(text))return;
    cell.innerHTML=`<span class="ctpa-status-pill ${classifyStatus(text)}">${esc(text.replaceAll('_',' '))}</span>`;
  });
}

function wireRenderedPage(){
  wireTableTools();
  decorateStatuses();
  document.querySelectorAll('button[aria-label="Help"]').forEach(b=>{b.onclick=()=>location.href='support.html'});
  document.querySelectorAll('.sidebar-help').forEach(x=>{x.style.cursor='pointer';x.onclick=()=>location.href='support.html'});
}

function csv(rows,name){if(!rows.length)return status('No records to export.','error');const keys=[...new Set(rows.flatMap(Object.keys))],q=v=>`"${String(typeof v==='object'&&v!==null?JSON.stringify(v):v??'').replaceAll('"','""')}"`,txt=[keys.map(q).join(','),...rows.map(r=>keys.map(k=>q(r[k])).join(','))].join('\n'),u=URL.createObjectURL(new Blob([txt],{type:'text/csv'})),a=document.createElement('a');a.href=u;a.download=name+'.csv';a.click();URL.revokeObjectURL(u)}
function pageScope(){return (location.pathname.split('/').pop()||'dashboard.html').replace(/\.html$/,'');}
function workspaceCacheKey(){const id=new URLSearchParams(location.search).get('ctpa')||'current';return `s4u_ctpa_workspace_${id}_${pageScope()}`;}
function readWorkspaceCache(){try{const c=JSON.parse(sessionStorage.getItem(workspaceCacheKey())||'null');return c&&Date.now()-c.saved_at<60000?c.data:null}catch{return null}}
function writeWorkspaceCache(data){try{sessionStorage.setItem(workspaceCacheKey(),JSON.stringify({saved_at:Date.now(),data}))}catch{}}
async function refreshWorkspace(){const d=await api({action:'workspace',scope:pageScope()});writeWorkspaceCache(d);paint(d);return d}
function paint(d){const content=$('.content');if(content)content.style.visibility='visible';nav(d);const file=location.pathname.split('/').pop()||'dashboard.html',feature=PAGE_FEATURE[file];if(feature&&!ent(d,feature)){location.replace('../access-required.html?reason=subscription');return}document.querySelectorAll('.page-title span').forEach(x=>x.textContent=d.ctpa?.organizations?.legal_name||'C/TPA');render(d,file);wireRenderedPage()}
const initialContent=$('.content');
if(initialContent){
  initialContent.innerHTML=`<div class="ctpa-loading" aria-label="Loading C/TPA workspace">
    <div class="ctpa-loading-hero"></div>
    <div class="ctpa-loading-card"></div>
    <div class="ctpa-loading-card"></div>
  </div>`;
}
portalCtx=await portalReady;try{const surfaceCtx=await loadSurfaceContext();portalCtx={...portalCtx,...surfaceCtx};installBusinessSwitcher(portalCtx);localStorage.removeItem('s4u_ctpa_demo_workspace_v1');localStorage.removeItem('s4u_ctpa_demo_onboarding');const cached=readWorkspaceCache();if(cached)paint(cached);const d=await api({action:'workspace',scope:pageScope()});writeWorkspaceCache(d);paint(d)}catch(e){const cached=readWorkspaceCache();if(!cached){const c=$('.content');if(c)c.innerHTML=head('C/TPA Portal','Unable to load this workspace.')+`<div class="saas-notice">${esc(e.message)}</div>`;}console.error(e)}
