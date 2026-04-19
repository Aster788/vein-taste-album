# Phase 1 收尾自检记录

> 对照 `docs/agent_rules.md` §三自检清单（含 §3.5 资源与路径）。  
> 执行时间：以本文件提交日为准；验证命令：`npm run dev`、`npm run build`、对 `http://localhost:5173/` 的 HTTP 探测。

---

## 一、`npm run dev` 与基础连通性


| 检查项               | 结果  | 说明                                                                     |
| ----------------- | --- | ---------------------------------------------------------------------- |
| `npm run dev` 可启动 | ✅   | Vite `ready in ~300ms`，`http://localhost:5173/`                        |
| 路由可进              | ✅   | `GET /`、`GET /dalian`、`GET /jeju` 返回 **200**（SPA 入口 HTML）              |
| 非法 city           | ✅   | `GET /invalid-city-xyz` 仍为 **200**（由客户端 `<Navigate />` 处理，符合 Vite SPA） |
| `npm run build`   | ✅   | 此前已通过；Phase 1 收尾前再次具备可发布构建能力                                           |


---

## 二、全局变量与主题


| 检查项                    | 结果  | 说明                                                                  |
| ---------------------- | --- | ------------------------------------------------------------------- |
| `global.css` 中城市 token | ✅   | `html[data-city="…"]` 定义 11 套 `--city-primary` / `--city-secondary` |
| 组件内色值                  | ✅   | 占位页使用 `var(--*)` 与工具类，未见组件内写死 `#RRGGBB`                             |
| `data-city` 与路由        | ✅   | `CityDetail` 合法 slug 时写入 `documentElement.dataset.city`，书架清除        |


**说明**：CSS 变量在浏览器计算后的最终值，建议在 DevTools → Elements 中点选 `<html>` 对 `dalian` 等路由做一次人工确认（自动化未接浏览器算样式）。

---

## 三、字体加载


| 检查项                         | 结果         | 说明                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| --------------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `index.html` 含 Google Fonts | ✅          | 响应 HTML 中含 `fonts.googleapis.com`（Playfair）                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `#root` 存在                  | ✅          | 入口 HTML 含 `id="root"`                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 本地字体文件                      | ✅          | 终端曾核对 `MuYao-SoftBrush.ttf`、`LXGWWenKai-Regular.ttf` 非空、有合法 TTF 头                                                                                                                                                                                                                                                                                                                                                                                                          |
| **控制台致命错误**                 | ⚠️ 待人工     | **须在 Chrome/Edge 打开本地站**，查看 Console：404（字体路径）、CORS、MIME 等；本记录无法在 CI 中自动抓取控制台                                                                                                                                                                                                                                                                                                                                                                                               |
| 人工检查结果                      | warning 1  | react-router-dom.js?v=dd146586:4434 ⚠️ React Router Future Flag Warning: React Router will begin wrapping state updates in `React.startTransition` in v7. You can use the `v7_startTransition` future flag to opt-in early. For more information, see [https://reactrouter.com/v6/upgrading/future#v7_starttransition](https://reactrouter.com/v6/upgrading/future#v7_starttransition). warnOnce @ react-router-dom.js?v=dd146586:4434 react-router-dom.js?v=dd146586:4434 |
| 人工检查结果                      | warning 2  | ⚠️ React Router Future Flag Warning: Relative route resolution within Splat routes is changing in v7. You can use the `v7_relativeSplatPath` future flag to opt-in early. For more information, see [https://reactrouter.com/v6/upgrading/future#v7_relativesplatpath](https://reactrouter.com/v6/upgrading/future#v7_relativesplatpath). warnOnce @ react-router-dom.js?v=dd146586:4434                                                                                   |
| 人工检查结果                      | 1280px+ 布局 | 视口：1280×800，1920x1005；路由：/、/dalian、/jeju；结果：无横向滚动条                                                                                                                                                                                                                                                                                                                                                                                                                         |


---

## 四、Language Context 默认值与行为


| 检查项                 | 结果  | 说明                                                      |
| ------------------- | --- | ------------------------------------------------------- |
| 默认 `locale`         | ✅   | `useState("zh")`                                        |
| 默认 `citySlug`       | ✅   | `null`（书架）                                              |
| `showEnCnToggle`    | ✅   | 书架与中国城为 `true`；`jeju` / `kuala-lumpur` 为 `false`（见占位文案） |
| `setCitySlug` 与路由同步 | ✅   | `Bookshelf` / `CityDetail` 在 `useEffect` 中维护            |


---

## 五、对照 `agent_rules.md` §3.1～§3.5

### 3.1 功能

- 实现范围与 Phase 1（脚手架、样式 token、路由、数据只读工具、坐标工具、Context）一致。  
- 未见偏离 PRD 的大型功能块。  
- [⚠] 占位页含「EN/CN 占位 / 三语示例」属便于验收 Context 的**最小演示**，Phase 2 可替换为真实 UI。

### 3.2 数据

- [⚠] **占位页未消费 `restaurants.json` 列表**；`dataLoader.js` 已实现，待 Phase 2+ 接入 UI 后满足「展示来自 JSON」。  
- 未见把真实店名、城市名硬编码为业务数据源（仅有路由说明类文案）。  
- [N/A] 图片路径：Phase 1 未渲染 `assets/photos` 图片组件，待 Phase 5 对照规范。

### 3.3 设计

- 字体链路：`Playfair`（外链）+ `LXGW WenKai`（本地 `@font-face`）+ `MuYao`（本地）；正文类用 `global.css` 变量。  
- 颜色使用 CSS 变量 / `data-city`。  
- 占位使用 `ffj-`* 类名前缀，与现有约定一致。

### 3.4 兼容

- [⚠] **1280px+ 布局**：未跑无头截图测试；建议全屏浏览器快速目视。  
- 当前仅少量页面组件，未见互相破坏。  
- [⚠] **控制台**：同「三、字体」——**需人工**列出警告（若有）。

### 3.5 资源与路径

- 关键字体路径曾用 **PowerShell `Get-Item` / 字节读取** 核对，未仅凭 Glob 断言。

---

## 六、结论与后续

- **Phase 1 可视为收尾完成**，条件：你在浏览器中完成 **Console + 1280px 视检** 且无致命报错。  
- 建议进入 **Phase 2** 前：在 `project_rules.md` §六勾选 Phase 1，并填写「当前正在做：Phase 2」。

