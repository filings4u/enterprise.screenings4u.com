(()=>{"use strict";

const state={
  db:null,
  user:null,
  courses:[],
  filter:"all",
  search:""
};

const $=id=>document.getElementById(id);

document.addEventListener("DOMContentLoaded",init);

async function init(){
  bindEvents();

  try{
    state.db=window.getScreenings4uSupabase
      ? await window.getScreenings4uSupabase()
      : window.screenings4uSupabase;

    if(!state.db) throw new Error("Supabase client is unavailable.");

    await loadCourses();
  }catch(error){
    console.error("[Employee Courses]",error);
    showModal("Courses Unavailable",error?.message||"Unable to load your assigned courses.");
  }
}

function bindEvents(){
  $("course-search")?.addEventListener("input",event=>{
    state.search=String(event.target.value||"").toLowerCase();
    render();
  });

  $("course-filter")?.addEventListener("change",event=>{
    state.filter=event.target.value;
    syncFilters();
    render();
  });

  document.querySelectorAll("[data-filter]").forEach(button=>{
    button.addEventListener("click",()=>{
      state.filter=button.dataset.filter||"all";
      if($("course-filter")) $("course-filter").value=state.filter;
      syncFilters();
      render();
    });
  });

  $("courses-modal-close")?.addEventListener("click",closeModal);
}

async function loadCourses(){
  const {data:{user},error:userError}=await state.db.auth.getUser();

  if(userError) throw userError;
  if(!user) throw new Error("Your employee session has expired. Please sign in again.");

  state.user=user;

  const {data:enrollments,error:enrollmentError}=await state.db
    .from("lms_enrollments")
    .select("id,course_id,employer_id,status,progress_percent,enrolled_at,started_at,completed_at,last_activity_at")
    .eq("user_id",user.id)
    .order("last_activity_at",{ascending:false,nullsFirst:false});

  if(enrollmentError) throw enrollmentError;

  const enrollmentRows=enrollments||[];
  const courseIds=[...new Set(enrollmentRows.map(row=>row.course_id).filter(Boolean))];

  let coursesById=new Map();

  if(courseIds.length){
    const {data:courses,error:courseError}=await state.db
      .from("lms_courses")
      .select("id,slug,title,short_description,description,status")
      .in("id",courseIds);

    if(courseError) throw courseError;

    coursesById=new Map(
      (courses||[]).map(course=>[course.id,course])
    );
  }

  state.courses=enrollmentRows.map(enrollment=>{
    const course=coursesById.get(enrollment.course_id)||{};
    const progress=clamp(Number(enrollment.progress_percent||0));
    const status=normalizeStatus(enrollment,progress);

    return {
      id:enrollment.id,
      enrollment_id:enrollment.id,
      course_id:enrollment.course_id,
      slug:course.slug||"",
      title:course.title||"Training Course",
      description:course.short_description||course.description||"Training assigned by your employer.",
      status,
      progress,
      enrolled_at:enrollment.enrolled_at,
      started_at:enrollment.started_at,
      completed_at:enrollment.completed_at,
      last_activity_at:enrollment.last_activity_at
    };
  });

  render();
}

function normalizeStatus(enrollment,progress){
  const raw=String(enrollment.status||"").toLowerCase();

  if(enrollment.completed_at || progress>=100 || raw==="completed"){
    return "completed";
  }

  if(
    enrollment.started_at ||
    progress>0 ||
    ["active","in_progress","started"].includes(raw)
  ){
    return "in_progress";
  }

  return "available";
}

function filtered(){
  return state.courses.filter(course=>{
    const matchesFilter=
      state.filter==="all" ||
      course.status===state.filter;

    const text=
      `${course.title||""} ${course.description||""}`.toLowerCase();

    return matchesFilter && text.includes(state.search);
  });
}

function render(){
  const counts={
    all:state.courses.length,
    in_progress:state.courses.filter(c=>c.status==="in_progress").length,
    available:state.courses.filter(c=>c.status==="available").length,
    completed:state.courses.filter(c=>c.status==="completed").length
  };

  setText("count-all",counts.all);
  setText("count-progress",counts.in_progress);
  setText("count-available",counts.available);
  setText("count-completed",counts.completed);

  const list=filtered();
  const grid=$("courses-grid");
  const empty=$("courses-empty");

  grid.innerHTML=list.map(card).join("");
  grid.hidden=list.length===0;
  empty.hidden=list.length!==0;
}

function card(course){
  const statusLabel=
    course.status==="completed"
      ? "Completed"
      : course.status==="in_progress"
        ? "In Progress"
        : "Not Started";

  const statusClass=
    course.status==="completed"
      ? "completed"
      : course.status==="in_progress"
        ? "in-progress"
        : "";

  const action=
    course.status==="completed"
      ? "Review Course"
      : course.status==="in_progress"
        ? "Continue Course"
        : "Start Course";

  const courseUrl=buildCourseUrl(course);

  return `
    <article class="employee-course-card">
      <div class="employee-course-cover">
        ${esc(initials(course.title))}
      </div>

      <div class="employee-course-content">
        <div class="employee-course-meta">
          <span class="employee-course-badge">Assigned Course</span>
          <span class="employee-course-status ${statusClass}">
            ${esc(statusLabel)}
          </span>
        </div>

        <h2>${esc(course.title)}</h2>
        <p>${esc(course.description)}</p>

        <div class="employee-course-progress-row">
          <span>Progress</span>
          <strong>${course.progress}%</strong>
        </div>

        <div class="employee-course-progress-track">
          <span style="width:${course.progress}%"></span>
        </div>

        <div class="employee-course-actions">
          <a class="employee-course-launch"
             href="${esc(courseUrl)}">
            ${esc(action)}
          </a>

          <a class="employee-course-dashboard-link"
             href="employee-dashboard.html">
            Dashboard
          </a>
        </div>
      </div>
    </article>
  `;
}

function buildCourseUrl(course){
  const params=new URLSearchParams();

  if(course.course_id) params.set("course_id",course.course_id);
  if(course.enrollment_id) params.set("enrollment_id",course.enrollment_id);
  if(course.slug) params.set("course",course.slug);

  return `https://training.screenings4u.com/lms-course-player.html?${params.toString()}`;
}

function syncFilters(){
  document.querySelectorAll("[data-filter]").forEach(button=>{
    button.classList.toggle(
      "active",
      button.dataset.filter===state.filter
    );
  });
}

function initials(value){
  const words=String(value||"TR")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if(words.length===1){
    return words[0].slice(0,2).toUpperCase();
  }

  return `${words[0][0]||""}${words[1][0]||""}`.toUpperCase();
}

function clamp(value){
  return Math.max(
    0,
    Math.min(
      100,
      Number.isFinite(value) ? Math.round(value) : 0
    )
  );
}

function setText(id,value){
  const el=$(id);
  if(el) el.textContent=String(value);
}

function esc(value){
  return String(value??"").replace(/[&<>"']/g,char=>({
    "&":"&amp;",
    "<":"&lt;",
    ">":"&gt;",
    '"':"&quot;",
    "'":"&#39;"
  }[char]));
}

function showModal(title,message){
  setText("courses-modal-title",title);
  setText("courses-modal-message",message);
  $("courses-modal").hidden=false;
}

function closeModal(){
  $("courses-modal").hidden=true;
}

})();