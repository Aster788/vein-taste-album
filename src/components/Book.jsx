import { useLayoutEffect, useRef } from "react";
import { spineInkCssVariables } from "../utils/spineContrast.js";

/**
 * 书架单本书：书脊为主（书架行仅展示脊面，见 global.css）；
 * 书口与封面 DOM 保留供后续 Phase 复用，书架下行内以 CSS 隐藏。
 * 城市配色由外层 `li.ffj-bookshelf-book-slot[data-city]` 注入的 CSS 变量提供。
 *
 * 书脊文字（PRD §2.5「书脊与封面」、§3.3）：11 城统一两行竖排，
 * **上行中文**「国家·城市」（霞鹜文楷），**下行英文**「Country · City」（Playfair），不随 `locale` 切换。
 * 字色按 `--city-primary` 亮度自动选深/浅（`spineContrast.js`），保证与上海等深色主色对比度。
 *
 * @param {{ city: object }} props
 */
export default function Book({ city }) {
  const spineRef = useRef(null);
  const { is_china, country_zh, country_en, city_zh, city_en, slug } = city;

  useLayoutEffect(() => {
    const el = spineRef.current;
    if (!el) return;
    const raw = getComputedStyle(el).getPropertyValue("--city-primary").trim();
    const vars = spineInkCssVariables(raw);
    for (const [key, value] of Object.entries(vars)) {
      el.style.setProperty(key, value);
    }
    return () => {
      el.style.removeProperty("--ffj-spine-ink");
      el.style.removeProperty("--ffj-spine-shadow");
    };
  }, [slug]);

  const zhCountry = country_zh || (is_china ? "中国" : "");
  const enCountry = country_en || (is_china ? "China" : "");
  const spineLabel = `${zhCountry}·${city_zh}，${enCountry} · ${city_en}`;

  return (
    <div className="ffj-book">
      <div className="ffj-book__assembly">
        <div
          ref={spineRef}
          className="ffj-book__spine ffj-paper-noise ffj-paper-noise--warm"
          aria-label={spineLabel}
        >
          <div className="ffj-book__spine-text">
            <div className="ffj-book__spine-stack">
              <div className="ffj-book__spine-col ffj-book__spine-col--zh">
                {zhCountry}·{city_zh}
              </div>
              <div className="ffj-book__spine-col ffj-book__spine-col--en">
                {enCountry} · {city_en}
              </div>
            </div>
          </div>
        </div>
        <div className="ffj-book__pages" aria-hidden />
        <div className="ffj-book__cover" aria-hidden />
      </div>
    </div>
  );
}
