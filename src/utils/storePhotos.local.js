const PHOTO_MODULES = import.meta.glob(
  "../assets/photos/*/*/*.{jpg,jpeg,png,webp,heic,JPG,JPEG,PNG,WEBP,HEIC}",
  { eager: true, import: "default" },
);

import { addPhotoToIndex, finalizePhotoIndex } from "./storePhotos.index.js";

export function buildLocalPhotoIndex() {
  /** @type {Map<string, Array<{ href: string, filename: string }>>} */
  const index = new Map();

  Object.entries(PHOTO_MODULES).forEach(([path, href]) => {
    const matched = path.match(/\/assets\/photos\/([^/]+)\/([^/]+)\/([^/]+)$/i);
    if (!matched) return;
    const [, cityFolder, storeFolder, filename] = matched;
    addPhotoToIndex(index, cityFolder, storeFolder, filename, href);
  });

  return finalizePhotoIndex(index);
}
