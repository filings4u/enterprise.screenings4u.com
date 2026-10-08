(() => {
  "use strict";

  const state = { db: null, rows: [], editingId: null };
  const $ = (id) => document.getElementById(id);
  document.addEventListener("DOMContentLoaded", initialize);

  async function initialize() {
    try {
      state.db = await getScreenings4uSupabase();
      bindEvents();
      await loadFaqs();
    } catch (error) {
      report(error, "Unable to load FAQS management.");
    }
  }

  function bindEvents() {
    $("addFaqButton")?.addEventListener("click", () => openEditor());
    $("faqEditorClose")?.addEventListener("click", closeEditor);
    $("faqEditorCancel")?.addEventListener("click", closeEditor);
    $("faqEditor")?.addEventListener("click", (event) => { if (event.target === $("faqEditor")) closeEditor(); });
    $("faqForm")?.addEventListener("submit", saveFaq);
    $("faqAdminSearch")?.addEventListener("input", renderRows);
    $("faqAdminStatus")?.addEventListener("change", renderRows);
  }

  async function loadFaqs() {
    setLoading(true);
    const { data, error } = await state.db.from("faqs").select("*").order("sort_order").order("created_at");
    if (error) throw error;
    state.rows = data || [];
    renderStats();
    renderRows();
    setLoading(false);
  }

  function renderStats() {
    text("faqStatTotal", state.rows.length);
    text("faqStatPublished", state.rows.filter((row) => row.status === "published").length);
    text("faqStatDraft", state.rows.filter((row) => ["draft", "review"].includes(row.status)).length);
    text("faqStatFeatured", state.rows.filter((row) => row.featured).length);
  }

  function renderRows() {
    const target = $("faqAdminRows");
    if (!target) return;
    const query = $("faqAdminSearch")?.value.trim().toLowerCase() || "";
    const status = $("faqAdminStatus")?.value || "all";
    const rows = state.rows.filter((row) => {
      const matchesStatus = status === "all" || row.status === status;
      const haystack = [row.question, row.category, ...(row.tags || [])].join(" ").toLowerCase();
      return matchesStatus && (!query || haystack.includes(query));
    });

    target.replaceChildren();
    $("faqAdminEmpty").hidden = rows.length > 0;
    rows.forEach((row) => {
      const article = document.createElement("article");
      article.className = "faqs-admin-row";
      const main = document.createElement("div");
      main.className = "faqs-admin-main";
      const category = document.createElement("span");
      category.className = "faqs-admin-category";
      category.textContent = row.category || "General";
      const question = document.createElement("strong");
      question.textContent = row.question;
      const meta = document.createElement("small");
      meta.textContent = `Order ${row.sort_order} · ${visibilityLabel(row)}`;
      main.append(category, question, meta);

      const statusBadge = document.createElement("span");
      statusBadge.className = `faqs-status ${row.status}`;
      statusBadge.textContent = pretty(row.status);

      const actions = document.createElement("div");
      actions.className = "faqs-admin-actions";
      const edit = button("Edit", "secondary", () => openEditor(row));
      const toggle = button(row.status === "published" ? "Unpublish" : "Publish", "secondary", () => togglePublish(row));
      const remove = button("Delete", "danger", () => deleteFaq(row));
      actions.append(edit, toggle, remove);
      article.append(main, statusBadge, actions);
      target.appendChild(article);
    });
  }

  function openEditor(row = null) {
    state.editingId = row?.id || null;
    text("faqEditorTitle", row ? "Edit FAQS" : "Create FAQS");
    $("faqQuestion").value = row?.question || "";
    $("faqSlug").value = row?.slug || "";
    $("faqCategory").value = row?.category || "General";
    $("faqAnswer").value = row?.answer_html || "";
    $("faqTags").value = (row?.tags || []).join(", ");
    $("faqStatus").value = row?.status || "draft";
    $("faqSortOrder").value = row?.sort_order ?? nextSortOrder();
    $("faqFeatured").checked = Boolean(row?.featured);
    $("faqShowWebsite").checked = row ? Boolean(row.show_website) : true;
    $("faqShowCustomer").checked = row ? Boolean(row.show_customer_portal) : true;
    $("faqShowEmployer").checked = row ? Boolean(row.show_employer_portal) : true;
    $("faqEditor").classList.add("open");
    $("faqEditor").setAttribute("aria-hidden", "false");
    $("faqQuestion").focus();
  }

  function closeEditor() {
    $("faqEditor")?.classList.remove("open");
    $("faqEditor")?.setAttribute("aria-hidden", "true");
    state.editingId = null;
    $("faqForm")?.reset();
  }

  async function saveFaq(event) {
    event.preventDefault();
    const saveButton = $("faqSaveButton");
    saveButton.disabled = true;
    const question = $("faqQuestion").value.trim();
    const answer = $("faqAnswer").value.trim();
    if (!question || !answer) {
      toast("Question and answer are required.", "warning");
      saveButton.disabled = false;
      return;
    }

    const status = $("faqStatus").value;
    const payload = {
      question,
      slug: slugify($("faqSlug").value || question),
      answer_html: answer,
      category: $("faqCategory").value.trim() || "General",
      tags: $("faqTags").value.split(",").map((tag) => tag.trim()).filter(Boolean),
      status,
      sort_order: Math.max(0, Number($("faqSortOrder").value || 0)),
      featured: $("faqFeatured").checked,
      show_website: $("faqShowWebsite").checked,
      show_customer_portal: $("faqShowCustomer").checked,
      show_employer_portal: $("faqShowEmployer").checked,
      published_at: status === "published" ? new Date().toISOString() : null,
      updated_at: new Date().toISOString()
    };

    try {
      let query;
      if (state.editingId) query = state.db.from("faqs").update(payload).eq("id", state.editingId);
      else query = state.db.from("faqs").insert(payload);
      const { error } = await query;
      if (error) throw error;
      toast(state.editingId ? "FAQS updated." : "FAQS created.", "success");
      closeEditor();
      await loadFaqs();
    } catch (error) {
      report(error, "Unable to save this FAQS.");
    } finally {
      saveButton.disabled = false;
    }
  }

  async function togglePublish(row) {
    const publishing = row.status !== "published";
    const { error } = await state.db.from("faqs").update({
      status: publishing ? "published" : "draft",
      published_at: publishing ? new Date().toISOString() : null,
      updated_at: new Date().toISOString()
    }).eq("id", row.id);
    if (error) return report(error, "Unable to change publishing status.");
    toast(publishing ? "FAQS published." : "FAQS moved to draft.", "success");
    await loadFaqs();
  }

  async function deleteFaq(row) {
    if (!window.confirm(`Delete “${row.question}”? This cannot be undone.`)) return;
    const { error } = await state.db.from("faqs").delete().eq("id", row.id);
    if (error) return report(error, "Unable to delete this FAQS.");
    toast("FAQS deleted.", "success");
    await loadFaqs();
  }

  function setLoading(loading) { if ($("faqAdminLoading")) $("faqAdminLoading").hidden = !loading; }
  function nextSortOrder() { return state.rows.reduce((max, row) => Math.max(max, Number(row.sort_order || 0)), 0) + 10; }
  function visibilityLabel(row) { return [row.show_website && "Website", row.show_customer_portal && "Customer", row.show_employer_portal && "Employer"].filter(Boolean).join(", ") || "Hidden"; }
  function slugify(value) { return String(value).toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
  function pretty(value) { return String(value || "").replace(/[_-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }
  function button(label, variant, handler) { const element = document.createElement("button"); element.type = "button"; element.className = `faqs-row-button ${variant}`; element.textContent = label; element.addEventListener("click", handler); return element; }
  function text(id, value) { if ($(id)) $(id).textContent = String(value); }
  function toast(message, type) { window.S4UUI?.toast?.(message, type) || window.alert(message); }
  function report(error, fallback) { console.error("[Admin FAQs]", error); toast(error?.message || fallback, "error"); }
})();
