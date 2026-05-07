import { useMemo } from "react";
import { pickByLocale } from "../context/LanguageContext.jsx";
import { getDishesForRestaurant, getDishNoteText } from "../utils/dataLoader.js";
import { formatDishTasteStars } from "../utils/formatDishTasteStars.js";
import {
  findMatchedDishByFilename,
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
    const base = getStorePhotos(citySlug, selectedStore?.store_slug);
    return sortPhotosByDishMatch(base, dishes);
  }, [citySlug, selectedStore?.store_slug, dishes]);

  const activeFilename = useMemo(() => {
    if (!photos.length) return "";
    const safeIndex = Math.min(Math.max(0, activePhotoIndex), photos.length - 1);
    return photos[safeIndex]?.filename ?? "";
  }, [photos, activePhotoIndex]);

  const matchedDish = useMemo(
    () => findMatchedDishByFilename(activeFilename, dishes),
    [activeFilename, dishes],
  );

  const nameLines = useMemo(() => {
    if (matchedDish) {
      // 匹配成功：按 PRD 规则显示菜名
      if (isChina) {
        const line = pickByLocale(
          detailLocale,
          matchedDish.dish_name_zh,
          matchedDish.dish_name_en,
          { allowMachineTranslate: false },
        );
        const text = String(line ?? "").trim();
        return text === "" ? [] : [text];
      }
      return [matchedDish.dish_name_zh, matchedDish.dish_name_en, matchedDish.dish_name_local]
        .map((v) => String(v ?? "").trim())
        .filter((v) => v !== "");
    }

    // 未匹配到菜品：按 Task 5.9 basename 兜底规则
    const basename = getBasenameWithoutExtension(activeFilename);
    if (basename === "") return [];

    // basename 为中文数字序号（含十一/二十等组合）=> 仅图不显示名
    if (isChineseNumeralBasename(basename)) {
      return [];
    }

    // 其他 basename => 显示 basename（不含扩展名）作为图片名称
    return [basename];
  }, [matchedDish, isChina, detailLocale, activeFilename]);

  const starsText = matchedDish ? formatDishTasteStars(matchedDish.taste) : "";
  const noteText = matchedDish ? getDishNoteText(matchedDish) : "";
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
