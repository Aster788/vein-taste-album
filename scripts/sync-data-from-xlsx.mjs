import fs from "node:fs/promises";
import path from "node:path";
import xlsx from "xlsx";
import {
  DISHES_HEADERS,
  RESTAURANTS_HEADERS,
  normalizeNullableString,
  normalizeOptionalNumber,
  normalizeOptionalString,
  normalizeScope,
} from "./dataSchema.mjs";

const projectRoot = process.cwd();
const dataDir = path.join(projectRoot, "src", "data");
const restaurantsXlsxPath = path.join(dataDir, "restaurants.xlsx");
const dishesXlsxPath = path.join(dataDir, "dishes.xlsx");
const restaurantsJsonPath = path.join(dataDir, "restaurants.json");
const dishesJsonPath = path.join(dataDir, "dishes.json");

function firstSheetRows(workbookPath) {
  const workbook = xlsx.readFile(workbookPath, {
    cellDates: false,
    raw: false,
    defval: null,
  });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) return [];
  const sheet = workbook.Sheets[firstSheetName];
  return xlsx.utils.sheet_to_json(sheet, { defval: null });
}

function firstSheetHeaders(workbookPath) {
  const workbook = xlsx.readFile(workbookPath, {
    cellDates: false,
    raw: false,
    defval: null,
  });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) return [];
  const sheet = workbook.Sheets[firstSheetName];
  const rows = xlsx.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: null });
  return Array.isArray(rows[0]) ? rows[0].map((cell) => String(cell ?? "").trim()) : [];
}

function pickFields(row, headers) {
  const next = {};
  headers.forEach((header) => {
    next[header] = row?.[header] ?? null;
  });
  return next;
}

function hasAnyNonNull(values) {
  return values.some((value) => normalizeNullableString(value) != null);
}

function normalizeRestaurant(row) {
  const picked = pickFields(row, RESTAURANTS_HEADERS);
  const cityEn = normalizeOptionalString(picked.city_en);
  const cityZh = normalizeOptionalString(picked.city_zh);
  const cuisine = normalizeOptionalString(picked.cuisine);
  const storeSlug = normalizeNullableString(picked.store_slug);
  const nameZh = normalizeNullableString(picked.name_zh);
  const nameEn = normalizeNullableString(picked.name_en);
  const nameLocal = normalizeNullableString(picked.name_local);

  if (
    storeSlug == null ||
    !hasAnyNonNull([nameZh, nameEn, nameLocal])
  ) {
    return null;
  }

  const recordScope = normalizeScope(picked.record_scope);
  const isChina = String(picked.is_china ?? "")
    .trim()
    .toLowerCase();
  const normalized = {
    city_zh: cityZh,
    city_en: cityEn,
    country_zh: normalizeOptionalString(picked.country_zh),
    country_en: normalizeOptionalString(picked.country_en),
    is_china: isChina === "false" ? false : true,
    store_slug: storeSlug,
    record_scope: recordScope,
    name_zh: nameZh,
    name_en: nameEn,
    name_local: nameLocal,
    cuisine,
    address: normalizeOptionalString(picked.address),
    lng: normalizeOptionalNumber(picked.lng),
    lat: normalizeOptionalNumber(picked.lat),
    price_per_person: normalizeOptionalNumber(picked.price_per_person),
    score_overall: normalizeOptionalNumber(picked.score_overall),
    currency: normalizeOptionalString(picked.currency),
    hours: normalizeOptionalString(picked.hours),
    phone: normalizeOptionalString(picked.phone),
    map_platform: normalizeOptionalString(picked.map_platform),
    map_url: normalizeOptionalString(picked.map_url),
    dining_type: normalizeOptionalString(picked.dining_type),
    score_taste: normalizeOptionalNumber(picked.score_taste),
    socre_environment: normalizeOptionalNumber(picked.socre_environment),
    score_service: normalizeOptionalNumber(picked.score_service),
    score_queue: normalizeOptionalNumber(picked.score_queue),
    score_packaging: normalizeOptionalNumber(picked.score_packaging),
    score_delivery: normalizeOptionalNumber(picked.score_delivery),
    score_personal: normalizeOptionalNumber(picked.score_personal),
  };

  return normalized;
}

function normalizeDish(row) {
  const picked = pickFields(row, DISHES_HEADERS);
  const cityEn = normalizeOptionalString(picked.city_en).toLowerCase();
  const storeSlug = normalizeNullableString(picked.store_slug);
  const storeNameZh = normalizeNullableString(picked.store_name_zh);
  const storeNameLocal = normalizeNullableString(picked.store_name_local);
  const storeNameEn = normalizeNullableString(picked.store_name_en);
  const dishNameZh = normalizeNullableString(picked.dish_name_zh);
  const dishNameEn = normalizeNullableString(picked.dish_name_en);
  const dishNameLocal = normalizeNullableString(picked.dish_name_local);

  if (
    storeSlug == null ||
    !hasAnyNonNull([dishNameZh, dishNameEn, dishNameLocal])
  ) {
    return null;
  }

  return {
    store_slug: storeSlug,
    store_name_zh: storeNameZh,
    store_name_en: storeNameEn,
    store_name_local: storeNameLocal,
    city_en: cityEn,
    dish_name_zh: dishNameZh,
    dish_name_en: dishNameEn,
    dish_name_local: dishNameLocal,
    price: normalizeNullableString(picked.price),
    currency: normalizeOptionalString(picked.currency),
    taste: normalizeOptionalNumber(picked.taste),
    note: normalizeNullableString(picked.note),
  };
}

async function writeJson(filePath, payload) {
  await fs.writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

async function main() {
  const dishesHeaders = new Set(firstSheetHeaders(dishesXlsxPath));
  const legacyDishHeaders = ["name_zh", "name_en", "name_local"].filter((name) =>
    dishesHeaders.has(name),
  );
  if (legacyDishHeaders.length > 0) {
    throw new Error(
      `dishes.xlsx still includes legacy headers: ${legacyDishHeaders.join(", ")}. ` +
        "Please use only dish_name_zh / dish_name_en / dish_name_local.",
    );
  }

  const restaurantsRows = firstSheetRows(restaurantsXlsxPath);
  const dishesRows = firstSheetRows(dishesXlsxPath);
  const restaurants = restaurantsRows.map(normalizeRestaurant).filter(Boolean);
  const dishes = dishesRows.map(normalizeDish).filter(Boolean);

  await Promise.all([
    writeJson(restaurantsJsonPath, restaurants),
    writeJson(dishesJsonPath, dishes),
  ]);

  console.log(
    `[sync-data-from-xlsx] restaurants=${restaurants.length}, dishes=${dishes.length}`
  );
}

main().catch((error) => {
  console.error("[sync-data-from-xlsx] failed:", error);
  process.exitCode = 1;
});
