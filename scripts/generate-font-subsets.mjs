/**
 * Build WOFF2 subsets for LXGW WenKai (site copy) and MuYao (handwriting UI).
 * Outputs to public/fonts/ for stable URLs + index.html preload.
 */
import { readFileSync, writeFileSync, mkdirSync, statSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import subsetFont from "subset-font";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "public", "fonts");

const ASCII =
  " ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789" +
  ".,;:!?\"'()[]{}+-=*/\\|_<>@#$%^&~`";
const PUNCT_ZH = "，。！？、；：「」『』（）—…·％";

const STATIC_UI = [
  "世界这本书 我想一直读",
  "I wander, I wonder, I fall in love with the world-again and again",
  "欢迎回来",
  "点击地图上的任意\n一家店试试看",
  "Click any store on the map to begin",
  "Flavor Tale Album",
  "上一张",
  "下一张",
  "展开",
  "暂无照片",
];

function readJsonText(path) {
  try {
    const raw = readFileSync(path, "utf8");
    const data = JSON.parse(raw);
    return JSON.stringify(data);
  } catch {
    return "";
  }
}

function collectSiteText() {
  const parts = [
    STATIC_UI.join(""),
    readJsonText(join(root, "src/data/translations.static.json")),
    readJsonText(join(root, "src/data/dishes.json")),
    readJsonText(join(root, "src/data/restaurants.json")),
    readJsonText(join(root, "src/data/city_meta.json")),
  ];
  return [...new Set((parts.join("") + ASCII + PUNCT_ZH).split(""))].sort().join("");
}

function collectHandwritingText() {
  return [...new Set(STATIC_UI.join("") + ASCII + PUNCT_ZH)].sort().join("");
}

function isUpToDate(sourcePath, outputPath) {
  if (!existsSync(outputPath)) return false;
  return statSync(outputPath).mtimeMs >= statSync(sourcePath).mtimeMs;
}

async function subsetOne({ label, sourcePath, outputPath, text }) {
  if (isUpToDate(sourcePath, outputPath)) {
    console.log(`[fonts] ${label}: up to date`);
    return;
  }

  const font = readFileSync(sourcePath);
  const subset = await subsetFont(font, text, { targetFormat: "woff2" });
  writeFileSync(outputPath, subset);
  const kb = Math.round(subset.length / 1024);
  console.log(`[fonts] ${label}: wrote ${outputPath} (${kb} KB)`);
}

async function main() {
  mkdirSync(outDir, { recursive: true });

  const siteText = collectSiteText();
  const handwritingText = collectHandwritingText();

  await subsetOne({
    label: "LXGW WenKai",
    sourcePath: join(root, "src/assets/fonts/LXGWWenKai/LXGWWenKai-Regular.ttf"),
    outputPath: join(outDir, "LXGWWenKai-Regular.subset.woff2"),
    text: siteText,
  });

  await subsetOne({
    label: "MuYao Soft Brush",
    sourcePath: join(root, "src/assets/fonts/MuYao-SoftBrush.ttf"),
    outputPath: join(outDir, "MuYao-SoftBrush.subset.woff2"),
    text: handwritingText,
  });
}

main().catch((error) => {
  console.error("[fonts] subset failed:", error);
  process.exit(1);
});
