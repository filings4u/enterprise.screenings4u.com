/* ============================================================
   SCREENINGS4U — ADMIN LMS COURSE OVERVIEW
   ============================================================ */

(function () {
  "use strict";

  const TABLES = Object.freeze({
    courses: "lms_courses",
    sections: "lms_sections",
    lessons: "lms_lessons",
    enrollments: "lms_enrollments",
    media: "lms_media"
  });

  const state = {
    courseId: "",
    course: null,
    sections: [],
    lessons: [],
    enrollments: [],
    thumbnailMedia: null,
    thumbnailUrl: ""
  };

  const $ = (id) => document.getElementById(id);

  document.addEventListener(
    "DOMContentLoaded",
    initializeCourseOverview
  );


  /* ============================================================
     INITIALIZE
     ============================================================ */

  async function initializeCourseOverview() {
    try {
      bindStaticUi();

      const params =
        new URLSearchParams(
          window.location.search
        );

      state.courseId =
        String(params.get("course") || "").trim();

      if (!state.courseId) {
        throw new Error(
          "Open Course Overview from the selected course so its course ID is available."
        );
      }

      if (!isUuid(state.courseId)) {
        throw new Error(
          "The Course Overview URL contains an invalid course ID."
        );
      }

      applyCourseLinks();

      await loadOverviewData();

      renderOverview();

    } catch (error) {
      console.error(
        "[Course Overview]",
        error
      );

      showToast(
        error?.message ||
        "Unable to load course overview.",
        "error"
      );

      setLoading(false);
    }
  }


  /* ============================================================
     DATABASE
     ============================================================ */

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


  async function trainingReport(action, payload = {}) {
    const { data, error } = await db().auth.getSession();
    if (error) throw error;
    const token = data?.session?.access_token;
    if (!token) throw new Error("Your admin session has expired. Please sign in again.");
    const base = String(window.SCREENINGS4U_SUPABASE_URL || "https://elpbnytpciqnbexiaebp.supabase.co").replace(/\/$/, "");
    const anon = window.SCREENINGS4U_SUPABASE_ANON_KEY || window.SUPABASE_ANON_KEY || "";
    const response = await fetch(base + "/functions/v1/screenings4u-training-reporting", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + token,
        ...(anon ? { "apikey": anon } : {})
      },
      body: JSON.stringify({ action, ...payload })
    });
    const out = await response.json().catch(() => ({}));
    if (!response.ok || out?.error) throw new Error(out?.error || "Training reporting request failed.");
    return out;
  }


  async function loadOverviewData() {
    setLoading(true);
    const out = await trainingReport("course_overview", { course_id: state.courseId });
    if (!out?.course || String(out.course.id || "") !== state.courseId) {
      throw new Error("The requested course could not be loaded.");
    }

    if (out.course.admin_deleted_at) {
      throw new Error("This course has been removed from the admin portal.");
    }

    state.course = out.course;
    state.sections = (out.sections || []).filter(function (section) {
      return String(section.course_id || "") === state.courseId;
    });

    const sectionIds = new Set(state.sections.map(function (section) {
      return String(section.id || "");
    }));

    state.lessons = (out.lessons || []).filter(function (lesson) {
      return sectionIds.has(String(lesson.section_id || ""));
    });

    state.enrollments = (out.enrollments || []).filter(function (enrollment) {
      return String(enrollment.course_id || "") === state.courseId;
    });

    await loadCourseThumbnail();
    setLoading(false);
  }


  /* ============================================================
     COURSE THUMBNAIL
     Source of truth:
     lms_courses.thumbnail_media_id -> lms_media -> Storage
     ============================================================ */

  async function loadCourseThumbnail() {
    state.thumbnailMedia = null;
    state.thumbnailUrl = "";

    const mediaId =
      state.course?.thumbnail_media_id || "";

    if (!mediaId) {
      return;
    }

    try {
      if (window.S4UCourseImage?.resolveMedia) {
        const resolved =
          await window.S4UCourseImage.resolveMedia(mediaId);

        state.thumbnailMedia =
          resolved?.media || null;

        state.thumbnailUrl =
          resolved?.url || "";

        if (state.thumbnailUrl) {
          return;
        }
      }

      const mediaResult =
        await db()
          .from(TABLES.media)
          .select(
            "id,storage_bucket,storage_path,thumbnail_url,provider,provider_status,mime_type,title"
          )
          .eq("id", mediaId)
          .single();

      if (mediaResult.error) {
        throw mediaResult.error;
      }

      state.thumbnailMedia =
        mediaResult.data || null;

      state.thumbnailUrl =
        await resolveThumbnailUrl(
          state.thumbnailMedia
        );

    } catch (error) {
      console.warn(
        "[Course Overview] Course thumbnail unavailable:",
        error
      );

      state.thumbnailMedia = null;
      state.thumbnailUrl = "";
    }
  }

  async function resolveThumbnailUrl(media) {
    if (!media) {
      return "";
    }

    if (window.S4UCourseImage?.resolveMedia) {
      try {
        const resolved =
          await window.S4UCourseImage.resolveMedia(media);

        if (resolved?.url) {
          return resolved.url;
        }
      } catch (_) {}
    }

    if (
      media.thumbnail_url &&
      /^https?:\/\//i.test(media.thumbnail_url)
    ) {
      return media.thumbnail_url;
    }

    if (
      !media.storage_bucket ||
      !media.storage_path
    ) {
      return "";
    }

    const signedResult =
      await db().storage
        .from(media.storage_bucket)
        .createSignedUrl(
          media.storage_path,
          3600
        );

    if (signedResult.error) {
      throw signedResult.error;
    }

    return signedResult.data?.signedUrl || "";
  }


  /* ============================================================
     RENDER
     ============================================================ */

  function renderOverview() {
    renderHeader();
    renderCourseCard();
    renderSetupGuide();
    renderParticipantMetrics();
    renderCourseHealth();

    const content =
      $("overviewPageContent");

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
      "overviewCourseTitle",
      title
    );

    document.title =
      title + " | Course Overview | screenings4u Management Portal";

    setText(
      "overviewBreadcrumbCourse",
      title
    );

    const status =
      normalizeStatus(
        course.status
      );

    setText(
      "overviewCourseStatus",
      titleCase(status)
    );

    const statusBadge =
      $("overviewCourseStatus");

    if (statusBadge) {
      statusBadge.classList.toggle(
        "active",
        status === "published"
      );
    }

    setText(
      "overviewAccessStatus",
      status === "archived"
        ? "Archived"
        : "Active"
    );
  }


  function renderCourseCard() {
    const course =
      state.course || {};

    setText(
      "overviewSummaryTitle",
      course.title ||
      "Course"
    );

    setText(
      "overviewDuration",
      getDurationLabel(course)
    );

    setText(
      "overviewVisibility",
      getVisibilityLabel(course)
    );

    setText(
      "overviewCurriculumCount",
      state.sections.length +
      " Section" +
      (state.sections.length === 1 ? "" : "s") +
      " · " +
      state.lessons.length +
      " Lesson" +
      (state.lessons.length === 1 ? "" : "s")
    );


    setText(
      "overviewCertificateChip",
      isCertificateEnabled(course)
        ? "Certificate Enabled"
        : "Certificate Disabled"
    );


    setText(
      "overviewNavigationChip",
      getNavigationLabel(course)
    );


    const initials =
      getInitials(
        course.title ||
        "Screenings4u Course"
      );

    setText(
      "overviewThumbnailInitials",
      initials
    );


    const thumbnail =
      $("overviewThumbnail");

    if (thumbnail) {
      if (state.thumbnailUrl) {
        thumbnail.innerHTML =
          '<img src="' +
          escapeAttribute(state.thumbnailUrl) +
          '" alt="' +
          escapeAttribute(
            course.title
              ? course.title + " course image"
              : "Course image"
          ) +
          '">';
      } else {
        thumbnail.innerHTML =
          '<span id="overviewThumbnailInitials">' +
          escapeHtml(initials) +
          '</span>';
      }
    }
  }


  function renderSetupGuide() {
    const course =
      state.course || {};

    const completionConfigured =
      hasCompletionConfiguration(course);

    const checks = {
      details:
        Boolean(
          String(course.title || "").trim()
        ) &&
        Boolean(
          String(
            course.description ||
            course.short_description ||
            ""
          ).trim()
        ),

      curriculum:
        state.sections.length > 0 &&
        state.lessons.length > 0,

      completion:
        completionConfigured,

      published:
        normalizeStatus(
          course.status
        ) === "published",

      participants:
        state.enrollments.length > 0
    };


    setCheck(
      "checkDetails",
      checks.details
    );

    setCheck(
      "checkCurriculum",
      checks.curriculum
    );

    setCheck(
      "checkCompletion",
      checks.completion
    );

    setCheck(
      "checkPublished",
      checks.published
    );

    setCheck(
      "checkParticipants",
      checks.participants
    );


    const completed =
      Object.values(checks)
        .filter(Boolean)
        .length;

    const total =
      Object.keys(checks)
        .length;

    setText(
      "overviewSetupProgressText",
      completed +
      " / " +
      total
    );

    const bar =
      $("overviewSetupProgressBar");

    if (bar) {
      bar.style.width =
        total
          ? ((completed / total) * 100) + "%"
          : "0%";
    }
  }


  function renderParticipantMetrics() {
    const enrollments =
      state.enrollments || [];

    const total =
      enrollments.length;

    const completed =
      enrollments.filter(
        (row) =>
          normalizeStatus(row.status) === "completed"
      ).length;

    const inProgress =
      enrollments.filter(
        (row) => {
          const status =
            normalizeStatus(row.status);

          if (status === "completed" || row.completed_at) {
            return false;
          }

          return (
            status === "active" ||
            status === "in_progress" ||
            status === "in-progress" ||
            Boolean(row.started_at) ||
            Number(row.progress_percent || 0) > 0
          );
        }
      ).length;

    const rate =
      total > 0
        ? Math.round(
            (completed / total) * 100
          )
        : 0;

    setText(
      "metricTotalParticipants",
      total
    );

    setText(
      "metricInProgress",
      inProgress
    );

    setText(
      "metricCompleted",
      completed
    );

    setText(
      "metricCompletionRate",
      rate + "%"
    );
  }


  function renderCourseHealth() {
    const course =
      state.course || {};

    setText(
      "healthCourseStatus",
      titleCase(
        normalizeStatus(
          course.status
        )
      )
    );

    const passingScore =
      numberOrNull(
        course.passing_score
      );

    setText(
      "healthPassingScore",
      passingScore === null
        ? "—"
        : passingScore + "%"
    );

    const requiredLessons =
      state.lessons.filter(
        (lesson) =>
          Boolean(
            lesson.is_required
          )
      ).length;

    setText(
      "healthRequiredLessons",
      requiredLessons
    );

    setText(
      "healthCertificate",
      isCertificateEnabled(course)
        ? "Enabled"
        : "Disabled"
    );
  }


  /* ============================================================
     LINKS
     ============================================================ */

  function applyCourseLinks() {
    const encoded =
      encodeURIComponent(
        state.courseId
      );

    const links = {
      overviewPreviewButton:
        "admin-lms-course-preview.html?course=" + encoded,

      overviewInviteButton:
        "admin-lms-course-participants.html?course=" + encoded,

      overviewEditSettings:
        "admin-lms-course-settings.html?course=" + encoded,

      overviewFeatureSettingsLink:
        "admin-lms-course-settings.html?course=" + encoded,

      overviewViewParticipants:
        "admin-lms-course-participants.html?course=" + encoded,

      overviewInviteParticipantsSmall:
        "admin-lms-course-participants.html?course=" + encoded
    };

    Object.entries(links)
      .forEach(function ([id, href]) {
        const node = $(id);

        if (node) {
          node.href = href;
        }
      });

    const tabPages = {
      overview: "admin-lms-course-overview.html",
      content: "admin-lms-course-builder.html",
      participants: "admin-lms-course-participants.html",
      settings: "admin-lms-course-settings.html",
      engagement: "admin-lms-course-engagement.html"
    };

    document.querySelectorAll("[data-course-tab]").forEach(function (tab) {
      const page = tabPages[tab.dataset.courseTab];
      if (page) {
        tab.href = page + "?course=" + encoded;
      }
    });
  }


  /* ============================================================
     UI EVENTS
     ============================================================ */

  function bindStaticUi() {
    $("overviewMoreButton")
      ?.addEventListener(
        "click",
        function (event) {
          event.stopPropagation();

          const menu =
            $("overviewMoreMenu");

          const button =
            $("overviewMoreButton");

          if (!menu || !button) {
            return;
          }

          const opening =
            menu.hidden;

          menu.hidden =
            !opening;

          button.setAttribute(
            "aria-expanded",
            opening
              ? "true"
              : "false"
          );
        }
      );


    document.addEventListener(
      "click",
      function () {
        closeMoreMenu();
      }
    );


    document
      .querySelectorAll(
        "[data-course-tab]"
      )
      .forEach(function (tab) {
        tab.addEventListener(
          "click",
          function (event) {
            event.preventDefault();

            navigateTab(
              tab.dataset.courseTab
            );
          }
        );
      });


    document
      .querySelectorAll(
        "[data-setup-step]"
      )
      .forEach(function (button) {
        button.addEventListener(
          "click",
          function () {
            navigateSetupStep(
              button.dataset.setupStep
            );
          }
        );
      });


    $("overviewDismissGuide")
      ?.addEventListener(
        "click",
        function () {
          const card =
            document.querySelector(
              ".overview-setup-card"
            );

          if (card) {
            card.hidden = true;
          }
        }
      );


    $("overviewArchiveCourse")
      ?.addEventListener(
        "click",
        archiveCourse
      );


    $("overviewDuplicateCourse")
      ?.addEventListener(
        "click",
        function () {
          closeMoreMenu();

          showToast(
            "Course duplication is not available from Overview yet.",
            "error"
          );
        }
      );

    document.addEventListener(
      "keydown",
      function (event) {
        if (
          event.key === "Escape" &&
          !$("s4uOverviewDialogBackdrop")?.hidden
        ) {
          closeOverviewDialog(false);
        }
      }
    );
  }


  function navigateTab(tab) {
    const encoded =
      encodeURIComponent(
        state.courseId
      );

    const destinations = {
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

    const page =
      destinations[tab];

    if (!page) {
      return;
    }

    window.location.href =
      page +
      "?course=" +
      encoded;
  }


  function navigateSetupStep(step) {
    const map = {
      details: "settings",
      curriculum: "content",
      completion: "settings",
      publish: "settings",
      participants: "participants"
    };

    navigateTab(
      map[step] ||
      "overview"
    );
  }


  async function archiveCourse() {
    if (!state.courseId) {
      return;
    }

    const confirmed =
      await overviewConfirm({
        eyebrow: "COURSE MANAGEMENT",
        title: "Archive course?",
        message:
          "Archive this course? Learners should no longer see it as an active published course.",
        confirmLabel: "Archive Course",
        danger: true
      });

    if (!confirmed) {
      return;
    }

    try {
      const result =
        await db()
          .from(TABLES.courses)
          .update({
            status: "archived"
          })
          .eq(
            "id",
            state.courseId
          )
          .select("*")
          .single();

      if (result.error) {
        throw result.error;
      }

      state.course =
        result.data;

      renderHeader();
      renderSetupGuide();
      renderCourseHealth();

      closeMoreMenu();

      showToast(
        "Course archived.",
        "success"
      );

    } catch (error) {
      console.error(
        "[Course Overview] Archive:",
        error
      );

      showToast(
        error?.message ||
        "Unable to archive course.",
        "error"
      );
    }
  }


  function ensureOverviewDialog() {
    let backdrop =
      $("s4uOverviewDialogBackdrop");

    if (backdrop) {
      return backdrop;
    }

    backdrop =
      document.createElement("div");

    backdrop.id =
      "s4uOverviewDialogBackdrop";

    backdrop.className =
      "s4u-overview-dialog-backdrop";

    backdrop.hidden = true;

    backdrop.innerHTML = `
      <section
        class="s4u-overview-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="s4uOverviewDialogTitle"
      >
        <header>
          <div>
            <span
              class="s4u-overview-dialog-kicker"
              id="s4uOverviewDialogEyebrow"
            >COURSE OVERVIEW</span>

            <h2 id="s4uOverviewDialogTitle">
              Confirm
            </h2>

            <p id="s4uOverviewDialogMessage"></p>
          </div>

          <button
            type="button"
            class="s4u-overview-dialog-close"
            data-overview-dialog-cancel
            aria-label="Close"
          >×</button>
        </header>

        <div
          class="s4u-overview-dialog-body"
          id="s4uOverviewDialogBody"
        ></div>

        <footer>
          <button
            type="button"
            class="s4u-overview-dialog-btn secondary"
            data-overview-dialog-cancel
          >Cancel</button>

          <button
            type="button"
            class="s4u-overview-dialog-btn primary"
            id="s4uOverviewDialogConfirm"
          >Continue</button>
        </footer>
      </section>
    `;

    document.body.appendChild(backdrop);

    backdrop
      .querySelectorAll(
        "[data-overview-dialog-cancel]"
      )
      .forEach(function (button) {
        button.addEventListener(
          "click",
          function () {
            closeOverviewDialog(false);
          }
        );
      });

    backdrop.addEventListener(
      "click",
      function (event) {
        if (event.target === backdrop) {
          closeOverviewDialog(false);
        }
      }
    );

    return backdrop;
  }


  function closeOverviewDialog(value) {
    const backdrop =
      $("s4uOverviewDialogBackdrop");

    if (!backdrop) {
      return;
    }

    const resolver =
      backdrop._resolver;

    backdrop._resolver = null;
    backdrop.hidden = true;

    document.body.style.overflow =
      backdrop.dataset.previousOverflow || "";

    backdrop.dataset.previousOverflow = "";

    if (resolver) {
      resolver(Boolean(value));
    }
  }


  function overviewConfirm({
    eyebrow = "COURSE MANAGEMENT",
    title = "Confirm",
    message = "",
    confirmLabel = "Continue",
    danger = false
  }) {
    const backdrop =
      ensureOverviewDialog();

    setText(
      "s4uOverviewDialogEyebrow",
      eyebrow
    );

    setText(
      "s4uOverviewDialogTitle",
      title
    );

    setText(
      "s4uOverviewDialogMessage",
      message
    );

    const body =
      $("s4uOverviewDialogBody");

    if (body) {
      body.innerHTML =
        '<div class="s4u-overview-dialog-copy">' +
        escapeHtml(message) +
        "</div>";
    }

    const confirm =
      $("s4uOverviewDialogConfirm");

    if (confirm) {
      confirm.textContent =
        confirmLabel;

      confirm.classList.toggle(
        "danger",
        Boolean(danger)
      );
    }

    backdrop.hidden = false;

    backdrop.dataset.previousOverflow =
      document.body.style.overflow || "";

    document.body.style.overflow =
      "hidden";

    return new Promise(function (resolve) {
      backdrop._resolver = resolve;

      if (confirm) {
        confirm.onclick = function () {
          closeOverviewDialog(true);
        };
      }
    });
  }


  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }


  function closeMoreMenu() {
    const menu =
      $("overviewMoreMenu");

    const button =
      $("overviewMoreButton");

    if (menu) {
      menu.hidden = true;
    }

    if (button) {
      button.setAttribute(
        "aria-expanded",
        "false"
      );
    }
  }


  function isUuid(value) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      String(value || "").trim()
    );
  }


  /* ============================================================
     COURSE HELPERS
     ============================================================ */

  function getDurationLabel(course) {
    const days =
      numberOrNull(
        firstDefined(
          course.time_limit_days,
          course.duration_days,
          course.access_days
        )
      );

    if (
      days !== null &&
      days > 0
    ) {
      return days +
        " Day" +
        (days === 1 ? "" : "s");
    }

    const minutes =
      numberOrNull(
        firstDefined(
          course.estimated_minutes,
          course.duration_minutes
        )
      );

    if (
      minutes !== null &&
      minutes > 0
    ) {
      return minutes +
        " Minutes";
    }

    return "Self-Paced";
  }


  function getVisibilityLabel(course) {
    const visibility =
      firstString(
        course.visibility,
        course.access_type
      );

    if (visibility) {
      return titleCase(
        normalizeStatus(
          visibility
        )
      );
    }

    if (
      typeof course.is_public ===
      "boolean"
    ) {
      return course.is_public
        ? "Public"
        : "Private";
    }

    return "Public";
  }


  function getNavigationLabel(course) {
    const mode =
      firstString(
        course.navigation_mode,
        course.lesson_navigation_mode,
        course.progression_mode
      );

    if (!mode) {
      return "Free Navigation";
    }

    const normalized =
      normalizeStatus(mode);

    if (
      normalized === "sequential" ||
      normalized === "linear"
    ) {
      return "Sequential";
    }

    return "Free Navigation";
  }


  function isCertificateEnabled(course) {
    return Boolean(
      firstDefined(
        course.certificate_enabled,
        course.enable_certificate,
        course.has_certificate,
        false
      )
    );
  }


  function hasCompletionConfiguration(course) {
    const passingScore =
      numberOrNull(
        course.passing_score
      );

    if (passingScore !== null) {
      return true;
    }

    const knownBooleans = [
      course.require_all_lessons,
      course.require_lessons,
      course.require_assessments,
      course.certificate_enabled,
      course.enable_certificate
    ];

    if (
      knownBooleans.some(
        (value) =>
          typeof value === "boolean"
      )
    ) {
      return true;
    }

    const navigation =
      firstString(
        course.navigation_mode,
        course.progression_mode
      );

    return Boolean(navigation);
  }


  /* ============================================================
     GENERIC HELPERS
     ============================================================ */

  function setCheck(id, complete) {
    const node =
      $(id);

    if (!node) {
      return;
    }

    node.classList.toggle(
      "complete",
      Boolean(complete)
    );
  }


  function setLoading(show) {
    const loading =
      $("overviewLoading");

    const content =
      $("overviewPageContent");

    if (loading) {
      loading.hidden =
        !show;
    }

    if (
      content &&
      show
    ) {
      content.hidden = true;
    }
  }


  function showToast(
    message,
    type
  ) {
    const toast =
      $("overviewToast");

    if (!toast) {
      return;
    }

    toast.textContent =
      message;

    toast.className =
      "overview-toast show " +
      (type || "success");

    window.clearTimeout(
      showToast.timer
    );

    showToast.timer =
      window.setTimeout(
        function () {
          toast.classList.remove(
            "show"
          );
        },
        3600
      );
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


  function normalizeStatus(value) {
    return String(
      value ||
      "draft"
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
        function (character) {
          return character.toUpperCase();
        }
      );
  }


  function numberOrNull(value) {
    if (
      value === null ||
      value === undefined ||
      value === ""
    ) {
      return null;
    }

    const number =
      Number(value);

    return Number.isFinite(number)
      ? number
      : null;
  }


  function firstDefined() {
    for (
      let index = 0;
      index < arguments.length;
      index += 1
    ) {
      const value =
        arguments[index];

      if (
        value !== undefined &&
        value !== null
      ) {
        return value;
      }
    }

    return undefined;
  }


  function firstString() {
    for (
      let index = 0;
      index < arguments.length;
      index += 1
    ) {
      const value =
        arguments[index];

      if (
        typeof value === "string" &&
        value.trim()
      ) {
        return value.trim();
      }
    }

    return "";
  }


  function getInitials(value) {
    const parts =
      String(value || "")
        .trim()
        .split(/\s+/)
        .filter(Boolean);

    if (!parts.length) {
      return "SC";
    }

    if (parts.length === 1) {
      return parts[0]
        .slice(0, 2)
        .toUpperCase();
    }

    return (
      parts[0].charAt(0) +
      parts[parts.length - 1].charAt(0)
    ).toUpperCase();
  }


  function escapeAttribute(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

})();
