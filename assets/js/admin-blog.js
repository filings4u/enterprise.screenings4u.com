/* ============================================================
   SCREENINGS4U — BLOG MANAGEMENT

   Backend:
   admin-content-actions

   Uses the existing contract supplied by the current application:
   - kind: "blog"
   - action: "list"
   - action: "save"
   - action: "delete"
   ============================================================ */

(() => {
  "use strict";

  const WEBSITE_ORIGIN = "https://www.screenings4u.com";

  const WEBSITE_IMAGES = [
    ["Home", "index.html", "images/home-hero.png"],
    ["Workplace Drug & Alcohol Testing", "workplace-drug-and-alcohol-testing.html", "images/workplace-drug-and-alcohol-testing-hero.png"],
    ["DOT Services", "dot-services.html", "images/dot-hero.png"],
    ["DOT Urine Drug Testing", "dot-urine-drug-tests.html", "images/dot-urine-hero.png"],
    ["DOT Breath Alcohol Testing", "dot-breathalyzer-services.html", "images/dot-breathalyzer-hero.png"],
    ["DOT Physical Exams", "dot-physical-exam-services.html", "images/dot-physical-hero.png"],
    ["Personal Drug & Alcohol Testing", "personal-drug-and-alcohol-testing.html", "images/personal-drug-and-alcohol-testing-hero.png"],
    ["Non-DOT Breath Alcohol Testing", "non-dot-breathalyzer-services.html", "images/non-dot-breathalyzer-hero.png"],
    ["Mobile Drug & Alcohol Testing", "mobile-drug-and-alcohol-testing.html", "images/mobile-drug-and-alcohol-testing-hero.png"],
    ["Background Checks", "background-checks.html", "images/background-check-hero.png"],
    ["Business Services", "business-services.html", "images/business-services-hero.png"],
    ["Consulting Services", "consulting-services.html", "images/consulting-services-hero.png"],
    ["Court-Ordered Testing", "court-ordered-etg-drug-and-alcohol-testing.html", "images/court-ordered-testing-hero.png"],
    ["DOT Collector Training", "dot-specimen-collector-training.html", "images/dot-specimen-collector-training-hero.png"],
    ["Drug & Alcohol Policy Creation", "drug-alcohol-policy-creation.html", "images/drug-alcohol-policy-hero.png"],
    ["Industries Served", "industries-served.html", "images/industries-served-hero.png"],
    ["New Entrant Audit", "new-entrant-audit.html", "images/new-entrant-audit-hero.png"],
    ["Post-Accident Testing", "post-accident-testing.html", "images/post-accident-testing-hero.png"]
  ];

  let db = null;
  let items = [];
  let current = null;

  const kind =
    document.body.dataset.kind ||
    "blog";

  const E = {};

  document.addEventListener(
    "DOMContentLoaded",
    init
  );


  async function init() {
    installFeaturedImageFields();
    cache();
    bind();

    try {
      db = await getClient();

      if (!db) {
        throw new Error(
          "Supabase client not found."
        );
      }

      await load();

    } catch (error) {
      console.error(
        "[Admin Blog]",
        error
      );

      message(
        error?.message ||
        "Unable to load blog posts.",
        "error"
      );
    }
  }


  function cache() {
    [
      "refreshBtn",
      "newBtn",
      "search",
      "statusFilter",
      "categoryFilter",

      "total",
      "published",
      "draft",
      "featuredCount",

      "postBody",
      "emptyState",
      "message",

      "editorModal",
      "editorModalTitle",
      "editorModalSubtitle",

      "title",
      "slug",
      "category",
      "tags",
      "excerpt",

      "imageSourcePage",
      "featuredImageUrl",
      "featuredImagePreview",
      "featuredImagePreviewWrap",
      "clearFeaturedImageBtn",

      "editor",
      "editorToolbar",
      "blockFormat",
      "linkBtn",
      "clearFormatBtn",

      "seoTitle",
      "seoDescription",
      "seoTitleCount",
      "seoDescriptionCount",
      "seoSlugPreview",
      "seoTitlePreview",
      "seoDescriptionPreview",

      "status",
      "featured",
      "web",
      "customer",
      "employer",

      "summaryStatus",
      "summaryCategory",
      "summaryWords",
      "summaryReading",
      "summaryUpdated",

      "previewBtn",
      "previewModal",
      "previewCategory",
      "previewPostTitle",
      "previewExcerpt",
      "previewReadingTime",
      "previewContent",

      "saveDraftBtn",
      "saveBtn"
    ].forEach(
      (id) => {
        E[id] =
          document.getElementById(
            id
          );
      }
    );
  }


  function bind() {
    E.search?.addEventListener(
      "input",
      draw
    );

    E.statusFilter?.addEventListener(
      "change",
      draw
    );

    E.categoryFilter?.addEventListener(
      "change",
      draw
    );

    E.imageSourcePage?.addEventListener(
      "change",
      applySelectedWebsiteImage
    );

    E.featuredImageUrl?.addEventListener(
      "input",
      updateFeaturedImagePreview
    );

    E.clearFeaturedImageBtn?.addEventListener(
      "click",
      clearFeaturedImage
    );

    E.refreshBtn?.addEventListener(
      "click",
      load
    );

    E.newBtn?.addEventListener(
      "click",
      () => openEditor()
    );

    E.postBody?.addEventListener(
      "click",
      handleTableClick
    );

    document
      .querySelectorAll(
        "[data-close-editor]"
      )
      .forEach(
        (button) =>
          button.addEventListener(
            "click",
            closeEditor
          )
      );

    document
      .querySelectorAll(
        "[data-close-preview]"
      )
      .forEach(
        (button) =>
          button.addEventListener(
            "click",
            closePreview
          )
      );

    E.title?.addEventListener(
      "input",
      handleTitleInput
    );

    E.slug?.addEventListener(
      "input",
      updateSeoPreview
    );

    E.category?.addEventListener(
      "input",
      updateSummary
    );

    E.status?.addEventListener(
      "change",
      updateSummary
    );

    E.seoTitle?.addEventListener(
      "input",
      updateSeoPreview
    );

    E.seoDescription?.addEventListener(
      "input",
      updateSeoPreview
    );

    E.editor?.addEventListener(
      "input",
      updateSummary
    );

    E.blockFormat?.addEventListener(
      "change",
      () => {
        command(
          "formatBlock",
          E.blockFormat.value
        );
      }
    );

    E.editorToolbar
      ?.querySelectorAll(
        "[data-command]"
      )
      .forEach(
        (button) =>
          button.addEventListener(
            "click",
            () =>
              command(
                button.dataset.command
              )
          )
      );

    E.linkBtn?.addEventListener(
      "click",
      insertLink
    );

    E.clearFormatBtn?.addEventListener(
      "click",
      () =>
        command(
          "removeFormat"
        )
    );

    E.previewBtn?.addEventListener(
      "click",
      openPreview
    );

    E.saveDraftBtn?.addEventListener(
      "click",
      () => save("draft")
    );

    E.saveBtn?.addEventListener(
      "click",
      () => save()
    );

    document.addEventListener(
      "keydown",
      (event) => {
        if (event.key !== "Escape") {
          return;
        }

        if (
          E.previewModal &&
          !E.previewModal.hidden
        ) {
          closePreview();
          return;
        }

        if (
          E.editorModal &&
          !E.editorModal.hidden
        ) {
          closeEditor();
        }
      }
    );
  }


  function installFeaturedImageFields() {
    if (document.getElementById("featuredImageUrl")) return;

    const excerpt = document.getElementById("excerpt");
    const anchor = excerpt?.closest(".blog-field");
    if (!anchor) return;

    const section = document.createElement("section");
    section.className = "blog-image-picker blog-field-span-2";
    section.innerHTML = `
      <div class="blog-section-head">
        <div>
          <span class="blog-eyebrow">Featured image</span>
          <h3>Use an existing website image</h3>
        </div>
      </div>
      <div class="blog-grid-2">
        <label class="blog-field">
          <span>Service page</span>
          <select id="imageSourcePage">
            <option value="">Choose a website page...</option>
            ${WEBSITE_IMAGES.map(([label, page, image]) =>
              `<option value="${escapeAttribute(image)}" data-page="${escapeAttribute(page)}">${escapeHtmlText(label)}</option>`
            ).join("")}
          </select>
          <small>Selecting a page fills its existing hero image automatically.</small>
        </label>
        <label class="blog-field">
          <span>Image URL or website path</span>
          <input id="featuredImageUrl" type="text" placeholder="https://www.screenings4u.com/images/example.png" autocomplete="off">
          <small>Only the URL is saved. The image is not uploaded to Supabase.</small>
        </label>
      </div>
      <div id="featuredImagePreviewWrap" class="blog-image-preview" hidden>
        <img id="featuredImagePreview" alt="Featured image preview">
        <div class="blog-image-preview-actions">
          <a id="featuredImageOpen" class="blog-button secondary" href="#" target="_blank" rel="noopener">Open image</a>
          <button id="clearFeaturedImageBtn" class="blog-button danger" type="button">Remove image</button>
        </div>
      </div>`;

    anchor.insertAdjacentElement("afterend", section);
  }


  function applySelectedWebsiteImage() {
    if (!E.imageSourcePage?.value || !E.featuredImageUrl) return;

    E.featuredImageUrl.value = absoluteWebsiteUrl(E.imageSourcePage.value);
    updateFeaturedImagePreview(
      new URL(E.imageSourcePage.value, window.location.href).href
    );
  }


  function updateFeaturedImagePreview(previewOverride = null) {
    const value = E.featuredImageUrl?.value.trim() || "";
    const previewValue = previewOverride || value;
    const valid = validImageUrl(previewValue);

    if (E.featuredImagePreviewWrap) {
      E.featuredImagePreviewWrap.hidden = !valid;
    }

    if (E.featuredImagePreview) {
      E.featuredImagePreview.src = valid ? previewValue : "";
    }

    const open = document.getElementById("featuredImageOpen");
    if (open) open.href = valid ? previewValue : "#";
  }


  function clearFeaturedImage() {
    if (E.imageSourcePage) E.imageSourcePage.value = "";
    if (E.featuredImageUrl) E.featuredImageUrl.value = "";
    updateFeaturedImagePreview();
  }


  function absoluteWebsiteUrl(path) {
    try {
      return new URL(path, `${WEBSITE_ORIGIN}/`).href;
    } catch {
      return "";
    }
  }


  function validImageUrl(value) {
    try {
      const url = new URL(value);
      return ["http:", "https:"].includes(url.protocol);
    } catch {
      return false;
    }
  }


  function escapeAttribute(value) {
    return String(value).replace(/[&<>"']/g, (character) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[character]);
  }


  function escapeHtmlText(value) {
    return escapeAttribute(value);
  }


  async function getClient() {
    for (
      let i = 0;
      i < 40;
      i += 1
    ) {
      try {
        if (
          typeof window
            .getScreenings4uSupabase ===
          "function"
        ) {
          const client =
            await window
              .getScreenings4uSupabase();

          if (client?.functions) {
            return client;
          }
        }

        if (
          window
            .screenings4uSupabase
            ?.functions
        ) {
          return window
            .screenings4uSupabase;
        }

        if (
          window
            .supabaseClient
            ?.functions
        ) {
          return window
            .supabaseClient;
        }

      } catch (_) {}

      await delay(75);
    }

    return null;
  }


  async function call(body) {
    const {
      data,
      error
    } = await db.functions.invoke(
      "admin-content-actions",
      {
        body: {
          kind,
          ...body
        }
      }
    );

    if (error) {
      let text =
        error.message ||
        "Content action failed.";

      try {
        const payload =
          await error.context
            ?.clone?.()
            .json();

        if (payload?.error) {
          text =
            payload.error;
        }
      } catch (_) {}

      throw new Error(text);
    }

    if (data?.error) {
      throw new Error(
        data.error
      );
    }

    return data || {};
  }


  async function load() {
    setRefreshBusy(true);

    try {
      const data =
        await call({
          action: "list"
        });

      items =
        Array.isArray(data.items)
          ? data.items
          : [];

      updateStats();
      updateCategoryFilter();
      draw();

    } catch (error) {
      console.error(
        "[Load Blog Posts]",
        error
      );

      message(
        error?.message ||
        "Unable to load blog posts.",
        "error"
      );

    } finally {
      setRefreshBusy(false);
    }
  }


  function updateStats() {
    E.total.textContent =
      String(
        items.length
      );

    E.published.textContent =
      String(
        items.filter(
          (item) =>
            item.status ===
            "published"
        ).length
      );

    E.draft.textContent =
      String(
        items.filter(
          (item) =>
            item.status ===
            "draft"
        ).length
      );

    E.featuredCount.textContent =
      String(
        items.filter(
          (item) =>
            Boolean(item.featured)
        ).length
      );
  }


  function updateCategoryFilter() {
    if (!E.categoryFilter) {
      return;
    }

    const selected =
      E.categoryFilter.value;

    const categories =
      [
        ...new Set(
          items
            .map(
              (item) =>
                String(
                  item.category ||
                  ""
                ).trim()
            )
            .filter(Boolean)
        )
      ].sort(
        (a,b) =>
          a.localeCompare(b)
      );

    E.categoryFilter.innerHTML =
      '<option value="">All categories</option>' +
      categories
        .map(
          (category) =>
            `<option value="${esc(category)}">${esc(category)}</option>`
        )
        .join("");

    if (
      categories.includes(
        selected
      )
    ) {
      E.categoryFilter.value =
        selected;
    }
  }


  function draw() {
    const query =
      String(
        E.search?.value ||
        ""
      )
        .trim()
        .toLowerCase();

    const status =
      E.statusFilter
        ?.value ||
      "";

    const category =
      E.categoryFilter
        ?.value ||
      "";

    const filtered =
      items.filter(
        (item) => {
          if (
            status &&
            item.status !==
            status
          ) {
            return false;
          }

          if (
            category &&
            item.category !==
            category
          ) {
            return false;
          }

          if (!query) {
            return true;
          }

          const haystack =
            [
              item.title,
              item.slug,
              item.category,
              item.status,
              item.excerpt,
              ...(Array.isArray(item.tags)
                ? item.tags
                : [])
            ]
              .filter(Boolean)
              .join(" ")
              .toLowerCase();

          return haystack.includes(
            query
          );
        }
      );

    E.postBody.innerHTML =
      filtered
        .map(
          (item) => `
            <tr>
              <td>
                <div class="blog-post-title">
                  <strong>${esc(item.title || "Untitled Post")}</strong>
                  <small>/${esc(item.slug || "")}</small>
                </div>
              </td>

              <td>${esc(item.category || "—")}</td>

              <td>
                <span class="blog-pill ${escClass(item.status)}">
                  ${esc(human(item.status || "draft"))}
                </span>
              </td>

              <td>
                ${
                  item.featured
                    ? '<span class="blog-featured">Featured</span>'
                    : "—"
                }
              </td>

              <td>
                ${
                  item.show_website === false
                    ? "Hidden"
                    : "Visible"
                }
              </td>

              <td>${esc(formatDate(item.updated_at))}</td>

              <td>
                <div class="blog-table-actions">
                  <button
                    class="blog-button secondary"
                    type="button"
                    data-edit="${esc(item.id)}"
                  >
                    Edit
                  </button>

                  <button
                    class="blog-button secondary"
                    type="button"
                    data-preview="${esc(item.id)}"
                  >
                    Preview
                  </button>

                  <button
                    class="blog-button danger"
                    type="button"
                    data-delete="${esc(item.id)}"
                  >
                    Delete
                  </button>
                </div>
              </td>
            </tr>
          `
        )
        .join("");

    if (E.emptyState) {
      E.emptyState.hidden =
        filtered.length > 0;
    }
  }


  async function handleTableClick(
    event
  ) {
    const edit =
      event.target.closest(
        "[data-edit]"
      );

    if (edit) {
      const item =
        findItem(
          edit.dataset.edit
        );

      if (item) {
        openEditor(item);
      }

      return;
    }

    const preview =
      event.target.closest(
        "[data-preview]"
      );

    if (preview) {
      const item =
        findItem(
          preview.dataset.preview
        );

      if (item) {
        openPreview(item);
      }

      return;
    }

    const remove =
      event.target.closest(
        "[data-delete]"
      );

    if (remove) {
      await deletePost(
        remove.dataset.delete,
        remove
      );
    }
  }


  function findItem(id) {
    return items.find(
      (item) =>
        String(item.id) ===
        String(id)
    );
  }


  function openEditor(
    item = null
  ) {
    current = item;

    E.editorModalTitle.textContent =
      item
        ? "Edit Blog Post"
        : "New Blog Post";

    E.editorModalSubtitle.textContent =
      item
        ? "Update article content, SEO, and publishing settings."
        : "Create a polished article for the main website.";

    E.title.value =
      item?.title ||
      "";

    E.slug.value =
      item?.slug ||
      "";

    E.category.value =
      item?.category ||
      "";

    E.tags.value =
      Array.isArray(item?.tags)
        ? item.tags.join(", ")
        : "";

    E.excerpt.value =
      item?.excerpt ||
      "";

    if (E.featuredImageUrl) {
      E.featuredImageUrl.value =
        item?.featured_image_url ||
        "";
    }

    let selectedImagePath = "";

    if (E.imageSourcePage) {
      const currentImage =
        item?.featured_image_url ||
        "";

      const match = WEBSITE_IMAGES.find(
        ([, , image]) =>
          currentImage === image ||
          currentImage.endsWith(`/${image}`)
      );

      E.imageSourcePage.value =
        match?.[2] ||
        "";

      selectedImagePath =
        match?.[2] ||
        "";
    }

    updateFeaturedImagePreview(
      selectedImagePath
        ? new URL(selectedImagePath, window.location.href).href
        : null
    );

    E.editor.innerHTML =
      item?.content_html ||
      item?.content ||
      "";

    E.seoTitle.value =
      item?.seo_title ||
      "";

    E.seoDescription.value =
      item?.seo_description ||
      "";

    E.status.value =
      item?.status ||
      "draft";

    E.featured.value =
      String(
        Boolean(
          item?.featured
        )
      );

    E.web.checked =
      item
        ? item.show_website !==
          false
        : true;

    E.customer.checked =
      item
        ? item.show_customer_portal !==
          false
        : false;

    E.employer.checked =
      item
        ? item.show_employer_portal !==
          false
        : false;

    E.summaryUpdated.textContent =
      item?.updated_at
        ? formatDate(
            item.updated_at
          )
        : "Not saved";

    updateSeoPreview();
    updateSummary();

    E.editorModal.hidden =
      false;

    E.editorModal.setAttribute(
      "aria-hidden",
      "false"
    );

    document.body.classList.add(
      "blog-modal-open"
    );

    window.setTimeout(
      () =>
        E.title?.focus(),
      50
    );
  }


  function closeEditor() {
    E.editorModal.hidden =
      true;

    E.editorModal.setAttribute(
      "aria-hidden",
      "true"
    );

    document.body.classList.remove(
      "blog-modal-open"
    );

    current = null;
  }


  function handleTitleInput() {
    if (
      !current &&
      !E.slug.dataset.touched
    ) {
      E.slug.value =
        slugify(
          E.title.value
        );
    }

    if (
      !E.seoTitle.value.trim()
    ) {
      E.seoTitlePreview.textContent =
        E.title.value.trim() ||
        "Your blog post title";
    }

    updateSeoPreview();
    updateSummary();
  }


  function updateSeoPreview() {
    const seoTitle =
      E.seoTitle.value.trim() ||
      E.title.value.trim() ||
      "Your blog post title";

    const seoDescription =
      E.seoDescription.value.trim() ||
      E.excerpt.value.trim() ||
      "Your SEO description will appear here.";

    E.seoTitleCount.textContent =
      String(
        E.seoTitle.value.length
      );

    E.seoDescriptionCount.textContent =
      String(
        E.seoDescription.value.length
      );

    E.seoSlugPreview.textContent =
      E.slug.value.trim() ||
      slugify(
        E.title.value
      ) ||
      "your-post";

    E.seoTitlePreview.textContent =
      seoTitle;

    E.seoDescriptionPreview.textContent =
      seoDescription;
  }


  function updateSummary() {
    const words =
      wordCount(
        E.editor?.innerText ||
        ""
      );

    E.summaryStatus.textContent =
      human(
        E.status?.value ||
        "draft"
      );

    E.summaryCategory.textContent =
      E.category
        ?.value
        .trim() ||
      "Uncategorized";

    E.summaryWords.textContent =
      String(words);

    E.summaryReading.textContent =
      `${readingMinutes(words)} min`;
  }


  function command(
    name,
    value = null
  ) {
    E.editor?.focus();

    document.execCommand(
      name,
      false,
      value
    );

    updateSummary();
  }


  function insertLink() {
    const value =
      window.prompt(
        "Enter link URL:"
      );

    if (!value) {
      return;
    }

    command(
      "createLink",
      value
    );
  }


  function openPreview(
    item = null
  ) {
    const title =
      item?.title ||
      E.title.value.trim() ||
      "Untitled Blog Post";

    const category =
      item?.category ||
      E.category.value.trim() ||
      "Uncategorized";

    const excerpt =
      item?.excerpt ||
      E.excerpt.value.trim() ||
      "";

    const content =
      item?.content_html ||
      item?.content ||
      E.editor.innerHTML ||
      "";

    const words =
      wordCount(
        stripHtml(content)
      );

    E.previewCategory.textContent =
      category;

    E.previewPostTitle.textContent =
      title;

    E.previewExcerpt.textContent =
      excerpt;

    E.previewReadingTime.textContent =
      `${readingMinutes(words)} min read`;

    E.previewContent.innerHTML =
      content;

    E.previewModal.hidden =
      false;

    E.previewModal.setAttribute(
      "aria-hidden",
      "false"
    );

    document.body.classList.add(
      "blog-modal-open"
    );
  }


  function closePreview() {
    E.previewModal.hidden =
      true;

    E.previewModal.setAttribute(
      "aria-hidden",
      "true"
    );

    if (
      E.editorModal.hidden
    ) {
      document.body.classList.remove(
        "blog-modal-open"
      );
    }
  }


  async function save(
    forcedStatus = null
  ) {
    const title =
      E.title.value.trim();

    if (!title) {
      message(
        "Blog post title is required.",
        "error"
      );

      E.title.focus();
      return;
    }

    const status =
      forcedStatus ||
      E.status.value;

    const record = {
      id:
        current?.id,

      title,

      slug:
        E.slug.value.trim() ||
        slugify(title),

      category:
        E.category.value.trim() ||
        null,

      tags:
        E.tags.value
          .split(",")
          .map(
            (value) =>
              value.trim()
          )
          .filter(Boolean),

      status,

      featured:
        E.featured.value ===
        "true",

      excerpt:
        E.excerpt.value.trim() ||
        null,

      featured_image_url:
        E.featuredImageUrl?.value.trim() ||
        null,

      content_html:
        E.editor.innerHTML,

      seo_title:
        E.seoTitle.value.trim() ||
        null,

      seo_description:
        E.seoDescription.value.trim() ||
        null,

      show_website:
        E.web.checked,

      show_customer_portal:
        E.customer.checked,

      show_employer_portal:
        E.employer.checked
    };

    setSaveBusy(true);

    try {
      await call({
        action: "save",
        record
      });

      closeEditor();

      message(
        status === "draft"
          ? "Draft saved."
          : "Blog post saved.",
        "ok"
      );

      await load();

    } catch (error) {
      console.error(
        "[Save Blog Post]",
        error
      );

      message(
        error?.message ||
        "Unable to save blog post.",
        "error"
      );

    } finally {
      setSaveBusy(false);
    }
  }


  async function deletePost(
    id,
    button
  ) {
    const item =
      findItem(id);

    if (!item) {
      return;
    }

    const confirmed =
      window.confirm(
        `Delete "${item.title || "this blog post"}"?`
      );

    if (!confirmed) {
      return;
    }

    if (button) {
      button.disabled =
        true;
    }

    try {
      await call({
        action: "delete",
        id: item.id
      });

      items =
        items.filter(
          (value) =>
            String(value.id) !==
            String(item.id)
        );

      updateStats();
      updateCategoryFilter();
      draw();

      message(
        "Blog post deleted.",
        "ok"
      );

    } catch (error) {
      console.error(
        "[Delete Blog Post]",
        error
      );

      message(
        error?.message ||
        "Unable to delete blog post.",
        "error"
      );

      if (button) {
        button.disabled =
          false;
      }
    }
  }


  function setRefreshBusy(
    busy
  ) {
    if (!E.refreshBtn) {
      return;
    }

    E.refreshBtn.disabled =
      busy;

    E.refreshBtn.textContent =
      busy
        ? "Refreshing..."
        : "Refresh";
  }


  function setSaveBusy(
    busy
  ) {
    [
      E.saveDraftBtn,
      E.saveBtn
    ]
      .filter(Boolean)
      .forEach(
        (button) => {
          button.disabled =
            busy;
        }
      );

    if (E.saveDraftBtn) {
      E.saveDraftBtn.textContent =
        busy
          ? "Saving..."
          : "Save Draft";
    }

    if (E.saveBtn) {
      E.saveBtn.textContent =
        busy
          ? "Saving..."
          : "Save Post";
    }
  }


  function slugify(value) {
    return String(
      value ||
      ""
    )
      .toLowerCase()
      .trim()
      .replace(
        /[^a-z0-9]+/g,
        "-"
      )
      .replace(
        /^-+|-+$/g,
        ""
      );
  }


  function wordCount(value) {
    const text =
      String(
        value ||
        ""
      ).trim();

    if (!text) {
      return 0;
    }

    return text
      .split(/\s+/)
      .filter(Boolean)
      .length;
  }


  function readingMinutes(words) {
    if (!words) {
      return 0;
    }

    return Math.max(
      1,
      Math.ceil(
        words / 220
      )
    );
  }


  function stripHtml(value) {
    const element =
      document.createElement(
        "div"
      );

    element.innerHTML =
      String(
        value ||
        ""
      );

    return (
      element.textContent ||
      element.innerText ||
      ""
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

    return date.toLocaleString(
      [],
      {
        dateStyle: "medium",
        timeStyle: "short"
      }
    );
  }


  function human(value) {
    return String(
      value ||
      ""
    )
      .replace(
        /_/g,
        " "
      )
      .replace(
        /\b\w/g,
        (letter) =>
          letter.toUpperCase()
      );
  }


  function escClass(value) {
    return String(
      value ||
      ""
    )
      .toLowerCase()
      .replace(
        /[^a-z0-9_-]/g,
        ""
      );
  }


  function esc(value) {
    return String(
      value ??
      ""
    )
      .replace(/&/g,"&amp;")
      .replace(/</g,"&lt;")
      .replace(/>/g,"&gt;")
      .replace(/"/g,"&quot;")
      .replace(/'/g,"&#039;");
  }


  function message(
    text,
    type = "ok"
  ) {
    if (!E.message) {
      return;
    }

    E.message.textContent =
      text;

    E.message.className =
      `blog-message show ${type}`;

    window.clearTimeout(
      message.timer
    );

    message.timer =
      window.setTimeout(
        () => {
          E.message
            ?.classList
            .remove("show");
        },
        5000
      );
  }


  function delay(milliseconds) {
    return new Promise(
      (resolve) =>
        window.setTimeout(
          resolve,
          milliseconds
        )
    );
  }

})();
