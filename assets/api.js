(() => {
  'use strict';
  const endpoint = () => `${String(window.SCREENINGS4U_SUPABASE_URL||'').replace(/\/$/,'')}/functions/v1/enterprise-admin-api-v2`;
  async function client(){
    const c=window.getScreenings4uSupabase?.()||window.screenings4uSupabase;
    if(!c?.auth) throw new Error('Supabase is not initialized.');
    return c;
  }
  async function call(action,payload={}){
    const c=await client();
    const {data:{session},error}=await c.auth.getSession();
    if(error)throw error;
    if(!session){ location.href='../admin-login.html'; throw new Error('Your staff session has expired.'); }
    const r=await fetch(endpoint(),{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${session.access_token}`,'apikey':window.SCREENINGS4U_SUPABASE_ANON_KEY},body:JSON.stringify({action,...payload})});
    const out=await r.json().catch(()=>({}));
    if(!r.ok||out.error)throw new Error(out.error||`Request failed (${r.status}).`);
    return out.data;
  }
  window.EnterpriseAPI={call,client};
})();
