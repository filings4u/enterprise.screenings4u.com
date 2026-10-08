/* ============================================================
   screenings4u — CORE PERMISSIONS
   ============================================================ */

(() => {
  "use strict";

  async function hasPermission(permission, organizationId = null) {
    const client = window.S4UAuth.getClient();

    const { data, error } = await client.rpc("has_permission", {
      requested_permission: permission,
      requested_organization: organizationId
    });

    if (error) {
      console.error("Permission check failed:", error);
      return false;
    }

    return data === true;
  }

  async function requirePermission(permission, fallback = "admin-dashboard.html") {
    const allowed = await hasPermission(permission);

    if (!allowed) {
      window.location.replace(fallback);
      return false;
    }

    return true;
  }

  window.S4UPermissions = Object.freeze({
    hasPermission,
    requirePermission
  });
})();
