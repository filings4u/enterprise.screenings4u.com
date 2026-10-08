(()=>{'use strict';
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const page=(location.pathname.split('/').pop()||'admin-dashboard.html').toLowerCase();
const PUBLIC_AUTH_PAGES=new Set([
  'admin-login.html','customer-login.html','employer-login.html','employee-login.html',
  'login.html','forgot-password.html','reset-password.html','set-password.html','auth-handoff.html'
]);
if(PUBLIC_AUTH_PAGES.has(page)) return;
const query=new URLSearchParams(location.search);
const queryBusiness=String(query.get('business')||'').toLowerCase();
const state={ctx:null};
const storage={get(k){try{return localStorage.getItem(k)}catch{return null}},set(k,v){try{localStorage.setItem(k,v)}catch{}}};
const ICONS={
 home:'<svg viewBox="0 0 24 24"><path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10.5V20h13v-9.5"/><path d="M9.5 20v-6h5v6"/></svg>',
 testing:'<svg viewBox="0 0 24 24"><path d="M9 3h6"/><path d="M10 3v5l-4.5 8.4A3 3 0 0 0 8.1 21h7.8a3 3 0 0 0 2.6-4.6L14 8V3"/><path d="M7.5 15h9"/></svg>',
 training:'<svg viewBox="0 0 24 24"><path d="m3 8 9-4 9 4-9 4-9-4Z"/><path d="M7 10.2V15c0 1.8 2.2 3 5 3s5-1.2 5-3v-4.8"/><path d="M21 8v6"/></svg>',
 workforce:'<svg viewBox="0 0 24 24"><circle cx="8" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M2.5 20c.4-4 2.5-6 5.5-6s5.1 2 5.5 6"/><path d="M13 16c1-.9 2.2-1.4 3.8-1.4 2.5 0 4 1.6 4.7 4.4"/></svg>',
 dot:'<svg viewBox="0 0 24 24"><path d="M4 6h11v10H4z"/><path d="M15 9h3l2 3v4h-5z"/><circle cx="8" cy="18" r="2"/><circle cx="17.5" cy="18" r="2"/></svg>',
 assignments:'<svg viewBox="0 0 24 24"><path d="M4 5h16v14H4z"/><path d="M8 3v4M16 3v4M4 9h16"/><path d="M8 13h3M8 16h6"/></svg>',
 finance:'<svg viewBox="0 0 24 24"><path d="M4 7h16v12H4z"/><path d="M4 10h16"/><path d="M8 15h3"/><path d="M7 4h10"/></svg>',
 crm:'<svg viewBox="0 0 24 24"><path d="M4 5h16v11H8l-4 4V5Z"/><path d="M8 9h8M8 12h5"/></svg>',
 schedule:'<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18"/><path d="M8 14h3M13 14h3M8 17h3"/></svg>',
 docs:'<svg viewBox="0 0 24 24"><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v5h5M9 13h6M9 17h6"/></svg>',
 staff:'<svg viewBox="0 0 24 24"><circle cx="8" cy="8" r="3"/><path d="M3 20c.5-4 2.4-6 5-6s4.5 2 5 6"/><path d="M16 7h5M18.5 4.5v5M16 14h5M16 18h5"/></svg>',
 audit:'<svg viewBox="0 0 24 24"><path d="M12 3l7 3v5c0 4.8-2.7 8.1-7 10-4.3-1.9-7-5.2-7-10V6l7-3Z"/><path d="M9 12l2 2 4-4"/></svg>',
 settings:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.4-2.4 1a7.5 7.5 0 0 0-1.8-1L14.4 3h-4.8l-.4 3.1a7.5 7.5 0 0 0-1.8 1l-2.4-1-2 3.4L5 11a7 7 0 0 0 0 2l-2 1.5 2 3.4 2.4-1a7.5 7.5 0 0 0 1.8 1l.4 3.1h4.8l.4-3.1a7.5 7.5 0 0 0 1.8-1l2.4 1 2-3.4L19 13a7 7 0 0 0 0-1Z"/></svg>',
 tech:'<svg viewBox="0 0 24 24"><path d="M8 12h8M12 8v8"/><rect x="4" y="4" width="16" height="16" rx="3"/></svg>',
 help:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M9.7 9a2.5 2.5 0 1 1 4.4 1.7c-.9.9-2.1 1.2-2.1 2.8M12 17h.01"/></svg>',
 operations:'<svg viewBox="0 0 24 24"><path d="M4 6h10M18 6h2M4 12h3M11 12h9M4 18h7M15 18h5"/><circle cx="16" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="13" cy="18" r="2"/></svg>',
 services:'<svg viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h16"/><path d="M7 4v6M12 9v6M17 14v6"/></svg>',
 user:'<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="3.5"/><path d="M5 20c.6-4.2 2.9-6.3 7-6.3s6.4 2.1 7 6.3"/></svg>',
 search:'<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>',
 bell:'<svg viewBox="0 0 24 24"><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 8h18c0-1-3-1-3-8"/><path d="M10 21h4"/></svg>',
 user:'<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21c.7-5 3.2-7.5 8-7.5s7.3 2.5 8 7.5"/></svg>',
 menu:'<svg viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
 x:'<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg>',
 chevron:'<svg viewBox="0 0 24 24"><path d="m9 6 6 6-6 6"/></svg>'
};
const modules={
 enterprise:{label:'Enterprise',landing:'admin-dashboard.html',product:null,permission:c=>!!c?.super_admin,groups:[
  ['Global Ecosystem',[
   ['admin-global-staff.html','Global Staff','staff'],['admin-catalog-management.html','Global Catalog Governance','services']]],
  ['Global Governance',[
   ['admin-legacy-routes.html','Portal Routes','tech']]]]},
 testing:{label:'Testing',landing:'admin-testing.html',product:'screenings4u',groups:[
  ['Operations',[
   ['admin-testing-operations.html','Operations','operations'],['admin-testing-work-orders.html','Work Orders','assignments'],['admin-testing-results.html','Results','testing'],['admin-testing-result-documents.html','Result Documents','docs']]],
  ['Service Requests',[
   ['admin-testing-mobile-requests.html','Mobile Testing','schedule'],['admin-testing-onsite-requests.html','On-Site Workplace','schedule'],['admin-testing-post-accident.html','Post-Accident','testing']]],
  ['Customers & Sales',[
   ['admin-testing-customers.html','Customers & Employers','user'],['admin-testing-portal-access.html','Portal Access','settings'],['admin-testing-proposals.html','Proposals','crm'],['admin-testing-background-checks.html','Background Checks','services']]],
  ['Resources & Content',[
   ['admin-testing-documents.html','Private Documents','docs'],['admin-testing-collectors.html','Collector Network','workforce'],['admin-testing-services.html','Services & Pricing','services'],['admin-testing-blog.html','Blog Editor','docs'],['admin-testing-reports.html','Reports','audit']]],
  ['Company Administration',[
   ['admin-organizations.html?business=testing','Organizations & Accounts','crm'],['admin-people.html?business=testing','People & Identity','staff'],['admin-access.html?business=testing','Portal Users & Access','user'],['admin-customer-setup.html?business=testing','Customer Setup & Configuration','settings'],['admin-testing-tasks.html','Task Manager','schedule']]],
  ['Business Administration',[
   ['admin-testing-settings.html','Settings','settings'],['admin-testing-support.html','Support','help'],['admin-testing-billing.html','Billing & Receivables','finance'],['admin-testing-invoices.html','Invoicing','finance'],['admin-notifications.html?business=testing','Notifications','bell']]]]},
 training:{label:'Training',landing:'admin-lms-dashboard.html',product:'training',groups:[
  ['Learner Management',[
   ['admin-lms-enrollments.html','Enrollments'],['admin-lms-progress.html','Learner Progress'],['admin-lms-documents.html','Learner Documents','docs'],['admin-lms-certificates.html','Certificates','docs']]],
  ['Course Management',[
   ['admin-lms-courses.html','Courses'],['admin-lms-creation.html','Create Course'],['admin-lms-quizzes.html','Quizzes'],['admin-lms-video.html','Media']]],
  ['Storefront & Commerce',[
   ['admin-lms-storefront.html','Storefront & Pricing','services'],['admin-lms-orders.html','Training Orders','orders'],['admin-lms-fulfillment.html','Order Fulfillment','orders'],['admin-lms-order-create.html','Create Training Order','training'],['admin-lms-group-seats.html','Group Training Seats','training']]],
  ['Operations & Reporting',[
   ['admin-lms-reports.html','Reports','audit']]],
  ['Company Administration',[
   ['admin-lms-tasks.html','Task Manager','schedule']]],
  ['Business Administration',[
   ['admin-lms-settings.html','Settings','settings'],['admin-lms-support.html','Support','help'],['admin-lms-billing.html','Billing & Invoicing','finance'],['admin-lms-notifications.html?business=training','Notifications','bell']]]]},
 workforce:{label:'Workforce',landing:'admin-organizations.html?business=workforce&type=ctpa',product:'workforce',groups:[
  ['Customers & Access',[
   ['admin-workforce-ctpas.html','C/TPA Accounts'],['admin-workforce-employers.html','Non-DOT Employers'],['admin-workforce-employees.html','Employees / NON-DOT Drivers'],['admin-workforce-onboarding.html','Onboarding'],['admin-workforce-portal-access.html','NON-DOT Portal Access'],['admin-workforce-users.html','Users & Team'],['admin-customer-assignments.html?business=workforce','Staff Assignments']]],
  ['Programs & Testing',[
   ['admin-operations-command-center.html?business=workforce&tab=programs','Program Operations','operations'],['admin-workforce-programs.html','Non-DOT Programs'],['admin-workforce-pools.html','Consortiums & Random Pools'],['admin-workforce-pool-members.html','Pool Memberships'],['admin-workforce-selections.html','Random Selections'],['admin-workforce-testing.html','Testing Orders'],['admin-workforce-results.html','Results']]],
  ['Customer Configuration',[
   ['admin-workforce-catalog.html','Storefront, Plans & Pricing','services'],['admin-customer-setup.html?business=workforce&tab=manage','Locations'],['admin-customer-setup.html?business=workforce&tab=manage','Branding'],['admin-customer-setup.html?business=workforce&tab=manage','Consents & Acknowledgments'],['admin-customer-setup.html?business=workforce&tab=manage','Credentials']]],
  ['Operations & Compliance',[
   ['admin-workforce-catalog.html?view=services','Service Configuration'],['admin-workforce-compliance.html','Compliance Cases'],['admin-customer-setup.html?business=workforce&tab=manage','Policies'],['admin-workforce-training.html','Training Records'],['admin-workforce-reports.html','Reports']]],
  ['Company Administration',[
   ['admin-organizations.html?business=workforce','Organizations & Accounts','crm'],['admin-people.html?business=workforce','People & Identity','staff'],['admin-access.html?business=workforce','Portal Users & Access','user'],['admin-customer-setup.html?business=workforce','Customer Setup & Configuration','settings'],['admin-workforce-tasks.html','Task Manager','schedule']]],
  ['Business Administration',[
   ['admin-workforce-settings.html','Settings','settings'],['admin-workforce-support.html','Support','help'],['admin-workforce-billing.html','Billing & Receivables','finance'],['admin-workforce-invoices.html','Invoicing','finance'],['admin-notifications.html?business=workforce','Notifications','bell']]]]},
 dot:{label:'DOT',landing:'admin-dot.html',product:'dot',groups:[
  ['Customers & Access',[
   ['admin-dot-ctpas.html','DOT C/TPAs'],['admin-dot-employers.html','DOT Employers'],['admin-dot-owner-operators.html','Owner-Operators'],['admin-dot-drivers.html','Drivers'],['admin-dot-portal-access.html','Portal Access'],['admin-dot-staff-assignments.html','Staff Assignments']]],
  ['Programs & Randoms',[
   ['admin-dot-operations.html','DOT Program Operations','operations'],['admin-dot-programs.html','DOT Programs'],['admin-dot-consortiums.html','Consortiums'],['admin-dot-pools.html','Random Pools'],['admin-dot-pool-members.html','Pool Memberships'],['admin-dot-selections.html','Random Selections'],['admin-dot-testing.html','Testing Orders'],['admin-dot-results.html','Results'],['admin-dot-post-accident.html','Post-Accident']]],
  ['Plans & Customer Configuration',[
   ['admin-dot-catalog.html','Storefront, Plans & Pricing','services'],['admin-dot-features.html','Plan Features & Access','settings'],['admin-dot-users.html','DOT Users & Roles'],['admin-dot-locations.html','Locations'],['admin-dot-integrations.html','Integrations'],['admin-dot-consents.html','Consents & Acknowledgments'],['admin-dot-credentials.html','Credentials'],['admin-dot-training.html','Training Records']]],
  ['Agency Management',[
   ['admin-dot-fmcsa.html','FMCSA'],['admin-dot-faa.html','FAA'],['admin-dot-fra.html','FRA'],['admin-dot-fta.html','FTA'],['admin-dot-phmsa.html','PHMSA'],['admin-dot-uscg.html','USCG']]],
  ['Regulatory Operations',[
   ['admin-dot-clearinghouse.html','Clearinghouse'],['admin-dot-new-entrant.html','New Entrant Audits'],['admin-dot-rtd.html','Return-to-Duty / SAP'],['admin-dot-compliance.html','Compliance Cases'],['admin-dot-services.html','DOT Service Catalog'],['admin-dot-orders.html','Service Orders'],['admin-dot-reports.html','Reports']]],
  ['DOT Administration',[
   ['admin-dot-settings.html','Settings','settings'],['admin-dot-audit.html','Audit History'],['admin-dot-support.html','Support','help'],['admin-dot-billing.html','Billing & Receivables','finance'],['admin-dot-invoices.html','Invoicing','finance'],['admin-dot-notifications.html','Notifications','bell']]]]},
 finance:{label:'Finance',landing:'admin-finance-ar.html',product:'finance',permission:c=>!c||c.super_admin||(c.permissions||[]).some(x=>String(x).startsWith('finance.')),groups:[
  ['Finance Operations',[
   ['admin-finance-ar.html','Revenue, Billing & Receivables','finance'],['admin-finance-invoices.html','Invoices','finance'],['admin-finance-orders.html','Orders & Payments','orders'],['admin-finance-ap.html','Accounts Payable','finance'],['admin-finance-accounting.html','Accounting','finance'],['admin-finance-statements.html','Financial Statements','finance']]],
  ['Billing Tools',[
   ['admin-checkout.html','Checkout','finance'],['admin-discounts.html','Discounts & Promotions','finance']]]]} 
};
const explicit={
 'admin-global-staff-record.html':'enterprise','admin-intake-documents.html':'enterprise', 'admin-testing-command-center.html':'testing','admin-testing.html':'testing','admin-testing-orders.html':'testing','admin-testing-cases.html':'testing','admin-testing-case.html':'testing','admin-testing-schedule.html':'testing','admin-testing-results.html':'testing','admin-testing-providers.html':'testing','admin-testing-customers.html':'testing','admin-testing-services.html':'testing','admin-testing-background.html':'testing','admin-testing-mobile.html':'testing','admin-testing-post-accident.html':'testing','admin-testing-court-orders.html':'testing','admin-testing-documents.html':'testing','admin-testing-reports.html':'testing','admin-orders.html':'testing','admin-test-results.html':'testing','admin-scheduling.html':'testing',
 'admin-workforce.html':'workforce','admin-workforce-ctpas.html':'workforce','admin-workforce-employers.html':'workforce','admin-workforce-employer.html':'workforce','admin-workforce-employees.html':'workforce','admin-workforce-employee.html':'workforce','admin-workforce-onboarding.html':'workforce','admin-workforce-portal-access.html':'workforce','admin-workforce-programs.html':'workforce','admin-workforce-pools.html':'workforce','admin-workforce-pool-members.html':'workforce','admin-workforce-selections.html':'workforce','admin-workforce-services.html':'workforce','admin-workforce-compliance.html':'workforce','admin-workforce-policies.html':'workforce','admin-workforce-documents.html':'workforce','admin-workforce-training.html':'workforce','admin-workforce-notifications.html':'workforce','admin-workforce-testing.html':'workforce','admin-workforce-results.html':'workforce','admin-workforce-plans.html':'workforce','admin-workforce-billing.html':'workforce','admin-workforce-users.html':'workforce','admin-workforce-locations.html':'workforce','admin-workforce-branding.html':'workforce','admin-workforce-integrations.html':'workforce','admin-workforce-consents.html':'workforce','admin-workforce-credentials.html':'workforce','admin-workforce-audit.html':'workforce','admin-workforce-support.html':'workforce','admin-workforce-reports.html':'workforce','admin-customer-assignments.html':'workforce',
 'admin-dot-user.html':'dot','admin-dot-order.html':'dot','admin-dot-result.html':'dot','admin-dot-staff-assignments.html':'dot','admin-dot-staff-assignment.html':'dot','admin-dot-ctpa-staff.html':'dot','admin-dot-employer-staff.html':'dot','admin-dot.html':'dot','admin-dot-testing.html':'dot','admin-dot-results.html':'dot','admin-dot-post-accident.html':'dot','admin-dot-plans.html':'dot','admin-dot-billing.html':'dot','admin-dot-users.html':'dot','admin-dot-locations.html':'dot','admin-dot-integrations.html':'dot','admin-dot-consents.html':'dot','admin-dot-credentials.html':'dot','admin-dot-training.html':'dot','admin-dot-support.html':'dot','admin-dot-audit.html':'dot','admin-dot-orders.html':'dot','admin-dot-fmcsa.html':'dot','admin-dot-faa.html':'dot','admin-dot-fra.html':'dot','admin-dot-fta.html':'dot','admin-dot-phmsa.html':'dot','admin-dot-uscg.html':'dot','admin-dot-ctpas.html':'dot','admin-dot-employers.html':'dot','admin-dot-owner-operators.html':'dot','admin-dot-drivers.html':'dot','admin-dot-portal-access.html':'dot','admin-dot-programs.html':'dot','admin-dot-consortiums.html':'dot','admin-dot-pools.html':'dot','admin-dot-pool-members.html':'dot','admin-dot-selections.html':'dot','admin-dot-clearinghouse.html':'dot','admin-dot-new-entrant.html':'dot','admin-dot-rtd.html':'dot','admin-dot-compliance.html':'dot','admin-dot-services.html':'dot','admin-dot-documents.html':'dot','admin-dot-notifications.html':'dot','admin-dot-reports.html':'dot',
 'admin-testing-catalog.html':'testing','admin-training-catalog.html':'training','admin-lms-orders.html':'training','admin-lms-fulfillment.html':'training','admin-lms-group-seats.html':'training','admin-lms-group-seat.html':'training','admin-lms-documents.html':'training','admin-lms-certificates.html':'training','admin-lms-reports.html':'training','admin-workforce-catalog.html':'workforce','admin-dot-catalog.html':'dot',
 'admin-finance-ar.html':'finance','admin-finance-ap.html':'finance','admin-finance-invoices.html':'finance','admin-finance-accounting.html':'finance','admin-finance-statements.html':'finance','admin-finance-orders.html':'finance','admin-invoices.html':'finance','admin-invoice.html':'finance','admin-checkout.html':'finance','admin-discounts.html':'finance','admin-revenue-service-management.html':'finance',
 'admin-testing-support.html':'testing','admin-testing-billing.html':'testing','admin-testing-invoices.html':'testing','admin-testing-settings.html':'testing',
 'admin-training-support.html':'training','admin-training-billing.html':'training','admin-training-invoices.html':'training','admin-training-settings.html':'training','admin-lms-invoice.html':'training',
 'admin-workforce-settings.html':'workforce','admin-workforce-invoices.html':'workforce',
 'admin-dot-settings.html':'dot','admin-dot-config-record.html':'dot','admin-dot-invoices.html':'dot' 
};
const navAliases={
 'admin-audit-event.html':'admin-audit.html',
 'admin-testing.html':'admin-testing-command-center.html',
 'admin-testing-case.html':'admin-testing-command-center.html',
 'admin-testing-cases.html':'admin-testing-command-center.html',
 'admin-testing-orders.html':'admin-testing-command-center.html',
 'admin-testing-results.html':'admin-testing-command-center.html',
 'admin-testing-schedule.html':'admin-testing-command-center.html',
 'admin-testing-providers.html':'admin-testing-command-center.html',
 'admin-testing-customers.html':'admin-testing-command-center.html',
 'admin-testing-background.html':'admin-testing-command-center.html',
 'admin-testing-mobile.html':'admin-testing-command-center.html',
 'admin-testing-post-accident.html':'admin-testing-command-center.html',
 'admin-testing-court-orders.html':'admin-testing-command-center.html',
 'admin-testing-reports.html':'admin-testing-command-center.html',
 'admin-orders.html':'admin-testing-command-center.html',
 'admin-test-results.html':'admin-testing-command-center.html',
 'admin-scheduling.html':'admin-work-management.html',
 'admin-scheduling-availability.html':'admin-work-management.html',
 'admin-scheduling-booking-form.html':'admin-work-management.html',
 'admin-scheduling-locations.html':'admin-work-management.html',
 'admin-scheduling-notifications.html':'admin-work-management.html',
 'admin-scheduling-overrides.html':'admin-work-management.html',
 'admin-scheduling-resources.html':'admin-work-management.html',
 'admin-scheduling-services.html':'admin-work-management.html',
 'admin-scheduling-settings.html':'admin-work-management.html',
 'admin-scheduling-staff.html':'admin-work-management.html',
 'admin-scheduling-time-off.html':'admin-work-management.html',
 'admin-scheduling-waitlist.html':'admin-work-management.html',
 'admin-customer-chat.html':'admin-work-management.html',
 'admin-internal-chat.html':'admin-work-management.html',
 'admin-tasks.html':'admin-work-management.html',
 'admin-crm.html':'admin-people.html',
 'admin-security-access.html':'admin-people.html',
 'admin-staff.html':'admin-people.html',
 'admin-customer-crm.html':'admin-access.html',
 'admin-employer-crm.html':'admin-organizations.html',
 'admin-lms-dashboard.html':'admin-lms-dashboard.html',
 'admin-lms-enrollment.html':'admin-lms-enrollments.html','admin-lms-document.html':'admin-lms-documents.html','admin-lms-document-upload.html':'admin-lms-documents.html','admin-lms-certificate.html':'admin-lms-certificates.html',

 'admin-lms-course-manager.html':'admin-lms-courses.html',
 'admin-lms-course-builder.html':'admin-lms-courses.html',
 'admin-lms-lesson-builder.html':'admin-lms-lessons.html',
 'admin-workforce.html':'admin-workforce-ctpas.html',
 'admin-workforce-employer.html':'admin-workforce-employers.html',
 'admin-workforce-employee.html':'admin-workforce-employees.html',
 'admin-dot.html':'admin-dot-ctpas.html',
 'admin-invoice.html':'admin-finance-invoices.html',
 'admin-invoices.html':'admin-finance-invoices.html',

};
function activeNavPage(){return navAliases[page]||page}
function moduleForPage(){
 if(['admin-service-desk.html','admin-service-desk-ticket.html','admin-service-desk-communication.html','admin-service-desk-document.html','admin-service-desk-activity.html','admin-notifications.html'].includes(page)&&['testing','training','workforce','dot'].includes(queryBusiness))return queryBusiness;
 if(page==='admin-operations-command-center.html')return queryBusiness==='workforce'?'workforce':'dot';
 if(page==='admin-customer-assignments.html')return queryBusiness==='dot'?'dot':(queryBusiness==='workforce'?'workforce':'enterprise');
 const shared=new Set(['admin-organizations.html','admin-organization.html','admin-customer-operations.html','admin-organization-operations.html','admin-customer-setup.html','admin-compliance-command-center.html','admin-agency-workforce-management.html','admin-work-management.html','admin-people.html','admin-person.html','admin-access.html']);
 if(shared.has(page)&&['testing','training','workforce','dot'].includes(queryBusiness))return queryBusiness;
 if(page==='admin-dashboard.html'||['admin-security-access.html','admin-legacy-routes.html','admin-staff.html','admin-customer-assignments.html','admin-audit.html','admin-audit-event.html','admin-global-settings.html','admin-technology.html','admin-integration.html','admin-enterprise-search.html','admin-intake-documents.html'].includes(page))return 'enterprise';
 if(page==='admin-testing-tasks.html')return 'testing';
 if(page==='admin-training-tasks.html'||page==='admin-lms-tasks.html')return 'training';
 if(page==='admin-workforce-tasks.html')return 'workforce';
 if(page==='admin-dot-tasks.html')return 'dot';
 if(page==='admin-testing-command-center.html'||page==='admin-testing.html')return 'testing';
 if(explicit[page])return explicit[page];
 if(page.startsWith('admin-lms-'))return 'training';
 if(page.startsWith('admin-workforce-'))return 'workforce';
 if(page.startsWith('admin-dot-'))return 'dot';
 if(page.startsWith('admin-testing-')||page.startsWith('admin-scheduling-'))return 'testing';
 if(page.startsWith('admin-finance-'))return 'finance';
 return 'enterprise';
}
function escapeHtml(v=''){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function initials(v='Administrator'){return String(v).split(/[\s._@-]+/).filter(Boolean).slice(0,2).map(x=>x[0]||'').join('').toUpperCase()||'A'}
function visibleModules(){const c=state.ctx,prods=new Set((c?.product_access||[]).map(x=>x.product_code));return Object.entries(modules).filter(([key,m])=>{if(c?.super_admin)return true;if(c&&['screenings4u','training','workforce','dot'].includes(m.product)&&!prods.has(m.product))return false;return !m.permission||m.permission(c)})}
const adminItems=[
 ['admin-audit.html','Audit Log','audit'],
 ['admin-technology.html','Integration Management','tech']
];
const moduleIcons={enterprise:'home',testing:'testing',training:'training',workforce:'workforce',dot:'dot',finance:'finance'};
function navItem([href,label,icon],activeModule){const active=activeNavPage()===String(href).split('?')[0];const ic=icon||moduleIcons[activeModule]||'home';return `<a class="ep-side-link ${active?'active':''}" href="${href}"${active?' aria-current="page"':''}><span class="ep-side-icon">${ICONS[ic]||ICONS.home}</span><span>${escapeHtml(label)}</span></a>`}
function canSeeAdminItem(href){const c=state.ctx;if(!c||c.super_admin)return true;const perms=new Set(c.permissions||[]);if(href==='admin-customer-assignments.html')return perms.has('customers.assign')||perms.has('customers.view_assigned')||perms.has('customers.view_all');if(href==='admin-audit.html')return perms.has('audit.view');if(href==='admin-service-desk.html'||href==='admin-support-tickets.html')return perms.has('support.view')||perms.has('support.manage')||perms.has('audit.view');if(href==='admin-legacy-routes.html')return perms.has('developer.tools')||perms.has('integrations.view')||perms.has('audit.view');if(href==='admin-global-settings.html')return false;if(href==='admin-technology.html'||href==='admin-integration.html')return perms.has('integrations.view')||perms.has('integrations.manage')||perms.has('developer.tools');return true}
function visibleAdminItems(){return adminItems.filter(([href])=>canSeeAdminItem(href))}
function groupHasActive(links){const active=activeNavPage();return links.some(([href])=>String(href).split('?')[0]===active)}
function sideGroup(title,links,key,forceOpen=false){const open=forceOpen||groupHasActive(links);return `<details class="ep-side-group" ${open?'open':''}><summary><span>${escapeHtml(title)}</span><i>${ICONS.chevron}</i></summary><div class="ep-side-section">${links.map(x=>navItem(x,key)).join('')}</div></details>`}
function sidebar(){const key=moduleForPage(),m=modules[key]||modules.enterprise;const groups=m.groups||[],hasActive=groups.some(([,links])=>groupHasActive(links));const admin=key==='enterprise'?visibleAdminItems():[],adminActive=groupHasActive(admin);const adminHtml=admin.length?`<div class="ep-side-divider"></div>${sideGroup('Administration',admin,key,adminActive)}`:'';const homes={enterprise:['admin-dashboard.html','Executive Overview','home'],testing:['admin-testing.html','Testing Overview','testing'],training:['admin-lms-dashboard.html','Training Overview','training'],workforce:['admin-organizations.html?business=workforce&type=ctpa','Workforce Overview','workforce'],dot:['admin-dot.html','DOT Overview','dot'],finance:['admin-finance-ar.html','Finance Overview','finance']};const home=homes[key]||homes.enterprise;return `<aside class="ep-sidebar"><div class="ep-brand"><a href="${m.landing}"><img src="images/logo2.png" alt="screenings4u"><span>Enterprise Management Portal</span></a></div><div class="ep-side-workspace"><span>Workspace</span><strong>${escapeHtml(m.label)}</strong></div><nav class="ep-side-scroll" aria-label="${escapeHtml(m.label)} management"><div class="ep-side-section ep-side-home">${navItem(home,key)}</div><div class="ep-side-divider"></div>${groups.map((g,i)=>sideGroup(g[0],g[1],key,!hasActive&&i===0)).join('')}${adminHtml}</nav><div class="ep-side-footer"><strong>screenings4u Enterprise</strong><span>${escapeHtml(m.label)} workspace</span></div></aside>`}
function tabDropdown(key,m){const active=page!=='admin-dashboard.html'&&moduleForPage()===key;return `<div class="ep-biz-tab-wrap"><a class="ep-biz-tab ${active?'active':''}" href="${m.landing}"${active?' aria-current="page"':''}>${escapeHtml(m.label)}</a></div>`}
function topbar(){const c=state.ctx,email=c?.user?.email||'Administrator',display=c?.profile?.display_name||c?.user?.user_metadata?.full_name||email.split('@')[0]||'Administrator',role=c?.roles?.[0]?.name||'Internal Staff',mod=moduleForPage(),biz=['testing','training','workforce','dot'].includes(mod)?mod:'',supportHref=biz?({testing:'admin-testing-support.html',training:'admin-lms-support.html',workforce:'admin-workforce-support.html',dot:'admin-dot-support.html'}[biz]):'admin-knowledge-base.html',supportLabel=biz?'Support':'Knowledge Base',notifyHref=biz==='dot'?'admin-dot-notifications.html':(biz?'admin-notifications.html?business='+encodeURIComponent(biz):'admin-notifications.html');return `<div class="ep-top-brand"><button class="ep-mobile-menu" id="epMobileMenu" aria-label="Open navigation">${ICONS.menu}</button><div><strong>screenings4u Enterprise</strong><small>Business operations. One enterprise system.</small></div></div><nav class="ep-business-tabs" aria-label="Business platforms">${visibleModules().map(([k,m])=>tabDropdown(k,m)).join('')}</nav><div class="ep-top-actions"><a class="ep-top-icon" id="epSearchBtn" href="admin-enterprise-search.html" aria-label="Search" title="Search">${ICONS.search}</a><a class="ep-top-icon ep-notification-button" href="${notifyHref}" aria-label="Notifications" title="Notifications">${ICONS.bell}<span class="ep-notify-dot" aria-hidden="true"></span></a><a class="ep-top-icon" id="epHelpBtn" href="${supportHref}" aria-label="${supportLabel}" title="${supportLabel}">${ICONS.help}</a><div class="s4u-font-sizer" aria-label="Portal font size"><span>Text</span><button type="button" data-scale="0.85" aria-pressed="false" title="Smaller text">A−</button><button type="button" data-scale="0.92" aria-pressed="false" title="Default text">A</button><button type="button" data-scale="1" aria-pressed="false" title="Larger text">A+</button></div><div class="ep-user-menu"><button class="ep-user-toggle" id="epUserToggle"><span class="ep-avatar">${initials(display)}</span><span class="ep-user-copy"><strong>${escapeHtml(display)}</strong><small>${escapeHtml(role)}</small></span><span class="ep-user-caret">⌄</span></button><div class="ep-menu" id="epUserMenu"><div class="ep-menu-head"><div><strong>${escapeHtml(display)}</strong><small>${escapeHtml(email)}</small></div><button class="ep-menu-close" aria-label="Close">${ICONS.x}</button></div><a href="${biz==='training'?'admin-lms-person.html':'admin-person.html'}?id=${encodeURIComponent(c?.user?.id||'')}${biz?'&business='+encodeURIComponent(biz):''}">My identity & access</a><a href="${notifyHref}">Notifications</a><a href="${supportHref}">${supportLabel}</a><button data-ep-logout>Sign out</button></div></div></div>`}
function render(){document.body.classList.add('ep-enterprise-shell');const side=$('#admin-lms-sidebar-target');if(side)side.innerHTML=sidebar();let top=$('.admin-lms-topbar');if(!top){top=document.createElement('header');top.className='admin-lms-topbar';$('.admin-lms-main')?.prepend(top)}if(top)top.innerHTML=topbar();window.S4UFontSizer?.refresh?.();overlays();wire();}
function searchIndex(){const x=[];for(const [k,m] of Object.entries(modules))for(const [group,links] of m.groups)for(const [href,label] of links)x.push({href,label,group,module:m.label});for(const [href,label] of visibleAdminItems())if(!x.some(i=>i.href===href))x.push({href,label,group:'Administration',module:'Enterprise'});return x}
function overlays(){if(!$('.ep-overlay'))document.body.insertAdjacentHTML('beforeend','<div class="ep-overlay" id="epOverlay"></div>')}
function closeFloating(){$('#epUserMenu')?.classList.remove('open');$('#epHelpPanel')?.classList.remove('open');$('#epSearchModal')?.classList.remove('open');$('#epSearchModal')?.setAttribute('aria-hidden','true');document.body.classList.remove('ep-search-open');}
function openSearch(){location.href='admin-enterprise-search.html'}
function keepActiveNavigationVisible(){const scroller=$('.ep-side-scroll'),active=$('.ep-side-link.active');if(!scroller||!active)return;requestAnimationFrame(()=>{const sr=scroller.getBoundingClientRect(),ar=active.getBoundingClientRect();const target=scroller.scrollTop+(ar.top-sr.top)-(scroller.clientHeight-ar.height)/2;scroller.scrollTo({top:Math.max(0,target),behavior:'auto'})})}
function wire(){keepActiveNavigationVisible();$$('.ep-side-group').forEach((g,i)=>{const key='s4u-nav-'+moduleForPage()+'-'+i;const saved=storage.get(key);if(saved!==null&&!groupHasActive([...g.querySelectorAll('.ep-side-link')].map(a=>[a.getAttribute('href')||'',a.textContent||''])))g.open=saved==='1';g.addEventListener('toggle',()=>storage.set(key,g.open?'1':'0'))});const overlay=$('#epOverlay');$('#epMobileMenu')?.addEventListener('click',()=>document.body.classList.add('ep-mobile-open'));overlay?.addEventListener('click',()=>{document.body.classList.remove('ep-mobile-open');closeFloating()});$$('.ep-side-link').forEach(a=>a.addEventListener('click',()=>document.body.classList.remove('ep-mobile-open')));
 const menu=$('#epUserMenu');$('#epUserToggle')?.addEventListener('click',e=>{e.stopPropagation();$('#epHelpPanel')?.classList.remove('open');menu?.classList.toggle('open')});$('.ep-menu-close')?.addEventListener('click',()=>menu?.classList.remove('open'));document.addEventListener('click',e=>{if(!e.target.closest('.ep-user-menu'))menu?.classList.remove('open')});
 document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();location.href='admin-enterprise-search.html'}if(e.key==='Escape'){document.body.classList.remove('ep-mobile-open');closeFloating()}});
 $('[data-ep-logout]')?.addEventListener('click',async()=>{try{await window.screenings4uSupabase?.auth?.signOut({scope:'local'})}finally{location.href='admin-login.html'}});
}
async function waitForVerifiedAdmin(){
 try{
  const ready=window.S4UPortalGuard?.waitForAdmin;
  if(typeof ready==='function')return await ready();
  if(window.S4UAdminReady)return await window.S4UAdminReady;
  if(window.S4UAuth?.requireAuth)return await window.S4UAuth.requireAuth({portal:'admin',loginPage:'admin-login.html'});
 }catch(err){console.error('[Enterprise Shell] admin authentication failed',err)}
 return null;
}
async function loadContext(){
 try{
  const authState=await waitForVerifiedAdmin();
  if(!authState?.user?.id)return;
  const cached=window.S4UAdminContext;
  if(cached?.user){
    state.ctx={...cached,super_admin:cached.is_super_admin,product_access:cached.products||cached.product_access||[]};
    return;
  }
  const sb=window.screenings4uSupabase;
  if(!sb?.functions)return;
  const {data,error}=await sb.functions.invoke('screenings4u-staff-context',{body:{action:'context'}});
  if(error)throw error;
  if(data?.user){
    window.S4UAdminContext=data;
    state.ctx={...data,super_admin:data.is_super_admin,product_access:data.products||data.product_access||[]};
  }
 }catch(err){console.warn('[Enterprise Shell] staff context unavailable',err)}
}
async function init(){await loadContext();render();document.documentElement.classList.add('ep-ready')}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(init,0),{once:true});else setTimeout(init,0);
})();
