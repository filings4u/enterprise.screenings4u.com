(()=>{
  "use strict";

  const money=(v,c="USD")=>{try{return new Intl.NumberFormat("en-US",{style:"currency",currency:c||"USD"}).format(Number(v||0))}catch{return `$${Number(v||0).toFixed(2)}`}};
  const issuerName=r=>r?.issuer_legal_name||r?.metadata?.issuer_legal_name||"screenings4u, LLC";
  const logoPath=r=>r?.issuer_logo_path||r?.metadata?.issuer_logo_path||"images/logo.png";
  const brandColor=r=>r?.issuer_brand_color||r?.metadata?.issuer_brand_color||"#24467f";
  const entityCode=r=>String(r?.issuer_entity_code||r?.metadata?.entity_code||"screenings4u").toLowerCase();
  const entitySite=r=>({training:"training.screenings4u.com",dot:"dot.screenings4u.com",workforce:"workforce.screenings4u.com",screenings4u:"screenings4u.com",testing:"screenings4u.com"}[entityCode(r)]||"screenings4u.com");
  const parentName="Roseland Companies, LLC";

  async function logoData(record){
    const path=logoPath(record); if(!path)return null;
    try{const r=await fetch(path,{cache:"no-store"});if(!r.ok)return null;const b=await r.blob();return await new Promise((res,rej)=>{const f=new FileReader();f.onload=()=>res(f.result);f.onerror=rej;f.readAsDataURL(b)})}catch(_){return null}
  }
  function rgb(hex){const h=String(hex||"#24467f").replace("#","");return /^[0-9a-f]{6}$/i.test(h)?[parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)]:[36,70,127]}
  function mix(a,b,t){return a.map((v,i)=>Math.round(v+(b[i]-v)*t))}
  function addressLines(r){const out=[];if(r?.billing_address_line_1)out.push(String(r.billing_address_line_1));if(r?.billing_address_line_2)out.push(String(r.billing_address_line_2));const city=[r?.billing_city,r?.billing_state,r?.billing_postal_code].filter(Boolean).join(r?.billing_city&&r?.billing_state?", ":" ");if(city)out.push(city);if(r?.billing_country&&String(r.billing_country).toUpperCase()!=="US")out.push(String(r.billing_country));return out}
  function statusLabel(v){return String(v||"draft").replaceAll("_"," ").toUpperCase()}
  function checkoutUrl(r){return r?.id&&r?.public_token?`https://portals.screenings4u.com/invoice-checkout.html?id=${encodeURIComponent(r.id)}&token=${encodeURIComponent(r.public_token)}`:""}

  function addInvoiceHeader(d,r,logo,brand,pageNo){
    const issuer=issuerName(r),site=entitySite(r);
    if(pageNo===1){
      if(logo){try{d.addImage(logo,undefined,48,42,172,52,undefined,"FAST")}catch(_){d.setTextColor(...brand);d.setFont("helvetica","bold");d.setFontSize(16);d.text(issuer,48,67)}}
      else{d.setTextColor(...brand);d.setFont("helvetica","bold");d.setFontSize(16);d.text(issuer,48,67)}
      d.setTextColor(26,37,52);d.setFont("helvetica","bold");d.setFontSize(25);d.text("INVOICE",564,57,{align:"right"});
      d.setFont("helvetica","normal");d.setFontSize(8.5);d.setTextColor(92,105,121);d.text(String(r.invoice_number||"Invoice"),564,73,{align:"right"});
      d.setDrawColor(218,224,231);d.line(48,108,564,108);
    }else{
      d.setTextColor(...brand);d.setFont("helvetica","bold");d.setFontSize(9);d.text(issuer,48,48);
      d.setTextColor(92,105,121);d.setFont("helvetica","normal");d.text(`${r.invoice_number||"Invoice"} - continued`,564,48,{align:"right"});
      d.setDrawColor(226,231,237);d.line(48,59,564,59);
    }
  }
  function addInvoiceFooter(d,r,page,pages){
    d.setDrawColor(226,231,237);d.line(48,746,564,746);
    d.setFont("helvetica","normal");d.setFontSize(7.2);d.setTextColor(118,129,143);
    d.text(`${issuerName(r)}  |  ${entitySite(r)}  |  A ${parentName} company`,48,762);
    d.text(`${page} / ${pages}`,564,762,{align:"right"});
  }
  function addItemTableHeader(d,y,brand){
    d.setFillColor(246,248,250);d.rect(48,y,516,25,"F");
    d.setTextColor(86,99,116);d.setFont("helvetica","bold");d.setFontSize(7.2);
    d.text("DESCRIPTION",58,y+16);d.text("QTY",372,y+16,{align:"right"});d.text("RATE",447,y+16,{align:"right"});d.text("DISCOUNT",505,y+16,{align:"right"});d.text("AMOUNT",554,y+16,{align:"right"});
    d.setDrawColor(219,225,232);d.line(48,y+25,564,y+25);return y+37;
  }
  function addInvoicePage(d,r,logo,brand,pageNo){addInvoiceHeader(d,r,logo,brand,pageNo);return pageNo===1?130:78}

  async function invoicePdf(record){
    if(!window.jspdf?.jsPDF)throw Error("PDF library not loaded.");
    const {jsPDF}=window.jspdf,d=new jsPDF({unit:"pt",format:"letter",compress:true}),logo=await logoData(record),brand=rgb(brandColor(record)),currency=record.currency||"USD";
    const dark=[26,37,52],muted=[91,104,121],items=record.items||[];
    let page=1,y=addInvoicePage(d,record,logo,brand,page);

    // Compact document metadata - no dashboard cards or pills.
    d.setFont("helvetica","bold");d.setFontSize(7.2);d.setTextColor(...muted);
    d.text("ISSUE DATE",48,y);d.text("DUE DATE",156,y);d.text("STATUS",264,y);d.text("BALANCE DUE",564,y,{align:"right"});
    d.setFontSize(9);d.setTextColor(...dark);d.text(String(record.issue_date||"-"),48,y+17);d.text(String(record.due_date||"-"),156,y+17);d.text(statusLabel(record.status),264,y+17);
    d.setFont("helvetica","bold");d.setFontSize(16);d.setTextColor(...brand);d.text(money(record.amount_due,currency),564,y+18,{align:"right"});
    y+=55;d.setDrawColor(226,231,237);d.line(48,y,564,y);y+=25;

    // Parties.
    d.setFont("helvetica","bold");d.setFontSize(7.2);d.setTextColor(...muted);d.text("FROM",48,y);d.text("BILL TO",316,y);
    y+=17;d.setTextColor(...dark);d.setFontSize(10.5);d.text(issuerName(record),48,y);d.text(String(record.customer_name||"Customer"),316,y);
    d.setFont("helvetica","normal");d.setFontSize(8.4);d.setTextColor(...muted);
    d.text(entitySite(record),48,y+16);d.text("support@screenings4u.com",48,y+29);
    const bill=[record.customer_email,...addressLines(record)].filter(Boolean).map(String);let by=y+16;for(const line of bill){d.text(line,316,by);by+=13}
    y=Math.max(y+63,by+15);

    // Line items.
    d.setFont("helvetica","bold");d.setFontSize(8);d.setTextColor(...dark);d.text("DETAILS",48,y);y+=11;y=addItemTableHeader(d,y,brand);
    for(let index=0;index<items.length;index++){
      const x=items[index],q=Number(x.quantity||1),u=Number(x.unit_price||0),disc=Number(x.discount_amount||0),line=Number(x.line_total??(q*u-disc));
      const desc=d.splitTextToSize(String(x.description||"Service"),275),rowH=Math.max(32,desc.length*11+12);
      if(y+rowH>650){d.addPage();page++;y=addInvoicePage(d,record,logo,brand,page);y=addItemTableHeader(d,y,brand)}
      d.setTextColor(...dark);d.setFont("helvetica","normal");d.setFontSize(8.6);d.text(desc,58,y+5);
      d.setTextColor(...muted);d.text(String(q),372,y+5,{align:"right"});d.text(money(u,currency),447,y+5,{align:"right"});d.text(disc?`-${money(disc,currency)}`:"-",505,y+5,{align:"right"});
      d.setTextColor(...dark);d.setFont("helvetica","bold");d.text(money(line,currency),554,y+5,{align:"right"});
      d.setDrawColor(235,239,243);d.line(48,y+rowH-7,564,y+rowH-7);y+=rowH;
    }

    const need=165;if(y+need>700){d.addPage();page++;y=addInvoicePage(d,record,logo,brand,page)}
    y+=20;
    // Terms on left, totals on right.
    const totalsX=410,valueX=564;let ty=y;
    const totalRow=(label,value,bold=false)=>{d.setFont("helvetica",bold?"bold":"normal");d.setFontSize(bold?9.5:8.4);d.setTextColor(...(bold?dark:muted));d.text(label,totalsX,ty,{align:"right"});d.setTextColor(...dark);d.text(value,valueX,ty,{align:"right"});ty+=18};
    totalRow("Subtotal",money(record.subtotal,currency));if(Number(record.discount_total||0))totalRow("Discount",`-${money(record.discount_total,currency)}`);if(Number(record.tax_total||0))totalRow("Tax",money(record.tax_total,currency));
    d.setDrawColor(211,218,226);d.line(426,ty-7,564,ty-7);totalRow("Total",money(record.total,currency),true);if(Number(record.amount_paid||0))totalRow("Payments",`-${money(record.amount_paid,currency)}`);
    d.setFont("helvetica","bold");d.setFontSize(9);d.setTextColor(...muted);d.text("AMOUNT DUE",totalsX,ty+3,{align:"right"});d.setFontSize(15);d.setTextColor(...brand);d.text(money(record.amount_due,currency),valueX,ty+3,{align:"right"});

    let leftY=y;if(record.terms){d.setFont("helvetica","bold");d.setFontSize(7.2);d.setTextColor(...muted);d.text("PAYMENT TERMS",48,leftY);leftY+=14;d.setFont("helvetica","normal");d.setFontSize(8.2);d.setTextColor(...dark);const lines=d.splitTextToSize(String(record.terms),285);d.text(lines,48,leftY);leftY+=lines.length*10+15}
    if(record.notes){d.setFont("helvetica","bold");d.setFontSize(7.2);d.setTextColor(...muted);d.text("NOTES",48,leftY);leftY+=14;d.setFont("helvetica","normal");d.setFontSize(8.2);d.setTextColor(...dark);d.text(d.splitTextToSize(String(record.notes),285),48,leftY)}

    // Payment URL is a quiet document note, not a giant web CTA.
    const pay=checkoutUrl(record);const py=Math.max(leftY,ty+20);
    if(pay&&Number(record.amount_due||0)>0&&!['paid','void','uncollectible'].includes(String(record.status))&&py<716){
      d.setDrawColor(...brand);d.setLineWidth(.8);d.line(48,py,564,py);d.setFont("helvetica","bold");d.setFontSize(8);d.setTextColor(...brand);d.textWithLink("Pay securely online",48,py+18,{url:pay});d.setFont("helvetica","normal");d.setTextColor(...muted);d.text("Payment is processed securely by Stripe through the screenings4u billing portal.",135,py+18);
    }

    const pages=d.getNumberOfPages();for(let i=1;i<=pages;i++){d.setPage(i);addInvoiceFooter(d,record,i,pages)}return d;
  }

  async function legacyPdf(record,type){
    if(!window.jspdf?.jsPDF)throw Error("PDF library not loaded.");
    const {jsPDF}=window.jspdf,d=new jsPDF({unit:"pt",format:"letter"}),logo=await logoData(record),brand=rgb(brandColor(record)),issuer=issuerName(record);let y=48;
    if(logo){try{d.addImage(logo,undefined,48,35,170,56)}catch(_){}}else{d.setTextColor(...brand);d.setFontSize(17);d.text(issuer,48,58)}
    d.setTextColor(...brand);d.setFontSize(22);d.text(type.toUpperCase(),564,55,{align:"right"});d.setFontSize(10);d.text(record.invoice_number||record.proposal_number||"S4U",564,73,{align:"right"});
    d.setTextColor(40,50,65);y=112;d.setFontSize(8);d.text(`Issued by: ${issuer}`,48,y);y+=22;const name=record.customer_name||"Customer";d.setFontSize(11);d.text(`Prepared For: ${name}`,48,y);y+=16;d.setFontSize(9);if(record.customer_email)d.text(record.customer_email,48,y);y+=24;
    if(type==="invoice"){d.text(`Issue Date: ${record.issue_date||"-"}`,48,y);d.text(`Due Date: ${record.due_date||"-"}`,280,y);y+=28}else{d.text(`Valid Until: ${record.valid_until||"-"}`,48,y);y+=28}
    if(record.title){d.setFontSize(14);d.setTextColor(...brand);d.text(record.title,48,y);y+=22;d.setTextColor(40,50,65)}
    const sections=type==="proposal"?[["Executive Summary",record.executive_summary],["Client Needs",record.client_needs],["Proposed Solution",record.proposed_solution],["Scope of Work",record.scope_of_work],["Deliverables",record.deliverables],["Implementation Plan",record.implementation_plan],["Value Proposition",record.value_proposition],["Qualifications",record.qualifications]]:type==="quote"?[["Introduction",record.introduction]]:[];
    for(const [h,v] of sections){if(!v)continue;if(y>690){d.addPage();y=48}d.setFontSize(11);d.setTextColor(...brand);d.text(h,48,y);y+=14;d.setFontSize(9);d.setTextColor(40,50,65);const lines=d.splitTextToSize(String(v),515);d.text(lines,48,y);y+=lines.length*11+14}
    if(y>620){d.addPage();y=48}d.setFillColor(245,247,250);d.rect(48,y,516,22,"F");d.setFontSize(8);d.setTextColor(...brand);d.text("DESCRIPTION",54,y+14);d.text("QTY",350,y+14);d.text("UNIT",405,y+14);d.text("TOTAL",510,y+14);y+=32;
    for(const x of record.items||[]){if(y>700){d.addPage();y=48}const q=Number(x.quantity||1),u=Number(x.unit_price||0),line=Number(x.line_total??q*u);d.setTextColor(40,50,65);d.text(String(x.description||"Service").slice(0,58),54,y);d.text(String(q),350,y);d.text(money(u),405,y);d.text(money(line),510,y);y+=17}
    y+=10;d.setFontSize(10);d.setTextColor(...brand);d.text(`Subtotal: ${money(record.subtotal)}`,564,y,{align:"right"});y+=15;if(Number(record.discount_total)){d.text(`Discount: -${money(record.discount_total)}`,564,y,{align:"right"});y+=15}if(Number(record.tax_total)){d.text(`Tax: ${money(record.tax_total)}`,564,y,{align:"right"});y+=15}d.setFontSize(14);d.text(`Total: ${money(record.total)}`,564,y,{align:"right"});y+=25;
    const tail=type==="proposal"?[["Timeline",record.timeline_summary],["Terms",record.terms],["Next Steps",record.next_steps]]:[["Terms",record.terms],["Notes",record.notes]];for(const [h,v] of tail){if(!v)continue;if(y>690){d.addPage();y=48}d.setFontSize(10);d.setTextColor(...brand);d.text(h,48,y);y+=13;d.setFontSize(8);d.setTextColor(40,50,65);const lines=d.splitTextToSize(String(v),515);d.text(lines,48,y);y+=lines.length*10+12}
    const pages=d.getNumberOfPages();for(let i=1;i<=pages;i++){d.setPage(i);d.setFontSize(7);d.setTextColor(120);d.text(`${issuer} | ${record.invoice_number||record.proposal_number||"S4U"} | Page ${i} of ${pages}`,306,770,{align:"center"})}return d;
  }

  async function pdf(record,type){return type==="invoice"?invoicePdf(record):legacyPdf(record,type)}
  async function store(db,record,type){const d=await pdf(record,type),uri=d.output("datauristring"),base64=uri.split(",")[1],tracking=record.invoice_number||record.proposal_number;const {data,error}=await db.functions.invoke("business-document-actions",{body:{action:"store",entity_type:type,entity_id:record.id,tracking_number:tracking,owner_user_id:record.customer_user_id||record.user_id||null,employer_id:record.employer_id||null,pdf_base64:base64}});if(error)throw error;if(data?.error)throw Error(data.error);return data}
  async function get(db,id,type){const {data,error}=await db.functions.invoke("business-document-actions",{body:{action:"get",entity_type:type,entity_id:id}});if(error)throw error;if(data?.error)throw Error(data.error);return data}
  async function download(db,record,type){let g=await get(db,record.id,type);if(!g.exists){await store(db,record,type);g=await get(db,record.id,type)}const a=document.createElement("a");a.href=g.url;a.download=`${record.invoice_number||record.proposal_number}-${type}.pdf`;a.target="_blank";document.body.appendChild(a);a.click();a.remove()}
  window.S4UDocuments={pdf,store,get,download};
})();
