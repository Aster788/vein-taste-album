import fs from "node:fs";
import path from "node:path";
import xlsx from "xlsx";
import { loadEnvLocal } from "./load-env-local.mjs";

loadEnvLocal();

const AMAP_KEY = process.env.AMAP_WEB_KEY?.trim();
if (!AMAP_KEY) {
  console.error("Set AMAP_WEB_KEY in .env.local before running.");
  process.exit(1);
}

const FILE = path.join(process.cwd(), "src/data/restaurants.xlsx");
const TARGET_COLUMNS = [
  "lng",
  "lat",
  "address",
  "cuisine_zh",
  "price_per_person",
  "score_overall",
  "hours",
  "phone",
  "map_url",
];

const TARGET_NAMES = [
  "Black Salt·黑盐印度融合菜(K11店)",
  "Archie\u2019s餐厅(凯旋路2280弄小区店)",
  "上海1号私藏菜(静安店)",
  "上海紫竹万怡酒店",
  "CHICKEN&EGG葡式霹雳烤鸡(悟锦世纪大楼店)",
  "8PINTS八品脱(常熟路店)",
  "AK28炸鸡SINCE1996(交大店)",
  "复兴面王(万象城店)",
  "JESSY&JERRY(前滩太古里店)",
  "九十叶·抹茶专门店(上海·太古里店)",
  "BEIGEL TREE贝果树·纽约贝果博物馆(陆家嘴中心店)",
  "AZUL意大利餐厅(上海白玉兰广场店)",
  "凤凰湘语(浦东旗舰店)",
  "海尚·生活广场",
  "育音堂音乐公园",
  "上海天文馆(上海科技馆分馆)",
  "望丘山(长宁龙之梦店)",
  "菊樱寿司(南桥百联店)",
  "湊湊火锅·茶憩(百联南方购物中心店)",
  "牛New寿喜烧(南桥店)",
  "东北筋饼骨头王奉贤店",
  "宫廷糕点(上海陆家嘴世纪大道地铁站如家商旅酒店店)",
  "山石榴·贵州菜(前滩太古里店)",
  "釜山鱼饼(井亭大厦店)",
  "88食堂·烤肉酱蟹(虹泉路店)",
  "BARBARIAN(武定路店)",
  "东北四季饺子王(华轻梅陇购物中心店)",
  "AMINO AMIGO(静安嘉里中心店)",
  "AMINO AMIGO(晶耀前滩店)",
  "Chili's奇利斯美式小餐馆(西岸梦中心1F层)",
  "温暖你的猪(漕河泾M+店)",
  "翠富楼·粤式点心·啫啫煲(美罗城店)",
  "HOLY BAGEL(耀华店)",
  "国际饭店蝴蝶酥(上海一店)",
  "饿梨酱(前滩公园巷店)",
  "龙华素斋(龙华路店)",
  "欧记大排档(大悦城店)",
  "ROOTS Bar&Cafe",
  "派悦坊.甜品.蛋糕(长宁龙之梦店)",
  "桂满陇(徐汇万科)",
  "the Roll'ING手作瑞士卷专门店(大宁久光店)",
  "Blue Bottle Coffee蓝瓶咖啡(张园店)",
  "巴波萨烧烤",
  "Apollo(复兴西路丁香花园店)",
  "萨莉亚意式餐厅(中星城店)",
  "Wagas沃歌斯(上海莘庄龙之梦)",
  "沪西老弄堂面馆(静安寺店)",
  "HOTCRUSH趁热集合·现烤面包(上海荟聚店)",
  "Punch Monday Bakery(晶耀前滩南区店)",
  "苹果花园(襄阳南路店)",
  "潘小烧-云南烧烤(环宇城店)",
];

const GEOCODE_ONLY = {
  "莉莲蛋挞(上海南站店)": {
    address: "徐汇区漕河泾街道地铁一号线南站站厅层C121-1(地铁3号线1号口附近)",
    fallbacks: ["上海南站地铁站C121-1", "上海南站地铁站"],
    geocodeOnly: true,
  },
  虹口糕团店: {
    address: "徐汇区漕河泾街道沪闵路9001-3号",
    fallbacks: ["沪闵路9001-3号"],
    geocodeOnly: true,
  },
  "彩云间(海思路店)": {
    address: "奉贤区海思路789弄6号202室",
    fallbacks: ["奉贤区海思路789弄6号202室", "奉贤区海思路789弄6号"],
    geocodeOnly: true,
  },
};

function isBlank(value) {
  return value == null || String(value).trim() === "";
}

async function httpGetJson(url) {
  const resp = await fetch(url, {
    headers: { "User-Agent": "FoodForJoy/1.0" },
    signal: AbortSignal.timeout(20000),
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const data = await resp.json();
  if (data.status !== "1") {
    const info = data.info || "unknown";
    const code = data.infocode || "";
    if (code === "10013" || code === "10001" || code === "10002") {
      throw new Error(`Amap key invalid or unauthorized: ${info} (${code}). Create a new Web服务 key at console.amap.com.`);
    }
    throw new Error(`Amap API error: ${info}${code ? ` (${code})` : ""}`);
  }
  return data;
}

async function placeText(query, cityZh = "上海", cityEn = "shanghai") {
  for (const city of [cityZh, cityEn, ""]) {
    const params = new URLSearchParams({
      key: AMAP_KEY,
      keywords: query,
      extensions: "all",
      offset: "10",
      page: "1",
      citylimit: city ? "true" : "false",
    });
    if (city) params.set("city", city);
    const data = await httpGetJson(`https://restapi.amap.com/v3/place/text?${params}`);
    if (data.pois?.length) return data.pois[0];
  }
  return null;
}

async function placeDetail(poiId) {
  if (!poiId) return null;
  const params = new URLSearchParams({ key: AMAP_KEY, id: poiId, extensions: "all" });
  const data = await httpGetJson(`https://restapi.amap.com/v3/place/detail?${params}`);
  if (!data.pois?.length) return null;
  return data.pois[0];
}

async function geocodeAddress(address, city = "上海", extraCandidates = []) {
  const candidates = [...new Set([address, ...extraCandidates].filter(Boolean))];

  for (const candidate of candidates) {
    try {
      const params = new URLSearchParams({ key: AMAP_KEY, address: candidate, city });
      const data = await httpGetJson(`https://restapi.amap.com/v3/geocode/geo?${params}`);
      if (!data.geocodes?.length) continue;
      const geo = data.geocodes[0];
      const [lng, lat] = String(geo.location || "")
        .split(",")
        .map(Number);
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue;
      return { lng, lat, formatted: geo.formatted_address || candidate, query: candidate };
    } catch {
      continue;
    }
  }
  return null;
}

function parseLocation(location) {
  if (!location || !String(location).includes(",")) return { lng: null, lat: null };
  const [lngRaw, latRaw] = String(location).split(",", 2);
  const lng = Number(lngRaw);
  const lat = Number(latRaw);
  return {
    lng: Number.isFinite(lng) ? lng : null,
    lat: Number.isFinite(lat) ? lat : null,
  };
}

function buildHours(detail, poi) {
  for (const source of [detail, poi]) {
    for (const key of ["opentime2", "opentime"]) {
      const v = source?.biz_ext?.[key];
      if (!isBlank(v)) return String(v).trim();
    }
    if (!isBlank(source?.business_hours)) return String(source.business_hours).trim();
  }
  return "";
}

function buildCuisine(detail, poi) {
  const typeText = String(detail?.type || poi?.type || "").trim();
  if (!typeText) return "";
  const segments = typeText.split(";").map((s) => s.trim()).filter(Boolean);
  return segments.length ? segments.at(-1) : typeText;
}

function getPrice(detail, poi) {
  for (const source of [detail, poi]) {
    let v = source?.biz_ext?.cost;
    if (isBlank(v)) continue;
    if (Array.isArray(v)) v = v[0];
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function getScore(detail, poi) {
  for (const source of [detail, poi]) {
    let v = source?.biz_ext?.rating;
    if (isBlank(v)) continue;
    if (Array.isArray(v)) v = v[0];
    const n = Number(v);
    if (Number.isFinite(n)) return Math.round(n * 10) / 10;
  }
  return null;
}

function getPhone(detail, poi) {
  for (const source of [detail, poi]) {
    if (!isBlank(source?.tel)) return String(source.tel).trim();
  }
  return "";
}

function cellRef(colIndex, rowIndex) {
  return xlsx.utils.encode_cell({ c: colIndex, r: rowIndex });
}

function getCellValue(ws, colIndex, rowIndex) {
  return ws[cellRef(colIndex, rowIndex)]?.v;
}

function setCellValue(ws, colIndex, rowIndex, value) {
  const ref = cellRef(colIndex, rowIndex);
  ws[ref] = { t: typeof value === "number" ? "n" : "s", v: value };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const wb = xlsx.readFile(FILE, { cellDates: false, raw: false });
  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const rows = xlsx.utils.sheet_to_json(ws, { defval: null, header: 1 });
  const headers = rows[0].map((h) => String(h ?? "").trim());
  const col = Object.fromEntries(headers.map((h, i) => [h, i]));

  const missingCols = ["name_zh", "city_zh", "city_en", "map_platform", ...TARGET_COLUMNS].filter(
    (h) => !(h in col),
  );
  if (missingCols.length) throw new Error(`Missing columns: ${missingCols.join(", ")}`);

  const nameToRow = new Map();
  for (let r = 1; r < rows.length; r += 1) {
    const nameZh = String(rows[r][col.name_zh] ?? "").trim();
    if (nameZh) nameToRow.set(nameZh, r);
  }

  const allTargets = [...TARGET_NAMES, ...Object.keys(GEOCODE_ONLY)];
  const summary = {
    matched: [],
    no_match: [],
    protected: [],
    written: [],
    missing_rows: [],
  };

  for (const targetName of allTargets) {
    const rowIndex = nameToRow.get(targetName);
    if (rowIndex == null) {
      summary.missing_rows.push(targetName);
      continue;
    }

    const geocodeCfg = GEOCODE_ONLY[targetName];
    let values = {};

    if (geocodeCfg) {
      const geo = await geocodeAddress(geocodeCfg.address, "上海", geocodeCfg.fallbacks ?? []);
      if (!geo) {
        summary.no_match.push({ name_zh: targetName, reason: "geocode_failed" });
        await sleep(150);
        continue;
      }
      values = { lng: geo.lng, lat: geo.lat };
      summary.matched.push({
        name_zh: targetName,
        mode: "geocode",
        lng: geo.lng,
        lat: geo.lat,
      });
    } else {
      const cityZh = String(rows[rowIndex][col.city_zh] ?? "上海").trim();
      const cityEn = String(rows[rowIndex][col.city_en] ?? "shanghai").trim();
      let poi = null;
      let detail = null;
      try {
        poi = await placeText(targetName, cityZh, cityEn);
        if (poi) detail = (await placeDetail(String(poi.id || "").trim())) || poi;
      } catch (error) {
        summary.no_match.push({ name_zh: targetName, reason: `request_error: ${error.message}` });
        await sleep(150);
        continue;
      }

      if (!poi) {
        summary.no_match.push({ name_zh: targetName, reason: "no_poi" });
        await sleep(150);
        continue;
      }

      detail = detail || poi;
      const { lng, lat } = parseLocation(String(detail.location || poi.location || ""));
      const poiId = String(detail.id || poi.id || "").trim();
      values = {
        lng,
        lat,
        address: String(detail.address || poi.address || "").trim(),
        cuisine_zh: buildCuisine(detail, poi),
        price_per_person: getPrice(detail, poi),
        score_overall: getScore(detail, poi),
        hours: buildHours(detail, poi),
        phone: getPhone(detail, poi),
        map_url: poiId ? `https://www.amap.com/place/${poiId}` : "",
      };
      summary.matched.push({
        name_zh: targetName,
        mode: "place",
        matched_name: String(detail.name || poi.name || ""),
        poi_id: poiId,
      });
    }

    const rowWritten = {};
    const rowProtected = {};

    const columnsToWrite = geocodeCfg?.geocodeOnly ? ["lng", "lat"] : TARGET_COLUMNS;

    for (const key of columnsToWrite) {
      const existing = getCellValue(ws, col[key], rowIndex);
      if (!isBlank(existing)) {
        rowProtected[key] = existing;
        summary.protected.push({ name_zh: targetName, column: key, value: existing });
        continue;
      }
      const next = values[key];
      if (next == null || (typeof next === "string" && next.trim() === "")) continue;
      setCellValue(ws, col[key], rowIndex, next);
      rowWritten[key] = next;
      summary.written.push({ name_zh: targetName, column: key, value: next });
    }

    if (!geocodeCfg?.geocodeOnly) {
      const mapUrl = getCellValue(ws, col.map_url, rowIndex);
      const mapPlatform = getCellValue(ws, col.map_platform, rowIndex);
      if (!isBlank(mapUrl) && isBlank(mapPlatform)) {
        setCellValue(ws, col.map_platform, rowIndex, "amap");
        summary.written.push({ name_zh: targetName, column: "map_platform", value: "amap" });
      }
    }

    await sleep(150);
  }

  xlsx.writeFile(wb, FILE);

  const outPath = path.join(process.cwd(), "src/data/_shanghai_targets_amap_summary.json");
  fs.writeFileSync(outPath, JSON.stringify(summary, null, 2), "utf8");
  console.log(JSON.stringify(summary, null, 2));
  console.log(`summary_saved=${outPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
