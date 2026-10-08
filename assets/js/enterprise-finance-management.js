(()=>{
  'use strict';

  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const API='https://elpbnytpciqnbexiaebp.supabase.co/functions/v1/screenings4u-finance-management';
  const KEY=window.SCREENINGS4U_SUPABASE_ANON_KEY||'';
  const page=(location.pathname.split('/').pop()||'').toLowerCase();
  const cfg={
    'admin-finance-ar.html':['ar','Accounts Receivable',['Invoice','Company','Customer','Status','Due date','Total','Outstanding']],
    'admin-finance-ap.html':['ap','Accounts Payable',['Bill','Vendor','Company','Status','Due date','Total','Outstanding','Actions']],
    'admin-finance-invoices.html':['invoices','Invoicing',['Invoice','Company','Customer','Status','Payment','Total','Outstanding','Source']],
    'admin-finance-accounting.html':['accounting','Accounting',['Entry','Date','Company','Description','Status','Debits','Credits','Actions']],
    'admin-finance-statements.html':['statements','Financial Statements',['Statement','Amount']],
    'admin-finance-orders.html':['orders','All Orders',['Number','Company','Type','Customer','Status','Payment','Total','Date','Actions']],
    'admin-testing-billing.html':['ar','Testing Billing & Receivables',['Invoice','Company','Customer','Status','Due date','Total','Outstanding']],
    'admin-testing-invoices.html':['invoices','Testing Invoices',['Invoice','Company','Customer','Status','Payment','Total','Outstanding','Source']],
    'admin-training-billing.html':['ar','Training Billing & Receivables',['Invoice','Company','Customer','Status','Due date','Total','Outstanding']],
    'admin-training-invoices.html':['invoices','Training Invoices',['Invoice','Company','Customer','Status','Payment','Total','Outstanding','Source']],
    'admin-workforce-billing.html':['ar','Workforce Billing & Receivables',['Invoice','Company','Customer','Status','Due date','Total','Outstanding']],
    'admin-workforce-invoices.html':['invoices','Workforce Invoices',['Invoice','Company','Customer','Status','Payment','Total','Outstanding','Source']],
    'admin-dot-billing.html':['ar','DOT Billing & Receivables',['Invoice','Company','Customer','Status','Due date','Total','Outstanding']],
    'admin-dot-invoices.html':['invoices','DOT Invoices',['Invoice','Company','Customer','Status','Payment','Total','Outstanding','Source']]
  };
  const fixedEntities={
    'admin-testing-billing.html':'screenings4u','admin-testing-invoices.html':'screenings4u',
    'admin-training-billing.html':'training','admin-training-invoices.html':'training',
    'admin-workforce-billing.html':'workforce','admin-workforce-invoices.html':'workforce',
    'admin-dot-billing.html':'dot','admin-dot-invoices.html':'dot'
  };

  let state={data:null,overview:null,model:null,entityCode:fixedEntities[page]||localStorage.getItem('s4u_finance_entity')||'consolidated'};

  async function client(){
    for(let i=0;i<50;i++){
      const c=window.screenings4uSupabase||window.supabaseClient;
      if(c?.auth?.getSession)return c;
      await new Promise(r=>setTimeout(r,50));
    }
    throw new Error('Supabase client unavailable.');
  }

  async function request(body){
    const c=await client();
    const {data:{session}}=await c.auth.getSession();
    if(!session)throw new Error('Your staff session has expired.');
    const r=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${session.access_token}`,'apikey':KEY},body:JSON.stringify(body)});
    const d=await r.json().catch(()=>({}));
    if(!r.ok||d.error){
      const parts=[
        d.error||`Request failed (${r.status}).`,
        d.code?`Code: ${d.code}`:'',
        d.details?`Details: ${d.details}`:'',
        d.hint?`Hint: ${d.hint}`:''
      ].filter(Boolean);
      throw new Error(parts.join('\n'));
    }
    return d;
  }

  const call=(action,extra={})=>request({action,...extra});
  const money=v=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(v||0));
  const date=v=>v?new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',year:'numeric'}).format(new Date(v)):'—';
  const pill=v=>{const s=String(v||'—');const k=/paid|posted|active|completed|classified/i.test(s)?'good':/past_due|failed|void|uncollectible|needs_review/i.test(s)?'bad':'warn';return `<span class="ep-business-pill ${k}">${esc(s.replaceAll('_',' '))}</span>`};
  const company=x=>x?.finance_legal_entities?.legal_name||x?.finance_business_units?.name||x?.finance_business_units?.code||'Needs Review';
  const selectedEntity=()=>state.entityCode||'consolidated';
  const selectedEntityRecord=()=>state.model?.entities?.find(x=>x.code===selectedEntity())||null;

  function toast(m,t='success'){window.S4UUI?.toast?.(m,t)}
  function err(e){window.S4UUI?.modal?window.S4UUI.modal({title:'Finance',message:e?.message||String(e),type:'error',confirmText:'Close'}):console.error(e)}
  function form(title,message,fields,confirmText,onSubmit){if(!window.S4UUI?.formModal)throw new Error('Branded form system unavailable.');return window.S4UUI.formModal({title,message,fields,confirmText,onSubmit})}
  async function confirmBox(title,message,confirmText='Continue'){return window.S4UUI?.confirm?await window.S4UUI.confirm(message,{title,type:'warning',confirmText,cancelText:'Cancel'}):false}
  function addTop(label,fn,primary=true){const box=$('.ep-business-actions');if(!box)return;const b=document.createElement('button');b.type='button';b.className='ep-business-btn'+(primary?' primary':'');b.textContent=label;b.onclick=fn;box.prepend(b)}
  const btn=(label,attr,val,primary=false)=>`<button type="button" class="ep-mini-btn${primary?' primary':''}" ${attr}="${esc(val)}">${esc(label)}</button>`;
  function row(cells){return `<tr>${cells.map(v=>`<td>${v??'—'}</td>`).join('')}</tr>`}
  function render(rows){const body=$('#financeRows');const cols=cfg[page]?.[2]?.length||1;body.innerHTML=rows.length?rows.join(''):`<tr><td colspan="${cols}"><div class="ep-business-empty">No records found.</div></td></tr>`;$('#recordCount').textContent=String(rows.length)}

  function entityOptions(includeConsolidated=true){
    const list=(state.model?.entities||[]).filter(x=>x.active!==false);
    const out=includeConsolidated?[{value:'consolidated',label:'Consolidated · Roseland + all operating companies'}]:[];
    return out.concat(list.map(x=>({value:x.code,label:x.legal_name})));
  }

  function setupEntitySelector(){
    const host=$('.finance-entity');
    if(!host||host.dataset.selectorReady)return;
    host.dataset.selectorReady='1';
    if(fixedEntities[page]){
      state.entityCode=fixedEntities[page];
      const rec=selectedEntityRecord();
      host.innerHTML=`<span class="finance-entity-summary"><strong>${esc(rec?.legal_name||state.entityCode)}</strong> · business-owned billing records</span>`;
      return;
    }
    host.innerHTML=`<label class="finance-entity-select"><span>Company</span><select id="financeEntitySelector"></select></label><span id="financeEntitySummary" class="finance-entity-summary"></span>`;
    const sel=$('#financeEntitySelector');
    sel.innerHTML=entityOptions(true).map(x=>`<option value="${esc(x.value)}">${esc(x.label)}</option>`).join('');
    if(![...sel.options].some(o=>o.value===state.entityCode))state.entityCode='consolidated';
    sel.value=state.entityCode;
    sel.addEventListener('change',async()=>{
      state.entityCode=sel.value;
      localStorage.setItem('s4u_finance_entity',state.entityCode);
      try{await loadDataOnly()}catch(e){err(e)}
    });
    updateEntitySummary();
  }

  function updateEntitySummary(){
    const el=$('#financeEntitySummary');
    if(!el)return;
    const rec=selectedEntityRecord();
    el.textContent=selectedEntity()==='consolidated'?'Consolidated reporting view across Roseland Companies, LLC and all operating subsidiaries.':`${rec?.legal_name||selectedEntity()} · separate legal-entity books`;
  }

  function overviewCards(o){
    const m=o?.metrics||{},el=$('#financeMetrics');if(!el)return;
    el.innerHTML=[['Receivables',money(m.receivables)],['Payables',money(m.payables)],['All Orders',m.orders??0],['Needs Review',m.needs_review??0]].map(([a,b])=>`<article class="finance-metric"><span>${esc(a)}</span><strong>${esc(b)}</strong></article>`).join('');
  }

  function requireEntity(message='Select a specific company before creating this accounting record.'){
    if(selectedEntity()!=='consolidated')return true;
    err(new Error(message));
    return false;
  }

  function unitOptions(){return (state.model?.business_units||[]).filter(x=>x.code!=='corporate').map(x=>({value:x.code,label:x.name}))}
  function vendorOptions(){return (state.data?.vendors||[]).map(x=>({value:x.id,label:x.legal_name}))}
  function accountOptions(){return (state.data?.accounts||[]).map(x=>({value:x.id,label:`${x.account_number} · ${x.name}`}))}
  function businessUnitIdOptions(){
    const ent=selectedEntityRecord();
    return (state.model?.business_units||[]).filter(x=>!ent||x.legal_entity_id===ent.id).map(x=>({value:x.id,label:x.name}));
  }

  function bankOptions(){return (state.data?.bank_accounts||[]).map(x=>({value:x.id,label:`${x.account_name}${x.institution_name?` · ${x.institution_name}`:''}${x.account_last4?` · ••••${x.account_last4}`:''}`}))}

  function bankAccountForm(){
    if(!requireEntity('Select a specific company before adding a bank account.'))return;
    const ledgerAccounts=(state.data?.accounts||[]).filter(x=>['asset','liability'].includes(x.account_type));
    form('Add Bank / Payment Account',`Create the cash account used to pay bills for ${selectedEntityRecord()?.legal_name||selectedEntity()}.`,[
      {name:'account_name',label:'Account name',value:'Operating Checking',required:true},
      {name:'institution_name',label:'Financial institution',value:''},
      {name:'account_type',label:'Account type',type:'select',value:'checking',options:[{value:'checking',label:'Checking'},{value:'savings',label:'Savings'},{value:'credit_card',label:'Credit card / payment account'},{value:'other',label:'Other'}]},
      {name:'account_last4',label:'Last 4 digits',value:'',max:4},
      {name:'gl_account_id',label:'General ledger account',type:'select',value:ledgerAccounts.find(x=>x.system_code==='cash')?.id||'',required:true,options:ledgerAccounts.map(x=>({value:x.id,label:`${x.account_number} · ${x.name} (${x.account_type})`}))},
      {name:'external_reference',label:'External reference',value:''}
    ],'Save Account',async v=>{await call('save_bank_account',{bank_account:{entity_code:selectedEntity(),account_name:v.account_name,institution_name:v.institution_name,account_type:v.account_type,account_last4:v.account_last4,gl_account_id:v.gl_account_id,currency:'USD',is_primary:(state.data?.bank_accounts||[]).length===0,active:true,external_reference:v.external_reference}});toast('Bank account saved.');await loadDataOnly()})
  }

  function paymentsForBill(id){return (state.data?.payments||[]).filter(x=>x.bill_id===id)}
  function docsForPayment(id){return (state.data?.payment_documents||[]).filter(x=>x.payment_id===id)}

  function payBill(id){
    const bill=(state.data?.bills||[]).find(x=>x.id===id);if(!bill)return;
    const banks=(state.data?.bank_accounts||[]).filter(x=>x.legal_entity_id===bill.legal_entity_id);
    if(!banks.length){err(new Error('Add a bank/payment account for this company before recording a vendor payment.'));return}
    form('Record Vendor Payment',`Pay ${bill.finance_vendors?.legal_name||'vendor'} bill ${bill.bill_number||bill.id.slice(0,8)}. This will debit Accounts Payable and credit the selected cash account.`,[
      {name:'bank_account_id',label:'Pay from',type:'select',value:banks.find(x=>x.is_primary)?.id||banks[0].id,required:true,options:banks.map(x=>({value:x.id,label:`${x.account_name}${x.institution_name?` · ${x.institution_name}`:''}${x.account_last4?` · ••••${x.account_last4}`:''}`}))},
      {name:'amount',label:'Payment amount',type:'number',value:String(Number(bill.amount_due||0).toFixed(2)),required:true,min:'0.01'},
      {name:'payment_date',label:'Payment date',type:'date',value:new Date().toISOString().slice(0,10),required:true},
      {name:'payment_method',label:'Payment method',type:'select',value:'ach',options:[{value:'ach',label:'ACH'},{value:'check',label:'Check'},{value:'card',label:'Card'},{value:'wire',label:'Wire'},{value:'cash',label:'Cash'},{value:'other',label:'Other'}]},
      {name:'reference_number',label:'Reference / check number',value:''},
      {name:'memo',label:'Memo',type:'textarea',value:''}
    ],'Record Payment',async v=>{const amount=Number(v.amount||0);if(amount<=0)throw new Error('Payment amount must be greater than zero.');if(amount>Number(bill.amount_due||0)+0.005)throw new Error('Payment cannot exceed the outstanding balance.');await call('record_ap_payment',{payment:{bill_id:bill.id,bank_account_id:v.bank_account_id,amount,payment_date:v.payment_date,payment_method:v.payment_method,reference_number:v.reference_number,memo:v.memo}});toast('Vendor payment recorded and posted to the general ledger.');await loadDataOnly();openBill(id)})
  }

  async function reconcilePayment(id){
    const p=(state.data?.payments||[]).find(x=>x.id===id);if(!p||p.status==='void')return;
    form('Reconcile Payment','Mark this payment as matched to the bank statement.',[
      {name:'reconciliation_reference',label:'Statement / reconciliation reference',value:p.reconciliation_reference||''}
    ],'Mark Reconciled',async v=>{await call('reconcile_ap_payment',{payment_id:id,reconciliation_reference:v.reconciliation_reference});toast('Payment reconciled.');await loadDataOnly();openBill(p.bill_id)})
  }

  async function voidPayment(id){
    const p=(state.data?.payments||[]).find(x=>x.id===id);if(!p||p.status==='void')return;
    const reason=await window.S4UUI?.prompt?.('Why is this payment being voided?',{title:'Void Vendor Payment',label:'Reason',required:true,confirmText:'Void Payment'});
    if(reason===null||!String(reason).trim())return;
    if(!await confirmBox('Void vendor payment','This creates a reversing journal entry and restores the bill balance.','Void Payment'))return;
    await call('void_ap_payment',{payment_id:id,reason:String(reason).trim()});toast('Vendor payment voided and reversed.');await loadDataOnly();openBill(p.bill_id)
  }

  async function attachPaymentDocument(paymentId){
    const input=document.createElement('input');input.type='file';input.accept='application/pdf,image/png,image/jpeg,image/webp';
    input.onchange=async()=>{try{const file=input.files?.[0];if(!file)return;if(file.size>10*1024*1024)throw new Error('Document cannot exceed 10 MB.');const prep=await call('prepare_ap_document_upload',{payment_id:paymentId,file_name:file.name,mime_type:file.type||'application/octet-stream'});const c=await client();const up=await c.storage.from(prep.bucket_name).uploadToSignedUrl(prep.storage_path,prep.token,file,{contentType:file.type||'application/octet-stream',upsert:false});if(up.error)throw up.error;await call('complete_ap_document_upload',{payment_id:paymentId,storage_path:prep.storage_path,document_type:'receipt',file_name:file.name,mime_type:file.type||'application/octet-stream',byte_size:file.size});toast('Receipt/document attached.');const p=(state.data?.payments||[]).find(x=>x.id===paymentId);await loadDataOnly();if(p)openBill(p.bill_id)}catch(e){err(e)}};input.click()
  }

  async function openPaymentDocument(id){
    const d=await call('get_ap_document_url',{document_id:id});if(!d.url)throw new Error('Document link unavailable.');window.open(d.url,'_blank','noopener')
  }

  function closeBillPanel(){document.querySelector('.finance-bill-modal')?.remove();document.body.classList.remove('finance-bill-open')}

  function openBill(id){
    closeBillPanel();
    const bill=(state.data?.bills||[]).find(x=>x.id===id);if(!bill)return;
    const items=(state.data?.bill_items||[]).filter(x=>x.bill_id===id),payments=paymentsForBill(id);
    const modal=document.createElement('div');modal.className='finance-bill-modal';
    modal.innerHTML=`<div class="finance-bill-backdrop" data-close-bill></div><section class="finance-bill-panel"><header><div><span class="ep-eyebrow">Accounts Payable</span><h2>${esc(bill.finance_vendors?.legal_name||'Vendor Bill')}</h2><p>${esc(bill.bill_number||bill.id.slice(0,8))} · ${esc(bill.finance_legal_entities?.legal_name||'')}</p></div><button type="button" class="ep-mini-btn" data-close-bill>Close</button></header><div class="finance-bill-summary"><div><span>Total</span><strong>${money(bill.total)}</strong></div><div><span>Paid</span><strong>${money(bill.amount_paid)}</strong></div><div><span>Outstanding</span><strong>${money(bill.amount_due)}</strong></div><div><span>Status</span><strong>${pill(bill.status)}</strong></div></div><div class="finance-bill-actions">${Number(bill.amount_due||0)>0&&bill.status!=='void'?`<button type="button" class="ep-business-btn primary" data-pay-bill="${esc(bill.id)}">Record Payment</button>`:''}</div><h3>Bill Items</h3><div class="ep-finance-table-wrap"><table class="ep-finance-table finance-detail-table"><thead><tr><th>Description</th><th>Qty</th><th>Unit price</th><th>Total</th></tr></thead><tbody>${items.length?items.map(i=>row([esc(i.description),esc(i.quantity),money(i.unit_price),money(i.line_total)])).join(''):`<tr><td colspan="4">No bill lines found.</td></tr>`}</tbody></table></div><h3>Payment History</h3><div class="finance-payment-list">${payments.length?payments.map(p=>{const docs=docsForPayment(p.id);return `<article class="finance-payment-card"><div><strong>${esc(p.payment_number)}</strong><span>${date(p.payment_date)} · ${esc(String(p.payment_method||'').toUpperCase())} · ${money(p.amount)}</span><span>${pill(p.status)} ${pill(p.reconciliation_status)}</span>${p.reference_number?`<span>Reference: ${esc(p.reference_number)}</span>`:''}</div><div class="finance-payment-actions">${p.status!=='void'&&p.reconciliation_status!=='reconciled'?`<button type="button" class="ep-mini-btn" data-reconcile-payment="${esc(p.id)}">Reconcile</button>`:''}${p.status!=='void'?`<button type="button" class="ep-mini-btn" data-attach-payment="${esc(p.id)}">Attach Receipt</button><button type="button" class="ep-mini-btn" data-void-payment="${esc(p.id)}">Void</button>`:''}${docs.map(d=>`<button type="button" class="ep-mini-btn" data-open-doc="${esc(d.id)}">${esc(d.file_name)}</button>`).join('')}</div></article>`}).join(''):`<div class="ep-business-empty">No payments have been recorded.</div>`}</div></section>`;
    document.body.appendChild(modal);document.body.classList.add('finance-bill-open');
    modal.querySelectorAll('[data-close-bill]').forEach(x=>x.onclick=closeBillPanel);
    modal.querySelector('[data-pay-bill]')?.addEventListener('click',()=>{closeBillPanel();payBill(id)});
    modal.querySelectorAll('[data-reconcile-payment]').forEach(x=>x.addEventListener('click',()=>{closeBillPanel();reconcilePayment(x.dataset.reconcilePayment)}));
    modal.querySelectorAll('[data-attach-payment]').forEach(x=>x.addEventListener('click',()=>attachPaymentDocument(x.dataset.attachPayment)));
    modal.querySelectorAll('[data-void-payment]').forEach(x=>x.addEventListener('click',()=>{closeBillPanel();voidPayment(x.dataset.voidPayment)}));
    modal.querySelectorAll('[data-open-doc]').forEach(x=>x.addEventListener('click',()=>openPaymentDocument(x.dataset.openDoc).catch(err)));
  }

  function renderBankAccounts(){
    if(page!=='admin-finance-ap.html')return;let card=$('#financeBankAccountsCard');if(!card){card=document.createElement('article');card.id='financeBankAccountsCard';card.className='ep-business-card finance-bank-card';$('#financeMetrics')?.insertAdjacentElement('afterend',card)}
    const banks=state.data?.bank_accounts||[];card.innerHTML=`<div class="ep-business-card-head"><div><h2>Payment Accounts</h2><p>Bank and payment accounts available for vendor disbursements.</p></div><strong>${banks.length}</strong></div><div class="finance-bank-grid">${banks.length?banks.map(b=>`<article><strong>${esc(b.account_name)}</strong><span>${esc(b.institution_name||'Financial account')}</span><span>${esc(b.account_type||'checking')}${b.account_last4?` · ••••${esc(b.account_last4)}`:''}</span>${b.is_primary?'<em>Primary</em>':''}</article>`).join(''):'<div class="ep-business-empty">No payment accounts configured for this company.</div>'}</div>`
  }

  async function classify(id){
    form('Classify Finance Record','Assign this source transaction to the correct operating business. The transaction date determines the legal entity through the finance routing table.',[{name:'business_unit_code',label:'Business',type:'select',value:'',required:true,options:unitOptions()}],'Save Classification',async v=>{await call('classify_source',{source_record_id:id,business_unit_code:v.business_unit_code});toast('Finance record classified.');await loadDataOnly()})
  }

  function vendorForm(x={}){
    if(!requireEntity('Select the company that owns this vendor relationship before adding a vendor.'))return;
    const entity=selectedEntityRecord();
    form(x.id?'Edit Vendor':'Add Vendor',`Vendor record for ${entity?.legal_name||selectedEntity()}. Vendors remain separated by legal entity.`,[
      {name:'legal_name',label:'Legal name',value:x.legal_name||'',required:true},
      {name:'dba_name',label:'DBA / trade name',value:x.dba_name||''},
      {name:'vendor_number',label:'Vendor number',value:x.vendor_number||''},
      {name:'email',label:'Email',type:'email',value:x.email||''},
      {name:'phone',label:'Phone',value:x.phone||''},
      {name:'payment_terms',label:'Payment terms',value:x.payment_terms||'Net 30'},
      {name:'tax_id_last4',label:'Tax ID last 4',value:x.tax_id_last4||''}
    ],'Save Vendor',async v=>{await call('save_vendor',{vendor:{id:x.id||'',entity_code:selectedEntity(),...v}});toast('Vendor saved.');await loadDataOnly()})
  }

  function billForm(){
    if(!requireEntity('Select a specific company before creating a vendor bill.'))return;
    if(!(state.data?.vendors||[]).length){err(new Error(`Add a vendor for ${selectedEntityRecord()?.legal_name||'this company'} before creating a bill.`));return}
    const expense=(state.data?.accounts||[]).filter(x=>x.account_type==='expense');
    form('Add Vendor Bill',`Create an Accounts Payable obligation for ${selectedEntityRecord()?.legal_name||selectedEntity()}.`,[
      {name:'vendor_id',label:'Vendor',type:'select',value:'',required:true,options:vendorOptions()},
      {name:'business_unit_id',label:'Business unit',type:'select',value:'',options:businessUnitIdOptions()},
      {name:'bill_number',label:'Vendor bill number',value:''},
      {name:'bill_date',label:'Bill date',type:'date',value:new Date().toISOString().slice(0,10)},
      {name:'due_date',label:'Due date',type:'date',value:''},
      {name:'description',label:'Expense description',value:'',required:true},
      {name:'expense_account_id',label:'Expense account',type:'select',value:'',required:true,options:expense.map(x=>({value:x.id,label:`${x.account_number} · ${x.name}`}))},
      {name:'amount',label:'Amount',type:'number',value:'0',required:true},
      {name:'memo',label:'Memo',type:'textarea',value:''}
    ],'Create Bill',async v=>{await call('save_bill',{bill:{entity_code:selectedEntity(),vendor_id:v.vendor_id,business_unit_id:v.business_unit_id,bill_number:v.bill_number,bill_date:v.bill_date,due_date:v.due_date,memo:v.memo,tax_total:0,currency:'USD'},items:[{description:v.description,expense_account_id:v.expense_account_id,business_unit_id:v.business_unit_id,quantity:1,unit_price:Number(v.amount||0)}]});toast('Vendor bill created.');await loadDataOnly()})
  }

  function journalForm(){
    if(!requireEntity('Select a specific company before creating a journal entry. This prevents accounts from different legal entities from being mixed.'))return;
    const acc=accountOptions(),units=businessUnitIdOptions();
    form('New Journal Entry',`Create a balanced journal entry for ${selectedEntityRecord()?.legal_name||selectedEntity()}.`,[
      {name:'entry_date',label:'Entry date',type:'date',value:new Date().toISOString().slice(0,10)},
      {name:'business_unit_id',label:'Business unit',type:'select',value:'',options:units},
      {name:'description',label:'Description',value:'',required:true},
      {name:'debit_account_id',label:'Debit account',type:'select',value:'',required:true,options:acc},
      {name:'credit_account_id',label:'Credit account',type:'select',value:'',required:true,options:acc},
      {name:'amount',label:'Amount',type:'number',value:'0',required:true}
    ],'Save Draft',async v=>{const amount=Number(v.amount||0);if(amount<=0)throw new Error('Amount must be greater than zero.');await call('save_journal',{journal:{entity_code:selectedEntity(),entry_date:v.entry_date,business_unit_id:v.business_unit_id,description:v.description},lines:[{account_id:v.debit_account_id,business_unit_id:v.business_unit_id,debit:amount,credit:0,description:v.description},{account_id:v.credit_account_id,business_unit_id:v.business_unit_id,debit:0,credit:amount,description:v.description}]});toast('Journal draft saved.');await loadDataOnly()})
  }

  async function postJournal(id){if(!await confirmBox('Post journal entry','Posting makes this journal part of the financial statements. The entry must balance.','Post Journal'))return;await call('post_journal',{journal_id:id});toast('Journal posted.');await loadDataOnly()}
  async function syncSources(){if(!await confirmBox('Refresh financial sources','Refresh orders, invoices, payments, subscriptions, and billable records from every screenings4u business system. Existing source records are updated, not duplicated.','Refresh Sources'))return;const o=await call('sync_sources');toast(`Finance sources refreshed. ${o.local?.orders||0} screenings4u orders and ${o.remote?.records||0} Workforce/DOT records processed.`);await loadDataOnly()}

  function rowsFor(action,d){
    if(action==='ar')return (d.invoices||[]).map(x=>row([esc(x.source_number||'—'),esc(company(x)),esc(x.customer_name||x.customer_email||'—'),pill(x.status),date(x.source_metadata?.due_date||x.source_metadata?.due_at||x.occurred_at),money(x.total),money(x.amount_due)]));
    if(action==='invoices')return (d.invoices||[]).map(x=>row([esc(x.source_number||'—'),esc(company(x)),esc(x.customer_name||x.customer_email||'—'),pill(x.status),pill(x.payment_status),money(x.total),money(x.amount_due),esc(`${x.source_project} / ${x.source_table}`)]));
    if(action==='orders')return (d.records||[]).map(x=>row([esc(x.source_number||String(x.source_id||'').slice(0,8)),esc(company(x)),pill(x.source_type),esc(x.customer_name||x.customer_email||'—'),pill(x.status),pill(x.payment_status||'—'),money(x.total),date(x.occurred_at),x.classification_status==='needs_review'?btn('Classify','data-classify',x.id,true):pill('classified')]));
    if(action==='ap')return (d.bills||[]).map(x=>row([esc(x.bill_number||x.id.slice(0,8)),esc(x.finance_vendors?.legal_name||'—'),esc(company(x)),pill(x.status),date(x.due_date),money(x.total),money(x.amount_due),`<div class="finance-row-actions">${Number(x.amount_due||0)>0&&x.status!=='void'?btn('Pay','data-pay-bill',x.id,true):''}${btn('Open','data-bill',x.id)}</div>`]));
    if(action==='accounting'){
      const lm=new Map();
      for(const l of d.lines||[]){const z=lm.get(l.journal_entry_id)||{d:0,c:0};z.d+=Number(l.debit||0);z.c+=Number(l.credit||0);lm.set(l.journal_entry_id,z)}
      return (d.journals||[]).map(x=>{const z=lm.get(x.id)||{d:0,c:0};return row([esc(x.entry_number),date(x.entry_date),esc(company(x)),esc(x.description),pill(x.status),money(z.d),money(z.c),x.status==='draft'?btn('Post','data-post',x.id,true):'—'])})
    }
    if(action==='statements'){
      const p=d.profit_and_loss||{},b=d.balance_sheet||{};
      return [row(['Revenue',money(p.revenue)]),row(['Expenses',money(p.expenses)]),row(['Net Income',money(p.net_income)]),row(['Assets',money(b.assets)]),row(['Liabilities',money(b.liabilities)]),row(['Equity',money(b.equity)])]
    }
    return[];
  }

  function renderChartOfAccounts(d){
    let card=$('#chartOfAccountsCard');
    if(!card){
      card=document.createElement('article');card.id='chartOfAccountsCard';card.className='ep-business-card finance-coa-card';
      const metrics=$('#financeMetrics');metrics?.insertAdjacentElement('afterend',card);
    }
    const accounts=d.accounts||[];
    card.innerHTML=`<div class="ep-business-card-head"><div><h2>Chart of Accounts</h2><p>${selectedEntity()==='consolidated'?'Accounts across all active legal entities. Select a company above to work inside one set of books.':`Active accounts for ${esc(selectedEntityRecord()?.legal_name||selectedEntity())}.`}</p></div><strong>${accounts.length}</strong></div><div class="ep-finance-table-wrap"><table class="ep-finance-table finance-coa-table"><thead><tr><th>Account</th><th>Name</th><th>Type</th><th>Subtype</th><th>Company</th></tr></thead><tbody>${accounts.length?accounts.map(a=>row([esc(a.account_number),esc(a.name),pill(a.account_type),esc(a.subtype||'—'),esc(a.finance_legal_entities?.legal_name||'—')])).join(''):`<tr><td colspan="5"><div class="ep-business-empty">No accounts found.</div></td></tr>`}</tbody></table></div>`;
  }

  function bind(){
    $$('[data-classify]').forEach(b=>b.onclick=()=>classify(b.dataset.classify));
    $$('[data-post]').forEach(b=>b.onclick=()=>postJournal(b.dataset.post));
    $$('[data-bill]').forEach(b=>b.onclick=()=>openBill(b.dataset.bill));
    $$('[data-pay-bill]').forEach(b=>b.onclick=()=>payBill(b.dataset.payBill));
  }

  async function loadDataOnly(){
    const c=cfg[page];if(!c)return;
    updateEntitySummary();
    state.overview=await call('overview',{entity_code:selectedEntity()});
    overviewCards(state.overview);
    state.data=await call(c[0],{entity_code:selectedEntity()});
    render(rowsFor(c[0],state.data));
    if(c[0]==='ap')renderBankAccounts();
    if(c[0]==='accounting')renderChartOfAccounts(state.data);
    bind();
    if(c[0]==='statements'){
      const note=$('#statementNote');
      if(note)note.textContent=(state.data.posted_journal_count||0)?`${state.data.posted_journal_count} posted journal entries included. ${state.data.consolidation_status==='pre_elimination'?'Consolidated totals are shown before intercompany eliminations.':''}`:'No posted journal entries yet. Statements remain zero until accounting entries are posted.';
    }
    const newInvoice=$('[data-finance-new-invoice]');
    if(newInvoice)newInvoice.href=`admin-invoice.html${selectedEntity()!=='consolidated'?`?entity=${encodeURIComponent(selectedEntity())}`:''}`;
  }

  function printStatements(){
    const old=document.title;document.title='screenings4u Enterprise Financial Statements';window.print();document.title=old;
  }
  function exportStatements(){
    const p=state.data?.profit_and_loss||{},b=state.data?.balance_sheet||{};
    const rows=[['Statement','Amount'],['Revenue',p.revenue||0],['Expenses',p.expenses||0],['Net Income',p.net_income||0],['Assets',b.assets||0],['Liabilities',b.liabilities||0],['Equity',b.equity||0]];
    const csv=rows.map(r=>r.map(v=>'"'+String(v).replaceAll('"','""')+'"').join(',')).join('\n');
    const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));a.download='screenings4u-enterprise-financial-statements.csv';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  }

  function setupActions(action){
    document.querySelectorAll('[data-finance-refresh]').forEach(b=>{b.onclick=async()=>{b.disabled=true;try{await loadDataOnly();toast('Financial data refreshed.')}catch(e){err(e)}finally{b.disabled=false}}});
    const box=$('.ep-business-actions');if(!box||box.dataset.ready)return;
    box.dataset.ready='1';
    addTop('Refresh Sources',syncSources,false);
    if(action==='ap'){addTop('Add Bank Account',bankAccountForm,false);addTop('Add Vendor',()=>vendorForm({}),false);addTop('Add Bill',billForm,true)}
    if(action==='accounting')addTop('New Journal Entry',journalForm,true);
    if(action==='invoices'){
      const a=document.createElement('a');a.dataset.financeNewInvoice='1';a.href='admin-invoice.html';a.className='ep-business-btn primary';a.textContent='New Invoice';box.prepend(a);
    }
    if(action==='statements'){addTop('Export CSV',exportStatements,false);addTop('Print Statements',printStatements,true)}
  }

  async function load(){
    const c=cfg[page];if(!c)return;
    $('#pageTitle').textContent=c[1];
    $('#financeHeaders').innerHTML=c[2].map(x=>`<th>${esc(x)}</th>`).join('');
    state.model=await call('entities');
    setupEntitySelector();
    setupActions(c[0]);
    await loadDataOnly();
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(()=>load().catch(err),100),{once:true});
  else setTimeout(()=>load().catch(err),100);
})();
