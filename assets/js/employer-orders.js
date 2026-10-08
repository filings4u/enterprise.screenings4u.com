/* ============================================================
   SCREENINGS4U — EMPLOYER ORDERS
   Live canonical orders + order_items
   ============================================================ */

(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);

  const state = {
    db: null,
    orders: [],
    activeType: "all"
  };

  document.addEventListener("DOMContentLoaded", initializeOrders);

  async function initializeOrders() {
    bindControls();

    try {
      state.db = await getScreenings4uSupabase();
      await loadOrders();
    } catch (error) {
      console.error("[Employer Orders]", error);
      state.orders = [];
      updateMetrics();
      renderOrders(error);
    }
  }

  function bindControls() {
    const search = $("order-search");
    const statusFilter = $("order-status-filter");

    if (search) search.addEventListener("input", renderOrders);
    if (statusFilter) statusFilter.addEventListener("change", renderOrders);

    document.querySelectorAll(".order-type-tab").forEach((button) => {
      button.addEventListener("click", () => {
        state.activeType = button.dataset.orderType || "all";

        document.querySelectorAll(".order-type-tab").forEach((tab) => {
          tab.classList.remove("active");
        });

        button.classList.add("active");
        renderOrders();
      });
    });

    bindClick("order-detail-close", closeOrderDetail);
    bindClick("order-detail-close-bottom", closeOrderDetail);
    bindClick("order-detail-backdrop", closeOrderDetail);
  }

  async function loadOrders() {
    const {
      data: { session },
      error: sessionError
    } = await state.db.auth.getSession();

    if (sessionError) throw sessionError;
    if (!session?.user?.id) {
      throw new Error("Your login session expired. Please sign in again.");
    }

    const { data: access, error: accessError } = await state.db.functions.invoke(
      "portal-access-context",
      { body: { portal: "employer" } }
    );

    if (accessError) throw accessError;
    if (!access?.allowed || !access?.employer_id) {
      throw new Error(access?.reason || "Active employer portal access was not found.");
    }

    const employerIds = [access.employer_id];

    const { data: orders, error: ordersError } = await state.db
      .from("orders")
      .select(`
        id,
        order_number,
        user_id,
        employer_id,
        status,
        payment_status,
        subtotal,
        tax,
        total,
        currency,
        source,
        fulfillment_type,
        fulfillment_status,
        payment_method,
        payment_reference,
        tracking_number,
        customer_email,
        customer_first_name,
        customer_last_name,
        customer_phone,
        created_at,
        paid_at,
        fulfilled_at
      `)
      .in("employer_id", employerIds)
      .eq("payment_status", "paid")
      .order("created_at", { ascending: false });

    if (ordersError) throw ordersError;

    const orderIds = (orders || []).map((row) => row.id);
    let items = [];

    if (orderIds.length) {
      const { data: orderItems, error: itemsError } = await state.db
        .from("order_items")
        .select(`
          id,
          order_id,
          service_id,
          quantity,
          unit_price,
          line_total,
          services (
            id,
            sku,
            name,
            description,
            product_type,
            metadata
          )
        `)
        .in("order_id", orderIds);

      if (itemsError) throw itemsError;
      items = orderItems || [];
    }

    const byOrder = new Map();

    items.forEach((item) => {
      if (!byOrder.has(item.order_id)) byOrder.set(item.order_id, []);
      byOrder.get(item.order_id).push(item);
    });

    state.orders = (orders || []).map((order) => {
      const orderItems = byOrder.get(order.id) || [];

      return {
        ...order,
        type: order.fulfillment_type || "other",
        total_amount: Number(order.total || 0),
        items: orderItems,
        services: orderItems.map((item) =>
          item.services?.name || "Service"
        )
      };
    });

    updateMetrics();
    renderOrders();

    const requestedId = new URLSearchParams(location.search).get("id");
    if (requestedId && state.orders.some((order) => order.id === requestedId)) {
      openOrderDetail(requestedId);
    }
  }

  function getFilteredOrders() {
    const search = getValue("order-search").toLowerCase();
    const status = getValue("order-status-filter") || "all";

    return state.orders.filter((order) => {
      const orderNumber = String(order.order_number || order.id || "").toLowerCase();
      const serviceText = getOrderServiceText(order).toLowerCase();
      const orderType = String(order.type || "").toLowerCase();
      const orderStatus = String(order.status || "").toLowerCase();

      return (
        (!search || orderNumber.includes(search) || serviceText.includes(search)) &&
        (status === "all" || orderStatus === status) &&
        (state.activeType === "all" || orderType === state.activeType)
      );
    });
  }

  function renderOrders(loadError) {
    const tbody = $("orders-table-body");
    if (!tbody) return;

    if (loadError) {
      tbody.innerHTML = `
        <tr class="orders-empty-row">
          <td colspan="6">
            <div class="orders-empty-state">
              <h3>Unable to load orders</h3>
              <p>${escapeHtml(loadError.message || "Please refresh and try again.")}</p>
            </div>
          </td>
        </tr>`;
      return;
    }

    const orders = getFilteredOrders();

    if (!orders.length) {
      tbody.innerHTML = `
        <tr class="orders-empty-row">
          <td colspan="6">
            <div class="orders-empty-state">
              <div class="orders-empty-icon">□</div>
              <h3>${state.orders.length ? "No orders match your filters" : "Your orders will appear here"}</h3>
              <p>${state.orders.length ? "Try changing your search, status, or order type." : "Completed prepaid orders will appear here after payment is confirmed."}</p>
              ${state.orders.length ? "" : '<a href="employer-catalog.html" class="orders-secondary-btn">Browse Services</a>'}
            </div>
          </td>
        </tr>`;
      return;
    }

    tbody.innerHTML = orders.map((order) => {
      const paymentStatus = String(order.payment_status || "unpaid").toLowerCase();

      return `
        <tr>
          <td>
            <span class="order-number">${escapeHtml(order.order_number || order.id)}</span>
            <span class="order-id-subtext">${escapeHtml(formatOrderType(order.type))}</span>
          </td>
          <td class="order-services">${escapeHtml(getOrderServiceText(order))}</td>
          <td>${escapeHtml(formatDate(order.created_at))}</td>
          <td><span class="order-status order-status-${escapeAttribute(paymentStatus)}">${escapeHtml(capitalize(paymentStatus))}</span></td>
          <td class="order-total">${escapeHtml(formatCurrency(order.total))}</td>
          <td>
            <button type="button" class="order-view-btn" data-order-id="${escapeAttribute(order.id)}">View</button>
          </td>
        </tr>`;
    }).join("");

    tbody.querySelectorAll("[data-order-id]").forEach((button) => {
      button.addEventListener("click", () => openOrderDetail(button.dataset.orderId));
    });
  }

  function updateMetrics() {
    const totalOrders = state.orders.length;
    const activeOrders = state.orders.filter((order) =>
      ["pending", "processing"].includes(String(order.status || "").toLowerCase())
    ).length;
    const completedOrders = state.orders.filter((order) =>
      String(order.status || "").toLowerCase() === "completed"
    ).length;
    const totalSpend = state.orders.reduce(
      (sum, order) => sum + Number(order.total || 0),
      0
    );

    setText("stat-total-orders", totalOrders || "—");
    setText("stat-active-orders", activeOrders || "—");
    setText("stat-completed-orders", completedOrders || "—");
    setText("stat-total-spend", totalOrders ? formatCurrency(totalSpend) : "—");
  }

  function openOrderDetail(orderId) {
    const order = state.orders.find((item) => String(item.id) === String(orderId));
    if (!order) return;

    const modal = $("order-detail-modal");
    const title = $("order-detail-title");
    const content = $("order-detail-content");

    if (!modal || !content) return;
    if (title) title.textContent = order.order_number || "Order Details";

    const itemHtml = (order.items || []).map((item) => `
      <li>
        <strong>${escapeHtml(item.services?.name || "Service")}</strong>
        <span>Qty ${escapeHtml(item.quantity)} · ${escapeHtml(formatCurrency(item.line_total))}</span>
      </li>
    `).join("");

    content.innerHTML = `
      <div class="order-detail-grid">
        <div class="order-detail-item"><span>Payment Status</span><strong>${escapeHtml(capitalize(order.payment_status || "unpaid"))}</strong></div>
        <div class="order-detail-item"><span>Order Status</span><strong>${escapeHtml(capitalize(order.status || "pending"))}</strong></div>
        <div class="order-detail-item"><span>Order Date</span><strong>${escapeHtml(formatDate(order.created_at))}</strong></div>
        <div class="order-detail-item"><span>Total</span><strong>${escapeHtml(formatCurrency(order.total))}</strong></div>
        <div class="order-detail-item"><span>Tracking Number</span><strong>${escapeHtml(order.tracking_number || "—")}</strong></div>
      </div>

      <div class="order-detail-services">
        <h3>Services</h3>
        <ul>${itemHtml || "<li>Service order</li>"}</ul>
      </div>

      <div class="order-detail-actions">
        <a class="order-view-btn" href="employer-receipt.html?id=${encodeURIComponent(order.id)}">View Receipt</a>
      </div>`;

    modal.hidden = false;
  }

  function closeOrderDetail() {
    const modal = $("order-detail-modal");
    if (modal) modal.hidden = true;
  }

  function getOrderServiceText(order) {
    if (Array.isArray(order.services) && order.services.length) {
      return order.services.join(", ");
    }
    if (order.items?.length) return `${order.items.length} service item(s)`;
    return "Service order";
  }

  function formatOrderType(type) {
    const types = {
      testing: "Testing",
      dot_physical: "DOT Physical",
      background_check: "Background Check",
      workplace: "Workplace",
      mobile_testing: "Mobile Testing",
      training: "Training",
      other: "Service"
    };
    return types[type] || "Service";
  }

  function formatDate(value) {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit"
    }).format(date);
  }

  function formatCurrency(value) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD"
    }).format(Number(value || 0));
  }

  function capitalize(value) {
    const text = String(value || "").replace(/_/g, " ");
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  function bindClick(id, handler) {
    const element = $(id);
    if (element) element.addEventListener("click", handler);
  }

  function getValue(id) {
    const element = $(id);
    return element ? String(element.value || "").trim() : "";
  }

  function setText(id, value) {
    const element = $(id);
    if (element) element.textContent = value == null ? "" : value;
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function escapeAttribute(value) {
    return escapeHtml(value);
  }
})();