/**
 * Fails when a Markdown link is wrapped in outer backticks (renders as code, not clickable).
 * Pattern to avoid: `[text](url)`  — correct: [text](url) or [`code`](url) with backticks only inside link text.
 */
import fs from "node:fs";
import path from "node:path";

const DOCS_DIR = path.join(process.cwd(), "docs");
/** Operational docs only; rules docs may show counter-examples in prose. */
const SCAN_FILES = new Set([
  "data-workflow.md",
  "prd.md",
  "prd-ui-spec.md",
  "prd-i18n-locale.md",
  "structure.md",
]);
const WRAPPED_LINK = /`\[([^\]]*)\]\(([^)]*)\)`/g;

function scanFile(filePath) {
  const rel = path.relative(process.cwd(), filePath);
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  const issues = [];
  let inFence = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^```/.test(line.trim())) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    for (const match of line.matchAll(WRAPPED_LINK)) {
      issues.push({ rel, line: i + 1, snippet: match[0].slice(0, 80) });
    }
  }

  return issues;
}

function main() {
  const entries = fs.readdirSync(DOCS_DIR, { withFileTypes: true });
  const issues = [];

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
    if (!SCAN_FILES.has(entry.name)) continue;
    issues.push(...scanFile(path.join(DOCS_DIR, entry.name)));
  }

  if (issues.length === 0) {
    console.log("audit:doc-links OK — no wrapped Markdown links in docs/*.md");
    return;
  }

  console.error("audit:doc-links FAILED — link wrapped in outer backticks (not clickable):\n");
  for (const { rel, line, snippet } of issues) {
    console.error(`  ${rel}:${line}  ${snippet}`);
  }
  console.error(
    "\nFix: remove outer backticks. Use [src/foo.js](../src/foo.js), not `[src/foo.js](../src/foo.js)`.",
  );
  process.exit(1);
}

main();
