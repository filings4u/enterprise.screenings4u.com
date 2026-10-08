/* screenings4u — CUSTOMER LOGIN */
(() => {
  "use strict";

  const DASHBOARD_PAGE = "customer-dashboard.html";
  const FORGOT_PASSWORD_PAGE = "forgot-password.html";
  const $ = (selector) => document.querySelector(selector);

  function setStatus(message = "", type = "") {
    const status = $("#loginStatus");
    if (!status) return;
    status.textContent = message;
    status.className = "login-status";
    if (type) status.classList.add(type);
    status.hidden = !message;
  }

  function setLoading(loading) {
    const button = $("#loginButton");
    if (!button) return;
    if (!button.dataset.originalText) button.dataset.originalText = button.innerHTML;
    button.disabled = loading;
    button.setAttribute("aria-busy", String(loading));
    button.innerHTML = loading
      ? '<span class="login-button-loading">Signing In...</span>'
      : button.dataset.originalText;
  }

  function showError(message) {
    setStatus(message, "error");
    window.S4UUI?.toast?.(message, "error");
  }

  async function redirectIfAuthenticated() {
    try {
      const state = await window.S4UAuth.initialize({ force: true });
      if (!state?.session || !state?.user) return;

      if (window.S4UAuth.userCanAccessPortal(state.roles || [], "customer")) {
        window.location.replace(DASHBOARD_PAGE);
        return;
      }

      if (typeof window.S4UAuth.signOutSilently === "function") {
        await window.S4UAuth.signOutSilently();
      }
    } catch (error) {
      console.error("[Customer Login] Existing session check failed:", error);
    }
  }

  function bindPasswordToggle() {
    const input = $("#password");
    const button = $("#passwordToggle");
    if (!input || !button) return;

    button.addEventListener("click", () => {
      const hidden = input.type === "password";
      input.type = hidden ? "text" : "password";
      button.setAttribute("aria-label", hidden ? "Hide password" : "Show password");
      button.setAttribute("aria-pressed", String(hidden));
    });
  }

  function bindForgotPassword() {
    const control = $("#forgotPasswordBtn");
    if (!control) return;
    if (control.tagName === "A" && control.getAttribute("href")) return;

    control.addEventListener("click", (event) => {
      event.preventDefault();
      window.location.href = FORGOT_PASSWORD_PAGE;
    });
  }

  async function handleLogin(event) {
    event.preventDefault();

    const email = $("#email")?.value?.trim();
    const password = $("#password")?.value;

    if (!email || !password) {
      showError("Please enter your email and password.");
      return;
    }

    setStatus("");
    setLoading(true);

    try {
      await window.S4UAuth.signInToPortal("customer", email, password);
      setStatus("Sign-in successful. Redirecting you now...", "success");
      window.location.replace(DASHBOARD_PAGE);
    } catch (error) {
      console.error("[Customer Login] Sign-in failed:", error);
      showError(error?.message || "Unable to sign in. Please check your credentials and try again.");
      setLoading(false);
    }
  }

  async function initializeCustomerLogin() {
    const auth = window.S4UAuth;

    if (
      !auth ||
      typeof auth.initialize !== "function" ||
      typeof auth.signInToPortal !== "function" ||
      typeof auth.userCanAccessPortal !== "function"
    ) {
      console.error("[Customer Login] Incompatible core-auth.js is loaded.");
      showError("The secure login service is unavailable. Please refresh the page.");
      return;
    }

    $("#customerLoginForm")?.addEventListener("submit", handleLogin);
    bindPasswordToggle();
    bindForgotPassword();
    await redirectIfAuthenticated();
  }

  document.addEventListener("DOMContentLoaded", initializeCustomerLogin);
})();
