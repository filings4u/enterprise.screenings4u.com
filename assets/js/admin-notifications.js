/* ============================================================
   SCREENINGS4U — ADMIN NOTIFICATIONS

   Edge Function:
   notification-admin-actions

   Supported actions used by this page:
   - list
   - reply
   - delete
   ============================================================ */

(() => {
  "use strict";

  let db = null;
  let notifications = [];
  let profiles = [];
  let employers = [];
  let replyTarget = null;

  const E = {};

  document.addEventListener("DOMContentLoaded", init);


  async function init() {
    cache();
    bind();

    try {
      db = await getClient();

      if (!db) {
        throw new Error("Supabase client not found.");
      }

      await load();

    } catch (error) {
      console.error("[Admin Notifications]", error);

      message(
        error?.message ||
        "Unable to load notifications.",
        "error"
      );
    }
  }


  function cache() {
    [
      "refresh",
      "search",
      "total",
      "queued",
      "sent",
      "failed",
      "notificationBody",
      "emptyState",
      "message",
      "replyModal",
      "replyRecipient",
      "replySubject",
      "replyBody",
      "sendReply"
    ].forEach((id) => {
      E[id] = document.getElementById(id);
    });
  }


  function bind() {
    E.search?.addEventListener(
      "input",
      draw
    );

    E.refresh?.addEventListener(
      "click",
      load
    );

    E.notificationBody?.addEventListener(
      "click",
      handleTableClick
    );

    E.sendReply?.addEventListener(
      "click",
      sendReply
    );

    document
      .querySelectorAll("[data-close-reply]")
      .forEach((button) => {
        button.addEventListener(
          "click",
          closeReplyModal
        );
      });

    document.addEventListener(
      "keydown",
      (event) => {
        if (
          event.key === "Escape" &&
          E.replyModal &&
          !E.replyModal.hidden
        ) {
          closeReplyModal();
        }
      }
    );
  }


  async function getClient() {
    for (let i = 0; i < 40; i += 1) {
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
      "notification-admin-actions",
      {
        body
      }
    );

    if (error) {
      let text =
        error.message ||
        "Notification action failed.";

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

      notifications =
        Array.isArray(data.notifications)
          ? data.notifications
          : [];

      profiles =
        Array.isArray(data.profiles)
          ? data.profiles
          : [];

      employers =
        Array.isArray(data.employers)
          ? data.employers
          : [];

      updateStats();
      draw();

    } catch (error) {
      console.error(
        "[Load Notifications]",
        error
      );

      message(
        error?.message ||
        "Unable to load notifications.",
        "error"
      );

    } finally {
      setRefreshBusy(false);
    }
  }


  function updateStats() {
    E.total.textContent =
      String(
        notifications.length
      );

    E.queued.textContent =
      String(
        notifications.filter(
          (item) =>
            item.status ===
            "queued"
        ).length
      );

    E.sent.textContent =
      String(
        notifications.filter(
          (item) =>
            [
              "sent",
              "delivered"
            ].includes(
              item.status
            )
        ).length
      );

    E.failed.textContent =
      String(
        notifications.filter(
          (item) =>
            item.status ===
            "failed"
        ).length
      );
  }


  function recipientLabel(item) {
    const profile =
      profiles.find(
        (value) =>
          value.id ===
          item.recipient_user_id
      );

    const employer =
      employers.find(
        (value) =>
          value.id ===
          item.employer_id
      );

    return (
      employer?.employer_name ||
      profile?.display_name ||
      profile?.email ||
      item.recipient_email ||
      "Unknown"
    );
  }


  function recipientSecondary(item) {
    const profile =
      profiles.find(
        (value) =>
          value.id ===
          item.recipient_user_id
      );

    const employer =
      employers.find(
        (value) =>
          value.id ===
          item.employer_id
      );

    return (
      profile?.email ||
      employer?.billing_email ||
      employer?.email ||
      item.recipient_email ||
      ""
    );
  }


  function draw() {
    const query =
      String(
        E.search?.value ||
        ""
      )
        .trim()
        .toLowerCase();

    const filtered =
      notifications.filter(
        (item) => {
          if (!query) {
            return true;
          }

          const haystack = [
            recipientLabel(item),
            recipientSecondary(item),
            item.subject,
            item.body,
            item.channel,
            item.status
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

          return haystack.includes(
            query
          );
        }
      );

    E.notificationBody.innerHTML =
      filtered
        .map(
          (item) => `
            <tr>
              <td>
                <div class="notifications-recipient">
                  <strong>${esc(recipientLabel(item))}</strong>
                  ${
                    recipientSecondary(item)
                      ? `<div>${esc(recipientSecondary(item))}</div>`
                      : ""
                  }
                </div>
              </td>

              <td>
                <div class="notifications-subject">
                  <strong>${esc(item.subject || "Notification")}</strong>
                  <span>${esc(truncate(item.body || "", 150))}</span>
                </div>
              </td>

              <td>${esc(item.channel || "—")}</td>

              <td>
                <span class="notifications-badge ${escClass(item.status)}">
                  ${esc(human(item.status || "unknown"))}
                </span>
              </td>

              <td>
                ${esc(formatDate(item.created_at))}
              </td>

              <td>
                <div class="notifications-row-actions">
                  <button
                    class="notifications-button secondary"
                    type="button"
                    data-reply="${esc(item.id)}"
                  >
                    Respond
                  </button>

                  <button
                    class="notifications-button danger"
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


  async function handleTableClick(event) {
    const replyButton =
      event.target.closest(
        "[data-reply]"
      );

    if (replyButton) {
      openReplyModal(
        replyButton.dataset.reply
      );

      return;
    }

    const deleteButton =
      event.target.closest(
        "[data-delete]"
      );

    if (deleteButton) {
      await deleteNotification(
        deleteButton.dataset.delete,
        deleteButton
      );
    }
  }


  function openReplyModal(id) {
    const item =
      notifications.find(
        (value) =>
          String(value.id) ===
          String(id)
      );

    if (!item) {
      message(
        "Notification record not found.",
        "error"
      );

      return;
    }

    replyTarget = item;

    E.replyRecipient.textContent =
      recipientLabel(item);

    E.replySubject.value =
      `Re: ${item.subject || "Notification"}`;

    E.replyBody.value =
      "";

    E.replyModal.hidden =
      false;

    E.replyModal.setAttribute(
      "aria-hidden",
      "false"
    );

    document.body.classList.add(
      "notifications-modal-open"
    );

    window.setTimeout(
      () => {
        E.replyBody?.focus();
      },
      50
    );
  }


  function closeReplyModal() {
    replyTarget = null;

    if (!E.replyModal) {
      return;
    }

    E.replyModal.hidden =
      true;

    E.replyModal.setAttribute(
      "aria-hidden",
      "true"
    );

    document.body.classList.remove(
      "notifications-modal-open"
    );
  }


  async function sendReply() {
    if (!replyTarget) {
      return;
    }

    const subject =
      E.replySubject.value.trim();

    const body =
      E.replyBody.value.trim();

    if (!body) {
      message(
        "Enter a response before sending.",
        "error"
      );

      return;
    }

    setReplyBusy(true);

    try {
      await call({
        action: "reply",

        recipient_user_id:
          replyTarget.recipient_user_id ||
          null,

        employer_id:
          replyTarget.employer_id ||
          null,

        subject:
          subject ||
          `Re: ${replyTarget.subject || "Notification"}`,

        body
      });

      closeReplyModal();

      message(
        "Response thread created.",
        "ok"
      );

      await load();

    } catch (error) {
      console.error(
        "[Reply Notification]",
        error
      );

      message(
        error?.message ||
        "Unable to send response.",
        "error"
      );

    } finally {
      setReplyBusy(false);
    }
  }


  async function deleteNotification(
    id,
    button
  ) {
    const item =
      notifications.find(
        (value) =>
          String(value.id) ===
          String(id)
      );

    if (!item) {
      return;
    }

    const confirmed =
      window.confirm(
        `Delete "${item.subject || "Notification"}"?`
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

      notifications =
        notifications.filter(
          (value) =>
            String(value.id) !==
            String(item.id)
        );

      updateStats();
      draw();

      message(
        "Notification deleted.",
        "ok"
      );

    } catch (error) {
      console.error(
        "[Delete Notification]",
        error
      );

      message(
        error?.message ||
        "Unable to delete notification.",
        "error"
      );

      if (button) {
        button.disabled =
          false;
      }
    }
  }


  function setRefreshBusy(busy) {
    if (!E.refresh) {
      return;
    }

    E.refresh.disabled =
      busy;

    E.refresh.textContent =
      busy
        ? "Refreshing..."
        : "Refresh";
  }


  function setReplyBusy(busy) {
    if (!E.sendReply) {
      return;
    }

    E.sendReply.disabled =
      busy;

    E.sendReply.textContent =
      busy
        ? "Sending..."
        : "Send Response";
  }


  function truncate(
    value,
    length
  ) {
    const text =
      String(value || "");

    if (
      text.length <=
      length
    ) {
      return text;
    }

    return `${text.slice(0, length).trim()}…`;
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
      value || ""
    )
      .replace(/_/g, " ")
      .replace(
        /\b\w/g,
        (letter) =>
          letter.toUpperCase()
      );
  }


  function escClass(value) {
    return String(
      value || ""
    )
      .toLowerCase()
      .replace(
        /[^a-z0-9_-]/g,
        ""
      );
  }


  function esc(value) {
    return String(
      value ?? ""
    )
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
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
      `notifications-message show ${type}`;

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
