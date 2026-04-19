import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { isChinaCitySlug } from "../utils/citySlugs.js";

const LanguageContext = createContext(null);

/**
 * 语言与路由城市（PRD §2.5、§3.1）
 *
 * **中国 9 城或书架 `/`**
 * - `locale`: `zh` | `en`，切换**页面内可变文案**（店名、菜系、地址、引导语等）；Phase 2/3 再在右上角挂 UI。
 * - **书脊 / 封面**：始终中英双行静态排版，**不**随 `locale` 改行内语言（切换只影响页内其它区域）。
 *
 * **济州岛、吉隆坡**
 * - 不展示 EN/CN；`locale` 无 UI 意义。
 * - 文案固定顺序：**本国语 → English → 中文**（用 `formatFixedTriple` 等工具拼展示字符串）。
 */

/**
 * @param {string | null | undefined} native
 * @param {string | null | undefined} en
 * @param {string | null | undefined} zh
 * @returns {string}
 */
export function formatFixedTriple(native, en, zh) {
  return [native, en, zh]
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
export function pickByLocale(locale, zhText, enText) {
  if (locale === "en") {
    const e = enText != null ? String(enText) : "";
    if (e.trim() !== "") return e;
  }
  return zhText != null ? String(zhText) : "";
}

export function LanguageProvider({ children }) {
  const [locale, setLocale] = useState("zh");
  const [citySlug, setCitySlugState] = useState(null);

  const setCitySlug = useCallback((slug) => {
    setCitySlugState(slug == null || slug === "" ? null : slug);
  }, []);

  const showEnCnToggle = useMemo(
    () => citySlug === null || isChinaCitySlug(citySlug),
    [citySlug]
  );

  const isFixedTripleCity = useMemo(
    () => citySlug !== null && !isChinaCitySlug(citySlug),
    [citySlug]
  );

  const value = useMemo(
    () => ({
      locale,
      setLocale,
      citySlug,
      setCitySlug,
      /** 书架或中国 9 城：右上角 EN/CN（Phase 2/3 再挂组件） */
      showEnCnToggle,
      /** 济州 / 吉隆坡详情：固定三语策略 */
      isFixedTripleCity,
    }),
    [locale, citySlug, setCitySlug, showEnCnToggle, isFixedTripleCity]
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
