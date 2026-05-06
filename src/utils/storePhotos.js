const PHOTO_MODULES = import.meta.glob(
  "../assets/photos/*/*/*.{jpg,jpeg,png,webp,JPG,JPEG,PNG,WEBP}",
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
 * 判断 basename 是否为纯中文数字（一二三四五六七八九十及其组合）
 * @param {string} basename
 * @returns {boolean}
 */
export function isChineseNumeralBasename(basename) {
  const s = String(basename ?? "").trim();
  if (s === "") return false;
  // 匹配纯中文数字：一二三四五六七八九十及其组合（如"十二"、"二十三"等）
  return /^[一二三四五六七八九十]+$/.test(s);
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
 * 同店铺图片排序：能匹配到菜名的图片优先，然后按文件名排序。
 * @param {ReadonlyArray<{ href: string, filename: string }>} photos
 * @param {ReadonlyArray<Record<string, unknown>>} dishes
 * @returns {Array<{ href: string, filename: string }>}
 */
export function sortPhotosByDishMatch(photos, dishes) {
  return [...photos].sort((left, right) => {
    const leftMatched = findMatchedDishByFilename(left.filename, dishes) != null;
    const rightMatched = findMatchedDishByFilename(right.filename, dishes) != null;
    if (leftMatched !== rightMatched) return leftMatched ? -1 : 1;
    return left.filename.localeCompare(right.filename, "zh-Hans-CN");
  });
}
