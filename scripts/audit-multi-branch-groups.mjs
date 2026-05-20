/**
 * Lists every multi-branch store group in restaurants.json.
 *
 * Rule (universal, not store-specific): same `(city_en, store_slug)` with
 * multiple `record_scope=branch` rows → one cuisine list item, multiple map pins.
 * See docs/data-workflow.md §4.1 and src/utils/storeGroups.js
 */
import fs from "node:fs";
import path from "node:path";

const RESTAURANTS_PATH = path.join(process.cwd(), "src", "data", "restaurants.json");

function normalizeCityEn(value) {
  return String(value ?? "").trim().toLowerCase();
}

function normalizeStoreSlug(value) {
  return String(value ?? "").trim().toLowerCase();
}

function normalizeRecordScope(value) {
  return String(value ?? "").trim().toLowerCase() === "brand" ? "brand" : "branch";
}

function parseBranchLabel(nameZh) {
  const text = String(nameZh ?? "").trim();
  const matched = text.match(/[（(]([^）)]+)[）)]\s*$/u);
  return matched ? String(matched[1] ?? "").trim() : "";
}

const restaurants = JSON.parse(fs.readFileSync(RESTAURANTS_PATH, "utf8"));
/** @type {Map<string, { city_en: string, store_slug: string, branches: object[] }>} */
const groups = new Map();

for (const row of restaurants) {
  if (normalizeRecordScope(row.record_scope) === "brand") continue;
  const slug = normalizeStoreSlug(row.store_slug);
  if (slug === "") continue;
  const key = `${normalizeCityEn(row.city_en)}|${slug}`;
  const existing = groups.get(key);
  if (existing) {
    existing.branches.push(row);
    continue;
  }
  groups.set(key, {
    city_en: row.city_en,
    store_slug: row.store_slug,
    branches: [row],
  });
}

const multiBranch = Array.from(groups.values()).filter((g) => g.branches.length > 1);

console.log(`[audit:multi-branch] total groups: ${groups.size}`);
console.log(`[audit:multi-branch] multi-branch groups: ${multiBranch.length}`);

if (multiBranch.length === 0) {
  console.log("[audit:multi-branch] OK — no multi-branch groups found.");
  process.exit(0);
}

multiBranch
  .sort((left, right) => {
    const cityCmp = normalizeCityEn(left.city_en).localeCompare(normalizeCityEn(right.city_en));
    if (cityCmp !== 0) return cityCmp;
    return normalizeStoreSlug(left.store_slug).localeCompare(normalizeStoreSlug(right.store_slug));
  })
  .forEach((group) => {
    console.log("");
    console.log(`${group.city_en} / ${group.store_slug} (${group.branches.length} branches)`);
    group.branches.forEach((branch) => {
      const label = parseBranchLabel(branch.name_zh) || branch.name_zh || "(no name)";
      const hasCoords = Number.isFinite(branch.lng) && Number.isFinite(branch.lat);
      console.log(`  - ${label} | map: ${hasCoords ? "yes" : "no coords"}`);
    });
  });

console.log("");
console.log("[audit:multi-branch] Cuisine UI will show 1 list item per group above; map shows each branch with coords.");
