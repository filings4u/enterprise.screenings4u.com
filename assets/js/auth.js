/* ============================================================
   screenings4u — CORE AUTH
   ============================================================ */

(() => {
  "use strict";

  function getClient() {
    if (typeof window.getScreenings4uSupabase === "function") {
      return window.getScreenings4uSupabase();
    }

    if (window.screenings4uSupabase?.auth) {
      return window.screenings4uSupabase;
    }

    throw new Error("Supabase client is not available.");
  }

  async function getSession() {
    const client = getClient();
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    return data?.session || null;
  }

  async function requireSession(loginPage = window.S4U_APP?.adminLogin) {
    const session = await getSession();

    if (!session?.user) {
      window.location.replace(loginPage);
      return null;
    }

    return session;
  }

  async function signOut(loginPage = window.S4U_APP?.adminLogin) {
    const client = getClient();
    const { error } = await client.auth.signOut();
    if (error) throw error;

    window.location.replace(loginPage);
  }

  window.S4UAuth = Object.freeze({
    getClient,
    getSession,
    requireSession,
    signOut
  });
})();
