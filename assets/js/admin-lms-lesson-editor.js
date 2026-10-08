/* ============================================================
   SCREENINGS4U — ADMIN LMS LESSON EDITOR
   Full structured editor + uploads + Cloudflare Stream
   ============================================================ */

(function () {
  "use strict";

  const TABLES = Object.freeze({
    lessons: "lms_lessons",
    sections: "lms_sections",
    blocks: "lms_content_blocks",
    media: "lms_media",
    quizzes: "lms_quizzes",
    assessments: "lms_assessments"
  });

  const STORAGE_BUCKET = "lms-media";

  const state = {
    courseId: "",
    lessonId: "",
    lesson: null,
    sections: [],
    blocks: [],
    media: new Map(),
    client: null,
    saving: false,
    activeMenu: null
  };

  const $ = (id) => document.getElementById(id);

  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    try {
      state.client = await waitForClient();
      await requireSession();

      const params = new URLSearchParams(location.search);

      state.courseId =
        params.get("course") ||
        params.get("course_id") ||
        "";

      state.lessonId =
        params.get("lesson") ||
        params.get("lesson_id") ||
        "";

      if (!isUuid(state.lessonId)) {
        throw new Error("A valid lesson ID is required.");
      }

      bindBaseUi();
      await load();
      buildFullEditor();
      renderAll();
    } catch (error) {
      console.error("[Lesson Editor]", error);
      toast(error?.message || "Unable to load lesson.", "error");
    }
  }

  async function waitForClient(timeout = 5000) {
    const started = Date.now();

    while (Date.now() - started < timeout) {
      const client = await resolveClient();
      if (client?.from) return client;
      await delay(75);
    }

    throw new Error("Supabase client is unavailable.");
  }

  async function resolveClient() {
    try {
      if (typeof window.getScreenings4uSupabase === "function") {
        const client = await window.getScreenings4uSupabase();
        if (client?.from) return client;
      }
    } catch (_) {}

    if (window.screenings4uSupabase?.from) return window.screenings4uSupabase;
    if (window.supabaseClient?.from) return window.supabaseClient;
    if (window.supabaseAdmin?.from) return window.supabaseAdmin;

    if (
      window.supabase?.createClient &&
      window.SCREENINGS4U_SUPABASE_URL &&
      window.SCREENINGS4U_SUPABASE_ANON_KEY
    ) {
      window.supabaseClient = window.supabase.createClient(
        window.SCREENINGS4U_SUPABASE_URL,
        window.SCREENINGS4U_SUPABASE_ANON_KEY
      );
      return window.supabaseClient;
    }

    return null;
  }

  async function requireSession() {
    if (window.S4UAuth?.requireSession) {
      const session = await window.S4UAuth.requireSession("admin-login.html");
      if (!session) throw new Error("Authentication required.");
      return session;
    }

    const { data, error } = await state.client.auth.getSession();

    if (error) throw error;

    if (!data?.session?.user) {
      location.replace("admin-login.html");
      throw new Error("Authentication required.");
    }

    return data.session;
  }

  function bindBaseUi() {
    $("lessonSaveButton")?.addEventListener("click", saveLesson);

    $("lessonCancelButton")?.addEventListener("click", function (event) {
      event.preventDefault();
      goBackToCourse();
    });

    document.addEventListener("click", async function (event) {
      const insert = event.target.closest("[data-insert]");
      if (insert) {
        event.preventDefault();
        await openNewBlock(normalizeInsertKind(insert.dataset.insert || ""));
        return;
      }

      const addBlock = event.target.closest("[data-editor-add]");
      if (addBlock) {
        event.preventDefault();
        await openNewBlock(addBlock.dataset.editorAdd || "");
        return;
      }

      const more = event.target.closest("[data-block-more]");
      if (more) {
        event.preventDefault();
        event.stopPropagation();
        openBlockActionMenu(more, more.dataset.blockMore || "");
        return;
      }

      const edit = event.target.closest("[data-edit-block]");
      if (edit) {
        event.preventDefault();
        await editBlock(edit.dataset.editBlock || "");
        return;
      }

      const closeMenuTarget = event.target.closest(".s4u-editor-action-menu");
      if (!closeMenuTarget) closeActionMenu();
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        closeActionMenu();
        if (!$("s4uEditorModal")?.hidden) closeEditorModal(null);
      }
    });
  }

  async function load() {
    const [
      { data: lesson, error: lessonError },
      { data: blocks, error: blockError }
    ] = await Promise.all([
      state.client
        .from(TABLES.lessons)
        .select("*")
        .eq("id", state.lessonId)
        .single(),

      state.client
        .from(TABLES.blocks)
        .select("*")
        .eq("lesson_id", state.lessonId)
        .order("sort_order", { ascending: true })
    ]);

    if (lessonError) throw lessonError;
    if (blockError) throw blockError;

    const { data: currentSection, error: sectionError } = await state.client
      .from(TABLES.sections)
      .select("id,course_id,title,sort_order")
      .eq("id", lesson.section_id)
      .single();

    if (sectionError) throw sectionError;

    if (!state.courseId) {
      state.courseId = currentSection.course_id;
    }

    if (currentSection.course_id !== state.courseId) {
      throw new Error("This lesson does not belong to the selected course.");
    }

    const { data: sections, error: sectionsError } = await state.client
      .from(TABLES.sections)
      .select("id,title,sort_order")
      .eq("course_id", state.courseId)
      .order("sort_order", { ascending: true });

    if (sectionsError) throw sectionsError;

    state.lesson = lesson;
    state.sections = sections || [];
    state.blocks = blocks || [];
    state.media = new Map();

    const mediaIds = [
      ...new Set(
        state.blocks
          .map((block) => block.media_id)
          .filter(Boolean)
      )
    ];

    if (mediaIds.length) {
      const { data: rows, error } = await state.client
        .from(TABLES.media)
        .select("*")
        .in("id", mediaIds);

      if (error) throw error;

      (rows || []).forEach((row) => {
        state.media.set(row.id, row);
      });
    }
  }

  function buildFullEditor() {
    injectEditorStyles();
    hideLegacyContentFields();
    ensureLessonSettingsPanel();
    ensureEditorCanvas();
    ensureEditorModal();
  }

  function hideLegacyContentFields() {
    /*
     * The old Content card is now obsolete because the full structured
     * editor replaces its toolbar, textarea, Video URL, and duration fields.
     * Hide the entire card instead of leaving an empty shell on the page.
     */
    const legacyContent = $("lessonContent");

    if (legacyContent) {
      const legacyCard =
        legacyContent.closest(".lesson-card") ||
        legacyContent.closest(".admin-card") ||
        legacyContent.closest("section");

      if (legacyCard) {
        legacyCard.hidden = true;
        legacyCard.setAttribute("aria-hidden", "true");
        legacyCard.classList.add("s4u-legacy-content-hidden");
      }
    }

    /*
     * Defensive fallback for versions of the HTML where the fields are not
     * wrapped by one common card.
     */
    ["lessonContent", "lessonVideoUrl", "lessonVideoDuration"].forEach((id) => {
      const node = $(id);
      if (!node) return;

      const wrapper =
        node.closest(
          ".admin-form-group, .lesson-editor-field, .form-field, .lesson-content-field, .lesson-media-grid"
        ) ||
        node.parentElement;

      if (wrapper) wrapper.hidden = true;
    });

    document.querySelectorAll(
      ".lesson-content-toolbar, .lesson-editor-tools, .insert-toolbar, .editor-toolbar"
    ).forEach((toolbar) => {
      toolbar.hidden = true;
    });
  }

  function ensureLessonSettingsPanel() {
    if ($("s4uLessonSettings")) return;

    const titleField = $("lessonTitle");

    const anchor =
      titleField?.closest(".admin-card, .lesson-editor-card, section") ||
      titleField?.parentElement;

    if (!anchor) return;

    const panel = document.createElement("section");
    panel.id = "s4uLessonSettings";
    panel.className = "s4u-editor-settings";
    panel.innerHTML = `
      <div class="s4u-editor-section-head">
        <div>
          <span>LESSON SETTINGS</span>
          <h2>Lesson Configuration</h2>
          <p>Control publishing, completion rules, timing, and lesson behavior.</p>
        </div>
      </div>

      <div class="s4u-editor-settings-grid">
        <label>
          <span>Status</span>
          <select id="s4uLessonStatus">
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </select>
        </label>

        <label>
          <span>Estimated Minutes</span>
          <input id="s4uLessonMinutes" type="number" min="0" step="1" placeholder="15">
        </label>

        <label class="wide">
          <span>Description</span>
          <textarea id="s4uLessonDescription" rows="4" placeholder="Short lesson description"></textarea>
        </label>
      </div>

      <div class="s4u-editor-toggle-grid">
        ${toggleHtml("s4uLessonRequired", "Required Lesson", "Learners must complete this lesson.")}
        ${toggleHtml("s4uCompletionRequired", "Completion Required", "Lesson completion counts toward course completion.")}
        ${toggleHtml("s4uLockPrevious", "Lock Until Previous Complete", "Require the previous lesson to be completed first.")}
      </div>
    `;

    anchor.insertAdjacentElement("afterend", panel);
  }

  function toggleHtml(id, title, copy) {
    return `
      <label class="s4u-editor-toggle">
        <span>
          <strong>${esc(title)}</strong>
          <small>${esc(copy)}</small>
        </span>
        <input id="${esc(id)}" type="checkbox">
        <i></i>
      </label>
    `;
  }

  function ensureEditorCanvas() {
    if ($("s4uFullLessonEditor")) return;

    const settings = $("s4uLessonSettings");
    if (!settings) return;

    const editor = document.createElement("section");
    editor.id = "s4uFullLessonEditor";
    editor.className = "s4u-full-editor";
    editor.innerHTML = `
      <header class="s4u-editor-header">
        <div>
          <span>LESSON CONTENT</span>
          <h2>Content Editor</h2>
          <p>Build this lesson with text, media, downloads, quizzes, embeds, forms, and more.</p>
        </div>
        <div class="s4u-editor-counter" id="s4uBlockCount">0 blocks</div>
      </header>

      <div class="s4u-editor-toolbar">
        ${toolbarButton("heading", "H", "Heading")}
        ${toolbarButton("text", "¶", "Text")}
        ${toolbarButton("video", "▶", "Video")}
        ${toolbarButton("image", "▧", "Image")}
        ${toolbarButton("download", "⇩", "File")}
        ${toolbarButton("pdf", "PDF", "PDF")}
        ${toolbarButton("audio", "♪", "Audio")}
        ${toolbarButton("link", "↗", "Link")}
        ${toolbarButton("embed", "</>", "Embed")}
        ${toolbarButton("quiz", "?", "Quiz")}
        ${toolbarButton("knowledge_check", "✓", "Assessment")}
        ${toolbarButton("form", "▤", "Form")}
        ${toolbarButton("divider", "—", "Divider")}
      </div>

      <div class="s4u-editor-canvas" id="s4uEditorCanvas"></div>

      <button type="button" class="s4u-editor-add-row" data-editor-add="text">
        <span>＋</span>
        Add another content block
      </button>
    `;

    settings.insertAdjacentElement("afterend", editor);
  }

  function toolbarButton(type, icon, label) {
    return `
      <button type="button" class="s4u-editor-tool" data-editor-add="${esc(type)}">
        <strong>${esc(icon)}</strong>
        <span>${esc(label)}</span>
      </button>
    `;
  }

  function renderAll() {
    renderLesson();
    renderBlocks();
  }

  function renderLesson() {
    const lesson = state.lesson || {};

    setText("lessonPageTitle", lesson.title || "Lesson");
    setText("lessonBreadcrumbTitle", lesson.title || "Lesson");
    setValue("lessonTitle", lesson.title || "");

    const section = $("lessonSection");
    if (section) {
      section.innerHTML = state.sections
        .map((item) => `
          <option value="${esc(item.id)}">${esc(item.title || "Section")}</option>
        `)
        .join("");

      section.value = lesson.section_id || "";
    }

    setValue("s4uLessonStatus", lesson.status || "draft");
    setValue("s4uLessonMinutes", lesson.estimated_minutes ?? "");
    setValue("s4uLessonDescription", lesson.description || "");
    setChecked("s4uLessonRequired", lesson.is_required !== false);
    setChecked("s4uCompletionRequired", lesson.completion_required !== false);
    setChecked("s4uLockPrevious", lesson.lock_until_previous_complete === true);

    const back = getCourseBuilderUrl();

    if ($("lessonCourseLink")) $("lessonCourseLink").href = back;
    if ($("lessonBackLink")) $("lessonBackLink").href = back;
    if ($("lessonCancelButton")) $("lessonCancelButton").href = back;
  }

  async function renderBlocks() {
    const canvas = $("s4uEditorCanvas");
    const count = $("s4uBlockCount");

    if (!canvas || !count) return;

    count.textContent =
      `${state.blocks.length} block${state.blocks.length === 1 ? "" : "s"}`;

    if (!state.blocks.length) {
      canvas.innerHTML = `
        <div class="s4u-editor-empty">
          <div class="s4u-editor-empty-icon">＋</div>
          <h3>Build your first lesson block</h3>
          <p>Choose a content type above. Every item is saved as structured LMS content.</p>
          <button type="button" data-editor-add="text">Add Text Block</button>
        </div>
      `;
      return;
    }

    const html = [];

    for (let index = 0; index < state.blocks.length; index += 1) {
      const block = state.blocks[index];
      const media = block.media_id ? state.media.get(block.media_id) : null;
      const preview = await blockPreview(block, media);

      html.push(`
        <article class="s4u-editor-block" data-block-id="${esc(block.id)}">
          <div class="s4u-editor-drag">⋮⋮</div>

          <button type="button" class="s4u-editor-block-main" data-edit-block="${esc(block.id)}">
            <div class="s4u-editor-block-icon">${blockIcon(block.block_type)}</div>
            <div class="s4u-editor-block-copy">
              <div class="s4u-editor-block-title">
                <strong>${esc(block.title || typeLabel(block.block_type))}</strong>
                <span>${esc(typeLabel(block.block_type))}</span>
                ${block.is_required ? `<em>Required</em>` : ""}
              </div>
              ${preview}
            </div>
          </button>

          <button
            type="button"
            class="s4u-editor-more"
            data-block-more="${esc(block.id)}"
            aria-label="Content block actions"
            aria-haspopup="menu"
          >••</button>
        </article>
      `);
    }

    canvas.innerHTML = html.join("");
  }

  async function blockPreview(block, media) {
    const type = block.block_type;

    if (type === "heading") {
      const level = block.settings?.level || "h2";
      return `<${level} class="s4u-preview-heading">${esc(block.content || block.title || "Heading")}</${level}>`;
    }

    if (type === "text") {
      return `<div class="s4u-preview-text">${formatBasicText(block.content || "")}</div>`;
    }

    if (type === "divider") {
      return `<div class="s4u-preview-divider"></div>`;
    }

    if (type === "image") {
      const url = await mediaDisplayUrl(block, media);
      return url
        ? `<div class="s4u-preview-image"><img src="${esc(url)}" alt="${esc(block.settings?.alt || block.title || "")}"><small>${esc(block.settings?.caption || "")}</small></div>`
        : `<div class="s4u-preview-placeholder">Image attached</div>`;
    }

    if (type === "video") {
      const provider = media?.provider || block.settings?.provider || "external";
      const label =
        provider === "cloudflare_stream"
          ? `Cloudflare Stream · ${media?.provider_video_id || block.settings?.provider_video_id || "video"}`
          : block.external_url || "External video";

      return `<div class="s4u-preview-media"><span>▶</span><strong>${esc(label)}</strong></div>`;
    }

    if (["download", "pdf", "audio"].includes(type)) {
      const name = media?.original_filename || block.external_url || block.title || typeLabel(type);
      return `<div class="s4u-preview-media"><span>${type === "audio" ? "♪" : "⇩"}</span><strong>${esc(name)}</strong></div>`;
    }

    if (["link", "embed", "form"].includes(type)) {
      return `<div class="s4u-preview-url">${esc(block.external_url || "URL configured")}</div>`;
    }

    if (type === "quiz") {
      const recordId = block.settings?.record_id || "";
      const label = block.title || "Quiz";
      return `<div class="s4u-preview-media"><span>?</span><strong>${esc(label)}</strong>${recordId ? `<small>Quiz Library · ${esc(recordId)}</small>` : ""}</div>`;
    }

    if (type === "knowledge_check") {
      return `<div class="s4u-preview-media"><span>✓</span><strong>Assessment attached to this lesson</strong></div>`;
    }

    return `<div class="s4u-preview-placeholder">${esc(typeLabel(type))}</div>`;
  }

  async function mediaDisplayUrl(block, media) {
    if (block.external_url) return block.external_url;

    if (!media?.storage_path) return media?.playback_url || "";

    try {
      const { data, error } = await state.client.storage
        .from(media.storage_bucket || STORAGE_BUCKET)
        .createSignedUrl(media.storage_path, 3600);

      if (error) return "";
      return data?.signedUrl || "";
    } catch (_) {
      return "";
    }
  }

  async function saveLesson() {
    if (state.saving) return;

    const title = $("lessonTitle")?.value.trim() || "";
    const sectionId = $("lessonSection")?.value || "";

    if (!title) {
      toast("Enter a lesson title.", "error");
      return;
    }

    if (!isUuid(sectionId)) {
      toast("Choose a valid section.", "error");
      return;
    }

    state.saving = true;

    const button = $("lessonSaveButton");
    if (button) button.disabled = true;

    try {
      const payload = {
        title,
        section_id: sectionId,
        description: $("s4uLessonDescription")?.value.trim() || null,
        status: $("s4uLessonStatus")?.value || "draft",
        estimated_minutes: integerOrNull($("s4uLessonMinutes")?.value),
        is_required: $("s4uLessonRequired")?.checked !== false,
        completion_required: $("s4uCompletionRequired")?.checked !== false,
        lock_until_previous_complete: $("s4uLockPrevious")?.checked === true,
        updated_at: new Date().toISOString()
      };

      const { data, error } = await state.client
        .from(TABLES.lessons)
        .update(payload)
        .eq("id", state.lessonId)
        .select("*")
        .single();

      if (error) throw error;

      state.lesson = data;
      renderLesson();
      toast("Lesson saved.", "success");
    } catch (error) {
      console.error("[Save Lesson]", error);
      toast(error?.message || "Unable to save lesson.", "error");
    } finally {
      state.saving = false;
      if (button) button.disabled = false;
    }
  }

  async function openNewBlock(type) {
    const normalized = normalizeInsertKind(type);

    if (!VALID_BLOCK_TYPES.has(normalized)) {
      toast(`"${type}" is not a supported content block.`, "error");
      return;
    }

    await openBlockEditor(normalized, null);
  }

  async function editBlock(blockId) {
    if (!isUuid(blockId)) return;

    const block = state.blocks.find((item) => item.id === blockId);
    if (!block) return;

    await openBlockEditor(block.block_type, block);
  }

  async function openBlockEditor(type, block) {
    if (type === "divider") {
      if (block) {
        await updateSimpleBlock(block.id, {
          title: "Divider",
          settings: block.settings || {}
        });
      } else {
        await createBlock({
          block_type: "divider",
          title: "Divider"
        });
      }
      return;
    }

    if (type === "quiz") {
      await openQuizEditor(block);
      return;
    }

    if (type === "knowledge_check") {
      await openAssessmentEditor(block);
      return;
    }

    const modalConfig = getBlockModalConfig(type, block);
    if (!modalConfig) return;

    const result = await openEditorForm(modalConfig);
    if (!result) return;

    try {
      setModalBusy(true);

      const payload = await buildPayloadFromForm(type, result, block);

      if (!payload) return;

      if (block) {
        await updateBlock(block.id, payload);
        toast(`${typeLabel(type)} updated.`, "success");
      } else {
        await createBlock({
          block_type: type,
          ...payload
        });
        toast(`${typeLabel(type)} added.`, "success");
      }

      closeEditorModal(true);
    } catch (error) {
      console.error("[Save Content Block]", error);
      showModalError(error?.message || "Unable to save content.");
    } finally {
      setModalBusy(false);
    }
  }

  function getBlockModalConfig(type, block) {
    const settings = block?.settings || {};
    const media = block?.media_id ? state.media.get(block.media_id) : null;

    if (type === "heading") {
      return {
        eyebrow: "TEXT CONTENT",
        title: block ? "Edit Heading" : "Add Heading",
        description: "Create a section heading for the lesson.",
        confirmLabel: block ? "Save Heading" : "Add Heading",
        fields: [
          field("content", "Heading Text", "text", block?.content || block?.title || "", true),
          selectField("level", "Heading Size", settings.level || "h2", [
            ["h2", "Large Heading"],
            ["h3", "Medium Heading"],
            ["h4", "Small Heading"]
          ]),
          selectField("alignment", "Alignment", settings.alignment || "left", [
            ["left", "Left"],
            ["center", "Center"],
            ["right", "Right"]
          ]),
          checkboxField("required", "Required content", block?.is_required === true)
        ]
      };
    }

    if (type === "text") {
      return {
        eyebrow: "TEXT CONTENT",
        title: block ? "Edit Text Block" : "Add Text Block",
        description: "Write lesson content. Basic formatting is supported.",
        confirmLabel: block ? "Save Text" : "Add Text",
        fields: [
          field("title", "Block Title", "text", block?.title || "Text"),
          field("content", "Lesson Text", "richtext", block?.content || "", true, {
            help: "Use the toolbar to format text, headings, fonts, lists, alignment, colors, and links."
          }),
          selectField("alignment", "Alignment", settings.alignment || "left", [
            ["left", "Left"],
            ["center", "Center"],
            ["right", "Right"]
          ]),
          checkboxField("required", "Required content", block?.is_required === true)
        ]
      };
    }

    if (type === "image") {
      return mediaModalConfig({
        type,
        block,
        media,
        eyebrow: "IMAGE",
        title: block ? "Edit Image" : "Add Image",
        accept: "image/jpeg,image/png,image/webp",
        sourceModes: [["upload", "Upload Image"], ["link", "Image Link"]],
        extraFields: [
          field("alt", "Alt Text", "text", settings.alt || ""),
          field("caption", "Caption", "text", settings.caption || ""),
          selectField("width", "Display Width", settings.width || "full", [
            ["small", "Small"],
            ["medium", "Medium"],
            ["large", "Large"],
            ["full", "Full Width"]
          ]),
          selectField("alignment", "Alignment", settings.alignment || "center", [
            ["left", "Left"],
            ["center", "Center"],
            ["right", "Right"]
          ])
        ]
      });
    }

    if (type === "video") {
      return {
        eyebrow: "VIDEO",
        title: block ? "Edit Video" : "Add Video",
        description: "Choose a video from the LMS Video Library, upload a new Cloudflare Stream video, use a Cloudflare Video ID, or insert an external video link.",
        confirmLabel: block ? "Save Video" : "Add Video",
        fields: [
          selectField(
            "source_mode",
            "Video Source",
            block?.media_id
              ? "library"
              : settings.provider === "external"
                ? "external"
                : "library",
            [
              ["library", "Video Library"],
              ["cloudflare_upload", "Upload New Video to Cloudflare"],
              ["cloudflare_id", "Use Cloudflare Video ID"],
              ["external", "External Video Link"]
            ],
            { modeController: true }
          ),
          {
            name: "library_media_id",
            label: "Video Library",
            type: "video_library",
            value: block?.media_id || "",
            modes: ["library"]
          },
          field("file", "Upload Video", "file", "", false, {
            accept: "video/mp4,video/webm,video/quicktime",
            modes: ["cloudflare_upload"]
          }),
          field("cloudflare_id", "Cloudflare Video ID", "text", media?.provider_video_id || settings.provider_video_id || "", false, {
            placeholder: "Cloudflare Stream video UID",
            modes: ["cloudflare_id"]
          }),
          field("url", "External Video URL", "url", block?.external_url || "", false, {
            placeholder: "https://",
            modes: ["external"]
          }),
          field("title", "Display Title", "text", block?.title || media?.title || "Video"),
          field("duration", "Duration (seconds)", "number", media?.duration_seconds ?? settings.duration_seconds ?? "", false, {
            min: 0
          }),
          checkboxField("required", "Required content", block?.is_required !== false)
        ]
      };
    }

    if (["download", "pdf", "audio"].includes(type)) {
      const label = typeLabel(type);
      const accept =
        type === "pdf"
          ? "application/pdf"
          : type === "audio"
            ? "audio/mpeg,audio/wav,audio/ogg"
            : ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/zip";

      return mediaModalConfig({
        type,
        block,
        media,
        eyebrow: type === "audio" ? "AUDIO" : "FILE",
        title: block ? `Edit ${label}` : `Add ${label}`,
        accept,
        sourceModes: [["upload", `Upload ${label}`], ["link", `External ${label} Link`]],
        extraFields: [
          field("description", "Description", "textarea", settings.description || "", false, { rows: 3 }),
          checkboxField("downloadable", "Allow learner download", settings.downloadable !== false),
          checkboxField("open_new_tab", "Open link in new tab", type === "download" ? settings.open_new_tab !== false : settings.open_new_tab === true)
        ]
      });
    }

    if (type === "link") {
      return {
        eyebrow: "LINK",
        title: block ? "Edit Link" : "Add Link",
        description: "Add a resource link to the lesson.",
        confirmLabel: block ? "Save Link" : "Add Link",
        fields: [
          field("title", "Link Text", "text", block?.title || "", true),
          field("url", "URL", "url", block?.external_url || "", true, { placeholder: "https://" }),
          field("description", "Description", "textarea", settings.description || "", false, { rows: 3 }),
          checkboxField("open_new_tab", "Open in new tab", settings.open_new_tab !== false),
          checkboxField("required", "Required content", block?.is_required === true)
        ]
      };
    }

    if (type === "embed") {
      return {
        eyebrow: "EMBED",
        title: block ? "Edit Embed" : "Add Embed",
        description: "Embed an external webpage, video player, presentation, or interactive resource.",
        confirmLabel: block ? "Save Embed" : "Add Embed",
        fields: [
          field("title", "Embed Title", "text", block?.title || "Embedded Content"),
          field("url", "Embed URL", "url", block?.external_url || "", true, { placeholder: "https://" }),
          field("height", "Frame Height (px)", "number", settings.height || 480, false, { min: 180 }),
          checkboxField("required", "Required content", block?.is_required === true)
        ]
      };
    }

    if (type === "form") {
      return {
        eyebrow: "FORM",
        title: block ? "Edit Form" : "Add Form",
        description: "Embed an external form or survey.",
        confirmLabel: block ? "Save Form" : "Add Form",
        fields: [
          field("title", "Form Title", "text", block?.title || "Form"),
          field("url", "Form URL", "url", block?.external_url || "", true, { placeholder: "https://" }),
          field("height", "Frame Height (px)", "number", settings.height || 620, false, { min: 240 }),
          checkboxField("required", "Required content", block?.is_required !== false)
        ]
      };
    }

    return null;
  }

  function mediaModalConfig({
    type,
    block,
    media,
    eyebrow,
    title,
    accept,
    sourceModes,
    extraFields = []
  }) {
    const settings = block?.settings || {};

    return {
      eyebrow,
      title,
      description: type === "download"
        ? "Upload a file or paste an external download link. External links are recommended for large PowerPoint files that exceed your Supabase Storage limit."
        : `Upload a ${typeLabel(type).toLowerCase()} or insert a link.`,
      confirmLabel: block ? `Save ${typeLabel(type)}` : `Add ${typeLabel(type)}`,
      fields: [
        selectField(
          "source_mode",
          "Source",
          block?.external_url && !block?.media_id ? "link" : "upload",
          sourceModes,
          { modeController: true }
        ),
        field("file", `Upload ${typeLabel(type)}`, "file", "", false, {
          accept,
          modes: ["upload"]
        }),
        field("url", `${typeLabel(type)} URL`, "url", block?.external_url || "", false, {
          placeholder: "https://",
          modes: ["link"]
        }),
        field("title", "Display Title", "text", block?.title || media?.title || typeLabel(type)),
        ...extraFields,
        checkboxField("required", "Required content", block?.is_required === true)
      ]
    };
  }

  function field(name, label, type, value = "", required = false, options = {}) {
    return {
      name,
      label,
      type,
      value,
      required,
      ...options
    };
  }

  function selectField(name, label, value, options, extra = {}) {
    return {
      name,
      label,
      type: "select",
      value,
      options,
      ...extra
    };
  }

  function checkboxField(name, label, checked) {
    return {
      name,
      label,
      type: "checkbox",
      checked: Boolean(checked)
    };
  }

  async function buildPayloadFromForm(type, values, block) {
    const settings = {
      ...(block?.settings || {})
    };

    if (type === "heading") {
      settings.level = values.level;
      settings.alignment = values.alignment;

      return {
        title: values.content.trim(),
        content: values.content.trim(),
        settings,
        is_required: values.required
      };
    }

    if (type === "text") {
      settings.alignment = values.alignment;

      return {
        title: values.title.trim() || "Text",
        content: sanitizeRichHtml(values.content),
        settings: {
          ...settings,
          content_format: "html"
        },
        is_required: values.required
      };
    }

    if (type === "image") {
      settings.alt = values.alt.trim();
      settings.caption = values.caption.trim();
      settings.width = values.width;
      settings.alignment = values.alignment;

      return await resolveUploadOrLinkPayload(type, values, block, settings);
    }

    if (type === "video") {
      return await resolveVideoPayload(values, block);
    }

    if (["download", "pdf", "audio"].includes(type)) {
      settings.description = values.description.trim();
      settings.downloadable = values.downloadable;
      settings.open_new_tab = values.open_new_tab;

      if (type === "download" && values.source_mode === "link") {
        settings.external_download = true;
        settings.downloadable = true;
        settings.open_new_tab = true;
      }

      return await resolveUploadOrLinkPayload(type, values, block, settings);
    }

    if (type === "link") {
      settings.description = values.description.trim();
      settings.open_new_tab = values.open_new_tab;

      return {
        title: values.title.trim(),
        external_url: values.url.trim(),
        media_id: null,
        settings,
        is_required: values.required
      };
    }

    if (type === "embed" || type === "form") {
      settings.height = integerOrNull(values.height) || (type === "form" ? 620 : 480);

      return {
        title: values.title.trim() || typeLabel(type),
        external_url: values.url.trim(),
        media_id: null,
        settings,
        is_required: values.required
      };
    }

    throw new Error("Unsupported content type.");
  }

  async function resolveUploadOrLinkPayload(type, values, block, settings) {
    if (values.source_mode === "link") {
      if (!values.url?.trim()) {
        throw new Error(`${typeLabel(type)} URL is required.`);
      }

      return {
        title: values.title.trim() || typeLabel(type),
        external_url: values.url.trim(),
        media_id: null,
        settings,
        is_required: values.required
      };
    }

    const file = values.file;

    if (!(file instanceof File) || !file.size) {
      if (block?.media_id) {
        return {
          title: values.title.trim() || block.title || typeLabel(type),
          external_url: null,
          media_id: block.media_id,
          settings,
          is_required: values.required
        };
      }

      throw new Error(`Choose a ${typeLabel(type).toLowerCase()} to upload.`);
    }

    const mediaType = mediaTypeForBlock(type);
    const media = await uploadToLmsStorage(file, mediaType, values.title.trim());

    return {
      title: values.title.trim() || file.name,
      external_url: null,
      media_id: media.id,
      settings,
      is_required: values.required
    };
  }

  function mediaTypeForBlock(type) {
    if (type === "image") return "image";
    if (type === "audio") return "audio";
    if (type === "pdf") return "pdf";
    return "document";
  }

  async function uploadToLmsStorage(file, mediaType, title) {
    const session = await currentSession();
    const userId = session?.user?.id || null;

    const safeName = sanitizeFilename(file.name);
    const path =
      `courses/${state.courseId}/lessons/${state.lessonId}/${uniqueToken()}-${safeName}`;

    showModalProgress(`Uploading ${file.name}...`, 15);

    const { error: uploadError } = await state.client.storage
      .from(STORAGE_BUCKET)
      .upload(path, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type || undefined
      });

    if (uploadError) throw uploadError;

    showModalProgress("Saving media record...", 85);

    const { data, error } = await state.client
      .from(TABLES.media)
      .insert({
        uploaded_by: userId,
        media_type: mediaType,
        original_filename: file.name,
        storage_bucket: STORAGE_BUCKET,
        storage_path: path,
        mime_type: file.type || null,
        file_size_bytes: file.size,
        title: title || file.name,
        metadata: {
          source: "lesson_editor",
          course_id: state.courseId,
          lesson_id: state.lessonId
        },
        provider: "supabase_storage",
        provider_status: "ready"
      })
      .select("*")
      .single();

    if (error) {
      await state.client.storage.from(STORAGE_BUCKET).remove([path]);
      throw error;
    }

    showModalProgress("Upload complete.", 100);

    return data;
  }

  async function resolveVideoPayload(values, block) {
    const settings = {
      ...(block?.settings || {})
    };

    const required = values.required;
    const title = values.title.trim() || "Video";
    const duration = integerOrNull(values.duration);

    if (values.source_mode === "library") {
      const mediaId =
        String(values.library_media_id || "").trim();

      if (!isUuid(mediaId)) {
        throw new Error("Choose a video from the Video Library.");
      }

      const { data: media, error } =
        await state.client
          .from(TABLES.media)
          .select("*")
          .eq("id", mediaId)
          .eq("media_type", "video")
          .single();

      if (error) throw error;

      if (!media) {
        throw new Error("The selected library video is unavailable.");
      }

      settings.provider =
        media.provider || "cloudflare_stream";
      settings.provider_video_id =
        media.provider_video_id || null;
      settings.duration_seconds =
        media.duration_seconds ?? duration;
      settings.library_media_id = media.id;

      return {
        title:
          values.title.trim() ||
          media.title ||
          media.original_filename ||
          "Video",
        external_url: media.playback_url || null,
        media_id: media.id,
        settings,
        is_required: required
      };
    }

    if (values.source_mode === "external") {
      if (!values.url?.trim()) {
        throw new Error("External video URL is required.");
      }

      settings.provider = "external";
      settings.provider_video_id = null;
      settings.duration_seconds = duration;

      return {
        title,
        external_url: values.url.trim(),
        media_id: null,
        settings,
        is_required: required
      };
    }

    if (values.source_mode === "cloudflare_id") {
      const uid = String(values.cloudflare_id || "").trim();

      if (!uid) {
        throw new Error("Cloudflare Video ID is required.");
      }

      const media = await resolveCloudflareVideoById(uid, title, duration);

      settings.provider = "cloudflare_stream";
      settings.provider_video_id = uid;
      settings.duration_seconds = media.duration_seconds ?? duration;

      return {
        title,
        external_url: media.playback_url || null,
        media_id: media.id,
        settings,
        is_required: required
      };
    }

    const file = values.file;

    if (!(file instanceof File) || !file.size) {
      const existingMedia =
        block?.media_id ? state.media.get(block.media_id) : null;

      if (existingMedia?.provider === "cloudflare_stream") {
        return {
          title,
          external_url: existingMedia.playback_url || block.external_url || null,
          media_id: existingMedia.id,
          settings: {
            ...settings,
            provider: "cloudflare_stream",
            provider_video_id: existingMedia.provider_video_id,
            duration_seconds: existingMedia.duration_seconds ?? duration
          },
          is_required: required
        };
      }

      throw new Error("Choose a video to upload to Cloudflare.");
    }

    const media = await uploadVideoToCloudflare(file, title, duration);

    settings.provider = "cloudflare_stream";
    settings.provider_video_id = media.provider_video_id;
    settings.duration_seconds = media.duration_seconds ?? duration;

    return {
      title,
      external_url: media.playback_url || null,
      media_id: media.id,
      settings,
      is_required: required
    };
  }

  async function uploadVideoToCloudflare(file, title, duration) {
    const session = await currentSession();

    showModalProgress("Preparing Cloudflare upload...", 5);

    const { data: initData, error: initError } = await state.client.functions.invoke(
      "cloudflare-stream-upload",
      {
        headers: {
          Authorization: `Bearer ${session.access_token}`
        },
        body: {
          mode: "init",
          fileSize: file.size,
          fileName: file.name
        }
      }
    );

    if (initError) throw initError;
    if (!initData?.success || !initData?.uploadURL || !initData?.uid) {
      throw new Error(initData?.error || "Unable to initialize Cloudflare upload.");
    }

    showModalProgress("Uploading video to Cloudflare...", 15);

    await uploadTusFile(initData.uploadURL, file, function (progress) {
      showModalProgress(
        `Uploading video to Cloudflare... ${Math.round(progress)}%`,
        15 + progress * 0.7
      );
    });

    showModalProgress("Reading Cloudflare video details...", 90);

    let details = null;

    try {
      details = await fetchCloudflareVideoDetails(initData.uid);
    } catch (error) {
      console.warn("[Cloudflare details]", error);
    }

    return await upsertCloudflareMedia({
      uid: initData.uid,
      title: title || file.name,
      originalFilename: file.name,
      fileSize: file.size,
      mimeType: file.type || "video/mp4",
      duration: details?.duration ?? duration,
      playbackUrl: cloudflarePlaybackUrl(details),
      thumbnailUrl: details?.thumbnail || null,
      providerStatus:
        details?.readyToStream === true
          ? "ready"
          : details?.status?.state || "processing"
    });
  }

  async function uploadTusFile(uploadURL, file, onProgress) {
    const chunkSize = 8 * 1024 * 1024;
    let offset = 0;

    while (offset < file.size) {
      const chunk = file.slice(offset, Math.min(file.size, offset + chunkSize));

      const response = await fetch(uploadURL, {
        method: "PATCH",
        headers: {
          "Tus-Resumable": "1.0.0",
          "Upload-Offset": String(offset),
          "Content-Type": "application/offset+octet-stream"
        },
        body: chunk
      });

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        throw new Error(
          `Cloudflare upload failed (${response.status}). ${body}`.trim()
        );
      }

      const nextOffset = Number(response.headers.get("Upload-Offset"));

      offset =
        Number.isFinite(nextOffset) && nextOffset > offset
          ? nextOffset
          : offset + chunk.size;

      if (onProgress) {
        onProgress(Math.min(100, (offset / file.size) * 100));
      }
    }
  }

  async function resolveCloudflareVideoById(uid, title, duration) {
    showModalProgress("Checking Cloudflare video...", 25);

    const details = await fetchCloudflareVideoDetails(uid);

    showModalProgress("Saving Cloudflare video...", 80);

    return await upsertCloudflareMedia({
      uid,
      title: title || details?.meta?.name || "Cloudflare Video",
      originalFilename: details?.meta?.name || `${uid}.cloudflare-stream`,
      fileSize: details?.size || null,
      mimeType: "video/cloudflare-stream",
      duration: details?.duration ?? duration,
      playbackUrl: cloudflarePlaybackUrl(details),
      thumbnailUrl: details?.thumbnail || null,
      providerStatus:
        details?.readyToStream === true
          ? "ready"
          : details?.status?.state || "processing"
    });
  }

  async function fetchCloudflareVideoDetails(uid) {
    const session = await currentSession();

    const { data, error } = await state.client.functions.invoke(
      "cloudflare-stream-video",
      {
        headers: {
          Authorization: `Bearer ${session.access_token}`
        },
        body: {
          videoId: uid
        }
      }
    );

    if (error) throw error;
    if (!data?.success || !data?.video) {
      throw new Error(data?.error || "Cloudflare video was not found.");
    }

    return data.video;
  }

  function cloudflarePlaybackUrl(details) {
    return (
      details?.playback?.hls ||
      details?.playback?.dash ||
      details?.preview ||
      null
    );
  }

  async function upsertCloudflareMedia({
    uid,
    title,
    originalFilename,
    fileSize,
    mimeType,
    duration,
    playbackUrl,
    thumbnailUrl,
    providerStatus
  }) {
    const session = await currentSession();

    const { data: existing, error: existingError } = await state.client
      .from(TABLES.media)
      .select("*")
      .eq("provider", "cloudflare_stream")
      .eq("provider_video_id", uid)
      .limit(1)
      .maybeSingle();

    if (existingError) throw existingError;

    const payload = {
      uploaded_by: session.user.id,
      media_type: "video",
      original_filename: originalFilename || `${uid}.cloudflare-stream`,
      storage_bucket: STORAGE_BUCKET,
      storage_path: `cloudflare-stream/${uid}`,
      mime_type: mimeType || "video/cloudflare-stream",
      file_size_bytes: fileSize || null,
      duration_seconds:
        Number.isFinite(Number(duration))
          ? Math.round(Number(duration))
          : null,
      title: title || "Cloudflare Video",
      metadata: {
        ...(existing?.metadata || {}),
        source: "lesson_editor",
        course_id: state.courseId,
        lesson_id: state.lessonId
      },
      provider: "cloudflare_stream",
      provider_video_id: uid,
      provider_status: providerStatus || "processing",
      playback_url: playbackUrl || existing?.playback_url || null,
      thumbnail_url: thumbnailUrl || existing?.thumbnail_url || null,
      updated_at: new Date().toISOString()
    };

    if (existing?.id) {
      const { data, error } = await state.client
        .from(TABLES.media)
        .update(payload)
        .eq("id", existing.id)
        .select("*")
        .single();

      if (error) throw error;
      return data;
    }

    const { data, error } = await state.client
      .from(TABLES.media)
      .insert(payload)
      .select("*")
      .single();

    if (error) throw error;
    return data;
  }

  async function openQuizEditor(block) {
    const attachedQuizId =
      String(block?.settings?.record_id || "").trim();

    const currentQuiz =
      attachedQuizId && isUuid(attachedQuizId)
        ? await loadQuizById(attachedQuizId)
        : await loadQuiz();

    const result = await openEditorForm({
      eyebrow: "QUIZ LIBRARY",
      title: block ? "Change Quiz" : "Add Quiz",
      description:
        "Choose a quiz that has already been created. A reusable copy is attached to this lesson so the original quiz remains in its current course.",
      confirmLabel: block ? "Use Selected Quiz" : "Add Selected Quiz",
      fields: [
        {
          name: "library_quiz_id",
          label: "Quiz Library",
          type: "quiz_library",
          value: currentQuiz?.id || ""
        },
        checkboxField(
          "required",
          "Required quiz",
          block?.is_required ?? currentQuiz?.is_required ?? true
        )
      ]
    });

    if (!result) return;

    const sourceQuizId =
      String(result.library_quiz_id || "").trim();

    if (!isUuid(sourceQuizId)) {
      showModalError("Choose a quiz from the Quiz Library.");
      return;
    }

    try {
      setModalBusy(true);

      const sourceQuiz =
        await loadQuizById(sourceQuizId);

      if (!sourceQuiz) {
        throw new Error("The selected quiz is no longer available.");
      }

      /*
       * lms_quizzes is lesson-owned in this LMS. Reusing a quiz therefore
       * means copying it into the current lesson rather than changing the
       * source quiz's lesson_id and removing it from its original course.
       */
      const attachedQuiz =
        await copyQuizIntoCurrentLesson(
          sourceQuiz,
          Boolean(result.required)
        );

      await ensureSpecialBlock(
        "quiz",
        attachedQuiz.id,
        attachedQuiz.title,
        Boolean(result.required)
      );

      await reloadBlocks();

      closeEditorModal(true);

      toast(
        sourceQuiz.lesson_id === state.lessonId
          ? "Quiz attached to this lesson."
          : "Quiz copied and added to this lesson.",
        "success"
      );
    } catch (error) {
      console.error("[Quiz Library]", error);
      showModalError(
        error?.message ||
        "Unable to add the selected quiz."
      );
    } finally {
      setModalBusy(false);
    }
  }


  async function loadQuizById(quizId) {
    if (!isUuid(quizId)) return null;

    const { data, error } = await state.client
      .from(TABLES.quizzes)
      .select("*")
      .eq("id", quizId)
      .maybeSingle();

    if (error) throw error;
    return data || null;
  }


  async function loadQuizLibraryRows() {
    const { data, error } = await state.client
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
      .order("created_at", { ascending: false });

    if (error) throw error;

    return (data || []).map((quiz) => {
      const lesson = quiz.lms_lessons || null;
      const section = lesson?.lms_sections || null;
      const course = section?.lms_courses || null;

      return {
        ...quiz,
        question_count: (quiz.lms_questions || []).length,
        lesson_title: lesson?.title || "Lesson",
        section_title: section?.title || "Section",
        course_title: course?.title || "Course",
        course_id: course?.id || section?.course_id || ""
      };
    });
  }


  async function copyQuizIntoCurrentLesson(sourceQuiz, required) {
    /*
     * lms_quizzes.lesson_id has a UNIQUE constraint.
     *
     * A lesson can own only one quiz row. Reusing a library quiz therefore
     * copies the selected quiz into that one lesson-owned record instead of
     * trying to create a second quiz for the same lesson.
     */

    if (sourceQuiz.lesson_id === state.lessonId) {
      const { data, error } = await state.client
        .from(TABLES.quizzes)
        .update({
          is_required: Boolean(required),
          updated_at: new Date().toISOString()
        })
        .eq("id", sourceQuiz.id)
        .select("*")
        .single();

      if (error) throw error;
      return data;
    }

    const quizPayload = {
      lesson_id: state.lessonId,
      title: sourceQuiz.title || "Quiz",
      description: sourceQuiz.description || null,
      passing_score: sourceQuiz.passing_score ?? 80,
      attempt_limit:
        sourceQuiz.attempt_limit == null
          ? null
          : sourceQuiz.attempt_limit,
      randomize_questions:
        sourceQuiz.randomize_questions === true,
      randomize_answers:
        sourceQuiz.randomize_answers === true,
      show_correct_answers:
        sourceQuiz.show_correct_answers !== false,
      show_explanations:
        sourceQuiz.show_explanations !== false,
      is_required: Boolean(required),
      updated_at: new Date().toISOString()
    };

    /*
     * Upsert on lesson_id is intentional. The database itself is the final
     * authority for the one-quiz-per-lesson rule, so this remains safe even
     * when an existing quiz is not present in stale in-memory editor state.
     */
    const { data: savedQuiz, error: saveError } = await state.client
      .from(TABLES.quizzes)
      .upsert(quizPayload, {
        onConflict: "lesson_id"
      })
      .select("*")
      .single();

    if (saveError) throw saveError;

    /*
     * Whether the row was newly created or already existed, make its
     * questions exactly match the selected source quiz.
     */
    await clearQuizQuestions(savedQuiz.id);

    await copyQuizQuestions(
      sourceQuiz.id,
      savedQuiz.id
    );

    return savedQuiz;
  }

  async function clearQuizQuestions(quizId) {
    const { data: questions, error } = await state.client
      .from("lms_questions")
      .select("id")
      .eq("quiz_id", quizId);

    if (error) throw error;

    const ids =
      (questions || [])
        .map((question) => question.id)
        .filter(Boolean);

    if (!ids.length) return;

    const { error: optionError } = await state.client
      .from("lms_question_options")
      .delete()
      .in("question_id", ids);

    if (optionError) throw optionError;

    const { error: questionError } = await state.client
      .from("lms_questions")
      .delete()
      .in("id", ids);

    if (questionError) throw questionError;
  }


  async function copyQuizQuestions(sourceQuizId, destinationQuizId) {
    const { data: questions, error } = await state.client
      .from("lms_questions")
      .select(`
        *,
        lms_question_options (
          *
        )
      `)
      .eq("quiz_id", sourceQuizId)
      .order("sort_order", { ascending: true });

    if (error) throw error;

    for (let index = 0; index < (questions || []).length; index += 1) {
      const sourceQuestion = questions[index];

      const { data: createdQuestion, error: questionError } =
        await state.client
          .from("lms_questions")
          .insert({
            quiz_id: destinationQuizId,
            question_type:
              sourceQuestion.question_type || "single_choice",
            question_text:
              sourceQuestion.question_text || "",
            explanation:
              sourceQuestion.explanation || null,
            points:
              Number(sourceQuestion.points) || 1,
            sort_order:
              index + 1
          })
          .select("*")
          .single();

      if (questionError) throw questionError;

      const options =
        (sourceQuestion.lms_question_options || [])
          .sort(
            (a, b) =>
              Number(a.sort_order || 0) -
              Number(b.sort_order || 0)
          )
          .map((option, optionIndex) => ({
            question_id: createdQuestion.id,
            option_text:
              option.option_text || "",
            is_correct:
              option.is_correct === true,
            sort_order:
              optionIndex + 1
          }));

      if (options.length) {
        const { error: optionError } = await state.client
          .from("lms_question_options")
          .insert(options);

        if (optionError) throw optionError;
      }
    }
  }

  async function loadQuiz() {
    const { data, error } = await state.client
      .from(TABLES.quizzes)
      .select("*")
      .eq("lesson_id", state.lessonId)
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return data || null;
  }

  async function openAssessmentEditor(block) {
    const assessment = await loadAssessment();

    const result = await openEditorForm({
      eyebrow: "ASSESSMENT",
      title: assessment ? "Assessment Settings" : "Create Assessment",
      description: "Configure the assessment attached to this lesson. Build questions in the Assessment Builder.",
      confirmLabel: assessment ? "Save & Open Builder" : "Create & Open Builder",
      fields: [
        field("title", "Assessment Title", "text", assessment?.title || block?.title || `${state.lesson?.title || "Lesson"} Assessment`, true),
        field("description", "Instructions", "textarea", assessment?.description || "", false, { rows: 4 }),
        selectField("assessment_type", "Assessment Type", assessment?.assessment_type || "quiz", [
          ["quiz", "Quiz"],
          ["knowledge_check", "Knowledge Check"],
          ["final", "Final Assessment"]
        ]),
        field("passing_score", "Passing Score (%)", "number", assessment?.passing_score ?? 80, true, { min: 0, max: 100 }),
        field("max_attempts", "Maximum Attempts", "number", assessment?.max_attempts ?? 0, false, { min: 0 }),
        field("time_limit_minutes", "Time Limit (minutes)", "number", assessment?.time_limit_minutes ?? 0, false, { min: 0 }),
        selectField("status", "Status", assessment?.status || "draft", [
          ["draft", "Draft"],
          ["published", "Published"],
          ["archived", "Archived"]
        ]),
        checkboxField("randomize_questions", "Shuffle questions", assessment?.randomize_questions === true),
        checkboxField("randomize_options", "Shuffle answer options", assessment?.randomize_options === true),
        checkboxField("show_correct_answers", "Show correct answers", assessment?.show_correct_answers !== false),
        checkboxField("require_pass", "Passing required", assessment?.require_pass !== false)
      ]
    });

    if (!result) return;

    try {
      setModalBusy(true);

      const payload = {
        lesson_id: state.lessonId,
        title: result.title.trim(),
        description: result.description.trim() || null,
        assessment_type: result.assessment_type,
        passing_score: clampNumber(result.passing_score, 0, 100, 80),
        max_attempts: integerOrZero(result.max_attempts),
        time_limit_minutes: integerOrZero(result.time_limit_minutes),
        status: result.status,
        randomize_questions: result.randomize_questions,
        randomize_options: result.randomize_options,
        show_correct_answers: result.show_correct_answers,
        require_pass: result.require_pass,
        updated_at: new Date().toISOString()
      };

      let saved;

      if (assessment?.id) {
        const { data, error } = await state.client
          .from(TABLES.assessments)
          .update(payload)
          .eq("id", assessment.id)
          .select("*")
          .single();

        if (error) throw error;
        saved = data;
      } else {
        const { data, error } = await state.client
          .from(TABLES.assessments)
          .insert(payload)
          .select("*")
          .single();

        if (error) throw error;
        saved = data;
      }

      await ensureSpecialBlock(
        "knowledge_check",
        saved.id,
        saved.title,
        saved.require_pass
      );

      closeEditorModal(true);

      location.href =
        `admin-lms-assessment-builder.html?course=${encodeURIComponent(state.courseId)}&lesson=${encodeURIComponent(state.lessonId)}&assessment=${encodeURIComponent(saved.id)}`;
    } catch (error) {
      console.error("[Assessment Editor]", error);
      showModalError(error?.message || "Unable to save assessment.");
    } finally {
      setModalBusy(false);
    }
  }

  async function loadAssessment() {
    const { data, error } = await state.client
      .from(TABLES.assessments)
      .select("*")
      .eq("lesson_id", state.lessonId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return data || null;
  }

  async function ensureSpecialBlock(type, recordId, title, required) {
    const existing = state.blocks.find((block) => block.block_type === type);

    const payload = {
      lesson_id: state.lessonId,
      block_type: type,
      title,
      content: null,
      external_url: null,
      settings: {
        ...(existing?.settings || {}),
        record_id: recordId
      },
      is_required: Boolean(required),
      updated_at: new Date().toISOString()
    };

    if (existing?.id) {
      const { error } = await state.client
        .from(TABLES.blocks)
        .update(payload)
        .eq("id", existing.id);

      if (error) throw error;
    } else {
      const { error } = await state.client
        .from(TABLES.blocks)
        .insert({
          ...payload,
          sort_order: nextSortOrder()
        });

      if (error) throw error;
    }
  }

  async function createBlock(payload) {
    const { error } = await state.client
      .from(TABLES.blocks)
      .insert({
        lesson_id: state.lessonId,
        sort_order: nextSortOrder(),
        content: null,
        media_id: null,
        external_url: null,
        settings: {},
        is_required: false,
        updated_at: new Date().toISOString(),
        ...payload
      });

    if (error) throw error;

    await reloadBlocks();
  }

  async function updateBlock(blockId, payload) {
    const { error } = await state.client
      .from(TABLES.blocks)
      .update({
        ...payload,
        updated_at: new Date().toISOString()
      })
      .eq("id", blockId);

    if (error) throw error;

    await reloadBlocks();
  }

  async function updateSimpleBlock(blockId, payload) {
    await updateBlock(blockId, payload);
    toast("Content updated.", "success");
  }

  async function reloadBlocks() {
    await load();
    renderAll();
  }

  function openBlockActionMenu(anchor, blockId) {
    closeActionMenu();

    const block = state.blocks.find((item) => item.id === blockId);
    if (!block) return;

    const menu = document.createElement("div");
    menu.className = "s4u-editor-action-menu";
    menu.setAttribute("role", "menu");

    const items = [
      ["Edit", () => editBlock(blockId)],
      ["Duplicate", () => duplicateBlock(blockId)],
      ["Move Up", () => moveBlock(blockId, -1)],
      ["Move Down", () => moveBlock(blockId, 1)],
      [
        block.is_required ? "Make Optional" : "Make Required",
        () => toggleBlockRequired(blockId)
      ],
      ["Delete", () => deleteBlock(blockId), true]
    ];

    items.forEach(([label, action, danger]) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = label;
      button.className = danger ? "danger" : "";
      button.addEventListener("click", async function (event) {
        event.stopPropagation();
        closeActionMenu();
        await action();
      });
      menu.appendChild(button);
    });

    document.body.appendChild(menu);
    state.activeMenu = menu;

    const rect = anchor.getBoundingClientRect();
    const width = 190;

    menu.style.left =
      `${Math.max(12, Math.min(window.innerWidth - width - 12, rect.right - width))}px`;

    const estimatedHeight = items.length * 40 + 12;
    const below = rect.bottom + 6;

    menu.style.top =
      `${below + estimatedHeight < window.innerHeight
        ? below
        : Math.max(12, rect.top - estimatedHeight - 6)}px`;
  }

  function closeActionMenu() {
    state.activeMenu?.remove();
    state.activeMenu = null;
  }

  async function duplicateBlock(blockId) {
    const block = state.blocks.find((item) => item.id === blockId);
    if (!block) return;

    try {
      const copy = {
        lesson_id: state.lessonId,
        block_type: block.block_type,
        title: `${block.title || typeLabel(block.block_type)} Copy`,
        sort_order: nextSortOrder(),
        content: block.content,
        media_id: block.media_id,
        external_url: block.external_url,
        settings: {
          ...(block.settings || {})
        },
        is_required: block.is_required,
        updated_at: new Date().toISOString()
      };

      const { error } = await state.client
        .from(TABLES.blocks)
        .insert(copy);

      if (error) throw error;

      await reloadBlocks();
      toast("Content block duplicated.", "success");
    } catch (error) {
      console.error("[Duplicate Block]", error);
      toast(error?.message || "Unable to duplicate block.", "error");
    }
  }

  async function toggleBlockRequired(blockId) {
    const block = state.blocks.find((item) => item.id === blockId);
    if (!block) return;

    try {
      const { error } = await state.client
        .from(TABLES.blocks)
        .update({
          is_required: !block.is_required,
          updated_at: new Date().toISOString()
        })
        .eq("id", blockId);

      if (error) throw error;

      await reloadBlocks();
      toast(block.is_required ? "Content is now optional." : "Content is now required.", "success");
    } catch (error) {
      console.error("[Required Toggle]", error);
      toast(error?.message || "Unable to update content.", "error");
    }
  }

  async function deleteBlock(blockId) {
    const block = state.blocks.find((item) => item.id === blockId);
    if (!block) return;

    const confirmed = await brandedConfirm({
      eyebrow: "REMOVE CONTENT",
      title: "Delete content block?",
      message:
        `Delete "${block.title || typeLabel(block.block_type)}" from this lesson?`,
      confirmLabel: "Delete Block"
    });

    if (!confirmed) return;

    try {
      const { error } = await state.client
        .from(TABLES.blocks)
        .delete()
        .eq("id", blockId);

      if (error) throw error;

      await normalizeBlockOrder();
      await reloadBlocks();
      toast("Content block deleted.", "success");
    } catch (error) {
      console.error("[Delete Block]", error);
      toast(error?.message || "Unable to delete block.", "error");
    }
  }

  async function moveBlock(blockId, direction) {
    const index = state.blocks.findIndex((block) => block.id === blockId);
    if (index < 0) return;

    const targetIndex = index + direction;

    if (targetIndex < 0 || targetIndex >= state.blocks.length) {
      toast(
        direction < 0
          ? "This block is already first."
          : "This block is already last.",
        "error"
      );
      return;
    }

    const reordered = [...state.blocks];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(targetIndex, 0, moved);

    try {
      await saveBlockOrder(reordered);
      await reloadBlocks();
      toast("Content order saved.", "success");
    } catch (error) {
      console.error("[Move Block]", error);
      toast(error?.message || "Unable to move content.", "error");
    }
  }

  async function saveBlockOrder(rows) {
    for (let index = 0; index < rows.length; index += 1) {
      const { error } = await state.client
        .from(TABLES.blocks)
        .update({ sort_order: 10000 + index })
        .eq("id", rows[index].id);

      if (error) throw error;
    }

    for (let index = 0; index < rows.length; index += 1) {
      const { error } = await state.client
        .from(TABLES.blocks)
        .update({
          sort_order: index + 1,
          updated_at: new Date().toISOString()
        })
        .eq("id", rows[index].id);

      if (error) throw error;
    }
  }

  async function normalizeBlockOrder() {
    const { data, error } = await state.client
      .from(TABLES.blocks)
      .select("*")
      .eq("lesson_id", state.lessonId)
      .order("sort_order", { ascending: true });

    if (error) throw error;

    await saveBlockOrder(data || []);
  }

  function nextSortOrder() {
    return (
      state.blocks.reduce(
        (max, block) => Math.max(max, Number(block.sort_order) || 0),
        0
      ) + 1
    );
  }

  /* ============================================================
     BRANDED MODAL
     ============================================================ */

  function ensureEditorModal() {
    if ($("s4uEditorModal")) return $("s4uEditorModal");

    const modal = document.createElement("div");
    modal.id = "s4uEditorModal";
    modal.hidden = true;
    modal.innerHTML = `
      <div class="s4u-editor-modal-backdrop" data-modal-cancel></div>

      <section
        class="s4u-editor-modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="s4uEditorModalTitle"
      >
        <header class="s4u-editor-modal-head">
          <div>
            <span id="s4uEditorModalEyebrow">LESSON CONTENT</span>
            <h2 id="s4uEditorModalTitle">Edit Content</h2>
            <p id="s4uEditorModalDescription"></p>
          </div>

          <button
            type="button"
            class="s4u-editor-modal-close"
            data-modal-cancel
            aria-label="Close"
          >×</button>
        </header>

        <div class="s4u-editor-modal-error" id="s4uEditorModalError"></div>

        <div class="s4u-editor-modal-progress" id="s4uEditorModalProgress" hidden>
          <div>
            <span id="s4uEditorModalProgressText">Working...</span>
            <strong id="s4uEditorModalProgressValue">0%</strong>
          </div>
          <i><b id="s4uEditorModalProgressBar"></b></i>
        </div>

        <div class="s4u-editor-modal-body" id="s4uEditorModalBody"></div>

        <footer class="s4u-editor-modal-footer">
          <button type="button" class="s4u-editor-modal-secondary" data-modal-cancel>
            Cancel
          </button>
          <button type="button" class="s4u-editor-modal-primary" id="s4uEditorModalConfirm">
            Save
          </button>
        </footer>
      </section>
    `;

    document.body.appendChild(modal);

    modal.querySelectorAll("[data-modal-cancel]").forEach((button) => {
      button.addEventListener("click", function () {
        closeEditorModal(null);
      });
    });

    return modal;
  }

  function openEditorForm(config) {
    const modal = ensureEditorModal();

    setText("s4uEditorModalEyebrow", config.eyebrow || "LESSON CONTENT");
    setText("s4uEditorModalTitle", config.title || "Edit Content");
    setText("s4uEditorModalDescription", config.description || "");
    setText("s4uEditorModalConfirm", config.confirmLabel || "Save");

    $("s4uEditorModalConfirm").classList.remove("danger");

    const body = $("s4uEditorModalBody");
    body.innerHTML = renderFields(config.fields || []);

    hideModalError();
    hideModalProgress();

    modal.hidden = false;
    modal.dataset.previousOverflow = document.body.style.overflow || "";
    document.body.style.overflow = "hidden";

    bindModalFieldModes();
    bindRichTextEditors();
    bindQuizLibraryPicker();
    bindVideoLibraryPicker();

    return new Promise((resolve) => {
      modal._resolver = resolve;

      $("s4uEditorModalConfirm").onclick = function () {
        const values = readModalFields(config.fields || []);
        if (!values) return;
        resolve(values);
        modal._resolver = null;
      };

      setTimeout(() => {
        body.querySelector(
          "[data-rich-editor], input:not([type=checkbox]), textarea, select"
        )?.focus();
      }, 0);
    });
  }

  function renderFields(fields) {
    return fields.map((item) => {
      const modes = item.modes?.length
        ? ` data-modes="${esc(item.modes.join(","))}"`
        : "";

      if (item.type === "checkbox") {
        return `
          <label class="s4u-modal-check"${modes}>
            <span>
              <strong>${esc(item.label)}</strong>
              ${item.help ? `<small>${esc(item.help)}</small>` : ""}
            </span>
            <input
              type="checkbox"
              data-modal-field="${esc(item.name)}"
              ${item.checked ? "checked" : ""}
            >
            <i></i>
          </label>
        `;
      }

      if (item.type === "select") {
        return `
          <label class="s4u-modal-field"${modes}>
            <span>${esc(item.label)}${item.required ? " *" : ""}</span>
            <select
              data-modal-field="${esc(item.name)}"
              ${item.modeController ? "data-mode-controller" : ""}
            >
              ${(item.options || []).map(([value, label]) => `
                <option
                  value="${esc(value)}"
                  ${String(item.value) === String(value) ? "selected" : ""}
                >${esc(label)}</option>
              `).join("")}
            </select>
            ${item.help ? `<small>${esc(item.help)}</small>` : ""}
          </label>
        `;
      }

      if (item.type === "quiz_library") {
        return `
          <div class="s4u-quiz-library-field wide"${modes}>
            <input
              type="hidden"
              data-modal-field="${esc(item.name)}"
              value="${esc(item.value || "")}"
            >

            <div class="s4u-quiz-library-toolbar">
              <div>
                <strong>Quiz Library</strong>
                <small>Select a quiz that has already been created.</small>
              </div>

              <input
                type="search"
                data-quiz-library-search
                placeholder="Search quizzes..."
                aria-label="Search quiz library"
              >
            </div>

            <div class="s4u-quiz-library-status" data-quiz-library-status>
              Loading quizzes...
            </div>

            <div class="s4u-quiz-library-grid" data-quiz-library-grid></div>
          </div>
        `;
      }

      if (item.type === "video_library") {
        return `
          <div class="s4u-video-library-field wide"${modes}>
            <input
              type="hidden"
              data-modal-field="${esc(item.name)}"
              value="${esc(item.value || "")}"
            >

            <div class="s4u-video-library-toolbar">
              <div>
                <strong>Video Library</strong>
                <small>Reuse a video already uploaded to the course platform.</small>
              </div>

              <div class="s4u-video-library-toolbar-actions">
                <input
                  type="search"
                  data-video-library-search
                  placeholder="Search videos..."
                  aria-label="Search video library"
                >
                <button
                  type="button"
                  class="s4u-video-library-open"
                  data-open-video-library-browser
                >Open Full Library</button>
              </div>
            </div>

            <div class="s4u-video-library-status" data-video-library-status>
              Loading videos...
            </div>

            <div class="s4u-video-library-grid" data-video-library-grid></div>
          </div>
        `;
      }

      if (item.type === "richtext") {
        return `
          <div class="s4u-modal-field wide s4u-rich-field"${modes}>
            <span>${esc(item.label)}${item.required ? " *" : ""}</span>

            <div class="s4u-rich-editor-shell">
              <div class="s4u-rich-toolbar" role="toolbar" aria-label="Text formatting">
                <select data-rich-command="formatBlock" aria-label="Paragraph style">
                  <option value="p">Paragraph</option>
                  <option value="h2">Heading 2</option>
                  <option value="h3">Heading 3</option>
                  <option value="h4">Heading 4</option>
                  <option value="blockquote">Quote</option>
                </select>

                <select data-rich-command="fontName" aria-label="Font family">
                  <option value="Arial">Arial</option>
                  <option value="Helvetica">Helvetica</option>
                  <option value="Verdana">Verdana</option>
                  <option value="Tahoma">Tahoma</option>
                  <option value="Trebuchet MS">Trebuchet MS</option>
                  <option value="Georgia">Georgia</option>
                  <option value="Times New Roman">Times New Roman</option>
                </select>

                <select data-rich-command="fontSize" aria-label="Font size">
                  <option value="2">Small</option>
                  <option value="3" selected>Normal</option>
                  <option value="4">Medium</option>
                  <option value="5">Large</option>
                  <option value="6">Extra Large</option>
                </select>

                <span class="s4u-rich-divider"></span>

                <button type="button" data-rich-command="bold" title="Bold"><strong>B</strong></button>
                <button type="button" data-rich-command="italic" title="Italic"><em>I</em></button>
                <button type="button" data-rich-command="underline" title="Underline"><u>U</u></button>
                <button type="button" data-rich-command="strikeThrough" title="Strikethrough"><s>S</s></button>

                <label class="s4u-rich-color" title="Text color">
                  <span>A</span>
                  <input type="color" data-rich-color value="#172033" aria-label="Text color">
                </label>

                <span class="s4u-rich-divider"></span>

                <button type="button" data-rich-command="insertUnorderedList" title="Bulleted list">• List</button>
                <button type="button" data-rich-command="insertOrderedList" title="Numbered list">1. List</button>
                <button type="button" data-rich-command="outdent" title="Decrease indent">⇤</button>
                <button type="button" data-rich-command="indent" title="Increase indent">⇥</button>

                <span class="s4u-rich-divider"></span>

                <button type="button" data-rich-command="justifyLeft" title="Align left">≡</button>
                <button type="button" data-rich-command="justifyCenter" title="Align center">≡</button>
                <button type="button" data-rich-command="justifyRight" title="Align right">≡</button>

                <span class="s4u-rich-divider"></span>

                <button type="button" data-rich-link title="Make selected text a link">🔗 Link</button>
                <button type="button" data-rich-command="unlink" title="Remove link">Unlink</button>
                <button type="button" data-rich-button title="Insert linked button">CTA Button</button>
                <button type="button" data-rich-command="removeFormat" title="Clear formatting">Clear</button>
                <button type="button" data-rich-command="undo" title="Undo">↶</button>
                <button type="button" data-rich-command="redo" title="Redo">↷</button>
              </div>

              <div class="s4u-rich-link-panel" data-rich-link-panel hidden>
                <div class="s4u-rich-link-selected">
                  <small>Selected text</small>
                  <strong data-rich-link-selected-text>Select text in the editor first</strong>
                </div>

                <input
                  type="url"
                  data-rich-link-url
                  placeholder="https://example.com"
                  aria-label="Link URL"
                >

                <label class="s4u-rich-panel-check">
                  <input type="checkbox" data-rich-link-new-tab checked>
                  <span>New tab</span>
                </label>

                <button type="button" data-rich-link-apply>Apply Link</button>
                <button type="button" data-rich-link-cancel>Cancel</button>
              </div>

              <div class="s4u-rich-button-panel" data-rich-button-panel hidden>
                <input
                  type="text"
                  data-rich-button-text
                  placeholder="Button text"
                  aria-label="Button text"
                >

                <input
                  type="url"
                  data-rich-button-url
                  placeholder="https://example.com"
                  aria-label="Button URL"
                >

                <select data-rich-button-style aria-label="Button style">
                  <option value="primary">Primary — Orange</option>
                  <option value="secondary">Secondary — Blue</option>
                  <option value="outline">Outline</option>
                </select>

                <select data-rich-button-size aria-label="Button size">
                  <option value="small">Small</option>
                  <option value="medium" selected>Medium</option>
                  <option value="large">Large</option>
                </select>

                <label class="s4u-rich-panel-check">
                  <input type="checkbox" data-rich-button-new-tab checked>
                  <span>New tab</span>
                </label>

                <button type="button" data-rich-button-apply>Insert Button</button>
                <button type="button" data-rich-button-cancel>Cancel</button>
              </div>

              <div
                class="s4u-rich-editor"
                data-rich-editor
                data-modal-field="${esc(item.name)}"
                contenteditable="true"
                spellcheck="true"
                role="textbox"
                aria-multiline="true"
                data-placeholder="${esc(item.placeholder || "Write lesson content here...")}"
              >${richTextInitialHtml(item.value || "")}</div>
            </div>

            ${item.help ? `<small>${esc(item.help)}</small>` : ""}
          </div>
        `;
      }

      if (item.type === "textarea") {
        return `
          <label class="s4u-modal-field wide"${modes}>
            <span>${esc(item.label)}${item.required ? " *" : ""}</span>
            <textarea
              data-modal-field="${esc(item.name)}"
              rows="${Number(item.rows || 5)}"
              placeholder="${esc(item.placeholder || "")}"
            >${esc(item.value || "")}</textarea>
            ${item.help ? `<small>${esc(item.help)}</small>` : ""}
          </label>
        `;
      }

      if (item.type === "file") {
        return `
          <label class="s4u-modal-upload"${modes}>
            <input
              type="file"
              data-modal-field="${esc(item.name)}"
              accept="${esc(item.accept || "")}"
            >
            <span class="s4u-modal-upload-icon">⇧</span>
            <strong>${esc(item.label)}</strong>
            <small>Choose a file from your computer</small>
            <em data-file-name>No file selected</em>
          </label>
        `;
      }

      return `
        <label class="s4u-modal-field"${modes}>
          <span>${esc(item.label)}${item.required ? " *" : ""}</span>
          <input
            type="${esc(item.type || "text")}"
            data-modal-field="${esc(item.name)}"
            value="${esc(item.value ?? "")}"
            placeholder="${esc(item.placeholder || "")}"
            ${item.min != null ? `min="${esc(item.min)}"` : ""}
            ${item.max != null ? `max="${esc(item.max)}"` : ""}
          >
          ${item.help ? `<small>${esc(item.help)}</small>` : ""}
        </label>
      `;
    }).join("");
  }

  function bindRichTextEditors() {
    const modal = $("s4uEditorModal");
    if (!modal) return;

    modal.querySelectorAll("[data-rich-editor]").forEach((editor) => {
      const shell = editor.closest(".s4u-rich-editor-shell");
      if (!shell) return;

      let savedRange = null;
      let restoringSelection = false;

      const saveSelection = () => {
        if (restoringSelection) return;

        const selection = window.getSelection();
        if (!selection?.rangeCount) return;

        const range = selection.getRangeAt(0);

        if (editor.contains(range.commonAncestorContainer)) {
          savedRange = range.cloneRange();
        }
      };

      const restoreSelection = () => {
        if (!savedRange) {
          editor.focus({ preventScroll: true });
          return false;
        }

        /*
         * IMPORTANT:
         * Focusing the contenteditable fires its focus handler. Without this
         * guard, that focus event can overwrite savedRange with the browser's
         * default caret position (usually the beginning of the editor).
         */
        const rangeToRestore = savedRange.cloneRange();

        restoringSelection = true;

        try {
          editor.focus({ preventScroll: true });

          const selection = window.getSelection();
          selection.removeAllRanges();
          selection.addRange(rangeToRestore);

          savedRange = rangeToRestore.cloneRange();
        } finally {
          restoringSelection = false;
        }

        return true;
      };

      const execute = (command, value = null) => {
        restoreSelection();

        try {
          document.execCommand("styleWithCSS", false, true);
        } catch (_) {}

        document.execCommand(command, false, value);
        saveSelection();
        editor.focus();
      };

      editor.addEventListener("keyup", saveSelection);
      editor.addEventListener("mouseup", saveSelection);
      editor.addEventListener("focus", saveSelection);

      editor.addEventListener("paste", function (event) {
        event.preventDefault();

        const text =
          event.clipboardData?.getData("text/plain") || "";

        document.execCommand(
          "insertText",
          false,
          text
        );
      });

      shell
        .querySelectorAll("[data-rich-command]")
        .forEach((control) => {
          if (control.tagName === "SELECT") {
            control.addEventListener("mousedown", saveSelection);

            control.addEventListener("change", function () {
              let value = control.value;

              if (
                control.dataset.richCommand === "formatBlock"
              ) {
                value = `<${value}>`;
              }

              execute(
                control.dataset.richCommand,
                value
              );
            });

            return;
          }

          control.addEventListener("mousedown", function (event) {
            event.preventDefault();
            saveSelection();
          });

          control.addEventListener("click", function () {
            execute(control.dataset.richCommand);
          });
        });

      const color =
        shell.querySelector("[data-rich-color]");

      color?.addEventListener("mousedown", saveSelection);

      color?.addEventListener("input", function () {
        execute("foreColor", color.value);
      });

      const linkButton =
        shell.querySelector("[data-rich-link]");

      const linkPanel =
        shell.querySelector("[data-rich-link-panel]");

      const linkInput =
        shell.querySelector("[data-rich-link-url]");

      const linkSelectedText =
        shell.querySelector("[data-rich-link-selected-text]");

      const linkNewTab =
        shell.querySelector("[data-rich-link-new-tab]");

      linkButton?.addEventListener("mousedown", function (event) {
        event.preventDefault();
        saveSelection();
      });

      linkButton?.addEventListener("click", function () {
        if (!linkPanel) return;

        /* Preserve the highlighted text before the URL field receives focus. */
        saveSelection();
        restoreSelection();

        const selection =
          window.getSelection();

        const selectedText =
          selection &&
          selection.rangeCount &&
          !selection.isCollapsed
            ? selection.toString().trim()
            : "";

        if (!selectedText) {
          showModalError(
            "Select the text you want to turn into a link, then click Link."
          );

          linkPanel.hidden = true;
          editor.focus();
          return;
        }

        hideModalError();

        if (linkSelectedText) {
          linkSelectedText.textContent = selectedText;
        }

        if (linkInput) {
          linkInput.value = "";
        }

        if (linkNewTab) {
          linkNewTab.checked = true;
        }

        linkPanel.hidden = false;
        linkInput?.focus();
      });

      shell
        .querySelector("[data-rich-link-cancel]")
        ?.addEventListener("click", function () {
          if (linkPanel) linkPanel.hidden = true;
          if (linkInput) linkInput.value = "";
          restoreSelection();
        });

      shell
        .querySelector("[data-rich-link-apply]")
        ?.addEventListener("click", function () {
          const url =
            String(linkInput?.value || "").trim();

          if (!url || !isReasonableUrl(url)) {
            showModalError(
              "Enter a valid link URL beginning with http:// or https://."
            );

            linkInput?.focus();
            return;
          }

          if (!savedRange || savedRange.collapsed) {
            showModalError(
              "Select the text you want to turn into a link, then click Link."
            );

            if (linkPanel) linkPanel.hidden = true;
            editor.focus();
            return;
          }

          if (!restoreSelection()) {
            showModalError(
              "The text selection was lost. Select the text again and click Link."
            );
            return;
          }

          const selection = window.getSelection();

          if (!selection?.rangeCount || selection.isCollapsed) {
            showModalError(
              "The text selection was lost. Select the text again and click Link."
            );
            return;
          }

          hideModalError();

          document.execCommand(
            "createLink",
            false,
            url
          );

          const range =
            selection.getRangeAt(0);

          let anchor =
            range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
              ? range.commonAncestorContainer.closest?.("a[href]")
              : range.commonAncestorContainer.parentElement?.closest?.("a[href]");

          if (!anchor) {
            anchor =
              editor.querySelector(
                `a[href="${cssEscape(url)}"]`
              );
          }

          if (anchor) {
            if (linkNewTab?.checked !== false) {
              anchor.target = "_blank";
              anchor.rel = "noopener noreferrer";
            } else {
              anchor.removeAttribute("target");
              anchor.rel = "noopener";
            }
          }

          saveSelection();

          if (linkPanel) linkPanel.hidden = true;
          if (linkInput) linkInput.value = "";

          editor.focus();
        });

      /* ------------------------------------------------------
         LINKED BUTTON INSIDE THE RICH-TEXT CONTENT
         ------------------------------------------------------ */

      const richButton =
        shell.querySelector("[data-rich-button]");

      const buttonPanel =
        shell.querySelector("[data-rich-button-panel]");

      const buttonText =
        shell.querySelector("[data-rich-button-text]");

      const buttonUrl =
        shell.querySelector("[data-rich-button-url]");

      const buttonStyle =
        shell.querySelector("[data-rich-button-style]");

      const buttonSize =
        shell.querySelector("[data-rich-button-size]");

      const buttonNewTab =
        shell.querySelector("[data-rich-button-new-tab]");

      richButton?.addEventListener("mousedown", function (event) {
        event.preventDefault();
        saveSelection();
      });

      richButton?.addEventListener("click", function () {
        if (!buttonPanel) return;

        /* Keep the exact caret/selection location before panel inputs receive focus. */
        saveSelection();
        hideModalError();

        if (linkPanel) {
          linkPanel.hidden = true;
        }

        buttonPanel.hidden = false;

        if (buttonText) {
          buttonText.value = "";
        }

        if (buttonUrl) {
          buttonUrl.value = "";
        }

        if (buttonStyle) {
          buttonStyle.value = "primary";
        }

        if (buttonSize) {
          buttonSize.value = "medium";
        }

        if (buttonNewTab) {
          buttonNewTab.checked = true;
        }

        buttonText?.focus();
      });

      shell
        .querySelector("[data-rich-button-cancel]")
        ?.addEventListener("click", function () {
          if (buttonPanel) buttonPanel.hidden = true;
          restoreSelection();
        });

      shell
        .querySelector("[data-rich-button-apply]")
        ?.addEventListener("click", function () {
          const text =
            String(buttonText?.value || "").trim();

          const url =
            String(buttonUrl?.value || "").trim();

          const style =
            ["primary", "secondary", "outline"].includes(buttonStyle?.value)
              ? buttonStyle.value
              : "primary";

          const size =
            ["small", "medium", "large"].includes(buttonSize?.value)
              ? buttonSize.value
              : "medium";

          if (!text) {
            showModalError("Enter button text.");
            buttonText?.focus();
            return;
          }

          if (!url || !isReasonableUrl(url)) {
            showModalError(
              "Enter a valid button URL beginning with http:// or https://."
            );
            buttonUrl?.focus();
            return;
          }

          hideModalError();

          if (!restoreSelection()) {
            showModalError(
              "Click in the lesson text where you want the button, then click CTA Button again."
            );
            editor.focus();
            return;
          }

          const selection = window.getSelection();

          if (!selection?.rangeCount) {
            showModalError(
              "The cursor position was lost. Click where you want the button and try again."
            );
            return;
          }

          const range = selection.getRangeAt(0);

          if (!editor.contains(range.commonAncestorContainer)) {
            showModalError(
              "The cursor position was lost. Click where you want the button and try again."
            );
            return;
          }

          /*
           * Insert directly at the saved DOM Range. This guarantees the CTA
           * goes exactly where the caret was instead of wherever the browser
           * moves the selection after panel focus.
           */
          range.deleteContents();

          const anchor = document.createElement("a");
          anchor.href = url;
          anchor.className = "s4u-rich-cta";
          anchor.dataset.s4uButtonStyle = style;
          anchor.dataset.s4uButtonSize = size;
          anchor.textContent = text;

          if (buttonNewTab?.checked !== false) {
            anchor.target = "_blank";
            anchor.rel = "noopener noreferrer";
          } else {
            anchor.rel = "noopener";
          }

          const spacer = document.createTextNode("\u00a0");
          const fragment = document.createDocumentFragment();
          fragment.append(anchor, spacer);
          range.insertNode(fragment);

          const caretRange = document.createRange();
          caretRange.setStartAfter(spacer);
          caretRange.collapse(true);

          selection.removeAllRanges();
          selection.addRange(caretRange);
          savedRange = caretRange.cloneRange();

          saveSelection();

          if (buttonPanel) {
            buttonPanel.hidden = true;
          }

          editor.focus();
        });
    });
  }


  function richTextInitialHtml(value) {
    const input = String(value || "");

    if (!input.trim()) {
      return "";
    }

    if (!/<[a-z][\s\S]*>/i.test(input)) {
      return legacyTextToHtml(input);
    }

    return sanitizeRichHtml(input);
  }


  function legacyTextToHtml(value) {
    let html = esc(value || "");

    html = html
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>")
      .replace(
        /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,
        '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
      );

    return html
      .split(/\n{2,}/)
      .map(
        (paragraph) =>
          `<p>${paragraph.replace(/\n/g, "<br>")}</p>`
      )
      .join("");
  }


  function sanitizeRichHtml(value) {
    const parser = new DOMParser();

    const doc = parser.parseFromString(
      `<div>${String(value || "")}</div>`,
      "text/html"
    );

    const root =
      doc.body.firstElementChild;

    if (!root) return "";

    const allowedTags = new Set([
      "P", "BR", "STRONG", "B", "EM", "I", "U", "S", "STRIKE",
      "UL", "OL", "LI", "H2", "H3", "H4", "BLOCKQUOTE",
      "A", "SPAN", "DIV", "FONT"
    ]);

    const allowedStyles = new Set([
      "font-family",
      "font-size",
      "color",
      "text-align",
      "font-weight",
      "font-style",
      "text-decoration"
    ]);

    const cleanNode = (node) => {
      [...node.children].forEach((child) => {
        if (!allowedTags.has(child.tagName)) {
          child.replaceWith(
            doc.createTextNode(
              child.textContent || ""
            )
          );
          return;
        }

        [...child.attributes].forEach((attribute) => {
          const name =
            attribute.name.toLowerCase();

          if (
            child.tagName === "A" &&
            ["href", "target", "rel"].includes(name)
          ) {
            return;
          }

          if (
            child.tagName === "A" &&
            name === "class" &&
            String(attribute.value || "")
              .split(/\s+/)
              .includes("s4u-rich-cta")
          ) {
            child.setAttribute(
              "class",
              "s4u-rich-cta"
            );
            return;
          }

          if (
            child.tagName === "A" &&
            ["data-s4u-button-style", "data-s4u-button-size"].includes(name)
          ) {
            return;
          }

          if (
            child.tagName === "FONT" &&
            ["color", "face", "size"].includes(name)
          ) {
            return;
          }

          if (name === "style") {
            const safeStyle = [];

            String(attribute.value || "")
              .split(";")
              .forEach((rule) => {
                const separator =
                  rule.indexOf(":");

                if (separator < 1) return;

                const property =
                  rule
                    .slice(0, separator)
                    .trim()
                    .toLowerCase();

                const rawValue =
                  rule
                    .slice(separator + 1)
                    .trim();

                if (
                  allowedStyles.has(property) &&
                  !/url\s*\(|expression\s*\(|javascript:/i.test(rawValue)
                ) {
                  safeStyle.push(
                    `${property}:${rawValue}`
                  );
                }
              });

            if (safeStyle.length) {
              child.setAttribute(
                "style",
                safeStyle.join(";")
              );
            } else {
              child.removeAttribute("style");
            }

            return;
          }

          child.removeAttribute(
            attribute.name
          );
        });

        if (child.tagName === "A") {
          const href =
            String(
              child.getAttribute("href") || ""
            ).trim();

          if (!isReasonableUrl(href)) {
            child.removeAttribute("href");
            child.removeAttribute("target");
            child.removeAttribute("rel");
          } else {
            const openNewTab =
              child.getAttribute("target") === "_blank";

            if (openNewTab) {
              child.setAttribute(
                "target",
                "_blank"
              );

              child.setAttribute(
                "rel",
                "noopener noreferrer"
              );
            } else {
              child.removeAttribute(
                "target"
              );

              child.setAttribute(
                "rel",
                "noopener"
              );
            }
          }

          if (
            child.classList.contains("s4u-rich-cta")
          ) {
            const buttonStyle =
              child.getAttribute("data-s4u-button-style");

            const buttonSize =
              child.getAttribute("data-s4u-button-size");

            child.setAttribute(
              "class",
              "s4u-rich-cta"
            );

            child.setAttribute(
              "data-s4u-button-style",
              ["primary", "secondary", "outline"].includes(buttonStyle)
                ? buttonStyle
                : "primary"
            );

            child.setAttribute(
              "data-s4u-button-size",
              ["small", "medium", "large"].includes(buttonSize)
                ? buttonSize
                : "medium"
            );
          } else {
            child.removeAttribute(
              "data-s4u-button-style"
            );

            child.removeAttribute(
              "data-s4u-button-size"
            );
          }
        }

        cleanNode(child);
      });
    };

    cleanNode(root);

    return root.innerHTML;
  }


  function richTextHasContent(value) {
    const parser = new DOMParser();

    const doc = parser.parseFromString(
      `<div>${String(value || "")}</div>`,
      "text/html"
    );

    return Boolean(
      doc.body.textContent
        ?.replace(/\u00a0/g, " ")
        .trim()
    );
  }


  /*
   * Never navigate away from the lesson editor for video selection.
   * The full-library action is an in-editor nested modal.
   */
  const s4uVideoLibraryNavigationBlock = true;


  async function bindQuizLibraryPicker() {
    const modal = $("s4uEditorModal");
    const grid =
      modal?.querySelector("[data-quiz-library-grid]");
    const status =
      modal?.querySelector("[data-quiz-library-status]");
    const search =
      modal?.querySelector("[data-quiz-library-search]");
    const selectedInput =
      modal?.querySelector(
        '[data-modal-field="library_quiz_id"]'
      );

    if (
      !modal ||
      !grid ||
      !status ||
      !selectedInput
    ) {
      return;
    }

    let rows = [];

    const render = () => {
      const query =
        String(search?.value || "")
          .trim()
          .toLowerCase();

      const visible =
        rows.filter((quiz) => {
          if (!query) return true;

          return [
            quiz.title,
            quiz.description,
            quiz.course_title,
            quiz.section_title,
            quiz.lesson_title
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(query);
        });

      status.textContent =
        visible.length
          ? `${visible.length} quiz${visible.length === 1 ? "" : "zes"} available`
          : "No quizzes match this search.";

      grid.hidden = false;
      grid.style.display = "grid";

      if (!visible.length) {
        grid.innerHTML = `
          <div class="s4u-quiz-library-empty">
            No quizzes match this search.
          </div>
        `;
        return;
      }

      grid.innerHTML =
        visible
          .map((quiz) => {
            const selected =
              String(selectedInput.value || "") ===
              String(quiz.id || "");

            const sameLesson =
              quiz.lesson_id === state.lessonId;

            const attempts =
              quiz.attempt_limit == null
                ? "Unlimited attempts"
                : `${quiz.attempt_limit} attempt${Number(quiz.attempt_limit) === 1 ? "" : "s"}`;

            return `
              <button
                type="button"
                class="s4u-quiz-library-card${selected ? " selected" : ""}"
                data-quiz-library-select="${esc(quiz.id)}"
              >
                <span class="s4u-quiz-library-icon">?</span>

                <span class="s4u-quiz-library-copy">
                  <strong>${esc(quiz.title || "Untitled Quiz")}</strong>
                  <small>
                    ${esc(quiz.course_title)}
                    ·
                    ${esc(quiz.lesson_title)}
                  </small>
                  <em>
                    ${Number(quiz.question_count || 0)} question${Number(quiz.question_count || 0) === 1 ? "" : "s"}
                    ·
                    ${Number(quiz.passing_score ?? 80)}% passing
                    ·
                    ${esc(attempts)}
                  </em>
                </span>

                <span class="s4u-quiz-library-side">
                  ${sameLesson ? `<small>Current lesson</small>` : `<small>Copy to lesson</small>`}
                  <b>${selected ? "✓" : "+"}</b>
                </span>
              </button>
            `;
          })
          .join("");

      grid
        .querySelectorAll("[data-quiz-library-select]")
        .forEach((button) => {
          button.addEventListener("click", function () {
            const id =
              button.dataset.quizLibrarySelect || "";

            if (!rows.some((quiz) => quiz.id === id)) {
              return;
            }

            selectedInput.value = id;
            render();
          });
        });
    };

    search?.addEventListener("input", render);

    try {
      rows = await loadQuizLibraryRows();
      render();
    } catch (error) {
      console.error("[Quiz Library]", error);

      status.textContent =
        error?.message ||
        "Unable to load the Quiz Library.";

      grid.innerHTML = "";
    }
  }


  async function bindVideoLibraryPicker() {
    const modal = $("s4uEditorModal");
    const grid = modal?.querySelector("[data-video-library-grid]");
    const status = modal?.querySelector("[data-video-library-status]");
    const search = modal?.querySelector("[data-video-library-search]");
    const selectedInput = modal?.querySelector(
      '[data-modal-field="library_media_id"]'
    );

    if (!modal || !grid || !status || !selectedInput) {
      return;
    }

    let rows = [];

    const render = () => {
      const query =
        String(search?.value || "")
          .trim()
          .toLowerCase();

      const visible = rows.filter((media) => {
        if (!query) return true;

        return [
          media.title,
          media.original_filename,
          media.provider_video_id,
          media.description
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(query);
      });

      status.textContent = visible.length
        ? `${visible.length} video${visible.length === 1 ? "" : "s"} available`
        : "No videos match this search.";

      /*
       * Keep the picker grid's visibility explicit. This prevents inherited
       * or page-level styles from collapsing the library result area.
       */
      grid.hidden = false;
      grid.style.display = "grid";

      if (!visible.length) {
        grid.innerHTML = `
          <div class="s4u-video-library-empty">
            No videos match this search.
          </div>
        `;
        return;
      }

      grid.innerHTML = visible.map((media) => {
        const selected =
          String(selectedInput.value || "") ===
          String(media.id || "");

        const thumb =
          isReasonableUrl(media.thumbnail_url || "")
            ? `<img src="${esc(media.thumbnail_url)}" alt="">`
            : `<div class="s4u-video-library-placeholder"><span>▶</span></div>`;

        return `
          <button
            type="button"
            class="s4u-video-library-card${selected ? " selected" : ""}"
            data-video-library-select="${esc(media.id)}"
          >
            <span class="s4u-video-library-thumb">${thumb}</span>
            <span class="s4u-video-library-copy">
              <strong>${esc(media.title || media.original_filename || "Untitled Video")}</strong>
              <small>
                ${esc(formatVideoLibraryMeta(media))}
              </small>
            </span>
            <span class="s4u-video-library-check">${selected ? "✓" : "+"}</span>
          </button>
        `;
      }).join("");

      grid
        .querySelectorAll("[data-video-library-select]")
        .forEach((button) => {
          button.addEventListener("click", function () {
            const id = button.dataset.videoLibrarySelect || "";
            const media = rows.find((item) => item.id === id);
            if (!media) return;

            selectedInput.value = media.id;

            const titleInput = modal.querySelector(
              '[data-modal-field="title"]'
            );
            const durationInput = modal.querySelector(
              '[data-modal-field="duration"]'
            );

            if (titleInput) {
              titleInput.value =
                media.title ||
                media.original_filename ||
                "Video";
            }

            if (
              durationInput &&
              media.duration_seconds != null
            ) {
              durationInput.value =
                String(media.duration_seconds);
            }

            render();
          });
        });
    };

    search?.addEventListener("input", render);

    modal
      .querySelector("[data-open-video-library-browser]")
      ?.addEventListener("click", function () {
        openVideoLibraryBrowser({
          rows,
          selectedInput,
          onSelect(media) {

            selectedInput.value =
              media.id;

            const titleInput =
              modal.querySelector(
                '[data-modal-field="title"]'
              );

            const durationInput =
              modal.querySelector(
                '[data-modal-field="duration"]'
              );

            if (titleInput) {
              titleInput.value =
                media.title ||
                media.original_filename ||
                "Video";
            }

            if (
              durationInput &&
              media.duration_seconds != null
            ) {
              durationInput.value =
                String(
                  media.duration_seconds
                );
            }

            render();
          }
        });
      });

    try {
      const { data, error } =
        await state.client
          .from(TABLES.media)
          .select(
            "id,title,description,original_filename,duration_seconds,provider,provider_video_id,provider_status,playback_url,thumbnail_url,created_at,metadata"
          )
          .eq("media_type", "video")
          .order("created_at", { ascending: false });

      if (error) throw error;

      rows = data || [];
      render();
    } catch (error) {
      console.error("[Video Library]", error);
      status.textContent =
        error?.message ||
        "Unable to load the Video Library.";
      grid.innerHTML = "";
    }
  }

  function ensureVideoLibraryBrowserModal() {

    let modal =
      $("s4uVideoLibraryBrowserModal");

    if (modal) {
      return modal;
    }

    modal =
      document.createElement("div");

    modal.id =
      "s4uVideoLibraryBrowserModal";

    modal.className =
      "s4u-video-browser-modal";

    modal.hidden =
      true;

    modal.innerHTML = `
      <div
        class="s4u-video-browser-backdrop"
        data-close-video-browser
      ></div>

      <section
        class="s4u-video-browser-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="s4uVideoBrowserTitle"
      >
        <header class="s4u-video-browser-head">
          <div>
            <span>VIDEO LIBRARY</span>
            <h2 id="s4uVideoBrowserTitle">Choose a Video</h2>
            <p>Select a video and return directly to the lesson editor.</p>
          </div>

          <button
            type="button"
            class="s4u-video-browser-close"
            data-close-video-browser
            aria-label="Close video library"
          >×</button>
        </header>

        <div class="s4u-video-browser-tools">
          <input
            type="search"
            data-video-browser-search
            placeholder="Search videos..."
            aria-label="Search full video library"
          >

          <span data-video-browser-count></span>
        </div>

        <div
          class="s4u-video-browser-grid"
          data-video-browser-grid
        ></div>

        <footer class="s4u-video-browser-footer">
          <button
            type="button"
            class="secondary"
            data-close-video-browser
          >Cancel</button>
        </footer>
      </section>
    `;

    document.body.appendChild(
      modal
    );

    modal
      .querySelectorAll(
        "[data-close-video-browser]"
      )
      .forEach((node) => {
        node.addEventListener(
          "click",
          closeVideoLibraryBrowser
        );
      });

    return modal;
  }


  function openVideoLibraryBrowser({
    rows = [],
    selectedInput = null,
    onSelect = null
  } = {}) {

    const modal =
      ensureVideoLibraryBrowserModal();

    const search =
      modal.querySelector(
        "[data-video-browser-search]"
      );

    const grid =
      modal.querySelector(
        "[data-video-browser-grid]"
      );

    const count =
      modal.querySelector(
        "[data-video-browser-count]"
      );

    modal._rows =
      Array.isArray(rows)
        ? rows
        : [];

    modal._selectedInput =
      selectedInput;

    modal._onSelect =
      typeof onSelect === "function"
        ? onSelect
        : null;

    const renderBrowser =
      () => {

        const query =
          String(
            search?.value || ""
          )
            .trim()
            .toLowerCase();

        const visible =
          modal._rows.filter(
            (media) => {

              if (!query) {
                return true;
              }

              return [
                media.title,
                media.original_filename,
                media.provider_video_id,
                media.description
              ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase()
                .includes(query);
            }
          );

        if (count) {
          count.textContent =
            `${visible.length} video${visible.length === 1 ? "" : "s"}`;
        }

        if (!visible.length) {

          grid.innerHTML = `
            <div class="s4u-video-browser-empty">
              No videos match this search.
            </div>
          `;

          return;
        }

        grid.innerHTML =
          visible
            .map((media) => {

              const selected =
                String(
                  modal._selectedInput?.value ||
                  ""
                ) ===
                String(
                  media.id ||
                  ""
                );

              const thumb =
                isReasonableUrl(
                  media.thumbnail_url ||
                  ""
                )
                  ? `<img src="${esc(media.thumbnail_url)}" alt="">`
                  : `<div class="s4u-video-library-placeholder"><span>▶</span></div>`;

              return `
                <button
                  type="button"
                  class="s4u-video-browser-item${selected ? " selected" : ""}"
                  data-video-browser-select="${esc(media.id)}"
                >
                  <span class="s4u-video-browser-thumb">
                    ${thumb}
                  </span>

                  <span class="s4u-video-browser-copy">
                    <strong>
                      ${esc(media.title || media.original_filename || "Untitled Video")}
                    </strong>

                    <small>
                      ${esc(formatVideoLibraryMeta(media))}
                    </small>

                    <em>
                      ${esc(media.provider_video_id || "")}
                    </em>
                  </span>

                  <span class="s4u-video-browser-select-label">
                    ${selected ? "Selected" : "Select"}
                  </span>
                </button>
              `;
            })
            .join("");

        grid
          .querySelectorAll(
            "[data-video-browser-select]"
          )
          .forEach((button) => {

            button.addEventListener(
              "click",
              function () {

                const id =
                  button.dataset
                    .videoBrowserSelect ||
                  "";

                const media =
                  modal._rows.find(
                    (item) =>
                      String(item.id) ===
                      String(id)
                  );

                if (!media) {
                  return;
                }

                if (
                  modal._selectedInput
                ) {
                  modal._selectedInput.value =
                    media.id;
                }

                modal._onSelect?.(
                  media
                );

                closeVideoLibraryBrowser();
              }
            );
          });
      };

    if (search) {

      search.value =
        "";

      search.oninput =
        renderBrowser;
    }

    renderBrowser();

    modal.hidden =
      false;

    setTimeout(() => {
      search?.focus();
    }, 0);
  }


  function closeVideoLibraryBrowser() {

    const modal =
      $("s4uVideoLibraryBrowserModal");

    if (
      !modal ||
      modal.hidden
    ) {
      return;
    }

    modal.hidden =
      true;

    modal._rows =
      [];

    modal._selectedInput =
      null;

    modal._onSelect =
      null;
  }


  function formatVideoLibraryMeta(media) {
    const parts = [];

    if (media?.duration_seconds != null) {
      parts.push(formatDuration(media.duration_seconds));
    }

    if (media?.provider === "cloudflare_stream") {
      parts.push("Cloudflare Stream");
    } else if (media?.provider) {
      parts.push(titleCase(media.provider));
    }

    if (media?.provider_status) {
      parts.push(titleCase(media.provider_status));
    }

    return parts.join(" · ") || "Video";
  }

  function titleCase(value) {
    return String(value || "")
      .replace(/[_-]+/g, " ")
      .replace(/\b\w/g, (character) =>
        character.toUpperCase()
      );
  }


  function formatDuration(seconds) {
    const value = Math.max(0, Math.round(Number(seconds) || 0));
    const hours = Math.floor(value / 3600);
    const minutes = Math.floor((value % 3600) / 60);
    const remainder = value % 60;

    if (hours) {
      return `${hours}:${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
    }

    return `${minutes}:${String(remainder).padStart(2, "0")}`;
  }


  function bindModalFieldModes() {
    const modal = $("s4uEditorModal");
    if (!modal) return;

    modal.querySelectorAll('input[type="file"]').forEach((input) => {
      input.addEventListener("change", function () {
        const label = input.closest(".s4u-modal-upload");
        const target = label?.querySelector("[data-file-name]");
        if (target) {
          target.textContent = input.files?.[0]?.name || "No file selected";
        }
      });
    });

    const controller = modal.querySelector("[data-mode-controller]");

    if (controller) {
      const sync = () => {
        const mode = controller.value;

        modal.querySelectorAll("[data-modes]").forEach((node) => {
          const modes = String(node.dataset.modes || "").split(",");
          node.hidden = !modes.includes(mode);
        });
      };

      controller.addEventListener("change", sync);
      sync();
    }
  }

  function readModalFields(fields) {
    const modal = $("s4uEditorModal");
    const values = {};

    hideModalError();

    for (const item of fields) {
      const input = modal.querySelector(
        `[data-modal-field="${cssEscape(item.name)}"]`
      );

      if (!input) continue;

      const modeController = modal.querySelector("[data-mode-controller]");
      const currentMode = modeController?.value || null;

      if (item.modes?.length && currentMode && !item.modes.includes(currentMode)) {
        values[item.name] = item.type === "checkbox" ? false : "";
        continue;
      }

      if (item.type === "checkbox") {
        values[item.name] = input.checked;
        continue;
      }

      if (item.type === "file") {
        values[item.name] = input.files?.[0] || null;
        continue;
      }

      if (item.type === "richtext") {
        const value =
          sanitizeRichHtml(
            input.innerHTML || ""
          );

        if (
          item.required &&
          !richTextHasContent(value)
        ) {
          showModalError(
            `${item.label} is required.`
          );

          input.focus();
          return null;
        }

        values[item.name] = value;
        continue;
      }

      const value = input.value ?? "";

      if (item.required && !String(value).trim()) {
        showModalError(`${item.label} is required.`);
        input.focus();
        return null;
      }

      if (
        item.type === "url" &&
        String(value).trim() &&
        !isReasonableUrl(String(value).trim())
      ) {
        showModalError(`Enter a valid ${item.label.toLowerCase()}.`);
        input.focus();
        return null;
      }

      values[item.name] = String(value);
    }

    return values;
  }

  function brandedConfirm({
    eyebrow = "CONFIRM ACTION",
    title = "Are you sure?",
    message = "",
    confirmLabel = "Confirm"
  }) {
    const modal = ensureEditorModal();

    setText("s4uEditorModalEyebrow", eyebrow);
    setText("s4uEditorModalTitle", title);
    setText("s4uEditorModalDescription", "");
    setText("s4uEditorModalConfirm", confirmLabel);

    $("s4uEditorModalConfirm").classList.add("danger");

    $("s4uEditorModalBody").innerHTML = `
      <div class="s4u-modal-confirm-copy">${esc(message)}</div>
    `;

    hideModalError();
    hideModalProgress();

    modal.hidden = false;
    modal.dataset.previousOverflow = document.body.style.overflow || "";
    document.body.style.overflow = "hidden";

    return new Promise((resolve) => {
      modal._resolver = resolve;

      $("s4uEditorModalConfirm").onclick = function () {
        modal._resolver = null;
        closeEditorModal(true);
        resolve(true);
      };
    });
  }

  function closeEditorModal(result) {
    closeVideoLibraryBrowser();

    const modal = $("s4uEditorModal");
    if (!modal) return;

    const resolver = modal._resolver;
    modal._resolver = null;

    modal.hidden = true;

    document.body.style.overflow =
      modal.dataset.previousOverflow || "";

    modal.dataset.previousOverflow = "";

    if (resolver) resolver(result);
  }

  function showModalError(message) {
    const box = $("s4uEditorModalError");
    if (!box) return;

    box.textContent = message;
    box.classList.add("show");
  }

  function hideModalError() {
    const box = $("s4uEditorModalError");
    if (!box) return;

    box.textContent = "";
    box.classList.remove("show");
  }

  function showModalProgress(message, percent) {
    const wrap = $("s4uEditorModalProgress");
    if (!wrap) return;

    wrap.hidden = false;

    const safe = Math.max(0, Math.min(100, Number(percent) || 0));

    setText("s4uEditorModalProgressText", message);
    setText("s4uEditorModalProgressValue", `${Math.round(safe)}%`);

    const bar = $("s4uEditorModalProgressBar");
    if (bar) bar.style.width = `${safe}%`;
  }

  function hideModalProgress() {
    const wrap = $("s4uEditorModalProgress");
    if (wrap) wrap.hidden = true;

    const bar = $("s4uEditorModalProgressBar");
    if (bar) bar.style.width = "0%";
  }

  function setModalBusy(busy) {
    const modal = $("s4uEditorModal");
    if (!modal) return;

    modal
      .querySelectorAll("input,textarea,select,button")
      .forEach((node) => {
        node.disabled =
          Boolean(busy);
      });

    modal
      .querySelectorAll("[contenteditable]")
      .forEach((node) => {
        node.contentEditable =
          busy ? "false" : "true";
      });
  }

  /* ============================================================
     STYLE
     ============================================================ */

  function injectEditorStyles() {
    if ($("s4uFullEditorStyles")) return;

    const style = document.createElement("style");
    style.id = "s4uFullEditorStyles";

    style.textContent = `
      :root{
        --s4u-blue:var(--admin-blue,#24467f);
        --s4u-blue-dark:var(--admin-blue-dark,#24467f);
        --s4u-orange:var(--admin-orange,#ff6b00);
        --s4u-orange-hover:var(--admin-orange-hover,#e66000);
        --s4u-bg:var(--admin-bg,#f5f7fa);
        --s4u-card:var(--admin-card,#fff);
        --s4u-border:var(--admin-border,#dfe5ec);
        --s4u-text:var(--admin-text,#172033);
        --s4u-muted:var(--admin-muted,#687386);
      }

      .s4u-editor-settings,
      .s4u-full-editor{
        margin-top:22px;
        overflow:hidden;
        border:1px solid var(--s4u-border);
        border-radius:18px;
        background:var(--s4u-card);
        box-shadow:0 8px 24px rgba(23,32,51,.06);
      }

      .s4u-editor-section-head,
      .s4u-editor-header{
        display:flex;
        align-items:flex-start;
        justify-content:space-between;
        gap:20px;
        padding:22px 24px;
        border-bottom:1px solid var(--s4u-border);
      }

      .s4u-editor-section-head > div > span,
      .s4u-editor-header > div > span{
        color:var(--s4u-orange);
        font-size:11px;
        font-weight:900;
        letter-spacing:.12em;
      }

      .s4u-editor-section-head h2,
      .s4u-editor-header h2{
        margin:6px 0 4px;
        color:var(--s4u-text);
        font-size:20px;
      }

      .s4u-editor-section-head p,
      .s4u-editor-header p{
        margin:0;
        color:var(--s4u-muted);
        font-size:13px;
        line-height:1.5;
      }

      .s4u-editor-counter{
        flex:0 0 auto;
        padding:8px 11px;
        border-radius:999px;
        background:rgba(50,90,163,.08);
        color:var(--s4u-blue);
        font-size:12px;
        font-weight:800;
      }

      .s4u-editor-settings-grid{
        display:grid;
        grid-template-columns:repeat(2,minmax(0,1fr));
        gap:18px;
        padding:22px 24px;
      }

      .s4u-editor-settings-grid label{
        display:grid;
        gap:7px;
      }

      .s4u-editor-settings-grid label.wide{
        grid-column:1/-1;
      }

      .s4u-editor-settings-grid label > span{
        color:var(--s4u-text);
        font-size:12px;
        font-weight:800;
      }

      .s4u-editor-settings-grid input,
      .s4u-editor-settings-grid select,
      .s4u-editor-settings-grid textarea{
        width:100%;
        border:1px solid var(--s4u-border);
        border-radius:10px;
        background:#fff;
        color:var(--s4u-text);
        font:inherit;
        font-size:14px;
        outline:none;
      }

      .s4u-editor-settings-grid input,
      .s4u-editor-settings-grid select{
        height:44px;
        padding:0 12px;
      }

      .s4u-editor-settings-grid textarea{
        padding:11px 12px;
        resize:vertical;
      }

      .s4u-editor-settings-grid input:focus,
      .s4u-editor-settings-grid select:focus,
      .s4u-editor-settings-grid textarea:focus{
        border-color:var(--s4u-blue);
        box-shadow:0 0 0 3px rgba(50,90,163,.1);
      }

      .s4u-editor-toggle-grid{
        display:grid;
        grid-template-columns:repeat(3,minmax(0,1fr));
        gap:12px;
        padding:0 24px 22px;
      }

      .s4u-editor-toggle,
      .s4u-modal-check{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:16px;
        padding:14px;
        border:1px solid var(--s4u-border);
        border-radius:12px;
        background:#fff;
      }

      .s4u-editor-toggle > span,
      .s4u-modal-check > span{
        min-width:0;
      }

      .s4u-editor-toggle strong,
      .s4u-editor-toggle small,
      .s4u-modal-check strong,
      .s4u-modal-check small{
        display:block;
      }

      .s4u-editor-toggle strong,
      .s4u-modal-check strong{
        color:var(--s4u-text);
        font-size:12px;
      }

      .s4u-editor-toggle small,
      .s4u-modal-check small{
        margin-top:3px;
        color:var(--s4u-muted);
        font-size:11px;
        line-height:1.4;
      }

      .s4u-editor-toggle input,
      .s4u-modal-check input{
        position:absolute;
        opacity:0;
        pointer-events:none;
      }

      .s4u-editor-toggle i,
      .s4u-modal-check i{
        position:relative;
        width:40px;
        height:22px;
        flex:0 0 40px;
        border-radius:999px;
        background:#cbd5e1;
        transition:.18s ease;
      }

      .s4u-editor-toggle i:after,
      .s4u-modal-check i:after{
        content:"";
        position:absolute;
        top:3px;
        left:3px;
        width:16px;
        height:16px;
        border-radius:50%;
        background:#fff;
        box-shadow:0 1px 4px rgba(15,23,42,.2);
        transition:.18s ease;
      }

      .s4u-editor-toggle input:checked + i,
      .s4u-modal-check input:checked + i{
        background:var(--s4u-blue);
      }

      .s4u-editor-toggle input:checked + i:after,
      .s4u-modal-check input:checked + i:after{
        transform:translateX(18px);
      }

      .s4u-editor-toolbar{
        display:grid;
        grid-template-columns:repeat(7,minmax(82px,1fr));
        gap:8px;
        padding:16px 18px;
        border-bottom:1px solid var(--s4u-border);
        background:#f9fbfd;
      }

      .s4u-editor-tool{
        min-height:68px;
        display:grid;
        place-items:center;
        align-content:center;
        gap:5px;
        border:1px solid var(--s4u-border);
        border-radius:11px;
        background:#fff;
        color:var(--s4u-text);
        cursor:pointer;
        transition:.16s ease;
      }

      .s4u-editor-tool:hover{
        border-color:var(--s4u-blue);
        background:rgba(50,90,163,.04);
        transform:translateY(-1px);
      }

      .s4u-editor-tool strong{
        color:var(--s4u-blue);
        font-size:16px;
        line-height:1;
      }

      .s4u-editor-tool span{
        font-size:11px;
        font-weight:800;
      }

      .s4u-editor-canvas{
        display:grid;
        gap:10px;
        padding:18px;
        background:#f7f9fc;
      }

      .s4u-editor-block{
        display:grid;
        grid-template-columns:30px minmax(0,1fr) 42px;
        gap:8px;
        align-items:stretch;
        border:1px solid var(--s4u-border);
        border-radius:13px;
        background:#fff;
        box-shadow:0 4px 14px rgba(23,32,51,.035);
        transition:.16s ease;
      }

      .s4u-editor-block:hover{
        border-color:#bfd0e5;
        box-shadow:0 8px 22px rgba(23,32,51,.07);
      }

      .s4u-editor-drag{
        display:grid;
        place-items:center;
        color:#9aa6b6;
        font-size:16px;
        user-select:none;
      }

      .s4u-editor-block-main{
        min-width:0;
        display:grid;
        grid-template-columns:42px minmax(0,1fr);
        gap:12px;
        align-items:center;
        padding:13px 0;
        border:0;
        background:transparent;
        color:inherit;
        text-align:left;
        cursor:pointer;
      }

      .s4u-editor-block-icon{
        width:40px;
        height:40px;
        display:grid;
        place-items:center;
        border-radius:10px;
        background:rgba(50,90,163,.08);
        color:var(--s4u-blue);
        font-size:13px;
        font-weight:900;
      }

      .s4u-editor-block-copy{
        min-width:0;
      }

      .s4u-editor-block-title{
        display:flex;
        flex-wrap:wrap;
        align-items:center;
        gap:7px;
      }

      .s4u-editor-block-title strong{
        color:var(--s4u-text);
        font-size:14px;
      }

      .s4u-editor-block-title span,
      .s4u-editor-block-title em{
        padding:3px 7px;
        border-radius:999px;
        font-size:9px;
        font-style:normal;
        font-weight:900;
        text-transform:uppercase;
        letter-spacing:.05em;
      }

      .s4u-editor-block-title span{
        background:#edf3fb;
        color:var(--s4u-blue);
      }

      .s4u-editor-block-title em{
        background:#fff0e5;
        color:var(--s4u-orange);
      }

      .s4u-editor-more{
        width:34px;
        height:34px;
        align-self:center;
        border:1px solid transparent;
        border-radius:9px;
        background:transparent;
        color:#627188;
        font-size:16px;
        font-weight:900;
        cursor:pointer;
      }

      .s4u-editor-more:hover{
        border-color:var(--s4u-border);
        background:var(--s4u-bg);
        color:var(--s4u-orange);
      }

      .s4u-preview-heading{
        margin:8px 0 0;
        color:#34425a;
        font-size:14px;
      }

      .s4u-preview-text,
      .s4u-preview-url,
      .s4u-preview-placeholder{
        margin-top:7px;
        color:var(--s4u-muted);
        font-size:12px;
        line-height:1.55;
      }

      .s4u-preview-text{
        max-height:54px;
        overflow:hidden;
      }

      .s4u-preview-divider{
        height:1px;
        margin-top:12px;
        background:var(--s4u-border);
      }

      .s4u-preview-media{
        display:flex;
        align-items:center;
        gap:8px;
        margin-top:8px;
        color:var(--s4u-muted);
        font-size:11px;
      }

      .s4u-preview-media span{
        color:var(--s4u-orange);
      }

      .s4u-preview-image{
        max-width:420px;
        margin-top:9px;
      }

      .s4u-preview-image img{
        display:block;
        width:100%;
        max-height:180px;
        object-fit:cover;
        border-radius:9px;
        border:1px solid var(--s4u-border);
      }

      .s4u-preview-image small{
        display:block;
        margin-top:4px;
        color:var(--s4u-muted);
        font-size:10px;
      }

      .s4u-editor-add-row{
        width:calc(100% - 36px);
        min-height:46px;
        margin:0 18px 18px;
        border:1px dashed var(--s4u-blue);
        border-radius:11px;
        background:rgba(50,90,163,.025);
        color:var(--s4u-blue);
        font:inherit;
        font-size:12px;
        font-weight:800;
        cursor:pointer;
      }

      .s4u-editor-add-row span{
        color:var(--s4u-orange);
        font-size:16px;
      }

      .s4u-editor-empty{
        padding:48px 20px;
        text-align:center;
        border:1px dashed #c9d4e2;
        border-radius:13px;
        background:#fff;
      }

      .s4u-editor-empty-icon{
        width:48px;
        height:48px;
        margin:0 auto 12px;
        display:grid;
        place-items:center;
        border-radius:14px;
        background:rgba(255,107,0,.1);
        color:var(--s4u-orange);
        font-size:22px;
      }

      .s4u-editor-empty h3{
        margin:0;
        color:var(--s4u-text);
        font-size:16px;
      }

      .s4u-editor-empty p{
        margin:7px auto 16px;
        max-width:480px;
        color:var(--s4u-muted);
        font-size:12px;
        line-height:1.55;
      }

      .s4u-editor-empty button{
        min-height:39px;
        padding:0 14px;
        border:0;
        border-radius:9px;
        background:var(--s4u-orange);
        color:#fff;
        font-weight:800;
        cursor:pointer;
      }

      .s4u-editor-action-menu{
        position:fixed;
        z-index:10020;
        width:190px;
        padding:6px;
        border:1px solid var(--s4u-border);
        border-radius:11px;
        background:#fff;
        box-shadow:0 18px 45px rgba(23,32,51,.18);
      }

      .s4u-editor-action-menu button{
        width:100%;
        min-height:38px;
        padding:0 10px;
        border:0;
        border-radius:7px;
        background:transparent;
        color:var(--s4u-text);
        font:inherit;
        font-size:12px;
        font-weight:700;
        text-align:left;
        cursor:pointer;
      }

      .s4u-editor-action-menu button:hover{
        background:#f3f6fa;
        color:var(--s4u-blue);
      }

      .s4u-editor-action-menu button.danger{
        color:#b42318;
      }

      .s4u-editor-action-menu button.danger:hover{
        background:#fff2f0;
      }

      #s4uEditorModal{
        position:fixed;
        inset:0;
        z-index:10000;
        display:grid;
        place-items:center;
        padding:16px 20px;
      }

      #s4uEditorModal[hidden]{
        display:none;
      }

      /*
       * Source-mode fields in the editor use the HTML hidden attribute.
       * Several modal components also define display:grid/flex below, so
       * explicitly preserve hidden semantics inside this modal.
       */
      #s4uEditorModal [hidden]{
        display:none !important;
      }

      .s4u-editor-modal-backdrop{
        position:absolute;
        inset:0;
        background:rgba(23,32,51,.62);
        backdrop-filter:blur(2px);
      }

      .s4u-editor-modal-card{
        position:relative;
        z-index:1;
        width:min(1120px,calc(100vw - 40px));
        max-height:calc(100vh - 32px);
        display:flex;
        flex-direction:column;
        overflow:hidden;
        border:1px solid var(--s4u-border);
        border-radius:18px;
        background:#fff;
        box-shadow:0 30px 90px rgba(23,32,51,.25);
      }

      .s4u-editor-modal-head{
        flex:0 0 auto;
        display:flex;
        align-items:flex-start;
        justify-content:space-between;
        gap:18px;
        padding:23px 25px 19px;
        border-top:4px solid var(--s4u-orange);
        border-bottom:1px solid var(--s4u-border);
      }

      .s4u-editor-modal-head > div > span{
        color:var(--s4u-orange);
        font-size:10px;
        font-weight:900;
        letter-spacing:.12em;
      }

      .s4u-editor-modal-head h2{
        margin:5px 0 5px;
        color:var(--s4u-blue-dark);
        font-size:22px;
      }

      .s4u-editor-modal-head p{
        margin:0;
        color:var(--s4u-muted);
        font-size:13px;
        line-height:1.5;
      }

      .s4u-editor-modal-close{
        width:36px;
        height:36px;
        flex:0 0 36px;
        border:1px solid var(--s4u-border);
        border-radius:50%;
        background:#fff;
        color:#59687d;
        font-size:20px;
        cursor:pointer;
      }

      .s4u-editor-modal-error{
        flex:0 0 auto;
        display:none;
        margin:16px 25px 0;
        padding:11px 13px;
        border:1px solid #efc3bf;
        border-radius:9px;
        background:#fff3f2;
        color:#a02b24;
        font-size:12px;
        font-weight:700;
      }

      .s4u-editor-modal-error.show{
        display:block;
      }

      .s4u-editor-modal-progress{
        flex:0 0 auto;
        margin:16px 25px 0;
        padding:12px 13px;
        border:1px solid #d8e4f3;
        border-radius:10px;
        background:#f6f9fd;
      }

      .s4u-editor-modal-progress > div{
        display:flex;
        justify-content:space-between;
        gap:14px;
        color:var(--s4u-blue-dark);
        font-size:11px;
        font-weight:800;
      }

      .s4u-editor-modal-progress > i{
        display:block;
        height:7px;
        margin-top:9px;
        overflow:hidden;
        border-radius:999px;
        background:#dde7f3;
      }

      .s4u-editor-modal-progress > i > b{
        display:block;
        width:0;
        height:100%;
        border-radius:inherit;
        background:linear-gradient(90deg,var(--s4u-blue),var(--s4u-orange));
        transition:width .15s ease;
      }

      .s4u-editor-modal-body{
        min-height:0;
        display:grid;
        grid-template-columns:repeat(3,minmax(0,1fr));
        gap:16px;
        padding:22px 25px;
        overflow:auto;
        overscroll-behavior:contain;
      }

      .s4u-video-library-field{
        grid-column:1/-1;
        display:grid;
        gap:12px;
        min-width:0;
        padding:14px;
        border:1px solid var(--s4u-border);
        border-radius:12px;
        background:#f8fafc;
      }

      .s4u-video-library-toolbar{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:16px;
      }

      .s4u-video-library-toolbar > div:first-child{
        display:grid;
        gap:3px;
      }

      .s4u-video-library-toolbar strong{
        color:var(--s4u-blue-dark);
        font-size:14px;
      }

      .s4u-video-library-toolbar small,
      .s4u-video-library-status{
        color:var(--s4u-muted);
        font-size:12px;
      }

      .s4u-video-library-toolbar-actions{
        display:flex;
        align-items:center;
        gap:8px;
      }

      .s4u-video-library-toolbar-actions input{
        width:230px;
        height:38px;
        padding:0 11px;
        border:1px solid #cfd9e6;
        border-radius:8px;
        background:#fff;
        color:var(--s4u-text);
        font:inherit;
        font-size:12px;
        outline:none;
      }

      .s4u-video-library-toolbar-actions input:focus{
        border-color:var(--s4u-blue);
        box-shadow:0 0 0 3px rgba(50,90,163,.08);
      }

      .s4u-video-library-open{
        min-height:38px;
        display:inline-flex;
        align-items:center;
        padding:0 12px;
        border:1px solid var(--s4u-border);
        border-radius:8px;
        background:#fff;
        color:var(--s4u-blue);
        font-size:12px;
        font-weight:800;
        text-decoration:none;
        white-space:nowrap;
      }

      .s4u-video-library-open:hover{
        border-color:var(--s4u-blue);
        color:var(--s4u-orange);
      }

      .s4u-video-library-grid{
        display:grid;
        grid-template-columns:repeat(3,minmax(0,1fr));
        gap:10px;
        width:100%;
        min-height:0;
        max-height:370px;
        overflow:auto;
      }

      .s4u-video-library-empty{
        grid-column:1/-1;
        padding:16px;
        border:1px dashed var(--s4u-border);
        border-radius:9px;
        background:#fff;
        color:var(--s4u-muted);
        font-size:12px;
        text-align:center;
      }

      .s4u-video-library-card{
        width:100%;
        min-width:0;
        min-height:70px;
        display:grid;
        grid-template-columns:88px minmax(0,1fr) 28px;
        align-items:center;
        gap:10px;
        padding:8px;
        border:1px solid var(--s4u-border);
        border-radius:10px;
        background:#fff;
        color:var(--s4u-text);
        font:inherit;
        text-align:left;
        cursor:pointer;
      }

      .s4u-video-library-card:hover{
        border-color:var(--s4u-blue);
      }

      .s4u-video-library-card.selected{
        border-color:var(--s4u-orange);
        box-shadow:0 0 0 2px rgba(255,107,0,.10);
      }

      .s4u-video-library-thumb{
        width:88px;
        height:52px;
        display:block;
        overflow:hidden;
        border-radius:7px;
        background:#e8eef6;
      }

      .s4u-video-library-thumb img{
        width:100%;
        height:100%;
        display:block;
        object-fit:cover;
      }

      .s4u-video-library-placeholder{
        width:100%;
        height:100%;
        display:grid;
        place-items:center;
        background:linear-gradient(135deg,rgba(50,90,163,.12),rgba(255,107,0,.10));
        color:var(--s4u-orange);
        font-size:18px;
      }

      .s4u-video-library-copy{
        min-width:0;
        display:grid;
        gap:4px;
      }

      .s4u-video-library-copy strong{
        overflow:hidden;
        color:var(--s4u-blue-dark);
        font-size:12px;
        white-space:nowrap;
        text-overflow:ellipsis;
      }

      .s4u-video-library-copy small{
        overflow:hidden;
        color:var(--s4u-muted);
        font-size:10px;
        white-space:nowrap;
        text-overflow:ellipsis;
      }

      .s4u-video-library-check{
        width:26px;
        height:26px;
        display:grid;
        place-items:center;
        border-radius:50%;
        background:rgba(50,90,163,.08);
        color:var(--s4u-blue);
        font-size:13px;
        font-weight:900;
      }

      .s4u-video-library-card.selected .s4u-video-library-check{
        background:rgba(255,107,0,.12);
        color:var(--s4u-orange);
      }

      .s4u-video-browser-modal{
        position:fixed;
        inset:0;
        z-index:10050;
        display:grid;
        place-items:center;
        padding:24px;
      }

      .s4u-video-browser-modal[hidden]{
        display:none !important;
      }

      .s4u-video-browser-backdrop{
        position:absolute;
        inset:0;
        background:rgba(15,31,54,.62);
        backdrop-filter:blur(2px);
      }

      .s4u-video-browser-card{
        position:relative;
        z-index:1;
        width:min(1080px,calc(100vw - 48px));
        max-height:min(760px,calc(100vh - 48px));
        display:grid;
        grid-template-rows:auto auto minmax(0,1fr) auto;
        overflow:hidden;
        border-top:4px solid var(--s4u-orange);
        border-radius:16px;
        background:#fff;
        box-shadow:0 24px 70px rgba(15,31,54,.28);
      }

      .s4u-video-browser-head{
        display:flex;
        align-items:flex-start;
        justify-content:space-between;
        gap:20px;
        padding:22px 26px 18px;
        border-bottom:1px solid var(--s4u-border);
      }

      .s4u-video-browser-head > div{
        display:grid;
        gap:4px;
      }

      .s4u-video-browser-head span{
        color:var(--s4u-orange);
        font-size:11px;
        font-weight:900;
        letter-spacing:.08em;
      }

      .s4u-video-browser-head h2{
        margin:0;
        color:var(--s4u-blue-dark);
        font-size:22px;
      }

      .s4u-video-browser-head p{
        margin:0;
        color:var(--s4u-muted);
        font-size:13px;
      }

      .s4u-video-browser-close{
        width:38px;
        height:38px;
        display:grid;
        place-items:center;
        border:1px solid var(--s4u-border);
        border-radius:50%;
        background:#fff;
        color:var(--s4u-blue);
        font-size:22px;
        cursor:pointer;
      }

      .s4u-video-browser-tools{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:14px;
        padding:14px 26px;
        border-bottom:1px solid var(--s4u-border);
        background:#f8fafc;
      }

      .s4u-video-browser-tools input{
        width:min(420px,100%);
        height:42px;
        padding:0 12px;
        border:1px solid #cfd9e6;
        border-radius:9px;
        background:#fff;
        color:var(--s4u-text);
        font:inherit;
        font-size:13px;
        outline:none;
      }

      .s4u-video-browser-tools span{
        color:var(--s4u-muted);
        font-size:12px;
        font-weight:800;
      }

      .s4u-video-browser-grid{
        min-height:250px;
        display:grid;
        grid-template-columns:repeat(2,minmax(0,1fr));
        align-content:start;
        gap:12px;
        padding:20px 26px;
        overflow:auto;
      }

      .s4u-video-browser-item{
        width:100%;
        min-width:0;
        display:grid;
        grid-template-columns:160px minmax(0,1fr) auto;
        align-items:center;
        gap:14px;
        padding:10px;
        border:1px solid var(--s4u-border);
        border-radius:12px;
        background:#fff;
        color:var(--s4u-text);
        font:inherit;
        text-align:left;
        cursor:pointer;
      }

      .s4u-video-browser-item:hover{
        border-color:var(--s4u-blue);
        box-shadow:0 6px 18px rgba(50,90,163,.08);
      }

      .s4u-video-browser-item.selected{
        border-color:var(--s4u-orange);
        box-shadow:0 0 0 2px rgba(255,107,0,.10);
      }

      .s4u-video-browser-thumb{
        width:160px;
        height:92px;
        display:block;
        overflow:hidden;
        border-radius:9px;
        background:#e8eef6;
      }

      .s4u-video-browser-thumb img{
        width:100%;
        height:100%;
        display:block;
        object-fit:cover;
      }

      .s4u-video-browser-copy{
        min-width:0;
        display:grid;
        gap:6px;
      }

      .s4u-video-browser-copy strong{
        overflow:hidden;
        color:var(--s4u-blue-dark);
        font-size:14px;
        white-space:nowrap;
        text-overflow:ellipsis;
      }

      .s4u-video-browser-copy small{
        color:var(--s4u-muted);
        font-size:12px;
      }

      .s4u-video-browser-copy em{
        overflow:hidden;
        color:#7d899a;
        font-size:10px;
        font-style:normal;
        white-space:nowrap;
        text-overflow:ellipsis;
      }

      .s4u-video-browser-select-label{
        min-width:62px;
        padding:8px 10px;
        border-radius:8px;
        background:rgba(50,90,163,.08);
        color:var(--s4u-blue);
        font-size:11px;
        font-weight:900;
        text-align:center;
      }

      .s4u-video-browser-item.selected .s4u-video-browser-select-label{
        background:rgba(255,107,0,.12);
        color:var(--s4u-orange);
      }

      .s4u-video-browser-empty{
        grid-column:1/-1;
        padding:30px;
        border:1px dashed var(--s4u-border);
        border-radius:10px;
        color:var(--s4u-muted);
        text-align:center;
      }

      .s4u-video-browser-footer{
        display:flex;
        justify-content:flex-end;
        padding:14px 26px;
        border-top:1px solid var(--s4u-border);
        background:#fff;
      }

      @media(max-width:900px){
        .s4u-video-browser-grid{
          grid-template-columns:1fr;
        }

        .s4u-video-browser-item{
          grid-template-columns:130px minmax(0,1fr) auto;
        }

        .s4u-video-browser-thumb{
          width:130px;
          height:76px;
        }
      }

      @media(max-width:900px){
        .s4u-video-library-grid{grid-template-columns:repeat(2,minmax(0,1fr));}
        .s4u-video-library-toolbar{align-items:flex-start;flex-direction:column;}
        .s4u-video-library-toolbar-actions{width:100%;}
        .s4u-video-library-toolbar-actions input{flex:1;width:auto;}
      }

      @media(max-width:620px){
        .s4u-video-library-grid{grid-template-columns:1fr;}
        .s4u-video-library-toolbar-actions{align-items:stretch;flex-direction:column;}
        .s4u-video-library-open{justify-content:center;}
      }

      .s4u-modal-field{
        display:grid;
        gap:7px;
      }

      .s4u-modal-field.wide{
        grid-column:1/-1;
      }

      .s4u-modal-field > span{
        color:var(--s4u-text);
        font-size:12px;
        font-weight:800;
      }

      .s4u-modal-field input,
      .s4u-modal-field textarea,
      .s4u-modal-field select{
        width:100%;
        box-sizing:border-box;
        border:1px solid var(--s4u-border);
        border-radius:9px;
        background:#fff;
        color:var(--s4u-text);
        font:inherit;
        font-size:14px;
        outline:none;
      }

      .s4u-modal-field input,
      .s4u-modal-field select{
        height:44px;
        padding:0 12px;
      }

      .s4u-modal-field textarea{
        min-height:110px;
        max-height:320px;
        padding:11px 12px;
        resize:vertical;
      }

      .s4u-editor-modal-body > .s4u-modal-field.wide,
      .s4u-editor-modal-body > .s4u-modal-upload,
      .s4u-editor-modal-body > .s4u-modal-confirm-copy{
        grid-column:1/-1;
      }

      .s4u-modal-field input:focus,
      .s4u-modal-field textarea:focus,
      .s4u-modal-field select:focus{
        border-color:var(--s4u-blue);
        box-shadow:0 0 0 3px rgba(50,90,163,.1);
      }

      .s4u-modal-field small{
        color:var(--s4u-muted);
        font-size:10px;
        line-height:1.4;
      }

      /* ========================================================
         RICH TEXT EDITOR
         ======================================================== */

      .s4u-rich-field{
        grid-column:1/-1;
      }

      .s4u-rich-editor-shell{
        overflow:hidden;
        border:1px solid var(--s4u-border);
        border-radius:12px;
        background:#fff;
        box-shadow:0 1px 2px rgba(23,32,51,.03);
      }

      .s4u-rich-editor-shell:focus-within{
        border-color:var(--s4u-blue);
        box-shadow:0 0 0 3px rgba(50,90,163,.10);
      }

      .s4u-rich-toolbar{
        display:flex;
        align-items:center;
        gap:6px;
        flex-wrap:wrap;
        padding:10px;
        border-bottom:1px solid var(--s4u-border);
        background:#f8fafc;
      }

      .s4u-rich-toolbar button,
      .s4u-rich-toolbar select{
        min-height:34px;
        border:1px solid #cfd9e6;
        border-radius:7px;
        background:#fff;
        color:var(--s4u-text);
        font:inherit;
        font-size:11px;
        font-weight:750;
        outline:none;
      }

      .s4u-rich-toolbar button{
        min-width:34px;
        padding:0 9px;
        cursor:pointer;
      }

      .s4u-rich-toolbar select{
        padding:0 28px 0 9px;
        cursor:pointer;
      }

      .s4u-rich-toolbar button:hover,
      .s4u-rich-toolbar select:hover,
      .s4u-rich-toolbar button:focus-visible,
      .s4u-rich-toolbar select:focus{
        border-color:var(--s4u-blue);
        color:var(--s4u-blue-dark);
      }

      .s4u-rich-toolbar button:hover{
        background:rgba(50,90,163,.08);
      }

      .s4u-rich-divider{
        width:1px;
        height:24px;
        margin:0 2px;
        background:var(--s4u-border);
      }

      .s4u-rich-color{
        position:relative;
        width:36px;
        height:34px;
        display:grid;
        place-items:center;
        overflow:hidden;
        border:1px solid #cfd9e6;
        border-radius:7px;
        background:#fff;
        color:var(--s4u-text);
        font-size:12px;
        font-weight:900;
        cursor:pointer;
      }

      .s4u-rich-color input{
        position:absolute;
        left:4px;
        right:4px;
        bottom:3px;
        width:28px;
        height:5px;
        padding:0;
        border:0;
        cursor:pointer;
      }

      .s4u-rich-link-panel,
      .s4u-rich-button-panel{
        display:grid;
        grid-template-columns:minmax(160px,.8fr) minmax(220px,1.4fr) auto auto auto;
        gap:8px;
        align-items:center;
        padding:9px 10px;
        border-bottom:1px solid var(--s4u-border);
        background:#fff8f2;
      }

      .s4u-rich-button-panel{
        grid-template-columns:minmax(150px,1fr) minmax(220px,1.3fr) auto auto auto auto auto;
        background:#f7faff;
      }

      .s4u-rich-link-panel[hidden],
      .s4u-rich-button-panel[hidden]{
        display:none;
      }

      .s4u-rich-link-selected{
        min-width:0;
        display:grid;
        gap:2px;
      }

      .s4u-rich-link-selected small{
        color:var(--s4u-muted);
        font-size:9px;
        font-weight:800;
        text-transform:uppercase;
        letter-spacing:.05em;
      }

      .s4u-rich-link-selected strong{
        overflow:hidden;
        color:var(--s4u-blue-dark);
        font-size:11px;
        white-space:nowrap;
        text-overflow:ellipsis;
      }

      .s4u-rich-link-panel input,
      .s4u-rich-button-panel input,
      .s4u-rich-button-panel select{
        width:100%;
        min-height:36px;
        padding:0 10px;
        border:1px solid #cfd9e6;
        border-radius:7px;
        background:#fff;
        color:var(--s4u-text);
        font:inherit;
        font-size:12px;
        outline:none;
      }

      .s4u-rich-link-panel input:focus,
      .s4u-rich-button-panel input:focus,
      .s4u-rich-button-panel select:focus{
        border-color:var(--s4u-blue);
        box-shadow:0 0 0 3px rgba(50,90,163,.08);
      }

      .s4u-rich-link-panel button,
      .s4u-rich-button-panel button{
        min-height:36px;
        padding:0 12px;
        border:1px solid var(--s4u-border);
        border-radius:7px;
        background:#fff;
        color:var(--s4u-blue-dark);
        font:inherit;
        font-size:11px;
        font-weight:800;
        cursor:pointer;
      }

      .s4u-rich-link-panel button[data-rich-link-apply],
      .s4u-rich-button-panel button[data-rich-button-apply]{
        border-color:var(--s4u-orange);
        background:var(--s4u-orange);
        color:#fff;
      }

      .s4u-rich-panel-check{
        display:flex;
        align-items:center;
        gap:6px;
        min-height:36px;
        color:var(--s4u-text);
        font-size:10px;
        font-weight:800;
        white-space:nowrap;
      }

      .s4u-rich-panel-check input{
        width:15px;
        height:15px;
        min-height:0;
        padding:0;
        accent-color:var(--s4u-blue);
      }

      .s4u-rich-editor{
        min-height:300px;
        max-height:50vh;
        overflow:auto;
        padding:16px 17px;
        color:var(--s4u-text);
        background:#fff;
        font-size:14px;
        line-height:1.7;
        outline:none;
      }

      .s4u-rich-editor:empty:before{
        content:attr(data-placeholder);
        color:#94a3b8;
        pointer-events:none;
      }

      .s4u-rich-editor p{
        margin:0 0 12px;
      }

      .s4u-rich-editor h2,
      .s4u-rich-editor h3,
      .s4u-rich-editor h4{
        margin:14px 0 8px;
        color:var(--s4u-blue-dark);
        line-height:1.3;
      }

      .s4u-rich-editor h2{
        font-size:22px;
      }

      .s4u-rich-editor h3{
        font-size:18px;
      }

      .s4u-rich-editor h4{
        font-size:15px;
      }

      .s4u-rich-editor ul,
      .s4u-rich-editor ol{
        margin:8px 0 12px;
        padding-left:28px;
      }

      .s4u-rich-editor li{
        margin:4px 0;
      }

      .s4u-rich-editor blockquote{
        margin:12px 0;
        padding:10px 14px;
        border-left:4px solid var(--s4u-orange);
        background:#fff8f2;
        color:#475569;
      }

      .s4u-rich-editor a{
        color:var(--s4u-blue);
        text-decoration:underline;
      }

      .s4u-rich-editor a.s4u-rich-cta{
        display:inline-flex;
        align-items:center;
        justify-content:center;
        margin:6px 4px 6px 0;
        border-radius:9px;
        font-weight:850;
        line-height:1;
        text-decoration:none;
        cursor:pointer;
      }

      .s4u-rich-editor a.s4u-rich-cta[data-s4u-button-size="small"]{
        min-height:34px;
        padding:0 12px;
        font-size:11px;
      }

      .s4u-rich-editor a.s4u-rich-cta[data-s4u-button-size="medium"]{
        min-height:40px;
        padding:0 16px;
        font-size:12px;
      }

      .s4u-rich-editor a.s4u-rich-cta[data-s4u-button-size="large"]{
        min-height:46px;
        padding:0 20px;
        font-size:13px;
      }

      .s4u-rich-editor a.s4u-rich-cta[data-s4u-button-style="primary"]{
        border:1px solid var(--s4u-orange);
        background:var(--s4u-orange);
        color:#fff;
      }

      .s4u-rich-editor a.s4u-rich-cta[data-s4u-button-style="secondary"]{
        border:1px solid var(--s4u-blue);
        background:var(--s4u-blue);
        color:#fff;
      }

      .s4u-rich-editor a.s4u-rich-cta[data-s4u-button-style="outline"]{
        border:1px solid var(--s4u-blue);
        background:#fff;
        color:var(--s4u-blue);
      }

      .s4u-preview-text ul,
      .s4u-preview-text ol{
        margin:8px 0;
        padding-left:24px;
      }

      .s4u-preview-text p{
        margin:0 0 9px;
      }

      .s4u-preview-text h2,
      .s4u-preview-text h3,
      .s4u-preview-text h4{
        margin:8px 0;
        color:var(--s4u-blue-dark);
      }

      .s4u-preview-text blockquote{
        margin:8px 0;
        padding:8px 12px;
        border-left:3px solid var(--s4u-orange);
        background:#fff8f2;
      }

      .s4u-modal-upload{
        grid-column:1/-1;
        min-height:145px;
        display:grid;
        place-items:center;
        align-content:center;
        gap:5px;
        padding:20px;
        border:2px dashed #b9c8db;
        border-radius:13px;
        background:#f9fbfd;
        text-align:center;
        cursor:pointer;
      }

      .s4u-modal-upload:hover{
        border-color:var(--s4u-blue);
        background:rgba(50,90,163,.035);
      }

      .s4u-modal-upload input{
        position:absolute;
        opacity:0;
        pointer-events:none;
      }

      .s4u-modal-upload-icon{
        width:42px;
        height:42px;
        display:grid;
        place-items:center;
        border-radius:12px;
        background:rgba(255,107,0,.1);
        color:var(--s4u-orange);
        font-size:20px;
        font-weight:900;
      }

      .s4u-modal-upload strong{
        color:var(--s4u-blue-dark);
        font-size:13px;
      }

      .s4u-modal-upload small{
        color:var(--s4u-muted);
        font-size:11px;
      }

      .s4u-modal-upload em{
        margin-top:3px;
        color:var(--s4u-blue);
        font-size:11px;
        font-style:normal;
        font-weight:800;
      }

      .s4u-modal-check{
        min-height:64px;
      }

      .s4u-modal-confirm-copy{
        grid-column:1/-1;
        padding:4px 0;
        color:#34435b;
        font-size:14px;
        line-height:1.65;
      }

      .s4u-editor-modal-footer{
        flex:0 0 auto;
        display:flex;
        justify-content:flex-end;
        gap:10px;
        padding:17px 25px 21px;
        border-top:1px solid var(--s4u-border);
        background:#fbfcfe;
      }

      .s4u-editor-modal-secondary,
      .s4u-editor-modal-primary{
        min-height:41px;
        padding:0 17px;
        border-radius:9px;
        font:inherit;
        font-size:13px;
        font-weight:800;
        cursor:pointer;
      }

      .s4u-editor-modal-secondary{
        border:1px solid var(--s4u-border);
        background:#fff;
        color:#37465d;
      }

      .s4u-editor-modal-primary{
        border:1px solid var(--s4u-orange);
        background:var(--s4u-orange);
        color:#fff;
        box-shadow:0 8px 18px rgba(255,107,0,.16);
      }

      .s4u-editor-modal-primary:hover{
        background:var(--s4u-orange-hover);
      }

      .s4u-editor-modal-primary.danger{
        border-color:#b42318;
        background:#b42318;
      }

      @media(max-width:1100px){
        .s4u-editor-toolbar{
          grid-template-columns:repeat(4,minmax(82px,1fr));
        }

        .s4u-editor-toggle-grid{
          grid-template-columns:1fr;
        }

        .s4u-editor-modal-body{
          grid-template-columns:repeat(2,minmax(0,1fr));
        }
      }

      @media(max-width:900px){
        .s4u-rich-link-panel,
        .s4u-rich-button-panel{
          grid-template-columns:1fr;
        }

        .s4u-rich-toolbar select{
          flex:1 1 140px;
        }

        .s4u-rich-editor{
          min-height:260px;
          max-height:46vh;
        }

        .s4u-rich-link-panel{
          grid-template-columns:1fr;
        }
      }

      @media(max-width:700px){
        .s4u-editor-settings-grid,
        .s4u-editor-modal-body{
          grid-template-columns:1fr;
        }

        .s4u-editor-settings-grid label.wide,
        .s4u-modal-field.wide,
        .s4u-modal-upload,
        .s4u-modal-confirm-copy{
          grid-column:auto;
        }

        .s4u-editor-toolbar{
          grid-template-columns:repeat(2,minmax(82px,1fr));
        }

        #s4uEditorModal{
          padding:10px;
        }

        .s4u-editor-modal-card{
          width:calc(100vw - 20px);
          max-height:calc(100vh - 20px);
        }

        .s4u-editor-modal-body{
          grid-template-columns:1fr;
        }

        .s4u-editor-modal-footer{
          flex-direction:column-reverse;
        }

        .s4u-editor-modal-secondary,
        .s4u-editor-modal-primary{
          width:100%;
        }
      }

      /* ==========================================================
         QUIZ LIBRARY PICKER
         ========================================================== */

      .s4u-quiz-library-field{
        display:grid;
        gap:12px;
        grid-column:1/-1;
      }

      .s4u-quiz-library-toolbar{
        display:flex;
        align-items:flex-end;
        justify-content:space-between;
        gap:14px;
      }

      .s4u-quiz-library-toolbar > div{
        min-width:0;
      }

      .s4u-quiz-library-toolbar strong,
      .s4u-quiz-library-toolbar small{
        display:block;
      }

      .s4u-quiz-library-toolbar strong{
        color:var(--s4u-blue-dark);
        font-size:13px;
        font-weight:900;
      }

      .s4u-quiz-library-toolbar small{
        margin-top:3px;
        color:var(--s4u-muted);
        font-size:11px;
      }

      .s4u-quiz-library-toolbar input{
        width:min(260px,100%);
        height:40px;
        padding:0 11px;
        border:1px solid var(--s4u-border);
        border-radius:9px;
        background:#fff;
        color:var(--s4u-text);
        font:inherit;
        font-size:12px;
        outline:none;
      }

      .s4u-quiz-library-toolbar input:focus{
        border-color:var(--s4u-blue);
        box-shadow:0 0 0 3px rgba(50,90,163,.09);
      }

      .s4u-quiz-library-status{
        color:var(--s4u-muted);
        font-size:11px;
        font-weight:700;
      }

      .s4u-quiz-library-grid{
        display:grid;
        gap:9px;
        max-height:360px;
        overflow:auto;
        padding:2px;
      }

      .s4u-quiz-library-card{
        width:100%;
        display:grid;
        grid-template-columns:42px minmax(0,1fr) auto;
        gap:12px;
        align-items:center;
        padding:12px;
        border:1px solid var(--s4u-border);
        border-radius:11px;
        background:#fff;
        color:var(--s4u-text);
        font:inherit;
        text-align:left;
        cursor:pointer;
        transition:.16s ease;
      }

      .s4u-quiz-library-card:hover{
        border-color:#b7c9e0;
        background:#fbfdff;
        transform:translateY(-1px);
      }

      .s4u-quiz-library-card.selected{
        border-color:var(--s4u-orange);
        background:#fffaf6;
        box-shadow:0 0 0 2px rgba(255,107,0,.08);
      }

      .s4u-quiz-library-icon{
        width:42px;
        height:42px;
        display:grid;
        place-items:center;
        border-radius:10px;
        background:#eef3fb;
        color:var(--s4u-blue);
        font-size:18px;
        font-weight:900;
      }

      .s4u-quiz-library-copy{
        min-width:0;
      }

      .s4u-quiz-library-copy strong,
      .s4u-quiz-library-copy small,
      .s4u-quiz-library-copy em{
        display:block;
      }

      .s4u-quiz-library-copy strong{
        overflow:hidden;
        color:var(--s4u-blue-dark);
        font-size:12px;
        font-weight:900;
        white-space:nowrap;
        text-overflow:ellipsis;
      }

      .s4u-quiz-library-copy small{
        margin-top:4px;
        overflow:hidden;
        color:var(--s4u-muted);
        font-size:10px;
        white-space:nowrap;
        text-overflow:ellipsis;
      }

      .s4u-quiz-library-copy em{
        margin-top:5px;
        color:#7b8798;
        font-size:10px;
        font-style:normal;
      }

      .s4u-quiz-library-side{
        display:grid;
        justify-items:end;
        gap:6px;
      }

      .s4u-quiz-library-side small{
        color:var(--s4u-muted);
        font-size:9px;
        font-weight:800;
        text-transform:uppercase;
        letter-spacing:.04em;
      }

      .s4u-quiz-library-side b{
        width:26px;
        height:26px;
        display:grid;
        place-items:center;
        border-radius:50%;
        background:#eef3fb;
        color:var(--s4u-blue);
        font-size:13px;
      }

      .s4u-quiz-library-card.selected .s4u-quiz-library-side b{
        background:var(--s4u-orange);
        color:#fff;
      }

      .s4u-quiz-library-empty{
        padding:28px 16px;
        border:1px dashed var(--s4u-border);
        border-radius:10px;
        color:var(--s4u-muted);
        font-size:12px;
        text-align:center;
      }

      @media(max-width:700px){
        .s4u-quiz-library-toolbar{
          align-items:stretch;
          flex-direction:column;
        }

        .s4u-quiz-library-toolbar input{
          width:100%;
        }

        .s4u-quiz-library-card{
          grid-template-columns:38px minmax(0,1fr);
        }

        .s4u-quiz-library-side{
          grid-column:1/-1;
          display:flex;
          align-items:center;
          justify-content:flex-end;
        }
      }

    `;

    document.head.appendChild(style);
  }

  /* ============================================================
     HELPERS
     ============================================================ */

  const VALID_BLOCK_TYPES = new Set([
    "heading",
    "text",
    "video",
    "audio",
    "image",
    "pdf",
    "download",
    "link",
    "embed",
    "quiz",
    "knowledge_check",
    "form",
    "divider"
  ]);

  function normalizeInsertKind(value) {
    const type = String(value || "").toLowerCase();

    const aliases = {
      paragraph: "text",
      file: "download",
      assessment: "knowledge_check"
    };

    return aliases[type] || type;
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

  function blockIcon(type) {
    return {
      heading: "H",
      text: "¶",
      video: "▶",
      audio: "♪",
      image: "▧",
      pdf: "PDF",
      download: "⇩",
      link: "↗",
      embed: "</>",
      quiz: "?",
      knowledge_check: "✓",
      form: "▤",
      divider: "—"
    }[type] || "•";
  }

  async function currentSession() {
    const { data, error } = await state.client.auth.getSession();

    if (error) throw error;
    if (!data?.session?.user) throw new Error("Authentication required.");

    return data.session;
  }

  function goBackToCourse() {
    location.href = getCourseBuilderUrl();
  }

  function getCourseBuilderUrl() {
    return state.courseId
      ? `admin-lms-course-builder.html?course=${encodeURIComponent(state.courseId)}`
      : "admin-lms-course-builder.html";
  }

  function toast(message, type) {
    const node = $("lessonEditorToast");

    if (!node) {
      console[type === "error" ? "error" : "log"](message);
      return;
    }

    node.textContent = message;
    node.className =
      `lesson-editor-toast show ${type || "success"}`;

    clearTimeout(toast.timer);

    toast.timer = setTimeout(() => {
      node.classList.remove("show");
    }, 3200);
  }

  function formatBasicText(value) {
    const input =
      String(value || "");

    if (/<[a-z][\s\S]*>/i.test(input)) {
      return sanitizeRichHtml(input);
    }

    return legacyTextToHtml(input);
  }

  function setText(id, value) {
    const node = $(id);
    if (node) node.textContent = value ?? "";
  }

  function setValue(id, value) {
    const node = $(id);
    if (node) node.value = value ?? "";
  }

  function setChecked(id, value) {
    const node = $(id);
    if (node) node.checked = Boolean(value);
  }

  function integerOrNull(value) {
    if (value === "" || value == null) return null;

    const number = Number(value);

    return Number.isFinite(number) && number >= 0
      ? Math.round(number)
      : null;
  }

  function quizAttemptLimit(value) {
    /*
     * Quiz semantics:
     *   blank / null / 0 = unlimited -> database NULL
     *   1+              = limited attempts
     *
     * Do not reuse integerOrNull() here because that helper
     * intentionally considers zero a valid numeric value.
     */
    if (value === "" || value == null) return null;

    const number = Number(value);

    if (!Number.isFinite(number)) return null;

    const attempts = Math.round(number);

    return attempts >= 1 ? attempts : null;
  }


  function integerOrZero(value) {
    return integerOrNull(value) || 0;
  }

  function clampNumber(value, min, max, fallback) {
    const number = Number(value);

    if (!Number.isFinite(number)) return fallback;

    return Math.max(min, Math.min(max, number));
  }

  function isReasonableUrl(value) {
    try {
      const url = new URL(value);
      return ["http:", "https:"].includes(url.protocol);
    } catch (_) {
      return false;
    }
  }

  function sanitizeFilename(value) {
    const name = String(value || "file")
      .trim()
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/-+/g, "-");

    return name || "file";
  }

  function isUuid(value) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      .test(String(value || ""));
  }

  function uniqueToken() {
    if (window.crypto?.randomUUID) {
      return window.crypto.randomUUID();
    }

    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  function cssEscape(value) {
    if (window.CSS?.escape) return window.CSS.escape(String(value));
    return String(value).replace(/["\\]/g, "\\$&");
  }

  function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    }[character]));
  }
})();
