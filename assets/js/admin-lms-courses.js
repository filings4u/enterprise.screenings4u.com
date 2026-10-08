/* screenings4u — admin-lms-courses.js */

(() => {
"use strict";

const PAGE_SIZE = 20;

let client = null;
let courses = [], sections = [], lessons = [], enrollments = [], filtered = [];
let page = 1;
let pendingDeleteCourse = null;

const el = {};

document.addEventListener("DOMContentLoaded", init);

async function init() {
    cache();
    bind();

    if (new URLSearchParams(window.location.search).get('engagement') === 'select-course') {
        setTimeout(() => window.S4UUI?.modal?.({title:'Select a Course',message:'Course Engagement opens from a specific course record. Use the Engagement button for the course you want to review.',type:'info',confirmText:'Close'}), 50);
    }

    try {
        client = await waitForClient();
        if (!client) throw new Error("Supabase client was not found.");

        await requireSession();
        await loadAll();
    } catch (error) {
        console.error(error);
        tableError(error.message || "Unable to load courses.");
    }
}

function cache() {
    [
        "courseMetricTotal",
        "courseMetricPublished",
        "courseMetricDraft",
        "courseMetricArchived",
        "courseCount",
        "courseSearch",
        "courseStatus",
        "courseSort",
        "courseClear",
        "courseTableBody",
        "courseResults",
        "coursePrevious",
        "courseNext",
        "coursePage",
        "courseDeleteModal",
        "courseDeleteName",
        "courseDeleteConfirm"
    ].forEach(id => el[id] = document.getElementById(id));
}

function bind() {
    el.courseSearch?.addEventListener("input", () => {
        page = 1;
        render();
    });

    el.courseStatus?.addEventListener("change", () => {
        page = 1;
        render();
    });

    el.courseSort?.addEventListener("change", () => {
        page = 1;
        render();
    });

    el.courseClear?.addEventListener("click", () => {
        el.courseSearch.value = "";
        el.courseStatus.value = "";
        el.courseSort.value = "newest";
        page = 1;
        render();
    });

    el.coursePrevious?.addEventListener("click", () => {
        if (page > 1) {
            page--;
            renderPage();
        }
    });

    el.courseNext?.addEventListener("click", () => {
        const max = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
        if (page < max) {
            page++;
            renderPage();
        }
    });

    el.courseTableBody?.addEventListener("click", event => {
        const editButton = event.target.closest("[data-edit-course]");
        if (editButton) {
            event.preventDefault();
            const courseId = String(editButton.dataset.editCourse || "").trim();
            if (!courseId || !courses.some(item => item.id === courseId)) {
                window.S4UUI?.modal?.({
                    title: "Course Not Available",
                    message: "The selected course record could not be found. Refresh the course list and try again.",
                    type: "error",
                    confirmText: "Close"
                });
                return;
            }
            window.location.assign(`admin-lms-course-builder.html?course=${encodeURIComponent(courseId)}`);
            return;
        }

        const button = event.target.closest("[data-delete-course]");
        if (!button) return;

        const course = courses.find(item => item.id === button.dataset.deleteCourse);
        if (course) openDeleteModal(course);
    });

    document.querySelectorAll("[data-course-delete-close]").forEach(button => {
        button.addEventListener("click", closeDeleteModal);
    });

    el.courseDeleteConfirm?.addEventListener("click", deleteCourse);

    document.addEventListener("keydown", event => {
        if (event.key === "Escape" && !el.courseDeleteModal?.hidden) {
            closeDeleteModal();
        }
    });
}

async function waitForClient(timeout = 3500) {
    const start = Date.now();

    while (Date.now() - start < timeout) {
        const c = await getClient();
        if (c?.from) return c;
        await new Promise(resolve => setTimeout(resolve, 75));
    }

    return null;
}

async function getClient() {
    try {
        if (typeof window.getScreenings4uSupabase === "function") {
            const c = await window.getScreenings4uSupabase();
            if (c?.from) return c;
        }
    } catch (_) {}

    if (window.screenings4uSupabase?.from) return window.screenings4uSupabase;
    if (window.supabaseClient?.from) return window.supabaseClient;

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
        return;
    }

    const { data, error } = await client.auth.getSession();

    if (error) throw error;

    if (!data?.session?.user) {
        location.replace("admin-login.html");
        throw new Error("Authentication required.");
    }
}

async function trainingReport(action,payload={}){
  const {data,error}=await client.auth.getSession();
  if(error)throw error;
  const token=data?.session?.access_token;
  if(!token)throw new Error("Your admin session has expired. Please sign in again.");
  const base=String(window.SCREENINGS4U_SUPABASE_URL||"https://elpbnytpciqnbexiaebp.supabase.co").replace(/\/$/,"");
  const anon=window.SCREENINGS4U_SUPABASE_ANON_KEY||window.SUPABASE_ANON_KEY||"";
  const response=await fetch(base+"/functions/v1/screenings4u-training-reporting",{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+token,...(anon?{"apikey":anon}:{})},body:JSON.stringify({action,...payload})});
  const out=await response.json().catch(()=>({}));
  if(!response.ok||out?.error)throw new Error(out?.error||"Training reporting request failed.");
  return out;
}

async function loadAll() {
    loading();
    const out = await trainingReport("course_directory");
    courses = out.courses || [];
    sections = out.sections || [];
    lessons = out.lessons || [];
    enrollments = out.enrollments || [];
    fillStatusFilter();
    updateMetrics();
    page = 1;
    render();
}

function fillStatusFilter() {
    const current = el.courseStatus.value;

    const statuses = [
        ...new Set(
            courses
                .map(course => String(course.status || "").toLowerCase())
                .filter(Boolean)
        )
    ].sort();

    el.courseStatus.innerHTML =
        '<option value="">All statuses</option>' +
        statuses
            .map(status => `<option value="${esc(status)}">${esc(human(status))}</option>`)
            .join("");

    if (statuses.includes(current)) {
        el.courseStatus.value = current;
    }
}

function updateMetrics() {
    const status = value =>
        courses.filter(course =>
            String(course.status || "").toLowerCase() === value
        ).length;

    el.courseMetricTotal.textContent = courses.length.toLocaleString();
    el.courseMetricPublished.textContent = status("published").toLocaleString();
    el.courseMetricDraft.textContent = status("draft").toLocaleString();
    el.courseMetricArchived.textContent = status("archived").toLocaleString();
}

function render() {
    const q = String(el.courseSearch.value || "").trim().toLowerCase();
    const status = el.courseStatus.value;

    filtered = courses.filter(course => {
        const hay = [
            course.title,
            course.slug,
            course.short_description,
            course.description,
            course.status
        ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

        return (
            (!q || hay.includes(q)) &&
            (!status || String(course.status).toLowerCase() === status)
        );
    });

    const mode = el.courseSort.value;

    filtered.sort((a, b) => {
        if (mode === "oldest") {
            return new Date(a.created_at || 0) - new Date(b.created_at || 0);
        }

        if (mode === "name") {
            return String(a.title || "").localeCompare(String(b.title || ""));
        }

        if (mode === "updated") {
            return new Date(b.updated_at || 0) - new Date(a.updated_at || 0);
        }

        return new Date(b.created_at || 0) - new Date(a.created_at || 0);
    });

    el.courseCount.textContent =
        `${filtered.length} Course${filtered.length === 1 ? "" : "s"}`;

    const max = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    if (page > max) page = max;

    renderPage();
}

function renderPage() {
    if (!filtered.length) {
        el.courseTableBody.innerHTML =
            '<tr><td colspan="7" class="course-empty">No courses match these filters.</td></tr>';

        el.courseResults.textContent = "0 courses";
        el.coursePage.textContent = "1";
        el.coursePrevious.disabled = true;
        el.courseNext.disabled = true;
        return;
    }

    const start = (page - 1) * PAGE_SIZE;
    const rows = filtered.slice(start, start + PAGE_SIZE);

    el.courseTableBody.innerHTML = rows.map(course => {
        const courseSections = sections.filter(section => section.course_id === course.id);
        const sectionIds = new Set(courseSections.map(section => section.id));
        const lessonCount = lessons.filter(lesson => sectionIds.has(lesson.section_id)).length;
        const enrollmentCount = enrollments.filter(enrollment => enrollment.course_id === course.id).length;

        const status = String(course.status || "").toLowerCase();
        const statusClass = ["published", "draft", "archived"].includes(status)
            ? status
            : "";

        const build =
            `admin-lms-course-builder.html?course=${encodeURIComponent(course.id)}`;
        const engagement =
            `admin-lms-course-engagement.html?course=${encodeURIComponent(course.id)}`;

        return `<tr>
            <td>
                <div class="course-name">
                    <strong>${esc(course.title || "Untitled Course")}</strong>
                    <small>${esc(course.short_description || course.slug || "No description")}</small>
                </div>
            </td>

            <td>
                <span class="course-badge ${esc(statusClass)}">
                    ${esc(human(course.status))}
                </span>
            </td>

            <td>${courseSections.length.toLocaleString()}</td>
            <td>${lessonCount.toLocaleString()}</td>
            <td>${enrollmentCount.toLocaleString()}</td>
            <td>${esc(dateTime(course.updated_at || course.created_at))}</td>

            <td>
                <div class="course-row-actions">
                    <button
                        class="course-row-btn danger"
                        type="button"
                        data-delete-course="${esc(course.id)}"
                    >Delete Course</button>

                    <a class="course-row-btn primary" href="${engagement}">Engagement</a>
                    <a class="course-row-btn" href="${build}" data-edit-course="${esc(course.id)}">Edit Course</a>
                </div>
            </td>
        </tr>`;
    }).join("");

    el.courseResults.textContent =
        `Showing ${start + 1}–${Math.min(start + PAGE_SIZE, filtered.length)} ` +
        `of ${filtered.length} course${filtered.length === 1 ? "" : "s"}`;

    el.coursePage.textContent = String(page);
    el.coursePrevious.disabled = page <= 1;
    el.courseNext.disabled = page >= Math.ceil(filtered.length / PAGE_SIZE);
}

function openDeleteModal(course) {
    pendingDeleteCourse = course;

    if (el.courseDeleteName) {
        el.courseDeleteName.textContent = course.title || "this course";
    }

    if (el.courseDeleteModal) {
        el.courseDeleteModal.hidden = false;
    }

    document.body.classList.add("course-delete-open");

    setTimeout(() => {
        el.courseDeleteConfirm?.focus();
    }, 0);
}

function closeDeleteModal() {
    pendingDeleteCourse = null;

    if (el.courseDeleteModal) {
        el.courseDeleteModal.hidden = true;
    }

    document.body.classList.remove("course-delete-open");

    if (el.courseDeleteConfirm) {
        el.courseDeleteConfirm.disabled = false;
        el.courseDeleteConfirm.textContent = "Delete Course";
    }
}

async function deleteCourse() {
    const course = pendingDeleteCourse;
    if (!course) return;

    try {
        el.courseDeleteConfirm.disabled = true;
        el.courseDeleteConfirm.textContent = "Deleting...";

        /*
         * Admin Delete is a soft delete. The course and all historical LMS records
         * remain in Supabase, while course_directory stops returning it to the admin portal.
         */
        await trainingReport("soft_delete_course", { course_id: course.id });

        closeDeleteModal();

        courses = courses.filter(item => item.id !== course.id);
        filtered = filtered.filter(item => item.id !== course.id);

        fillStatusFilter();
        updateMetrics();
        page = 1;
        render();

    } catch (error) {
        console.error("[Delete Course]", error);

        el.courseDeleteConfirm.disabled = false;
        el.courseDeleteConfirm.textContent = "Delete Course";

        window.S4UUI.modal({title:"Unable to Delete Course",message:error.message || "Unable to remove this course from the admin portal.",type:"error",confirmText:"Close"});
    }
}

function loading() {
    el.courseTableBody.innerHTML =
        '<tr><td colspan="7" class="course-loading">Loading courses...</td></tr>';
}

function tableError(text) {
    el.courseTableBody.innerHTML =
        `<tr><td colspan="7" class="course-error">${esc(text)}</td></tr>`;
}

function human(value) {
    return String(value || "—")
        .replace(/_/g, " ")
        .replace(/\b\w/g, character => character.toUpperCase());
}

function dateTime(value) {
    if (!value) return "—";

    const date = new Date(value);

    return Number.isNaN(date.getTime())
        ? "—"
        : date.toLocaleString(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit"
        });
}

function esc(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

})();
