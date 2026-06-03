/**
 * Desktop Safari / iOS WebKit (excludes Chromium-based browsers that embed WebKit).
 * @returns {boolean}
 */
export function isSafariWebKit() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  if (!/AppleWebKit/i.test(ua)) return false;
  if (/Chrome|Chromium|CriOS|Edg|EdgiOS|OPR|OPiOS|FxiOS/i.test(ua)) return false;
  return true;
}
