/* ============================================================
   screenings4u — RESET PASSWORD
   Shared Supabase recovery-session password update
   Supports customer, employee, employer, and admin portals
   ============================================================ */

(() => {
  "use strict";

  const PORTALS = Object.freeze({
    customer: {
      loginPage: "customer-login.html",
      label: "Customer"
    },
    employee: {
      loginPage: "employee-login.html",
      label: "Employee"
    },
    employer: {
      loginPage: "employer-login.html",
      label: "Employer"
    },
    admin: {
      loginPage: "admin-login.html",
      label: "Admin"
    }
  });

  const DEFAULT_PORTAL = "customer";

  const $ = id => document.getElementById(id);

  let recoveryReady = false;

  function getClient() {
    return (
      window.supabaseClient ||
      window.screenings4uSupabase ||
      window.S4USupabase?.client ||
      null
    );
  }

  function getRequestedPortal() {
    const params = new URLSearchParams(window.location.search);
    const requested = String(params.get("portal") || "")
      .trim()
      .toLowerCase();

    return PORTALS[requested] ? requested : DEFAULT_PORTAL;
  }

  const portal = getRequestedPortal();
  const portalConfig = PORTALS[portal];

  function getLoginPage() {
    return portalConfig.loginPage;
  }

  function updatePortalUI() {
    const backLink = $("backToLoginLink");

    if (backLink) {
      backLink.href = getLoginPage();
      backLink.textContent = `← Back to ${portalConfig.label} Sign In`;
    }
  }

  function setStatus(message = "", type = "") {
    const el = $("resetStatus");

    if (!el) return;

    el.textContent = message;
    el.className = "login-status";

    if (type) {
      el.classList.add(type);
    }
  }

  function setLoading(loading) {
    const btn = $("resetButton");

    if (!btn) return;

    btn.disabled = loading || !recoveryReady;
    btn.textContent = loading
      ? "UPDATING PASSWORD..."
      : "UPDATE PASSWORD";
  }

  function showModal(message) {
    const messageEl = $("modalMessage");
    const modal = $("s4uModal");

    if (messageEl) {
      messageEl.textContent = message;
    }

    if (modal) {
      modal.classList.add("is-open");
    }
  }

  async function finishAndReturnToLogin() {
    try {
      const client = getClient();

      if (client?.auth) {
        await client.auth.signOut({
          scope: "local"
        });
      }
    } catch (error) {
      console.warn(
        "[Reset Password] Sign-out after reset failed:",
        error
      );
    }

    window.location.replace(getLoginPage());
  }

  function bindToggles() {
    document
      .querySelectorAll("[data-toggle]")
      .forEach(button => {
        button.addEventListener("click", () => {
          const input = $(button.dataset.toggle);

          if (!input) return;

          const currentlyVisible = input.type === "text";

          input.type = currentlyVisible
            ? "password"
            : "text";

          button.setAttribute(
            "aria-label",
            currentlyVisible
              ? "Show password"
              : "Hide password"
          );
        });
      });
  }

  function cleanRecoveryCodeFromUrl(url) {
    url.searchParams.delete("code");

    history.replaceState(
      {},
      document.title,
      url.pathname +
        url.search +
        url.hash
    );
  }

  async function establishRecoverySession() {
    const client = getClient();

    if (!client?.auth) {
      recoveryReady = false;

      setStatus(
        "The secure password service is unavailable. Please request a new password recovery link and try again.",
        "error"
      );

      setLoading(false);
      return;
    }

    try {
      const url = new URL(window.location.href);
      const code = url.searchParams.get("code");

      /*
       * PKCE recovery flow:
       * Supabase may redirect here with ?code=...
       */
      if (
        code &&
        typeof client.auth.exchangeCodeForSession === "function"
      ) {
        const { error } =
          await client.auth.exchangeCodeForSession(code);

        if (error) {
          throw error;
        }

        cleanRecoveryCodeFromUrl(url);
      }

      /*
       * Verify that Supabase has actually established
       * an authenticated recovery/invite session.
       */
      const {
        data: sessionData,
        error: sessionError
      } = await client.auth.getSession();

      if (sessionError) {
        throw sessionError;
      }

      const session = sessionData?.session;

      if (!session?.user) {
        recoveryReady = false;

        setStatus(
          "This password recovery link is invalid or has expired. Please request a new password reset link.",
          "error"
        );

        setLoading(false);
        return;
      }

      /*
       * Verify the session against Supabase Auth instead
       * of trusting only the locally stored session object.
       */
      const {
        data: userData,
        error: userError
      } = await client.auth.getUser();

      if (userError || !userData?.user) {
        throw (
          userError ||
          new Error("The recovery user could not be verified.")
        );
      }

      recoveryReady = true;

      setStatus(
        "Recovery link verified. You can now choose a new password.",
        "success"
      );

      setLoading(false);

    } catch (error) {
      console.error(
        "[Reset Password] Recovery verification failed:",
        error
      );

      recoveryReady = false;

      setStatus(
        "This password recovery link is invalid or has expired. Please request a new password reset link.",
        "error"
      );

      setLoading(false);
    }
  }

  async function handleReset(event) {
    event.preventDefault();

    if (!recoveryReady) {
      setStatus(
        "Please request a new password recovery link before changing your password.",
        "error"
      );

      return;
    }

    const password =
      $("newPassword")?.value || "";

    const confirm =
      $("confirmPassword")?.value || "";

    if (password.length < 8) {
      setStatus(
        "Your new password must contain at least 8 characters.",
        "error"
      );

      $("newPassword")?.focus();
      return;
    }

    if (password !== confirm) {
      setStatus(
        "The passwords do not match. Please enter them again.",
        "error"
      );

      $("confirmPassword")?.focus();
      return;
    }

    const client = getClient();

    if (!client?.auth) {
      setStatus(
        "The secure password service is unavailable. Please try again.",
        "error"
      );

      return;
    }

    setLoading(true);
    setStatus("");

    try {
      const {
        data,
        error
      } = await client.auth.updateUser({
        password
      });

      if (error) {
        throw error;
      }

      if (!data?.user) {
        throw new Error(
          "Supabase did not confirm the password update."
        );
      }

      recoveryReady = false;

      $("newPassword").value = "";
      $("confirmPassword").value = "";

      setStatus(
        "Your password has been updated successfully.",
        "success"
      );

      showModal(
        `Your password has been changed. You can now sign in to the ${portalConfig.label} Portal with your new password.`
      );

    } catch (error) {
      console.error(
        "[Reset Password] Password update failed:",
        error
      );

      setStatus(
        error?.message ||
          "We could not update your password. Please request a new recovery link and try again.",
        "error"
      );

      recoveryReady = true;
      setLoading(false);
    }
  }

  document.addEventListener(
    "DOMContentLoaded",
    async () => {
      if ($("currentYear")) {
        $("currentYear").textContent =
          new Date().getFullYear();
      }

      updatePortalUI();
      bindToggles();

      $("resetPasswordForm")
        ?.addEventListener(
          "submit",
          handleReset
        );

      $("modalButton")
        ?.addEventListener(
          "click",
          finishAndReturnToLogin
        );

      setLoading(false);

      await establishRecoverySession();
    }
  );
})();