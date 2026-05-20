/**
 * 菜品页「多分店归组」——同城 + 相同 store_slug 的通用规则（非白名单、非店名硬编码）。
 *
 * 契约（适用于所有现有与未来分店，无需改 UI 代码）：
 * - 数据：restaurants.json 中多条 `record_scope=branch` 行共享 `(city_en, store_slug)`
 * - 地图：每条 branch 独立打点（MapPanel 读原始行，不经本模块去重）
 * - 菜品左侧：本模块 `getCuisineStoreGroupsByCity` 按 slug 合并为一项
 * - 菜品右侧地址：`getCuisineAddressBlock` 多行 `{分店标签}：{address}`
 * - dishes / photos：一套 `store_slug` 目录与菜品记录（见 docs/data-workflow.md §4.1）
 *
 * 维护：新增分店只需在 Excel 填相同 store_slug；跑 `npm run audit:multi-branch` 核对。
 *
 * @see docs/prd.md §5.1 多分店
 * @see docs/prd-ui-spec.md §4.3 菜品页
 */
import { getDishesByCity, getRestaurantsByCity, normalizeCityEn } from "./dataLoader.js";

const ZH_PINYIN_COLLATOR = new Intl.Collator("zh-Hans-CN-u-co-pinyin", {
  usage: "sort",
  sensitivity: "base",
  numeric: true,
});

function normalizeRecordScope(recordScope) {
  return String(recordScope ?? "")
    .trim()
    .toLowerCase() === "brand"
    ? "brand"
    : "branch";
}

function normalizeStoreSlug(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function normalizeSortText(value) {
  return String(value ?? "")
    .trim()
    .replace(/^[\s\p{P}\p{S}]+/gu, "");
}

function isNumericLeading(text) {
  return /^\d/.test(text);
}

function comparePinyinWithNumericRule(leftText, rightText) {
  const leftNumeric = isNumericLeading(leftText);
  const rightNumeric = isNumericLeading(rightText);
  if (leftNumeric !== rightNumeric) {
    return leftNumeric ? 1 : -1;
  }
  return ZH_PINYIN_COLLATOR.compare(leftText, rightText);
}

/**
 * 从完整店名解析括号内分店标签（通用规则，适用于所有含括号分店名的店名）。
 * 例：`南里山房(上海来福士广场店)` → `上海来福士广场店`；`耶里夏丽(田林东路店)` → `田林东路店`
 * @param {string | null | undefined} nameZh
 * @returns {string}
 */
export function parseBranchLabel(nameZh) {
  const text = String(nameZh ?? "").trim();
  const matched = text.match(/[（(]([^）)]+)[）)]\s*$/u);
  return matched ? String(matched[1] ?? "").trim() : "";
}

/**
 * 去掉末尾括号分店后缀，得到基础店名。
 * @param {string | null | undefined} name
 * @returns {string}
 */
export function stripBranchSuffix(name) {
  const text = String(name ?? "").trim();
  if (text === "") return "";
  const stripped = text.replace(/[（(][^）)]*[）)]\s*$/u, "").trim();
  return stripped || text;
}

/**
 * 地图标签文案：按完整店名（name_zh / name_en / name_local，由 MapPanel 选定）展示；
 * 空间不足时仅从末尾截断并加省略号，不单独抽取括号内分店后缀。
 * @see docs/prd.md §5.1 多分店 — 地图标签显示完整 name_zh
 * @param {string | null | undefined} name
 * @param {number} maxChars
 * @returns {string}
 */
export function formatMapTagLabel(name, maxChars) {
  const full = String(name ?? "").trim();
  const limit = Math.max(1, Math.floor(Number(maxChars) || 0));
  if (full === "") return "";
  if (full.length <= limit) return full;
  if (limit <= 1) return "…";
  return `${full.slice(0, limit - 1)}…`;
}

/**
 * 地图每个 branch 打点的唯一键（同城同 slug 多分店时仍唯一）。
 * @param {{ city_en?: string, store_slug?: string, lng?: number, lat?: number, name_zh?: string, name_en?: string, name_local?: string }} row
 * @returns {string}
 */
export function buildMapBranchKey(row) {
  const city = normalizeCityEn(row?.city_en);
  const slug = normalizeStoreSlug(row?.store_slug);
  const lng = Number(row?.lng);
  const lat = Number(row?.lat);
  if (city !== "" && slug !== "" && Number.isFinite(lng) && Number.isFinite(lat)) {
    return `${city}|${slug}|${lng.toFixed(6)}|${lat.toFixed(6)}`;
  }
  const name = String(row?.name_zh ?? row?.name_en ?? row?.name_local ?? "").trim();
  return `${city}|${slug}|${name}`;
}

function getDishesForStoreSlug(cityEn, storeSlug) {
  const slugKey = normalizeStoreSlug(storeSlug);
  if (slugKey === "") return [];
  return getDishesByCity(cityEn).filter(
    (dish) => normalizeStoreSlug(dish.store_slug) === slugKey,
  );
}

function pickBaseNameZhFromBranches(branches) {
  const candidates = branches
    .map((row) => stripBranchSuffix(row?.name_zh))
    .map((value) => String(value ?? "").trim())
    .filter((value) => value !== "");
  if (candidates.length === 0) return "";
  return candidates.sort((left, right) => left.length - right.length)[0];
}

function pickBaseNameFromDishes(cityEn, storeSlug) {
  const dishes = getDishesForStoreSlug(cityEn, storeSlug);
  const first = dishes[0];
  if (!first) return { zh: "", en: "", local: "" };
  return {
    zh: String(first.store_name_zh ?? "").trim(),
    en: String(first.store_name_en ?? "").trim(),
    local: String(first.store_name_local ?? "").trim(),
  };
}

function collectUniqueNonEmpty(values) {
  const seen = new Set();
  const result = [];
  values.forEach((value) => {
    const text = String(value ?? "").trim();
    if (text === "" || seen.has(text)) return;
    seen.add(text);
    result.push(text);
  });
  return result;
}

/**
 * @typedef {object} CuisineStoreGroup
 * @property {string} city_en
 * @property {string} store_slug
 * @property {Array<Record<string, unknown>>} branches
 */

/**
 * 按 `(city_en, store_slug)` 将 branch 行归组（排除 `record_scope=brand`）。
 * 单 slug 仅一行时返回长度为 1 的组（行为与单店一致）。
 * 多行同 slug 时自动合并——无需维护店名白名单。
 * @param {string} cityEn
 * @returns {CuisineStoreGroup[]}
 */
export function getCuisineStoreGroupsByCity(cityEn) {
  const rows = getRestaurantsByCity(cityEn).filter(
    (row) => normalizeRecordScope(row.record_scope) !== "brand",
  );
  /** @type {Map<string, CuisineStoreGroup>} */
  const groups = new Map();

  rows.forEach((row, index) => {
    const slug = normalizeStoreSlug(row.store_slug);
    if (slug === "") return;
    const key = `${normalizeCityEn(row.city_en)}|${slug}`;
    const existing = groups.get(key);
    if (existing) {
      existing.branches.push(row);
      existing._order = Math.min(existing._order ?? index, index);
      return;
    }
    groups.set(key, {
      city_en: row.city_en,
      store_slug: row.store_slug,
      branches: [row],
      _order: index,
    });
  });

  return Array.from(groups.values()).map(({ _order: _ignored, ...group }) => group);
}

/**
 * @param {CuisineStoreGroup} group
 * @returns {string[]}
 */
export function getCuisineDisplayNameLines(group) {
  const fromDishes = pickBaseNameFromDishes(group.city_en, group.store_slug);
  const zh =
    fromDishes.zh || pickBaseNameZhFromBranches(group.branches);
  const enValues = collectUniqueNonEmpty([
    fromDishes.en,
    ...group.branches.map((row) => row?.name_en),
  ]);
  const localValues = collectUniqueNonEmpty([
    fromDishes.local,
    ...group.branches.map((row) => row?.name_local),
  ]);

  return [zh, ...enValues, ...localValues].filter((value) => value !== "");
}

function sortBranchesForDisplay(branches) {
  return [...branches].sort((left, right) => {
    const leftLabel = normalizeSortText(
      parseBranchLabel(left?.name_zh) || left?.name_zh,
    );
    const rightLabel = normalizeSortText(
      parseBranchLabel(right?.name_zh) || right?.name_zh,
    );
    return comparePinyinWithNumericRule(leftLabel, rightLabel);
  });
}

/**
 * @param {CuisineStoreGroup} group
 * @returns {string}
 */
export function getCuisineAddressBlock(group) {
  const branches = sortBranchesForDisplay(group.branches);
  const isMultiBranch = branches.length > 1;
  const lines = [];

  branches.forEach((branch) => {
    const address = String(branch?.address ?? "").trim();
    if (address === "") return;
    if (!isMultiBranch) {
      lines.push(address);
      return;
    }
    const label =
      parseBranchLabel(branch?.name_zh) ||
      String(branch?.name_zh ?? "").trim();
    lines.push(`${label}：${address}`);
  });

  return lines.join("\n");
}

/**
 * 菜品页列表排序用主键（基础名优先）。
 * @param {CuisineStoreGroup} group
 * @returns {string}
 */
export function getCuisineGroupSortKey(group) {
  const lines = getCuisineDisplayNameLines(group);
  return normalizeSortText(lines[0] ?? "");
}

/**
 * 组内代表分店行（`store_slug` 相同，任取稳定排序后首条）。
 * @param {CuisineStoreGroup} group
 * @returns {CuisineStoreGroup['branches'][number] | null}
 */
export function getCuisineGroupRepresentativeBranch(group) {
  const branches = sortBranchesForDisplay(group.branches);
  return branches[0] ?? null;
}
