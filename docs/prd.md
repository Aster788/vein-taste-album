# 产品需求文档 · 旅行美食推荐网站

---

## 一、产品概述

### 1.1 产品定位

一个私人旅行美食推荐网站，以"书"为核心视觉语言，记录用户走过的城市和收藏的美食店。整体气质：手帐风、温暖有质感，让每一位访客感受到幸福感和探索欲。

### 1.2 Slogan

展示格式（中英双语，两行）：

```
世界这本书 我想一直读       ← 沐瑶软笔手写体，较大字号
I wander, I wonder, I fall in love with the world-again and again   ← 沐瑶软笔手写体，字号缩小，中文下方
```

动画分两阶段执行（详见第三节）：

1. 打字机效果：中文行逐字打出全部10个字，打字完成后英文行淡入显示
2. 打字完成后：两行文字整体呈横幅被风吹动的飘动动画

### 1.3 技术栈


| 层级     | 技术                                                                           |
| ------ | ---------------------------------------------------------------------------- |
| 前端框架   | React（Vite）                                                                  |
| 地图渲染   | Mapbox GL JS（自定义暖白纸感样式：底色米白 `#F7F3EE`，道路浅暖灰，水域淡蓝，高对比度，兼顾纸质感与可读性）             |
| 行政区划边界 | GeoJSON 文件（本地，每个城市一个文件）                                                      |
| 坐标转换   | gcoord 库（GCJ-02 → WGS-84，仅中国城市）                                              |
| 数据     | 本地 JSON 文件（restaurants.json + dishes.json），无后端                               |
| 图表     | Chart.js（雷达图）                                                                |
| 贴纸素材   | SVG， 存放于本地 stickers 文件夹下                                                     |
| 字体     | 霞鹜文楷（本地 `LXGWWenKai-Regular.ttf`）、Playfair Display（Google Fonts）、沐瑶软笔手写体（本地） |
| 部署     | 静态托管（Vercel）                                                                 |


### 1.4 地图数据架构说明

> ⚠️ 重要：高德/谷歌 API 仅用于**数据准备阶段**，网站运行时只调用 Mapbox，不实时请求高德或谷歌。

```
数据准备阶段（建表时手动操作）：
  中国城市店铺   → 用高德 API/App 查询经纬度、地址、营业时间、人均、…… → 填入 Excel
  非中国城市店铺  → 用谷歌 API/Maps 查询经纬度、地址、营业时间、人均、…… → 填入 Excel

网站运行时：
  Mapbox 读取 restaurants.json 中的 lng/lng 字段渲染标注点
  不再实时调用高德或谷歌（避免双SDK冲突）

地图跳转链接：
  中国城市店铺   → map_platform: "amap"，map_url 为高德链接
  非中国城市店铺  → map_platform: "google"，map_url 为谷歌地图链接
```

> ⚠️ 坐标系转换：Mapbox 使用 WGS-84，高德返回 GCJ-02，直接混用会导致中国城市图层整体偏移（常见数百米量级）。
> 处理方式（必须同时满足）：
> 1) **点图层**：读取 restaurants.json 时将中国城市店铺坐标从 GCJ-02 转换为 WGS-84 后再传给 Mapbox。  
> 2) **边界图层**：读取中国城市 GeoJSON 后也必须执行 GCJ-02 → WGS-84，再作为 GeoJSON source 加载。  
> 非中国城市（济州岛、吉隆坡……）使用原生 WGS-84 数据，不做转换。
> 非中国城市（济州岛、吉隆坡……）使用谷歌坐标，原生 WGS-84，无需转换。

### 1.5 城市列表（共10本书）


| 编号  | 城市中文 | 城市英文         | 国家   | 语言类型  |
| --- | ---- | ------------ | ---- | ----- |
| 1   | 大连   | Dalian       | 中国   | 中文城市  |
| 2   | 青岛   | Qingdao      | 中国   | 中文城市  |
| 3   | 上海   | Shanghai     | 中国   | 中文城市  |
| 4   | 广州   | Guangzhou    | 中国   | 中文城市  |
| 5   | 重庆   | Chongqing    | 中国   | 中文城市  |
| 6   | 福州   | Fuzhou       | 中国   | 中文城市  |
| 7   | 厦门   | Xiamen       | 中国   | 中文城市  |
| 8   | 泉州   | Quanzhou     | 中国   | 中文城市  |
| 9   | 济州岛  | Jeju         | 韩国   | 多语言城市 |
| 10  | 吉隆坡  | Kuala Lumpur | 马来西亚 | 多语言城市 |


### 1.6 城市地图中心坐标（Mapbox 初始化用，均为 WGS-84）


| 城市  | 纬度 lat  | 经度 lng   | 推荐缩放级别 |
| --- | ------- | -------- | ------ |
| 大连  | 38.9140 | 121.6147 | 11     |
| 青岛  | 36.0671 | 120.3826 | 11     |
| 上海  | 31.2304 | 121.4737 | 11     |
| 广州  | 23.1291 | 113.2644 | 11     |
| 重庆  | 29.5630 | 106.5516 | 11     |
| 福州  | 26.0745 | 119.2965 | 11     |
| 厦门  | 24.4798 | 118.0894 | 11     |
| 泉州  | 24.8741 | 118.6757 | 11     |
| 济州岛 | 33.4996 | 126.5312 | 10     |
| 吉隆坡 | 3.1390  | 101.6869 | 11     |


> 中国城市 POI 标注点坐标需额外做 GCJ-02→WGS-84 转换，城市中心坐标已是 WGS-84 可直接用于初始化。

---

## 二、设计系统（索引）

本章细则已拆分至专题文档：

- UI 与视觉规范：`docs/prd-ui-spec.md`
- 语言切换与文案回退：`docs/prd-i18n-locale.md`

仅保留总纲约束：

- 视觉与交互改动优先维护 `prd-ui-spec.md`。
- 语言按钮、回退链、名称类字段策略优先维护 `prd-i18n-locale.md`。

---

## 三、第一页：书架页面（索引）

书架页面布局、动效与交互细则已迁移至 `docs/prd-ui-spec.md`（对应原 3.1~3.5）。

---

## 四、第二页：城市详情页（索引）

城市详情页（板块①/②）布局与交互细则已迁移至 `docs/prd-ui-spec.md`。
涉及语言切换联动的规则统一维护在 `docs/prd-i18n-locale.md`。

---

## 五、数据结构

### 5.1 主数据文件：restaurants.json

所有城市所有店铺在一个 JSON 数组里，按 `city_en` 字段筛选。

```json
[
  {
    "city_zh": "大连",
    "city_en": "Dalian",
    "country_zh": "中国",
    "country_en": "China",
    "is_china": true,

    "name_zh": "店铺中文名",
    "name_en": "",
    "cuisine": "韩餐",
    "address": "大连市中山区XX路XX号",
    "lat": 38.9140,
    "lng": 121.6147,
    "price_per_person": 80,
    "currency": "CNY",
    "hours": "10:00–22:00",
    "phone": "",
    "map_platform": "amap",
    "map_url": "https://...",

    "dining_type": "dine_in",

    "score_taste": 4.5,
    "score_service": 4.0,
    "score_queue": 3.5,
    "score_overall": 4.5,
    "score_packaging": null,
    "score_delivery": null
  }
]
```

字段说明：

- `is_china`：布尔值，用于判断是否需要 GCJ-02→WGS-84 坐标转换，以及是否显示语言切换按钮
- `currency`：货币单位，中国城市填 `CNY`，济州岛填 `KRW`，吉隆坡填 `MYR`
- `name_en`：可为空字符串，中文餐厅无需强制填写
- 堂食时 `score_packaging` 和 `score_delivery` 填 `null`；外带时 `score_delivery`填 `null`；外卖时 `score_environment`, `score_service` 和 `score_queue` 填 `null`

### 5.2 菜品数据文件：dishes.json

独立文件，与 restaurants.json 通过店铺名称字段关联（`store_name_zh` / `store_name_en` / `store_name_local` 任一可匹配），并携带 `store_slug` 作为图片目录定位键。

```json
[
  {
    "store_name_zh": "店铺中文名",
    "store_name_en": "",
    "store_name_local": "",
    "store_slug": "xssss",
    "city_en": "Dalian",

    "dish_name_zh": "红烧带鱼",
    "dish_name_en": "Braised Cutlassfish",
    "dish_name_local": "",
    "price": "38",
    "taste": 5
  }
]
```

> **变更说明**：`dishes.json` **不包含 `review` 字段**；Excel **dishes 表不设 `review` 列**。菜品长文字评价不在本文件中维护；板块②「评价层」**仅展示口味星级**（由 `taste` 渲染，见 4.3 节）。

字段说明：

- `dish_name_local`：菜品本国语言名称（如韩文、马来文、日文）；缺失可留空字符串
- `dish_name_zh` / `dish_name_en`：所有城市都填，便于多语言展示
- `**price`：一律为 JSON 字符串（`string`）**。纯金额写作 `"38"`；按件/重量等计价写作 `"19/个"`、`"24/对"`、`"10/斤"` 等，不解析为数字。
- 菜名层价格展示规则（板块②）：
  - 命中菜品且 `price` 与 `currency` 有值时，在菜名首行后追加价格，格式为「菜名 + 两个空格 + 币种符号+price」。
  - 货币前缀规则：不维护固定映射表；前端按 `currency`（ISO 4217）动态解析币种符号（如 `JPY -> ¥`、`THB -> ฿`、`CNY -> ¥`）。若运行环境无法解析，则回退为 `currency` 代码前缀。
  - 若 `price` 已自带币种符号/文本（如 `¥`、`₩`、`RM`、`CNY`、`KRW`、`MYR`），前端保持原值，不重复追加。
  - 若 `price` 未带币种且 `currency` 有值，即使是 `"19/个"`、`"11/斤"` 这类描述型价格，也必须补对应币种前缀后展示。
- `taste`：JSON **数字**（`number`），主观口味档位，取值 **整数 `1`、`2`、`3`、`4`、`5`**，分别对应 **一星～五星** 的展示强度。**数据层只存数字，不存 `⭐` 等字符**；页面上由**统一工具函数**将数值渲染为星标（如 Unicode `⭐` 重复 `taste` 次，或等价空心/实心方案，全站一套规则）。若日后需半档（如 `4.5`），再扩展同一渲染函数与建表约定，不在 JSON 手写星串。板块②展示见 4.3 节。
- `store_slug`：图片目录定位键，对应 `assets/photos/{city}/{store_slug}/`
- 图片匹配规则（所有城市统一）：代码取图片 basename（去扩展名）后，按顺序匹配菜品 `dish_name_local` → `dish_name_en` → `dish_name_zh`；命中任一即视为该图属于该菜。比对前需做 `trim` 与 Unicode 规范化（NFC）

### 5.3 地图行政区划数据：GeoJSON 文件

每个城市一个 GeoJSON 文件，存放在 `/assets/geojson/` 文件夹下：

```
/assets/geojson/
  dalian.geojson
  qingdao.geojson
  shanghai.geojson
  guangzhou.geojson
  chongqing.geojson
  fuzhou.geojson
  xiamen.geojson
  quanzhou.geojson
  jeju.geojson
  kuala-lumpur.geojson
  …
```

#### 非中国城市：地图上「分区」边界的统一规则

**总原则**：先遵守统一的**选型顺序**与**入库门槛**；每个城市在该顺序内选取**许可清晰、几何可用**的一组多边形。仅当没有合格数据源、或边界口径与产品定义冲突时，再就该城单独讨论例外方案。

**数据源优先级（从高到低）**

1. **官方行政区划（城市内下一级）**  
   如市辖区、行政区等公众认知中的「市里分区」。目标块数约 **8～20**（读图清晰）。许可须允许纳入本仓库分发，或须在构建说明 / 要素属性中可追溯引用。
2. **国际开放行政边界库**  
   如 geoBoundaries、GADM 等，在官方矢量难获取或授权不清晰时使用。须核对 **ADM 级别** 与粒度，避免整城仅 **1～2** 块过粗，或 **数百块** 过细不可读。
3. **非纯民政但覆盖完整、用户熟悉的区划**  
   例如**国会选区 / 选举分区**等。仅当同时满足：**覆盖全市、无明显空洞、块数仍落在可接受区间**、且产品需要标出用户熟知地名时采用。须在要素属性中注明类别（如 `ffj_admin`）与数据来源，避免与口语中的「行政区」混为一谈。
4. **兜底**  
   对过细的官方网格做**人工合并**，或改用上一级 ADM，使块数回到约 **8～20**（可接受 **5～30**）。

**每个非中国城市入库前须满足**

- **几何**：标准 `FeatureCollection`，Ring 闭合，坐标为 **WGS-84**，可被 Mapbox GeoJSON 源稳定加载。
- **命名**：每个分区建议具备 `name`、`name_en`；`name_zh` 能补则补（地图展示可退化为单行）。
- **覆盖**：与产品当前定义的该城范围一致，无明显越界或漏划。
- **许可与出处**：许可证可追溯；必要时在要素属性（如 `ffj_source`）或本节变更说明中写明上游数据集名称与版本。

**与中国城市的区别**

- **中国城市**：默认仍以 **DataV 区级** 为获取方式（见下节）。
- **非中国城市**：**不强制**与中国城同级数据源；按本节优先级在**各城**选取最优解，避免无规则的「一城一议」，同时保留例外升级路径。

**当前示例（对齐口径，非穷尽）**

- **吉隆坡**：采用 Wilayah Persekutuan **2015 年国会议席（PAR）**多边形（`ffj_admin = mys_parliament_wpkl_2015`），来源 TindakMalaysia `Federal-Territories-Maps` 中 `Kuala_Lumpur_PAR_2015.geojson`，属优先级 **3**；可用仓库内 `scripts/build_kuala_lumpur_par_geojson.py` 复现生成。
- **济州岛**：优先按 **1～2** 选取官方或开放库中的市内分区；若使用 OpenStreetMap，须注明 `admin_level` 与 ODbL 许可，并自检几何质量。

**获取方式（免费，无需额外 API Key）：**

中国城市 → 阿里云 DataV 地图选择器：

```
网址：datav.aliyun.com/portal/school/atlas/area_selector
操作：选择省份 → 城市 → 区级 → 下载 GeoJSON
```

> **说明**：济州岛、吉隆坡等**实际入库**的 GeoJSON 可按上节「非中国城市：分区边界统一规则」选用**已审核的其他来源**；下文 Overpass 仅作为**可选**获取途径（例如从 OSM 拉取关系几何），不保证粒度与产品当前口径一致。

济州岛、吉隆坡 → Overpass Turbo（失败）：

```
网址：overpass-turbo.eu
济州岛查询语句：
  [out:json];
  relation["name:en"="Jeju-si"]["admin_level"="5"];
  out geom;
吉隆坡查询语句：
  [out:json];
  relation["name"="Kuala Lumpur"]["admin_level"="5"];
  out geom;
操作：粘贴语句 → 点击 Run → 点击 Export → 选 GeoJSON 下载
```

济州岛、吉隆坡 → 用 Overpass API 直接下载GeoJSON，不需要经过overpass-turbo的界面：

```
济州岛，直接在浏览器打开链接：
https://overpass-api.de/api/interpreter?data=[out:json];relation(2398560);out geom;
吉隆坡：
https://overpass-api.de/api/interpreter?data=[out:json];relation(2939672);out geom;
打开后Ctrl+S（Mac是Cmd+S） 保存页面，保存时把文件名改成 jeju.geojson 和 kuala-lumpur.geojson ，文件类型选"所有文件"，不要选"网页"。
```

### 5.4 Excel 主数据表列名清单

建表时直接用以下列名（restaurants 表）：

```
city_zh / city_en / country_zh / country_en / is_china /
store_slug / name_zh / name_en / cuisine / address /
lng / lat / price_per_person / score_overall / currency / hours / phone /
map_platform / map_url / dining_type /
score_taste / socre_environment / score_service / score_queue /
score_packaging / score_delivery / score_personal
```

restaurants 表补充填表约束：

- 必填：`store_slug`
- 名称要求：`name_zh` / `name_en` / `name_local` 至少一列有值
- 其余列均可为空（非必填）
- `price_per_person` 必须为数值单元格，不得带货币符号；币种统一写在 `currency` 列。
- `score_overall` 必须为数值单元格，统一保留 1 位小数。
- 以上两列禁止混用文本数字与数值，避免导出与前端消费时出现类型不一致。
- `is_china` 统一填写小写字符串 `true` / `false`。

Google Places 自动补全约束（适用于 Excel 回填）：

- 来源表扫描 `src/data/*.xlsx` 时，排除 `restaurants.xlsx`、`dishes.xlsx` 与 `~$` 临时文件。
- 店名多语言写入：同一 `place_id` 分别拉取并写入 `name_zh` / `name_en` / `name_local`；缺失语言保持空值。
- `name_zh` 禁止写入纯英文值（仅当包含中文字符时写入）。
- `name_en` 仅允许写入纯英文值（非纯英文则保持空值）。
- `hours` 文本统一规则：
  - 星期段与时间段之间使用空格，不使用冒号；
  - 全周一致时写作 `周一至周日 xx:xx–xx:xx`；
  - 连续日期段用 `至` 合并；
  - 非连续但同时段的多个日期段用 `、` 合并。
- 重跑保护：
  - `name_zh`、`hours`、`cuisine` 在单元格已有非空值时不覆盖；
  - 其中 `cuisine` 允许首跑空值自动填充，后续非空即锁定。

dishes 表列名：

```
store_slug / store_name_zh / store_name_en / store_name_local / city_en /
dish_name_zh / dish_name_en / dish_name_local /
price / taste
```

dishes 表补充填表约束：

- 必填：`store_slug`
- 菜名要求：`dish_name_zh` / `dish_name_en` / `dish_name_local` 至少一列有值
- 其余列均可为空（非必填）

`**dishes.price`（Excel）**：整列格式设为 「文本」，再填写内容，避免 `19/个` 等被误判为日期。转换到 `dishes.json` 时 `**price` 必须输出为带双引号的字符串**，与上节约定一致。

`**dishes.taste`（Excel）**：整列填 **整数 `1`～`5`**（常规数字单元格即可），表示口味档位；**勿在表格中填写星号字符**。导出到 `dishes.json` 时 `taste` 为 **JSON number**（示例：`"taste": 4` 中的 `4` 无引号）。

> Excel 建好后，让 Cursor 将其转换为 restaurants.json 和 dishes.json，无需手写 JSON。
> 每次新增店铺/菜品：在 Excel 中新增行 → 让 Cursor 重新转换 → 覆盖对应 JSON 文件。

### 5.5 图片文件夹规范

```
/assets/photos/
  /dalian/
    /xssss/
      鹅肝寿司.jpg
      柚子比目鱼寿司.jpg
  /jeju/
    /jeju-black-pork/
      흑돼지구이.jpg
      Black Pork BBQ.jpg
  /kuala-lumpur/
    /kl-jalan-alor-01/
      Nasi Lemak.jpg
```

命名规则（所有城市统一）：

- 城市文件夹：使用 `city_en` 的 slug 形式（中国城市用拼音小写；非中国城市用英文小写连字符）
- 店铺文件夹：使用 `store_slug`（来源于 `restaurants.xlsx` / `restaurants.json`）
  - 格式：`[a-z0-9-]+`
  - 唯一性：至少保证 `(city_en, store_slug)` 唯一
  - 语义：仅作资源路径键，不要求等于 `name_en` / `name_local` / `name_zh`
- 图片文件名：允许使用任一已知菜名语言版本（`dish_name_local` / `dish_name_en` / `dish_name_zh`），推荐优先本国语言
- 代码匹配：去扩展名后的 basename 依次匹配 `dish_name_local` → `dish_name_en` → `dish_name_zh`；命中任一即归属该菜
- 未命中兜底：若 basename 未命中任何菜品，图片仍在所属 `store_slug` 下展示；basename 为中文数字序号（`一二三四五六七八九十`）时不显示名称，否则显示 basename（不含扩展名）作为图片名称
- 文件格式一致性：扩展名必须与真实编码一致（`.jpg/.jpeg` 必须是 JPEG 文件头 `FF D8 FF`）。禁止仅修改后缀名把 HEIC/HEIF 伪装为 JPG。

---

## 六、开发分阶段计划

> 策略：先完成大连一个城市的完整体验，结构跑通后，其余城市复用填数据。

---

### Phase 0：准备工作（开始写代码前，你来完成）

**账号与 Token：**

- 注册 Mapbox 账号，获取 Access Token（需绑定信用卡，免费额度足够个人使用）
- 注册高德开放平台，申请 Web JS API Key（仅用于数据准备阶段查询店铺信息）

**数据准备：**

- 在 Excel 中建立 restaurants 表，列名按 5.4 节清单
- 用高德查询大连所有店铺经纬度（GCJ-02，Cursor 负责转换）、地址、营业时间、人均，填入表中
- 手动填写个人评分、dining_type 等字段
- 建立 dishes 表，列名按 5.4 节清单，填入大连所有店铺的菜品信息（含 `price`、`taste` 等；**不含 `review` 列**）
- 两张表建好后，让 Cursor 转换为 restaurants.json 和 dishes.json

**素材准备：**

- 整理大连店铺图片，按 5.5 节规范命名（目录使用 `store_slug`；文件名可用 `dish_name_local` / `dish_name_en` / `dish_name_zh` 之一）
- 从阿里云 DataV 下载大连市区级 GeoJSON 文件，存为 `assets/geojson/dalian.geojson`
- 从 Icons8 / Flaticon 下载城市书脊贴纸 SVG
- 下载菜系筛选贴纸 SVG（日料、中国菜、融合菜、饮品等对应食物图标）

---

### Phase 1：项目初始化 + 全局设计系统

**喂给 Cursor：prd.md 第一节 + 第二节**

- 创建 React 项目（Vite + React）
- 引入 gcoord 库（GCJ-02→WGS-84 坐标转换）
- 配置全局 CSS 变量（10 套城市配色 token、字体变量、纸质纹理）
- 引入字体：霞鹜文楷（本地 `LXGWWenKai/LXGWWenKai-Regular.ttf` + `@font-face`）、Playfair Display（Google Fonts）、沐瑶软笔手写体（本地）
- 建立路由：`/`（书架页）和 `/:city`（城市详情页）
- 载入 restaurants.json 和 dishes.json，建立全局数据读取工具函数
- 建立语言切换全局状态（Context）：中国城 `EN/CN`；非中国城按 §2.5（`EN/<ISO639-1>/CN` 或 `EN/CN`）；并预留「作者原文优先 + 缺失机器翻译补齐 + A 回退」策略（名称类字段除外，见 §2.5）

---

### Phase 2：书架页面

**喂给 Cursor：prd.md 第三节**

- 书架横向布局，左右平滑滚动
- 单本书 3D 样式（CSS perspective，书脊+封面+厚度三个面）
- 书脊文字（中英双语竖排，霞鹜文楷+Playfair Display）
- 书脊城市主色 + 纸质纹理
- 书脊贴纸 SVG
- Slogan 打字机动画（Phase 1：逐字打出）
- Slogan 飘动动画（Phase 2：打字完成后触发，CSS keyframes）
- Slogan 旁贴纸（地球仪、飞机、图钉）
- 页面右上角语言切换按钮（书架页不显示；中国城 `EN/CN`，非中国城按 §2.5；**不**切换书脊文字，见 §2.5）
- 指针分界 yaw：光标左右为界，左侧书渐露正面、右侧渐露反面（反面弱于正面）；横向滚动仅浏览书排
- 命中抽出：仅光标落在该书槽内时 `translateZ` 抽出（`300ms ease-out`）
- 脚印导航：点击脚印可让对应书本平滑居中到视口中线
- 点击：跳转到 `/:city` 路由

---

### Phase 3：第二页框架 + 顶部导航

**喂给 Cursor：prd.md 第四节开头（4.1）**

- 城市详情页整体布局（书本两页摊开，含中缝折痕阴影）
- 顶部三色块导航栏
- 板块①②切换逻辑（按压效果 + 内容区切换）
- 城市主色动态应用（根据路由参数读取配色 token）
- 语言切换按钮：城市详情页右上角显示（中国城 `EN/CN`；非中国城按 §2.5）；书架页不显示
- 语言切换联动（Context 全局更新所有文字）

---

### Phase 4：板块①地图

**喂给 Cursor：prd.md 第四节 4.2**

- Mapbox 初始化，加载城市中心坐标和缩放级别
- 地图使用 Mapbox Light 样式作为基础（style: 'mapbox://styles/mapbox/light-v11'），在代码里把地图背景色改为 #F7F3EE，道路颜色改为浅暖灰，水域保留淡蓝色
- 加载城市 GeoJSON，渲染行政区划边界线 + 区名文字标注
- 读取当前城市店铺数据，gcoord 转换坐标（中国城市），渲染标注点
- 标注点连线引出店铺名标签（标签文案固定 `name_zh → name_en → name_local`，不随语言切换；见 §4.2）
- 右侧书脊菜系便利贴标签，点击筛选高亮/变灰
- 右侧笔记信息区：默认引导文字状态
- 点击标注点：笔记区展示店铺信息（店名按作者数据展示且不随语言切换；店名右侧地图跳转图标；菜系、综合评分、人均、营业时间、雷达图等字段标签随语言策略展示）
- 地图跳转图标（品牌SVG，点击新标签页打开 map_url）
- 雷达图（Chart.js，按评分字段“有值即显示”动态渲染，不显示 tooltip）
- 笔记区横线样式  + 适量留白
- 地图加载异常提示：正常加载无提示；Token 为空显示缺失提示；Token/网络/样式失败显示错误提示与细节，不得一直停留在「地图加载中...」

---

### Phase 5：板块②杂志详情

**喂给 Cursor：prd.md 第四节 4.3**

- 左页菜系筛选标签（含贴纸）
- 店铺列表（音乐播放器样式，序号+店名，默认选中第一项）
- 非中国城市店铺列表店名：固定多行 `name_zh → name_en → name_local`（不参与语言切换；见 §4.3）
- 菜系筛选样式：下拉按钮 + 下拉框（每项：贴纸 + 菜系名 + 店铺总数）
- 菜系筛选排序：`全部` 固定首位；其余按 `count` 降序；同 `count` 按中文拼音 `A-Z`；数字开头排在字母后
- 店铺列表排序：按 `name_zh` 中文拼音 `A-Z`；`name_zh` 为空时回退 `name_en` 再回退 `name_local`；数字开头排在字母后
- 列表高亮切换逻辑
- 列表键盘导航：焦点在店铺列表区域内时，按 `↑` / `↓` 键可切换上/下一家店铺，焦点跟随移动
- 列表最后一行显示 AND MORE TO COME
- 右页顶部地址区（地点图标+小字地址，无地址时自动隐藏）
- 右页拍立得图片区（白边框、随机微旋转、阴影、胶带贴纸）
- 图片右侧菜品信息区（菜名层 + 评价层：菜名通过文件名匹配 `dishes.json` 条目；`taste` 按 5.2 节渲染为星标；**无 `review` 文字字段**，**有 `note` 文字字段**）
- 非中国城市菜名展示：`dish_name_zh` / `dish_name_en` / `dish_name_local` 只要有值就都展示（每行一个，固定顺序）
- 文件名未匹配 `dishes.json` 时：图片仍展示；basename 为中文数字序号（`一二三四五六七八九十`）仅显示图片，其它 basename 显示为图片名称（不含扩展名）
- 图片支持放大/缩小（点击放大，再点击或者按ESC关闭）
- 图片切换（页码点 + 左右按钮）
- 异常处理：无图占位、无匹配店铺提示、无地址隐藏

---

### Phase 6：打磨与扩展

- 翻书过渡动画（书架→第二页展开效果）⭐ 锦上添花
- 填入剩余10个城市数据（GeoJSON + restaurants + dishes + 图片）
- 整体贴纸位置微调
- 全站语言切换验证（中国城 `EN/CN`；非中国城按 §2.5；Map 店铺名标签与 Cuisine 名称多行展示符合 §2.5 / §4.2 / §4.3）
- 响应式适配（1280px以上宽屏完好）
- 域名购买 + 部署 Vercel

---

## 七、每次使用 Cursor 的建议方式

1. 每次只做一个 Phase，不跨 Phase
2. 喂给 Cursor：`prd.md 第二节设计系统` + `当前 Phase 对应章节`，不要全文喂入
3. 同时喂入 `agent_rules.md`，约束 Agent 行为
4. 每个 Phase 完成后，在浏览器验证效果，再进入下一个
5. 所有内容从 JSON 读取，禁止硬编码任何业务数据
6. 在任何新分支做现有功能改动或新增功能时，仅允许修改当前任务直接相关部分；不得改动不相关模块

---