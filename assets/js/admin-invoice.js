(()=>{
  "use strict";
  async function waitForAdminAuth(){
    if(window.S4UPortalGuard?.waitForAdmin){
      const state=await window.S4UPortalGuard.waitForAdmin();
      if(!state?.user?.id)throw Error("Authentication required.");
      return state;
    }
    if(window.S4UAuth?.requireAuth){
      const state=await window.S4UAuth.requireAuth({portal:"admin",loginPage:"admin-login.html"});
      if(!state?.user?.id)throw Error("Authentication required.");
      return state;
    }
    throw Error("Admin authentication service is unavailable.");
  }

  let db=null,current=null,services=[],prices=[],employers=[],profiles=[],entities=[],items=[],mode="edit";
  const E={};
  document.addEventListener("DOMContentLoaded",init);

  function cache(){
    ["message","pageTitle","editPane","previewPane","issuerEntity","recipientType","recipient","status","customerName","customerEmail","issueDate","dueDate","amountPaid","address1","address2","city","state","postal","service","price","qty","discount","addItem","items","subtotal","discountTotal","total","terms","notes","statusText","editBtn","viewBtn","downloadBtn","copyLink","sendInvoice","markPaid","voidInvoice","save"].forEach(id=>E[id]=document.getElementById(id));
  }

  async function client(){
    for(let i=0;i<40;i++){
      try{
        if(typeof window.getScreenings4uSupabase==="function"){
          const c=await window.getScreenings4uSupabase();
          if(c?.functions)return c;
        }
        if(window.screenings4uSupabase?.functions)return window.screenings4uSupabase;
      }catch(_){}
      await new Promise(r=>setTimeout(r,75));
    }
    return null;
  }

  async function invoke(name,body,fallback){
    const {data,error}=await db.functions.invoke(name,{body});
    if(error){
      let m=error.message||fallback;
      try{const r=error.context;if(r?.clone){const j=await r.clone().json();if(j?.error)m=j.error}}catch(_){}
      throw Error(m);
    }
    if(data?.error)throw Error(data.error);
    return data;
  }
  const call=body=>invoke("invoice-actions",body,"Invoice action failed.");
  const financeCall=body=>invoke("screenings4u-finance-management",body,"Finance action failed.");
  const deliveryCall=body=>invoke("invoice-admin-delivery",body,"Invoice delivery failed.");

  async function init(){
    cache();bind();
    if(E.amountPaid){E.amountPaid.readOnly=true;E.amountPaid.title="Payments are recorded through Mark Paid or Stripe.";}
    try{
      db=await client();if(!db)throw Error("Supabase client not found.");
      await waitForAdminAuth();
      const [d,f]=await Promise.all([call({action:"list"}),financeCall({action:"entities"})]);
      services=d.services||[];prices=d.prices||[];employers=d.employers||[];profiles=d.profiles||[];
      entities=(f.entities||[]).filter(x=>x.active!==false&&["screenings4u","training","workforce","dot","roseland"].includes(x.code));
      populateEntities();populateServices();recipients();
      const params=new URLSearchParams(location.search),id=params.get("id");
      if(id){
        current=(d.invoices||[]).find(x=>x.id===id);
        if(!current)throw Error("Invoice not found.");
        fill(current);
      }else{
        const requested=params.get("entity");
        if(requested&&entities.some(x=>x.code===requested))E.issuerEntity.value=requested;
        else E.issuerEntity.value="screenings4u";
        E.issueDate.value=new Date().toISOString().slice(0,10);
        E.dueDate.value=new Date(Date.now()+30*86400000).toISOString().slice(0,10);
        draw();controls();
      }
    }catch(e){msg(e.message||"Unable to load invoice.","error")}
  }

  function bind(){
    E.recipientType?.addEventListener("change",recipients);
    E.recipient?.addEventListener("change",recipientChanged);
    E.service?.addEventListener("change",serviceChanged);
    E.addItem?.addEventListener("click",addItem);
    E.items?.addEventListener("click",itemClick);
    E.items?.addEventListener("change",itemChange);
    E.save?.addEventListener("click",save);
    E.viewBtn?.addEventListener("click",showPreview);
    E.editBtn?.addEventListener("click",showEdit);
    E.downloadBtn?.addEventListener("click",download);
    E.copyLink?.addEventListener("click",copyCheckoutLink);
    E.sendInvoice?.addEventListener("click",sendInvoice);
    E.markPaid?.addEventListener("click",markPaid);
    E.voidInvoice?.addEventListener("click",voidInvoice);
  }

  function populateEntities(){
    if(!E.issuerEntity)return;
    E.issuerEntity.innerHTML=entities.map(x=>`<option value="${esc(x.code)}">${esc(x.legal_name)}</option>`).join("");
  }
  function populateServices(){const a=services.filter(x=>x.active!==false);E.service.innerHTML=a.length?a.map(x=>`<option value="${x.id}">${esc(x.name)}${x.sku?` — ${esc(x.sku)}`:""}</option>`).join(""):'<option value="">No active services available</option>';serviceChanged()}
  function getPrice(id){const p=prices.filter(x=>x.service_id===id&&x.active!==false).sort((a,b)=>new Date(b.effective_from||0)-new Date(a.effective_from||0))[0];return Number(p?.amount||0)}
  function serviceChanged(){E.price.value=E.service.value?getPrice(E.service.value).toFixed(2):"0.00"}
  function recipients(){E.recipient.innerHTML=E.recipientType.value==="employer"?'<option value="">Select employer...</option>'+employers.map(x=>`<option value="${x.id}">${esc(x.employer_name)}</option>`).join(""):'<option value="">Manual / new customer</option>'+profiles.filter(x=>x.email&&x.is_active!==false).map(x=>`<option value="${x.id}">${esc(x.display_name||[x.first_name,x.last_name].filter(Boolean).join(" ")||x.email)}</option>`).join("")}
  function recipientChanged(){const employer=E.recipientType.value==="employer",x=employer?employers.find(v=>v.id===E.recipient.value):profiles.find(v=>v.id===E.recipient.value);if(!x)return;E.customerName.value=employer?x.employer_name:(x.display_name||[x.first_name,x.last_name].filter(Boolean).join(" "));E.customerEmail.value=employer?(x.billing_email||x.email||""):(x.email||"");E.address1.value=x.address_line_1||"";E.address2.value=x.address_line_2||"";E.city.value=x.city||"";E.state.value=x.state||"";E.postal.value=x.postal_code||""}

  function entityCode(x){return x?.issuer_entity_code||x?.metadata?.entity_code||"screenings4u"}
  function logoPath(x){return x?.issuer_logo_path||x?.metadata?.issuer_logo_path||"images/logo.png"}
  function issuerName(x){return x?.issuer_legal_name||entities.find(e=>e.code===entityCode(x))?.legal_name||"screenings4u, LLC"}

  function fill(x){
    current=x;
    items=(x.items||[]).map(i=>({...i,quantity:Number(i.quantity||1),unit_price:Number(i.unit_price||0),discount_amount:Number(i.discount_amount||0),tax_rate:0}));
    E.pageTitle.textContent=x.invoice_number;
    if(E.issuerEntity){E.issuerEntity.value=entityCode(x);E.issuerEntity.disabled=true}
    E.recipientType.value=x.employer_id?"employer":"customer";recipients();E.recipient.value=x.employer_id||x.customer_user_id||"";
    E.status.value=x.status;E.customerName.value=x.customer_name||"";E.customerEmail.value=x.customer_email||"";E.issueDate.value=x.issue_date||"";E.dueDate.value=x.due_date||"";E.amountPaid.value=x.amount_paid||0;E.address1.value=x.billing_address_line_1||"";E.address2.value=x.billing_address_line_2||"";E.city.value=x.billing_city||"";E.state.value=x.billing_state||"";E.postal.value=x.billing_postal_code||"";E.terms.value=x.terms||"";E.notes.value=x.notes||"";E.statusText.textContent=human(x.status).toUpperCase();draw();controls();
  }

  function addItem(){const s=services.find(x=>x.id===E.service.value);if(!s){msg("Select a service first.","error");return}items.push({service_id:s.id,description:s.name,quantity:Math.max(.01,Number(E.qty.value)||1),unit_price:Math.max(0,Number(E.price.value)||0),discount_amount:Math.max(0,Number(E.discount.value)||0),tax_rate:0});E.qty.value="1";E.discount.value="0";draw()}
  function itemClick(e){const b=e.target.closest("[data-remove]");if(!b)return;items.splice(Number(b.dataset.remove),1);draw()}
  function itemChange(e){const i=Number(e.target.dataset.i),k=e.target.dataset.k;if(!Number.isInteger(i)||!items[i]||!k)return;items[i][k]=k==="description"?e.target.value:Math.max(0,Number(e.target.value)||0);draw()}
  function calc(){let sub=0,disc=0,total=0;items.forEach(x=>{const b=x.quantity*x.unit_price,d=Math.min(b,x.discount_amount||0);sub+=b;disc+=d;total+=b-d});return{sub,disc,total}}
  function draw(){E.items.innerHTML=items.length?items.map((x,i)=>{const b=x.quantity*x.unit_price,d=Math.min(b,x.discount_amount||0);x.tax_rate=0;return `<tr><td><input style="width:230px" data-i="${i}" data-k="description" value="${esc(x.description)}"></td><td><input style="width:65px" data-i="${i}" data-k="quantity" type="number" min=".01" step=".01" value="${x.quantity}"></td><td><input style="width:85px" data-i="${i}" data-k="unit_price" type="number" min="0" step=".01" value="${x.unit_price}"></td><td><input style="width:85px" data-i="${i}" data-k="discount_amount" type="number" min="0" step=".01" value="${x.discount_amount||0}"></td><td>${money(b-d)}</td><td><button class="remove" type="button" data-remove="${i}">Remove</button></td></tr>`}).join(""):'<tr><td colspan="6" style="text-align:center;color:#748196">No invoice items added.</td></tr>';const t=calc();E.subtotal.textContent=money(t.sub);E.discountTotal.textContent=money(t.disc);E.total.textContent=money(t.total)}

  function legacyPayload(actionOverride){return{action:actionOverride||(current?"update":"create"),id:current?.id||null,employer_id:E.recipientType.value==="employer"?E.recipient.value||null:null,customer_user_id:E.recipientType.value==="customer"?E.recipient.value||null:null,status:E.status.value,customer_name:E.customerName.value.trim(),customer_email:E.customerEmail.value.trim(),issue_date:E.issueDate.value,due_date:E.dueDate.value||null,amount_paid:Number(E.amountPaid.value)||0,billing_address_line_1:E.address1.value,billing_address_line_2:E.address2.value,billing_city:E.city.value,billing_state:E.state.value,billing_postal_code:E.postal.value,terms:E.terms.value,notes:E.notes.value,metadata:{...(current?.metadata||{}),no_customer_sales_tax:true},items:items.map(x=>({...x,tax_rate:0,tax_amount:0}))}}

  async function createEntityInvoice(){
    const entity=E.issuerEntity?.value||"screenings4u";
    const created=await financeCall({action:"create_invoice",invoice:{entity_code:entity,customer_name:E.customerName.value.trim(),customer_email:E.customerEmail.value.trim(),issue_date:E.issueDate.value,due_date:E.dueDate.value||null,terms:E.terms.value,notes:E.notes.value},items});
    const result=created?.result;
    if(!result?.invoice?.id)throw Error("The company invoice was not created.");
    current={...result.invoice,items:result.items||[]};
    const patched=await call(legacyPayload("update"));
    return patched.invoice;
  }

  async function save(){
    if(!E.customerName.value.trim()||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(E.customerEmail.value.trim())){msg("Customer name and a valid email are required.","error");return}
    if(!items.length){msg("Add at least one invoice item.","error");return}
    try{
      E.save.disabled=true;msg("Saving invoice…","ok");
      if(!current)current=await createEntityInvoice();
      else current=(await call(legacyPayload("update"))).invoice;
      history.replaceState(null,"",`admin-invoice.html?id=${encodeURIComponent(current.id)}`);
      await window.S4UDocuments.store(db,current,"invoice");
      fill(current);msg(`Invoice ${current.invoice_number} saved for ${issuerName(current)} and PDF version stored.`,"ok");
    }catch(e){msg(e.message||"Unable to save invoice.","error")}
    finally{E.save.disabled=false}
  }

  function controls(){if(E.editBtn)E.editBtn.hidden=!current||mode==="edit";if(E.viewBtn)E.viewBtn.hidden=!current||mode==="view";if(E.downloadBtn)E.downloadBtn.hidden=!current;if(E.copyLink)E.copyLink.hidden=!current;if(E.sendInvoice)E.sendInvoice.hidden=!current||["paid","void","uncollectible"].includes(String(current.status||""));if(E.markPaid)E.markPaid.hidden=!current||current.status==="paid";if(E.voidInvoice)E.voidInvoice.hidden=!current||["paid","void"].includes(String(current.status||""));if(E.save)E.save.hidden=mode==="view";if(E.editPane)E.editPane.hidden=mode==="view";if(E.previewPane)E.previewPane.hidden=mode!=="view"}
  function showPreview(){if(!current)return;mode="view";E.previewPane.innerHTML=preview(current);controls()}
  function showEdit(){mode="edit";controls()}
  function preview(x){const logo=logoPath(x),issuer=issuerName(x);return `<div class="invoice-preview"><div class="preview-top"><div>${logo?`<img class="preview-logo" src="${esc(logo)}" alt="${esc(issuer)}">`:`<strong class="preview-issuer-name">${esc(issuer)}</strong>`}<div class="preview-issuer-legal">${esc(issuer)}</div></div><div class="preview-number"><h2>INVOICE</h2><strong>${esc(x.invoice_number)}</strong><div>${esc(human(x.status))}</div></div></div><hr><p><strong>Bill To:</strong> ${esc(x.customer_name)}<br>${esc(x.customer_email||"")}</p><p><strong>Issue:</strong> ${x.issue_date||"—"} &nbsp; <strong>Due:</strong> ${x.due_date||"—"}</p><table class="preview-items"><thead><tr><th>Description</th><th>Qty</th><th>Unit</th><th>Total</th></tr></thead><tbody>${(x.items||[]).map(i=>`<tr><td>${esc(i.description)}</td><td>${i.quantity}</td><td>${money(i.unit_price)}</td><td>${money(i.line_total)}</td></tr>`).join("")}</tbody></table><div class="preview-total"><div><span>Subtotal</span><strong>${money(x.subtotal)}</strong></div><div class="grand"><span>Total</span><strong>${money(x.total)}</strong></div><div><span>Paid</span><strong>${money(x.amount_paid)}</strong></div><div><span>Amount Due</span><strong>${money(x.amount_due)}</strong></div></div>${x.terms?`<p><strong>Terms:</strong><br>${esc(x.terms)}</p>`:""}${x.notes?`<p><strong>Notes:</strong><br>${esc(x.notes)}</p>`:""}</div>`}
  async function download(){if(!current)return;try{await window.S4UDocuments.download(db,current,"invoice")}catch(e){msg(e.message||"Unable to download invoice.","error")}}
  async function markPaid(){if(!current)return;try{const d=await call({action:"status",id:current.id,status:"paid"});current=d.invoice;await window.S4UDocuments.store(db,current,"invoice");fill(current);showPreview();msg("Invoice marked paid and a new PDF version was stored.","ok")}catch(e){msg(e.message||"Unable to mark invoice paid.","error")}}
  async function copyCheckoutLink(){if(!current)return;try{E.copyLink.disabled=true;msg("Generating secure checkout link…","ok");const d=await deliveryCall({action:"link",id:current.id});if(!d?.checkout_url)throw Error("Checkout link was not returned.");current={...(d.invoice||current),checkout_url:d.checkout_url};try{if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(d.checkout_url);else throw Error("clipboard unavailable")}catch(_){const ta=document.createElement("textarea");ta.value=d.checkout_url;ta.style.position="fixed";ta.style.opacity="0";document.body.appendChild(ta);ta.select();document.execCommand("copy");ta.remove()}controls();msg("Secure checkout link copied to clipboard.","ok")}catch(e){msg(e.message||"Unable to copy checkout link.","error")}finally{if(E.copyLink)E.copyLink.disabled=false}}
  async function sendInvoice(){if(!current)return;try{E.sendInvoice.disabled=true;msg("Sending invoice…","ok");const d=await deliveryCall({action:"send",id:current.id});current={...(d.invoice||current),checkout_url:d.checkout_url||current.checkout_url};fill(current);msg(`Invoice ${current.invoice_number} sent to ${current.customer_email}.`,"ok")}catch(e){console.error("send invoice failed",e);msg(e.message||"Unable to send invoice.","error")}finally{if(E.sendInvoice)E.sendInvoice.disabled=false}}
  async function voidInvoice(){if(!current)return;if(!confirm(`Void invoice ${current.invoice_number}? The customer will no longer be able to pay it.`))return;try{E.voidInvoice.disabled=true;const d=await call({action:"status",id:current.id,status:"void"});current=d.invoice;await window.S4UDocuments.store(db,current,"invoice");fill(current);showPreview();msg("Invoice voided.","ok")}catch(e){msg(e.message||"Unable to void invoice.","error")}finally{if(E.voidInvoice)E.voidInvoice.disabled=false}}
  function msg(t,type="ok"){E.message.textContent=t;E.message.className=`message show ${type}`}
  function money(v){return new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(Number(v||0))}
  function human(v){return String(v||"").replace(/_/g," ").replace(/\b\w/g,c=>c.toUpperCase())}
  function esc(v){return String(v??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;")}
})();
