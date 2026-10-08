/* ============================================================
   SCREENINGS4U — ADMIN LMS COURSE ENGAGEMENT
   Read-only engagement analytics + communication routing
   ============================================================ */

(function () {
  "use strict";

  const TABLES = Object.freeze({
    courses: "lms_courses",
    enrollments: "lms_enrollments",
    profiles: "user_profiles",
    lessonProgress: "lms_lesson_progress",
    blockProgress: "lms_block_progress",
    quizAttempts: "lms_quiz_attempts",
    assessmentAttempts: "lms_assessment_attempts"
  });

  const state = {
    courseId: "",
    course: null,
    enrollments: [],
    profiles: [],
    profileMap: new Map(),
    lessonProgress: [],
    blockProgress: [],
    quizAttempts: [],
    assessmentAttempts: [],
    filters: {
      activity: "all",
      search: ""
    }
  };

  const $ = (id) =>
    document.getElementById(id);

  document.addEventListener(
    "DOMContentLoaded",
    initialize
  );


  /* ============================================================
     INITIALIZE
     ============================================================ */

  async function initialize() {
    try {
      bindUi();

      const params =
        new URLSearchParams(
          window.location.search
        );

      state.courseId =
        params.get("course") ||
        params.get("course_id") ||
        params.get("id") ||
        "";

      if (!state.courseId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(state.courseId)) {
        window.location.replace("admin-lms-courses.html?engagement=select-course");
        return;
      }

      applyLinks();

      await loadAll();

      renderAll();

    } catch (error) {
      console.error(
        "[Course Engagement]",
        error
      );

      showToast(
        error?.message ||
        "Unable to load course engagement.",
        "error"
      );

      setLoading(false);
    }
  }


  function db() {
    const candidates = [
      window.supabaseClient,
      window.supabaseAdmin,
      window.supabase
    ];

    const client =
      candidates.find(
        (value) =>
          value &&
          typeof value.from === "function"
      );

    if (!client) {
      throw new Error(
        "Supabase client is unavailable."
      );
    }

    return client;
  }


  async function report(action,payload={}) {
    const { data, error } = await db().auth.getSession();
    if (error) throw error;
    const token = data?.session?.access_token;
    if (!token) throw new Error('Your admin session has expired. Please sign in again.');
    const base = String(window.SCREENINGS4U_SUPABASE_URL || 'https://elpbnytpciqnbexiaebp.supabase.co').replace(/\/$/, '');
    const anon = window.SCREENINGS4U_SUPABASE_ANON_KEY || window.SUPABASE_ANON_KEY || '';
    const response = await fetch(base + '/functions/v1/screenings4u-training-reporting', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token,
        ...(anon ? { 'apikey': anon } : {})
      },
      body: JSON.stringify({ action, ...payload })
    });
    const out = await response.json().catch(() => ({}));
    if (!response.ok || out?.error) throw new Error(out?.error || 'Training reporting request failed.');
    return out;
  }


  /* ============================================================
     DATA LOAD
     ============================================================ */

  async function loadAll() {
    setLoading(true);
    const out = await report('engagement', { course_id: state.courseId });
    state.course = out.course || null;
    state.enrollments = out.enrollments || [];
    state.profiles = out.profiles || [];
    state.profileMap = new Map(state.profiles.map(profile => [profile.id, profile]));
    state.lessonProgress = out.lesson_progress || [];
    state.blockProgress = out.block_progress || [];
    state.quizAttempts = out.quiz_attempts || [];
    state.assessmentAttempts = out.assessment_attempts || [];
    setLoading(false);
  }


  /* ============================================================
     RENDER
     ============================================================ */

  function renderAll() {
    renderHeader();
    renderMetrics();
    renderLearners();
    renderQuizPerformance();
    renderMomentum();

    const content =
      $("engagementContent");

    if (content) {
      content.hidden = false;
    }
  }


  function renderHeader() {
    const course =
      state.course || {};

    const title =
      course.title ||
      "Course";

    setText(
      "engagementCourseTitle",
      title
    );

    setText(
      "engagementBreadcrumbCourse",
      title
    );


    const status =
      normalizeStatus(
        course.status
      );

    setText(
      "engagementCourseStatus",
      titleCase(status)
    );

    setText(
      "engagementAccessStatus",
      status === "archived"
        ? "Archived"
        : "Active"
    );
  }


  function renderMetrics() {
    const active =
      state.enrollments.filter(
        row =>
          normalizeStatus(
            row.status
          ) === "active"
      );

    const completed =
      state.enrollments.filter(
        row =>
          normalizeStatus(
            row.status
          ) === "completed"
      );

    const avgProgress =
      average(
        state.enrollments.map(
          row =>
            number(
              row.progress_percent
            )
        )
      );

    const completionRate =
      state.enrollments.length
        ? Math.round(
            completed.length /
            state.enrollments.length *
            100
          )
        : 0;


    const gradedAttempts =
      state.quizAttempts.filter(
        row =>
          typeof row.passed ===
          "boolean"
      );

    const passedAttempts =
      gradedAttempts.filter(
        row =>
          row.passed === true
      );


    setText(
      "metricActiveParticipants",
      active.length
    );

    setText(
      "metricAverageProgress",
      Math.round(avgProgress) + "%"
    );

    setText(
      "metricCompletionRate",
      completionRate + "%"
    );

    setText(
      "metricQuizPassRate",
      gradedAttempts.length
        ? Math.round(
            passedAttempts.length /
            gradedAttempts.length *
            100
          ) + "%"
        : "—"
    );
  }


  function renderLearners() {
    const body =
      $("engagementTableBody");

    const empty =
      $("engagementEmpty");

    if (!body || !empty) {
      return;
    }


    const rows =
      state.enrollments
        .filter(matchesFilters)
        .map(buildLearnerRow);


    if (!rows.length) {
      body.innerHTML = "";
      empty.hidden = false;
      return;
    }


    empty.hidden = true;

    body.innerHTML =
      rows.join("");


    document
      .querySelectorAll(
        "[data-engagement-message]"
      )
      .forEach(
        button => {
          button.addEventListener(
            "click",
            function () {
              const userId =
                button.dataset.engagementMessage;

              openParticipantMessage(
                userId
              );
            }
          );
        }
      );
  }


  function buildLearnerRow(enrollment) {
    const profile =
      state.profileMap.get(
        enrollment.user_id
      ) || {};

    const name =
      getProfileName(profile);

    const progress =
      clamp(
        number(
          enrollment.progress_percent
        ),
        0,
        100
      );

    const lastActivity =
      enrollment.last_activity_at ||
      enrollment.started_at ||
      enrollment.enrolled_at;

    const daysInactive =
      daysSince(
        lastActivity
      );

    const status =
      normalizeStatus(
        enrollment.status
      );

    const engagement =
      getEngagementLevel(
        progress,
        status,
        daysInactive
      );

    const attempts =
      state.quizAttempts.filter(
        row =>
          row.enrollment_id ===
          enrollment.id
      );

    const passed =
      attempts.filter(
        row =>
          row.passed === true
      ).length;


    return `
      <tr>

        <td>
          <div class="engagement-person">
            <span class="engagement-avatar">
              ${esc(getInitials(name))}
            </span>

            <div>
              <strong>${esc(name)}</strong>
              <small>${esc(profile.email || "")}</small>
            </div>
          </div>
        </td>


        <td>
          ${Math.round(progress)}%
        </td>


        <td>
          ${esc(formatDate(lastActivity))}
        </td>


        <td>
          <span class="engagement-level ${engagement.className}">
            ${esc(engagement.label)}
          </span>
        </td>


        <td>
          ${
            attempts.length
              ? esc(
                  passed +
                  " passed / " +
                  attempts.length +
                  " attempts"
                )
              : "No attempts"
          }
        </td>


        <td>
          <button
            type="button"
            class="engagement-row-action"
            data-engagement-message="${esc(enrollment.user_id)}"
          >
            Message
          </button>
        </td>

      </tr>
    `;
  }


  function renderQuizPerformance() {
    const attempts =
      state.quizAttempts;

    const passed =
      attempts.filter(
        row =>
          row.passed === true
      ).length;

    const failed =
      attempts.filter(
        row =>
          row.passed === false
      ).length;

    const scores =
      attempts
        .map(
          row =>
            numberOrNull(
              row.score
            )
        )
        .filter(
          value =>
            value !== null
        );


    setText(
      "quizTotalAttempts",
      attempts.length
    );

    setText(
      "quizPassedAttempts",
      passed
    );

    setText(
      "quizFailedAttempts",
      failed
    );

    setText(
      "quizAverageScore",
      scores.length
        ? Math.round(
            average(scores)
          ) + "%"
        : "—"
    );
  }


  function renderMomentum() {
    let notStarted = 0;
    let inProgress = 0;
    let needsAttention = 0;
    let completed = 0;


    state.enrollments
      .forEach(
        enrollment => {
          const progress =
            number(
              enrollment.progress_percent
            );

          const status =
            normalizeStatus(
              enrollment.status
            );

          const inactivity =
            daysSince(
              enrollment.last_activity_at ||
              enrollment.started_at ||
              enrollment.enrolled_at
            );


          if (
            status === "completed" ||
            progress >= 100
          ) {
            completed += 1;
            return;
          }


          if (progress <= 0) {
            notStarted += 1;
          } else {
            inProgress += 1;
          }


          if (
            status === "active" &&
            inactivity >= 7
          ) {
            needsAttention += 1;
          }
        }
      );


    setText(
      "momentumNotStarted",
      notStarted
    );

    setText(
      "momentumInProgress",
      inProgress
    );

    setText(
      "momentumNeedsAttention",
      needsAttention
    );

    setText(
      "momentumCompleted",
      completed
    );
  }


  /* ============================================================
     FILTERS
     ============================================================ */

  function matchesFilters(enrollment) {
    const profile =
      state.profileMap.get(
        enrollment.user_id
      ) || {};

    const name =
      getProfileName(profile);

    const email =
      String(
        profile.email || ""
      );

    const query =
      state.filters.search
        .trim()
        .toLowerCase();


    if (
      query &&
      !(
        name
          .toLowerCase()
          .includes(query) ||
        email
          .toLowerCase()
          .includes(query)
      )
    ) {
      return false;
    }


    const activity =
      state.filters.activity;

    const status =
      normalizeStatus(
        enrollment.status
      );

    const inactivity =
      daysSince(
        enrollment.last_activity_at ||
        enrollment.started_at ||
        enrollment.enrolled_at
      );


    if (
      activity === "completed"
    ) {
      return status === "completed";
    }


    if (
      activity === "active"
    ) {
      return (
        status === "active" &&
        inactivity < 7
      );
    }


    if (
      activity === "inactive"
    ) {
      return (
        status === "active" &&
        inactivity >= 7
      );
    }


    return true;
  }


  /* ============================================================
     COMMUNICATION ROUTING
     ============================================================ */

  function openMessageModal() {
    const modal =
      $("engagementMessageModal");

    if (modal) {
      modal.hidden = false;
    }
  }


  function closeMessageModal() {
    const modal =
      $("engagementMessageModal");

    if (modal) {
      modal.hidden = true;
    }
  }


  function openParticipantMessage(
    userId
  ) {
    const profile =
      state.profileMap.get(
        userId
      );

    if (!profile) {
      openMessageModal();
      return;
    }


    const url =
      new URL(
        "admin-internal-chat.html",
        window.location.href
      );

    url.searchParams.set(
      "user",
      userId
    );

    url.searchParams.set(
      "course",
      state.courseId
    );

    window.location.href =
      url.pathname +
      url.search;
  }


  /* ============================================================
     UI EVENTS
     ============================================================ */

  function bindUi() {
    document
      .querySelectorAll(
        "[data-course-tab]"
      )
      .forEach(
        tab => {
          tab.addEventListener(
            "click",
            function (event) {
              event.preventDefault();

              navigateTab(
                tab.dataset.courseTab
              );
            }
          );
        }
      );


    $("engagementRefreshButton")
      ?.addEventListener(
        "click",
        async function () {
          try {
            await loadAll();
            renderAll();

            showToast(
              "Engagement data refreshed.",
              "success"
            );
          } catch (error) {
            showToast(
              error?.message ||
              "Unable to refresh engagement data.",
              "error"
            );
          }
        }
      );


    $("engagementMessageButton")
      ?.addEventListener(
        "click",
        openMessageModal
      );


    $("sendCourseEmailButton")
      ?.addEventListener(
        "click",
        function () {
          goToCommunication(
            "admin-email-marketing.html"
          );
        }
      );


    $("openCourseMessagesButton")
      ?.addEventListener(
        "click",
        function () {
          goToCommunication(
            "admin-internal-chat.html"
          );
        }
      );


    $("viewCourseNotificationsButton")
      ?.addEventListener(
        "click",
        function () {
          window.location.href =
            "admin-notifications.html?course=" +
            encodeURIComponent(state.courseId);
        }
      );


    $("messageViaEmail")
      ?.addEventListener(
        "click",
        function () {
          goToCommunication(
            "admin-email-marketing.html"
          );
        }
      );


    $("messageViaMessaging")
      ?.addEventListener(
        "click",
        function () {
          goToCommunication(
            "admin-internal-chat.html"
          );
        }
      );


    document
      .querySelectorAll(
        "[data-close-engagement-modal]"
      )
      .forEach(
        button => {
          button.addEventListener(
            "click",
            closeMessageModal
          );
        }
      );


    $("engagementMessageModal")
      ?.addEventListener(
        "click",
        function (event) {
          if (
            event.target ===
            event.currentTarget
          ) {
            closeMessageModal();
          }
        }
      );


    $("engagementActivityFilter")
      ?.addEventListener(
        "change",
        function () {
          state.filters.activity =
            this.value || "all";

          renderLearners();
        }
      );


    $("engagementSearch")
      ?.addEventListener(
        "input",
        function () {
          state.filters.search =
            this.value || "";

          renderLearners();
        }
      );
  }


  function goToCommunication(page) {
    const url =
      new URL(
        page,
        window.location.href
      );

    url.searchParams.set(
      "course",
      state.courseId
    );

    window.location.href =
      url.pathname +
      url.search;
  }


  /* ============================================================
     NAVIGATION
     ============================================================ */

  function applyLinks() {
    const preview =
      $("engagementPreviewButton");

    if (preview) {
      preview.href =
        "admin-lms-course-preview.html?course=" +
        encodeURIComponent(
          state.courseId
        );
    }

    const scopedLinks = [
      ["engagementAutomationManageButton", "admin-email-marketing.html"],
      ["engagementAssessmentsButton", "admin-lms-quizzes.html"]
    ];

    scopedLinks.forEach(([id, page]) => {
      const link = $(id);
      if (!link) return;
      const url = new URL(page, window.location.href);
      url.searchParams.set("course", state.courseId);
      link.href = url.pathname + url.search;
    });
  }


  function navigateTab(tab) {
    const pages = {
      overview:
        "admin-lms-course-overview.html",

      content:
        "admin-lms-course-builder.html",

      participants:
        "admin-lms-course-participants.html",

      settings:
        "admin-lms-course-settings.html",

      engagement:
        "admin-lms-course-engagement.html"
    };

    if (!pages[tab]) {
      return;
    }

    window.location.href =
      pages[tab] +
      "?course=" +
      encodeURIComponent(
        state.courseId
      );
  }


  /* ============================================================
     HELPERS
     ============================================================ */

  function getEngagementLevel(
    progress,
    status,
    inactivity
  ) {
    if (
      status === "completed" ||
      progress >= 100
    ) {
      return {
        label: "Completed",
        className: "high"
      };
    }


    if (inactivity >= 14) {
      return {
        label: "Needs attention",
        className: "low"
      };
    }


    if (
      inactivity >= 7 ||
      progress < 25
    ) {
      return {
        label: "Moderate",
        className: "medium"
      };
    }


    return {
      label: "Active",
      className: "high"
    };
  }


  function getProfileName(profile) {
    const display =
      String(
        profile?.display_name ||
        ""
      ).trim();

    if (display) {
      return display;
    }


    const full =
      [
        profile?.first_name,
        profile?.last_name
      ]
        .map(
          value =>
            String(
              value || ""
            ).trim()
        )
        .filter(Boolean)
        .join(" ");

    return (
      full ||
      profile?.email ||
      "Participant"
    );
  }


  function getInitials(value) {
    const parts =
      String(value || "")
        .trim()
        .split(/\s+/)
        .filter(Boolean);

    if (!parts.length) {
      return "--";
    }

    if (parts.length === 1) {
      return parts[0]
        .slice(0, 2)
        .toUpperCase();
    }

    return (
      parts[0].charAt(0) +
      parts[
        parts.length - 1
      ].charAt(0)
    ).toUpperCase();
  }


  function daysSince(value) {
    if (!value) {
      return 999;
    }

    const date =
      new Date(value);

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return 999;
    }

    return Math.floor(
      (
        Date.now() -
        date.getTime()
      ) /
      86400000
    );
  }


  function formatDate(value) {
    if (!value) {
      return "—";
    }

    const date =
      new Date(value);

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return "—";
    }

    return date.toLocaleDateString(
      undefined,
      {
        month: "short",
        day: "numeric",
        year: "numeric"
      }
    );
  }


  function normalizeStatus(value) {
    return String(
      value ||
      "active"
    )
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "_");
  }


  function titleCase(value) {
    return String(value || "")
      .replace(/[_-]+/g, " ")
      .replace(
        /\b\w/g,
        character =>
          character.toUpperCase()
      );
  }


  function number(value) {
    const result =
      Number(value);

    return Number.isFinite(result)
      ? result
      : 0;
  }


  function numberOrNull(value) {
    if (
      value === null ||
      value === undefined ||
      value === ""
    ) {
      return null;
    }

    const result =
      Number(value);

    return Number.isFinite(result)
      ? result
      : null;
  }


  function average(values) {
    if (!values.length) {
      return 0;
    }

    return (
      values.reduce(
        (sum, value) =>
          sum + number(value),
        0
      ) /
      values.length
    );
  }


  function clamp(
    value,
    min,
    max
  ) {
    return Math.max(
      min,
      Math.min(
        max,
        value
      )
    );
  }


  function setLoading(show) {
    const loading =
      $("engagementLoading");

    const content =
      $("engagementContent");

    if (loading) {
      loading.hidden = !show;
    }

    if (
      content &&
      show
    ) {
      content.hidden = true;
    }
  }


  function setText(
    id,
    value
  ) {
    const node =
      $(id);

    if (node) {
      node.textContent =
        value ?? "";
    }
  }


  function showToast(
    message,
    type
  ) {
    const toast =
      $("engagementToast");

    if (!toast) {
      return;
    }

    toast.textContent =
      message;

    toast.className =
      "engagement-toast show " +
      (type || "success");

    clearTimeout(
      showToast.timer
    );

    showToast.timer =
      setTimeout(
        function () {
          toast.classList.remove(
            "show"
          );
        },
        3400
      );
  }


  function esc(value) {
    return String(value ?? "")
      .replace(
        /[&<>"']/g,
        character =>
          ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#039;"
          })[character]
      );
  }

})();
