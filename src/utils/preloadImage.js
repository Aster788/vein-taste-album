import { getPhotoNetworkProfile } from "./photoNetworkProfile.js";

/** @type {Map<string, Promise<HTMLImageElement | null>>} */
const preloadCache = new Map();

const PRIORITY_HIGH = 0;
const PRIORITY_LOW = 10;

let activeCount = 0;
/** @type {Array<{ run: () => void, priority: number }>} */
const waitQueue = [];

/** @type {Set<string>} */
const warmedOrigins = new Set();

function getMaxConcurrent() {
  return getPhotoNetworkProfile().maxConcurrent;
}

function insertQueuedJob(job) {
  const index = waitQueue.findIndex((entry) => entry.priority > job.priority);
  if (index === -1) waitQueue.push(job);
  else waitQueue.splice(index, 0, job);
}

function pumpQueue() {
  while (activeCount < getMaxConcurrent() && waitQueue.length > 0) {
    const next = waitQueue.shift();
    if (next) next.run();
  }
}

/**
 * @param {() => Promise<HTMLImageElement | null>} task
 * @param {number} priority
 * @returns {Promise<HTMLImageElement | null>}
 */
function schedulePreload(task, priority = PRIORITY_LOW) {
  return new Promise((resolve, reject) => {
    const run = () => {
      activeCount += 1;
      task()
        .then(resolve, reject)
        .finally(() => {
          activeCount -= 1;
          pumpQueue();
        });
    };

    if (priority === PRIORITY_HIGH || activeCount < getMaxConcurrent()) {
      run();
      return;
    }

    insertQueuedJob({ priority, run });
  });
}

/**
 * @param {HTMLImageElement} img
 */
async function decodeImage(img) {
  if (typeof img.decode === "function") {
    try {
      await img.decode();
    } catch {
      // decode() can reject for oversized images; load event still fired.
    }
  }
}

/**
 * @param {string} href
 * @returns {Promise<HTMLImageElement>}
 */
function loadImageElement(href) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => {
      decodeImage(img).then(() => resolve(img));
    };
    img.onerror = () => reject(new Error(`Failed to preload image: ${href}`));
    img.src = href;
  });
}

/**
 * @param {string} href
 * @param {{ priority?: 'high' | 'low' }} [options]
 * @returns {Promise<HTMLImageElement | null>}
 */
export function preloadImage(href, options = {}) {
  const url = String(href ?? "").trim();
  if (url === "") return Promise.resolve(null);

  const priority = options.priority === "high" ? PRIORITY_HIGH : PRIORITY_LOW;
  const cached = preloadCache.get(url);
  if (cached) return cached;

  const promise = schedulePreload(() => loadImageElement(url), priority).catch((error) => {
    preloadCache.delete(url);
    throw error;
  });
  preloadCache.set(url, promise);
  return promise;
}

/**
 * @param {ReadonlyArray<string>} hrefs
 */
function preloadLowPriorityBatch(hrefs) {
  for (const href of hrefs) {
    preloadImage(href, { priority: "low" }).catch(() => undefined);
  }
}

/**
 * Fire-and-forget preload; priority URLs use high priority and run first.
 * On slow/medium networks, remaining album images are deferred until priorities finish.
 * @param {ReadonlyArray<string>} hrefs
 * @param {{ prioritize?: ReadonlyArray<string> }} [options]
 */
export function preloadImages(hrefs, options = {}) {
  const profile = getPhotoNetworkProfile();
  const prioritize = new Set(
    (options.prioritize ?? [])
      .map((href) => String(href ?? "").trim())
      .filter(Boolean),
  );
  const unique = [
    ...new Set(hrefs.map((href) => String(href ?? "").trim()).filter(Boolean)),
  ];
  const priorityList = unique.filter((href) => prioritize.has(href));
  const rest = unique.filter((href) => !prioritize.has(href));

  for (const href of priorityList) {
    preloadImage(href, { priority: "high" }).catch(() => undefined);
  }

  if (!profile.preloadAlbum || rest.length === 0) return;

  const deferRest = () => {
    if (typeof requestIdleCallback === "function") {
      requestIdleCallback(() => preloadLowPriorityBatch(rest), { timeout: 4000 });
    } else {
      window.setTimeout(() => preloadLowPriorityBatch(rest), 250);
    }
  };

  if (priorityList.length === 0) {
    deferRest();
    return;
  }

  Promise.allSettled(priorityList.map((href) => preloadImage(href, { priority: "high" }))).then(
    deferRest,
  );
}

/**
 * Preload first N photos for a store (sorted), with high priority.
 * @param {ReadonlyArray<{ href: string }>} photos
 * @param {number} count
 */
export function preloadLeadPhotos(photos, count) {
  const limit = Math.max(1, count);
  const hrefs = photos
    .slice(0, limit)
    .map((photo) => String(photo.href ?? "").trim())
    .filter(Boolean);
  preloadImages(hrefs, { prioritize: hrefs });
}

/**
 * Hint the browser to fetch the active polaroid URL early.
 * @param {string} href
 */
export function hintPreloadImageLink(href) {
  const url = String(href ?? "").trim();
  if (url === "" || typeof document === "undefined") return;

  document.querySelectorAll("link[data-ffj-photo-preload]").forEach((node) => node.remove());

  const link = document.createElement("link");
  link.rel = "preload";
  link.as = "image";
  link.href = url;
  link.crossOrigin = "anonymous";
  link.setAttribute("data-ffj-photo-preload", "1");
  if ("fetchPriority" in link) {
    /** @type {HTMLLinkElement & { fetchPriority?: string }} */ (link).fetchPriority = "high";
  }
  document.head.appendChild(link);
}

/**
 * Preconnect / dns-prefetch the photos CDN origin (VITE_PHOTOS_BASE_URL).
 */
export function warmPhotosOrigin() {
  const base = String(import.meta.env.VITE_PHOTOS_BASE_URL ?? "").trim();
  if (base === "" || typeof document === "undefined") return;

  let origin = "";
  try {
    origin = new URL(base).origin;
  } catch {
    return;
  }
  if (origin === "" || warmedOrigins.has(origin)) return;
  warmedOrigins.add(origin);

  const preconnect = document.createElement("link");
  preconnect.rel = "preconnect";
  preconnect.href = origin;
  preconnect.crossOrigin = "anonymous";
  document.head.appendChild(preconnect);

  const dnsPrefetch = document.createElement("link");
  dnsPrefetch.rel = "dns-prefetch";
  dnsPrefetch.href = origin;
  document.head.appendChild(dnsPrefetch);
}
