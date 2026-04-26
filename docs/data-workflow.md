# data-workflow.md · 数据与翻译固定流程手册

> 目标：把项目里“每次都要按顺序做”的操作集中到一处，减少漏步骤与返工。

---

## 0) 日常最常用流程（先看这个）

适用场景：你改了 `restaurants.xlsx` / `dishes.xlsx`，要刷新站点数据。

1. 运行 `npm run data:sync`
2. 若需要补齐非名称类文案翻译（静态落盘）：
  - 临时在 `.env` 设 `VITE_ENABLE_MT=true`
  - 运行 `npm run data:export-translations`
  - 完成后把 `.env` 改回 `VITE_ENABLE_MT=false`
3. 运行 `npm run build` 验证可构建

---

## 1) Workbook -> JSON 同步流程

触发：修改了 `src/data/restaurants.xlsx` 或 `src/data/dishes.xlsx`。

### 前置检查

- `restaurants.xlsx` 至少满足：
  - `city_en`
  - `store_slug`
  - `record_scope`（`branch` / `brand`）
  - `name_zh/name_en/name_local` 至少一个
- `dishes.xlsx` 至少满足：
  - `city_en`
  - `store_slug`
  - `dish_name_zh/dish_name_en/dish_name_local` 至少一个

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

触发：非中国城市可变文案（如 `cuisine/address/hours`）有缺失语言，需要一次补齐并固定。

### 前置

- `.env` 中具备：
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

- `.env` 设回 `VITE_ENABLE_MT=false`（生产默认关闭 MT）

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
4. 补齐城市贴纸与图片目录（按 `store_slug`）
5. 跑数据同步：`npm run data:sync`
6. 需要时跑静态翻译导出：`npm run data:export-translations`
7. 跑边界审计：`npm run audit:boundary-offsets`
8. 跑构建验证：`npm run build`

---

## 4) record_scope 使用规范

- `brand`：品牌层记录，不作为地图点位，不应被当作具体门店。
- `branch + 有效 lng/lat`：具体门店，可上图。
- `branch + 无效/缺失 lng/lat`：具体门店，暂不上图（待补坐标）；即使后续确认不再补坐标，也保持 `branch`，不要为了“不上图”改成 `brand`。

地图上点规则：必须同时满足 `record_scope=branch` 且有有效 `lng/lat`；`branch` 但缺坐标会被自动过滤，不上图。

---

## 5) Google Places 回填流程（可选）

触发：你有城市来源 xlsx（`Title`/`URL`）要批量补店铺信息。

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
  - 检查是否 `record_scope=branch` 且 `lng/lat` 有效
- 地图一直显示“加载中...”
  - 正常加载应无提示；若 `VITE_MAPBOX_TOKEN` 为空，应显示缺失提示
  - 若出现 Token/网络/样式请求失败（例如 `ERR_PROXY_CONNECTION_FAILED`），应显示「地图加载失败，请检查 Mapbox Token 或网络连接」并带错误细节
- 板块②图片存在但菜名没显示
  - 先检查图片 basename 是否命中 `dish_name_local -> dish_name_en -> dish_name_zh`
  - 若未命中：仍应展示图片；basename 为中文数字序号（`一二三四五六七八九十`）时只显示图片，否则应显示 basename（不含扩展名）作为图片名称
- 非中国城市语言按钮不对
  - 检查 `src/data/city_meta.json` 的 `detail_locale_mode` 与 `native_*` 字段
- 翻译落盘没有变化
  - 检查 `.env` key 与 `VITE_ENABLE_MT=true` 是否开启（仅导出时临时开启）

