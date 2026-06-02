const ZH_PINYIN_COLLATOR = new Intl.Collator("zh-Hans-CN-u-co-pinyin", {
  usage: "sort",
  sensitivity: "base",
  numeric: true,
});

export function normalizeSortText(value) {
  return String(value ?? "")
    .trim()
    .replace(/^[\s\p{P}\p{S}]+/gu, "");
}

export function isNumericLeading(text) {
  return /^\d/.test(text);
}

export function comparePinyinWithNumericRule(leftText, rightText) {
  const leftNumeric = isNumericLeading(leftText);
  const rightNumeric = isNumericLeading(rightText);
  if (leftNumeric !== rightNumeric) {
    return leftNumeric ? 1 : -1;
  }
  return ZH_PINYIN_COLLATOR.compare(leftText, rightText);
}
