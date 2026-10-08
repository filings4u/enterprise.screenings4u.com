/* ============================================================
   screenings4u — APPLICATION CORE CONFIG
   Browser-safe configuration only.
   ============================================================ */

(() => {
  "use strict";

  const url = window.SCREENINGS4U_SUPABASE_URL;
  const anonKey = window.SCREENINGS4U_SUPABASE_ANON_KEY;

  window.S4U_APP = Object.freeze({
    brand: "screenings4u",
    supabaseUrl: url || "",
    supabaseAnonKey: anonKey || "",
    adminLogin: "admin-login.html",
    clientLogin: "client-login.html",
    website: "index.html"
  });
})();
