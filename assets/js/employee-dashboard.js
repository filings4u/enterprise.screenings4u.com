(()=>{
"use strict";

const state={
  db:null,
  user:null,
  profile:null,
  employee:null,
  employer:null,
  courses:[]
};

const $=id=>document.getElementById(id);

document.addEventListener("DOMContentLoaded",init);

async function init(){
  try{
    state.db=window.getScreenings4uSupabase
      ? await window.getScreenings4uSupabase()
      : window.screenings4uSupabase;

    if(!state.db) throw new Error("Supabase client is unavailable.");

    bindEvents();
    await loadDashboard();
  }catch(error){
    console.error("[Employee Dashboard]",error);
    showModal("Dashboard Unavailable",error?.message||"Unable to load your dashboard.");
  }
}

function bindEvents(){
  $("employee-modal-close")?.addEventListener("click",closeModal);
  $("employee-modal")?.querySelector(".employee-modal-backdrop")?.addEventListener("click",closeModal);
}

async function loadDashboard(){
  const {data:{user},error:userError}=await state.db.auth.getUser();
  if(userError) throw userError;
  if(!user) throw new Error("Your employee session has expired. Please sign in again.");

  state.user=user;

  const [profileResult,employeeResult,enrollmentResult]=await Promise.all([
    state.db.from("user_profiles")
      .select("id,first_name,last_name,display_name,email")
      .eq("id",user.id)
      .maybeSingle(),

    state.db.from("employer_employees")
      .select("id,employer_id,user_id,first_name,last_name,email,employment_status,job_title,department")
      .eq("user_id",user.id)
      .maybeSingle(),

    state.db.from("lms_enrollments")
      .select("id,user_id,course_id,employer_id,status,progress_percent,enrolled_at,started_at,completed_at,last_activity_at")
      .eq("user_id",user.id)
      .order("last_activity_at",{ascending:false,nullsFirst:false})
  ]);

  if(profileResult.error) throw profileResult.error;
  if(employeeResult.error) throw employeeResult.error;
  if(enrollmentResult.error) throw enrollmentResult.error;

  state.profile=profileResult.data||null;
  state.employee=employeeResult.data||null;

  if(state.employee?.employer_id){
    const {data,error}=await state.db.from("employer_profiles")
      .select("id,employer_name,legal_name,email,phone,status")
      .eq("id",state.employee.employer_id)
      .maybeSingle();

    if(error) throw error;
    state.employer=data||null;
  }

  const enrollments=enrollmentResult.data||[];
  const courseIds=[...new Set(enrollments.map(row=>row.course_id).filter(Boolean))];

  let byId=new Map();

  if(courseIds.length){
    const {data,error}=await state.db.from("lms_courses")
      .select("id,slug,title,short_description,description,status")
      .in("id",courseIds);

    if(error) throw error;
    byId=new Map((data||[]).map(course=>[course.id,course]));
  }

  state.courses=enrollments.map(enrollment=>{
    const course=byId.get(enrollment.course_id)||{};
    const progress=clamp(Number(enrollment.progress_percent||0));
    const rawStatus=String(enrollment.status||"").toLowerCase();

    let status="available";

    if(enrollment.completed_at || progress>=100 || rawStatus==="completed"){
      status="completed";
    }else if(
      enrollment.started_at ||
      progress>0 ||
      ["active","in_progress","started"].includes(rawStatus)
    ){
      status="in_progress";
    }

    return {
      enrollment_id:enrollment.id,
      course_id:enrollment.course_id,
      slug:course.slug||"",
      title:course.title||"Training Course",
      status,
      progress
    };
  });

  render();
}

function render(){
  const name=state.profile?.first_name||state.employee?.first_name||"";
  setText("welcome-name",name?`Welcome back, ${name}`:"Welcome back");

  const completed=state.courses.filter(c=>c.status==="completed").length;
  const active=state.courses.filter(c=>c.status==="in_progress").length;
  const available=state.courses.filter(c=>c.status==="available").length;
  const percent=state.courses.length
    ? Math.round(state.courses.reduce((sum,c)=>sum+c.progress,0)/state.courses.length)
    : 0;

  setText("stat-available",available);
  setText("stat-progress",active);
  setText("stat-completed",completed);
  setText("stat-percent",`${percent}%`);
  setText("progress-ring-value",`${percent}%`);
  setText("legend-completed",completed);
  setText("legend-progress",active);
  setText("legend-available",available);

  if(state.employer){
    setText("employer-name",
      state.employer.employer_name||
      state.employer.legal_name||
      "Your Employer"
    );
    setText("employer-message",
      "Your employer manages your employee training access, course assignments, and required learning."
    );
  }

  renderContinue();
  renderCourses();

  window.updateEmployeePortalUser?.({
    fullName:
      state.profile?.display_name||
      [state.profile?.first_name,state.profile?.last_name].filter(Boolean).join(" ")||
      [state.employee?.first_name,state.employee?.last_name].filter(Boolean).join(" ")||
      "Employee",
    email:state.profile?.email||state.employee?.email||state.user?.email||""
  });
}

function renderContinue(){
  const target=$("continue-course");
  if(!target) return;

  const course=
    state.courses.find(c=>c.status==="in_progress")||
    state.courses.find(c=>c.status==="available");

  if(!course){
    target.className="employee-empty-state";
    target.textContent="No course is currently in progress.";
    return;
  }

  target.className="employee-open-items";
  target.innerHTML=courseMarkup(course);
}

function renderCourses(){
  const target=$("course-list");
  if(!target) return;

  if(!state.courses.length){
    target.innerHTML='<div class="employee-empty-state">No courses assigned yet.</div>';
    return;
  }

  target.innerHTML=state.courses.slice(0,4).map(courseMarkup).join("");
}

function courseMarkup(course){
  const label=
    course.status==="completed"
      ? "Completed"
      : course.status==="in_progress"
        ? `${course.progress}% complete`
        : "Ready to begin";

  const action=
    course.status==="completed"
      ? "Review"
      : course.status==="in_progress"
        ? "Continue"
        : "Start";

  const url=buildCoursePlayerUrl(course);

  return `
    <div class="employee-open-item">
      <div>
        <strong>${escapeHtml(course.title)}</strong>
        <span>${escapeHtml(label)}</span>
      </div>
      <a href="${escapeHtml(url)}">${escapeHtml(action)}</a>
    </div>
  `;
}

function buildCoursePlayerUrl(course){
  if(!course?.course_id || !course?.enrollment_id){
    return "employee-courses.html";
  }

  const params=new URLSearchParams({
    course_id:String(course.course_id),
    enrollment_id:String(course.enrollment_id)
  });

  if(course.slug) params.set("course",String(course.slug));

  return `https://training.screenings4u.com/lms-course-player.html?${params.toString()}`;
}

function setText(id,value){
  const el=$(id);
  if(el) el.textContent=String(value);
}

function clamp(value){
  return Math.max(0,Math.min(100,Number.isFinite(value)?Math.round(value):0));
}

function showModal(title,message){
  setText("employee-modal-title",title);
  setText("employee-modal-message",message);
  const modal=$("employee-modal");
  if(modal) modal.hidden=false;
}

function closeModal(){
  const modal=$("employee-modal");
  if(modal) modal.hidden=true;
}

function escapeHtml(value){
  return String(value??"").replace(/[&<>"']/g,c=>({
    "&":"&amp;",
    "<":"&lt;",
    ">":"&gt;",
    '"':"&quot;",
    "'":"&#39;"
  }[c]));
}

})();
