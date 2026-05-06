import { promises as fs } from "node:fs";
import path from "node:path";

const ROOT = path.resolve("src/assets/photos");
const TARGET_EXT = new Set([".jpg", ".jpeg", ".png", ".webp"]);

function toHex(buffer) {
  return Array.from(buffer)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join(" ")
    .toUpperCase();
}

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(full)));
    } else if (entry.isFile()) {
      files.push(full);
    }
  }
  return files;
}

function detectType(header) {
  if (header.length >= 3 && header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff) {
    return "jpeg";
  }
  if (
    header.length >= 8 &&
    header[0] === 0x89 &&
    header[1] === 0x50 &&
    header[2] === 0x4e &&
    header[3] === 0x47
  ) {
    return "png";
  }
  if (
    header.length >= 12 &&
    String.fromCharCode(...header.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...header.slice(8, 12)) === "WEBP"
  ) {
    return "webp";
  }
  if (header.length >= 12 && Buffer.from(header).includes(Buffer.from("ftypheic"))) {
    return "heic";
  }
  if (header.length >= 12 && Buffer.from(header).includes(Buffer.from("ftypheif"))) {
    return "heif";
  }
  return "unknown";
}

function expectedFromExt(ext) {
  if (ext === ".jpg" || ext === ".jpeg") return "jpeg";
  if (ext === ".png") return "png";
  if (ext === ".webp") return "webp";
  return "unknown";
}

async function main() {
  const allFiles = await walk(ROOT);
  const photoFiles = allFiles.filter((file) => TARGET_EXT.has(path.extname(file).toLowerCase()));
  const issues = [];

  for (const file of photoFiles) {
    const ext = path.extname(file).toLowerCase();
    const expected = expectedFromExt(ext);
    const fd = await fs.open(file, "r");
    const buffer = Buffer.alloc(32);
    const { bytesRead } = await fd.read(buffer, 0, buffer.length, 0);
    await fd.close();
    const header = buffer.subarray(0, bytesRead);
    const actual = detectType(header);

    if (expected !== actual) {
      issues.push({
        file: path.relative(process.cwd(), file).replaceAll("\\", "/"),
        ext,
        expected,
        actual,
        header: toHex(header.subarray(0, 16)),
      });
    }
  }

  console.log(`[photo-magic] scanned=${photoFiles.length} issues=${issues.length}`);
  if (issues.length === 0) {
    console.log("[photo-magic] OK: all photo file headers match extensions.");
    return;
  }

  for (const issue of issues) {
    const disguisedHeic =
      (issue.ext === ".jpg" || issue.ext === ".jpeg") &&
      (issue.actual === "heic" || issue.actual === "heif");
    const note = disguisedHeic ? " (HEIC disguised as JPG/JPEG)" : "";
    console.error(
      `[photo-magic] ${issue.file} ext=${issue.ext} expected=${issue.expected} actual=${issue.actual}${note} header=${issue.header}`,
    );
  }

  process.exitCode = 1;
}

main().catch((error) => {
  console.error("[photo-magic] failed:", error);
  process.exitCode = 1;
});
