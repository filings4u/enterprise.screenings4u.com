(() => {
  'use strict';
  const nav=[
    ['Overview','index.html','⌂'],['Customers','customers.html','▣'],['Add Customer','customer-new.html','＋']
  ];
  function file(){return location.pathname.split('/').pop()||'index.html'}
  function toast(msg,type='info'){
    let stack=document.querySelector('.toast-stack');
    if(!stack){stack=document.createElement('div');stack.className='toast-stack';document.body.append(stack)}
    const el=document.createElement('div');el.className=`toast ${type}`;el.textContent=msg;stack.append(el);setTimeout(()=>el.remove(),5000);
  }
  function setScale(scale){
    const n=Math.max(.9,Math.min(1.1,Number(scale)||1));
    document.documentElement.style.setProperty('--scale',String(n));
    localStorage.setItem('s4u-enterprise-v2-font-scale',String(n));
    document.querySelectorAll('[data-scale]').forEach(b=>b.classList.toggle('active',Number(b.dataset.scale)===n));
  }
  async function userInfo(){
    try{const c=await EnterpriseAPI.client();const {data:{session}}=await c.auth.getSession();if(!session){location.href='../admin-login.html';return null}const u=session.user;return {email:u.email||'',initial:(u.email||'S')[0].toUpperCase()}}catch(e){toast(e.message,'error');return null}
  }
  async function render(){
    const host=document.querySelector('[data-app]');if(!host)return;
    const current=file();
    const user=await userInfo();if(!user)return;
    host.innerHTML=`<div class="app"><aside class="sidebar"><div class="brand">screenings<span style="color:#ff6a13">4u</span> <small>Enterprise Management Portal — V2</small></div><div class="nav-group"><div class="nav-title">Enterprise</div>${nav.map(([n,h,i])=>`<a class="nav-link ${current===h?'active':''}" href="${h}"><span>${i}</span><span>${n}</span></a>`).join('')}</div><div class="nav-group"><div class="nav-title">Business Systems</div><a class="nav-link" href="../admin-testing-command-center.html"><span>◌</span><span>Testing</span></a><a class="nav-link" href="../admin-lms-dashboard.html"><span>◌</span><span>Training LMS</span></a><a class="nav-link" href="../admin-workforce.html"><span>◌</span><span>NON-DOT Workforce</span></a><a class="nav-link" href="../admin-dot.html"><span>◌</span><span>DOT</span></a></div></aside><main class="main"><header class="topbar"><div><div class="topbar-title">screenings4u Enterprise</div><div class="topbar-sub">Clean management rebuild</div></div><div class="topbar-actions"><div class="font-control"><span>TEXT</span><button data-scale="0.9">A−</button><button data-scale="1">A</button><button data-scale="1.1">A+</button></div><div class="user-chip"><div class="avatar">${user.initial}</div><div><div style="font-size:.76rem;font-weight:800">${user.email}</div><div class="topbar-sub">Internal Staff</div></div></div></div></header><div class="content" data-page-host></div></main></div>`;
    document.querySelectorAll('[data-scale]').forEach(b=>b.addEventListener('click',()=>setScale(b.dataset.scale)));
    setScale(localStorage.getItem('s4u-enterprise-v2-font-scale')||1);
    window.dispatchEvent(new CustomEvent('enterprise:v2-ready'));
  }
  window.EnterpriseUI={toast,setScale};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',render,{once:true});else render();
})();
