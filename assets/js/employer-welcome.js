(() => {
  "use strict";

  document.addEventListener(
    "DOMContentLoaded",
    initializeEmployerWelcome
  );

  async function initializeEmployerWelcome() {
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

      updateGreeting(user);
      updatePortalAccount(user);

    } catch (error) {
      console.error(
        "[Employer Welcome]",
        error
      );
    }
  }

  function updateGreeting(user) {
    const greeting =
      document.getElementById(
        "employer-welcome-greeting"
      );

    if (!greeting) return;

    const firstName =
      getFirstName(user);

    greeting.textContent =
      firstName
        ? `Welcome, ${firstName}.`
        : "Welcome.";
  }

  function updatePortalAccount(user) {
    if (
      typeof window.updateEmployerPortalUser !==
      "function"
    ) return;

    const fullName =
      getFullName(user);

    window.updateEmployerPortalUser({
      fullName,
      name: fullName,
      email: user?.email || ""
    });
  }

  function getFullName(user) {
    const metadata =
      user?.user_metadata || {};

    const first =
      metadata.first_name || "";

    const last =
      metadata.last_name || "";

    const combined =
      [first, last]
        .filter(Boolean)
        .join(" ")
        .trim();

    return (
      metadata.full_name ||
      metadata.name ||
      combined ||
      ""
    );
  }

  function getFirstName(user) {
    const metadata =
      user?.user_metadata || {};

    if (metadata.first_name) {
      return metadata.first_name;
    }

    const fullName =
      getFullName(user);

    if (!fullName) return "";

    return String(fullName)
      .trim()
      .split(/\s+/)[0] || "";
  }
})();
