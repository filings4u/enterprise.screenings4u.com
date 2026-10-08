/* ============================================================
   SCREENINGS4U
   EMPLOYER PORTAL SHELL
   employer-portal.js
   ============================================================ */

(function () {
  "use strict";

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeEmployerPortal, { once: true });
  } else {
    initializeEmployerPortal();
  }

  /* ==========================================================
     INITIALIZE
     ========================================================== */

  function initializeEmployerPortal() {
    injectEmployerSidebar();
    injectEmployerHeader();
    injectSidebarReopenButton();
    injectMobileDropdownNavigation();

    setActiveNavigation();
    initializeSidebarControls();
    initializeNavigationAccordion();
    initializeMobileNavigation();
    initializeAccountMenu();
    initializeNotificationButton();
    initializeSignOutButtons();

    applyPageMetadata();
  }


  /* ==========================================================
     SIDEBAR
     ========================================================== */

  function injectEmployerSidebar() {
    const sidebarTarget = document.getElementById(
      "employer-portal-sidebar"
    );

    if (!sidebarTarget) {
      return;
    }

    sidebarTarget.innerHTML = getSidebarMarkup();
  }


  function getSidebarMarkup() {
    return `
      <aside class="employer-sidebar" id="employer-sidebar" aria-label="Employer portal navigation">
        <div class="employer-sidebar-inner">
          <div class="employer-sidebar-brand">
            <a href="employer-dashboard.html" class="employer-sidebar-logo-link" aria-label="Screenings4u Employer Portal">
              <img src="images/logo.png" alt="screenings4u" class="employer-sidebar-logo" />
              <div class="employer-sidebar-brand-copy"><span class="employer-sidebar-brand-label">Employer Portal</span></div>
            </a>
            <button type="button" class="employer-sidebar-collapse" id="employer-sidebar-collapse" aria-label="Collapse sidebar" title="Collapse sidebar">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 18l-6-6 6-6"></path></svg>
            </button>
          </div>

          <div class="employer-sidebar-scroll">

            <div class="employer-nav-group">
              <span class="employer-nav-label">Overview</span>
              <nav class="employer-nav">
                <a href="employer-welcome.html" class="employer-nav-link" data-employer-page="employer-welcome.html">
                  <span class="employer-nav-icon"><svg viewBox="0 0 24 24"><path d="M3 11.5 12 4l9 7.5"></path><path d="M5.5 10.5V20h13v-9.5"></path><path d="M9.5 20v-6h5v6"></path></svg></span>
                  <span class="employer-nav-text">Welcome</span>
                </a>
                <a href="employer-dashboard.html" class="employer-nav-link" data-employer-page="employer-dashboard.html">
                  <span class="employer-nav-icon"><svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1"></rect><rect x="14" y="3" width="7" height="7" rx="1"></rect><rect x="3" y="14" width="7" height="7" rx="1"></rect><rect x="14" y="14" width="7" height="7" rx="1"></rect></svg></span>
                  <span class="employer-nav-text">Dashboard</span>
                </a>
                <a href="employer-notifications.html" class="employer-nav-link" data-employer-page="employer-notifications.html">
                  <span class="employer-nav-icon"><svg viewBox="0 0 24 24"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"></path><path d="M10 21h4"></path></svg></span>
                  <span class="employer-nav-text">Notifications</span><span class="employer-nav-badge" id="employer-notification-count" style="display:none;">0</span>
                </a>
              </nav>
            </div>

            <div class="employer-nav-group">
              <span class="employer-nav-label">Workforce</span>
              <nav class="employer-nav">
                <a href="employer-employees.html" class="employer-nav-link" data-employer-page="employer-employees.html"><span class="employer-nav-icon"><svg viewBox="0 0 24 24"><circle cx="9" cy="7" r="3"></circle><circle cx="17" cy="9" r="2"></circle><path d="M3 21c.5-4 2.5-6 6-6s5.5 2 6 6"></path><path d="M15 15c3 0 5 1.5 6 4"></path></svg></span><span class="employer-nav-text">Employees</span></a>
                <a href="employer-programs.html" class="employer-nav-link" data-employer-page="employer-programs.html"><span class="employer-nav-icon"><svg viewBox="0 0 24 24"><path d="M4 4h16v16H4z"></path><path d="M8 9h8"></path><path d="M8 13h8"></path><path d="M8 17h5"></path></svg></span><span class="employer-nav-text">Programs</span></a>
              </nav>
            </div>

            <div class="employer-nav-group">
              <span class="employer-nav-label">Training</span>
              <nav class="employer-nav">
                <a href="employer-training-management.html" class="employer-nav-link" data-employer-page="employer-training-management.html"><span class="employer-nav-icon"><svg viewBox="0 0 24 24"><path d="M3 5h8a3 3 0 0 1 3 3v11a3 3 0 0 0-3-3H3z"></path><path d="M21 5h-8a3 3 0 0 0-3 3v11a3 3 0 0 1 3-3h8z"></path></svg></span><span class="employer-nav-text">Training Management</span></a>
                <a href="employer-training-credits.html" class="employer-nav-link" data-employer-page="employer-training-credits.html"><span class="employer-nav-icon"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"></circle><path d="M9 9h6"></path><path d="M9 15h6"></path><path d="M12 7v10"></path></svg></span><span class="employer-nav-text">Training & Credits</span></a>
              </nav>
            </div>

            <div class="employer-nav-group">
              <span class="employer-nav-label">Orders & Billing</span>
              <nav class="employer-nav">
                <a href="employer-orders.html" class="employer-nav-link" data-employer-page="employer-orders.html"><span class="employer-nav-icon"><svg viewBox="0 0 24 24"><path d="M6 3h12"></path><path d="M6 7h12"></path><path d="M6 11h12"></path><path d="M6 15h8"></path></svg></span><span class="employer-nav-text">Orders</span></a>
                <a href="employer-invoices.html" class="employer-nav-link" data-employer-page="employer-invoices.html"><span class="employer-nav-icon"><svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"></rect><path d="M3 10h18"></path><path d="M7 15h2"></path></svg></span><span class="employer-nav-text">Invoices</span></a>
                <a href="employer-proposals.html" class="employer-nav-link" data-employer-page="employer-proposals.html"><span class="employer-nav-icon"><svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><path d="M14 2v6h6"></path><path d="M8 13h8"></path></svg></span><span class="employer-nav-text">Proposals</span></a>
              </nav>
            </div>

            <div class="employer-nav-group">
              <span class="employer-nav-label">Services & Requests</span>
              <nav class="employer-nav">
                <a href="employer-catalog.html" class="employer-nav-link" data-employer-page="employer-catalog.html"><span class="employer-nav-icon"><svg viewBox="0 0 24 24"><circle cx="9" cy="20" r="1"></circle><circle cx="20" cy="20" r="1"></circle><path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h7.8a2 2 0 0 0 1.9-1.4L22 6H6"></path></svg></span><span class="employer-nav-text">Service Catalog</span></a>
                <a href="employer-request-post-accident.html" class="employer-nav-link" data-employer-page="employer-request-post-accident.html"><span class="employer-nav-icon"><svg viewBox="0 0 24 24"><path d="M12 9v4"></path><path d="M12 17h.01"></path><path d="M10.3 3.9 2.6 18a2 2 0 0 0 1.8 3h15.2a2 2 0 0 0 1.8-3L13.7 3.9a2 2 0 0 0-3.4 0z"></path></svg></span><span class="employer-nav-text">Post-Accident Testing</span></a>
                <a href="employer-request-onsite-testing.html" class="employer-nav-link" data-employer-page="employer-request-onsite-testing.html"><span class="employer-nav-icon"><svg viewBox="0 0 24 24"><path d="M3 21h18"></path><path d="M5 21V9l7-5 7 5v12"></path><path d="M9 21v-5h6v5"></path></svg></span><span class="employer-nav-text">Onsite Testing</span></a>
              </nav>
            </div>

            <div class="employer-nav-group">
              <span class="employer-nav-label">Company & Account</span>
              <nav class="employer-nav">
                <a href="employer-profile.html" class="employer-nav-link" data-employer-page="employer-profile.html"><span class="employer-nav-icon"><svg viewBox="0 0 24 24"><path d="M3 21V5a2 2 0 0 1 2-2h10v18"></path><path d="M15 8h6v13h-6"></path><path d="M7 7h4"></path><path d="M7 11h4"></path></svg></span><span class="employer-nav-text">Company Profile</span></a>
                <a href="employer-users.html" class="employer-nav-link" data-employer-page="employer-users.html"><span class="employer-nav-icon"><svg viewBox="0 0 24 24"><circle cx="8" cy="8" r="3"></circle><circle cx="17" cy="9" r="2"></circle><path d="M2 21c.5-4 2.5-6 6-6s5.5 2 6 6"></path><path d="M14 16c3 0 5 1.5 6 4"></path></svg></span><span class="employer-nav-text">Portal Users</span></a>
                <a href="employer-account-settings.html" class="employer-nav-link" data-employer-page="employer-account-settings.html"><span class="employer-nav-icon"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1z"></path></svg></span><span class="employer-nav-text">Account Settings</span></a>
                <a href="employer-integrations.html" class="employer-nav-link" data-employer-page="employer-integrations.html"><span class="employer-nav-icon"><svg viewBox="0 0 24 24"><path d="M8 12h8M12 8v8"></path><rect x="4" y="4" width="16" height="16" rx="3"></rect></svg></span><span class="employer-nav-text">Integrations</span></a>
                <a href="employer-support.html" class="employer-nav-link" data-employer-page="employer-support.html"><span class="employer-nav-icon"><svg viewBox="0 0 24 24"><path d="M4 4h16v13H8l-4 4z"></path><path d="M8 9h8"></path><path d="M8 13h5"></path></svg></span><span class="employer-nav-text">Support</span></a>
              </nav>
            </div>

          </div>

          <div class="employer-sidebar-footer"><div class="employer-sidebar-footer-links">
            <a href="https://screenings4u.com" class="employer-footer-link"><span class="employer-footer-icon"><svg viewBox="0 0 24 24"><path d="M19 12H5"></path><path d="m12 19-7-7 7-7"></path></svg></span><span class="employer-footer-text">Back to Screenings4u</span></a>
            <button type="button" class="employer-footer-link sign-out" data-employer-sign-out><span class="employer-footer-icon"><svg viewBox="0 0 24 24"><path d="M10 17l5-5-5-5"></path><path d="M15 12H3"></path><path d="M21 19V5a2 2 0 0 0-2-2h-6"></path></svg></span><span class="employer-footer-text">Sign Out</span></button>
          </div></div>
        </div>
      </aside>
      <div class="employer-sidebar-overlay" id="employer-sidebar-overlay" aria-hidden="true"></div>
    `;
  }

  /* ==========================================================
     HEADER
     ========================================================== */

  function injectEmployerHeader() {
    const headerTarget = document.getElementById(
      "employer-portal-header"
    );

    if (!headerTarget) {
      return;
    }

    const pageTitle =
      document.body.getAttribute("data-page-title") ||
      "Employer Portal";

    const pageSubtitle =
      document.body.getAttribute("data-page-subtitle") ||
      "Manage your Screenings4u services and account.";

    headerTarget.className = "employer-portal-header";

    headerTarget.innerHTML = `
      <div class="employer-header-left">

        <!-- MOBILE MENU -->

        <button
          type="button"
          class="employer-mobile-menu"
          id="employer-mobile-menu"
          aria-label="Open navigation"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 7h16"></path>
            <path d="M4 12h16"></path>
            <path d="M4 17h16"></path>
          </svg>
        </button>


        <!-- PAGE TITLE -->

        <div class="employer-header-title-wrap">

          <h1 class="employer-header-title">
            ${escapeHtml(pageTitle)}
          </h1>

          <p class="employer-header-subtitle">
            ${escapeHtml(pageSubtitle)}
          </p>

        </div>

      </div>


      <div class="employer-header-right">

        <!-- NOTIFICATIONS -->

        <button
          type="button"
          class="employer-header-icon-button"
          id="employer-header-notifications"
          aria-label="View notifications"
          title="Notifications"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"></path>
            <path d="M10 21h4"></path>
          </svg>

          <span
            class="employer-notification-indicator"
            id="employer-header-notification-indicator"
            style="display: none;"
          ></span>
        </button>


        <!-- ACCOUNT MENU -->

        <div
          class="employer-account-menu"
          id="employer-account-menu"
        >

          <button
            type="button"
            class="employer-account-trigger"
            id="employer-account-trigger"
            aria-haspopup="true"
            aria-expanded="false"
          >

            <span
              class="employer-account-avatar"
              id="employer-account-avatar"
            >
            </span>


            <span class="employer-account-copy">

              <span
                class="employer-account-name"
                id="employer-account-name"
              >
              </span>

              <span class="employer-account-role">
                Employer Account
              </span>

            </span>


            <svg
              class="employer-account-chevron"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path d="m6 9 6 6 6-6"></path>
            </svg>

          </button>


          <!-- ACCOUNT DROPDOWN -->

          <div
            class="employer-account-dropdown"
            id="employer-account-dropdown"
          >

            <div class="employer-account-dropdown-user">

              <span
                class="employer-dropdown-name"
                id="employer-dropdown-name"
              >
              </span>

              <span
                class="employer-dropdown-email"
                id="employer-dropdown-email"
              >
              </span>

            </div>


            <div class="employer-dropdown-links">

              <a
                href="employer-profile.html"
                class="employer-dropdown-link"
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
                href="employer-invoices.html"
                class="employer-dropdown-link"
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
                class="employer-dropdown-link sign-out"
                data-employer-sign-out
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
        "employer-sidebar-reopen"
      )
    ) {
      return;
    }

    const button = document.createElement(
      "button"
    );

    button.type = "button";
    button.id = "employer-sidebar-reopen";
    button.className = "employer-sidebar-reopen";

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
      "employer-dashboard.html";

    const navigationLinks =
      document.querySelectorAll(
        ".employer-nav-link[data-employer-page]"
      );

    navigationLinks.forEach(function (link) {
      const page =
        link.getAttribute(
          "data-employer-page"
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
      document.querySelectorAll(".employer-nav-group")
    );

    if (!groups.length) {
      return;
    }

    let activeGroup = null;

    groups.forEach(function (group) {
      const label = group.querySelector(".employer-nav-label");
      const nav = group.querySelector(".employer-nav");
      const activeLink = group.querySelector(
        ".employer-nav-link.active"
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
      // without changing employer-portal.css.
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
          ".employer-nav-label"
        );

        const nav = group.querySelector(
          ".employer-nav"
        );

        const isOpen = group === targetGroup;

        group.classList.toggle(
          "employer-nav-group-open",
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
          // does not require any modifications to employer-portal.css.
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
        ".employer-nav-label"
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
        "employer-sidebar-collapse"
      );

    if (collapseButton) {
      collapseButton.addEventListener(
        "click",
        collapseSidebar
      );
    }


    const storedState =
      localStorage.getItem(
        "employerPortalSidebarCollapsed"
      );

    if (
      storedState === "true" &&
      window.innerWidth > 860
    ) {
      document.body.classList.add(
        "employer-sidebar-collapsed"
      );
    }
  }


  function collapseSidebar() {
    if (window.innerWidth <= 860) {
      return;
    }

    document.body.classList.add(
      "employer-sidebar-collapsed"
    );

    localStorage.setItem(
      "employerPortalSidebarCollapsed",
      "true"
    );
  }


  function expandSidebar() {
    document.body.classList.remove(
      "employer-sidebar-collapsed"
    );

    localStorage.setItem(
      "employerPortalSidebarCollapsed",
      "false"
    );
  }



  /* ==========================================================
     MOBILE DROPDOWN NAVIGATION
     ========================================================== */

  function injectMobileDropdownNavigation() {
    if (document.getElementById("employer-mobile-dropdown")) {
      return;
    }

    const header =
      document.getElementById(
        "employer-portal-header"
      );

    if (!header) {
      return;
    }

    const dropdown =
      document.createElement("div");

    dropdown.id = "employer-mobile-dropdown";
    dropdown.className = "employer-mobile-dropdown";
    dropdown.hidden = true;

    header.appendChild(dropdown);

    injectMobileDropdownStyles();
  }


  function rebuildMobileDropdown() {
    const sidebar =
      document.getElementById(
        "employer-sidebar"
      );

    const dropdown =
      document.getElementById(
        "employer-mobile-dropdown"
      );

    if (!sidebar || !dropdown) {
      return;
    }

    dropdown.innerHTML = "";

    const groups =
      sidebar.querySelectorAll(
        ".employer-nav-group"
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
          ".employer-nav-label"
        );

      const links =
        group.querySelectorAll(
          ".employer-nav-link"
        );

      if (!links.length) {
        return;
      }

      const section =
        document.createElement("div");

      section.className =
        "employer-mobile-dropdown-section";

      if (label) {
        const heading =
          document.createElement("div");

        heading.className =
          "employer-mobile-dropdown-label";

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
          "employer-mobile-dropdown-link";

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
        "employer-mobile-dropdown-styles"
      )
    ) {
      return;
    }

    const style =
      document.createElement("style");

    style.id =
      "employer-mobile-dropdown-styles";

    style.textContent = `
      @media (max-width: 860px) {
        .employer-sidebar,
        #employer-sidebar,
        .employer-sidebar-overlay,
        #employer-sidebar-overlay,
        .employer-sidebar-reopen,
        #employer-sidebar-reopen {
          display: none !important;
        }

        body.sidebar-open {
          overflow: auto !important;
        }

        .employer-portal-header {
          position: relative;
          z-index: 80;
        }

        .employer-mobile-dropdown {
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

        .employer-mobile-dropdown[hidden] {
          display: none !important;
        }

        .employer-mobile-dropdown-section {
          padding: 8px;
          border-bottom: 1px solid #edf1f5;
        }

        .employer-mobile-dropdown-section:last-child {
          border-bottom: 0;
        }

        .employer-mobile-dropdown-label {
          padding: 7px 10px 5px;
          color: #748197;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: .08em;
          text-transform: uppercase;
        }

        .employer-mobile-dropdown-link {
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

        .employer-mobile-dropdown-link:hover,
        .employer-mobile-dropdown-link.active {
          background: #f2f6fb;
          color: #24467f;
        }

        .employer-mobile-menu[aria-expanded="true"] {
          background: #f2f6fb;
        }
      }

      @media (min-width: 861px) {
        .employer-mobile-dropdown {
          display: none !important;
        }
      }
    `;

    document.head.appendChild(style);
  }


  function openMobileDropdown() {
    const button =
      document.getElementById(
        "employer-mobile-menu"
      );

    const dropdown =
      document.getElementById(
        "employer-mobile-dropdown"
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
        "employer-mobile-menu"
      );

    const dropdown =
      document.getElementById(
        "employer-mobile-dropdown"
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
        "employer-mobile-menu"
      );

    const dropdown =
      document.getElementById(
        "employer-mobile-dropdown"
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
      "employer-mobile-dropdown"
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
        "employer-sidebar"
      );

    const overlay =
      document.getElementById(
        "employer-sidebar-overlay"
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
        "employer-sidebar"
      );

    const overlay =
      document.getElementById(
        "employer-sidebar-overlay"
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
        "employer-account-menu"
      );

    const trigger =
      document.getElementById(
        "employer-account-trigger"
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
     NOTIFICATIONS
     ========================================================== */

  function initializeNotificationButton() {
    const button =
      document.getElementById(
        "employer-header-notifications"
      );

    if (!button) {
      return;
    }

    button.addEventListener(
      "click",
      function () {
        window.location.href =
          "employer-notifications.html";
      }
    );
  }


  /* ==========================================================
     NOTIFICATION COUNT
     ========================================================== */

  window.updateEmployerNotificationCount =
    function (count) {

      const numericCount =
        Number(count) || 0;

      const navBadge =
        document.getElementById(
          "employer-notification-count"
        );

      const headerIndicator =
        document.getElementById(
          "employer-header-notification-indicator"
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
     EMPLOYER USER UPDATE
     ========================================================== */

  window.updateEmployerPortalUser =
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
        getInitials(name);


      const accountName =
        document.getElementById(
          "employer-account-name"
        );

      const dropdownName =
        document.getElementById(
          "employer-dropdown-name"
        );

      const dropdownEmail =
        document.getElementById(
          "employer-dropdown-email"
        );

      const avatar =
        document.getElementById(
          "employer-account-avatar"
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


  /* ==========================================================
     SIGN OUT
     ========================================================== */

  function initializeSignOutButtons() {
    const buttons =
      document.querySelectorAll(
        "[data-employer-sign-out]"
      );

    buttons.forEach(function (button) {
      button.addEventListener(
        "click",
        async function () {
          if (button.disabled) {
            return;
          }

          button.disabled = true;

          try {
            let client = null;

            if (
              typeof window.getScreenings4uSupabase ===
              "function"
            ) {
              client =
                await window.getScreenings4uSupabase();
            } else {
              client =
                window.screenings4uSupabase ||
                window.supabaseClient ||
                null;
            }

            if (!client?.auth) {
              throw new Error(
                "Supabase auth client is unavailable."
              );
            }

            const { error } =
              await client.auth.signOut();

            if (error) {
              throw error;
            }

          } catch (error) {
            console.error(
              "[Employer Portal] Sign out failed:",
              error
            );

            button.disabled = false;

            alert(
              "We could not sign you out. Please try again."
            );

            return;
          }

          // replace() prevents Back from reopening the protected page.
          window.location.replace(
            "employer-login.html"
          );
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