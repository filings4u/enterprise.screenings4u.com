(()=>{"use strict";

let db = null;
let orders = [];
const E = {};

document.addEventListener("DOMContentLoaded", init);

async function init() {
  cache();
  bind();

  try {
    db = await getClient();

    if (!db) {
      throw new Error("Supabase client not found.");
    }

    const { data } = await db.auth.getSession();

    if (!data?.session?.user) {
      location.replace("admin-login.html");
      return;
    }

    await loadOrders();
  } catch (error) {
    showMessage(error?.message || "Unable to load orders.", "error");
  }
}

function cache() {
  [
    "refresh",
    "export",
    "message",
    "total",
    "paid",
    "unpaid",
    "revenue",
    "admin",
    "search",
    "payment",
    "source",
    "body",
    "empty"
  ].forEach((id) => {
    E[id] = document.getElementById(id);
  });
}

function bind() {
  E.refresh?.addEventListener("click", loadOrders);
  E.export?.addEventListener("click", exportCsv);
  E.search?.addEventListener("input", render);
  E.payment?.addEventListener("change", render);
  E.source?.addEventListener("change", render);
}

async function getClient() {
  for (let i = 0; i < 40; i += 1) {
    try {
      if (typeof window.getScreenings4uSupabase === "function") {
        const instance = await window.getScreenings4uSupabase();

        if (instance?.functions) {
          return instance;
        }
      }

      if (window.screenings4uSupabase?.functions) {
        return window.screenings4uSupabase;
      }

      if (window.supabaseClient?.functions) {
        return window.supabaseClient;
      }
    } catch (_) {}

    await new Promise((resolve) => setTimeout(resolve, 75));
  }

  return null;
}

async function call(body) {
  const { data, error } = await db.functions.invoke("admin-order-actions", {
    body
  });

  if (error) {
    let message = error.message || "Order action failed.";

    try {
      const response = error.context;

      if (response && typeof response.clone === "function") {
        const payload = await response.clone().json();

        if (payload?.error) {
          message = payload.error;
        }
      }
    } catch (_) {}

    throw new Error(message);
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  return data;
}

async function loadOrders() {
  if (E.refresh) {
    E.refresh.disabled = true;
  }

  try {
    const data = await call({ action: "list" });
    orders = data.orders || [];

    updateStats();
    render();
  } catch (error) {
    showMessage(error?.message || "Unable to load orders.", "error");
  } finally {
    if (E.refresh) {
      E.refresh.disabled = false;
    }
  }
}

function updateStats() {
  if (E.total) {
    E.total.textContent = String(orders.length);
  }

  if (E.paid) {
    E.paid.textContent = String(
      orders.filter((order) => order.payment_status === "paid").length
    );
  }

  if (E.unpaid) {
    E.unpaid.textContent = String(
      orders.filter((order) =>
        ["unpaid", "pending", "failed"].includes(order.payment_status)
      ).length
    );
  }

  if (E.revenue) {
    const revenue = orders
      .filter((order) => order.payment_status === "paid")
      .reduce((sum, order) => sum + Number(order.total || 0), 0);

    E.revenue.textContent = money(revenue);
  }

  if (E.admin) {
    E.admin.textContent = String(
      orders.filter((order) => order.source === "admin").length
    );
  }
}

function render() {
  if (!E.body) {
    return;
  }

  const query = String(E.search?.value || "").toLowerCase().trim();
  const paymentFilter = E.payment?.value || "all";
  const sourceFilter = E.source?.value || "all";

  const filtered = orders.filter((order) => {
    const searchable = [
      order.order_number,
      order.customer_first_name,
      order.customer_last_name,
      order.customer_email,
      order.customer_phone,
      order.payment_reference,
      ...(order.items || []).map((item) => item.service?.name)
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return (
      (!query || searchable.includes(query)) &&
      (paymentFilter === "all" ||
        order.payment_status === paymentFilter) &&
      (sourceFilter === "all" ||
        order.source === sourceFilter)
    );
  });

  if (E.empty) {
    E.empty.hidden = filtered.length > 0;
  }

  E.body.innerHTML = filtered
    .map((order) => {
      const customer =
        [order.customer_first_name, order.customer_last_name]
          .filter(Boolean)
          .join(" ") || "Customer";

      const services = (order.items || [])
        .map((item) => item.service?.name || "Service")
        .join(", ");

      const canPay =
        order.payment_method === "stripe" &&
        !["paid", "refunded"].includes(order.payment_status);

      return `
        <tr>
          <td>
            <div class="order">
              <strong>${escapeHtml(order.order_number)}</strong>
              <small>${escapeHtml(
                order.tracking_number ||
                String(order.id || "").slice(0, 8)
              )}</small>
            </div>
          </td>

          <td>
            <div class="customer">
              <strong>${escapeHtml(customer)}</strong>
              <small>${escapeHtml(order.customer_email || "")}</small>
            </div>
          </td>

          <td>
            <span class="badge">${human(order.source)}</span>
          </td>

          <td>${escapeHtml(services || "—")}</td>

          <td>
            <span class="badge ${escapeHtml(order.status || "")}">
              ${human(order.status)}
            </span>
          </td>

          <td>
            <span class="badge ${escapeHtml(
              order.payment_status || ""
            )}">
              ${human(order.payment_status)}
            </span>
          </td>

          <td>
            <span class="badge ${escapeHtml(
              order.fulfillment_status || ""
            )}">
              ${human(order.fulfillment_status)}
            </span>
          </td>

          <td class="money">${money(order.total)}</td>
          <td>${formatDate(order.created_at)}</td>

          <td>
            <div class="row-actions">
              <a
                class="row-btn"
                href="admin-checkout.html?order_id=${encodeURIComponent(
                  order.id
                )}"
              >
                Open
              </a>

              <a
                class="row-btn"
                href="admin-testing-cases.html?order_id=${encodeURIComponent(
                  order.id
                )}"
              >
                Testing Workflow
              </a>

              ${
                canPay
                  ? `
                    <a
                      class="row-btn pay"
                      href="admin-checkout.html?order_id=${encodeURIComponent(
                        order.id
                      )}#payment"
                    >
                      Pay
                    </a>
                  `
                  : ""
              }
            </div>
          </td>
        </tr>
      `;
    })
    .join("");
}

function exportCsv() {
  const rows = [
    [
      "Order",
      "Customer",
      "Email",
      "Source",
      "Status",
      "Payment",
      "Fulfillment",
      "Total",
      "Created"
    ],
    ...orders.map((order) => [
      order.order_number,
      [order.customer_first_name, order.customer_last_name]
        .filter(Boolean)
        .join(" "),
      order.customer_email,
      order.source,
      order.status,
      order.payment_status,
      order.fulfillment_status,
      order.total,
      order.created_at
    ])
  ];

  const csv = rows
    .map((row) =>
      row
        .map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`)
        .join(",")
    )
    .join("\n");

  const blob = new Blob([csv], {
    type: "text/csv;charset=utf-8"
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = "screenings4u-orders.csv";
  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(url);
}

function showMessage(text, type = "error") {
  if (!E.message) {
    return;
  }

  E.message.textContent = text;
  E.message.className = `message show ${type}`;
}

function money(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(Number(value || 0));
}

function formatDate(value) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleDateString();
}

function human(value) {
  return String(value || "—")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
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