# data-workflow.md · 数据与翻译固定流程手册

> 目标：把项目里“每次都要按顺序做”的操作集中到一处，减少漏步骤与返工。

---

## 0) 日常最常用流程（先看这个）

### 仅改 xlsx（无照片变动）

1. 运行 `npm run data:sync`
2. 若需要补齐非名称类文案翻译（静态落盘）：
  - 临时在 `.env.local` 设 `VITE_ENABLE_MT=true`
  - 运行 `npm run data:export-translations`
  - 完成后把 `.env.local` 改回 `VITE_ENABLE_MT=false`
3. 运行 `npm run build` 验证可构建

### 含照片增删改（见 §8、§9）

**阶段 A · 本地编辑**

1. §8 `npm run audit:photo-magic` + `npm run audit:filenames`
2. `npm run data:sync`
3. 可选 `npm run photos:thumbs`（仅本地 dev 首图加速，见 **§9.0**；不提交 Git）
4. `npm run dev` / `npm run build` 验收

**阶段 B · Git**

5. `create branch` → `commit` → `push` → PR

**阶段 C · CDN 同步（commit & push 之后；推荐 merge + Vercel 部署后）**

6. **§9.2** 增量同步 R2：`photos:thumbs` → `photos:manifest` → `npm run photos:sync-r2`（默认增量，**不要**日常全量）；merge 后已在 `main` 上见 **§9.2.1**
7. **§9.5** Production 无痕验收相册（Network 确认图片来自 `VITE_PHOTOS_BASE_URL`）；通用站点检查见 [deploy-vercel.md](deploy-vercel.md)

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

`restaurants.xlsx` 可选列 `recommend`：`yes` / `no` / 空（或 `null`）——菜品页店铺列表首行名称右侧显示推荐 / 不推荐标识；空则不显示。同城同 `store_slug` 的多分店行应填相同值。

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
  - 精确匹配菜名才显示 `dishes.json` 菜名与价格/星级/备注；basename 仅包含菜名（如 `菜名-横截面`）时只显示完整 basename
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

触发：对 `src/assets/photos/{city}/{store_slug}/` 做了增删改或重命名，且需要 Production / Preview 站点显示相册。

说明：

- **合并 PR 后 Vercel 只会部署前端与 `photo-manifest.json`，不会自动把图片同步到 R2。** 未同步时线上相册会裂图或残留旧图。
- **日常默认走增量同步**（`npm run photos:sync-r2` / `npm run photos:upload-r2`），对比 `origin/main...HEAD` 的 Git 变更；**不要**每次全量上传 ~1300 张。
- R2 同步应在 **commit & push 之后**（推荐 **merge + Vercel 部署后**）执行，确保线上 manifest 与照片变更同属一次发布。

### 9.0) 本地生成缩略图（本地 dev 可选）

触发：向 `src/assets/photos/{city}/{store_slug}/` 放入或替换了原图，且要在本机 `npm run dev` 时让相册首图更快显示。

说明：

- `npm run data:sync`、`predev` / `prebuild`（`photos:manifest`）**均不会**自动生成本地缩略图。
- 产出：`{原名}.thumb.webp`（宽 ≤800px，WebP），与原图同目录。
- 文件在 `.gitignore` 中，**不提交 Git**；可在 **阶段 A（commit 前）** 为本地 dev 提前执行。
- **阶段 C 上传 R2 前**建议再跑一遍，保证 CDN 缩略图与本地一致。

```bash
npm run photos:thumbs
```

通过标准：`[photos:thumbs] Done. wrote=N skipped=M`

### 9.1) 环境与凭证

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
| 每次 `photos:sync-r2`、每次 `data:sync` | **不必** |
| `vercel env pull .env.local` 覆盖整份本地 env | **禁止** |

前置：建议先完成 §8 `npm run audit:photo-magic` 与 `npm run audit:filenames`。

### 9.2) 增量同步 R2（默认）

触发：照片已 **commit & push**（或 merge 后），需要让 R2 与 Git 中本次变更一致。

```bash
npm run photos:thumbs
npm run photos:manifest
npm run photos:sync-r2
```

`photos:sync-r2` 与 `photos:upload-r2` 为同一脚本；**默认增量**，对比 `origin/main...HEAD` 下 `src/assets/photos/` 的 Git diff。

**照片 CRUD 与 R2 行为：**

| 本地操作 | Git 状态 | R2 动作 |
| --- | --- | --- |
| 新增图片 | `A` | 上传原图 + `{原名}.thumb.webp` |
| 同名换图 | `M` | 覆盖原图 + 缩略图 |
| 删除图片 | `D` | 删除原图 + 对应 `.thumb.webp` |
| 重命名 | `R` | 删除旧 Key，上传新 Key |

对象 Key：`photos/{city}/{store}/{filename}`，与本地目录一致。

**常用标志：**

```bash
npm run photos:sync-r2 -- --dry-run              # 预览 puts/deletes 数量
npm run photos:sync-r2 -- --working --dry-run    # 未 push 时：工作区 + 未跟踪文件
npm run photos:sync-r2 -- --base origin/main     # 显式指定对比基线
npm run photos:sync-r2 -- --skip-thumbs            # 仅原图（不推荐）
```

#### 9.2.1) merge 后已在 `main` 上同步（常见）

合并 PR 并 `git pull origin main` 后，本地 `HEAD` 往往已与 `origin/main` 一致，此时默认的 `origin/main...HEAD` **diff 为空**，`photos:sync-r2` 会输出 `Nothing to sync.`。

做法：用 **合并前** 的 `main` 提交作为基线，对比本次 release 带来的照片变更：

```bash
git checkout main && git pull origin main
# 记下 merge 前 main 的 SHA（示例：git log --oneline -3，取 merge commit 的父提交）
npm run photos:sync-r2 -- --base <合并前main的SHA> --dry-run   # 先预览 puts/deletes
npm run photos:thumbs
npm run photos:manifest
npm run photos:sync-r2 -- --base <合并前main的SHA>
```

说明：

- `<合并前main的SHA>` 即 merge commit 的**第一个父提交**（`git log -1 --format=%P` 的空格前一段），或你记得的「合并前最后一笔 main」。
- 仍在 feature 分支、尚未 merge 时：在分支上直接 `npm run photos:sync-r2`（默认 `origin/main...HEAD`）即可，无需 `--base`。

**通过标准：**

- 命令结束：`Done. uploaded=N deleted=M`，且无 failure
- `--dry-run` 时对象数应接近「变更原图数 × 2」，而非 ~1308 × 2
- 线上相册可加载；已删本地图在 R2 上应 404
- 可选：`curl -I` 抽查新图返回 `200`

**失败处理：**

- 线上仍显示已删图片：确认本次 sync 输出含 `deleted>0`；若变更未 push，用 `--working` 或先 push 再 sync
- `Missing R2_*` / `AccessDenied`：检查 `.env.local` 四行 `R2_*` 与 Token 权限
- 单文件失败：检查文件名 URL 安全（`npm run audit:filenames`）

### 9.3) 全量上传（例外场景）

仅用于：**首次铺库**、怀疑 R2 与本地严重漂移、灾难恢复。

```bash
npm run photos:sync-r2 -- --full
```

说明：

- 遍历本地全部原图并 `PutObject`；**不会**删除 R2 上本地已不存在的孤儿对象。
- 体量大（约 1308 张 / 1.7GB），耗时长；**不要**作为日常默认。
- 可调 `PHOTO_UPLOAD_CONCURRENCY`（默认 4）加速。

### 9.4) rclone 备选（镜像同步）

已配置 **rclone** 时，可用镜像同步代替 npm 脚本（天然支持增删改）：

```bash
rclone sync "src/assets/photos/" "r2vein:vein-taste-album-photos/photos/" -P --transfers 8
```

目标路径须为 `bucket/photos/...`。`sync` 会使 R2 与本地目录一致（含删除）；操作前请确认本地目录即为期望真源。

### 推荐节奏（与 Git / Vercel 配合）

1. **阶段 A**：§8 自检 → `data:sync` → 可选 `photos:thumbs` → `dev` / `build` 验收
2. **阶段 B**：分支 → commit → push → PR
3. **阶段 C**：merge → Vercel 部署 → `photos:thumbs` → `photos:manifest` → `photos:sync-r2`（增量；merge 后 on `main` 见 **§9.2.1**）
4. **§9.5** Production 无痕验收相册

详见 [deploy-vercel.md](deploy-vercel.md)。

### 9.5) Production 无痕验收相册（阶段 C 收尾）

触发：阶段 C `photos:sync-r2` 已成功（`uploaded` / `deleted` 符合预期），且 Vercel Production 已部署。

**准备**

1. Chrome / Safari / Edge 打开**无痕/隐私窗口**（避免旧缓存）。
2. 打开开发者工具 → **Network**；**不要**勾选 Disable cache。
3. Filter 可填 R2 照片域（如 `photos.veintastealbum.com`）或 `photos/shanghai`，便于只看相册请求。

**操作**

1. 打开 https://www.veintastealbum.com/ ，点书架上的目标城市（或直接 `https://www.veintastealbum.com/shanghai`）。
2. 停留在 **美食** Tab；在左侧列表点选本次变更涉及的店（按 `name_zh` 或 `store_slug` 辨认）。
3. 每家店：板块②应出现缩略图/轮播，**无裂图**；连点多张图，大图与菜名/图片名应同步切换。
4. Network 中相册图片 URL 应形如  
   `https://<VITE_PHOTOS_BASE_URL 的 host>/photos/{city}/{store_slug}/{文件名}`  
   状态码 **200**；缩略图路径含 `.thumb.webp`。
5. 若本次有**删图**：对应旧文件名在 R2 上应 **404**（店内不应再出现该图）。

**通过标准**

- 新店/变更店相册可正常浏览，无长期裂图或错位。
- 图片请求来自 R2/CDN 域，而非主站打包的 `assets` 路径。
- 通用站点项（地图懒加载、Safari 预加载等）见 [deploy-vercel.md](deploy-vercel.md)「三浏览器验收」。