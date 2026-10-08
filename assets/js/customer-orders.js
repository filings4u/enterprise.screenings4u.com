(() => {
  "use strict";

  const S = {
    db: null,
    user: null,
    filter: "all",
    search: "",
    newest: true,
    orders: [],
    invoices: [],
    links: [],
    documents: [],
    selected: null
  };

  const $ = id => document.getElementById(id);

  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    bind();
    loading(true);

    try {
      S.db = await getScreenings4uSupabase();

      const {
        data: { user },
        error
      } = await S.db.auth.getUser();

      if (error || !user) {
        throw error || new Error("Not signed in");
      }

      S.user = user;
      await load();

      const id = new URLSearchParams(location.search).get("id");

      if (id) {
        const o = S.orders.find(
          x => x.id === id || x.order_number === id
        );

        if (o) goToReceipt(o);
      }
    } catch (e) {
      fail(e);
    } finally {
      loading(false);
    }
  }

  function bind() {
    document.querySelectorAll("[data-order-filter]").forEach(b => {
      b.onclick = () => {
        S.filter = b.dataset.orderFilter;

        document.querySelectorAll("[data-order-filter]").forEach(x => {
          const on = x === b;
          x.classList.toggle("is-active", on);
          x.setAttribute("aria-selected", String(on));
        });

        render();
      };
    });

    $("customer-orders-search-input").oninput = e => {
      S.search = e.target.value.trim().toLowerCase();
      render();
    };

    $("customer-orders-sort").onclick = () => {
      S.newest = !S.newest;
      $("customer-orders-sort").querySelector("span").textContent =
        S.newest ? "Newest First" : "Oldest First";
      render();
    };

    // Order rows now redirect directly to the branded receipt page.
    // The legacy modal is no longer used.
  }

  async function call(action, p = {}) {
    const { data, error } = await S.db.functions.invoke(
      "customer-orders-actions",
      {
        body: {
          action,
          ...p
        }
      }
    );

    if (error) throw error;
    if (data?.error) throw new Error(data.error);

    return data;
  }

  async function load() {
    const d = await call("list");

    S.orders = d.orders || [];
    S.invoices = d.invoices || [];
    S.links = d.links || [];
    S.documents = d.documents || [];

    summary();
    render();
  }

  function summary() {
    text(
      "orders-active-count",
      S.orders.filter(
        o =>
          ["pending", "processing"].includes(o.status) ||
          ["pending", "processing"].includes(o.fulfillment_status)
      ).length
    );

    text(
      "orders-completed-count",
      S.orders.filter(
        o =>
          o.status === "completed" ||
          o.fulfillment_status === "completed"
      ).length
    );

    text("orders-total-count", S.orders.length);
  }

  function render() {
    let a = S.orders.slice();

    if (S.filter === "active") {
      a = a.filter(
        o =>
          ["pending", "processing"].includes(o.status) ||
          ["pending", "processing"].includes(o.fulfillment_status)
      );
    } else if (S.filter !== "all") {
      a = a.filter(
        o =>
          o.status === S.filter ||
          o.fulfillment_status === S.filter
      );
    }

    if (S.search) {
      a = a.filter(o =>
        [
          o.order_number,
          o.status,
          o.fulfillment_status,
          o.tracking_number,
          ...(o.order_items || []).map(
            i =>
              i.services?.name ||
              i.metadata?.service_name ||
              ""
          )
        ]
          .join(" ")
          .toLowerCase()
          .includes(S.search)
      );
    }

    a.sort(
      (x, y) =>
        (new Date(y.created_at) - new Date(x.created_at)) *
        (S.newest ? 1 : -1)
    );

    const list = $("customer-orders-list");
    const empty = $("customer-orders-empty");

    list.innerHTML = "";

    if (!a.length) {
      list.hidden = true;
      empty.hidden = false;
      return;
    }

    empty.hidden = true;
    list.hidden = false;

    a.forEach(o => {
      const el = document.createElement("article");

      el.className = "customer-order-row";
      el.tabIndex = 0;
      el.innerHTML = row(o);

      el.onclick = e => {
        if (!e.target.closest("button,a")) goToReceipt(o);
      };

      el.onkeydown = e => {
        if (e.key === "Enter") goToReceipt(o);
      };

      el.querySelector(".customer-order-view").onclick = () => goToReceipt(o);

      list.appendChild(el);
    });
  }

  function row(o) {
    const items = o.order_items || [];

    const name =
      items.length === 1
        ? itemName(items[0])
        : items.length
          ? `${items.length} services`
          : "Screenings4u Service";

    return `
      <div class="customer-order-service">
        <div class="customer-order-service-icon">▤</div>
        <div class="customer-order-service-copy">
          <strong>${esc(name)}</strong>
          <span>${esc(o.order_number)}</span>
        </div>
      </div>

      <div class="customer-order-meta">
        <span class="customer-order-meta-label">Order Date</span>
        <span class="customer-order-meta-value">${date(o.created_at)}</span>
      </div>

      <div class="customer-order-meta">
        <span class="customer-order-meta-label">Status</span>
        <span class="customer-order-status ${esc(o.status)}">
          ${esc(status(o.status))}
        </span>
      </div>

      <div>
        <div class="customer-order-amount">${money(o.total, o.currency)}</div>
        <button type="button" class="customer-order-view">View Order ›</button>
      </div>
    `;
  }

  function goToReceipt(o) {
    if (!o?.id) return;

    window.location.href =
      `customer-receipt.html?id=${encodeURIComponent(o.id)}`;
  }

  function item(i) {
    return `
      <div class="customer-order-item">
        <div>
          <strong>${esc(itemName(i))}</strong>
          <small>${esc(i.services?.sku || "Service")}</small>
        </div>

        <span>Qty ${Number(i.quantity || 1)}</span>

        <strong>
          ${money(
            i.line_total ??
              Number(i.unit_price || 0) *
              Number(i.quantity || 1),
            S.selected?.currency
          )}
        </strong>
      </div>
    `;
  }

  function itemName(i) {
    return (
      i.services?.name ||
      i.metadata?.service_name ||
      i.metadata?.name ||
      "Screenings4u Service"
    );
  }

  function loading(v) {
    $("customer-orders-loading").hidden = !v;
  }

  function text(id, v) {
    $(id).textContent = v;
  }

  function date(v) {
    const d = new Date(v);

    return isNaN(d)
      ? "—"
      : new Intl.DateTimeFormat("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric"
        }).format(d);
  }

  function money(v, c = "usd") {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: String(c || "usd").toUpperCase()
    }).format(Number(v || 0));
  }

  function status(v) {
    return String(v || "")
      .replace(/_/g, " ")
      .replace(/\b\w/g, c => c.toUpperCase());
  }

  function esc(v) {
    const d = document.createElement("div");
    d.textContent = String(v ?? "");
    return d.innerHTML;
  }

  function fail(e) {
    console.error("[Customer Orders]", e);

    if (window.Screenings4uUI?.toast) {
      Screenings4uUI.toast(
        e?.message || "Unable to load orders.",
        "error"
      );
    } else {
      alert(
        e?.message || "Unable to load orders."
      );
    }
  }
})();