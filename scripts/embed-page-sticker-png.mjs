/**
 * Embed a transparent PNG page sticker into a cropped SVG (no full-canvas backdrop).
 * Usage:
 *   node scripts/embed-page-sticker-png.mjs src/assets/stickers/page/left-arrow.png
 *   node scripts/embed-page-sticker-png.mjs src/assets/stickers/page/left-arrow.png --ink 545d67
 */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const inputPath = process.argv[2];
const inkArg = process.argv.find((a) => a.startsWith("--ink="))?.slice(6) ?? "545d67";
const lightenArg =
  process.argv.find((a) => a.startsWith("--lighten="))?.slice(10) ?? "0.38";
const outlineLightenArg =
  process.argv.find((a) => a.startsWith("--outline-lighten="))?.slice(18) ??
  null;
const softenAlphaArg =
  process.argv.find((a) => a.startsWith("--soften-alpha="))?.slice(15) ??
  null;

if (!inputPath) {
  console.error(
    "Usage: node scripts/embed-page-sticker-png.mjs <png-path> [--ink=RRGGBB] [--lighten=0-1]",
  );
  process.exit(1);
}

const inkHex = inkArg.replace(/^#/, "");
if (!/^[0-9a-fA-F]{6}$/.test(inkHex)) {
  console.error("[embed-page-sticker-png] --ink must be 6-digit hex, e.g. 545d67");
  process.exit(1);
}

const ink = {
  r: Number.parseInt(inkHex.slice(0, 2), 16),
  g: Number.parseInt(inkHex.slice(2, 4), 16),
  b: Number.parseInt(inkHex.slice(4, 6), 16),
};
const lighten = Math.min(1, Math.max(0, Number.parseFloat(lightenArg) || 0));
const outlineLighten = Math.min(
  1,
  Math.max(
    0,
    Number.parseFloat(outlineLightenArg ?? String(lighten * 0.55 + 0.22)),
  ),
);
const softenAlpha = Math.min(
  1,
  Math.max(0, Number.parseFloat(softenAlphaArg ?? "0.88")),
);
const fillInk = {
  r: Math.round(ink.r + (255 - ink.r) * lighten),
  g: Math.round(ink.g + (255 - ink.g) * lighten),
  b: Math.round(ink.b + (255 - ink.b) * lighten),
};
const outlineInk = {
  r: Math.round(ink.r + (255 - ink.r) * outlineLighten),
  g: Math.round(ink.g + (255 - ink.g) * outlineLighten),
  b: Math.round(ink.b + (255 - ink.b) * outlineLighten),
};

const absInput = path.resolve(inputPath);
const outSvg = absInput.replace(/\.png$/i, ".svg");

const { data, info } = await sharp(absInput)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

const { width: w, height: h } = info;
const out = Buffer.from(data);

const isBlueFill = (r, g, b) => b > r + 18 && b > g + 4 && r + g + b > 48;
const isOutline = (r, g, b) => r < 52 && g < 52 && b < 52;

for (let i = 0; i < out.length; i += 4) {
  const r = out[i];
  const g = out[i + 1];
  const b = out[i + 2];
  let a = out[i + 3];
  if (a < 16) continue;

  if (isOutline(r, g, b)) {
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    const scale = 0.68 + 0.28 * lum;
    out[i] = Math.min(255, Math.round(outlineInk.r * scale));
    out[i + 1] = Math.min(255, Math.round(outlineInk.g * scale));
    out[i + 2] = Math.min(255, Math.round(outlineInk.b * scale));
    out[i + 3] = Math.round(a * softenAlpha);
    continue;
  }

  if (!isBlueFill(r, g, b)) {
    out[i + 3] = Math.round(a * softenAlpha);
    continue;
  }

  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  const scale = 0.52 + 0.42 * lum;
  out[i] = Math.min(255, Math.round(fillInk.r * scale));
  out[i + 1] = Math.min(255, Math.round(fillInk.g * scale));
  out[i + 2] = Math.min(255, Math.round(fillInk.b * scale));
  out[i + 3] = Math.round(a * softenAlpha);
}

let minX = w;
let minY = h;
let maxX = 0;
let maxY = 0;

for (let y = 0; y < h; y += 1) {
  for (let x = 0; x < w; x += 1) {
    const a = out[(y * w + x) * 4 + 3];
    if (a > 20) {
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
}

if (maxX < minX || maxY < minY) {
  console.error("[embed-page-sticker-png] No opaque pixels found.");
  process.exit(1);
}

const crop = {
  left: minX,
  top: minY,
  width: maxX - minX + 1,
  height: maxY - minY + 1,
};

const pngBuf = await sharp(out, {
  raw: { width: w, height: h, channels: 4 },
})
  .extract(crop)
  .png()
  .toBuffer();

const b64 = pngBuf.toString("base64");
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${crop.width} ${crop.height}" width="${crop.width}" height="${crop.height}" aria-hidden="true">
  <image width="${crop.width}" height="${crop.height}" href="data:image/png;base64,${b64}"/>
</svg>
`;

fs.writeFileSync(outSvg, svg);
console.log(
  `[embed-page-sticker-png] Wrote ${outSvg} (${crop.width}×${crop.height}, ink=#${inkHex}, lighten=${lighten})`,
);
