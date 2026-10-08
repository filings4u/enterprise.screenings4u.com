/* ============================================================
   SCREENINGS4U — ADMIN LMS COURSE BUILDER
   Course workspace + draggable curriculum
   ============================================================ */

(function () {
  "use strict";

  const TABLES = Object.freeze({
    courses: "lms_courses",
    sections: "lms_sections",
    lessons: "lms_lessons",
    blocks: "lms_content_blocks",
    quizzes: "lms_quizzes",
    questions: "lms_questions",
    questionOptions: "lms_question_options",
    assessments: "lms_assessments",
    assessmentQuestions: "lms_assessment_questions",
    assessmentOptions: "lms_assessment_options"
  });

  const state = {
    courseId: "",
    course: null,
    courses: [],
    sections: [],
    activeSectionId: "",
    editingSectionId: "",
    pendingLessonType: "article",
    creatingQuiz: false,
    dragging: null,
    collapsedSectionIds: new Set(),
    editState: null
  };

  const $ = (id) => document.getElementById(id);

  document.addEventListener("DOMContentLoaded", initialize);

  async function initialize() {
    try {
      bindStaticUi();

      await waitForClient();
      await requireAdminSession();

      const params = new URLSearchParams(window.location.search);
      state.courseId =
        params.get("course") ||
        params.get("course_id") ||
        "";

      await loadCourseDirectory();
      ensureCourseSelector();

      if (state.courseId && state.courses.some((course) => course.id === state.courseId)) {
        await loadCourse();
        render();
        syncCourseSelector();
        return;
      }

      if (state.courseId) {
        const requestedCourseId = state.courseId;
        state.courseId = "";
        state.course = null;
        state.sections = [];
        state.activeSectionId = "";
        renderNoCourseSelected();
        syncCourseSelector();
        setLoading(false);
        showToast(`Course ${requestedCourseId} was not found. Return to Courses and select Edit Course again.`, "error");
        return;
      }

      if (state.courses.length === 1) {
        state.courseId = state.courses[0].id;
        const url = new URL(window.location.href);
        url.searchParams.set("course", state.courseId);
        history.replaceState({}, "", url);

        await loadCourse();
        render();
        syncCourseSelector();
        return;
      }

      state.courseId = "";
      state.course = null;
      state.sections = [];
      state.activeSectionId = "";

      renderNoCourseSelected();
      syncCourseSelector();
      setLoading(false);
    } catch (error) {
      console.error("[Course Builder]", error);
      showToast(error?.message || "Unable to load course builder.", "error");
      setLoading(false);
    }
  }

  async function waitForClient(timeout = 5000) {
    const started = Date.now();

    while (Date.now() - started < timeout) {
      try {
        const client = db();
        if (client?.from) return client;
      } catch (_) {}

      await new Promise((resolve) => setTimeout(resolve, 75));
    }

    throw new Error("Supabase client is unavailable.");
  }

  async function requireAdminSession() {
    if (window.S4UAuth?.requireSession) {
      const session = await window.S4UAuth.requireSession("admin-login.html");
      if (!session) throw new Error("Authentication required.");
      return session;
    }

    const { data, error } = await db().auth.getSession();
    if (error) throw error;

    if (!data?.session?.user) {
      window.location.replace("admin-login.html");
      throw new Error("Authentication required.");
    }

    return data.session;
  }

  function db() {
    const candidates = [
      window.supabaseClient,
      window.supabaseAdmin,
      window.supabase
    ];

    const client = candidates.find(
      (value) => value && typeof value.from === "function"
    );

    if (!client) {
      throw new Error("Supabase client is unavailable.");
    }

    return client;
  }

  function bindStaticUi() {
    $("addContentButton")?.addEventListener("click", function (event) {
      event.stopPropagation();
      toggleMenu("addContentMenu", "addContentButton");
    });

    $("courseMoreButton")?.addEventListener("click", function (event) {
      event.stopPropagation();
      toggleMenu("courseMoreMenu", "courseMoreButton");
    });

    document.addEventListener("click", function () {
      closeMenu("addContentMenu", "addContentButton");
      closeMenu("courseMoreMenu", "courseMoreButton");
      closeDynamicMenus();
    });

    $("addContentMenu")?.addEventListener("click", function (event) {
      event.stopPropagation();

      const button = event.target.closest("[data-add-kind]");
      if (!button) return;

      const kind = button.dataset.addKind || "";
      closeMenu("addContentMenu", "addContentButton");

      if (!state.courseId) {
        showToast("Select a course to manage first.", "error");
        return;
      }

      if (kind === "section") {
        openSectionModal();
        return;
      }

      if (kind === "import") {
        openImportLessonDialog();
        return;
      }

      if (kind === "quiz") {
        openQuizModal();
        return;
      }

      openLessonModal(kind);
    });

    $("emptyAddSectionButton")?.addEventListener("click", function () {
      openSectionModal();
    });

    document.querySelectorAll("[data-close-modal]").forEach(function (button) {
      button.addEventListener("click", closeModals);
    });

    $("saveSectionButton")?.addEventListener("click", saveSection);
    $("saveLessonButton")?.addEventListener("click", saveLesson);
    $("createQuizButton")?.addEventListener("click", createQuizFromCourseBuilder);

    $("sectionModal")?.addEventListener("click", function (event) {
      if (event.target === event.currentTarget) closeModals();
    });

    $("lessonModal")?.addEventListener("click", function (event) {
      if (event.target === event.currentTarget) closeModals();
    });

    $("quizModal")?.addEventListener("click", function (event) {
      if (event.target === event.currentTarget) closeModals();
    });

    document.addEventListener("keydown", function (event) {
      if (event.key !== "Escape") return;
      closeModals();
      closeDynamicMenus();
      closeMenu("addContentMenu", "addContentButton");
      closeMenu("courseMoreMenu", "courseMoreButton");
      if (!$("s4uBuilderDialogBackdrop")?.hidden) {
        closeBuilderDialog(null);
      }
    });

    document.querySelectorAll("[data-course-tab]").forEach(function (tab) {
      tab.addEventListener("click", function (event) {
        event.preventDefault();
        const target = tab.dataset.courseTab;

        const destinations = {
          overview: "admin-lms-course-overview.html",
          content: "admin-lms-course-builder.html",
          participants: "admin-lms-course-participants.html",
          settings: "admin-lms-course-settings.html",
          engagement: "admin-lms-course-engagement.html"
        };

        const page = destinations[target];
        if (!page) return;

        window.location.href = state.courseId
          ? `${page}?course=${encodeURIComponent(state.courseId)}`
          : page;
      });
    });

    $("participantsButton")?.addEventListener("click", function (event) {
      event.preventDefault();
      window.location.href = state.courseId
        ? `admin-lms-course-participants.html?course=${encodeURIComponent(state.courseId)}`
        : "admin-lms-course-participants.html";
    });

    $("previewCourseButton")?.addEventListener("click", function (event) {
      event.preventDefault();
      window.location.href = state.courseId
        ? `admin-lms-course-preview.html?course=${encodeURIComponent(state.courseId)}`
        : "admin-lms-course-preview.html";
    });

    $("archiveCourseButton")?.addEventListener("click", function () {
      archiveCourse(courseActionCourseId());
    });
    $("duplicateCourseButton")?.addEventListener("click", function () {
      duplicateCoursePlaceholder(courseActionCourseId());
    });
    $("publishCourseButton")?.addEventListener("click", publishEntireCourse);

    removeUnusedAiTools();
  }

  function toggleMenu(menuId, triggerId) {
    const menu = $(menuId);
    const trigger = $(triggerId);
    if (!menu || !trigger) return;

    const opening = menu.hidden;
    menu.hidden = !opening;
    trigger.setAttribute("aria-expanded", opening ? "true" : "false");

    if (opening && menuId === "courseMoreMenu") {
      menu.dataset.courseId = state.courseId || "";

      /* Keep the three-dot menu physically anchored to its trigger even
         when the course selector changes the width of the header actions. */
      menu.style.left = `${trigger.offsetLeft}px`;
      menu.style.right = "auto";
      menu.style.top = `${trigger.offsetTop + trigger.offsetHeight + 6}px`;
    }
  }

  function courseActionCourseId() {
    const menu = $("courseMoreMenu");
    const boundCourseId = String(menu?.dataset.courseId || "").trim();
    const currentCourseId = String(state.courseId || "").trim();

    if (!boundCourseId || boundCourseId !== currentCourseId) {
      closeMenu("courseMoreMenu", "courseMoreButton");
      showToast("The selected course changed. Open the course menu again.", "error");
      return "";
    }

    return boundCourseId;
  }

  function closeMenu(menuId, triggerId) {
    const menu = $(menuId);
    const trigger = $(triggerId);

    if (menu) menu.hidden = true;
    if (trigger) trigger.setAttribute("aria-expanded", "false");
  }

  async function loadCourseDirectory() {
    const { data, error } = await db()
      .from(TABLES.courses)
      .select("id,title,status,updated_at")
      .order("title", { ascending: true });

    if (error) throw error;
    state.courses = data || [];
  }

  function ensureCourseSelector() {
    if ($("courseManagementSelect")) return;

    const select = document.createElement("select");
    select.id = "courseManagementSelect";
    select.setAttribute("aria-label", "Select course to manage");
    select.style.minWidth = "290px";
    select.style.height = "42px";
    select.style.padding = "0 12px";
    select.style.border = "1px solid var(--course-line, #dfe5ec)";
    select.style.borderRadius = "10px";
    select.style.background = "#fff";
    select.style.color = "var(--course-ink, #172033)";
    select.style.font = "inherit";

    select.innerHTML =
      '<option value="">Select a course to manage</option>' +
      state.courses.map((course) =>
        `<option value="${esc(course.id)}">${esc(course.title || "Untitled Course")} · ${esc(humanStatus(course.status))}</option>`
      ).join("");

    select.addEventListener("change", async function () {
      closeMenu("courseMoreMenu", "courseMoreButton");
      state.courseId = select.value || "";
      state.course = null;
      state.sections = [];
      state.activeSectionId = "";

      const url = new URL(window.location.href);
      url.searchParams.delete("id");
      url.searchParams.delete("course_id");
      if (state.courseId) url.searchParams.set("course", state.courseId);
      else url.searchParams.delete("course");
      history.replaceState({}, "", url);

      if (!state.courseId) {
        renderNoCourseSelected();
        setLoading(false);
        return;
      }

      try {
        await loadCourse();
        render();
        syncCourseSelector();
      } catch (error) {
        console.error("[Course Builder] course selection", error);
        showToast(error?.message || "Unable to load selected course.", "error");
      }
    });

    const target =
      document.querySelector(".course-builder-header-actions") ||
      document.querySelector(".course-header-actions") ||
      document.querySelector(".builder-header-actions") ||
      document.querySelector(".admin-lms-topbar-right");

    if (target) {
      target.insertBefore(select, target.firstChild);
      return;
    }

    const host = $("courseTitle")?.parentElement || $("courseBreadcrumb")?.parentElement;
    if (host) {
      const wrap = document.createElement("div");
      wrap.style.marginBottom = "14px";
      wrap.appendChild(select);
      host.insertBefore(wrap, host.firstChild);
    }
  }

  function syncCourseSelector() {
    const select = $("courseManagementSelect");
    if (select) select.value = state.courseId || "";
  }

  function renderNoCourseSelected() {
    setText("courseTitle", "Content Builder");
    setText("courseBreadcrumb", "Content Builder");
    setText("courseStatusBadge", "Select Course");

    const badge = $("courseStatusBadge");
    if (badge) badge.classList.remove("live");

    const target = $("courseCurriculum");
    const empty = $("courseEmpty");

    if (target) {
      target.hidden = true;
      target.innerHTML = "";
    }

    if (empty) {
      empty.hidden = false;
      const title = empty.querySelector("h2, h3, strong");
      const copy = empty.querySelector("p");
      if (title) title.textContent = "Select a course";
      if (copy) copy.textContent = "Choose a course above to manage its sections and lessons.";
    }
  }

  function humanStatus(value) {
    return String(value || "draft")
      .replace(/_/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  async function loadCourse() {
    setLoading(true);

    const { data: course, error: courseError } = await db()
      .from(TABLES.courses)
      .select("*")
      .eq("id", state.courseId)
      .single();

    if (courseError) throw courseError;

    const { data: sections, error: sectionError } = await db()
      .from(TABLES.sections)
      .select(`
        *,
        lms_lessons (
          *
        )
      `)
      .eq("course_id", state.courseId)
      .order("sort_order", { ascending: true });

    if (sectionError) throw sectionError;

    state.course = course;

    const { data: editState, error: editStateError } = await db()
      .rpc("enterprise_training_course_edit_state", { p_course_id: state.courseId });
    if (editStateError) throw editStateError;
    state.editState = editState || null;

    state.sections = (sections || []).map(function (section) {
      return {
        ...section,
        lms_lessons: (section.lms_lessons || []).sort(function (a, b) {
          return number(a.sort_order) - number(b.sort_order);
        })
      };
    });

    state.activeSectionId =
      state.activeSectionId ||
      state.sections[0]?.id ||
      "";

    setLoading(false);
  }

  function render() {
    renderCourseHeader();
    renderCurriculum();
    populateSectionSelect();
    ensureCourseSelector();
    syncCourseSelector();
  }

  function renderCourseHeader() {
    const course = state.course || {};
    const title = course.title || "Course";
    const status = String(course.status || "draft");

    setText("courseTitle", title);
    setText("courseBreadcrumb", title);
    setText(
      "courseStatusBadge",
      status.charAt(0).toUpperCase() + status.slice(1)
    );

    const statusBadge = $("courseStatusBadge");
    if (statusBadge) {
      statusBadge.classList.toggle("live", status === "published");
    }

    const publishButton = $("publishCourseButton");
    if (publishButton) {
      publishButton.textContent = status === "published" ? "Save Published Course" : "Publish Course";
    }

    const addContentButton = $("addContentButton");
    if (addContentButton) addContentButton.title = "Add course content";
  }

  function renderCurriculum() {
    const target = $("courseCurriculum");
    const empty = $("courseEmpty");
    if (!target || !empty) return;

    if (!state.sections.length) {
      target.hidden = true;
      empty.hidden = false;
      return;
    }

    empty.hidden = true;
    target.hidden = false;

    target.innerHTML = state.sections
      .map(sectionTemplate)
      .join("");

    bindCurriculumUi();
  }

  function sectionTemplate(section, sectionIndex) {
    const lessons = section.lms_lessons || [];
    const selected = state.activeSectionId === section.id;
    const collapsed = state.collapsedSectionIds.has(section.id);

    return `
      <article
        class="curriculum-section${selected ? " selected" : ""}${collapsed ? " collapsed" : ""}"
        data-section-id="${esc(section.id)}"
        draggable="true"
      >
        <header class="curriculum-section-header">
          <span class="drag-handle" aria-hidden="true" title="Drag section">⋮⋮</span>

          <div class="curriculum-section-copy">
            <div class="curriculum-section-title">
              ${esc(section.title || `Section ${sectionIndex + 1}`)}
            </div>
            <div class="curriculum-section-meta">
              ${lessons.length} step${lessons.length === 1 ? "" : "s"}
            </div>
          </div>

          <div class="curriculum-section-actions">
            <button
              type="button"
              class="curriculum-icon-action"
              data-section-more="${esc(section.id)}"
              aria-label="Section actions"
              aria-haspopup="menu"
            >•••</button>

            <button
              type="button"
              class="curriculum-icon-action curriculum-toggle-action"
              data-toggle-section="${esc(section.id)}"
              aria-label="${collapsed ? "Expand" : "Collapse"} section"
              aria-expanded="${collapsed ? "false" : "true"}"
              title="${collapsed ? "Expand section" : "Collapse section"}"
            >${collapsed ? "⌄" : "⌃"}</button>
          </div>
        </header>

        <div
          class="curriculum-section-body"
          data-section-body-for="${esc(section.id)}"
          ${collapsed ? "hidden" : ""}
        >
          <div
            class="curriculum-lessons"
            data-lessons-for="${esc(section.id)}"
            data-lesson-drop-section="${esc(section.id)}"
          >
            ${lessons.map(lessonTemplate).join("")}
          </div>

          <div
            class="section-add-row"
            data-lesson-drop-section="${esc(section.id)}"
          >
            <button type="button" data-add-lesson="${esc(section.id)}">＋ Add Step</button>
            <button type="button" data-import-lesson="${esc(section.id)}">⇩ Import Step</button>
          </div>
        </div>
      </article>
    `;
  }

  function lessonTemplate(lesson) {
    return `
      <article
        class="curriculum-lesson"
        data-lesson-id="${esc(lesson.id)}"
        data-section-id="${esc(lesson.section_id)}"
        draggable="true"
      >
        <span class="drag-handle" aria-hidden="true" title="Drag step">⋮⋮</span>

        <div class="curriculum-lesson-copy">
          <div class="curriculum-lesson-title">
            ${esc(lesson.title || "Untitled step")}
            <span class="lesson-type-badge">${esc(humanStatus(lesson.status || "draft"))}</span>
          </div>

          <div class="curriculum-lesson-meta">
            ${esc(humanStatus(lesson.status || "draft"))}
            ${lesson.is_required ? " · Required" : ""}
            ${lesson.completion_required ? " · Completion required" : ""}
          </div>
        </div>

        <div class="curriculum-lesson-actions">
          <button
            type="button"
            class="curriculum-icon-action"
            data-lesson-more="${esc(lesson.id)}"
            aria-label="Lesson actions"
            aria-haspopup="menu"
          >•••</button>
        </div>
      </article>
    `;
  }

  function bindCurriculumUi() {
    document.querySelectorAll("[data-section-id].curriculum-section").forEach(function (section) {
      section.addEventListener("click", function (event) {
        if (event.target.closest("button") || event.target.closest(".curriculum-lesson")) return;
        state.activeSectionId = section.dataset.sectionId || "";
        renderCurriculum();
      });

      section.addEventListener("dragstart", beginSectionDrag);
      section.addEventListener("dragover", overSectionDrag);
      section.addEventListener("dragleave", clearDragTarget);
      section.addEventListener("drop", dropSection);
      section.addEventListener("dragend", endDrag);
    });

    document.querySelectorAll("[data-lesson-id].curriculum-lesson").forEach(function (lesson) {
      lesson.addEventListener("dragstart", beginLessonDrag);
      lesson.addEventListener("dragover", overLessonDrag);
      lesson.addEventListener("dragleave", clearDragTarget);
      lesson.addEventListener("drop", dropLesson);
      lesson.addEventListener("dragend", endDrag);
    });

    document.querySelectorAll("[data-lesson-drop-section]").forEach(function (dropZone) {
      dropZone.addEventListener("dragover", overLessonSectionDrop);
      dropZone.addEventListener("drop", dropLessonIntoSection);
      dropZone.addEventListener("dragleave", clearDragTarget);
    });

    document.querySelectorAll("[data-add-lesson]").forEach(function (button) {
      button.addEventListener("click", function () {
        state.activeSectionId = button.dataset.addLesson || "";
        openLessonModal("article");
      });
    });

    document.querySelectorAll("[data-toggle-section]").forEach(function (button) {
      button.addEventListener("click", function (event) {
        event.stopPropagation();

        const id = button.dataset.toggleSection || "";
        if (!id) return;

        if (state.collapsedSectionIds.has(id)) {
          state.collapsedSectionIds.delete(id);
        } else {
          state.collapsedSectionIds.add(id);
        }

        const body = document.querySelector(
          `[data-section-body-for="${cssEsc(id)}"]`
        );

        const collapsed = state.collapsedSectionIds.has(id);

        if (body) body.hidden = collapsed;

        const section = button.closest(".curriculum-section");
        section?.classList.toggle("collapsed", collapsed);

        button.textContent = collapsed ? "⌄" : "⌃";
        button.setAttribute("aria-expanded", collapsed ? "false" : "true");
        button.setAttribute("aria-label", collapsed ? "Expand section" : "Collapse section");
        button.title = collapsed ? "Expand section" : "Collapse section";
      });
    });

    document.querySelectorAll("[data-import-lesson]").forEach(function (button) {
      button.addEventListener("click", function () {
        state.activeSectionId = button.dataset.importLesson || "";
        openImportLessonDialog();
      });
    });

    document.querySelectorAll("[data-section-more]").forEach(function (button) {
      button.addEventListener("click", function (event) {
        event.stopPropagation();
        openSectionActionMenu(button, button.dataset.sectionMore || "");
      });
    });

    document.querySelectorAll("[data-lesson-more]").forEach(function (button) {
      button.addEventListener("click", function (event) {
        event.stopPropagation();
        openLessonActionMenu(button, button.dataset.lessonMore || "");
      });
    });
  }

  function beginSectionDrag(event) {
    if (event.target.closest(".curriculum-lesson")) {
      event.preventDefault();
      return;
    }

    const section = event.currentTarget;

    state.dragging = {
      kind: "section",
      id: section.dataset.sectionId
    };

    section.classList.add("dragging");

    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", `section:${section.dataset.sectionId || ""}`);
    }
  }

  function overSectionDrag(event) {
    if (state.dragging?.kind !== "section") return;

    event.preventDefault();
    event.stopPropagation();

    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = "move";
    }

    event.currentTarget.classList.add("drag-target");
  }

  async function dropSection(event) {
    if (state.dragging?.kind !== "section") return;

    event.preventDefault();
    event.stopPropagation();

    const targetId = event.currentTarget.dataset.sectionId;
    const sourceId = state.dragging.id;

    if (!sourceId || !targetId || sourceId === targetId) {
      endDrag();
      return;
    }

    reorderArray(state.sections, sourceId, targetId);
    renderCurriculum();

    try {
      await persistSectionOrder();
      showToast("Section order saved.", "success");
    } catch (error) {
      console.error("[Section Drag]", error);
      await loadCourse();
      render();
      showToast("Section order could not be saved.", "error");
    } finally {
      endDrag();
    }
  }

  function beginLessonDrag(event) {
    event.stopPropagation();

    const lesson = event.currentTarget;

    state.dragging = {
      kind: "lesson",
      id: lesson.dataset.lessonId,
      sectionId: lesson.dataset.sectionId
    };

    lesson.classList.add("dragging");

    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", `lesson:${lesson.dataset.lessonId || ""}`);
    }
  }

  function overLessonDrag(event) {
    if (state.dragging?.kind !== "lesson") return;

    event.preventDefault();
    event.stopPropagation();

    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = "move";
    }

    event.currentTarget.classList.add("drag-target");
  }

  async function dropLesson(event) {
    if (state.dragging?.kind !== "lesson") return;

    event.preventDefault();
    event.stopPropagation();

    const targetLessonId = event.currentTarget.dataset.lessonId || "";
    const targetSectionId = event.currentTarget.dataset.sectionId || "";
    const sourceLessonId = state.dragging.id || "";
    const sourceSectionId = state.dragging.sectionId || "";

    if (!sourceLessonId || !targetLessonId || sourceLessonId === targetLessonId || !targetSectionId) {
      endDrag();
      return;
    }

    const sourceSection = state.sections.find((item) => item.id === sourceSectionId);
    const targetSection = state.sections.find((item) => item.id === targetSectionId);

    if (!sourceSection || !targetSection) {
      endDrag();
      return;
    }

    const sourceLessons = sourceSection.lms_lessons || [];
    const sourceIndex = sourceLessons.findIndex((item) => item.id === sourceLessonId);

    if (sourceIndex < 0) {
      endDrag();
      return;
    }

    const [movedLesson] = sourceLessons.splice(sourceIndex, 1);
    const targetLessons = targetSection.lms_lessons || [];
    const targetIndex = targetLessons.findIndex((item) => item.id === targetLessonId);

    if (targetIndex < 0) {
      sourceLessons.splice(sourceIndex, 0, movedLesson);
      endDrag();
      return;
    }

    movedLesson.section_id = targetSectionId;
    targetLessons.splice(targetIndex, 0, movedLesson);

    renderCurriculum();

    try {
      if (sourceSectionId !== targetSectionId) {
        const { error: moveError } = await db()
          .from(TABLES.lessons)
          .update({
            section_id: targetSectionId,
            updated_at: new Date().toISOString()
          })
          .eq("id", sourceLessonId);

        if (moveError) throw moveError;

        await persistLessonOrder(sourceSection);
      }

      await persistLessonOrder(targetSection);

      state.activeSectionId = targetSectionId;
      showToast("Lesson order saved.", "success");
    } catch (error) {
      console.error("[Lesson Drag]", error);
      await loadCourse();
      render();
      showToast("Lesson order could not be saved.", "error");
    } finally {
      endDrag();
    }
  }

  function overLessonSectionDrop(event) {
    if (state.dragging?.kind !== "lesson") return;

    if (event.target.closest(".curriculum-lesson")) return;

    event.preventDefault();
    event.stopPropagation();

    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = "move";
    }

    event.currentTarget.classList.add("drag-target");
  }

  async function dropLessonIntoSection(event) {
    if (state.dragging?.kind !== "lesson") return;

    if (event.target.closest(".curriculum-lesson")) return;

    event.preventDefault();
    event.stopPropagation();

    const targetSectionId = event.currentTarget.dataset.lessonDropSection || "";
    const sourceSectionId = state.dragging.sectionId || "";
    const sourceLessonId = state.dragging.id || "";

    if (!targetSectionId || !sourceLessonId) {
      endDrag();
      return;
    }

    const sourceSection = state.sections.find((item) => item.id === sourceSectionId);
    const targetSection = state.sections.find((item) => item.id === targetSectionId);

    if (!sourceSection || !targetSection) {
      endDrag();
      return;
    }

    const sourceLessons = sourceSection.lms_lessons || [];
    const sourceIndex = sourceLessons.findIndex((item) => item.id === sourceLessonId);

    if (sourceIndex < 0) {
      endDrag();
      return;
    }

    const [movedLesson] = sourceLessons.splice(sourceIndex, 1);
    movedLesson.section_id = targetSectionId;

    targetSection.lms_lessons = targetSection.lms_lessons || [];
    targetSection.lms_lessons.push(movedLesson);

    renderCurriculum();

    try {
      if (sourceSectionId !== targetSectionId) {
        const { error: moveError } = await db()
          .from(TABLES.lessons)
          .update({
            section_id: targetSectionId,
            updated_at: new Date().toISOString()
          })
          .eq("id", sourceLessonId);

        if (moveError) throw moveError;

        await persistLessonOrder(sourceSection);
      }

      await persistLessonOrder(targetSection);

      state.activeSectionId = targetSectionId;
      showToast("Lesson moved.", "success");
    } catch (error) {
      console.error("[Lesson Section Drop]", error);
      await loadCourse();
      render();
      showToast("Lesson move could not be saved.", "error");
    } finally {
      endDrag();
    }
  }

  function clearDragTarget(event) {
    event.currentTarget.classList.remove("drag-target");
  }

  function endDrag() {
    document.querySelectorAll(".dragging, .drag-target").forEach(function (node) {
      node.classList.remove("dragging", "drag-target");
    });

    state.dragging = null;
  }

  function reorderArray(items, sourceId, targetId) {
    const from = items.findIndex((item) => item.id === sourceId);
    const to = items.findIndex((item) => item.id === targetId);

    if (from < 0 || to < 0) return;

    const [moved] = items.splice(from, 1);
    items.splice(to, 0, moved);
  }

  async function persistSectionOrder() {
    if (!(await ensureEditableCourse())) return;
    for (let index = 0; index < state.sections.length; index += 1) {
      const section = state.sections[index];

      const { error } = await db()
        .from(TABLES.sections)
        .update({ sort_order: index + 1 })
        .eq("id", section.id);

      if (error) throw error;
      section.sort_order = index + 1;
    }
  }

  async function persistLessonOrder(section) {
    if (!(await ensureEditableCourse())) return;
    const lessons = section?.lms_lessons || [];

    for (let index = 0; index < lessons.length; index += 1) {
      const lesson = lessons[index];

      const { error } = await db()
        .from(TABLES.lessons)
        .update({
          section_id: section.id,
          sort_order: index + 1
        })
        .eq("id", lesson.id);

      if (error) throw error;

      lesson.section_id = section.id;
      lesson.sort_order = index + 1;
    }
  }

  async function openSectionModal(sectionId = "") {
    if (!(await ensureEditableCourse())) return;
    // Event listeners can pass a PointerEvent as the first argument.
    // A section ID must always be a string UUID or an empty string.
    if (typeof sectionId !== "string") {
      sectionId = "";
    }

    if (!state.courseId) {
      showToast("Select a course to manage first.", "error");
      return;
    }

    state.editingSectionId = sectionId;

    const section = state.sections.find((item) => item.id === sectionId);

    setText(
      "sectionModalTitle",
      section ? "Edit section" : "Add section"
    );

    $("sectionTitleInput").value = section?.title || "";
    $("sectionDescriptionInput").value = section?.description || "";

    $("sectionModal").hidden = false;
    setTimeout(() => $("sectionTitleInput")?.focus(), 0);
  }

  async function openLessonModal(kind = "article") {
    if (!(await ensureEditableCourse())) return;
    if (!state.sections.length) {
      showToast("Add a section before creating a lesson.", "error");
      openSectionModal();
      return;
    }

    state.pendingLessonType = normalizeLessonType(kind);

    populateSectionSelect();

    $("lessonTitleInput").value = "";
    if ($("lessonTypeSelect")) {
      $("lessonTypeSelect").value = state.pendingLessonType;
      $("lessonTypeSelect").disabled = true;
      $("lessonTypeSelect").title =
        "Create the lesson here, then choose video, text, file, embed, quiz, assessment, or Cloudflare content in the Lesson Editor.";
    }
    $("lessonRequiredInput").checked = true;

    if (state.activeSectionId) {
      $("lessonSectionSelect").value = state.activeSectionId;
    }

    $("lessonModal").hidden = false;
    setTimeout(() => $("lessonTitleInput")?.focus(), 0);
  }

  async function openQuizModal() {
    if (!(await ensureEditableCourse())) return;
    if (!state.courseId) {
      showToast("Select a course to manage first.", "error");
      return;
    }

    if (!state.sections.length) {
      showToast("Add a section before creating a quiz.", "error");
      openSectionModal();
      return;
    }

    const select = $("quizSectionSelect");

    if (select) {
      select.innerHTML = state.sections
        .map((section) =>
          `<option value="${esc(section.id)}">${esc(section.title || "Untitled Section")}</option>`
        )
        .join("");

      select.value =
        state.activeSectionId ||
        state.sections[0]?.id ||
        "";
    }

    if ($("quizTitleInput")) $("quizTitleInput").value = "";
    if ($("quizDescriptionInput")) $("quizDescriptionInput").value = "";
    if ($("quizPassingScoreInput")) $("quizPassingScoreInput").value = "80";
    if ($("quizAttemptLimitInput")) $("quizAttemptLimitInput").value = "0";
    if ($("quizRequiredInput")) $("quizRequiredInput").checked = true;

    $("quizModal").hidden = false;

    window.setTimeout(() => {
      $("quizTitleInput")?.focus();
    }, 0);
  }


  async function createQuizFromCourseBuilder() {
    if (state.creatingQuiz) return;

    const title = $("quizTitleInput")?.value.trim() || "";
    const sectionId = $("quizSectionSelect")?.value || "";
    const description = $("quizDescriptionInput")?.value.trim() || null;
    const passingScore = clampQuizNumber(
      $("quizPassingScoreInput")?.value,
      0,
      100,
      80
    );
    const attemptLimit = quizAttemptLimit(
      $("quizAttemptLimitInput")?.value
    );
    const required = $("quizRequiredInput")?.checked !== false;

    if (!title) {
      showToast("Enter a quiz title.", "error");
      $("quizTitleInput")?.focus();
      return;
    }

    const section = state.sections.find((item) => item.id === sectionId);

    if (!section) {
      showToast("Choose a valid section.", "error");
      return;
    }

    state.creatingQuiz = true;

    const button = $("createQuizButton");
    if (button) {
      button.disabled = true;
      button.textContent = "Creating Quiz...";
    }

    let createdLessonId = "";

    try {
      const { data: lesson, error: lessonError } = await db()
        .from(TABLES.lessons)
        .insert({
          section_id: sectionId,
          title,
          description: null,
          status: "draft",
          sort_order: (section.lms_lessons || []).length + 1,
          is_required: required,
          completion_required: true,
          lock_until_previous_complete: false,
          estimated_minutes: null,
          updated_at: new Date().toISOString()
        })
        .select("*")
        .single();

      if (lessonError) throw lessonError;

      createdLessonId = lesson.id;

      const { data: quiz, error: quizError } = await db()
        .from(TABLES.quizzes)
        .insert({
          lesson_id: lesson.id,
          title,
          description,
          passing_score: passingScore,
          attempt_limit: attemptLimit,
          randomize_questions: false,
          randomize_answers: false,
          show_correct_answers: true,
          show_explanations: true,
          is_required: required,
          updated_at: new Date().toISOString()
        })
        .select("*")
        .single();

      if (quizError) throw quizError;

      const { error: blockError } = await db()
        .from(TABLES.blocks)
        .insert({
          lesson_id: lesson.id,
          block_type: "quiz",
          title: quiz.title,
          sort_order: 1,
          content: null,
          media_id: null,
          external_url: null,
          settings: {
            record_id: quiz.id
          },
          is_required: required,
          updated_at: new Date().toISOString()
        });

      if (blockError) throw blockError;

      closeModals();

      window.location.href =
        `admin-lms-quiz-builder.html?course=${encodeURIComponent(state.courseId)}` +
        `&lesson=${encodeURIComponent(lesson.id)}` +
        `&quiz=${encodeURIComponent(quiz.id)}`;

    } catch (error) {
      console.error("[Create Quiz]", error);

      /*
       * If the quiz insert fails after creating the shell lesson, remove
       * that shell so the course builder is not left with an empty step.
       */
      if (createdLessonId) {
        try {
          await db()
            .from(TABLES.lessons)
            .delete()
            .eq("id", createdLessonId);
        } catch (_) {}
      }

      showToast(
        error?.message || "Unable to create quiz.",
        "error"
      );

    } finally {
      state.creatingQuiz = false;

      if (button) {
        button.disabled = false;
        button.textContent = "Create Quiz";
      }
    }
  }


  function quizAttemptLimit(value) {
    if (value === "" || value == null) return null;

    const number = Number(value);
    if (!Number.isFinite(number)) return null;

    const attempts = Math.round(number);
    return attempts >= 1 ? attempts : null;
  }


  function clampQuizNumber(value, minimum, maximum, fallback) {
    const number = Number(value);

    if (!Number.isFinite(number)) return fallback;

    return Math.min(
      maximum,
      Math.max(minimum, Math.round(number))
    );
  }


  function courseIsLocked() {
    return false;
  }

  async function ensureEditableCourse() {
    // Existing course IDs are edited in place. New course records are created
    // only from the explicit Create Course or Duplicate Course actions.
    return true;
  }

  function closeModals() {
    if ($("sectionModal")) $("sectionModal").hidden = true;
    if ($("lessonModal")) $("lessonModal").hidden = true;
    if ($("quizModal")) $("quizModal").hidden = true;
  }

  async function saveSection() {
    const title = $("sectionTitleInput").value.trim();
    const description = $("sectionDescriptionInput").value.trim();

    if (!title) {
      showToast("Enter a section name.", "error");
      return;
    }

    const button = $("saveSectionButton");
    button.disabled = true;

    try {
      let result;

      if (
        typeof state.editingSectionId === "string" &&
        state.editingSectionId.trim()
      ) {
        result = await db()
          .from(TABLES.sections)
          .update({
            title,
            description: description || null
          })
          .eq("id", state.editingSectionId)
          .select("*")
          .single();
      } else {
        result = await db()
          .from(TABLES.sections)
          .insert({
            course_id: state.courseId,
            title,
            description: description || null,
            sort_order: state.sections.length + 1,
            is_published: true
          })
          .select("*")
          .single();
      }

      if (result.error) throw result.error;

      closeModals();
      await loadCourse();
      state.activeSectionId = result.data.id;
      render();

      showToast(
        state.editingSectionId ? "Section updated." : "Section added.",
        "success"
      );

      state.editingSectionId = "";
    } catch (error) {
      console.error(error);
      showToast(error?.message || "Unable to save section.", "error");
    } finally {
      button.disabled = false;
    }
  }

  async function saveLesson() {
    const title = $("lessonTitleInput")?.value.trim() || "";
    const sectionId = $("lessonSectionSelect")?.value || "";
    const required = $("lessonRequiredInput")?.checked !== false;

    if (!state.courseId) {
      showToast("Select a course to manage first.", "error");
      return;
    }

    if (!title) {
      showToast("Enter a step name.", "error");
      return;
    }

    const section = state.sections.find((item) => item.id === sectionId);

    if (!section) {
      showToast("Choose a section.", "error");
      return;
    }

    const button = $("saveLessonButton");
    if (button) button.disabled = true;

    try {
      const { data, error } = await db()
        .from(TABLES.lessons)
        .insert({
          section_id: sectionId,
          title,
          description: null,
          status: "draft",
          sort_order: (section.lms_lessons || []).length + 1,
          is_required: required,
          completion_required: true,
          lock_until_previous_complete: false,
          estimated_minutes: null,
          updated_at: new Date().toISOString()
        })
        .select("*")
        .single();

      if (error) throw error;

      closeModals();
      await loadCourse();
      state.activeSectionId = sectionId;
      render();

      showToast("Lesson created. Opening the lesson editor...", "success");

      window.setTimeout(function () {
        window.location.href =
          `admin-lms-lesson-builder.html?course=${encodeURIComponent(state.courseId)}&lesson=${encodeURIComponent(data.id)}`;
      }, 250);
    } catch (error) {
      console.error(error);
      showToast(error?.message || "Unable to create lesson.", "error");
    } finally {
      if (button) button.disabled = false;
    }
  }

  function populateSectionSelect() {
    const select = $("lessonSectionSelect");
    if (!select) return;

    select.innerHTML = state.sections.map(function (section) {
      return `<option value="${esc(section.id)}">${esc(section.title || "Section")}</option>`;
    }).join("");
  }


  async function publishEntireCourse() {
    closeMenu("courseMoreMenu", "courseMoreButton");
    if (courseIsLocked()) {
      await ensureEditableCourse();
      return;
    }

    if (!state.courseId || !state.course) {
      showToast("Select a course first.", "error");
      return;
    }

    if (!state.sections.length) {
      showToast(
        "Add at least one section before publishing this course.",
        "error"
      );
      return;
    }

    const lessonIds =
      state.sections.flatMap(
        (section) =>
          (section.lms_lessons || [])
            .map((lesson) => lesson.id)
            .filter(Boolean)
      );

    if (!lessonIds.length) {
      showToast(
        "Add at least one lesson before publishing this course.",
        "error"
      );
      return;
    }

    const confirmed = await builderConfirm({
      eyebrow: "PUBLISH COURSE",
      title:
        state.course.status === "published"
          ? "Publish all course updates?"
          : "Publish this entire course?",
      message:
        "This publishes the course, every section, every lesson, and every assessment. " +
        "Customers, employers, and employees who already have course access through their LMS enrollment will be able to see the published training.",
      confirmLabel:
        state.course.status === "published"
          ? "Publish Updates"
          : "Publish Course"
    });

    if (!confirmed) return;

    const button = $("publishCourseButton");
    const originalText =
      button?.textContent ||
      "Publish Course";

    if (button) {
      button.disabled = true;
      button.textContent = "Publishing...";
    }

    /*
     * Snapshot the current authored publication states so a failed
     * multi-table publish can be restored as closely as possible.
     */
    let courseSnapshot = null;
    let sectionSnapshot = [];
    let lessonSnapshot = [];
    let assessmentSnapshot = [];

    try {
      const [
        courseResult,
        sectionResult,
        lessonResult,
        assessmentResult
      ] = await Promise.all([
        db()
          .from(TABLES.courses)
          .select("id,status,published_at")
          .eq("id", state.courseId)
          .single(),

        db()
          .from(TABLES.sections)
          .select("id,is_published")
          .eq("course_id", state.courseId),

        db()
          .from(TABLES.lessons)
          .select("id,status")
          .in("id", lessonIds),

        db()
          .from(TABLES.assessments)
          .select("id,status")
          .in("lesson_id", lessonIds)
      ]);

      if (courseResult.error) throw courseResult.error;
      if (sectionResult.error) throw sectionResult.error;
      if (lessonResult.error) throw lessonResult.error;
      if (assessmentResult.error) throw assessmentResult.error;

      courseSnapshot = courseResult.data || null;
      sectionSnapshot = sectionResult.data || [];
      lessonSnapshot = lessonResult.data || [];
      assessmentSnapshot = assessmentResult.data || [];

      const now =
        new Date().toISOString();

      /*
       * Publish children first. The course itself is published last,
       * so learner-facing RLS never sees a published course whose
       * curriculum is still partly draft.
       */
      const { error: sectionError } = await db()
        .from(TABLES.sections)
        .update({
          is_published: true,
          updated_at: now
        })
        .eq("course_id", state.courseId);

      if (sectionError) throw sectionError;

      const { error: lessonError } = await db()
        .from(TABLES.lessons)
        .update({
          status: "published",
          updated_at: now
        })
        .in("id", lessonIds);

      if (lessonError) throw lessonError;

      if (assessmentSnapshot.length) {
        const assessmentIds =
          assessmentSnapshot.map(
            (assessment) =>
              assessment.id
          );

        const { error: assessmentError } = await db()
          .from(TABLES.assessments)
          .update({
            status: "published",
            updated_at: now
          })
          .in("id", assessmentIds);

        if (assessmentError) {
          throw assessmentError;
        }
      }

      const { data: publishedCourse, error: courseError } = await db()
        .from(TABLES.courses)
        .update({
          status: "published",
          published_at: now,
          updated_at: now
        })
        .eq("id", state.courseId)
        .select("*")
        .single();

      if (courseError) throw courseError;

      state.course = publishedCourse;

      await loadCourseDirectory();
      await loadCourse();
      render();

      showToast(
        "Course published. Existing enrolled customers and employees can now access the published training.",
        "success"
      );

    } catch (error) {
      console.error(
        "[Publish Entire Course]",
        error
      );

      /*
       * Best-effort rollback of authored publication states.
       * This is intentionally defensive because browser-side Supabase
       * calls are not one PostgreSQL transaction.
       */
      try {
        for (const section of sectionSnapshot) {
          await db()
            .from(TABLES.sections)
            .update({
              is_published:
                section.is_published
            })
            .eq("id", section.id);
        }

        for (const lesson of lessonSnapshot) {
          await db()
            .from(TABLES.lessons)
            .update({
              status: lesson.status
            })
            .eq("id", lesson.id);
        }

        for (const assessment of assessmentSnapshot) {
          await db()
            .from(TABLES.assessments)
            .update({
              status: assessment.status
            })
            .eq("id", assessment.id);
        }

        if (courseSnapshot) {
          await db()
            .from(TABLES.courses)
            .update({
              status: courseSnapshot.status,
              published_at:
                courseSnapshot.published_at
            })
            .eq("id", state.courseId);
        }
      } catch (rollbackError) {
        console.warn(
          "[Publish Entire Course] Rollback was incomplete.",
          rollbackError
        );
      }

      showToast(
        error?.message ||
        "Unable to publish the entire course.",
        "error"
      );

    } finally {
      if (button) {
        button.disabled = false;
        button.textContent =
          state.course?.status === "published"
            ? "Publish Updates"
            : originalText;
      }
    }
  }


  async function archiveCourse(courseId) {
    closeMenu("courseMoreMenu", "courseMoreButton");

    courseId = String(courseId || "").trim();
    if (!courseId) return;

    const course = state.courses.find((item) => item.id === courseId);
    if (!course) {
      showToast("That course is no longer available in this builder.", "error");
      return;
    }

    const confirmed = await builderConfirm({
      eyebrow: "COURSE MANAGEMENT",
      title: "Archive course?",
      message: `Archive "${course.title || "this course"}"? Learners should no longer see it as an active published course.`,
      confirmLabel: "Archive Course",
      danger: true
    });

    if (!confirmed) return;

    try {
      const now = new Date().toISOString();
      const { data: archived, error } = await db()
        .from(TABLES.courses)
        .update({ status: "archived", updated_at: now })
        .eq("id", courseId)
        .select("*")
        .single();

      if (error) throw error;

      await loadCourseDirectory();

      if (state.courseId === courseId) {
        state.course = archived;
        renderCourseHeader();
      }

      syncCourseSelector();
      showToast(`"${archived.title || course.title || "Course"}" archived.`, "success");
    } catch (error) {
      console.error("[Archive Course]", error);
      showToast(error?.message || "Unable to archive course.", "error");
    }
  }

  async function duplicateCoursePlaceholder(courseId) {
    closeMenu("courseMoreMenu", "courseMoreButton");

    courseId = String(courseId || "").trim();
    if (!courseId) return;

    const sourceCourse = state.courses.find((item) => item.id === courseId);
    if (!sourceCourse) {
      showToast("That course is no longer available in this builder.", "error");
      return;
    }

    const confirmed = await builderConfirm({
      eyebrow: "COURSE MANAGEMENT",
      title: "Duplicate course?",
      message: `Duplicate "${sourceCourse.title || "this course"}" and its curriculum? The copy will be created as a draft.`,
      confirmLabel: "Duplicate Course"
    });

    if (!confirmed) return;

    try {
      showToast(`Duplicating "${sourceCourse.title || "course"}"...`, "success");

      const copiedCourse = await duplicateCourseDeep(courseId);

      showToast("Course duplicated. Opening the copy...", "success");

      window.setTimeout(function () {
        window.location.href =
          `admin-lms-course-builder.html?course=${encodeURIComponent(copiedCourse.id)}`;
      }, 250);
    } catch (error) {
      console.error("[Duplicate Course]", error);
      showToast(error?.message || "Unable to duplicate course.", "error");
    }
  }

  function ensureBuilderDialog() {
    let backdrop = $("s4uBuilderDialogBackdrop");
    if (backdrop) return backdrop;

    backdrop = document.createElement("div");
    backdrop.id = "s4uBuilderDialogBackdrop";
    backdrop.className = "s4u-builder-dialog-backdrop";
    backdrop.hidden = true;

    backdrop.innerHTML = `
      <section class="s4u-builder-dialog" role="dialog" aria-modal="true" aria-labelledby="s4uBuilderDialogTitle">
        <div class="s4u-builder-dialog-brand"><img src="images/logo.png" alt="screenings4u"></div>
        <header>
          <div>
            <span class="s4u-builder-dialog-kicker" id="s4uBuilderDialogEyebrow">COURSE BUILDER</span>
            <h2 id="s4uBuilderDialogTitle">Course Builder</h2>
            <p id="s4uBuilderDialogMessage"></p>
          </div>
          <button type="button" class="s4u-builder-dialog-close" data-builder-dialog-cancel aria-label="Close">×</button>
        </header>

        <div class="s4u-builder-dialog-body" id="s4uBuilderDialogBody"></div>

        <footer>
          <button type="button" class="s4u-builder-dialog-btn secondary" data-builder-dialog-cancel>Cancel</button>
          <button type="button" class="s4u-builder-dialog-btn primary" id="s4uBuilderDialogConfirm">Continue</button>
        </footer>
      </section>
    `;

    document.body.appendChild(backdrop);

    backdrop.querySelectorAll("[data-builder-dialog-cancel]").forEach((button) => {
      button.addEventListener("click", () => closeBuilderDialog(null));
    });

    backdrop.addEventListener("click", (event) => {
      if (event.target === backdrop) closeBuilderDialog(null);
    });

    return backdrop;
  }

  function closeBuilderDialog(value) {
    const backdrop = $("s4uBuilderDialogBackdrop");
    if (!backdrop) return;

    const resolver = backdrop._resolver;
    backdrop._resolver = null;
    backdrop.hidden = true;

    document.body.style.overflow =
      backdrop.dataset.previousOverflow || "";

    backdrop.dataset.previousOverflow = "";

    if (resolver) resolver(value);
  }

  function openBuilderDialog({
    eyebrow = "COURSE BUILDER",
    title = "Confirm",
    message = "",
    confirmLabel = "Continue",
    danger = false,
    bodyHtml = "",
    onConfirm
  }) {
    const backdrop = ensureBuilderDialog();

    setText("s4uBuilderDialogEyebrow", eyebrow);
    setText("s4uBuilderDialogTitle", title);
    setText("s4uBuilderDialogMessage", message);

    const body = $("s4uBuilderDialogBody");
    body.innerHTML = bodyHtml;

    const confirm = $("s4uBuilderDialogConfirm");
    confirm.textContent = confirmLabel;
    confirm.classList.toggle("danger", Boolean(danger));

    backdrop.hidden = false;
    backdrop.dataset.previousOverflow = document.body.style.overflow || "";
    document.body.style.overflow = "hidden";

    return new Promise((resolve) => {
      backdrop._resolver = resolve;

      confirm.onclick = async () => {
        const result = onConfirm ? await onConfirm(body) : true;
        if (result === false || result == null) return;
        closeBuilderDialog(result);
      };
    });
  }

  function builderConfirm({
    eyebrow,
    title,
    message,
    confirmLabel,
    danger = false
  }) {
    return openBuilderDialog({
      eyebrow,
      title,
      message,
      confirmLabel,
      danger,
      bodyHtml: `
        <div style="color:#334155;font-size:14px;line-height:1.65;">
          ${esc(message)}
        </div>
      `,
      onConfirm: () => true
    }).then((value) => value === true);
  }

  function builderChoice({
    eyebrow,
    title,
    message,
    confirmLabel,
    options = []
  }) {
    let selectedValue = "";

    const bodyHtml = `
      <div class="s4u-builder-dialog-options">
        ${options.map((option) => `
          <button
            type="button"
            class="s4u-builder-dialog-option"
            data-builder-choice="${esc(option.value)}"
          >${esc(option.label)}</button>
        `).join("")}
      </div>
    `;

    const promise = openBuilderDialog({
      eyebrow,
      title,
      message,
      confirmLabel,
      bodyHtml,
      onConfirm: () => selectedValue || false
    });

    setTimeout(() => {
      const body = $("s4uBuilderDialogBody");
      if (!body) return;

      body.querySelectorAll("[data-builder-choice]").forEach((button) => {
        button.addEventListener("click", () => {
          selectedValue = button.dataset.builderChoice || "";

          body.querySelectorAll("[data-builder-choice]").forEach((item) => {
            item.classList.toggle(
              "selected",
              item.dataset.builderChoice === selectedValue
            );
          });
        });
      });
    }, 0);

    return promise;
  }

  function closeDynamicMenus() {
    document.querySelectorAll(".course-builder-dynamic-menu").forEach((menu) => menu.remove());
  }

  function openActionMenu(anchor, items) {
    closeDynamicMenus();

    const menu = document.createElement("div");
    menu.className = "course-builder-dynamic-menu";
    menu.setAttribute("role", "menu");

    items.forEach((item) => {
      const button = document.createElement("button");

      button.type = "button";
      button.className =
        `course-builder-dynamic-menu-item${item.danger ? " danger" : ""}`;
      button.textContent = item.label;
      button.setAttribute("role", "menuitem");

      button.addEventListener("click", async (event) => {
        event.stopPropagation();
        closeDynamicMenus();
        await item.action();
      });

      menu.appendChild(button);
    });

    document.body.appendChild(menu);

    const rect = anchor.getBoundingClientRect();
    const menuRect = menu.getBoundingClientRect();

    let left = rect.right - menuRect.width;
    left = Math.min(left, window.innerWidth - menuRect.width - 10);
    left = Math.max(10, left);

    let top = rect.bottom + 7;

    if (top + menuRect.height > window.innerHeight - 10) {
      top = Math.max(10, rect.top - menuRect.height - 7);
    }

    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;

    requestAnimationFrame(() => {
      menu.classList.add("open");
    });

    setTimeout(() => {
      document.addEventListener("click", closeDynamicMenus, { once: true });
    }, 0);
  }

  function openSectionActionMenu(anchor, sectionId) {
    const section = state.sections.find((item) => item.id === sectionId);
    if (!section) return;

    openActionMenu(anchor, [
      {
        label: "Edit Section",
        action: async () => openSectionModal(sectionId)
      },
      {
        label: "Duplicate Section",
        action: async () => duplicateSection(sectionId)
      },
      {
        label: "Delete Section",
        danger: true,
        action: async () => deleteSection(sectionId)
      }
    ]);
  }

  function openLessonActionMenu(anchor, lessonId) {
    const lesson = findLesson(lessonId);
    if (!lesson) return;

    openActionMenu(anchor, [
      {
        label: "Edit Lesson",
        action: async () => {
          window.location.href =
            `admin-lms-lesson-builder.html?course=${encodeURIComponent(state.courseId)}&lesson=${encodeURIComponent(lessonId)}`;
        }
      },
      {
        label: "Move to Section",
        action: async () => moveLessonToSection(lessonId)
      },
      {
        label: "Duplicate Lesson",
        action: async () => duplicateLessonIntoSection(lessonId, lesson.section_id)
      },
      {
        label: "Delete Lesson",
        danger: true,
        action: async () => deleteLesson(lessonId)
      }
    ]);
  }

  function findLesson(lessonId) {
    for (const section of state.sections) {
      const lesson = (section.lms_lessons || []).find((item) => item.id === lessonId);
      if (lesson) return lesson;
    }
    return null;
  }

  async function deleteSection(sectionId) {
    const section = state.sections.find((item) => item.id === sectionId);
    if (!section) return;

    const confirmed = await builderConfirm({
      eyebrow: "DELETE SECTION",
      title: "Delete section?",
      message: `Delete "${section.title || "this section"}"? Its lessons and attached LMS content will also be deleted.`,
      confirmLabel: "Delete Section",
      danger: true
    });

    if (!confirmed) return;

    try {
      const { error } = await db()
        .from(TABLES.sections)
        .delete()
        .eq("id", sectionId);

      if (error) throw error;

      if (state.activeSectionId === sectionId) state.activeSectionId = "";

      await loadCourse();
      render();
      showToast("Section deleted.", "success");
    } catch (error) {
      console.error("[Delete Section]", error);
      showToast(error?.message || "Unable to delete section.", "error");
    }
  }

  async function deleteLesson(lessonId) {
    const lesson = findLesson(lessonId);
    if (!lesson) return;

    const confirmed = await builderConfirm({
      eyebrow: "DELETE LESSON",
      title: "Delete lesson?",
      message: `Delete "${lesson.title || "this lesson"}"? Attached blocks, quizzes, and assessments will also be deleted.`,
      confirmLabel: "Delete Lesson",
      danger: true
    });

    if (!confirmed) return;

    try {
      const { error } = await db()
        .from(TABLES.lessons)
        .delete()
        .eq("id", lessonId);

      if (error) throw error;

      await normalizeLessonOrders(lesson.section_id);
      await loadCourse();
      render();
      showToast("Lesson deleted.", "success");
    } catch (error) {
      console.error("[Delete Lesson]", error);
      showToast(error?.message || "Unable to delete lesson.", "error");
    }
  }

  async function moveLessonToSection(lessonId) {
    const lesson = findLesson(lessonId);
    if (!lesson) return;

    const available = state.sections.filter(
      (section) => section.id !== lesson.section_id
    );

    if (!available.length) {
      showToast("Add another section before moving this lesson.", "error");
      return;
    }

    const targetId = await builderChoice({
      eyebrow: "MOVE LESSON",
      title: `Move "${lesson.title || "Lesson"}"`,
      message: "Choose the section where this lesson should be moved.",
      confirmLabel: "Move Lesson",
      options: available.map((section) => ({
        value: section.id,
        label: section.title || "Untitled Section"
      }))
    });

    if (!targetId) return;

    const target = available.find((section) => section.id === targetId);

    if (!target) {
      showToast("That section selection is not valid.", "error");
      return;
    }

    try {
      const targetOrder = (target.lms_lessons || []).length + 1;
      const oldSectionId = lesson.section_id;

      const { error } = await db()
        .from(TABLES.lessons)
        .update({
          section_id: target.id,
          sort_order: targetOrder,
          updated_at: new Date().toISOString()
        })
        .eq("id", lessonId);

      if (error) throw error;

      await normalizeLessonOrders(oldSectionId);
      await loadCourse();
      state.activeSectionId = target.id;
      render();
      showToast("Lesson moved.", "success");
    } catch (error) {
      console.error("[Move Lesson]", error);
      showToast(error?.message || "Unable to move lesson.", "error");
    }
  }

  async function normalizeLessonOrders(sectionId) {
    const { data, error } = await db()
      .from(TABLES.lessons)
      .select("id,sort_order")
      .eq("section_id", sectionId)
      .order("sort_order", { ascending: true });

    if (error) throw error;

    for (let index = 0; index < (data || []).length; index += 1) {
      const row = data[index];
      if (Number(row.sort_order) === index + 1) continue;

      const { error: updateError } = await db()
        .from(TABLES.lessons)
        .update({ sort_order: index + 1 })
        .eq("id", row.id);

      if (updateError) throw updateError;
    }
  }

  async function duplicateSection(sectionId) {
    const source = state.sections.find((section) => section.id === sectionId);
    if (!source) return;

    try {
      showToast("Duplicating section...", "success");

      const { data: created, error } = await db()
        .from(TABLES.sections)
        .insert({
          course_id: state.courseId,
          title: `${source.title || "Section"} Copy`,
          description: source.description || null,
          sort_order: state.sections.length + 1,
          is_published: false,
          updated_at: new Date().toISOString()
        })
        .select("*")
        .single();

      if (error) throw error;

      for (const lesson of source.lms_lessons || []) {
        await duplicateLessonIntoSection(lesson.id, created.id, { silent: true });
      }

      await loadCourse();
      state.activeSectionId = created.id;
      render();
      showToast("Section duplicated.", "success");
    } catch (error) {
      console.error("[Duplicate Section]", error);
      showToast(error?.message || "Unable to duplicate section.", "error");
    }
  }

  async function duplicateLessonIntoSection(lessonId, targetSectionId, options = {}) {
    const { data: lesson, error: lessonError } = await db()
      .from(TABLES.lessons)
      .select("*")
      .eq("id", lessonId)
      .single();

    if (lessonError) throw lessonError;

    const { count, error: countError } = await db()
      .from(TABLES.lessons)
      .select("id", { count: "exact", head: true })
      .eq("section_id", targetSectionId);

    if (countError) throw countError;

    const lessonPayload = copyRow(lesson, [
      "id", "section_id", "sort_order", "created_at", "updated_at"
    ]);

    lessonPayload.section_id = targetSectionId;
    lessonPayload.sort_order = Number(count || 0) + 1;
    lessonPayload.title =
      targetSectionId === lesson.section_id && !options.exactCopy
        ? `${lesson.title || "Lesson"} Copy`
        : lesson.title || "Lesson";

    /*
     * A normal Duplicate Lesson creates a draft copy.
     * A full Duplicate Course preserves the lesson's authored settings/status
     * while the copied parent course itself remains draft.
     */
    if (!options.exactCopy) {
      lessonPayload.status = "draft";
    }

    lessonPayload.updated_at = new Date().toISOString();

    const { data: created, error } = await db()
      .from(TABLES.lessons)
      .insert(lessonPayload)
      .select("*")
      .single();

    if (error) throw error;

    await copyLessonChildren(lesson.id, created.id, options);

    if (!options.silent) {
      await loadCourse();
      state.activeSectionId = targetSectionId;
      render();
      showToast("Lesson duplicated.", "success");
    }

    return created;
  }

  async function copyLessonChildren(sourceLessonId, targetLessonId, options = {}) {
    const quizMap = await copyQuiz(sourceLessonId, targetLessonId);
    const assessmentMap = await copyAssessments(sourceLessonId, targetLessonId, options);

    const idMap = new Map();

    if (quizMap?.sourceId && quizMap?.targetId) {
      idMap.set(String(quizMap.sourceId), String(quizMap.targetId));
    }

    for (const [sourceId, targetId] of assessmentMap.entries()) {
      idMap.set(String(sourceId), String(targetId));
    }

    await copyBlocks(sourceLessonId, targetLessonId, idMap);
  }

  async function copyBlocks(sourceLessonId, targetLessonId, idMap = new Map()) {
    const { data, error } = await db()
      .from(TABLES.blocks)
      .select("*")
      .eq("lesson_id", sourceLessonId)
      .order("sort_order", { ascending: true });

    if (error) throw error;
    if (!data?.length) return;

    const rows = data.map((row) => {
      const copy = copyRow(row, ["id", "lesson_id", "created_at", "updated_at"]);

      for (const [key, value] of Object.entries(copy)) {
        copy[key] = remapCopiedIds(value, idMap);
      }

      copy.lesson_id = targetLessonId;
      copy.updated_at = new Date().toISOString();

      return copy;
    });

    const { error: insertError } = await db()
      .from(TABLES.blocks)
      .insert(rows);

    if (insertError) throw insertError;
  }

  async function copyQuiz(sourceLessonId, targetLessonId) {
    const { data: quiz, error } = await db()
      .from(TABLES.quizzes)
      .select("*")
      .eq("lesson_id", sourceLessonId)
      .maybeSingle();

    if (error) throw error;
    if (!quiz) return null;

    const quizPayload = copyRow(
      quiz,
      ["id", "lesson_id", "created_at", "updated_at"]
    );

    quizPayload.lesson_id = targetLessonId;
    quizPayload.updated_at = new Date().toISOString();

    const { data: newQuiz, error: quizInsertError } = await db()
      .from(TABLES.quizzes)
      .insert(quizPayload)
      .select("*")
      .single();

    if (quizInsertError) throw quizInsertError;

    const { data: questions, error: questionError } = await db()
      .from(TABLES.questions)
      .select("*")
      .eq("quiz_id", quiz.id)
      .order("sort_order", { ascending: true });

    if (questionError) throw questionError;

    for (const question of questions || []) {
      const questionPayload = copyRow(
        question,
        ["id", "quiz_id", "created_at", "updated_at"]
      );

      questionPayload.quiz_id = newQuiz.id;
      questionPayload.updated_at = new Date().toISOString();

      const { data: newQuestion, error: questionInsertError } = await db()
        .from(TABLES.questions)
        .insert(questionPayload)
        .select("*")
        .single();

      if (questionInsertError) throw questionInsertError;

      const { data: options, error: optionsError } = await db()
        .from(TABLES.questionOptions)
        .select("*")
        .eq("question_id", question.id)
        .order("sort_order", { ascending: true });

      if (optionsError) throw optionsError;

      if (options?.length) {
        const rows = options.map((option) => {
          const optionPayload = copyRow(
            option,
            ["id", "question_id", "created_at", "updated_at"]
          );

          optionPayload.question_id = newQuestion.id;

          return optionPayload;
        });

        const { error: optionInsertError } = await db()
          .from(TABLES.questionOptions)
          .insert(rows);

        if (optionInsertError) throw optionInsertError;
      }
    }

    return {
      sourceId: quiz.id,
      targetId: newQuiz.id
    };
  }

  async function copyAssessments(sourceLessonId, targetLessonId, options = {}) {
    const idMap = new Map();

    const { data: assessments, error } = await db()
      .from(TABLES.assessments)
      .select("*")
      .eq("lesson_id", sourceLessonId)
      .order("created_at", { ascending: true });

    if (error) throw error;

    for (const assessment of assessments || []) {
      const payload = copyRow(
        assessment,
        ["id", "lesson_id", "created_at", "updated_at"]
      );

      payload.lesson_id = targetLessonId;

      if (!options.exactCopy) {
        payload.status = "draft";
      }

      payload.updated_at = new Date().toISOString();

      const { data: newAssessment, error: insertError } = await db()
        .from(TABLES.assessments)
        .insert(payload)
        .select("*")
        .single();

      if (insertError) throw insertError;

      idMap.set(String(assessment.id), String(newAssessment.id));

      const { data: questions, error: qError } = await db()
        .from(TABLES.assessmentQuestions)
        .select("*")
        .eq("assessment_id", assessment.id)
        .order("sort_order", { ascending: true });

      if (qError) throw qError;

      for (const question of questions || []) {
        const questionPayload = copyRow(
          question,
          ["id", "assessment_id", "created_at", "updated_at"]
        );

        questionPayload.assessment_id = newAssessment.id;
        questionPayload.updated_at = new Date().toISOString();

        const { data: newQuestion, error: newQuestionError } = await db()
          .from(TABLES.assessmentQuestions)
          .insert(questionPayload)
          .select("*")
          .single();

        if (newQuestionError) throw newQuestionError;

        const { data: options, error: optionError } = await db()
          .from(TABLES.assessmentOptions)
          .select("*")
          .eq("question_id", question.id)
          .order("sort_order", { ascending: true });

        if (optionError) throw optionError;

        if (options?.length) {
          const rows = options.map((option) => {
            const optionPayload = copyRow(
              option,
              ["id", "question_id", "created_at", "updated_at"]
            );

            optionPayload.question_id = newQuestion.id;

            return optionPayload;
          });

          const { error: insertOptionError } = await db()
            .from(TABLES.assessmentOptions)
            .insert(rows);

          if (insertOptionError) throw insertOptionError;
        }
      }
    }

    return idMap;
  }

  function remapCopiedIds(value, idMap) {
    if (!idMap?.size) return value;

    if (typeof value === "string") {
      return idMap.get(value) || value;
    }

    if (Array.isArray(value)) {
      return value.map((item) => remapCopiedIds(item, idMap));
    }

    if (value && typeof value === "object") {
      return Object.fromEntries(
        Object.entries(value).map(([key, item]) => [
          key,
          remapCopiedIds(item, idMap)
        ])
      );
    }

    return value;
  }

  async function openImportLessonDialog() {
    if (!state.courseId || !state.sections.length) {
      showToast("Select a course and add a section before importing a lesson.", "error");
      return;
    }

    try {
      const { data: sourceSections, error } = await db()
        .from(TABLES.sections)
        .select(`
          id,
          title,
          course_id,
          lms_courses ( id, title ),
          lms_lessons ( id, title, section_id, sort_order )
        `)
        .neq("course_id", state.courseId)
        .order("title", { ascending: true });

      if (error) throw error;

      const sourceLessons = (sourceSections || [])
        .flatMap((section) =>
          (section.lms_lessons || []).map((lesson) => ({
            ...lesson,
            source_section_title: section.title,
            source_course_title: section.lms_courses?.title || "Course"
          }))
        )
        .sort((a, b) =>
          `${a.source_course_title} ${a.source_section_title} ${a.title}`
            .localeCompare(`${b.source_course_title} ${b.source_section_title} ${b.title}`)
        );

      if (!sourceLessons.length) {
        showToast("There are no lessons in other courses to import.", "error");
        return;
      }

      const sourceLessonId = await builderChoice({
        eyebrow: "IMPORT LESSON",
        title: "Import lesson",
        message: "Choose a lesson to copy into the selected section.",
        confirmLabel: "Import Lesson",
        options: sourceLessons.map((lesson) => ({
          value: lesson.id,
          label:
            `${lesson.source_course_title} → ` +
            `${lesson.source_section_title} → ` +
            `${lesson.title}`
        }))
      });

      if (!sourceLessonId) return;

      const sourceLesson = sourceLessons.find(
        (lesson) => lesson.id === sourceLessonId
      );

      if (!sourceLesson) {
        showToast("That lesson selection is not valid.", "error");
        return;
      }

      const targetSectionId =
        state.activeSectionId || state.sections[0]?.id || "";

      if (!targetSectionId) {
        showToast("Choose a target section first.", "error");
        return;
      }

      showToast("Importing lesson...", "success");

      await duplicateLessonIntoSection(sourceLesson.id, targetSectionId, {
        silent: true
      });

      await loadCourse();
      state.activeSectionId = targetSectionId;
      render();

      showToast("Lesson imported.", "success");
    } catch (error) {
      console.error("[Import Lesson]", error);
      showToast(error?.message || "Unable to import lesson.", "error");
    }
  }

  async function duplicateCourseDeep(courseId) {
    /*
     * The previous builder called duplicate_lms_course_deep, but that RPC is
     * not present in this Supabase project. Use the verified deep-copy path
     * already implemented below. It copies the selected course's sections,
     * lessons, blocks, quizzes/questions/options, and assessments while
     * intentionally leaving learner history on the source course.
     */
    return duplicateCourseDeepLegacy(courseId);
  }


  /*
   * Retained for reference only. The browser-based deep copy is no longer
   * called because a page change can interrupt its many individual requests.
   */
  async function duplicateCourseDeepLegacy(courseId) {
    let newCourse = null;

    try {
      /*
       * Build an exact authored-content inventory before we copy anything.
       * A duplicate is not considered successful unless the target course
       * has the same authored-content counts as the source.
       *
       * Learner data is intentionally NOT copied:
       * - enrollments
       * - progress
       * - attempts / answers
       * - certificates
       *
       * Media records are shared library assets. The copied course/blocks
       * keep their media_id references, so videos/files/images continue to
       * point at the same media library objects.
       */
      const sourceInventory = await getCourseAuthoredInventory(courseId);

      const { data: sourceCourse, error: courseError } = await db()
        .from(TABLES.courses)
        .select("*")
        .eq("id", courseId)
        .single();

      if (courseError) throw courseError;

      const coursePayload = copyRow(
        sourceCourse,
        [
          "id",
          "slug",
          "status",
          "published_at",
          "created_at",
          "updated_at"
        ]
      );

      coursePayload.title =
        `${sourceCourse.title || "Course"} Copy`;

      coursePayload.slug =
        await uniqueCourseSlug(
          `${sourceCourse.slug || slugify(sourceCourse.title || "course")}-copy`
        );

      coursePayload.status = "draft";
      coursePayload.published_at = null;
      coursePayload.updated_at = new Date().toISOString();

      const { data: createdCourse, error: insertCourseError } = await db()
        .from(TABLES.courses)
        .insert(coursePayload)
        .select("*")
        .single();

      if (insertCourseError) throw insertCourseError;

      newCourse = createdCourse;

      /*
       * Do not load lessons through an embedded lms_sections relationship
       * here. The live PostgREST response returned only one embedded lesson
       * per section, which reduced a 42-lesson course to six lessons and made
       * the verification step delete the incomplete copy.
       *
       * Load both tables independently, then group every lesson under its
       * source section before beginning the copy.
       */
      const { data: sourceSections, error: sectionError } = await db()
        .from(TABLES.sections)
        .select("*")
        .eq("course_id", courseId)
        .order("sort_order", { ascending: true });

      if (sectionError) throw sectionError;

      const sourceSectionIds =
        (sourceSections || []).map(
          (section) => section.id
        );

      let sourceLessons = [];

      if (sourceSectionIds.length) {
        const { data, error: lessonError } = await db()
          .from(TABLES.lessons)
          .select("*")
          .in("section_id", sourceSectionIds)
          .order("sort_order", { ascending: true });

        if (lessonError) throw lessonError;

        sourceLessons = data || [];
      }

      const lessonsBySection =
        sourceLessons.reduce(
          (map, lesson) => {
            if (!map.has(lesson.section_id)) {
              map.set(lesson.section_id, []);
            }

            map.get(lesson.section_id).push(lesson);

            return map;
          },
          new Map()
        );

      for (const sourceSection of sourceSections || []) {
        const sectionPayload = copyRow(
          sourceSection,
          [
            "id",
            "course_id",
            "created_at",
            "updated_at"
          ]
        );

        sectionPayload.course_id = newCourse.id;

        /*
         * Keep the section's authored settings. The parent course itself
         * is draft, but section content/settings should be copied exactly.
         */
        sectionPayload.updated_at = new Date().toISOString();

        const { data: newSection, error: newSectionError } = await db()
          .from(TABLES.sections)
          .insert(sectionPayload)
          .select("*")
          .single();

        if (newSectionError) throw newSectionError;

        const lessons =
          [...(lessonsBySection.get(sourceSection.id) || [])]
            .sort(
              (a, b) =>
                number(a.sort_order) -
                number(b.sort_order)
            );

        for (const sourceLesson of lessons) {
          await duplicateLessonIntoSection(
            sourceLesson.id,
            newSection.id,
            {
              silent: true,
              exactCopy: true
            }
          );
        }
      }

      /*
       * Verify the new tree from Supabase instead of trusting the inserts.
       * This catches a copy that silently omitted blocks, quiz content,
       * assessment content, or an entire section/lesson.
       */
      const targetInventory =
        await getCourseAuthoredInventory(
          newCourse.id
        );

      const mismatches =
        compareCourseInventories(
          sourceInventory,
          targetInventory
        );

      const treeMismatches =
        await compareCourseCurriculumTrees(
          courseId,
          newCourse.id
        );

      const allMismatches = [
        ...mismatches,
        ...treeMismatches
      ];

      if (allMismatches.length) {
        throw new Error(
          "Course duplication was incomplete. " +
          allMismatches.join("; ")
        );
      }

      return newCourse;

    } catch (error) {
      /*
       * Never leave an incomplete duplicate behind.
       * lms_sections / lms_lessons / authored children cascade from
       * the copied course hierarchy.
       */
      if (newCourse?.id) {
        try {
          const { error: cleanupError } = await db()
            .from(TABLES.courses)
            .delete()
            .eq("id", newCourse.id);

          if (cleanupError) {
            console.warn(
              "[Duplicate Course] Partial-copy cleanup failed.",
              cleanupError
            );
          }
        } catch (cleanupError) {
          console.warn(
            "[Duplicate Course] Partial-copy cleanup failed.",
            cleanupError
          );
        }
      }

      throw error;
    }
  }


  async function getCourseAuthoredInventory(courseId) {
    const inventory = {
      sections: 0,
      lessons: 0,
      blocks: 0,
      quizzes: 0,
      quizQuestions: 0,
      quizOptions: 0,
      assessments: 0,
      assessmentQuestions: 0,
      assessmentOptions: 0
    };

    const { data: sections, error: sectionError } = await db()
      .from(TABLES.sections)
      .select("id")
      .eq("course_id", courseId);

    if (sectionError) throw sectionError;

    const sectionIds =
      (sections || []).map(
        (row) => row.id
      );

    inventory.sections =
      sectionIds.length;

    if (!sectionIds.length) {
      return inventory;
    }

    const { data: lessons, error: lessonError } = await db()
      .from(TABLES.lessons)
      .select("id")
      .in("section_id", sectionIds);

    if (lessonError) throw lessonError;

    const lessonIds =
      (lessons || []).map(
        (row) => row.id
      );

    inventory.lessons =
      lessonIds.length;

    if (!lessonIds.length) {
      return inventory;
    }

    const [
      blockResult,
      quizResult,
      assessmentResult
    ] = await Promise.all([
      db()
        .from(TABLES.blocks)
        .select("id,lesson_id")
        .in("lesson_id", lessonIds),

      db()
        .from(TABLES.quizzes)
        .select("id,lesson_id")
        .in("lesson_id", lessonIds),

      db()
        .from(TABLES.assessments)
        .select("id,lesson_id")
        .in("lesson_id", lessonIds)
    ]);

    if (blockResult.error) {
      throw blockResult.error;
    }

    if (quizResult.error) {
      throw quizResult.error;
    }

    if (assessmentResult.error) {
      throw assessmentResult.error;
    }

    inventory.blocks =
      (blockResult.data || []).length;

    const quizIds =
      (quizResult.data || []).map(
        (row) => row.id
      );

    const assessmentIds =
      (assessmentResult.data || []).map(
        (row) => row.id
      );

    inventory.quizzes =
      quizIds.length;

    inventory.assessments =
      assessmentIds.length;

    let quizQuestionIds = [];

    if (quizIds.length) {
      const { data: questions, error } = await db()
        .from(TABLES.questions)
        .select("id,quiz_id")
        .in("quiz_id", quizIds);

      if (error) throw error;

      quizQuestionIds =
        (questions || []).map(
          (row) => row.id
        );

      inventory.quizQuestions =
        quizQuestionIds.length;
    }

    if (quizQuestionIds.length) {
      const { data: options, error } = await db()
        .from(TABLES.questionOptions)
        .select("id,question_id")
        .in("question_id", quizQuestionIds);

      if (error) throw error;

      inventory.quizOptions =
        (options || []).length;
    }

    let assessmentQuestionIds = [];

    if (assessmentIds.length) {
      const { data: questions, error } = await db()
        .from(TABLES.assessmentQuestions)
        .select("id,assessment_id")
        .in("assessment_id", assessmentIds);

      if (error) throw error;

      assessmentQuestionIds =
        (questions || []).map(
          (row) => row.id
        );

      inventory.assessmentQuestions =
        assessmentQuestionIds.length;
    }

    if (assessmentQuestionIds.length) {
      const { data: options, error } = await db()
        .from(TABLES.assessmentOptions)
        .select("id,question_id")
        .in("question_id", assessmentQuestionIds);

      if (error) throw error;

      inventory.assessmentOptions =
        (options || []).length;
    }

    return inventory;
  }


  function compareCourseInventories(source, target) {
    const labels = {
      sections: "sections",
      lessons: "lessons",
      blocks: "content blocks",
      quizzes: "quizzes",
      quizQuestions: "quiz questions",
      quizOptions: "quiz answer options",
      assessments: "assessments",
      assessmentQuestions: "assessment questions",
      assessmentOptions: "assessment answer options"
    };

    const mismatches = [];

    Object.keys(labels).forEach((key) => {
      const sourceCount =
        Number(source?.[key] || 0);

      const targetCount =
        Number(target?.[key] || 0);

      if (sourceCount !== targetCount) {
        mismatches.push(
          `${labels[key]} ${targetCount}/${sourceCount}`
        );
      }
    });

    return mismatches;
  }


  async function compareCourseCurriculumTrees(sourceCourseId, targetCourseId) {
    const sourceTree =
      await getCourseCurriculumSignature(sourceCourseId);

    const targetTree =
      await getCourseCurriculumSignature(targetCourseId);

    const mismatches = [];

    if (sourceTree.length !== targetTree.length) {
      mismatches.push(
        `curriculum rows ${targetTree.length}/${sourceTree.length}`
      );
      return mismatches;
    }

    for (let index = 0; index < sourceTree.length; index += 1) {
      const source = sourceTree[index];
      const target = targetTree[index];

      if (
        source.sectionTitle !== target.sectionTitle ||
        source.sectionOrder !== target.sectionOrder ||
        source.lessonTitle !== target.lessonTitle ||
        source.lessonOrder !== target.lessonOrder
      ) {
        mismatches.push(
          `curriculum mismatch at item ${index + 1}`
        );
        break;
      }
    }

    return mismatches;
  }


  async function getCourseCurriculumSignature(courseId) {
    const { data: courseSections, error } = await db()
      .from(TABLES.sections)
      .select(`
        id,
        title,
        sort_order,
        lms_lessons (
          id,
          title,
          sort_order
        )
      `)
      .eq("course_id", courseId)
      .order("sort_order", { ascending: true });

    if (error) throw error;

    const signature = [];

    for (const section of courseSections || []) {
      const sectionLessons =
        [...(section.lms_lessons || [])]
          .sort(
            (a, b) =>
              number(a.sort_order) -
              number(b.sort_order)
          );

      if (!sectionLessons.length) {
        signature.push({
          sectionTitle: section.title || "",
          sectionOrder: number(section.sort_order),
          lessonTitle: "",
          lessonOrder: 0
        });
        continue;
      }

      for (const lesson of sectionLessons) {
        signature.push({
          sectionTitle: section.title || "",
          sectionOrder: number(section.sort_order),
          lessonTitle: lesson.title || "",
          lessonOrder: number(lesson.sort_order)
        });
      }
    }

    return signature;
  }


  async function uniqueCourseSlug(base) {
    let candidate = slugify(base) || `course-copy-${Date.now()}`;

    for (let attempt = 0; attempt < 30; attempt += 1) {
      const { data, error } = await db()
        .from(TABLES.courses)
        .select("id")
        .eq("slug", candidate)
        .limit(1);

      if (error) throw error;
      if (!data?.length) return candidate;

      candidate = `${slugify(base)}-${attempt + 2}`;
    }

    return `${slugify(base)}-${Date.now().toString(36)}`;
  }

  function copyRow(row, excluded = []) {
    const blocked = new Set(excluded);
    return Object.fromEntries(
      Object.entries(row || {}).filter(([key]) => !blocked.has(key))
    );
  }

  function slugify(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 170);
  }

  function removeUnusedAiTools() {
    document.querySelector(".course-ai-banner")?.remove();
    $("createWithAiButton")?.remove();
    $("aiTutorButton")?.remove();
  }

  function normalizeLessonType(value) {
    const type = String(value || "article").toLowerCase();

    const aliases = {
      text: "article",
      document: "article",
      download: "file"
    };

    return aliases[type] || type;
  }

  function typeLabel(type) {
    const labels = {
      article: "Article",
      video: "Video",
      quiz: "Quiz",
      file: "File",
      embed: "Embed"
    };

    return labels[type] || "Lesson";
  }

  function setLoading(show) {
    const loading = $("courseLoading");
    if (loading) loading.hidden = !show;
  }

  function showToast(message, type) {
    const toast = $("courseToast");
    if (!toast) return;

    toast.textContent = message;
    toast.className = `course-toast show ${type || "success"}`;

    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(function () {
      toast.classList.remove("show");
    }, 3600);
  }

  function setText(id, value) {
    const node = $(id);
    if (node) node.textContent = value ?? "";
  }

  function number(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }

  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, function (character) {
      return {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
      }[character];
    });
  }

  function cssEsc(value) {
    if (window.CSS?.escape) return window.CSS.escape(String(value));
    return String(value).replace(/["\\]/g, "\\$&");
  }
})();
