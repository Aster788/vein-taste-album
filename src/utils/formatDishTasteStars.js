/**
 * `dishes.json` 的 `taste`（1～5 整数）→ 星标展示字符串（全站唯一实现）。
 * @param {unknown} taste
 * @returns {string} 无效或空时返回空字符串
 */
export function formatDishTasteStars(taste) {
  const n = Number(taste);
  if (!Number.isFinite(n)) return "";
  const rounded = Math.round(n);
  if (rounded < 1 || rounded > 5) return "";
  return "⭐".repeat(rounded);
}
