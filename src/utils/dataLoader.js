import dishesData from "../data/dishes.json";
import restaurantsData from "../data/restaurants.json";
import {
  BOOKSHELF_CITY_DISPLAY_BY_SLUG,
  CITY_SLUGS,
  CITY_STICKER_FILENAME_BY_SLUG,
  NON_CHINA_CITY_SLUGS,
} from "./citySlugs.js";

const restaurants = restaurantsData;
const dishes = dishesData;

function normalizeRecordScope(recordScope) {
  return String(recordScope ?? "")
    .trim()
    .toLowerCase() === "brand"
    ? "brand"
    : "branch";
}

function hasValidCoordinates(row) {
  return Number.isFinite(row?.lng) && Number.isFinite(row?.lat);
}

function isRestaurantClosed(row) {
  return String(row?.closed ?? "")
    .trim()
    .toLowerCase() === "yes";
}

function isChainStorePlaceholderAddress(row) {
  return String(row?.address ?? "").trim() === "连锁店";
}

/**
 * 地图页排除：brand、已关闭、地址为「连锁店」占位（菜品页仍展示）。
 * @param {typeof restaurants[number]} row
 * @returns {boolean}
 */
export function isExcludedFromMap(row) {
  if (normalizeRecordScope(row?.record_scope) === "brand") return true;
  if (isRestaurantClosed(row)) return true;
  if (isChainStorePlaceholderAddress(row)) return true;
  return false;
}

/**
 * 统一城市键：大小写不敏感（`Dalian` / `dalian` 一致）。
 * @param {string | undefined | null} cityEn
 * @returns {string}
 */
export function normalizeCityEn(cityEn) {
  return String(cityEn ?? "")
    .trim()
    .toLowerCase();
}

function normalizeNameKey(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function escapeRegExp(value) {
  return String(value ?? "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function resolveCurrencyPrefix(currencyCode) {
  const code = String(currencyCode ?? "").trim().toUpperCase();
  if (code === "") return "";

  // ISO 4217 currency code -> localized symbol (JPY -> ¥, THB -> ฿, etc.).
  // Using "narrowSymbol" keeps symbols concise for inline dish title rendering.
  try {
    const formatter = new Intl.NumberFormat("en", {
      style: "currency",
      currency: code,
      currencyDisplay: "narrowSymbol",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
    const parts = formatter.formatToParts(1);
    const symbol = parts.find((part) => part.type === "currency")?.value ?? "";
    const normalizedSymbol = String(symbol).trim();
    if (normalizedSymbol !== "") return normalizedSymbol;
  } catch {
    // Unsupported currency code or runtime Intl limitations: fall back to code.
  }
  return code;
}

function nonEmptyNameKeys(...values) {
  return values
    .map((value) => normalizeNameKey(value))
    .filter((value) => value !== "");
}

function normalizeStoreSlug(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

/**
 * 按城市筛选店铺（`restaurants.json` 的 `city_en`）。
 * @param {string} cityEn
 * @returns {typeof restaurants}
 */
export function getRestaurantsByCity(cityEn) {
  const key = normalizeCityEn(cityEn);
  return restaurants.filter((r) => normalizeCityEn(r.city_en) === key);
}

/**
 * 仅返回可上地图的具体门店（branch、坐标完整，且非关闭/连锁店占位/brand）。
 * @param {string} cityEn
 * @returns {typeof restaurants}
 */
export function getMappableRestaurantsByCity(cityEn) {
  return getRestaurantsByCity(cityEn).filter(
    (row) =>
      normalizeRecordScope(row.record_scope) === "branch" &&
      hasValidCoordinates(row) &&
      !isExcludedFromMap(row),
  );
}

/**
 * 按城市筛选菜品（`dishes.json` 的 `city_en`）。
 * @param {string} cityEn
 * @returns {typeof dishes}
 */
export function getDishesByCity(cityEn) {
  const key = normalizeCityEn(cityEn);
  return dishes.filter((d) => normalizeCityEn(d.city_en) === key);
}

/**
 * 菜品价格：空值时返回空字符串，便于 UI 侧按“有值才显示”处理。
 * @param {typeof dishes[number]} dish
 * @returns {string}
 */
export function getDishPriceText(dish) {
  const value = dish?.price;
  if (value == null) return "";
  const text = String(value).trim();
  if (text === "") return "";

  // dishes.xlsx: `currency` is the unit for `price`.
  const currency = String(dish?.currency ?? "").trim().toUpperCase();
  if (currency === "") return text;

  // If authors already typed a currency marker/text in `price`, keep it as-is.
  const currencyCodePattern = new RegExp(`\\b${escapeRegExp(currency)}\\b`, "i");
  if (/[¥₩$€£₹₽₫฿₺₴₦₱₲₡₵₸₭₪₼₾₣]|RM/i.test(text) || currencyCodePattern.test(text)) {
    return text;
  }

  // If currency is provided and text doesn't already contain a currency marker,
  // prepend resolved symbol/prefix for both numeric and descriptive prices.
  const currencyPrefix = resolveCurrencyPrefix(currency);
  if (currencyPrefix === "") return text;
  return `${currencyPrefix}${text}`;
}

/**
 * 菜品备注：空值时返回空字符串，便于 UI 侧按“有值才显示”处理。
 * @param {typeof dishes[number]} dish
 * @returns {string}
 */
export function getDishNoteText(dish) {
  const value = dish?.note;
  if (value == null) return "";
  const text = String(value).trim();
  return text === "" ? "" : text;
}

/**
 * 判断单条菜品是否属于指定店铺（与 PRD：中国用 `store_name_zh` ↔ `name_zh`，非中国用 `store_name_local` 等一致）。
 * @param {typeof dishes[number]} dish
 * @param {typeof restaurants[number]} restaurant
 * @returns {boolean}
 */
export function dishBelongsToRestaurant(dish, restaurant) {
  if (normalizeCityEn(dish.city_en) !== normalizeCityEn(restaurant.city_en)) {
    return false;
  }

  const dishSlug = normalizeStoreSlug(dish.store_slug);
  const restaurantSlug = normalizeStoreSlug(restaurant.store_slug);
  if (dishSlug !== "" && restaurantSlug !== "" && dishSlug === restaurantSlug) {
    return true;
  }

  const dishKeys = new Set(
    nonEmptyNameKeys(
      dish.store_name_zh,
      dish.store_name_en,
      dish.store_name_local,
    ),
  );
  const restaurantKeys = new Set(
    nonEmptyNameKeys(
      restaurant.name_zh,
      restaurant.name_en,
      restaurant.name_local,
    ),
  );

  for (const key of dishKeys) {
    if (restaurantKeys.has(key)) return true;
  }
  return false;
}

/**
 * 返回该店铺在 `dishes.json` 中的全部菜品。
 * @param {typeof restaurants[number]} restaurant
 * @returns {typeof dishes}
 */
export function getDishesForRestaurant(restaurant) {
  return dishes.filter((d) => dishBelongsToRestaurant(d, restaurant));
}

/** @returns {ReadonlyArray<(typeof restaurants)[number]>} */
export function getAllRestaurants() {
  return restaurants;
}

/** @returns {ReadonlyArray<(typeof dishes)[number]>} */
export function getAllDishes() {
  return dishes;
}

/**
 * URL 段（如 `kuala-lumpur`）→ `restaurants.json` 的 `city_en`（如 `Kuala Lumpur`）。
 * @param {string} slug
 * @returns {string}
 */
export function cityEnFromBookshelfSlug(slug) {
  return slug
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

/**
 * 书架「一本书」对应的城市元数据（展示顺序与 `citySlugs.js` 中 `CITY_SLUGS` 一致）。
 *
 * @typedef {Object} BookshelfCityRow
 * @property {string} slug URL 段，与 `html[data-city]` / 路由一致
 * @property {string} city_en 来自 `restaurants.json` 首条匹配店的 `city_en`，无数据时由 slug 推导
 * @property {string} city_zh 城市中文名（或济州/吉隆坡中文名）
 * @property {string} country_zh 中国城：国家中文；非中国城：空
 * @property {string} country_en 中国城：国家英文；非中国城：空
 * @property {string} city_native 非中国城：本国语城市名（供详情页三语文案等，**不用于书脊**）；中国城：空字符串
 * @property {boolean} is_china 同上 `is_china`，无数据时由 slug 是否属非中国区推导
 * @property {string} stickerFileName `stickers/cities/` 下文件名
 * @property {string} stickerHref Vite 解析后的贴纸 URL，供 `<img src>` 等使用（SVG 须无整幅黑/白底，见 `citySlugs.js`）
 * @property {Readonly<{ primary: string; secondary: string }>} colorTokens 全局配色变量名（值由 `data-city` 与 `global.css` 决定）
 */

/**
 * 书架 10 城：`CITY_SLUGS.map` 生成槽位顺序；展示名优先取该城在 `restaurants.json` 中的首条店铺。
 * @returns {ReadonlyArray<BookshelfCityRow>}
 */
export function getBookshelfCities() {
  const all = getAllRestaurants();
  return CITY_SLUGS.map((slug) => {
    const derivedEn = cityEnFromBookshelfSlug(slug);
    const row = all.find(
      (r) => normalizeCityEn(r.city_en) === normalizeCityEn(derivedEn),
    );
    const isChina = !NON_CHINA_CITY_SLUGS.includes(slug);
    const fb = BOOKSHELF_CITY_DISPLAY_BY_SLUG[slug];
    const resolvedIsChina = row?.is_china ?? isChina;
    const city_en = (row?.city_en ?? fb?.city_en ?? derivedEn).trim();
    const city_zh = (row?.city_zh ?? fb?.city_zh ?? "").trim();
    const country_zh = String(row?.country_zh || fb?.country_zh || "").trim();
    const country_en = String(row?.country_en || fb?.country_en || "").trim();
    const city_native = resolvedIsChina
      ? ""
      : String(row?.city_local ?? fb?.city_native ?? "").trim();
    const stickerFileName = CITY_STICKER_FILENAME_BY_SLUG[slug] ?? "";
    const stickerHref =
      stickerFileName === ""
        ? ""
        : new URL(
            `../assets/stickers/cities/${stickerFileName}`,
            import.meta.url,
          ).href;
    return {
      slug,
      city_en,
      city_zh,
      country_zh,
      country_en,
      city_native,
      is_china: resolvedIsChina,
      stickerFileName,
      stickerHref,
      colorTokens: Object.freeze({
        primary: "--city-primary",
        secondary: "--city-secondary",
      }),
    };
  });
}
