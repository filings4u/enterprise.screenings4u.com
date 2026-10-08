/* ============================================================
   SCREENINGS4U — ADMIN LMS VIDEO LIBRARY

   One reusable LMS video library for:
   - Uploaded video files
   - Cloudflare Stream videos
   - YouTube videos
   - External / website videos

   Source of truth:
   public.lms_media where media_type = 'video'
   ============================================================ */

(function () {
  "use strict";

  const TABLES = Object.freeze({
    media: "lms_media",
    courses: "lms_courses",
    sections: "lms_sections",
    lessons: "lms_lessons",
    blocks: "lms_content_blocks"
  });

  const STORAGE_BUCKET = "lms-media";
  const MAX_UPLOAD_BYTES = 500 * 1024 * 1024;

  const state = {
    client: null,
    videos: [],
    selectedVideo: null,
    deleteVideo: null,
    categoryVideo: null,
    uploadFile: null,
    courses: [],
    addSource: "upload",
    filters: {
      search: "",
      provider: "all",
      status: "all",
      category: "all"
    }
  };

  const $ = (id) =>
    document.getElementById(id);

  document.addEventListener(
    "DOMContentLoaded",
    init
  );


  /* ============================================================
     INITIALIZE
     ============================================================ */

  function assertRequiredElements() {
    const required = [
      "videoLibraryAdd",
      "videoLibrarySearch",
      "videoLibraryProvider",
      "videoLibraryStatus",
      "videoLibraryRefresh",
      "videoLibraryCategoryTabs",
      "videoLibraryGrid",
      "videoAddModal",
      "videoAddCategory",
      "videoAddConfirm",
      "videoAddFile",
      "videoAddYouTubeUrl",
      "videoAddExternalUrl",
      "videoDeleteModal",
      "videoDeleteConfirm",
      "videoCategoryModal",
      "videoCategoryName",
      "videoCategoryConfirm"
    ];

    const missing =
      required.filter(
        (id) => !document.getElementById(id)
      );

    if (missing.length) {
      throw new Error(
        "Video Library HTML/JS mismatch. Missing: " +
        missing.join(", ")
      );
    }
  }


  async function init() {
    try {
      assertRequiredElements();
      bind();

      console.info("[Video Library] UI controls wired.");

      state.client =
        await waitForClient();

      await Promise.all([
        loadVideos(),
        loadCourses()
      ]);

    } catch (error) {
      console.error(
        "[Video Library]",
        error
      );

      toast(
        error?.message ||
        "Unable to load video library.",
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
      Date.now() - started < timeout
    ) {
      const client =
        await resolveClient();

      if (
        client?.from &&
        client?.storage
      ) {
        return client;
      }

      await delay(75);
    }

    throw new Error(
      "Supabase client is unavailable."
    );
  }


  async function resolveClient() {
    try {
      if (
        typeof window
          .getScreenings4uSupabase ===
        "function"
      ) {
        const client =
          await window
            .getScreenings4uSupabase();

        if (client?.from) {
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


  /* ============================================================
     LOAD LIBRARY
     ============================================================ */

  async function loadVideos() {
    setLoading(true);

    try {
      const {
        data,
        error
      } = await state.client
        .from(TABLES.media)
        .select("*")
        .eq(
          "media_type",
          "video"
        )
        .order(
          "created_at",
          {
            ascending: false
          }
        );

      if (error) {
        throw error;
      }

      state.videos =
        data || [];

      renderMetrics();
      renderCategoryTabs();
      populateCategoryOptions();
      renderVideos();

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
        "id,title,status,updated_at"
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


  /* ============================================================
     METRICS / FILTERS
     ============================================================ */

  function renderMetrics() {
    const total =
      state.videos.length;

    const ready =
      state.videos.filter(
        (video) =>
          normalize(
            video.provider_status
          ) === "ready"
      ).length;

    const cloudflare =
      state.videos.filter(
        (video) =>
          video.provider ===
          "cloudflare_stream"
      ).length;

    const seconds =
      state.videos.reduce(
        (sum, video) =>
          sum +
          (
            Number(
              video.duration_seconds
            ) || 0
          ),
        0
      );

    set(
      "videoMetricTotal",
      total
    );

    set(
      "videoMetricReady",
      ready
    );

    set(
      "videoMetricCloudflare",
      cloudflare
    );

    set(
      "videoMetricRuntime",
      formatRuntime(seconds)
    );
  }


  function filteredVideos() {
    const query =
      state.filters.search
        .trim()
        .toLowerCase();

    return state.videos.filter(
      (video) => {

        if (query) {
          const haystack = [
            video.title,
            video.original_filename,
            video.description,
            video.provider_video_id,
            video.playback_url,
            video.provider
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

          if (
            !haystack.includes(
              query
            )
          ) {
            return false;
          }
        }

        if (
          state.filters.provider !==
          "all"
        ) {
          if (
            state.filters.provider ===
            "other"
          ) {
            if (
              [
                "cloudflare_stream",
                "supabase_storage",
                "youtube",
                "external"
              ].includes(
                video.provider
              )
            ) {
              return false;
            }

          } else if (
            video.provider !==
            state.filters.provider
          ) {
            return false;
          }
        }

        if (
          state.filters.status !==
          "all"
        ) {
          const status =
            normalize(
              video.provider_status
            );

          if (
            state.filters.status ===
            "processing"
          ) {
            if (status === "ready") {
              return false;
            }

          } else if (
            status !==
            state.filters.status
          ) {
            return false;
          }
        }

        if (
          state.filters.category !==
          "all"
        ) {
          const category =
            normalizeCategory(
              getVideoCategory(
                video
              )
            );

          if (
            category !==
            state.filters.category
          ) {
            return false;
          }
        }

        return true;
      }
    );
  }


  /* ============================================================
     CATEGORIES
     ============================================================ */

  function getVideoCategory(video) {
    return cleanCategoryName(
      video?.metadata?.category ||
      "Uncategorized"
    );
  }


  function cleanCategoryName(value) {
    const cleaned =
      String(value || "")
        .trim()
        .replace(/\s+/g, " ")
        .slice(0, 80);

    return cleaned ||
      "Uncategorized";
  }


  function normalizeCategory(value) {
    return cleanCategoryName(value)
      .toLowerCase();
  }


  function getCategoryNames() {
    const map =
      new Map();

    state.videos
      .forEach((video) => {
        const category =
          getVideoCategory(video);

        map.set(
          normalizeCategory(category),
          category
        );
      });

    const names =
      Array.from(
        map.values()
      )
        .filter(
          (name) =>
            normalizeCategory(name) !==
            "uncategorized"
        )
        .sort(
          (a, b) =>
            a.localeCompare(b)
        );

    if (
      state.videos.some(
        (video) =>
          normalizeCategory(
            getVideoCategory(video)
          ) === "uncategorized"
      )
    ) {
      names.push(
        "Uncategorized"
      );
    }

    return names;
  }


  function countVideosInCategory(category) {
    const normalized =
      normalizeCategory(category);

    return state.videos
      .filter(
        (video) =>
          normalizeCategory(
            getVideoCategory(video)
          ) === normalized
      )
      .length;
  }


  function renderCategoryTabs() {
    const container =
      $("videoLibraryCategoryTabs");

    if (!container) {
      return;
    }

    const categories =
      getCategoryNames();

    container.innerHTML = `
      <button
        type="button"
        class="video-category-tab ${state.filters.category === "all" ? "active" : ""}"
        data-video-category="all"
      >
        <span>All Videos</span>
        <strong>${state.videos.length}</strong>
      </button>

      ${categories.map((category) => {
        const normalized =
          normalizeCategory(category);

        return `
          <button
            type="button"
            class="video-category-tab ${state.filters.category === normalized ? "active" : ""}"
            data-video-category="${esc(normalized)}"
          >
            <span>${esc(category)}</span>
            <strong>${countVideosInCategory(category)}</strong>
          </button>
        `;
      }).join("")}
    `;

    container
      .querySelectorAll(
        "[data-video-category]"
      )
      .forEach(
        (button) => {
          button.addEventListener(
            "click",
            () => {
              state.filters.category =
                button.dataset
                  .videoCategory ||
                "all";

              renderCategoryTabs();
              renderVideos();
            }
          );
        }
      );
  }


  function populateCategoryOptions() {
    const list =
      $("videoCategoryOptions");

    if (!list) {
      return;
    }

    list.innerHTML =
      getCategoryNames()
        .filter(
          (category) =>
            normalizeCategory(category) !==
            "uncategorized"
        )
        .map(
          (category) =>
            `<option value="${esc(category)}"></option>`
        )
        .join("");
  }


  function openCategoryModal(id) {
    const video =
      state.videos.find(
        (row) =>
          row.id === id
      );

    if (!video) {
      return;
    }

    state.categoryVideo =
      video;

    set(
      "videoCategoryVideoName",
      video.title ||
      video.original_filename ||
      "Video"
    );

    $("videoCategoryName").value =
      normalizeCategory(
        getVideoCategory(video)
      ) === "uncategorized"
        ? ""
        : getVideoCategory(video);

    populateCategoryOptions();

    const modal =
      $("videoCategoryModal");

    if (!modal) {
      return;
    }

    modal.hidden =
      false;

    document.body.style.overflow =
      "hidden";

    setTimeout(
      () =>
        $("videoCategoryName")
          ?.focus(),
      0
    );
  }


  function closeCategoryModal() {
    const modal =
      $("videoCategoryModal");

    if (
      !modal ||
      modal.hidden
    ) {
      return;
    }

    modal.hidden =
      true;

    state.categoryVideo =
      null;

    restoreScroll();
  }


  async function saveVideoCategory() {
    const video =
      state.categoryVideo;

    if (!video?.id) {
      return;
    }

    const raw =
      $("videoCategoryName")
        ?.value ||
      "";

    const category =
      cleanCategoryName(
        raw
      );

    const metadata = {
      ...(video.metadata || {}),
      category
    };

    const button =
      $("videoCategoryConfirm");

    if (button) {
      button.disabled =
        true;

      button.textContent =
        "Saving...";
    }

    try {
      const {
        error
      } = await state.client
        .from(TABLES.media)
        .update({
          metadata,
          updated_at:
            new Date()
              .toISOString()
        })
        .eq(
          "id",
          video.id
        );

      if (error) {
        throw error;
      }

      closeCategoryModal();

      await loadVideos();

      toast(
        category === "Uncategorized"
          ? "Video moved to Uncategorized."
          : `Video moved to ${category}.`,
        "success"
      );

    } catch (error) {
      console.error(
        "[Video Category]",
        error
      );

      toast(
        error?.message ||
        "Unable to update video category.",
        "error"
      );

    } finally {
      if (button) {
        button.disabled =
          false;

        button.textContent =
          "Save Category";
      }
    }
  }


  /* ============================================================
     VIDEO CARDS
     ============================================================ */

  function renderVideos() {
    const grid =
      $("videoLibraryGrid");

    const empty =
      $("videoLibraryEmpty");

    const rows =
      filteredVideos();

    set(
      "videoLibraryCount",
      `${rows.length} of ${state.videos.length} videos`
    );

    if (
      !grid ||
      !empty
    ) {
      return;
    }

    if (!rows.length) {
      grid.hidden =
        true;

      grid.innerHTML =
        "";

      empty.hidden =
        false;

      return;
    }

    empty.hidden =
      true;

    grid.hidden =
      false;

    grid.innerHTML =
      rows
        .map(videoCard)
        .join("");

    grid
      .querySelectorAll(
        "[data-preview-video]"
      )
      .forEach(
        (button) => {
          button.addEventListener(
            "click",
            () =>
              openPreview(
                button.dataset
                  .previewVideo
              )
          );
        }
      );

    grid
      .querySelectorAll(
        "[data-use-video]"
      )
      .forEach(
        (button) => {
          button.addEventListener(
            "click",
            () =>
              openUseModal(
                button.dataset
                  .useVideo
              )
          );
        }
      );

    grid
      .querySelectorAll(
        "[data-categorize-video]"
      )
      .forEach(
        (button) => {
          button.addEventListener(
            "click",
            () =>
              openCategoryModal(
                button.dataset
                  .categorizeVideo
              )
          );
        }
      );

    grid
      .querySelectorAll(
        "[data-delete-video]"
      )
      .forEach(
        (button) => {
          button.addEventListener(
            "click",
            () =>
              openDeleteModal(
                button.dataset
                  .deleteVideo
              )
          );
        }
      );
  }


  function videoCard(video) {
    const title =
      video.title ||
      video.original_filename ||
      "Untitled Video";

    const status =
      normalize(
        video.provider_status
      ) ||
      "unknown";

    const thumbnail =
      isUrl(
        video.thumbnail_url
      )
        ? `
          <img
            src="${esc(video.thumbnail_url)}"
            alt=""
          >
        `
        : `
          <div class="video-card-placeholder">
            ▶
          </div>
        `;

    return `
      <article class="video-card">

        <div class="video-card-thumb">
          ${thumbnail}

          <span
            class="video-card-status ${status === "ready" ? "ready" : ""}"
          >
            ${esc(titleCase(status))}
          </span>
        </div>

        <div class="video-card-body">

          <h3 title="${esc(title)}">
            ${esc(title)}
          </h3>

          <div class="video-card-category">
            ${esc(getVideoCategory(video))}
          </div>

          <div class="video-card-meta">
            <span>
              ${esc(formatDuration(video.duration_seconds))}
            </span>

            <span>
              ${esc(providerLabel(video.provider))}
            </span>

            <span>
              ${esc(formatDate(video.created_at))}
            </span>
          </div>

          <div
            class="video-card-id"
            title="${esc(video.provider_video_id || video.playback_url || video.id || "")}"
          >
            ${esc(video.provider_video_id || video.playback_url || video.id || "")}
          </div>

          <div class="video-card-actions">

            <button
              type="button"
              data-preview-video="${esc(video.id)}"
            >
              Preview
            </button>

            <button
              type="button"
              class="use-video"
              data-use-video="${esc(video.id)}"
            >
              Use in Course
            </button>

            <button
              type="button"
              class="organize-video"
              data-categorize-video="${esc(video.id)}"
            >
              Organize
            </button>

            <button
              type="button"
              class="delete-video"
              data-delete-video="${esc(video.id)}"
            >
              Delete
            </button>

          </div>
        </div>
      </article>
    `;
  }


  /* ============================================================
     ADD VIDEO MODAL
     ============================================================ */

  function openAddModal() {
    const modal =
      $("videoAddModal");

    if (!modal) {
      return;
    }

    state.uploadFile =
      null;

    $("videoAddFile").value =
      "";

    $("videoAddYouTubeUrl").value =
      "";

    $("videoAddExternalUrl").value =
      "";

    $("videoAddDisplayTitle").value =
      "";

    $("videoAddDuration").value =
      "";

    $("videoAddThumbnail").value =
      "";

    $("videoAddDescription").value =
      "";

    $("videoAddCategory").value =
      "";

    populateCategoryOptions();

    set(
      "videoAddFileName",
      "No file selected"
    );

    set(
      "videoAddProgressText",
      ""
    );

    const progress =
      $("videoAddProgress");

    if (progress) {
      progress.hidden =
        true;

      progress.value =
        0;
    }

    setAddSource(
      "upload"
    );

    modal.hidden =
      false;

    document.body.style.overflow =
      "hidden";
  }


  function closeAddModal() {
    const modal =
      $("videoAddModal");

    if (
      !modal ||
      modal.hidden
    ) {
      return;
    }

    modal.hidden =
      true;

    state.uploadFile =
      null;

    restoreScroll();
  }


  function setAddSource(
    source
  ) {
    const allowed =
      [
        "upload",
        "youtube",
        "external"
      ];

    state.addSource =
      allowed.includes(source)
        ? source
        : "upload";

    const sourceInput =
      $("videoAddSource");

    if (sourceInput) {
      sourceInput.value =
        state.addSource;
    }

    document
      .querySelectorAll(
        "[data-video-source-tab]"
      )
      .forEach(
        (button) => {
          const active =
            button.dataset
              .videoSourceTab ===
            state.addSource;

          button.classList.toggle(
            "active",
            active
          );

          button.setAttribute(
            "aria-selected",
            active
              ? "true"
              : "false"
          );
        }
      );

    document
      .querySelectorAll(
        "[data-video-source-panel]"
      )
      .forEach(
        (panel) => {
          panel.hidden =
            panel.dataset
              .videoSourcePanel !==
            state.addSource;
        }
      );
  }


  function handleUploadFile(
    file
  ) {
    state.uploadFile =
      file || null;

    set(
      "videoAddFileName",
      file
        ? `${file.name} · ${formatBytes(file.size)}`
        : "No file selected"
    );

    const title =
      $("videoAddDisplayTitle");

    if (
      file &&
      title &&
      !title.value.trim()
    ) {
      title.value =
        file.name
          .replace(
            /\.[^.]+$/,
            ""
          );
    }
  }


  async function addVideo() {
    const source =
      state.addSource;

    const title =
      $("videoAddDisplayTitle")
        ?.value
        .trim() ||
      "";

    const description =
      $("videoAddDescription")
        ?.value
        .trim() ||
      null;

    const durationRaw =
      Number(
        $("videoAddDuration")
          ?.value ||
        0
      );

    const duration =
      Number.isFinite(
        durationRaw
      ) &&
      durationRaw > 0
        ? Math.round(
            durationRaw
          )
        : null;

    const thumbnail =
      $("videoAddThumbnail")
        ?.value
        .trim() ||
      null;

    const category =
      cleanCategoryName(
        $("videoAddCategory")
          ?.value ||
        ""
      );

    const button =
      $("videoAddConfirm");

    const progress =
      $("videoAddProgress");

    if (button) {
      button.disabled =
        true;

      button.textContent =
        source === "upload"
          ? "Uploading..."
          : "Saving...";
    }

    try {

      if (
        source ===
        "upload"
      ) {
        await addUploadedVideo({
          title,
          description,
          duration,
          thumbnail,
          category,
          progress
        });

      } else if (
        source ===
        "youtube"
      ) {
        await addYouTubeVideo({
          title,
          description,
          duration,
          thumbnail,
          category
        });

      } else {
        await addExternalVideo({
          title,
          description,
          duration,
          thumbnail,
          category
        });
      }

      closeAddModal();

      await loadVideos();

      toast(
        "Video added to the library.",
        "success"
      );

    } catch (error) {
      console.error(
        "[Add Video]",
        error
      );

      toast(
        error?.message ||
        "Unable to add video.",
        "error"
      );

    } finally {
      if (button) {
        button.disabled =
          false;

        button.textContent =
          "Add Video";
      }
    }
  }


  async function addUploadedVideo({
    title,
    description,
    duration,
    thumbnail,
    category,
    progress
  }) {
    const file =
      state.uploadFile ||
      $("videoAddFile")
        ?.files?.[0] ||
      null;

    if (!file) {
      throw new Error(
        "Choose a video file first."
      );
    }

    const allowedMimeTypes =
      [
        "video/mp4",
        "video/webm",
        "video/quicktime"
      ];

    if (
      file.type &&
      !allowedMimeTypes.includes(
        file.type
      )
    ) {
      throw new Error(
        "Use an MP4, WebM, or MOV video file."
      );
    }

    if (
      file.size >
      MAX_UPLOAD_BYTES
    ) {
      throw new Error(
        "Video files must be 500 MB or smaller."
      );
    }

    const {
      data: sessionData,
      error: sessionError
    } = await state.client
      .auth
      .getSession();

    if (sessionError) {
      throw sessionError;
    }

    const userId =
      sessionData
        ?.session
        ?.user
        ?.id ||
      null;

    const extension =
      safeFileExtension(
        file.name
      );

    const safeName =
      safeStorageName(
        file.name
      );

    const storagePath =
      `videos/${new Date().getFullYear()}/` +
      `${crypto.randomUUID()}-${safeName}.${extension}`;

    if (progress) {
      progress.hidden =
        false;

      progress.value =
        20;
    }

    set(
      "videoAddProgressText",
      "Uploading video file..."
    );

    const {
      error: uploadError
    } = await state.client
      .storage
      .from(
        STORAGE_BUCKET
      )
      .upload(
        storagePath,
        file,
        {
          cacheControl:
            "3600",
          upsert:
            false,
          contentType:
            file.type ||
            "video/mp4"
        }
      );

    if (uploadError) {
      throw uploadError;
    }

    if (progress) {
      progress.value =
        75;
    }

    set(
      "videoAddProgressText",
      "Saving library record..."
    );

    try {
      const {
        error: insertError
      } = await state.client
        .from(TABLES.media)
        .insert({
          uploaded_by:
            userId,

          media_type:
            "video",

          original_filename:
            file.name,

          storage_bucket:
            STORAGE_BUCKET,

          storage_path:
            storagePath,

          mime_type:
            file.type ||
            "video/mp4",

          file_size_bytes:
            file.size,

          duration_seconds:
            duration,

          title:
            title ||
            file.name.replace(
              /\.[^.]+$/,
              ""
            ),

          description,

          metadata: {
            source:
              "physical_upload",
            uploaded_from:
              "admin-lms-video.html",
            category
          },

          provider:
            "supabase_storage",

          provider_video_id:
            null,

          provider_status:
            "ready",

          playback_url:
            null,

          thumbnail_url:
            thumbnail
        });

      if (insertError) {
        throw insertError;
      }

    } catch (error) {
      try {
        await state.client
          .storage
          .from(
            STORAGE_BUCKET
          )
          .remove([
            storagePath
          ]);
      } catch (_) {}

      throw error;
    }

    if (progress) {
      progress.value =
        100;
    }

    set(
      "videoAddProgressText",
      "Upload complete."
    );
  }


  async function addYouTubeVideo({
    title,
    description,
    duration,
    thumbnail,
    category
  }) {
    const rawUrl =
      $("videoAddYouTubeUrl")
        ?.value
        .trim() ||
      "";

    const videoId =
      extractYouTubeId(
        rawUrl
      );

    if (!videoId) {
      throw new Error(
        "Enter a valid YouTube video URL."
      );
    }

    const watchUrl =
      `https://www.youtube.com/watch?v=${videoId}`;

    const embedUrl =
      `https://www.youtube.com/embed/${videoId}`;

    const thumbnailUrl =
      thumbnail ||
      `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

    const {
      data: sessionData
    } = await state.client
      .auth
      .getSession();

    const {
      error
    } = await state.client
      .from(TABLES.media)
      .insert({
        uploaded_by:
          sessionData
            ?.session
            ?.user
            ?.id ||
          null,

        media_type:
          "video",

        original_filename:
          title ||
          `YouTube ${videoId}`,

        storage_bucket:
          STORAGE_BUCKET,

        storage_path:
          `youtube/${videoId}`,

        mime_type:
          "text/html",

        file_size_bytes:
          null,

        duration_seconds:
          duration,

        title:
          title ||
          "YouTube Video",

        description,

        metadata: {
          source:
            "youtube",
          original_url:
            watchUrl,
          embed_url:
            embedUrl,
          category
        },

        provider:
          "youtube",

        provider_video_id:
          videoId,

        provider_status:
          "ready",

        playback_url:
          embedUrl,

        thumbnail_url:
          thumbnailUrl
      });

    if (error) {
      throw error;
    }
  }


  async function addExternalVideo({
    title,
    description,
    duration,
    thumbnail,
    category
  }) {
    const url =
      $("videoAddExternalUrl")
        ?.value
        .trim() ||
      "";

    if (
      !isUrl(url)
    ) {
      throw new Error(
        "Enter a valid external video or website URL."
      );
    }

    const {
      data: sessionData
    } = await state.client
      .auth
      .getSession();

    const reference =
      crypto.randomUUID();

    let hostname =
      "External Video";

    try {
      hostname =
        new URL(url)
          .hostname
          .replace(
            /^www\./i,
            ""
          );
    } catch (_) {}

    const {
      error
    } = await state.client
      .from(TABLES.media)
      .insert({
        uploaded_by:
          sessionData
            ?.session
            ?.user
            ?.id ||
          null,

        media_type:
          "video",

        original_filename:
          title ||
          hostname,

        storage_bucket:
          STORAGE_BUCKET,

        storage_path:
          `external/${reference}`,

        mime_type:
          "text/html",

        file_size_bytes:
          null,

        duration_seconds:
          duration,

        title:
          title ||
          hostname,

        description,

        metadata: {
          source:
            "external_url",
          original_url:
            url,
          category
        },

        provider:
          "external",

        provider_video_id:
          reference,

        provider_status:
          "ready",

        playback_url:
          url,

        thumbnail_url:
          thumbnail
      });

    if (error) {
      throw error;
    }
  }


  /* ============================================================
     PREVIEW
     ============================================================ */

  async function openPreview(
    id
  ) {
    const video =
      state.videos.find(
        (row) =>
          row.id === id
      );

    if (!video) {
      return;
    }

    const modal =
      $("videoPreviewModal");

    const body =
      $("videoPreviewBody");

    if (
      !modal ||
      !body
    ) {
      return;
    }

    set(
      "videoPreviewTitle",
      video.title ||
      video.original_filename ||
      "Video Preview"
    );

    set(
      "videoPreviewMeta",
      `${providerLabel(video.provider)} · ` +
      `${formatDuration(video.duration_seconds)} · ` +
      `${titleCase(normalize(video.provider_status) || "unknown")}`
    );

    body.innerHTML =
      `
        <div class="video-preview-frame">
          <div class="video-preview-fallback">
            Loading preview...
          </div>
        </div>
      `;

    modal.hidden =
      false;

    document.body.style.overflow =
      "hidden";

    try {
      const source =
        await getPreviewSource(
          video
        );

      body.innerHTML =
        renderPreview(
          video,
          source
        );

    } catch (error) {
      console.error(
        "[Video Preview]",
        error
      );

      body.innerHTML =
        `
          <div class="video-preview-frame">
            <div class="video-preview-fallback">
              Preview could not be loaded.
            </div>
          </div>
        `;
    }
  }


  async function getPreviewSource(
    video
  ) {
    if (
      video.provider ===
      "supabase_storage" &&
      video.storage_bucket &&
      video.storage_path
    ) {
      const {
        data,
        error
      } = await state.client
        .storage
        .from(
          video.storage_bucket
        )
        .createSignedUrl(
          video.storage_path,
          60 * 60
        );

      if (error) {
        throw error;
      }

      return data
        ?.signedUrl ||
        null;
    }

    return video.playback_url ||
      video.metadata
        ?.original_url ||
      null;
  }


  function renderPreview(
    video,
    source
  ) {
    if (
      video.provider ===
      "youtube"
    ) {
      const videoId =
        video.provider_video_id ||
        extractYouTubeId(
          source
        );

      if (!videoId) {
        return previewFallback(
          "YouTube video ID is unavailable."
        );
      }

      return `
        <div class="video-preview-frame">
          <iframe
            src="https://www.youtube.com/embed/${esc(videoId)}"
            title="${esc(video.title || "YouTube video")}"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowfullscreen
          ></iframe>
        </div>
      `;
    }

    if (video.provider === "cloudflare_stream") {
      const uid = String(video.provider_video_id || "").trim();
      if (!uid) {
        return previewFallback("Cloudflare Stream video ID is unavailable.");
      }
      return `
        <div class="video-preview-frame">
          <iframe
            src="https://customer-dakmi8r1pa369sua.cloudflarestream.com/${esc(uid)}/iframe"
            title="${esc(video.title || "Cloudflare Stream video")}"
            allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
            allowfullscreen
          ></iframe>
        </div>
      `;
    }

    if (
      video.provider ===
      "external"
    ) {
      if (
        isDirectVideoUrl(
          source
        )
      ) {
        return `
          <div class="video-preview-frame">
            <video
              controls
              preload="metadata"
              poster="${esc(video.thumbnail_url || "")}"
            >
              <source src="${esc(source)}">
            </video>
          </div>
        `;
      }

      if (
        isUrl(source)
      ) {
        return `
          <div class="video-preview-frame">
            <iframe
              src="${esc(source)}"
              title="${esc(video.title || "External video")}"
              allow="autoplay; fullscreen; picture-in-picture"
              allowfullscreen
            ></iframe>
          </div>

          <div class="video-preview-link">
            If this website blocks embedded playback,
            <a
              href="${esc(source)}"
              target="_blank"
              rel="noopener"
            >
              open the video in a new tab
            </a>.
          </div>
        `;
      }
    }

    if (
      isUrl(source)
    ) {
      return `
        <div class="video-preview-frame">
          <video
            controls
            preload="metadata"
            poster="${esc(video.thumbnail_url || "")}"
          >
            <source src="${esc(source)}">
          </video>
        </div>
      `;
    }

    if (
      isUrl(
        video.thumbnail_url
      )
    ) {
      return `
        <div class="video-preview-frame">
          <img
            src="${esc(video.thumbnail_url)}"
            alt=""
          >
        </div>
      `;
    }

    return previewFallback(
      "Preview is not available for this video."
    );
  }


  function previewFallback(
    message
  ) {
    return `
      <div class="video-preview-frame">
        <div class="video-preview-fallback">
          ${esc(message)}
        </div>
      </div>
    `;
  }


  /* ============================================================
     USE VIDEO IN COURSE
     ============================================================ */

  async function openUseModal(
    id
  ) {
    const video =
      state.videos.find(
        (row) =>
          row.id === id
      );

    if (!video) {
      return;
    }

    state.selectedVideo =
      video;

    const modal =
      $("videoUseModal");

    if (!modal) {
      return;
    }

    set(
      "videoUseName",
      video.title ||
      video.original_filename ||
      "Video"
    );

    $("videoUseDisplayTitle").value =
      video.title ||
      video.original_filename ||
      "Video";

    $("videoUseRequired").checked =
      true;

    const course =
      $("videoUseCourse");

    course.innerHTML = `
      <option value="">
        Select a course
      </option>

      ${
        state.courses.map(
          (row) => `
            <option value="${esc(row.id)}">
              ${esc(row.title || "Course")}
            </option>
          `
        ).join("")
      }
    `;

    const lesson =
      $("videoUseLesson");

    lesson.innerHTML =
      '<option value="">Select a course first</option>';

    lesson.disabled =
      true;

    modal.hidden =
      false;

    document.body.style.overflow =
      "hidden";
  }


  async function loadLessonsForCourse(
    courseId
  ) {
    const lessonSelect =
      $("videoUseLesson");

    if (!lessonSelect) {
      return;
    }

    lessonSelect.disabled =
      true;

    lessonSelect.innerHTML =
      '<option value="">Loading lessons...</option>';

    if (!courseId) {
      lessonSelect.innerHTML =
        '<option value="">Select a course first</option>';

      return;
    }

    const {
      data: sections,
      error: sectionError
    } = await state.client
      .from(TABLES.sections)
      .select(
        "id,title,sort_order"
      )
      .eq(
        "course_id",
        courseId
      )
      .order(
        "sort_order",
        {
          ascending: true
        }
      );

    if (sectionError) {
      throw sectionError;
    }

    const sectionIds =
      (sections || [])
        .map(
          (row) =>
            row.id
        );

    if (!sectionIds.length) {
      lessonSelect.innerHTML =
        '<option value="">This course has no lessons</option>';

      return;
    }

    const {
      data: lessons,
      error: lessonError
    } = await state.client
      .from(TABLES.lessons)
      .select(
        "id,title,section_id,sort_order"
      )
      .in(
        "section_id",
        sectionIds
      )
      .order(
        "sort_order",
        {
          ascending: true
        }
      );

    if (lessonError) {
      throw lessonError;
    }

    const sectionMap =
      new Map(
        (sections || [])
          .map(
            (row) => [
              row.id,
              row.title ||
              "Section"
            ]
          )
      );

    lessonSelect.innerHTML = `
      <option value="">
        Select a lesson
      </option>

      ${
        (lessons || [])
          .map(
            (row) => `
              <option value="${esc(row.id)}">
                ${esc(sectionMap.get(row.section_id) || "Section")}
                —
                ${esc(row.title || "Lesson")}
              </option>
            `
          )
          .join("")
      }
    `;

    lessonSelect.disabled =
      !(lessons || []).length;
  }


  async function addSelectedVideoToLesson() {
    const media =
      state.selectedVideo;

    const lessonId =
      $("videoUseLesson")
        ?.value ||
      "";

    const title =
      $("videoUseDisplayTitle")
        ?.value
        .trim() ||
      media?.title ||
      "Video";

    if (!media?.id) {
      toast(
        "Choose a video first.",
        "error"
      );

      return;
    }

    if (
      !isUuid(
        lessonId
      )
    ) {
      toast(
        "Choose a lesson.",
        "error"
      );

      return;
    }

    const button =
      $("videoUseConfirm");

    if (button) {
      button.disabled =
        true;
    }

    try {
      const {
        data: last,
        error: sortError
      } = await state.client
        .from(TABLES.blocks)
        .select(
          "sort_order"
        )
        .eq(
          "lesson_id",
          lessonId
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

      if (sortError) {
        throw sortError;
      }

      const sortOrder =
        (
          Number(
            last?.sort_order
          ) ||
          0
        ) +
        1;

      const externalUrl =
        media.provider ===
          "supabase_storage"
          ? null
          : (
              media.playback_url ||
              media.metadata
                ?.original_url ||
              null
            );

      const {
        error
      } = await state.client
        .from(TABLES.blocks)
        .insert({
          lesson_id:
            lessonId,

          block_type:
            "video",

          title,

          sort_order:
            sortOrder,

          content:
            null,

          media_id:
            media.id,

          external_url:
            externalUrl,

          settings: {
            provider:
              media.provider ||
              "video",

            provider_video_id:
              media.provider_video_id ||
              null,

            duration_seconds:
              media.duration_seconds ??
              null,

            library_media_id:
              media.id,

            source:
              "video_library",

            storage_bucket:
              media.storage_bucket ||
              null,

            storage_path:
              media.storage_path ||
              null,

            original_url:
              media.metadata
                ?.original_url ||
              null,

            embed_url:
              media.metadata
                ?.embed_url ||
              null
          },

          is_required:
            $("videoUseRequired")
              ?.checked !==
            false,

          updated_at:
            new Date()
              .toISOString()
        });

      if (error) {
        throw error;
      }

      closeUseModal();

      toast(
        "Video added to the selected lesson.",
        "success"
      );

    } catch (error) {
      console.error(
        "[Use Video in Course]",
        error
      );

      toast(
        error?.message ||
        "Unable to add video to lesson.",
        "error"
      );

    } finally {
      if (button) {
        button.disabled =
          false;
      }
    }
  }


  /* ============================================================
     DELETE
     ============================================================ */

  function openDeleteModal(
    id
  ) {
    const video =
      state.videos.find(
        (row) =>
          row.id === id
      );

    if (!video) {
      return;
    }

    state.deleteVideo =
      video;

    set(
      "videoDeleteName",
      video.title ||
      video.original_filename ||
      "Video"
    );

    const modal =
      $("videoDeleteModal");

    if (!modal) {
      return;
    }

    modal.hidden =
      false;

    document.body.style.overflow =
      "hidden";
  }


  function closeDeleteModal() {
    const modal =
      $("videoDeleteModal");

    if (
      !modal ||
      modal.hidden
    ) {
      return;
    }

    modal.hidden =
      true;

    state.deleteVideo =
      null;

    restoreScroll();
  }


  async function deleteSelectedVideo() {
    const video =
      state.deleteVideo;

    if (!video?.id) {
      return;
    }

    const button =
      $("videoDeleteConfirm");

    if (button) {
      button.disabled =
        true;

      button.textContent =
        "Deleting...";
    }

    try {
      /*
       * Preserve the content block itself, but remove the media FK so
       * deleting the library record cannot fail because it is in use.
       */
      const {
        error: blockError
      } = await state.client
        .from(TABLES.blocks)
        .update({
          media_id:
            null,

          updated_at:
            new Date()
              .toISOString()
        })
        .eq(
          "media_id",
          video.id
        );

      if (blockError) {
        throw blockError;
      }

      /*
       * Only physical uploads have a real storage object.
       * YouTube/external/Cloudflare library records are not Supabase
       * Storage objects and must not be removed from the bucket.
       */
      if (
        video.provider ===
          "supabase_storage" &&
        video.storage_bucket &&
        video.storage_path
      ) {
        const {
          error: storageError
        } = await state.client
          .storage
          .from(
            video.storage_bucket
          )
          .remove([
            video.storage_path
          ]);

        if (storageError) {
          throw storageError;
        }
      }

      const {
        error: deleteError
      } = await state.client
        .from(TABLES.media)
        .delete()
        .eq(
          "id",
          video.id
        );

      if (deleteError) {
        throw deleteError;
      }

      closeDeleteModal();

      await loadVideos();

      toast(
        "Video deleted from the library.",
        "success"
      );

    } catch (error) {
      console.error(
        "[Delete Video]",
        error
      );

      toast(
        error?.message ||
        "Unable to delete video.",
        "error"
      );

    } finally {
      if (button) {
        button.disabled =
          false;

        button.textContent =
          "Delete Video";
      }
    }
  }


  /* ============================================================
     EVENTS
     ============================================================ */

  function bind() {
    $("videoLibraryAdd")
      ?.addEventListener(
        "click",
        openAddModal
      );

    document
      .querySelectorAll(
        "[data-video-source-tab]"
      )
      .forEach(
        (button) => {
          button.addEventListener(
            "click",
            () => {
              setAddSource(
                button.dataset
                  .videoSourceTab
              );
            }
          );
        }
      );

    $("videoAddFile")
      ?.addEventListener(
        "change",
        function () {
          handleUploadFile(
            this.files?.[0] ||
            null
          );
        }
      );

    $("videoAddYouTubeUrl")
      ?.addEventListener(
        "input",
        function () {
          const videoId =
            extractYouTubeId(
              this.value
            );

          if (!videoId) {
            return;
          }

          const thumbnail =
            $("videoAddThumbnail");

          if (
            thumbnail &&
            !thumbnail.value.trim()
          ) {
            thumbnail.value =
              `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
          }
        }
      );

    $("videoAddConfirm")
      ?.addEventListener(
        "click",
        addVideo
      );

    $("videoDeleteConfirm")
      ?.addEventListener(
        "click",
        deleteSelectedVideo
      );

    $("videoCategoryConfirm")
      ?.addEventListener(
        "click",
        saveVideoCategory
      );

    $("videoLibrarySearch")
      ?.addEventListener(
        "input",
        function () {
          state.filters.search =
            this.value ||
            "";

          renderVideos();
        }
      );

    $("videoLibraryProvider")
      ?.addEventListener(
        "change",
        function () {
          state.filters.provider =
            this.value ||
            "all";

          renderVideos();
        }
      );

    $("videoLibraryStatus")
      ?.addEventListener(
        "change",
        function () {
          state.filters.status =
            this.value ||
            "all";

          renderVideos();
        }
      );

    $("videoLibraryRefresh")
      ?.addEventListener(
        "click",
        async function () {
          try {
            await loadVideos();

            toast(
              "Video library refreshed.",
              "success"
            );

          } catch (error) {
            toast(
              error?.message ||
              "Unable to refresh video library.",
              "error"
            );
          }
        }
      );

    $("videoUseCourse")
      ?.addEventListener(
        "change",
        async function () {
          try {
            await loadLessonsForCourse(
              this.value ||
              ""
            );

          } catch (error) {
            toast(
              error?.message ||
              "Unable to load course lessons.",
              "error"
            );
          }
        }
      );

    $("videoUseConfirm")
      ?.addEventListener(
        "click",
        addSelectedVideoToLesson
      );

    document
      .querySelectorAll(
        "[data-close-add-video]"
      )
      .forEach(
        (node) => {
          node.addEventListener(
            "click",
            closeAddModal
          );
        }
      );

    document
      .querySelectorAll(
        "[data-close-video-modal]"
      )
      .forEach(
        (node) => {
          node.addEventListener(
            "click",
            closePreview
          );
        }
      );

    document
      .querySelectorAll(
        "[data-close-use-modal]"
      )
      .forEach(
        (node) => {
          node.addEventListener(
            "click",
            closeUseModal
          );
        }
      );

    document
      .querySelectorAll(
        "[data-close-delete-video]"
      )
      .forEach(
        (node) => {
          node.addEventListener(
            "click",
            closeDeleteModal
          );
        }
      );

    document
      .querySelectorAll(
        "[data-close-category-video]"
      )
      .forEach(
        (node) => {
          node.addEventListener(
            "click",
            closeCategoryModal
          );
        }
      );

    document.addEventListener(
      "keydown",
      function (
        event
      ) {
        if (
          event.key ===
          "Escape"
        ) {
          closeAddModal();
          closePreview();
          closeUseModal();
          closeDeleteModal();
          closeCategoryModal();
        }
      }
    );
  }


  /* ============================================================
     CLOSE MODALS
     ============================================================ */

  function closePreview() {
    const modal =
      $("videoPreviewModal");

    if (
      !modal ||
      modal.hidden
    ) {
      return;
    }

    modal.hidden =
      true;

    $("videoPreviewBody")
      .innerHTML =
      "";

    restoreScroll();
  }


  function closeUseModal() {
    const modal =
      $("videoUseModal");

    if (
      !modal ||
      modal.hidden
    ) {
      return;
    }

    modal.hidden =
      true;

    state.selectedVideo =
      null;

    restoreScroll();
  }


  function restoreScroll() {
    const ids = [
      "videoAddModal",
      "videoPreviewModal",
      "videoUseModal",
      "videoDeleteModal",
      "videoCategoryModal"
    ];

    const anyOpen =
      ids.some(
        (id) =>
          $(id)?.hidden ===
          false
      );

    if (!anyOpen) {
      document.body.style.overflow =
        "";
    }
  }


  /* ============================================================
     HELPERS
     ============================================================ */

  function setLoading(
    show
  ) {
    if (
      $("videoLibraryLoading")
    ) {
      $("videoLibraryLoading")
        .hidden =
        !show;
    }

    if (
      $("videoLibraryGrid") &&
      show
    ) {
      $("videoLibraryGrid")
        .hidden =
        true;
    }
  }


  function toast(
    message,
    type
  ) {
    const node =
      $("videoLibraryToast");

    if (!node) {
      return;
    }

    node.textContent =
      message;

    node.className =
      `video-library-toast show ${type || "success"}`;

    clearTimeout(
      toast.timer
    );

    toast.timer =
      setTimeout(
        () =>
          node.classList.remove(
            "show"
          ),
        3600
      );
  }


  function set(
    id,
    value
  ) {
    const node =
      $(id);

    if (node) {
      node.textContent =
        value ??
        "";
    }
  }


  function providerLabel(
    value
  ) {
    if (
      value ===
      "cloudflare_stream"
    ) {
      return "Cloudflare Stream";
    }

    if (
      value ===
      "supabase_storage"
    ) {
      return "Uploaded File";
    }

    if (
      value ===
      "youtube"
    ) {
      return "YouTube";
    }

    if (
      value ===
      "external"
    ) {
      return "External Website";
    }

    return value
      ? titleCase(value)
      : "Video";
  }


  function extractYouTubeId(
    value
  ) {
    const raw =
      String(
        value ||
        ""
      )
        .trim();

    if (!raw) {
      return null;
    }

    if (
      /^[A-Za-z0-9_-]{11}$/
        .test(raw)
    ) {
      return raw;
    }

    try {
      const url =
        new URL(raw);

      const host =
        url.hostname
          .replace(
            /^www\./i,
            ""
          )
          .toLowerCase();

      if (
        host ===
        "youtu.be"
      ) {
        const id =
          url.pathname
            .split("/")
            .filter(Boolean)[0];

        return validYouTubeId(id);
      }

      if (
        host.endsWith(
          "youtube.com"
        )
      ) {
        const queryId =
          url.searchParams
            .get("v");

        if (
          validYouTubeId(
            queryId
          )
        ) {
          return queryId;
        }

        const parts =
          url.pathname
            .split("/")
            .filter(Boolean);

        const known =
          [
            "embed",
            "shorts",
            "live"
          ];

        if (
          known.includes(
            parts[0]
          )
        ) {
          return validYouTubeId(
            parts[1]
          );
        }
      }

    } catch (_) {}

    return null;
  }


  function validYouTubeId(
    value
  ) {
    return /^[A-Za-z0-9_-]{11}$/
      .test(
        String(
          value ||
          ""
        )
      )
      ? String(value)
      : null;
  }


  function isDirectVideoUrl(
    value
  ) {
    return /\.(mp4|webm|mov|m4v|ogv)(?:[?#].*)?$/i
      .test(
        String(
          value ||
          ""
        )
      );
  }


  function safeStorageName(
    value
  ) {
    return String(
      value ||
      "video"
    )
      .replace(
        /\.[^.]+$/,
        ""
      )
      .toLowerCase()
      .replace(
        /[^a-z0-9]+/g,
        "-"
      )
      .replace(
        /^-+|-+$/g,
        ""
      )
      .slice(
        0,
        70
      ) ||
      "video";
  }


  function safeFileExtension(
    value
  ) {
    const extension =
      String(
        value ||
        ""
      )
        .split(".")
        .pop()
        .toLowerCase()
        .replace(
          /[^a-z0-9]/g,
          ""
        );

    return extension ||
      "mp4";
  }


  function formatBytes(
    bytes
  ) {
    const value =
      Number(bytes) ||
      0;

    if (
      value <
      1024
    ) {
      return `${value} B`;
    }

    if (
      value <
      1024 * 1024
    ) {
      return `${(value / 1024).toFixed(1)} KB`;
    }

    if (
      value <
      1024 * 1024 * 1024
    ) {
      return `${(value / (1024 * 1024)).toFixed(1)} MB`;
    }

    return `${(value / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }


  function formatDuration(
    seconds
  ) {
    const numeric =
      Number(seconds);

    if (
      !Number.isFinite(
        numeric
      ) ||
      numeric <=
      0
    ) {
      return "—";
    }

    const value =
      Math.max(
        0,
        Math.round(
          numeric
        )
      );

    const hours =
      Math.floor(
        value /
        3600
      );

    const minutes =
      Math.floor(
        (
          value %
          3600
        ) /
        60
      );

    const remainingSeconds =
      value %
      60;

    return hours
      ? `${hours}:${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`
      : `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
  }


  function formatRuntime(
    seconds
  ) {
    const total =
      Math.max(
        0,
        Math.round(
          Number(seconds) ||
          0
        )
      );

    const hours =
      Math.floor(
        total /
        3600
      );

    const minutes =
      Math.round(
        (
          total %
          3600
        ) /
        60
      );

    return hours
      ? `${hours}h ${minutes}m`
      : `${minutes}m`;
  }


  function formatDate(
    value
  ) {
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

    return date
      .toLocaleDateString(
        undefined,
        {
          month:
            "short",
          day:
            "numeric",
          year:
            "numeric"
        }
      );
  }


  function normalize(
    value
  ) {
    return String(
      value ||
      ""
    )
      .trim()
      .toLowerCase()
      .replace(
        /[\s-]+/g,
        "_"
      );
  }


  function titleCase(
    value
  ) {
    return String(
      value ||
      ""
    )
      .replace(
        /[_-]+/g,
        " "
      )
      .replace(
        /\b\w/g,
        (character) =>
          character
            .toUpperCase()
      );
  }


  function isUrl(
    value
  ) {
    return /^https?:\/\//i
      .test(
        String(
          value ||
          ""
        )
          .trim()
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
    ms
  ) {
    return new Promise(
      (resolve) =>
        setTimeout(
          resolve,
          ms
        )
    );
  }

})();
