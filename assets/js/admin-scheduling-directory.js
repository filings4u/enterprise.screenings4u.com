(() => {
  "use strict";

  let db = null;
  let rows = [];

  const E = {};
  const $ = (id) => document.getElementById(id);

  document.addEventListener("DOMContentLoaded", init);

  async function client() {
    for (let i = 0; i < 40; i += 1) {
      try {
        if (typeof window.getScreenings4uSupabase === "function") {
          const c = await window.getScreenings4uSupabase();
          if (c?.functions) return c;
        }
        if (window.screenings4uSupabase?.functions) return window.screenings4uSupabase;
      } catch (_) {}
      await new Promise((resolve) => setTimeout(resolve, 75));
    }
    return null;
  }

  async function call(body) {
    const { data, error } = await db.functions.invoke("scheduling-actions", { body });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data;
  }

  async function init() {
    [
      "refresh","message","sTotal","sUpcoming","sToday","sCompleted","sCancelled",
      "search","statusFilter","body","empty","recordCount"
    ].forEach((id) => E[id] = $(id));

    E.refresh?.addEventListener("click", load);
    E.search?.addEventListener("input", render);
    E.statusFilter?.addEventListener("change", render);

    try {
      db = await client();
      if (!db) throw new Error("Supabase client not found.");
      await load();
    } catch (error) {
      msg(error.message || "Unable to load scheduling.", "error");
    }
  }

  async function load() {
    const button = E.refresh;
    if (button) {
      button.disabled = true;
      button.textContent = "Refreshing...";
    }

    try {
      const page = document.querySelector("[data-schedule-type]");
      const type = page?.dataset.scheduleType || "";
      const data = await call({ action: "list", appointment_type: type });
      rows = data.appointments || [];
      stats();
      render();
    } catch (error) {
      msg(error.message || "Unable to load scheduling.", "error");
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = "Refresh";
      }
    }
  }

  function stats() {
    const now = new Date();
    const today = now.toDateString();

    E.sTotal.textContent = rows.length;
    E.sUpcoming.textContent = rows.filter((x) =>
      new Date(x.start_at) >= now &&
      !["cancelled","completed","no_show"].includes(x.status)
    ).length;

    E.sToday.textContent = rows.filter((x) =>
      new Date(x.start_at).toDateString() === today
    ).length;

    E.sCompleted.textContent = rows.filter((x) => x.status === "completed").length;
    E.sCancelled.textContent = rows.filter((x) =>
      ["cancelled","no_show"].includes(x.status)
    ).length;
  }

  function render() {
    const q = (E.search?.value || "").trim().toLowerCase();
    const status = E.statusFilter?.value || "all";
    const page = document.querySelector("[data-schedule-type]");
    const builder = page?.dataset.builder || "#";
    const type = page?.dataset.scheduleType || "";

    const out = rows.filter((x) => {
      const haystack = [
        x.tracking_number,x.title,x.attendee_name,x.attendee_email,
        x.host_name,x.host_email,x.location_name,x.location_address,
        x.phone_number,x.meeting_provider
      ].filter(Boolean).join(" ").toLowerCase();

      return (!q || haystack.includes(q)) &&
        (status === "all" || x.status === status);
    });

    if (E.recordCount) {
      E.recordCount.textContent = `${out.length} of ${rows.length} appointments`;
    }

    E.empty.hidden = out.length !== 0;

    E.body.innerHTML = out.map((x) => {
      const method = methodLabel(x, type);
      return `<tr>
        <td><strong>${esc(x.tracking_number || "—")}</strong></td>
        <td><strong>${esc(x.title || "Untitled Appointment")}</strong><br><small>${esc(x.description || "")}</small></td>
        <td>${esc(x.attendee_name || "—")}<br><small>${esc(x.attendee_email || "")}</small></td>
        <td>${fmt(x.start_at)}<br><small>${esc(x.timezone || "")}</small></td>
        <td><span class="scheduling-badge ${esc(x.status)}">${human(x.status)}</span></td>
        <td>${esc(method)}</td>
        <td>
          <div class="scheduling-row-actions">
            <a class="scheduling-row-button" href="${builder}?id=${encodeURIComponent(x.id)}">Open</a>
            ${x.meeting_url ? `<a class="scheduling-row-button join" href="${esc(x.meeting_url)}" target="_blank" rel="noopener">Join</a>` : ""}
          </div>
        </td>
      </tr>`;
    }).join("");
  }

  function methodLabel(x, type) {
    if (type === "phone") return x.phone_number || x.host_name || "Phone";
    if (type === "in_person") return x.location_name || x.location_address || "In Person";
    if (type === "teams") return x.host_name || "Microsoft Teams";
    return x.meeting_provider || x.host_name || "Online Meeting";
  }

  function fmt(value) {
    if (!value) return "—";
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? "—"
      : date.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
  }

  function human(value) {
    return String(value || "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }

  function esc(value) {
    return String(value ?? "")
      .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
      .replace(/"/g,"&quot;").replace(/'/g,"&#039;");
  }

  function msg(text, type = "ok") {
    if (!E.message) return;
    E.message.textContent = text;
    E.message.className = `scheduling-message show ${type}`;
  }
})();
