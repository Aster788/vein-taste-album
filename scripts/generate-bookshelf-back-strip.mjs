/**
 * Capture the bookshelf scroll viewport and write a transparent WebP strip
 * for CityDetail「返回书架」button (168×52 @2x → 27px tall in UI).
 *
 * Usage:
 *   npm run dev   # another terminal
 *   npm run assets:bookshelf-back-strip
 */
import path from "node:path";
import { chromium } from "playwright";
import sharp from "sharp";

const ROOT = process.cwd();
const OUT_PATH = path.join(ROOT, "src/assets/stickers/page/bookshelf-back-strip.webp");
const OUT_W = 168;
const OUT_H = 52;

/** 书架页暖白纸底（与 .ffj-paper-noise--warm 接近） */
const PAGE_BG = { r: 247, g: 243, b: 238 };

const baseArg = process.argv.find((arg) => arg.startsWith("--base="));
const BASE = (baseArg ? baseArg.slice("--base=".length) : "http://localhost:5173").replace(
  /\/+$/,
  "",
);

function colorDistance(r, g, b, target) {
  const dr = r - target.r;
  const dg = g - target.g;
  const db = b - target.b;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

function stripPageBackground(data) {
  const px = data;
  for (let i = 0; i < px.length; i += 4) {
    const r = px[i];
    const g = px[i + 1];
    const b = px[i + 2];
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    const chroma = Math.max(r, g, b) - Math.min(r, g, b);
    const distPage = colorDistance(r, g, b, PAGE_BG);
    const distWhite = colorDistance(r, g, b, { r: 255, g: 255, b: 255 });

    if (distPage < 28 || (lum > 240 && chroma < 20) || distWhite < 18) {
      px[i + 3] = 0;
    } else if (distPage < 42 || (lum > 228 && chroma < 28)) {
      const t = Math.min(1, (distPage - 28) / 14);
      px[i + 3] = Math.round(px[i + 3] * t);
    }
  }
  return px;
}

async function launchBrowser() {
  try {
    return await chromium.launch({ headless: true });
  } catch {
    return chromium.launch({ headless: true, channel: "chrome" });
  }
}

async function waitForBookshelfReady(page) {
  await page.waitForSelector(".ffj-bookshelf-scroll", { timeout: 30_000 });
  await page.waitForSelector(".ffj-bookshelf-book-slot", { timeout: 30_000 });
  await page.waitForFunction(() => {
    const scroller = document.querySelector(".ffj-bookshelf-scroll");
    if (!scroller) return false;
    const max = scroller.scrollWidth - scroller.clientWidth;
    return max <= 0 || scroller.scrollLeft > 0;
  }, { timeout: 15_000 });
  await page.waitForTimeout(1500);
}

async function visibleBooksClip(page) {
  return page.evaluate(() => {
    const scroller = document.querySelector(".ffj-bookshelf-scroll");
    const slots = [...document.querySelectorAll(".ffj-bookshelf-book-slot")];
    if (!scroller || slots.length === 0) return null;

    const sc = scroller.getBoundingClientRect();
    let left = Infinity;
    let top = Infinity;
    let right = -Infinity;
    let bottom = -Infinity;
    let count = 0;

    for (const slot of slots) {
      const r = slot.getBoundingClientRect();
      const intersects =
        r.right > sc.left + 4 &&
        r.left < sc.right - 4 &&
        r.bottom > sc.top + 4 &&
        r.top < sc.bottom - 4;
      if (!intersects) continue;
      count += 1;
      left = Math.min(left, r.left);
      top = Math.min(top, r.top);
      right = Math.max(right, r.right);
      bottom = Math.max(bottom, r.bottom);
    }

    if (count < 3) return null;

    const padX = 6;
    const padY = 4;
    return {
      x: Math.max(0, left - padX),
      y: Math.max(0, top - padY),
      width: right - left + padX * 2,
      height: bottom - top + padY * 2,
    };
  });
}

async function main() {
  const browser = await launchBrowser();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  try {
    await page.goto(`${BASE}/`, { waitUntil: "networkidle", timeout: 60_000 });
    // 与进站首屏一致：Bookshelf.jsx 将 scrollLeft 置为 max/2，不额外滚动
    await waitForBookshelfReady(page);

    await page.addStyleTag({
      content: `
        .ffj-photo-nav,
        .ffj-bookshelf-slogan-nav { visibility: hidden !important; }
        .ffj-bookshelf-slogan-region { opacity: 0 !important; }
      `,
    });
    await page.waitForTimeout(200);

    const clip = await visibleBooksClip(page);
    if (!clip || clip.width < 80 || clip.height < 20) {
      throw new Error("could not measure visible book spines clip");
    }

    const rawPng = await page.screenshot({ type: "png", clip });

    const { data, info } = await sharp(rawPng).ensureAlpha().raw().toBuffer({
      resolveWithObject: true,
    });
    const stripped = stripPageBackground(data);

    await sharp(stripped, {
      raw: { width: info.width, height: info.height, channels: 4 },
    })
      .trim({ threshold: 8 })
      .resize(OUT_W, OUT_H, {
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
        kernel: sharp.kernel.lanczos3,
      })
      .webp({ quality: 92, alphaQuality: 100 })
      .toFile(OUT_PATH);

    const meta = await sharp(OUT_PATH).metadata();
    console.log(`Wrote ${OUT_PATH} (${meta.width}×${meta.height}) from clip ${Math.round(clip.width)}×${Math.round(clip.height)}`);
  } finally {
    await context.close();
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
