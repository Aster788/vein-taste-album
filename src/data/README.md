# Data Authoring Rules

Food data is maintained in two workbook sources:

- `src/data/restaurants.xlsx`
- `src/data/dishes.xlsx`

Run `npm run data:sync` to regenerate `restaurants.json` and `dishes.json` after edits.

## Restaurants Sheet

Required columns:

- `city_en`
- `city_zh`
- `cuisine`
- at least one of: `name_zh`, `name_en`, `name_local`

Scope and map behavior:

- `record_scope=branch`: concrete branch record, can render map point when `lng` and `lat` exist.
- `record_scope=brand`: brand-level record, does not render map point.

Optional columns:

- `price_per_person`, `hours`, `phone`, `map_url`

Numeric formatting rules (must stay consistent for every row, including newly added rows):

- `price_per_person`: store as numeric only (no currency symbols like `¥`/`₩`/`RM`, no text prefix/suffix). Currency must be recorded in `currency`.
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

Required columns:

- `city_en`
- at least one of: `store_name_zh`, `store_name_en`, `store_name_local`
- at least one of: `dish_name_zh`, `dish_name_en`, `dish_name_local`

Optional columns:

- `price` (nullable)
- `note` (nullable, rendered as plain text with no field label)
