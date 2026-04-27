import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const dataDir = path.join(root, "src", "data");
const restaurantsPath = path.join(dataDir, "restaurants.json");
const cityMetaPath = path.join(dataDir, "city_meta.json");
const outputPath = path.join(dataDir, "translations.static.json");
const envPath = path.join(root, ".env");

function normalizeLangCode(langCode) {
  const code = String(langCode ?? "").trim().toLowerCase();
  if (code === "zh" || code === "cn") return "zh-CN";
  return code;
}

function makeKey(text, sourceLang, targetLang) {
  return JSON.stringify({
    t: String(text ?? ""),
    s: normalizeLangCode(sourceLang),
    d: normalizeLangCode(targetLang),
  });
}

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw);
}

async function readEnvFile(filePath) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const map = new Map();
    raw.split(/\r?\n/).forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) return;
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim();
      map.set(key, value);
    });
    return map;
  } catch {
    return new Map();
  }
}

function collectTranslationJobs(restaurants, cityMetaBySlug) {
  const jobs = new Map();

  for (const row of restaurants) {
    if (row?.is_china !== false) continue;
    const citySlug = String(row.city_en ?? "").trim().toLowerCase();
    const cityMeta = cityMetaBySlug[citySlug] ?? null;
    const mode = cityMeta?.detail_locale_mode ?? "en_native_zh";
    const nativeIso = String(cityMeta?.native_iso639_1 ?? "").trim().toLowerCase();
    const targetLangs =
      mode === "en_zh" ? ["zh-CN", "en"] : ["zh-CN", "en", normalizeLangCode(nativeIso)];

    const fields = [
      { value: row.cuisine, sourceHint: "zh-CN" },
      { value: row.address, sourceHint: "zh-CN" },
      { value: row.hours, sourceHint: "zh-CN" },
    ];

    for (const field of fields) {
      const text = String(field.value ?? "").trim();
      if (text === "") continue;

      for (const targetLang of targetLangs) {
        if (!targetLang) continue;
        if (targetLang === field.sourceHint) continue;
        const key = makeKey(text, field.sourceHint, targetLang);
        if (!jobs.has(key)) {
          jobs.set(key, {
            text,
            sourceLang: field.sourceHint,
            targetLang,
          });
        }
      }
    }
  }

  return Array.from(jobs.values());
}

async function translateText({ text, sourceLang, targetLang, apiKey }) {
  const endpoint = `https://translation.googleapis.com/language/translate/v2?key=${encodeURIComponent(
    apiKey,
  )}`;
  const payload = {
    q: text,
    source: sourceLang,
    target: targetLang,
    format: "text",
  };
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const data = await response.json();
  return String(data?.data?.translations?.[0]?.translatedText ?? "").trim();
}

async function main() {
  const envMap = await readEnvFile(envPath);
  const apiKey =
    process.env.VITE_GOOGLE_TRANSLATE_API_KEY ??
    envMap.get("VITE_GOOGLE_TRANSLATE_API_KEY") ??
    "";

  if (!String(apiKey).trim()) {
    throw new Error("Missing VITE_GOOGLE_TRANSLATE_API_KEY in .env");
  }

  const restaurants = await readJson(restaurantsPath);
  const cityMetaBySlug = await readJson(cityMetaPath);
  const existing = await readJson(outputPath).catch(() => ({ version: 1, translations: {} }));
  const translations = { ...(existing?.translations ?? {}) };

  const jobs = collectTranslationJobs(restaurants, cityMetaBySlug);
  let translated = 0;
  let skipped = 0;
  let failed = 0;

  for (const job of jobs) {
    const key = makeKey(job.text, job.sourceLang, job.targetLang);
    if (translations[key]) {
      skipped += 1;
      continue;
    }
    try {
      const out = await translateText({ ...job, apiKey });
      if (out) {
        translations[key] = out;
        translated += 1;
      } else {
        failed += 1;
      }
    } catch {
      failed += 1;
    }
    await new Promise((resolve) => setTimeout(resolve, 120));
  }

  const payload = {
    version: 1,
    generated_at: new Date().toISOString(),
    source: "google-translate-v2",
    translations,
  };
  await fs.writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  console.log(
    `[export-static-translations] jobs=${jobs.length} translated=${translated} skipped=${skipped} failed=${failed} output=${path.relative(
      root,
      outputPath,
    )}`,
  );
}

main().catch((error) => {
  console.error("[export-static-translations] failed:", error);
  process.exitCode = 1;
});
