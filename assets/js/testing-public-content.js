(()=>{
'use strict';
const findClient=()=>{
  for(const k of ['supabaseClient','s4uSupabase','S4USupabase','sb','supabaseDb','supabaseApp']){
    const v=window[k]; if(v?.functions?.invoke)return v;
  }
  for(const k of Object.keys(window)){try{const v=window[k];if(v&&typeof v==='object'&&v.functions?.invoke)return v}catch{}}
  return null;
};
const setText=(selector,value)=>document.querySelectorAll(selector).forEach(el=>{el.textContent=value??''});
const safeLocalRoute=v=>typeof v==='string'&&/^\/(?!\/)[^?#]*$/.test(v);
const safeTarget=v=>{
  if(typeof v!=='string'||!v)return false;
  if(safeLocalRoute(v)||/^[\w-]+\.html(?:[?#].*)?$/.test(v))return true;
  try{return new URL(v,location.href).protocol==='https:'}catch{return false}
};
async function run(){
  const client=findClient(); if(!client)return;
  try{
    const {data,error}=await client.functions.invoke('enterprise-testing-command',{body:{action:'published_website'}});
    if(error||data?.error)throw error||new Error(data.error);
    const payload=data?.data||data||{};
    window.Screenings4uTestingPublished=payload;
    const path=location.pathname||'/';
    const leaf=path.split('/').filter(Boolean).pop()||'';
    const page=(payload.pages||[]).find(p=>p.route===path||p.slug===leaf.replace(/\.html$/i,''));
    if(page?.kind==='redirect'&&safeTarget(page.target)&&page.target!==path){location.replace(page.target);return}
    if(page){
      if(page.meta_title||page.title)document.title=page.meta_title||page.title;
      if(page.meta_description){let m=document.querySelector('meta[name="description"]');if(!m){m=document.createElement('meta');m.name='description';document.head.appendChild(m)}m.content=page.meta_description}
      setText('[data-s4u-testing-content="title"]',page.title);
      setText('[data-s4u-testing-content="body"]',page.body);
    }
    const settings=payload.settings||{};
    for(const [k,v] of Object.entries(settings))setText(`[data-s4u-testing-setting="${CSS.escape(k)}"]`,v);
    document.dispatchEvent(new CustomEvent('s4u:testing-content',{detail:{page,settings,payload}}));
  }catch(e){console.warn('screenings4u Testing public content:',e?.message||e)}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run,{once:true});else run();
})();
