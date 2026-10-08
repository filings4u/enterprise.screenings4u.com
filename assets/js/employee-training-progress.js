(()=>{"use strict";

const state={
  db:null,
  user:null,
  courses:[]
};

const $=id=>document.getElementById(id);

document.addEventListener("DOMContentLoaded",init);

async function init(){
  $("progress-filter")?.addEventListener("change",render);

  try{
    state.db=window.getScreenings4uSupabase
      ? await window.getScreenings4uSupabase()
      : window.screenings4uSupabase;

    if(!state.db) throw new Error("Supabase client is unavailable.");

    await loadProgress();
  }catch(error){
    console.error("[Employee Training Progress]",error);
    renderError(error?.message||"Unable to load training progress.");
  }
}

async function loadProgress(){
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

function render(){
  const filter=$("progress-filter")?.value||"all";
  const all=state.courses;
  const list=filter==="all"
    ? all
    : all.filter(course=>course.status===filter);

  const completed=all.filter(course=>course.status==="completed").length;
  const active=all.filter(course=>course.status==="in_progress").length;
  const overall=all.length
    ? Math.round(all.reduce((sum,course)=>sum+course.progress,0)/all.length)
    : 0;

  setText("overall-progress",`${overall}%`);
  setText("completed-count",completed);
  setText("active-count",active);

  const box=$("progress-list");
  const empty=$("empty-state");

  box.innerHTML=list.map(item).join("");
  box.hidden=!list.length;
  empty.hidden=!!list.length;
}

function item(course){
  const label=
    course.status==="completed"
      ? "Completed"
      : course.status==="in_progress"
        ? "In Progress"
        : "Not Started";

  const action=
    course.status==="completed"
      ? "Review Course"
      : course.status==="in_progress"
        ? "Continue Course"
        : "Start Course";

  const url=buildCourseUrl(course);

  return `
    <article class="employee-training-progress-item">
      <div class="employee-training-progress-course-icon">
        ${esc(initials(course.title))}
      </div>

      <div class="employee-training-progress-course-info">
        <h3>${esc(course.title)}</h3>
        <p>${esc(label)}</p>

        <div class="employee-training-progress-bar">
          <span style="width:${course.progress}%"></span>
        </div>
      </div>

      <div class="employee-training-progress-course-percent">
        ${course.progress}%
        <small>${esc(label)}</small>
        <a href="${esc(url)}">${esc(action)}</a>
      </div>
    </article>
  `;
}

function buildCourseUrl(course){
  if(!course?.course_id || !course?.enrollment_id){
    return "employee-courses.html";
  }

  const params=new URLSearchParams({
    course_id:String(course.course_id),
    enrollment_id:String(course.enrollment_id)
  });

  if(course.slug) params.set("course",course.slug);

  return `https://training.screenings4u.com/lms-course-player.html?${params.toString()}`;
}

function renderError(message){
  setText("overall-progress","0%");
  setText("completed-count","0");
  setText("active-count","0");

  const box=$("progress-list");
  const empty=$("empty-state");

  if(box) box.hidden=true;

  if(empty){
    empty.hidden=false;
    empty.innerHTML=`
      <div class="employee-training-progress-empty-icon">!</div>
      <h2>Unable to load training</h2>
      <p>${esc(message)}</p>
    `;
  }
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
      Number.isFinite(value)?Math.round(value):0
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

})();