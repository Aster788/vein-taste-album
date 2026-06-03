import fs from "node:fs";
import path from "node:path";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import sharp from "sharp";
import { loadEnvLocal } from "./load-env-local.mjs";
import { photoObjectKey, walkStorePhotos, walkStoreThumbs } from "./photo-manifest-utils.mjs";

loadEnvLocal();

const accountId = String(process.env.R2_ACCOUNT_ID ?? "").trim();
const accessKeyId = String(process.env.R2_ACCESS_KEY_ID ?? "").trim();
const secretAccessKey = String(process.env.R2_SECRET_ACCESS_KEY ?? "").trim();
const bucket = String(process.env.R2_BUCKET_NAME ?? "").trim();

const missing = [];
if (accountId === "") missing.push("R2_ACCOUNT_ID");
if (accessKeyId === "") missing.push("R2_ACCESS_KEY_ID");
if (secretAccessKey === "") missing.push("R2_SECRET_ACCESS_KEY");
if (bucket === "") missing.push("R2_BUCKET_NAME");

if (missing.length > 0) {
  console.error("[photos:upload-r2] Missing required env in .env.local:");
  for (const key of missing) console.error(`  - ${key}`);
  console.error("Create an R2 API token (Object Read & Write) in Cloudflare dashboard.");
  process.exit(1);
}

const concurrency = Math.max(1, Number(process.env.PHOTO_UPLOAD_CONCURRENCY ?? "4") || 4);
const dryRun = process.argv.includes("--dry-run");
const skipThumbs = process.argv.includes("--skip-thumbs");
const thumbsOnly = process.argv.includes("--thumbs-only");

const THUMB_MAX_WIDTH = 800;
const THUMB_QUALITY = 82;

const client = new S3Client({
  region: "auto",
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId, secretAccessKey },
});

/** @type {Array<{ city: string, store: string, filename: string, absPath: string }>} */
const queue = [];
if (thumbsOnly) {
  walkStoreThumbs((entry) => queue.push(entry));
} else {
  walkStorePhotos((entry) => queue.push(entry));
}

console.log(
  `[photos:upload-r2] ${dryRun ? "Dry run — " : ""}${queue.length} files, bucket=${bucket}, concurrency=${concurrency}${thumbsOnly ? ", thumbs-only" : skipThumbs ? ", skip-thumbs" : ""}`,
);

let uploaded = 0;
let failed = 0;
let index = 0;

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

/** @param {string} filename */
function thumbFilenameFor(filename) {
  const name = String(filename ?? "").trim();
  if (name === "") return "";
  const lastDot = name.lastIndexOf(".");
  const base = lastDot <= 0 ? name : name.slice(0, lastDot);
  return `${base}.thumb.webp`;
}

/**
 * @param {string} key
 * @param {Buffer} body
 * @param {string} contentType
 */
async function putObject(key, body, contentType) {
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );
}

async function uploadOne(entry) {
  const key = photoObjectKey(entry.city, entry.store, entry.filename);
  if (dryRun) {
    console.log(`[dry-run] ${key}`);
    if (!thumbsOnly && !skipThumbs) {
      const thumbName = thumbFilenameFor(entry.filename);
      if (thumbName !== "") {
        console.log(`[dry-run] ${photoObjectKey(entry.city, entry.store, thumbName)}`);
      }
    }
    return;
  }

  if (thumbsOnly) {
    const body = fs.readFileSync(entry.absPath);
    await putObject(key, body, "image/webp");
    return;
  }

  const body = fs.readFileSync(entry.absPath);
  await putObject(key, body, contentTypeForFile(entry.filename));

  if (!skipThumbs) {
    const thumbName = thumbFilenameFor(entry.filename);
    if (thumbName !== "") {
      const thumbPath = path.join(path.dirname(entry.absPath), thumbName);
      if (fs.existsSync(thumbPath)) {
        await putObject(
          photoObjectKey(entry.city, entry.store, thumbName),
          fs.readFileSync(thumbPath),
          "image/webp",
        );
      } else {
        const thumbBuffer = await sharp(entry.absPath)
          .rotate()
          .resize({ width: THUMB_MAX_WIDTH, withoutEnlargement: true })
          .webp({ quality: THUMB_QUALITY })
          .toBuffer();
        await putObject(
          photoObjectKey(entry.city, entry.store, thumbName),
          thumbBuffer,
          "image/webp",
        );
      }
    }
  }
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
        console.log(`[photos:upload-r2] Progress ${uploaded}/${queue.length}`);
      }
    } catch (error) {
      failed += 1;
      console.error(
        `[photos:upload-r2] Failed ${photoObjectKey(entry.city, entry.store, entry.filename)}:`,
        error instanceof Error ? error.message : error,
      );
    }
  }
}

await Promise.all(Array.from({ length: concurrency }, () => worker()));

if (failed > 0) {
  console.error(`[photos:upload-r2] Done with ${failed} failure(s).`);
  process.exit(1);
}

console.log(`[photos:upload-r2] Done. Uploaded ${uploaded} file(s).`);
