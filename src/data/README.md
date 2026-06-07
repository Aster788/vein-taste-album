# Data Authoring Rules

Food data is maintained in two workbook sources:

- `src/data/restaurants.xlsx`
- `src/data/dishes.xlsx`

Run `npm run data:sync` to regenerate `restaurants.json` and `dishes.json` after edits.
Run `npm run data:export-translations` to batch-fill missing non-name copy translations into `translations.static.json` (for static runtime lookup).

## Non-China City Locale Config

UI language buttons for non-China city detail pages are maintained separately in:

- `src/data/city_meta.json`

When adding a new non-China city, update this file together with workbook/JSON data. Do not hardcode city-specific language tabs in React components.

Required rules:

- Add one entry keyed by route slug (for example: `jeju`, `kuala-lumpur`).
- Always set `detail_locale_mode`:
  - `en_native_zh` -> show `EN / <native ISO 639-1> / CN`
  - `en_zh` -> show `EN / CN`
- If `detail_locale_mode=en_native_zh`, also provide:
  - `native_iso639_1`
  - `native_button_label`

China cities do not need entries in `city_meta.json`.

## MT cache persistence policy

Machine translation runtime cache is stored in browser `localStorage` and is configurable via env:

- `VITE_MT_CACHE_TTL_DAYS=3650` (default): keep translated entries for 10 years.
- `VITE_MT_CACHE_TTL_DAYS=-1`: never expire cache by time (manual clear only).

For this project (few and mostly stable texts), prefer long TTL or no-expiry.

When `translations.static.json` contains an entry, runtime will always prefer this static value over network MT.

## Restaurants Sheet

Required fields (per data row):

- `store_slug`
- `city_en`
- `record_scope` (`branch` or `brand`)
- at least one of: `name_zh`, `name_en`, `name_local`

Scope and map behavior:

- `record_scope=branch`: concrete branch record; map point when `lng`/`lat` exist and row is not excluded (see below).
- `record_scope=brand`: brand-level record, does not render map point.
- `closed`: optional; `yes` (case-insensitive) = closed — excluded from map, still on cuisine page.
- `address` exactly `连锁店` (after trim): chain placeholder — excluded from map, still on cuisine page.

Map eligibility (`getMappableRestaurantsByCity`): `branch` + valid coordinates + not (`brand` | `closed=yes` | `address=连锁店`).

Slug/scope hygiene rules:

- `store_slug` should satisfy `[a-z0-9-]+`.
- `(city_en, store_slug)` must be unique for **dishes** and **photos** (one menu / album per slug).
- `restaurants.json` may contain **multiple** `branch` rows with the same `(city_en, store_slug)` when a brand has several locations; map shows each row, cuisine UI groups by slug (see `docs/data-workflow.md` §4.1).
- **Universal rule — not store-specific**: any future multi-branch store follows the same logic when branches share `store_slug`; implementation is only in `src/utils/storeGroups.js` (no React whitelist).
- Use `branch` for concrete stores (even if coordinates are temporarily missing and will be filled later).
- Use `brand` only for brand-level placeholders that should never become map points.

Optional columns:

- all other restaurant columns (for example: `city_en`, `city_zh`, `cuisine_zh`, `cuisine_en`, `price_per_person`, `hours`, `phone`, `map_url`)
- `recommend`: `yes` (recommended — thumbs-up in store list), `no` (not recommended — thumbs-down), or empty / `null` (no marker). Use the same value for every `branch` row that shares a `store_slug`.

### Cuisine fields (`cuisine_zh` / `cuisine_en`)

These two columns link each store to a sticker under `src/assets/stickers/cuisine/`:

| Column | Role |
| ------ | ---- |
| `cuisine_zh` | Chinese label shown in filters, map tags, and store detail |
| `cuisine_en` | Sticker slug; **must exactly match** `{cuisine_en}.svg` in `stickers/cuisine/` (e.g. `hotpot`, `chuan-cuisine`, `russian-cuisine`) |

Rules:

- Fill **both** when possible. **`cuisine_en` is the source of truth** for the sticker file name and filter key; `cuisine_zh` is the source of truth for Chinese display text.
- `cuisine_en` format: lowercase `[a-z0-9-]+`. Many regional cuisines use a `-cuisine` suffix (e.g. `korean-cuisine`, `western-cuisine`); some use short slugs (e.g. `noodle`, `hotpot`). Do not reuse deprecated slugs such as `japanese`, `korean`, `sichuan-cuisine`, `western-food`, `russian` (without `-cuisine` where applicable).
- Keep `(cuisine_zh, cuisine_en)` pairs consistent across rows: one Chinese label should map to one slug (e.g. all 川菜 rows use `chuan-cuisine`, not mixed with old `sichuan-cuisine`).
- Preferred unified `cuisine_zh` labels (when applicable): 面食、零食、黔菜、西式、俄罗斯菜 — align with `CUISINE_BY_EN` in `src/utils/cuisineSlugs.js`.
- When adding a new slug: add SVG → add `CUISINE_BY_EN` entry → fill Excel. If SVG is missing, UI falls back to `other.svg` until the asset exists.
- Legacy column `cuisine` is still synced: if `cuisine_zh` is empty, sync copies `cuisine` into `cuisine_zh`.
- See [docs/structure.md](../docs/structure.md)（菜系筛选贴纸）and `src/utils/cuisineSlugs.js` for the full slug registry and DEV warnings when a slug has no SVG.

### Multi-branch stores (same `store_slug` in one city)

When one brand has several locations in the same city:

1. Add one Excel row per branch, all with the **same** `store_slug` and `record_scope=branch`.
2. Each row gets its own `name_zh` (with branch suffix in parentheses), `address`, `lng`, `lat`.
3. In `dishes.xlsx`, use that shared `store_slug` once; `store_name_*` = base brand name (no branch suffix).
4. Photos: one folder `src/assets/photos/{city}/{store_slug}/`.
5. Run `npm run data:sync` then `npm run audit:multi-branch` to verify.

UI grouping is automatic via `src/utils/storeGroups.js` — do not add store-specific logic in React.

### Phone field (`phone`)

- Store one or more phone numbers in a single cell.
- Separate multiple numbers with English `;` or full-width Chinese `；` (both are supported).
- Do not add line breaks in Excel; the frontend splits on semicolons and displays each number on its own line in the store detail panel (`NotePanel`).
- Example: `020-83700611;020-83700622` or `13862053849；15862546585`.

Numeric formatting rules (must stay consistent for every row, including newly added rows):

- `price_per_person`: store as numeric only (no currency symbols like `¥`/`₩`/`RM`, no text prefix/suffix). Currency must be recorded in `currency`.
  - Mapping rule: in `restaurants.xlsx`, `currency` is the unit for `price_per_person` (for example: `CNY` -> `¥`, `KRW` -> `₩`, `MYR` -> `RM`).
- `score_overall`: store as numeric only, rounded/formatted to 1 decimal place.
- Do not mix text numbers and numeric cells in these two columns; keep both columns as numeric cell types to avoid alignment/type drift in Excel.

`is_china` rules:

- Use lowercase string values only: `true` or `false`.
- Avoid values like `FALSE`, `0`, `no`, empty string, or `null` text.

## Google Places Enrichment Rules (for `restaurants.xlsx`)

When using scripts to enrich rows from Google Maps/Places, apply the following rules consistently.

### Input source scanning

- Scan `src/data/*.xlsx` for city source workbooks in Google Takeout shape (`Title`, `URL`).
- Exclude:
  - `restaurants.xlsx`
  - `dishes.xlsx`
  - temporary lock files starting with `~$`

### Name field write rules

- Multi-language names should be fetched from the same `place_id` with multiple `language` requests and written separately:
  - Chinese -> `name_zh`
  - English -> `name_en`
  - local language -> `name_local` (language code configured per city)
- If a language name is missing from Google Places, keep that target field empty (do not invent translations).
- `name_zh` must not contain pure English text:
  - write to `name_zh` only when value includes Chinese characters.
- `name_en` must contain pure English text only:
  - write to `name_en` only when value matches English-only text; otherwise keep empty.

Title fallback rules (used only when corresponding Google language value is missing):

- pure English title -> `name_en`
- Chinese-only title -> `name_zh`
- non-Chinese/non-English or mixed-language title -> `name_local`

### Hours normalization rules

Store hours text with these formatting constraints:

- day/range and time are separated by a space, not a colon:
  - use `星期一 10:00–22:00`, not `星期一: 10:00–22:00`
- if all 7 days are the same:
  - `周一至周日 08:00–22:00`
- if adjacent days share the same time, merge ranges with `至`:
  - `星期二至星期日 17:00–01:00`
- if non-adjacent ranges share the same time, merge range labels with `、`:
  - `星期一至星期二、星期六 10:00–22:00`
- if multiple time ranges need separate lines on the site, keep one cell in Excel and separate segments with ASCII `|` or fullwidth `｜` (do not use line breaks in the cell):
  - example: `周一至周四 09:00-21:00 | 周五至周日 10:00-22:00`
  - `NotePanel` splits on `|` / `｜` and renders each segment on its own line

### Manual-edit protection (rerun behavior)

For reruns of enrichment scripts:

- `name_zh`: if cell already has a non-empty value, do not overwrite.
- `cuisine` / `cuisine_zh` / `cuisine_en`: first run may auto-fill when empty; if cell already has a non-empty value, do not overwrite.
- `hours`: if cell already has a non-empty value, do not overwrite.
- Other fields may continue to auto-update.

## Dishes Sheet

Required fields (per data row):

- `store_slug`
- at least one of: `dish_name_zh`, `dish_name_en`, `dish_name_local`

Rows with all three dish names empty are skipped on sync (they do not block photo display; see `src/assets/photos/{city}/{store_slug}/`).

### One dish, multiple photos (variant filenames)

When one dish needs more than one image (e.g. cross-section, detail shot), use the **exact dish name** for the primary photo and a **suffix** for variants:

- Primary: `{dish_name_zh}.jpg` (or `dish_name_en` / `dish_name_local` if that is your naming convention)
- Variant: `{dish_name_zh}-{suffix}.jpg` — use ASCII hyphen `-` between dish name and suffix (URL-safe), e.g. `贵州抹茶柚子蛋糕-横截面.jpg`

Frontend rules (see [project_rules.md](../../docs/project_rules.md) §五, [storePhotos.js](../utils/storePhotos.js)):

- Exact basename match → show dish row from `dishes.json` (name, price, stars, note); China cities switch `dish_name_zh` ↔ `dish_name_en` with EN/CN (see [prd-i18n-locale.md](../../docs/prd-i18n-locale.md))
- Prefix match only (variant filename) → show full basename only; sort immediately after the exact-match photo for that dish

Optional columns:

- all other dish columns (for example: `city_en`, `store_name_zh`, `store_name_en`, `store_name_local`, `price`, `note`)
- `currency` is supported and should be filled when `price` has value.
  - Mapping rule: in `dishes.xlsx`, `currency` is the unit for `price` (same code set: `CNY` / `KRW` / `MYR`).
  - Rendering rule (must stay consistent for new rows):
    - if `price` already includes a currency marker/text (`¥`/`₩`/`$`/`RM`/`CNY`/`KRW`/`MYR`), frontend keeps `price` as-is.
    - otherwise, when `currency` is present, frontend prepends currency prefix:
      - frontend resolves symbol dynamically from `currency` (ISO 4217 code) via runtime formatter (for example: `JPY -> ¥`, `THB -> ฿`, `USD -> $`).
      - when symbol resolution is unavailable, fallback is raw `currency` code prefix.
    - this applies to both plain numeric prices (`38`) and descriptive prices (`19/个`, `11/斤`).
  - Authoring recommendation:
    - keep `price` focused on amount/description only, do not manually repeat currency symbols.
    - always fill `currency` whenever `price` has value, to avoid missing currency display in UI.
