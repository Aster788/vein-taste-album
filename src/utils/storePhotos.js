import restaurantsData from "../data/restaurants.json";
import { cityEnFromBookshelfSlug, normalizeCityEn } from "./dataLoader.js";
import { stripBranchSuffix } from "./storeGroups.js";
import { isNumericLeading, normalizeSortText } from "./sortText.js";

const PHOTO_MODULES = import.meta.glob(
  "../assets/photos/*/*/*.{jpg,jpeg,png,webp,heic,JPG,JPEG,PNG,WEBP,HEIC}",
  { eager: true, import: "default" },
);

function normalizeSegment(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function buildPhotoIndex() {
  /** @type {Map<string, Array<{ href: string, filename: string }>>} */
  const index = new Map();

  Object.entries(PHOTO_MODULES).forEach(([path, href]) => {
    const matched = path.match(/\/assets\/photos\/([^/]+)\/([^/]+)\/([^/]+)$/i);
    if (!matched) return;
    const [, cityFolder, storeFolder, filename] = matched;
    const key = `${normalizeSegment(cityFolder)}/${normalizeSegment(storeFolder)}`;
    const list = index.get(key) ?? [];
    list.push({ href, filename });
    index.set(key, list);
  });

  index.forEach((list, key) => {
    index.set(
      key,
      list.sort((left, right) => left.filename.localeCompare(right.filename, "zh-Hans-CN")),
    );
  });

  return index;
}

const PHOTO_INDEX = buildPhotoIndex();

function normalizeMatchKey(value) {
  const s = String(value ?? "").trim();
  if (s === "") return "";
  return s.normalize("NFC").toLowerCase();
}

/**
 * 判断 basename 是否为中文数字序号（支持单字与常见组合，如：一、十、十一、二十）。
 * @param {string} basename
 * @returns {boolean}
 */
export function isChineseNumeralBasename(basename) {
  return parseChineseNumeralBasename(basename) != null;
}

/**
 * 解析中文数字 basename 为阿拉伯数字。
 * 支持范围：1-99（例如 一、十、十一、二十、二十三）。
 * @param {string} basename
 * @returns {number | null}
 */
function parseChineseNumeralBasename(basename) {
  const s = String(basename ?? "").trim();
  if (s === "") return null;
  if (!/^(十[一二三四五六七八九]?|[一二三四五六七八九]十[一二三四五六七八九]?|[一二三四五六七八九])$/.test(s)) {
    return null;
  }

  /** @type {Record<string, number>} */
  const digit = {
    一: 1,
    二: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    七: 7,
    八: 8,
    九: 9,
  };

  if (digit[s]) return digit[s];
  if (s === "十") return 10;

  if (s.startsWith("十")) {
    const ones = s.slice(1);
    return 10 + (digit[ones] ?? 0);
  }

  const [tensChar, maybeTen, onesChar] = Array.from(s);
  if (maybeTen !== "十") return null;
  return (digit[tensChar] ?? 0) * 10 + (digit[onesChar] ?? 0);
}

function basenameWithoutExtension(filename) {
  const name = String(filename ?? "").trim();
  if (name === "") return "";
  const lastDot = name.lastIndexOf(".");
  if (lastDot <= 0) return normalizeMatchKey(name);
  return normalizeMatchKey(name.slice(0, lastDot));
}

/**
 * basename 与 `dishes.json` 条目匹配：优先 `dish_name_local`，其次 `dish_name_en`，最后 `dish_name_zh`。
 * @param {ReadonlyArray<Record<string, unknown>>} dishes
 * @param {string} basenameKey
 * @returns {Record<string, unknown> | null}
 */
function matchDishByBasename(dishes, basenameKey) {
  if (basenameKey === "") return null;
  const tryField = (field) => {
    for (const dish of dishes) {
      if (normalizeMatchKey(dish[field]) === basenameKey) return dish;
    }
    return null;
  };
  return tryField("dish_name_local") || tryField("dish_name_en") || tryField("dish_name_zh");
}

function normalizeStoreSlug(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

/**
 * @param {Set<string>} keys
 * @param {string | null | undefined} raw
 */
function addStoreNameKey(keys, raw) {
  const text = String(raw ?? "").trim();
  if (text === "") return;
  keys.add(normalizeMatchKey(text));
}

/**
 * 店名图匹配键：与 `dishes.json` 的 `store_name_*` 完全一致，并补充基础店名（去括号分店后缀）、
 * 以及同城同 `store_slug` 各分店在 `restaurants.json` 的 `name_*`（含带分店名全称）。
 * @param {ReadonlyArray<Record<string, unknown>>} dishes
 * @param {Record<string, unknown> | null | undefined} restaurant
 * @returns {Set<string>}
 */
function collectStoreNameKeys(dishes, restaurant) {
  const keys = new Set();

  for (const dish of dishes) {
    for (const field of ["store_name_local", "store_name_en", "store_name_zh"]) {
      addStoreNameKey(keys, dish[field]);
    }
    const storeZh = String(dish.store_name_zh ?? "").trim();
    const baseFromDish = stripBranchSuffix(storeZh);
    if (baseFromDish !== "") addStoreNameKey(keys, baseFromDish);
  }

  if (restaurant) {
    const city = normalizeCityEn(restaurant.city_en);
    const slug = normalizeStoreSlug(restaurant.store_slug);
    if (city !== "" && slug !== "") {
      for (const row of restaurantsData) {
        if (normalizeCityEn(row.city_en) !== city) continue;
        if (normalizeStoreSlug(row.store_slug) !== slug) continue;
        addStoreNameKey(keys, row.name_local);
        addStoreNameKey(keys, row.name_en);
        addStoreNameKey(keys, row.name_zh);
        const baseFromBranch = stripBranchSuffix(row.name_zh);
        if (baseFromBranch !== "") addStoreNameKey(keys, baseFromBranch);
      }
    }
  }

  return keys;
}

/**
 * @param {ReadonlySet<string>} storeNameKeys
 * @param {string} basenameKey
 * @returns {boolean}
 */
function matchesStoreNameByBasename(storeNameKeys, basenameKey) {
  return basenameKey !== "" && storeNameKeys.has(basenameKey);
}

const EN_LETTER_COLLATOR = new Intl.Collator("en", {
  usage: "sort",
  sensitivity: "base",
  numeric: true,
});

const ZH_PINYIN_COLLATOR = new Intl.Collator("zh-Hans-CN-u-co-pinyin", {
  usage: "sort",
  sensitivity: "base",
  numeric: true,
});

/** @returns {0 | 1 | 2} — 0 英文起头，1 数字起头，2 中文起头，3 其它 */
function getMiscBasenameScriptRank(basename) {
  const text = normalizeSortText(basename);
  if (text === "") return 3;
  if (/^[a-zA-Z]/.test(text)) return 0;
  if (isNumericLeading(text)) return 1;
  if (/^[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/.test(text)) return 2;
  return 3;
}

/**
 * 第 3 档（非菜名、非店名、非中文序号）排序：英文起头 → 数字起头 → 中文拼音 → 其它。
 * @param {string} leftBasename
 * @param {string} rightBasename
 * @returns {number}
 */
function compareMiscBasenames(leftBasename, rightBasename) {
  const left = normalizeSortText(leftBasename);
  const right = normalizeSortText(rightBasename);
  const leftRank = getMiscBasenameScriptRank(left);
  const rightRank = getMiscBasenameScriptRank(right);
  if (leftRank !== rightRank) return leftRank - rightRank;

  if (leftRank === 0) {
    return EN_LETTER_COLLATOR.compare(left, right);
  }

  if (leftRank === 2) {
    return ZH_PINYIN_COLLATOR.compare(left, right);
  }

  if (leftRank === 1) {
    return ZH_PINYIN_COLLATOR.compare(left, right);
  }

  return left.localeCompare(right, "zh-Hans-CN");
}

function photoCityLookupKeys(citySlug, cityEn = null) {
  const keys = new Set();
  const raw = normalizeSegment(citySlug);
  if (raw !== "") keys.add(raw);
  const fromBookshelf = normalizeSegment(cityEnFromBookshelfSlug(citySlug));
  if (fromBookshelf !== "") keys.add(fromBookshelf);
  const fromCityEn = normalizeSegment(cityEn);
  if (fromCityEn !== "") keys.add(fromCityEn);
  return keys;
}

/**
 * @param {string | undefined | null} citySlug
 * @param {string | undefined | null} storeSlug
 * @param {string | undefined | null} [cityEn]
 * @returns {ReadonlyArray<{ href: string, filename: string }>}
 */
export function getStorePhotos(citySlug, storeSlug, cityEn = null) {
  const store = normalizeSegment(storeSlug);
  if (store === "") return [];

  for (const city of photoCityLookupKeys(citySlug, cityEn)) {
    const photos = PHOTO_INDEX.get(`${city}/${store}`);
    if (photos?.length) return photos;
  }

  return [];
}

/**
 * @param {string} filename
 * @param {ReadonlyArray<Record<string, unknown>>} dishes
 * @returns {Record<string, unknown> | null}
 */
export function findMatchedDishByFilename(filename, dishes) {
  const basenameKey = basenameWithoutExtension(filename);
  return matchDishByBasename(dishes, basenameKey);
}

/**
 * 获取文件名 basename（不含扩展名），保留原始大小写
 * @param {string} filename
 * @returns {string}
 */
export function getBasenameWithoutExtension(filename) {
  const name = String(filename ?? "").trim();
  if (name === "") return "";
  const lastDot = name.lastIndexOf(".");
  if (lastDot <= 0) return name;
  return name.slice(0, lastDot);
}

/**
 * 同店铺图片排序（四档）：
 * 0) basename 匹配 `dishes.json` 菜名（dish_name_local → dish_name_en → dish_name_zh）；
 * 1) basename 匹配店名（`dishes.json` 的 `store_name_*` 全文 + 去括号基础名 + 同 slug 分店 `restaurants.json` 的 `name_*`）；
 * 2) 其余非中文数字序号：英文起头按英文字母序，中文起头按拼音序（数字起头介于二者之间）；
 * 3) 中文数字序号（一～九、十、十一…）最后，按数值升序。
 * @param {ReadonlyArray<{ href: string, filename: string }>} photos
 * @param {ReadonlyArray<Record<string, unknown>>} dishes
 * @param {Record<string, unknown> | null | undefined} [restaurant]
 *   强烈建议传入当前店铺（如 `selectedStore`）：
 *   - 可补充同城同 `store_slug` 分店 `name_*` 键，保障「菜名图 > 店名图 > 其它」稳定成立；
 *   - 若省略，函数会退化为仅依赖 `dishes` 的店名键，可能导致店名图优先级命中不足。
 * @returns {Array<{ href: string, filename: string }>}
 */
export function sortPhotosByDishMatch(photos, dishes, restaurant = null) {
  if (
    import.meta.env?.DEV &&
    (restaurant == null || String(restaurant?.store_slug ?? "").trim() === "")
  ) {
    console.warn(
      "[storePhotos] sortPhotosByDishMatch called without valid restaurant; " +
        "store-name priority may degrade. Pass selectedStore to keep " +
        "`dish > store > misc > numerals` ordering stable.",
    );
  }
  const storeNameKeys = collectStoreNameKeys(dishes, restaurant);

  const getBucket = (filename) => {
    if (findMatchedDishByFilename(filename, dishes) != null) return 0;
    const basenameKey = basenameWithoutExtension(filename);
    if (matchesStoreNameByBasename(storeNameKeys, basenameKey)) return 1;
    const basename = getBasenameWithoutExtension(filename).trim();
    if (isChineseNumeralBasename(basename)) return 3;
    return 2;
  };

  const getNumeralRank = (filename) => {
    const basename = getBasenameWithoutExtension(filename).trim();
    return parseChineseNumeralBasename(basename) ?? Number.MAX_SAFE_INTEGER;
  };

  const compareWithinBucket = (left, right, bucket) => {
    if (bucket === 3) {
      const leftRank = getNumeralRank(left.filename);
      const rightRank = getNumeralRank(right.filename);
      if (leftRank !== rightRank) return leftRank - rightRank;
    }

    if (bucket === 2) {
      const leftBasename = getBasenameWithoutExtension(left.filename);
      const rightBasename = getBasenameWithoutExtension(right.filename);
      const byMisc = compareMiscBasenames(leftBasename, rightBasename);
      if (byMisc !== 0) return byMisc;
    }

    return left.filename.localeCompare(right.filename, "zh-Hans-CN");
  };

  return [...photos].sort((left, right) => {
    const leftBucket = getBucket(left.filename);
    const rightBucket = getBucket(right.filename);
    if (leftBucket !== rightBucket) return leftBucket - rightBucket;
    return compareWithinBucket(left, right, leftBucket);
  });
}
