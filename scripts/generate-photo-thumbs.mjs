/**
 * Generate {basename}.thumb.webp (max width 800) beside each store photo for CDN upload.
 * Skips existing thumbs when source mtime is not newer than thumb.
 */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { walkStorePhotos } from "./photo-manifest-utils.mjs";

const ROOT = process.cwd();
const THUMB_MAX_WIDTH = 800;
const THUMB_QUALITY = 82;

/** @param {string} filename */
function thumbFilenameFor(filename) {
  const name = String(filename ?? "").trim();
  if (name === "") return "";
  const lastDot = name.lastIndexOf(".");
  const base = lastDot <= 0 ? name : name.slice(0, lastDot);
  return `${base}.thumb.webp`;
}

function isUpToDate(sourcePath, thumbPath) {
  if (!fs.existsSync(thumbPath)) return false;
  return fs.statSync(thumbPath).mtimeMs >= fs.statSync(sourcePath).mtimeMs;
}

/** @type {Array<{ city: string, store: string, filename: string, absPath: string }>} */
const queue = [];
walkStorePhotos((entry) => queue.push(entry));

let wrote = 0;
let skipped = 0;

for (const entry of queue) {
  const thumbName = thumbFilenameFor(entry.filename);
  if (thumbName === "") continue;

  const thumbPath = path.join(path.dirname(entry.absPath), thumbName);
  if (isUpToDate(entry.absPath, thumbPath)) {
    skipped += 1;
    continue;
  }

  await sharp(entry.absPath)
    .rotate()
    .resize({ width: THUMB_MAX_WIDTH, withoutEnlargement: true })
    .webp({ quality: THUMB_QUALITY })
    .toFile(thumbPath);

  wrote += 1;
  if (wrote % 50 === 0) {
    console.log(`[photos:thumbs] wrote ${wrote}…`);
  }
}

console.log(
  `[photos:thumbs] Done. wrote=${wrote} skipped=${skipped} (from ${queue.length} source photos)`,
);
