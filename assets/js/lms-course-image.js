/* ============================================================
   SCREENINGS4U — LMS COURSE IMAGE RESOLVER
   Single source of truth:
   lms_courses.thumbnail_media_id -> lms_media -> private lms-media storage
   ============================================================ */
(function () {
  "use strict";

  const CACHE = new Map();

  async function getClient() {
    if (typeof window.getScreenings4uSupabase === "function") {
      const client = await window.getScreenings4uSupabase();
      if (client?.from) return client;
    }

    const client = [
      window.screenings4uSupabase,
      window.supabaseClient,
      window.supabaseAdmin,
      window.supabase
    ].find((value) => value && typeof value.from === "function");

    if (!client) {
      throw new Error("Supabase client is unavailable.");
    }

    return client;
  }

  async function resolveMedia(mediaOrId, expiresIn = 3600) {
    if (!mediaOrId) return null;

    const client = await getClient();

    let media =
      typeof mediaOrId === "object"
        ? mediaOrId
        : null;

    const mediaId =
      typeof mediaOrId === "string"
        ? mediaOrId
        : mediaOrId?.id || "";

    if (!media && mediaId) {
      const cacheKey = `media:${mediaId}`;
      if (CACHE.has(cacheKey)) {
        media = CACHE.get(cacheKey);
      } else {
        const { data, error } = await client
          .from("lms_media")
          .select(
            "id,media_type,title,original_filename,storage_bucket,storage_path,thumbnail_url,playback_url,mime_type,metadata,provider"
          )
          .eq("id", mediaId)
          .single();

        if (error) throw error;
        media = data;
        CACHE.set(cacheKey, media);
      }
    }

    if (!media) return null;

    if (
      media.thumbnail_url &&
      /^https?:\/\//i.test(media.thumbnail_url)
    ) {
      return {
        media,
        url: media.thumbnail_url
      };
    }

    if (
      media.playback_url &&
      String(media.media_type || "").toLowerCase() === "image" &&
      /^https?:\/\//i.test(media.playback_url)
    ) {
      return {
        media,
        url: media.playback_url
      };
    }

    if (!media.storage_bucket || !media.storage_path) {
      return {
        media,
        url: ""
      };
    }

    const urlCacheKey =
      `signed:${media.storage_bucket}:${media.storage_path}:${expiresIn}`;

    const cached = CACHE.get(urlCacheKey);

    if (
      cached &&
      cached.expiresAt > Date.now() + 60_000
    ) {
      return {
        media,
        url: cached.url
      };
    }

    const { data, error } = await client.storage
      .from(media.storage_bucket)
      .createSignedUrl(media.storage_path, expiresIn);

    if (error) throw error;

    const url = data?.signedUrl || "";

    CACHE.set(urlCacheKey, {
      url,
      expiresAt: Date.now() + expiresIn * 1000
    });

    return {
      media,
      url
    };
  }

  async function resolveCourse(courseOrId, expiresIn = 3600) {
    if (!courseOrId) return null;

    const client = await getClient();

    let course =
      typeof courseOrId === "object"
        ? courseOrId
        : null;

    if (!course) {
      const { data, error } = await client
        .from("lms_courses")
        .select("id,title,thumbnail_media_id")
        .eq("id", courseOrId)
        .single();

      if (error) throw error;
      course = data;
    }

    if (!course?.thumbnail_media_id) {
      return {
        course,
        media: null,
        url: ""
      };
    }

    const resolved =
      await resolveMedia(
        course.thumbnail_media_id,
        expiresIn
      );

    return {
      course,
      media: resolved?.media || null,
      url: resolved?.url || ""
    };
  }

  async function applyToElement(element, courseOrId, options = {}) {
    if (!element) return null;

    const result =
      await resolveCourse(
        courseOrId,
        options.expiresIn || 3600
      );

    const url = result?.url || "";

    if (!url) {
      element.classList.add(
        options.emptyClass || "s4u-course-image-empty"
      );

      if (
        element.tagName === "IMG" &&
        options.placeholder
      ) {
        element.src = options.placeholder;
      }

      return result;
    }

    element.classList.remove(
      options.emptyClass || "s4u-course-image-empty"
    );

    if (element.tagName === "IMG") {
      element.src = url;

      if (!element.alt) {
        element.alt =
          result?.course?.title
            ? `${result.course.title} course image`
            : "Course image";
      }
    } else {
      element.style.backgroundImage =
        `url("${cssUrl(url)}")`;

      element.classList.add(
        options.loadedClass || "s4u-course-image-loaded"
      );
    }

    return result;
  }

  function clearCache(mediaId = "") {
    if (!mediaId) {
      CACHE.clear();
      return;
    }

    for (const key of [...CACHE.keys()]) {
      if (key.includes(mediaId)) {
        CACHE.delete(key);
      }
    }
  }

  function cssUrl(value) {
    return String(value || "")
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"');
  }

  window.S4UCourseImage = Object.freeze({
    resolveMedia,
    resolveCourse,
    applyToElement,
    clearCache
  });
})();
