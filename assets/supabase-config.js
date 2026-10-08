/* ============================================================
   SCREENINGS4U — PORTAL SUPABASE CONFIG
   Session storage is isolated to the current browser tab.
   ============================================================ */

(() => {
  "use strict";

  const SUPABASE_URL =
    "https://rgsrubdtljyxmnihwlah.supabase.co";

  /*
   * This is the public/anon browser key. It is safe to expose in
   * frontend code. Never place the service-role or secret key here.
   */
  const SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJnc3J1YmR0bGp5eG1uaWh3bGFoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY2NjYxODgsImV4cCI6MjEwMjI0MjE4OH0.al5nEbeGjGncHZ9cJjh1oN76XjfS4EfYj5fXyeD2CE0";

  const STORAGE_KEY =
    "s4u-auth-session";

  window.SCREENINGS4U_SUPABASE_URL =
    SUPABASE_URL;

  window.SCREENINGS4U_SUPABASE_ANON_KEY =
    SUPABASE_ANON_KEY;

  if (!window.screenings4uSupabase) {
    if (
      !window.supabase ||
      typeof window.supabase.createClient !== "function"
    ) {
      console.error(
        "[Supabase Config] Supabase JS is unavailable. " +
        "Load @supabase/supabase-js before supabase-config.js."
      );

      return;
    }

    window.screenings4uSupabase =
      window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_ANON_KEY,
        {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
            storage: window.sessionStorage,
            storageKey: STORAGE_KEY
          }
        }
      );
  }

  window.supabaseClient =
    window.screenings4uSupabase;

  window.getScreenings4uSupabase = function () {
    const client =
      window.screenings4uSupabase;

    if (client?.auth) {
      return client;
    }

    throw new Error(
      "Supabase client is not initialized. " +
      "Load @supabase/supabase-js before supabase-config.js."
    );
  };
})();
