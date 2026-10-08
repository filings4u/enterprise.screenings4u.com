/* ============================================================
   SCREENINGS4U — LOGIN HELPER
   STRICT PORTAL-SPECIFIC LOGIN
   ============================================================ */

(() => {
  "use strict";

  function bindLogin({
    formSelector = "[data-s4u-login-form]",
    emailSelector = "[data-s4u-login-email]",
    passwordSelector = "[data-s4u-login-password]",
    submitSelector = "[data-s4u-login-submit]",

    /*
      Required portal:
      admin
      customer
      employer
      employee
    */
    portal = null,

    /*
      Backward compatibility.
      If portal is not supplied, expectedRole will be used.
    */
    expectedRole = null,

    dashboard = null
  } = {}) {

    const form = document.querySelector(formSelector);

    if (!form) return;

    form.addEventListener("submit", async (event) => {

      event.preventDefault();

      const email = document
        .querySelector(emailSelector)
        ?.value
        ?.trim();

      const password = document
        .querySelector(passwordSelector)
        ?.value;

      const button = document.querySelector(
        submitSelector
      );

      if (!email || !password) {

        window.S4UUI?.toast(
          "Enter your email and password.",
          "warning"
        );

        return;
      }

      /*
        Resolve the portal.

        New preferred method:
        portal: "admin"

        Old method still supported:
        expectedRole: "admin"
      */

      const requestedPortal =
        portal || expectedRole;

      if (!requestedPortal) {

        console.error(
          "No portal was specified for this login form."
        );

        window.S4UUI?.toast(
          "This login page is not configured correctly.",
          "error"
        );

        return;
      }

      try {

        if (button) {
          button.disabled = true;
          button.setAttribute(
            "aria-busy",
            "true"
          );
        }

        /*
          STRICT PORTAL LOGIN

          This signs the user in and immediately
          verifies that the account has access to
          the requested portal.

          If the role is wrong:

          - The session is signed out.
          - The user remains out of all portals.
          - No automatic redirect occurs to another portal.
        */

        await window.S4UAuth.signInToPortal(
          requestedPortal,
          email,
          password
        );

        /*
          Load the authenticated state.
        */

        const state =
          await window.S4UAuth.initialize();

        if (!state?.authenticated) {

          await window.S4UAuth.signOutSilently();

          throw new Error(
            "We could not verify your account."
          );
        }

        /*
          Final role verification.

          This is intentionally strict.
        */

        const authorized =
          await window.S4UAuth.hasRole(
            requestedPortal,
            state.user.id
          );

        if (!authorized) {

          await window.S4UAuth.signOutSilently();

          throw new Error(
            "This account does not have access to this portal."
          );
        }

        /*
          Redirect only to the dashboard
          for the portal that was used.
        */

        const destination =
          dashboard ||
          window.S4UAuth.getDashboardForRole(
            requestedPortal
          );

        window.location.replace(
          destination
        );

      } catch (error) {

        console.error(
          "Login failed:",
          error
        );

        window.S4UUI?.toast(
          error?.message ||
          "Unable to sign in. Please try again.",
          "error"
        );

      } finally {

        if (button) {

          button.disabled = false;

          button.removeAttribute(
            "aria-busy"
          );
        }
      }

    });
  }

  window.S4ULogin = Object.freeze({
    bindLogin
  });

})();