import fs from "node:fs";
import path from "node:path";
import gcoord from "gcoord";

const ROOT = process.cwd();
const GEOJSON_DIR = path.join(ROOT, "src", "assets", "geojson");
const RESTAURANTS_PATH = path.join(ROOT, "src", "data", "restaurants.json");
const REPORT_JSON_PATH = path.join(ROOT, "docs", "boundary-offset-audit-report.json");
const REPORT_MD_PATH = path.join(ROOT, "docs", "boundary-offset-audit-report.md");

const CITY_CONFIG = [
  { slug: "shanghai", cityEn: "shanghai", isChina: true },
  { slug: "qingdao", cityEn: "qingdao", isChina: true },
  { slug: "chongqing", cityEn: "chongqing", isChina: true },
  { slug: "guangzhou", cityEn: "guangzhou", isChina: true },
  { slug: "fuzhou", cityEn: "fuzhou", isChina: true },
  { slug: "quanzhou", cityEn: "quanzhou", isChina: true },
  { slug: "xiamen", cityEn: "xiamen", isChina: true },
  { slug: "dalian", cityEn: "dalian", isChina: true },
  { slug: "suzhou", cityEn: "suzhou", isChina: true },
  { slug: "jeju", cityEn: "jeju", isChina: false },
  { slug: "kuala-lumpur", cityEn: "kuala-lumpur", isChina: false },
  { slug: "melaka", cityEn: "melaka", isChina: false },
];

function parseArgs(argv) {
  const args = {
    cities: null,
    failOnRegression: false,
    minDeltaPct: 0,
    maxOpenRings: 0,
    maxInvalidLngLat: 0,
  };

  for (const raw of argv) {
    if (raw.startsWith("--cities=")) {
      const value = raw.slice("--cities=".length).trim();
      args.cities = value
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    } else if (raw === "--fail-on-regression") {
      args.failOnRegression = true;
    } else if (raw.startsWith("--min-delta-pct=")) {
      const value = Number(raw.slice("--min-delta-pct=".length));
      if (Number.isFinite(value)) args.minDeltaPct = value;
    } else if (raw.startsWith("--max-open-rings=")) {
      const value = Number(raw.slice("--max-open-rings=".length));
      if (Number.isFinite(value)) args.maxOpenRings = value;
    } else if (raw.startsWith("--max-invalid-lnglat=")) {
      const value = Number(raw.slice("--max-invalid-lnglat=".length));
      if (Number.isFinite(value)) args.maxInvalidLngLat = value;
    }
  }

  return args;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function transformCoord(lng, lat) {
  const [x, y] = gcoord.transform([lng, lat], gcoord.GCJ02, gcoord.WGS84);
  return [x, y];
}

function transformGeometryGcjToWgs(geometry) {
  if (!geometry || !geometry.type) return geometry;
  if (geometry.type === "Polygon") {
    return {
      ...geometry,
      coordinates: geometry.coordinates.map((ring) =>
        ring.map(([lng, lat]) => transformCoord(lng, lat)),
      ),
    };
  }
  if (geometry.type === "MultiPolygon") {
    return {
      ...geometry,
      coordinates: geometry.coordinates.map((poly) =>
        poly.map((ring) => ring.map(([lng, lat]) => transformCoord(lng, lat))),
      ),
    };
  }
  return geometry;
}

function parseCityEn(raw) {
  return String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-");
}

function pointInRing(point, ring) {
  const [x, y] = point;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / ((yj - yi) || 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function pointInPolygon(point, polygonCoords) {
  if (!Array.isArray(polygonCoords) || polygonCoords.length === 0) return false;
  const [outer, ...holes] = polygonCoords;
  if (!pointInRing(point, outer)) return false;
  for (const hole of holes) {
    if (pointInRing(point, hole)) return false;
  }
  return true;
}

function pointInGeometry(point, geometry) {
  if (!geometry) return false;
  if (geometry.type === "Polygon") {
    return pointInPolygon(point, geometry.coordinates);
  }
  if (geometry.type === "MultiPolygon") {
    return geometry.coordinates.some((polygonCoords) => pointInPolygon(point, polygonCoords));
  }
  return false;
}

function pointInFeatureCollection(point, featureCollection) {
  const features = featureCollection?.features ?? [];
  return features.some((feature) => pointInGeometry(point, feature.geometry));
}

function getCoordBounds(featureCollection) {
  let minLng = Number.POSITIVE_INFINITY;
  let minLat = Number.POSITIVE_INFINITY;
  let maxLng = Number.NEGATIVE_INFINITY;
  let maxLat = Number.NEGATIVE_INFINITY;
  let coordCount = 0;

  function visitCoords(coords) {
    if (!Array.isArray(coords)) return;
    if (typeof coords[0] === "number" && typeof coords[1] === "number") {
      const [lng, lat] = coords;
      minLng = Math.min(minLng, lng);
      minLat = Math.min(minLat, lat);
      maxLng = Math.max(maxLng, lng);
      maxLat = Math.max(maxLat, lat);
      coordCount += 1;
      return;
    }
    for (const child of coords) visitCoords(child);
  }

  for (const feature of featureCollection.features ?? []) {
    visitCoords(feature?.geometry?.coordinates);
  }

  return {
    minLng,
    minLat,
    maxLng,
    maxLat,
    coordCount,
  };
}

function isRingClosed(ring) {
  if (!Array.isArray(ring) || ring.length < 4) return false;
  const first = ring[0];
  const last = ring[ring.length - 1];
  return first[0] === last[0] && first[1] === last[1];
}

function geometryHealthStats(featureCollection) {
  let polygonCount = 0;
  let multiPolygonCount = 0;
  let closedRingCount = 0;
  let openRingCount = 0;
  let invalidLngLatCount = 0;

  for (const feature of featureCollection.features ?? []) {
    const geometry = feature?.geometry;
    if (!geometry) continue;
    if (geometry.type === "Polygon") {
      polygonCount += 1;
      for (const ring of geometry.coordinates ?? []) {
        if (isRingClosed(ring)) closedRingCount += 1;
        else openRingCount += 1;
        for (const [lng, lat] of ring) {
          if (lng < -180 || lng > 180 || lat < -90 || lat > 90) invalidLngLatCount += 1;
        }
      }
    } else if (geometry.type === "MultiPolygon") {
      multiPolygonCount += 1;
      for (const poly of geometry.coordinates ?? []) {
        for (const ring of poly ?? []) {
          if (isRingClosed(ring)) closedRingCount += 1;
          else openRingCount += 1;
          for (const [lng, lat] of ring) {
            if (lng < -180 || lng > 180 || lat < -90 || lat > 90) invalidLngLatCount += 1;
          }
        }
      }
    }
  }

  return {
    polygonCount,
    multiPolygonCount,
    closedRingCount,
    openRingCount,
    invalidLngLatCount,
  };
}

function classifySource(featureCollection) {
  const firstProps = featureCollection?.features?.[0]?.properties ?? {};
  const keys = Object.keys(firstProps);
  const hasDataV = ["adcode", "center", "centroid", "acroutes"].every((k) => keys.includes(k));
  const hasFfjParliament = keys.includes("ffj_admin") && String(firstProps.ffj_admin).includes("parliament");
  const hasJejuMinimal = ["name", "name_en", "name_zh", "level"].every((k) => keys.includes(k));

  if (hasDataV) return "DataV-like (China district boundary schema)";
  if (hasFfjParliament) return "TindakMalaysia parliamentary boundary schema";
  if (hasJejuMinimal) return "Minimal custom schema (likely open admin source)";
  return "Unknown/custom mixed schema";
}

function meanBoundaryShiftMeters(featureCollection) {
  const samples = [];
  function sampleCoord(coords) {
    if (samples.length >= 2000) return;
    if (!Array.isArray(coords)) return;
    if (typeof coords[0] === "number" && typeof coords[1] === "number") {
      samples.push(coords);
      return;
    }
    for (const child of coords) {
      sampleCoord(child);
      if (samples.length >= 2000) break;
    }
  }
  for (const feature of featureCollection.features ?? []) {
    sampleCoord(feature?.geometry?.coordinates);
    if (samples.length >= 2000) break;
  }
  if (samples.length === 0) return null;

  let total = 0;
  for (const [lng, lat] of samples) {
    const [x, y] = transformCoord(lng, lat);
    const dLng = x - lng;
    const dLat = y - lat;
    const latMeter = dLat * 111320;
    const lngMeter = dLng * 111320 * Math.cos((lat * Math.PI) / 180);
    total += Math.hypot(lngMeter, latMeter);
  }
  return total / samples.length;
}

function restaurantsForCity(restaurants, citySlug) {
  return restaurants.filter((row) => parseCityEn(row.city_en) === citySlug);
}

function rowToMapboxPoint(row) {
  const lng = Number(row?.lng);
  const lat = Number(row?.lat);
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
  if (row?.is_china) {
    const [x, y] = transformCoord(lng, lat);
    return [x, y];
  }
  return [lng, lat];
}

function toMdTable(rows) {
  const header =
    "| 城市 | 文件存在 | 来源识别 | 几何闭环 | 点样本数 | A落区率 | B落区率 | B-A |\n|---|---:|---|---:|---:|---:|---:|---:|";
  const body = rows
    .map((r) =>
      [
        r.slug,
        r.fileExists ? "Yes" : "No",
        r.sourceClass,
        `${r.health.closedRingCount}/${r.health.closedRingCount + r.health.openRingCount}`,
        r.sampleCount,
        r.aCoveragePct == null ? "N/A" : `${r.aCoveragePct.toFixed(1)}%`,
        r.bCoveragePct == null ? "N/A" : `${r.bCoveragePct.toFixed(1)}%`,
        r.deltaPct == null ? "N/A" : `${r.deltaPct >= 0 ? "+" : ""}${r.deltaPct.toFixed(1)}%`,
      ].join(" | "),
    )
    .map((line) => `| ${line} |`)
    .join("\n");
  return `${header}\n${body}`;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const restaurants = readJson(RESTAURANTS_PATH);
  const reportRows = [];
  const cityConfig = Array.isArray(args.cities) && args.cities.length > 0
    ? CITY_CONFIG.filter((city) => args.cities.includes(city.slug))
    : CITY_CONFIG;

  if (cityConfig.length === 0) {
    console.log("No matching cities to audit. Skipping.");
    return;
  }

  for (const city of cityConfig) {
    const filePath = path.join(GEOJSON_DIR, `${city.slug}.geojson`);
    const fileExists = fs.existsSync(filePath);
    const row = {
      slug: city.slug,
      isChina: city.isChina,
      fileExists,
      sourceClass: "Missing",
      health: {
        polygonCount: 0,
        multiPolygonCount: 0,
        closedRingCount: 0,
        openRingCount: 0,
        invalidLngLatCount: 0,
      },
      bounds: null,
      sampleCount: 0,
      aCoveragePct: null,
      bCoveragePct: null,
      deltaPct: null,
      meanGcjToWgsShiftMeters: null,
    };

    if (!fileExists) {
      reportRows.push(row);
      continue;
    }

    const fc = readJson(filePath);
    row.sourceClass = classifySource(fc);
    row.health = geometryHealthStats(fc);
    row.bounds = getCoordBounds(fc);
    row.meanGcjToWgsShiftMeters = city.isChina ? meanBoundaryShiftMeters(fc) : 0;

    const cityRows = restaurantsForCity(restaurants, city.slug);
    const points = cityRows.map(rowToMapboxPoint).filter(Boolean);
    row.sampleCount = points.length;

    if (points.length > 0) {
      let insideA = 0;
      let insideB = 0;
      const transformed = city.isChina
        ? {
            ...fc,
            features: (fc.features ?? []).map((feature) => ({
              ...feature,
              geometry: transformGeometryGcjToWgs(feature.geometry),
            })),
          }
        : fc;

      for (const pt of points) {
        if (pointInFeatureCollection(pt, fc)) insideA += 1;
        if (pointInFeatureCollection(pt, transformed)) insideB += 1;
      }

      row.aCoveragePct = (insideA / points.length) * 100;
      row.bCoveragePct = (insideB / points.length) * 100;
      row.deltaPct = row.bCoveragePct - row.aCoveragePct;
    }

    reportRows.push(row);
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    cities: reportRows,
    notes: [
      "A = 原始边界（线上逻辑）",
      "B = 中国城市边界做 GCJ-02 -> WGS-84 转换后",
      "点样本来自 restaurants.json 且先按现有 Mapbox 规则转换（中国点位会先转 WGS）",
    ],
  };

  fs.writeFileSync(REPORT_JSON_PATH, `${JSON.stringify(summary, null, 2)}\n`, "utf8");

  const md = `# 10城行政边界偏移审计报告\n\n${toMdTable(reportRows)}\n\n## 说明\n- A/B 指标定义：\n  - A：原始 GeoJSON 边界\n  - B：中国城市边界执行 GCJ->WGS 转换后\n- 点样本不足（N/A）说明该城当前 restaurants.json 缺少可用经纬度。\n- meanGcjToWgsShiftMeters 表示若把该城边界从 GCJ 转到 WGS，平均坐标位移量（米），用于估计潜在系统偏移规模。\n`;
  fs.writeFileSync(REPORT_MD_PATH, md, "utf8");

  console.log(`Wrote JSON report: ${REPORT_JSON_PATH}`);
  console.log(`Wrote Markdown report: ${REPORT_MD_PATH}`);

  if (args.failOnRegression) {
    const failures = [];
    for (const row of reportRows) {
      if (!row.fileExists) {
        failures.push(`${row.slug}: boundary file missing`);
        continue;
      }

      if (row.health.openRingCount > args.maxOpenRings) {
        failures.push(`${row.slug}: open rings ${row.health.openRingCount} > ${args.maxOpenRings}`);
      }

      if (row.health.invalidLngLatCount > args.maxInvalidLngLat) {
        failures.push(
          `${row.slug}: invalid lng/lat ${row.health.invalidLngLatCount} > ${args.maxInvalidLngLat}`,
        );
      }

      if (row.isChina && row.deltaPct != null && row.deltaPct < args.minDeltaPct) {
        failures.push(
          `${row.slug}: coverage delta ${row.deltaPct.toFixed(2)}% < ${args.minDeltaPct}%`,
        );
      }
    }

    if (failures.length > 0) {
      console.error("Boundary offset audit regression detected:");
      for (const failure of failures) console.error(`- ${failure}`);
      process.exit(1);
    }
  }
}

main();
