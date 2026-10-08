/* ============================================================
   SCREENINGS4U — ADMIN LMS ASSESSMENT BUILDER
   Live assessment, question, and answer-option management
   ============================================================ */
(() => {
"use strict";

let client=null, assessmentId="", courseId="", sectionId="", lessonId="", assessment=null, editState=null;
let courses=[], sections=[], lessons=[], questions=[], options=[];
const el={};

document.addEventListener("DOMContentLoaded",init);

async function init(){
    cache();bind();
    try{
        client=await waitForClient();
        if(!client)throw new Error("Supabase client was not found.");
        await requireSession();

        const params=new URLSearchParams(location.search);
        assessmentId=params.get("assessment")||"";
        courseId=params.get("course")||"";
        sectionId=params.get("section")||"";
        lessonId=params.get("lesson")||"";

        await loadReferenceData();
        updateLinks();

        if(assessmentId){
            await loadAssessment();
            await loadAssessmentEditState();
            if(editState?.locked)await offerSafeRevision();
        }
        else{
            if(courseId&&courses.some(c=>c.id===courseId)){
                el.abCourse.value=courseId;
                fillSections(courseId);
            }else if(courses.length===1){
                courseId=courses[0].id;
                el.abCourse.value=courseId;
                fillSections(courseId);
            }else{
                fillSections("");
            }

            if(sectionId&&sections.some(s=>s.id===sectionId&&s.course_id===courseId)){
                el.abSection.value=sectionId;
            }else{
                const courseSections=sections.filter(s=>s.course_id===courseId);
                if(courseSections.length===1){
                    sectionId=courseSections[0].id;
                    el.abSection.value=sectionId;
                }
            }

            fillLessons(sectionId);

            if(lessonId&&lessons.some(l=>l.id===lessonId&&l.section_id===sectionId)){
                el.abLesson.value=lessonId;
            }

            addQuestion();
            renderSummary();
            updateLinks();
            updateAvailability();
        }
    }catch(error){
        console.error(error);show(error.message||"Unable to load assessment builder.","error");
    }
}

function cache(){
    ["abHeading","abMessage","abForm","abTitle","abCourse","abSection","abLesson","abLessonHelp","abType","abStatus","abDescription","abQuestionList","abEmpty","abAddQuestion",
     "abPassingScore","abMaxAttempts","abTimeLimit","abRandomQuestions","abRandomOptions","abShowAnswers","abRequirePass",
     "abSummaryMode","abSummaryStatus","abSummaryQuestions","abSummaryPoints","abSummarySaved","abSave","abSaveBottom","abPublishBottom",
     "abDelete","abCourseManager","abBackCourse","abCreateLesson"].forEach(id=>el[id]=document.getElementById(id));
}

function bind(){
    el.abCourse.addEventListener("change",()=>{
        courseId=el.abCourse.value;
        sectionId="";
        lessonId="";
        fillSections(courseId);
        fillLessons("");
        updateLinks();
        updateAvailability();
    });
    el.abSection.addEventListener("change",()=>{
        sectionId=el.abSection.value;
        lessonId="";
        fillLessons(sectionId);
        updateLinks();
        updateAvailability();
    });
    el.abLesson.addEventListener("change",()=>{
        lessonId=el.abLesson.value;
        updateLinks();
        updateAvailability();
    });
    el.abStatus.addEventListener("change",renderSummary);
    el.abAddQuestion.addEventListener("click",()=>addQuestion());
    el.abForm.addEventListener("submit",e=>{e.preventDefault();saveAssessment(false);});
    el.abSaveBottom.addEventListener("click",()=>saveAssessment(false));
    el.abPublishBottom.addEventListener("click",()=>saveAssessment(true));
    el.abDelete.addEventListener("click",deleteAssessment);

    el.abQuestionList.addEventListener("input",renderSummary);
    el.abQuestionList.addEventListener("change",event=>{
        const type=event.target.closest(".ab-question-type");
        if(type)handleQuestionType(type.closest(".ab-question"),type.value);
        renderSummary();
    });
    el.abQuestionList.addEventListener("click",event=>{
        const removeQ=event.target.closest("[data-remove-question]");
        if(removeQ){removeQ.closest(".ab-question").remove();updateQuestionNumbers();renderSummary();return;}
        const addOpt=event.target.closest("[data-add-option]");
        if(addOpt){addOption(addOpt.closest(".ab-question"));renderSummary();return;}
        const removeOpt=event.target.closest("[data-remove-option]");
        if(removeOpt){removeOpt.closest(".ab-option").remove();renderSummary();}
    });
    el.abQuestionList.addEventListener("dragover",event=>{
        event.preventDefault();
        const dragging=el.abQuestionList.querySelector(".dragging");if(!dragging)return;
        const after=[...el.abQuestionList.querySelectorAll(".ab-question:not(.dragging)")].find(node=>{
            const r=node.getBoundingClientRect();return event.clientY<r.top+r.height/2;
        });
        if(after)el.abQuestionList.insertBefore(dragging,after);else el.abQuestionList.appendChild(dragging);
    });
}

async function waitForClient(timeout=3500){
    const start=Date.now();while(Date.now()-start<timeout){const c=await getClient();if(c?.from)return c;await new Promise(r=>setTimeout(r,75));}return null;
}
async function getClient(){
    try{if(typeof window.getScreenings4uSupabase==="function"){const c=await window.getScreenings4uSupabase();if(c?.from)return c;}}catch(_){}
    if(window.screenings4uSupabase?.from)return window.screenings4uSupabase;
    if(window.supabaseClient?.from)return window.supabaseClient;
    if(window.supabase?.createClient&&window.SCREENINGS4U_SUPABASE_URL&&window.SCREENINGS4U_SUPABASE_ANON_KEY){
        window.supabaseClient=window.supabase.createClient(window.SCREENINGS4U_SUPABASE_URL,window.SCREENINGS4U_SUPABASE_ANON_KEY);return window.supabaseClient;
    }
    return null;
}
async function requireSession(){
    if(window.S4UAuth?.requireSession){const s=await window.S4UAuth.requireSession("admin-login.html");if(!s)throw new Error("Authentication required.");return;}
    const {data,error}=await client.auth.getSession();if(error)throw error;if(!data?.session?.user){location.replace("admin-login.html");throw new Error("Authentication required.");}
}

async function loadReferenceData(){
    const [{data:c,error:ce},{data:s,error:se},{data:l,error:le}]=await Promise.all([
        client.from("lms_courses").select("id,title,status").order("title"),
        client.from("lms_sections").select("id,course_id,title,sort_order").order("sort_order"),
        client.from("lms_lessons").select("id,section_id,title,status,sort_order").order("sort_order")
    ]);
    if(ce)throw ce;if(se)throw se;if(le)throw le;
    courses=c||[];sections=s||[];lessons=l||[];
    el.abCourse.innerHTML='<option value="">Select course</option>'+courses.map(x=>`<option value="${esc(x.id)}">${esc(x.title||"Untitled Course")}</option>`).join("");
}

function fillSections(course){
    const list=sections.filter(s=>s.course_id===course);
    el.abSection.innerHTML='<option value="">Select section</option>'+list.map(s=>`<option value="${esc(s.id)}">${esc(s.title||"Untitled Section")}</option>`).join("");
    el.abSection.disabled=!course||!list.length;

    if(sectionId&&list.some(s=>s.id===sectionId)){
        el.abSection.value=sectionId;
    }
}

function fillLessons(section){
    const list=lessons.filter(l=>l.section_id===section);
    el.abLesson.innerHTML='<option value="">Select lesson</option>'+list.map(l=>`<option value="${esc(l.id)}">${esc(l.title||"Untitled Lesson")} · ${esc(human(l.status||"draft"))}</option>`).join("");
    el.abLesson.disabled=!section||!list.length;

    if(lessonId&&list.some(l=>l.id===lessonId)){
        el.abLesson.value=lessonId;
    }

    if(!section){
        el.abLessonHelp.textContent="Select a section to load lessons.";
    }else if(!list.length){
        el.abLessonHelp.textContent="This section has no lessons. Create a lesson before creating an assessment.";
    }else{
        el.abLessonHelp.textContent=`${list.length} lesson${list.length===1?"":"s"} available in this section.`;
    }
}

async function loadAssessment(){
    const {data:a,error:ae}=await client.from("lms_assessments").select("*").eq("id",assessmentId).single();
    if(ae)throw ae;
    assessment=a;lessonId=a.lesson_id;
    const lesson=lessons.find(l=>l.id===lessonId);
    sectionId=lesson?.section_id||"";
    const section=sections.find(s=>s.id===sectionId);
    courseId=section?.course_id||"";

    el.abCourse.value=courseId;
    fillSections(courseId);
    el.abSection.value=sectionId;
    fillLessons(sectionId);
    el.abLesson.value=lessonId;
    el.abHeading.textContent="Edit Assessment";
    el.abTitle.value=a.title||"";
    el.abDescription.value=a.description||"";
    el.abType.value=a.assessment_type||"quiz";
    el.abStatus.value=a.status||"draft";
    el.abPassingScore.value=a.passing_score??80;
    el.abMaxAttempts.value=a.max_attempts??0;
    el.abTimeLimit.value=a.time_limit_minutes??0;
    el.abRandomQuestions.checked=!!a.randomize_questions;
    el.abRandomOptions.checked=!!a.randomize_options;
    el.abShowAnswers.checked=a.show_correct_answers!==false;
    el.abRequirePass.checked=a.require_pass!==false;
    el.abDelete.disabled=false;

    await loadQuestions();
    renderSummary();updateLinks();updateAvailability();
}


async function loadAssessmentEditState(){
    const {data,error}=await client.rpc("enterprise_training_assessment_edit_state",{p_assessment_id:assessmentId});
    if(error)throw error;
    editState=data||null;
}

async function offerSafeRevision(){
    return false;
}

async function loadQuestions(){
    const {data:q,error:qe}=await client.from("lms_assessment_questions").select("*").eq("assessment_id",assessmentId).order("sort_order");
    if(qe)throw qe;
    questions=q||[];
    const ids=questions.map(x=>x.id);
    if(ids.length){
        const {data:o,error:oe}=await client.from("lms_assessment_options").select("*").in("question_id",ids).order("sort_order");
        if(oe)throw oe;options=o||[];
    }else options=[];

    el.abQuestionList.innerHTML="";
    questions.forEach(q=>addQuestion({
        id:q.id,question_text:q.question_text,explanation:q.explanation,question_type:q.question_type,points:q.points,is_required:q.is_required,
        options:options.filter(o=>o.question_id===q.id)
    }));
    updateQuestionNumbers();
}

function addQuestion(data={}){
    const localId=data.id||`local_${crypto.randomUUID()}`;
    const card=document.createElement("article");
    card.className="ab-question";card.draggable=true;card.dataset.questionId=localId;
    card.innerHTML=`<header class="ab-question-head"><span class="ab-drag">⋮⋮</span><span class="ab-number"></span><strong>Assessment Question</strong><button class="ab-icon-btn" data-remove-question type="button" aria-label="Remove question">×</button></header>
    <div class="ab-question-body">
      <div class="ab-question-top">
        <input class="ab-question-text" type="text" placeholder="Enter your question" value="${escAttr(data.question_text||"")}">
        <select class="ab-question-type"><option value="multiple_choice">Multiple Choice</option><option value="true_false">True / False</option></select>
        <input class="ab-points" type="number" min="0.01" step="0.01" value="${escAttr(data.points??1)}" title="Points">
      </div>
      <div class="ab-options"></div>
      <button class="ab-add-option" data-add-option type="button">+ Add Answer Option</button>
      <textarea class="ab-explanation" placeholder="Optional explanation or learner feedback...">${esc(data.explanation||"")}</textarea>
      <label class="ab-required"><input class="ab-is-required" type="checkbox" ${data.is_required===false?"":"checked"}> Required question</label>
    </div>`;
    card.querySelector(".ab-question-type").value=data.question_type||"multiple_choice";
    const optionBox=card.querySelector(".ab-options");
    const supplied=data.options||[];
    if(supplied.length)supplied.forEach(o=>addOption(card,o));
    else if((data.question_type||"multiple_choice")==="true_false"){
        addOption(card,{option_text:"True",is_correct:true});
        addOption(card,{option_text:"False",is_correct:false});
    }else{
        ["","","",""].forEach((_,i)=>addOption(card,{option_text:"",is_correct:i===0}));
    }
    card.addEventListener("dragstart",()=>card.classList.add("dragging"));
    card.addEventListener("dragend",()=>{card.classList.remove("dragging");updateQuestionNumbers();});
    el.abQuestionList.appendChild(card);
    updateQuestionNumbers();renderSummary();
}

function addOption(card,data={}){
    const box=card.querySelector(".ab-options");
    const name=`correct_${card.dataset.questionId}`;
    const row=document.createElement("div");row.className="ab-option";
    row.dataset.optionId=data.id||"";
    row.innerHTML=`<input type="radio" name="${escAttr(name)}" ${data.is_correct?"checked":""} aria-label="Correct answer"><input type="text" value="${escAttr(data.option_text||"")}" placeholder="Answer option"><button class="ab-icon-btn" data-remove-option type="button" aria-label="Remove answer">×</button>`;
    box.appendChild(row);
}

function handleQuestionType(card,type){
    const box=card.querySelector(".ab-options");
    if(type==="true_false"){
        box.innerHTML="";
        addOption(card,{option_text:"True",is_correct:true});
        addOption(card,{option_text:"False",is_correct:false});
        card.querySelector("[data-add-option]").style.display="none";
    }else{
        card.querySelector("[data-add-option]").style.display="";
        if(box.children.length<2){
            box.innerHTML="";
            ["","","",""].forEach((_,i)=>addOption(card,{is_correct:i===0}));
        }
    }
}

function updateQuestionNumbers(){
    const cards=[...el.abQuestionList.querySelectorAll(".ab-question")];
    cards.forEach((c,i)=>c.querySelector(".ab-number").textContent=String(i+1).padStart(2,"0"));
    el.abEmpty.style.display=cards.length?"none":"block";
}

function collectQuestions(){
    const cards=[...el.abQuestionList.querySelectorAll(".ab-question")];
    if(!cards.length)throw new Error("Add at least one assessment question.");
    return cards.map((card,index)=>{
        const questionText=card.querySelector(".ab-question-text").value.trim();
        if(!questionText)throw new Error(`Question ${index+1} needs question text.`);
        const rows=[...card.querySelectorAll(".ab-option")];
        if(rows.length<2)throw new Error(`Question ${index+1} needs at least two answer options.`);
        const opts=rows.map((row,i)=>({
            option_text:row.querySelector('input[type="text"]').value.trim(),
            is_correct:row.querySelector('input[type="radio"]').checked,
            sort_order:i+1
        }));
        if(opts.some(o=>!o.option_text))throw new Error(`Question ${index+1} has a blank answer option.`);
        if(!opts.some(o=>o.is_correct))throw new Error(`Question ${index+1} needs one correct answer.`);
        return {
            question_text:questionText,
            explanation:card.querySelector(".ab-explanation").value.trim()||null,
            question_type:card.querySelector(".ab-question-type").value,
            points:Number(card.querySelector(".ab-points").value)||1,
            sort_order:index+1,
            is_required:card.querySelector(".ab-is-required").checked,
            options:opts
        };
    });
}

async function saveAssessment(publish){
    if(editState?.locked){await offerSafeRevision();return;}
    if(!el.abForm.reportValidity())return;
    if(!el.abCourse.value)return show("Select a course.","error");
    if(!el.abSection.value)return show("Select a section.","error");
    if(!el.abLesson.value)return show("Create or select a lesson before saving an assessment.","error");
    let questionPayload;
    try{questionPayload=collectQuestions();}catch(error){return show(error.message,"error");}

    const payload={
        lesson_id:el.abLesson.value,
        title:el.abTitle.value.trim(),
        description:el.abDescription.value.trim()||null,
        assessment_type:el.abType.value,
        passing_score:Number(el.abPassingScore.value)||0,
        max_attempts:Number(el.abMaxAttempts.value)||0,
        time_limit_minutes:Number(el.abTimeLimit.value)||0,
        status:publish?"published":el.abStatus.value,
        randomize_questions:el.abRandomQuestions.checked,
        randomize_options:el.abRandomOptions.checked,
        show_correct_answers:el.abShowAnswers.checked,
        require_pass:el.abRequirePass.checked,
        updated_at:new Date().toISOString()
    };

    const buttons=[el.abSave,el.abSaveBottom,el.abPublishBottom];buttons.forEach(b=>b.disabled=true);
    try{
        let result;
        if(assessmentId)result=await client.from("lms_assessments").update(payload).eq("id",assessmentId).select("*").single();
        else{
            payload.created_at=new Date().toISOString();
            result=await client.from("lms_assessments").insert(payload).select("*").single();
        }
        if(result.error)throw result.error;
        assessment=result.data;assessmentId=assessment.id;lessonId=assessment.lesson_id;
        await replaceQuestions(questionPayload);

        const lesson=lessons.find(l=>l.id===lessonId);
        sectionId=lesson?.section_id||sectionId;
        const section=sections.find(s=>s.id===sectionId);
        courseId=section?.course_id||courseId;
        const url=new URL(location.href);
        url.searchParams.set("assessment",assessmentId);
        url.searchParams.set("course",courseId);
        url.searchParams.set("section",sectionId);
        url.searchParams.set("lesson",lessonId);
        history.replaceState({},"",url);

        el.abHeading.textContent="Edit Assessment";el.abStatus.value=assessment.status;el.abDelete.disabled=false;
        await loadQuestions();renderSummary();updateLinks();
        show(publish?"Assessment published successfully.":"Assessment saved successfully.","ok");
    }catch(error){
        console.error(error);show(error.message||"Unable to save assessment.","error");
    }finally{buttons.forEach(b=>b.disabled=false);}
}

async function replaceQuestions(items){
    const {error:deleteError}=await client.from("lms_assessment_questions").delete().eq("assessment_id",assessmentId);
    if(deleteError)throw deleteError;

    for(const q of items){
        const {options:opts,...questionData}=q;
        questionData.assessment_id=assessmentId;
        questionData.created_at=new Date().toISOString();
        questionData.updated_at=new Date().toISOString();
        const {data:created,error:qError}=await client.from("lms_assessment_questions").insert(questionData).select("*").single();
        if(qError)throw qError;
        const rows=opts.map(o=>({...o,question_id:created.id,created_at:new Date().toISOString()}));
        const {error:oError}=await client.from("lms_assessment_options").insert(rows);
        if(oError)throw oError;
    }
}

async function deleteAssessment(){
    if(!assessmentId)return;
    if(editState?.locked){await offerSafeRevision();return;}
    if(!(await window.S4UUI.confirm(`Delete "${assessment?.title||"this assessment"}"? All questions and answer options will also be removed.`,{title:"Delete Assessment",confirmText:"Delete Assessment",type:"error"})))return;
    try{
        const {error}=await client.from("lms_assessments").delete().eq("id",assessmentId);
        if(error)throw error;
        location.href="admin-lms-assessments.html";
    }catch(error){show(error.message||"Unable to delete assessment.","error");}
}

function updateLinks(){
    const c=courseId||el.abCourse.value;
    const s=sectionId||el.abSection.value;

    el.abCourseManager.href="admin-lms-course-builder.html";
    el.abBackCourse.href="admin-lms-course-builder.html";
    el.abCreateLesson.href="admin-lms-lesson-builder.html";

    if(c){
        const ce=encodeURIComponent(c);
        el.abCourseManager.href=`admin-lms-course-builder.html?course=${ce}`;
        el.abBackCourse.href=`admin-lms-course-builder.html?course=${ce}#curriculum`;

        if(s){
            el.abCreateLesson.href=`admin-lms-lesson-builder.html?course=${ce}&section=${encodeURIComponent(s)}`;
        }else{
            el.abCreateLesson.href=`admin-lms-lesson-builder.html?course=${ce}`;
        }
    }
}

function updateAvailability(){
    const course=el.abCourse.value;
    const section=el.abSection.value;
    const lesson=el.abLesson.value;
    const sectionLessons=lessons.filter(l=>l.section_id===section);

    el.abCreateLesson.hidden=!course;
    el.abCreateLesson.textContent=section&&sectionLessons.length===0?"Create First Lesson":"Create Lesson";

    const canSave=Boolean(course&&section&&lesson);
    [el.abSave,el.abSaveBottom,el.abPublishBottom].forEach(button=>{
        if(button)button.disabled=!canSave;
    });

    if(course&&section&&!sectionLessons.length){
        show("This section has no lessons yet. Create a lesson first, then return here to build its assessment.","error");
    }
}

function renderSummary(){
    const cards=[...el.abQuestionList.querySelectorAll(".ab-question")];
    const total=cards.reduce((sum,c)=>sum+(Number(c.querySelector(".ab-points")?.value)||0),0);
    el.abSummaryMode.textContent=assessmentId?"Editing Existing Assessment":"New Assessment";
    el.abSummaryStatus.textContent=human(el.abStatus.value||assessment?.status||"draft");
    el.abSummaryQuestions.textContent=String(cards.length);
    el.abSummaryPoints.textContent=String(total);
    el.abSummarySaved.textContent=assessment?.updated_at?dateTime(assessment.updated_at):"Not saved";
}

function show(text,type="ok"){el.abMessage.textContent=text;el.abMessage.className=`ab-message show ${type}`;clearTimeout(show.timer);show.timer=setTimeout(()=>el.abMessage.className="ab-message",6500);}
function human(v){return String(v||"—").replace(/_/g," ").replace(/\b\w/g,c=>c.toUpperCase());}
function dateTime(v){if(!v)return"—";const d=new Date(v);return Number.isNaN(d.getTime())?"—":d.toLocaleString(undefined,{year:"numeric",month:"short",day:"numeric",hour:"numeric",minute:"2-digit"});}
function esc(v){return String(v??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");}
function escAttr(v){return esc(v);}
})();
