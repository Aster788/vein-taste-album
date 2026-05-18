/**
 * PRD 12 城 URL 段（小写 + 连字符），与 geojson 文件名、global.css `html[data-city]` 一致。
 * 书架横向成书顺序与本数组顺序相同（`getBookshelfCities` 使用 `CITY_SLUGS.map`）。
 */
export const CITY_SLUGS = Object.freeze([
  "shanghai",
  "suzhou",
  "qingdao",
  "chongqing",
  "guangzhou",
  "jeju",
  "kuala-lumpur",
  "melaka",
  "fuzhou",
  "quanzhou",
  "xiamen",
  "dalian",
]);

/** PRD：非中文城市（济州岛、吉隆坡、马六甲） */
export const NON_CHINA_CITY_SLUGS = Object.freeze(["jeju", "kuala-lumpur", "melaka"]);

/**
 * 书脊城市贴纸文件名（位于 `src/assets/stickers/cities/`，与 `docs/structure.md` 一致）。
 * 键顺序与上方 `CITY_SLUGS` 一致，便于对照维护。
 *
 * **贴纸 SVG 规范**：不得含整幅 viewBox 黑框/白框或大块纯色底（导出器常见）；仅保留透明底上的图形，
 *   否则 `<img>` 书脊上会露出黑/白矩形。换图后用浏览器看一眼书脊即可自检。
 *
 * @type {Readonly<Record<(typeof CITY_SLUGS)[number], string>>}
 */
export const CITY_STICKER_FILENAME_BY_SLUG = Object.freeze({
  shanghai: "shanghai-oriental-pearl-tower.svg",
  suzhou: "suzhou-huqiuta.svg",
  qingdao: "qingdao-beer.svg",
  chongqing: "chongqing-chili.svg",
  guangzhou: "guangzhou-canton-tower.svg",
  jeju: "jeju-orange.svg",
  "kuala-lumpur": "kl-petronas-twin-tower.svg",
  melaka: "melaka-mosque.svg",
  fuzhou: "fuzhou-banyan-tree.svg",
  quanzhou: "quanzhou-anchor.svg",
  xiamen: "xiamen-piano.svg",
  dalian: "dalian-seagull.svg",
});

/**
 * 书架书脊/封面用城市文案兜底（与 PRD §1.5、§2.5「国家·城市」一致；`restaurants.json` 有该城数据时以 JSON 覆盖）。
 * 书脊双行：上中文 `country_zh·city_zh`，下英文 `country_en · city_en`。
 * `city_native` 供详情页等城市文案使用，**不用于书脊**（语言切换与展示策略见 `prd.md` §2.5）。
 * @type {Readonly<Record<(typeof CITY_SLUGS)[number], { country_zh: string; country_en: string; city_zh: string; city_en: string; city_native: string; is_china: boolean }>>}
 */
export const BOOKSHELF_CITY_DISPLAY_BY_SLUG = Object.freeze({
  dalian: {
    country_zh: "中国",
    country_en: "China",
    city_zh: "大连",
    city_en: "Dalian",
    city_native: "",
    is_china: true,
  },
  qingdao: {
    country_zh: "中国",
    country_en: "China",
    city_zh: "青岛",
    city_en: "Qingdao",
    city_native: "",
    is_china: true,
  },
  suzhou: {
    country_zh: "中国",
    country_en: "China",
    city_zh: "苏州",
    city_en: "Suzhou",
    city_native: "",
    is_china: true,
  },
  shanghai: {
    country_zh: "中国",
    country_en: "China",
    city_zh: "上海",
    city_en: "Shanghai",
    city_native: "",
    is_china: true,
  },
  guangzhou: {
    country_zh: "中国",
    country_en: "China",
    city_zh: "广州",
    city_en: "Guangzhou",
    city_native: "",
    is_china: true,
  },
  chongqing: {
    country_zh: "中国",
    country_en: "China",
    city_zh: "重庆",
    city_en: "Chongqing",
    city_native: "",
    is_china: true,
  },
  fuzhou: {
    country_zh: "中国",
    country_en: "China",
    city_zh: "福州",
    city_en: "Fuzhou",
    city_native: "",
    is_china: true,
  },
  xiamen: {
    country_zh: "中国",
    country_en: "China",
    city_zh: "厦门",
    city_en: "Xiamen",
    city_native: "",
    is_china: true,
  },
  quanzhou: {
    country_zh: "中国",
    country_en: "China",
    city_zh: "泉州",
    city_en: "Quanzhou",
    city_native: "",
    is_china: true,
  },
  jeju: {
    country_zh: "韩国",
    country_en: "South Korea",
    city_zh: "济州岛",
    city_en: "Jeju",
    city_native: "제주",
    is_china: false,
  },
  "kuala-lumpur": {
    country_zh: "马来西亚",
    country_en: "Malaysia",
    city_zh: "吉隆坡",
    city_en: "Kuala Lumpur",
    city_native: "Kuala Lumpur",
    is_china: false,
  },
  melaka: {
    country_zh: "马来西亚",
    country_en: "Malaysia",
    city_zh: "马六甲",
    city_en: "Melaka",
    city_native: "Melaka",
    is_china: false,
  },
});

if (import.meta.env?.DEV) {
  for (const slug of CITY_SLUGS) {
    if (!CITY_STICKER_FILENAME_BY_SLUG[slug]) {
      console.warn(`[citySlugs] Missing CITY_STICKER_FILENAME_BY_SLUG for: ${slug}`);
    }
    if (!BOOKSHELF_CITY_DISPLAY_BY_SLUG[slug]) {
      console.warn(`[citySlugs] Missing BOOKSHELF_CITY_DISPLAY_BY_SLUG for: ${slug}`);
    }
  }
}

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
