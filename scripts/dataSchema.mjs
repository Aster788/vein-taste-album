export const RESTAURANTS_HEADERS = Object.freeze([
  "city_zh",
  "city_en",
  "country_zh",
  "country_en",
  "is_china",
  "store_slug",
  "record_scope",
  "name_zh",
  "name_en",
  "name_local",
  "cuisine",
  "cuisine_zh",
  "cuisine_en",
  "address",
  "lng",
  "lat",
  "price_per_person",
  "currency",
  "hours",
  "phone",
  "map_platform",
  "map_url",
  "dining_type",
  "score_overall",
  "score_taste",
  "socre_environment",
  "score_service",
  "score_queue",
  "score_packaging",
  "score_delivery",
  "score_personal",
]);

export const DISHES_HEADERS = Object.freeze([
  "store_slug",
  "store_name_zh",
  "store_name_local",
  "store_name_en",
  "city_en",
  "dish_name_zh",
  "dish_name_en",
  "dish_name_local",
  // Backward compatibility for older sheet headers
  "name_zh",
  "name_en",
  "name_local",
  "price",
  "currency",
  "taste",
  "note",
]);

export function normalizeScope(value) {
  const raw = String(value ?? "").trim().toLowerCase();
  return raw === "brand" ? "brand" : "branch";
}

export function normalizeNullableString(value) {
  if (value == null) return null;
  const next = String(value).trim();
  if (/^null$/i.test(next)) return null;
  return next === "" ? null : next;
}

export function normalizeOptionalString(value) {
  if (value == null) return "";
  return String(value).trim();
}

export function normalizeOptionalNumber(value) {
  if (value == null || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const maybe = Number(String(value).trim());
  return Number.isFinite(maybe) ? maybe : null;
}
