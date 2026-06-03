# data-workflow.md · 数据与翻译固定流程手册

> 目标：把项目里“每次都要按顺序做”的操作集中到一处，减少漏步骤与返工。

---

## 0) 日常最常用流程（先看这个）

适用场景：你改了 `restaurants.xlsx` / `dishes.xlsx`，要刷新站点数据。

1. 运行 `npm run data:sync`
2. 若需要补齐非名称类文案翻译（静态落盘）：
  - 临时在 `.env.local` 设 `VITE_ENABLE_MT=true`
  - 运行 `npm run data:export-translations`
  - 完成后把 `.env.local` 改回 `VITE_ENABLE_MT=false`
3. 若新增/变更了 `src/assets/photos/` 下图片：见 **§9 同步照片到 Cloudflare R2**（合并 PR 并部署后也要做）
4. 运行 `npm run build` 验证可构建

---

## 1) Workbook -> JSON 同步流程

触发：修改了 `src/data/restaurants.xlsx` 或 `src/data/dishes.xlsx`。

### 前置检查

- `restaurants.xlsx` 至少满足：
  - `city_en`
  - `store_slug`
  - `record_scope`（`branch` / `brand`）
  - `name_zh/name_en/name_local` 至少一个
- 菜系列（推荐成对填写）：`cuisine_zh`（中文展示）、`cuisine_en`（贴纸 slug，与 `stickers/cuisine/{cuisine_en}.svg` 一致）。见 [structure.md](structure.md) §菜系筛选贴纸
- `dishes.xlsx` 至少满足：
  - `city_en`
  - `store_slug`
  - `dish_name_zh/dish_name_en/dish_name_local` 至少一个（三列全空的行不会写入 `dishes.json`；**不影响**该店 `photos` 文件夹内图片展示）

价格单位规则（必须统一）：

- `restaurants.xlsx`：`currency` 列对应 `price_per_person` 的单位。
- `dishes.xlsx`：`currency` 列对应 `price` 列的单位。
- 推荐货币代码：`CNY` / `KRW` / `MYR`（大写）。

### 执行

```bash
npm run data:sync
```

### 结果

- 输出：
  - `src/data/restaurants.json`
  - `src/data/dishes.json`
- 若出现 `restaurants=0`，优先检查 `store_slug` 与 `record_scope` 列是否缺失或为空。

---

## 2) 静态翻译落盘流程（推荐）

触发：非中国城市可变文案（如 `address`/`hours`/字段标签等，**不含**店名、菜名、`cuisine_zh`）有缺失语言，需要一次补齐并固定。

### 前置

- `.env.local` 中具备：
  - `VITE_GOOGLE_TRANSLATE_API_KEY`
  - `VITE_ENABLE_MT=true`（临时）
- 已先执行 `npm run data:sync`

### 执行

```bash
npm run data:export-translations
```

### 结果

- 更新 `src/data/translations.static.json`
- 运行时优先读取静态翻译，不依赖网络请求

### 收口（必须）

- `.env.local` 设回 `VITE_ENABLE_MT=false`（生产默认关闭 MT）

---

## 3) 新增非中国城市流程

触发：新增日本/泰国/其他非中国城市。

### 必做清单（顺序建议）

1. 在 `restaurants.xlsx` / `dishes.xlsx` 增加该城数据行
2. 配置 `src/data/city_meta.json`
  - `detail_locale_mode`
  - 若 `en_native_zh`，还需：
    - `native_iso639_1`
    - `native_button_label`
3. 增加该城市边界文件：`src/assets/geojson/<slug>.geojson`
4. 补齐城市贴纸：`src/assets/stickers/cities/`；菜系贴纸按表中出现的 `cuisine_en` 准备 `src/assets/stickers/cuisine/{cuisine_en}.svg`（见 [structure.md](structure.md)）
5. 补齐店铺图片目录（按 `store_slug`）：`src/assets/photos/{city-folder}/{store_slug}/`
6. 跑数据同步：`npm run data:sync`
7. 需要时跑静态翻译导出：`npm run data:export-translations`
8. 跑边界审计：`npm run audit:boundary-offsets`
9. 跑构建验证：`npm run build`
10. 合并 PR、Vercel 部署后：§9 同步照片到 R2

---

## 4) record_scope 使用规范

- `brand`：品牌层记录，不作为地图点位，不应被当作具体门店。
- `branch + 有效 lng/lat`：具体门店，可上图。
- `branch + 无效/缺失 lng/lat`：具体门店，暂不上图（待补坐标）；即使后续确认不再补坐标，也保持 `branch`，不要为了“不上图”改成 `brand`。

地图上点规则（`getMappableRestaurantsByCity`）：须 `record_scope=branch`、有效 `lng/lat`，且**不**满足：`record_scope=brand`、`closed` 为 `yes`（不区分大小写）、`address` trim 后为 `连锁店`。`branch` 但缺坐标会被自动过滤；`closed=yes` 或地址「连锁店」的店在菜品页仍展示。

`restaurants.xlsx` 可选列 `closed`：`yes` 表示已关闭；同步后写入 `restaurants.json`。

---

## 4.1) 多分店 `store_slug`（同城同品牌，通用）

> **所有多分店店铺均适用**（如南里山房 `nlsf`、耶里夏丽 `ylxl` 及今后任意新增）。规则由数据驱动，前端按 `(city_en, store_slug)` 自动归组，**禁止**为单店写 UI 白名单。
> 实现入口：[src/utils/storeGroups.js](../src/utils/storeGroups.js)

适用：同一城市有多家分店、菜品与照片只维护一份。

### Excel 录入

- 每个分店一行，`record_scope=branch`
- **相同** `store_slug`（如 `nlsf`、`ylxl`），各自填写 `name_zh`（含括号分店名）、`address`、`lng`、`lat`
- 同步后 `restaurants.json` 可出现重复 `(city_en, store_slug)` — 属预期
- 新增第 N 家分店：再增一行、**沿用同一 slug**，无需改代码

### dishes / 照片

- `dishes.xlsx`：`store_slug` 与组一致；`store_name_zh` 等写**基础店名**（不含括号分店名）
- 照片目录：`src/assets/photos/{city-folder}/{store_slug}/` 仅一套

### 页面行为（数据驱动，无白名单）

- 地图：每个**地图可见**分店独立打点（`getMappableRestaurantsByCity`，不去重；排除 brand / closed / 连锁店地址）；单 slug 单店标签去括号后缀，同 slug 多 `branch` 标签保留完整 `name_zh`（`pickMapTagDisplayName`）
- 菜品：左侧列表按 `(city_en, store_slug)` 合并为一项（`getCuisineStoreGroupsByCity`）；右侧地址多行展示各分店
- 菜系筛选：下拉项贴纸由 `cuisine_en` 加载，中文名用 `cuisine_zh`；排序与语言切换解耦（见 `prd-ui-spec.md` §4.3）

### 校验

```bash
npm run audit:multi-branch
```

输出当前所有「同城同 slug 多 branch」组；发布前建议跑一遍确认录入正确。

---

## 5) Google Places 回填流程（可选）

触发：你有城市来源 xlsx（`Title`/`URL`）要批量补店铺信息。

### 前置

- `.env.local` 中配置 **`GOOGLE_MAPS_API_KEY`**（Google Cloud 启用 **Places API**，与翻译用的 `VITE_GOOGLE_TRANSLATE_API_KEY` 是**两把不同的 key**）。
- 代码里只有 `scripts/fill-city-restaurants.mjs` 读取该变量（调用 `maps.googleapis.com` 的 Place Find/Details）。前端与其它 Node 脚本**不会**用到它。
- 模板见 `.env.example`；填好后可用下面命令自检（应输出 `Places API status: OK`）：

```bash
node -e "
import { loadEnvLocal } from './scripts/load-env-local.mjs';
loadEnvLocal();
const k = process.env.GOOGLE_MAPS_API_KEY?.trim();
const u = 'https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=Starbucks&inputtype=textquery&fields=place_id&key=' + encodeURIComponent(k);
const j = await (await fetch(u)).json();
console.log('Places API status:', j.status, j.error_message ?? '');
"
```

### 执行

```bash
node scripts/fill-city-restaurants.mjs
npm run data:sync
```

### 说明

- 该流程会回填名称、地址、坐标、营业时间等（遵守 `src/data/README.md` 规则）。
- 不是每次都要跑，仅在“批量数据导入/清洗”时使用。

---

## 6) 发布前最小检查

```bash
npm run data:sync
npm run audit:all
npm run audit:multi-branch
npm run build
```

若本次涉及城市边界或坐标相关数据，再加：

```bash
npm run audit:boundary-offsets
```

---

## 7) 常见故障快速定位

- `data:sync` 后 `restaurants=0`
  - 检查 `restaurants.xlsx` 是否缺 `store_slug` 或名称三选一全空
- 地图店铺不上图
  - 检查是否满足地图可见：`record_scope=branch`、`lng/lat` 有效，且非 `closed=yes`、非 `address=连锁店`、非 `record_scope=brand`
- 地图一直显示“加载中...”
  - 正常加载应无提示；若 `VITE_MAPBOX_TOKEN` 为空，应显示缺失提示
  - 若出现 Token/网络/样式请求失败（例如 `ERR_PROXY_CONNECTION_FAILED`），应显示「地图加载失败，请检查 Mapbox Token 或网络连接」并带错误细节
- 板块②图片存在但菜名没显示
  - 先检查图片 basename 是否命中 `dish_name_local -> dish_name_en -> dish_name_zh`，其次 `store_name_local -> store_name_en -> store_name_zh`
  - 轮播顺序：菜名图 → 店名图（含 `store_name_*` 全文、基础店名、分店 `name_*`）→ 其它非序号图 → 中文序号图（数值序）
  - 代码调用约束：`sortPhotosByDishMatch` 必须传当前店铺对象（`selectedStore`）作为第 3 参数，避免店名图匹配降级为“仅 dishes 键”
  - 若未命中菜名：仍应展示图片；basename 为中文数字序号（`一二三四五六七八九十`）时只显示图片，否则应显示 basename（不含扩展名）作为图片名称
- 板块②图片显示坏图标（但文件后缀是 `.jpg/.jpeg`）
  - 高概率是“扩展名是 JPG，但真实编码是 HEIC/HEIF”
  - 先运行 `npm run audit:photo-magic` 检查文件头
  - 若命中异常，先把文件转换为真实 JPEG 再放入 `src/assets/photos/`
- 非中国城市语言按钮不对
  - 检查 `src/data/city_meta.json` 的 `detail_locale_mode` 与 `native_*` 字段
- 翻译落盘没有变化
  - 检查 `.env.local` key 与 `VITE_ENABLE_MT=true` 是否开启（仅导出时临时开启）
- 菜系筛选无贴纸或显示 `other`
  - 检查 `cuisine_en` 是否与 `src/assets/stickers/cuisine/{cuisine_en}.svg` 文件名一致
  - 检查 `src/utils/cuisineSlugs.js` 的 `CUISINE_BY_EN` 是否含该 slug；DEV 控制台会有 Missing sticker 警告

---

## 8) 图片导入前格式自检（强烈建议）

触发：新增任意城市图片，或批量替换 `src/assets/photos/` 素材。

### 执行

```bash
npm run audit:photo-magic
```

### 通过标准

- 扫描结果为 0 条异常。
- `.jpg/.jpeg` 文件头应为 `FF D8 FF`（真实 JPEG）。
- `.png` 文件头应为 `89 50 4E 47`。
- `.webp` 文件头应满足 `RIFF....WEBP`。

### 失败处理

- 若报“HEIC disguised as JPG/JPEG”，说明文件扩展名与真实编码不一致。
- 先在本地把该图片转换为真实 JPEG（不要只改文件后缀），再重新运行自检直到通过。

---

## 9) 同步照片到 Cloudflare R2（线上相册必做）

触发：新增或替换了 `src/assets/photos/{city}/{store_slug}/` 下任意图片，且需要 Production / Preview 站点显示相册。

说明：**合并 PR 后 Vercel 只会部署前端与 `photo-manifest.json`，不会自动把图片上传到 R2。** 未上传时线上相册会裂图。

### 前置

- 本机 `.env.local` 含有效的 **`R2_*`**（见 `.env.example`）与其它自管密钥（**勿提交 Git**）
- Cloudflare R2 bucket 已开启公开访问（Custom Domain 或 `*.r2.dev`）
- Vercel 环境变量已配置 **`VITE_PHOTOS_BASE_URL`**（与 R2 公开根一致，无末尾 `/`）
- 建议先完成 §8 `npm run audit:photo-magic` 与 `npm run audit:filenames`

### 9.1) `.env.local` 与 `npm run env:pull-vercel`

| 变量 | 用途 |
| --- | --- |
| `R2_ACCOUNT_ID` | Cloudflare 账号 ID（R2 Overview） |
| `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` | R2 API Token（Object Read & Write，限定 bucket） |
| `R2_BUCKET_NAME` | 如 `vein-taste-album-photos` |
| `VITE_PHOTOS_BASE_URL` | 浏览器读图根 URL（Vercel 与本地各配一份） |

`npm run env:pull-vercel` 仅写入 **`.env.vercel`**（Vercel CLI 变量），**不会**覆盖 `.env.local`。照片上传**不依赖**该命令；R2 密钥在 Cloudflare 创建后手填 `.env.local`。

加载顺序（带 `loadEnvLocal()` 的 Node 脚本）：先 `.env.vercel`，再 `.env.local`，**同名键以 `.env.local` 为准**。

| 场景 | 要不要跑 `env:pull-vercel` |
| --- | --- |
| 需要从 Vercel 拉 `VERCEL_*` 等 CLI 变量到 `.env.vercel` | 可选 |
| 每次 `photos:upload-r2`、每次 `data:sync` | **不必** |
| `vercel env pull .env.local` 覆盖整份本地 env | **禁止** |

### 执行

```bash
npm run photos:manifest
npm run photos:upload-r2
```

可选预览（不上传）：`npm run photos:upload-r2 -- --dry-run`

对象 Key：`photos/{city}/{store}/{filename}`，与本地目录一致；已存在 Key 会被覆盖。

### 推荐节奏（与 Git / Vercel 配合）

1. 本地加图 → `data:sync` → 自检 → 分支 → PR
2. 本地 `npm run dev`（默认读本机 `photos/`，不必配 CDN）确认 UI
3. 合并 PR → Vercel 自动部署
4. **本机执行 §9 上传**（与部署并列，不可省略）
5. 打开 Production 验收；Network 确认图片来自 `VITE_PHOTOS_BASE_URL` 对应域名

### 通过标准

- 命令结束：`Done. Uploaded N file(s).` 且无 failure
- 线上店铺相册可加载
- 可选：`curl -I` 抽查  
  `https://你的照片域/photos/城市/店slug/某图.jpg` 返回 `200`

### 失败处理

- `Missing R2_*`：在 `.env.local` 补全四行，或到 Cloudflare R2 → API Tokens 重建
- `AccessDenied` / 403：密钥错、bucket 名错，或 Token 未含该 bucket 的写权限
- 单文件失败：检查文件名 URL 安全（`npm run audit:filenames`）
- 上传很慢：全量约 1290 张 / 1.7GB 属正常；可调 `PHOTO_UPLOAD_CONCURRENCY`（默认 4）
- 已配置 **rclone** 时可用 `rclone sync` 代替脚本，目标路径须为 `bucket/photos/...`（见 [deploy-vercel.md](deploy-vercel.md)）

详见 [deploy-vercel.md](deploy-vercel.md)。