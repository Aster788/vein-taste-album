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

## 上传照片到 R2（本机，约 1.7GB）

```bash
npm run photos:manifest
npm run photos:upload-r2
```

可选预览（不上传）：`npm run photos:upload-r2 -- --dry-run`

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
3. **本机执行上传**（新增/变更图片后；见 [data-workflow.md](data-workflow.md) §9）
4. 验收：首页、城市直链、地图、店铺相册；Network 里图片域名为你的 R2 公开域

## Mapbox

Token URL restrictions 添加（不要带 `/*` 路径通配）：

- `https://vein-taste-album.vercel.app`
- `https://*.vercel.app`（若 Mapbox 允许子域通配）
- `https://www.veintastealbum.com` 与自定义域名

## 自定义域名（站点 + 照片）

- **站点**：Vercel → Settings → Domains（如 `www.veintastealbum.com`）
- **照片**：Cloudflare R2 bucket → Custom Domains（如 `photos.veintastealbum.com`），与 Vercel 无关；改域名后更新 `VITE_PHOTOS_BASE_URL` 并 Redeploy
