# project_rules.md · 旅行美食推荐网站

> 每次启动 Cursor 新任务时，连同 agent_rules.md 一起喂给 Agent。
> 本文件帮助 Agent 理解项目背景、目标、技术决策原因，避免做出与项目风格冲突的判断。

---

## 一、项目是什么

这是一个**私人旅行美食推荐网站**，由个人创作者独立开发，记录作者走访过的城市和收藏的美食店。

网站不是点评平台，也不是商业导购，而是一本"私人美食书"——作者以自己的视角和体验为内容核心，带访客感受每座城市的饮食温度。

---

## 二、核心视觉语言

**以"书"为唯一视觉隐喻。**

- 第一页：一排横向书架，每本书代表一座城市，书脊朝外，可左右滑动
- 第二页：点击某本书进入该城市，页面呈现"一本打开的书"，左右两页摊开
- 整体气质：手帐风、书卷气、温暖有质感，让访客感受到幸福感和探索欲

**不允许出现的风格：**

- 科技感、渐变光效、玻璃拟态（glassmorphism）
- 深色背景（全站底色为纯白）
- 任何与"书/纸/手帐"隐喻冲突的视觉元素

---

## 三、技术背景与约束

- **开发方式**：纯 Vibe Coding，使用 Cursor，作者无深度编程背景
- **技术栈**：React（Vite）+ Mapbox GL JS + Chart.js + 本地 JSON 数据，无后端
- **当前阶段**：MVP，数据全部存在本地 JSON 文件，不涉及数据库或用户系统
- **部署目标**：Vercel 静态托管

**关键技术决策及原因：**


| 决策                       | 原因                                                                                                                                              |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| 地图用 Mapbox，不用高德/谷歌 SDK   | 避免双 SDK 冲突；高德/谷歌仅用于数据准备阶段查询经纬度                                                                                                                  |
| 中国城市坐标需 GCJ-02→WGS-84 转换 | 高德返回 GCJ-02，Mapbox 用 WGS-84；点图层与边界图层都必须转换，否则会出现整体偏移                                                                                             |
| 地图加载异常需可见化反馈             | 正常加载不提示；Token 为空显示缺失提示；Token/网络/样式失败显示错误提示+细节，避免长期“地图加载中”                                                                                       |
| 数据用本地 JSON，不用数据库         | MVP 阶段复杂度最低，静态部署足够                                                                                                                              |
| 图片路径与文件名匹配               | 店铺目录统一用 `store_slug`；图片 basename 按 `dish_name_local`→`dish_name_en`→`dish_name_zh` 匹配 dishes.json；未命中也要展示（中文数字序号 basename 仅图，其他 basename 显示为名称） |
| 图片扩展名需与真实编码一致            | `.jpg/.jpeg` 必须是真实 JPEG（文件头 `FF D8 FF`）；禁止把 HEIC/HEIF 仅改后缀伪装成 JPG，避免浏览器坏图                                                                       |
| 所有颜色用 CSS 变量（token）      | 12 个城市各有专属配色，必须通过变量统一管理，禁止硬编码色值                                                                                                                 |


---

## 四、城市与语言规则

- **目前共 12 个城市**：中国 9 城（大连、青岛、上海、苏州、广州、重庆、福州、厦门、泉州）+ 济州岛 + 吉隆坡 + 马六甲
- **中国城市**：页面右上角显示 EN/CN 切换按钮，用户可在中英文间切换（**不含**书脊/封面：书脊与封面统一为上中文、下英文「国家·城市」，见 `prd.md` §2.5）
- **非中国城市**（济州岛、吉隆坡、马六甲；以及未来新增城市）：页面右上角显示语言切换按钮（书架页不显示；具体按钮集合见 `prd.md` §2.5，例如 `EN/KO/CN` 或 `EN/CN`）；**书脊/封面**与中国城同一套上中文、下英文「国家·城市」
- **非中国城市配置源**：详情页语言按钮集合不写死在组件里，统一读取 `src/data/city_meta.json`
- **新增非中国城市时必须同步补配置**：至少新增该城市的 `slug -> detail_locale_mode`；若模式为 `en_native_zh`，还必须补 `native_iso639_1` 与 `native_button_label`
- **店铺名 / 菜品名**：始终以数据文件中的多语言字段为准（`restaurants.json`：`name_zh/name_en/name_local`；`dishes.json`：`dish_name_zh/dish_name_en/dish_name_local`），**不参与**语言切换，也**不做**机器翻译覆盖（Map 点位标签与 Cuisine 多行展示规则见 `prd.md` §2.5 / §4.2 / §4.3）
- **其它可变文案**：允许「作者原文优先 + 缺失机器翻译补齐 + 失败回退：`目标语言 → 英文 → 中文`」（见 `prd.md` §2.5）
- **数据字段 `is_china: true/false`**：代码以此判断坐标系转换需求和语言切换按钮显示逻辑（中国城市：点位与边界均转换；非中国城市：不转换）
- **Map 右侧标签筛选区（强约束）**：
  - 按钮文案排版固定为“首行左对齐、后续行居中”；不允许改成全行统一居中或统一左对齐
  - 分行策略固定为“先判断是否超宽，再拆行”；禁止无条件按空格预拆行
  - 宽度上限按文案脚本而非当前语言按钮判定：`zh=4em`、`en=12em`、`ja=4.5em`、`ko=5.5em`、`th=6.2em`
  - 英文文案统一小写展示
  - 标签区需支持超量纵向滚动，滚动条颜色跟随城市主色
  - 菜系筛选与地图标签：展示文案用 `cuisine_zh`；贴纸与筛选键用 `cuisine_en`（须与 `stickers/cuisine/{cuisine_en}.svg` 文件名一致）。英文兜底文案见 `cuisineSlugs.js` 的 `CUISINE_BY_EN`（不以组件内正则猜贴纸）

---

## 五、数据文件说明

```
src/data/
├── restaurants.json   ← 所有城市所有店铺，一个数组，按 city_en 筛选
├── dishes.json        ← 所有城市所有菜品，通过 `store_name_zh` / `store_name_en` / `store_name_local`（任一可匹配）+ `city_en` 关联店铺（**不含 `review` 字段**，见 `prd.md` §5.2）
├── city_meta.json     ← 城市级语言 UI 配置；非中国城市详情页按钮模式统一在这里维护
└── translations.static.json ← 静态翻译落盘结果（脚本批量生成；运行时优先读取）
```

**所有页面展示内容必须从这些 JSON / 配置文件读取，禁止在组件里硬编码任何业务数据或城市语言特例。**

数据处理强约束（执行与填表口径）：

- `restaurants.xlsx` 中：
  - 必填：`city_en`、`store_slug`、`record_scope`（`branch` / `brand`）以及至少一个店名字段（`name_zh/name_en/name_local`）。
  - `store_slug` 规则：`[a-z0-9-]+`；`dishes` / `photos` 维度 `(city_en, store_slug)` 唯一；`restaurants` 允许多条 `branch` 共享同一 slug（多分店，见 `docs/data-workflow.md` §4.1）。
  - **多分店 UI 归组**：唯一实现 `[src/utils/storeGroups.js](../src/utils/storeGroups.js)`；新增分店只改 Excel 共用 slug，禁止在组件写店名/slug 白名单。
  - `record_scope` 语义：`branch`=具体门店；`brand`=品牌层记录（不作为地图点位）。地图另排除 `closed=yes`、`address=连锁店`（见 `getMappableRestaurantsByCity` / `docs/prd.md` §5.1）。
  - `price_per_person` 必须是数值单元格（不带货币符号，币种写 `currency`）。
  - `score_overall` 必须是数值单元格（统一 1 位小数）。
  - `is_china` 仅允许小写字符串 `true` / `false`。
  - **菜系与贴纸**：`cuisine_zh`（中文展示名）、`cuisine_en`（贴纸 slug，对应 `src/assets/stickers/cuisine/{cuisine_en}.svg`，如 `chuan-cuisine`、`russian-cuisine`）。**`cuisine_en` 为贴纸文件名的唯一准绳**；筛选、地图高亮、下拉贴纸均以 `cuisine_en` 为准。注册表与命名约定见 [docs/structure.md](structure.md) §菜系筛选贴纸、`src/utils/cuisineSlugs.js`。缺 SVG 时运行时回退 `other.svg`。
- 数据变更后的执行顺序：
  - 先运行 `npm run data:sync`（xlsx -> restaurants.json/dishes.json）
  - 如需固化 MT 结果，再运行 `npm run data:export-translations`（输出 `translations.static.json`）
- Google Places 回填时，必须遵守 `src/data/README.md` 中的规则（多语言店名写入、hours 合并格式、手动编辑保护策略）。

图片路径规则：

```
src/assets/photos/{city-folder}/{store_slug}/{dish-file}.{jpg|jpeg|png|webp|heic}
`store_slug` 规则：[a-z0-9-]+；`dishes` / `photos` 在 `(city_en, store_slug)` 唯一；`restaurants` 可多 branch 行共享 slug（多分店）
`dish-file` 可使用任一语言菜名；代码匹配顺序：dish_name_local → dish_name_en → dish_name_zh
```

补充兜底规则（板块②）：

- basename 未匹配到 `dishes.json` 任一菜名时，图片仍需展示在其所属店铺下（不丢图）。
- basename 为中文数字序号（`一二三四五六七八九十`，含组合如 `十一/十二/二十`）时，仅显示图片，不显示名称文本。
- basename 非中文数字序号时，显示 basename（不含扩展名）作为图片名称。
- 图片真实格式强约束：扩展名与文件头必须一致；导入新城市图片前先跑 `npm run audit:photo-magic`。
- 板块②图片排序固定四段式：① basename 匹配菜名；② basename 匹配店名（`dishes.json` 的 `store_name_*` 全文、其去括号基础名、以及同城同 `store_slug` 各分店 `restaurants.json` 的 `name_*` 全文）；③ 其余非中文数字序号（英文起头字母序、数字起头介于英/中、中文起头拼音序）；④ 中文数字序号最后按数值升序（这组不显示名称）。

板块②排序与列表规则（已确认）：

- 店铺列表：按 `name_zh` 中文拼音 `A-Z` 排序；`name_zh` 为空时回退 `name_en`，再回退 `name_local`。
- 菜系下拉：`全部` 固定首位；其余按 `count` 降序；`count` 相同按菜系中文拼音 `A-Z` 排序。
- 数字开头条目统一排在字母后。
- 排序前统一 `trim` + 去前导符号；同 key 维持原始输入顺序（稳定排序）。
- 排序与语言切换解耦：切换 `EN/CN/本地语` 只影响显示文本，不改变既定排序顺序。

---

## 六、当前开发进度

> 每次开始新任务时，由开发者手动更新此节。

- Phase 0：准备工作
- Phase 1：项目初始化 + 全局设计系统
- Phase 2：书架页面
- Phase 3：第二页框架 + 顶部导航
- Phase 4：板块①地图
- Phase 5：板块②杂志详情
- Phase 6：打磨与扩展

**当前已全部完成，出于打磨、扩展阶段。**

---

## 七、Agent 必须知道的禁区

1. **不要自行决定引入新的地图库**（如 Leaflet、高德 JS SDK），地图只用 Mapbox
2. **不要自行添加动画效果**，所有动效以 PRD_v2.md 描述为准
3. **不要修改 JSON 文件的字段名**，字段名一旦改变会破坏整个数据关联逻辑
4. **不要把颜色值写死在组件里**，必须引用 `global.css` 中的 CSS 变量
5. **不要自行决定字体**，字体规范见 prd.md 第二节
6. **所有贴纸 SVG（`stickers/cities`、`stickers/page`、`stickers/cuisine`）必须透明底**：禁止整幅 viewBox 黑/白底框、禁止大面积纯色卡纸底；否则会在书脊/Slogan/筛选/拍立得区域出现黑白方块。
  - **硬性验收标准**：任何贴纸 SVG 都不允许存在“覆盖全画布（接近 `0,0` 到 `512,512`）的黑色或白色背景 path/rect”（含 `#000/#000000/#010000/#fff/#ffffff` 及近似纯黑纯白）。
  - 如素材自带背景层，必须先删除或改为透明再接入页面。
  - **展示颜色需与素材一致**：禁止在贴纸 `<img>` 或其容器上用 `filter: invert()` / `hue-rotate()` / `brightness()` 等方式整体改色；如出现“页面颜色与 SVG 文件不一致”，先排查样式层滤镜而非改素材色值。
7. **在任何新分支进行功能改动/新增时，禁止触碰不相关模块**：只允许修改与当前任务直接相关的文件与逻辑；若发现需要跨模块调整，必须先与开发者确认范围再改。

---

## 八、文档 Markdown 链接（防误改）

`docs/*.md` 里引用代码文件时，使用**可点击**链接，例如：

```markdown
[src/utils/storeGroups.js](../src/utils/storeGroups.js)
```

**禁止**在整条链接外再包一层反引号：

```markdown
`[src/utils/storeGroups.js](../src/utils/storeGroups.js)`
```

后者在预览里只是代码文字，**无法点击**，且易被编辑器「切换行内代码」或 Agent 误改。

**为何总在 `data-workflow.md` §4.1 附近出现：** 该段 blockquote 同行有多处 `nlsf`、`ylxl` 等行内代码，编辑时若选中范围过大再按 ```，会把整段 `[...](...)` 一起包进反引号。

**预防：**

- 工作区 `.vscode/settings.json` 已对 `[markdown]` 关闭 `formatOnSave`
- 发布前可跑：`npm run audit:doc-links`
- 改文档时勿对含 `[text](url)` 的整段使用 Toggle Inline Code

---

## 九、参考资料位置


| 文件                        | 用途                                  |
| ------------------------- | ----------------------------------- |
| `docs/prd.md`             | 产品需求总纲（产品概述、数据结构、阶段计划、索引）           |
| `docs/prd-ui-spec.md`     | UI 与交互规范专题（视觉、布局、页面交互）              |
| `docs/prd-i18n-locale.md` | 语言切换与文案回退专题（按钮、回退链、解耦规则）            |
| `docs/agent_rules.md`     | Agent 行为约束，自检流程，汇报格式                |
| `docs/project_rules.md`   | 本文件，项目背景和技术决策说明                     |
| `docs/data-workflow.md`   | 数据与翻译固定流程手册（xlsx->json、MT落盘、新增城市清单） |
| `.env`                    | API Key 和 Access Token（不得上传 GitHub） |


---

*文件结束 · 有疑问先查 prd.md，查不到再问开发者*