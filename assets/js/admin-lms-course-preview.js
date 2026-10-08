/* ============================================================
   SCREENINGS4U — ADMIN LMS COURSE PREVIEW
   Real course/section/lesson/content/media preview
   ============================================================ */

(function () {
  "use strict";

  const TABLES = Object.freeze({
    courses: "lms_courses",
    sections: "lms_sections",
    lessons: "lms_lessons",
    blocks: "lms_content_blocks",
    media: "lms_media",
    quizzes: "lms_quizzes",
    assessments: "lms_assessments"
  });

  const state = {
    courseId: "",
    activeLessonId: "",
    course: null,
    sections: [],
    lessons: [],
    blocksByLesson: new Map(),
    media: new Map(),
    quizzes: [],
    assessments: [],
    client: null
  };

  const $ = (id) => document.getElementById(id);

  document.addEventListener("DOMContentLoaded", initialize);

  async function initialize() {
    try {
      state.client = await waitForClient();

      const params = new URLSearchParams(window.location.search);

      state.courseId =
        params.get("course") ||
        params.get("course_id") ||
        "";

      state.activeLessonId =
        params.get("lesson") ||
        params.get("lesson_id") ||
        "";

      if (!isUuid(state.courseId)) {
        throw new Error("A valid course ID is required.");
      }

      bindUi();
      applyManagementLinks();
      await loadPreview();
      render();
    } catch (error) {
      console.error("[Course Preview]", error);
      setLoading(false);
      showToast(
        error?.message || "Unable to load course preview.",
        "error"
      );
    }
  }

  async function waitForClient(timeout = 5000) {
    const started = Date.now();

    while (Date.now() - started < timeout) {
      const client = resolveClient();
      if (client?.from) return client;
      await delay(75);
    }

    throw new Error("Supabase client is unavailable.");
  }

  function resolveClient() {
    const candidates = [
      window.screenings4uSupabase,
      window.supabaseClient,
      window.supabaseAdmin,
      window.supabase
    ];

    return candidates.find(
      (value) =>
        value &&
        typeof value.from === "function"
    ) || null;
  }

  function bindUi() {
    $("refreshPreviewButton")?.addEventListener(
      "click",
      refreshPreview
    );

    $("previewPreviousButton")?.addEventListener(
      "click",
      function () {
        moveActiveLesson(-1);
      }
    );

    $("previewNextButton")?.addEventListener(
      "click",
      function () {
        moveActiveLesson(1);
      }
    );

    $("previewOutlineList")?.addEventListener(
      "click",
      function (event) {
        const button =
          event.target.closest("[data-preview-lesson]");

        if (!button) return;

        selectLesson(
          button.dataset.previewLesson || ""
        );
      }
    );
  }

  function applyManagementLinks() {
    const encoded =
      encodeURIComponent(state.courseId);

    const builder =
      `admin-lms-course-builder.html?course=${encoded}`;

    const overview =
      `admin-lms-course-overview.html?course=${encoded}`;

    if ($("previewBackButton")) {
      $("previewBackButton").href = builder;
    }

    if ($("previewBreadcrumbCourse")) {
      $("previewBreadcrumbCourse").href = overview;
    }
  }

  async function refreshPreview() {
    const button =
      $("refreshPreviewButton");

    if (button) {
      button.disabled = true;
      button.textContent = "Refreshing...";
    }

    try {
      await loadPreview();
      render();
      showToast("Preview refreshed.", "success");
    } catch (error) {
      console.error("[Course Preview Refresh]", error);
      showToast(
        error?.message || "Unable to refresh preview.",
        "error"
      );
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = "Refresh Preview";
      }
    }
  }

  async function loadPreview() {
    setLoading(true);

    const { data: course, error: courseError } =
      await state.client
        .from(TABLES.courses)
        .select("*")
        .eq("id", state.courseId)
        .single();

    if (courseError) throw courseError;

    state.course = course;

    const { data: sections, error: sectionsError } =
      await state.client
        .from(TABLES.sections)
        .select("*")
        .eq("course_id", state.courseId)
        .order("sort_order", { ascending: true });

    if (sectionsError) throw sectionsError;

    state.sections = sections || [];

    const sectionIds =
      state.sections
        .map((section) => section.id)
        .filter(Boolean);

    if (!sectionIds.length) {
      state.lessons = [];
      state.blocksByLesson = new Map();
      state.media = new Map();
      state.quizzes = [];
      state.assessments = [];
      state.activeLessonId = "";
      setLoading(false);
      return;
    }

    const { data: lessons, error: lessonsError } =
      await state.client
        .from(TABLES.lessons)
        .select("*")
        .in("section_id", sectionIds)
        .order("sort_order", { ascending: true });

    if (lessonsError) throw lessonsError;

    state.lessons =
      (lessons || []).sort(compareLessons);

    const lessonIds =
      state.lessons
        .map((lesson) => lesson.id)
        .filter(Boolean);

    if (!lessonIds.length) {
      state.blocksByLesson = new Map();
      state.media = new Map();
      state.quizzes = [];
      state.assessments = [];
      state.activeLessonId = "";
      setLoading(false);
      return;
    }

    const [
      blocksResult,
      quizzesResult,
      assessmentsResult
    ] = await Promise.all([
      state.client
        .from(TABLES.blocks)
        .select("*")
        .in("lesson_id", lessonIds)
        .order("sort_order", { ascending: true }),

      state.client
        .from(TABLES.quizzes)
        .select("*")
        .in("lesson_id", lessonIds),

      state.client
        .from(TABLES.assessments)
        .select("*")
        .in("lesson_id", lessonIds)
    ]);

    if (blocksResult.error) throw blocksResult.error;
    if (quizzesResult.error) throw quizzesResult.error;
    if (assessmentsResult.error) throw assessmentsResult.error;

    state.quizzes = quizzesResult.data || [];
    state.assessments = assessmentsResult.data || [];

    state.blocksByLesson = new Map();

    (blocksResult.data || []).forEach((block) => {
      if (!state.blocksByLesson.has(block.lesson_id)) {
        state.blocksByLesson.set(block.lesson_id, []);
      }

      state.blocksByLesson.get(block.lesson_id).push(block);
    });

    const mediaIds = [
      ...new Set([
        ...(blocksResult.data || [])
          .map((block) => block.media_id)
          .filter(Boolean),

        state.course.thumbnail_media_id
      ].filter(Boolean))
    ];

    state.media = new Map();

    if (mediaIds.length) {
      const { data: mediaRows, error: mediaError } =
        await state.client
          .from(TABLES.media)
          .select("*")
          .in("id", mediaIds);

      if (mediaError) throw mediaError;

      (mediaRows || []).forEach((media) => {
        state.media.set(media.id, media);
      });
    }

    if (
      !state.activeLessonId ||
      !state.lessons.some(
        (lesson) =>
          lesson.id === state.activeLessonId
      )
    ) {
      state.activeLessonId =
        state.lessons[0]?.id || "";
    }

    setLoading(false);
  }

  function compareLessons(a, b) {
    const sectionOrder = new Map(
      state.sections.map(
        (section, index) =>
          [section.id, index]
      )
    );

    const sa =
      sectionOrder.get(a.section_id) ?? 99999;

    const sb =
      sectionOrder.get(b.section_id) ?? 99999;

    if (sa !== sb) return sa - sb;

    return (
      Number(a.sort_order || 0) -
      Number(b.sort_order || 0)
    );
  }

  function render() {
    renderCourseHeader();
    renderOutline();
    renderCourseHero();
    renderActiveLesson();
    renderInfoCards();

    const content =
      $("previewPageContent");

    if (content) {
      content.hidden = false;
    }
  }

  function renderCourseHeader() {
    const course = state.course || {};

    setText(
      "previewPageCourseTitle",
      course.title || "Course Preview"
    );

    setText(
      "previewBreadcrumbCourseName",
      course.title || "Course"
    );
  }

  async function renderCourseHero() {
    const course = state.course || {};

    setText(
      "previewHeroTitle",
      course.title || "Course"
    );

    setText(
      "previewHeroDescription",
      course.short_description ||
      course.description ||
      "Preview the learner-facing course experience."
    );

    setText(
      "previewSectionCount",
      String(state.sections.length)
    );

    setText(
      "previewLessonCount",
      String(state.lessons.length)
    );

    setText(
      "previewQuizCount",
      String(state.quizzes.length)
    );

    setText(
      "previewAssessmentCount",
      String(state.assessments.length)
    );

    const banner =
      $("previewCourseBanner");

    if (!banner) return;

    banner.classList.remove("has-image");
    banner.style.backgroundImage = "";

    const thumbnail =
      state.course.thumbnail_media_id
        ? state.media.get(
            state.course.thumbnail_media_id
          )
        : null;

    const url =
      await getMediaUrl(thumbnail);

    if (url) {
      banner.classList.add("has-image");
      banner.style.backgroundImage =
        `linear-gradient(135deg, rgba(50,90,163,.90), rgba(36,70,127,.88)), url("${cssUrl(url)}")`;
    }
  }

  function renderOutline() {
    const target =
      $("previewOutlineList");

    if (!target) return;

    if (!state.sections.length) {
      target.innerHTML =
        '<div class="preview-outline-empty">This course does not have any sections yet.</div>';

      updateProgress();
      return;
    }

    target.innerHTML =
      state.sections
        .map((section, sectionIndex) => {
          const lessons =
            state.lessons.filter(
              (lesson) =>
                lesson.section_id === section.id
            );

          return `
            <section class="preview-outline-section">
              <div class="preview-outline-section-title">
                <span class="preview-section-number">
                  ${String(sectionIndex + 1).padStart(2, "0")}
                </span>

                <span>${esc(section.title || `Section ${sectionIndex + 1}`)}</span>

                <span class="preview-section-count">
                  ${lessons.length}
                </span>
              </div>

              ${lessons.map((lesson) => `
                <button
                  type="button"
                  class="preview-outline-lesson${lesson.id === state.activeLessonId ? " active" : ""}"
                  data-preview-lesson="${esc(lesson.id)}"
                >
                  <span class="preview-lesson-icon">
                    ${lessonIcon(lesson)}
                  </span>

                  <span>${esc(lesson.title || "Untitled Lesson")}</span>
                </button>
              `).join("")}
            </section>
          `;
        })
        .join("");

    updateProgress();
  }

  async function renderActiveLesson() {
    const lesson =
      activeLesson();

    const container =
      $("previewLessonCard");

    if (!container) return;

    if (!lesson) {
      container.innerHTML = `
        <div class="preview-empty-content">
          Add a lesson in the Course Builder to preview learner content here.
        </div>
      `;

      updateNavigationButtons();
      return;
    }

    const section =
      state.sections.find(
        (item) => item.id === lesson.section_id
      );

    const sectionLessons =
      state.lessons.filter(
        (item) => item.section_id === lesson.section_id
      );

    const lessonIndex =
      sectionLessons.findIndex(
        (item) => item.id === lesson.id
      );

    setText(
      "previewLessonKicker",
      `${section?.title || "Section"} · Lesson ${Math.max(1, lessonIndex + 1)}`
    );

    setText(
      "previewLessonTitle",
      lesson.title || "Lesson"
    );

    setText(
      "previewLessonDescription",
      lesson.description || ""
    );

    const blocks =
      state.blocksByLesson.get(lesson.id) || [];

    const target =
      $("previewBlocks");

    if (target) {
      if (!blocks.length) {
        target.innerHTML = `
          <div class="preview-empty-content">
            This lesson does not contain any content blocks yet.
          </div>
        `;
      } else {
        const rendered = [];

        for (const block of blocks) {
          rendered.push(
            await renderBlock(block)
          );
        }

        target.innerHTML =
          rendered.join("");
      }
    }

    updateNavigationButtons();
    updateProgress();

    const url =
      new URL(window.location.href);

    url.searchParams.set(
      "lesson",
      lesson.id
    );

    history.replaceState(
      {},
      "",
      url
    );
  }

  async function renderBlock(block) {
    const type =
      String(block.block_type || "");

    const settings =
      block.settings || {};

    const media =
      block.media_id
        ? state.media.get(block.media_id)
        : null;

    if (type === "heading") {
      const level =
        ["h2", "h3", "h4"].includes(settings.level)
          ? settings.level
          : "h3";

      return `
        <div class="preview-block heading" style="text-align:${safeAlignment(settings.alignment)}">
          <${level}>${esc(block.content || block.title || "Heading")}</${level}>
        </div>
      `;
    }

    if (type === "text") {
      const contentFormat =
        String(settings.content_format || "").toLowerCase();

      const renderedContent =
        contentFormat === "html" || looksLikeRichHtml(block.content)
          ? sanitizePreviewRichHtml(block.content || "")
          : formatBasicText(block.content || "");

      return `
        <div class="preview-block text s4u-rich-content" style="text-align:${safeAlignment(settings.alignment)}">
          ${renderedContent}
        </div>
      `;
    }

    if (type === "divider") {
      return '<div class="preview-block divider"></div>';
    }

    if (type === "image") {
      const url =
        block.external_url ||
        await getMediaUrl(media);

      if (!url) {
        return specialCard(
          "▧",
          block.title || "Image",
          "Image is attached but does not have a previewable URL."
        );
      }

      return `
        <figure class="preview-block preview-image-frame">
          <img
            src="${escAttr(url)}"
            alt="${escAttr(settings.alt || block.title || "")}"
          >
          ${settings.caption
            ? `<figcaption class="preview-image-caption">${esc(settings.caption)}</figcaption>`
            : ""}
        </figure>
      `;
    }

    if (type === "video") {
      const url =
        media?.playback_url ||
        block.external_url ||
        await getMediaUrl(media);

      if (!url) {
        return specialCard(
          "▶",
          block.title || "Video",
          "Video is attached but is not ready for playback."
        );
      }

      return `
        <div class="preview-block preview-media-frame">
          <video
            controls
            preload="metadata"
            src="${escAttr(url)}"
          ></video>
        </div>
      `;
    }

    if (type === "audio") {
      const url =
        block.external_url ||
        await getMediaUrl(media);

      if (!url) {
        return specialCard(
          "♪",
          block.title || "Audio",
          "Audio is attached but does not have a previewable URL."
        );
      }

      return `
        <div class="preview-block preview-media-frame">
          <audio controls src="${escAttr(url)}"></audio>
        </div>
      `;
    }

    if (
      type === "download" ||
      type === "pdf"
    ) {
      const url =
        block.external_url ||
        await getMediaUrl(media);

      return fileCard(
        type === "pdf" ? "PDF" : "⇩",
        block.title ||
          media?.original_filename ||
          typeLabel(type),
        settings.description || "",
        url
      );
    }

    if (type === "link") {
      return fileCard(
        "↗",
        block.title || "Resource Link",
        settings.description || "",
        block.external_url || ""
      );
    }

    if (
      type === "embed" ||
      type === "form"
    ) {
      if (!block.external_url) {
        return specialCard(
          type === "form" ? "▤" : "</>",
          block.title || typeLabel(type),
          "No embed URL is configured."
        );
      }

      return `
        <div
          class="preview-block preview-embed-frame"
          style="min-height:${Math.max(240, Number(settings.height || (type === "form" ? 620 : 480)))}px"
        >
          <iframe
            src="${escAttr(block.external_url)}"
            title="${escAttr(block.title || typeLabel(type))}"
            loading="lazy"
            referrerpolicy="strict-origin-when-cross-origin"
          ></iframe>
        </div>
      `;
    }

    if (type === "quiz") {
      const quiz =
        state.quizzes.find(
          (item) =>
            item.id === settings.record_id ||
            item.lesson_id === block.lesson_id
        );

      return specialCard(
        "?",
        quiz?.title || block.title || "Quiz",
        quiz
          ? `Passing score: ${numberLabel(quiz.passing_score, "%")} · ${quiz.is_required ? "Required" : "Optional"}`
          : "Quiz attached to this lesson."
      );
    }

    if (type === "knowledge_check") {
      const assessment =
        state.assessments.find(
          (item) =>
            item.id === settings.record_id ||
            item.lesson_id === block.lesson_id
        );

      return specialCard(
        "✓",
        assessment?.title ||
          block.title ||
          "Assessment",
        assessment
          ? `Passing score: ${numberLabel(assessment.passing_score, "%")} · ${assessment.require_pass ? "Pass required" : "Pass optional"}`
          : "Assessment attached to this lesson."
      );
    }

    return specialCard(
      "•",
      block.title || typeLabel(type),
      "This content block is configured for the lesson."
    );
  }

  function fileCard(icon, title, description, url) {
    return `
      <div class="preview-block preview-file-card">
        <div class="preview-file-icon">${esc(icon)}</div>
        <div class="preview-file-copy">
          <strong>${esc(title)}</strong>
          ${description ? `<small>${esc(description)}</small>` : ""}
          ${url
            ? `<small><a href="${escAttr(url)}" target="_blank" rel="noopener">Open resource</a></small>`
            : "<small>Resource URL unavailable.</small>"}
        </div>
      </div>
    `;
  }

  function specialCard(icon, title, description) {
    return `
      <div class="preview-block preview-special-card">
        <div class="preview-special-icon">${esc(icon)}</div>
        <div class="preview-special-copy">
          <strong>${esc(title)}</strong>
          <small>${esc(description || "")}</small>
        </div>
      </div>
    `;
  }

  function renderInfoCards() {
    const course =
      state.course || {};

    const lesson =
      activeLesson();

    setText(
      "previewInfoStatus",
      titleCase(course.status || "draft")
    );

    setText(
      "previewInfoLesson",
      lesson?.title || "No lesson"
    );

    setText(
      "previewInfoView",
      window.innerWidth <= 760
        ? "Mobile Preview"
        : "Desktop Preview"
    );
  }

  function selectLesson(lessonId) {
    if (
      !state.lessons.some(
        (lesson) => lesson.id === lessonId
      )
    ) {
      return;
    }

    state.activeLessonId = lessonId;

    renderOutline();
    renderActiveLesson();
    renderInfoCards();
  }

  function moveActiveLesson(direction) {
    if (!state.lessons.length) return;

    const index =
      state.lessons.findIndex(
        (lesson) =>
          lesson.id === state.activeLessonId
      );

    const nextIndex =
      Math.max(
        0,
        Math.min(
          state.lessons.length - 1,
          index + direction
        )
      );

    if (nextIndex === index) return;

    selectLesson(
      state.lessons[nextIndex].id
    );
  }

  function updateNavigationButtons() {
    const index =
      state.lessons.findIndex(
        (lesson) =>
          lesson.id === state.activeLessonId
      );

    const previous =
      $("previewPreviousButton");

    const next =
      $("previewNextButton");

    if (previous) {
      previous.disabled =
        index <= 0;
    }

    if (next) {
      next.disabled =
        index < 0 ||
        index >= state.lessons.length - 1;

      next.textContent =
        index >= state.lessons.length - 1
          ? "End of Course"
          : "Next Lesson →";
    }
  }

  function updateProgress() {
    const total =
      state.lessons.length;

    const index =
      state.lessons.findIndex(
        (lesson) =>
          lesson.id === state.activeLessonId
      );

    const percent =
      total && index >= 0
        ? Math.round(
            ((index + 1) / total) * 100
          )
        : 0;

    setText(
      "previewProgressText",
      `${percent}%`
    );

    const bar =
      $("previewProgressBar");

    if (bar) {
      bar.style.width =
        `${percent}%`;
    }
  }

  function activeLesson() {
    return (
      state.lessons.find(
        (lesson) =>
          lesson.id === state.activeLessonId
      ) || null
    );
  }

  async function getMediaUrl(media) {
    if (!media) return "";

    if (media.playback_url) {
      return media.playback_url;
    }

    if (media.thumbnail_url) {
      if (media.media_type === "image") {
        return media.thumbnail_url;
      }
    }

    if (
      !media.storage_bucket ||
      !media.storage_path
    ) {
      return "";
    }

    try {
      const { data, error } =
        await state.client.storage
          .from(media.storage_bucket)
          .createSignedUrl(
            media.storage_path,
            3600
          );

      if (error) {
        console.warn(
          "[Course Preview] Media signed URL:",
          error
        );
        return "";
      }

      return data?.signedUrl || "";
    } catch (error) {
      console.warn(
        "[Course Preview] Media URL:",
        error
      );
      return "";
    }
  }

  function setLoading(show) {
    const loading =
      $("previewLoading");

    const content =
      $("previewPageContent");

    if (loading) {
      loading.hidden = !show;
    }

    if (content && show) {
      content.hidden = true;
    }
  }

  function showToast(message, type) {
    const node =
      $("previewToast");

    if (!node) return;

    node.textContent = message;
    node.className =
      `preview-toast show ${type || "success"}`;

    clearTimeout(showToast.timer);

    showToast.timer =
      setTimeout(
        () =>
          node.classList.remove("show"),
        3200
      );
  }

  function lessonIcon(lesson) {
    const hasQuiz =
      state.quizzes.some(
        (quiz) =>
          quiz.lesson_id === lesson.id
      );

    const hasAssessment =
      state.assessments.some(
        (assessment) =>
          assessment.lesson_id === lesson.id
      );

    if (hasAssessment) return "A";
    if (hasQuiz) return "Q";

    const blocks =
      state.blocksByLesson.get(lesson.id) || [];

    if (
      blocks.some(
        (block) =>
          block.block_type === "video"
      )
    ) {
      return "▶";
    }

    return "L";
  }

  function looksLikeRichHtml(value) {
    return /<\/?(?:p|div|span|strong|b|em|i|u|s|strike|ul|ol|li|a|h[1-6]|blockquote|br)\b/i
      .test(String(value || ""));
  }

  function sanitizePreviewRichHtml(value) {
    const raw = String(value || "");

    if (!raw.trim()) return "";

    const template = document.createElement("template");
    template.innerHTML = raw;

    const allowedTags = new Set([
      "P", "DIV", "SPAN", "BR",
      "STRONG", "B", "EM", "I", "U", "S", "STRIKE",
      "UL", "OL", "LI",
      "A",
      "H1", "H2", "H3", "H4", "H5", "H6",
      "BLOCKQUOTE"
    ]);

    const allowedStyleProperties = new Set([
      "color",
      "background-color",
      "font-family",
      "font-size",
      "font-weight",
      "font-style",
      "text-decoration",
      "text-align"
    ]);

    const nodes = [...template.content.querySelectorAll("*")];

    nodes.forEach((node) => {
      if (!allowedTags.has(node.tagName)) {
        node.replaceWith(...node.childNodes);
        return;
      }

      [...node.attributes].forEach((attribute) => {
        const name = attribute.name.toLowerCase();

        if (name === "style") return;

        if (node.tagName === "A" && ["href", "target", "rel"].includes(name)) {
          return;
        }

        if (
          node.tagName === "A" &&
          name === "class" &&
          String(attribute.value || "").split(/\s+/).includes("s4u-rich-cta")
        ) {
          node.setAttribute("class", "s4u-rich-cta");
          return;
        }

        if (
          node.tagName === "A" &&
          ["data-s4u-button-style", "data-s4u-button-size"].includes(name)
        ) {
          return;
        }

        node.removeAttribute(attribute.name);
      });

      if (node.hasAttribute("style")) {
        const cleaned = [];

        String(node.getAttribute("style") || "")
          .split(";")
          .forEach((declaration) => {
            const separator = declaration.indexOf(":");
            if (separator < 0) return;

            const property = declaration.slice(0, separator).trim().toLowerCase();
            const value = declaration.slice(separator + 1).trim();

            if (!allowedStyleProperties.has(property) || !value) return;

            if (/expression\s*\(|javascript:|url\s*\(/i.test(value)) return;

            cleaned.push(`${property}:${value}`);
          });

        if (cleaned.length) {
          node.setAttribute("style", cleaned.join(";"));
        } else {
          node.removeAttribute("style");
        }
      }

      if (node.tagName === "A") {
        const href = String(node.getAttribute("href") || "").trim();

        if (!/^https?:\/\//i.test(href)) {
          node.removeAttribute("href");
          node.removeAttribute("target");
          node.removeAttribute("rel");
        } else {
          node.setAttribute("target", "_blank");
          node.setAttribute("rel", "noopener noreferrer");
        }
      }
    });

    return template.innerHTML;
  }

  function formatBasicText(value) {
    let text =
      esc(value || "");

    text = text
      .replace(
        /\*\*(.+?)\*\*/g,
        "<strong>$1</strong>"
      )
      .replace(
        /\*(.+?)\*/g,
        "<em>$1</em>"
      )
      .replace(
        /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,
        '<a href="$2" target="_blank" rel="noopener">$1</a>'
      )
      .replace(/\n{2,}/g, "</p><p>")
      .replace(/\n/g, "<br>");

    return `<p>${text}</p>`;
  }

  function typeLabel(type) {
    return {
      heading: "Heading",
      text: "Text",
      video: "Video",
      audio: "Audio",
      image: "Image",
      pdf: "PDF",
      download: "File",
      link: "Link",
      embed: "Embed",
      quiz: "Quiz",
      knowledge_check: "Assessment",
      form: "Form",
      divider: "Divider"
    }[type] || "Content";
  }

  function titleCase(value) {
    return String(value || "")
      .replace(/[_-]+/g, " ")
      .replace(
        /\b\w/g,
        (character) =>
          character.toUpperCase()
      );
  }

  function numberLabel(value, suffix) {
    const number =
      Number(value);

    return Number.isFinite(number)
      ? `${number}${suffix || ""}`
      : "—";
  }

  function safeAlignment(value) {
    return ["left", "center", "right"]
      .includes(value)
        ? value
        : "left";
  }

  function setText(id, value) {
    const node = $(id);
    if (node) {
      node.textContent = value ?? "";
    }
  }

  function cssUrl(value) {
    return String(value || "")
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"');
  }

  function isUuid(value) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      .test(String(value || ""));
  }

  function delay(ms) {
    return new Promise(
      (resolve) =>
        setTimeout(resolve, ms)
    );
  }

  function esc(value) {
    return String(value ?? "")
      .replace(/[&<>"']/g, (character) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
      }[character]));
  }

  function escAttr(value) {
    return esc(value);
  }
})();
