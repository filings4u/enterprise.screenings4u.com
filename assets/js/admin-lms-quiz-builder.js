/* ============================================================
   SCREENINGS4U — ADMIN LMS QUIZ BUILDER

   Uses:
   public.lms_quizzes
   public.lms_questions
   public.lms_question_options
   ============================================================ */

(function () {
  "use strict";

  const TABLES = Object.freeze({
    courses: "lms_courses",
    sections: "lms_sections",
    lessons: "lms_lessons",
    quizzes: "lms_quizzes",
    questions: "lms_questions",
    options: "lms_question_options",
    blocks: "lms_content_blocks"
  });

  const state = {
    client: null,
    courseId: "",
    lessonId: "",
    quizId: "",
    course: null,
    lesson: null,
    section: null,
    quiz: null,
    questions: [],
    editingQuestionIndex: null,
    deletingQuestionIndex: null,
    saving: false,
    editState: null
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

      readParams();

      if (!isUuid(state.quizId)) {
        throw new Error(
          "A valid quiz ID is required."
        );
      }

      await loadQuiz();
      await loadQuizEditState();

      render();

      $("quizBuilderLoading").hidden =
        true;

      $("quizBuilderWorkspace").hidden =
        false;

      if (state.editState?.locked) {
        await offerSafeRevision();
      }

    } catch (error) {
      console.error(
        "[Quiz Builder]",
        error
      );

      toast(
        error?.message ||
        "Unable to load quiz builder.",
        "error"
      );

      if ($("quizBuilderLoading")) {
        $("quizBuilderLoading").textContent =
          error?.message ||
          "Unable to load quiz.";
      }
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

      if (client?.from) {
        return client;
      }

      await delay(75);
    }

    throw new Error(
      "Supabase client is unavailable."
    );
  }


  function resolveClient() {
    if (
      typeof window
        .getScreenings4uSupabase ===
      "function"
    ) {
      try {
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
      } catch (_) {}
    }

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


  function readParams() {
    const params =
      new URLSearchParams(
        window.location.search
      );

    state.courseId =
      params.get("course") ||
      params.get("course_id") ||
      "";

    state.lessonId =
      params.get("lesson") ||
      params.get("lesson_id") ||
      "";

    state.quizId =
      params.get("quiz") ||
      params.get("id") ||
      "";
  }


  async function loadQuiz() {
    const {
      data: quiz,
      error: quizError
    } = await state.client
      .from(TABLES.quizzes)
      .select("*")
      .eq(
        "id",
        state.quizId
      )
      .single();

    if (quizError) {
      throw quizError;
    }

    state.quiz =
      quiz;

    state.lessonId =
      quiz.lesson_id ||
      state.lessonId;

    if (
      !isUuid(
        state.lessonId
      )
    ) {
      throw new Error(
        "The quiz is not attached to a valid lesson."
      );
    }

    const {
      data: lesson,
      error: lessonError
    } = await state.client
      .from(TABLES.lessons)
      .select("*")
      .eq(
        "id",
        state.lessonId
      )
      .single();

    if (lessonError) {
      throw lessonError;
    }

    state.lesson =
      lesson;

    const {
      data: section,
      error: sectionError
    } = await state.client
      .from(TABLES.sections)
      .select(
        "id,course_id,title,sort_order"
      )
      .eq(
        "id",
        lesson.section_id
      )
      .single();

    if (sectionError) {
      throw sectionError;
    }

    state.section =
      section;

    state.courseId =
      section.course_id ||
      state.courseId;

    const {
      data: course,
      error: courseError
    } = await state.client
      .from(TABLES.courses)
      .select(
        "id,title,status"
      )
      .eq(
        "id",
        state.courseId
      )
      .single();

    if (courseError) {
      throw courseError;
    }

    state.course =
      course;

    const {
      data: questions,
      error: questionError
    } = await state.client
      .from(TABLES.questions)
      .select(`
        *,
        lms_question_options (
          *
        )
      `)
      .eq(
        "quiz_id",
        state.quizId
      )
      .order(
        "sort_order",
        {
          ascending: true
        }
      );

    if (questionError) {
      throw questionError;
    }

    state.questions =
      (questions || [])
        .map(
          normalizeQuestion
        );
  }


  async function loadQuizEditState() {
    /*
     * The edit-state RPC provides history/attempt metadata, but it must not
     * make the Quiz Builder unusable if PostgREST is briefly refreshing its
     * schema cache after a deployment. Direct editing remains protected by
     * the LMS table RLS policies.
     */
    const { data, error } = await state.client.rpc(
      "enterprise_training_quiz_edit_state",
      { p_quiz_id: state.quizId }
    );

    if (error) {
      const message = String(error.message || error.details || "");
      const schemaCacheMiss =
        /schema cache/i.test(message) ||
        /could not find the function/i.test(message) ||
        error.code === "PGRST202";

      if (!schemaCacheMiss) throw error;

      console.warn(
        "[Quiz Builder] Edit-state metadata is temporarily unavailable; continuing with direct LMS editing.",
        error
      );

      state.editState = {
        quiz_id: state.quizId,
        lesson_id: state.lessonId,
        course_id: state.courseId,
        locked: false,
        direct_edit_enabled: true,
        metadata_unavailable: true
      };
      return;
    }

    state.editState = data || { locked: false, direct_edit_enabled: true };
  }

  async function offerSafeRevision() {
    return false;
  }

  function normalizeQuestion(
    question
  ) {
    return {
      id:
        question.id ||
        null,

      question_type:
        question.question_type ||
        "single_choice",

      editor_type:
        inferEditorType(
          question
        ),

      question_text:
        question.question_text ||
        "",

      explanation:
        question.explanation ||
        "",

      points:
        Math.max(
          1,
          Math.round(
            Number(
              question.points
            ) ||
            1
          )
        ),

      lms_question_options:
        (
          question
            .lms_question_options ||
          []
        )
          .sort(
            (a, b) =>
              Number(
                a.sort_order
              ) -
              Number(
                b.sort_order
              )
          )
          .map(
            (option) => ({
              id:
                option.id ||
                null,

              option_text:
                option.option_text ||
                "",

              is_correct:
                option.is_correct ===
                true,

              sort_order:
                option.sort_order ||
                1
            })
          )
    };
  }


  function inferEditorType(
    question
  ) {
    /*
     * Respect the actual LMS enum when it is available.
     * multiple_choice supports one OR several correct options.
     */
    if (
      question?.question_type ===
      "true_false"
    ) {
      return "true_false";
    }

    if (
      question?.question_type ===
      "multiple_choice"
    ) {
      return "multiple_choice";
    }

    const options =
      (
        question
          .lms_question_options ||
        []
      )
        .map(
          (option) =>
            String(
              option.option_text ||
              ""
            )
              .trim()
              .toLowerCase()
        );

    if (
      options.length === 2 &&
      options.includes("true") &&
      options.includes("false")
    ) {
      return "true_false";
    }

    return "multiple_choice";
  }


  function render() {
    renderHeader();
    renderQuizSettings();
    renderQuestions();
    renderSummary();
  }


  function renderHeader() {
    const courseTitle =
      state.course?.title ||
      "Course";

    const quizTitle =
      state.quiz?.title ||
      "Quiz";

    $("quizPageTitle").textContent =
      quizTitle;

    $("quizBreadcrumbCourse").textContent =
      courseTitle;

    $("quizBreadcrumbTitle").textContent =
      quizTitle;

    $("quizCourseBackLink").href =
      `admin-lms-course-builder.html?course=${encodeURIComponent(state.courseId)}`;

    $("backToCourseButton").href =
      `admin-lms-course-builder.html?course=${encodeURIComponent(state.courseId)}`;

    $("quizLessonEditorLink").href =
      `admin-lms-lesson-editor.html?course=${encodeURIComponent(state.courseId)}` +
      `&lesson=${encodeURIComponent(state.lessonId)}`;
  }


  function renderQuizSettings() {
    const quiz =
      state.quiz ||
      {};

    $("quizTitle").value =
      quiz.title ||
      "";

    $("quizDescription").value =
      quiz.description ||
      "";

    $("passingScore").value =
      quiz.passing_score ??
      80;

    $("attemptLimit").value =
      quiz.attempt_limit ??
      0;

    $("randomizeQuestions").checked =
      quiz.randomize_questions ===
      true;

    $("randomizeAnswers").checked =
      quiz.randomize_answers ===
      true;

    $("showCorrectAnswers").checked =
      quiz.show_correct_answers !==
      false;

    $("showExplanations").checked =
      quiz.show_explanations !==
      false;

    $("quizRequired").checked =
      quiz.is_required !==
      false;
  }


  function renderQuestions() {
    const list =
      $("questionList");

    const empty =
      $("questionEmpty");

    if (
      !list ||
      !empty
    ) {
      return;
    }

    empty.hidden =
      state.questions.length >
      0;

    list.innerHTML =
      state.questions
        .map(
          questionCard
        )
        .join("");

    list
      .querySelectorAll(
        "[data-edit-question]"
      )
      .forEach(
        (button) => {
          button.addEventListener(
            "click",
            () => {
              openQuestionModal(
                Number(
                  button.dataset
                    .editQuestion
                )
              );
            }
          );
        }
      );

    list
      .querySelectorAll(
        "[data-delete-question]"
      )
      .forEach(
        (button) => {
          button.addEventListener(
            "click",
            () => {
              openDeleteQuestionModal(
                Number(
                  button.dataset
                    .deleteQuestion
                )
              );
            }
          );
        }
      );

    list
      .querySelectorAll(
        ".quiz-question-card"
      )
      .forEach(
        (card) => {
          card.addEventListener(
            "dragstart",
            beginQuestionDrag
          );

          card.addEventListener(
            "dragend",
            endQuestionDrag
          );

          card.addEventListener(
            "dragover",
            overQuestionDrag
          );

          card.addEventListener(
            "drop",
            dropQuestion
          );
        }
      );

    renderSummary();
  }


  function questionCard(
    question,
    index
  ) {
    const options =
      question
        .lms_question_options ||
      [];

    return `
      <article
        class="quiz-question-card"
        draggable="true"
        data-question-index="${index}"
      >
        <div class="quiz-question-card-head">

          <span class="quiz-question-drag">
            ⋮⋮
          </span>

          <span class="quiz-question-number">
            ${index + 1}
          </span>

          <div class="quiz-question-copy">
            <strong>
              ${esc(question.question_text || "Untitled question")}
            </strong>

            <span>
              ${
                question.editor_type === "true_false"
                  ? "True / False"
                  : (
                      options.filter((option) => option.is_correct).length > 1
                        ? "Multiple Choice · Select all that apply"
                        : "Multiple Choice"
                    )
              }
              ·
              ${question.points || 1}
              point${Number(question.points || 1) === 1 ? "" : "s"}
            </span>
          </div>

          <div class="quiz-question-actions">
            <button
              type="button"
              data-edit-question="${index}"
            >
              Edit
            </button>

            <button
              type="button"
              class="delete"
              data-delete-question="${index}"
            >
              Delete
            </button>
          </div>
        </div>

        <div class="quiz-question-options">
          ${
            options.map(
              (option) => `
                <div class="quiz-question-option ${option.is_correct ? "correct" : ""}">
                  <i>${option.is_correct ? "✓" : ""}</i>
                  <span>${esc(option.option_text || "Blank answer")}</span>
                </div>
              `
            ).join("")
          }
        </div>
      </article>
    `;
  }


  function openQuestionModal(
    index = null
  ) {
    state.editingQuestionIndex =
      Number.isInteger(index)
        ? index
        : null;

    const question =
      state.editingQuestionIndex ===
      null
        ? null
        : state.questions[
            state.editingQuestionIndex
          ];

    $("questionModalTitle").textContent =
      question
        ? "Edit Question"
        : "Add Question";

    $("saveQuestionButton").textContent =
      question
        ? "Save Question"
        : "Add Question";

    $("questionType").value =
      question?.editor_type ||
      "multiple_choice";

    $("questionText").value =
      question?.question_text ||
      "";

    $("questionPoints").value =
      question?.points ||
      1;

    $("questionExplanation").value =
      question?.explanation ||
      "";

    hideQuestionError();

    ensureMultipleChoiceHint();

    if (
      question?.editor_type ===
      "true_false"
    ) {
      renderOptionEditor([
        {
          option_text:
            "True",
          is_correct:
            question
              .lms_question_options
              ?.find(
                (option) =>
                  String(
                    option.option_text
                  ).toLowerCase() ===
                  "true"
              )
              ?.is_correct ===
            true
        },
        {
          option_text:
            "False",
          is_correct:
            question
              .lms_question_options
              ?.find(
                (option) =>
                  String(
                    option.option_text
                  ).toLowerCase() ===
                  "false"
              )
              ?.is_correct ===
            true
        }
      ]);

    } else {
      const options =
        question
          ?.lms_question_options
          ?.length
          ? question
              .lms_question_options
          : [
              {
                option_text:
                  "",
                is_correct:
                  true
              },
              {
                option_text:
                  "",
                is_correct:
                  false
              },
              {
                option_text:
                  "",
                is_correct:
                  false
              },
              {
                option_text:
                  "",
                is_correct:
                  false
              }
            ];

      renderOptionEditor(
        options
      );
    }

    syncQuestionTypeUi();

    $("questionModal").hidden =
      false;

    document.body.style.overflow =
      "hidden";

    window.setTimeout(
      () =>
        $("questionText")
          ?.focus(),
      0
    );
  }


  function closeQuestionModal() {
    if (
      !$("questionModal") ||
      $("questionModal").hidden
    ) {
      return;
    }

    $("questionModal").hidden =
      true;

    state.editingQuestionIndex =
      null;

    restoreScroll();
  }


  function syncQuestionTypeUi() {
    const trueFalse =
      $("questionType").value ===
      "true_false";

    $("addAnswerOptionButton").hidden =
      trueFalse;

    if (trueFalse) {
      renderOptionEditor([
        {
          option_text:
            "True",
          is_correct:
            true
        },
        {
          option_text:
            "False",
          is_correct:
            false
        }
      ]);

      return;
    }

    /*
     * When switching back to Multiple Choice, rebuild the answer controls
     * as checkboxes. Preserve the visible answer text where possible.
     */
    const currentRows =
      [
        ...$("questionOptionList")
          .querySelectorAll(
            ".question-option-row"
          )
      ];

    if (currentRows.length) {
      const current =
        currentRows.map(
          (row, index) => ({
            option_text:
              row
                .querySelector(
                  'input[type="text"]'
                )
                ?.value ||
              "",
            is_correct:
              row
                .querySelector(
                  "[data-correct-answer]"
                )
                ?.checked ===
              true
          })
        );

      renderOptionEditor(current);
    }
  }


  function ensureMultipleChoiceHint() {
    const list =
      $("questionOptionList");

    const container =
      list?.parentElement;

    if (!container) return;

    let hint =
      container.querySelector(
        "[data-multiple-answer-hint]"
      );

    if (!hint) {
      hint =
        document.createElement(
          "small"
        );

      hint.dataset.multipleAnswerHint =
        "true";

      hint.style.display =
        "block";

      hint.style.marginTop =
        "6px";

      hint.style.color =
        "#687386";

      hint.style.fontSize =
        "11px";

      container.appendChild(
        hint
      );
    }

    const refresh = () => {
      hint.textContent =
        $("questionType")?.value ===
        "true_false"
          ? "Choose one correct answer."
          : "Check every answer that should be accepted as correct. You may select more than one.";
    };

    refresh();

    $("questionType")
      ?.addEventListener(
        "change",
        refresh,
        {
          once: true
        }
      );
  }


  function renderOptionEditor(
    options
  ) {
    const list =
      $("questionOptionList");

    list.innerHTML =
      "";

    (
      options ||
      []
    ).forEach(
      (option) => {
        list.appendChild(
          createOptionRow(
            option
          )
        );
      }
    );
  }


  function createOptionRow(
    option = {}
  ) {
    const row =
      document.createElement(
        "div"
      );

    row.className =
      "question-option-row";

    const trueFalse =
      $("questionType")
        ?.value ===
      "true_false";

    /*
     * Multiple Choice = checkbox so one or several answers can be correct.
     * True / False = radio because it must have exactly one correct answer.
     */
    const correct =
      document.createElement(
        "input"
      );

    correct.type =
      trueFalse
        ? "radio"
        : "checkbox";

    correct.dataset.correctAnswer =
      "true";

    if (trueFalse) {
      correct.name =
        "questionCorrectOption";
    }

    correct.checked =
      option.is_correct ===
      true;

    correct.setAttribute(
      "aria-label",
      trueFalse
        ? "Correct answer"
        : "Mark this answer as correct"
    );

    const text =
      document.createElement(
        "input"
      );

    text.type =
      "text";

    text.placeholder =
      "Answer option";

    text.value =
      option.option_text ||
      "";

    if (trueFalse) {
      text.readOnly =
        true;
    }

    const remove =
      document.createElement(
        "button"
      );

    remove.type =
      "button";

    remove.textContent =
      "×";

    remove.setAttribute(
      "aria-label",
      "Remove answer"
    );

    remove.addEventListener(
      "click",
      () => {
        if (
          $("questionType")
            ?.value ===
          "true_false"
        ) {
          return;
        }

        row.remove();
      }
    );

    row.append(
      correct,
      text,
      remove
    );

    return row;
  }

  function addOptionRow() {
    if (
      $("questionType").value ===
      "true_false"
    ) {
      return;
    }

    $("questionOptionList")
      .appendChild(
        createOptionRow({
          option_text:
            "",
          is_correct:
            false
        })
      );
  }


  function saveQuestionToState() {
    const text =
      $("questionText")
        .value
        .trim();

    if (!text) {
      showQuestionError(
        "Enter the question text."
      );

      return;
    }

    const rows =
      [
        ...$("questionOptionList")
          .querySelectorAll(
            ".question-option-row"
          )
      ];

    const options =
      rows
        .map(
          (row, index) => ({
            option_text:
              row
                .querySelector(
                  'input[type="text"]'
                )
                .value
                .trim(),

            is_correct:
              row
                .querySelector(
                  "[data-correct-answer]"
                )
                .checked,

            sort_order:
              index + 1
          })
        )
        .filter(
          (option) =>
            option.option_text
        );

    if (
      options.length < 2
    ) {
      showQuestionError(
        "Add at least two answer options."
      );

      return;
    }

    const correctCount =
      options.filter(
        (option) =>
          option.is_correct
      ).length;

    const trueFalse =
      $("questionType").value ===
      "true_false";

    if (
      trueFalse &&
      correctCount !== 1
    ) {
      showQuestionError(
        "Choose exactly one correct answer for a True / False question."
      );

      return;
    }

    if (
      !trueFalse &&
      correctCount < 1
    ) {
      showQuestionError(
        "Select at least one correct answer. Multiple answers may be marked correct."
      );

      return;
    }

    const question = {
      id:
        state.editingQuestionIndex ===
          null
          ? null
          : state.questions[
              state
                .editingQuestionIndex
            ]?.id ||
            null,

      question_type:
        $("questionType").value === "true_false"
          ? "true_false"
          : "multiple_choice",

      editor_type:
        $("questionType").value,

      question_text:
        text,

      explanation:
        $("questionExplanation")
          .value
          .trim(),

      points:
        Math.max(
          1,
          Math.round(
            Number(
              $("questionPoints")
                .value
            ) ||
            1
          )
        ),

      lms_question_options:
        options
    };

    if (
      state.editingQuestionIndex ===
      null
    ) {
      state.questions.push(
        question
      );

    } else {
      state.questions[
        state.editingQuestionIndex
      ] = {
        ...state.questions[
          state.editingQuestionIndex
        ],
        ...question
      };
    }

    closeQuestionModal();

    renderQuestions();
  }


  function showQuestionError(
    message
  ) {
    const node =
      $("questionModalError");

    node.textContent =
      message;

    node.hidden =
      false;
  }


  function hideQuestionError() {
    const node =
      $("questionModalError");

    node.textContent =
      "";

    node.hidden =
      true;
  }


  function openDeleteQuestionModal(
    index
  ) {
    if (
      !Number.isInteger(
        index
      ) ||
      !state.questions[index]
    ) {
      return;
    }

    state.deletingQuestionIndex =
      index;

    $("deleteQuestionModal").hidden =
      false;

    document.body.style.overflow =
      "hidden";
  }


  function closeDeleteQuestionModal() {
    if (
      !$("deleteQuestionModal") ||
      $("deleteQuestionModal").hidden
    ) {
      return;
    }

    $("deleteQuestionModal").hidden =
      true;

    state.deletingQuestionIndex =
      null;

    restoreScroll();
  }


  function confirmDeleteQuestion() {
    const index =
      state.deletingQuestionIndex;

    if (
      !Number.isInteger(
        index
      ) ||
      !state.questions[index]
    ) {
      return;
    }

    state.questions.splice(
      index,
      1
    );

    closeDeleteQuestionModal();

    renderQuestions();
  }


  function beginQuestionDrag(
    event
  ) {
    const card =
      event.currentTarget;

    card.classList.add(
      "dragging"
    );

    event.dataTransfer.effectAllowed =
      "move";

    event.dataTransfer.setData(
      "text/plain",
      card.dataset
        .questionIndex ||
      ""
    );
  }


  function endQuestionDrag(
    event
  ) {
    event.currentTarget
      .classList.remove(
        "dragging"
      );
  }


  function overQuestionDrag(
    event
  ) {
    event.preventDefault();
    event.dataTransfer.dropEffect =
      "move";
  }


  function dropQuestion(
    event
  ) {
    event.preventDefault();

    const source =
      Number(
        event.dataTransfer
          .getData(
            "text/plain"
          )
      );

    const target =
      Number(
        event.currentTarget
          .dataset
          .questionIndex
      );

    if (
      !Number.isInteger(
        source
      ) ||
      !Number.isInteger(
        target
      ) ||
      source === target
    ) {
      return;
    }

    const [
      moved
    ] =
      state.questions.splice(
        source,
        1
      );

    state.questions.splice(
      target,
      0,
      moved
    );

    renderQuestions();
  }


  async function saveQuiz() {
    if (state.editState?.locked) {
      await offerSafeRevision();
      return;
    }

    if (
      state.saving
    ) {
      return;
    }

    const title =
      $("quizTitle")
        .value
        .trim();

    if (!title) {
      toast(
        "Enter a quiz title.",
        "error"
      );

      $("quizTitle").focus();

      return;
    }

    for (
      let index = 0;
      index <
      state.questions.length;
      index += 1
    ) {
      const question =
        state.questions[index];

      if (
        !question
          .question_text
          ?.trim()
      ) {
        toast(
          `Question ${index + 1} needs question text.`,
          "error"
        );

        return;
      }

      const options =
        question
          .lms_question_options ||
        [];

      if (
        options.length < 2
      ) {
        toast(
          `Question ${index + 1} needs at least two answers.`,
          "error"
        );

        return;
      }

      const correctCount =
        options.filter(
          (option) =>
            option.is_correct
        ).length;

      const trueFalse =
        question.editor_type ===
          "true_false" ||
        question.question_type ===
          "true_false";

      if (
        trueFalse &&
        correctCount !== 1
      ) {
        toast(
          `Question ${index + 1} must have exactly one correct answer.`,
          "error"
        );

        return;
      }

      if (
        !trueFalse &&
        correctCount < 1
      ) {
        toast(
          `Question ${index + 1} needs at least one correct answer.`,
          "error"
        );

        return;
      }
    }

    state.saving =
      true;

    setSaveButtonsBusy(
      true
    );

    try {
      const payload = {
        lesson_id:
          state.lessonId,

        title,

        description:
          $("quizDescription")
            .value
            .trim() ||
          null,

        passing_score:
          clampNumber(
            $("passingScore")
              .value,
            0,
            100,
            80
          ),

        /*
         * Database constraint safe:
         * 0 / blank = unlimited = NULL
         */
        attempt_limit:
          quizAttemptLimit(
            $("attemptLimit")
              .value
          ),

        randomize_questions:
          $("randomizeQuestions")
            .checked,

        randomize_answers:
          $("randomizeAnswers")
            .checked,

        show_correct_answers:
          $("showCorrectAnswers")
            .checked,

        show_explanations:
          $("showExplanations")
            .checked,

        is_required:
          $("quizRequired")
            .checked,

        updated_at:
          new Date()
            .toISOString()
      };

      const {
        data: savedQuiz,
        error: quizError
      } = await state.client
        .from(TABLES.quizzes)
        .update(payload)
        .eq(
          "id",
          state.quizId
        )
        .select("*")
        .single();

      if (quizError) {
        throw quizError;
      }

      const {
        data: existing,
        error: existingError
      } = await state.client
        .from(TABLES.questions)
        .select("id")
        .eq(
          "quiz_id",
          state.quizId
        );

      if (existingError) {
        throw existingError;
      }

      const existingIds =
        new Set(
          (existing || [])
            .map(
              (row) =>
                row.id
            )
        );

      const seen =
        new Set();

      for (
        let index = 0;
        index <
        state.questions.length;
        index += 1
      ) {
        const question =
          state.questions[index];

        const row = {
          quiz_id:
            state.quizId,

          /*
           * The LMS enum supports multiple_choice and true_false.
           * Multiple-choice questions may have one or several
           * lms_question_options rows with is_correct = true.
           */
          question_type:
            (
              question.editor_type ===
                "true_false" ||
              question.question_type ===
                "true_false"
            )
              ? "true_false"
              : "multiple_choice",

          question_text:
            question
              .question_text
              .trim(),

          explanation:
            question
              .explanation
              ?.trim() ||
            null,

          points:
            Math.max(
              1,
              Math.round(
                Number(
                  question.points
                ) ||
                1
              )
            ),

          sort_order:
            index + 1,

          updated_at:
            new Date()
              .toISOString()
        };

        let questionId =
          question.id;

        if (
          isUuid(
            questionId
          )
        ) {
          const {
            error
          } = await state.client
            .from(TABLES.questions)
            .update(row)
            .eq(
              "id",
              questionId
            );

          if (error) {
            throw error;
          }

        } else {
          const {
            data,
            error
          } = await state.client
            .from(TABLES.questions)
            .insert(row)
            .select("*")
            .single();

          if (error) {
            throw error;
          }

          questionId =
            data.id;

          state.questions[
            index
          ].id =
            questionId;
        }

        seen.add(
          questionId
        );

        const {
          error: deleteOptionsError
        } = await state.client
          .from(TABLES.options)
          .delete()
          .eq(
            "question_id",
            questionId
          );

        if (
          deleteOptionsError
        ) {
          throw deleteOptionsError;
        }

        const optionRows =
          (
            question
              .lms_question_options ||
            []
          )
            .map(
              (
                option,
                optionIndex
              ) => ({
                question_id:
                  questionId,

                option_text:
                  option
                    .option_text
                    .trim(),

                is_correct:
                  option.is_correct ===
                  true,

                sort_order:
                  optionIndex +
                  1
              })
            );

        if (
          optionRows.length
        ) {
          const {
            error: optionError
          } = await state.client
            .from(TABLES.options)
            .insert(
              optionRows
            );

          if (optionError) {
            throw optionError;
          }
        }
      }

      const remove =
        [
          ...existingIds
        ].filter(
          (id) =>
            !seen.has(id)
        );

      if (
        remove.length
      ) {
        const {
          error
        } = await state.client
          .from(TABLES.questions)
          .delete()
          .in(
            "id",
            remove
          );

        if (error) {
          throw error;
        }
      }

      await syncQuizBlock(
        savedQuiz
      );

      state.quiz =
        savedQuiz;

      renderHeader();

      toast(
        "Quiz saved successfully.",
        "success"
      );

    } catch (error) {
      console.error(
        "[Save Quiz]",
        error
      );

      toast(
        error?.message ||
        "Unable to save quiz.",
        "error"
      );

    } finally {
      state.saving =
        false;

      setSaveButtonsBusy(
        false
      );
    }
  }


  async function syncQuizBlock(
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
        state.lessonId
      )
      .eq(
        "block_type",
        "quiz"
      )
      .order(
        "sort_order",
        {
          ascending: true
        }
      )
      .limit(1)
      .maybeSingle();

    if (existingError) {
      throw existingError;
    }

    const payload = {
      lesson_id:
        state.lessonId,

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
        state.lessonId
      )
      .order(
        "sort_order",
        {
          ascending:
            false
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


  function renderSummary() {
    $("questionCount").textContent =
      String(
        state.questions.length
      );

    const passing =
      clampNumber(
        $("passingScore")
          ?.value,
        0,
        100,
        80
      );

    $("passingScoreSummary").textContent =
      `${passing}%`;

    const attempts =
      quizAttemptLimit(
        $("attemptLimit")
          ?.value
      );

    $("attemptSummary").textContent =
      attempts == null
        ? "Unlimited"
        : String(
            attempts
          );
  }


  function setSaveButtonsBusy(
    busy
  ) {
    [
      "saveQuizButton",
      "saveQuizTopButton"
    ].forEach(
      (id) => {
        const button =
          $(id);

        if (!button) {
          return;
        }

        button.disabled =
          busy;

        button.textContent =
          busy
            ? "Saving..."
            : "Save Quiz";
      }
    );
  }


  function bind() {
    $("addQuestionButton")
      ?.addEventListener(
        "click",
        () =>
          openQuestionModal()
      );

    $("saveQuestionButton")
      ?.addEventListener(
        "click",
        saveQuestionToState
      );

    $("addAnswerOptionButton")
      ?.addEventListener(
        "click",
        addOptionRow
      );

    $("questionType")
      ?.addEventListener(
        "change",
        syncQuestionTypeUi
      );

    $("confirmDeleteQuestionButton")
      ?.addEventListener(
        "click",
        confirmDeleteQuestion
      );

    [
      "saveQuizButton",
      "saveQuizTopButton"
    ].forEach(
      (id) => {
        $(id)
          ?.addEventListener(
            "click",
            saveQuiz
          );
      }
    );

    [
      "passingScore",
      "attemptLimit"
    ].forEach(
      (id) => {
        $(id)
          ?.addEventListener(
            "input",
            renderSummary
          );
      }
    );

    document
      .querySelectorAll(
        "[data-close-question-modal]"
      )
      .forEach(
        (node) => {
          node.addEventListener(
            "click",
            closeQuestionModal
          );
        }
      );

    document
      .querySelectorAll(
        "[data-close-delete-question]"
      )
      .forEach(
        (node) => {
          node.addEventListener(
            "click",
            closeDeleteQuestionModal
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

        closeQuestionModal();
        closeDeleteQuestionModal();
      }
    );
  }


  function restoreScroll() {
    const anyOpen =
      [
        "questionModal",
        "deleteQuestionModal"
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
      $("quizBuilderToast");

    if (!node) {
      return;
    }

    node.textContent =
      message;

    node.className =
      `quiz-builder-toast show ${type || "success"}`;

    window.clearTimeout(
      toast.timer
    );

    toast.timer =
      window.setTimeout(
        () => {
          node.classList.remove(
            "show"
          );
        },
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
