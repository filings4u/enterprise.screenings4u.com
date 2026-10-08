/**
 * screenings4u — Administrator Portal Authentication Guard
 *
 * Load this file only on protected Administrator Portal pages.
 * Do not load it on admin-login.html, set-password.html,
 * reset-password.html, or other public authentication pages.
 */

(() => {
  "use strict";

  let started = false;

  async function protectAdminPortal() {
    if (started) {
      return;
    }

    started = true;
    document.documentElement.classList.add(
      "s4u-auth-pending"
    );

    if (
      !window.S4UPortalGuard ||
      typeof window.S4UPortalGuard.protectPortal !== "function"
    ) {
      // Fail closed. The pending class remains, so portal content stays hidden.
      console.error(
        "[Admin auth guard] S4UPortalGuard.protectPortal is unavailable. " +
        "Load portal-auth-guard.js before admin-auth-guard.js."
      );

      window.dispatchEvent(
        new CustomEvent("s4u:auth-error", {
          detail: {
            portal: "admin",
            reason: "portal_guard_unavailable"
          }
        })
      );

      return;
    }

    await window.S4UPortalGuard.protectPortal({
      portal: "admin",
      loginPage: "admin-login.html"
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      protectAdminPortal,
      { once: true }
    );
  } else {
    protectAdminPortal();
  }
})();
