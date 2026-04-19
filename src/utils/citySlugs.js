/**
 * PRD 11 城 URL 段（小写 + 连字符），与 geojson 文件名、global.css `html[data-city]` 一致。
 */
export const CITY_SLUGS = Object.freeze([
  "dalian",
  "qingdao",
  "shanghai",
  "guangzhou",
  "chongqing",
  "fuzhou",
  "xiamen",
  "quanzhou",
  "pingtan",
  "jeju",
  "kuala-lumpur",
]);

/** PRD：非中文城市（济州岛、吉隆坡） */
export const NON_CHINA_CITY_SLUGS = Object.freeze(["jeju", "kuala-lumpur"]);

/**
 * @param {string | undefined} raw
 * @returns {string}
 */
export function normalizeCitySlug(raw) {
  return (raw ?? "").trim().toLowerCase().replace(/\s+/g, "-");
}

/**
 * 是否为中国 9 城之一（用于 EN/CN 与坐标系等）。
 * 书架 `/` 无 city 段时传入 `null` / `''`，返回 `true`（首页仍提供 EN/CN，见 PRD 3.1）。
 * @param {string | null | undefined} slug
 */
export function isChinaCitySlug(slug) {
  const s = normalizeCitySlug(slug ?? "");
  if (s === "") return true;
  return !NON_CHINA_CITY_SLUGS.includes(s);
}

/**
 * @param {string} slug
 * @returns {boolean}
 */
export function isValidCitySlug(slug) {
  return slug !== "" && CITY_SLUGS.includes(slug);
}
