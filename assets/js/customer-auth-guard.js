/**
 * screenings4u â€” Customer Portal Authentication Guard
 *
 * Load this file only on protected Customer Portal pages.
 * Do not load it on customer-login.html, set-password.html,
 * reset-password.html, or other public authentication pages.
 */

(() => {
  "use strict";

  let started = false;

  async function protectCustomerPortal() {
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
        "[Customer auth guard] S4UPortalGuard.protectPortal is unavailable. " +
        "Load portal-auth-guard.js before customer-auth-guard.js."
      );

      window.dispatchEvent(
        new CustomEvent("s4u:auth-error", {
          detail: {
            portal: "customer",
            reason: "portal_guard_unavailable"
          }
        })
      );

      return;
    }

    await window.S4UPortalGuard.protectPortal({
      portal: "customer",
      loginPage: "customer-login.html"
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      protectCustomerPortal,
      { once: true }
    );
  } else {
    protectCustomerPortal();
  }
})();