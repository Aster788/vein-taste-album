import { isSafariWebKit } from "./browserPlatform.js";

/** @typedef {'fast' | 'medium' | 'slow'} PhotoNetworkTier */

/** @typedef {{ tier: PhotoNetworkTier, maxConcurrent: number, leadPhotoCount: number, preloadAlbum: boolean }} PhotoNetworkProfile */

const PROFILES = /** @type {const} */ ({
  fast: {
    tier: "fast",
    maxConcurrent: 4,
    leadPhotoCount: 3,
    preloadAlbum: true,
  },
  medium: {
    tier: "medium",
    maxConcurrent: 2,
    leadPhotoCount: 2,
    preloadAlbum: false,
  },
  slow: {
    tier: "slow",
    maxConcurrent: 1,
    leadPhotoCount: 1,
    preloadAlbum: false,
  },
});

/**
 * Safari/WebKit benefits from more parallel connections to the photos CDN host.
 * @param {PhotoNetworkProfile} profile
 * @returns {PhotoNetworkProfile}
 */
function tuneForSafari(profile) {
  if (!isSafariWebKit()) return profile;
  if (profile.tier === "slow") {
    return { ...profile, maxConcurrent: Math.max(profile.maxConcurrent, 2) };
  }
  return { ...profile, maxConcurrent: 6, preloadAlbum: false };
}

/**
 * Infer photo preload aggressiveness from Network Information API (when available).
 * DevTools throttling may not update `effectiveType`; priority-queue still helps either way.
 * @returns {PhotoNetworkProfile}
 */
export function getPhotoNetworkProfile() {
  if (typeof navigator === "undefined") return tuneForSafari(PROFILES.fast);

  const connection =
    navigator.connection ?? navigator.mozConnection ?? navigator.webkitConnection;

  if (connection?.saveData) return tuneForSafari(PROFILES.slow);

  const effectiveType = String(connection?.effectiveType ?? "").trim();
  if (effectiveType === "slow-2g" || effectiveType === "2g") return tuneForSafari(PROFILES.slow);
  if (effectiveType === "3g") return tuneForSafari(PROFILES.slow);

  if (effectiveType === "4g") {
    const downlinkMbps = Number(connection?.downlink ?? 0);
    // DevTools Slow 4G (~4 Mbps) vs Fast 4G (~9+ Mbps).
    if (downlinkMbps > 0 && downlinkMbps < 6) return tuneForSafari(PROFILES.medium);
    return tuneForSafari(PROFILES.fast);
  }

  return tuneForSafari(PROFILES.fast);
}

/**
 * @param {ReadonlyArray<{ href: string }>} photos
 * @param {number} [count]
 * @returns {string[]}
 */
export function getLeadPhotoHrefs(photos, count = 1) {
  const limit = Math.max(1, count);
  return photos
    .slice(0, limit)
    .map((photo) => String(photo.href ?? "").trim())
    .filter(Boolean);
}
