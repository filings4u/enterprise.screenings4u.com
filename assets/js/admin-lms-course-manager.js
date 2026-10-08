/* screenings4u — admin-lms-course-manager.js */
(() => {
"use strict";

let client=null;
let courses=[], sections=[], lessons=[], enrollments=[];
let selectedCourseId="";
let courseMap=new Map();
const el={};

document.addEventListener("DOMContentLoaded",init);

async function init(){
    cache(); bind();
    try{
        client=await waitForClient();
        if(!client)throw new Error("Supabase client was not found.");
        await requireSession();
        selectedCourseId=new URLSearchParams(location.search).get("course")||"";
        await loadAll();
    }catch(error){
        console.error(error);
        show(error.message||"Unable to load the course manager.","error");
    }
}

function cache(){
    ["cmMessage","cmCourseSelect","cmOpenCourse","cmCourseTitle","cmCourseDescription","cmEditCourse","cmPublish","cmStatus","cmUpdated",
    "cmEnrollmentsTab","cmProgressTab","cmCertificatesTab","cmSettingsTab","cmManageLessons","cmAddSection","cmOutline",
    "cmSummarySections","cmSummaryLessons","cmSummaryEnrollments","cmSummaryCompleted","cmSummaryRate",
    "cmQuickLessons","cmQuickEnrollments","cmQuickProgress","cmQuickCertificates","cmArchive"].forEach(id=>el[id]=document.getElementById(id));
}

function bind(){
    el.cmOpenCourse?.addEventListener("click",()=>openSelected(el.cmCourseSelect.value));
    el.cmCourseSelect?.addEventListener("change",()=>{ if(el.cmCourseSelect.value) openSelected(el.cmCourseSelect.value); });
    el.cmPublish?.addEventListener("click",togglePublish);
    el.cmArchive?.addEventListener("click",archiveCourse);
}

async function waitForClient(timeout=3500){
    const start=Date.now();
    while(Date.now()-start<timeout){
        const c=await getClient(); if(c?.from)return c;
        await new Promise(r=>setTimeout(r,75));
    }
    return null;
}

async function getClient(){
    try{
        if(typeof window.getScreenings4uSupabase==="function"){
            const c=await window.getScreenings4uSupabase(); if(c?.from)return c;
        }
    }catch(_){}
    if(window.screenings4uSupabase?.from)return window.screenings4uSupabase;
    if(window.supabaseClient?.from)return window.supabaseClient;
    if(window.supabase?.createClient&&window.SCREENINGS4U_SUPABASE_URL&&window.SCREENINGS4U_SUPABASE_ANON_KEY){
        window.supabaseClient=window.supabase.createClient(window.SCREENINGS4U_SUPABASE_URL,window.SCREENINGS4U_SUPABASE_ANON_KEY);
        return window.supabaseClient;
    }
    return null;
}

async function requireSession(){
    if(window.S4UAuth?.requireSession){
        const session=await window.S4UAuth.requireSession("admin-login.html");
        if(!session)throw new Error("Authentication required.");
        return;
    }
    const {data,error}=await client.auth.getSession();
    if(error)throw error;
    if(!data?.session?.user){location.replace("admin-login.html");throw new Error("Authentication required.");}
}

async function trainingReport(action,payload={}){
  const {data,error}=await client.auth.getSession();
  if(error)throw error;
  const token=data?.session?.access_token;
  if(!token)throw new Error("Your admin session has expired. Please sign in again.");
  const base=String(window.SCREENINGS4U_SUPABASE_URL||"https://elpbnytpciqnbexiaebp.supabase.co").replace(/\/$/,"");
  const anon=window.SCREENINGS4U_SUPABASE_ANON_KEY||window.SUPABASE_ANON_KEY||"";
  const response=await fetch(base+"/functions/v1/screenings4u-training-reporting",{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+token,...(anon?{"apikey":anon}:{})},body:JSON.stringify({action,...payload})});
  const out=await response.json().catch(()=>({}));
  if(!response.ok||out?.error)throw new Error(out?.error||"Training reporting request failed.");
  return out;
}

async function loadAll(){
    const out=await trainingReport("course_directory");
    courses=out.courses||[];
    sections=out.sections||[];
    lessons=out.lessons||[];
    enrollments=out.enrollments||[];
    courseMap=new Map(courses.map(c=>[c.id,c]));
    fillCourseSelect();

    if(selectedCourseId&&courseMap.has(selectedCourseId)){
        renderCourse(selectedCourseId);
    }else if(courses.length){
        selectedCourseId=courses[0].id;
        renderCourse(selectedCourseId);
    }else{
        renderNoCourses();
    }
}

function fillCourseSelect(){
    el.cmCourseSelect.innerHTML='<option value="">Select a course to manage</option>'+courses.map(c=>`<option value="${esc(c.id)}">${esc(c.title||"Untitled Course")} · ${esc(human(c.status))}</option>`).join("");
    if(selectedCourseId&&courseMap.has(selectedCourseId))el.cmCourseSelect.value=selectedCourseId;
}

function openSelected(id){
    if(!id)return;
    selectedCourseId=id;
    const url=new URL(location.href);
    url.searchParams.set("course",id);
    history.replaceState({},"",url);
    renderCourse(id);
}

function renderCourse(id){
    const c=courseMap.get(id);
    if(!c)return renderNoCourses();
    selectedCourseId=id;
    el.cmCourseSelect.value=id;

    el.cmCourseTitle.textContent=c.title||"Untitled Course";
    el.cmCourseDescription.textContent=c.short_description||c.description||"No course description has been added.";
    el.cmStatus.textContent=human(c.status);
    el.cmStatus.className=`cm-badge ${String(c.status||"").toLowerCase()}`;
    el.cmUpdated.textContent=dateTime(c.updated_at||c.created_at);

    const encoded=encodeURIComponent(id);
    el.cmEditCourse.href=`admin-lms-course-builder.html?course=${encoded}`;
    el.cmSettingsTab.href=`admin-lms-course-builder.html?course=${encoded}`;
    el.cmAddSection.href=`admin-lms-course-builder.html?course=${encoded}#sections`;
    el.cmManageLessons.href=`admin-lms-lesson-builder.html?course=${encoded}`;
    el.cmEnrollmentsTab.href=`admin-lms-enrollments.html?course=${encoded}`;
    el.cmProgressTab.href=`admin-lms-progress.html?course=${encoded}`;
    el.cmCertificatesTab.href=`admin-lms-certificates.html?course=${encoded}`;
    el.cmQuickLessons.href=`admin-lms-lesson-builder.html?course=${encoded}`;
    el.cmQuickEnrollments.href=`admin-lms-enrollments.html?course=${encoded}`;
    el.cmQuickProgress.href=`admin-lms-progress.html?course=${encoded}`;
    el.cmQuickCertificates.href=`admin-lms-certificates.html?course=${encoded}`;

    const status=String(c.status||"").toLowerCase();
    el.cmPublish.disabled=status==="archived";
    el.cmPublish.textContent=status==="published"?"Unpublish Course":"Publish Course";
    el.cmArchive.disabled=status==="archived";

    const courseSections=sections.filter(s=>s.course_id===id).sort((a,b)=>Number(a.sort_order||0)-Number(b.sort_order||0));
    const sectionIds=new Set(courseSections.map(s=>s.id));
    const courseLessons=lessons.filter(l=>sectionIds.has(l.section_id));
    const courseEnrollments=enrollments.filter(e=>e.course_id===id);
    const completed=courseEnrollments.filter(e=>String(e.status||"").toLowerCase()==="completed").length;
    const rate=courseEnrollments.length?Math.round((completed/courseEnrollments.length)*100):0;

    el.cmSummarySections.textContent=courseSections.length.toLocaleString();
    el.cmSummaryLessons.textContent=courseLessons.length.toLocaleString();
    el.cmSummaryEnrollments.textContent=courseEnrollments.length.toLocaleString();
    el.cmSummaryCompleted.textContent=completed.toLocaleString();
    el.cmSummaryRate.textContent=courseEnrollments.length?`${rate}%`:"—";

    renderOutline(courseSections);
}

function renderOutline(courseSections){
    if(!courseSections.length){
        el.cmOutline.innerHTML='<div class="cm-empty">This course has no sections yet. Use <strong>Add Section</strong> to begin building the course structure.</div><div class="cm-add-wrap"><a class="cm-add-btn" style="display:flex;align-items:center;justify-content:center;text-decoration:none" href="'+el.cmAddSection.href+'">+ Add New Section</a></div>';
        return;
    }

    el.cmOutline.innerHTML=courseSections.map((s,index)=>{
        const sectionLessons=lessons.filter(l=>l.section_id===s.id).sort((a,b)=>Number(a.sort_order||0)-Number(b.sort_order||0));
        const lessonHtml=sectionLessons.length?sectionLessons.map(l=>{
            const minutes=Number(l.estimated_minutes||0);
            const meta=[human(l.status),l.is_required?"Required":"Optional",minutes?`${minutes} min`:""].filter(Boolean).join(" · ");
            return `<div class="cm-lesson">
                <div class="cm-lesson-icon">L</div>
                <div class="cm-lesson-copy"><strong>${esc(l.title||"Untitled Lesson")}</strong><small>${esc(meta)}</small></div>
                <a href="admin-lms-lesson-builder.html?lesson=${encodeURIComponent(l.id)}&course=${encodeURIComponent(selectedCourseId)}">Edit</a>
            </div>`;
        }).join(""):'<div class="cm-empty" style="padding:14px 0">No lessons in this section.</div>';

        return `<section class="cm-section">
            <header class="cm-section-head">
                <span class="cm-section-num">${String(index+1).padStart(2,"0")}</span>
                <div class="cm-section-copy"><strong>${esc(s.title||"Untitled Section")}</strong><small>${sectionLessons.length} lesson${sectionLessons.length===1?"":"s"} · ${s.is_published?"Published":"Not published"}</small></div>
                <a class="cm-btn" style="min-height:30px;padding:0 9px;font-size:8px" href="admin-lms-course-builder.html?course=${encodeURIComponent(selectedCourseId)}&section=${encodeURIComponent(s.id)}#sections">Edit Section</a>
            </header>
            <div class="cm-lessons">${lessonHtml}<div class="cm-add-wrap"><a href="admin-lms-lesson-builder.html?course=${encodeURIComponent(selectedCourseId)}&section=${encodeURIComponent(s.id)}" style="color:var(--cm-orange);font-size:8px;font-weight:900;text-decoration:none">+ Add Lesson</a></div></div>
        </section>`;
    }).join("")+`<div class="cm-add-wrap"><a class="cm-add-btn" style="display:flex;align-items:center;justify-content:center;text-decoration:none" href="${el.cmAddSection.href}">+ Add New Section</a></div>`;
}

function renderNoCourses(){
    selectedCourseId="";
    el.cmCourseTitle.textContent="No Courses Available";
    el.cmCourseDescription.textContent="There are currently no LMS course records. Create your first course to begin building the Learning Center.";
    el.cmStatus.textContent="No Course Selected";
    el.cmStatus.className="cm-badge";
    el.cmUpdated.textContent="—";
    el.cmPublish.disabled=true; el.cmArchive.disabled=true;
    ["cmSummarySections","cmSummaryLessons","cmSummaryEnrollments","cmSummaryCompleted","cmSummaryRate"].forEach(k=>el[k].textContent="—");
    el.cmOutline.innerHTML='<div class="cm-empty">No courses were found in Supabase.<br><br><a class="cm-btn orange" href="admin-lms-course-builder.html">Create Your First Course</a></div>';
}

async function togglePublish(){
    const c=courseMap.get(selectedCourseId); if(!c)return;
    const current=String(c.status||"").toLowerCase();
    const next=current==="published"?"draft":"published";
    const original=el.cmPublish.textContent;
    el.cmPublish.disabled=true; el.cmPublish.textContent="Saving...";
    try{
        const patch={status:next,updated_at:new Date().toISOString()};
        if(next==="published"&&!c.published_at)patch.published_at=new Date().toISOString();
        const {data,error}=await client.from("lms_courses").update(patch).eq("id",c.id).select("id,status,published_at,updated_at").single();
        if(error)throw error;
        Object.assign(c,data);
        renderCourse(c.id);
        show(next==="published"?"Course published.":"Course returned to draft.","ok");
    }catch(error){
        console.error(error); show(error.message||"Unable to update course status.","error");
        el.cmPublish.disabled=false; el.cmPublish.textContent=original;
    }
}

async function archiveCourse(){
    const c=courseMap.get(selectedCourseId); if(!c)return;
    if(!(await window.S4UUI.confirm(`Archive "${c.title||"this course"}"?`,{title:"Archive Course",confirmText:"Archive Course"})))return;
    el.cmArchive.disabled=true; el.cmArchive.textContent="Archiving...";
    try{
        const {data,error}=await client.from("lms_courses").update({status:"archived",updated_at:new Date().toISOString()}).eq("id",c.id).select("id,status,updated_at").single();
        if(error)throw error;
        Object.assign(c,data);
        renderCourse(c.id);
        fillCourseSelect();
        show("Course archived.","ok");
    }catch(error){
        console.error(error); show(error.message||"Unable to archive course.","error");
        el.cmArchive.disabled=false; el.cmArchive.textContent="Archive Course";
    }
}

function show(text,type="ok"){
    el.cmMessage.textContent=text; el.cmMessage.className=`cm-message show ${type}`;
    clearTimeout(show.timer); show.timer=setTimeout(()=>{el.cmMessage.className="cm-message";},5000);
}
function human(v){return String(v||"—").replace(/_/g," ").replace(/\b\w/g,c=>c.toUpperCase());}
function dateTime(v){if(!v)return"—";const d=new Date(v);return Number.isNaN(d.getTime())?"—":d.toLocaleString(undefined,{year:"numeric",month:"short",day:"numeric",hour:"numeric",minute:"2-digit"});}
function esc(v){return String(v??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");}
})();
