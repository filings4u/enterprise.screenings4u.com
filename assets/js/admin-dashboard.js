/* ============================================================
   screenings4u — ADMIN DASHBOARD
   Live dashboard metrics and recent system activity.
   ============================================================ */

(() => {
  "use strict";

  document.addEventListener("DOMContentLoaded", initializeAdminDashboard);

  async function initializeAdminDashboard() {
    const client = getClient();

    if (!client) {
      console.error("Supabase client was not found.");
      setDashboardErrorState();
      return;
    }

    const backfillButton = document.getElementById("runTeamsBackfill");
    if (backfillButton) {
      backfillButton.addEventListener("click", () => runTeamsBackfill(client));
    }

    const migrationNoticeButton = document.getElementById("sendLiveTrainingMigrationNotices");
    if (migrationNoticeButton) {
      migrationNoticeButton.addEventListener("click", () => sendLiveTrainingMigrationNotices(client));
    }

    try {
      await loadDashboard(client);
    } catch (error) {
      console.error("Admin dashboard initialization failed:", error);
      setDashboardErrorState();
    }
  }

  function getClient() {
    try {
      if (typeof window.getScreenings4uSupabase === "function") {
        return window.getScreenings4uSupabase();
      }

      if (window.screenings4uSupabase?.from) {
        return window.screenings4uSupabase;
      }

      if (window.supabaseClient?.from) {
        return window.supabaseClient;
      }
    } catch (error) {
      console.error("Unable to obtain Supabase client:", error);
    }

    return null;
  }


  async function runTeamsBackfill(client) {
    const button = document.getElementById("runTeamsBackfill");
    const status = document.getElementById("teamsBackfillStatus");
    if (!button || !status) return;

    if (!window.confirm("Create calendar-backed Microsoft Teams meetings for all eligible future training appointments? No student notification emails will be sent by this action.")) return;

    const original = status.textContent;
    button.disabled = true;
    status.textContent = "Running secure Teams calendar backfill…";

    try {
      const { data, error } = await client.functions.invoke("scheduling-teams-backfill", {
        body: { execute: true }
      });
      if (error) {
        let message = error.message || "Backfill request failed.";
        try {
          const response = error.context;
          if (response?.clone) {
            const body = await response.clone().json();
            if (body?.error) message = body.error;
          }
        } catch (_) {}
        throw new Error(message);
      }
      if (data?.error) throw new Error(data.error);

      const processed = Number(data?.processed || 0);
      const backfilled = Number(data?.backfilled || 0);
      const failed = Number(data?.failed || 0);
      status.textContent = `Complete — ${backfilled} backfilled, ${failed} failed (${processed} processed).`;
      console.log("Teams calendar backfill result:", data);
      window.alert(`Teams calendar backfill complete.\n\nBackfilled: ${backfilled}\nFailed: ${failed}\nProcessed: ${processed}\n\nNo student notification emails were sent.`);
    } catch (error) {
      console.error("Teams calendar backfill failed:", error);
      status.textContent = `Backfill failed — ${error?.message || "unknown error"}`;
      window.alert(`Teams calendar backfill failed: ${error?.message || "Unknown error"}`);
      setTimeout(() => { status.textContent = original; }, 10000);
    } finally {
      button.disabled = false;
    }
  }

  async function sendLiveTrainingMigrationNotices(client) {
    const button = document.getElementById("sendLiveTrainingMigrationNotices");
    const status = document.getElementById("liveTrainingMigrationStatus");
    if (!button || !status) return;

    if (!window.confirm("Send the Live Training system update email now to students whose appointments were successfully backfilled? Each appointment can only be sent once.")) return;

    const original = status.textContent;
    button.disabled = true;
    status.textContent = "Sending Live Training update emails…";

    try {
      const { data, error } = await client.functions.invoke("scheduling-live-training-migration-notice", { body: {} });
      if (error) {
        let message = error.message || "Notification request failed.";
        try {
          const response = error.context;
          if (response?.clone) {
            const body = await response.clone().json();
            if (body?.error) message = body.error;
          }
        } catch (_) {}
        throw new Error(message);
      }
      if (data?.error) throw new Error(data.error);

      const processed = Number(data?.processed || 0);
      const sent = Number(data?.sent || 0);
      const skipped = Number(data?.skipped || 0);
      const failed = Number(data?.failed || 0);
      status.textContent = `Complete — ${sent} sent, ${skipped} skipped, ${failed} failed.`;
      console.log("Live Training migration notice result:", data);
      window.alert(`Live Training update emails complete.\n\nSent: ${sent}\nSkipped: ${skipped}\nFailed: ${failed}\nProcessed: ${processed}`);
    } catch (error) {
      console.error("Live Training migration notices failed:", error);
      status.textContent = `Email send failed — ${error?.message || "unknown error"}`;
      window.alert(`Live Training update emails failed: ${error?.message || "Unknown error"}`);
      setTimeout(() => { status.textContent = original; }, 10000);
    } finally {
      button.disabled = false;
    }
  }

  async function loadDashboard(client) {
    const results = await Promise.allSettled([
      countActiveEmployers(client),
      countActiveEmployees(client),
      countDotTests(client),
      countOpenSupportTickets(client),
      loadRecentActivity(client)
    ]);

    const [
      employersResult,
      employeesResult,
      dotTestsResult,
      supportTicketsResult,
      activityResult
    ] = results;

    setStat(
      "employers",
      employersResult.status === "fulfilled" ? employersResult.value : 0
    );

    setStat(
      "employees",
      employeesResult.status === "fulfilled" ? employeesResult.value : 0
    );

    setStat(
      "dot-tests",
      dotTestsResult.status === "fulfilled" ? dotTestsResult.value : 0
    );

    setStat(
      "support-tickets",
      supportTicketsResult.status === "fulfilled" ? supportTicketsResult.value : 0
    );

    if (activityResult.status === "fulfilled") {
      renderActivity(activityResult.value);
    } else {
      console.error("Unable to load system activity:", activityResult.reason);
      renderEmptyActivity();
    }
  }

  async function countActiveEmployers(client) {
    const { count, error } = await client
      .from("employer_profiles")
      .select("*", { count: "exact", head: true })
      .eq("status", "active");

    if (error) {
      console.warn("Unable to count active employers:", error.message);
      return 0;
    }

    return Number(count || 0);
  }

  async function countActiveEmployees(client) {
    const activeResult = await client
      .from("employer_employees")
      .select("*", { count: "exact", head: true })
      .eq("employment_status", "active");

    if (!activeResult.error) {
      return Number(activeResult.count || 0);
    }

    const fallback = await client
      .from("employer_employees")
      .select("*", { count: "exact", head: true });

    if (fallback.error) {
      console.warn("Unable to count employees:", fallback.error.message);
      return 0;
    }

    return Number(fallback.count || 0);
  }

  async function countDotTests(client) {
    const { count, error } = await client
      .from("dot_tests")
      .select("*", { count: "exact", head: true });

    if (error) {
      console.warn("Unable to count DOT tests:", error.message);
      return 0;
    }

    return Number(count || 0);
  }

  async function countOpenSupportTickets() {
    /*
     * The current database structure supplied for this dashboard does
     * not include a support_tickets table. Keep the metric at zero
     * until that module/table exists.
     */
    return 0;
  }

  async function loadRecentActivity(client) {
    const sources = await Promise.allSettled([
      client
        .from("system_events")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10),

      client
        .from("audit_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10)
    ]);

    const rows = [];

    for (const source of sources) {
      if (source.status !== "fulfilled") {
        continue;
      }

      const result = source.value;

      if (!result?.error && Array.isArray(result?.data)) {
        rows.push(...result.data);
      }
    }

    return rows
      .map(normalizeActivity)
      .sort((a, b) => {
        return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
      })
      .slice(0, 8);
  }

  function normalizeActivity(row) {
    const title =
      row?.event_name ||
      row?.event_type ||
      row?.action ||
      row?.operation ||
      row?.event ||
      row?.table_name ||
      "System activity";

    const description =
      row?.description ||
      row?.message ||
      row?.summary ||
      buildAuditDescription(row) ||
      "System record updated.";

    return {
      title: humanize(title),
      description: String(description),
      createdAt:
        row?.created_at ||
        row?.updated_at ||
        row?.occurred_at ||
        row?.event_at ||
        null
    };
  }

  function buildAuditDescription(row) {
    if (!row || typeof row !== "object") {
      return "";
    }

    const table =
      row.table_name ||
      row.entity_type ||
      row.resource ||
      "";

    const action =
      row.action ||
      row.operation ||
      "";

    if (table && action) {
      return `${humanize(action)} record in ${humanize(table)}.`;
    }

    return "";
  }

  function renderActivity(items) {
    const target = document.getElementById("admin-system-activity-target");

    if (!target) {
      return;
    }

    if (!Array.isArray(items) || items.length === 0) {
      renderEmptyActivity();
      return;
    }

    target.innerHTML = items
      .map((item, index) => {
        const number = String(index + 1).padStart(2, "0");

        return `
          <div class="admin-activity">
            <div class="admin-activity-icon">${escapeHtml(number)}</div>

            <div class="admin-activity-copy">
              <div class="admin-activity-title">
                ${escapeHtml(item.title)}
              </div>

              <div class="admin-activity-text">
                ${escapeHtml(item.description)}
              </div>
            </div>

            <div class="admin-activity-time">
              ${escapeHtml(formatRelativeTime(item.createdAt))}
            </div>
          </div>
        `;
      })
      .join("");
  }

  function renderEmptyActivity() {
    const target = document.getElementById("admin-system-activity-target");

    if (!target) {
      return;
    }

    target.innerHTML = `
      <div class="admin-activity">
        <div class="admin-activity-icon">01</div>

        <div class="admin-activity-copy">
          <div class="admin-activity-title">
            Management Portal Ready
          </div>

          <div class="admin-activity-text">
            No recent system activity is available yet.
          </div>
        </div>

        <div class="admin-activity-time">Now</div>
      </div>
    `;
  }

  function setStat(name, value) {
    const target = document.querySelector(`[data-admin-stat="${name}"]`);

    if (target) {
      target.textContent = Number(value || 0).toLocaleString();
    }
  }

  function setDashboardErrorState() {
    setStat("employers", 0);
    setStat("employees", 0);
    setStat("dot-tests", 0);
    setStat("support-tickets", 0);

    renderEmptyActivity();
  }

  function humanize(value) {
    return String(value || "")
      .replace(/[._-]+/g, " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  function formatRelativeTime(value) {
    if (!value) {
      return "Recently";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "Recently";
    }

    const seconds = Math.max(
      0,
      Math.floor((Date.now() - date.getTime()) / 1000)
    );

    if (seconds < 60) {
      return "Now";
    }

    const minutes = Math.floor(seconds / 60);

    if (minutes < 60) {
      return `${minutes}m ago`;
    }

    const hours = Math.floor(minutes / 60);

    if (hours < 24) {
      return `${hours}h ago`;
    }

    const days = Math.floor(hours / 24);

    if (days < 7) {
      return `${days}d ago`;
    }

    return date.toLocaleDateString();
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
})();
