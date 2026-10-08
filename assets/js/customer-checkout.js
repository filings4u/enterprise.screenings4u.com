(() => {
  "use strict";

  const STRIPE_PUBLISHABLE_KEY = "pk_live_51U8CQJEHE8bc4Otur9RVR1HsajJbmSbmRr5z0jGw1v5jgrKrzmnaaRTIV5v5CbEZIwFJLujrU0AI3lOZFDaNg4CG005XAPqkx3";
  const $ = (id) => document.getElementById(id);

  let db = null;
  let stripe = null;
  let elements = null;
  let order = null;

  const cart = JSON.parse(
    localStorage.getItem("s4u_market_cart") || "[]"
  );

  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    try {
      if (!cart.length) {
        location.replace("customer-catalog.html");
        return;
      }

      if (typeof window.Stripe !== "function") {
        throw new Error("Stripe.js did not load.");
      }

      db = await getScreenings4uSupabase();

      const catalog = await call("catalog");

      const serviceMap = new Map(
        (catalog.services || []).map((service) => [
          service.id,
          service
        ])
      );

      renderSummary(serviceMap);

      order = await call("prepare_checkout", {
        items: cart
      });

      if (!order || !order.clientSecret) {
        throw new Error(
          "Checkout did not return a Stripe client secret."
        );
      }

      stripe = window.Stripe(STRIPE_PUBLISHABLE_KEY);

      elements = stripe.elements({
        clientSecret: order.clientSecret,
        appearance: {
          theme: "stripe"
        }
      });

      const paymentElement = elements.create("payment");

      paymentElement.on("ready", () => {
        const payButton = $("pay-button");
        payButton.disabled = false;
        payButton.textContent =
          `Pay ${money(Number(order.amount || 0) / 100)}`;
      });

      paymentElement.on("loaderror", (event) => {
        console.error("[Stripe loaderror]", event);
        showError(
          event?.error?.message ||
          "Stripe payment form could not load."
        );
      });

      paymentElement.mount("#payment-element");

      $("pay-button").addEventListener("click", pay);

    } catch (error) {
      console.error("[Customer Checkout Init]", error);
      showError(error);
    }
  }

  function renderSummary(serviceMap) {
    $("checkout-items").innerHTML = cart
      .map((item) => {
        const service = serviceMap.get(item.service_id);
        if (!service) return "";

        const quantity = Number(item.quantity || 1);
        const unit = Number(service.price?.amount || 0);

        return `
          <div class="summary-line">
            <div>
              <strong>${escapeHtml(service.name)}</strong>
              <br>
              <small>Qty ${quantity}</small>
            </div>
            <span>${money(unit * quantity)}</span>
          </div>
        `;
      })
      .join("");

    const total = cart.reduce((sum, item) => {
      const service = serviceMap.get(item.service_id);
      return (
        sum +
        Number(service?.price?.amount || 0) *
        Number(item.quantity || 1)
      );
    }, 0);

    $("checkout-total").textContent = money(total);
  }

  async function call(action, payload = {}) {
    const {
      data: { session },
      error: sessionError
    } = await db.auth.getSession();

    if (sessionError) throw sessionError;

    if (!session?.access_token) {
      throw new Error(
        "Your login session expired. Please sign in again."
      );
    }

    const { data, error } =
      await db.functions.invoke(
        "customer-marketplace-actions",
        {
          headers: {
            Authorization:
              `Bearer ${session.access_token}`
          },
          body: {
            action,
            ...payload
          }
        }
      );

    if (error) {
      console.error(
        `[customer-marketplace-actions:${action}]`,
        error
      );
      throw error;
    }

    if (data?.error) {
      throw new Error(data.error);
    }

    return data;
  }

  async function pay() {
    const button = $("pay-button");

    button.disabled = true;
    button.textContent = "Processing...";
    hideError();

    try {
      const { error: submitError } =
        await elements.submit();

      if (submitError) {
        throw submitError;
      }

      const { error } =
        await stripe.confirmPayment({
          elements,
          clientSecret: order.clientSecret,
          confirmParams: {
            return_url:
              new URL(
                `customer-orders.html?id=${
                  encodeURIComponent(order.orderId)
                }`,
                location.href
              ).href
          },
          redirect: "if_required"
        });

      if (error) {
        throw error;
      }

      localStorage.removeItem("s4u_market_cart");

      $("checkout-success").hidden = false;
      button.hidden = true;

      window.setTimeout(() => {
        location.href =
          `customer-orders.html?id=${
            encodeURIComponent(order.orderId)
          }`;
      }, 1400);

    } catch (error) {
      console.error("[Customer Checkout Payment]", error);
      showError(error);

      button.disabled = false;
      button.textContent =
        `Pay ${money(Number(order?.amount || 0) / 100)}`;
    }
  }

  function showError(error) {
    const box = $("checkout-error");
    if (!box) return;

    box.hidden = false;
    box.textContent =
      error?.message ||
      String(error || "Unable to complete checkout.");
  }

  function hideError() {
    const box = $("checkout-error");
    if (!box) return;

    box.hidden = true;
    box.textContent = "";
  }

  function money(value) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD"
    }).format(Number(value || 0));
  }

  function escapeHtml(value) {
    const element = document.createElement("div");
    element.textContent = String(value ?? "");
    return element.innerHTML;
  }
})();