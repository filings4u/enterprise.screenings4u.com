/* ============================================================
   screenings4u — PASSWORD RECOVERY
   ============================================================ */

(() => {
  "use strict";

  const STAFF_DOMAIN = "@screenings4u.com";
  const $ = id => document.getElementById(id);

  function isStaffEmail(email) {
    return String(email || "").trim().toLowerCase().endsWith(STAFF_DOMAIN);
  }

  function setStatus(message = "", type = "") {
    const el = $("recoveryStatus");
    if (!el) return;
    el.textContent = message;
    el.className = "login-status";
    if (type) el.classList.add(type);
  }

  function setLoading(loading) {
    const btn = $("recoveryButton");
    if (!btn) return;
    btn.disabled = loading;
    btn.textContent = loading ? "SENDING RESET LINK..." : "SEND PASSWORD RESET LINK";
  }

  function showModal(title, message, error = false) {
    const modal = $("s4uModal");
    const icon = $("modalIcon");
    const titleEl = $("modalTitle");
    const messageEl = $("modalMessage");
    if (!modal || !titleEl || !messageEl) return;

    titleEl.textContent = title;
    messageEl.textContent = message;
    if (icon) {
      icon.textContent = error ? "!" : "✓";
      icon.classList.toggle("error", error);
    }
    modal.classList.add("is-open");
  }

  function closeModal() {
    $("s4uModal")?.classList.remove("is-open");
  }

  async function handleRecovery(event) {
    event.preventDefault();

    const email = $("email")?.value?.trim().toLowerCase();

    if (!email || !email.includes("@")) {
      setStatus("Please enter a valid email address.", "error");
      return;
    }

    /*
     * Staff accounts are intentionally not recovered through the customer-facing
     * recovery page. They should use the staff/admin recovery process.
     */
    if (isStaffEmail(email)) {
      setStatus("Screenings4u staff accounts cannot use customer password recovery.", "error");
      showModal(
        "Staff account",
        "Screenings4u staff email addresses cannot use this customer-facing password recovery page.",
        true
      );
      return;
    }

    const client = window.supabaseClient || window.S4USupabase?.client;

    if (!client?.auth?.resetPasswordForEmail) {
      setStatus("Password recovery is temporarily unavailable.", "error");
      return;
    }

    setLoading(true);
    setStatus("");

    try {
      const redirectTo = new URL("reset-password.html", window.location.href).href;

      const { error } = await client.auth.resetPasswordForEmail(email, {
        redirectTo
      });

      if (error) throw error;

      const message =
        "If an eligible Screenings4u account exists for that email address, password reset instructions have been sent.";

      setStatus(message, "success");
      showModal("Check your email", message);

    } catch (error) {
      console.error("[Password Recovery]", error);

      // Keep the public response generic to reduce account enumeration.
      const message =
        "We could not start password recovery right now. Please try again in a few minutes.";

      setStatus(message, "error");
      showModal("Recovery unavailable", message, true);
    } finally {
      setLoading(false);
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    $("currentYear").textContent = new Date().getFullYear();

    $("forgotPasswordForm")?.addEventListener("submit", handleRecovery);
    $("modalButton")?.addEventListener("click", closeModal);

    $("s4uModal")?.addEventListener("click", event => {
      if (event.target === $("s4uModal")) closeModal();
    });
  });
})();