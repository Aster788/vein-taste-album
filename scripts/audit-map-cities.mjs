/**
 * Smoke-test Mapbox map panel for every bookshelf city slug.
 * Requires dev/preview server and VITE_MAPBOX_TOKEN in .env.local (via Vite).
 *
 * Usage:
 *   npm run dev   # in another terminal
 *   node scripts/audit-map-cities.mjs
 *   node scripts/audit-map-cities.mjs --base http://localhost:5175
 */
import { chromium } from "playwright";

const CITY_SLUGS = [
  "shanghai",
  "nanjing",
  "suzhou",
  "qingdao",
  "chongqing",
  "guangzhou",
  "jeju",
  "kuala-lumpur",
  "melaka",
  "fuzhou",
  "quanzhou",
  "xiamen",
  "dalian",
];

const baseArg = process.argv.find((arg) => arg.startsWith("--base="));
const BASE = (baseArg ? baseArg.slice("--base=".length) : "http://localhost:5175").replace(
  /\/+$/,
  "",
);
const MAP_WAIT_MS = 8_000;

/** @param {import('@playwright/test').Page} page */
async function readMapState(page) {
  return page.evaluate(() => {
    const canvas = document.querySelector(".mapboxgl-canvas");
    return {
      hasError: Boolean(document.querySelector(".ffj-map-error")),
      hasTokenMsg: document.body.innerText.includes("缺少 VITE_MAPBOX_TOKEN"),
      canvasH: canvas?.clientHeight ?? 0,
      canvasW: canvas?.clientWidth ?? 0,
      tags: document.querySelectorAll(".ffj-map-tag-bubble").length,
      detail: document.querySelector(".ffj-map-error-detail")?.textContent?.trim() ?? "",
      loading: Boolean(document.querySelector(".ffj-map-loading")),
      section: document.querySelector(".ffj-city-section-current")?.textContent?.trim() ?? "",
    };
  });
}

/** @param {typeof CITY_SLUGS[number]} city @param {Awaited<ReturnType<typeof readMapState>>} state */
function evaluateOk(city, state) {
  const reasons = [];
  if (state.hasTokenMsg) reasons.push("missing VITE_MAPBOX_TOKEN");
  if (state.hasError) reasons.push(state.detail || "map error overlay");
  if (state.canvasH < 100 || state.canvasW < 100) reasons.push(`canvas too small (${state.canvasW}x${state.canvasH})`);
  if (state.loading && state.canvasH < 100) reasons.push("stuck loading");
  return { ok: reasons.length === 0, reasons };
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  /** @type {Array<{ city: string, ok: boolean, reasons: string[], state: Awaited<ReturnType<typeof readMapState>> }>} */
  const rows = [];

  for (const city of CITY_SLUGS) {
    const url = `${BASE}/${city}`;
    process.stdout.write(`[audit-map] ${city} … `);
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 });
      await page.waitForTimeout(MAP_WAIT_MS);
      const state = await readMapState(page);
      const { ok, reasons } = evaluateOk(city, state);
      rows.push({ city, ok, reasons, state });
      console.log(ok ? "OK" : `FAIL (${reasons.join("; ")})`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      rows.push({
        city,
        ok: false,
        reasons: [`navigation: ${message}`],
        state: {
          hasError: true,
          hasTokenMsg: false,
          canvasH: 0,
          canvasW: 0,
          tags: 0,
          detail: message,
          loading: false,
          section: "",
        },
      });
      console.log(`FAIL (${message})`);
    }
  }

  await browser.close();

  console.log("\n[audit-map] Summary");
  console.table(
    rows.map(({ city, ok, reasons, state }) => ({
      city,
      ok: ok ? "yes" : "no",
      canvas: `${state.canvasW}x${state.canvasH}`,
      tags: state.tags,
      error: state.hasError ? state.detail || "overlay" : "",
    })),
  );

  const failed = rows.filter((row) => !row.ok);
  if (failed.length > 0) {
    console.error(`\n[audit-map] ${failed.length}/${rows.length} cities failed.`);
    process.exit(1);
  }

  console.log(`\n[audit-map] All ${rows.length} cities passed.`);
}

main().catch((error) => {
  console.error("[audit-map] Fatal:", error);
  process.exit(1);
});
