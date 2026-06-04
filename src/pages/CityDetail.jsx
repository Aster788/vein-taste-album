import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Navigate, useParams } from "react-router-dom";
import BookshelfBackButton from "../components/BookshelfBackButton.jsx";
import {
  pickByDetailLocale,
  pickByLocale,
  useLanguage,
} from "../context/LanguageContext.jsx";
import {
  BOOKSHELF_CITY_DISPLAY_BY_SLUG,
  getCityDetailTitles,
  isValidCitySlug,
  normalizeCitySlug,
} from "../utils/citySlugs.js";
import "../styles/fonts-muyao.css";

const MapPanel = lazy(() => import("../components/MapPanel.jsx"));
import clickCursorStickerUrl from "../assets/stickers/page/click.svg?url";
import paperAirplaneCursorStickerUrl from "../assets/stickers/page/paper-airplane.svg?url";
import spoonAndForkStickerUrl from "../assets/stickers/page/spoon-and-fork.svg?url";
import locationStickerUrl from "../assets/stickers/page/location.svg?url";
import thumbsUpStickerUrl from "../assets/stickers/page/thumbs-up.svg?url";
import thumbsDownStickerUrl from "../assets/stickers/page/thumbs-down.svg?url";
import {
  cityEnFromBookshelfSlug,
  getMappableRestaurantsByCity,
} from "../utils/dataLoader.js";
import {
  getCuisineLabelsByEn,
  getRestaurantCuisineEn,
  getRestaurantCuisineZh,
  resolveCuisineStickerHref,
} from "../utils/cuisineSlugs.js";
import {
  getCuisineAddressBlock,
  getCuisineDisplayNameLines,
  getCuisineGroupRepresentativeBranch,
  getCuisineGroupSortKey,
  getCuisineStoreGroupsByCity,
  getStoreRecommend,
} from "../utils/storeGroups.js";
import { comparePinyinWithNumericRule, normalizeSortText } from "../utils/sortText.js";
import DishInfo from "../components/DishInfo.jsx";
import NotePanel from "../components/NotePanel.jsx";
import PhotoPanel from "../components/PhotoPanel.jsx";
import { getPhotoNetworkProfile } from "../utils/photoNetworkProfile.js";
import { isSafariWebKit } from "../utils/browserPlatform.js";
import { bumpPhotoPreloadSession, preloadStoreThumbs } from "../utils/preloadImage.js";
import { getSortedStorePhotos } from "../utils/storePhotos.js";

function splitCuisineLabelLines(label, detailLocale) {
  const text = String(label ?? "").trim();
  if (text === "") return [];
  const script = detectLabelScript(text, detailLocale);
  const maxUnits = MAX_INLINE_UNITS_BY_SCRIPT[script];
  if (measureLabelUnits(text, script) <= maxUnits) return [text];
  return splitLabelByUnits(text, script, maxUnits);
}

const MAX_INLINE_UNITS_BY_SCRIPT = Object.freeze({
  zh: 4,
  en: 12,
  ja: 4.5,
  ko: 5.5,
  th: 6.2,
});

function detectLabelScript(text, detailLocale) {
  if (/[\u0E00-\u0E7F]/u.test(text)) return "th";
  if (/[\u1100-\u11FF\u3130-\u318F\uAC00-\uD7AF]/u.test(text)) return "ko";
  if (/[\u3040-\u30FF\u31F0-\u31FF\uFF66-\uFF9D]/u.test(text)) return "ja";
  if (/[A-Za-z]/u.test(text)) return "en";
  if (detailLocale === "en") return "en";
  return "zh";
}

function measureLabelUnits(text, script) {
  if (script === "en") {
    let sum = 0;
    for (const char of text) {
      if (char === " ") {
        sum += 0.35;
      } else {
        sum += 1;
      }
    }
    return sum;
  }
  return Array.from(text).length;
}

function splitLabelByUnits(text, script, maxUnits) {
  if (script === "en") {
    const words = text.split(/\s+/).filter(Boolean);
    if (words.length <= 1) return [text];
    const lines = [];
    let current = "";
    words.forEach((word) => {
      const candidate = current === "" ? word : `${current} ${word}`;
      if (measureLabelUnits(candidate, script) <= maxUnits || current === "") {
        current = candidate;
      } else {
        lines.push(current);
        current = word;
      }
    });
    if (current !== "") lines.push(current);
    return lines;
  }

  const hardLimit = Math.max(1, Math.floor(maxUnits));
  const chars = Array.from(text);
  const lines = [];
  for (let start = 0; start < chars.length; start += hardLimit) {
    lines.push(chars.slice(start, start + hardLimit).join(""));
  }
  return lines;
}

function useDismissOnOutsideAndEscape(open, ref, onClose) {
  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event) => {
      if (!ref.current?.contains(event.target)) {
        onClose();
      }
    };
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, ref, onClose]);
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
  const [isCuisineMenuOpen, setCuisineMenuOpen] = useState(false);
  const [isCuisineMenuScrollable, setCuisineMenuScrollable] = useState(false);
  const [cuisineMenuMaxHeight, setCuisineMenuMaxHeight] = useState(null);
  const [isCuisineSortHintOpen, setCuisineSortHintOpen] = useState(false);
  const [selectedStore, setSelectedStore] = useState(null);
  const [selectedCuisineGroup, setSelectedCuisineGroup] = useState(null);
  const storeListRef = useRef(null);
  const [activeCuisine, setActiveCuisine] = useState("");
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [displayPhotoIndex, setDisplayPhotoIndex] = useState(0);
  const [displayedCuisineStore, setDisplayedCuisineStore] = useState(null);
  const [mapCursorUi, setMapCursorUi] = useState({
    visible: false,
    isInteractive: false,
  });
  const sectionMenuRef = useRef(null);
  const cuisineMenuRef = useRef(null);
  const cuisineStorePanelRef = useRef(null);
  const cuisineDropdownMenuRef = useRef(null);
  const cuisineSortHintRef = useRef(null);
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
  const nativeNoteGuideText =
    nativeIso === "ko" ? "지도에서 가게를 하나 눌러보세요" : "Tap a store on the map to begin";
  const nativeCuisineLabelText = nativeIso === "ko" ? "요리 유형" : "Cuisine";
  const nativeScoreOverallText = nativeIso === "ko" ? "종합 평점" : "Overall score";
  const nativePricePerPersonText = nativeIso === "ko" ? "1인 평균 지출" : "Average spend";
  const nativeBusinessHoursText = nativeIso === "ko" ? "영업시간" : "Business hours";
  const nativePhoneText = nativeIso === "ko" ? "전화번호" : "Phone";
  const nativeRadarTitleText = nativeIso === "ko" ? "평점 레이더 차트" : "Score radar";
  const nativeRadarNoDataText = nativeIso === "ko" ? "레이더 차트 데이터가 없습니다" : "No radar data yet";
  const nativeRadarTasteText = nativeIso === "ko" ? "맛" : "Taste";
  const nativeRadarEnvironmentText = nativeIso === "ko" ? "분위기" : "Environment";
  const nativeRadarQueueText = nativeIso === "ko" ? "대기 친화도" : "Queue friendliness";
  const nativeRadarServiceText = nativeIso === "ko" ? "서비스" : "Service";
  const nativeRadarPackagingText = nativeIso === "ko" ? "포장" : "Packaging";
  const nativeRadarDeliveryText = nativeIso === "ko" ? "배달" : "Delivery";
  const nativeRadarPersonalText = nativeIso === "ko" ? "개인 추천도" : "Personal recommendation";
  const nativeMapOpenText = nativeIso === "ko" ? "새 탭에서 지도 열기" : "Open map in new tab";
  const nativeMapUnavailableText = nativeIso === "ko" ? "지도 링크가 없습니다" : "Map link unavailable";
  const nativeAllText = nativeIso === "ko" ? "전체" : "All";
  const nativeCuisineFilterText = nativeIso === "ko" ? "요리 필터" : "Cuisine filter";
  const nativeStorePlaylistText = nativeIso === "ko" ? "가게 플레이리스트" : "Store playlist";
  const nativeNoStoreText = nativeIso === "ko" ? "더 찾아볼게요!" : "More to explore!";
  const nativeNoPhotoText = nativeIso === "ko" ? "등록된 사진이 없습니다" : "No photos yet";
  const nativePhotoRegionText = nativeIso === "ko" ? "사진 영역" : "Photo area";
  const nativePhotoPaginationText = nativeIso === "ko" ? "사진 페이지네이션" : "Photo pagination";
  const nativePrevPhotoText = nativeIso === "ko" ? "이전 사진" : "Previous photo";
  const nativeNextPhotoText = nativeIso === "ko" ? "다음 사진" : "Next photo";
  const nativeGotoPhotoText = nativeIso === "ko" ? "사진으로 이동" : "Go to photo";
  const nativeExpandPhotoText = nativeIso === "ko" ? "클릭하여 확대" : "Click to enlarge";
  const nativeCloseLightboxText =
    nativeIso === "ko" ? "확대 보기 닫기 (클릭 또는 Esc)" : "Close enlarged view (click or Esc)";
  const nativeDishInfoRegionText = nativeIso === "ko" ? "요리 정보" : "Dish details";
  const nativeTasteStarsText = nativeIso === "ko" ? "맛 별점" : "Taste";
  const nativeCuisineSortInfoText = nativeIso === "ko" ? "요리 정렬 규칙 안내" : "Cuisine sort rules";
  const nativeBackToBookshelfText =
    nativeIso === "ko" ? "책장으로 돌아가기" : "Back to bookshelf";
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
  const pickCuisineLabel = (cuisineEn, cuisineZh = "") => {
    const slug = String(cuisineEn ?? "").trim();
    if (slug === "") return "";
    const mapped = getCuisineLabelsByEn(slug);
    const zhLabel = String(cuisineZh ?? "").trim() || mapped.zh;
    const en = mapped.en ?? "";
    const native = nativeIso === "ko" ? mapped.ko ?? "" : "";
    const label = pickUiText(zhLabel, en, native);
    return detailLocale === "en" ? label.toLowerCase() : label;
  };

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
  const cityTitleByLocale = useMemo(() => getCityDetailTitles(cityMeta), [cityMeta]);
  const cityDisplay = localeConfig.isChina
    ? pickByLocale(detailLocale, cityTitleByLocale.zh, cityTitleByLocale.en)
    : pickByDetailLocale(
        detailLocale,
        cityTitleByLocale.zh,
        cityTitleByLocale.en,
        cityTitleByLocale.native,
        localeConfig.nativeIso639_1,
      );
  const activeSectionLabel =
    sectionOptions.find((option) => option.id === activeSection)?.label ??
    sectionOptions[0].label;
  const cuisineFilters = useMemo(() => {
    const cityEn = cityEnFromBookshelfSlug(slug);
    if (!cityEn) return [];
    const unique = new Map();
    getMappableRestaurantsByCity(cityEn).forEach((row) => {
      const cuisineEn = getRestaurantCuisineEn(row);
      if (cuisineEn === "") return;
      if (!unique.has(cuisineEn)) {
        unique.set(cuisineEn, getRestaurantCuisineZh(row));
      }
    });

    return Array.from(unique.entries())
      .map(([cuisineEn, cuisineZh], index) => ({
        cuisineEn,
        cuisineZh,
        sortKey: normalizeSortText(cuisineZh || getCuisineLabelsByEn(cuisineEn).zh),
        index,
      }))
      .sort((left, right) => {
        const byPinyin = comparePinyinWithNumericRule(left.sortKey, right.sortKey);
        if (byPinyin !== 0) return byPinyin;
        return left.index - right.index;
      })
      .map((item) => item.cuisineEn);
  }, [slug]);
  const cuisineStoreGroups = useMemo(() => {
    // Multi-branch grouping: universal (city_en + store_slug), see src/utils/storeGroups.js
    const cityEn = cityEnFromBookshelfSlug(slug);
    if (!cityEn) return [];
    const filtered = getCuisineStoreGroupsByCity(cityEn).filter((group) => {
      if (activeCuisine === "") return true;
      return group.branches.some(
        (row) => getRestaurantCuisineEn(row) === activeCuisine,
      );
    });

    return filtered
      .map((group, index) => {
        const lines = getCuisineDisplayNameLines(group);
        const zhKey = normalizeSortText(lines[0] ?? "");
        const enKey = normalizeSortText(lines[1] ?? "");
        const localKey = normalizeSortText(lines[2] ?? "");
        const primaryKey = zhKey || getCuisineGroupSortKey(group) || enKey || localKey;
        return { group, index, primaryKey, enKey, localKey };
      })
      .sort((left, right) => {
        const leftHasKey = left.primaryKey !== "";
        const rightHasKey = right.primaryKey !== "";
        if (leftHasKey !== rightHasKey) return leftHasKey ? -1 : 1;

        const byPrimary = comparePinyinWithNumericRule(left.primaryKey, right.primaryKey);
        if (byPrimary !== 0) return byPrimary;

        const byEn = comparePinyinWithNumericRule(left.enKey, right.enKey);
        if (byEn !== 0) return byEn;

        const byLocal = comparePinyinWithNumericRule(left.localKey, right.localKey);
        if (byLocal !== 0) return byLocal;

        return left.index - right.index;
      })
      .map((entry) => entry.group);
  }, [slug, activeCuisine]);
  const cuisineFilterItems = useMemo(() => {
    const cityEn = cityEnFromBookshelfSlug(slug);
    if (!cityEn) return [];
    const counters = new Map();
    const allCuisineGroups = getCuisineStoreGroupsByCity(cityEn);
    allCuisineGroups.forEach((group) => {
      const cuisineEns = new Set(
        group.branches
          .map((row) => getRestaurantCuisineEn(row))
          .filter((value) => value !== ""),
      );
      cuisineEns.forEach((cuisineEn) => {
        const existing = counters.get(cuisineEn);
        if (!existing) {
          counters.set(cuisineEn, {
            count: 1,
            cuisineZh: getRestaurantCuisineZh(
              group.branches.find((row) => getRestaurantCuisineEn(row) === cuisineEn) ??
                group.branches[0],
            ),
          });
          return;
        }
        existing.count += 1;
      });
    });

    const dynamicItems = Array.from(counters.entries())
      .map(([cuisineEn, meta], index) => ({
        key: cuisineEn,
        cuisine: cuisineEn,
        cuisineZh: meta.cuisineZh,
        count: meta.count,
        stickerUrl: resolveCuisineStickerHref(cuisineEn),
        sortKey: normalizeSortText(meta.cuisineZh || getCuisineLabelsByEn(cuisineEn).zh),
        index,
      }))
      .sort((left, right) => {
        if (right.count !== left.count) return right.count - left.count;

        const byPinyin = comparePinyinWithNumericRule(left.sortKey, right.sortKey);
        if (byPinyin !== 0) return byPinyin;

        return left.index - right.index;
      })
      .map(({ sortKey: _sortKey, index: _index, ...item }) => item);

    return [
      {
        key: "__all__",
        cuisine: "",
        count: allCuisineGroups.length,
        stickerUrl: resolveCuisineStickerHref("all"),
      },
      ...dynamicItems,
    ];
  }, [slug]);
  const activeCuisineLabel = useMemo(() => {
    if (activeCuisine === "") {
      return pickUiText("全部", "All", nativeAllText);
    }
    const meta = cuisineFilterItems.find((item) => item.cuisine === activeCuisine);
    return pickCuisineLabel(activeCuisine, meta?.cuisineZh ?? "");
  }, [activeCuisine, cuisineFilterItems, detailLocale, localeConfig.isChina, nativeAllText]);
  const isCuisineFilterNoMatch = activeCuisine !== "" && cuisineStoreGroups.length === 0;
  const selectedCuisineStore = useMemo(
    () =>
      selectedCuisineGroup
        ? getCuisineGroupRepresentativeBranch(selectedCuisineGroup)
        : null,
    [selectedCuisineGroup],
  );
  const selectedStoreAddress = selectedCuisineGroup
    ? getCuisineAddressBlock(selectedCuisineGroup)
    : "";

  const prefetchStoreLeadPhotos = useCallback(
    (group, { urgent = false, allThumbs = false } = {}) => {
      const store = getCuisineGroupRepresentativeBranch(group);
      const photos = getSortedStorePhotos(slug, store);
      const { leadPhotoCount } = getPhotoNetworkProfile();
      const count = isSafariWebKit()
        ? Math.min(photos.length, Math.max(leadPhotoCount + 2, 4))
        : leadPhotoCount;
      const limit = allThumbs ? photos.length : count;
      if (urgent) bumpPhotoPreloadSession();
      preloadStoreThumbs(photos, {
        limit,
        includeLeadFull: !urgent,
        priority: urgent ? "high" : "low",
      });
    },
    [slug],
  );

  const selectCuisineGroup = useCallback(
    (group) => {
      prefetchStoreLeadPhotos(group, { urgent: true, allThumbs: true });
      setActivePhotoIndex(0);
      setDisplayPhotoIndex(0);
      setDisplayedCuisineStore(getCuisineGroupRepresentativeBranch(group));
      setSelectedCuisineGroup(group);
    },
    [prefetchStoreLeadPhotos],
  );

  useEffect(() => {
    if (!valid || cuisineStoreGroups.length === 0) return;
    prefetchStoreLeadPhotos(cuisineStoreGroups[0], { urgent: true });
    const warmCount = isSafariWebKit() ? 10 : 6;
    cuisineStoreGroups.slice(1, warmCount).forEach((group) => {
      prefetchStoreLeadPhotos(group);
    });
  }, [valid, slug, cuisineStoreGroups, prefetchStoreLeadPhotos]);

  useEffect(() => {
    if (activeSection !== "cuisine") return undefined;
    const listNode = storeListRef.current;
    if (!listNode || cuisineStoreGroups.length === 0) return undefined;

    const observed = new WeakSet();
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const target = entry.target;
          if (!(target instanceof HTMLElement) || observed.has(target)) return;
          observed.add(target);
          const index = Number(target.dataset.storeIndex ?? NaN);
          if (!Number.isFinite(index) || index < 0) return;
          const group = cuisineStoreGroups[index];
          if (group) prefetchStoreLeadPhotos(group, { allThumbs: true });
        });
      },
      { root: listNode, rootMargin: "120px 0px", threshold: 0.01 },
    );

    listNode.querySelectorAll("[data-store-index]").forEach((node) => {
      observer.observe(node);
    });

    return () => {
      observer.disconnect();
    };
  }, [activeSection, cuisineStoreGroups, prefetchStoreLeadPhotos]);

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

  useDismissOnOutsideAndEscape(isSectionMenuOpen, sectionMenuRef, () => {
    setSectionMenuOpen(false);
  });
  useDismissOnOutsideAndEscape(isCuisineMenuOpen, cuisineMenuRef, () => {
    setCuisineMenuOpen(false);
  });

  useEffect(() => {
    setSelectedStore(null);
    setSelectedCuisineGroup(null);
    setActiveCuisine("");
    setActivePhotoIndex(0);
    setDisplayPhotoIndex(0);
    setDisplayedCuisineStore(null);
    setCuisineMenuOpen(false);
    storeItemRefs.current = [];
  }, [slug]);

  useEffect(() => {
    if (activeSection !== "cuisine") return;
    if (cuisineStoreGroups.length === 0) {
      setSelectedCuisineGroup(null);
      setActivePhotoIndex(0);
      return;
    }
    const hasCurrent = cuisineStoreGroups.some((group) => group === selectedCuisineGroup);
    if (!hasCurrent) {
      setSelectedCuisineGroup(cuisineStoreGroups[0]);
      setActivePhotoIndex(0);
    }
  }, [activeSection, cuisineStoreGroups, selectedCuisineGroup]);

  useEffect(() => {
    setActivePhotoIndex(0);
    setDisplayPhotoIndex(0);
    setDisplayedCuisineStore(selectedCuisineStore);
  }, [selectedCuisineGroup, selectedCuisineStore]);

  const handleDisplayPhotoIndexChange = useCallback(
    (index) => {
      setDisplayPhotoIndex(index);
      setDisplayedCuisineStore(selectedCuisineStore);
    },
    [selectedCuisineStore],
  );

  useEffect(() => {
    storeItemRefs.current = [];
  }, [cuisineStoreGroups.length]);

  useEffect(() => {
    if (!selectedCuisineGroup) return;
    if (activeCuisine === "") return;
    const matchesFilter = selectedCuisineGroup.branches.some(
      (row) => getRestaurantCuisineEn(row) === activeCuisine,
    );
    if (!matchesFilter) {
      setSelectedCuisineGroup(null);
    }
  }, [activeCuisine, selectedCuisineGroup]);

  useEffect(() => {
    setCuisineMenuOpen(false);
  }, [activeCuisine, activeSection]);

  // 店铺列表键盘导航：上下键切换店铺
  const storeItemRefs = useRef([]);
  useEffect(() => {
    if (activeSection !== "cuisine") return undefined;
    if (cuisineStoreGroups.length === 0) return undefined;

    const onKeyDown = (event) => {
      if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;

      // 如果当前焦点不在店铺列表区域内，不处理
      const listNode = storeListRef.current;
      if (!listNode) return;

      const activeElement = document.activeElement;
      const isFocusInList = listNode.contains(activeElement);
      if (!isFocusInList) return;

      event.preventDefault();

      const currentIndex = selectedCuisineGroup
        ? cuisineStoreGroups.findIndex((group) => group === selectedCuisineGroup)
        : -1;
      let nextIndex;

      if (event.key === "ArrowUp") {
        nextIndex = currentIndex <= 0 ? cuisineStoreGroups.length - 1 : currentIndex - 1;
      } else {
        nextIndex = currentIndex >= cuisineStoreGroups.length - 1 ? 0 : currentIndex + 1;
      }

      const nextGroup = cuisineStoreGroups[nextIndex];
      selectCuisineGroup(nextGroup);

      // 焦点跟随：切换后将焦点设置到新选中的店铺项
      window.requestAnimationFrame(() => {
        const nextItemEl = storeItemRefs.current[nextIndex];
        if (nextItemEl && typeof nextItemEl.focus === "function") {
          nextItemEl.focus();
        }
      });
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [activeSection, cuisineStoreGroups, selectCuisineGroup, selectedCuisineGroup]);

  useDismissOnOutsideAndEscape(isCuisineSortHintOpen, cuisineSortHintRef, () => {
    setCuisineSortHintOpen(false);
  });

  useLayoutEffect(() => {
    if (!isCuisineMenuOpen) {
      setCuisineMenuScrollable(false);
      setCuisineMenuMaxHeight(null);
      return;
    }

    const menuNode = cuisineDropdownMenuRef.current;
    const panelNode = cuisineStorePanelRef.current;
    if (!menuNode || !panelNode) return;

    const updateCuisineMenuLayout = () => {
      const panelRect = panelNode.getBoundingClientRect();
      const menuRect = menuNode.getBoundingClientRect();
      const availableHeight = Math.floor(panelRect.bottom - menuRect.top - 6);
      const nextMaxHeight = Math.max(0, availableHeight);

      // Measure unconstrained content height; max-height from state may not be applied yet.
      const previousMaxHeight = menuNode.style.maxHeight;
      menuNode.style.maxHeight = "none";
      const contentHeight = menuNode.scrollHeight;
      menuNode.style.maxHeight = previousMaxHeight;

      setCuisineMenuMaxHeight(nextMaxHeight);
      setCuisineMenuScrollable(contentHeight > nextMaxHeight + 1);
    };

    updateCuisineMenuLayout();
    const frameId = requestAnimationFrame(updateCuisineMenuLayout);
    window.addEventListener("resize", updateCuisineMenuLayout);
    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener("resize", updateCuisineMenuLayout);
    };
  }, [isCuisineMenuOpen, cuisineFilterItems]);

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
          <div className="ffj-city-detail-top-actions">
            <BookshelfBackButton
              ariaLabel={pickUiText("返回书架", "Back to bookshelf", nativeBackToBookshelfText)}
            />
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
            ) : null}
          </div>
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
            <Suspense fallback={null}>
              <MapPanel
                citySlug={slug}
                cityLabel={cityDisplay}
                isVisible={activeSection === "map"}
                activeCuisine={activeCuisine}
                onSelectStore={setSelectedStore}
                onInteractiveHoverChange={handleMapInteractiveHoverChange}
                onContinueWithoutMap={() => setActiveSection("cuisine")}
              />
            </Suspense>
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
                cuisine: pickUiText("菜系类型", "Cuisine", nativeCuisineLabelText),
                scoreOverall: pickUiText("综合评分", "Overall score", nativeScoreOverallText),
                pricePerPerson: pickUiText("人均消费", "Average spend", nativePricePerPersonText),
                hours: pickUiText("营业时间", "Business hours", nativeBusinessHoursText),
                phone: pickUiText("联系电话", "Phone", nativePhoneText),
                radar: pickUiText("评分雷达图", "Score radar", nativeRadarTitleText),
                radarNoData: pickUiText("暂无雷达图数据", "No radar data yet", nativeRadarNoDataText),
                radarTaste: pickUiText("口味", "Taste", nativeRadarTasteText),
                radarEnvironment: pickUiText("环境", "Environment", nativeRadarEnvironmentText),
                radarQueue: pickUiText("排队友好度", "Queue friendliness", nativeRadarQueueText),
                radarService: pickUiText("服务", "Service", nativeRadarServiceText),
                radarPackaging: pickUiText("包装", "Packaging", nativeRadarPackagingText),
                radarDelivery: pickUiText("配送", "Delivery", nativeRadarDeliveryText),
                radarPersonal: pickUiText("个人推荐值", "Personal recommendation", nativeRadarPersonalText),
                mapOpen: pickUiText("新标签页打开地图", "Open map in new tab", nativeMapOpenText),
                mapUnavailable: pickUiText("暂无地图链接", "Map link unavailable", nativeMapUnavailableText),
              }}
            />
          </article>

          <aside
            className="ffj-city-book-page ffj-city-book-page--sticker"
            aria-label={pickUiText("菜系筛选", "Cuisine filters", nativeCuisineLeftPlaceholderText)}
          >
            <div className={`ffj-cuisine-filter-stack ${activeCuisine !== "" ? "is-filtering" : ""}`}>
              {cuisineFilters.map((cuisineEn) => {
                const isActive = activeCuisine === cuisineEn;
                const cuisineLabel = pickCuisineLabel(cuisineEn);
                const scriptClass = `is-script-${detectLabelScript(cuisineLabel, detailLocale)}`;
                return (
                  <button
                    key={cuisineEn}
                    type="button"
                    className={`ffj-cuisine-filter-btn ${scriptClass} ${isActive ? "is-active" : ""}`}
                    onClick={() => {
                      setActiveCuisine((current) => (current === cuisineEn ? "" : cuisineEn));
                    }}
                    onMouseEnter={() => handleMapInteractiveHoverChange(true)}
                    onMouseLeave={() => handleMapInteractiveHoverChange(false)}
                    aria-pressed={isActive}
                  >
                    <span className="ffj-cuisine-filter-btn-text">
                      {splitCuisineLabelLines(cuisineLabel, detailLocale).map((line, lineIndex) => (
                        <span
                          key={`${cuisineEn}-${line}-${lineIndex}`}
                          className={`ffj-cuisine-filter-btn-line ${
                            lineIndex === 0 ? "is-first" : "is-following"
                          }`}
                        >
                          {line}
                        </span>
                      ))}
                    </span>
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
            <section
              ref={cuisineStorePanelRef}
              className="ffj-cuisine-store-panel"
              aria-label={pickUiText("菜系筛选与店铺列表", "Cuisine filter and store list", nativeStorePlaylistText)}
              tabIndex={-1}
            >
              <div className="ffj-cuisine-dropdown" ref={cuisineMenuRef}>
                <div className="ffj-cuisine-dropdown-control-row">
                  <button
                    type="button"
                    className={`ffj-cuisine-dropdown-trigger ${isCuisineMenuOpen ? "is-open" : ""}`}
                    onClick={() => setCuisineMenuOpen((open) => !open)}
                    aria-haspopup="listbox"
                    aria-expanded={isCuisineMenuOpen}
                    aria-label={pickUiText("菜系筛选", "Cuisine filter", nativeCuisineFilterText)}
                  >
                    <span className="ffj-cuisine-dropdown-trigger-label">{activeCuisineLabel}</span>
                    <span className="ffj-cuisine-dropdown-trigger-arrow" aria-hidden="true">
                      ▾
                    </span>
                  </button>
                  <div
                    className={`ffj-cuisine-sort-hint-anchor ${isCuisineSortHintOpen ? "is-open" : ""}`}
                    ref={cuisineSortHintRef}
                    onMouseEnter={() => setCuisineSortHintOpen(true)}
                    onMouseLeave={() => setCuisineSortHintOpen(false)}
                  >
                    <button
                      type="button"
                      className="ffj-cuisine-sort-hint-trigger"
                      aria-label={pickUiText("菜系列表排序规则", "Cuisine sorting rules", nativeCuisineSortInfoText)}
                      aria-expanded={isCuisineSortHintOpen}
                      aria-controls="ffj-cuisine-sort-hint-panel"
                      onClick={() => setCuisineSortHintOpen((open) => !open)}
                      onFocus={() => setCuisineSortHintOpen(true)}
                      onBlur={(event) => {
                        if (!cuisineSortHintRef.current?.contains(event.relatedTarget)) {
                          setCuisineSortHintOpen(false);
                        }
                      }}
                    >
                      i
                    </button>
                    <div
                      id="ffj-cuisine-sort-hint-panel"
                      className="ffj-cuisine-sort-hint-bubble"
                      role="tooltip"
                    >
                      <p className="ffj-cuisine-sort-hint-title">
                        {pickUiText("菜系排序规则：", "Cuisine sort rules:", "요리 정렬 규칙:")}
                      </p>
                      <p className="ffj-cuisine-sort-hint-line">
                        {pickUiText(
                          "先按店铺数降序",
                          "Store count descending first",
                          "매장 수 내림차순 우선"
                        )}
                      </p>
                      <p className="ffj-cuisine-sort-hint-line">
                        {pickUiText(
                          "同店铺数按中文拼音升序",
                          "Tie: Chinese pinyin ascending",
                          "동률은 중국어 병음 오름차순"
                        )}
                      </p>
                      <p className="ffj-cuisine-sort-hint-title ffj-cuisine-sort-hint-title--sub">
                        {pickUiText("店铺排序规则：", "Store sort rules:", "매장 정렬 규칙:")}
                      </p>
                      <p className="ffj-cuisine-sort-hint-line">
                        {pickUiText(
                          "先按中文拼音升序",
                          "First: Chinese pinyin ascending",
                          "먼저 중국어 병음 오름차순"
                        )}
                      </p>
                      <p className="ffj-cuisine-sort-hint-line">
                        {pickUiText(
                          "再按英文字母升序",
                          "Then: English alphabet ascending",
                          "다음은 영문 알파벳 오름차순"
                        )}
                      </p>
                      <p className="ffj-cuisine-sort-hint-line">
                        {pickUiText(
                          "最后展示数字开头的店铺",
                          "Finally: numeric-leading names last",
                          "마지막으로 숫자로 시작하는 매장 표시"
                        )}
                      </p>
                    </div>
                  </div>
                </div>
                {isCuisineMenuOpen ? (
                  <div
                    ref={cuisineDropdownMenuRef}
                    className={`ffj-cuisine-dropdown-menu ${cuisineMenuMaxHeight != null ? "is-constrained" : ""} ${isCuisineMenuScrollable ? "is-scrollable" : ""}`}
                    role="listbox"
                    style={
                      cuisineMenuMaxHeight == null
                        ? undefined
                        : { maxHeight: `${cuisineMenuMaxHeight}px` }
                    }
                  >
                    {cuisineFilterItems.map((item) => {
                      const isAll = item.cuisine === "";
                      const isActive = isAll ? activeCuisine === "" : activeCuisine === item.cuisine;
                      const label = isAll
                        ? pickUiText("全部", "All", nativeAllText)
                        : pickCuisineLabel(item.cuisine, item.cuisineZh);
                      return (
                        <button
                          key={item.key}
                          type="button"
                          role="option"
                          aria-selected={isActive}
                          className={`ffj-cuisine-dropdown-item ${isActive ? "is-active" : ""}`}
                          onClick={() => {
                            setActiveCuisine(isAll ? "" : item.cuisine);
                            setCuisineMenuOpen(false);
                          }}
                        >
                          <span className="ffj-cuisine-dropdown-item-main">
                            <img
                              className="ffj-cuisine-filter-sticker"
                              src={item.stickerUrl}
                              alt=""
                              aria-hidden="true"
                              draggable={false}
                            />
                            <span className="ffj-cuisine-dropdown-item-label">{label}</span>
                          </span>
                          <span className="ffj-cuisine-dropdown-item-count">{item.count}</span>
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>

              <div ref={storeListRef} className="ffj-store-playlist" tabIndex={-1}>
                {cuisineStoreGroups.length === 0 ? (
                  <p className="ffj-store-playlist-empty">
                    {pickUiText("等我探索 ：）", "More to explore :)", nativeNoStoreText)}
                  </p>
                ) : (
                  <>
                    {cuisineStoreGroups.map((group, index) => {
                      const isActive = selectedCuisineGroup === group;
                      const lines = getCuisineDisplayNameLines(group);
                      const recommend = getStoreRecommend(group);
                      return (
                        <button
                          key={`${group.city_en}-${group.store_slug ?? index}`}
                          data-store-index={index}
                          ref={(el) => { storeItemRefs.current[index] = el; }}
                          type="button"
                          className={`ffj-store-playlist-item ${isActive ? "is-active" : ""}`}
                          onClick={() => selectCuisineGroup(group)}
                          onMouseEnter={() => prefetchStoreLeadPhotos(group)}
                          onFocus={() => prefetchStoreLeadPhotos(group)}
                          aria-pressed={isActive}
                        >
                          <span className="ffj-store-playlist-item-index">
                            {String(index + 1).padStart(2, "0")}
                          </span>
                          <span className="ffj-store-playlist-item-names">
                            {lines.map((line, lineIndex) => (
                              <span
                                key={`${line}-${lineIndex}`}
                                className={`ffj-store-playlist-item-name-line ${
                                  lineIndex > 0 ? "is-secondary" : ""
                                }`}
                              >
                                <span className="ffj-store-playlist-item-name-text">
                                  {line}
                                </span>
                                {lineIndex === 0 && recommend === "yes" ? (
                                  <span
                                    className="ffj-store-recommend-marker ffj-store-recommend-marker--up"
                                    aria-hidden="true"
                                    style={{
                                      "--ffj-recommend-marker-mask": `url("${thumbsUpStickerUrl}")`,
                                    }}
                                  />
                                ) : null}
                                {lineIndex === 0 && recommend === "no" ? (
                                  <span
                                    className="ffj-store-recommend-marker ffj-store-recommend-marker--down"
                                    aria-hidden="true"
                                    style={{
                                      "--ffj-recommend-marker-mask": `url("${thumbsDownStickerUrl}")`,
                                    }}
                                  />
                                ) : null}
                              </span>
                            ))}
                          </span>
                        </button>
                      );
                    })}
                  </>
                )}
                <div className="ffj-store-playlist-item ffj-store-playlist-item--tail" aria-hidden="true">
                  <span className="ffj-store-playlist-item-index">
                    {String(cuisineStoreGroups.length + 1).padStart(2, "0")}
                  </span>
                  <span className="ffj-store-playlist-item-names">
                    <span className="ffj-store-playlist-item-name-line ffj-store-playlist-item-name-line--tail">
                      AND MORE TO COME~
                    </span>
                  </span>
                </div>
              </div>
            </section>
          </article>

          <div className="ffj-city-book-gutter" aria-hidden="true" />

          <article
            className="ffj-city-book-page ffj-city-book-page--right"
            aria-label={pickUiText("右页占位", "Right page placeholder", nativeRightPageText)}
          >
            <header className="ffj-cuisine-address" aria-label={pickUiText("店铺地址", "Store address")}>
              <img
                className={`ffj-cuisine-address-icon ${selectedStoreAddress === "" ? "is-empty" : ""}`}
                src={locationStickerUrl}
                alt=""
                aria-hidden="true"
                draggable={false}
              />
              <p className="ffj-cuisine-address-text">
                {selectedStoreAddress !== "" ? selectedStoreAddress : "\u00A0"}
              </p>
            </header>
            {isCuisineFilterNoMatch ? (
              <p className="ffj-cuisine-right-empty">
                {pickUiText(
                  "当前筛选下暂无匹配店铺",
                  "No stores match this filter",
                  nativeIso === "ko" ? "현재 필터에 맞는 매장이 없어요" : "No stores match this filter"
                )}
              </p>
            ) : (
              <PhotoPanel
                citySlug={slug}
                selectedStore={selectedCuisineStore}
                activePhotoIndex={activePhotoIndex}
                onChangeActivePhotoIndex={setActivePhotoIndex}
                onDisplayPhotoIndexChange={handleDisplayPhotoIndexChange}
                labels={{
                  photoRegion: pickUiText("店铺图片区域", "Store photo area", nativePhotoRegionText),
                  photoPagination: pickUiText(
                    "图片分页切换",
                    "Photo pagination",
                    nativePhotoPaginationText,
                  ),
                  prevPhoto: pickUiText("上一张图片", "Previous photo", nativePrevPhotoText),
                  nextPhoto: pickUiText("下一张图片", "Next photo", nativeNextPhotoText),
                  gotoPhoto: pickUiText("跳转到图片", "Go to photo", nativeGotoPhotoText),
                  expandPhoto: pickUiText("点击放大查看", "Click to enlarge", nativeExpandPhotoText),
                  closeLightbox: pickUiText(
                    "关闭大图（点击空白或图片，或按 Esc）",
                    "Close enlarged view (click or press Esc)",
                    nativeCloseLightboxText,
                  ),
                  noPhoto: pickUiText("暂无美食图片", "No photos yet", nativeNoPhotoText),
                }}
                metaContent={
                  selectedCuisineStore ? (
                    <DishInfo
                      citySlug={slug}
                      selectedStore={displayedCuisineStore ?? selectedCuisineStore}
                      activePhotoIndex={displayPhotoIndex}
                      isChina={localeConfig.isChina}
                      detailLocale={detailLocale}
                      labels={{
                        dishInfoRegion: pickUiText("菜品信息", "Dish details", nativeDishInfoRegionText),
                        tasteStars: pickUiText("口味星级", "Taste", nativeTasteStarsText),
                      }}
                    />
                  ) : null
                }
              />
            )}
          </article>
        </div>
      </section>
    </main>
  );
}
