(() => {
  "use strict";

  const S = {
    db: null,
    user: null,
    profile: null,
    orders: [],
    results: [],
    notifications: [],
    donorPasses: []
  };

  const $ = (id) => document.getElementById(id);

  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    try {
      await waitForShell();

      S.db = await getScreenings4uSupabase();

      const {
        data: { user },
        error
      } = await S.db.auth.getUser();

      if (error || !user) {
        return;
      }

      S.user = user;

      const d = await invoke();

      S.profile = d.profile || null;
      S.orders = d.orders || [];
      S.results = d.results || [];
      S.notifications = d.notifications || [];
      S.donorPasses = d.donor_passes || [];

      render();

    } catch (e) {
      console.error("[Customer Dashboard]", e);
      showError();
    }
  }

  function waitForShell() {
    return new Promise((resolve) => setTimeout(resolve, 60));
  }

  async function invoke() {
    const { data, error } =
      await S.db.functions.invoke(
        "customer-dashboard-actions",
        {
          body: {
            action: "dashboard"
          }
        }
      );

    if (error) {
      let message =
        error.message;

      try {
        const json =
          await error.context?.clone?.().json();

        if (json?.error) {
          message = json.error;
        }
      } catch {}

      throw new Error(message);
    }

    if (data?.error) {
      throw new Error(data.error);
    }

    return data || {};
  }

  function render() {
    renderWelcome();
    renderPortalAccount();
    renderUnifiedPortalAccess();
    renderStats();
    renderOrders();
    renderResults();
    renderReceipts();
    renderNotifications();
    renderDonorFeature();
  }

  function renderWelcome() {
    text(
      "customer-welcome-name",
      displayFirstName()
    );
  }

  function renderPortalAccount() {
    if (
      typeof window.updateCustomerPortalUser !==
      "function"
    ) {
      return;
    }

    const fullName =
      displayFullName();

    window.updateCustomerPortalUser({
      fullName,
      name: fullName,
      email: S.user?.email || ""
    });
  }


  function hasDotCtpaAccess() {
    return S.orders.some((o) =>
      (o.order_items || []).some((i) =>
        String(i?.metadata?.service_sku || '').toLowerCase() === 'lab-account' ||
        String(i?.metadata?.workforce_dot_plan_code || '').toLowerCase().includes('dot_ctpa')
      )
    );
  }

  function renderUnifiedPortalAccess() {
    if (!hasDotCtpaAccess()) return;
    const actions = document.querySelector('.customer-welcome-actions');
    if (!actions || document.getElementById('customer-dot-ctpa-sso')) return;
    const link = document.createElement('a');
    link.href = '#';
    link.id = 'customer-dot-ctpa-sso';
    link.className = 'customer-primary-action';
    link.innerHTML = 'Open C/TPA DOT Portal';
    link.addEventListener('click', openDotCtpaPortal);
    actions.appendChild(link);
  }

  async function openDotCtpaPortal(event) {
    event?.preventDefault?.();
    const link = event?.currentTarget;
    const original = link?.textContent || 'Open C/TPA DOT Portal';
    try {
      if (link) { link.textContent = 'Opening DOT Portal…'; link.setAttribute('aria-disabled','true'); }
      const { data: { session } } = await S.db.auth.getSession();
      if (!session?.access_token) throw new Error('Your screenings4u session has expired. Please sign in again.');
      const { data: body, error } = await S.db.functions.invoke('portal-session-handoff', {
        body: {
          action: 'create',
          surface: 'dot',
          portal_code: 'ctpa_dot',
          next: '/ctpa/dashboard.html'
        }
      });
      if (error || body?.error || !body?.redirect_url) {
        throw new Error(body?.error || error?.message || 'Unable to open the DOT C/TPA portal.');
      }
      window.location.href = body.redirect_url;
    } catch (e) {
      console.error('[Customer Dashboard] DOT SSO', e);
      if (window.S4UUI?.alert) window.S4UUI.alert(e.message || 'Unable to open the DOT portal.', { title: 'Portal Access' });
      else alert(e.message || 'Unable to open the DOT portal.');
      if (link) { link.textContent = original; link.removeAttribute('aria-disabled'); }
    }
  }

  function displayFullName() {
    const profile =
      S.profile || {};

    const metadata =
      S.user?.user_metadata || {};

    const first =
      profile.first_name ||
      metadata.first_name ||
      "";

    const last =
      profile.last_name ||
      metadata.last_name ||
      "";

    const combined =
      [first, last]
        .filter(Boolean)
        .join(" ")
        .trim();

    return (
      profile.display_name ||
      profile.full_name ||
      combined ||
      metadata.full_name ||
      metadata.name ||
      ""
    );
  }

  function displayFirstName() {
    const profile =
      S.profile || {};

    const metadata =
      S.user?.user_metadata || {};

    const fullName =
      displayFullName();

    if (profile.first_name) {
      return profile.first_name;
    }

    if (metadata.first_name) {
      return metadata.first_name;
    }

    if (fullName) {
      return String(fullName)
        .trim()
        .split(/\s+/)[0] || "";
    }

    return "";
  }

  function renderStats() {
    const active =
      S.orders.filter((o) =>
        ![
          "completed",
          "cancelled",
          "refunded"
        ].includes(
          String(
            o.fulfillment_status ||
            o.status ||
            ""
          ).toLowerCase()
        )
      ).length;

    text(
      "customer-stat-active-orders",
      active
    );

    text(
      "customer-stat-results",
      S.results.length
    );

    text(
      "customer-stat-donor-passes",
      S.donorPasses.filter((p) =>
        ![
          "completed",
          "cancelled",
          "expired",
          "used"
        ].includes(
          String(
            p.status || ""
          ).toLowerCase()
        )
      ).length
    );

    text(
      "customer-stat-completed-orders",
      S.orders.filter((o) =>
        o.payment_status === "paid" ||
        o.status === "completed"
      ).length
    );
  }

  function renderOrders() {
    const box =
      $("customer-recent-orders");

    const empty =
      $("customer-orders-empty");

    const load =
      $("customer-orders-loading");

    if (load) load.remove();
    if (!box) return;

    const rows =
      S.orders.slice(0, 5);

    box.querySelectorAll(
      ".customer-order-item"
    ).forEach((x) => x.remove());

    if (!rows.length) {
      if (empty) empty.hidden = false;
      return;
    }

    if (empty) empty.hidden = true;

    rows.forEach((o) => {
      const item =
        document.createElement("article");

      item.className =
        "customer-order-item";

      const serviceNames =
        (o.order_items || [])
          .map((i) =>
            i.services?.name ||
            i.metadata?.service_name ||
            i.metadata?.name
          )
          .filter(Boolean);

      const name =
        serviceNames.length
          ? serviceNames.join(", ")
          : labelType(
              o.fulfillment_type
            );

      const status =
        String(
          o.fulfillment_status ||
          o.status ||
          "pending"
        ).toLowerCase();

      item.innerHTML =
        `<div class="customer-order-icon">${icon("order")}</div>` +
        `<div class="customer-order-copy">` +
          `<div class="customer-order-name"></div>` +
          `<div class="customer-order-meta"></div>` +
        `</div>` +
        `<div class="customer-order-status"></div>`;

      item.querySelector(
        ".customer-order-name"
      ).textContent = name;

      item.querySelector(
        ".customer-order-meta"
      ).textContent =
        `${o.order_number || "Order"} · ${date(o.created_at)}`;

      const st =
        item.querySelector(
          ".customer-order-status"
        );

      st.textContent =
        pretty(status);

      st.classList.add(
        statusClass(status)
      );

      box.appendChild(item);
    });
  }

  function renderResults() {
    const box =
      $("customer-recent-results");

    const empty =
      $("customer-results-empty");

    const load =
      $("customer-results-loading");

    if (load) load.remove();
    if (!box) return;

    const rows =
      S.results.slice(0, 5);

    box.querySelectorAll(
      ".customer-result-item"
    ).forEach((x) => x.remove());

    if (!rows.length) {
      if (empty) empty.hidden = false;
      return;
    }

    if (empty) empty.hidden = true;

    rows.forEach((r) => {
      const el =
        document.createElement("article");

      el.className =
        "customer-result-item";

      el.innerHTML =
        `<div class="customer-result-icon">${icon("result")}</div>` +
        `<div class="customer-result-copy">` +
          `<div class="customer-result-name"></div>` +
          `<div class="customer-result-meta"></div>` +
        `</div>` +
        `<a class="customer-result-action" href="customer-results.html">View</a>`;

      el.querySelector(
        ".customer-result-name"
      ).textContent =
        r.title || "Screening Result";

      el.querySelector(
        ".customer-result-meta"
      ).textContent =
        date(
          r.updated_at ||
          r.created_at
        );

      box.appendChild(el);
    });
  }

  function renderReceipts() {
    const box =
      $("customer-recent-receipts");

    const empty =
      $("customer-receipts-empty");

    const load =
      $("customer-receipts-loading");

    if (load) load.remove();
    if (!box) return;

    const rows =
      S.orders
        .filter((o) =>
          o.payment_status === "paid" ||
          o.status === "completed"
        )
        .slice(0, 5);

    box.querySelectorAll(
      ".customer-order-item"
    ).forEach((x) => x.remove());

    if (!rows.length) {
      if (empty) empty.hidden = false;
      return;
    }

    if (empty) empty.hidden = true;

    rows.forEach((o) => {
      const el =
        document.createElement("article");

      el.className =
        "customer-order-item";

      el.innerHTML =
        `<div class="customer-order-icon">${icon("order")}</div>` +
        `<div class="customer-order-copy">` +
          `<div class="customer-order-name"></div>` +
          `<div class="customer-order-meta"></div>` +
        `</div>` +
        `<a class="customer-result-action" href="customer-receipt.html?id=${encodeURIComponent(o.id)}">View Receipt</a>`;

      el.querySelector(
        ".customer-order-name"
      ).textContent =
        o.order_number ||
        "Paid Order";

      el.querySelector(
        ".customer-order-meta"
      ).textContent =
        `${money(o.total, o.currency)} · ${date(o.paid_at || o.created_at)}`;

      box.appendChild(el);
    });
  }

  function renderNotifications() {
    const box =
      $("customer-dashboard-notifications");

    const empty =
      $("customer-notifications-empty");

    const load =
      $("customer-notifications-loading");

    if (load) load.remove();
    if (!box) return;

    const rows =
      S.notifications.slice(0, 5);

    box.querySelectorAll(
      ".customer-notification-item"
    ).forEach((x) => x.remove());

    if (!rows.length) {
      if (empty) empty.hidden = false;
      return;
    }

    if (empty) empty.hidden = true;

    rows.forEach((n) => {
      const el =
        document.createElement("article");

      el.className =
        "customer-notification-item";

      el.innerHTML =
        `<div class="customer-notification-dot"></div>` +
        `<div class="customer-notification-copy">` +
          `<strong></strong>` +
          `<p></p>` +
          `<span></span>` +
        `</div>`;

      el.querySelector(
        "strong"
      ).textContent =
        n.subject ||
        "Account Notification";

      el.querySelector(
        "p"
      ).textContent =
        n.body || "";

      el.querySelector(
        "span"
      ).textContent =
        date(
          n.sent_at ||
          n.created_at
        );

      box.appendChild(el);
    });
  }

  function renderDonorFeature() {
    const el =
      $("customer-dashboard-donor-feature");

    if (!el) return;

    const active =
      S.donorPasses.filter((p) =>
        ![
          "completed",
          "cancelled",
          "expired",
          "used"
        ].includes(
          String(
            p.status || ""
          ).toLowerCase()
        )
      );

    const copy =
      el.querySelector(
        ".customer-donor-feature-copy p"
      );

    if (copy && active.length) {
      const p =
        active[0];

      copy.textContent =
        p.location_name
          ? `Your donor pass is ready. Assigned collection site: ${p.location_name}.`
          : `You have ${active.length} active donor pass${active.length === 1 ? "" : "es"} ready to review.`;
    }
  }

  function showError() {
    [
      "customer-orders-loading",
      "customer-results-loading",
      "customer-receipts-loading",
      "customer-notifications-loading"
    ].forEach((id) =>
      $(id)?.remove()
    );

    [
      "customer-orders-empty",
      "customer-results-empty",
      "customer-receipts-empty",
      "customer-notifications-empty"
    ].forEach((id) => {
      if ($(id)) {
        $(id).hidden = false;
      }
    });
  }

  function statusClass(v) {
    if (
      v.includes("complete") ||
      v.includes("fulfilled")
    ) {
      return "completed";
    }

    if (
      v.includes("cancel") ||
      v.includes("refund")
    ) {
      return "cancelled";
    }

    return "pending";
  }

  function labelType(v) {
    return pretty(
      String(
        v || "Service"
      ).replaceAll("_", " ")
    );
  }

  function pretty(v) {
    return String(v || "")
      .replace(/[._-]+/g, " ")
      .replace(
        /\b\w/g,
        (c) => c.toUpperCase()
      );
  }

  function date(v) {
    const d =
      new Date(v);

    return Number.isNaN(
      d.getTime()
    )
      ? "—"
      : new Intl.DateTimeFormat(
          "en-US",
          {
            month: "short",
            day: "numeric",
            year: "numeric"
          }
        ).format(d);
  }

  function money(
    v,
    c = "USD"
  ) {
    return new Intl.NumberFormat(
      "en-US",
      {
        style: "currency",
        currency:
          String(
            c || "USD"
          ).toUpperCase()
      }
    ).format(
      Number(v || 0)
    );
  }

  function text(id, v) {
    if ($(id)) {
      $(id).textContent =
        String(
          v ?? ""
        );
    }
  }

  function icon(t) {
    return t === "result"
      ? `<svg viewBox="0 0 24 24"><path d="M7 3h7l4 4v14H7z"></path><path d="M14 3v5h5"></path><path d="m9 13 2 2 4-4"></path></svg>`
      : t === "document"
        ? `<svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><path d="M14 2v6h6"></path></svg>`
        : `<svg viewBox="0 0 24 24"><path d="M6 3h12"></path><path d="M6 7h12"></path><path d="M6 11h12"></path><path d="M6 15h8"></path></svg>`;
  }
})();
