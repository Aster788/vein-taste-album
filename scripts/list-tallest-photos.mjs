/**
 * 扫描 src/assets/photos 下图片像素尺寸，按高度降序输出（用于校准拍立得 max-height）。
 * 支持：JPEG、PNG（WebP/HEIC 仅列文件名，尺寸记为 0）。
 */
import { promises as fs } from "node:fs";
import path from "node:path";

const ROOT = path.resolve("src/assets/photos");
const TARGET_EXT = new Set([".jpg", ".jpeg", ".png", ".webp", ".JPG", ".JPEG", ".PNG", ".WEBP"]);

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(full)));
    } else if (entry.isFile()) {
      files.push(full);
    }
  }
  return files;
}

function readPngSize(buf) {
  if (buf.length < 24) return null;
  if (buf[0] !== 0x89 || buf[1] !== 0x50 || buf[2] !== 0x4e || buf[3] !== 0x47) return null;
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  return width > 0 && height > 0 ? { width, height } : null;
}

function readJpegSize(buf) {
  let offset = 2;
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  while (offset + 9 < buf.length) {
    if (buf[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = buf[offset + 1];
    // SOF0 / SOF1 / SOF2
    if (marker >= 0xc0 && marker <= 0xc2) {
      const height = buf.readUInt16BE(offset + 5);
      const width = buf.readUInt16BE(offset + 7);
      return width > 0 && height > 0 ? { width, height } : null;
    }
    if (marker === 0xd8 || marker === 0xd9) {
      offset += 2;
      continue;
    }
    const segLen = buf.readUInt16BE(offset + 2);
    if (segLen < 2) return null;
    offset += 2 + segLen;
  }
  return null;
}

async function readImageSize(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const fh = await fs.open(filePath, "r");
  try {
    const head = Buffer.alloc(65536);
    const { bytesRead } = await fh.read(head, 0, head.length, 0);
    const buf = head.subarray(0, bytesRead);
    if (ext === ".png") {
      const s = readPngSize(buf);
      if (s) return s;
    }
    if (ext === ".jpg" || ext === ".jpeg") {
      const s = readJpegSize(buf);
      if (s) return s;
    }
    return { width: 0, height: 0 };
  } finally {
    await fh.close();
  }
}

async function main() {
  const all = await walk(ROOT);
  const photos = all.filter((f) => TARGET_EXT.has(path.extname(f)));
  const rows = [];
  for (const file of photos) {
    const rel = path.relative(process.cwd(), file).replace(/\\/g, "/");
    try {
      const { width, height } = await readImageSize(file);
      rows.push({ rel, width, height });
    } catch {
      rows.push({ rel, width: 0, height: 0 });
    }
  }
  rows.sort((a, b) => b.height - a.height || b.width - a.width);
  const top = rows.slice(0, 40);
  console.log(`Scanned ${photos.length} images under ${ROOT}\nTop ${top.length} by height:\n`);
  for (const r of top) {
    console.log(`${String(r.height).padStart(5)}×${String(r.width).padStart(5)}  ${r.rel}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
