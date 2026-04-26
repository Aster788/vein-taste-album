import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  getCityDetailLocaleConfig,
  normalizeDetailLocale,
} from "../utils/cityMeta.js";
import {
  getCachedTranslation,
  maybeTranslateWithCache,
  MT_CACHE_EVENT_NAME,
} from "../utils/translation.js";

const LanguageContext = createContext(null);

/**
 * 语言与路由城市（PRD §2.5、§3.1）
 *
 * **中国 8 城或书架 `/`**
 * - `detailLocale`：中国城为 `zh` | `en`；非中国城为 `zh` | `en` | `native`（见 `src/data/city_meta.json` + `cityMeta.js`）。
 * - **书脊 / 封面**：10 城统一上中文「国家·城市」、下英文「Country · City」，**不**随 `detailLocale` 改变（见 PRD §2.5）。
 *
 * **济州岛、吉隆坡（以及未来其它非中国城市）**
 * - 详情页语言切换与展示策略以 `prd.md` §2.5 为准（例如 `EN/KO/CN` 或 `EN/CN`）。
 * - **店铺名 / 菜品名**：以数据文件字段为准，**不参与**语言切换，也**不做**机器翻译覆盖（见 `prd.md` §2.5）。
 * - `formatFixedTriple`：保留为可选拼接工具（例如某些调试页/临时展示），**不作为**非中国城市详情页主展示规则。
 */

/**
 * @param {string | null | undefined} zh
 * @param {string | null | undefined} native
 * @param {string | null | undefined} en
 * @returns {string}
 */
export function formatFixedTriple(zh, native, en) {
  return [zh, native, en]
    .map((s) => (s == null ? "" : String(s).trim()))
    .filter((s) => s.length > 0)
    .join(" / ");
}

/**
 * 中国语境下按 `locale` 取一段文案（用于页面内可变区，不用于书脊/封面双行结构）。
 * @param {'zh' | 'en'} locale
 * @param {string | null | undefined} zhText
 * @param {string | null | undefined} enText
 */
export function pickByLocale(locale, zhText, enText, options = {}) {
  const zh = zhText != null ? String(zhText).trim() : "";
  const en = enText != null ? String(enText).trim() : "";
  const allowMachineTranslate = options.allowMachineTranslate !== false;
  if (locale === "en") {
    if (en !== "") return en;
    if (allowMachineTranslate) {
      const mt = getCachedTranslation({ text: zh, sourceLang: "zh", targetLang: "en" });
      if (mt !== "") return mt;
      if (zh !== "") {
        maybeTranslateWithCache({ text: zh, sourceLang: "zh", targetLang: "en" });
      }
    }
    return zh;
  }
  if (zh !== "") return zh;
  if (allowMachineTranslate) {
    const mt = getCachedTranslation({ text: en, sourceLang: "en", targetLang: "zh" });
    if (mt !== "") return mt;
    if (en !== "") {
      maybeTranslateWithCache({ text: en, sourceLang: "en", targetLang: "zh" });
    }
  }
  return en;
}

/**
 * 非中国城市：按 `detailLocale` 取可变文案；缺失时按 PRD 回退链 **目标 → EN → ZH**。
 * @param {'zh' | 'en' | 'native'} detailLocale
 * @param {string | null | undefined} zhText
 * @param {string | null | undefined} enText
 * @param {string | null | undefined} nativeText
 */
export function pickByDetailLocale(
  detailLocale,
  zhText,
  enText,
  nativeText,
  nativeIso639_1 = "",
  options = {},
) {
  const zh = zhText != null ? String(zhText).trim() : "";
  const en = enText != null ? String(enText).trim() : "";
  const native = nativeText != null ? String(nativeText).trim() : "";
  const nativeIso = String(nativeIso639_1 ?? "").trim().toLowerCase();
  const allowMachineTranslate = options.allowMachineTranslate !== false;

  const pickTarget = () => {
    if (detailLocale === "en") return en;
    if (detailLocale === "native") return native;
    return zh;
  };

  const target = pickTarget();
  if (target !== "") return target;

  if (allowMachineTranslate && detailLocale === "native" && nativeIso !== "") {
    const sourceForNative = en !== "" ? { text: en, sourceLang: "en" } : { text: zh, sourceLang: "zh" };
    if (sourceForNative.text !== "") {
      const mt = getCachedTranslation({
        text: sourceForNative.text,
        sourceLang: sourceForNative.sourceLang,
        targetLang: nativeIso,
      });
      if (mt !== "") return mt;
      maybeTranslateWithCache({
        text: sourceForNative.text,
        sourceLang: sourceForNative.sourceLang,
        targetLang: nativeIso,
      });
    }
  }

  if (allowMachineTranslate && detailLocale === "en" && zh !== "") {
    const mt = getCachedTranslation({ text: zh, sourceLang: "zh", targetLang: "en" });
    if (mt !== "") return mt;
    maybeTranslateWithCache({ text: zh, sourceLang: "zh", targetLang: "en" });
  }
  if (allowMachineTranslate && detailLocale === "zh" && en !== "") {
    const mt = getCachedTranslation({ text: en, sourceLang: "en", targetLang: "zh" });
    if (mt !== "") return mt;
    maybeTranslateWithCache({ text: en, sourceLang: "en", targetLang: "zh" });
  }

  if (detailLocale !== "en" && en !== "") return en;
  if (detailLocale !== "zh" && zh !== "") return zh;
  if (detailLocale !== "native" && native !== "") return native;
  return "";
}

export function LanguageProvider({ children }) {
  const [detailLocale, setDetailLocale] = useState("zh");
  const [citySlug, setCitySlugState] = useState(null);
  const [, setMtCacheVersion] = useState(0);

  const setCitySlug = useCallback((slug) => {
    setCitySlugState(slug == null || slug === "" ? null : slug);
  }, []);

  const localeConfig = useMemo(() => {
    if (citySlug == null) {
      return getCityDetailLocaleConfig("");
    }
    return getCityDetailLocaleConfig(citySlug);
  }, [citySlug]);

  useEffect(() => {
    setDetailLocale("zh");
  }, [citySlug]);

  useEffect(() => {
    if (citySlug == null) return;

    if (localeConfig.isChina) {
      setDetailLocale((current) => (current === "en" || current === "zh" ? current : "zh"));
      return;
    }

    if (!localeConfig.mode) return;
    setDetailLocale((current) => normalizeDetailLocale(current, localeConfig.mode));
  }, [citySlug, localeConfig.isChina, localeConfig.mode]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const onCacheUpdated = () => {
      setMtCacheVersion((version) => version + 1);
    };
    window.addEventListener(MT_CACHE_EVENT_NAME, onCacheUpdated);
    return () => {
      window.removeEventListener(MT_CACHE_EVENT_NAME, onCacheUpdated);
    };
  }, []);

  const showDetailLocaleToggle = useMemo(() => citySlug !== null, [citySlug]);

  const value = useMemo(
    () => ({
      /** @type {'zh' | 'en' | 'native'} */
      detailLocale,
      setDetailLocale,
      /** @deprecated 兼容旧命名：等同于 `detailLocale` */
      locale: detailLocale,
      /** @deprecated 兼容旧命名：等同于 `setDetailLocale` */
      setLocale: setDetailLocale,
      citySlug,
      setCitySlug,
      localeConfig,
      /** 城市详情页（`citySlug !== null`）显示右上角语言切换；书架页不显示 */
      showDetailLocaleToggle,
    }),
    [detailLocale, citySlug, setCitySlug, localeConfig, showDetailLocaleToggle]
  );

  return (
    <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error("useLanguage must be used within LanguageProvider");
  }
  return ctx;
}
