/* ============================================================
   SCREENINGS4U
   CUSTOMER PORTAL SHELL
   customer-portal.js
   ============================================================ */

(function () {
  "use strict";

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeCustomerPortal, { once: true });
  } else {
    initializeCustomerPortal();
  }

  /* ==========================================================
     INITIALIZE
     ========================================================== */

  function initializeCustomerPortal() {
    injectCustomerSidebar();
    injectCustomerHeader();
    injectSidebarReopenButton();
    injectMobileDropdownNavigation();

    setActiveNavigation();
    initializeSidebarControls();
    initializeNavigationAccordion();
    initializeMobileNavigation();
    initializeAccountMenu();
    initializeNotificationButton();
    initializeSignOutButtons();
    initializeTrainingNavigation();

    applyPageMetadata();
  }


  /* ==========================================================
     SIDEBAR
     ========================================================== */

  function injectCustomerSidebar() {
    const sidebarTarget = document.getElementById(
      "customer-portal-sidebar"
    );

    if (!sidebarTarget) {
      return;
    }

    sidebarTarget.innerHTML = getSidebarMarkup();
  }


  function getSidebarMarkup() {
    return `
      <aside
        class="customer-sidebar"
        id="customer-sidebar"
        aria-label="Customer portal navigation"
      >
        <div class="customer-sidebar-inner">

          <!-- =================================================
               BRAND
               ================================================= -->

          <div class="customer-sidebar-brand">

            <a
              href="customer-dashboard.html"
              class="customer-sidebar-logo-link"
              aria-label="Screenings4u Customer Portal"
            >
              <img
                src="images/logo.png"
                alt="screenings4u"
                class="customer-sidebar-logo"
              />

              <div class="customer-sidebar-brand-copy">
                <span class="customer-sidebar-brand-label">
                  Customer Portal
                </span>
              </div>
            </a>


            <button
              type="button"
              class="customer-sidebar-collapse"
              id="customer-sidebar-collapse"
              aria-label="Collapse sidebar"
              title="Collapse sidebar"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M15 18l-6-6 6-6"></path>
              </svg>
            </button>

          </div>


          <div class="customer-sidebar-scroll">

            <!-- OVERVIEW -->

            <div class="customer-nav-group">

              <span class="customer-nav-label">
                Overview
              </span>

              <nav class="customer-nav">

                <!-- WELCOME -->

                <a
                  href="customer-welcome.html"
                  class="customer-nav-link"
                  data-customer-page="customer-welcome.html"
                >
                  <span class="customer-nav-icon">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M3 11.5 12 4l9 7.5"></path>
                      <path d="M5.5 10.5V20h13v-9.5"></path>
                      <path d="M9 20v-6h6v6"></path>
                    </svg>
                  </span>

                  <span class="customer-nav-text">
                    Welcome
                  </span>
                </a>


                <!-- DASHBOARD -->

                <a
                  href="customer-dashboard.html"
                  class="customer-nav-link"
                  data-customer-page="customer-dashboard.html"
                >
                  <span class="customer-nav-icon">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <rect
                        x="3"
                        y="3"
                        width="7"
                        height="7"
                        rx="1"
                      ></rect>

                      <rect
                        x="14"
                        y="3"
                        width="7"
                        height="7"
                        rx="1"
                      ></rect>

                      <rect
                        x="3"
                        y="14"
                        width="7"
                        height="7"
                        rx="1"
                      ></rect>

                      <rect
                        x="14"
                        y="14"
                        width="7"
                        height="7"
                        rx="1"
                      ></rect>
                    </svg>
                  </span>

                  <span class="customer-nav-text">
                    Dashboard
                  </span>
                </a>


              </nav>

            </div>


            <!-- MY SERVICES -->

            <div class="customer-nav-group">

              <span class="customer-nav-label">
                My Services
              </span>

              <nav class="customer-nav">


                <!-- ORDERS -->

                <a
                  href="customer-orders.html"
                  class="customer-nav-link"
                  data-customer-page="customer-orders.html"
                >
                  <span class="customer-nav-icon">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M6 3h12"></path>
                      <path d="M6 7h12"></path>
                      <path d="M6 11h12"></path>
                      <path d="M6 15h8"></path>
                      <path d="M4 3h.01"></path>
                      <path d="M4 7h.01"></path>
                      <path d="M4 11h.01"></path>
                      <path d="M4 15h.01"></path>
                    </svg>
                  </span>

                  <span class="customer-nav-text">
                    Orders
                  </span>
                </a>


                <!-- RESULTS -->

                <a
                  href="customer-results.html"
                  class="customer-nav-link"
                  data-customer-page="customer-results.html"
                >
                  <span class="customer-nav-icon">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M7 3h7l4 4v14H7z"></path>
                      <path d="M14 3v5h5"></path>
                      <path d="M9 13l2 2 4-4"></path>
                    </svg>
                  </span>

                  <span class="customer-nav-text">
                    Results
                  </span>
                </a>


                <!-- DONOR PASS -->

                <a
                  href="customer-donor-pass.html"
                  class="customer-nav-link"
                  data-customer-page="customer-donor-pass.html"
                >
                  <span class="customer-nav-icon">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <rect
                        x="3"
                        y="5"
                        width="18"
                        height="14"
                        rx="2"
                      ></rect>

                      <circle
                        cx="8"
                        cy="12"
                        r="2"
                      ></circle>

                      <path d="M13 10h5"></path>
                      <path d="M13 14h5"></path>
                    </svg>
                  </span>

                  <span class="customer-nav-text">
                    Donor Pass
                  </span>
                </a>


                <!-- NOTIFICATIONS -->

                <a
                  href="customer-notifications.html"
                  class="customer-nav-link"
                  data-customer-page="customer-notifications.html"
                >
                  <span class="customer-nav-icon">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"></path>
                      <path d="M10 21h4"></path>
                    </svg>
                  </span>

                  <span class="customer-nav-text">
                    Notifications
                  </span>

                  <span
                    class="customer-nav-badge"
                    id="customer-notification-count"
                    style="display: none;"
                  >
                    0
                  </span>
                </a>

              </nav>

            </div>


            <!-- PURCHASE -->

            <div class="customer-nav-group">

              <span class="customer-nav-label">
                Purchase
              </span>

              <nav class="customer-nav">

                <a
                  href="customer-catalog.html"
                  class="customer-nav-link"
                  data-customer-page="customer-catalog.html"
                >
                  <span class="customer-nav-icon">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <circle cx="9" cy="20" r="1"></circle>
                      <circle cx="20" cy="20" r="1"></circle>
                      <path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h7.8a2 2 0 0 0 1.9-1.4L22 6H6"></path>
                    </svg>
                  </span>

                  <span class="customer-nav-text">
                    Service Catalog
                  </span>
                </a>

              </nav>

            </div>


            <!-- ACCOUNT -->

            <div class="customer-nav-group">

              <span class="customer-nav-label">
                Account
              </span>

              <nav class="customer-nav">


                <!-- BILLING -->

                <a
                  href="customer-billing.html"
                  class="customer-nav-link"
                  data-customer-page="customer-billing.html"
                >
                  <span class="customer-nav-icon">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <rect
                        x="3"
                        y="5"
                        width="18"
                        height="14"
                        rx="2"
                      ></rect>

                      <path d="M3 10h18"></path>
                      <path d="M7 15h2"></path>
                    </svg>
                  </span>

                  <span class="customer-nav-text">
                    Billing &amp; Receipts
                  </span>
                </a>


                <!-- ACCOUNT -->

                <a
                  href="customer-account.html"
                  class="customer-nav-link"
                  data-customer-page="customer-account.html"
                >
                  <span class="customer-nav-icon">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <circle
                        cx="12"
                        cy="8"
                        r="4"
                      ></circle>

                      <path d="M4 21c.8-4 3.4-6 8-6s7.2 2 8 6"></path>
                    </svg>
                  </span>

                  <span class="customer-nav-text">
                    My Account
                  </span>
                </a>

              </nav>

            </div>

            <!-- TRAINING — shown only after a qualifying purchase -->

            <div class="customer-nav-group" id="customer-training-group" hidden style="display:none;">

              <span class="customer-nav-label">
                Training
              </span>

              <nav class="customer-nav">

                 <a
                  href="https://training.screenings4u.com"
                  class="customer-nav-link"
                  id="customer-training-link"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <span class="customer-nav-icon">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <circle
                        cx="12"
                        cy="8"
                        r="4"
                      ></circle>

                      <path d="M4 21c.8-4 3.4-6 8-6s7.2 2 8 6"></path>
                    </svg>
                  </span>

                  <span class="customer-nav-text">
                    Training Center
                  </span>
                </a>

              </nav>

            </div>

          </div>


          <!-- =================================================
               SIDEBAR FOOTER
               ================================================= -->

          <div class="customer-sidebar-footer">

            <div class="customer-sidebar-footer-links">


              <!-- BACK TO MAIN WEBSITE -->

              <a
                href="https://screenings4u.com"
                class="customer-footer-link"
              >
                <span class="customer-footer-icon">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M19 12H5"></path>
                    <path d="m12 19-7-7 7-7"></path>
                  </svg>
                </span>

                <span class="customer-footer-text">
                  Back to Screenings4u
                </span>
              </a>


              <!-- SIGN OUT -->

              <button
                type="button"
                class="customer-footer-link sign-out"
                data-customer-sign-out
              >
                <span class="customer-footer-icon">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M10 17l5-5-5-5"></path>
                    <path d="M15 12H3"></path>
                    <path d="M21 19V5a2 2 0 0 0-2-2h-6"></path>
                  </svg>
                </span>

                <span class="customer-footer-text">
                  Sign Out
                </span>
              </button>

            </div>

          </div>

        </div>
      </aside>


      <!-- MOBILE OVERLAY -->

      <div
        class="customer-sidebar-overlay"
        id="customer-sidebar-overlay"
        aria-hidden="true"
      ></div>
    `;
  }


  /* ==========================================================
     HEADER
     ========================================================== */

  function injectCustomerHeader() {
    const headerTarget = document.getElementById(
      "customer-portal-header"
    );

    if (!headerTarget) {
      return;
    }

    const pageTitle =
      document.body.getAttribute("data-page-title") ||
      "Customer Portal";

    const pageSubtitle =
      document.body.getAttribute("data-page-subtitle") ||
      "Manage your Screenings4u services and account.";

    headerTarget.className = "customer-portal-header";

    headerTarget.innerHTML = `
      <div class="customer-header-left">

        <!-- MOBILE MENU -->

        <button
          type="button"
          class="customer-mobile-menu"
          id="customer-mobile-menu"
          aria-label="Open navigation"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 7h16"></path>
            <path d="M4 12h16"></path>
            <path d="M4 17h16"></path>
          </svg>
        </button>


        <!-- PAGE TITLE -->

        <div class="customer-header-title-wrap">

          <h1 class="customer-header-title">
            ${escapeHtml(pageTitle)}
          </h1>

          <p class="customer-header-subtitle">
            ${escapeHtml(pageSubtitle)}
          </p>

        </div>

      </div>


      <div class="customer-header-right">

        <!-- NOTIFICATIONS -->

        <button
          type="button"
          class="customer-header-icon-button"
          id="customer-header-notifications"
          aria-label="View notifications"
          title="Notifications"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"></path>
            <path d="M10 21h4"></path>
          </svg>

          <span
            class="customer-notification-indicator"
            id="customer-header-notification-indicator"
            style="display: none;"
          ></span>
        </button>


        <!-- ACCOUNT MENU -->

        <div
          class="customer-account-menu"
          id="customer-account-menu"
        >

          <button
            type="button"
            class="customer-account-trigger"
            id="customer-account-trigger"
            aria-haspopup="true"
            aria-expanded="false"
          >

            <span
              class="customer-account-avatar"
              id="customer-account-avatar"
            >
              CU
            </span>


            <span class="customer-account-copy">

              <span
                class="customer-account-name"
                id="customer-account-name"
              ></span>

              <span class="customer-account-role">
                Customer Account
              </span>

            </span>


            <svg
              class="customer-account-chevron"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path d="m6 9 6 6 6-6"></path>
            </svg>

          </button>


          <!-- ACCOUNT DROPDOWN -->

          <div
            class="customer-account-dropdown"
            id="customer-account-dropdown"
          >

            <div class="customer-account-dropdown-user">

              <span
                class="customer-dropdown-name"
                id="customer-dropdown-name"
              ></span>

              <span
                class="customer-dropdown-email"
                id="customer-dropdown-email"
              ></span>

            </div>


            <div class="customer-dropdown-links">

              <a
                href="customer-account.html"
                class="customer-dropdown-link"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <circle
                    cx="12"
                    cy="8"
                    r="4"
                  ></circle>

                  <path d="M4 21c.8-4 3.4-6 8-6s7.2 2 8 6"></path>
                </svg>

                My Account
              </a>


              <a
                href="customer-billing.html"
                class="customer-dropdown-link"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <rect
                    x="3"
                    y="5"
                    width="18"
                    height="14"
                    rx="2"
                  ></rect>

                  <path d="M3 10h18"></path>
                </svg>

                Billing
              </a>


              <button
                type="button"
                class="customer-dropdown-link sign-out"
                data-customer-sign-out
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M10 17l5-5-5-5"></path>
                  <path d="M15 12H3"></path>
                  <path d="M21 19V5a2 2 0 0 0-2-2h-6"></path>
                </svg>

                Sign Out
              </button>

            </div>

          </div>

        </div>

      </div>
    `;
  }


  /* ==========================================================
     SIDEBAR REOPEN BUTTON
     ========================================================== */

  function injectSidebarReopenButton() {
    if (
      document.getElementById(
        "customer-sidebar-reopen"
      )
    ) {
      return;
    }

    const button = document.createElement(
      "button"
    );

    button.type = "button";
    button.id = "customer-sidebar-reopen";
    button.className = "customer-sidebar-reopen";

    button.setAttribute(
      "aria-label",
      "Expand sidebar"
    );

    button.setAttribute(
      "title",
      "Expand sidebar"
    );

    button.innerHTML = `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="m9 18 6-6-6-6"></path>
      </svg>
    `;

    document.body.appendChild(button);

    button.addEventListener(
      "click",
      expandSidebar
    );
  }


  /* ==========================================================
     ACTIVE NAVIGATION
     ========================================================== */

  function setActiveNavigation() {
    const currentPage =
      window.location.pathname
        .split("/")
        .pop() ||
      "customer-dashboard.html";

    const navigationLinks =
      document.querySelectorAll(
        ".customer-nav-link[data-customer-page]"
      );

    navigationLinks.forEach(function (link) {
      const page =
        link.getAttribute(
          "data-customer-page"
        );

      link.classList.remove("active");

      if (page === currentPage) {
        link.classList.add("active");
      }
    });
  }


  /* ==========================================================
     NAVIGATION ACCORDION
     ========================================================== */

  function initializeNavigationAccordion() {
    const groups = Array.from(
      document.querySelectorAll(".customer-nav-group")
    );

    if (!groups.length) {
      return;
    }

    let activeGroup = null;

    groups.forEach(function (group) {
      const label = group.querySelector(".customer-nav-label");
      const nav = group.querySelector(".customer-nav");
      const activeLink = group.querySelector(
        ".customer-nav-link.active"
      );

      if (!label || !nav) {
        return;
      }

      // Make the existing label behave like an accordion trigger.
      label.setAttribute("role", "button");
      label.setAttribute("tabindex", "0");
      label.setAttribute("aria-expanded", "false");
      label.style.cursor = "pointer";

      // Preserve comfortable spacing between collapsed sections
      // without changing customer-portal.css.
      group.style.marginBottom = "10px";
      label.style.paddingTop = "10px";
      label.style.paddingBottom = "10px";

      if (activeLink) {
        activeGroup = group;
      }
    });

    // If no page link is active, keep the first group open.
    if (!activeGroup) {
      activeGroup = groups[0];
    }

    function openGroup(targetGroup) {
      groups.forEach(function (group) {
        const label = group.querySelector(
          ".customer-nav-label"
        );

        const nav = group.querySelector(
          ".customer-nav"
        );

        const isOpen = group === targetGroup;

        group.classList.toggle(
          "customer-nav-group-open",
          isOpen
        );

        if (label) {
          label.setAttribute(
            "aria-expanded",
            isOpen ? "true" : "false"
          );
        }

        if (nav) {
          // Inline display control keeps this change JS-only and
          // does not require any modifications to customer-portal.css.
          nav.style.display = isOpen ? "" : "none";

          if (isOpen) {
            // Restore breathing room between the section heading
            // and its navigation links.
            nav.style.paddingTop = "4px";
            nav.style.paddingBottom = "6px";
          }
        }
      });
    }

    groups.forEach(function (group) {
      const label = group.querySelector(
        ".customer-nav-label"
      );

      if (!label) {
        return;
      }

      label.addEventListener(
        "click",
        function () {
          openGroup(group);
        }
      );

      label.addEventListener(
        "keydown",
        function (event) {
          if (
            event.key === "Enter" ||
            event.key === " "
          ) {
            event.preventDefault();
            openGroup(group);
          }
        }
      );
    });

    openGroup(activeGroup);
  }


  /* ==========================================================
     SIDEBAR CONTROLS
     ========================================================== */

  function initializeSidebarControls() {
    const collapseButton =
      document.getElementById(
        "customer-sidebar-collapse"
      );

    if (collapseButton) {
      collapseButton.addEventListener(
        "click",
        collapseSidebar
      );
    }


    const storedState =
      localStorage.getItem(
        "customerPortalSidebarCollapsed"
      );

    if (
      storedState === "true" &&
      window.innerWidth > 860
    ) {
      document.body.classList.add(
        "customer-sidebar-collapsed"
      );
    }
  }


  function collapseSidebar() {
    if (window.innerWidth <= 860) {
      return;
    }

    document.body.classList.add(
      "customer-sidebar-collapsed"
    );

    localStorage.setItem(
      "customerPortalSidebarCollapsed",
      "true"
    );
  }


  function expandSidebar() {
    document.body.classList.remove(
      "customer-sidebar-collapsed"
    );

    localStorage.setItem(
      "customerPortalSidebarCollapsed",
      "false"
    );
  }



  /* ==========================================================
     MOBILE DROPDOWN NAVIGATION
     ========================================================== */

  function injectMobileDropdownNavigation() {
    if (document.getElementById("customer-mobile-dropdown")) {
      return;
    }

    const header =
      document.getElementById(
        "customer-portal-header"
      );

    if (!header) {
      return;
    }

    const dropdown =
      document.createElement("div");

    dropdown.id = "customer-mobile-dropdown";
    dropdown.className = "customer-mobile-dropdown";
    dropdown.hidden = true;

    header.appendChild(dropdown);

    injectMobileDropdownStyles();
  }


  function rebuildMobileDropdown() {
    const sidebar =
      document.getElementById(
        "customer-sidebar"
      );

    const dropdown =
      document.getElementById(
        "customer-mobile-dropdown"
      );

    if (!sidebar || !dropdown) {
      return;
    }

    dropdown.innerHTML = "";

    const groups =
      sidebar.querySelectorAll(
        ".customer-nav-group"
      );

    groups.forEach(function (group) {
      if (
        group.hidden ||
        group.style.display === "none"
      ) {
        return;
      }

      const label =
        group.querySelector(
          ".customer-nav-label"
        );

      const links =
        group.querySelectorAll(
          ".customer-nav-link"
        );

      if (!links.length) {
        return;
      }

      const section =
        document.createElement("div");

      section.className =
        "customer-mobile-dropdown-section";

      if (label) {
        const heading =
          document.createElement("div");

        heading.className =
          "customer-mobile-dropdown-label";

        heading.textContent =
          label.textContent.trim();

        section.appendChild(heading);
      }

      links.forEach(function (sourceLink) {
        if (
          sourceLink.hidden ||
          sourceLink.style.display === "none"
        ) {
          return;
        }

        const link =
          document.createElement("a");

        link.href =
          sourceLink.getAttribute("href") || "#";

        link.className =
          "customer-mobile-dropdown-link";

        link.textContent =
          sourceLink.textContent
            .replace(/\s+/g, " ")
            .trim();

        if (
          sourceLink.classList.contains("active")
        ) {
          link.classList.add("active");
          link.setAttribute(
            "aria-current",
            "page"
          );
        }

        if (
          sourceLink.target
        ) {
          link.target = sourceLink.target;
        }

        if (
          sourceLink.rel
        ) {
          link.rel = sourceLink.rel;
        }

        section.appendChild(link);
      });

      if (section.querySelector("a")) {
        dropdown.appendChild(section);
      }
    });
  }


  function injectMobileDropdownStyles() {
    if (
      document.getElementById(
        "customer-mobile-dropdown-styles"
      )
    ) {
      return;
    }

    const style =
      document.createElement("style");

    style.id =
      "customer-mobile-dropdown-styles";

    style.textContent = `
      @media (max-width: 860px) {
        .customer-sidebar,
        #customer-sidebar,
        .customer-sidebar-overlay,
        #customer-sidebar-overlay,
        .customer-sidebar-reopen,
        #customer-sidebar-reopen {
          display: none !important;
        }

        body.sidebar-open {
          overflow: auto !important;
        }

        .customer-portal-header {
          position: relative;
          z-index: 80;
        }

        .customer-mobile-dropdown {
          position: absolute;
          left: 12px;
          right: 12px;
          top: calc(100% + 8px);
          max-height: calc(100vh - 110px);
          overflow-y: auto;
          background: #ffffff;
          border: 1px solid #d8e0ec;
          border-radius: 12px;
          box-shadow: 0 16px 38px rgba(18, 45, 82, .16);
          z-index: 1000;
        }

        .customer-mobile-dropdown[hidden] {
          display: none !important;
        }

        .customer-mobile-dropdown-section {
          padding: 8px;
          border-bottom: 1px solid #edf1f5;
        }

        .customer-mobile-dropdown-section:last-child {
          border-bottom: 0;
        }

        .customer-mobile-dropdown-label {
          padding: 7px 10px 5px;
          color: #748197;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: .08em;
          text-transform: uppercase;
        }

        .customer-mobile-dropdown-link {
          display: flex;
          align-items: center;
          min-height: 42px;
          padding: 0 10px;
          border-radius: 8px;
          color: #273348;
          text-decoration: none;
          font-size: 14px;
          font-weight: 700;
        }

        .customer-mobile-dropdown-link:hover,
        .customer-mobile-dropdown-link.active {
          background: #f2f6fb;
          color: #24467f;
        }

        .customer-mobile-menu[aria-expanded="true"] {
          background: #f2f6fb;
        }
      }

      @media (min-width: 861px) {
        .customer-mobile-dropdown {
          display: none !important;
        }
      }
    `;

    document.head.appendChild(style);
  }


  function openMobileDropdown() {
    const button =
      document.getElementById(
        "customer-mobile-menu"
      );

    const dropdown =
      document.getElementById(
        "customer-mobile-dropdown"
      );

    if (!button || !dropdown) {
      return;
    }

    rebuildMobileDropdown();

    dropdown.hidden = false;

    button.setAttribute(
      "aria-expanded",
      "true"
    );

    button.setAttribute(
      "aria-label",
      "Close navigation"
    );
  }


  function closeMobileDropdown() {
    const button =
      document.getElementById(
        "customer-mobile-menu"
      );

    const dropdown =
      document.getElementById(
        "customer-mobile-dropdown"
      );

    if (dropdown) {
      dropdown.hidden = true;
    }

    if (button) {
      button.setAttribute(
        "aria-expanded",
        "false"
      );

      button.setAttribute(
        "aria-label",
        "Open navigation"
      );
    }
  }


  /* ==========================================================
     MOBILE NAVIGATION
     ========================================================== */

  function initializeMobileNavigation() {
    const menuButton =
      document.getElementById(
        "customer-mobile-menu"
      );

    const dropdown =
      document.getElementById(
        "customer-mobile-dropdown"
      );

    if (!menuButton || !dropdown) {
      return;
    }

    menuButton.setAttribute(
      "aria-expanded",
      "false"
    );

    menuButton.setAttribute(
      "aria-controls",
      "customer-mobile-dropdown"
    );

    menuButton.addEventListener(
      "click",
      function (event) {
        if (window.innerWidth > 860) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();

        const isOpen =
          menuButton.getAttribute(
            "aria-expanded"
          ) === "true";

        if (isOpen) {
          closeMobileDropdown();
        } else {
          openMobileDropdown();
        }
      }
    );

    dropdown.addEventListener(
      "click",
      function (event) {
        event.stopPropagation();

        const link =
          event.target.closest("a");

        if (link) {
          closeMobileDropdown();
        }
      }
    );

    document.addEventListener(
      "click",
      function (event) {
        if (
          window.innerWidth <= 860 &&
          !dropdown.contains(event.target) &&
          !menuButton.contains(event.target)
        ) {
          closeMobileDropdown();
        }
      }
    );

    document.addEventListener(
      "keydown",
      function (event) {
        if (event.key === "Escape") {
          closeMobileDropdown();
        }
      }
    );

    window.addEventListener(
      "resize",
      function () {
        closeMobileDropdown();
      }
    );
  }

  function openMobileSidebar() {
    const sidebar =
      document.getElementById(
        "customer-sidebar"
      );

    const overlay =
      document.getElementById(
        "customer-sidebar-overlay"
      );

    if (!sidebar || !overlay) {
      return;
    }

    sidebar.classList.add(
      "mobile-open"
    );

    overlay.classList.add(
      "active"
    );

    document.body.classList.add(
      "sidebar-open"
    );
  }


  function closeMobileSidebar() {
    const sidebar =
      document.getElementById(
        "customer-sidebar"
      );

    const overlay =
      document.getElementById(
        "customer-sidebar-overlay"
      );

    if (sidebar) {
      sidebar.classList.remove(
        "mobile-open"
      );
    }

    if (overlay) {
      overlay.classList.remove(
        "active"
      );
    }

    document.body.classList.remove(
      "sidebar-open"
    );
  }


  /* ==========================================================
     ACCOUNT MENU
     ========================================================== */

  function initializeAccountMenu() {
    const menu =
      document.getElementById(
        "customer-account-menu"
      );

    const trigger =
      document.getElementById(
        "customer-account-trigger"
      );

    if (!menu || !trigger) {
      return;
    }


    trigger.addEventListener(
      "click",
      function (event) {
        event.stopPropagation();

        const isOpen =
          menu.classList.toggle("open");

        trigger.setAttribute(
          "aria-expanded",
          isOpen ? "true" : "false"
        );
      }
    );


    document.addEventListener(
      "click",
      function (event) {
        if (!menu.contains(event.target)) {
          menu.classList.remove("open");

          trigger.setAttribute(
            "aria-expanded",
            "false"
          );
        }
      }
    );


    document.addEventListener(
      "keydown",
      function (event) {
        if (event.key === "Escape") {
          menu.classList.remove("open");

          trigger.setAttribute(
            "aria-expanded",
            "false"
          );
        }
      }
    );
  }


  /* ==========================================================
     TRAINING PURCHASE ACCESS
     ========================================================== */

  async function initializeTrainingNavigation() {
    const group = document.getElementById("customer-training-group");
    if (!group) return;

    try {
      const client = await waitForSupabaseClient();
      const result = await client.rpc("customer_has_training_purchase");

      if (result.error) {
        throw result.error;
      }

      if (result.data === true) {
        group.hidden = false;
        group.style.removeProperty("display");
      }
    } catch (error) {
      // Fail closed: customers without a verified purchase never see the link.
      console.warn("[Customer Portal] Training access check failed:", error);
      group.hidden = true;
      group.style.display = "none";
    }
  }

  async function waitForSupabaseClient(timeout) {
    const limit = Number(timeout) || 6000;
    const started = Date.now();

    while (Date.now() - started < limit) {
      let client = null;

      if (typeof window.getScreenings4uSupabase === "function") {
        try {
          client = await window.getScreenings4uSupabase();
        } catch (_) {}
      }

      client = client || window.screenings4uSupabase ||
        window.supabaseClient || window.supabaseAdmin ||
        (window.supabase && typeof window.supabase.from === "function" ? window.supabase : null);

      if (client && typeof client.rpc === "function") {
        return client;
      }

      await new Promise(function (resolve) { window.setTimeout(resolve, 75); });
    }

    throw new Error("Supabase client is unavailable.");
  }

  /* ==========================================================
     NOTIFICATIONS
     ========================================================== */

  function initializeNotificationButton() {
    const button =
      document.getElementById(
        "customer-header-notifications"
      );

    if (!button) {
      return;
    }

    button.addEventListener(
      "click",
      function () {
        window.location.href =
          "customer-notifications.html";
      }
    );
  }


  /* ==========================================================
     NOTIFICATION COUNT
     ========================================================== */

  window.updateCustomerNotificationCount =
    function (count) {

      const numericCount =
        Number(count) || 0;

      const navBadge =
        document.getElementById(
          "customer-notification-count"
        );

      const headerIndicator =
        document.getElementById(
          "customer-header-notification-indicator"
        );


      if (navBadge) {

        navBadge.textContent =
          numericCount;

        navBadge.style.display =
          numericCount > 0
            ? ""
            : "none";
      }


      if (headerIndicator) {

        headerIndicator.style.display =
          numericCount > 0
            ? ""
            : "none";
      }
    };


  /* ==========================================================
     CUSTOMER USER UPDATE
     ========================================================== */

  window.updateCustomerPortalUser =
    function (user) {

      if (!user) {
        return;
      }


      const name =
        user.fullName ||
        user.name ||
        "";

      const email =
        user.email ||
        "";

      const initials =
        name
          ? getInitials(name)
          : "";


      const accountName =
        document.getElementById(
          "customer-account-name"
        );

      const dropdownName =
        document.getElementById(
          "customer-dropdown-name"
        );

      const dropdownEmail =
        document.getElementById(
          "customer-dropdown-email"
        );

      const avatar =
        document.getElementById(
          "customer-account-avatar"
        );


      if (accountName) {
        accountName.textContent = name;
      }

      if (dropdownName) {
        dropdownName.textContent = name;
      }

      if (dropdownEmail) {
        dropdownEmail.textContent = email;
      }

      if (avatar) {
        avatar.textContent = initials;
      }
    };


function initializeSignOutButtons() {
  const buttons =
    document.querySelectorAll(
      "[data-customer-sign-out]"
    );

  buttons.forEach(function (button) {

    button.addEventListener(
      "click",
      async function (event) {

        event.preventDefault();

        if (button.disabled) {
          return;
        }

        button.disabled = true;

        try {

          if (
            window.S4UAuth &&
            typeof window.S4UAuth.signOut === "function"
          ) {

            await window.S4UAuth.signOut({
              redirectTo:
                "customer-login.html"
            });

            return;
          }

          console.error(
            "[Customer Portal] S4UAuth.signOut() is unavailable."
          );

          window.location.replace(
            "customer-login.html"
          );

        } catch (error) {

          console.error(
            "[Customer Portal] Sign-out failed:",
            error
          );

          button.disabled = false;

          alert(
            "We could not sign you out. Please try again."
          );

        }

      }
    );

  });
}


  /* ==========================================================
     PAGE METADATA
     ========================================================== */

  function applyPageMetadata() {
    const pageTitle =
      document.body.getAttribute(
        "data-page-title"
      );

    if (pageTitle) {
      document.title =
        pageTitle +
        " | Screenings4u";
    }
  }


  /* ==========================================================
     UTILITIES
     ========================================================== */

  function getInitials(name) {
    if (!name) {
      return "";
    }

    const parts =
      String(name)
        .trim()
        .split(/\s+/)
        .filter(Boolean);

    if (parts.length === 0) {
      return "";
    }

    if (parts.length === 1) {
      return parts[0]
        .charAt(0)
        .toUpperCase();
    }

    return (
      parts[0].charAt(0) +
      parts[parts.length - 1].charAt(0)
    ).toUpperCase();
  }


  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

})();
