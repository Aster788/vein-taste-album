import fs from "node:fs";
import path from "node:path";
import { put } from "@vercel/blob";
import { loadEnvLocal } from "./load-env-local.mjs";
import {
  photoBlobPathname,
  walkStorePhotos,
} from "./photo-manifest-utils.mjs";

loadEnvLocal();

const token = String(process.env.BLOB_READ_WRITE_TOKEN ?? "").trim();
if (token === "") {
  console.error("[photos:upload-blob] Missing BLOB_READ_WRITE_TOKEN.");
  console.error("Add BLOB_READ_WRITE_TOKEN to .env.local, or run:");
  console.error("  npm run env:pull-vercel");
  process.exit(1);
}

const concurrency = Math.max(1, Number(process.env.PHOTO_UPLOAD_CONCURRENCY ?? "4") || 4);
const dryRun = process.argv.includes("--dry-run");

/** @type {Array<{ city: string, store: string, filename: string, absPath: string }>} */
const queue = [];
walkStorePhotos((entry) => queue.push(entry));

console.log(
  `[photos:upload-blob] ${dryRun ? "Dry run — " : ""}${queue.length} files, concurrency=${concurrency}`,
);

let uploaded = 0;
let failed = 0;
let index = 0;

async function uploadOne(entry) {
  const pathname = photoBlobPathname(entry.city, entry.store, entry.filename);
  if (dryRun) {
    console.log(`[dry-run] ${pathname}`);
    return;
  }

  const body = fs.readFileSync(entry.absPath);
  await put(pathname, body, {
    access: "public",
    token,
    addRandomSuffix: false,
    contentType: contentTypeForFile(entry.filename),
  });
}

/** @param {string} filename */
function contentTypeForFile(filename) {
  const ext = path.extname(filename).toLowerCase();
  const map = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".heic": "image/heic",
  };
  return map[ext] ?? "application/octet-stream";
}

async function worker() {
  while (index < queue.length) {
    const current = index;
    index += 1;
    const entry = queue[current];
    try {
      await uploadOne(entry);
      uploaded += 1;
      if (uploaded % 25 === 0 || uploaded === queue.length) {
        console.log(`[photos:upload-blob] Progress ${uploaded}/${queue.length}`);
      }
    } catch (error) {
      failed += 1;
      console.error(
        `[photos:upload-blob] Failed ${photoBlobPathname(entry.city, entry.store, entry.filename)}:`,
        error instanceof Error ? error.message : error,
      );
    }
  }
}

await Promise.all(Array.from({ length: concurrency }, () => worker()));

if (failed > 0) {
  console.error(`[photos:upload-blob] Done with ${failed} failure(s).`);
  process.exit(1);
}

console.log(`[photos:upload-blob] Done. Uploaded ${uploaded} file(s).`);
