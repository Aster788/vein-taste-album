import { useLayoutEffect, useRef } from "react";
import {
  LIGHT_SPINE_INK_CSS_VARIABLES,
  spineInkCssVariables,
} from "../utils/spineContrast.js";

const FORCE_LIGHT_SPINE_INK_SLUGS = Object.freeze(new Set(["suzhou", "melaka"]));

/**
 * 书架单本书：书脊 + 书口 + 封面 3D 组装；父级 `li` 写入 `--ffj-book-yaw-scroll`，抽出由 hover 样式控制（见 Bookshelf.jsx、global.css）。
 * 城市配色由外层 `li.ffj-bookshelf-book-slot[data-city]` 注入的 CSS 变量提供。
 *
 * 书脊文字（PRD §2.5「书脊与封面」、§3.3）：10 城统一两行竖排，
 * **上行中文**「国家·城市」（霞鹜文楷），**下行英文**「Country · City」（Playfair），不随 `locale` 切换。
 * 字色按 `--city-primary` 亮度自动选深/浅（`spineContrast.js`），保证与上海等深色主色对比度。
 * 书脊城市贴纸：`<img>` 直接渲染 SVG，保留资源内多色填充；透明区域透出书脊底纹。
 * **资源约定（`src/assets/stickers/cities/*.svg`）**：不得含整幅画布黑底/白底或「大卡纸」矩形层；
 *   导出工具常自动加全框 path，上架前须删净，否则书脊上会出现黑/白方块（与 `citySlugs.js` 注释一致）。
 *
 * @param {{ city: object, isTransitioning?: boolean }} props
 *   isTransitioning - 是否为过渡动画模式，此时会调整书本外观以适应翻书动画
 */
export default function Book({ city, isTransitioning = false }) {
  const spineRef = useRef(null);
  const {
    is_china,
    country_zh,
    country_en,
    city_zh,
    city_en,
    slug,
    stickerHref,
  } = city;

  useLayoutEffect(() => {
    const el = spineRef.current;
    if (!el) return;
    const raw = getComputedStyle(el).getPropertyValue("--city-primary").trim();
    const vars = FORCE_LIGHT_SPINE_INK_SLUGS.has(slug)
      ? LIGHT_SPINE_INK_CSS_VARIABLES
      : spineInkCssVariables(raw);
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
    <div className={`ffj-book ${isTransitioning ? "is-transitioning" : ""}`}>
      {/* 滚动驱动 yaw 无 transition；仅 hover 到该书时轻微 translateZ 抽出，子层 300ms ease-out */}
      <div className="ffj-book__yaw-scroll">
        <div className="ffj-book__yaw-hover">
          <div className="ffj-book__assembly">
            <div
              ref={spineRef}
              className="ffj-book__spine ffj-paper-noise ffj-paper-noise--warm"
              aria-label={spineLabel}
            >
              {stickerHref ? (
                <img
                  className="ffj-book__spine-sticker"
                  src={stickerHref}
                  alt=""
                  decoding="async"
                  aria-hidden
                />
              ) : null}
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
            <div className="ffj-book__cover ffj-book__cover--bookshelf-solid" aria-hidden />
            <div className="ffj-book__back ffj-book__back--bookshelf-solid" aria-hidden />
            {/* 铰链柔化：置于各面之后并略抬高 Z，叠在接缝上消缝（preserve-3d 深度排序） */}
            <div className="ffj-book__hinge-blend ffj-book__hinge-blend--cover" aria-hidden />
            <div className="ffj-book__hinge-blend ffj-book__hinge-blend--back" aria-hidden />
            {/* 过渡动画时显示的封面（从书脊侧翻转出来） */}
            {isTransitioning && (
              <div className="ffj-book__cover ffj-book__cover--transition" aria-hidden />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
