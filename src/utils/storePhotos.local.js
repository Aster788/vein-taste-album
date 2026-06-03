const PHOTO_MODULES = import.meta.glob(
  "../assets/photos/*/*/*.{jpg,jpeg,png,webp,heic,JPG,JPEG,PNG,WEBP,HEIC}",
  { eager: true, import: "default" },
);

const THUMB_MODULES = import.meta.glob(
  "../assets/photos/*/*/*.thumb.webp",
  { eager: true, import: "default" },
);

import { addPhotoToIndex, finalizePhotoIndex } from "./storePhotos.index.js";

function normalizeSegment(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

/** @param {string} filename */
function thumbFilenameFor(filename) {
  const name = String(filename ?? "").trim();
  if (name === "") return "";
  const lastDot = name.lastIndexOf(".");
  const base = lastDot <= 0 ? name : name.slice(0, lastDot);
  return `${base}.thumb.webp`;
}

function buildThumbLookup() {
  /** @type {Map<string, string>} */
  const lookup = new Map();
  Object.entries(THUMB_MODULES).forEach(([path, href]) => {
    const matched = path.match(/\/assets\/photos\/([^/]+)\/([^/]+)\/([^/]+)$/i);
    if (!matched) return;
    const [, cityFolder, storeFolder, filename] = matched;
    lookup.set(`${normalizeSegment(cityFolder)}/${normalizeSegment(storeFolder)}/${filename}`, href);
  });
  return lookup;
}

export function buildLocalPhotoIndex() {
  const thumbLookup = buildThumbLookup();
  /** @type {Map<string, Array<{ href: string, thumbHref: string, filename: string }>>} */
  const index = new Map();

  Object.entries(PHOTO_MODULES).forEach(([path, href]) => {
    const matched = path.match(/\/assets\/photos\/([^/]+)\/([^/]+)\/([^/]+)$/i);
    if (!matched) return;
    const [, cityFolder, storeFolder, filename] = matched;
    if (/\.thumb\.webp$/i.test(filename)) return;

    const thumbName = thumbFilenameFor(filename);
    const thumbKey = `${normalizeSegment(cityFolder)}/${normalizeSegment(storeFolder)}/${thumbName}`;
    const thumbHref = thumbLookup.get(thumbKey) ?? href;

    addPhotoToIndex(index, cityFolder, storeFolder, filename, {
      href,
      thumbHref,
      filename,
    });
  });

  return finalizePhotoIndex(index);
}
