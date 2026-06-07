# Vercel 部署（站点）+ Cloudflare R2（照片 CDN）

## 架构

- **Vercel**：托管 Vite 构建产物（`dist`，不含约 1.7GB 本地照片）
- **Cloudflare R2（Public）**：托管 `src/assets/photos/**`；浏览器通过 `VITE_PHOTOS_BASE_URL` 加载
- 对象 Key 规则：`photos/{city}/{store}/{filename}`（与本地 `src/assets/photos/` 一致）

## 一次性：Vercel 项目

1. Import GitHub 仓库，Framework **Vite**，Output **`dist`**
2. 环境变量（Production + Preview）：
   - `VITE_MAPBOX_TOKEN`
   - `VITE_ENABLE_MT=false`
   - `VITE_PHOTOS_BASE_URL` — R2 公开根 URL，**无末尾斜杠**  
     例：`https://photos.veintastealbum.com`（Custom Domain）或临时 `https://pub-xxxx.r2.dev`
3. **不要**再连接 Vercel Blob Storage；照片上传走 R2，与 Vercel 项目解耦。

## 一次性：Cloudflare R2

1. 创建 bucket（如 `vein-taste-album-photos`）
2. **Settings → Custom Domains** 绑定子域（推荐 `photos.你的域名.com`），或暂用 **Public Development URL**（`*.r2.dev`）做冒烟
3. **R2 → API Tokens** 创建 **Object Read & Write**（限定该 bucket）→ 得到 Access Key / Secret
4. 记下 **Account ID**（R2 Overview 右侧）

本机 `.env.local` 模板见根目录 `.env.example`（`R2_*` 四行 + `VITE_PHOTOS_BASE_URL`）。

## 同步照片到 R2（本机，默认增量）

日常（commit & push / merge 后）：

```bash
npm run photos:thumbs
npm run photos:manifest
npm run photos:sync-r2
```

默认对比 `origin/main...HEAD` 的 Git 变更，仅上传/覆盖/删除本次变动的原图与缩略图。预览：`npm run photos:sync-r2 -- --dry-run`

未 push 时在本地预览变更范围：`npm run photos:sync-r2 -- --working --dry-run`

全量重建（首次铺库 / 灾难恢复，约 1.7GB）：`npm run photos:sync-r2 -- --full`

`.env.local`：你维护的密钥（Mapbox、翻译、高德、R2 等）。  
可选 `.env.vercel`：仅 `npm run env:pull-vercel` 写入（Vercel CLI 变量）；Node 脚本先读 `.env.vercel` 再读 `.env.local`，**同名键以 `.env.local` 为准**。

**备选上传方式（已配置 rclone 时）：**

```bash
rclone sync "src/assets/photos/" "r2vein:vein-taste-album-photos/photos/" -P --transfers 8
```

## 本地开发

- 默认：不设置 `VITE_PHOTOS_BASE_URL`，继续读 `src/assets/photos`（`import.meta.glob`）
- 测 CDN：在 `.env.local` 设置 `VITE_PHOTOS_BASE_URL` 后 `npm run dev`

## 合并 PR 后

1. Vercel 自动 `prebuild` → 生成 manifest → `vite build`
2. 确认 `VITE_PHOTOS_BASE_URL` 指向 R2 自定义域（或 `r2.dev`）→ **Redeploy**
3. **本机执行增量同步**（照片增删改后；见 [data-workflow.md](data-workflow.md) §9.2；merge 后已在 `main` 上见 **§9.2.1**）
4. 验收：首页、城市直链、地图、店铺相册（相册 CDN 细则见下方「相册 CDN 验收」）；Network 里图片域名为 R2 公开域

## Mapbox

Token URL restrictions 添加（不要带 `/*` 路径通配）：

- `https://vein-taste-album.vercel.app`
- `https://*.vercel.app`（若 Mapbox 允许子域通配）
- `https://www.veintastealbum.com` 与自定义域名

## 自定义域名（站点 + 照片）

- **站点**：Vercel → Settings → Domains（如 `www.veintastealbum.com`）
- **照片**：Cloudflare R2 bucket → Custom Domains（如 `photos.veintastealbum.com`），与 Vercel 无关；改域名后更新 `VITE_PHOTOS_BASE_URL` 并 Redeploy

## R2 CORS（相册预加载 / Safari）

若启用 `preloadImage` 的 blob 缓存（跨子域 `www` → `photos`），在 Cloudflare R2 bucket **Settings → CORS** 增加一条规则，例如：

| 字段 | 值 |
| --- | --- |
| Allowed Origins | `https://www.veintastealbum.com`（以及 Vercel 预览域，如需） |
| Allowed Methods | `GET`, `HEAD` |
| Allowed Headers | `*` |
| Max Age | `86400` |

未配置 CORS 时站点仍可正常显示图片（`<img>` 不需 CORS）；仅 blob 复用与部分 preload 优化会回退到原始 URL。

## 相册 CDN 验收（照片变更后必做）

在「三浏览器验收」之前或之中执行。**完整步骤与通过标准**见 [data-workflow.md](data-workflow.md) §9.5（无痕窗口、Network Filter、R2 域名、Status 200、删图 404 等）。

## 三浏览器验收（桌面 Chrome / Safari / Edge）

每次 Production 部署后，用**无痕窗口**、Network **不要**勾 Disable cache：

1. 打开 https://www.veintastealbum.com/ — 书架应可滚动，Network **不应**出现 `mapbox-gl`（未进城市页前）。
2. 进入任意城市 → 先停留在美食 Tab，确认仍未加载 Mapbox；再切到地图 Tab，此时才应加载 `mapbox-gl` chunk。
3. 美食页：切 3 家店、同店连点 5 张图 — 菜名与大图应同步，无明显长期错位（含 **相册 CDN 验收** 上述步骤）。
4. Safari → 开发 → 显示 Web 检查器 → 切一张**未看过**的店图：同一图片 URL 不应出现两次完整下载（若已配 R2 CORS，应看到 blob 显示或单次 GET）。
5. 对比 Chrome：主观延迟 Safari 不应明显长于 Chrome 的约 1.2 倍。

文案或数据变更后若出现「缺字」，在本机执行 `npm run fonts:subset` 后提交 `public/fonts/*.woff2`。

## 相册缩略图（首图零转圈）

- 本地生成：`npm run photos:thumbs`（产出 `{原名}.thumb.webp`，宽 ≤800px）
- 同步 R2 原图+缩略图：`npm run photos:sync-r2`（默认增量；全量加 `--full`；仅原图加 `--skip-thumbs`）
- 仅补传缩略图：`npm run photos:upload-thumbs-r2`（需先 `npm run photos:thumbs`）
- 线上 URL 约定：`photos/{city}/{store}/{basename}.thumb.webp`；前端先显缩略图再换高清原图
