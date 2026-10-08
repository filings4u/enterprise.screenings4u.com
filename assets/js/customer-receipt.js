(() => {
  "use strict";

  const $ = id => document.getElementById(id);

  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    try {
      const db = await getScreenings4uSupabase();

      const {
        data: { user },
        error: userError
      } = await db.auth.getUser();

      if (userError || !user) {
        throw userError || new Error("You must be signed in to view this receipt.");
      }

      const orderId = new URLSearchParams(window.location.search).get("id");

      if (!orderId) {
        throw new Error("No order was specified for this receipt.");
      }

      const { data, error } = await db.functions.invoke(
        "customer-orders-actions",
        {
          body: {
            action: "list"
          }
        }
      );

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const orders = data?.orders || [];

      const order = orders.find(
        o => o.id === orderId || o.order_number === orderId
      );

      if (!order) {
        throw new Error("This order could not be found in your account.");
      }

      render(order);
    } catch (error) {
      console.error("[Customer Receipt]", error);
      $("receipt-loading").hidden = true;
      $("receipt-error").hidden = false;
      $("receipt-error").textContent =
        error?.message || "Unable to load this receipt.";
    }
  }

  function render(o) {
    $("receipt-order-number").textContent = o.order_number || "Receipt";
    $("receipt-paid-date").textContent = formatDate(o.paid_at || o.created_at);
    $("receipt-payment-status").textContent = title(o.payment_status);
    $("receipt-order-status").textContent = title(o.status);
    $("receipt-service-status").textContent = title(o.fulfillment_status);

    if (String(o.payment_status || "").toLowerCase() === "paid") {
      $("receipt-payment-status").classList.add("receipt-status-paid");
    }

    const fullName = [
      o.customer_first_name,
      o.customer_last_name
    ].filter(Boolean).join(" ");

    $("receipt-customer-name").textContent = fullName || "Customer";
    $("receipt-customer-email").textContent = o.customer_email || "—";
    $("receipt-customer-phone").textContent = o.customer_phone || "—";

    $("receipt-order-id").textContent = o.id || "—";
    $("receipt-tracking").textContent = o.tracking_number || "Not assigned";
    $("receipt-fulfillment-type").textContent = title(o.fulfillment_type);
    $("receipt-created-date").textContent = formatDateTime(o.created_at);

    $("receipt-payment-method").textContent = title(o.payment_method);
    $("receipt-payment-provider").textContent = title(o.payment_provider);
    $("receipt-payment-reference").textContent =
      o.payment_reference || o.stripe_payment_intent_id || "—";
    $("receipt-paid-at").textContent = formatDateTime(o.paid_at);

    const address = [
      o.billing_address_line_1,
      o.billing_address_line_2
    ].filter(Boolean).join(", ");

    $("receipt-billing-address").textContent = address || "—";
    $("receipt-billing-city-state").textContent =
      [o.billing_city, o.billing_state].filter(Boolean).join(", ") || "—";
    $("receipt-billing-postal").textContent = o.billing_postal_code || "—";
    $("receipt-billing-country").textContent = o.billing_country || "—";

    const tbody = $("receipt-items");
    tbody.innerHTML = "";

    const items = o.order_items || [];

    if (!items.length) {
      const tr = document.createElement("tr");
      tr.innerHTML = '<td colspan="4">No order items are available.</td>';
      tbody.appendChild(tr);
    } else {
      items.forEach(i => {
        const tr = document.createElement("tr");

        const serviceName =
          i.services?.name ||
          i.metadata?.service_name ||
          i.metadata?.name ||
          "Screenings4u Service";

        const sku =
          i.services?.sku ||
          i.metadata?.service_sku ||
          "Service";

        const qty = Number(i.quantity || 1);
        const unitPrice = Number(i.unit_price || 0);
        const lineTotal =
          i.line_total ?? (unitPrice * qty);

        tr.innerHTML = `
          <td>
            <span class="item-name">${escapeHtml(serviceName)}</span>
            <span class="item-sku">${escapeHtml(sku)}</span>
          </td>
          <td>${qty}</td>
          <td>${money(unitPrice, o.currency)}</td>
          <td>${money(lineTotal, o.currency)}</td>
        `;

        tbody.appendChild(tr);
      });
    }

    $("receipt-subtotal").textContent = money(o.subtotal, o.currency);
    $("receipt-total").textContent = money(o.total, o.currency);

    if (o.customer_notes) {
      $("receipt-notes").textContent = o.customer_notes;
      $("receipt-notes-section").hidden = false;
    }

    $("receipt-loading").hidden = true;
    $("receipt-page").hidden = false;

    document.title =
      `${o.order_number || "Receipt"} | Screenings4u Receipt`;
  }

  function money(value, currency = "usd") {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: String(currency || "usd").toUpperCase()
    }).format(Number(value || 0));
  }

  function formatDate(value) {
    if (!value) return "—";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "—";

    return new Intl.DateTimeFormat("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric"
    }).format(d);
  }

  function formatDateTime(value) {
    if (!value) return "—";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "—";

    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit"
    }).format(d);
  }

  function title(value) {
    if (!value) return "—";

    return String(value)
      .replace(/_/g, " ")
      .replace(/\b\w/g, c => c.toUpperCase());
  }

  function escapeHtml(value) {
    const div = document.createElement("div");
    div.textContent = String(value ?? "");
    return div.innerHTML;
  }
})();