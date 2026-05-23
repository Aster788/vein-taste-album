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
  all: { zh: "全部", en: "all", ko: "전체" },
  bar: { zh: "酒吧", en: "bar", ko: "바" },
  bbq: { zh: "烧烤", en: "bbq", ko: "바베큐" },
  bread: { zh: "面包", en: "bread", ko: "빵" },
  "cantonese-cuisine": { zh: "粤菜", en: "cantonese cuisine", ko: "광동 요리" },
  coffee: { zh: "咖啡", en: "coffee", ko: "커피" },
  dessert: { zh: "甜品", en: "dessert", ko: "디저트" },
  "fast-food": { zh: "快餐", en: "fast food", ko: "패스트푸드" },
  "fusion-cuisine": { zh: "融合菜", en: "fusion cuisine", ko: "퓨전 요리" },
  grill: { zh: "烤肉", en: "grill", ko: "구이" },
  "guizhou-cuisine": { zh: "贵州菜", en: "guizhou cuisine", ko: "구이저우 요리" },
  hotpot: { zh: "火锅", en: "hotpot", ko: "훠궈" },
  "hunan-cuisine": { zh: "湘菜", en: "hunan cuisine", ko: "후난 요리" },
  "ice-cream": { zh: "冰淇淋", en: "ice cream", ko: "아이스크림" },
  italian: { zh: "意大利菜", en: "italian cuisine", ko: "이탈리아 요리" },
  "jiangsu-cuisine": { zh: "苏菜", en: "jiangsu cuisine", ko: "장쑤 요리" },
  japanese: { zh: "日料", en: "japanese cuisine", ko: "일식" },
  korean: { zh: "韩餐", en: "korean cuisine", ko: "한식" },
  "light-meal": { zh: "轻食", en: "light meal", ko: "가벼운 식사" },
  "milk-tea": { zh: "奶茶", en: "milk tea", ko: "밀크티" },
  noodle: { zh: "面食", en: "noodles", ko: "면류" },
  "northeastern-chinese-cuisine": {
    zh: "东北菜",
    en: "northeastern cuisine",
    ko: "중국 동북 요리",
  },
  other: { zh: "其他", en: "other", ko: "기타" },
  pastry: { zh: "糕点", en: "pastry", ko: "제과" },
  russian: { zh: "俄餐", en: "russian cuisine", ko: "러시아 요리" },
  seafood: { zh: "海鲜", en: "seafood", ko: "해산물" },
  "shandong-cuisine": { zh: "鲁菜", en: "shandong cuisine", ko: "산둥 요리" },
  "sichuan-cuisine": { zh: "川菜", en: "sichuan cuisine", ko: "사천 요리" },
  snacks: { zh: "小吃", en: "snacks", ko: "간식" },
  "southeast-asian": { zh: "东南亚菜", en: "southeast asian cuisine", ko: "동남아 요리" },
  spanish: { zh: "西班牙菜", en: "spanish cuisine", ko: "스페인 요리" },
  steak: { zh: "牛排", en: "steak", ko: "스테이크" },
  "street-food": { zh: "街头小吃", en: "street food", ko: "길거리 음식" },
  "western-food": { zh: "西餐", en: "western food", ko: "양식" },
  "xinjiang-cuisine": { zh: "新疆菜", en: "xinjiang cuisine", ko: "신장 요리" },
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
