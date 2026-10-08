/* ============================================================
   SCREENINGS4U — ADMIN LMS QUIZ MANAGEMENT

   Live data:
   public.lms_quizzes
   public.lms_questions
   public.lms_question_options
   public.lms_lessons
   public.lms_sections
   public.lms_courses
   ============================================================ */

(function () {
  "use strict";

  const TABLES = Object.freeze({
    quizzes: "lms_quizzes",
    questions: "lms_questions",
    options: "lms_question_options",
    lessons: "lms_lessons",
    sections: "lms_sections",
    courses: "lms_courses",
    blocks: "lms_content_blocks"
  });

  const state = {
    client: null,
    quizzes: [],
    courses: [],
    lessons: [],
    deleteQuizId: "",
    creating: false,
    deleting: false,
    filters: {
      search: "",
      course: "all",
      type: "all"
    }
  };

  const $ = (id) =>
    document.getElementById(id);

  document.addEventListener(
    "DOMContentLoaded",
    initialize
  );


  async function initialize() {
    try {
      bind();

      state.client =
        await waitForClient();

      await requireSession();

      await loadAll();

    } catch (error) {
      console.error(
        "[Quiz Management]",
        error
      );

      toast(
        error?.message ||
        "Unable to load quizzes.",
        "error"
      );

      setLoading(false);
    }
  }


  async function waitForClient(
    timeout = 5000
  ) {
    const started =
      Date.now();

    while (
      Date.now() - started <
      timeout
    ) {
      const client =
        resolveClient();

      if (
        client?.from
      ) {
        return client;
      }

      await delay(75);
    }

    throw new Error(
      "Supabase client is unavailable."
    );
  }


  function resolveClient() {
    try {
      if (
        typeof window
          .getScreenings4uSupabase ===
        "function"
      ) {
        const client =
          window
            .getScreenings4uSupabase();

        if (
          client &&
          typeof client.then !==
            "function" &&
          client?.from
        ) {
          return client;
        }
      }
    } catch (_) {}

    return [
      window.screenings4uSupabase,
      window.supabaseClient,
      window.supabaseAdmin
    ].find(
      (value) =>
        value &&
        typeof value.from ===
          "function"
    ) || null;
  }


  async function requireSession() {
    if (
      window.S4UAuth
        ?.requireSession
    ) {
      const session =
        await window.S4UAuth
          .requireSession(
            "admin-login.html"
          );

      if (!session) {
        throw new Error(
          "Authentication required."
        );
      }

      return session;
    }

    const {
      data,
      error
    } = await state.client
      .auth
      .getSession();

    if (error) {
      throw error;
    }

    if (
      !data?.session?.user
    ) {
      window.location.replace(
        "admin-login.html"
      );

      throw new Error(
        "Authentication required."
      );
    }

    return data.session;
  }


  async function loadAll() {
    setLoading(true);

    try {
      await Promise.all([
        loadCourses(),
        loadLessons(),
        loadQuizzes()
      ]);

      populateCourseFilter();
      populateCreateCourseSelect();
      renderMetrics();
      renderQuizzes();

    } finally {
      setLoading(false);
    }
  }


  async function loadCourses() {
    const {
      data,
      error
    } = await state.client
      .from(TABLES.courses)
      .select(
        "id,title,status"
      )
      .order(
        "title",
        {
          ascending: true
        }
      );

    if (error) {
      throw error;
    }

    state.courses =
      data || [];
  }


  async function loadLessons() {
    const {
      data,
      error
    } = await state.client
      .from(TABLES.sections)
      .select(`
        id,
        course_id,
        title,
        sort_order,
        lms_lessons (
          id,
          section_id,
          title,
          status,
          sort_order
        )
      `)
      .order(
        "sort_order",
        {
          ascending: true
        }
      );

    if (error) {
      throw error;
    }

    state.lessons =
      (data || [])
        .flatMap(
          (section) =>
            (
              section
                .lms_lessons ||
              []
            )
              .map(
                (lesson) => ({
                  ...lesson,
                  section_title:
                    section.title ||
                    "Section",
                  course_id:
                    section.course_id
                })
              )
        )
        .sort(
          (a, b) =>
            Number(
              a.sort_order
            ) -
            Number(
              b.sort_order
            )
        );
  }


  async function loadQuizzes() {
    const {
      data,
      error
    } = await state.client
      .from(TABLES.quizzes)
      .select(`
        *,
        lms_questions (
          id
        ),
        lms_lessons (
          id,
          title,
          section_id,
          lms_sections (
            id,
            title,
            course_id,
            lms_courses (
              id,
              title
            )
          )
        )
      `)
      .order(
        "created_at",
        {
          ascending: false
        }
      );

    if (error) {
      throw error;
    }

    state.quizzes =
      (data || [])
        .map(
          normalizeQuiz
        );
  }


  function normalizeQuiz(
    quiz
  ) {
    const lesson =
      quiz.lms_lessons ||
      null;

    const section =
      lesson?.lms_sections ||
      null;

    const course =
      section?.lms_courses ||
      null;

    return {
      ...quiz,

      question_count:
        (
          quiz
            .lms_questions ||
          []
        ).length,

      lesson_title:
        lesson?.title ||
        "Lesson",

      section_title:
        section?.title ||
        "Section",

      course_id:
        course?.id ||
        section?.course_id ||
        "",

      course_title:
        course?.title ||
        "Course"
    };
  }


  function populateCourseFilter() {
    const select =
      $("courseFilter");

    if (!select) {
      return;
    }

    const current =
      select.value ||
      "all";

    select.innerHTML =
      '<option value="all">All Courses</option>' +
      state.courses
        .map(
          (course) =>
            `<option value="${esc(course.id)}">${esc(course.title || "Untitled Course")}</option>`
        )
        .join("");

    select.value =
      state.courses.some(
        (course) =>
          course.id === current
      )
        ? current
        : "all";
  }


  function populateCreateCourseSelect() {
    const select =
      $("newQuizCourse");

    if (!select) {
      return;
    }

    select.innerHTML =
      '<option value="">Select a course</option>' +
      state.courses
        .map(
          (course) =>
            `<option value="${esc(course.id)}">${esc(course.title || "Untitled Course")}</option>`
        )
        .join("");
  }


  function populateCreateLessonSelect(
    courseId
  ) {
    const select =
      $("newQuizLesson");

    if (!select) {
      return;
    }

    const lessons =
      state.lessons
        .filter(
          (lesson) =>
            lesson.course_id ===
            courseId
        );

    if (!courseId) {
      select.disabled =
        true;

      select.innerHTML =
        '<option value="">Select a course first</option>';

      return;
    }

    if (!lessons.length) {
      select.disabled =
        true;

      select.innerHTML =
        '<option value="">No lessons in this course</option>';

      return;
    }

    select.disabled =
      false;

    select.innerHTML =
      '<option value="">Select a lesson</option>' +
      lessons
        .map(
          (lesson) =>
            `<option value="${esc(lesson.id)}">${esc(lesson.section_title)} · ${esc(lesson.title || "Untitled Lesson")}</option>`
        )
        .join("");
  }


  function renderMetrics() {
    const total =
      state.quizzes.length;

    const required =
      state.quizzes.filter(
        (quiz) =>
          quiz.is_required !==
          false
      ).length;

    const unlimited =
      state.quizzes.filter(
        (quiz) =>
          quiz.attempt_limit ==
          null
      ).length;

    const questions =
      state.quizzes.reduce(
        (sum, quiz) =>
          sum +
          Number(
            quiz.question_count ||
            0
          ),
        0
      );

    setText(
      "quizStatTotal",
      total
    );

    setText(
      "quizStatRequired",
      required
    );

    setText(
      "quizStatUnlimited",
      unlimited
    );

    setText(
      "quizStatQuestions",
      questions
    );
  }


  function filteredQuizzes() {
    const search =
      state.filters.search
        .trim()
        .toLowerCase();

    return state.quizzes
      .filter(
        (quiz) => {
          if (search) {
            const haystack = [
              quiz.title,
              quiz.description,
              quiz.course_title,
              quiz.section_title,
              quiz.lesson_title
            ]
              .filter(Boolean)
              .join(" ")
              .toLowerCase();

            if (
              !haystack.includes(
                search
              )
            ) {
              return false;
            }
          }

          if (
            state.filters.course !==
            "all" &&
            quiz.course_id !==
            state.filters.course
          ) {
            return false;
          }

          switch (
            state.filters.type
          ) {
            case "required":
              return quiz.is_required !==
                false;

            case "optional":
              return quiz.is_required ===
                false;

            case "unlimited":
              return quiz.attempt_limit ==
                null;

            case "limited":
              return quiz.attempt_limit !=
                null;

            case "empty":
              return Number(
                quiz.question_count ||
                0
              ) === 0;

            default:
              return true;
          }
        }
      );
  }


  function renderQuizzes() {
    const list =
      $("quizList");

    const empty =
      $("quizEmpty");

    if (
      !list ||
      !empty
    ) {
      return;
    }

    const rows =
      filteredQuizzes();

    setText(
      "quizCount",
      `${rows.length} of ${state.quizzes.length} quizzes`
    );

    if (!rows.length) {
      list.hidden =
        true;

      list.innerHTML =
        "";

      empty.hidden =
        false;

      return;
    }

    empty.hidden =
      true;

    list.hidden =
      false;

    list.innerHTML =
      rows
        .map(
          quizRow
        )
        .join("");

    list
      .querySelectorAll(
        "[data-delete-quiz]"
      )
      .forEach(
        (button) => {
          button.addEventListener(
            "click",
            () =>
              openDeleteModal(
                button.dataset
                  .deleteQuiz
              )
          );
        }
      );
  }


  function quizRow(
    quiz
  ) {
    const attempts =
      quiz.attempt_limit ==
      null
        ? "Unlimited"
        : String(
            quiz.attempt_limit
          );

    const required =
      quiz.is_required !==
      false;

    const editUrl =
      `admin-lms-quiz-builder.html?course=${encodeURIComponent(quiz.course_id || "")}` +
      `&lesson=${encodeURIComponent(quiz.lesson_id || "")}` +
      `&quiz=${encodeURIComponent(quiz.id)}`;

    const lessonUrl =
      `admin-lms-lesson-editor.html?course=${encodeURIComponent(quiz.course_id || "")}` +
      `&lesson=${encodeURIComponent(quiz.lesson_id || "")}`;

    return `
      <article class="quiz-row">

        <div class="quiz-title-cell">
          <div class="quiz-icon">?</div>

          <div class="quiz-title-copy">
            <strong title="${esc(quiz.title || "Untitled Quiz")}">
              ${esc(quiz.title || "Untitled Quiz")}
            </strong>

            <span>
              ${required ? "Required quiz" : "Optional quiz"}
              ·
              ${esc(formatDate(quiz.updated_at || quiz.created_at))}
            </span>
          </div>
        </div>

        <div class="quiz-course-cell">
          <strong>
            ${esc(quiz.course_title)}
          </strong>

          <span>
            ${esc(quiz.section_title)}
            ·
            ${esc(quiz.lesson_title)}
          </span>
        </div>

        <div class="quiz-number-cell">
          ${Number(quiz.question_count || 0)}
          <small>Questions</small>
        </div>

        <div class="quiz-number-cell">
          ${Number(quiz.passing_score ?? 80)}%
          <small>Passing</small>
        </div>

        <div>
          <span class="quiz-attempts ${quiz.attempt_limit == null ? "unlimited" : ""}">
            ${esc(attempts)}
          </span>
        </div>

        <div class="quiz-actions">
          <a
            class="quiz-action primary"
            href="${editUrl}"
          >
            Edit
          </a>

          <a
            class="quiz-action"
            href="${lessonUrl}"
          >
            Lesson
          </a>

          <button
            type="button"
            class="quiz-action delete"
            data-delete-quiz="${esc(quiz.id)}"
          >
            Delete
          </button>
        </div>
      </article>
    `;
  }


  function openCreateModal() {
    clearCreateError();

    if (
      $("newQuizCourse")
    ) {
      $("newQuizCourse").value =
        "";
    }

    populateCreateLessonSelect(
      ""
    );

    $("newQuizTitle").value =
      "";

    $("newQuizDescription").value =
      "";

    $("newQuizPassingScore").value =
      "80";

    $("newQuizAttemptLimit").value =
      "0";

    $("newQuizRequired").checked =
      true;

    $("quizCreateModal").hidden =
      false;

    document.body.style.overflow =
      "hidden";

    window.setTimeout(
      () =>
        $("newQuizCourse")
          ?.focus(),
      0
    );
  }


  function closeCreateModal() {
    if (
      !$("quizCreateModal") ||
      $("quizCreateModal").hidden
    ) {
      return;
    }

    $("quizCreateModal").hidden =
      true;

    restoreScroll();
  }


  async function createQuiz() {
    if (
      state.creating
    ) {
      return;
    }

    const courseId =
      $("newQuizCourse")
        .value;

    const lessonId =
      $("newQuizLesson")
        .value;

    const title =
      $("newQuizTitle")
        .value
        .trim();

    if (!courseId) {
      showCreateError(
        "Choose a course."
      );

      return;
    }

    if (
      !isUuid(
        lessonId
      )
    ) {
      showCreateError(
        "Choose a lesson."
      );

      return;
    }

    if (!title) {
      showCreateError(
        "Enter a quiz title."
      );

      $("newQuizTitle")
        .focus();

      return;
    }

    state.creating =
      true;

    const button =
      $("saveNewQuizButton");

    button.disabled =
      true;

    button.textContent =
      "Creating...";

    try {
      const {
        data: existing,
        error: existingError
      } = await state.client
        .from(TABLES.quizzes)
        .select(
          "id,title"
        )
        .eq(
          "lesson_id",
          lessonId
        )
        .limit(1)
        .maybeSingle();

      if (existingError) {
        throw existingError;
      }

      if (existing?.id) {
        throw new Error(
          `This lesson already has a quiz: ${existing.title || "Untitled Quiz"}.`
        );
      }

      const payload = {
        lesson_id:
          lessonId,

        title,

        description:
          $("newQuizDescription")
            .value
            .trim() ||
          null,

        passing_score:
          clampNumber(
            $("newQuizPassingScore")
              .value,
            0,
            100,
            80
          ),

        attempt_limit:
          quizAttemptLimit(
            $("newQuizAttemptLimit")
              .value
          ),

        randomize_questions:
          false,

        randomize_answers:
          false,

        show_correct_answers:
          true,

        show_explanations:
          true,

        is_required:
          $("newQuizRequired")
            .checked,

        updated_at:
          new Date()
            .toISOString()
      };

      const {
        data: quiz,
        error
      } = await state.client
        .from(TABLES.quizzes)
        .insert(payload)
        .select("*")
        .single();

      if (error) {
        throw error;
      }

      await ensureQuizBlock(
        quiz
      );

      window.location.href =
        `admin-lms-quiz-builder.html?course=${encodeURIComponent(courseId)}` +
        `&lesson=${encodeURIComponent(lessonId)}` +
        `&quiz=${encodeURIComponent(quiz.id)}`;

    } catch (error) {
      console.error(
        "[Create Quiz]",
        error
      );

      showCreateError(
        error?.message ||
        "Unable to create quiz."
      );

    } finally {
      state.creating =
        false;

      button.disabled =
        false;

      button.textContent =
        "Create Quiz";
    }
  }


  async function ensureQuizBlock(
    quiz
  ) {
    const {
      data: existing,
      error: existingError
    } = await state.client
      .from(TABLES.blocks)
      .select("*")
      .eq(
        "lesson_id",
        quiz.lesson_id
      )
      .eq(
        "block_type",
        "quiz"
      )
      .limit(1)
      .maybeSingle();

    if (existingError) {
      throw existingError;
    }

    const payload = {
      lesson_id:
        quiz.lesson_id,

      block_type:
        "quiz",

      title:
        quiz.title,

      content:
        null,

      media_id:
        null,

      external_url:
        null,

      settings: {
        ...(
          existing
            ?.settings ||
          {}
        ),
        record_id:
          quiz.id
      },

      is_required:
        quiz.is_required !==
        false,

      updated_at:
        new Date()
          .toISOString()
    };

    if (
      existing?.id
    ) {
      const {
        error
      } = await state.client
        .from(TABLES.blocks)
        .update(payload)
        .eq(
          "id",
          existing.id
        );

      if (error) {
        throw error;
      }

      return;
    }

    const {
      data: last,
      error: lastError
    } = await state.client
      .from(TABLES.blocks)
      .select(
        "sort_order"
      )
      .eq(
        "lesson_id",
        quiz.lesson_id
      )
      .order(
        "sort_order",
        {
          ascending: false
        }
      )
      .limit(1)
      .maybeSingle();

    if (lastError) {
      throw lastError;
    }

    const {
      error
    } = await state.client
      .from(TABLES.blocks)
      .insert({
        ...payload,
        sort_order:
          (
            Number(
              last
                ?.sort_order
            ) ||
            0
          ) +
          1
      });

    if (error) {
      throw error;
    }
  }


  function openDeleteModal(
    quizId
  ) {
    const quiz =
      state.quizzes.find(
        (item) =>
          item.id ===
          quizId
      );

    if (!quiz) {
      return;
    }

    state.deleteQuizId =
      quiz.id;

    $("quizDeleteName").textContent =
      quiz.title ||
      "Quiz";

    $("quizDeleteModal").hidden =
      false;

    document.body.style.overflow =
      "hidden";
  }


  function closeDeleteModal() {
    if (
      !$("quizDeleteModal") ||
      $("quizDeleteModal").hidden
    ) {
      return;
    }

    $("quizDeleteModal").hidden =
      true;

    state.deleteQuizId =
      "";

    restoreScroll();
  }


  async function deleteQuiz() {
    if (
      state.deleting ||
      !isUuid(
        state.deleteQuizId
      )
    ) {
      return;
    }

    const quizId =
      state.deleteQuizId;

    state.deleting =
      true;

    const button =
      $("confirmDeleteQuizButton");

    button.disabled =
      true;

    button.textContent =
      "Deleting...";

    try {
      const {
        data: questions,
        error: questionReadError
      } = await state.client
        .from(TABLES.questions)
        .select("id")
        .eq(
          "quiz_id",
          quizId
        );

      if (questionReadError) {
        throw questionReadError;
      }

      const questionIds =
        (questions || [])
          .map(
            (question) =>
              question.id
          )
          .filter(
            isUuid
          );

      if (
        questionIds.length
      ) {
        const {
          error: optionError
        } = await state.client
          .from(TABLES.options)
          .delete()
          .in(
            "question_id",
            questionIds
          );

        if (optionError) {
          throw optionError;
        }

        const {
          error: questionError
        } = await state.client
          .from(TABLES.questions)
          .delete()
          .in(
            "id",
            questionIds
          );

        if (questionError) {
          throw questionError;
        }
      }

      const quiz =
        state.quizzes.find(
          (item) =>
            item.id ===
            quizId
        );

      if (
        quiz?.lesson_id
      ) {
        const {
          data: blocks,
          error: blockReadError
        } = await state.client
          .from(TABLES.blocks)
          .select(
            "id,settings"
          )
          .eq(
            "lesson_id",
            quiz.lesson_id
          )
          .eq(
            "block_type",
            "quiz"
          );

        if (blockReadError) {
          throw blockReadError;
        }

        const blockIds =
          (blocks || [])
            .filter(
              (block) =>
                block.settings
                  ?.record_id ===
                quizId
            )
            .map(
              (block) =>
                block.id
            );

        if (
          blockIds.length
        ) {
          const {
            error: blockDeleteError
          } = await state.client
            .from(TABLES.blocks)
            .delete()
            .in(
              "id",
              blockIds
            );

          if (blockDeleteError) {
            throw blockDeleteError;
          }
        }
      }

      const {
        error
      } = await state.client
        .from(TABLES.quizzes)
        .delete()
        .eq(
          "id",
          quizId
        );

      if (error) {
        throw error;
      }

      closeDeleteModal();

      await loadQuizzes();

      renderMetrics();
      renderQuizzes();

      toast(
        "Quiz deleted.",
        "success"
      );

    } catch (error) {
      console.error(
        "[Delete Quiz]",
        error
      );

      toast(
        error?.message ||
        "Unable to delete quiz.",
        "error"
      );

    } finally {
      state.deleting =
        false;

      button.disabled =
        false;

      button.textContent =
        "Delete Quiz";
    }
  }


  function showCreateError(
    message
  ) {
    const node =
      $("quizCreateError");

    node.textContent =
      message;

    node.hidden =
      false;
  }


  function clearCreateError() {
    const node =
      $("quizCreateError");

    node.textContent =
      "";

    node.hidden =
      true;
  }


  function bind() {
    $("createQuizButton")
      ?.addEventListener(
        "click",
        openCreateModal
      );

    $("saveNewQuizButton")
      ?.addEventListener(
        "click",
        createQuiz
      );

    $("newQuizCourse")
      ?.addEventListener(
        "change",
        (event) => {
          populateCreateLessonSelect(
            event.target.value ||
            ""
          );
        }
      );

    $("confirmDeleteQuizButton")
      ?.addEventListener(
        "click",
        deleteQuiz
      );

    $("quizRefresh")
      ?.addEventListener(
        "click",
        async () => {
          try {
            await loadAll();

            toast(
              "Quiz list refreshed.",
              "success"
            );
          } catch (error) {
            toast(
              error?.message ||
              "Unable to refresh quizzes.",
              "error"
            );
          }
        }
      );

    $("quizSearch")
      ?.addEventListener(
        "input",
        (event) => {
          state.filters.search =
            event.target.value ||
            "";

          renderQuizzes();
        }
      );

    $("courseFilter")
      ?.addEventListener(
        "change",
        (event) => {
          state.filters.course =
            event.target.value ||
            "all";

          renderQuizzes();
        }
      );

    $("quizTypeFilter")
      ?.addEventListener(
        "change",
        (event) => {
          state.filters.type =
            event.target.value ||
            "all";

          renderQuizzes();
        }
      );

    document
      .querySelectorAll(
        "[data-close-create-quiz]"
      )
      .forEach(
        (node) => {
          node.addEventListener(
            "click",
            closeCreateModal
          );
        }
      );

    document
      .querySelectorAll(
        "[data-close-delete-quiz]"
      )
      .forEach(
        (node) => {
          node.addEventListener(
            "click",
            closeDeleteModal
          );
        }
      );

    document.addEventListener(
      "keydown",
      (event) => {
        if (
          event.key !==
          "Escape"
        ) {
          return;
        }

        closeCreateModal();
        closeDeleteModal();
      }
    );
  }


  function setLoading(
    loading
  ) {
    const node =
      $("quizLoading");

    const list =
      $("quizList");

    if (node) {
      node.hidden =
        !loading;
    }

    if (
      list &&
      loading
    ) {
      list.hidden =
        true;
    }
  }


  function restoreScroll() {
    const anyOpen =
      [
        "quizCreateModal",
        "quizDeleteModal"
      ].some(
        (id) =>
          $(id)?.hidden ===
          false
      );

    if (!anyOpen) {
      document.body.style.overflow =
        "";
    }
  }


  function toast(
    message,
    type
  ) {
    const node =
      $("quizToast");

    if (!node) {
      return;
    }

    node.textContent =
      message;

    node.className =
      `quiz-toast show ${type || "success"}`;

    window.clearTimeout(
      toast.timer
    );

    toast.timer =
      window.setTimeout(
        () =>
          node.classList
            .remove(
              "show"
            ),
        3600
      );
  }


  function quizAttemptLimit(
    value
  ) {
    if (
      value === "" ||
      value == null
    ) {
      return null;
    }

    const number =
      Number(value);

    if (
      !Number.isFinite(
        number
      )
    ) {
      return null;
    }

    const attempts =
      Math.round(
        number
      );

    return attempts >= 1
      ? attempts
      : null;
  }


  function clampNumber(
    value,
    minimum,
    maximum,
    fallback
  ) {
    const number =
      Number(value);

    if (
      !Number.isFinite(
        number
      )
    ) {
      return fallback;
    }

    return Math.min(
      maximum,
      Math.max(
        minimum,
        Math.round(
          number
        )
      )
    );
  }


  function formatDate(
    value
  ) {
    if (!value) {
      return "No date";
    }

    const date =
      new Date(value);

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return "No date";
    }

    return new Intl
      .DateTimeFormat(
        undefined,
        {
          month: "short",
          day: "numeric",
          year: "numeric"
        }
      )
      .format(date);
  }


  function setText(
    id,
    value
  ) {
    const node =
      $(id);

    if (node) {
      node.textContent =
        String(
          value ??
          ""
        );
    }
  }


  function isUuid(
    value
  ) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      .test(
        String(
          value ||
          ""
        )
      );
  }


  function esc(
    value
  ) {
    return String(
      value ??
      ""
    )
      .replace(
        /&/g,
        "&amp;"
      )
      .replace(
        /</g,
        "&lt;"
      )
      .replace(
        />/g,
        "&gt;"
      )
      .replace(
        /"/g,
        "&quot;"
      )
      .replace(
        /'/g,
        "&#039;"
      );
  }


  function delay(
    milliseconds
  ) {
    return new Promise(
      (resolve) =>
        window.setTimeout(
          resolve,
          milliseconds
        )
    );
  }

})();
