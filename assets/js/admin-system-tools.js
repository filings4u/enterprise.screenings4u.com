(() => {
  "use strict";
  const tool = document.body.dataset.systemTool;
  const root = document.getElementById("systemToolRoot");
  let db;
  let rows = [];
  let currentId = null;
  const configs = {
    redirects:{table:"url_redirects",title:"URL Redirects",eyebrow:"SYSTEM · ROUTING",description:"Create and manage source-to-destination URL rules.",button:"New Redirect"},
    seo:{table:"seo_pages",title:"SEO Management",eyebrow:"SYSTEM · SEARCH",description:"Manage page metadata, canonical URLs, robots rules, social previews, and sitemap settings.",button:"Add Page"},
    forms:{table:"dynamic_forms",title:"Forms Editor",eyebrow:"SYSTEM · DATA COLLECTION",description:"Build reusable intake and information-gathering forms without uploading form code.",button:"New Form"},
    tasks:{table:"admin_tasks",title:"Task Manager",eyebrow:"SYSTEM · WORK MANAGEMENT",description:"Track administrative work, priorities, due dates, and completion status.",button:"New Task"},
    search:{table:"search_engine_submissions",title:"Search Submission",eyebrow:"SYSTEM · INDEXING",description:"Queue and track Google, Bing, and IndexNow URL or sitemap submissions.",button:"Queue Submission"}
  };
  document.addEventListener("DOMContentLoaded", init);

  async function init(){
    if(!root||!configs[tool])return;
    renderShell(); bind();
    try{db=await getClient();await load();}catch(error){show(error.message||"Unable to load this system tool.","error");root.querySelector("#systemData").innerHTML='<div class="system-empty">Unable to load records.</div>';}
  }
  async function getClient(){
    if(typeof window.getScreenings4uSupabase==="function")return window.getScreenings4uSupabase();
    if(window.supabaseClient)return window.supabaseClient;
    if(window.S4USupabase?.client)return window.S4USupabase.client;
    throw new Error("Supabase client is unavailable.");
  }
  function renderShell(){
    const c=configs[tool];
    root.innerHTML=`<section class="system-tools"><header class="system-head"><div><span class="system-eyebrow">${esc(c.eyebrow)}</span><h1>${esc(c.title)}</h1><p>${esc(c.description)}</p></div><button id="systemNew" class="system-button primary" type="button">+ ${esc(c.button)}</button></header>${notice()}<div id="systemMessage" class="system-message"></div><div id="systemStats" class="system-stats"></div><section class="system-card"><div class="system-toolbar"><input id="systemSearch" type="search" placeholder="Search records..."><select id="systemFilter"><option value="">All statuses</option></select><button id="systemRefresh" class="system-button" type="button">Refresh</button></div><div id="systemData" class="system-loading">Loading...</div></section></section><div id="systemDialog" class="system-dialog" hidden><div class="system-dialog-backdrop" data-close></div><form id="systemForm" class="system-dialog-panel"><header class="system-dialog-head"><h2 id="systemDialogTitle"></h2><button class="system-button small" type="button" data-close>Close</button></header><div id="systemDialogBody" class="system-dialog-body"></div><footer class="system-dialog-foot"><button class="system-button" type="button" data-close>Cancel</button><button id="systemSave" class="system-button primary" type="submit">Save</button></footer></form></div>`;
  }
  function notice(){
    if(tool==="redirects")return '<div class="system-notice warning">Redirect records require your production host, CDN, or server middleware to read and apply these rules. A database row alone cannot intercept a missing static URL.</div>';
    if(tool==="seo")return '<div class="system-notice">For best indexing, production deployment should render this metadata into the initial HTML and generated sitemap—not only inject it in the browser.</div>';
    if(tool==="search")return '<div class="system-notice warning">Google requires Search Console verification and API credentials. Bing requires Webmaster API credentials or an IndexNow key. Queued does not mean submitted until that server-side integration is connected.</div>';
    if(tool==="forms")return '<div class="system-notice">Published forms can be displayed with form.html?slug=your-form-slug. Public visitors may submit but cannot read submissions.</div>';
    return '';
  }
  function bind(){
    root.addEventListener("click",click);
    root.querySelector("#systemForm").addEventListener("submit",save);
    root.querySelector("#systemSearch").addEventListener("input",draw);
    root.querySelector("#systemFilter").addEventListener("change",draw);
    root.querySelector("#systemRefresh").addEventListener("click",load);
    root.querySelector("#systemNew").addEventListener("click",()=>open());
  }
  async function load(){
    root.querySelector("#systemData").innerHTML='<div class="system-loading">Loading...</div>';
    const order=tool==="tasks"?"due_at":tool==="search"?"requested_at":"updated_at";
    const {data,error}=await db.from(configs[tool].table).select("*").order(order,{ascending:false,nullsFirst:false});
    if(error)throw error;rows=data||[];populateFilter();draw();stats();
  }
  function populateFilter(){
    const select=root.querySelector("#systemFilter");
    const values=[...new Set(rows.map(r=>statusValue(r)).filter(Boolean))];
    select.innerHTML='<option value="">All statuses</option>'+values.map(v=>`<option value="${esc(v)}">${esc(human(v))}</option>`).join("");
  }
  function statusValue(r){return tool==="redirects"||tool==="seo"?(r.active?"active":"inactive"):r.status||r.engine;}
  function stats(){
    const active=rows.filter(r=>["active","published","todo","in_progress","queued","submitted"].includes(statusValue(r))).length;
    const secondary=tool==="tasks"?rows.filter(r=>r.priority==="urgent"||r.priority==="high").length:tool==="search"?rows.filter(r=>r.status==="failed").length:tool==="forms"?rows.filter(r=>r.status==="published").length:rows.filter(r=>statusValue(r)==="inactive").length;
    root.querySelector("#systemStats").innerHTML=stat("Total",rows.length)+stat(tool==="tasks"?"Open":"Active",active)+stat(tool==="tasks"?"High Priority":tool==="search"?"Failed":tool==="forms"?"Published":"Inactive",secondary)+stat("Updated Today",rows.filter(r=>sameDay(r.updated_at||r.requested_at||r.created_at)).length);
  }
  function stat(label,value){return `<article class="system-stat"><span>${esc(label)}</span><strong>${value}</strong></article>`;}
  function draw(){
    const q=root.querySelector("#systemSearch").value.trim().toLowerCase();const f=root.querySelector("#systemFilter").value;
    const filtered=rows.filter(r=>(!f||statusValue(r)===f)&&(!q||JSON.stringify(r).toLowerCase().includes(q)));
    const box=root.querySelector("#systemData");
    if(!filtered.length){box.innerHTML='<div class="system-empty">No records found.</div>';return;}
    if(tool==="tasks"){drawTasks(filtered,box);return;}
    const heads={redirects:["Source","Destination","Code","Status","Updated"],seo:["Page","Title","Robots","Sitemap","Status"],forms:["Form","Slug","Fields","Status","Updated"],search:["URL","Engine","Type","Status","Requested"]}[tool];
    box.innerHTML=`<div class="system-table-wrap"><table class="system-table"><thead><tr>${heads.map(h=>`<th>${h}</th>`).join("")}<th></th></tr></thead><tbody>${filtered.map(rowHtml).join("")}</tbody></table></div>`;
  }
  function rowHtml(r){
    let cells="";
    if(tool==="redirects")cells=`<td><strong>${esc(r.source_path)}</strong></td><td>${esc(r.destination_url)}</td><td>${r.status_code}</td><td>${pill(statusValue(r))}</td><td>${date(r.updated_at)}</td>`;
    if(tool==="seo")cells=`<td><strong>${esc(r.page_path)}</strong></td><td>${esc(r.page_title||"—")}</td><td>${esc(r.robots_directive)}</td><td>${r.include_in_sitemap?"Included":"Excluded"}</td><td>${pill(statusValue(r))}</td>`;
    if(tool==="forms")cells=`<td><strong>${esc(r.name)}</strong></td><td>${esc(r.slug)}</td><td>${Array.isArray(r.fields)?r.fields.length:0}</td><td>${pill(r.status)}</td><td>${date(r.updated_at)}</td>`;
    if(tool==="search")cells=`<td><strong>${esc(r.url)}</strong></td><td>${esc(human(r.engine))}</td><td>${esc(human(r.submission_type))}</td><td>${pill(r.status)}</td><td>${date(r.requested_at)}</td>`;
    const extra=tool==="forms"?`<button class="system-button small" type="button" data-submissions="${r.id}">Submissions</button>`:"";
    return `<tr>${cells}<td><div class="system-actions">${extra}${tool!=="search"?`<button class="system-button small" type="button" data-edit="${r.id}">Edit</button>`:""}<button class="system-button small danger" type="button" data-delete="${r.id}">Delete</button></div></td></tr>`;
  }
  function drawTasks(list,box){
    const columns=[["todo","To Do"],["in_progress","In Progress"],["blocked","Blocked"],["completed","Completed"]];
    box.innerHTML=`<div class="system-dialog-body"><div class="system-kanban">${columns.map(([key,label])=>`<section class="task-column"><h3>${label}</h3>${list.filter(r=>r.status===key).map(r=>`<article class="task-card"><strong>${esc(r.title)}</strong><p>${esc(r.description||"")}</p><div class="task-meta"><span>${esc(human(r.priority))}</span><span>${r.due_at?date(r.due_at):"No due date"}</span></div><div class="system-actions"><button class="system-button small" data-edit="${r.id}" type="button">Edit</button><button class="system-button small danger" data-delete="${r.id}" type="button">Delete</button></div></article>`).join("")||'<div class="system-empty">Empty</div>'}</section>`).join("")}</div></div>`;
  }
  async function click(e){
    if(e.target.closest("[data-close]")){close();return;}
    const submissions=e.target.closest("[data-submissions]");if(submissions){await openSubmissions(submissions.dataset.submissions);return;}
    const edit=e.target.closest("[data-edit]");if(edit){open(rows.find(r=>r.id===edit.dataset.edit));return;}
    const del=e.target.closest("[data-delete]");if(del&&confirm("Delete this record?")){const {error}=await db.from(configs[tool].table).delete().eq("id",del.dataset.delete);if(error)show(error.message,"error");else{show("Record deleted.","ok");await load();}}
    const add=e.target.closest("#addField");if(add)addField();
    const remove=e.target.closest("[data-remove-field]");if(remove)remove.closest(".field-row")?.remove();
  }
  async function openSubmissions(formId){
    root.querySelector("#systemSave").hidden=true;
    const selected=rows.find(r=>r.id===formId);root.querySelector("#systemDialogTitle").textContent=`${selected?.name||"Form"} Submissions`;
    root.querySelector("#systemDialogBody").innerHTML='<div class="system-loading">Loading submissions...</div>';
    root.querySelector("#systemDialog").hidden=false;
    const{data,error}=await db.from("dynamic_form_submissions").select("*").eq("form_id",formId).order("submitted_at",{ascending:false});
    if(error){root.querySelector("#systemDialogBody").innerHTML=`<div class="system-empty">${esc(error.message)}</div>`;return;}
    root.querySelector("#systemDialogBody").innerHTML=!data?.length?'<div class="system-empty">No submissions yet.</div>':`<div class="system-table-wrap"><table class="system-table"><thead><tr><th>Submitted</th><th>Email</th><th>Information</th><th>Status</th></tr></thead><tbody>${data.map(s=>`<tr><td>${date(s.submitted_at)}</td><td>${esc(s.submitter_email||"—")}</td><td><pre>${esc(JSON.stringify(s.submission_data,null,2))}</pre></td><td>${pill(s.status)}</td></tr>`).join("")}</tbody></table></div>`;
  }
  function open(item=null){
    root.querySelector("#systemSave").hidden=false;
    currentId=item?.id||null;root.querySelector("#systemDialogTitle").textContent=item?`Edit ${configs[tool].title}`:configs[tool].button;
    root.querySelector("#systemDialogBody").innerHTML=formHtml(item||{});
    if(tool==="forms")renderFields(item?.fields||[]);
    const dialog=root.querySelector("#systemDialog");dialog.hidden=false;dialog.setAttribute("aria-hidden","false");
  }
  function close(){const dialog=root.querySelector("#systemDialog");dialog.hidden=true;dialog.setAttribute("aria-hidden","true");currentId=null;}
  function formHtml(r){
    if(tool==="redirects")return grid(field("source_path","Source Path",r.source_path,"/old-page",true)+field("destination_url","Destination URL",r.destination_url,"https://www.screenings4u.com/new-page",true)+select("status_code","Redirect Type",r.status_code||301,[[301,"301 Permanent"],[302,"302 Temporary"],[307,"307 Temporary"],[308,"308 Permanent"]])+select("active","Status",String(r.active!==false),[["true","Active"],["false","Inactive"]])+area("notes","Notes",r.notes));
    if(tool==="seo")return grid(field("page_path","Page Path",r.page_path,"/services",true)+field("page_title","SEO Title",r.page_title,"Page title")+area("meta_description","Meta Description",r.meta_description)+field("canonical_url","Canonical URL",r.canonical_url,"https://www.screenings4u.com/services")+field("robots_directive","Robots",r.robots_directive||"index,follow","index,follow")+field("og_image_url","Social Image URL",r.og_image_url,"https://www.screenings4u.com/images/...")+field("og_title","Social Title",r.og_title)+area("og_description","Social Description",r.og_description)+select("include_in_sitemap","Sitemap",String(r.include_in_sitemap!==false),[["true","Include"],["false","Exclude"]])+field("sitemap_priority","Priority",r.sitemap_priority??"","0.0–1.0")+select("sitemap_change_frequency","Change Frequency",r.sitemap_change_frequency||"",[["","Not set"],["daily","Daily"],["weekly","Weekly"],["monthly","Monthly"],["yearly","Yearly"]])+select("active","Status",String(r.active!==false),[["true","Active"],["false","Inactive"]])+area("structured_data","Structured Data JSON",JSON.stringify(r.structured_data||{},null,2)));
    if(tool==="forms")return grid(field("name","Form Name",r.name,"Customer Intake",true)+field("slug","Slug",r.slug,"customer-intake",true)+area("description","Description",r.description)+select("status","Status",r.status||"draft",[["draft","Draft"],["published","Published"],["archived","Archived"]])+field("submit_button_label","Button Label",r.submit_button_label||"Submit")+area("success_message","Success Message",r.success_message||"Thank you. Your information has been submitted.")+field("notification_email","Notification Email",r.notification_email,"support@screenings4u.com")+`<div class="system-field full"><span>Fields</span><div id="fieldBuilder" class="field-builder"></div><button id="addField" class="system-button" type="button">+ Add Field</button></div>`);
    if(tool==="tasks")return grid(field("title","Task Title",r.title,"Task title",true)+select("status","Status",r.status||"todo",[["todo","To Do"],["in_progress","In Progress"],["blocked","Blocked"],["completed","Completed"],["cancelled","Cancelled"]])+select("priority","Priority",r.priority||"normal",[["low","Low"],["normal","Normal"],["high","High"],["urgent","Urgent"]])+field("due_at","Due Date",toLocal(r.due_at),"",false,"datetime-local")+area("description","Description",r.description)+field("tags","Tags",(r.tags||[]).join(", "),"operations, follow-up"));
    return grid(field("url","URL or Sitemap",r.url,"https://www.screenings4u.com/page",true)+select("engine","Search Engine",r.engine||"google",[["google","Google"],["bing","Bing"],["indexnow","IndexNow"]])+select("submission_type","Submission Type",r.submission_type||"url",[["url","URL"],["sitemap","Sitemap"]]));
  }
  async function save(e){
    e.preventDefault();const fd=new FormData(e.currentTarget);let record=Object.fromEntries(fd.entries());
    try{
      if(tool==="redirects"){record.status_code=Number(record.status_code);record.active=record.active==="true";}
      if(tool==="seo"){record.active=record.active==="true";record.include_in_sitemap=record.include_in_sitemap==="true";record.sitemap_priority=record.sitemap_priority===""?null:Number(record.sitemap_priority);record.sitemap_change_frequency=record.sitemap_change_frequency||null;record.structured_data=JSON.parse(record.structured_data||"{}");}
      if(tool==="forms")record.fields=collectFields();
      if(tool==="tasks"){record.tags=String(record.tags||"").split(",").map(x=>x.trim()).filter(Boolean);record.due_at=record.due_at||null;record.completed_at=record.status==="completed"?new Date().toISOString():null;}
      if(tool==="search")record.status="queued";
      record.updated_at=new Date().toISOString();
      let query=currentId?db.from(configs[tool].table).update(record).eq("id",currentId):db.from(configs[tool].table).insert(record);
      const {error}=await query;if(error)throw error;close();show(tool==="search"?"Submission queued. Credentials and server processing are still required.":"Record saved.","ok");await load();
    }catch(error){show(error.message||"Unable to save record.","error");}
  }
  function renderFields(fields){const box=root.querySelector("#fieldBuilder");box.innerHTML="";(fields.length?fields:[{label:"Full Name",name:"full_name",type:"text",required:true}]).forEach(f=>addField(f));}
  function addField(f={}){const box=root.querySelector("#fieldBuilder");if(!box)return;const row=document.createElement("div");row.className="field-row";row.innerHTML=`<input data-field="label" value="${esc(f.label||"")}" placeholder="Label"><input data-field="name" value="${esc(f.name||"")}" placeholder="field_name"><select data-field="type">${["text","email","tel","number","date","textarea","select","checkbox"].map(t=>`<option value="${t}" ${f.type===t?"selected":""}>${human(t)}</option>`).join("")}</select><label><input data-field="required" type="checkbox" ${f.required?"checked":""}> Required</label><button class="system-button small danger" data-remove-field type="button">Remove</button><input data-field="options" value="${esc((f.options||[]).join(", "))}" placeholder="Options, comma separated" style="grid-column:1/-1">`;box.appendChild(row);}
  function collectFields(){return [...root.querySelectorAll(".field-row")].map(row=>{const get=n=>row.querySelector(`[data-field="${n}"]`);return{label:get("label").value.trim(),name:get("name").value.trim(),type:get("type").value,required:get("required").checked,options:get("options").value.split(",").map(x=>x.trim()).filter(Boolean)};}).filter(f=>f.label&&f.name);}
  function grid(content){return `<div class="system-form-grid">${content}</div>`;}function field(name,label,value="",placeholder="",required=false,type="text"){return `<label class="system-field"><span>${label}</span><input name="${name}" type="${type}" value="${esc(value||"")}" placeholder="${esc(placeholder)}" ${required?"required":""}></label>`;}function area(name,label,value=""){return `<label class="system-field full"><span>${label}</span><textarea name="${name}">${esc(value||"")}</textarea></label>`;}function select(name,label,value,options){return `<label class="system-field"><span>${label}</span><select name="${name}">${options.map(([v,l])=>`<option value="${v}" ${String(v)===String(value)?"selected":""}>${l}</option>`).join("")}</select></label>`;}
  function show(text,type){const el=root.querySelector("#systemMessage");el.textContent=text;el.className=`system-message show ${type}`;setTimeout(()=>el.classList.remove("show"),6000);}function pill(v){return `<span class="system-pill ${esc(v)}">${esc(human(v))}</span>`;}function human(v){return String(v||"").replace(/_/g," ").replace(/\b\w/g,c=>c.toUpperCase());}function date(v){const d=new Date(v);return Number.isNaN(d.getTime())?"—":new Intl.DateTimeFormat("en-US",{month:"short",day:"numeric",year:"numeric"}).format(d);}function sameDay(v){const d=new Date(v),n=new Date();return !Number.isNaN(d.getTime())&&d.toDateString()===n.toDateString();}function toLocal(v){if(!v)return"";const d=new Date(v);return Number.isNaN(d.getTime())?"":new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16);}function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
})();
