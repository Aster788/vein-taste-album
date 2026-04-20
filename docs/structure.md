# structure.md · 项目文件夹结构说明

> Agent 必读文件。每次任务开始前喂给 Cursor，严格按照本文件的结构组织代码和文件。
> 禁止新建本文件未列出的文件夹。禁止将文件放入不对应的目录。

---

## 完整目录结构与职责说明

```
food-for-joy/
│
├── public/
│   └── favicon.ico               ← 网站图标，唯一允许放在 public/ 的文件
│
├── src/
│   │
│   ├── main.jsx                  ← React 入口：挂载全局 Provider（BrowserRouter、LanguageContext 等）与 App，不写业务逻辑
│   ├── App.jsx                   ← 路由配置，只定义页面路由，不写 UI
│   │
│   ├── context/                  ← 全局 React Context（语言等跨路由状态）；仅 Provider + hook，不放页面或展示组件
│   │   └── LanguageContext.jsx   ← LanguageProvider、useLanguage；`locale`/`citySlug`/`showEnCnToggle`；同文件导出 `formatFixedTriple`、`pickByLocale`
│   │
│   ├── pages/                    ← 页面级组件，每个文件对应一个完整页面
│   │   ├── Bookshelf.jsx         ← 第一页：书架页面
│   │   └── CityDetail.jsx         ← 第二页：城市详情页（含板块①②切换）
│   │
│   ├── components/               ← 可复用的 UI 组件，只负责渲染，不做数据请求
│   │   ├── Book.jsx              ← 单本书组件（书脊+封面+3D效果+悬停动效）
│   │   ├── MapPanel.jsx          ← 板块①左侧：Mapbox 地图 + GeoJSON边界 + 标注点
│   │   ├── NotePanel.jsx         ← 板块①右侧：笔记本样式店铺信息区
│   │   ├── RadarChart.jsx        ← 雷达图组件（Chart.js，堂食/外卖维度自动切换）
│   │   ├── StoreList.jsx         ← 板块②左页：菜系筛选标签 + 店铺列表
│   │   ├── PhotoPanel.jsx        ← 板块②右页：拍立得图片轮播
│   │   └── DishInfo.jsx          ← 板块②右页：菜名 + 评价文字区（与图片并列）
│   │
│   ├── styles/                   ← 所有样式文件，组件不使用内联style对象
│   │   ├── global.css            ← 全局样式 + 所有 CSS 变量（城市配色token、字体变量）
│   │   │                            ⚠️ 所有颜色值必须在此定义，组件中只能引用变量名
│   │   └── textures.css          ← 纸质纹理、书本材质相关样式
│   │
│   ├── data/                     ← 本地数据文件，只存放 JSON，不存放其他类型文件
│   │   ├── restaurants.json      ← 所有城市所有店铺数据（唯一数据源）
│   │   └── dishes.json           ← 所有城市所有菜品数据（唯一数据源；不含 `review` 字段，见 prd.md §5.2）
│   │
│   ├── assets/                   ← 静态媒体资源，代码不在此目录下写任何逻辑
│   │   │
│   │   ├── photos/               ← 美食实拍图片，按城市→店铺两级组织
│   │   │   ├── dalian/           ← 城市文件夹：拼音小写
│   │   │   │   └── hai-yue/      ← 店铺文件夹：拼音小写+连字符
│   │   │   │       ├── 红烧带鱼.jpg   ← 图片文件名：中文菜名（中国城市）
│   │   │   │       └── 蒜蓉扇贝.jpg
│   │   │   ├── jeju/
│   │   │   │   └── store-name/
│   │   │   │       └── 갈치조림.jpg   ← 图片文件名：本国语言菜名（非中国城市）
│   │   │   └── （其余城市同结构）
│   │   │
│   │   ├── geojson/              ← 行政区划边界数据，每个城市一个文件
│   │   │   ├── dalian.geojson
│   │   │   ├── qingdao.geojson
│   │   │   ├── shanghai.geojson
│   │   │   ├── guangzhou.geojson
│   │   │   ├── chongqing.geojson
│   │   │   ├── fuzhou.geojson
│   │   │   ├── xiamen.geojson
│   │   │   ├── quanzhou.geojson
│   │   │   ├── pingtan.geojson
│   │   │   ├── jeju.geojson
│   │   │   └── kuala-lumpur.geojson
│   │   │
│   │   ├── stickers/             ← 所有 SVG 贴纸，按用途分三个子文件夹（统一要求：透明底；禁止整幅黑/白底框与大面积底卡）
│   │   │   ├── cities/           ← 书脊城市贴纸（每个城市一个SVG）
│   │   │   │   ├── dalian-seagull.svg
│   │   │   │   ├── qingdao-beer.svg
│   │   │   │   ├── shanghai-oriental-pearl-tower.svg
│   │   │   │   ├── guangzhou-canton-tower.svg
│   │   │   │   ├── chongqing-chili.svg
│   │   │   │   ├── fuzhou-banyan-tree.svg
│   │   │   │   ├── xiamen-piano.svg
│   │   │   │   ├── quanzhou-anchor.svg
│   │   │   │   ├── pingtan-wave.svg
│   │   │   │   ├── jeju-orange.svg
│   │   │   │   └── kl-petronas-twin-tower.svg
│   │   │   ├── page/           ← 网页上可能会用到的贴纸
│   │   │   │   ├── airplane.svg
│   │   │   │   ├── earth.svg
│   │   │   │   ├── footprints.svg
│   │   │   │   ├── paperclip.svg
│   │   │   │   ├── pin.svg
│   │   │   │   ├── star.svg
│   │   │   │   └── tape.svg
│   │   │   └── cuisine/          ← 菜系和饮品筛选贴纸（每种一个SVG）
│   │   │       ├── all.svg
│   │   │       ├── bakery.svg
│   │   │       ├── chinese.svg
│   │   │       ├── dessert.svg
│   │   │       ├── drinks.svg
│   │   │       ├── japanese.svg
│   │   │       ├── korean.svg
│   │   │       ├── other.svg
│   │   │       ├── southeast-asian.svg
│   │   │       └── western.svg
│   │   │
│   │   └── fonts/                ← 本地字体文件（仅存放无法通过 CDN 加载或需固定版本的字体）
│   │       ├── MuYao-SoftBrush.ttf   ← 沐瑶软笔手写体
│   │       └── LXGWWenKai/           ← 霞鹜文楷（LXGW WenKai）
│   │           └── LXGWWenKai-Regular.ttf   ← 正文 Regular，@font-face 字族名 LXGW WenKai
│   │
│   └── utils/                    ← 工具函数，只存放纯函数，不含任何 JSX 或样式
│       ├── citySlugs.js          ← 合法城市 URL 段（slug）、`isChinaCitySlug`（书架/语言/坐标语义）
│       ├── coordTransform.js     ← GCJ-02→WGS-84 坐标转换（仅供 MapPanel.jsx 调用）
│       ├── dataLoader.js         ← JSON 数据读取与筛选函数（按城市筛选、按菜系筛选等）
│       └── formatDishTasteStars.js   ← dishes.json 的 `taste`（1～5 整数）→ 星标展示字符串，全站唯一实现（板块②等调用）
│
├── docs/                         ← 项目文档，不参与编译，不影响网站运行
│   ├── prd.md                 ← 产品需求文档（功能与设计唯一标准）
│   ├── agent_rules.md            ← Agent 行为约束（自检流程、汇报格式）
│   ├── project_rules.md          ← 项目背景与技术决策说明
│   ├── phase1-self-check.md      ← Phase 1 收尾自检记录（对照 agent_rules §三）
│   └── structure.md              ← 本文件
│
├── .env                          ← 环境变量，存放所有 API Key 和 Token
│                                    ⚠️ 绝对不能上传 GitHub
│                                    内容：
│                                    VITE_MAPBOX_TOKEN=pk.eyJ1...
│                                    VITE_AMAP_KEY=你的高德Key
│
├── .env.example                  ← 环境变量模板（可上传GitHub，供参考）
│                                    内容：
│                                    VITE_MAPBOX_TOKEN=your_token_here
│                                    VITE_AMAP_KEY=your_key_here
│
├── .gitignore                    ← 必须包含 .env，防止 Key 泄露
├── package.json                  ← 依赖管理，由 Cursor 维护，不手动修改
└── vite.config.js                ← Vite 配置，由 Cursor 维护，不手动修改
```

---

## 文件职责边界（Agent 必须遵守）

### 哪些文件 Agent 会创建/修改


| 文件/目录             | Agent 操作权限                        |
| ----------------- | --------------------------------- |
| `src/pages/`      | ✅ 可创建和修改                          |
| `src/components/` | ✅ 可创建和修改                          |
| `src/context/`    | ✅ 可创建和修改（仅全局状态，与 UI 无关的 Provider） |
| `src/styles/`     | ✅ 可创建和修改                          |
| `src/utils/`      | ✅ 可创建和修改                          |
| `src/main.jsx`    | ✅ 仅在 Phase 1 初始化时修改一次             |
| `src/App.jsx`     | ✅ 仅在 Phase 1 配置路由时修改一次            |
| `package.json`    | ✅ 仅在需要新增依赖时修改，必须告知用户              |
| `vite.config.js`  | ✅ 仅在 Phase 1 初始化时修改一次             |


### 哪些文件/目录 Agent 绝对不能修改


| 文件/目录                  | 原因                          |
| ---------------------- | --------------------------- |
| `src/data/*.json`      | 数据文件由用户手动维护，Agent 只能读取，不能写入 |
| `src/assets/photos/`   | 图片由用户自行添加，Agent 不操作         |
| `src/assets/geojson/`  | GeoJSON 由用户下载，Agent 不操作     |
| `src/assets/stickers/` | SVG 由用户下载或 Agent 单独生成后由用户放入 |
| `src/assets/fonts/`    | 字体文件由用户下载，Agent 不操作         |
| `docs/`                | 文档目录，Agent 不修改（除非被明确要求）     |
| `.env`                 | 敏感信息，Agent 不读取不修改           |


---

## 例外：确实需要新增文件时

如果 Agent 判断需要新建本文件未列出的文件或文件夹，必须按以下流程处理，不得直接创建：

1. **停下来，说明原因**：告诉用户"我需要新建 `xxx` 文件，原因是……"
2. **说明放在哪里**：给出拟放置的路径，并解释为何放在该位置
3. **等待用户确认**：用户明确说"可以"之后再创建
4. **创建后更新说明**：提醒用户将新文件补充记录到 `STRUCTURE.md` 中

常见的合理新增场景举例：

- 某个组件过于复杂，需要拆分出子组件（如 `MapMarker.jsx`）
- 需要新增一个工具函数文件（如 `imageLoader.js`）
- 需要为某个组件单独建立样式文件

不合理的新增场景（直接拒绝）：

- 功能与现有文件重复
- 用于临时测试或调试
- 未在 PRD 中提及的功能模块

---

## 禁止行为

- ❌ 禁止在未经用户确认的情况下，新建本文件未列出的文件或文件夹
- ❌ 禁止把组件文件放到 `pages/` 目录，也不能把页面文件放到 `components/` 目录
- ❌ 禁止在 `context/` 中编写页面级 UI 或可复用展示组件（仅允许 Context / Provider / hook）
- ❌ 禁止在组件文件里写颜色的具体数值（如 `#4A7FA5`），必须用 CSS 变量
- ❌ 禁止在 `utils/` 里写 JSX 或样式相关代码
- ❌ 禁止创建与现有文件功能重复的新文件（如再建一个 `MapComponent.jsx`）
- ❌ 禁止修改 `src/data/` 下的任何 JSON 文件

---

## 如何在 Cursor 中使用本文件

每次开始新 Phase 前，将以下三个文件一起粘贴到 Cursor 对话框：

1. `docs/structure.md`（本文件）
2. `docs/agent_rules.md`
3. `docs/project_rules.md`

然后再告诉 Agent 当前要做的具体任务和对应的 PRD 章节。

---

*文件结束*