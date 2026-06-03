import fs from "node:fs/promises";
import path from "node:path";
import xlsx from "xlsx";
import { BOOKSHELF_CITY_DISPLAY_BY_SLUG, normalizeCitySlug } from "../src/utils/citySlugs.js";
import { loadEnvLocal } from "./load-env-local.mjs";

loadEnvLocal();

const API_KEY = process.env.GOOGLE_MAPS_API_KEY?.trim();
if (!API_KEY) {
  throw new Error("Missing GOOGLE_MAPS_API_KEY in .env.local");
}

const root = process.cwd();
const dataDir = path.join(root, "src", "data");
const restaurantsPath = path.join(dataDir, "restaurants.xlsx");
const logPath = path.join(dataDir, "city-enrichment-log.json");

const CITY_META_BY_SLUG = new Map(
  Object.entries(BOOKSHELF_CITY_DISPLAY_BY_SLUG).map(([slug, meta]) => [
    slug,
    {
      city_zh: meta.city_zh,
      city_en: normalizeCitySlug(meta.city_en),
      country_zh: meta.country_zh,
      country_en: String(meta.country_en ?? "").toLowerCase(),
      is_china: meta.is_china ? "true" : "false",
      currency: meta.is_china ? "CNY" : slug === "jeju" ? "KRW" : slug === "kuala-lumpur" ? "MYR" : "",
    },
  ])
);

const LOCAL_LANGUAGE_BY_CITY = Object.freeze({
  shanghai: "zh-CN",
  qingdao: "zh-CN",
  chongqing: "zh-CN",
  guangzhou: "zh-CN",
  jeju: "ko",
  "kuala-lumpur": "ms",
  fuzhou: "zh-CN",
  quanzhou: "zh-CN",
  xiamen: "zh-CN",
  dalian: "zh-CN",
  // Future extension examples:
  // tokyo: "ja",
  // bangkok: "th",
});

function readRows(filePath) {
  const wb = xlsx.readFile(filePath, { raw: false, defval: null });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = xlsx.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: null });
  return { wb, sheet, rows };
}

function buildHeaderMap(headers) {
  const map = new Map();
  headers.forEach((h, idx) => map.set(String(h ?? "").trim(), idx));
  return map;
}

function hasCellValue(value) {
  if (value == null) return false;
  return String(value).trim() !== "";
}

function normalizeTypesToCuisine(types) {
  if (!Array.isArray(types) || types.length === 0) return "";
  const priority = [
    ["korean_restaurant", "韩餐"],
    ["seafood_restaurant", "海鲜"],
    ["japanese_restaurant", "日料"],
    ["chinese_restaurant", "中餐"],
    ["western_restaurant", "西餐"],
    ["barbecue_restaurant", "烧烤"],
    ["chicken_restaurant", "炸鸡"],
    ["noodle_shop", "面食"],
    ["cafe", "咖啡馆"],
    ["bakery", "面包甜点"],
    ["restaurant", "餐厅"],
    ["food", "美食"],
    ["tourist_attraction", "景点"],
  ];
  for (const [type, label] of priority) {
    if (types.includes(type)) return label;
  }
  return types.slice(0, 3).join(",");
}

function mapPriceLevel(level, currency) {
  const v = Number(level);
  if (!Number.isFinite(v)) return null;
  if (v <= 0) return null;
  if (currency === "KRW") {
    if (v === 1) return 10000;
    if (v === 2) return 20000;
    if (v === 3) return 40000;
    if (v >= 4) return 80000;
  }
  if (currency === "CNY") {
    if (v === 1) return 30;
    if (v === 2) return 80;
    if (v === 3) return 150;
    if (v >= 4) return 300;
  }
  if (currency === "MYR") {
    if (v === 1) return 20;
    if (v === 2) return 40;
    if (v === 3) return 80;
    if (v >= 4) return 150;
  }
  return null;
}

function toHoursText(openingHours) {
  const weekday = openingHours?.weekday_text;
  if (!Array.isArray(weekday) || weekday.length === 0) return "";
  const dayOrder = ["星期一", "星期二", "星期三", "星期四", "星期五", "星期六", "星期日"];
  const pairs = weekday
    .map((line) => String(line ?? "").trim())
    .map((line) => {
      const m = line.match(/^(星期[一二三四五六日])\s*:\s*(.+)$/);
      return m ? { day: m[1], time: m[2].trim() } : null;
    })
    .filter(Boolean);

  if (pairs.length !== 7) {
    return weekday
      .map((line) => String(line ?? "").replace(/^(星期[一二三四五六日])\s*:\s*/, "$1 "))
      .join(" | ");
  }
  const dayToTime = new Map(pairs.map((p) => [p.day, p.time]));
  const ordered = dayOrder.map((day) => ({ day, time: dayToTime.get(day) ?? "" }));
  if (ordered.some((d) => !d.time)) {
    return weekday
      .map((line) => String(line ?? "").replace(/^(星期[一二三四五六日])\s*:\s*/, "$1 "))
      .join(" | ");
  }

  const segments = [];
  let start = 0;
  for (let i = 1; i <= ordered.length; i += 1) {
    const changed = i === ordered.length || ordered[i].time !== ordered[start].time;
    if (!changed) continue;
    segments.push({
      from: start,
      to: i - 1,
      time: ordered[start].time,
    });
    start = i;
  }

  if (segments.length === 1) {
    return `周一至周日 ${segments[0].time}`;
  }

  const byTime = new Map();
  const timeOrder = [];
  for (const seg of segments) {
    const dayText =
      seg.from === seg.to
        ? dayOrder[seg.from]
        : `${dayOrder[seg.from]}至${dayOrder[seg.to]}`;
    if (!byTime.has(seg.time)) {
      byTime.set(seg.time, []);
      timeOrder.push(seg.time);
    }
    byTime.get(seg.time).push(dayText);
  }

  return timeOrder
    .map((time) => `${byTime.get(time).join("、")} ${time}`)
    .join(" | ");
}

function detectTitleLanguage(title) {
  const text = String(title ?? "").trim();
  if (!text) return "local";
  if (/^[A-Za-z0-9\s'’\-&.,/()]+$/.test(text)) {
    return "en";
  }
  const hasZh = /[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/u.test(text);
  if (hasZh) {
    const stripped = text.replace(
      /[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF0-9\s'’\-&.,/()，。！？：；、（）【】《》「」『』]/gu,
      ""
    );
    return stripped.length === 0 ? "zh" : "local";
  }
  return "local";
}

function hasChineseChars(text) {
  return /[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/u.test(String(text ?? ""));
}

function isPureEnglishText(text) {
  const value = String(text ?? "").trim();
  if (!value) return false;
  return /^[A-Za-z0-9\s'’\-&.,/()]+$/.test(value);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseGoogleMapsUrlMeta(url) {
  if (!url) return {};
  const match = String(url).match(/1s(0x[0-9a-f]+:0x[0-9a-f]+)/i);
  return { cidLike: match?.[1] ?? null };
}

async function fetchJson(url) {
  const response = await fetch(url);
  const data = await response.json();
  return data;
}

async function findPlaceByTitle(title, cityQuery) {
  const query = encodeURIComponent(`${title} ${cityQuery}`.trim());
  const fields = encodeURIComponent(
    "place_id,name,formatted_address,geometry,types,rating,price_level"
  );
  const url =
    `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?` +
    `input=${query}&inputtype=textquery&fields=${fields}&language=zh-CN&key=${API_KEY}`;
  const data = await fetchJson(url);
  const candidate = Array.isArray(data?.candidates) ? data.candidates[0] : null;
  return { data, candidate };
}

async function fetchPlaceDetails(placeId) {
  const fields = encodeURIComponent(
    [
      "place_id",
      "name",
      "formatted_address",
      "geometry",
      "types",
      "rating",
      "price_level",
      "international_phone_number",
      "formatted_phone_number",
      "opening_hours",
      "url",
      "website",
    ].join(",")
  );
  const url =
    `https://maps.googleapis.com/maps/api/place/details/json?` +
    `place_id=${encodeURIComponent(placeId)}&fields=${fields}&language=zh-CN&key=${API_KEY}`;
  const data = await fetchJson(url);
  return data?.result ?? null;
}

async function fetchPlaceNameByLanguage(placeId, language) {
  const fields = encodeURIComponent("name");
  const url =
    `https://maps.googleapis.com/maps/api/place/details/json?` +
    `place_id=${encodeURIComponent(placeId)}&fields=${fields}&language=${encodeURIComponent(language)}&key=${API_KEY}`;
  const data = await fetchJson(url);
  return String(data?.result?.name ?? "").trim();
}

async function fetchMultilingualNames(placeId, cityMeta) {
  if (!placeId) return { zh: "", en: "", local: "" };
  const localLanguage = LOCAL_LANGUAGE_BY_CITY[cityMeta.city_en] ?? "en";
  const [zhName, enName, localName] = await Promise.all([
    fetchPlaceNameByLanguage(placeId, "zh-CN"),
    fetchPlaceNameByLanguage(placeId, "en"),
    fetchPlaceNameByLanguage(placeId, localLanguage),
  ]);
  return {
    zh: zhName,
    en: enName,
    local: localName,
  };
}

async function main() {
  const allDataEntries = await fs.readdir(dataDir, { withFileTypes: true });
  const sourceXlsxFiles = allDataEntries
    .filter((entry) => entry.isFile() && /\.xlsx$/i.test(entry.name))
    .map((entry) => entry.name)
    .filter((name) => {
      const lower = name.toLowerCase();
      return !lower.startsWith("~$") && lower !== "restaurants.xlsx" && lower !== "dishes.xlsx";
    });

  const sourcePayloads = sourceXlsxFiles
    .map((filename) => {
      const slug = normalizeCitySlug(path.basename(filename, path.extname(filename)));
      const cityMeta = CITY_META_BY_SLUG.get(slug);
      if (!cityMeta) return null;
      const sourcePath = path.join(dataDir, filename);
      const { rows } = readRows(sourcePath);
      const headers = rows[0] || [];
      const headerMap = buildHeaderMap(headers);
      const titleIdx = headerMap.get("Title");
      const urlIdx = headerMap.get("URL");
      if (titleIdx == null || urlIdx == null) return null;
      const records = rows
        .slice(1)
        .map((row, i) => ({
          citySlug: slug,
          sourceFile: filename,
          sourceRow: i + 2,
          title: String(row[titleIdx] ?? "").trim(),
          mapUrl: String(row[urlIdx] ?? "").trim(),
          cityMeta,
        }))
        .filter((r) => r.title);
      if (records.length === 0) return null;
      return { slug, cityMeta, records };
    })
    .filter(Boolean);

  if (sourcePayloads.length === 0) {
    throw new Error("No city source xlsx (Title/URL format) found in src/data.");
  }

  const { wb: restWb, rows: restRows } = readRows(restaurantsPath);
  const restHeaders = restRows[0] || [];
  const restMap = buildHeaderMap(restHeaders);
  const cityIdx = restMap.get("city_en");
  const rowIndexesByCity = new Map();
  for (let i = 1; i < restRows.length; i += 1) {
    const cityRaw = String(restRows[i][cityIdx] ?? "").trim();
    const citySlug = normalizeCitySlug(cityRaw);
    if (!rowIndexesByCity.has(citySlug)) rowIndexesByCity.set(citySlug, []);
    rowIndexesByCity.get(citySlug).push(i);
  }

  const setField = (row, key, value) => {
    const idx = restMap.get(key);
    if (idx == null) return;
    row[idx] = value == null ? null : value;
  };
  const getField = (row, key) => {
    const idx = restMap.get(key);
    if (idx == null) return null;
    return row[idx] ?? null;
  };
  const isManualLocked = (row, key) => ["name_zh", "cuisine", "hours"].includes(key) && hasCellValue(getField(row, key));

  const logs = [];
  for (const payload of sourcePayloads) {
    const targetRowIndexes = rowIndexesByCity.get(payload.slug) || [];
    if (targetRowIndexes.length < payload.records.length) {
      throw new Error(
        `restaurants.xlsx rows for ${payload.slug} (${targetRowIndexes.length}) are less than source rows (${payload.records.length}).`
      );
    }
    for (let i = 0; i < payload.records.length; i += 1) {
      const src = payload.records[i];
      const targetRowIndex = targetRowIndexes[i];
      const targetRow = restRows[targetRowIndex];
      const meta = parseGoogleMapsUrlMeta(src.mapUrl);

      const find = await findPlaceByTitle(src.title, src.cityMeta.city_en);
      let detail = null;
      if (find.candidate?.place_id) {
        detail = await fetchPlaceDetails(find.candidate.place_id);
      }
      const multilingualNames = await fetchMultilingualNames(find.candidate?.place_id, src.cityMeta);

      const finalInfo = detail || find.candidate || {};
      const lng = finalInfo?.geometry?.location?.lng ?? null;
      const lat = finalInfo?.geometry?.location?.lat ?? null;
      const phone =
        finalInfo?.international_phone_number || finalInfo?.formatted_phone_number || "";
      const hours = toHoursText(finalInfo?.opening_hours);
      const cuisine = normalizeTypesToCuisine(finalInfo?.types || find.candidate?.types || []);
      const score = Number(finalInfo?.rating ?? find.candidate?.rating);
      const scoreOverall = Number.isFinite(score) ? score : null;
      const pricePerPerson = mapPriceLevel(
        finalInfo?.price_level ?? find.candidate?.price_level,
        src.cityMeta.currency
      );

      setField(targetRow, "city_zh", src.cityMeta.city_zh);
      setField(targetRow, "city_en", src.cityMeta.city_en);
      setField(targetRow, "country_zh", src.cityMeta.country_zh);
      setField(targetRow, "country_en", src.cityMeta.country_en);
      setField(targetRow, "is_china", src.cityMeta.is_china);
      setField(targetRow, "name_en", null);
      setField(targetRow, "name_local", null);
      const lang = detectTitleLanguage(src.title);
      const fallbackNames = { zh: "", en: "", local: "" };
      if (lang === "zh") fallbackNames.zh = src.title;
      if (lang === "en") fallbackNames.en = src.title;
      if (lang === "local") fallbackNames.local = src.title;

      const zhCandidate = multilingualNames.zh || fallbackNames.zh;
      const finalZhName = hasChineseChars(zhCandidate) ? zhCandidate : "";
      const enCandidate = multilingualNames.en || fallbackNames.en;
      const finalEnName = isPureEnglishText(enCandidate) ? enCandidate : "";
      const finalLocalName = multilingualNames.local || fallbackNames.local;

      if (!isManualLocked(targetRow, "name_zh")) {
        setField(targetRow, "name_zh", finalZhName || null);
      }
      setField(targetRow, "name_en", finalEnName || null);
      setField(targetRow, "name_local", finalLocalName || null);
      setField(
        targetRow,
        "address",
        finalInfo?.formatted_address ?? find.candidate?.formatted_address ?? ""
      );
      setField(targetRow, "lng", lng);
      setField(targetRow, "lat", lat);
      setField(targetRow, "price_per_person", pricePerPerson);
      setField(targetRow, "currency", src.cityMeta.currency);
      if (!isManualLocked(targetRow, "cuisine")) {
        setField(targetRow, "cuisine", cuisine);
      }
      if (!isManualLocked(targetRow, "hours")) {
        setField(targetRow, "hours", hours);
      }
      setField(targetRow, "phone", phone);
      setField(targetRow, "map_platform", "google");
      setField(targetRow, "map_url", src.mapUrl || finalInfo?.url || "");
      setField(targetRow, "score_overall", scoreOverall);

      logs.push({
        city: src.cityMeta.city_en,
        sourceFile: src.sourceFile,
        sourceRow: src.sourceRow,
        targetRow: targetRowIndex + 1,
        title: src.title,
        mapUrl: src.mapUrl,
        cidLike: meta.cidLike,
        matchedPlaceId: find.candidate?.place_id ?? null,
        matchedName: finalInfo?.name ?? find.candidate?.name ?? null,
        address: finalInfo?.formatted_address ?? find.candidate?.formatted_address ?? null,
        lng,
        lat,
        rating: scoreOverall,
        price_level: finalInfo?.price_level ?? find.candidate?.price_level ?? null,
        price_per_person: pricePerPerson,
        currency: src.cityMeta.currency,
        phone,
        hasHours: Boolean(hours),
        titleLanguage: lang,
        names: multilingualNames,
        cuisine,
        findStatus: find.data?.status ?? null,
      });

      await sleep(180);
    }
  }

  const outSheet = xlsx.utils.aoa_to_sheet(restRows);
  restWb.Sheets[restWb.SheetNames[0]] = outSheet;
  xlsx.writeFile(restWb, restaurantsPath);
  await fs.writeFile(logPath, `${JSON.stringify(logs, null, 2)}\n`, "utf8");

  const ok = logs.filter((l) => l.lng != null && l.lat != null).length;
  console.log(
    `[fill-city-restaurants] processed=${logs.length} geocoded=${ok} log=${path.relative(root, logPath)}`
  );
}

main().catch((error) => {
  console.error("[fill-city-restaurants] failed:", error);
  process.exitCode = 1;
});
