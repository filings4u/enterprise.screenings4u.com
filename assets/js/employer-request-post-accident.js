(function(){
"use strict";
let db=null,employees=[],busy=false;
document.addEventListener("DOMContentLoaded",init);

async function init(){
  setDefaults(); bindEvents(); restoreDraft();
  try{
    db=await getScreenings4uSupabase();
    await loadEmployees();
    await prefillRequester();
  }catch(error){
    console.error("Post-accident initialization failed:",error);
    showModal("Unable to Load Request",error?.message||"The post-accident request page could not connect to your employer account.");
  }
}

function setDefaults(){
  const date=document.getElementById("incident-date");
  if(date&&!date.value)date.value=new Date().toISOString().slice(0,10);
}
function bindEvents(){
  document.getElementById("post-accident-form")?.addEventListener("submit",submitRequest);
  document.getElementById("save-draft")?.addEventListener("click",saveDraft);
  document.getElementById("employee-id")?.addEventListener("change",fillEmployee);
  document.getElementById("request-modal-close")?.addEventListener("click",closeModal);
  document.querySelector("#request-modal .request-modal-backdrop")?.addEventListener("click",closeModal);
}
async function invoke(action,request){
  if(!db)throw new Error("The employer account connection is not ready.");
  const {data,error}=await db.functions.invoke("employer-onsite-request-actions",{body:{action,request,request_type:"post_accident"}});
  if(error)throw error;if(data?.error)throw new Error(data.error);return data;
}
async function loadEmployees(){
  const result=await invoke("list_employees");
  employees=result.employees||[];
  const select=document.getElementById("employee-id"); if(!select)return;
  select.innerHTML='<option value="">Select employee</option>';
  employees.forEach(e=>{
    const option=document.createElement("option");
    option.value=e.id;
    const name=[e.first_name,e.middle_name,e.last_name].filter(Boolean).join(" ");
    option.textContent=e.employee_number?`${name} · ${e.employee_number}`:name;
    select.appendChild(option);
  });
  const draft=readDraft(); if(draft?.employee_id){select.value=draft.employee_id;fillEmployee(false);}
}
function fillEmployee(overwrite=true){
  const id=document.getElementById("employee-id")?.value;
  const e=employees.find(x=>x.id===id);if(!e)return;
  const name=[e.first_name,e.middle_name,e.last_name].filter(Boolean).join(" ");
  set("employee-name",name,overwrite);set("employee-phone",e.phone||"",overwrite);set("employee-email",e.email||"",overwrite);
}
async function prefillRequester(){
  try{
    const {data:{user}}=await db.auth.getUser();if(!user)return;
    const {data:profile}=await db.from("user_profiles").select("first_name,last_name,phone").eq("id",user.id).maybeSingle();
    const name=[profile?.first_name,profile?.last_name].filter(Boolean).join(" ");
    set("requested-by",name,false);set("contact-phone",profile?.phone||"",false);
  }catch(error){console.warn("Requester profile could not be prefilled:",error);}
}
function set(id,value,overwrite){
  const el=document.getElementById(id);if(el&&(overwrite||!el.value))el.value=value||"";
}
function selectedTests(){return Array.from(document.querySelectorAll('input[name="testing"]:checked')).map(x=>x.value);}
function collectData(){return{
  employee_id:document.getElementById("employee-id")?.value||null,
  employee_name:document.getElementById("employee-name")?.value.trim()||"",
  employee_phone:document.getElementById("employee-phone")?.value.trim()||"",
  employee_email:document.getElementById("employee-email")?.value.trim()||"",
  incident_date:document.getElementById("incident-date")?.value||"",
  incident_time:document.getElementById("incident-time")?.value||"",
  incident_location:document.getElementById("incident-location")?.value.trim()||"",
  description:document.getElementById("incident-description")?.value.trim()||"",
  priority:document.getElementById("request-priority")?.value||"urgent",
  testing:selectedTests(),
  requested_by:document.getElementById("requested-by")?.value.trim()||"",
  contact_phone:document.getElementById("contact-phone")?.value.trim()||""
};}
async function saveDraft(){
  if(busy)return;const d=collectData();
  if(!d.employee_name&&!d.incident_location){showModal("Draft Information Required","Enter the employee or incident location before saving a draft.");return;}
  setBusy(true,"Saving…");
  try{
    const result=await invoke("save_draft",d);
    localStorage.setItem("screenings4u_post_accident_draft",JSON.stringify(d));
    showModal("Draft Saved",`Post-accident draft ${result.request.request_number} was saved to your employer account.`);
  }catch(error){console.error(error);showModal("Unable to Save Draft",await errorMessage(error));}
  finally{setBusy(false);}
}
async function submitRequest(event){
  event.preventDefault();if(busy)return;const d=collectData();
  if(!d.employee_name){showModal("Employee Required","Please select or enter the employee involved in the incident.");return;}
  if(!d.incident_date||!d.incident_location){showModal("Incident Details Required","Please provide the incident date and location.");return;}
  if(!d.testing.length){showModal("Testing Selection Required","Select the testing requested.");return;}
  if(!d.requested_by||!d.contact_phone){showModal("Request Contact Required","Please provide the request contact name and best contact number.");return;}
  setBusy(true,"Submitting…");
  try{
    const result=await invoke("submit",d);
    localStorage.removeItem("screenings4u_post_accident_draft");
    document.getElementById("post-accident-form")?.reset();setDefaults();
    showModal("Post-Accident Request Submitted",`Request ${result.request.request_number} has been submitted for coordination.`);
  }catch(error){console.error(error);showModal("Unable to Submit Request",await errorMessage(error));}
  finally{setBusy(false);}
}
function readDraft(){try{return JSON.parse(localStorage.getItem("screenings4u_post_accident_draft")||"null");}catch{return null;}}
function restoreDraft(){
  const d=readDraft();if(!d)return;
  const map={"employee-name":"employee_name","employee-phone":"employee_phone","employee-email":"employee_email","incident-date":"incident_date","incident-time":"incident_time","incident-location":"incident_location","incident-description":"description","request-priority":"priority","requested-by":"requested_by","contact-phone":"contact_phone"};
  Object.entries(map).forEach(([id,key])=>set(id,d[key]||"",true));
  (d.testing||[]).forEach(v=>{const x=document.querySelector(`input[name="testing"][value="${CSS.escape(v)}"]`);if(x)x.checked=true;});
}
function setBusy(on,text){
  busy=on;const submit=document.querySelector('#post-accident-form button[type="submit"]'),draft=document.getElementById("save-draft");
  if(submit){submit.disabled=on;submit.textContent=on?(text||"Working…"):"Submit Request";}if(draft)draft.disabled=on;
}
async function errorMessage(error){try{if(error?.context?.json){const b=await error.context.json();if(b?.error)return b.error;}}catch(_){}return error?.message||"The request could not be completed.";}
function showModal(title,message){document.getElementById("request-modal-title").textContent=title;document.getElementById("request-modal-message").textContent=message;document.getElementById("request-modal").hidden=false;}
function closeModal(){document.getElementById("request-modal").hidden=true;}
})();