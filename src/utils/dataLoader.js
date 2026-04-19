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
 * 按城市筛选菜品（`dishes.json` 的 `city_en`）。
 * @param {string} cityEn
 * @returns {typeof dishes}
 */
export function getDishesByCity(cityEn) {
  const key = normalizeCityEn(cityEn);
  return dishes.filter((d) => normalizeCityEn(d.city_en) === key);
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
  if (restaurant.is_china) {
    return dish.store_name_zh === restaurant.name_zh;
  }
  const dLocal = dish.store_name_local;
  const rLocal = restaurant.name_local;
  if (dLocal != null && dLocal !== "" && rLocal != null && rLocal !== "") {
    return dLocal === rLocal;
  }
  return dish.store_name_zh === restaurant.name_zh;
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
 * @property {string} stickerHref Vite 解析后的贴纸 URL，供 `<img src>` 等使用
 * @property {Readonly<{ primary: string; secondary: string }>} colorTokens 全局配色变量名（值由 `data-city` 与 `global.css` 决定）
 */

/**
 * 书架 11 城：`CITY_SLUGS.map` 生成槽位顺序；展示名优先取该城在 `restaurants.json` 中的首条店铺。
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
