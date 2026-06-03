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
 * @param {() => Promise<string | null>} task
 * @param {number} priority
 * @returns {Promise<string | null>}
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
function decodeImage(img) {
  if (typeof img.decode === "function") {
    img.decode().catch(() => undefined);
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
async function resolveDisplayUrl(href) {
  const cached = displayUrlCache.get(href);
  if (cached) return cached;

  await new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => {
      decodeImage(img);
      resolve();
    };
    img.onerror = () => reject(new Error(`Failed to preload image: ${href}`));
    img.src = href;
  });

  return rememberDisplayUrl(href, href);
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

  document.querySelectorAll("link[data-ffj-photo-preload]").forEach((node) => node.remove());

  const link = document.createElement("link");
  link.rel = "preload";
  link.as = "image";
  link.href = url;
  link.setAttribute("data-ffj-photo-preload", "1");
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

  const promise = schedulePreload(() => resolveDisplayUrl(url), priority).catch((error) => {
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
  const slice = photos.slice(0, limit);
  const prioritize = [];
  const all = [];

  for (const photo of slice) {
    const thumb = String(photo.thumbHref ?? "").trim();
    const full = String(photo.href ?? "").trim();
    if (thumb !== "") {
      all.push(thumb);
      prioritize.push(thumb);
    }
    if (full !== "") {
      all.push(full);
      if (prioritize.length === 0 || !prioritize.includes(full)) {
        prioritize.push(full);
      }
    }
  }

  const unique = [...new Set(all)];
  const priorityUnique = [...new Set(prioritize)];
  preloadImages(unique, { prioritize: priorityUnique });
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
