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
  const nativeSectionPrefixText = isKoreanNativeCity ? "전환" : "Switch";
  const nativeSectionMenuText = isKoreanNativeCity ? "전환 메뉴" : "Switch menu";
  const nativeContentAreaText = isKoreanNativeCity
    ? "도시 상세 콘텐츠 영역"
    : "City detail content area";
  const nativeBookSpreadText = isKoreanNativeCity
    ? "책 펼침 컨테이너"
    : "Open-book spread container";
  const nativeLeftPageText = isKoreanNativeCity ? "왼쪽 페이지 자리" : "Left page placeholder";
  const nativeRightPageText = isKoreanNativeCity ? "오른쪽 페이지 자리" : "Right page placeholder";
  const nativeMapLeftPlaceholderText =
    isKoreanNativeCity
      ? "지도 왼쪽 페이지 자리(지도 영역)"
      : "Map left-page placeholder (map area)";
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
                className={`ffj-city-section-caret ${
                  isSectionMenuOpen ? "is-open" : ""
                }`}
                aria-hidden="true"
              />
              <span className="ffj-city-section-prefix">
                {pickUiText("切换", "Switch", nativeSectionPrefixText)}
              </span>
            </button>

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
                    {option.label}
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
          className="ffj-city-book-spread"
          aria-label={pickUiText("书本双页容器", "Open-book spread container", nativeBookSpreadText)}
        >
          <article
            className="ffj-city-book-page ffj-city-book-page--left"
            aria-label={pickUiText("左页占位", "Left page placeholder", nativeLeftPageText)}
          >
            {activeSection === "map" ? (
              <p className="ffj-body-text">
                {pickUiText(
                  "地图左页占位（地图区）",
                  "Map left-page placeholder (map area)",
                  nativeMapLeftPlaceholderText
                )}
              </p>
            ) : (
              <p className="ffj-body-text">
                {pickUiText(
                  "菜品左页占位（菜品筛选区）",
                  "Cuisine left-page placeholder (cuisine filters)",
                  nativeCuisineLeftPlaceholderText
                )}
              </p>
            )}
          </article>

          <div className="ffj-city-book-gutter" aria-hidden="true" />

          <article
            className="ffj-city-book-page ffj-city-book-page--right"
            aria-label={pickUiText("右页占位", "Right page placeholder", nativeRightPageText)}
          >
            {activeSection === "map" ? (
              <p className="ffj-body-text">
                {pickUiText(
                  "地图右页占位（地图详情区）",
                  "Map right-page placeholder (map details)",
                  nativeMapRightPlaceholderText
                )}
              </p>
            ) : (
              <p className="ffj-body-text">
                {pickUiText(
                  "菜品右页占位（菜品详情区）",
                  "Cuisine right-page placeholder (dish details)",
                  nativeCuisineRightPlaceholderText
                )}
              </p>
            )}
          </article>
        </div>
      </section>
    </main>
  );
}
