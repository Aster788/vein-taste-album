# 项目资源结构（节选）

## 城市书脊贴纸

- 目录：`src/assets/stickers/cities/`
- slug → 文件名映射：`src/utils/citySlugs.js` 中的 `CITY_STICKER_FILENAME_BY_SLUG`
- 视觉规范与气质说明：`docs/prd-ui-spec.md` §2.2（配色）、§2.4（贴纸）


| slug           | 贴纸语义 | 文件名                                 |
| -------------- | ---- | ----------------------------------- |
| `shanghai`     | 东方明珠 | `shanghai-oriental-pearl-tower.svg` |
| `nanjing`      | 梅花   | `nanjing-plum-blossom.svg`          |
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
  - `cuisine_en`：贴纸 slug，**与 SVG 文件名一致**（不含 `.svg`），例如 `chuan-cuisine` → `chuan-cuisine.svg`
- 代码约定：`src/utils/cuisineSlugs.js`（`CUISINE_BY_EN`、`resolveCuisineStickerHref`、`getRestaurantCuisineEn` / `getRestaurantCuisineZh`）
- 视觉规范：`docs/prd-ui-spec.md` §2.4、§4.3；透明底要求见 `docs/project_rules.md` §七

### Slug 命名约定

- 格式：`[a-z0-9-]+`（小写、连字符，无空格）
- **以 `cuisine_en` 为唯一准绳**：磁盘贴纸文件名、Excel 列、`restaurants.json`、注册表 `CUISINE_BY_EN` 的键名必须相同
- 常见模式：
  - 短 slug：`hotpot`、`noodle`、`coffee`、`bbq`
  - 带 `-cuisine` 后缀：`chuan-cuisine`（川菜）、`korean-cuisine`（韩餐）、`japanese-cuisine`（日料）、`western-cuisine`（西式）、`russian-cuisine`（俄罗斯菜）等
- 勿混用旧 slug（已废弃）：`sichuan-cuisine`、`japanese`、`korean`、`western-food`、`northeastern-chinese-cuisine`、`southeast-asian`、`spanish`、`italian`、`russian`（无 `-cuisine`）

### 维护规则

1. **新增菜系**：先在 `stickers/cuisine/` 放入 `{cuisine_en}.svg`，再在 `CUISINE_BY_EN` 与 Excel 中为店铺填写对应的 `cuisine_zh` / `cuisine_en`。
2. `cuisine_en` 决定加载哪张贴纸；`cuisine_zh` 决定界面中文展示与筛选排序（拼音）。
3. 历史列 `cuisine` 在 `npm run data:sync` 时与 `cuisine_zh` 同步，仅作兼容；新填表请写 `cuisine_zh` / `cuisine_en`。
4. 若仅填 `cuisine_zh`，前端会尝试 `CUISINE_EN_BY_ZH` 反查 slug；**正式数据应显式填 `cuisine_en`**。
5. 若 `cuisine_en` 在注册表中有条目但尚无对应 SVG，运行时贴纸回退为 `other.svg`（DEV 下 `cuisineSlugs.js` 会 `console.warn`）。

### 示例对照（非完整列表）

| cuisine_en | 示例 cuisine_zh | 贴纸文件 |
| ---------- | ------------- | -------- |
| `chuan-cuisine` | 川菜 | `chuan-cuisine.svg` |
| `korean-cuisine` | 韩餐 | `korean-cuisine.svg` |
| `japanese-cuisine` | 日料 | `japanese-cuisine.svg` |
| `southeast-asian-cuisine` | 东南亚菜 | `southeast-asian-cuisine.svg` |
| `northeast-cuisine` | 东北菜 | `northeast-cuisine.svg` |
| `western-cuisine` | 西式 | `western-cuisine.svg` |
| `russian-cuisine` | 俄罗斯菜 | `russian-cuisine.svg` |
| `noodle` | 面食 | `noodle.svg` |
| `snacks` | 零食 | `snacks.svg` |
| `guizhou-cuisine` | 黔菜 | `guizhou-cuisine.svg` |
| `all` | （仅 UI「全部」项） | `all.svg` |

完整 slug 与中英展示兜底见 `src/utils/cuisineSlugs.js` 中的 `CUISINE_BY_EN`；以 xlsx 实际取值为准，改表后运行 `npm run data:sync`。

## 城市配色 token

- 定义位置：`src/styles/global.css` 中 `html[data-city="<slug>"]` 的 `--city-primary` / `--city-secondary`
- 地图边界线同色：`src/components/MapPanel.jsx` 中 `CITY_MAP_LINE_COLORS_BY_SLUG`
- 设计说明：`docs/prd-ui-spec.md` §2.2