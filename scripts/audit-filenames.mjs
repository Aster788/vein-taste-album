import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SCAN_DIRS = ["src/assets", "public", "static"];
const IGNORE_DIRS = new Set(["node_modules", ".git", "dist", "build", ".next", ".nuxt"]);
const ALLOWED_EXTS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif",
  ".svg",
  ".ico",
  ".mp4",
  ".webm",
  ".mp3",
  ".wav",
  ".pdf",
  ".json",
  ".txt",
  ".heic",
  ".avif",
]);

const CONTROL_CHAR_RE = /[\u0000-\u001F\u007F]/;
const FORBIDDEN_CHAR_RE = /[#?\\]/;
const LONE_PERCENT_RE = /%(?![0-9A-Fa-f]{2})/;
const LEADING_TRAILING_SPACE_RE = /^\s|\s$/;

function toPosix(relativePath) {
  return relativePath.replace(/\\/g, "/");
}

/** @param {string} absPath */
function walk(absPath, issues) {
  const entries = fs.readdirSync(absPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(absPath, entry.name);
    if (entry.isDirectory()) {
      if (!IGNORE_DIRS.has(entry.name)) walk(fullPath, issues);
      continue;
    }
    if (!entry.isFile()) continue;

    const ext = path.extname(entry.name).toLowerCase();
    if (!ALLOWED_EXTS.has(ext)) continue;

    const relPath = toPosix(path.relative(ROOT, fullPath));
    const filename = entry.name;

    if (LEADING_TRAILING_SPACE_RE.test(filename)) {
      issues.push({ relPath, reason: "leading/trailing space" });
    }
    if (CONTROL_CHAR_RE.test(filename)) {
      issues.push({ relPath, reason: "control character in filename" });
    }
    if (FORBIDDEN_CHAR_RE.test(filename)) {
      issues.push({ relPath, reason: "contains forbidden character (#, ?, \\\\)" });
    }
    if (LONE_PERCENT_RE.test(filename)) {
      issues.push({ relPath, reason: "contains raw % (not %XX encoded)" });
    }

    try {
      decodeURI(filename);
    } catch {
      issues.push({ relPath, reason: "decodeURI failed (URI malformed)" });
    }
  }
}

function main() {
  /** @type {Array<{relPath: string, reason: string}>} */
  const issues = [];

  for (const relDir of SCAN_DIRS) {
    const absDir = path.resolve(ROOT, relDir);
    if (fs.existsSync(absDir)) {
      walk(absDir, issues);
    }
  }

  if (issues.length > 0) {
    console.error("[audit-filenames] FAILED");
    for (const issue of issues) {
      console.error(`- ${issue.relPath} -> ${issue.reason}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log("[audit-filenames] OK");
}

main();
