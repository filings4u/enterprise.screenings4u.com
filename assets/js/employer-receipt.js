(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);

  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    $("print-receipt")?.addEventListener("click", () => window.print());

    try {
      const orderId = new URLSearchParams(location.search).get("id");
      if (!orderId) throw new Error("No order was selected.");

      const db = await getScreenings4uSupabase();

      const {
        data: { session },
        error: sessionError
      } = await db.auth.getSession();

      if (sessionError) throw sessionError;
      if (!session?.user?.id) {
        throw new Error("Your login session expired. Please sign in again.");
      }

      const { data: order, error: orderError } = await db
        .from("orders")
        .select(`
          id, order_number, employer_id, status, payment_status,
          subtotal, tax, total, currency, payment_method,
          payment_reference, tracking_number, customer_email,
          customer_first_name, customer_last_name, customer_phone,
          created_at, paid_at
        `)
        .eq("id", orderId)
        .single();

      if (orderError) throw orderError;

      const { data: items, error: itemsError } = await db
        .from("order_items")
        .select(`
          id, order_id, quantity, unit_price, line_total,
          services ( id, sku, name, description )
        `)
        .eq("order_id", orderId);

      if (itemsError) throw itemsError;

      let employerName = "Employer";

      const { data: access, error: accessError } = await db.functions.invoke(
        "portal-access-context",
        { body: { portal: "employer" } }
      );
      if (accessError) throw accessError;
      if (!access?.allowed || String(access?.employer_id || "") !== String(order.employer_id || "")) {
        throw new Error(access?.reason || "This receipt is not available for your employer account.");
      }

      employerName =
        access?.organization?.dba_name ||
        access?.organization?.legal_name ||
        access?.employer?.dba_name ||
        access?.employer?.legal_name ||
        "Employer";

      render(order, items || [], employerName);

    } catch (error) {
      console.error("[Employer Receipt]", error);
      const box = $("receipt-error");
      if (box) {
        box.hidden = false;
        box.textContent = error?.message || "Unable to load receipt.";
      }
      const status = $("receipt-payment-status");
      if (status) status.textContent = "Unavailable";
    }
  }

  function render(order, items, employerName) {
    $("receipt-content").hidden = false;

    setText("receipt-order-number", order.order_number || order.id);
    setText("receipt-date", formatDate(order.paid_at || order.created_at));
    setText("receipt-employer", employerName);

    const customerName =
      [order.customer_first_name, order.customer_last_name]
        .filter(Boolean)
        .join(" ") || "—";

    setText("receipt-customer", customerName);
    setText("receipt-email", order.customer_email || "—");
    setText("receipt-payment-method", formatLabel(order.payment_method || "stripe"));
    setText("receipt-payment-reference", order.payment_reference || "—");
    setText("receipt-tracking-number", order.tracking_number || "—");
    setText("receipt-payment-status", formatLabel(order.payment_status || "unpaid"));

    $("receipt-items").innerHTML = items.map((item) => `
      <tr>
        <td>
          <strong>${escapeHtml(item.services?.name || "Service")}</strong>
          ${item.services?.sku ? `<small>${escapeHtml(item.services.sku)}</small>` : ""}
        </td>
        <td>${escapeHtml(item.quantity)}</td>
        <td>${money(item.unit_price)}</td>
        <td>${money(item.line_total)}</td>
      </tr>
    `).join("");

    setText("receipt-subtotal", money(order.subtotal));
    setText("receipt-total", money(order.total));

    document.title = `${order.order_number || "Receipt"} | Screenings4u`;
  }

  function setText(id, value) {
    const element = $(id);
    if (element) element.textContent = value == null ? "" : value;
  }

  function money(value) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD"
    }).format(Number(value || 0));
  }

  function formatDate(value) {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit"
    }).format(date);
  }

  function formatLabel(value) {
    return String(value || "—")
      .replace(/_/g, " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  function escapeHtml(value) {
    const element = document.createElement("div");
    element.textContent = String(value ?? "");
    return element.innerHTML;
  }
})();