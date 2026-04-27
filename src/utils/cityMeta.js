import cityMetaJson from "../data/city_meta.json";
import { isChinaCitySlug } from "./citySlugs.js";

/**
 * @typedef {'en_native_zh' | 'en_zh'} DetailLocaleMode
 */

/**
 * @typedef {Object} CityMetaEntry
 * @property {DetailLocaleMode} detail_locale_mode
 * @property {string} [native_iso639_1]
 * @property {string} [native_button_label]
 */

/** @type {Readonly<Record<string, CityMetaEntry>>} */
const CITY_META_BY_SLUG = Object.freeze(cityMetaJson);

/**
 * @param {string | null | undefined} slug
 * @returns {CityMetaEntry | null}
 */
export function getCityMetaEntry(slug) {
  if (slug == null || slug === "") return null;
  const key = String(slug).trim();
  return CITY_META_BY_SLUG[key] ?? null;
}

/**
 * @param {'zh' | 'en' | 'native'} detailLocale
 * @param {DetailLocaleMode} mode
 * @returns {'zh' | 'en' | 'native'}
 */
export function normalizeDetailLocale(detailLocale, mode) {
  if (mode === "en_zh" && detailLocale === "native") return "zh";
  return detailLocale;
}

/**
 * @param {string} citySlug
 * @returns {{
 *   isChina: boolean,
 *   mode: DetailLocaleMode | null,
 *   nativeIso639_1: string,
 *   nativeButtonLabel: string,
 * }}
 */
export function getCityDetailLocaleConfig(citySlug) {
  const slug = String(citySlug ?? "").trim();
  if (slug === "") {
    return {
      isChina: true,
      mode: null,
      nativeIso639_1: "",
      nativeButtonLabel: "",
    };
  }

  const isChina = isChinaCitySlug(slug);
  if (isChina) {
    return {
      isChina: true,
      mode: null,
      nativeIso639_1: "",
      nativeButtonLabel: "",
    };
  }

  const meta = getCityMetaEntry(slug);
  const mode = meta?.detail_locale_mode ?? "en_native_zh";
  const nativeIso639_1 = String(meta?.native_iso639_1 ?? "").trim();
  const nativeButtonLabel = String(meta?.native_button_label ?? nativeIso639_1)
    .trim()
    .toUpperCase();

  return {
    isChina: false,
    mode,
    nativeIso639_1,
    nativeButtonLabel,
  };
}
