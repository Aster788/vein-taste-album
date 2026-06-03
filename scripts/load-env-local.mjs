import fs from "node:fs";
import path from "node:path";

/**
 * @param {string} envPath
 * @param {{ override?: boolean }} options — override=true: .env.local wins over existing keys
 */
function applyEnvFile(envPath, { override = false } = {}) {
  if (!fs.existsSync(envPath)) return false;

  const raw = fs.readFileSync(envPath, "utf8");
  raw.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) return;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (key === "") return;
    if (!override && process.env[key] != null) return;
    process.env[key] = value;
  });

  return true;
}

/**
 * Load env for Node scripts: `.env.vercel` (from `vercel env pull`) then `.env.local` (your secrets, wins on conflict).
 * @param {string} [root]
 */
export function loadEnvLocal(root = process.cwd()) {
  const vercelPath = path.join(root, ".env.vercel");
  const localPath = path.join(root, ".env.local");

  applyEnvFile(vercelPath, { override: false });
  applyEnvFile(localPath, { override: true });

  return fs.existsSync(localPath) || fs.existsSync(vercelPath);
}
