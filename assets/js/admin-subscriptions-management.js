(()=>{'use strict';
const $=s=>document.querySelector(s), esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let records=[];
const endpoint='https://elpbnytpciqnbexiaebp.supabase.co/functions/v1/dot-enterprise-management';
async function load(){
 const notice=$('#subscriptionNotice');notice.textContent='Loading current subscriptions…';
 try {
  let client; for(let i=0;i<60;i++){client=window.screenings4uSupabase||window.supabaseClient;if(client?.auth?.getSession)break;await new Promise(r=>setTimeout(r,75))}
  if(!client?.auth?.getSession)throw Error('Secure authentication unavailable.');
  const {data:{session}}=await client.auth.getSession();if(!session)throw Error('Sign in to continue.');
  const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+session.access_token,apikey:window.SCREENINGS4U_SUPABASE_ANON_KEY||''},body:JSON.stringify({action:'billing'})});
  const payload=await response.json();if(!response.ok||payload.error)throw Error(payload.error||'Unable to load subscriptions');
  const em=new Map((payload.employers||[]).map(x=>[x.id,x.legal_name]));
  const ct=new Map((payload.ctpas||[]).map(x=>[x.id,x.legal_name]));
  const owners=new Map((payload.owner_operators||[]).map(x=>[x.employer_id,x.legal_name]));
  records=(payload.subscriptions||[]).map(x=>({...x,customer:em.get(x.employer_id)||owners.get(x.employer_id)||ct.get(x.ctpa_id)||'Unassigned account',plan:x.plans?.name||'Plan not assigned',annual:x.plans?.annual_price??x.plans?.billing_model?.amount??null}));
  notice.textContent='Subscription records shown from Screenings4U. Stripe synchronization must be checked before changing a paid subscription.';
  render();
 }catch(e){notice.textContent='Unable to load: '+e.message;$('#financeRows').innerHTML='<tr><td>Subscription register unavailable.</td></tr>';}
}
function render(){
 const term=String($('#subscriptionSearch')?.value||'').toLowerCase();
 const filtered=records.filter(x=>[x.customer,x.plan,x.id,x.stripe_subscription_id].join(' ').toLowerCase().includes(term));
 $('#recordCount').textContent=filtered.length+' subscriptions';
 $('#financeMetrics').innerHTML='<article><b>'+records.length+'</b><span>Total records</span></article><article><b>'+records.filter(x=>x.status==='active').length+'</b><span>Active</span></article><article><b>'+records.filter(x=>!x.stripe_subscription_id).length+'</b><span>No Stripe reference</span></article>';
 $('#financeHeaders').innerHTML=['Customer','Plan','Annual price','Status','Renews','Stripe reference'].map(x=>'<th>'+x+'</th>').join('');
 $('#financeRows').innerHTML=filtered.length?filtered.map(s=>'<tr><td>'+esc(s.customer)+'</td><td>'+esc(s.plan)+'</td><td>'+esc(s.annual==null?'—':'$'+Number(s.annual).toFixed(2))+'</td><td>'+esc(s.status)+'</td><td>'+esc(s.renewal_date||'—')+'</td><td><code>'+esc(s.stripe_subscription_id||'Not linked')+'</code></td></tr>').join(''):'<tr><td colspan="6">No matching subscriptions.</td></tr>';
}
document.addEventListener('DOMContentLoaded',()=>{$('#subscriptionSearch')?.addEventListener('input',render);document.querySelector('[data-finance-refresh]')?.addEventListener('click',load);load()});
})();