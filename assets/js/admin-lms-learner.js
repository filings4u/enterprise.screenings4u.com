(()=>{
  "use strict";
  const $=id=>document.getElementById(id);
  const qs=new URLSearchParams(location.search);
  const requestedUser=qs.get("user")||"";
  const requestedEnrollment=qs.get("enrollment")||"";
  let db=null,state=null;

  const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
  const date=v=>v?new Date(v).toLocaleDateString():"—";
  const dateTime=v=>v?new Date(v).toLocaleString():"—";
  const money=(v,c="usd")=>new Intl.NumberFormat("en-US",{style:"currency",currency:String(c||"usd").toUpperCase()}).format(Number(v||0));

  async function call(body){
    const {data,error}=await db.functions.invoke("admin-lms-enrollment-actions",{body});
    if(error) throw error;
    if(data?.error) throw new Error(typeof data.error==="string"?data.error:(data.error?.message||"Request failed."));
    return data;
  }

  function notice(msg,type="ok"){
    const n=$("notice"); if(!n)return;
    n.textContent=msg||"";n.className="tl-note "+type;
    if(!msg)n.className="tl-note";
  }

  function derivedEnrollmentStatus(e){
    const raw=String(e.status||"").toLowerCase();
    if(raw==="cancelled")return"cancelled";
    if(e.completed_at||raw==="completed")return"completed";
    if(e.expires_at&&new Date(e.expires_at).getTime()<=Date.now())return"expired";
    if(Number(e.progress_percent||0)<=0&&!e.started_at)return"not-started";
    return"active";
  }

  function courseTitle(e){return e.course?.title||"Course";}

  function render(){
    const p=state.profile||{},a=state.auth_user||{},enrollments=state.enrollments||[],orders=state.orders||[],documents=state.documents||[],certs=state.certificates||[],emails=state.email_events||[];
    const name=p.display_name||[p.first_name,p.last_name].filter(Boolean).join(" ")||p.email||"Learner";
    $("pageTitle").textContent=name;
    document.title=`${name} | screenings4u Enterprise`;
    $("firstName").value=p.first_name||"";
    $("lastName").value=p.last_name||"";
    $("email").value=p.email||a.email||"";
    $("phone").value=p.phone||a.phone||"";
    $("profileStatus").value=p.status||"active";
    $("authStatus").value=a.id?(a.last_sign_in_at?`Active account · last sign in ${dateTime(a.last_sign_in_at)}`:"Account created · never signed in"):"No Auth account found";
    $("statEnrollments").textContent=enrollments.length;
    $("statProgress").textContent=enrollments.length?`${Math.round(enrollments.reduce((s,e)=>s+Number(e.progress_percent||0),0)/enrollments.length)}%`:"0%";
    $("statOrders").textContent=orders.length;
    $("statLastSignIn").textContent=a.last_sign_in_at?date(a.last_sign_in_at):"Never";

    $("newOrderBtn").href=`admin-lms-order-create.html?user=${encodeURIComponent(p.id||requestedUser)}`;
    $("progressBtn").href=`admin-lms-progress.html?user=${encodeURIComponent(p.id||requestedUser)}`;

    $("enrollmentRows").innerHTML=enrollments.map(e=>{
      const st=derivedEnrollmentStatus(e);
      const expires=e.expires_at?String(e.expires_at).slice(0,10):"";
      return `<tr>
        <td><strong>${esc(courseTitle(e))}</strong><br><span class="tl-subtle">${esc(e.assignment_source||"training")}</span></td>
        <td><strong>${Math.round(Number(e.progress_percent||0))}%</strong><br><span class="tl-subtle">${e.completed_at?"Completed "+esc(date(e.completed_at)):e.started_at?"Started "+esc(date(e.started_at)):"Not started"}</span></td>
        <td>${esc(dateTime(e.last_activity_at||e.updated_at))}</td>
        <td><span class="tl-badge ${esc(st)}">${esc(st.replaceAll("-"," "))}</span><br><span class="tl-subtle">Expires ${esc(date(e.expires_at))}</span></td>
        <td>
          <div class="tl-inline-edit">
            <select data-status="${esc(e.id)}">
              <option value="active"${st==="active"||st==="not-started"?" selected":""}>Active</option>
              <option value="completed"${st==="completed"?" selected":""}>Completed</option>
              <option value="cancelled"${st==="cancelled"?" selected":""}>Cancelled</option>
            </select>
            <input type="date" data-expiry="${esc(e.id)}" value="${esc(expires)}">
            <button class="tl-btn" type="button" data-save-enrollment="${esc(e.id)}">Save</button>
          </div>
        </td>
      </tr>`;
    }).join("")||'<tr><td colspan="5" class="tl-empty">No Training enrollments for this learner.</td></tr>';

    $("orderRows").innerHTML=orders.map(o=>{
      const names=(o.items||[]).map(i=>i.training_product?.name||i.metadata?.product_slug||"Training item").join(", ");
      return `<tr>
        <td><strong>${esc(o.order_number)}</strong><br><span class="tl-subtle">${esc(String(o.source||"website"))}</span></td>
        <td>${esc(names||"Training order")}</td>
        <td><span class="tl-badge">${esc(String(o.payment_status||"").replaceAll("_"," "))}</span></td>
        <td>${esc(String(o.fulfillment_status||"").replaceAll("_"," "))}</td>
        <td>${esc(money(o.total,o.currency))}</td>
        <td>${esc(date(o.created_at))}</td>
      </tr>`;
    }).join("")||'<tr><td colspan="6" class="tl-empty">No Training orders found for this learner.</td></tr>';

    const enrollmentMap=new Map(enrollments.map(e=>[e.id,courseTitle(e)]));
    $("documentRows").innerHTML=documents.map(d=>{
      const doc=d.document||{};
      return `<tr>
        <td><strong>${esc(doc.title||"Learner document")}</strong><br><span class="tl-subtle">${esc(doc.mime_type||"")}</span></td>
        <td>${esc(String(d.category||"other").replaceAll("_"," "))}</td>
        <td><span class="tl-badge">${esc(String(d.status||"").replaceAll("_"," "))}</span></td>
        <td>${esc(d.enrollment_id?enrollmentMap.get(d.enrollment_id)||"Training enrollment":"Account document")}</td>
        <td>${esc(date(d.created_at))}</td>
      </tr>`;
    }).join("")||'<tr><td colspan="5" class="tl-empty">No learner documents found.</td></tr>';

    $("certificateRows").innerHTML=certs.map(c=>`<tr>
      <td><strong>${esc(c.certificate_number||"Certificate")}</strong></td>
      <td>${esc(c.course_title||enrollmentMap.get(c.enrollment_id)||"Training course")}</td>
      <td><span class="tl-badge">${esc(String(c.status||"").replaceAll("_"," "))}</span></td>
      <td>${esc(date(c.issued_at))}</td>
      <td>${esc(date(c.published_at))}</td>
    </tr>`).join("")||'<tr><td colspan="5" class="tl-empty">No certificates have been issued to this learner.</td></tr>';

    $("emailRows").innerHTML=emails.map(e=>`<tr>
      <td>${esc(String(e.event_type||"email").replaceAll("_"," "))}</td>
      <td><strong>${esc(e.subject||"Training email")}</strong><br><span class="tl-subtle">${esc(e.recipient_email||"")}</span></td>
      <td><span class="tl-badge">${esc(String(e.status||"").replaceAll("_"," "))}</span>${e.error_message?`<br><span class="tl-subtle">${esc(e.error_message)}</span>`:""}</td>
      <td>${esc(dateTime(e.sent_at||e.created_at))}</td>
      <td><span class="tl-subtle">${esc(e.provider_message_id||"—")}</span></td>
    </tr>`).join("")||'<tr><td colspan="5" class="tl-empty">No Training email events recorded for this learner.</td></tr>';
  }

  async function load(){
    state=await call({action:"learner-detail",user_id:requestedUser||undefined,enrollment_id:requestedEnrollment||undefined});
    render();
  }

  async function saveProfile(){
    const btn=$("saveProfileBtn");btn.disabled=true;notice("Saving learner profile…");
    try{
      const d=await call({
        action:"update-profile",
        user_id:state.profile.id,
        first_name:$("firstName").value.trim(),
        last_name:$("lastName").value.trim(),
        email:$("email").value.trim(),
        phone:$("phone").value.trim(),
        status:$("profileStatus").value
      });
      state.profile=d.profile;
      if(d.auth_user)state.auth_user={...(state.auth_user||{}),...d.auth_user};
      render();notice("Learner profile updated.","ok");
    }catch(e){notice(e.message||"Unable to update learner profile.","err")}
    finally{btn.disabled=false}
  }

  async function saveEnrollment(id,button){
    const status=document.querySelector(`[data-status="${CSS.escape(id)}"]`)?.value||"active";
    const expiry=document.querySelector(`[data-expiry="${CSS.escape(id)}"]`)?.value||null;
    button.disabled=true;notice("Saving enrollment access…");
    try{
      await call({action:"update",enrollment_id:id,status,expires_at:expiry?new Date(expiry+"T23:59:59").toISOString():null,clear_completed:status==="active"});
      await load();notice("Enrollment access updated.","ok");
    }catch(e){notice(e.message||"Unable to update enrollment.","err")}
    finally{button.disabled=false}
  }

  async function resendInvite(){
    const btn=$("resendInviteBtn");btn.disabled=true;notice("Sending branded Learning Center invite…");
    try{
      const {data,error}=await db.functions.invoke("send-training-account-setup",{body:{email:state.profile.email}});
      if(error)throw error;if(data?.error)throw new Error(data.error);
      notice("Branded Learning Center invite sent.","ok");
      await load();
    }catch(e){notice(e.message||"Unable to send account invite.","err")}
    finally{btn.disabled=false}
  }

  document.addEventListener("DOMContentLoaded",async()=>{
    db=await getScreenings4uSupabase();
    if(!requestedUser&&!requestedEnrollment){
      location.replace("admin-lms-enrollments.html");
      return;
    }
    $("saveProfileBtn").addEventListener("click",saveProfile);
    $("resendInviteBtn").addEventListener("click",resendInvite);
    document.addEventListener("click",e=>{
      const b=e.target.closest("[data-save-enrollment]");
      if(b)saveEnrollment(b.dataset.saveEnrollment,b);
    });
    try{await load()}catch(e){notice(e.message||"Unable to load learner account.","err")}
  });
})();