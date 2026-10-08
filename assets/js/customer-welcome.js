(() => {
  "use strict";

  document.addEventListener(
    "DOMContentLoaded",
    initializeWelcomePage
  );

  async function initializeWelcomePage() {
    try {
      const client =
        await getScreenings4uSupabase();

      const {
        data: { user },
        error: userError
      } = await client.auth.getUser();

      if (userError || !user) {
        return;
      }

      let profile = null;

      try {
        const {
          data,
          error
        } = await client.functions.invoke(
          "customer-dashboard-actions",
          {
            body: {
              action: "dashboard"
            }
          }
        );

        if (!error && !data?.error) {
          profile =
            data?.profile || null;
        }

      } catch (error) {
        console.warn(
          "[Customer Welcome] Profile lookup failed:",
          error
        );
      }

      updateWelcomeName(
        profile,
        user
      );

      updatePortalAccount(
        profile,
        user
      );

      await updateTrainingCard(
        client
      );

    } catch (error) {
      console.error(
        "[Customer Welcome]",
        error
      );
    }
  }


  function updateWelcomeName(
    profile,
    user
  ) {
    const el =
      document.getElementById(
        "customer-welcome-first-name"
      );

    if (!el) {
      return;
    }

    const firstName =
      getFirstName(
        profile,
        user
      );

    if (!firstName) {
      el.remove();
      return;
    }

    el.textContent =
      firstName;

    el.classList.remove(
      "customer-welcome-name-pending"
    );
  }


  function updatePortalAccount(
    profile,
    user
  ) {
    if (
      typeof window.updateCustomerPortalUser !==
      "function"
    ) {
      return;
    }

    const fullName =
      getFullName(
        profile,
        user
      );

    window.updateCustomerPortalUser({
      fullName,
      name: fullName,
      email:
        user?.email || ""
    });
  }


  async function updateTrainingCard(
    client
  ) {
    const card =
      document.getElementById(
        "customer-welcome-training-card"
      );

    if (!card) {
      return;
    }

    // Fail closed. The card stays hidden unless access is verified.
    card.hidden = true;

    try {
      const {
        data,
        error
      } = await client.rpc(
        "customer_has_training_purchase"
      );

      if (error) {
        throw error;
      }

      if (data === true) {
        card.hidden = false;
      }

    } catch (error) {
      console.warn(
        "[Customer Welcome] Training access check failed:",
        error
      );

      card.hidden = true;
    }
  }


  function getFullName(
    profile,
    user
  ) {
    const p =
      profile || {};

    const metadata =
      user?.user_metadata || {};

    const first =
      p.first_name ||
      metadata.first_name ||
      "";

    const last =
      p.last_name ||
      metadata.last_name ||
      "";

    const combined =
      [first, last]
        .filter(Boolean)
        .join(" ")
        .trim();

    return (
      p.display_name ||
      p.full_name ||
      combined ||
      metadata.full_name ||
      metadata.name ||
      ""
    );
  }


  function getFirstName(
    profile,
    user
  ) {
    const p =
      profile || {};

    const metadata =
      user?.user_metadata || {};

    if (p.first_name) {
      return p.first_name;
    }

    if (metadata.first_name) {
      return metadata.first_name;
    }

    const fullName =
      getFullName(
        profile,
        user
      );

    if (!fullName) {
      return "";
    }

    return String(fullName)
      .trim()
      .split(/\s+/)[0] || "";
  }
})();
