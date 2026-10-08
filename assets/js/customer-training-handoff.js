(() => {
  "use strict";

  const TRAINING_ORIGIN = "https://training.screenings4u.com";
  const DEFAULT_NEXT = "/lms-dashboard.html";
  const HANDOFF_FUNCTION = "create-training-handoff";

  let handoffInProgress = false;

  function getSupabaseClient() {
    if (typeof window.getScreenings4uSupabase === "function") {
      return window.getScreenings4uSupabase();
    }

    if (window.screenings4uSupabase?.auth) {
      return window.screenings4uSupabase;
    }

    if (window.supabaseClient?.auth) {
      return window.supabaseClient;
    }

    throw new Error(
      "The screenings4u authentication service is unavailable. Please refresh the page."
    );
  }

  function normalizeTrainingTarget(href) {
    try {
      const url = new URL(href, window.location.href);

      if (url.origin !== TRAINING_ORIGIN) {
        return null;
      }

      const filename =
        url.pathname
          .split("/")
          .filter(Boolean)
          .pop()
          ?.toLowerCase() || "";

      if (
        filename === "training-login.html" ||
        filename === "reset-password.html" ||
        filename === "training-handoff.html"
      ) {
        return DEFAULT_NEXT;
      }

      return `${url.pathname}${url.search}${url.hash}` || DEFAULT_NEXT;
    } catch {
      return null;
    }
  }

  function isModifiedClick(event) {
    return (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    );
  }

  function setLinkBusy(link, busy) {
    if (!(link instanceof HTMLElement)) {
      return;
    }

    if (busy) {
      if (!link.dataset.s4uOriginalText) {
        link.dataset.s4uOriginalText = link.textContent || "";
      }

      link.setAttribute("aria-busy", "true");
      link.classList.add("s4u-training-handoff-pending");
    } else {
      link.removeAttribute("aria-busy");
      link.classList.remove("s4u-training-handoff-pending");
    }
  }

  async function openTraining(next = DEFAULT_NEXT) {
    if (handoffInProgress) {
      return;
    }

    handoffInProgress = true;

    try {
      const client = await getSupabaseClient();

      const {
        data: { session },
        error: sessionError
      } = await client.auth.getSession();

      if (sessionError) {
        throw sessionError;
      }

      if (!session?.access_token) {
        const customerLogin = new URL(
          "customer-login.html",
          window.location.origin + "/"
        );

        customerLogin.searchParams.set(
          "returnTo",
          `${window.location.pathname}${window.location.search}${window.location.hash}`
        );

        window.location.assign(customerLogin.href);
        return;
      }

      const { data, error } = await client.functions.invoke(
        HANDOFF_FUNCTION,
        {
          body: {
            next
          }
        }
      );

      if (error) {
        let message = error.message || "Unable to open Training.";

        try {
          const response = error.context?.clone?.();

          if (response) {
            const body = await response.json();

            if (body?.error) {
              message = body.error;
            }
          }
        } catch {
          // Keep the original Edge Function error message.
        }

        throw new Error(message);
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      if (!data?.handoff_url) {
        throw new Error(
          "Automatic Training sign-in could not be created."
        );
      }

      const handoffUrl = new URL(data.handoff_url);

      if (handoffUrl.origin !== TRAINING_ORIGIN) {
        throw new Error(
          "The Training destination could not be verified."
        );
      }

      window.location.assign(handoffUrl.href);
    } catch (error) {
      console.error(
        "[Customer Training Handoff]",
        error
      );

      handoffInProgress = false;

      const message =
        error?.message ||
        "Unable to open Training right now. Please try again.";

      window.alert(message);
    }
  }

  function handleTrainingClick(event) {
    if (event.defaultPrevented || isModifiedClick(event)) {
      return;
    }

    const link = event.target.closest?.("a[href]");

    if (!link) {
      return;
    }

    const next = normalizeTrainingTarget(
      link.getAttribute("href")
    );

    if (!next) {
      return;
    }

    event.preventDefault();

    setLinkBusy(link, true);

    openTraining(next).finally(() => {
      setLinkBusy(link, false);
    });
  }

  window.S4UTrainingHandoff = Object.freeze({
    openTraining
  });

  document.addEventListener(
    "click",
    handleTrainingClick
  );
})();
