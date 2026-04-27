import staticTranslations from "../data/translations.static.json";

const MT_ENABLED = String(import.meta.env.VITE_ENABLE_MT ?? "false").toLowerCase() === "true";
const MT_API_KEY = String(import.meta.env.VITE_GOOGLE_TRANSLATE_API_KEY ?? "").trim();
const MT_CACHE_STORAGE_KEY = "ffj_mt_cache_v1";
const MT_CACHE_TTL_DAYS_RAW = Number(import.meta.env.VITE_MT_CACHE_TTL_DAYS ?? "3650");
const MT_CACHE_TTL_MS =
  Number.isFinite(MT_CACHE_TTL_DAYS_RAW) && MT_CACHE_TTL_DAYS_RAW >= 0
    ? MT_CACHE_TTL_DAYS_RAW * 24 * 60 * 60 * 1000
    : Number.POSITIVE_INFINITY;
const CACHE_UPDATED_EVENT = "ffj:mt-cache-updated";
const STATIC_TRANSLATIONS = Object.freeze(staticTranslations?.translations ?? {});

const memoryCache = new Map();
const inFlight = new Map();
let cacheLoaded = false;

function normalizeLangCode(langCode) {
  const code = String(langCode ?? "").trim().toLowerCase();
  if (code === "zh") return "zh-CN";
  if (code === "cn") return "zh-CN";
  return code;
}

function makeCacheKey({ text, sourceLang, targetLang }) {
  return JSON.stringify({
    t: String(text ?? ""),
    s: normalizeLangCode(sourceLang),
    d: normalizeLangCode(targetLang),
  });
}

function canUseLocalStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function loadPersistedCache() {
  if (cacheLoaded || !canUseLocalStorage()) return;
  cacheLoaded = true;
  try {
    const raw = window.localStorage.getItem(MT_CACHE_STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return;
    parsed.forEach((entry) => {
      if (!entry || typeof entry !== "object") return;
      if (typeof entry.key !== "string") return;
      if (typeof entry.value !== "string") return;
      if (!Number.isFinite(entry.savedAt)) return;
      memoryCache.set(entry.key, { value: entry.value, savedAt: entry.savedAt });
    });
  } catch {
    // Ignore malformed local cache data.
  }
}

function pruneExpiredCache(now = Date.now()) {
  if (!Number.isFinite(MT_CACHE_TTL_MS)) return false;
  let changed = false;
  for (const [key, item] of memoryCache.entries()) {
    if (!item || !Number.isFinite(item.savedAt) || now - item.savedAt > MT_CACHE_TTL_MS) {
      memoryCache.delete(key);
      changed = true;
    }
  }
  return changed;
}

function persistCache() {
  if (!canUseLocalStorage()) return;
  const now = Date.now();
  const changedByPrune = pruneExpiredCache(now);
  try {
    const payload = Array.from(memoryCache.entries()).map(([key, entry]) => ({
      key,
      value: entry.value,
      savedAt: entry.savedAt,
    }));
    window.localStorage.setItem(MT_CACHE_STORAGE_KEY, JSON.stringify(payload));
    if (changedByPrune) {
      window.dispatchEvent(new CustomEvent(CACHE_UPDATED_EVENT));
    }
  } catch {
    // Ignore storage quota / serialization failures.
  }
}

function setCachedTranslation(cacheKey, translatedText) {
  memoryCache.set(cacheKey, { value: translatedText, savedAt: Date.now() });
  persistCache();
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(CACHE_UPDATED_EVENT));
  }
}

function getCacheEntry(cacheKey) {
  if (STATIC_TRANSLATIONS[cacheKey]) {
    return STATIC_TRANSLATIONS[cacheKey];
  }
  loadPersistedCache();
  const item = memoryCache.get(cacheKey);
  if (!item) return null;
  if (Number.isFinite(MT_CACHE_TTL_MS) && Date.now() - item.savedAt > MT_CACHE_TTL_MS) {
    memoryCache.delete(cacheKey);
    persistCache();
    return null;
  }
  return item.value;
}

export function getMachineTranslationStatus() {
  return {
    enabled: MT_ENABLED,
    hasKey: MT_API_KEY !== "",
  };
}

export function isMachineTranslationEnabled() {
  return MT_ENABLED && MT_API_KEY !== "";
}

export function getCachedTranslation({ text, sourceLang, targetLang }) {
  const source = String(text ?? "").trim();
  const srcLang = normalizeLangCode(sourceLang);
  const dstLang = normalizeLangCode(targetLang);
  if (source === "" || srcLang === "" || dstLang === "" || srcLang === dstLang) return "";
  const cacheKey = makeCacheKey({ text: source, sourceLang: srcLang, targetLang: dstLang });
  return getCacheEntry(cacheKey) ?? "";
}

async function requestGoogleTranslation({ text, sourceLang, targetLang }) {
  const endpoint = `https://translation.googleapis.com/language/translate/v2?key=${encodeURIComponent(
    MT_API_KEY,
  )}`;
  const payload = {
    q: text,
    target: targetLang,
    format: "text",
  };
  if (sourceLang) {
    payload.source = sourceLang;
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(`Google Translate HTTP ${response.status}`);
  }
  const data = await response.json();
  const translatedText = String(data?.data?.translations?.[0]?.translatedText ?? "").trim();
  if (translatedText === "") {
    throw new Error("Google Translate returned empty text");
  }
  return translatedText;
}

export async function translateWithCache({ text, sourceLang, targetLang }) {
  const source = String(text ?? "").trim();
  const srcLang = normalizeLangCode(sourceLang);
  const dstLang = normalizeLangCode(targetLang);
  if (source === "" || srcLang === "" || dstLang === "" || srcLang === dstLang) return "";
  if (!isMachineTranslationEnabled()) return "";

  const cacheKey = makeCacheKey({ text: source, sourceLang: srcLang, targetLang: dstLang });
  const cached = getCacheEntry(cacheKey);
  if (cached) return cached;

  const inFlightKey = cacheKey;
  if (inFlight.has(inFlightKey)) {
    return inFlight.get(inFlightKey);
  }

  const task = requestGoogleTranslation({
    text: source,
    sourceLang: srcLang,
    targetLang: dstLang,
  })
    .then((translated) => {
      setCachedTranslation(cacheKey, translated);
      return translated;
    })
    .catch(() => "")
    .finally(() => {
      inFlight.delete(inFlightKey);
    });

  inFlight.set(inFlightKey, task);
  return task;
}

export function maybeTranslateWithCache(input) {
  void translateWithCache(input);
}

export const MT_CACHE_EVENT_NAME = CACHE_UPDATED_EVENT;
