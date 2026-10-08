(() => {
      "use strict";

      const ADMIN_ROLES = [
        "super_admin",
        "admin",
        "operations",
        "compliance",
        "billing",
        "support",
        "content",
        "readonly"
      ];

      const $ = (id) => document.getElementById(id);
      const form = $("adminLoginForm");
      const loginButton = $("loginButton");
      const loginStatus = $("loginStatus");

      $("currentYear").textContent = new Date().getFullYear();

      function showStatus(message, type = "") {
        loginStatus.textContent = message || "";
        loginStatus.className = "login-status" + (type ? " " + type : "");
      }

      function showModal(title, message, type = "info", callback = null) {
        const modal = $("s4uModal");
        const icon = $("modalIcon");

        $("modalTitle").textContent = title;
        $("modalMessage").textContent = message;
        icon.textContent = type === "error" ? "!" : "✓";
        icon.className = "modal-icon" + (type === "error" ? " error" : "");

        $("modalButton").onclick = () => {
          modal.classList.remove("is-open");
          if (typeof callback === "function") callback();
        };

        modal.classList.add("is-open");
      }

      function getSupabaseClient() {
        if (window.supabaseClient) return window.supabaseClient;

        const url =
          window.SCREENINGS4U_SUPABASE_URL ||
          window.SUPABASE_URL;

        const key =
          window.SCREENINGS4U_SUPABASE_ANON_KEY ||
          window.SUPABASE_ANON_KEY;

        if (!window.supabase || !url || !key) {
          throw new Error("Supabase client is not available. Check assets/js/supabase-config.js.");
        }

        window.supabaseClient = window.supabase.createClient(url, key);
        return window.supabaseClient;
      }

      async function getAdminAccess(client, userId) {
        const [{ data: profile, error: profileError }, { data: roleContext, error: roleError }] =
          await Promise.all([
            client
              .from("user_profiles")
              .select("id, email, first_name, last_name, status")
              .eq("id", userId)
              .maybeSingle(),

            client.functions.invoke("portal-access-context", {
              body: { portal: "roles" }
            })
          ]);

        if (profileError) throw profileError;
        if (roleError || roleContext?.error) throw roleError || new Error(roleContext.error);

        if (!profile) {
          return { allowed: false, reason: "This account does not have a user profile." };
        }

        if (profile.status === 'inactive') {
          return { allowed: false, reason: "This administrator account is inactive. Please contact a system administrator." };
        }

        const roles = (roleContext?.roles || []).map(role => String(role || "").toLowerCase());
        const allowedRole = roles.find(role => ADMIN_ROLES.includes(role));

        if (!allowedRole) {
          return { allowed: false, reason: "Your account does not have permission to access the admin console." };
        }

        return { allowed: true, role: allowedRole, profile };
      }

      async function resetLoginState() {
        try {
          const client = getSupabaseClient();
          // The administrator login page must always start from a clean local
          // state. Never auto-redirect an existing/stale session back to the
          // dashboard; that behavior can create a login <-> dashboard loop.
          await client.auth.signOut({ scope: "local" });
        } catch (error) {
          console.warn("Admin login state reset warning:", error);
        }

        try {
          sessionStorage.removeItem("s4u-security-last-activity-v2");
          localStorage.removeItem("s4u-security-last-activity-v2");
        } catch (_) {}
      }

      $("passwordToggle").addEventListener("click", () => {
        const password = $("password");
        const show = password.type === "password";
        password.type = show ? "text" : "password";
        $("passwordToggle").textContent = show ? "◉" : "◉";
        $("passwordToggle").setAttribute("aria-label", show ? "Hide password" : "Show password");
      });

$("forgotPasswordBtn").addEventListener("click", async () => {
  const email = $("email").value.trim().toLowerCase();

  if (!email) {
    showModal(
      "Email Required",
      "Enter your staff email address first, then click Forgot password?",
      "error"
    );
    $("email").focus();
    return;
  }

  if (!email.endsWith("@screenings4u.com")) {
    showModal(
      "Staff Account Required",
      "Password recovery from the Admin Console is available only for Screenings4u staff accounts.",
      "error"
    );
    return;
  }

  try {
    const client = getSupabaseClient();

    const redirectTo =
      `${window.location.origin}/reset-password.html?portal=admin`;

    const { error } = await client.auth.resetPasswordForEmail(email, {
      redirectTo
    });

    if (error) {
      console.error("Admin password recovery request failed:", error);

      showModal(
        "Password Reset Error",
        "We could not start the password reset process. Please try again or contact a system administrator.",
        "error"
      );

      return;
    }

    showModal(
      "Check Your Email",
      "If an eligible staff account exists for that email address, password reset instructions have been sent. Open the email and follow the link to create a new password."
    );

  } catch (error) {
    console.error("Admin password recovery failed:", error);

    showModal(
      "Connection Error",
      "The password recovery service could not be reached. Please try again.",
      "error"
    );
  }
});

      form.addEventListener("submit", async (event) => {
        event.preventDefault();

        const email = $("email").value.trim();
        const password = $("password").value;

        if (!email || !password) {
          showModal("Missing Information", "Enter your staff email and password before signing in.", "error");
          return;
        }

        try {
          loginButton.disabled = true;
          loginButton.textContent = "SIGNING IN...";
          showStatus("Authenticating your account...");

          const client = getSupabaseClient();

          const { data, error } = await client.auth.signInWithPassword({
            email,
            password
          });

          if (error) {
            showStatus("");
            showModal("Sign In Failed", error.message || "We could not sign you in. Please verify your credentials.", "error");
            return;
          }

          if (!data.user) {
            showStatus("");
            showModal("Sign In Failed", "No authenticated user was returned. Please try again.", "error");
            return;
          }

          showStatus("Verifying admin access...");

          const access = await getAdminAccess(client, data.user.id);

          if (!access.allowed) {
            await client.auth.signOut({ scope: "local" });
            showStatus("");
            showModal("Access Denied", access.reason, "error");
            return;
          }

          showStatus("Access verified. Opening admin console...", "success");

          // Establish a fresh inactivity baseline before entering the
          // protected portal so the new login cannot be treated as stale.
          try {
            localStorage.setItem("s4u-security-last-activity-v2", String(Date.now()));
            sessionStorage.setItem("s4u-security-last-activity-v2", String(Date.now()));
          } catch (_) {}

          window.location.replace("portal-selector.html");

        } catch (error) {
          console.error("Admin login failed:", error);
          showStatus("");
          showModal(
            "Connection Error",
            error.message || "The sign-in service could not be reached. Please try again.",
            "error"
          );
        } finally {
          loginButton.disabled = false;
          loginButton.textContent = "SIGN IN TO ADMIN CONSOLE";
        }
      });

      resetLoginState();
    })();
