/**
 * 菜系贴纸与 `restaurants.json` 字段 `cuisine_zh` / `cuisine_en` 的约定（见 `docs/structure.md`）。
 *
 * - `cuisine_zh`：菜系中文名（筛选展示、排序）
 * - `cuisine_en`：贴纸 slug，对应 `src/assets/stickers/cuisine/{cuisine_en}.svg`
 */

const CUISINE_STICKER_MODULES = import.meta.glob("../assets/stickers/cuisine/*.svg", {
  eager: true,
  import: "default",
});

/** @type {Readonly<Record<string, string>>} */
export const CUISINE_STICKER_HREF_BY_SLUG = Object.freeze(
  Object.fromEntries(
    Object.entries(CUISINE_STICKER_MODULES).map(([filePath, href]) => {
      const matched = filePath.match(/\/([^/]+)\.svg$/);
      return [matched?.[1] ?? filePath, href];
    }),
  ),
);

/**
 * 贴纸目录下各 slug 的展示文案（数据未填 `cuisine_zh` 时的兜底；填表仍以 xlsx 为准）。
 * @type {Readonly<Record<string, { zh: string; en: string; ko?: string }>>}
 */
export const CUISINE_BY_EN = Object.freeze({
  all: { zh: "全部", en: "all" },
  bar: { zh: "酒吧", en: "bar" },
  bbq: { zh: "烧烤", en: "bbq" },
  bread: { zh: "面包", en: "bread" },
  "cantonese-cuisine": { zh: "粤菜", en: "cantonese cuisine" },
  coffee: { zh: "咖啡", en: "coffee" },
  dessert: { zh: "甜品", en: "dessert" },
  "fast-food": { zh: "快餐", en: "fast food" },
  "fusion-cuisine": { zh: "融合菜", en: "fusion cuisine" },
  grill: { zh: "烤肉", en: "grill" },
  "guizhou-cuisine": { zh: "贵州菜", en: "guizhou cuisine" },
  hotpot: { zh: "火锅", en: "hotpot" },
  "hunan-cuisine": { zh: "湘菜", en: "hunan cuisine" },
  "ice-cream": { zh: "冰淇淋", en: "ice cream" },
  italian: { zh: "意大利菜", en: "italian cuisine" },
  "jiangsu-cuisine": { zh: "苏菜", en: "jiangsu cuisine" },
  japanese: { zh: "日料", en: "japanese cuisine", ko: "일식" },
  korean: { zh: "韩餐", en: "korean cuisine", ko: "한식" },
  "light-meal": { zh: "轻食", en: "light meal" },
  "milk-tea": { zh: "奶茶", en: "milk tea", ko: "밀크티" },
  noodle: { zh: "面食", en: "noodles" },
  "northeastern-chinese-cuisine": {
    zh: "东北菜",
    en: "northeastern cuisine",
    ko: "중국 동북 요리",
  },
  other: { zh: "其他", en: "other" },
  pastry: { zh: "糕点", en: "pastry" },
  russian: { zh: "俄餐", en: "russian cuisine" },
  seafood: { zh: "海鲜", en: "seafood", ko: "해산물" },
  "shandong-cuisine": { zh: "鲁菜", en: "shandong cuisine" },
  "sichuan-cuisine": { zh: "川菜", en: "sichuan cuisine" },
  snacks: { zh: "小吃", en: "snacks", ko: "간식" },
  "southeast-asian": { zh: "东南亚菜", en: "southeast asian cuisine" },
  spanish: { zh: "西班牙菜", en: "spanish cuisine" },
  steak: { zh: "牛排", en: "steak" },
  "street-food": { zh: "街头小吃", en: "street food" },
  "western-food": { zh: "西餐", en: "western food" },
  "xinjiang-cuisine": { zh: "新疆菜", en: "xinjiang cuisine" },
});

/** @type {Readonly<Record<string, string>>} */
export const CUISINE_EN_BY_ZH = Object.freeze(
  Object.fromEntries(
    Object.entries(CUISINE_BY_EN)
      .filter(([slug]) => slug !== "all")
      .map(([slug, labels]) => [labels.zh, slug]),
  ),
);

/**
 * @param {string | undefined | null} raw
 * @returns {string}
 */
export function normalizeCuisineEn(raw) {
  return String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/_/g, "-");
}

/**
 * @param {Record<string, unknown> | null | undefined} row
 * @returns {string}
 */
export function getRestaurantCuisineZh(row) {
  const zh = String(row?.cuisine_zh ?? "").trim();
  if (zh !== "") return zh;
  return String(row?.cuisine ?? "").trim();
}

/**
 * @param {Record<string, unknown> | null | undefined} row
 * @returns {string}
 */
export function getRestaurantCuisineEn(row) {
  const direct = normalizeCuisineEn(row?.cuisine_en);
  if (direct !== "") return direct;
  const zh = getRestaurantCuisineZh(row);
  if (zh === "") return "";
  return CUISINE_EN_BY_ZH[zh] ?? "";
}

/**
 * 筛选键：优先 `cuisine_en`（与贴纸、地图高亮一致）。
 * @param {Record<string, unknown> | null | undefined} row
 * @returns {string}
 */
export function getRestaurantCuisineFilterKey(row) {
  return getRestaurantCuisineEn(row);
}

/**
 * @param {string | undefined | null} cuisineEn
 * @returns {string}
 */
export function resolveCuisineStickerHref(cuisineEn) {
  const slug = normalizeCuisineEn(cuisineEn);
  if (slug === "" || slug === "all") {
    return CUISINE_STICKER_HREF_BY_SLUG.all ?? "";
  }
  return (
    CUISINE_STICKER_HREF_BY_SLUG[slug] ??
    CUISINE_STICKER_HREF_BY_SLUG.other ??
    CUISINE_STICKER_HREF_BY_SLUG.all ??
    ""
  );
}

/**
 * @param {string} cuisineEn
 * @returns {{ zh: string; en: string; ko?: string }}
 */
export function getCuisineLabelsByEn(cuisineEn) {
  const slug = normalizeCuisineEn(cuisineEn);
  if (slug === "") return { zh: "", en: "" };
  return CUISINE_BY_EN[slug] ?? { zh: slug, en: slug.replace(/-/g, " ") };
}

if (import.meta.env?.DEV) {
  for (const slug of Object.keys(CUISINE_BY_EN)) {
    if (slug === "all") continue;
    if (!CUISINE_STICKER_HREF_BY_SLUG[slug]) {
      console.warn(`[cuisineSlugs] Missing sticker SVG for cuisine_en="${slug}"`);
    }
  }
  for (const slug of Object.keys(CUISINE_STICKER_HREF_BY_SLUG)) {
    if (slug === "all") continue;
    if (!CUISINE_BY_EN[slug]) {
      console.warn(`[cuisineSlugs] No CUISINE_BY_EN entry for sticker slug "${slug}"`);
    }
  }
}
