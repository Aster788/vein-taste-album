# Vercel 部署（完整体验 · 照片走 Blob CDN）

## 架构

- **Vercel**：托管 Vite 构建产物（`dist`，不含 1.7GB 照片）
- **Vercel Blob（Public）**：托管 `src/assets/photos/**`，浏览器通过 `VITE_PHOTOS_BASE_URL` 加载

## 一次性：Vercel 项目

1. Import GitHub 仓库 `Aster788/wonder-world`，Framework **Vite**，Output **`dist`**
2. 环境变量（Production + Preview）：
   - `VITE_MAPBOX_TOKEN`
   - `VITE_ENABLE_MT=false`
   - `VITE_PHOTOS_BASE_URL` — Public Blob 根 URL，**无末尾斜杠**  
     例：`https://cl1nagn6jqecw0y5.public.blob.vercel-storage.com`
3. Storage → **Public** Blob → Connect 项目（勾选 read-write token）→ 得到 `BLOB_READ_WRITE_TOKEN`（仅上传用，不要暴露到前端）

## 上传照片到 Blob（本机，约 1.7GB）

```bash
vercel env pull .env.local --environment=preview
npm run photos:manifest
npm run photos:upload-blob
```

可选：`npm run photos:upload-blob -- --dry-run` 预览路径。

上传后 Blob 路径规则：`photos/{city}/{store}/{filename}`，与本地目录一致。

## 本地开发

- 默认：不设置 `VITE_PHOTOS_BASE_URL`，继续读 `src/assets/photos`（`import.meta.glob`）
- 测 CDN：在 `.env.local` 设置 `VITE_PHOTOS_BASE_URL` 后 `npm run dev`

## 合并 PR 后

1. Vercel 自动 `prebuild` → 生成 manifest → `vite build`（产物体积小）
2. 确认 `VITE_PHOTOS_BASE_URL` 已配置 → **Redeploy**
3. 验收：首页、城市直链（`/shanghai`）、地图、店铺相册

## Mapbox

Token URL restrictions 添加（不要带 `/*` 路径通配）：

- `https://vein-taste-album.vercel.app`
- `https://*.vercel.app`（若 Mapbox 允许子域通配）
- 自定义域名（购买后）

## 自定义域名（可选）

Vercel → Settings → Domains → 按提示配 DNS；Mapbox 与 Blob 无需改路径。
