/** @typedef {'fast' | 'medium' | 'slow'} PhotoNetworkTier */

/** @typedef {{ tier: PhotoNetworkTier, maxConcurrent: number, leadPhotoCount: number, preloadAlbum: boolean }} PhotoNetworkProfile */

const PROFILES = /** @type {const} */ ({
  fast: {
    tier: "fast",
    maxConcurrent: 4,
    leadPhotoCount: 1,
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
    leadPhotoCount: 3,
    preloadAlbum: false,
  },
});

/**
 * Infer photo preload aggressiveness from Network Information API (when available).
 * DevTools throttling may not update `effectiveType`; priority-queue still helps either way.
 * @returns {PhotoNetworkProfile}
 */
export function getPhotoNetworkProfile() {
  if (typeof navigator === "undefined") return PROFILES.fast;

  const connection =
    navigator.connection ?? navigator.mozConnection ?? navigator.webkitConnection;

  if (connection?.saveData) return PROFILES.slow;

  const effectiveType = String(connection?.effectiveType ?? "").trim();
  if (effectiveType === "slow-2g" || effectiveType === "2g") return PROFILES.slow;
  if (effectiveType === "3g") return PROFILES.slow;

  if (effectiveType === "4g") {
    const downlinkMbps = Number(connection?.downlink ?? 0);
    // DevTools Slow 4G (~4 Mbps) vs Fast 4G (~9+ Mbps).
    if (downlinkMbps > 0 && downlinkMbps < 6) return PROFILES.medium;
    return PROFILES.fast;
  }

  return PROFILES.fast;
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
