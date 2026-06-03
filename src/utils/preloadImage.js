import { isSafariWebKit } from "./browserPlatform.js";
import { getPhotoNetworkProfile } from "./photoNetworkProfile.js";

/** @type {Map<string, Promise<string | null>>} */
const preloadCache = new Map();

/** @type {Map<string, string>} */
const displayUrlCache = new Map();

/** @type {Set<string>} */
const blobUrls = new Set();

const PRIORITY_HIGH = 0;
const PRIORITY_LOW = 10;

let activeCount = 0;
/** @type {Array<{ run: () => void, priority: number }>} */
const waitQueue = [];

/** @type {Set<string>} */
const warmedOrigins = new Set();

/** Bumped when the active cuisine store changes — stale idle album preloads are skipped. */
let photoPreloadSession = 0;

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
 * Drop queued low-priority preloads so the newly selected store's images can start sooner.
 */
export function reprioritizeBackgroundPhotoPreloads() {
  for (let i = waitQueue.length - 1; i >= 0; i -= 1) {
    if (waitQueue[i].priority === PRIORITY_LOW) {
      waitQueue.splice(i, 1);
    }
  }
  pumpQueue();
}

/**
 * Invalidate deferred album preloads and clear background queue (call on cuisine store change).
 * @returns {number} current session id
 */
export function bumpPhotoPreloadSession() {
  photoPreloadSession += 1;
  reprioritizeBackgroundPhotoPreloads();
  return photoPreloadSession;
}

/**
 * @param {() => Promise<string | null>} task
 * @param {number} priority
 * @returns {Promise<string | null>}
 */
function schedulePreload(task, priority = PRIORITY_LOW) {
  const runTask = () => {
    activeCount += 1;
    return task().finally(() => {
      activeCount -= 1;
      pumpQueue();
    });
  };

  // High-priority loads (active store) must never wait behind background album preloads.
  if (priority === PRIORITY_HIGH) {
    return runTask();
  }

  return new Promise((resolve, reject) => {
    const run = () => {
      runTask().then(resolve, reject);
    };

    if (activeCount < getMaxConcurrent()) {
      run();
      return;
    }

    insertQueuedJob({ priority, run });
  });
}

const MAX_HINT_PRELOAD_LINKS = isSafariWebKit() ? 6 : 4;

/**
 * @param {HTMLImageElement} img
 * @returns {Promise<void>}
 */
async function decodeImage(img) {
  if (typeof img.decode !== "function") return;
  try {
    await img.decode();
  } catch {
    // decode() rejects for broken images; onload already validated this URL.
  }
}

/**
 * @param {string} href
 * @returns {Promise<string>}
 */
function rememberDisplayUrl(href, displayUrl) {
  displayUrlCache.set(href, displayUrl);
  return displayUrl;
}

/**
 * Preload through the browser image pipeline and return the URL when it is renderable.
 * Avoid fetch/blob for remote R2 images until CORS is configured; otherwise every
 * cold image pays an extra failed CORS request before the actual image load.
 * @param {string} href
 * @returns {Promise<string>}
 */
/**
 * @param {string} href
 * @param {{ awaitDecode?: boolean }} [options]
 */
async function resolveDisplayUrl(href, options = {}) {
  const cached = displayUrlCache.get(href);
  if (cached) return cached;

  const awaitDecode = options.awaitDecode !== false;

  await new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => {
      if (awaitDecode) {
        decodeImage(img).then(resolve, resolve);
      } else {
        resolve();
      }
    };
    img.onerror = () => reject(new Error(`Failed to preload image: ${href}`));
    img.src = href;
  });

  return rememberDisplayUrl(href, href);
}

/**
 * Mark a URL as displayable (e.g. after the visible `<img>` fires `onload`).
 * @param {string} href
 */
export function markPhotoDisplayReady(href) {
  const url = String(href ?? "").trim();
  if (url === "") return;
  rememberDisplayUrl(url, url);
  if (!preloadCache.has(url)) {
    preloadCache.set(url, Promise.resolve(url));
  }
}

/**
 * URL safe to assign to `<img src>` after preload (blob URL when available).
 * @param {string} href
 * @returns {string}
 */
export function getPreloadedDisplayUrl(href) {
  const url = String(href ?? "").trim();
  if (url === "") return "";
  return displayUrlCache.get(url) ?? url;
}

/**
 * Whether a URL finished preload and is safe to assign synchronously (zero-spinner path).
 * @param {string} href
 * @returns {boolean}
 */
export function isPhotoDisplayReady(href) {
  const url = String(href ?? "").trim();
  return url !== "" && displayUrlCache.has(url);
}

/**
 * Single image preload hint (no crossOrigin — R2 may omit CORS).
 * @param {string} href
 */
export function hintPreloadImageLink(href) {
  const url = String(href ?? "").trim();
  if (url === "" || typeof document === "undefined") return;

  const attrValue =
    typeof CSS !== "undefined" && typeof CSS.escape === "function"
      ? CSS.escape(url)
      : url.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const existing = document.querySelector(`link[data-ffj-photo-preload="${attrValue}"]`);
  if (existing) return;

  const links = [...document.querySelectorAll("link[data-ffj-photo-preload]")];
  while (links.length >= MAX_HINT_PRELOAD_LINKS) {
    links.shift()?.remove();
  }

  const link = document.createElement("link");
  link.rel = "preload";
  link.as = "image";
  link.href = url;
  link.setAttribute("data-ffj-photo-preload", url);
  document.head.appendChild(link);
}

/**
 * @param {string} href
 * @param {{ priority?: 'high' | 'low' }} [options]
 * @returns {Promise<string | null>}
 */
export function preloadImage(href, options = {}) {
  const url = String(href ?? "").trim();
  if (url === "") return Promise.resolve(null);

  const priority = options.priority === "high" ? PRIORITY_HIGH : PRIORITY_LOW;
  const cached = preloadCache.get(url);
  if (cached) return cached;

  const awaitDecode = priority === PRIORITY_LOW;
  const promise = schedulePreload(
    () => resolveDisplayUrl(url, { awaitDecode }),
    priority,
  ).catch((error) => {
    preloadCache.delete(url);
    displayUrlCache.delete(url);
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
  const session = photoPreloadSession;
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
    const runBatch = () => {
      if (session !== photoPreloadSession) return;
      preloadLowPriorityBatch(rest);
    };
    if (typeof requestIdleCallback === "function") {
      requestIdleCallback(runBatch, { timeout: 4000 });
    } else {
      window.setTimeout(runBatch, 250);
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
  preloadStoreThumbs(photos, { limit: count, includeLeadFull: true });
}

/**
 * Preload WebP thumbs (small) for a store; full-size originals stay low priority.
 * @param {ReadonlyArray<{ href?: string, thumbHref?: string }>} photos
 * @param {{ limit?: number, includeLeadFull?: boolean, priority?: 'high' | 'low' }} [options]
 */
export function preloadStoreThumbs(photos, options = {}) {
  const limit = Math.max(1, options.limit ?? photos.length);
  const slice = photos.slice(0, limit);
  const priority = options.priority === "low" ? PRIORITY_LOW : PRIORITY_HIGH;
  const priorityLabel = priority === PRIORITY_HIGH ? "high" : "low";

  const thumbs = [
    ...new Set(
      slice
        .map((photo) => String(photo.thumbHref ?? "").trim())
        .filter((href) => href !== ""),
    ),
  ];

  for (const href of thumbs) {
    preloadImage(href, { priority: priorityLabel }).catch(() => undefined);
    hintPreloadImageLink(href);
  }

  if (!options.includeLeadFull) return;

  const leadFull = String(slice[0]?.href ?? "").trim();
  if (leadFull !== "") {
    preloadImage(leadFull, { priority: "low" }).catch(() => undefined);
  }
}

/**
 * Revoke blob URLs created by preload (e.g. on panel unmount).
 */
export function revokePreloadedBlobUrls() {
  for (const blobUrl of blobUrls) {
    URL.revokeObjectURL(blobUrl);
  }
  blobUrls.clear();
  for (const [href, displayUrl] of displayUrlCache.entries()) {
    if (displayUrl.startsWith("blob:")) {
      displayUrlCache.delete(href);
    }
  }
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
