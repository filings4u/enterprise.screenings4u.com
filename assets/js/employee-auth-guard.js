/**
 * screenings4u — Employee Portal Authentication Guard
 *
 * Load this file only on protected Employee Portal pages.
 * Do not load it on employee-login.html, set-password.html,
 * reset-password.html, or other public authentication pages.
 */

(() => {
  "use strict";

  let started = false;

  async function protectEmployeePortal() {
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
        "[Employee auth guard] S4UPortalGuard.protectPortal is unavailable. " +
        "Load portal-auth-guard.js before employee-auth-guard.js."
      );

      window.dispatchEvent(
        new CustomEvent("s4u:auth-error", {
          detail: {
            portal: "employee",
            reason: "portal_guard_unavailable"
          }
        })
      );

      return;
    }

    await window.S4UPortalGuard.protectPortal({
      portal: "employee",
      loginPage: "employee-login.html"
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      protectEmployeePortal,
      { once: true }
    );
  } else {
    protectEmployeePortal();
  }
})();
