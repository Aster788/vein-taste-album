/**
 * 书脊字色：按 `--city-primary` 解析后的颜色，在浅字 / 深字间取对比度更高者（方案 B）。
 * 纯函数，无 DOM；供 `Book.jsx` 在 `useLayoutEffect` 中写入 CSS 变量。
 */

/**
 * @param {string} s `getComputedStyle(...).getPropertyValue('--city-primary')` 或任意 `rgb()` / `#hex`
 * @returns {{ r: number; g: number; b: number } | null}
 */
export function parseCssRgb(s) {
  const t = (s || "").trim();
  const rgb = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i.exec(t);
  if (rgb) {
    return { r: +rgb[1], g: +rgb[2], b: +rgb[3] };
  }
  const hex = /^#([\da-f]{6})$/i.exec(t);
  if (hex) {
    const n = parseInt(hex[1], 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }
  return null;
}

/** @param {number} c 0–255 sRGB 通道 */
function channelToLinear(c) {
  const x = c / 255;
  return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
}

/** WCAG 2.1 relative luminance */
function relativeLuminance(rgb) {
  const R = channelToLinear(rgb.r);
  const G = channelToLinear(rgb.g);
  const B = channelToLinear(rgb.b);
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

/** @param {number} lumFg @param {number} lumBg 均在 0–1 */
function contrastRatio(lumFg, lumBg) {
  const L1 = Math.max(lumFg, lumBg);
  const L2 = Math.min(lumFg, lumBg);
  return (L1 + 0.05) / (L2 + 0.05);
}

/** 与正文一致的深灰字近似亮度 */
const LUM_INK = relativeLuminance({ r: 26, g: 26, b: 26 });
const LUM_PAPER = 1;

export const LIGHT_SPINE_INK_CSS_VARIABLES = Object.freeze({
  "--ffj-spine-ink": "rgba(252, 250, 246, 0.97)",
  "--ffj-spine-shadow":
    "0 0 1px rgba(0, 0, 0, 0.52), 0 1px 4px rgba(0, 0, 0, 0.4)",
});

/**
 * @param {string} cityPrimaryResolved 浏览器解析后的主色字符串
 * @returns {Record<string, string>} 写入书脊根节点的 CSS 自定义属性
 */
export function spineInkCssVariables(cityPrimaryResolved) {
  const rgb = parseCssRgb(cityPrimaryResolved);
  if (!rgb) {
    return {
      "--ffj-spine-ink": "color-mix(in srgb, var(--color-text) 93%, transparent)",
      "--ffj-spine-shadow":
        "0 0 0.5px color-mix(in srgb, var(--color-page-bg) 50%, transparent), 0 1px 2px color-mix(in srgb, var(--color-text) 12%, transparent)",
    };
  }

  const lumBg = relativeLuminance(rgb);
  const crLight = contrastRatio(LUM_PAPER, lumBg);
  const crDark = contrastRatio(LUM_INK, lumBg);
  const useLightInk = crLight >= crDark;

  if (useLightInk) {
    return LIGHT_SPINE_INK_CSS_VARIABLES;
  }

  return {
    "--ffj-spine-ink": "color-mix(in srgb, var(--color-text) 93%, transparent)",
    "--ffj-spine-shadow":
      "0 0 0.5px color-mix(in srgb, var(--color-page-bg) 50%, transparent), 0 1px 2px color-mix(in srgb, var(--color-text) 12%, transparent)",
  };
}
