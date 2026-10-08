/* ============================================================
   screenings4u — CLIENT AUDIT HELPER
   ============================================================ */

(() => {
  "use strict";

  async function record(action, {
    entityType = null,
    entityId = null,
    details = {}
  } = {}) {
    try {
      const client = window.S4UAuth.getClient();

      const {
        data: { user }
      } = await client.auth.getUser();

      const { error } = await client.from("audit_log").insert({
        actor_user_id: user?.id || null,
        action,
        entity_type: entityType,
        entity_id: entityId,
        details
      });

      if (error) {
        console.error("Audit write failed:", error);
        return false;
      }

      return true;
    } catch (error) {
      console.error("Audit helper failed:", error);
      return false;
    }
  }

  window.S4UAudit = Object.freeze({ record });
})();
