/* ============================================================
   SCREENINGS4U — CORE AUTH
   Strict role-based portal authentication and authorization
   ============================================================ */

(() => {
  "use strict";

  const PORTALS = Object.freeze({
    admin: Object.freeze({
      login: "admin-login.html",
      dashboard: "admin-dashboard.html",
      allowedRoles: Object.freeze([
        "super_admin",
        "admin",
        "administrator",
        "operations",
        "compliance",
        "billing",
        "support",
        "content",
        "readonly"
      ])
    }),

    customer: Object.freeze({
      login: "customer-login.html",
      dashboard: "customer-dashboard.html",
      allowedRoles: Object.freeze([
        "client_user",
        "client_admin",
        "client_manager"
      ])
    }),

    employer: Object.freeze({
      login: "employer-login.html",
      dashboard: "employer-dashboard.html",
      allowedRoles: Object.freeze([
        "employer_user",
        "employer_admin",
        "employer_hr",
        "employer_safety",
        "employer_billing"
      ])
    }),

    employee: Object.freeze({
      login: "employee-login.html",
      dashboard: "employee-dashboard.html",
      allowedRoles: Object.freeze([
        "employee"
      ])
    }),

    training: Object.freeze({
      login: "https://training.screenings4u.com/training-login.html",
      dashboard: "https://training.screenings4u.com/lms-dashboard.html",
      allowedRoles: Object.freeze([])
    })
  });

  const EMPTY_STATE = Object.freeze({
    initialized: false,
    session: null,
    user: null,
    profile: null,
    roles: Object.freeze([]),
    primaryRole: null
  });

  let state = {
    initialized: EMPTY_STATE.initialized,
    session: EMPTY_STATE.session,
    user: EMPTY_STATE.user,
    profile: EMPTY_STATE.profile,
    roles: [],
    primaryRole: EMPTY_STATE.primaryRole
  };

  function getClient() {
    if (
      typeof window.getScreenings4uSupabase === "function"
    ) {
      return window.getScreenings4uSupabase();
    }

    if (window.screenings4uSupabase?.auth) {
      return window.screenings4uSupabase;
    }

    if (window.supabaseClient?.auth) {
      return window.supabaseClient;
    }

    throw new Error(
      "Supabase client is unavailable. " +
      "Load @supabase/supabase-js and supabase-config.js before core-auth.js."
    );
  }

  function normalizeRole(value) {
    if (!value) {
      return null;
    }

    return String(value)
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "_");
  }

  function uniqueRoles(values = []) {
    return [
      ...new Set(
        values
          .map(normalizeRole)
          .filter(Boolean)
      )
    ];
  }

  function getPortal(portalName) {
    const name = String(portalName || "")
      .trim()
      .toLowerCase();

    const portal = PORTALS[name];

    if (!portal) {
      throw new Error(
        `Unknown portal "${portalName}".`
      );
    }

    return {
      name,
      ...portal,
      allowedRoles: [...portal.allowedRoles]
    };
  }

  function cloneState() {
    return {
      ...state,
      roles: [...state.roles]
    };
  }

  function clearState(initialized = true) {
    state = {
      initialized,
      session: null,
      user: null,
      profile: null,
      roles: [],
      primaryRole: null
    };
  }

  async function getSession() {
    const client = getClient();
    const { data, error } =
      await client.auth.getSession();

    if (error) {
      throw error;
    }

    return data?.session || null;
  }

  /*
   * Unlike getSession(), getVerifiedUser() makes a request to
   * Supabase Auth. Use it before granting access to protected pages.
   */
  async function getVerifiedUser() {
    const client = getClient();
    const { data, error } =
      await client.auth.getUser();

    if (error) {
      throw error;
    }

    return data?.user || null;
  }

  async function getProfile(userId = null) {
    const id =
      userId || (await getVerifiedUser())?.id;

    if (!id) {
      return null;
    }

    const client = getClient();
    const { data, error } = await client
      .from("user_profiles")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      console.warn(
        "[S4UAuth] Unable to load the user profile:",
        error
      );

      return null;
    }

    return data || null;
  }

  async function getRoles(userId = null) {
    const id =
      userId || (await getVerifiedUser())?.id;

    if (!id) {
      return [];
    }

    const client = getClient();
    const { data, error } = await client.functions.invoke("portal-access-context", {
      body: { portal: "roles" }
    });

    if (error || data?.error) {
      throw new Error(
        `Unable to verify portal roles: ${data?.error || error?.message || "Unknown role error"}`
      );
    }

    return uniqueRoles(data?.roles || []);
  }

  function userCanAccessPortal(
    userRoles = [],
    portalName
  ) {
    const portal = getPortal(portalName);
    const roles = uniqueRoles(userRoles);
    const allowed = uniqueRoles(portal.allowedRoles);

    return roles.some(role =>
      allowed.includes(role)
    );
  }

  async function verifyAdminAccess() {
    const client = getClient();

    /*
     * Phase 6 hardening: legacy portal roles are no longer sufficient
     * for Administrator Portal entry. The server must confirm an active
     * internal staff profile and at least one active staff role.
     */
    const { data, error } = await client.functions.invoke(
      "screenings4u-staff-context",
      { body: { action: "context" } }
    );

    if (error || data?.error) {
      const message = data?.error || error?.message ||
        "Active internal staff access is required.";
      if (/active screenings4u staff access|required/i.test(message)) {
        return false;
      }
      throw new Error(
        `Unable to verify administrator access: ${message}`
      );
    }

    return Boolean(
      data?.profile?.employment_status === "active" &&
      Array.isArray(data?.role_codes) &&
      data.role_codes.length
    );
  }

  async function verifyTrainingAccess() {
    const client = getClient();
    const { data, error } =
      await client.rpc("can_access_training_portal");

    if (error) {
      throw new Error(
        `Unable to verify training access: ${error.message}`
      );
    }

    return data === true;
  }

  function getPrimaryRole(userRoles = []) {
    const roles = uniqueRoles(userRoles);

    if (userCanAccessPortal(roles, "admin")) {
      return "admin";
    }

    if (userCanAccessPortal(roles, "employer")) {
      return "employer";
    }

    if (userCanAccessPortal(roles, "employee")) {
      return "employee";
    }

    if (userCanAccessPortal(roles, "customer")) {
      return "customer";
    }

    return null;
  }

  async function initialize({ force = false } = {}) {
    if (state.initialized && !force) {
      return cloneState();
    }

    const session = await getSession();

    if (!session?.access_token) {
      clearState(true);
      return cloneState();
    }

    let user;

    try {
      user = await getVerifiedUser();
    } catch (error) {
      clearState(true);

      try {
        await getClient().auth.signOut({
          scope: "local"
        });
      } catch (signOutError) {
        console.warn(
          "[S4UAuth] Unable to clear an invalid local session:",
          signOutError
        );
      }

      throw new Error(
        `Unable to verify the current session: ${error.message}`
      );
    }

    if (!user?.id) {
      clearState(true);
      return cloneState();
    }

    const [profile, roles] = await Promise.all([
      getProfile(user.id),
      getRoles(user.id)
    ]);

    state = {
      initialized: true,
      session,
      user,
      profile,
      roles,
      primaryRole: getPrimaryRole(roles)
    };

    return cloneState();
  }

  async function hasRole(role, userId = null) {
    const requestedRole = normalizeRole(role);

    if (!requestedRole) {
      return false;
    }

    if (requestedRole === "training") {
      await getVerifiedUser();
      return verifyTrainingAccess();
    }

    const roles = await getRoles(userId);
    return roles.includes(requestedRole);
  }

  async function hasAnyRole(
    allowedRoles = [],
    userId = null
  ) {
    const allowed = uniqueRoles(allowedRoles);

    if (!allowed.length) {
      return false;
    }

    const roles = await getRoles(userId);

    return roles.some(role =>
      allowed.includes(role)
    );
  }

  function getDashboardForRole(role) {
    const normalizedRole = normalizeRole(role);

    if (!normalizedRole) {
      return null;
    }

    if (PORTALS[normalizedRole]) {
      return PORTALS[normalizedRole].dashboard;
    }

    for (const portal of Object.values(PORTALS)) {
      if (
        portal.allowedRoles.includes(normalizedRole)
      ) {
        return portal.dashboard;
      }
    }

    return null;
  }

  function getLoginForPortal(portalName) {
    return getPortal(portalName).login;
  }

  async function verifyPortalAccess(
    portalName,
    authState
  ) {
    if (!authState?.user?.id) {
      return false;
    }

    if (portalName === "training") {
      return verifyTrainingAccess();
    }

    if (portalName === "admin") {
      return verifyAdminAccess(authState.roles);
    }

    return userCanAccessPortal(
      authState.roles,
      portalName
    );
  }

  async function requireAuth({
    portal = null,
    loginPage = null
  } = {}) {
    const portalConfig =
      portal ? getPortal(portal) : null;

    const destination =
      loginPage ||
      portalConfig?.login ||
      "customer-login.html";

    const session = await getSession();

    if (!session?.access_token) {
      window.location.replace(destination);
      return null;
    }

    /*
     * Admin fast path: screenings4u-staff-context already validates the JWT,
     * active staff profile, active staff roles, permissions, and business
     * access server-side. Reusing that one request avoids the old sequence of
     * getUser + user_profiles + portal roles + staff-context before the page
     * could become visible.
     */
    if (portalConfig?.name === "admin") {
      try {
        const client = getClient();
        const { data, error } = await client.functions.invoke(
          "screenings4u-staff-context",
          { body: { action: "context" } }
        );

        if (error || data?.error || !data?.user?.id) {
          throw new Error(
            data?.error || error?.message ||
            "Active screenings4u staff access is required."
          );
        }

        window.S4UAdminContext = data;
        state = {
          initialized: true,
          session,
          user: data.user,
          profile: data.profile || null,
          roles: uniqueRoles(data.role_codes || []),
          primaryRole: "admin"
        };

        return cloneState();
      } catch (error) {
        console.error("[S4UAuth] Administrator verification failed:", error);
        try { await getClient().auth.signOut({ scope: "local" }); } catch {}
        clearState(true);
        window.location.replace(destination);
        return null;
      }
    }

    let authState;

    try {
      authState = await initialize({
        force: true
      });
    } catch (error) {
      console.error(
        "[S4UAuth] Session verification failed:",
        error
      );

      window.location.replace(destination);
      return null;
    }

    if (!authState.user?.id) {
      window.location.replace(destination);
      return null;
    }

    if (!portalConfig) {
      return authState;
    }

    const allowed = await verifyPortalAccess(
      portalConfig.name,
      authState
    );

    if (!allowed) {
      console.warn(
        "[S4UAuth] Portal access denied.",
        {
          portal: portalConfig.name,
          userId: authState.user.id,
          roles: authState.roles
        }
      );

      await signOutSilently();
      window.location.replace(destination);
      return null;
    }

    return authState;
  }

  async function signIn(email, password) {
    const client = getClient();
    const normalizedEmail = String(email || "")
      .trim()
      .toLowerCase();

    if (!normalizedEmail || !password) {
      throw new Error(
        "Email and password are required."
      );
    }

    const { data, error } =
      await client.auth.signInWithPassword({
        email: normalizedEmail,
        password
      });

    if (error) {
      throw error;
    }

    await initialize({ force: true });
    return data;
  }

  async function signInToPortal(
    portalName,
    email,
    password
  ) {
    const portal = getPortal(portalName);
    const result = await signIn(email, password);
    const authState = await initialize({ force: true });
    const allowed = await verifyPortalAccess(
      portal.name,
      authState
    );

    if (!allowed) {
      await signOutSilently();

      throw new Error(
        `This account does not have access to the ${portal.name} portal.`
      );
    }

    return {
      ...result,
      portal,
      state: authState
    };
  }

  async function signOutSilently() {
    try {
      await getClient().auth.signOut();
    } catch (error) {
      console.error(
        "[S4UAuth] Unable to sign out:",
        error
      );
    } finally {
      clearState(true);
    }
  }

  async function signOut(
    loginPage = "customer-login.html"
  ) {
    const destination =
      typeof loginPage === "object" &&
      loginPage !== null
        ? loginPage.redirectTo ||
          "customer-login.html"
        : loginPage;

    await signOutSilently();
    window.location.replace(destination);
  }

  window.S4UAuth = Object.freeze({
    getClient,
    getSession,
    getVerifiedUser,
    initialize,
    getProfile,
    getRoles,
    hasRole,
    hasAnyRole,
    normalizeRole,
    userCanAccessPortal,
    verifyAdminAccess,
    verifyTrainingAccess,
    getPrimaryRole,
    PORTALS,
    getPortal,
    getDashboardForRole,
    getLoginForPortal,
    requireAuth,
    signIn,
    signInToPortal,
    signOut,
    signOutSilently
  });
})();
