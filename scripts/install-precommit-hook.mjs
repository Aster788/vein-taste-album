import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const hookPath = path.join(root, ".git", "hooks", "pre-commit");

if (!fs.existsSync(path.join(root, ".git"))) {
  console.error("[install-precommit-hook] .git directory not found");
  process.exit(1);
}

const hookScript = `#!/usr/bin/env bash
set -euo pipefail

echo "[pre-commit] Running filename audit..."
npm run audit:filenames
`;

fs.writeFileSync(hookPath, hookScript, "utf8");
fs.chmodSync(hookPath, 0o755);
console.log("[install-precommit-hook] Installed .git/hooks/pre-commit");
