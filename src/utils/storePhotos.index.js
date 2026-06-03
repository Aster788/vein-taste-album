export function finalizePhotoIndex(index) {
  index.forEach((list, key) => {
    index.set(
      key,
      list.sort((left, right) =>
        left.filename.localeCompare(right.filename, "zh-Hans-CN"),
      ),
    );
  });
  return index;
}

/**
 * @param {Map<string, Array<{ href: string, thumbHref: string, filename: string }>>} index
 * @param {string} cityFolder
 * @param {string} storeFolder
 * @param {string} filename
 * @param {{ href: string, thumbHref: string, filename: string }} record
 */
export function addPhotoToIndex(index, cityFolder, storeFolder, filename, record) {
  const key = `${normalizeSegment(cityFolder)}/${normalizeSegment(storeFolder)}`;
  const list = index.get(key) ?? [];
  list.push(record);
  index.set(key, list);
}

function normalizeSegment(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}
