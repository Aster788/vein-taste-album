import { buildLocalPhotoIndex } from "./storePhotos.local.js";
import { setStorePhotoIndex } from "./storePhotos.js";

export async function initDevStorePhotos() {
  setStorePhotoIndex(buildLocalPhotoIndex());
}
