(()=>{"use strict";

let db=null;
let authUser=null;

const $=id=>document.getElementById(id);

document.addEventListener("DOMContentLoaded",init);

async function init(){
  bind();

  try{
    db=window.getScreenings4uSupabase
      ? await window.getScreenings4uSupabase()
      : window.screenings4uSupabase;

    if(!db) throw new Error("Supabase client is unavailable.");

    await loadAccount();
  }catch(error){
    console.error("[Employee Account]",error);
    show("Account Unavailable",error?.message||"Unable to load your account.");
  }
}

function bind(){
  document.querySelectorAll(".employee-account-tab").forEach(button=>{
    button.addEventListener("click",()=>showTab(button.dataset.tab));
  });

  $("profile-form")?.addEventListener("submit",saveProfile);
  $("password-form")?.addEventListener("submit",updatePassword);
  $("preferences-form")?.addEventListener("submit",savePreferences);
  $("modal-close")?.addEventListener("click",closeModal);
}

async function loadAccount(){
  const {data:{user},error:userError}=await db.auth.getUser();
  if(userError) throw userError;
  if(!user) throw new Error("Your employee session has expired. Please sign in again.");

  authUser=user;

  const [profileResult,preferenceResult]=await Promise.all([
    db.from("user_profiles")
      .select("id,first_name,last_name,display_name,email,phone")
      .eq("id",user.id)
      .maybeSingle(),

    db.from("employee_account_preferences")
      .select("training_updates,certificate_notifications,account_notifications")
      .eq("user_id",user.id)
      .maybeSingle()
  ]);

  if(profileResult.error) throw profileResult.error;
  if(preferenceResult.error) throw preferenceResult.error;

  const profile=profileResult.data||{};
  const preferences=preferenceResult.data||{
    training_updates:true,
    certificate_notifications:true,
    account_notifications:true
  };

  setVal("first-name",profile.first_name);
  setVal("last-name",profile.last_name);
  setVal("email",profile.email||user.email);
  setVal("phone",profile.phone);

  setCheck("pref-training",preferences.training_updates);
  setCheck("pref-certificates",preferences.certificate_notifications);
  setCheck("pref-account",preferences.account_notifications);

  updatePortalUser(profile);
}

function showTab(tab){
  document.querySelectorAll(".employee-account-tab").forEach(button=>{
    button.classList.toggle("active",button.dataset.tab===tab);
  });

  document.querySelectorAll(".employee-account-panel").forEach(panel=>{
    panel.classList.toggle("active",panel.dataset.panel===tab);
  });
}

async function saveProfile(event){
  event.preventDefault();

  const button=event.submitter;
  setBusy(button,true,"Saving...");

  try{
    const payload={
      first_name:val("first-name"),
      last_name:val("last-name"),
      phone:val("phone")||null
    };

    const {data,error}=await db
      .from("user_profiles")
      .update(payload)
      .eq("id",authUser.id)
      .select("id,first_name,last_name,display_name,email,phone")
      .single();

    if(error) throw error;

    updatePortalUser(data);
    show("Profile Updated","Your personal information has been saved.");
  }catch(error){
    console.error("[Employee Account] profile update",error);
    show("Unable to Save Profile",error?.message||"Your profile could not be updated.");
  }finally{
    setBusy(button,false,"Save Changes");
  }
}

async function updatePassword(event){
  event.preventDefault();

  const current=val("current-password");
  const next=val("new-password");
  const confirm=val("confirm-password");

  if(!current||!next||!confirm){
    show("Password Required","Please complete all password fields.");
    return;
  }

  if(next!==confirm){
    show("Passwords Do Not Match","Your new password and confirmation must match.");
    return;
  }

  if(next.length<8){
    show("Choose a Stronger Password","Your new password must contain at least 8 characters.");
    return;
  }

  const button=event.submitter;
  setBusy(button,true,"Updating...");

  try{
    if(!authUser?.email){
      throw new Error("No email address is available for password verification.");
    }

    const {error:verifyError}=await db.auth.signInWithPassword({
      email:authUser.email,
      password:current
    });

    if(verifyError){
      throw new Error("Your current password is incorrect.");
    }

    const {error:updateError}=await db.auth.updateUser({password:next});
    if(updateError) throw updateError;

    event.target.reset();
    show("Password Updated","Your password has been changed successfully.");
  }catch(error){
    console.error("[Employee Account] password update",error);
    show("Unable to Update Password",error?.message||"Your password could not be updated.");
  }finally{
    setBusy(button,false,"Update Password");
  }
}

async function savePreferences(event){
  event.preventDefault();

  const button=event.submitter;
  setBusy(button,true,"Saving...");

  try{
    const payload={
      user_id:authUser.id,
      training_updates:checked("pref-training"),
      certificate_notifications:checked("pref-certificates"),
      account_notifications:checked("pref-account")
    };

    const {error}=await db
      .from("employee_account_preferences")
      .upsert(payload,{onConflict:"user_id"});

    if(error) throw error;

    show("Preferences Updated","Your employee notification preferences have been saved.");
  }catch(error){
    console.error("[Employee Account] preferences update",error);
    show("Unable to Save Preferences",error?.message||"Your preferences could not be saved.");
  }finally{
    setBusy(button,false,"Save Preferences");
  }
}

function updatePortalUser(profile){
  const fullName=
    profile?.display_name ||
    [profile?.first_name,profile?.last_name].filter(Boolean).join(" ") ||
    "Employee";

  window.updateEmployeePortalUser?.({
    fullName,
    email:profile?.email||authUser?.email||""
  });
}

function val(id){
  return $(id)?.value?.trim()||"";
}

function setVal(id,value){
  const el=$(id);
  if(el) el.value=value||"";
}

function checked(id){
  return !!$(id)?.checked;
}

function setCheck(id,value){
  const el=$(id);
  if(el) el.checked=!!value;
}

function setBusy(button,busy,label){
  if(!button) return;
  button.disabled=busy;
  button.textContent=label;
}

function show(title,message){
  $("modal-title").textContent=title;
  $("modal-message").textContent=message;
  $("account-modal").hidden=false;
}

function closeModal(){
  $("account-modal").hidden=true;
}

})();