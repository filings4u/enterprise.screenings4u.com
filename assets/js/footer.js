(() => {
  "use strict";
  const el = document.getElementById("siteFooter");
  if (!el) return;
  const year = new Date().getFullYear();
  el.innerHTML = `<div class="form-container" style="padding:28px 20px;text-align:center;color:#66778e;font-size:12px;border-top:1px solid #dbe5ef;margin-top:32px">© ${year} screenings4u, LLC. All rights reserved. · <a href="mailto:hello@screenings4u.com" style="color:#24467f;font-weight:700">hello@screenings4u.com</a></div>`;
})();
