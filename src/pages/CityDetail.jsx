import { useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import {
  formatFixedTriple,
  pickByLocale,
  useLanguage,
} from "../context/LanguageContext.jsx";
import { BOOKSHELF_CITY_DISPLAY_BY_SLUG } from "../utils/citySlugs.js";
import {
  isValidCitySlug,
  normalizeCitySlug,
} from "../utils/citySlugs.js";
import MapPanel from "../components/MapPanel.jsx";
import spoonAndForkStickerUrl from "../assets/stickers/page/spoon-and-fork.svg?url";
import locationStickerUrl from "../assets/stickers/page/location.svg?url";
import {
  cityEnFromBookshelfSlug,
  getDishNoteText,
  getDishPriceText,
  getDishesByCity,
} from "../utils/dataLoader.js";

export default function CityDetail() {
  const { citySlug } = useParams();
  const slug = normalizeCitySlug(citySlug);
  const valid = isValidCitySlug(slug);
  const { locale, setLocale, setCitySlug, showEnCnToggle } = useLanguage();
  const [activeSection, setActiveSection] = useState("map");
  const [isSectionMenuOpen, setSectionMenuOpen] = useState(false);
  const sectionMenuRef = useRef(null);

  const cityMeta = valid ? BOOKSHELF_CITY_DISPLAY_BY_SLUG[slug] : null;
  const isKoreanNativeCity = /[\uac00-\ud7a3]/.test(cityMeta?.city_native ?? "");
  const formatNonChinaText = (zhText, nativeText, enText) => {
    const zh = zhText == null ? "" : String(zhText).trim();
    const nativeValue = nativeText == null ? "" : String(nativeText).trim();
    const en = enText == null ? "" : String(enText).trim();
    const nativeEqualsEn =
      nativeValue !== "" && en !== "" && nativeValue.toLowerCase() === en.toLowerCase();
    return nativeEqualsEn
      ? formatFixedTriple(zh, nativeValue, "")
      : formatFixedTriple(zh, nativeValue || en, en);
  };
  const pickUiText = (zhText, enText, nativeText = "") =>
    showEnCnToggle
      ? pickByLocale(locale, zhText, enText)
      : formatNonChinaText(zhText, nativeText, enText);
  const sectionNativeMapText = isKoreanNativeCity ? "지도" : "Map";
  const sectionNativeCuisineText = isKoreanNativeCity ? "요리" : "Cuisine";
  const nativeTopAreaText = isKoreanNativeCity ? "도시 상세 상단 영역" : "City detail top area";
  const nativeLanguageToggleText = isKoreanNativeCity ? "언어 전환" : "Language toggle";
  const nativeOpenMenuText = isKoreanNativeCity
    ? "전환 드롭다운 메뉴 열기"
    : "Open switch dropdown menu";
  const nativeSectionMenuText = isKoreanNativeCity ? "전환 메뉴" : "Switch menu";
  const nativeContentAreaText = isKoreanNativeCity
    ? "도시 상세 콘텐츠 영역"
    : "City detail content area";
  const nativeBookSpreadText = isKoreanNativeCity
    ? "책 펼침 컨테이너"
    : "Open-book spread container";
  const nativeLeftPageText = isKoreanNativeCity ? "왼쪽 페이지 자리" : "Left page placeholder";
  const nativeRightPageText = isKoreanNativeCity ? "오른쪽 페이지 자리" : "Right page placeholder";
  const nativeCuisineLeftPlaceholderText =
    isKoreanNativeCity
      ? "요리 왼쪽 페이지 자리(요리 필터)"
      : "Cuisine left-page placeholder (cuisine filters)";
  const nativeMapRightPlaceholderText =
    isKoreanNativeCity
      ? "지도 오른쪽 페이지 자리(지도 상세)"
      : "Map right-page placeholder (map details)";
  const nativeCuisineRightPlaceholderText =
    isKoreanNativeCity
      ? "요리 오른쪽 페이지 자리(요리 상세)"
      : "Cuisine right-page placeholder (dish details)";

  const sectionOptions = useMemo(
    () => [
      {
        id: "map",
        label: pickUiText("地图", "Map", sectionNativeMapText),
      },
      {
        id: "cuisine",
        label: pickUiText("菜品", "Cuisine", sectionNativeCuisineText),
      },
    ],
    [locale, showEnCnToggle, sectionNativeMapText, sectionNativeCuisineText]
  );
  const cityDisplay = showEnCnToggle
    ? pickByLocale(locale, cityMeta?.city_zh || "城市详情", cityMeta?.city_en || "City Detail")
    : formatNonChinaText(
        cityMeta?.city_zh || "城市详情",
        cityMeta?.city_native || cityMeta?.city_en || "City Detail",
        cityMeta?.city_en || "City Detail"
      );
  const activeSectionLabel =
    sectionOptions.find((option) => option.id === activeSection)?.label ??
    sectionOptions[0].label;
  const cityDishes = useMemo(
    () => getDishesByCity(cityEnFromBookshelfSlug(slug)).slice(0, 8),
    [slug]
  );

  useEffect(() => {
    if (!valid) return;
    document.documentElement.dataset.city = slug;
    return () => {
      delete document.documentElement.dataset.city;
    };
  }, [slug, valid]);

  useEffect(() => {
    if (!valid) {
      setCitySlug(null);
      return;
    }
    setCitySlug(slug);
    return () => {
      setCitySlug(null);
    };
  }, [valid, slug, setCitySlug]);

  useEffect(() => {
    if (!isSectionMenuOpen) return;

    const onPointerDown = (event) => {
      if (!sectionMenuRef.current?.contains(event.target)) {
        setSectionMenuOpen(false);
      }
    };
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        setSectionMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isSectionMenuOpen]);

  const handleSelectSection = (nextSection) => {
    setActiveSection(nextSection);
    setSectionMenuOpen(false);
  };
  const renderSectionIcon = (sectionId) => {
    if (sectionId === "map") {
      return (
        <img
          className="ffj-city-section-current-icon-img"
          src={locationStickerUrl}
          alt=""
          aria-hidden="true"
          draggable={false}
        />
      );
    }

    return (
      <img
        className="ffj-city-section-current-icon-img"
        src={spoonAndForkStickerUrl}
        alt=""
        aria-hidden="true"
        draggable={false}
      />
    );
  };
  const renderSelectedOptionMarker = () => (
    <svg
      className="ffj-city-section-option-marker-svg"
      viewBox="0 0 24 24"
      role="presentation"
      focusable="false"
    >
      <path d="M3.2 2.8L20.5 10L12.6 12.6L10 20.6L3.2 2.8Z" />
    </svg>
  );

  if (!valid) {
    return <Navigate to="/" replace />;
  }

  return (
    <main className="ffj-page-shell ffj-paper-noise ffj-city-detail-page">
      <header
        className="ffj-city-detail-top"
        aria-label={pickUiText("城市详情顶部区", "City detail top area", nativeTopAreaText)}
      >
        <div className="ffj-city-detail-top-row ffj-city-detail-top-row--city">
          <p className="ffj-city-title">{cityDisplay}</p>
          {showEnCnToggle ? (
            <div
              className="ffj-city-locale-toggle"
              aria-label={pickUiText("语言切换", "Language toggle", nativeLanguageToggleText)}
            >
              <button
                type="button"
                className={`ffj-city-locale-btn ${locale === "en" ? "is-active" : ""}`}
                onClick={() => setLocale("en")}
                aria-pressed={locale === "en"}
              >
                EN
              </button>
              <button
                type="button"
                className={`ffj-city-locale-btn ${locale === "zh" ? "is-active" : ""}`}
                onClick={() => setLocale("zh")}
                aria-pressed={locale === "zh"}
              >
                CN
              </button>
            </div>
          ) : (
            <div aria-hidden="true" />
          )}
        </div>

        <div className="ffj-city-detail-top-row ffj-city-detail-top-row--section">
          <div className="ffj-city-section-anchor" ref={sectionMenuRef}>
            <button
              type="button"
              className="ffj-city-section-trigger"
              aria-label={pickUiText(
                "展开切换下拉菜单",
                "Open switch dropdown menu",
                nativeOpenMenuText
              )}
              aria-expanded={isSectionMenuOpen}
              aria-controls="ffj-city-section-menu"
              onClick={() => setSectionMenuOpen((open) => !open)}
            >
              <span
                className={`ffj-city-switch-icon ${
                  isSectionMenuOpen ? "is-open" : ""
                }`}
                aria-hidden="true"
              >
                <svg
                  className="ffj-city-switch-icon-svg"
                  viewBox="0 0 24 24"
                  role="presentation"
                  focusable="false"
                >
                  <path d="M5 7L9 3M5 7H19" />
                  <path d="M19 17L15 21M5 17H19" />
                </svg>
              </span>
            </button>

            <span className="ffj-city-section-current-icon" aria-hidden="true">
              {renderSectionIcon(activeSection)}
            </span>
            <p className="ffj-city-section-current">{activeSectionLabel}</p>

            {isSectionMenuOpen ? (
              <div
                id="ffj-city-section-menu"
                className="ffj-city-section-menu"
                role="menu"
                aria-label={pickUiText(
                  "切换菜单",
                  "Switch menu",
                  nativeSectionMenuText
                )}
              >
                {sectionOptions.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    role="menuitemradio"
                    aria-checked={activeSection === option.id}
                    className={`ffj-city-section-option ${
                      activeSection === option.id ? "is-active" : ""
                    }`}
                    onClick={() => handleSelectSection(option.id)}
                  >
                    <span>{option.label}</span>
                    {activeSection === option.id ? (
                      <span className="ffj-city-section-option-marker" aria-hidden="true">
                        {renderSelectedOptionMarker()}
                      </span>
                    ) : null}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <section
        className="ffj-city-detail-content"
        aria-label={pickUiText("城市详情内容区", "City detail content area", nativeContentAreaText)}
      >
        <div
          className={`ffj-city-book-spread ffj-city-book-spread--map ${
            activeSection === "map" ? "" : "is-hidden"
          }`}
          aria-label={pickUiText("书本双页容器", "Open-book spread container", nativeBookSpreadText)}
          aria-hidden={activeSection !== "map"}
        >
          <article
            className="ffj-city-book-page ffj-city-book-page--left ffj-city-book-page--map"
            aria-label={pickUiText("左页占位", "Left page placeholder", nativeLeftPageText)}
          >
            <MapPanel citySlug={slug} cityLabel={cityDisplay} isVisible={activeSection === "map"} />
          </article>

          <div className="ffj-city-book-gutter" aria-hidden="true" />

          <article
            className="ffj-city-book-page ffj-city-book-page--note"
            aria-label={pickUiText("右页占位", "Right page placeholder", nativeRightPageText)}
          >
            <p className="ffj-body-text">
              {pickUiText(
                "地图右页占位（地图详情区）",
                "Map right-page placeholder (map details)",
                nativeMapRightPlaceholderText
              )}
            </p>
          </article>

          <aside className="ffj-city-book-page ffj-city-book-page--sticker" aria-hidden="true">
            <p className="ffj-body-text">{pickUiText("便签筛选区占位", "Sticker filter placeholder")}</p>
          </aside>
        </div>

        <div
          className={`ffj-city-book-spread ${activeSection === "cuisine" ? "" : "is-hidden"}`}
          aria-label={pickUiText("书本双页容器", "Open-book spread container", nativeBookSpreadText)}
          aria-hidden={activeSection !== "cuisine"}
        >
          <article
            className="ffj-city-book-page ffj-city-book-page--left"
            aria-label={pickUiText("左页占位", "Left page placeholder", nativeLeftPageText)}
          >
            <p className="ffj-body-text">
              {pickUiText(
                "菜品左页占位（菜品筛选区）",
                "Cuisine left-page placeholder (cuisine filters)",
                nativeCuisineLeftPlaceholderText
              )}
            </p>
          </article>

          <div className="ffj-city-book-gutter" aria-hidden="true" />

          <article
            className="ffj-city-book-page ffj-city-book-page--right"
            aria-label={pickUiText("右页占位", "Right page placeholder", nativeRightPageText)}
          >
            {cityDishes.length === 0 ? (
              <p className="ffj-body-text">
                {pickUiText(
                  "菜品右页占位（菜品详情区）",
                  "Cuisine right-page placeholder (dish details)",
                  nativeCuisineRightPlaceholderText
                )}
              </p>
            ) : (
              <div className="ffj-city-dish-preview-list">
                {cityDishes.map((dish, index) => {
                  const dishName = pickUiText(
                    dish.name_zh || "",
                    dish.name_en || dish.name_zh || "",
                    dish.name_local || dish.name_en || dish.name_zh || ""
                  );
                  const priceText = getDishPriceText(dish);
                  const noteText = getDishNoteText(dish);
                  return (
                    <article
                      key={`${dish.store_name_zh}-${dish.name_zh}-${index}`}
                      className="ffj-city-dish-preview-card"
                    >
                      <h3 className="ffj-city-dish-preview-name">{dishName}</h3>
                      {priceText !== "" ? (
                        <p className="ffj-city-dish-preview-price">{priceText}</p>
                      ) : null}
                      {noteText !== "" ? (
                        <p className="ffj-city-dish-preview-note">{noteText}</p>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            )}
          </article>
        </div>
      </section>
    </main>
  );
}
