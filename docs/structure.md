# 项目资源结构（节选）

## 城市书脊贴纸

- 目录：`src/assets/stickers/cities/`
- slug → 文件名映射：`src/utils/citySlugs.js` 中的 `CITY_STICKER_FILENAME_BY_SLUG`
- 视觉规范与气质说明：`docs/prd-ui-spec.md` §2.2（配色）、§2.4（贴纸）


| slug           | 贴纸语义 | 文件名                                 |
| -------------- | ---- | ----------------------------------- |
| `shanghai`     | 东方明珠 | `shanghai-oriental-pearl-tower.svg` |
| `suzhou`       | 虎丘塔  | `suzhou-huqiuta.svg`                |
| `qingdao`      | 啤酒杯  | `qingdao-beer.svg`                  |
| `chongqing`    | 辣椒   | `chongqing-chili.svg`               |
| `guangzhou`    | 广州塔  | `guangzhou-canton-tower.svg`        |
| `jeju`         | 橘子   | `jeju-orange.svg`                   |
| `kuala-lumpur` | 双子塔  | `kl-petronas-twin-tower.svg`        |
| `melaka`       | 清真寺  | `melaka-mosque.svg`                 |
| `fuzhou`       | 榕树   | `fuzhou-banyan-tree.svg`            |
| `quanzhou`     | 船锚   | `quanzhou-anchor.svg`               |
| `xiamen`       | 钢琴   | `xiamen-piano.svg`                  |
| `dalian`       | 海鸥   | `dalian-seagull.svg`                |


## 菜系筛选贴纸

- 目录：`src/assets/stickers/cuisine/`
- 数据字段（`restaurants.json` / `restaurants.xlsx`）：
  - `cuisine_zh`：菜系中文名（筛选下拉、地图标签等展示文案）
  - `cuisine_en`：贴纸 slug，与文件名一致（不含 `.svg`），例如 `sichuan-cuisine` → `sichuan-cuisine.svg`
- 代码约定：`src/utils/cuisineSlugs.js`（`resolveCuisineStickerHref`、`getRestaurantCuisineEn` / `getRestaurantCuisineZh`）
- 视觉规范：`docs/prd-ui-spec.md` §2.4、§4.3；透明底要求见 `docs/project_rules.md` §七

维护规则：

1. 新增菜系时，先在 `stickers/cuisine/` 放入 `{cuisine_en}.svg`，再在表里为店铺填写对应的 `cuisine_zh` 与 `cuisine_en`。
2. `cuisine_en` 必须与磁盘上的 SVG 文件名一致；`cuisine_zh` 用于界面展示与按拼音排序。
3. 历史列 `cuisine` 在 `npm run data:sync` 时与 `cuisine_zh` 同步，仅作兼容；新填表请优先写 `cuisine_zh` / `cuisine_en`。
4. 若仅填了 `cuisine_zh`（旧表），前端会尝试用 `cuisineSlugs.js` 中的 `CUISINE_EN_BY_ZH` 反查 slug 以加载贴纸；正式数据应显式填写 `cuisine_en`。

| cuisine_en | 示例 cuisine_zh | 贴纸文件 |
| ---------- | ------------- | -------- |
| `japanese` | 日料 | `japanese.svg` |
| `korean` | 韩餐 | `korean.svg` |
| `sichuan-cuisine` | 川菜 | `sichuan-cuisine.svg` |
| `all` | （仅 UI「全部」项） | `all.svg` |

完整 slug 列表与展示兜底见 `src/utils/cuisineSlugs.js` 中的 `CUISINE_BY_EN`。

## 城市配色 token

- 定义位置：`src/styles/global.css` 中 `html[data-city="<slug>"]` 的 `--city-primary` / `--city-secondary`
- 地图边界线同色：`src/components/MapPanel.jsx` 中 `CITY_MAP_LINE_COLORS_BY_SLUG`
- 设计说明：`docs/prd-ui-spec.md` §2.2