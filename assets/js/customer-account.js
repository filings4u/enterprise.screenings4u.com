/* ============================================================
   SCREENINGS4U - CUSTOMER MY ACCOUNT
   Live Supabase wiring
   ============================================================ */

(() => {
  "use strict";

  const LOGIN_PAGE = "customer-login.html";
  const state = {
    db: null,
    user: null,
    profile: null,
    originalProfile: null,
    preferences: null,
    editing: false
  };

  const $ = (id) => document.getElementById(id);

  // Do not display protected account content while auth is being checked.
  if (document.body) {
    document.body.style.visibility = "hidden";
    document.body.setAttribute("aria-busy", "true");
  }

  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    bind();

    try {
      state.db = await getClient();

      // A signed-out visitor has a null session. This is a redirect state,
      // not an error that should be displayed to the visitor.
      const {
        data: { session },
        error: sessionError
      } = await state.db.auth.getSession();

      if (sessionError) {
        if (isMissingSessionError(sessionError)) return redirectToLogin();
        throw sessionError;
      }

      if (!session) return redirectToLogin();

      // Verify the stored session with Supabase before exposing account data.
      const {
        data: { user },
        error: userError
      } = await state.db.auth.getUser();

      if (userError) {
        if (isMissingSessionError(userError)) return redirectToLogin();
        throw userError;
      }

      if (!user) return redirectToLogin();

      state.user = user;
      await loadAccount();
      revealPage();
    } catch (error) {
      console.error("customer-account:", error);

      if (isMissingSessionError(error)) {
        return redirectToLogin();
      }

      revealPage();
      notify(error?.message || "Unable to load your account.", true);
    }
  }

  function redirectToLogin() {
    window.location.replace(LOGIN_PAGE);
  }

  function isMissingSessionError(error) {
    const name = String(error?.name || "").toLowerCase();
    const message = String(error?.message || error || "").toLowerCase();

    return (
      name.includes("authsessionmissing") ||
      message.includes("auth session missing") ||
      message.includes("session missing") ||
      message.includes("no session")
    );
  }

  function revealPage() {
    if (!document.body) return;
    document.body.style.visibility = "";
    document.body.removeAttribute("aria-busy");
  }

  async function getClient() {
    if (typeof window.getScreenings4uSupabase === "function") {
      return await window.getScreenings4uSupabase();
    }

    if (window.screenings4uSupabase) {
      return window.screenings4uSupabase;
    }

    throw new Error("Screenings4u Supabase client is unavailable.");
  }

  function bind() {
    $("customer-edit-profile-btn")?.addEventListener("click", () => setEditing(true));

    $("customer-cancel-profile-btn")?.addEventListener("click", () => {
      state.profile = clone(state.originalProfile);
      render();
      setEditing(false);
    });

    $("customer-profile-form")?.addEventListener("submit", saveProfile);
    $("customer-save-notifications")?.addEventListener("click", savePreferences);
    $("customer-password-btn")?.addEventListener("click", openPasswordModal);
    $("customer-password-modal-close")?.addEventListener("click", closePasswordModal);
    $("customer-password-modal-done")?.addEventListener("click", sendPasswordReset);
    document.querySelector(".customer-account-modal-backdrop")?.addEventListener("click", closePasswordModal);

    $("customer-account-support-btn")?.addEventListener("click", () => {
      window.location.href = "customer-support.html";
    });
  }

  async function loadAccount() {
    const uid = state.user.id;

    const [profileResult, prefResult] = await Promise.all([
      state.db
        .from("user_profiles")
        .select("id,first_name,last_name,display_name,email,phone,status,metadata,created_at,updated_at")
        .eq("id", uid)
        .maybeSingle(),
      state.db
        .from("customer_account_preferences")
        .select("*")
        .eq("user_id", uid)
        .maybeSingle()
    ]);

    if (profileResult.error) throw profileResult.error;

    state.profile = profileResult.data || {
      id: uid,
      first_name: state.user.user_metadata?.first_name || "",
      last_name: state.user.user_metadata?.last_name || "",
      display_name: state.user.user_metadata?.display_name || "",
      email: state.user.email || "",
      phone: state.user.phone || "",
      status: "active",
      created_at: state.user.created_at
    };

    // Supabase Auth email is authoritative for sign-in identity.
    state.profile.email = state.user.email || state.profile.email || "";
    state.originalProfile = clone(state.profile);

    if (prefResult.error) {
      console.warn("Unable to load notification preferences:", prefResult.error);
    }

    state.preferences = prefResult.data || {
      user_id: uid,
      email_notifications: true,
      service_notifications: true
    };

    render();
    setEditing(false);
  }

  function render() {
    const profile = state.profile || {};
    const preferences = state.preferences || {};

    setValue("customer-first-name", profile.first_name);
    setValue("customer-last-name", profile.last_name);
    setValue("customer-email", profile.email);
    setValue("customer-phone", profile.phone);

    const fullName =
      [profile.first_name, profile.last_name].filter(Boolean).join(" ") ||
      profile.display_name ||
      "Your Name";

    setText("customer-account-name", fullName);
    setText("customer-account-email", profile.email || "—");
    setText("customer-member-since", profile.created_at ? formatDate(profile.created_at) : "—");
    setText("customer-account-id", profile.id ? shortenId(profile.id) : "—");
    setText("customer-account-avatar", initials(profile.first_name, profile.last_name));

    if ($("customer-email-notifications")) {
      $("customer-email-notifications").checked = preferences.email_notifications !== false;
    }

    if ($("customer-service-notifications")) {
      $("customer-service-notifications").checked = preferences.service_notifications !== false;
    }

    const activeBadge = document.querySelector(".customer-account-active");
    if (activeBadge) {
      activeBadge.textContent = profile.status === 'inactive' ? "Inactive Account" : "Active Account";
    }
  }

  function setEditing(on) {
    state.editing = Boolean(on);

    [
      "customer-first-name",
      "customer-last-name",
      "customer-phone",
      "customer-email-notifications",
      "customer-service-notifications"
    ].forEach((id) => {
      const element = $(id);
      if (element) element.disabled = !state.editing;
    });

    if ($("customer-email")) $("customer-email").disabled = true;
    if ($("customer-profile-actions")) $("customer-profile-actions").hidden = !state.editing;
    if ($("customer-notification-actions")) $("customer-notification-actions").hidden = !state.editing;
    if ($("customer-edit-profile-btn")) $("customer-edit-profile-btn").hidden = state.editing;
  }

  async function saveProfile(event) {
    event.preventDefault();
    if (!state.user) return redirectToLogin();

    const patch = {
      first_name: value("customer-first-name"),
      last_name: value("customer-last-name"),
      phone: value("customer-phone") || null,
      display_name:
        [value("customer-first-name"), value("customer-last-name")]
          .filter(Boolean)
          .join(" ") || null,
      updated_at: new Date().toISOString()
    };

    const submit = event.submitter;
    setBusy(submit, true, "Saving...");

    try {
      const { data, error } = await state.db
        .from("user_profiles")
        .update(patch)
        .eq("id", state.user.id)
        .select("id,first_name,last_name,display_name,email,phone,status,metadata,created_at,updated_at")
        .single();

      if (error) throw error;

      state.profile = { ...data, email: state.user.email || data.email };
      state.originalProfile = clone(state.profile);
      render();
      setEditing(false);
      notify("Account information updated.");
    } catch (error) {
      console.error(error);
      if (isMissingSessionError(error)) return redirectToLogin();
      notify(error?.message || "Unable to save account information.", true);
    } finally {
      setBusy(submit, false, "Save Changes");
    }
  }

  async function savePreferences() {
    if (!state.user) return redirectToLogin();

    const button = $("customer-save-notifications");
    setBusy(button, true, "Saving...");

    const record = {
      user_id: state.user.id,
      email_notifications: checked("customer-email-notifications"),
      service_notifications: checked("customer-service-notifications"),
      updated_at: new Date().toISOString()
    };

    try {
      const { data, error } = await state.db
        .from("customer_account_preferences")
        .upsert(record, { onConflict: "user_id" })
        .select()
        .single();

      if (error) throw error;
      state.preferences = data;
      notify("Notification preferences updated.");
    } catch (error) {
      console.error(error);
      if (isMissingSessionError(error)) return redirectToLogin();
      notify(error?.message || "Unable to save notification preferences.", true);
    } finally {
      setBusy(button, false, "Save Preferences");
    }
  }

  function openPasswordModal() {
    const modal = $("customer-password-modal");
    if (modal) modal.hidden = false;

    const copy = document.querySelector("#customer-password-modal p");
    if (copy) {
      copy.textContent =
        "We will send a secure password-reset link to your account email. Your current password is never displayed.";
    }

    const done = $("customer-password-modal-done");
    if (done) done.textContent = "Send Reset Email";
  }

  function closePasswordModal() {
    const modal = $("customer-password-modal");
    if (modal) modal.hidden = true;
  }

  async function sendPasswordReset() {
    const email = state.user?.email;
    if (!email) return redirectToLogin();

    const button = $("customer-password-modal-done");
    setBusy(button, true, "Sending...");

    try {
      const redirectTo = new URL("reset-password.html", window.location.href).href;
      const { error } = await state.db.auth.resetPasswordForEmail(email, { redirectTo });
      if (error) throw error;

      closePasswordModal();
      notify("Password reset email sent.");
    } catch (error) {
      console.error(error);
      if (isMissingSessionError(error)) return redirectToLogin();
      notify(error?.message || "Unable to send password reset email.", true);
    } finally {
      setBusy(button, false, "Send Reset Email");
    }
  }

  function notify(message, error = false) {
    if (window.Screenings4uUI?.toast) {
      return window.Screenings4uUI.toast(message, {
        type: error ? "error" : "success"
      });
    }

    if (window.showToast) {
      return window.showToast(message, error ? "error" : "success");
    }

    window.alert(message);
  }

  function setBusy(element, on, text) {
    if (!element) return;
    if (!element.dataset.originalText) {
      element.dataset.originalText = element.textContent;
    }
    element.disabled = on;
    element.textContent = on ? text : element.dataset.originalText || text;
  }

  function value(id) {
    return $(id)?.value.trim() || "";
  }

  function checked(id) {
    return Boolean($(id)?.checked);
  }

  function setValue(id, valueToSet) {
    const element = $(id);
    if (element) element.value = valueToSet ?? "";
  }

  function setText(id, valueToSet) {
    const element = $(id);
    if (element) element.textContent = String(valueToSet ?? "");
  }

  function clone(valueToClone) {
    return valueToClone ? JSON.parse(JSON.stringify(valueToClone)) : null;
  }

  function initials(firstName, lastName) {
    return (
      [firstName, lastName]
        .filter(Boolean)
        .map((part) => String(part).trim()[0]?.toUpperCase())
        .join("") || "CU"
    );
  }

  function shortenId(id) {
    const stringId = String(id);
    return stringId.length <= 12
      ? stringId
      : `${stringId.slice(0, 8)}…${stringId.slice(-4)}`;
  }

  function formatDate(valueToFormat) {
    const date = new Date(valueToFormat);
    return Number.isNaN(date.getTime())
      ? "—"
      : new Intl.DateTimeFormat("en-US", {
   month: "short",
          year: "numeric"
        }).format(date);
  }
})();
