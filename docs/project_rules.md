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


| 决策                       | 原因                                           |
| ------------------------ | -------------------------------------------- |
| 地图用 Mapbox，不用高德/谷歌 SDK   | 避免双 SDK 冲突；高德/谷歌仅用于数据准备阶段查询经纬度               |
| 中国城市坐标需 GCJ-02→WGS-84 转换 | 高德返回 GCJ-02，Mapbox 用 WGS-84；点图层与边界图层都必须转换，否则会出现整体偏移 |
| 地图加载异常需可见化反馈           | 正常加载不提示；Token 为空显示缺失提示；Token/网络/样式失败显示错误提示+细节，避免长期“地图加载中” |
| 数据用本地 JSON，不用数据库         | MVP 阶段复杂度最低，静态部署足够                           |
| 图片路径与文件名匹配             | 店铺目录统一用 `store_slug`；图片 basename 按 `dish_name_local`→`dish_name_en`→`dish_name_zh` 匹配 dishes.json；未命中也要展示（中文数字序号 basename 仅图，其他 basename 显示为名称） |
| 所有颜色用 CSS 变量（token）      | 10个城市各有专属配色，必须通过变量统一管理，禁止硬编码色值               |


---

## 四、城市与语言规则

- **目前共10个城市**：中国8城（大连、青岛、上海、广州、重庆、福州、厦门、泉州）+ 济州岛 + 吉隆坡
- **中国城市**：页面右上角显示 EN/CN 切换按钮，用户可在中英文间切换（**不含**书脊/封面：书脊与封面统一为上中文、下英文「国家·城市」，见 `prd.md` §2.5）
- **非中国城市**（济州岛、吉隆坡；以及未来新增城市）：页面右上角显示语言切换按钮（书架页不显示；具体按钮集合见 `prd.md` §2.5，例如 `EN/KO/CN` 或 `EN/CN`）；**书脊/封面**与中国城同一套上中文、下英文「国家·城市」
- **非中国城市配置源**：详情页语言按钮集合不写死在组件里，统一读取 `src/data/city_meta.json`
- **新增非中国城市时必须同步补配置**：至少新增该城市的 `slug -> detail_locale_mode`；若模式为 `en_native_zh`，还必须补 `native_iso639_1` 与 `native_button_label`
- **店铺名 / 菜品名**：始终以数据文件中的多语言字段为准（`restaurants.json`：`name_zh/name_en/name_local`；`dishes.json`：`dish_name_zh/dish_name_en/dish_name_local`），**不参与**语言切换，也**不做**机器翻译覆盖（Map 点位标签与 Cuisine 多行展示规则见 `prd.md` §2.5 / §4.2 / §4.3）
- **其它可变文案**：允许「作者原文优先 + 缺失机器翻译补齐 + 失败回退：`目标语言 → 英文 → 中文`」（见 `prd.md` §2.5）
- **数据字段 `is_china: true/false`**：代码以此判断坐标系转换需求和语言切换按钮显示逻辑（中国城市：点位与边界均转换；非中国城市：不转换）

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
  - `store_slug` 规则：`[a-z0-9-]+`，至少保证 `(city_en, store_slug)` 唯一。
  - `record_scope` 语义：`branch`=具体门店（有坐标即可上图）；`brand`=品牌层记录（不作为地图点位）。
  - `price_per_person` 必须是数值单元格（不带货币符号，币种写 `currency`）。
  - `score_overall` 必须是数值单元格（统一 1 位小数）。
  - `is_china` 仅允许小写字符串 `true` / `false`。
- 数据变更后的执行顺序：
  - 先运行 `npm run data:sync`（xlsx -> restaurants.json/dishes.json）
  - 如需固化 MT 结果，再运行 `npm run data:export-translations`（输出 `translations.static.json`）
- Google Places 回填时，必须遵守 `src/data/README.md` 中的规则（多语言店名写入、hours 合并格式、手动编辑保护策略）。

图片路径规则：

```
src/assets/photos/{city-folder}/{store_slug}/{dish-file}.jpg
`store_slug` 规则：[a-z0-9-]+，至少在 `(city_en, store_slug)` 维度唯一
`dish-file` 可使用任一语言菜名；代码匹配顺序：dish_name_local → dish_name_en → dish_name_zh
```

补充兜底规则（板块②）：

- basename 未匹配到 `dishes.json` 任一菜名时，图片仍需展示在其所属店铺下（不丢图）。
- basename 为中文数字序号（`一二三四五六七八九十`）时，仅显示图片，不显示名称文本。
- basename 非中文数字序号时，显示 basename（不含扩展名）作为图片名称。

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

**当前正在做：Phase 4（板块①地图，当前推进 Task 4.10）**

---

## 七、Agent 必须知道的禁区

1. **不要自行决定引入新的地图库**（如 Leaflet、高德 JS SDK），地图只用 Mapbox
2. **不要自行添加动画效果**，所有动效以 PRD_v2.md 描述为准
3. **不要修改 JSON 文件的字段名**，字段名一旦改变会破坏整个数据关联逻辑
4. **不要把颜色值写死在组件里**，必须引用 `global.css` 中的 CSS 变量
5. **不要自行决定字体**，字体规范见 prd.md 第二节
6. **所有贴纸 SVG（`stickers/cities`、`stickers/page`、`stickers/cuisine`）必须透明底**：禁止整幅 viewBox 黑/白底框、禁止大面积纯色卡纸底；否则会在书脊/Slogan/筛选/拍立得区域出现黑白方块

---

## 八、参考资料位置


| 文件                      | 用途                                  |
| ----------------------- | ----------------------------------- |
| `prd.md`                | 产品需求文档，所有功能和设计细节的唯一标准               |
| `docs/agent_rules.md`   | Agent 行为约束，自检流程，汇报格式                |
| `docs/project_rules.md` | 本文件，项目背景和技术决策说明                     |
| `docs/data-workflow.md` | 数据与翻译固定流程手册（xlsx->json、MT落盘、新增城市清单） |
| `.env`                  | API Key 和 Access Token（不得上传 GitHub） |


---

*文件结束 · 有疑问先查 prd.md，查不到再问开发者*