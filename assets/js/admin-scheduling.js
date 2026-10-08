(() => {
  "use strict";

  console.info("[Admin Scheduling v7] FullCalendar 7.0.2 loading-state fix loaded.");

  const state = {
    calendar: null,
    services: [],
    staff: [],
    locations: [],
    appointments: [],
    visibleAppointments: [],
    selectedAppointment: null,
    selectedSlot: null,
    availableSlots: [],
    loadingCalendar: false,
    initialized: false,
  };

  const $ = (id) => document.getElementById(id);

  function getSupabaseClient() {
    return (
      window.supabaseClient ||
      window.supabaseClientInstance ||
      window.SUPABASE_CLIENT ||
      window.sb ||
      null
    );
  }

  async function invokeCalendar(payload) {
    const client = getSupabaseClient();

    if (!client?.auth?.getSession) {
      throw new Error(
        "Supabase client was not found. Verify assets/js/supabase-config.js exposes window.supabaseClient."
      );
    }

    const { data: sessionData, error: sessionError } =
      await client.auth.getSession();

    if (sessionError) {
      throw new Error(
        sessionError.message || "Unable to read the current admin session."
      );
    }

    const accessToken = sessionData?.session?.access_token;

    if (!accessToken) {
      throw new Error("No active admin login session was found.");
    }

    const projectUrl =
      client.supabaseUrl ||
      window.SUPABASE_URL ||
      window.supabaseUrl ||
      "https://rgsrubdtljyxmnihwlah.supabase.co";

    const anonKey =
      client.supabaseKey ||
      window.SUPABASE_ANON_KEY ||
      window.SUPABASE_PUBLISHABLE_KEY ||
      window.supabaseAnonKey ||
      "";

    const requestHeaders = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${accessToken}`,
    };

    if (anonKey) {
      requestHeaders["apikey"] = anonKey;
    }

    let response;

    try {
      response = await fetch(
        `${projectUrl}/functions/v1/scheduling-admin-calendar`,
        {
          method: "POST",
          headers: requestHeaders,
          body: JSON.stringify(payload || {}),
        }
      );
    } catch (networkError) {
      console.error("[Admin Scheduling v4] Network error:", networkError);
      throw new Error(
        networkError?.message
          ? `Scheduling network request failed: ${networkError.message}`
          : "Scheduling network request failed."
      );
    }

    const rawText = await response.text();

    let body = null;

    if (rawText) {
      try {
        body = JSON.parse(rawText);
      } catch (_) {
        body = null;
      }
    }

    if (!response.ok) {
      const message =
        body?.error ||
        body?.message ||
        rawText ||
        `Scheduling request failed with HTTP ${response.status}.`;

      console.error("[Admin Scheduling v4] Edge Function failure:", {
        action: payload?.action,
        status: response.status,
        statusText: response.statusText,
        response: body || rawText,
      });

      throw new Error(message);
    }

    if (body?.error) {
      throw new Error(body.error);
    }

    return body || {};
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function localIsoDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function formatDateTime(value, timezone) {
    if (!value) return { date: "—", time: "—" };
    const dt = new Date(value);
    const opts = timezone ? { timeZone: timezone } : {};
    return {
      date: new Intl.DateTimeFormat("en-US", { ...opts, weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(dt),
      time: new Intl.DateTimeFormat("en-US", { ...opts, hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(dt),
    };
  }

  function serviceById(id) {
    return state.services.find((item) => item.id === id) || null;
  }

  function staffById(id) {
    return state.staff.find((item) => item.id === id) || null;
  }

  function locationById(id) {
    return state.locations.find((item) => item.id === id) || null;
  }

  function setLoading(value) {
    state.loadingCalendar = value;
    const loading = $("calendarLoading");
    if (!loading) return;

    loading.hidden = !value;
    loading.setAttribute("aria-hidden", value ? "false" : "true");

    // Shared admin styles may override the native [hidden] attribute.
    // Enforce the actual visual state so the calendar can never remain
    // covered by a stale loading overlay.
    if (value) {
      loading.style.removeProperty("display");
    } else {
      loading.style.setProperty("display", "none", "important");
    }
  }

  function showFormError(message) {
    const box = $("schedulerFormError");
    box.textContent = message || "Something went wrong.";
    box.hidden = false;
  }

  function clearFormError() {
    $("schedulerFormError").hidden = true;
    $("schedulerFormError").textContent = "";
  }

  function openBackdrop() {
    $("schedulerBackdrop").hidden = false;
  }

  function closeBackdropIfUnused() {
    const drawerOpen = $("appointmentDrawer").classList.contains("is-open");
    const modalOpen = !$("appointmentModal").hidden;
    $("schedulerBackdrop").hidden = !(drawerOpen || modalOpen);
  }

  function closeDrawer() {
    $("appointmentDrawer").classList.remove("is-open");
    $("appointmentDrawer").setAttribute("aria-hidden", "true");
    closeBackdropIfUnused();
  }

  function openDrawer(appointment) {
    state.selectedAppointment = appointment;
    const svc = serviceById(appointment.event_type_id);
    const staff = staffById(appointment.staff_id);
    const loc = locationById(appointment.location_id);
    const start = formatDateTime(appointment.start_at, appointment.timezone);
    const end = appointment.end_at
      ? new Intl.DateTimeFormat("en-US", {
          timeZone: appointment.timezone || undefined,
          hour: "numeric",
          minute: "2-digit",
          timeZoneName: "short",
        }).format(new Date(appointment.end_at))
      : "—";

    $("drawerTracking").textContent = appointment.tracking_number || "Appointment";
    $("drawerTitle").textContent = appointment.title || svc?.name || "Appointment details";
    $("drawerStatus").textContent = String(appointment.status || "scheduled").replaceAll("_", " ");
    $("drawerStatus").dataset.status = appointment.status || "scheduled";
    $("drawerDate").textContent = start.date;
    $("drawerTime").textContent = `${start.time} – ${end}`;
    $("drawerCustomer").textContent = appointment.attendee_name || "—";
    $("drawerEmail").textContent = appointment.attendee_email || "—";
    $("drawerPhone").textContent = appointment.attendee_phone || "—";
    $("drawerStaff").textContent = staff?.display_name || appointment.host_name || "Any / Unassigned";
    $("drawerLocation").textContent = loc?.name || appointment.location_name || appointment.location_address || "—";
    $("drawerSource").textContent = appointment.booking_source || appointment.booked_via || "—";

    const active = ["scheduled", "confirmed", "rescheduled"].includes(appointment.status);
    $("rescheduleAppointmentBtn").disabled = !active || !appointment.event_type_id;
    $("cancelAppointmentBtn").disabled = !active || !appointment.event_type_id;

    openBackdrop();
    $("appointmentDrawer").classList.add("is-open");
    $("appointmentDrawer").setAttribute("aria-hidden", "false");
  }

  function closeAppointmentModal() {
    $("appointmentModal").hidden = true;
    state.selectedSlot = null;
    closeBackdropIfUnused();
  }

  function resetAppointmentForm() {
    $("appointmentForm").reset();
    $("formMode").value = "create";
    $("formAppointmentId").value = "";
    $("formPartySize").value = "1";
    $("availableSlots").innerHTML = "";
    $("availabilityHint").textContent = "Choose an appointment type and date.";
    $("saveAppointmentBtn").textContent = "Schedule Appointment";
    $("saveAppointmentBtn").disabled = true;
    $("appointmentModalTitle").textContent = "New Appointment";
    $("appointmentModalEyebrow").textContent = "Admin Scheduling";
    $("formService").disabled = false;
    $("customerFields").hidden = false;
    state.selectedSlot = null;
    clearFormError();
  }

  function openCreateModal(date = null) {
    resetAppointmentForm();
    if (date) $("formDate").value = localIsoDate(date);
    openBackdrop();
    $("appointmentModal").hidden = false;
  }

  function openRescheduleModal() {
    const a = state.selectedAppointment;
    if (!a?.event_type_id) return;

    closeDrawer();
    resetAppointmentForm();
    $("formMode").value = "reschedule";
    $("formAppointmentId").value = a.id;
    $("formService").value = a.event_type_id;
    $("formService").disabled = true;
    $("formStaff").value = a.staff_id || "";
    $("formLocation").value = a.location_id || "";
    $("formPartySize").value = String(a.party_size || 1);
    $("formDate").value = localIsoDate(new Date(a.start_at));
    $("customerFields").hidden = true;
    $("appointmentModalTitle").textContent = "Reschedule Appointment";
    $("appointmentModalEyebrow").textContent = a.tracking_number || "Appointment";
    $("saveAppointmentBtn").textContent = "Save New Time";
    openBackdrop();
    $("appointmentModal").hidden = false;
    loadAvailability();
  }

  function populateSelect(select, rows, placeholder, labelKey) {
    select.innerHTML = `<option value="">${escapeHtml(placeholder)}</option>`;
    rows.forEach((row) => {
      const option = document.createElement("option");
      option.value = row.id;
      option.textContent = row[labelKey] || "Unnamed";
      select.append(option);
    });
  }

  function populateFiltersAndForms() {
    populateSelect($("filterService"), state.services, "All appointment types", "name");
    populateSelect($("filterStaff"), state.staff, "All staff", "display_name");
    populateSelect($("filterLocation"), state.locations, "All locations", "name");

    populateSelect($("formService"), state.services, "Select appointment type", "name");
    populateSelect($("formStaff"), state.staff, "Any available staff", "display_name");
    populateSelect($("formLocation"), state.locations, "Any available location", "name");
  }

  async function bootstrap() {
    const data = await invokeCalendar({ action: "bootstrap" });
    state.services = data.services || [];
    state.staff = data.staff || [];
    state.locations = data.locations || [];
    populateFiltersAndForms();
    $("schedulerEmptyConfig").hidden = state.services.length > 0;
    $("newAppointmentBtn").disabled = state.services.length === 0;
  }

  function calendarRange() {
    const view = state.calendar.view;
    return {
      start: view.activeStart.toISOString(),
      end: view.activeEnd.toISOString(),
    };
  }

  async function loadAppointments() {
    if (!state.calendar || state.loadingCalendar) return;
    setLoading(true);
    try {
      const range = calendarRange();
      const data = await invokeCalendar({
        action: "list",
        start: range.start,
        end: range.end,
        event_type_id: $("filterService").value || null,
        staff_id: $("filterStaff").value || null,
        location_id: $("filterLocation").value || null,
        status: $("filterStatus").value || null,
      });
      state.appointments = data.appointments || [];
      applySearchFilter();
    } catch (error) {
      console.error(error);
      alert(error.message || "Unable to load appointments.");
    } finally {
      setLoading(false);
    }
  }

  function applySearchFilter() {
    const q = $("calendarSearch").value.trim().toLowerCase();
    state.visibleAppointments = !q
      ? [...state.appointments]
      : state.appointments.filter((a) => [
          a.tracking_number,
          a.title,
          a.attendee_name,
          a.attendee_email,
          a.attendee_phone,
          a.host_name,
          a.location_name,
        ].some((v) => String(v || "").toLowerCase().includes(q)));
    renderCalendarEvents();
  }

  function eventColor(appointment) {
    if (appointment.status === "cancelled") return "#7b8494";
    if (appointment.status === "completed") return "#16835f";
    if (appointment.status === "no_show") return "#c45100";
    return serviceById(appointment.event_type_id)?.color || "#124b8e";
  }

  function renderCalendarEvents() {
    if (!state.calendar) return;
    state.calendar.removeAllEvents();
    state.calendar.addEventSource(state.visibleAppointments.map((a) => ({
      id: a.id,
      title: a.title || serviceById(a.event_type_id)?.name || "Appointment",
      start: a.start_at,
      end: a.end_at,
      backgroundColor: eventColor(a),
      borderColor: eventColor(a),
      textColor: "#ffffff",
      extendedProps: { appointment: a },
    })));
  }

  function initializeCalendar() {
    const calendarEl = $("adminSchedulingCalendar");
    state.calendar = new FullCalendar.Calendar(calendarEl, {
      initialView: "dayGridMonth",
      headerToolbar: false,
      firstDay: 0,
      nowIndicator: true,
      selectable: true,
      selectMirror: true,
      editable: false,
      eventStartEditable: false,
      eventDurationEditable: false,
      allDaySlot: false,
      slotMinTime: "06:00:00",
      slotMaxTime: "22:00:00",
      slotDuration: "00:30:00",
      height: "auto",
      dayMaxEvents: 4,
      displayEventTime: true,
      datesSet(info) {
        $("calendarRangeTitle").textContent = info.view.title;
        document.querySelectorAll("[data-calendar-view]").forEach((button) => {
          button.classList.toggle("is-active", button.dataset.calendarView === info.view.type);
        });
        window.clearTimeout(initializeCalendar._loadTimer);
        initializeCalendar._loadTimer = window.setTimeout(loadAppointments, 0);
      },
      dateClick(info) {
        if (!state.services.length) return;
        openCreateModal(info.date);
      },
      select(info) {
        if (!state.services.length) return;
        openCreateModal(info.start);
        state.calendar.unselect();
      },
      eventClick(info) {
        openDrawer(info.event.extendedProps.appointment);
      },
      eventContent(arg) {
        const a = arg.event.extendedProps.appointment;
        const customer = a.attendee_name || a.attendee_email || "";
        const className = a.status === "cancelled" ? " scheduler-event-cancelled" : "";
        return {
          html: `<div class="scheduler-event-content${className}">
            <span class="scheduler-event-time">${escapeHtml(arg.timeText || "")}</span>
            <span class="scheduler-event-name">${escapeHtml(arg.event.title)}</span>
            ${customer ? `<span class="scheduler-event-customer">${escapeHtml(customer)}</span>` : ""}
          </div>`,
        };
      },
    });
    state.calendar.render();

  }

  function selectAvailableSlot(index, button) {
    const slot = state.availableSlots[index];
    if (!slot?.slot_start || !button) {
      showFormError("That appointment time is no longer available. Refresh the available times and try again.");
      return false;
    }

    const slotsEl = $("availableSlots");
    slotsEl.querySelectorAll("button.scheduler-slot").forEach((item) => {
      const selected = item === button;
      item.classList.toggle("is-selected", selected);
      item.setAttribute("aria-pressed", selected ? "true" : "false");
      item.dataset.selected = selected ? "true" : "false";
    });

    state.selectedSlot = slot;
    clearFormError();
    $("saveAppointmentBtn").disabled = false;
    $("availabilityHint").textContent = `${button.dataset.timeLabel || button.textContent.replace("✓", "").trim()} selected.`;
    return true;
  }

  async function loadAvailability() {
    clearFormError();
    state.selectedSlot = null;
    state.availableSlots = [];
    $("saveAppointmentBtn").disabled = true;
    const serviceId = $("formService").value;
    const date = $("formDate").value;
    const slotsEl = $("availableSlots");

    if (!serviceId || !date) {
      slotsEl.innerHTML = "";
      $("availabilityHint").textContent = "Choose an appointment type and date.";
      return;
    }

    slotsEl.innerHTML = `<div class="scheduler-no-slots">Checking availability…</div>`;
    $("availabilityHint").textContent = "Calculating real availability from schedules, staff, time off, resources, buffers, capacity and existing appointments.";

    try {
      const data = await invokeCalendar({
        action: "availability",
        event_type_id: serviceId,
        start_date: date,
        end_date: date,
        staff_id: $("formStaff").value || null,
        location_id: $("formLocation").value || null,
        party_size: Number($("formPartySize").value || 1),
        exclude_appointment_id: $("formMode").value === "reschedule" ? $("formAppointmentId").value : null,
      });

      const slots = data.slots || [];
      if (!slots.length) {
        slotsEl.innerHTML = `<div class="scheduler-no-slots">No available times for this date.</div>`;
        $("availabilityHint").textContent = "No slots satisfy the current scheduling rules.";
        return;
      }

      state.availableSlots = slots;
      $("availabilityHint").textContent = `${slots.length} available time${slots.length === 1 ? "" : "s"}. Select a time below.`;
      slotsEl.innerHTML = "";
      slots.forEach((slot, index) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "scheduler-slot";
        button.dataset.slotIndex = String(index);
        button.dataset.slotStart = slot.slot_start;
        button.dataset.selected = "false";
        button.setAttribute("aria-pressed", "false");
        const tz = slot.timezone || serviceById(serviceId)?.timezone || undefined;
        button.textContent = new Intl.DateTimeFormat("en-US", {
          timeZone: tz,
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        }).format(new Date(slot.slot_start));
        button.dataset.timeLabel = button.textContent;
        button.title = slot.staff_name ? `${button.textContent} — ${slot.staff_name}` : button.textContent;
        button.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          selectAvailableSlot(index, button);
        });
        slotsEl.append(button);
      });
    } catch (error) {
      slotsEl.innerHTML = `<div class="scheduler-no-slots">Unable to load availability.</div>`;
      showFormError(error.message);
    }
  }

  async function submitAppointment(event) {
    event.preventDefault();
    clearFormError();

    if (!state.selectedSlot?.slot_start) {
      showFormError("Select an available appointment time.");
      return;
    }

    const mode = $("formMode").value;
    const button = $("saveAppointmentBtn");
    button.disabled = true;
    const originalText = button.textContent;
    button.textContent = mode === "reschedule" ? "Saving…" : "Scheduling…";

    try {
      if (mode === "reschedule") {
        await invokeCalendar({
          action: "reschedule",
          appointment_id: $("formAppointmentId").value,
          start_at: state.selectedSlot.slot_start,
          staff_id: state.selectedSlot.staff_id || $("formStaff").value || null,
          location_id: $("formLocation").value || null,
          customer_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          metadata: { source: "admin_calendar" },
        });
      } else {
        const name = $("formCustomerName").value.trim();
        const email = $("formCustomerEmail").value.trim();
        if (!name || !email) throw new Error("Customer name and email are required.");

        await invokeCalendar({
          action: "create",
          event_type_id: $("formService").value,
          start_at: state.selectedSlot.slot_start,
          staff_id: state.selectedSlot.staff_id || $("formStaff").value || null,
          location_id: $("formLocation").value || null,
          attendee_name: name,
          attendee_email: email,
          attendee_phone: $("formCustomerPhone").value.trim() || null,
          party_size: Number($("formPartySize").value || 1),
          customer_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          metadata: { source: "admin_calendar" },
        });
      }

      closeAppointmentModal();
      await loadAppointments();
    } catch (error) {
      showFormError(error.message || "Unable to save appointment.");
    } finally {
      button.disabled = !state.selectedSlot?.slot_start;
      button.textContent = originalText;
    }
  }

  async function cancelSelectedAppointment() {
    const a = state.selectedAppointment;
    if (!a) return;
    const reason = window.prompt(`Cancel ${a.tracking_number || "this appointment"}?\n\nEnter a cancellation reason (optional):`, "");
    if (reason === null) return;

    const button = $("cancelAppointmentBtn");
    button.disabled = true;
    try {
      await invokeCalendar({
        action: "cancel",
        appointment_id: a.id,
        reason: reason.trim() || null,
      });
      closeDrawer();
      await loadAppointments();
    } catch (error) {
      alert(error.message || "Unable to cancel appointment.");
    } finally {
      button.disabled = false;
    }
  }

  function bindEvents() {
    $("calendarPrevBtn").addEventListener("click", () => state.calendar.prev());
    $("calendarTodayBtn").addEventListener("click", () => state.calendar.today());
    $("calendarNextBtn").addEventListener("click", () => state.calendar.next());

    document.querySelectorAll("[data-calendar-view]").forEach((button) => {
      button.addEventListener("click", () => state.calendar.changeView(button.dataset.calendarView));
    });

    ["filterService", "filterStaff", "filterLocation", "filterStatus"].forEach((id) => {
      $(id).addEventListener("change", loadAppointments);
    });
    $("calendarSearch").addEventListener("input", applySearchFilter);
    $("clearFiltersBtn").addEventListener("click", () => {
      $("filterService").value = "";
      $("filterStaff").value = "";
      $("filterLocation").value = "";
      $("filterStatus").value = "";
      $("calendarSearch").value = "";
      loadAppointments();
    });

    $("newAppointmentBtn").addEventListener("click", () => openCreateModal(new Date()));
    $("closeDrawerBtn").addEventListener("click", closeDrawer);
    $("schedulerBackdrop").addEventListener("click", () => {
      closeDrawer();
      closeAppointmentModal();
    });

    $("closeAppointmentModalBtn").addEventListener("click", closeAppointmentModal);
    $("cancelAppointmentModalBtn").addEventListener("click", closeAppointmentModal);
    $("appointmentForm").addEventListener("submit", submitAppointment);

    ["formService", "formDate", "formStaff", "formLocation", "formPartySize"].forEach((id) => {
      $(id).addEventListener("change", loadAvailability);
    });
    $("refreshAvailabilityBtn").addEventListener("click", loadAvailability);

    // Delegate slot selection from the container so dynamically generated times
    // remain reliably clickable after every availability refresh.
    $("availableSlots").addEventListener("click", (event) => {
      const button = event.target.closest("button.scheduler-slot");
      if (!button || !$("availableSlots").contains(button)) return;

      event.preventDefault();
      const index = Number(button.dataset.slotIndex);
      selectAvailableSlot(index, button);
    });

    $("rescheduleAppointmentBtn").addEventListener("click", openRescheduleModal);
    $("cancelAppointmentBtn").addEventListener("click", cancelSelectedAppointment);

    window.addEventListener("resize", () => {
    });

    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      closeDrawer();
      closeAppointmentModal();
    });
  }

  async function init() {
    if (state.initialized) return;
    state.initialized = true;

    // Always start with overlays closed. This also protects against
    // conflicting shared admin CSS that may override the HTML hidden attribute.
    $("appointmentModal").hidden = true;
    $("schedulerBackdrop").hidden = true;
    $("appointmentDrawer").classList.remove("is-open");
    $("appointmentDrawer").setAttribute("aria-hidden", "true");

    try {
      bindEvents();
      await bootstrap();
      initializeCalendar();
    } catch (error) {
      console.error("Admin scheduling failed to initialize:", error);
      alert(error.message || "Admin scheduling failed to initialize.");
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
