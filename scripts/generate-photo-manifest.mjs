import fs from "node:fs";
import path from "node:path";
import { walkStorePhotos } from "./photo-manifest-utils.mjs";

const ROOT = process.cwd();
const OUT_PATH = path.join(ROOT, "src/data/photo-manifest.json");

/** @type {Array<{ city: string, store: string, filename: string }>} */
const photos = [];

walkStorePhotos(({ city, store, filename }) => {
  photos.push({ city, store, filename });
});

photos.sort((left, right) => {
  const byCity = left.city.localeCompare(right.city, "zh-Hans-CN");
  if (byCity !== 0) return byCity;
  const byStore = left.store.localeCompare(right.store, "zh-Hans-CN");
  if (byStore !== 0) return byStore;
  return left.filename.localeCompare(right.filename, "zh-Hans-CN");
});

const payload = {
  version: 1,
  generatedAt: new Date().toISOString(),
  count: photos.length,
  photos,
};

fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
fs.writeFileSync(OUT_PATH, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

console.log(`[photos:manifest] Wrote ${photos.length} entries to ${path.relative(ROOT, OUT_PATH)}`);
