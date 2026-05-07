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

/**
 * @param {string | undefined | null} citySlug
 * @param {string | undefined | null} storeSlug
 * @returns {ReadonlyArray<{ href: string, filename: string }>}
 */
export function getStorePhotos(citySlug, storeSlug) {
  const key = `${normalizeSegment(citySlug)}/${normalizeSegment(storeSlug)}`;
  return PHOTO_INDEX.get(key) ?? [];
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
 * 同店铺图片排序：
 * 1) 匹配到菜名的图片优先；
 * 2) 未匹配且 basename 非中文数字序号次之；
 * 3) basename 为中文数字序号（含组合，如 十一/二十）的最后，且按数值顺序展示。
 * @param {ReadonlyArray<{ href: string, filename: string }>} photos
 * @param {ReadonlyArray<Record<string, unknown>>} dishes
 * @returns {Array<{ href: string, filename: string }>}
 */
export function sortPhotosByDishMatch(photos, dishes) {
  const getBucket = (filename) => {
    if (findMatchedDishByFilename(filename, dishes) != null) return 0;
    const basename = getBasenameWithoutExtension(filename).trim();
    return isChineseNumeralBasename(basename) ? 2 : 1;
  };
  const getNumeralRank = (filename) => {
    const basename = getBasenameWithoutExtension(filename).trim();
    return parseChineseNumeralBasename(basename) ?? Number.MAX_SAFE_INTEGER;
  };

  return [...photos].sort((left, right) => {
    const leftBucket = getBucket(left.filename);
    const rightBucket = getBucket(right.filename);
    if (leftBucket !== rightBucket) return leftBucket - rightBucket;

    if (leftBucket === 2) {
      const leftRank = getNumeralRank(left.filename);
      const rightRank = getNumeralRank(right.filename);
      if (leftRank !== rightRank) return leftRank - rightRank;
    }

    return left.filename.localeCompare(right.filename, "zh-Hans-CN");
  });
}
