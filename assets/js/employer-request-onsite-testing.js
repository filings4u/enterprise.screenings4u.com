(function(){
'use strict';
let db=null,busy=false;
document.addEventListener('DOMContentLoaded',init);

async function init(){
  bindEvents();
  try{
    db=await getScreenings4uSupabase();
    restoreLocalDraft();
  }catch(error){
    console.error('Onsite request initialization failed:',error);
    show('Unable to Start Request',error?.message||'The onsite request page could not connect to your account.');
  }
}

function bindEvents(){
  document.getElementById('onsite-request-form')?.addEventListener('submit',submitRequest);
  document.getElementById('onsite-save-draft')?.addEventListener('click',saveDraft);
  document.getElementById('onsite-modal-close')?.addEventListener('click',closeModal);
  document.querySelector('#onsite-modal .onsite-modal-backdrop')?.addEventListener('click',closeModal);
}

function services(){
  return Array.from(document.querySelectorAll('input[name="service"]:checked')).map(x=>x.value);
}

function formData(){
  return{
    site_name:v('site-name'),
    primary_contact:v('primary-contact'),
    contact_email:v('contact-email'),
    contact_phone:v('contact-phone'),
    address:v('site-address'),
    city:v('site-city'),
    state:v('site-state'),
    zip:v('site-zip'),
    location_type:v('location-type'),
    employee_count:v('employee-count'),
    preferred_date:v('preferred-date'),
    preferred_time:v('preferred-time'),
    testing_purpose:v('testing-purpose'),
    services:services(),
    special_instructions:v('special-instructions')
  };
}

function v(id){return document.getElementById(id)?.value.trim()||'';}

async function call(action,request){
  if(!db)throw new Error('The employer account connection is not ready.');
  const {data,error}=await db.functions.invoke('employer-onsite-request-actions',{body:{action,request}});
  if(error)throw error;
  if(data?.error)throw new Error(data.error);
  return data;
}

async function saveDraft(){
  if(busy)return;
  const d=formData();
  if(!d.site_name){
    show('Workplace Name Required','Enter the company or location name before saving a draft.');
    return;
  }
  setBusy(true,'Saving…');
  try{
    const result=await call('save_draft',d);
    localStorage.setItem('screenings4u_onsite_testing_draft',JSON.stringify(d));
    show('Draft Saved',`Your onsite testing draft ${result.request.request_number} was saved to your employer account.`);
  }catch(error){
    console.error('Onsite draft save failed:',error);
    show('Unable to Save Draft',await errorMessage(error));
  }finally{setBusy(false);}
}

async function submitRequest(e){
  e.preventDefault();
  if(busy)return;
  const d=formData();
  if(!d.site_name||!d.primary_contact){show('Workplace Information Required','Please provide the worksite name and primary contact.');return;}
  if(!d.contact_email){show('Contact Email Required','Please provide an email address for onsite testing coordination.');return;}
  if(!d.address||!d.city||!d.state){show('Testing Location Required','Please provide the onsite testing location.');return;}
  if(!d.employee_count||Number(d.employee_count)<1){show('Participant Count Required','Enter the estimated number of employees or participants.');return;}
  if(!d.services.length){show('Services Required','Select at least one onsite service.');return;}

  setBusy(true,'Submitting…');
  try{
    const result=await call('submit',d);
    localStorage.removeItem('screenings4u_onsite_testing_draft');
    document.getElementById('onsite-request-form')?.reset();
    show('Onsite Request Submitted',`Your request ${result.request.request_number} has been submitted. The Screenings4u team can now review the location, staffing, services, scheduling, and pricing requirements.`);
  }catch(error){
    console.error('Onsite request submission failed:',error);
    show('Unable to Submit Request',await errorMessage(error));
  }finally{setBusy(false);}
}

function restoreLocalDraft(){
  try{
    const raw=localStorage.getItem('screenings4u_onsite_testing_draft');
    if(!raw)return;
    const d=JSON.parse(raw);
    const map={
      'site-name':'site_name','primary-contact':'primary_contact','contact-email':'contact_email',
      'contact-phone':'contact_phone','site-address':'address','site-city':'city','site-state':'state',
      'site-zip':'zip','location-type':'location_type','employee-count':'employee_count',
      'preferred-date':'preferred_date','preferred-time':'preferred_time','testing-purpose':'testing_purpose',
      'special-instructions':'special_instructions'
    };
    Object.entries(map).forEach(([id,key])=>{const el=document.getElementById(id);if(el&&d[key]!=null)el.value=d[key];});
    (d.services||[]).forEach(service=>{const el=document.querySelector(`input[name="service"][value="${CSS.escape(service)}"]`);if(el)el.checked=true;});
  }catch(error){console.warn('Local onsite draft could not be restored:',error);}
}

function setBusy(on,text){
  busy=on;
  const submit=document.querySelector('#onsite-request-form button[type="submit"]');
  const draft=document.getElementById('onsite-save-draft');
  if(submit){submit.disabled=on;submit.textContent=on?(text||'Working…'):'Submit Onsite Request';}
  if(draft)draft.disabled=on;
}

async function errorMessage(error){
  try{
    if(error?.context?.json){
      const body=await error.context.json();
      if(body?.error)return body.error;
    }
  }catch(_){}
  return error?.message||'The request could not be completed.';
}

function show(t,m){
  document.getElementById('onsite-modal-title').textContent=t;
  document.getElementById('onsite-modal-message').textContent=m;
  document.getElementById('onsite-modal').hidden=false;
}
function closeModal(){document.getElementById('onsite-modal').hidden=true;}
})();