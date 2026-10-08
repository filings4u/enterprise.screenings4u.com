/**
 * screenings4u — Universal Portal Session Security
 * 10-minute inactivity timeout with branded one-minute warning.
 * Activity is synchronized across tabs on the same portal origin.
 * Training pages only count meaningful course-player interactions.
 */
(()=>{
  "use strict";
  const IDLE_LIMIT=10*60*1000;
  const WARNING=60*1000;
  const THROTTLE=750;
  const ACTIVITY_KEY="s4u-security-last-activity-v2";
  const WARNING_ID="s4u-session-warning";
  let logoutTimer=null, warningTimer=null, countdownTimer=null;
  let lastActivity=0, started=false, signingOut=false;

  const portal=()=>String(document.body?.dataset?.s4uPortal||document.documentElement?.dataset?.s4uPortal||inferPortal()).toLowerCase();
  function inferPortal(){
    const n=(location.pathname.split('/').pop()||'').toLowerCase();
    if(n.startsWith('admin-')) return 'admin';
    if(n.startsWith('customer-')) return 'customer';
    if(n.startsWith('employer-')) return 'employer';
    if(n.startsWith('employee-')) return 'employee';
    if(n.includes('course')||n.includes('lesson')||n.includes('training')||location.hostname==='training.screenings4u.com') return 'training';
    return '';
  }
  function storage(){try{return localStorage}catch{return sessionStorage}}
  function readActivity(){const n=Number(storage().getItem(ACTIVITY_KEY)||0);return Number.isFinite(n)?n:0}
  function writeActivity(v){try{storage().setItem(ACTIVITY_KEY,String(v))}catch{}}
  function clearTimers(){clearTimeout(logoutTimer);clearTimeout(warningTimer);clearInterval(countdownTimer);logoutTimer=warningTimer=countdownTimer=null}
  function removeWarning(){document.getElementById(WARNING_ID)?.remove()}
  function loginPage(){
    const p=portal();
    return window.S4UAuth?.getLoginForPortal?.(p) || (p==='training'?'https://training.screenings4u.com/training-login.html':`${p||'customer'}-login.html`);
  }
  async function signOut(){
    if(signingOut) return; signingOut=true; clearTimers(); removeWarning();
    const dest=loginPage();
    try{
      if(window.S4UAuth?.signOut){await window.S4UAuth.signOut({redirectTo:dest});return}
      const c=window.screenings4uSupabase||window.supabaseClient;
      if(c?.auth?.signOut) await c.auth.signOut();
    }catch(e){console.error('[Session security] sign out failed',e)}
    try{storage().removeItem(ACTIVITY_KEY)}catch{}
    location.replace(dest);
  }
  function button(label,fn,primary){const b=document.createElement('button');b.type='button';b.textContent=label;b.style.cssText=`min-height:44px;padding:0 18px;border-radius:9px;border:1px solid ${primary?'#ff6b00':'#24467f'};background:${primary?'#ff6b00':'#fff'};color:${primary?'#fff':'#24467f'};font:800 14px Inter,Arial,sans-serif;cursor:pointer`;b.addEventListener('click',fn);return b}
  function showWarning(){
    if(signingOut||document.getElementById(WARNING_ID)) return;
    let seconds=60;
    const o=document.createElement('div');o.id=WARNING_ID;o.style.cssText='position:fixed;inset:0;z-index:2147483647;display:grid;place-items:center;padding:24px;background:rgba(16,47,85,.78);font-family:Inter,Arial,sans-serif';
    const m=document.createElement('section');m.setAttribute('role','alertdialog');m.setAttribute('aria-modal','true');m.style.cssText='width:min(470px,100%);padding:30px;border-radius:16px;background:#fff;border-top:5px solid #ff6b00;box-shadow:0 24px 70px rgba(0,0,0,.28);text-align:center';
    const brand=document.createElement('div');brand.textContent='SCREENINGS4U';brand.style.cssText='font-size:11px;letter-spacing:.14em;font-weight:900;color:#ff6b00;margin-bottom:10px';
    const h=document.createElement('h2');h.textContent='Your session is about to end';h.style.cssText='margin:0 0 10px;color:#102f55;font-size:24px';
    const p=document.createElement('p');p.textContent='For your security, you will be signed out after 10 minutes of inactivity.';p.style.cssText='margin:0 0 10px;color:#667892;line-height:1.55';
    const c=document.createElement('p');c.style.cssText='margin:0 0 22px;color:#1d2d45';const strong=document.createElement('strong');strong.textContent='60';c.append('Signing out in ',strong,' seconds.');
    const a=document.createElement('div');a.style.cssText='display:flex;justify-content:center;gap:10px;flex-wrap:wrap';a.append(button('Stay Logged In',()=>touch(true),true),button('Sign Out Now',signOut,false));
    m.append(brand,h,p,c,a);o.append(m);document.body.append(o);m.querySelector('button')?.focus();
    countdownTimer=setInterval(()=>{seconds-=1;strong.textContent=String(Math.max(0,seconds));if(seconds<=0)signOut()},1000);
  }
  function schedule(){
    if(!started||signingOut) return; clearTimers(); removeWarning();
    const elapsed=Math.max(0,Date.now()-lastActivity), remaining=Math.max(0,IDLE_LIMIT-elapsed);
    if(!remaining){signOut();return}
    const warnIn=Math.max(0,remaining-WARNING); if(!warnIn)showWarning(); else warningTimer=setTimeout(showWarning,warnIn);
    logoutTimer=setTimeout(signOut,remaining);
  }
  function touch(force=false){if(!started||signingOut)return;const now=Date.now();if(!force&&now-lastActivity<THROTTLE)return;lastActivity=now;writeActivity(now);schedule()}
  function isTrainingMeaningful(target){
    if(portal()!=='training') return true;
    const el=target?.closest?.('[data-s4u-course-player],[data-course-player],#course-player,.course-player,.lesson-player,.video-player,button,a,input,select,textarea,[role="button"]');
    return !!el;
  }
  function onActivity(e){if(isTrainingMeaningful(e.target))touch(false)}
  function establishBaseline(state){
    const stored=readActivity();
    const signedInAt=Date.parse(state?.user?.last_sign_in_at||'')||0;
    if(!stored||stored<signedInAt){lastActivity=Date.now();writeActivity(lastActivity)}else lastActivity=stored;
  }
  async function preflight(state){establishBaseline(state);if(Date.now()-lastActivity>=IDLE_LIMIT){await signOut();return false}return true}
  function start(ev){if(started||signingOut)return;started=true;establishBaseline(ev?.detail||null);['pointerdown','keydown','touchstart','input','change'].forEach(n=>document.addEventListener(n,onActivity,{passive:true}));if(portal()!=='training')document.addEventListener('scroll',onActivity,{passive:true});document.addEventListener('play',onActivity,true);document.addEventListener('seeked',onActivity,true);document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){lastActivity=readActivity()||lastActivity;schedule()}});window.addEventListener('storage',e=>{if(e.key===ACTIVITY_KEY){lastActivity=Number(e.newValue||0)||lastActivity;schedule()}});schedule()}
  window.addEventListener('s4u:authenticated',start);
  window.addEventListener('s4u:training-ready',start);
  window.S4USessionSecurity=Object.freeze({start,reset:()=>touch(true),touch:()=>touch(true),signOut,preflight,isExpired:()=>!!readActivity()&&Date.now()-readActivity()>=IDLE_LIMIT});
})();
