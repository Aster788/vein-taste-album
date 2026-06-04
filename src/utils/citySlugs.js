/**
 * PRD 13 城 URL 段（小写 + 连字符），与 geojson 文件名、global.css `html[data-city]` 一致。
 * 书架横向成书顺序与本数组顺序相同（`getBookshelfCities` 使用 `CITY_SLUGS.map`）。
 */
export const CITY_SLUGS = Object.freeze([
  "shanghai",
  "nanjing",
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
  nanjing: "nanjing-plum-blossom.svg",
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
 * `province_*` 供详情页顶栏「国家·省份·城市」；直辖市留空。
 * @type {Readonly<Record<(typeof CITY_SLUGS)[number], { country_zh: string; country_en: string; country_native?: string; province_zh?: string; province_en?: string; province_native?: string; city_zh: string; city_en: string; city_native: string; is_china: boolean }>>}
 */
export const BOOKSHELF_CITY_DISPLAY_BY_SLUG = Object.freeze({
  dalian: {
    country_zh: "中国",
    country_en: "China",
    province_zh: "辽宁",
    province_en: "Liaoning",
    city_zh: "大连",
    city_en: "Dalian",
    city_native: "",
    is_china: true,
  },
  qingdao: {
    country_zh: "中国",
    country_en: "China",
    province_zh: "山东",
    province_en: "Shandong",
    city_zh: "青岛",
    city_en: "Qingdao",
    city_native: "",
    is_china: true,
  },
  suzhou: {
    country_zh: "中国",
    country_en: "China",
    province_zh: "江苏",
    province_en: "Jiangsu",
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
  nanjing: {
    country_zh: "中国",
    country_en: "China",
    province_zh: "江苏",
    province_en: "Jiangsu",
    city_zh: "南京",
    city_en: "Nanjing",
    city_native: "",
    is_china: true,
  },
  guangzhou: {
    country_zh: "中国",
    country_en: "China",
    province_zh: "广东",
    province_en: "Guangdong",
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
    province_zh: "福建",
    province_en: "Fujian",
    city_zh: "福州",
    city_en: "Fuzhou",
    city_native: "",
    is_china: true,
  },
  xiamen: {
    country_zh: "中国",
    country_en: "China",
    province_zh: "福建",
    province_en: "Fujian",
    city_zh: "厦门",
    city_en: "Xiamen",
    city_native: "",
    is_china: true,
  },
  quanzhou: {
    country_zh: "中国",
    country_en: "China",
    province_zh: "福建",
    province_en: "Fujian",
    city_zh: "泉州",
    city_en: "Quanzhou",
    city_native: "",
    is_china: true,
  },
  jeju: {
    country_zh: "韩国",
    country_en: "South Korea",
    country_native: "한국",
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
 * 详情页顶栏标题：「国家·省份·城市」；无省份时省略省份段（如直辖市、非中国城）。
 * @param {Record<string, string | boolean | undefined> | null | undefined} meta
 * @returns {{ zh: string; en: string; native: string }}
 */
export function getCityDetailTitles(meta) {
  if (!meta) {
    return { zh: "城市详情", en: "City Detail", native: "City Detail" };
  }

  const pickPart = (locale, zhKey, enKey, nativeKey) => {
    const zh = String(meta[zhKey] ?? "").trim();
    const en = String(meta[enKey] ?? "").trim();
    const native = String(meta[nativeKey] ?? "").trim();
    if (locale === "en") return en || zh;
    if (locale === "native") return native || en || zh;
    return zh || en;
  };

  const joinParts = (locale, parts) => {
    const filtered = parts.map((part) => String(part ?? "").trim()).filter(Boolean);
    if (filtered.length === 0) return locale === "en" ? "City Detail" : "城市详情";
    return locale === "en" ? filtered.join(" · ") : filtered.join("·");
  };

  const build = (locale) =>
    joinParts(locale, [
      pickPart(locale, "country_zh", "country_en", "country_native"),
      pickPart(locale, "province_zh", "province_en", "province_native"),
      pickPart(locale, "city_zh", "city_en", "city_native"),
    ]);

  return {
    zh: build("zh"),
    en: build("en"),
    native: build("native"),
  };
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
