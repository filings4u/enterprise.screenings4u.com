/* screenings4u — admin-lms-lesson-builder.js */
(() => {
"use strict";

let client=null, lessonId="", courseId="", sectionId="", lesson=null;
let courses=[], sections=[], media=[], contentBlocks=[];
const el={};

document.addEventListener("DOMContentLoaded",init);

async function init(){
    cache();bind();
    try{
        client=await waitForClient();
        if(!client)throw new Error("Supabase client was not found.");
        await requireSession();
        const params=new URLSearchParams(location.search);
        lessonId=params.get("lesson")||"";
        courseId=params.get("course")||"";
        sectionId=params.get("section")||"";
        await loadReferenceData();
        if(lessonId)await loadLesson();
        else{
            if(courseId)el.lbCourse.value=courseId;
            await fillSections(courseId);
            if(sectionId)el.lbSection.value=sectionId;
            renderSummary();
            updateLinks();
        }
    }catch(error){
        console.error(error);show(error.message||"Unable to load lesson builder.","error");
    }
}

function cache(){
    ["lbHeading","lbMessage","lbForm","lbTitle","lbCourse","lbSection","lbStatus","lbOrder","lbMinutes","lbDescription","lbContent",
     "lbVideoMedia","lbCloudflareUid","lbVideoPreview","lbResourceUpload","lbResourceList","lbRequired","lbCompletionRequired","lbLockPrevious",
     "lbSummaryMode","lbSummaryStatus","lbSummarySection","lbSummaryResources","lbSummarySaved","lbSave","lbSaveBottom","lbPublishBottom",
     "lbDelete","lbCourseManager","lbBackCourse"].forEach(id=>el[id]=document.getElementById(id));
}

function bind(){
    el.lbCourse.addEventListener("change",async()=>{courseId=el.lbCourse.value;await fillSections(courseId);updateLinks();renderSummary();});
    el.lbSection.addEventListener("change",()=>{sectionId=el.lbSection.value;renderSummary();});
    el.lbStatus.addEventListener("change",renderSummary);
    el.lbForm.addEventListener("submit",e=>{e.preventDefault();saveLesson(false);});
    el.lbSaveBottom.addEventListener("click",()=>saveLesson(false));
    el.lbPublishBottom.addEventListener("click",()=>saveLesson(true));
    el.lbDelete.addEventListener("click",deleteLesson);
    el.lbVideoMedia.addEventListener("change",renderVideoPreview);
    el.lbCloudflareUid.addEventListener("input",renderVideoPreview);
    el.lbResourceUpload.addEventListener("change",async e=>{
        const files=[...(e.target.files||[])];
        if(files.length)await uploadResources(files);
        e.target.value="";
    });
    document.querySelectorAll("[data-command]").forEach(button=>button.addEventListener("click",async()=>{
        const command=button.dataset.command;
        if(command==="createLink"){
            const url=await window.S4UUI.prompt("Enter the link URL:",{title:"Add Link",label:"URL",confirmText:"Add Link"});
            if(url)document.execCommand(command,false,url);
        }else document.execCommand(command,false,null);
        el.lbContent.focus();
    }));
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
    }return null;
}
async function requireSession(){
    if(window.S4UAuth?.requireSession){const s=await window.S4UAuth.requireSession("admin-login.html");if(!s)throw new Error("Authentication required.");return;}
    const {data,error}=await client.auth.getSession();if(error)throw error;if(!data?.session?.user){location.replace("admin-login.html");throw new Error("Authentication required.");}
}

async function loadReferenceData(){
    const [{data:c,error:ce},{data:s,error:se},{data:m,error:me}]=await Promise.all([
        client.from("lms_courses").select("id,title,status").order("title"),
        client.from("lms_sections").select("id,course_id,title,sort_order,is_published").order("sort_order"),
        client.from("lms_media").select("id,media_type,original_filename,title,provider,provider_video_id,playback_url,storage_bucket,storage_path,mime_type").order("created_at",{ascending:false})
    ]);
    if(ce)throw ce;if(se)throw se;if(me)throw me;
    courses=c||[];sections=s||[];media=m||[];
    el.lbCourse.innerHTML='<option value="">Select course</option>'+courses.map(x=>`<option value="${esc(x.id)}">${esc(x.title||"Untitled Course")}</option>`).join("");
    fillVideoMedia();
}

async function fillSections(id){
    const list=sections.filter(x=>x.course_id===id);
    el.lbSection.innerHTML='<option value="">Select section</option>'+list.map(x=>`<option value="${esc(x.id)}">${esc(x.title||"Untitled Section")}</option>`).join("");
    if(sectionId&&list.some(x=>x.id===sectionId))el.lbSection.value=sectionId;
}

function fillVideoMedia(){
    const videos=media.filter(m=>String(m.media_type).toLowerCase()==="video");
    el.lbVideoMedia.innerHTML='<option value="">No video</option>'+videos.map(m=>`<option value="${esc(m.id)}">${esc(m.title||m.original_filename||m.provider_video_id||"Video")}</option>`).join("");
}

async function loadLesson(){
    const {data,error}=await client.from("lms_lessons").select("*").eq("id",lessonId).single();
    if(error)throw error;
    lesson=data;
    sectionId=lesson.section_id;
    const section=sections.find(s=>s.id===sectionId);
    courseId=section?.course_id||courseId;
    await fillSections(courseId);
    el.lbCourse.value=courseId;
    el.lbSection.value=sectionId;
    el.lbHeading.textContent="Edit Lesson";
    el.lbTitle.value=lesson.title||"";
    el.lbDescription.value=lesson.description||"";
    el.lbStatus.value=lesson.status||"draft";
    el.lbOrder.value=lesson.sort_order||1;
    el.lbMinutes.value=lesson.estimated_minutes??"";
    el.lbRequired.checked=lesson.is_required!==false;
    el.lbCompletionRequired.checked=lesson.completion_required!==false;
    el.lbLockPrevious.checked=!!lesson.lock_until_previous_complete;
    el.lbDelete.disabled=false;
    await loadBlocks();
    renderSummary();updateLinks();
}

async function loadBlocks(){
    const {data,error}=await client.from("lms_content_blocks").select("*").eq("lesson_id",lessonId).order("sort_order");
    if(error)throw error;
    contentBlocks=data||[];
    const text=contentBlocks.find(b=>b.block_type==="text");
    el.lbContent.innerHTML=text?.content||"";
    const video=contentBlocks.find(b=>b.block_type==="video");
    if(video?.media_id)el.lbVideoMedia.value=video.media_id;
    if(video?.settings?.cloudflare_uid)el.lbCloudflareUid.value=video.settings.cloudflare_uid;
    renderVideoPreview();
    await renderResources();
}

async function saveLesson(publish){
    if(!el.lbForm.reportValidity())return;
    const section=el.lbSection.value;
    if(!section)return show("Select a section for this lesson.","error");
    const payload={
        section_id:section,
        title:el.lbTitle.value.trim(),
        description:el.lbDescription.value.trim()||null,
        status:publish?"published":el.lbStatus.value,
        sort_order:Number(el.lbOrder.value)||1,
        is_required:el.lbRequired.checked,
        completion_required:el.lbCompletionRequired.checked,
        lock_until_previous_complete:el.lbLockPrevious.checked,
        estimated_minutes:el.lbMinutes.value===""?null:Number(el.lbMinutes.value),
        updated_at:new Date().toISOString()
    };
    const buttons=[el.lbSave,el.lbSaveBottom,el.lbPublishBottom];buttons.forEach(b=>b.disabled=true);
    try{
        let result;
        if(lessonId)result=await client.from("lms_lessons").update(payload).eq("id",lessonId).select("*").single();
        else{
            payload.created_at=new Date().toISOString();
            result=await client.from("lms_lessons").insert(payload).select("*").single();
        }
        if(result.error)throw result.error;
        lesson=result.data;lessonId=lesson.id;sectionId=lesson.section_id;
        const sec=sections.find(s=>s.id===sectionId);courseId=sec?.course_id||courseId;
        await savePrimaryContentBlock();
        await saveVideoBlock();
        const url=new URL(location.href);url.searchParams.set("lesson",lessonId);url.searchParams.set("course",courseId);url.searchParams.set("section",sectionId);history.replaceState({},"",url);
        el.lbHeading.textContent="Edit Lesson";el.lbDelete.disabled=false;el.lbStatus.value=lesson.status;
        renderSummary();updateLinks();show(publish?"Lesson published successfully.":"Lesson saved successfully.","ok");
    }catch(error){console.error(error);show(error.message||"Unable to save lesson.","error");}
    finally{buttons.forEach(b=>b.disabled=false);}
}

async function savePrimaryContentBlock(){
    const content=el.lbContent.innerHTML.trim();
    const existing=contentBlocks.find(b=>b.block_type==="text");
    if(existing){
        const {data,error}=await client.from("lms_content_blocks").update({content,updated_at:new Date().toISOString()}).eq("id",existing.id).select("*").single();
        if(error)throw error;Object.assign(existing,data);
    }else if(content){
        const {data,error}=await client.from("lms_content_blocks").insert({lesson_id:lessonId,block_type:"text",title:"Lesson Content",sort_order:1,content,is_required:true}).select("*").single();
        if(error)throw error;contentBlocks.push(data);
    }
}

async function saveVideoBlock(){
    let mediaId=el.lbVideoMedia.value||null;
    const uid=el.lbCloudflareUid.value.trim();
    if(uid&&!mediaId){
        let found=media.find(m=>m.provider==="cloudflare_stream"&&m.provider_video_id===uid);
        if(!found){
            const {data:userData}=await client.auth.getUser();
            const {data,error}=await client.from("lms_media").insert({
                uploaded_by:userData?.user?.id||null,media_type:"video",original_filename:`cloudflare-${uid}`,
                storage_bucket:"lms-media",storage_path:`cloudflare/${uid}`,title:`Cloudflare Stream ${uid}`,
                provider:"cloudflare_stream",provider_video_id:uid,provider_status:"ready",
                metadata:{source:"lesson_builder"}
            }).select("*").single();
            if(error)throw error;found=data;media.unshift(found);fillVideoMedia();
        }
        mediaId=found.id;el.lbVideoMedia.value=mediaId;
    }

    const existing=contentBlocks.find(b=>b.block_type==="video");
    if(!mediaId&&!uid){
        if(existing){
            const {error}=await client.from("lms_content_blocks").delete().eq("id",existing.id);if(error)throw error;
            contentBlocks=contentBlocks.filter(x=>x.id!==existing.id);
        }
        return;
    }
    const patch={lesson_id:lessonId,block_type:"video",title:"Lesson Video",sort_order:2,media_id:mediaId,settings:{cloudflare_uid:uid||null},is_required:el.lbCompletionRequired.checked,updated_at:new Date().toISOString()};
    if(existing){
        const {data,error}=await client.from("lms_content_blocks").update(patch).eq("id",existing.id).select("*").single();
        if(error)throw error;Object.assign(existing,data);
    }else{
        patch.created_at=new Date().toISOString();
        const {data,error}=await client.from("lms_content_blocks").insert(patch).select("*").single();
        if(error)throw error;contentBlocks.push(data);
    }
    renderVideoPreview();
}

function renderVideoPreview(){
    const selected=media.find(m=>m.id===el.lbVideoMedia.value);
    const uid=el.lbCloudflareUid.value.trim()||selected?.provider_video_id||"";
    if(selected||uid){
        el.lbVideoPreview.innerHTML=`<div><strong>${esc(selected?.title||"Cloudflare Stream Video")}</strong><small>${esc(uid?`UID: ${uid}`:"Video media selected")}</small></div>`;
    }else el.lbVideoPreview.innerHTML='<div><strong>No lesson video selected.</strong><small>Select media or enter a Cloudflare Stream UID.</small></div>';
}

async function uploadResources(files){
    if(!lessonId){show("Save the lesson before uploading resources.","error");return;}
    const {data:userData,error:userError}=await client.auth.getUser();if(userError)throw userError;
    show(`Uploading ${files.length} resource${files.length===1?"":"s"}...`,"ok");
    try{
        for(const file of files){
            const ext=(file.name.split(".").pop()||"file").toLowerCase().replace(/[^a-z0-9]/g,"");
            const safe=file.name.replace(/\.[^.]+$/,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"").slice(0,70)||"resource";
            const path=`lesson-resources/${lessonId}/${Date.now()}-${crypto.randomUUID()}-${safe}.${ext}`;
            const {error:upErr}=await client.storage.from("lms-media").upload(path,file,{contentType:file.type||undefined,upsert:false});
            if(upErr)throw upErr;
            const type=mediaType(file.type);
            const {data:m,error:mErr}=await client.from("lms_media").insert({
                uploaded_by:userData?.user?.id||null,media_type:type,original_filename:file.name,storage_bucket:"lms-media",storage_path:path,
                mime_type:file.type||null,file_size_bytes:file.size,title:file.name.replace(/\.[^.]+$/,""),provider:"supabase_storage",
                metadata:{source:"lesson_builder",lesson_id:lessonId}
            }).select("*").single();
            if(mErr)throw mErr;
            media.unshift(m);
            const nextOrder=Math.max(2,...contentBlocks.map(b=>Number(b.sort_order||0)))+1;
            const {data:block,error:bErr}=await client.from("lms_content_blocks").insert({
                lesson_id:lessonId,block_type:"download",title:m.title||file.name,sort_order:nextOrder,media_id:m.id,is_required:false,
                settings:{original_filename:file.name}
            }).select("*").single();
            if(bErr)throw bErr;
            contentBlocks.push(block);
        }
        await renderResources();renderSummary();show("Lesson resources uploaded successfully.","ok");
    }catch(error){console.error(error);show(error.message||"Unable to upload lesson resources.","error");}
}

async function renderResources(){
    const resources=contentBlocks.filter(b=>b.block_type==="download");
    el.lbSummaryResources.textContent=String(resources.length);
    if(!resources.length){
        el.lbResourceList.innerHTML='<div class="lb-help">No lesson resources attached.</div>';return;
    }
    el.lbResourceList.innerHTML=resources.map(b=>{
        const m=media.find(x=>x.id===b.media_id);
        return `<div class="lb-resource-row"><div class="lb-resource-icon">${esc((m?.mime_type||"FILE").includes("pdf")?"PDF":"FILE")}</div><div class="lb-resource-copy"><strong>${esc(b.title||m?.original_filename||"Resource")}</strong><small>${esc(m?.original_filename||"Supporting resource")}</small></div><button class="lb-btn lb-mini danger" type="button" data-remove-resource="${esc(b.id)}">Remove</button></div>`;
    }).join("");
    el.lbResourceList.querySelectorAll("[data-remove-resource]").forEach(btn=>btn.addEventListener("click",()=>removeResource(btn.dataset.removeResource)));
}

async function removeResource(blockId){
    const block=contentBlocks.find(b=>b.id===blockId);if(!block)return;
    if(!(await window.S4UUI.confirm("Remove this lesson resource?",{title:"Remove Resource",confirmText:"Remove Resource"})))return;
    const {error}=await client.from("lms_content_blocks").delete().eq("id",blockId);if(error)return show(error.message,"error");
    contentBlocks=contentBlocks.filter(b=>b.id!==blockId);await renderResources();renderSummary();show("Resource removed.","ok");
}

async function deleteLesson(){
    if(!lessonId)return;
    if(!(await window.S4UUI.confirm(`Delete "${lesson?.title||"this lesson"}"? This also removes its content blocks.`,{title:"Delete Lesson",confirmText:"Delete Lesson",type:"error"})))return;
    try{
        const {error}=await client.from("lms_lessons").delete().eq("id",lessonId);
        if(error)throw error;
        location.href=courseId?`admin-lms-course-manager.html?course=${encodeURIComponent(courseId)}`:"admin-lms-courses.html";
    }catch(error){show(error.message||"Unable to delete lesson.","error");}
}

function updateLinks(){
    const c=courseId||el.lbCourse.value;
    if(c){
        const e=encodeURIComponent(c);
        el.lbCourseManager.href=`admin-lms-course-manager.html?course=${e}`;
        el.lbBackCourse.href=`admin-lms-course-builder.html?course=${e}#curriculum`;
    }
}

function renderSummary(){
    el.lbSummaryMode.textContent=lessonId?"Editing Existing Lesson":"New Lesson";
    el.lbSummaryStatus.textContent=human(el.lbStatus.value||lesson?.status||"draft");
    el.lbSummarySection.textContent=sections.find(s=>s.id===el.lbSection.value)?.title||"—";
    el.lbSummaryResources.textContent=String(contentBlocks.filter(b=>b.block_type==="download").length);
    el.lbSummarySaved.textContent=lesson?.updated_at?dateTime(lesson.updated_at):"Not saved";
}

function mediaType(mime){
    if(String(mime).startsWith("image/"))return"image";
    if(String(mime).startsWith("audio/"))return"audio";
    if(String(mime).startsWith("video/"))return"video";
    if(mime==="application/pdf")return"pdf";
    if(String(mime).includes("word")||String(mime).includes("excel")||String(mime).includes("sheet"))return"document";
    return"other";
}
function show(text,type="ok"){el.lbMessage.textContent=text;el.lbMessage.className=`lb-message show ${type}`;clearTimeout(show.timer);show.timer=setTimeout(()=>el.lbMessage.className="lb-message",5500);}
function human(v){return String(v||"—").replace(/_/g," ").replace(/\b\w/g,c=>c.toUpperCase());}
function dateTime(v){if(!v)return"—";const d=new Date(v);return Number.isNaN(d.getTime())?"—":d.toLocaleString(undefined,{year:"numeric",month:"short",day:"numeric",hour:"numeric",minute:"2-digit"});}
function esc(v){return String(v??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");}
})();
