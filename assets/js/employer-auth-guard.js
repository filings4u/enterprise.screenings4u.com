/**
 * screenings4u — Employer Portal Authentication Guard
 *
 * Load this file only on protected Employer Portal pages.
 * Do not load it on employer-login.html, set-password.html,
 * reset-password.html, or other public authentication pages.
 */

(() => {
  "use strict";

  let started = false;

  async function protectEmployerPortal() {
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
        "[Employer auth guard] S4UPortalGuard.protectPortal is unavailable. " +
        "Load portal-auth-guard.js before employer-auth-guard.js."
      );

      window.dispatchEvent(
        new CustomEvent("s4u:auth-error", {
          detail: {
            portal: "employer",
            reason: "portal_guard_unavailable"
          }
        })
      );

      return;
    }

    await window.S4UPortalGuard.protectPortal({
      portal: "employer",
      loginPage: "employer-login.html"
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      protectEmployerPortal,
      { once: true }
    );
  } else {
    protectEmployerPortal();
  }
})();
