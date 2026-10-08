/* ============================================================
   SCREENINGS4U — EMPLOYER DASHBOARD
   Live employer-scoped Supabase dashboard.
   ============================================================ */

(function () {
  "use strict";

  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    renderLoading();

    try {
      const client = getClient();

      if (!client) {
        throw new Error("Supabase client is unavailable.");
      }

      const {
        data: authData,
        error: authError
      } = await client.auth.getUser();

      if (authError) {
        throw authError;
      }

      const user = authData?.user || null;

      if (!user) {
        throw new Error("Your employer session has expired.");
      }

      updateLiveEmployerIdentity(user);

      const {
        data,
        error
      } = await client.rpc(
        "employer_dashboard_summary"
      );

      if (error) {
        throw error;
      }

      renderDashboard(
        data || {},
        user
      );

    } catch (error) {
      console.error(
        "[Employer Dashboard]",
        error
      );

      renderError(error);
    }
  }


  function getClient() {
    if (window.getScreenings4uSupabase) {
      return window.getScreenings4uSupabase();
    }

    return (
      window.screenings4uSupabase ||
      window.supabaseClient ||
      null
    );
  }


  function renderLoading() {
    setText(
      "employer-welcome-name",
      ""
    );

    [
      "stat-total-employees",
      "stat-training-progress",
      "stat-active-programs",
      "stat-open-orders",
      "training-completion-rate",
      "training-assigned-count",
      "training-completed-count",
      "training-attention-count"
    ].forEach(function (id) {
      setText(id, "—");
    });

    setText(
      "stat-active-employees",
      "Loading organization data..."
    );
  }


  function renderDashboard(
    data,
    user
  ) {
    const employees =
      data.employees || {};

    const training =
      data.training || {};

    const liveName =
      getUserFullName(user);

    const dashboardName =
      cleanName(data.employer_name);

    const displayName =
      liveName || dashboardName || "";

    setText(
      "employer-welcome-name",
      displayName
        ? `Welcome back, ${displayName}`
        : "Welcome back"
    );

    if (
      typeof window.updateEmployerPortalUser ===
      "function"
    ) {
      window.updateEmployerPortalUser({
        fullName: displayName,
        name: displayName,
        email: user?.email || ""
      });
    }

    setText(
      "stat-total-employees",
      number(employees.total)
    );

    setText(
      "stat-active-employees",
      `${number(employees.active)} active employee${
        Number(employees.active) === 1
          ? ""
          : "s"
      }`
    );

    setText(
      "stat-training-progress",
      number(training.in_progress)
    );

    setText(
      "stat-active-programs",
      number(data.active_programs)
    );

    setText(
      "stat-open-orders",
      number(data.open_orders)
    );

    setText(
      "training-completion-rate",
      `${number(training.completion_rate)}%`
    );

    setText(
      "training-assigned-count",
      number(training.assigned)
    );

    setText(
      "training-completed-count",
      number(training.completed)
    );

    setText(
      "training-attention-count",
      number(training.attention)
    );

    renderActivity(
      data.recent_activity || []
    );

    renderOpenItems(
      data.open_items || []
    );
  }


  function updateLiveEmployerIdentity(user) {
    const fullName =
      getUserFullName(user);

    setText(
      "employer-welcome-name",
      fullName
        ? `Welcome back, ${fullName}`
        : "Welcome back"
    );

    if (
      typeof window.updateEmployerPortalUser ===
      "function"
    ) {
      window.updateEmployerPortalUser({
        fullName,
        name: fullName,
        email: user?.email || ""
      });
    }
  }


  function getUserFullName(user) {
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


  function cleanName(value) {
    const name =
      String(value || "").trim();

    if (!name) {
      return "";
    }

    const blocked =
      new Set([
        "customer",
        "employer",
        "customer account",
        "employer account",
        "customer user",
        "employer user"
      ]);

    return blocked.has(name.toLowerCase())
      ? ""
      : name;
  }


  function renderActivity(items) {
    const root =
      document.getElementById(
        "employer-recent-activity"
      );

    if (!root) {
      return;
    }

    if (!items.length) {
      root.innerHTML =
        '<div class="employer-empty-state">No recent organization activity yet.</div>';

      return;
    }

    root.innerHTML =
      items
        .slice(0, 6)
        .map(function (item) {
          return `
            <a
              class="employer-activity-item"
              href="${safeHref(item.href)}"
            >
              <div class="employer-activity-icon">
                ${activityIcon(item.type)}
              </div>

              <div class="employer-activity-copy">
                <strong>
                  ${esc(item.title || "Organization activity")}
                </strong>

                <span>
                  ${esc(item.detail || "")}
                </span>

                <small>
                  ${formatDate(item.occurred_at)}
                </small>
              </div>
            </a>
          `;
        })
        .join("");
  }


  function renderOpenItems(items) {
    const root =
      document.getElementById(
        "employer-open-items"
      );

    if (!root) {
      return;
    }

    if (!items.length) {
      root.innerHTML =
        '<div class="employer-empty-state">No open orders or invoices require attention.</div>';

      return;
    }

    root.innerHTML =
      items
        .slice(0, 8)
        .map(function (item) {
          return `
            <a
              class="employer-open-item"
              href="${safeHref(item.href)}"
            >
              <div>
                <strong>
                  ${esc(item.title || "Open item")}
                </strong>

                <span>
                  ${esc(item.detail || "")}
                </span>
              </div>

              <span class="employer-open-item-status">
                ${esc(pretty(item.status))}
              </span>
            </a>
          `;
        })
        .join("");
  }


  function renderError(error) {
    setText(
      "stat-active-employees",
      "Unable to load employer data"
    );

    const message =
      esc(
        error?.message ||
        "Unable to load the employer dashboard."
      );

    const activity =
      document.getElementById(
        "employer-recent-activity"
      );

    const open =
      document.getElementById(
        "employer-open-items"
      );

    if (activity) {
      activity.innerHTML =
        `<div class="employer-empty-state">${message}</div>`;
    }

    if (open) {
      open.innerHTML =
        '<div class="employer-empty-state">Dashboard data is currently unavailable.</div>';
    }
  }


  function activityIcon(type) {
    if (type === "invoice") {
      return "$";
    }

    if (type === "notification") {
      return "!";
    }

    return "▣";
  }


  function number(value) {
    const n =
      Number(value || 0);

    return Number.isFinite(n)
      ? n.toLocaleString()
      : "0";
  }


  function pretty(value) {
    return String(value || "")
      .replace(/_/g, " ")
      .replace(
        /\b\w/g,
        function (c) {
          return c.toUpperCase();
        }
      );
  }


  function formatDate(value) {
    if (!value) {
      return "";
    }

    const d =
      new Date(value);

    if (Number.isNaN(d.getTime())) {
      return "";
    }

    return d.toLocaleDateString(
      undefined,
      {
        month: "short",
        day: "numeric",
        year: "numeric"
      }
    );
  }


  function safeHref(value) {
    const href =
      String(value || "#");

    return /^[a-z0-9._?=&%-]+$/i.test(href)
      ? href
      : "#";
  }


  function esc(value) {
    return String(value ?? "")
      .replace(
        /[&<>'"]/g,
        function (c) {
          return {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            "'": "&#39;",
            '"': "&quot;"
          }[c];
        }
      );
  }


  function setText(
    id,
    value
  ) {
    const element =
      document.getElementById(id);

    if (element) {
      element.textContent = value;
    }
  }

})();
