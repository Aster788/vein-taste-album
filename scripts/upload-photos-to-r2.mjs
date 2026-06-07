import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import sharp from "sharp";
import { loadEnvLocal } from "./load-env-local.mjs";
import { photoObjectKey, walkStorePhotos, walkStoreThumbs } from "./photo-manifest-utils.mjs";

loadEnvLocal();

const ROOT = process.cwd();
const PHOTO_REL_PREFIX = "src/assets/photos/";

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

/** @param {string[]} argv */
function parseCli(argv) {
  /** @param {string} flag */
  const valueAfter = (flag) => {
    const i = argv.indexOf(flag);
    if (i < 0 || i + 1 >= argv.length) return "";
    return String(argv[i + 1] ?? "").trim();
  };

  return {
    dryRun: argv.includes("--dry-run"),
    full: argv.includes("--full"),
    skipThumbs: argv.includes("--skip-thumbs"),
    thumbsOnly: argv.includes("--thumbs-only"),
    staged: argv.includes("--staged"),
    working: argv.includes("--working"),
    base: valueAfter("--base"),
  };
}

const cli = parseCli(process.argv.slice(2));
const concurrency = Math.max(1, Number(process.env.PHOTO_UPLOAD_CONCURRENCY ?? "4") || 4);

const THUMB_MAX_WIDTH = 800;
const THUMB_QUALITY = 82;

const client = new S3Client({
  region: "auto",
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId, secretAccessKey },
});

function gitRefExists(ref) {
  try {
    execFileSync("git", ["rev-parse", "--verify", ref], { cwd: ROOT, stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

/** @param {string} raw */
function normalizeRelPath(raw) {
  let value = String(raw ?? "").replace(/\\/g, "/").trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }
  return value;
}

/**
 * @param {string} relPath
 * @returns {{ city: string, store: string, filename: string, absPath: string } | null}
 */
function parsePhotoRelPath(relPath) {
  const normalized = normalizeRelPath(relPath);
  if (!normalized.startsWith(PHOTO_REL_PREFIX)) return null;

  const rest = normalized.slice(PHOTO_REL_PREFIX.length);
  const segments = rest.split("/").filter(Boolean);
  if (segments.length !== 3) return null;

  const [city, store, filename] = segments;
  if (/\.thumb\.webp$/i.test(filename)) return null;

  return {
    city,
    store,
    filename,
    absPath: path.join(ROOT, PHOTO_REL_PREFIX, city, store, filename),
  };
}

/**
 * @param {Buffer} output
 * @returns {Array<{ status: string, oldPath: string, newPath: string }>}
 */
function parseGitDiffZOutput(output) {
  /** @type {Array<{ status: string, oldPath: string, newPath: string }>} */
  const rows = [];
  const parts = output.toString("utf8").split("\0").filter((part) => part !== "");

  for (let i = 0; i < parts.length; ) {
    const status = parts[i] ?? "";
    i += 1;
    if (status === "") continue;

    if (status.startsWith("R")) {
      const oldPath = parts[i] ?? "";
      const newPath = parts[i + 1] ?? "";
      i += 2;
      if (oldPath !== "" && newPath !== "") {
        rows.push({ status: "R", oldPath, newPath });
      }
      continue;
    }

    if (status === "A" || status === "M" || status === "D") {
      const relPath = parts[i] ?? "";
      i += 1;
      if (relPath !== "") {
        rows.push({ status, oldPath: relPath, newPath: relPath });
      }
    }
  }

  return rows;
}

/**
 * @param {string[]} gitArgs
 * @returns {Array<{ status: string, oldPath: string, newPath: string }>}
 */
function gitDiffRows(gitArgs) {
  try {
    const [subcommand, ...rest] = gitArgs;
    const output = execFileSync("git", [subcommand, "-z", ...rest], {
      cwd: ROOT,
      encoding: "buffer",
      maxBuffer: 32 * 1024 * 1024,
    });
    if (!output || output.length === 0) return [];
    return parseGitDiffZOutput(output);
  } catch (error) {
    const stderr = error && typeof error === "object" && "stderr" in error ? String(error.stderr ?? "") : "";
    if (stderr) console.error(`[photos:upload-r2] git ${gitArgs.join(" ")} failed: ${stderr.trim()}`);
    return [];
  }
}

/** @returns {Array<{ status: string, oldPath: string, newPath: string }>} */
function collectIncrementalDiffRows() {
  /** @type {Array<{ status: string, oldPath: string, newPath: string }>} */
  const rows = [];
  const seen = new Set();

  /** @param {Array<{ status: string, oldPath: string, newPath: string }>} batch */
  const append = (batch) => {
    for (const row of batch) {
      const key = `${row.status}\t${row.oldPath}\t${row.newPath}`;
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push(row);
    }
  };

  if (cli.staged) {
    append(gitDiffRows(["diff", "--cached", "--name-status", "-M", "--find-renames=50%", "--", PHOTO_REL_PREFIX]));
    return rows;
  }

  if (cli.working) {
    append(gitDiffRows(["diff", "--name-status", "-M", "--find-renames=50%", "HEAD", "--", PHOTO_REL_PREFIX]));
    append(gitDiffRows(["diff", "--cached", "--name-status", "-M", "--find-renames=50%", "--", PHOTO_REL_PREFIX]));

    appendUntracked(rows, seen);
    return rows;
  }

  const base = cli.base !== "" ? cli.base : "origin/main";
  if (gitRefExists(base)) {
    append(gitDiffRows(["diff", "--name-status", "-M", "--find-renames=50%", `${base}...HEAD`, "--", PHOTO_REL_PREFIX]));
  }

  if (rows.length === 0) {
    console.log(
      `[photos:upload-r2] No changes vs ${base}...HEAD; falling back to working tree + untracked (use --working to force this mode).`,
    );
    append(gitDiffRows(["diff", "--name-status", "-M", "--find-renames=50%", "HEAD", "--", PHOTO_REL_PREFIX]));
    append(gitDiffRows(["diff", "--cached", "--name-status", "-M", "--find-renames=50%", "--", PHOTO_REL_PREFIX]));

    appendUntracked(rows, seen);
  }

  return rows;
}

/**
 * @param {Array<{ status: string, oldPath: string, newPath: string }>} rows
 * @param {Set<string>} seen
 */
function appendUntracked(rows, seen) {
  try {
    const output = execFileSync("git", ["ls-files", "-z", "--others", "--exclude-standard", PHOTO_REL_PREFIX], {
      cwd: ROOT,
      encoding: "buffer",
      maxBuffer: 32 * 1024 * 1024,
    });
    const files = output.toString("utf8").split("\0").filter((part) => part !== "");
    for (const rel of files) {
      const key = `A\t${rel}\t${rel}`;
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push({ status: "A", oldPath: rel, newPath: rel });
    }
  } catch {
    // ignore
  }
}

/**
 * @param {Array<{ status: string, oldPath: string, newPath: string }>} rows
 * @returns {{ puts: Array<{ city: string, store: string, filename: string, absPath: string }>, deletes: Array<{ city: string, store: string, filename: string }>, mode: string }}
 */
function buildIncrementalPlan(rows) {
  /** @type {Map<string, { city: string, store: string, filename: string, absPath: string }>} */
  const putMap = new Map();
  /** @type {Map<string, { city: string, store: string, filename: string }>} */
  const deleteMap = new Map();

  /** @param {{ city: string, store: string, filename: string }} entry */
  const deleteKey = (entry) => `${entry.city}/${entry.store}/${entry.filename}`;

  /** @param {{ city: string, store: string, filename: string, absPath: string }} entry */
  const putKey = (entry) => `${entry.city}/${entry.store}/${entry.filename}`;

  /** @param {string} relPath */
  const queueDelete = (relPath) => {
    const parsed = parsePhotoRelPath(relPath);
    if (!parsed) return;
    deleteMap.set(deleteKey(parsed), { city: parsed.city, store: parsed.store, filename: parsed.filename });
    const thumb = thumbFilenameFor(parsed.filename);
    if (thumb !== "") {
      deleteMap.set(deleteKey({ ...parsed, filename: thumb }), {
        city: parsed.city,
        store: parsed.store,
        filename: thumb,
      });
    }
  };

  /** @param {string} relPath */
  const queuePut = (relPath) => {
    const parsed = parsePhotoRelPath(relPath);
    if (!parsed || !fs.existsSync(parsed.absPath)) return;
    putMap.set(putKey(parsed), parsed);
  };

  for (const row of rows) {
    if (row.status === "D") {
      queueDelete(row.oldPath);
      continue;
    }

    if (row.status === "R") {
      queueDelete(row.oldPath);
      queuePut(row.newPath);
      continue;
    }

    if (row.status === "A" || row.status === "M") {
      queuePut(row.newPath);
    }
  }

  let modeLabel = "incremental(origin/main...HEAD)";
  if (cli.staged) modeLabel = "incremental(staged)";
  else if (cli.working) modeLabel = "incremental(working)";
  else if (cli.base !== "") modeLabel = `incremental(base=${cli.base}...HEAD)`;

  return {
    puts: [...putMap.values()],
    deletes: [...deleteMap.values()],
    mode: modeLabel,
  };
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

/** @param {string} key */
async function deleteObject(key) {
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

/**
 * @param {{ city: string, store: string, filename: string, absPath: string }} entry
 */
async function uploadOne(entry) {
  const key = photoObjectKey(entry.city, entry.store, entry.filename);

  if (cli.thumbsOnly) {
    if (cli.dryRun) {
      console.log(`[dry-run] PUT ${key}`);
      return;
    }
    await putObject(key, fs.readFileSync(entry.absPath), "image/webp");
    return;
  }

  if (cli.dryRun) {
    console.log(`[dry-run] PUT ${key}`);
    if (!cli.skipThumbs) {
      const thumbName = thumbFilenameFor(entry.filename);
      if (thumbName !== "") {
        console.log(`[dry-run] PUT ${photoObjectKey(entry.city, entry.store, thumbName)}`);
      }
    }
    return;
  }

  await putObject(key, fs.readFileSync(entry.absPath), contentTypeForFile(entry.filename));

  if (!cli.skipThumbs) {
    const thumbName = thumbFilenameFor(entry.filename);
    if (thumbName !== "") {
      const thumbPath = path.join(path.dirname(entry.absPath), thumbName);
      const thumbKey = photoObjectKey(entry.city, entry.store, thumbName);
      if (fs.existsSync(thumbPath)) {
        await putObject(thumbKey, fs.readFileSync(thumbPath), "image/webp");
      } else {
        const thumbBuffer = await sharp(entry.absPath)
          .rotate()
          .resize({ width: THUMB_MAX_WIDTH, withoutEnlargement: true })
          .webp({ quality: THUMB_QUALITY })
          .toBuffer();
        await putObject(thumbKey, thumbBuffer, "image/webp");
      }
    }
  }
}

/** @param {{ city: string, store: string, filename: string }} entry */
async function deleteOne(entry) {
  const key = photoObjectKey(entry.city, entry.store, entry.filename);
  if (cli.dryRun) {
    console.log(`[dry-run] DELETE ${key}`);
    return;
  }
  await deleteObject(key);
}

/**
 * @param {Array<{ city: string, store: string, filename: string, absPath: string }>} puts
 * @param {Array<{ city: string, store: string, filename: string }>} deletes
 */
async function runPlan(puts, deletes) {
  let uploaded = 0;
  let deleted = 0;
  let failed = 0;

  for (const entry of deletes) {
    try {
      await deleteOne(entry);
      deleted += 1;
    } catch (error) {
      failed += 1;
      console.error(
        `[photos:upload-r2] Failed DELETE ${photoObjectKey(entry.city, entry.store, entry.filename)}:`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  let index = 0;

  async function putWorker() {
    while (index < puts.length) {
      const current = index;
      index += 1;
      const entry = puts[current];
      try {
        await uploadOne(entry);
        uploaded += 1;
        if (uploaded % 25 === 0 || uploaded === puts.length) {
          console.log(`[photos:upload-r2] Upload progress ${uploaded}/${puts.length}`);
        }
      } catch (error) {
        failed += 1;
        console.error(
          `[photos:upload-r2] Failed PUT ${photoObjectKey(entry.city, entry.store, entry.filename)}:`,
          error instanceof Error ? error.message : error,
        );
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => putWorker()));

  if (failed > 0) {
    console.error(`[photos:upload-r2] Done with ${failed} failure(s). uploaded=${uploaded} deleted=${deleted}`);
    process.exit(1);
  }

  console.log(`[photos:upload-r2] Done. uploaded=${uploaded} deleted=${deleted}`);
}

/** @type {Array<{ city: string, store: string, filename: string, absPath: string }>} */
let putQueue = [];
/** @type {Array<{ city: string, store: string, filename: string }>} */
let deleteQueue = [];
let syncMode = "full";

if (cli.full || cli.thumbsOnly) {
  if (cli.thumbsOnly) {
    walkStoreThumbs((entry) => putQueue.push(entry));
    syncMode = "full-thumbs-only";
  } else {
    walkStorePhotos((entry) => putQueue.push(entry));
    syncMode = "full";
  }
} else {
  const diffRows = collectIncrementalDiffRows();
  const plan = buildIncrementalPlan(diffRows);
  putQueue = plan.puts;
  deleteQueue = plan.deletes;
  syncMode = plan.mode;
}

const thumbNote = cli.thumbsOnly ? ", thumbs-only" : cli.skipThumbs ? ", skip-thumbs" : "";
console.log(
  `[photos:upload-r2] ${cli.dryRun ? "Dry run — " : ""}mode=${syncMode}, puts=${putQueue.length}, deletes=${deleteQueue.length}, bucket=${bucket}, concurrency=${concurrency}${thumbNote}`,
);

if (putQueue.length === 0 && deleteQueue.length === 0) {
  console.log("[photos:upload-r2] Nothing to sync.");
  process.exit(0);
}

await runPlan(putQueue, deleteQueue);
