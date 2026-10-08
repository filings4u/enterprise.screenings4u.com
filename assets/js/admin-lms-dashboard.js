(()=>{
  'use strict';

  const $=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const num=v=>Number(v||0);
  const pct=v=>`${Math.max(0,Math.min(100,Math.round(num(v))))}%`;
  const money=v=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(num(v));
  const date=v=>v?new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',year:'numeric'}).format(new Date(v)):'—';

  function nameOf(profile){
    if(!profile)return 'Learner';
    return profile.display_name || [profile.first_name,profile.last_name].filter(Boolean).join(' ') || profile.email || 'Learner';
  }

  async function session(){
    const db=window.screenings4uSupabase||window.supabaseClient;
    if(!db)throw new Error('Supabase client unavailable.');
    const result=await db.auth.getSession();
    const s=result?.data?.session;
    if(!s)throw new Error('Admin session required.');
    return s;
  }

  async function callFunction(slug,payload,s){
    const base=String(window.SCREENINGS4U_SUPABASE_URL||'').replace(/\/$/,'');
    const r=await fetch(`${base}/functions/v1/${slug}`,{
      method:'POST',
      headers:{
        'Content-Type':'application/json',
        'Authorization':`Bearer ${s.access_token}`,
        'apikey':window.SCREENINGS4U_SUPABASE_ANON_KEY
      },
      body:JSON.stringify(payload)
    });
    const data=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(data.error||`Unable to load ${slug}.`);
    return data;
  }

  function renderMetrics(report){
    const m=report.metrics||{};
    const enrollments=num(m.enrollments);
    const completed=num(m.completed_enrollments);
    const progressEnrollments=report.progress?.enrollments||[];
    const learners=new Set(progressEnrollments.map(x=>x.user_id).filter(Boolean)).size;
    const active=new Set(progressEnrollments.filter(x=>x.status==='active').map(x=>x.user_id).filter(Boolean)).size;
    const average=enrollments?Math.round(progressEnrollments.reduce((sum,x)=>sum+num(x.progress_percent),0)/enrollments):0;
    const completionRate=enrollments?Math.round((completed/enrollments)*100):0;
    const notStarted=progressEnrollments.filter(x=>!x.started_at&&num(x.progress_percent)<=0).length;

    $('metricLearners').textContent=learners;
    $('metricEnrollments').textContent=enrollments;
    $('metricProgress').textContent=pct(average);
    $('metricCompletionRate').textContent=pct(completionRate);
    $('metricCourses').textContent=num(m.published_courses);
    $('metricCoursesNote').textContent=`${num(m.courses)} total courses`;
    $('metricOrders').textContent=num(m.training_orders);
    $('metricOrdersNote').textContent=`${num(m.paid_training_orders)} paid`;
    $('metricDocuments').textContent=num(m.pending_documents);
    $('metricCertificates').textContent=num(m.certificates);

    $('opsActiveLearners').textContent=active;
    $('opsNotStarted').textContent=notStarted;
    $('opsPaidOrders').textContent=num(m.paid_training_orders);
    $('opsDocuments').textContent=num(m.learner_documents);
    $('opsSeats').textContent=`${num(m.group_seats_used)} / ${num(m.group_seats_purchased)}`;
    $('opsExtensions').textContent=num(m.extensions);
  }

  function renderCoursePerformance(report){
    const courseMap=new Map((report.progress.courses||[]).map(c=>[c.id,c]));
    const enrollments=report.progress.enrollments||[];
    const rows=[];

    for(const course of report.progress.courses||[]){
      if(course.status!=='published' && !enrollments.some(e=>e.course_id===course.id))continue;
      const courseEnrollments=enrollments.filter(e=>e.course_id===course.id);
      const total=courseEnrollments.length;
      const active=courseEnrollments.filter(e=>e.status==='active').length;
      const completed=courseEnrollments.filter(e=>e.status==='completed'||e.completed_at).length;
      const notStarted=courseEnrollments.filter(e=>!e.started_at&&num(e.progress_percent)<=0).length;
      const avg=total?Math.round(courseEnrollments.reduce((s,e)=>s+num(e.progress_percent),0)/total):0;
      const completion=total?Math.round((completed/total)*100):0;
      rows.push({course,total,active,completed,notStarted,avg,completion});
    }

    rows.sort((a,b)=>b.total-a.total||String(a.course.title||'').localeCompare(String(b.course.title||'')));
    $('coursePerformanceBody').innerHTML=rows.map(x=>`<tr>
      <td><div class="training-overview-name"><strong>${esc(x.course.title||'Course')}</strong><small>${esc(x.course.slug||'')}</small></div></td>
      <td>${x.total}</td><td>${x.active}</td><td>${x.notStarted}</td>
      <td><div class="training-overview-progress"><div class="training-overview-progress-track"><i style="width:${Math.max(0,Math.min(100,x.avg))}%"></i></div><span>${x.avg}%</span></div></td>
      <td>${x.completion}%</td>
    </tr>`).join('')||'<tr><td colspan="6" class="training-overview-empty">No course activity yet.</td></tr>';
  }

  function renderRecentEnrollments(progress){
    const profiles=new Map((progress.profiles||[]).map(p=>[p.id,p]));
    const courses=new Map((progress.courses||[]).map(c=>[c.id,c]));
    const rows=[...(progress.enrollments||[])].sort((a,b)=>new Date(b.enrolled_at||0)-new Date(a.enrolled_at||0)).slice(0,8);
    $('recentEnrollmentsBody').innerHTML=rows.map(e=>{
      const p=profiles.get(e.user_id)||{};
      const c=courses.get(e.course_id)||{};
      return `<tr>
        <td><div class="training-overview-name"><strong>${esc(nameOf(p))}</strong><small>${esc(p.email||'')}</small></div></td>
        <td>${esc(c.title||'Course')}</td>
        <td><div class="training-overview-progress"><div class="training-overview-progress-track"><i style="width:${Math.max(0,Math.min(100,num(e.progress_percent)))}%"></i></div><span>${pct(e.progress_percent)}</span></div></td>
        <td><span class="training-overview-badge ${esc(e.status||'')}">${esc(e.status||'active')}</span></td>
        <td>${date(e.enrolled_at)}</td>
        <td><a class="training-standard-btn" href="admin-lms-enrollment.html?id=${encodeURIComponent(e.id)}">Manage</a></td>
      </tr>`;
    }).join('')||'<tr><td colspan="6" class="training-overview-empty">No enrollments yet.</td></tr>';
  }

  function renderRecentOrders(ordersData){
    const rows=(ordersData.orders||[]).slice(0,6);
    $('recentOrdersBody').innerHTML=rows.map(o=>`<tr>
      <td><div class="training-overview-name"><strong>${esc(o.order_number||o.id||'Order')}</strong><small>${esc(o.status||'')}</small></div></td>
      <td>${esc(nameOf(o.profile||{}))}</td>
      <td><span class="training-overview-badge ${esc(o.payment_status||'')}">${esc(o.payment_status||'—')}</span></td>
      <td><span class="training-overview-badge ${esc(o.fulfillment_status||'')}">${esc(o.fulfillment_status||'—')}</span></td>
      <td>${money(o.total)}</td>
      <td>${date(o.created_at)}</td>
    </tr>`).join('')||'<tr><td colspan="6" class="training-overview-empty">No Training orders yet.</td></tr>';
  }

  document.addEventListener('DOMContentLoaded',async()=>{
    try{
      const s=await session();
      const [reports,progress,orders]=await Promise.all([
        callFunction('screenings4u-training-management',{page:'reports'},s),
        callFunction('screenings4u-training-reporting',{action:'progress'},s),
        callFunction('screenings4u-training-management',{page:'orders'},s)
      ]);
      const view={...reports,progress};
      renderMetrics(view);
      renderCoursePerformance(view);
      renderRecentEnrollments(progress);
      renderRecentOrders(orders);
    }catch(e){
      const box=$('trainingOverviewError');
      if(box){box.hidden=false;box.textContent=e?.message||String(e);}
      for(const id of ['coursePerformanceBody','recentEnrollmentsBody','recentOrdersBody']){
        const el=$(id);if(el)el.innerHTML='<tr><td colspan="6" class="training-overview-empty">Unable to load Training overview.</td></tr>';
      }
    }
  });
})();
