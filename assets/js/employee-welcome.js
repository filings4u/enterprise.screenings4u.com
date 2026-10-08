(() => {
  "use strict";

  document.addEventListener(
    "DOMContentLoaded",
    initializeEmployeeWelcome
  );

  async function initializeEmployeeWelcome() {
    try {
      const client =
        await getScreenings4uSupabase();

      const {
        data: { user },
        error
      } = await client.auth.getUser();

      if (error || !user) {
        return;
      }

      const fullName =
        getFullName(user);

      const firstName =
        getFirstName(user);

      const greeting =
        document.getElementById(
          "employee-welcome-greeting"
        );

      if (greeting) {
        greeting.textContent =
          firstName
            ? `Welcome, ${firstName}.`
            : "Welcome.";
      }

      if (
        typeof window.updateEmployeePortalUser ===
        "function"
      ) {
        window.updateEmployeePortalUser({
          fullName,
          name: fullName,
          email: user?.email || ""
        });
      }

    } catch (error) {
      console.error(
        "[Employee Welcome]",
        error
      );
    }
  }

  function getFullName(user) {
    const metadata =
      user?.user_metadata || {};

    const first =
      cleanName(metadata.first_name);

    const last =
      cleanName(metadata.last_name);

    const combined =
      [first, last]
        .filter(Boolean)
        .join(" ")
        .trim();

    return (
      cleanName(metadata.full_name) ||
      cleanName(metadata.name) ||
      combined ||
      ""
    );
  }

  function getFirstName(user) {
    const metadata =
      user?.user_metadata || {};

    const firstName =
      cleanName(metadata.first_name);

    if (firstName) {
      return firstName;
    }

    const fullName =
      getFullName(user);

    if (!fullName) {
      return "";
    }

    return String(fullName)
      .trim()
      .split(/\s+/)[0] || "";
  }

  function cleanName(value) {
    const name =
      String(value || "").trim();

    if (!name) {
      return "";
    }

    const blocked =
      new Set([
        "employee",
        "employee account",
        "customer",
        "customer account"
      ]);

    return blocked.has(name.toLowerCase())
      ? ""
      : name;
  }
})();
