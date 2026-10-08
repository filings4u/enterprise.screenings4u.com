(()=>{'use strict';
const $=(s,r=document)=>r.querySelector(s),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const END='https://rgsrubdtljyxmnihwlah.supabase.co/functions/v1/screenings4u-testing-service-management';
const page=(location.pathname.split('/').pop()||'').toLowerCase();
const cfg={
 'admin-testing-background.html':['background','Background Checks'],
 'admin-testing-mobile.html':['mobile','Mobile & Onsite Testing'],
 'admin-testing-post-accident.html':['post_accident','Post-Accident Testing'],
 'admin-testing-court-orders.html':['court_order','Court-Ordered Testing']
};
async function client(){for(let i=0;i<40;i++){const c=window.screenings4uSupabase||window.supabaseClient;if(c?.auth?.getSession)return c;await new Promise(r=>setTimeout(r,50))}throw new Error('Supabase client unavailable.');}
async function load(){const c=cfg[page];if(!c)return;const sb=await client(),{data:{session}}=await sb.auth.getSession();if(!session)throw new Error('Your staff session has expired.');const r=await fetch(END,{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${session.access_token}`,'apikey':window.SCREENINGS4U_SUPABASE_ANON_KEY||''},body:JSON.stringify({surface:c[0]})});const d=await r.json().catch(()=>({}));if(!r.ok||d.error)throw new Error(d.error||`Request failed (${r.status}).`);$('#recordCount').textContent=String((d.services||[]).length);$('#testingRows').innerHTML=(d.services||[]).length?(d.services||[]).map(x=>`<tr><td><strong>${esc(x.name)}</strong><small>${esc(x.sku)}</small></td><td>${esc(x.metadata?.category||'—')}</td><td>${esc(x.metadata?.specimen||'—')}</td><td>${esc(x.metadata?.results||'—')}</td></tr>`).join(''):`<tr><td colspan="4"><div class="ep-business-empty">No active services are currently classified in this management area.</div></td></tr>`;}
function error(e){window.S4UUI?.modal?window.S4UUI.modal({title:'Testing Management',message:e.message||String(e),type:'error',confirmText:'Close'}):console.error(e)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>load().catch(error),{once:true});else load().catch(error);
})();
