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

- `record_scope=branch`: concrete branch record, can render map point when `lng` and `lat` exist.
- `record_scope=brand`: brand-level record, does not render map point.

Slug/scope hygiene rules:

- `store_slug` should satisfy `[a-z0-9-]+` and be unique at least by `(city_en, store_slug)`.
- Use `branch` for concrete stores (even if coordinates are temporarily missing and will be filled later).
- Use `brand` only for brand-level placeholders that should never become map points.

Optional columns:

- all other restaurant columns (for example: `city_en`, `city_zh`, `cuisine`, `price_per_person`, `hours`, `phone`, `map_url`)

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

### Manual-edit protection (rerun behavior)

For reruns of enrichment scripts:

- `name_zh`: if cell already has a non-empty value, do not overwrite.
- `cuisine`: first run may auto-fill when empty; if cell already has a non-empty value, do not overwrite.
- `hours`: if cell already has a non-empty value, do not overwrite.
- Other fields may continue to auto-update.

## Dishes Sheet

Required fields (per data row):

- `store_slug`
- at least one of: `dish_name_zh`, `dish_name_en`, `dish_name_local`

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
