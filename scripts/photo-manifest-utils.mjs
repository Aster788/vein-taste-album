import fs from "node:fs";
import path from "node:path";

export const PHOTOS_ROOT = path.join(process.cwd(), "src/assets/photos");
/** R2 / CDN object key prefix (matches `src/assets/photos/` layout). */
export const PHOTO_OBJECT_PREFIX = "photos";

const PHOTO_EXT_RE = /\.(jpg|jpeg|png|webp|heic)$/i;

/** @param {string} absPath @returns {boolean} */
export function isPhotoFile(absPath) {
  return PHOTO_EXT_RE.test(absPath);
}

/**
 * Walk store-level photo files: photos/{city}/{store}/{filename}
 * @param {(entry: { city: string, store: string, filename: string, absPath: string }) => void} onPhoto
 */
export function walkStorePhotos(onPhoto) {
  if (!fs.existsSync(PHOTOS_ROOT)) return;

  for (const cityEntry of fs.readdirSync(PHOTOS_ROOT, { withFileTypes: true })) {
    if (!cityEntry.isDirectory()) continue;
    const cityDir = path.join(PHOTOS_ROOT, cityEntry.name);

    for (const storeEntry of fs.readdirSync(cityDir, { withFileTypes: true })) {
      if (!storeEntry.isDirectory()) continue;
      const storeDir = path.join(cityDir, storeEntry.name);

      for (const fileEntry of fs.readdirSync(storeDir, { withFileTypes: true })) {
        if (!fileEntry.isFile()) continue;
        const absPath = path.join(storeDir, fileEntry.name);
        if (!isPhotoFile(absPath)) continue;
        if (/\.thumb\.webp$/i.test(fileEntry.name)) continue;

        onPhoto({
          city: cityEntry.name,
          store: storeEntry.name,
          filename: fileEntry.name,
          absPath,
        });
      }
    }
  }
}

/**
 * Walk generated thumbnail files only: photos/{city}/{store}/*.thumb.webp
 * @param {(entry: { city: string, store: string, filename: string, absPath: string }) => void} onPhoto
 */
export function walkStoreThumbs(onPhoto) {
  if (!fs.existsSync(PHOTOS_ROOT)) return;

  for (const cityEntry of fs.readdirSync(PHOTOS_ROOT, { withFileTypes: true })) {
    if (!cityEntry.isDirectory()) continue;
    const cityDir = path.join(PHOTOS_ROOT, cityEntry.name);

    for (const storeEntry of fs.readdirSync(cityDir, { withFileTypes: true })) {
      if (!storeEntry.isDirectory()) continue;
      const storeDir = path.join(cityDir, storeEntry.name);

      for (const fileEntry of fs.readdirSync(storeDir, { withFileTypes: true })) {
        if (!fileEntry.isFile()) continue;
        if (!/\.thumb\.webp$/i.test(fileEntry.name)) continue;
        onPhoto({
          city: cityEntry.name,
          store: storeEntry.name,
          filename: fileEntry.name,
          absPath: path.join(storeDir, fileEntry.name),
        });
      }
    }
  }
}

/** @param {string} city @param {string} store @param {string} filename */
export function photoObjectKey(city, store, filename) {
  return `${PHOTO_OBJECT_PREFIX}/${city}/${store}/${filename}`;
}

/** @param {string} baseUrl @param {string} city @param {string} store @param {string} filename */
export function photoPublicHref(baseUrl, city, store, filename) {
  const normalizedBase = String(baseUrl ?? "").trim().replace(/\/+$/, "");
  const segments = photoObjectKey(city, store, filename)
    .split("/")
    .map((segment) => encodeURIComponent(segment));
  return `${normalizedBase}/${segments.join("/")}`;
}
