(() => {
  "use strict";
  const nav = document.getElementById("mainNav");
  if (nav) {
    nav.innerHTML = `
      <a href="index.html">Portal Home</a>
      <a href="customer-login.html">Customer</a>
      <a href="employer-login.html">Employer</a>
      <a href="employee-login.html">Employee</a>
      <a href="admin-login.html">Management</a>`;
  }
  const toggle = document.getElementById("mobileToggle");
  const inner = document.getElementById("navInner");
  if (toggle && nav) {
    toggle.addEventListener("click", () => {
      const open = nav.classList.toggle("is-open");
      inner?.classList.toggle("menu-open", open);
      toggle.setAttribute("aria-expanded", String(open));
      toggle.textContent = open ? "×" : "☰";
    });
  }
})();
