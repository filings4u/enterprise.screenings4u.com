(function(){
  'use strict';

  const T={
    courses:'lms_courses', enrollments:'lms_enrollments', profiles:'user_profiles',
    sections:'lms_sections', lessons:'lms_lessons', lessonProgress:'lms_lesson_progress',
    quizAttempts:'lms_quiz_attempts', assessmentAttempts:'lms_assessment_attempts', certificates:'lms_certificates'
  };
  const S={courses:[],enrollments:[],profiles:[],sections:[],lessons:[],lessonProgress:[],quizAttempts:[],assessmentAttempts:[],certificates:[],courseMap:new Map(),profileMap:new Map(),lessonsByCourse:new Map(),courseFilter:'all',statusFilter:'all',search:''};
  const $=id=>document.getElementById(id);

  document.addEventListener('DOMContentLoaded',init);

  function db(){
    const c=[window.supabaseClient,window.supabaseAdmin,window.supabase].find(x=>x&&typeof x.from==='function');
    if(!c) throw new Error('Supabase client is unavailable.');
    return c;
  }
  async function waitForClient(timeout=6000){const st=Date.now();while(Date.now()-st<timeout){try{if(db())return}catch(_){}await new Promise(r=>setTimeout(r,75));}throw new Error('Supabase client is unavailable.');}
  async function requireAdmin(){
    if(window.S4UAuth?.requireSession){const s=await window.S4UAuth.requireSession('admin-login.html');if(!s)throw new Error('Authentication required.');return s;}
    const {data,error}=await db().auth.getSession();if(error)throw error;if(!data?.session?.user){location.replace('admin-login.html');throw new Error('Authentication required.');}return data.session;
  }


  async function report(action,payload={}){
    const {data,error}=await db().auth.getSession();
    if(error)throw error;
    const token=data?.session?.access_token;
    if(!token)throw new Error('Your admin session has expired. Please sign in again.');
    const base=String(window.SCREENINGS4U_SUPABASE_URL||'https://elpbnytpciqnbexiaebp.supabase.co').replace(/\/$/,'');
    const anon=window.SCREENINGS4U_SUPABASE_ANON_KEY||window.SUPABASE_ANON_KEY||'';
    const r=await fetch(base+'/functions/v1/screenings4u-training-reporting',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+token,...(anon?{'apikey':anon}:{})},body:JSON.stringify({action,...payload})});
    const out=await r.json().catch(()=>({}));
    if(!r.ok||out?.error)throw new Error(out?.error||'Training reporting request failed.');
    return out;
  }

  async function init(){
    try{
      bind(); setLoading(true); await waitForClient(); await requireAdmin(); await loadAll(); populateCourses(); applyQueryCourse(); render();
    }catch(e){console.error('[LMS Progress]',e);showError(e?.message||'Unable to load learner progress.');}finally{setLoading(false);}
  }
  function bind(){
    $('search')?.addEventListener('input',e=>{S.search=e.target.value.toLowerCase().trim();renderRows();});
    $('courseFilter')?.addEventListener('change',e=>{S.courseFilter=e.target.value;renderRows();syncUrl();});
    $('statusFilter')?.addEventListener('change',e=>{S.statusFilter=e.target.value;renderRows();});
    $('closeDetail')?.addEventListener('click',()=>{$('detail')?.classList.remove('show');});
    $('exportProgress')?.addEventListener('click',exportCsv);
    $('rows')?.addEventListener('click',e=>{const b=e.target.closest('.invite-btn');if(b)sendAccountInvite(b.dataset.email,b.dataset.name,b);});
  }

  async function safe(table,queryBuilder){
    try{const q=queryBuilder(db().from(table));const r=await q;if(r.error)throw r.error;return r.data||[];}catch(e){console.warn('[LMS Progress] Optional source unavailable:',table,e);return [];}
  }
  async function loadAll(){
    const out=await report('progress');
    S.courses=out.courses||[];
    S.enrollments=out.enrollments||[];
    S.profiles=out.profiles||[];
    S.sections=out.sections||[];
    S.lessons=out.lessons||[];
    S.lessonProgress=out.lesson_progress||[];
    S.quizAttempts=out.quiz_attempts||[];
    S.assessmentAttempts=out.assessment_attempts||[];
    S.certificates=out.certificates||[];
    S.courseMap=new Map(S.courses.map(x=>[x.id,x]));
    S.profileMap=new Map(S.profiles.map(x=>[x.id,x]));
    buildLessonIndex();
  }
  function buildLessonIndex(){
    const sectionCourse=new Map(S.sections.map(s=>[s.id,s.course_id]));
    S.lessonsByCourse=new Map();
    S.lessons.forEach(l=>{
      const cid=l.course_id||sectionCourse.get(l.section_id)||null;if(!cid)return;
      if(!S.lessonsByCourse.has(cid))S.lessonsByCourse.set(cid,[]);S.lessonsByCourse.get(cid).push(l);
    });
  }
  function populateCourses(){
    const sel=$('courseFilter'); if(!sel)return;
    sel.innerHTML='<option value="all">All Courses</option>'+S.courses.map(c=>`<option value="${esc(c.id)}">${esc(c.title||'Untitled Course')}</option>`).join('');
  }
  function applyQueryCourse(){const p=new URLSearchParams(location.search);const c=p.get('course')||p.get('course_id');if(c&&S.courseMap.has(c)){S.courseFilter=c;if($('courseFilter'))$('courseFilter').value=c;}}
  function syncUrl(){const u=new URL(location.href);if(S.courseFilter&&S.courseFilter!=='all')u.searchParams.set('course',S.courseFilter);else u.searchParams.delete('course');history.replaceState({},'',u);}

  function render(){renderStats();renderRows();}
  function enrollmentView(e){
    const p=S.profileMap.get(e.user_id)||{},c=S.courseMap.get(e.course_id)||{};
    const progress=clamp(Number(e.progress_percent||0));
    let status=String(e.status||'').toLowerCase();
    if(e.completed_at||progress>=100||status==='completed')status='completed';
    else if(progress>0||e.started_at)status='active'; else status='pending';
    const lp=S.lessonProgress.filter(x=>x.enrollment_id===e.id);
    const courseLessons=S.lessonsByCourse.get(e.course_id)||[];
    const completedLessons=new Set(lp.filter(isDone).map(x=>x.lesson_id).filter(Boolean));
    const lessonDone=completedLessons.size;
    const lessonTotal=courseLessons.length;
    const quizzes=S.quizAttempts.filter(x=>x.enrollment_id===e.id);
    const assessments=S.assessmentAttempts.filter(x=>x.enrollment_id===e.id);
    const cert=S.certificates.find(x=>x.enrollment_id===e.id&&!x.revoked_at)||null;
    return {e,p,c,progress,status,lessonDone,lessonTotal,lp,quizzes,assessments,cert,last:e.last_activity_at||e.completed_at||e.started_at||e.enrolled_at||null,name:profileName(p)};
  }
  function renderStats(){
    const views=S.enrollments.map(enrollmentView),active=views.filter(x=>x.status==='active').length,completed=views.filter(x=>x.status==='completed').length;
    const avg=views.length?Math.round(views.reduce((n,x)=>n+x.progress,0)/views.length):0;
    const lessons=new Set(S.lessonProgress.filter(isDone).map(x=>`${x.enrollment_id}:${x.lesson_id||x.id}`)).size;
    setText('statActive',active);setText('statAverage',avg+'%');setText('statLessons',lessons);setText('statCompleted',completed);
  }
  function filteredViews(){return S.enrollments.map(enrollmentView).filter(v=>{
    const hay=[v.name,v.p.email,v.p.company_name,v.c.title].filter(Boolean).join(' ').toLowerCase();
    return (!S.search||hay.includes(S.search))&&(S.courseFilter==='all'||v.e.course_id===S.courseFilter)&&(S.statusFilter==='all'||v.status===S.statusFilter);
  });}
  function renderRows(){
    const host=$('rows'),empty=$('empty');if(!host)return;
    const views=filteredViews();
    host.innerHTML=views.map(v=>`<article class="progress-row" data-enrollment="${esc(v.e.id)}"><div class="person"><div class="avatar">${esc(initials(v.name))}</div><div><strong>${esc(v.name)}</strong><span>${esc(v.p.email||'No email on profile')}${v.p.company_name?` · ${esc(v.p.company_name)}`:''}</span></div></div><div class="course"><strong>${esc(v.c.title||'Course')}</strong><span>${v.lessonTotal?`${v.lessonDone} of ${v.lessonTotal} lessons completed`:(v.progress?`${Math.round(v.progress)}% reported by enrollment`:'No lesson activity yet')}</span></div><div class="bar-wrap"><div class="bar-top"><span>Course Progress</span><span>${Math.round(v.progress)}%</span></div><div class="bar"><i style="width:${clamp(v.progress)}%"></i></div></div><div class="activity">${esc(formatRelative(v.last))}<small>${v.status==='completed'?'Completed':'Last activity'}</small></div><div><span class="status ${esc(v.status)}">${esc(statusLabel(v.status))}</span></div><div class="actions"><button type="button" class="action detail-btn" data-id="${esc(v.e.id)}">Details</button>${v.p.email?`<button type="button" class="action invite-btn" data-email="${esc(v.p.email)}" data-name="${esc(v.name)}">Send Account Invite</button>`:''}</div></article>`).join('');
    host.querySelectorAll('.detail-btn').forEach(b=>b.addEventListener('click',()=>openDetail(b.dataset.id)));
    if(empty)empty.style.display=views.length?'none':'block';setText('count',`Showing ${views.length} enrollment${views.length===1?'':'s'} across ${new Set(views.map(x=>x.e.user_id)).size} student${new Set(views.map(x=>x.e.user_id)).size===1?'':'s'}`);
  }
  async function sendAccountInvite(email,name,button){
    if(!email)return;
    const original=button?.textContent||'Send Account Invite';
    try{
      if(button){button.disabled=true;button.textContent='Sending…';}
      const {data:sessionData,error:sessionError}=await db().auth.getSession();
      if(sessionError)throw sessionError;
      const token=sessionData?.session?.access_token;
      if(!token)throw new Error('Your admin session has expired. Please sign in again.');
      const base=String(window.SCREENINGS4U_SUPABASE_URL||'https://elpbnytpciqnbexiaebp.supabase.co').replace(/\/$/,'');
      const anon=window.SCREENINGS4U_SUPABASE_ANON_KEY||window.SUPABASE_ANON_KEY||'';
      const r=await fetch(base+'/functions/v1/send-training-account-setup',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+token,...(anon?{'apikey':anon}:{})},body:JSON.stringify({email})});
      const result=await r.json().catch(()=>({}));
      if(!r.ok)throw new Error(result.error||'Unable to send account invite.');
      showNotice(`Account setup email sent to ${name||email} at ${email}.`,'success');
      if(button)button.textContent='Invite Sent';
      setTimeout(()=>{if(button){button.disabled=false;button.textContent='Resend Invite';}},2200);
    }catch(e){
      console.error('[LMS Progress Invite]',e);
      showNotice(e?.message||'Unable to send account invite.','error');
      if(button){button.disabled=false;button.textContent=original;}
    }
  }
  function showNotice(message,type){
    let n=$('progressNotice');
    if(!n)return;
    n.hidden=false;n.className='progress-notice '+(type||'');n.textContent=message;
    clearTimeout(showNotice.timer);showNotice.timer=setTimeout(()=>{n.hidden=true;},6000);
  }
  function openDetail(id){
    const e=S.enrollments.find(x=>x.id===id);if(!e)return;const v=enrollmentView(e),host=$('moduleList');
    setText('detailTitle',`${v.name} — ${Math.round(v.progress)}% Complete`);setText('detailSub',`${v.c.title||'Course'} · ${statusLabel(v.status)} · enrolled ${formatDate(v.e.enrolled_at)}`);
    const progressByLesson=new Map(v.lp.filter(x=>x.lesson_id).map(x=>[x.lesson_id,x]));
    const lessons=S.lessonsByCourse.get(v.e.course_id)||[];
    const lessonMarkup=lessons.length?lessons.map((l,i)=>{const r=progressByLesson.get(l.id);const done=r&&isDone(r);const started=r&&!done;return `<div class="module"><div class="module-num">${i+1}</div><div><strong>${esc(l.title||`Lesson ${i+1}`)}</strong><span>${esc(lessonMeta(r))}</span></div><span class="module-state ${done?'done':''}">${done?'COMPLETED':started?'IN PROGRESS':'NOT STARTED'}</span></div>`;}).join(''):'<div class="module"><div class="module-num">—</div><div><strong>No lesson records found</strong><span>This course may use enrollment-level progress only.</span></div><span class="module-state">—</span></div>';
    const q=v.quizzes.length?`<div class="module"><div class="module-num">Q</div><div><strong>Quiz Activity</strong><span>${v.quizzes.length} attempt${v.quizzes.length===1?'':'s'} · ${v.quizzes.filter(x=>x.passed===true).length} passed</span></div><span class="module-state">${bestScore(v.quizzes)}</span></div>`:'';
    const a=v.assessments.length?`<div class="module"><div class="module-num">A</div><div><strong>Assessment Activity</strong><span>${v.assessments.length} attempt${v.assessments.length===1?'':'s'}</span></div><span class="module-state">${bestScore(v.assessments)}</span></div>`:'';
    const cert=v.cert?`<div class="module"><div class="module-num">✓</div><div><strong>Certificate</strong><span>${esc(v.cert.certificate_number||'Issued')} · ${esc(formatDate(v.cert.issued_at))}</span></div><span class="module-state done">ISSUED</span></div>`:'';
    if(host)host.innerHTML=lessonMarkup+q+a+cert;$('detail')?.classList.add('show');$('detail')?.scrollIntoView({behavior:'smooth',block:'nearest'});
  }

  function exportCsv(){
    const rows=filteredViews().map(v=>({Student:v.name,Email:v.p.email||'',Company:v.p.company_name||'',Course:v.c.title||'',Status:statusLabel(v.status),Progress:`${Math.round(v.progress)}%`,LessonsCompleted:v.lessonDone,LessonsTotal:v.lessonTotal,LastActivity:v.last||'',EnrolledAt:v.e.enrolled_at||'',CompletedAt:v.e.completed_at||'',Certificate:v.cert?.certificate_number||''}));
    const keys=Object.keys(rows[0]||{Student:'',Email:'',Company:'',Course:'',Status:'',Progress:'',LessonsCompleted:'',LessonsTotal:'',LastActivity:'',EnrolledAt:'',CompletedAt:'',Certificate:''});
    const csv=[keys.join(','),...rows.map(r=>keys.map(k=>csvCell(r[k])).join(','))].join('\r\n');const blob=new Blob([csv],{type:'text/csv;charset=utf-8'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`screenings4u-student-progress-${new Date().toISOString().slice(0,10)}.csv`;a.click();URL.revokeObjectURL(a.href);
  }

  function isDone(x){const s=String(x?.status||'').toLowerCase();return x?.completed===true||!!x?.completed_at||s==='completed'||s==='done'||Number(x?.progress_percent||0)>=100;}
  function lessonMeta(r){if(!r)return'No activity recorded';if(r.completed_at)return`Completed ${formatDate(r.completed_at)}`;if(r.last_activity_at)return`Last activity ${formatDate(r.last_activity_at)}`;return String(r.status||'Activity recorded');}
  function bestScore(rows){const vals=rows.map(x=>Number(x.score_percent??x.score)).filter(Number.isFinite);return vals.length?`${Math.max(...vals).toFixed(0)}% BEST`:'RECORDED';}
  function profileName(p){return p.display_name||[p.first_name,p.last_name].filter(Boolean).join(' ')||p.email||'Student';}
  function initials(n){return String(n||'ST').split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase();}
  function statusLabel(s){return s==='completed'?'Completed':s==='active'?'In Progress':'Not Started';}
  function formatDate(v){if(!v)return'—';const d=new Date(v);return Number.isNaN(d.getTime())?'—':d.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});}
  function formatRelative(v){if(!v)return'No activity';const d=new Date(v);if(Number.isNaN(d.getTime()))return'No activity';const days=Math.floor((Date.now()-d.getTime())/86400000);if(days<=0)return'Today';if(days===1)return'Yesterday';if(days<7)return`${days} days ago`;return formatDate(v);}
  function chunk(a,n){const out=[];for(let i=0;i<a.length;i+=n)out.push(a.slice(i,i+n));return out;}
  function clamp(n){return Math.max(0,Math.min(100,Number.isFinite(n)?n:0));}
  function setText(id,v){const e=$(id);if(e)e.textContent=String(v);}
  function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function csvCell(v){const s=String(v??'');return /[",\n]/.test(s)?`"${s.replace(/"/g,'""')}"`:s;}
  function setLoading(on){const e=$('progressLoading');if(e)e.hidden=!on;}
  function showError(m){const e=$('progressError');if(e){e.hidden=false;e.textContent=m;}}
})();
