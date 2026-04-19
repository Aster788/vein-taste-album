import dishesData from "../data/dishes.json";
import restaurantsData from "../data/restaurants.json";

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
