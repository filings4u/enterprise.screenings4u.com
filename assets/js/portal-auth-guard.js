/**
 * screenings4u — Strict Portal Authentication Guard
 *
 * Protects portal content until core-auth.js verifies both:
 *   1. the Supabase user/session; and
 *   2. the user's authorization for the requested portal.
 *
 * Required load order:
 *   1. @supabase/supabase-js
 *   2. supabase-config.js
 *   3. core-auth.js
 *   4. portal-auth-guard.js
 *   5. the portal-specific guard
 *
 * Add class="s4u-auth-pending" to the page's <html> element.
 */

(() => {
  "use strict";

  const activeChecks = new Map();

  function installProtectionStyles() {
    if (document.getElementById("s4u-auth-guard-styles")) {
      return;
    }

    const style = document.createElement("style");
    style.id = "s4u-auth-guard-styles";
    style.textContent =
      "html.s4u-auth-pending body > :not(#s4u-auth-blocking-error):not(#s4u-auth-loading){visibility:hidden!important;}" +
      "html.s4u-auth-pending #s4u-auth-blocking-error,html.s4u-auth-pending #s4u-auth-loading{visibility:visible!important;}" +
      "html.s4u-authenticated #s4u-auth-loading{display:none!important;visibility:hidden!important;pointer-events:none!important;}";
    document.head.appendChild(style);
  }

  installProtectionStyles();

  function normalizePortal(value) {
    return String(value || "")
      .trim()
      .toLowerCase();
  }

  function getLoginDestination(portal, loginPage) {
    if (loginPage) {
      return loginPage;
    }

    const configuredLogin =
      window.S4UAuth?.getLoginForPortal?.(portal);

    return configuredLogin || `${portal}-login.html`;
  }

  function markAuthenticated(state) {
    const root = document.documentElement;
    const loading = document.getElementById("s4u-auth-loading");
    if (loading) {
      loading.style.pointerEvents = "none";
      loading.style.display = "none";
      loading.remove();
    }

    root.classList.remove(
      "s4u-auth-pending",
      "s4u-auth-error"
    );
    root.classList.add("s4u-authenticated");

    window.dispatchEvent(
      new CustomEvent("s4u:authenticated", {
        detail: state
      })
    );
  }

  function createErrorScreen(portal, loginPage) {
    if (!document.body) {
      return;
    }

    const existing = document.getElementById(
      "s4u-auth-blocking-error"
    );

    if (existing) {
      return;
    }

    const screen = document.createElement("div");
    screen.id = "s4u-auth-blocking-error";
    screen.setAttribute("role", "alert");
    screen.style.cssText = [
      "position:fixed",
      "inset:0",
      "z-index:2147483647",
      "display:grid",
      "place-items:center",
      "padding:24px",
      "background:#f4f7fc",
      "font-family:Inter,Arial,sans-serif"
    ].join(";");

    const card = document.createElement("div");
    card.style.cssText = [
      "width:min(480px,100%)",
      "padding:32px",
      "border:1px solid #d9e3f0",
      "border-radius:14px",
      "background:#ffffff",
      "box-shadow:0 14px 40px rgba(23,51,95,.10)",
      "text-align:center"
    ].join(";");

    const title = document.createElement("h1");
    title.textContent = "Unable to verify access";
    title.style.cssText = [
      "margin:0 0 12px",
      "color:#24467f",
      "font-size:24px"
    ].join(";");

    const message = document.createElement("p");
    message.textContent =
      "This protected page will remain locked until your access can be verified. Please try again or return to the login page.";
    message.style.cssText = [
      "margin:0 0 22px",
      "color:#667892",
      "font-size:14px",
      "line-height:1.6"
    ].join(";");

    const retryButton = document.createElement("button");
    retryButton.type = "button";
    retryButton.textContent = "Try Again";
    retryButton.style.cssText = [
      "min-height:44px",
      "margin:4px",
      "padding:0 18px",
      "border:0",
      "border-radius:8px",
      "background:#ff6b00",
      "color:#ffffff",
      "font:700 14px Inter,Arial,sans-serif",
      "cursor:pointer"
    ].join(";");
    retryButton.addEventListener("click", async () => {
      retryButton.disabled = true;
      retryButton.textContent = "Checking…";
      screen.remove();
      document.documentElement.classList.remove("s4u-auth-error");
      document.documentElement.classList.add("s4u-auth-pending");
      await protectPortal({ portal, loginPage });
    });

    const loginLink = document.createElement("a");
    loginLink.href = loginPage;
    loginLink.textContent = "Return to Login";
    loginLink.style.cssText = [
      "display:inline-flex",
      "min-height:44px",
      "margin:4px",
      "padding:0 18px",
      "align-items:center",
      "justify-content:center",
      "border:1px solid #24467f",
      "border-radius:8px",
      "background:#ffffff",
      "color:#24467f",
      "font:700 14px Inter,Arial,sans-serif",
      "text-decoration:none"
    ].join(";");

    card.append(title, message, retryButton, loginLink);
    screen.appendChild(card);
    document.body.appendChild(screen);

    window.dispatchEvent(
      new CustomEvent("s4u:auth-error", {
        detail: { portal }
      })
    );
  }

  function markVerificationError(portal, loginPage, error) {
    const root = document.documentElement;

    // Keep s4u-auth-pending in place so protected content stays hidden.
    root.classList.remove("s4u-authenticated");
    root.classList.add(
      "s4u-auth-pending",
      "s4u-auth-error"
    );

    console.error(
      `[${portal} portal guard] Access verification failed:`,
      error
    );

    createErrorScreen(portal, loginPage);
  }

  async function runProtection({ portal, loginPage }) {
    if (
      !window.S4UAuth ||
      typeof window.S4UAuth.requireAuth !== "function"
    ) {
      throw new Error(
        "S4UAuth.requireAuth is unavailable. Load core-auth.js before portal-auth-guard.js."
      );
    }

    const state = await window.S4UAuth.requireAuth({
      portal,
      loginPage
    });

    // requireAuth() performs redirects for missing sessions and denied roles.
    // Leave the protected page hidden while that navigation completes.
    if (!state?.user?.id) {
      return null;
    }

    // Never reveal cached/refreshed portal markup when the local idle window
    // has already expired. The session security runtime signs out first.
    if (window.S4USessionSecurity?.preflight) {
      const allowed = await window.S4USessionSecurity.preflight(state);
      if (!allowed) return null;
    }

    markAuthenticated(state);
    return state;
  }

  async function protectPortal({
    portal,
    loginPage = null
  } = {}) {
    const normalizedPortal = normalizePortal(portal);

    if (!normalizedPortal) {
      throw new Error("Portal name is required.");
    }

    const destination = getLoginDestination(
      normalizedPortal,
      loginPage
    );

    // If two scripts request the same protection simultaneously, reuse the
    // same verification instead of issuing duplicate authentication queries.
    if (activeChecks.has(normalizedPortal)) {
      return activeChecks.get(normalizedPortal);
    }

    document.documentElement.classList.add(
      "s4u-auth-pending"
    );

    const check = runProtection({
      portal: normalizedPortal,
      loginPage: destination
    })
      .catch((error) => {
        markVerificationError(
          normalizedPortal,
          destination,
          error
        );
        return null;
      })
      .finally(() => {
        activeChecks.delete(normalizedPortal);
      });

    activeChecks.set(normalizedPortal, check);

    if (normalizedPortal === "admin") {
      window.S4UAdminReady = check;
    }

    return check;
  }

  async function waitForAdmin() {
    if (window.S4UAdminReady) {
      return window.S4UAdminReady;
    }

    return protectPortal({
      portal: "admin",
      loginPage: "admin-login.html"
    });
  }

  window.S4UPortalGuard = Object.freeze({
    protectPortal,
    waitForAdmin
  });
})();
