/* ============================================================
   SCREENINGS4U — ADMIN LMS COURSE PARTICIPANTS
   Builder-matched UI + live Supabase wiring
   ============================================================ */

(function () {
  "use strict";

  const TABLES = Object.freeze({
    courses: "lms_courses",
    enrollments: "lms_enrollments",
    profiles: "user_profiles",
    certificates: "lms_certificates",
    services: "services",
    servicePrices: "service_prices",
    invitations: "account_invitations"
  });

  const state = {
    courseId: "",
    course: null,
    courses: [],
    enrollments: [],
    profiles: [],
    profileMap: new Map(),
    certificates: [],
    certificateMap: new Map(),
    services: [],
    servicePrices: [],
    selectedEnrollmentId: "",
    filters: {
      search: "",
      status: "",
      progress: ""
    }
  };

  const $ = (id) => document.getElementById(id);

  document.addEventListener("DOMContentLoaded", initializeParticipants);

  async function initializeParticipants() {
    try {
      bindStaticUi();
      await waitForClient();
      await requireAdminSession();

      const params = new URLSearchParams(window.location.search);
      state.courseId =
        params.get("course") ||
        params.get("course_id") ||
        params.get("id") ||
        "";

      await loadCourseDirectory();
      ensureCourseSelector();

      if (state.courseId && state.courses.some((course) => course.id === state.courseId)) {
        await loadPageData();
        renderAll();
        syncCourseSelector();
      } else if (state.courses.length === 1) {
        state.courseId = state.courses[0].id;
        updateCourseUrl();
        await loadPageData();
        renderAll();
        syncCourseSelector();
      } else {
        state.courseId = "";
        renderNoCourseSelected();
        syncCourseSelector();
        setLoading(false);
      }

      if (state.courseId && params.get("invite") === "1") {
        openInviteModal();
      }
    } catch (error) {
      console.error("[Course Participants]", error);
      showToast(error?.message || "Unable to load course participants.", "error");
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

    if (!client) throw new Error("Supabase client is unavailable.");
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


  async function enrollmentAction(action, payload = {}) {
    const { data, error } = await db().auth.getSession();
    if (error) throw error;
    const token = data?.session?.access_token;
    if (!token) throw new Error("Your admin session has expired. Please sign in again.");
    const base = String(window.SCREENINGS4U_SUPABASE_URL || "https://elpbnytpciqnbexiaebp.supabase.co").replace(/\/$/, "");
    const anon = window.SCREENINGS4U_SUPABASE_ANON_KEY || window.SUPABASE_ANON_KEY || "";
    const response = await fetch(base + "/functions/v1/admin-lms-enrollment-actions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + token,
        ...(anon ? { "apikey": anon } : {})
      },
      body: JSON.stringify({ action, ...payload })
    });
    const out = await response.json().catch(() => ({}));
    if (!response.ok || out?.error) throw new Error(out?.error || "Enrollment request failed.");
    return out;
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
    select.innerHTML =
      '<option value="">Select a course to manage</option>' +
      state.courses
        .map(
          (course) =>
            `<option value="${esc(course.id)}">${esc(course.title || "Untitled Course")} · ${esc(titleCase(course.status || "draft"))}</option>`
        )
        .join("");

    select.addEventListener("change", async function () {
      state.courseId = this.value || "";
      updateCourseUrl();

      if (!state.courseId) {
        renderNoCourseSelected();
        return;
      }

      try {
        await loadPageData();
        renderAll();
        syncCourseSelector();
      } catch (error) {
        console.error("[Course Participants] Course selection", error);
        showToast(error?.message || "Unable to load selected course.", "error");
      }
    });

    const target = document.querySelector(".participants-header-actions");
    if (target) target.insertBefore(select, target.firstChild);
  }

  function syncCourseSelector() {
    const select = $("courseManagementSelect");
    if (select) select.value = state.courseId || "";
  }

  function updateCourseUrl() {
    const url = new URL(window.location.href);
    url.searchParams.delete("id");
    url.searchParams.delete("course_id");

    if (state.courseId) url.searchParams.set("course", state.courseId);
    else url.searchParams.delete("course");

    history.replaceState({}, "", url);
    applyCourseLinks();
  }

  async function loadPageData() {
    if (!state.courseId) return;
    setLoading(true);

    const out = await trainingReport("participants", { course_id: state.courseId });
    state.course = out.course;
    state.enrollments = out.enrollments || [];
    state.profiles = out.profiles || [];
    state.profileMap = new Map(state.profiles.map((profile) => [profile.id, profile]));
    state.certificates = out.certificates || [];
    state.certificateMap = new Map(state.certificates.map((certificate) => [certificate.enrollment_id, certificate]));

    const serviceResult = await db()
      .from(TABLES.services)
      .select("id,name,active,training_course_id")
      .eq("training_course_id", state.courseId);
    state.services = serviceResult.error ? [] : serviceResult.data || [];
    state.servicePrices = [];
    const serviceIds = state.services.map((service) => service.id);
    if (serviceIds.length) {
      const priceResult = await db()
        .from(TABLES.servicePrices)
        .select("id,service_id,amount,currency,billing_interval,active,effective_from,effective_to")
        .in("service_id", serviceIds)
        .eq("active", true)
        .order("effective_from", { ascending: false });
      if (!priceResult.error) state.servicePrices = priceResult.data || [];
    }

    applyCourseLinks();
    setLoading(false);
  }

  async function reloadParticipantData() {
    const out = await trainingReport("participants", { course_id: state.courseId });
    state.enrollments = out.enrollments || [];
    state.profiles = out.profiles || state.profiles;
    state.profileMap = new Map(state.profiles.map((profile) => [profile.id, profile]));
    state.certificates = out.certificates || [];
    state.certificateMap = new Map(state.certificates.map((certificate) => [certificate.enrollment_id, certificate]));
    renderTable();
    populateInviteUsers();
  }

  function renderAll() {
    renderHeader();
    renderTable();
    populateInviteUsers();
  }

  function renderNoCourseSelected() {
    state.course = null;
    state.enrollments = [];
    state.certificates = [];
    state.certificateMap = new Map();

    setText("participantsCourseTitle", "Course Participants");
    setText("participantsBreadcrumbCourse", "Course Participants");
    setText("participantsCourseStatus", "Select Course");
    setText("participantsAccessStatus", "—");
    setText("participantCountHeading", "0");

    const empty = $("participantsEmpty");
    const wrap = $("participantsTableWrap");
    if (wrap) wrap.hidden = true;
    if (empty) {
      empty.hidden = false;
      const h3 = empty.querySelector("h3");
      const p = empty.querySelector("p");
      if (h3) h3.textContent = "Select a course";
      if (p) p.textContent = "Choose a course above to manage its participants.";
    }

    setLoading(false);
  }

  function renderHeader() {
    const course = state.course || {};
    const title = course.title || "Course";
    const status = normalizeStatus(course.status || "draft");

    setText("participantsCourseTitle", title);
    setText("participantsBreadcrumbCourse", title);
    setText("participantsCourseStatus", titleCase(status));
    setText("participantsAccessStatus", status === "archived" ? "Archived" : "Active");

    const courseBadge = $("participantsCourseStatus");
    if (courseBadge) courseBadge.classList.toggle("active", status === "published");
  }

  function renderTable() {
    const rows = getFilteredRows();
    setText("participantCountHeading", rows.length);

    const loading = $("participantsLoading");
    const empty = $("participantsEmpty");
    const wrap = $("participantsTableWrap");
    if (loading) loading.hidden = true;

    if (!state.courseId) return;

    if (!rows.length) {
      if (empty) {
        empty.hidden = false;
        const h3 = empty.querySelector("h3");
        const p = empty.querySelector("p");
        if (h3) h3.textContent = state.enrollments.length ? "No participants match these filters" : "No participants yet";
        if (p) p.textContent = state.enrollments.length
          ? "Change or clear the current filters to see participants."
          : "Add an existing Screenings4u user or create a pending account invitation for this course.";
      }
      if (wrap) wrap.hidden = true;
      return;
    }

    if (empty) empty.hidden = true;
    if (wrap) wrap.hidden = false;

    const body = $("participantsTableBody");
    if (!body) return;
    body.innerHTML = rows.map(participantRowTemplate).join("");
    bindRowActions();
  }

  function participantRowTemplate(enrollment) {
    const profile = state.profileMap.get(enrollment.user_id) || {};
    const certificate = state.certificateMap.get(enrollment.id);
    const name = getProfileName(profile);
    const progress = clampProgress(enrollment.progress_percent);
    const performance = getPerformanceLabel(progress);
    const status = normalizeStatus(enrollment.status);
    const pricing = getPricingLabel(enrollment);

    return `
      <tr>
        <td>
          <div class="participant-name-cell">
            <span class="participant-avatar" title="${esc(name)}">${esc(getInitials(name))}</span>
            <div class="participant-name-copy">
              <strong>${esc(name)}</strong>
              <div class="participant-name-badges">
                <span class="participant-mini-badge progress">${esc(getShortStatusLabel(status))}</span>
                <span class="participant-mini-badge plan">${esc(pricing.short)}</span>
              </div>
              ${profile.email ? `<small>${esc(profile.email)}</small>` : ""}
            </div>
          </div>
        </td>
        <td>
          <div class="participant-progress">
            <strong>${progress}%</strong>
            <small class="${performance.className}">${esc(performance.label)}</small>
          </div>
        </td>
        <td>${esc(formatDate(enrollment.last_activity_at || enrollment.started_at || enrollment.enrolled_at))}</td>
        <td>${esc(formatDate(enrollment.enrolled_at || enrollment.created_at))}</td>
        <td><span class="participant-pricing" title="${esc(pricing.title)}">${esc(pricing.label)}</span></td>
        <td><span class="participant-certificate ${certificate && !certificate.revoked_at ? "issued" : ""}">${esc(getCertificateText(certificate, enrollment))}</span></td>
        <td>
          <button type="button" class="participant-row-action" data-participant-menu="${esc(enrollment.id)}" aria-label="Participant actions">•••</button>
        </td>
      </tr>
    `;
  }

  function getPricingLabel(enrollment) {
    const source = String(enrollment?.assignment_source || "").toLowerCase();

    if (source === "credit") {
      return { label: "Training Credit", short: "Credit", title: "Enrollment assigned using employer training credits." };
    }
    if (source === "admin") {
      return { label: "Admin Assigned", short: "Admin", title: "Enrollment created by an administrator." };
    }
    if (source === "direct_purchase" || source === "self_purchase" || enrollment?.order_item_id) {
      return { label: "Paid", short: "Paid", title: "Enrollment is linked to a direct or self purchase." };
    }

    const service = state.services.find((item) => item.active !== false) || state.services[0];
    const price = service
      ? state.servicePrices.find((item) => item.service_id === service.id && item.active !== false)
      : null;

    if (price) {
      const amount = Number(price.amount);
      const currency = String(price.currency || "USD").toUpperCase();
      const formatted = Number.isFinite(amount)
        ? new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amount)
        : "Paid";
      return { label: formatted, short: "Paid", title: `${service?.name || "Course service"} · ${formatted}` };
    }

    return { label: "Included", short: "Access", title: "No active course price is linked to this enrollment." };
  }

  function getFilteredRows() {
    const query = state.filters.search.trim().toLowerCase();

    return state.enrollments.filter((enrollment) => {
      const status = normalizeStatus(enrollment.status);
      const profile = state.profileMap.get(enrollment.user_id) || {};
      const name = getProfileName(profile);
      const email = String(profile.email || "");
      const progress = clampProgress(enrollment.progress_percent);

      if (query && !name.toLowerCase().includes(query) && !email.toLowerCase().includes(query)) return false;
      if (state.filters.status && status !== state.filters.status) return false;
      if (state.filters.progress === "not-started" && progress !== 0) return false;
      if (state.filters.progress === "in-progress" && !(progress > 0 && progress < 100)) return false;
      if (state.filters.progress === "completed" && progress < 100 && status !== "completed") return false;

      return true;
    });
  }

  function populateInviteUsers() {
    const select = $("inviteParticipantUser");
    if (!select) return;

    const enrolledUserIds = new Set(state.enrollments.map((row) => row.user_id));
    const available = state.profiles.filter(
      (profile) => profile.is_active !== false && !enrolledUserIds.has(profile.id)
    );

    select.innerHTML =
      '<option value="">Select an existing user</option>' +
      available
        .map(
          (profile) =>
            `<option value="${esc(profile.id)}">${esc(getProfileName(profile))}${profile.email ? " — " + esc(profile.email) : ""}</option>`
        )
        .join("");
  }

  function openInviteModal() {
    if (!state.courseId) {
      showToast("Select a course first.", "error");
      return;
    }
    const modal = $("inviteParticipantModal");
    if (modal) modal.hidden = false;
  }

  function closeInviteModal() {
    const modal = $("inviteParticipantModal");
    if (modal) modal.hidden = true;
  }

  function openAddParticipantModal() {
    closeInviteModal();
    if ($("inviteParticipantUser")) $("inviteParticipantUser").value = "";
    if ($("inviteParticipantStatus")) $("inviteParticipantStatus").value = "active";
    renderSelectedUserPreview("");
    if ($("addParticipantModal")) $("addParticipantModal").hidden = false;
  }

  function closeAddParticipantModal() {
    if ($("addParticipantModal")) $("addParticipantModal").hidden = true;
  }

  function openEmailInviteModal() {
    closeInviteModal();
    if ($("participantInviteEmails")) $("participantInviteEmails").value = "";
    if ($("emailInviteModal")) $("emailInviteModal").hidden = false;
  }

  function closeEmailInviteModal() {
    if ($("emailInviteModal")) $("emailInviteModal").hidden = true;
  }

  async function copyInviteLink() {
    const url = new URL("https://training.screenings4u.com/training-login.html");
    url.searchParams.set("course", state.courseId);

    try {
      await navigator.clipboard.writeText(url.href);
      showToast("Course invite link copied.", "success");
    } catch (_) {
      await window.S4UUI.prompt("Copy this invite link:",{title:"Course Invite Link",label:"Invite Link",value:url.href,confirmText:"Close"});
    }
  }

  function renderSelectedUserPreview(userId) {
    const target = $("selectedUserPreview");
    if (!target) return;

    if (!userId) {
      target.textContent = "Select a user to view their account details.";
      return;
    }

    const profile = state.profileMap.get(userId);
    if (!profile) {
      target.textContent = "User profile not found.";
      return;
    }

    target.innerHTML = `
      <strong>${esc(getProfileName(profile))}</strong>
      <small>${esc(profile.email || "No email address")}</small>
      ${profile.company_name ? `<small>${esc(profile.company_name)}</small>` : ""}
    `;
  }

  async function saveParticipantEnrollment() {
    const userId = $("inviteParticipantUser")?.value || "";
    const status = $("inviteParticipantStatus")?.value || "active";

    if (!userId) {
      showToast("Select a participant.", "error");
      return;
    }

    const existing = state.enrollments.find((row) => row.user_id === userId);
    if (existing) {
      showToast("That user is already enrolled in this course.", "error");
      return;
    }

    const button = $("saveParticipantEnrollment");
    if (button) button.disabled = true;

    try {
      const enrolled = await enrollmentAction("enroll", { user_id: userId, course_id: state.courseId });
      if (status === "completed" && enrolled?.id) {
        await enrollmentAction("update", { enrollment_id: enrolled.id, status: "completed" });
      }

      closeAddParticipantModal();
      await reloadParticipantData();
      showToast("Participant added to the course.", "success");
    } catch (error) {
      console.error("[Course Participants] Add participant:", error);
      showToast(error?.message || "Unable to add participant.", "error");
    } finally {
      if (button) button.disabled = false;
    }
  }

  async function createEmailInvitations() {
    const field = $("participantInviteEmails");
    const button = $("sendParticipantInvites");
    const raw = field?.value || "";

    const emails = [...new Set(
      raw
        .split(/[\n,;]+/)
        .map((value) => value.trim().toLowerCase())
        .filter(Boolean)
    )];

    if (!emails.length) {
      showToast("Enter at least one email address.", "error");
      return;
    }

    const invalid = emails.filter((email) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
    if (invalid.length) {
      showToast(`Check these email addresses: ${invalid.join(", ")}`, "error");
      return;
    }

    if (button) button.disabled = true;

    try {
      const enrolledUserIds = new Set(state.enrollments.map((row) => row.user_id));
      const profileByEmail = new Map(
        state.profiles
          .filter((profile) => profile.email)
          .map((profile) => [String(profile.email).trim().toLowerCase(), profile])
      );

      const enrollPayload = [];
      const invitePayload = [];

      for (const email of emails) {
        const profile = profileByEmail.get(email);

        if (profile) {
          if (!enrolledUserIds.has(profile.id)) {
            enrollPayload.push({
              user_id: profile.id,
              course_id: state.courseId,
              status: "active",
              progress_percent: 0,
              assignment_source: "admin"
            });
          }
          continue;
        }

        invitePayload.push({
          email,
          requested_role: "client_user",
          status: "pending",
          metadata: {
            source: "lms_course_participants",
            course_id: state.courseId,
            course_title: state.course?.title || "Course"
          }
        });
      }

      if (enrollPayload.length) {
        for (const row of enrollPayload) {
          await enrollmentAction("enroll", { user_id: row.user_id, course_id: row.course_id });
        }
      }

      if (invitePayload.length) {
        const inviteResult = await db().from(TABLES.invitations).insert(invitePayload);
        if (inviteResult.error) throw inviteResult.error;
      }

      closeEmailInviteModal();
      await reloadParticipantData();

      const parts = [];
      if (enrollPayload.length) parts.push(`${enrollPayload.length} existing user${enrollPayload.length === 1 ? "" : "s"} enrolled`);
      if (invitePayload.length) parts.push(`${invitePayload.length} pending account invitation${invitePayload.length === 1 ? "" : "s"} created`);
      const already = emails.length - enrollPayload.length - invitePayload.length;
      if (already > 0) parts.push(`${already} already enrolled`);

      showToast(parts.join(" · ") || "No changes were needed.", "success");
    } catch (error) {
      console.error("[Course Participants] Create invitations:", error);
      showToast(error?.message || "Unable to create course invitations.", "error");
    } finally {
      if (button) button.disabled = false;
    }
  }

  function bindRowActions() {
    document.querySelectorAll("[data-participant-menu]").forEach((button) => {
      button.addEventListener("click", function (event) {
        event.stopPropagation();
        openRowMenu(button, button.dataset.participantMenu);
      });
    });
  }

  function openRowMenu(button, enrollmentId) {
    const menu = $("participantRowMenu");
    if (!menu) return;

    state.selectedEnrollmentId = enrollmentId || "";
    const enrollment = state.enrollments.find((row) => row.id === state.selectedEnrollmentId);

    const suspendAction = $("participantSuspendAction");
    const completeAction = $("participantCompleteAction");

    if (suspendAction && enrollment) {
      suspendAction.lastChild.textContent = normalizeStatus(enrollment.status) === "suspended"
        ? " Reactivate participant"
        : " Suspend participant";
    }

    if (completeAction && enrollment) {
      completeAction.hidden = normalizeStatus(enrollment.status) === "completed";
    }

    const rect = button.getBoundingClientRect();
    menu.style.top = Math.min(window.innerHeight - 240, rect.bottom + 5) + "px";
    menu.style.left = Math.max(10, rect.right - 210) + "px";
    menu.hidden = false;
  }

  function closeRowMenu() {
    const menu = $("participantRowMenu");
    if (menu) menu.hidden = true;
    state.selectedEnrollmentId = "";
  }

  async function handleRowAction(action) {
    const enrollment = state.enrollments.find((row) => row.id === state.selectedEnrollmentId);
    if (!enrollment) {
      closeRowMenu();
      return;
    }

    if (action === "view") {
      window.location.href =
        `admin-lms-students.html?user=${encodeURIComponent(enrollment.user_id)}&course=${encodeURIComponent(state.courseId)}`;
      return;
    }

    if (action === "message") {
      window.location.href =
        `admin-lms-course-engagement.html?course=${encodeURIComponent(state.courseId)}&user=${encodeURIComponent(enrollment.user_id)}`;
      return;
    }

    if (action === "complete") {
      const now = new Date().toISOString();
      await updateEnrollment(
        enrollment.id,
        {
          progress_percent: 100,
          status: "completed",
          started_at: enrollment.started_at || now,
          completed_at: now,
          last_activity_at: now
        },
        "Participant marked completed."
      );
      return;
    }

    if (action === "toggle-suspend") {
      const isSuspended = normalizeStatus(enrollment.status) === "suspended";
      await updateEnrollment(
        enrollment.id,
        { status: isSuspended ? "active" : "suspended" },
        isSuspended ? "Participant reactivated." : "Participant suspended."
      );
      return;
    }

    if (action === "remove") {
      const confirmed = await window.S4UUI.confirm(
        "Cancel this participant's course access? Enrollment history and progress will be preserved.",
        {title:"Cancel Course Access",confirmText:"Cancel Access"}
      );

      if (!confirmed) {
        closeRowMenu();
        return;
      }

      try {
        await enrollmentAction("cancel", { enrollment_id: enrollment.id });

        closeRowMenu();
        await reloadParticipantData();
        showToast("Participant access cancelled. Enrollment history was preserved.", "success");
      } catch (error) {
        console.error("[Course Participants] Cancel access:", error);
        showToast(error?.message || "Unable to cancel participant access.", "error");
      }
    }
  }

  async function updateEnrollment(enrollmentId, payload, successMessage) {
    try {
      const status = String(payload?.status || "").toLowerCase();
      if (!status) throw new Error("Enrollment status is required.");
      await enrollmentAction("update", { enrollment_id: enrollmentId, status });
      closeRowMenu();
      await reloadParticipantData();
      showToast(successMessage, "success");
    } catch (error) {
      console.error("[Course Participants] Enrollment update:", error);
      showToast(error?.message || "Unable to update enrollment.", "error");
    }
  }

  function exportParticipantsCsv() {
    const rows = getFilteredRows();

    if (!rows.length) {
      showToast("There are no participants to export.", "error");
      return;
    }

    const csvRows = [[
      "Name",
      "Email",
      "Progress",
      "Status",
      "Last Activity",
      "Date Joined",
      "Completed At",
      "Assignment Source",
      "Certificate"
    ]];

    rows.forEach((enrollment) => {
      const profile = state.profileMap.get(enrollment.user_id) || {};
      const certificate = state.certificateMap.get(enrollment.id);
      csvRows.push([
        getProfileName(profile),
        profile.email || "",
        clampProgress(enrollment.progress_percent) + "%",
        titleCase(normalizeStatus(enrollment.status)),
        formatDate(enrollment.last_activity_at),
        formatDate(enrollment.enrolled_at || enrollment.created_at),
        formatDate(enrollment.completed_at),
        enrollment.assignment_source || "",
        getCertificateText(certificate, enrollment)
      ]);
    });

    const csv = csvRows.map((row) => row.map(csvCell).join(",")).join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = slugify(state.course?.title || "course") + "-participants.csv";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);

    closeCourseMenu();
    showToast("Participant export created.", "success");
  }

  function bindStaticUi() {
    $("participantsMoreButton")?.addEventListener("click", function (event) {
      event.stopPropagation();
      const menu = $("participantsMoreMenu");
      if (!menu) return;
      const opening = menu.hidden;
      menu.hidden = !opening;
      this.setAttribute("aria-expanded", opening ? "true" : "false");
    });

    $("participantFilterButton")?.addEventListener("click", function (event) {
      event.stopPropagation();
      const menu = $("participantFilterMenu");
      if (!menu) return;
      const opening = menu.hidden;
      menu.hidden = !opening;
      this.setAttribute("aria-expanded", opening ? "true" : "false");
    });

    $("participantFilterMenu")?.addEventListener("click", (event) => event.stopPropagation());

    document.addEventListener("click", function () {
      closeCourseMenu();
      closeFilterMenu();
      closeRowMenu();
    });

    $("participantSearch")?.addEventListener("input", function () {
      state.filters.search = this.value || "";
      renderTable();
    });

    $("participantStatusFilter")?.addEventListener("change", function () {
      state.filters.status = this.value || "";
      renderTable();
    });

    $("participantProgressFilter")?.addEventListener("change", function () {
      state.filters.progress = this.value || "";
      renderTable();
    });

    $("clearParticipantFilters")?.addEventListener("click", function () {
      state.filters = { search: "", status: "", progress: "" };
      if ($("participantSearch")) $("participantSearch").value = "";
      if ($("participantStatusFilter")) $("participantStatusFilter").value = "";
      if ($("participantProgressFilter")) $("participantProgressFilter").value = "";
      renderTable();
    });

    $("participantsExportQuickButton")?.addEventListener("click", exportParticipantsCsv);
    $("participantsExportButton")?.addEventListener("click", exportParticipantsCsv);
    $("inviteParticipantsButton")?.addEventListener("click", openInviteModal);
    $("emptyInviteParticipantsButton")?.addEventListener("click", openInviteModal);
    $("addToProgramButton")?.addEventListener("click", openAddParticipantModal);
    $("inviteToProgramButton")?.addEventListener("click", openEmailInviteModal);
    $("copyProgramInviteLink")?.addEventListener("click", copyInviteLink);
    $("saveParticipantEnrollment")?.addEventListener("click", saveParticipantEnrollment);
    $("sendParticipantInvites")?.addEventListener("click", createEmailInvitations);

    $("participantsBulkMessageButton")?.addEventListener("click", function () {
      if (!state.courseId) return;
      window.location.href = `admin-lms-course-engagement.html?course=${encodeURIComponent(state.courseId)}`;
    });

    $("inviteParticipantUser")?.addEventListener("change", function () {
      renderSelectedUserPreview(this.value);
    });

    document.querySelectorAll("[data-close-participant-modal]").forEach((button) =>
      button.addEventListener("click", closeInviteModal)
    );
    document.querySelectorAll("[data-close-add-modal]").forEach((button) =>
      button.addEventListener("click", closeAddParticipantModal)
    );
    document.querySelectorAll("[data-close-email-modal]").forEach((button) =>
      button.addEventListener("click", closeEmailInviteModal)
    );

    [
      ["inviteParticipantModal", closeInviteModal],
      ["addParticipantModal", closeAddParticipantModal],
      ["emailInviteModal", closeEmailInviteModal]
    ].forEach(([id, closer]) => {
      $(id)?.addEventListener("click", function (event) {
        if (event.target === event.currentTarget) closer();
      });
    });

    $("participantRowMenu")?.addEventListener("click", function (event) {
      event.stopPropagation();
      const button = event.target.closest("[data-row-action]");
      if (button) handleRowAction(button.dataset.rowAction);
    });

    document.querySelectorAll("[data-course-tab]").forEach((tab) => {
      tab.addEventListener("click", function (event) {
        event.preventDefault();
        navigateTab(tab.dataset.courseTab);
      });
    });

    document.addEventListener("keydown", function (event) {
      if (event.key !== "Escape") return;
      closeCourseMenu();
      closeFilterMenu();
      closeRowMenu();
      closeInviteModal();
      closeAddParticipantModal();
      closeEmailInviteModal();
    });
  }

  function applyCourseLinks() {
    const preview = $("participantsPreviewButton");
    if (!preview) return;

    preview.href = state.courseId
      ? `admin-lms-course-preview.html?course=${encodeURIComponent(state.courseId)}`
      : "admin-lms-course-preview.html";
  }

  function navigateTab(tab) {
    const pages = {
      overview: "admin-lms-course-overview.html",
      content: "admin-lms-course-builder.html",
      participants: "admin-lms-course-participants.html",
      settings: "admin-lms-course-settings.html",
      engagement: "admin-lms-course-engagement.html"
    };

    const page = pages[tab];
    if (!page) return;

    window.location.href = state.courseId
      ? `${page}?course=${encodeURIComponent(state.courseId)}`
      : page;
  }

  function closeCourseMenu() {
    const menu = $("participantsMoreMenu");
    const button = $("participantsMoreButton");
    if (menu) menu.hidden = true;
    if (button) button.setAttribute("aria-expanded", "false");
  }

  function closeFilterMenu() {
    const menu = $("participantFilterMenu");
    const button = $("participantFilterButton");
    if (menu) menu.hidden = true;
    if (button) button.setAttribute("aria-expanded", "false");
  }

  function setLoading(value) {
    const loading = $("participantsLoading");
    if (loading) loading.hidden = !value;
  }

  function showToast(message, type) {
    const toast = $("participantsToast");
    if (!toast) return;

    toast.textContent = message || "";
    toast.className = "participants-toast show " + (type || "success");

    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove("show"), 4000);
  }

  function getProfileName(profile) {
    const display = String(profile?.display_name || "").trim();
    if (display) return display;

    const full = [profile?.first_name, profile?.last_name]
      .map((value) => String(value || "").trim())
      .filter(Boolean)
      .join(" ");

    return full || profile?.email || "Participant";
  }

  function getPerformanceLabel(progress) {
    if (progress >= 90) return { label: "Exceptional", className: "high" };
    if (progress >= 70) return { label: "High", className: "high" };
    if (progress >= 40) return { label: "Moderate", className: "medium" };
    return { label: progress === 0 ? "Not started" : "Low", className: "low" };
  }

  function getCertificateText(certificate, enrollment) {
    if (certificate && certificate.status !== "revoked" && !certificate.revoked_at) {
      return certificate.certificate_number || "Issued";
    }

    return normalizeStatus(enrollment.status) === "completed" ? "Not issued" : "—";
  }

  function getShortStatusLabel(status) {
    if (status === "active") return "In progress";
    if (status === "completed") return "Completed";
    if (status === "suspended") return "Suspended";
    if (status === "cancelled") return "Cancelled";
    return titleCase(status);
  }

  function clampProgress(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return 0;
    return Math.max(0, Math.min(100, Math.round(number)));
  }

  function formatDate(value) {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric"
    }).format(date);
  }

  function normalizeStatus(value) {
    return String(value || "").trim().toLowerCase().replace(/\s+/g, "_");
  }

  function titleCase(value) {
    return String(value || "")
      .replace(/[_-]+/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  function getInitials(name) {
    return String(name || "P")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || "")
      .join("") || "P";
  }

  function setText(id, value) {
    const node = $(id);
    if (node) node.textContent = value == null ? "" : String(value);
  }

  function slugify(value) {
    return String(value || "course")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "course";
  }

  function csvCell(value) {
    const text = String(value ?? "");
    return `"${text.replace(/"/g, '""')}"`;
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
