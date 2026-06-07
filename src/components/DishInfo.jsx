import { useMemo } from "react";
import { pickByLocale } from "../context/LanguageContext.jsx";
import { getDishesForRestaurant, getDishNoteText, getDishPriceText } from "../utils/dataLoader.js";
import { formatDishTasteStars } from "../utils/formatDishTasteStars.js";
import {
  findExactMatchedDishByFilename,
  getStorePhotos,
  sortPhotosByDishMatch,
  isChineseNumeralBasename,
  getBasenameWithoutExtension,
} from "../utils/storePhotos.js";

export default function DishInfo({
  citySlug,
  selectedStore,
  activePhotoIndex,
  isChina,
  detailLocale,
  labels,
}) {
  const dishes = useMemo(
    () => (selectedStore ? getDishesForRestaurant(selectedStore) : []),
    [selectedStore],
  );

  const photos = useMemo(() => {
    const base = getStorePhotos(citySlug, selectedStore?.store_slug, selectedStore?.city_en);
    return sortPhotosByDishMatch(base, dishes, selectedStore);
  }, [citySlug, selectedStore?.store_slug, selectedStore?.city_en, dishes]);

  const activeFilename = useMemo(() => {
    if (!photos.length) return "";
    const safeIndex = Math.min(Math.max(0, activePhotoIndex), photos.length - 1);
    return photos[safeIndex]?.filename ?? "";
  }, [photos, activePhotoIndex]);

  const exactMatchedDish = useMemo(
    () => findExactMatchedDishByFilename(activeFilename, dishes),
    [activeFilename, dishes],
  );

  const priceText = exactMatchedDish ? getDishPriceText(exactMatchedDish) : "";

  const nameLines = useMemo(() => {
    const basename = getBasenameWithoutExtension(activeFilename);

    if (exactMatchedDish) {
      // 精确匹配：按 PRD 规则显示菜名，首行追加价格（如有）
      if (isChina) {
        const line = pickByLocale(
          detailLocale,
          exactMatchedDish.dish_name_zh,
          exactMatchedDish.dish_name_en,
          { allowMachineTranslate: false },
        );
        const text = String(line ?? "").trim();
        if (text === "") return [];
        const lineWithPrice = priceText ? `${text}  ${priceText}` : text;
        return [lineWithPrice];
      }
      // 非中国城市：三语菜名，仅在首行追加价格
      const lines = [
        exactMatchedDish.dish_name_zh,
        exactMatchedDish.dish_name_en,
        exactMatchedDish.dish_name_local,
      ]
        .map((v) => String(v ?? "").trim())
        .filter((v) => v !== "");
      if (lines.length > 0 && priceText) {
        lines[0] = `${lines[0]}  ${priceText}`;
      }
      return lines;
    }

    // 前缀匹配或未匹配：仅展示 basename（中文数字序号除外）
    if (basename === "") return [];
    if (isChineseNumeralBasename(basename)) return [];
    return [basename];
  }, [exactMatchedDish, isChina, detailLocale, activeFilename, priceText]);

  const starsText = exactMatchedDish ? formatDishTasteStars(exactMatchedDish.taste) : "";
  const noteText = exactMatchedDish ? getDishNoteText(exactMatchedDish) : "";
  const noteLength = Array.from(noteText).length;
  const noteDensityClass =
    noteLength >= 220 ? "is-density-xl" : noteLength >= 150 ? "is-density-lg" : noteLength >= 90 ? "is-density-md" : "is-density-sm";

  if (!selectedStore) return null;

  return (
    <aside className="ffj-dish-info" aria-label={labels.dishInfoRegion}>
      <div className="ffj-dish-info-inner">
        {nameLines.length > 0 ? (
          <div className="ffj-dish-info-names">
            {nameLines.map((line, index) => (
              <p
                key={`${line}-${index}`}
                className={`ffj-dish-info-name-line ${index > 0 ? "is-secondary" : ""}`}
              >
                {line}
              </p>
            ))}
          </div>
        ) : null}
        {starsText !== "" ? (
          <p className="ffj-dish-info-stars" aria-label={labels.tasteStars}>
            {starsText}
          </p>
        ) : null}
        {noteText !== "" ? <p className={`ffj-dish-info-note ${noteDensityClass}`}>{noteText}</p> : null}
      </div>
    </aside>
  );
}
