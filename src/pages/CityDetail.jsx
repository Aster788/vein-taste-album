import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import {
  pickByDetailLocale,
  pickByLocale,
  useLanguage,
} from "../context/LanguageContext.jsx";
import { BOOKSHELF_CITY_DISPLAY_BY_SLUG } from "../utils/citySlugs.js";
import {
  isValidCitySlug,
  normalizeCitySlug,
} from "../utils/citySlugs.js";
import MapPanel from "../components/MapPanel.jsx";
import clickCursorStickerUrl from "../assets/stickers/page/click.svg?url";
import paperAirplaneCursorStickerUrl from "../assets/stickers/page/paper-airplane.svg?url";
import spoonAndForkStickerUrl from "../assets/stickers/page/spoon-and-fork.svg?url";
import locationStickerUrl from "../assets/stickers/page/location.svg?url";
import cuisineAllStickerUrl from "../assets/stickers/cuisine/all.svg?url";
import cuisineBakeryStickerUrl from "../assets/stickers/cuisine/bakery.svg?url";
import cuisineChineseStickerUrl from "../assets/stickers/cuisine/chinese.svg?url";
import cuisineDessertStickerUrl from "../assets/stickers/cuisine/dessert.svg?url";
import cuisineDrinksStickerUrl from "../assets/stickers/cuisine/drinks.svg?url";
import cuisineJapaneseStickerUrl from "../assets/stickers/cuisine/japanese.svg?url";
import cuisineKoreanStickerUrl from "../assets/stickers/cuisine/korean.svg?url";
import cuisineOtherStickerUrl from "../assets/stickers/cuisine/other.svg?url";
import cuisineSoutheastAsianStickerUrl from "../assets/stickers/cuisine/southeast-asian.svg?url";
import cuisineSteakStickerUrl from "../assets/stickers/cuisine/steak.svg?url";
import {
  cityEnFromBookshelfSlug,
  getDishNoteText,
  getDishPriceText,
  getDishesByCity,
  getRestaurantsByCity,
  getMappableRestaurantsByCity,
} from "../utils/dataLoader.js";
import NotePanel from "../components/NotePanel.jsx";

const CUISINE_STICKER_RULES = [
  { test: /(中餐|中式|川菜|粤菜|湘菜|鲁菜|东北|火锅|chinese|china)/i, sticker: cuisineChineseStickerUrl },
  { test: /(日料|寿司|烧鸟|拉面|japanese|japan)/i, sticker: cuisineJapaneseStickerUrl },
  { test: /(韩餐|韩式|korean|korea)/i, sticker: cuisineKoreanStickerUrl },
  { test: /(东南亚|泰餐|越南|马来|印尼|southeast|thai|vietnam|malay)/i, sticker: cuisineSoutheastAsianStickerUrl },
  { test: /(饮品|咖啡|奶茶|酒吧|鸡尾酒|茶饮|drinks|drink|coffee|tea|bar)/i, sticker: cuisineDrinksStickerUrl },
  { test: /(甜品|冰淇淋|蛋糕|dessert|gelato|ice cream)/i, sticker: cuisineDessertStickerUrl },
  { test: /(烘焙|面包|吐司|披萨|bakery|bread|toast|pastry)/i, sticker: cuisineBakeryStickerUrl },
  { test: /(牛排|steak)/i, sticker: cuisineSteakStickerUrl },
];

function pickCuisineSticker(cuisine) {
  const text = String(cuisine ?? "").trim();
  if (text === "") return cuisineOtherStickerUrl;
  const matched = CUISINE_STICKER_RULES.find((rule) => rule.test.test(text));
  return matched?.sticker ?? cuisineOtherStickerUrl;
}

export default function CityDetail() {
  const { citySlug } = useParams();
  const slug = normalizeCitySlug(citySlug);
  const valid = isValidCitySlug(slug);
  const {
    detailLocale,
    setDetailLocale,
    setCitySlug,
    localeConfig,
    showDetailLocaleToggle,
  } = useLanguage();
  const [activeSection, setActiveSection] = useState("map");
  const [isSectionMenuOpen, setSectionMenuOpen] = useState(false);
  const [selectedStore, setSelectedStore] = useState(null);
  const [activeCuisine, setActiveCuisine] = useState("");
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [mapCursorUi, setMapCursorUi] = useState({
    visible: false,
    isInteractive: false,
  });
  const sectionMenuRef = useRef(null);
  const mapCursorRef = useRef(null);
  const cursorPosRef = useRef({ x: 0, y: 0 });
  const cursorRafRef = useRef(0);

  const cityMeta = valid ? BOOKSHELF_CITY_DISPLAY_BY_SLUG[slug] : null;
  const nativeIso = String(localeConfig.nativeIso639_1 ?? "").trim().toLowerCase();
  const nativeLocaleButtonLabel =
    String(localeConfig.nativeButtonLabel ?? "").trim().toUpperCase() ||
    nativeIso.toUpperCase();
  const sectionNativeMapText = nativeIso === "ko" ? "지도" : "Map";
  const sectionNativeCuisineText = nativeIso === "ko" ? "요리" : "Cuisine";
  const nativeTopAreaText = nativeIso === "ko" ? "도시 상세 상단 영역" : "City detail top area";
  const nativeLanguageToggleText = nativeIso === "ko" ? "언어 전환" : "Language toggle";
  const nativeOpenMenuText =
    nativeIso === "ko" ? "전환 드롭다운 메뉴 열기" : "Open switch dropdown menu";
  const nativeSectionMenuText = nativeIso === "ko" ? "전환 메뉴" : "Switch menu";
  const nativeContentAreaText =
    nativeIso === "ko" ? "도시 상세 콘텐츠 영역" : "City detail content area";
  const nativeBookSpreadText = nativeIso === "ko" ? "책 펼침 컨테이너" : "Open-book spread container";
  const nativeLeftPageText = nativeIso === "ko" ? "왼쪽 페이지 자리" : "Left page placeholder";
  const nativeRightPageText = nativeIso === "ko" ? "오른쪽 페이지 자리" : "Right page placeholder";
  const nativeCuisineLeftPlaceholderText =
    nativeIso === "ko"
      ? "요리 왼쪽 페이지 자리(요리 필터)"
      : "Cuisine left-page placeholder (cuisine filters)";
  const nativeCuisineRightPlaceholderText =
    nativeIso === "ko"
      ? "요리 오른쪽 페이지 자리(요리 상세)"
      : "Cuisine right-page placeholder (dish details)";
  const nativeNoteGuideText =
    nativeIso === "ko" ? "지도에서 가게를 하나 눌러보세요" : "Tap a store on the map to begin";
  const pickUiText = (zhText, enText, nativeText = "") =>
    localeConfig.isChina
      ? pickByLocale(detailLocale, zhText, enText)
      : pickByDetailLocale(
          detailLocale,
          zhText,
          enText,
          nativeText,
          localeConfig.nativeIso639_1,
        );

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
    [detailLocale, localeConfig.isChina, sectionNativeMapText, sectionNativeCuisineText]
  );
  const cityDisplay = localeConfig.isChina
    ? pickByLocale(detailLocale, cityMeta?.city_zh || "城市详情", cityMeta?.city_en || "City Detail")
    : pickByDetailLocale(
        detailLocale,
        cityMeta?.city_zh || "城市详情",
        cityMeta?.city_en || "City Detail",
        cityMeta?.city_native || "",
        localeConfig.nativeIso639_1,
      );
  const activeSectionLabel =
    sectionOptions.find((option) => option.id === activeSection)?.label ??
    sectionOptions[0].label;
  const cityDishes = useMemo(
    () => getDishesByCity(cityEnFromBookshelfSlug(slug)).slice(0, 8),
    [slug]
  );
  const cuisineFilters = useMemo(() => {
    const cityEn = cityEnFromBookshelfSlug(slug);
    if (!cityEn) return [];
    const unique = new Set();
    getMappableRestaurantsByCity(cityEn).forEach((row) => {
      const cuisine = String(row?.cuisine ?? "").trim();
      if (cuisine !== "") unique.add(cuisine);
    });
    return Array.from(unique);
  }, [slug]);
  const cuisineStores = useMemo(() => {
    const cityEn = cityEnFromBookshelfSlug(slug);
    if (!cityEn) return [];
    return getRestaurantsByCity(cityEn).filter((row) => {
      if (String(row?.record_scope ?? "").trim().toLowerCase() === "brand") {
        return false;
      }
      if (activeCuisine === "") return true;
      return String(row?.cuisine ?? "").trim() === activeCuisine;
    });
  }, [slug, activeCuisine]);
  const cuisineFilterItems = useMemo(() => {
    const cityEn = cityEnFromBookshelfSlug(slug);
    if (!cityEn) return [];
    const counters = new Map();
    const branchStores = getRestaurantsByCity(cityEn).filter(
      (row) => String(row?.record_scope ?? "").trim().toLowerCase() !== "brand",
    );
    branchStores.forEach((row) => {
      const cuisine = String(row?.cuisine ?? "").trim();
      if (cuisine === "") return;
      counters.set(cuisine, (counters.get(cuisine) ?? 0) + 1);
    });

    const dynamicItems = Array.from(counters.entries()).map(([cuisine, count]) => ({
      key: cuisine,
      cuisine,
      count,
      stickerUrl: pickCuisineSticker(cuisine),
    }));

    dynamicItems.sort((left, right) =>
      left.cuisine.localeCompare(right.cuisine, "zh-Hans-CN"),
    );

    return [
      {
        key: "__all__",
        cuisine: "",
        count: branchStores.length,
        stickerUrl: cuisineAllStickerUrl,
      },
      ...dynamicItems,
    ];
  }, [slug]);

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

  useEffect(() => {
    setSelectedStore(null);
    setActiveCuisine("");
    setActivePhotoIndex(0);
  }, [slug]);

  useEffect(() => {
    if (activeSection !== "cuisine") return;
    if (cuisineStores.length === 0) {
      setSelectedStore(null);
      setActivePhotoIndex(0);
      return;
    }
    const hasCurrent = cuisineStores.some((row) => row === selectedStore);
    if (!hasCurrent) {
      setSelectedStore(cuisineStores[0]);
      setActivePhotoIndex(0);
    }
  }, [activeSection, cuisineStores, selectedStore]);

  useEffect(() => {
    setActivePhotoIndex(0);
  }, [selectedStore]);

  useEffect(() => {
    if (!selectedStore) return;
    if (activeCuisine === "") return;
    const selectedStoreCuisine = String(selectedStore?.cuisine ?? "").trim();
    if (selectedStoreCuisine !== activeCuisine) {
      setSelectedStore(null);
    }
  }, [activeCuisine, selectedStore]);

  useEffect(() => {
    return () => {
      if (cursorRafRef.current !== 0) {
        cancelAnimationFrame(cursorRafRef.current);
      }
    };
  }, []);

  const flushCursorPosition = useCallback(() => {
    cursorRafRef.current = 0;
    const cursorNode = mapCursorRef.current;
    if (!cursorNode) return;
    cursorNode.style.left = `${cursorPosRef.current.x}px`;
    cursorNode.style.top = `${cursorPosRef.current.y}px`;
  }, []);

  const queueCursorPosition = useCallback(() => {
    if (cursorRafRef.current !== 0) return;
    cursorRafRef.current = requestAnimationFrame(flushCursorPosition);
  }, [flushCursorPosition]);

  const handleMapInteractiveHoverChange = useCallback((isInteractive) => {
    setMapCursorUi((current) =>
      current.isInteractive === isInteractive
        ? current
        : { ...current, isInteractive },
    );
  }, []);

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
          {showDetailLocaleToggle ? (
            <div
              className="ffj-city-locale-toggle"
              aria-label={pickUiText("语言切换", "Language toggle", nativeLanguageToggleText)}
            >
              <button
                type="button"
                className={`ffj-city-locale-btn ${detailLocale === "en" ? "is-active" : ""}`}
                onClick={() => setDetailLocale("en")}
                aria-pressed={detailLocale === "en"}
              >
                EN
              </button>
              {!localeConfig.isChina && localeConfig.mode === "en_native_zh" ? (
                <button
                  type="button"
                  className={`ffj-city-locale-btn ${
                    detailLocale === "native" ? "is-active" : ""
                  }`}
                  onClick={() => setDetailLocale("native")}
                  aria-pressed={detailLocale === "native"}
                >
                  {nativeLocaleButtonLabel || "NATIVE"}
                </button>
              ) : null}
              <button
                type="button"
                className={`ffj-city-locale-btn ${detailLocale === "zh" ? "is-active" : ""}`}
                onClick={() => setDetailLocale("zh")}
                aria-pressed={detailLocale === "zh"}
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
          onMouseEnter={() =>
            setMapCursorUi((current) =>
              current.visible ? current : { ...current, visible: true },
            )
          }
          onMouseMove={(event) => {
            const rect = event.currentTarget.getBoundingClientRect();
            cursorPosRef.current.x = event.clientX - rect.left;
            cursorPosRef.current.y = event.clientY - rect.top;
            queueCursorPosition();
          }}
          onMouseLeave={() =>
            setMapCursorUi((current) => ({
              ...current,
              visible: false,
              isInteractive: false,
            }))
          }
        >
          <article
            className="ffj-city-book-page ffj-city-book-page--left ffj-city-book-page--map"
            aria-label={pickUiText("左页占位", "Left page placeholder", nativeLeftPageText)}
          >
            <MapPanel
              citySlug={slug}
              cityLabel={cityDisplay}
              isVisible={activeSection === "map"}
              activeCuisine={activeCuisine}
              onSelectStore={setSelectedStore}
              onInteractiveHoverChange={handleMapInteractiveHoverChange}
            />
          </article>

          <div className="ffj-city-book-gutter" aria-hidden="true" />

          <article
            className="ffj-city-book-page ffj-city-book-page--note"
            aria-label={pickUiText("右页占位", "Right page placeholder", nativeRightPageText)}
          >
            <NotePanel
              guideText={pickUiText(
                "点击地图上的任意\n一家店试试看",
                "Click any store on the map to begin",
                nativeNoteGuideText
              )}
              selectedStore={selectedStore}
              onInteractiveHoverChange={handleMapInteractiveHoverChange}
              labels={{
                cuisine: pickUiText("菜系类型", "Cuisine"),
                scoreOverall: pickUiText("综合评分", "Overall score"),
                pricePerPerson: pickUiText("人均消费", "Average spend"),
                hours: pickUiText("营业时间", "Business hours"),
                phone: pickUiText("联系电话", "Phone"),
                radar: pickUiText("评分雷达图", "Score radar"),
                radarNoData: pickUiText("暂无雷达图数据", "No radar data yet"),
                radarTaste: pickUiText("口味", "Taste"),
                radarEnvironment: pickUiText("环境", "Environment"),
                radarQueue: pickUiText("排队友好度", "Queue friendliness"),
                radarService: pickUiText("服务", "Service"),
                radarPackaging: pickUiText("包装", "Packaging"),
                radarDelivery: pickUiText("配送", "Delivery"),
                radarPersonal: pickUiText("个人推荐值", "Personal recommendation"),
                mapOpen: pickUiText("新标签页打开地图", "Open map in new tab"),
                mapUnavailable: pickUiText("暂无地图链接", "Map link unavailable"),
              }}
            />
          </article>

          <aside
            className="ffj-city-book-page ffj-city-book-page--sticker"
            aria-label={pickUiText("菜系筛选", "Cuisine filters", nativeCuisineLeftPlaceholderText)}
          >
            <div className={`ffj-cuisine-filter-stack ${activeCuisine !== "" ? "is-filtering" : ""}`}>
              {cuisineFilters.map((cuisine) => {
                const isActive = activeCuisine === cuisine;
                return (
                  <button
                    key={cuisine}
                    type="button"
                    className={`ffj-cuisine-filter-btn ${isActive ? "is-active" : ""}`}
                    onClick={() => {
                      setActiveCuisine((current) => (current === cuisine ? "" : cuisine));
                    }}
                    onMouseEnter={() => handleMapInteractiveHoverChange(true)}
                    onMouseLeave={() => handleMapInteractiveHoverChange(false)}
                    aria-pressed={isActive}
                  >
                    {cuisine}
                  </button>
                );
              })}
            </div>
          </aside>
          {mapCursorUi.visible ? (
            <span
              ref={mapCursorRef}
              className="ffj-map-cursor"
              aria-hidden="true"
              style={{
                "--ffj-map-cursor-mask": `url("${
                  mapCursorUi.isInteractive
                    ? clickCursorStickerUrl
                    : paperAirplaneCursorStickerUrl
                }")`,
              }}
            />
          ) : null}
        </div>

        <div
          className={`ffj-city-book-spread ffj-city-book-spread--cuisine ${
            activeSection === "cuisine" ? "" : "is-hidden"
          }`}
          aria-label={pickUiText("书本双页容器", "Open-book spread container", nativeBookSpreadText)}
          aria-hidden={activeSection !== "cuisine"}
        >
          <article
            className="ffj-city-book-page ffj-city-book-page--left"
            aria-label={pickUiText("左页占位", "Left page placeholder", nativeLeftPageText)}
          >
            <div
              className={`ffj-cuisine-filter-stack ffj-cuisine-filter-stack--cuisine-page ${
                activeCuisine !== "" ? "is-filtering" : ""
              }`}
            >
              {cuisineFilterItems.map((item) => {
                const isAll = item.cuisine === "";
                const isActive = isAll ? activeCuisine === "" : activeCuisine === item.cuisine;
                const label = isAll ? pickUiText("全部", "All") : item.cuisine;
                return (
                  <button
                    key={item.key}
                    type="button"
                    className={`ffj-cuisine-filter-btn ffj-cuisine-filter-btn--with-meta ${
                      isActive ? "is-active" : ""
                    }`}
                    onClick={() => {
                      if (isAll) {
                        setActiveCuisine("");
                        return;
                      }
                      setActiveCuisine((current) => (current === item.cuisine ? "" : item.cuisine));
                    }}
                    aria-pressed={isActive}
                  >
                    <span className="ffj-cuisine-filter-btn-main">
                      <img
                        className="ffj-cuisine-filter-sticker"
                        src={item.stickerUrl}
                        alt=""
                        aria-hidden="true"
                        draggable={false}
                      />
                      <span className="ffj-cuisine-filter-label">{label}</span>
                    </span>
                    <span className="ffj-cuisine-filter-count">{item.count}</span>
                  </button>
                );
              })}
            </div>
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
                  const dishName = localeConfig.isChina
                    ? pickByLocale(
                        detailLocale,
                        dish.dish_name_zh || "",
                        dish.dish_name_en || dish.dish_name_zh || "",
                        { allowMachineTranslate: false },
                      )
                    : [dish.dish_name_zh, dish.dish_name_en, dish.dish_name_local]
                        .map((value) => String(value ?? "").trim())
                        .filter((value) => value !== "")
                        .join("\n");
                  const priceText = getDishPriceText(dish);
                  const noteText = getDishNoteText(dish);
                  return (
                    <article
                      key={`${dish.city_en}-${dish.store_slug ?? "store"}-${
                        dish.dish_name_zh ?? ""
                      }-${dish.dish_name_en ?? ""}-${dish.dish_name_local ?? ""}-${index}`}
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
