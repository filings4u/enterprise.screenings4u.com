(()=>{"use strict";
const state={db:null,courses:[],employer:null};
const $=id=>document.getElementById(id);
document.addEventListener("DOMContentLoaded",init);

async function init(){
 bind();
 try{
  state.db=window.getScreenings4uSupabase?await window.getScreenings4uSupabase():window.screenings4uSupabase;
  if(!state.db)throw Error("Supabase client is unavailable.");
  await loadContactData();
 }catch(e){console.error("[Employee Contact]",e);show("Unable to Load",e.message||"Unable to load employer information.");}
}
function bind(){
 $("employer-contact-form")?.addEventListener("submit",sendMessage);
 $("clear-message")?.addEventListener("click",()=>$("employer-contact-form").reset());
 $("contact-modal-close")?.addEventListener("click",closeModal);
}
async function call(action,payload={}){
 const {data:{session}}=await state.db.auth.getSession();
 if(!session)throw Error("Your employee session has expired. Please sign in again.");
 const {data,error}=await state.db.functions.invoke("employee-contact-employer-actions",{body:{action,...payload},headers:{Authorization:`Bearer ${session.access_token}`}});
 if(error)throw error;if(data?.error)throw Error(data.error);return data;
}
async function loadContactData(){
 const data=await call("summary");
 state.employer=data.employer||null;state.courses=data.courses||[];
 renderEmployer();renderCourses();
}
function renderEmployer(){
 if(!state.employer)return;
 setText("contact-employer-name",state.employer.employer_name||state.employer.legal_name||"Employer Information");
 setText("contact-employer-email",state.employer.email||"Not available");
 setText("contact-employer-phone",state.employer.phone||"Not available");
}
function renderCourses(){
 const select=$("related-course");if(!select)return;
 select.innerHTML='<option value="">Select a course</option>';
 state.courses.sort((a,b)=>String(a.title||"").localeCompare(String(b.title||""))).forEach(c=>{
  const o=document.createElement("option");o.value=c.id;o.textContent=c.title||"Training Course";select.appendChild(o);
 });
}
async function sendMessage(e){
 e.preventDefault();
 const subject=$("message-subject").value;
 const message=$("message-body").value.trim();
 const course_id=$("related-course").value||null;
 if(!subject){show("Select a Topic","Please select the topic that best describes your request.");return;}
 if(!message){show("Message Required","Please enter a message for your employer.");return;}
 const btn=$("send-message-btn");btn.disabled=true;btn.textContent="Sending...";
 try{
  await call("send_message",{subject,message,course_id});
  e.target.reset();
  show("Message Sent","Your message was sent to your employer successfully.");
 }catch(err){console.error("[Employee Contact] send",err);show("Unable to Send Message",err.message||"Your message could not be sent.");}
 finally{btn.disabled=false;btn.textContent="Send Message";}
}
function setText(id,v){const el=$(id);if(el)el.textContent=v}
function show(t,m){setText("contact-modal-title",t);setText("contact-modal-message",m);$("contact-modal").hidden=false}
function closeModal(){$("contact-modal").hidden=true}
})();