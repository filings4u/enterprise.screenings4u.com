(()=>{"use strict";

const state={
  db:null,
  user:null,
  certificates:[],
  completedCourses:[],
  mediaById:new Map()
};

const $=id=>document.getElementById(id);

document.addEventListener("DOMContentLoaded",init);

async function init(){
  $("cert-search")?.addEventListener("input",render);
  $("modal-close")?.addEventListener("click",closeModal);

  try{
    state.db=window.getScreenings4uSupabase
      ? await window.getScreenings4uSupabase()
      : window.screenings4uSupabase;

    if(!state.db) throw new Error("Supabase client is unavailable.");

    await loadCertificates();
  }catch(error){
    console.error("[Employee Certificates]",error);
    showModal("Certificates Unavailable",error?.message||"Unable to load your certificates.");
  }
}

async function loadCertificates(){
  const {data:{user},error:userError}=await state.db.auth.getUser();
  if(userError) throw userError;
  if(!user) throw new Error("Your employee session has expired. Please sign in again.");

  state.user=user;

  const {data:enrollments,error:enrollmentError}=await state.db
    .from("lms_enrollments")
    .select("id,course_id,status,progress_percent,completed_at")
    .eq("user_id",user.id);

  if(enrollmentError) throw enrollmentError;

  const enrollmentRows=enrollments||[];
  const enrollmentIds=enrollmentRows.map(row=>row.id);
  const courseIds=[...new Set(enrollmentRows.map(row=>row.course_id).filter(Boolean))];

  let coursesById=new Map();

  if(courseIds.length){
    const {data:courses,error:courseError}=await state.db
      .from("lms_courses")
      .select("id,title,slug,certificate_enabled,status")
      .in("id",courseIds);

    if(courseError) throw courseError;
    coursesById=new Map((courses||[]).map(course=>[course.id,course]));
  }

  state.completedCourses=enrollmentRows.filter(row=>{
    const course=coursesById.get(row.course_id);
    const completed=
      !!row.completed_at ||
      Number(row.progress_percent||0)>=100 ||
      String(row.status||"").toLowerCase()==="completed";

    return completed && course?.certificate_enabled===true;
  });

  if(!enrollmentIds.length){
    state.certificates=[];
    render();
    return;
  }

  const {data:certificates,error:certError}=await state.db
    .from("lms_certificates")
    .select("id,enrollment_id,certificate_number,status,issued_at,revoked_at,certificate_media_id,metadata,created_at")
    .in("enrollment_id",enrollmentIds)
    .order("issued_at",{ascending:false,nullsFirst:false});

  if(certError) throw certError;

  const certRows=(certificates||[]).filter(row=>{
    return !row.revoked_at && String(row.status||"").toLowerCase()!=="revoked";
  });

  const mediaIds=[...new Set(certRows.map(row=>row.certificate_media_id).filter(Boolean))];

  if(mediaIds.length){
    const {data:mediaRows,error:mediaError}=await state.db
      .from("lms_media")
      .select("id,storage_bucket,storage_path,original_filename,mime_type,title")
      .in("id",mediaIds);

    if(mediaError) throw mediaError;
    state.mediaById=new Map((mediaRows||[]).map(row=>[row.id,row]));
  }else{
    state.mediaById=new Map();
  }

  const enrollmentById=new Map(enrollmentRows.map(row=>[row.id,row]));

  state.certificates=certRows.map(cert=>{
    const enrollment=enrollmentById.get(cert.enrollment_id)||{};
    const course=coursesById.get(enrollment.course_id)||{};
    const media=state.mediaById.get(cert.certificate_media_id)||null;

    return {
      id:cert.id,
      certificate_number:cert.certificate_number||"",
      issued_at:cert.issued_at||cert.created_at||null,
      course_title:course.title||"Training Certificate",
      course_slug:course.slug||"",
      media
    };
  });

  render();
}

function render(){
  const query=($("cert-search")?.value||"").trim().toLowerCase();

  const filtered=state.certificates.filter(cert=>{
    const haystack=`${cert.course_title} ${cert.certificate_number}`.toLowerCase();
    return haystack.includes(query);
  });

  const recent=state.certificates.filter(cert=>{
    if(!cert.issued_at) return false;
    const issued=new Date(cert.issued_at).getTime();
    return Number.isFinite(issued) && Date.now()-issued<=30*86400000;
  }).length;

  setText("cert-total",state.certificates.length);
  setText("cert-recent",recent);
  setText("training-completed",state.completedCourses.length);

  const grid=$("cert-list");
  const empty=$("cert-empty");

  grid.innerHTML=filtered.map(card).join("");
  grid.hidden=!filtered.length;
  empty.hidden=!!filtered.length;

  grid.querySelectorAll("[data-view]").forEach(button=>{
    button.addEventListener("click",()=>openCertificate(button.dataset.view));
  });

  grid.querySelectorAll("[data-download]").forEach(button=>{
    button.addEventListener("click",()=>downloadCertificate(button.dataset.download));
  });
}

function card(cert){
  return `
    <article class="employee-certificate-card">
      <div class="employee-certificate-card-top">
        <div class="employee-certificate-card-icon">✓</div>
        <div class="employee-certificate-card-title">
          <h3>${esc(cert.course_title)}</h3>
          <p>Successfully completed training</p>
        </div>
      </div>

      <div class="employee-certificate-meta">
        <div>
          <small>Issued</small>
          <strong>${esc(formatDate(cert.issued_at))}</strong>
        </div>

        <div>
          <small>Certificate ID</small>
          <strong>${esc(cert.certificate_number||"Available in record")}</strong>
        </div>
      </div>

      <div class="employee-certificate-actions">
        <button class="employee-certificate-view"
                data-view="${esc(cert.id)}"
                type="button">
          View Certificate
        </button>

        <button class="employee-certificate-download"
                data-download="${esc(cert.id)}"
                type="button">
          Download
        </button>
      </div>
    </article>
  `;
}

async function getSignedCertificateUrl(cert){
  if(!cert?.media?.storage_bucket || !cert?.media?.storage_path){
    return null;
  }

  const {data,error}=await state.db.storage
    .from(cert.media.storage_bucket)
    .createSignedUrl(cert.media.storage_path,300);

  if(error) throw error;
  return data?.signedUrl||null;
}

async function openCertificate(id){
  const cert=state.certificates.find(item=>String(item.id)===String(id));

  if(!cert){
    showModal("Certificate Access","This certificate could not be found.");
    return;
  }

  try{
    const url=await getSignedCertificateUrl(cert);

    if(!url){
      showModal("Certificate Recorded","This certificate is recorded in your account, but no certificate file is attached yet.");
      return;
    }

    window.open(url,"_blank","noopener");
  }catch(error){
    console.error("[Employee Certificates] open",error);
    showModal("Unable to Open Certificate",error?.message||"The certificate file could not be opened.");
  }
}

async function downloadCertificate(id){
  const cert=state.certificates.find(item=>String(item.id)===String(id));

  if(!cert){
    showModal("Certificate Download","This certificate could not be found.");
    return;
  }

  try{
    const url=await getSignedCertificateUrl(cert);

    if(!url){
      showModal("Certificate Recorded","This certificate is recorded in your account, but no downloadable file is attached yet.");
      return;
    }

    const anchor=document.createElement("a");
    anchor.href=url;
    anchor.download=cert.media?.original_filename||`${cert.course_title||"certificate"}.pdf`;
    anchor.target="_blank";
    anchor.rel="noopener";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  }catch(error){
    console.error("[Employee Certificates] download",error);
    showModal("Unable to Download Certificate",error?.message||"The certificate file could not be downloaded.");
  }
}

function formatDate(value){
  if(!value) return "Not available";
  const date=new Date(value);
  return Number.isNaN(date.getTime()) ? "Not available" : date.toLocaleDateString();
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
  setText("modal-title",title);
  setText("modal-message",message);
  $("cert-modal").hidden=false;
}

function closeModal(){
  $("cert-modal").hidden=true;
}

})();