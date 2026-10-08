/* ============================================================
   SCREENINGS4U — EMBEDDED EMPLOYER POPUP
   Self-contained: no HTML or extra CSS file required.
   ============================================================ */
(function () {
  "use strict";

  if (window.S4UEmployerPopup) return;

  let activeResolver = null;
  let overlay = null;

  function injectStyles() {
    if (document.getElementById("s4u-employer-popup-styles")) return;

    const style = document.createElement("style");
    style.id = "s4u-employer-popup-styles";
    style.textContent = `
      .s4u-ep[hidden]{display:none!important}
      .s4u-ep{position:fixed;z-index:30000;inset:0;display:grid;place-items:center;padding:20px;opacity:0;transition:opacity .15s ease}
      .s4u-ep.show{opacity:1}
      .s4u-ep-backdrop{position:absolute;inset:0;background:rgba(22,35,53,.52);backdrop-filter:blur(2px)}
      .s4u-ep-card{position:relative;width:min(100%,450px);padding:27px 27px 24px;border:1px solid #dbe4ef;border-radius:18px;background:#fff;box-shadow:0 25px 70px rgba(20,44,77,.28);transform:translateY(8px) scale(.985);transition:transform .15s ease}
      .s4u-ep.show .s4u-ep-card{transform:translateY(0) scale(1)}
      .s4u-ep-close{position:absolute;top:13px;right:13px;display:grid;place-items:center;width:32px;height:32px;padding:0;border:0;border-radius:8px;background:transparent;color:#8793a2;font:inherit;font-size:1.4rem;cursor:pointer}
      .s4u-ep-close:hover{background:#f4f7fb;color:#24467f}
      .s4u-ep-icon{display:grid;place-items:center;width:48px;height:48px;margin-bottom:17px;border-radius:13px;background:rgba(23,61,120,.09);color:#24467f;font-size:1.15rem;font-weight:900}
      .s4u-ep[data-type="success"] .s4u-ep-icon{background:rgba(22,128,77,.10);color:#16804d}
      .s4u-ep[data-type="warning"] .s4u-ep-icon,.s4u-ep[data-type="confirm"] .s4u-ep-icon{background:rgba(240,90,0,.11);color:#f05a00}
      .s4u-ep[data-type="error"] .s4u-ep-icon{background:rgba(179,77,77,.10);color:#b34d4d}
      .s4u-ep-kicker{display:block;margin-bottom:7px;color:#f05a00;font-size:.64rem;font-weight:850;letter-spacing:.11em}
      .s4u-ep-title{margin:0;color:#2f435e;font-size:1.08rem}
      .s4u-ep-message{margin:10px 0 0;color:#6b7b90;font-size:.72rem;line-height:1.65;white-space:pre-line}
      .s4u-ep-actions{display:flex;justify-content:flex-end;gap:9px;margin-top:24px}
      .s4u-ep-btn{min-height:40px;padding:0 16px;border-radius:8px;font:inherit;font-size:.66rem;font-weight:800;cursor:pointer}
      .s4u-ep-cancel{border:1px solid #d8e1eb;background:#fff;color:#68778a}
      .s4u-ep-ok{border:1px solid #24467f;background:#24467f;color:#fff}
      .s4u-ep[data-type="warning"] .s4u-ep-ok,.s4u-ep[data-type="confirm"] .s4u-ep-ok{border-color:#f05a00;background:#f05a00}
      .s4u-ep[data-type="error"] .s4u-ep-ok{border-color:#b34d4d;background:#b34d4d}
      body.s4u-ep-open{overflow:hidden}
      @media(max-width:520px){
        .s4u-ep{padding:16px}
        .s4u-ep-card{padding:24px 20px 20px}
        .s4u-ep-actions{flex-direction:column-reverse}
        .s4u-ep-btn{width:100%}
      }
    `;
    document.head.appendChild(style);
  }

  function ensureOverlay() {
    injectStyles();
    if (overlay) return overlay;

    overlay = document.createElement("div");
    overlay.className = "s4u-ep";
    overlay.hidden = true;
    overlay.innerHTML = `
      <div class="s4u-ep-backdrop" data-s4u-ep-close></div>
      <section class="s4u-ep-card" role="dialog" aria-modal="true" aria-labelledby="s4u-ep-title">
        <button class="s4u-ep-close" type="button" aria-label="Close" data-s4u-ep-close>×</button>
        <div class="s4u-ep-icon" id="s4u-ep-icon">i</div>
        <span class="s4u-ep-kicker" id="s4u-ep-kicker">SCREENINGS4U</span>
        <h2 class="s4u-ep-title" id="s4u-ep-title">Notice</h2>
        <p class="s4u-ep-message" id="s4u-ep-message"></p>
        <div class="s4u-ep-actions">
          <button class="s4u-ep-btn s4u-ep-cancel" type="button" id="s4u-ep-cancel">Cancel</button>
          <button class="s4u-ep-btn s4u-ep-ok" type="button" id="s4u-ep-ok">OK</button>
        </div>
      </section>
    `;
    document.body.appendChild(overlay);

    overlay.querySelectorAll("[data-s4u-ep-close]").forEach(el => {
      el.addEventListener("click", () => finish(false));
    });

    overlay.querySelector("#s4u-ep-cancel").addEventListener("click", () => finish(false));
    overlay.querySelector("#s4u-ep-ok").addEventListener("click", () => finish(true));

    document.addEventListener("keydown", event => {
      if (!overlay || overlay.hidden) return;
      if (event.key === "Escape") finish(false);
    });

    return overlay;
  }

  function finish(value) {
    if (!overlay || overlay.hidden) return;

    overlay.classList.remove("show");
    document.body.classList.remove("s4u-ep-open");

    setTimeout(() => {
      if (!overlay) return;
      overlay.hidden = true;

      const resolve = activeResolver;
      activeResolver = null;
      if (resolve) resolve(Boolean(value));
    }, 150);
  }

  function show(message, options = {}) {
    const root = ensureOverlay();
    const type = String(options.type || "info").toLowerCase();

    const defaults = {
      info:    { icon: "i", kicker: "SCREENINGS4U", title: "Notice" },
      success: { icon: "✓", kicker: "SUCCESS", title: "Success" },
      warning: { icon: "!", kicker: "ATTENTION", title: "Attention" },
      error:   { icon: "!", kicker: "SCREENINGS4U", title: "Unable to Complete" },
      confirm: { icon: "?", kicker: "CONFIRM ACTION", title: "Please Confirm" }
    };

    const d = defaults[type] || defaults.info;

    root.dataset.type = type;
    root.querySelector("#s4u-ep-icon").textContent = options.icon || d.icon;
    root.querySelector("#s4u-ep-kicker").textContent = options.kicker || d.kicker;
    root.querySelector("#s4u-ep-title").textContent = options.title || d.title;
    root.querySelector("#s4u-ep-message").textContent = String(message || "");

    const cancel = root.querySelector("#s4u-ep-cancel");
    const ok = root.querySelector("#s4u-ep-ok");

    cancel.hidden = !options.showCancel;
    cancel.textContent = options.cancelText || "Cancel";
    ok.textContent = options.confirmText || "OK";

    root.hidden = false;
    document.body.classList.add("s4u-ep-open");

    requestAnimationFrame(() => {
      root.classList.add("show");
      ok.focus();
    });

    return new Promise(resolve => {
      activeResolver = resolve;
    });
  }

  window.S4UEmployerPopup = {
    show,
    info(message, options = {}) {
      return show(message, { ...options, type: "info" });
    },
    success(message, options = {}) {
      return show(message, { ...options, type: "success" });
    },
    warning(message, options = {}) {
      return show(message, { ...options, type: "warning" });
    },
    error(message, options = {}) {
      return show(message, { ...options, type: "error" });
    },
    confirm(message, options = {}) {
      return show(message, {
        ...options,
        type: "confirm",
        showCancel: true,
        confirmText: options.confirmText || "Confirm",
        cancelText: options.cancelText || "Cancel"
      });
    }
  };
})();


/* ============================================================
   SCREENINGS4U — EMPLOYER SERVICE CATALOG
   Live services + employer cart + secure employer checkout
   ============================================================ */
(function () {
  "use strict";

  const CART_KEY = "s4u_employer_market_cart";
  const state = {
    db: null,
    products: [],
    cart: loadCart(),
    category: "all"
  };

  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    bindEvents();
    renderCart();

    try {
      state.db = await getScreenings4uSupabase();
      await loadCatalog();
    } catch (error) {
      console.error("[Employer Catalog]", error);
      showCatalogError(error?.message || "Unable to load the service catalog.");
    }
  }

  function bindEvents() {
    document.querySelectorAll(".catalog-category").forEach(function (button) {
      button.addEventListener("click", function () {
        state.category = button.dataset.category || "all";
        document.querySelectorAll(".catalog-category").forEach(function (item) {
          item.classList.toggle("active", item === button);
        });
        renderCatalog();
      });
    });

    document.getElementById("catalog-search")?.addEventListener("input", renderCatalog);
    document.getElementById("catalog-sort")?.addEventListener("change", renderCatalog);
    document.getElementById("catalog-cart-button")?.addEventListener("click", openCart);
    document.getElementById("catalog-close-cart")?.addEventListener("click", closeCart);
    document.getElementById("catalog-cart-overlay")?.addEventListener("click", closeCart);
    document.getElementById("catalog-checkout-button")?.addEventListener("click", beginCheckout);

    document.getElementById("catalog-request-help")?.addEventListener("click", function () {
      location.href = "employer-support.html?topic=catalog";
    });

    document.querySelectorAll("[data-close-catalog-modal]").forEach(function (button) {
      button.addEventListener("click", closeServiceModal);
    });
  }

  async function call(action, payload) {
    const { data, error } = await state.db.functions.invoke("employer-marketplace-actions", {
      body: Object.assign({ action: action }, payload || {})
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data;
  }

  async function loadCatalog() {
    const data = await call("catalog");
    state.products = (data.services || []).map(function (service) {
      return {
        id: service.id,
        sku: service.sku,
        name: service.name,
        description: service.description || "",
        category: categoryFor(service),
        price: service.price ? Number(service.price.amount) : null,
        currency: service.price?.currency || "USD",
        price_note: service.price ? "One-time purchase" : "Custom pricing",
        featured: Boolean(service.metadata?.featured),
        training_course_id: service.training_course_id || null,
        type: service.product_type || "service",
        purchasable: Boolean(service.price && Number(service.price.amount) > 0)
      };
    });

    // Remove cart entries for services that no longer exist.
    state.cart = state.cart.filter(function (item) {
      return state.products.some(function (p) { return p.id === item.service_id; });
    });
    saveCart();
    renderCatalog();
    renderCart();
  }

  function categoryFor(service) {
    const text = [service.name, service.sku, service.slug, service.product_type]
      .join(" ").toLowerCase();

    if (service.product_type === "course" || service.product_type === "training") return "training";
    if (text.includes("background")) return "background-checks";
    if (text.includes("alcohol") || text.includes("breath") || text.includes("etg")) return "alcohol-testing";
    if (text.includes("dot")) return "dot-services";
    if (text.includes("drug") || text.includes("urine") || text.includes("hair") || text.includes("oral")) return "drug-testing";
    return "workplace-services";
  }

  function getFilteredProducts() {
    const search = String(document.getElementById("catalog-search")?.value || "").trim().toLowerCase();
    const sort = document.getElementById("catalog-sort")?.value || "featured";

    const products = state.products.filter(function (product) {
      const categoryMatch = state.category === "all" || product.category === state.category;
      const haystack = [product.name, product.description, product.sku, product.category].join(" ").toLowerCase();
      return categoryMatch && (!search || haystack.includes(search));
    });

    products.sort(function (a, b) {
      if (sort === "name") return String(a.name || "").localeCompare(String(b.name || ""));
      if (sort === "price-low") return sortablePrice(a) - sortablePrice(b);
      if (sort === "price-high") return sortablePrice(b) - sortablePrice(a);
      return Number(Boolean(b.featured)) - Number(Boolean(a.featured)) ||
        String(a.name || "").localeCompare(String(b.name || ""));
    });

    return products;
  }

  function sortablePrice(product) {
    return product.purchasable ? Number(product.price) : Number.MAX_SAFE_INTEGER;
  }

  function renderCatalog() {
    const grid = document.getElementById("catalog-grid");
    const title = document.getElementById("catalog-section-title");
    const count = document.getElementById("catalog-result-count");
    if (!grid) return;

    const products = getFilteredProducts();
    if (title) title.textContent = categoryTitle(state.category);
    if (count) count.textContent = products.length + (products.length === 1 ? " service" : " services");

    if (!products.length) {
      grid.innerHTML = `<div class="catalog-empty"><div class="catalog-empty-icon">+</div><h3>No services found</h3><p>Try a different search or category.</p></div>`;
      return;
    }

    grid.innerHTML = products.map(function (product) {
      const action = product.purchasable
        ? `<button class="catalog-add-btn" data-product-add="${escapeAttribute(product.id)}" type="button">Add</button>`
        : `<button class="catalog-add-btn" data-product-quote="${escapeAttribute(product.sku || product.id)}" type="button">Request Pricing</button>`;

      return `
        <article class="catalog-card">
          <div class="catalog-card-top">
            <span class="catalog-card-category">${escapeHtml(categoryTitle(product.category))}</span>
          </div>
          <div class="catalog-card-body">
            <h3>${escapeHtml(product.name || "Service")}</h3>
            <p>${escapeHtml(product.description || "Professional Screenings4u service.")}</p>
            <div class="catalog-card-bottom">
              <div class="catalog-price">
                ${product.purchasable ? escapeHtml(formatPrice(product.price, product.currency)) : "Custom"}
                <span class="catalog-price-note">${escapeHtml(product.price_note)}</span>
              </div>
              <div class="catalog-card-actions">
                <button class="catalog-details-btn" data-product-details="${escapeAttribute(product.id)}" type="button">Details</button>
                ${action}
              </div>
            </div>
          </div>
        </article>`;
    }).join("");

    grid.querySelectorAll("[data-product-details]").forEach(function (button) {
      button.addEventListener("click", function () { openServiceModal(button.dataset.productDetails); });
    });
    grid.querySelectorAll("[data-product-add]").forEach(function (button) {
      button.addEventListener("click", function () { addToCart(button.dataset.productAdd); });
    });
    grid.querySelectorAll("[data-product-quote]").forEach(function (button) {
      button.addEventListener("click", function () {
        location.href = "employer-support.html?service=" + encodeURIComponent(button.dataset.productQuote);
      });
    });
  }

  function addToCart(productId) {
    const product = state.products.find(function (item) { return String(item.id) === String(productId); });
    if (!product || !product.purchasable) return;

    const existing = state.cart.find(function (item) { return item.service_id === product.id; });
    if (existing) existing.quantity += 1;
    else state.cart.push({ service_id: product.id, quantity: 1 });

    saveCart();
    renderCart();
    openCart();
  }

  function changeQuantity(serviceId, delta) {
    const item = state.cart.find(function (x) { return x.service_id === serviceId; });
    if (!item) return;
    item.quantity += delta;
    if (item.quantity <= 0) state.cart = state.cart.filter(function (x) { return x !== item; });
    saveCart();
    renderCart();
  }

  function removeFromCart(serviceId) {
    state.cart = state.cart.filter(function (item) { return item.service_id !== serviceId; });
    saveCart();
    renderCart();
  }

  function renderCart() {
    const items = document.getElementById("catalog-cart-items");
    const total = document.getElementById("catalog-cart-total");
    const badge = document.getElementById("catalog-cart-count");
    const checkout = document.getElementById("catalog-checkout-button");

    const count = state.cart.reduce(function (sum, item) { return sum + Number(item.quantity || 0); }, 0);
    if (badge) badge.textContent = count;

    let amount = 0;
    const rows = state.cart.map(function (item) {
      const product = state.products.find(function (x) { return x.id === item.service_id; });
      if (!product) return "";
      const lineTotal = Number(product.price || 0) * Number(item.quantity || 1);
      amount += lineTotal;
      return `
        <div class="catalog-cart-item">
          <div>
            <strong>${escapeHtml(product.name)}</strong>
            <span class="catalog-cart-item-price">${escapeHtml(formatPrice(lineTotal, product.currency))}</span>
            <div class="catalog-cart-qty">
              <button data-cart-minus="${escapeAttribute(product.id)}" type="button">−</button>
              <span>${Number(item.quantity || 1)}</span>
              <button data-cart-plus="${escapeAttribute(product.id)}" type="button">+</button>
            </div>
          </div>
          <button class="catalog-remove-btn" data-cart-remove="${escapeAttribute(product.id)}" type="button">Remove</button>
        </div>`;
    }).join("");

    if (total) total.textContent = formatPrice(amount);
    if (checkout) checkout.disabled = !count;
    if (!items) return;
    items.innerHTML = rows || `<div class="catalog-cart-empty">Your cart is empty.</div>`;

    items.querySelectorAll("[data-cart-plus]").forEach(function (button) {
      button.addEventListener("click", function () { changeQuantity(button.dataset.cartPlus, 1); });
    });
    items.querySelectorAll("[data-cart-minus]").forEach(function (button) {
      button.addEventListener("click", function () { changeQuantity(button.dataset.cartMinus, -1); });
    });
    items.querySelectorAll("[data-cart-remove]").forEach(function (button) {
      button.addEventListener("click", function () { removeFromCart(button.dataset.cartRemove); });
    });
  }

  function saveCart() {
    localStorage.setItem(CART_KEY, JSON.stringify(state.cart));
  }

  function loadCart() {
    try {
      const parsed = JSON.parse(localStorage.getItem(CART_KEY) || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return [];
    }
  }

  function beginCheckout() {
    if (!state.cart.length) {
      window.S4UEmployerPopup.info("Your cart is empty.", { title: "Nothing to Checkout" });
      return;
    }
    location.href = "employer-checkout.html";
  }

  function openCart() {
    document.getElementById("catalog-cart-drawer")?.classList.add("is-open");
    document.getElementById("catalog-cart-overlay")?.classList.add("is-open");
    document.getElementById("catalog-cart-drawer")?.setAttribute("aria-hidden", "false");
  }

  function closeCart() {
    document.getElementById("catalog-cart-drawer")?.classList.remove("is-open");
    document.getElementById("catalog-cart-overlay")?.classList.remove("is-open");
    document.getElementById("catalog-cart-drawer")?.setAttribute("aria-hidden", "true");
  }

  function openServiceModal(productId) {
    const product = state.products.find(function (item) { return String(item.id) === String(productId); });
    if (!product) return;

    const modal = document.getElementById("catalog-service-modal");
    const content = document.getElementById("catalog-modal-content");
    if (!modal || !content) return;

    content.innerHTML = `
      <span class="catalog-modal-category">${escapeHtml(categoryTitle(product.category))}</span>
      <h2>${escapeHtml(product.name || "Service")}</h2>
      <p class="catalog-modal-description">${escapeHtml(product.description || "Additional service information will be provided during the purchase process.")}</p>
      <div class="catalog-modal-meta">
        <div><span>Price</span><strong>${product.purchasable ? escapeHtml(formatPrice(product.price, product.currency)) : "Custom Pricing"}</strong></div>
        <div><span>Purchase Type</span><strong>${escapeHtml(product.type || "Service")}</strong></div>
      </div>
      <div class="catalog-modal-actions">
        <button class="catalog-details-btn" data-close-catalog-modal type="button">Close</button>
        ${product.purchasable
          ? `<button class="catalog-add-btn" id="catalog-modal-add" type="button">Add to Cart</button>`
          : `<button class="catalog-add-btn" id="catalog-modal-quote" type="button">Request Pricing</button>`}
      </div>`;

    content.querySelector("[data-close-catalog-modal]")?.addEventListener("click", closeServiceModal);
    content.querySelector("#catalog-modal-add")?.addEventListener("click", function () {
      addToCart(product.id);
      closeServiceModal();
    });
    content.querySelector("#catalog-modal-quote")?.addEventListener("click", function () {
      location.href = "employer-support.html?service=" + encodeURIComponent(product.sku || product.id);
    });

    modal.hidden = false;
  }

  function closeServiceModal() {
    const modal = document.getElementById("catalog-service-modal");
    if (modal) modal.hidden = true;
  }

  function showCatalogError(message) {
    const grid = document.getElementById("catalog-grid");
    if (!grid) return;
    grid.innerHTML = `<div class="catalog-empty"><div class="catalog-empty-icon">!</div><h3>Unable to load services</h3><p>${escapeHtml(message)}</p></div>`;
  }

  function categoryTitle(category) {
    const labels = {
      all: "All Services",
      "drug-testing": "Drug Testing",
      "alcohol-testing": "Alcohol Testing",
      "background-checks": "Background Checks",
      "dot-services": "DOT Services",
      training: "Training",
      "workplace-services": "Workplace Services"
    };
    return labels[category] || "Services";
  }

  function formatPrice(value, currency) {
    const number = Number(value);
    if (!Number.isFinite(number)) return "Custom";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD"
    }).format(number);
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function escapeAttribute(value) { return escapeHtml(value); }
})();