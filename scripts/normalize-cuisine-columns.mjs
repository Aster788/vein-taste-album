import xlsx from "xlsx";

const FILE = "src/data/restaurants.xlsx";
const wb = xlsx.readFile(FILE);
const ws = wb.Sheets[wb.SheetNames[0]];
const rows = xlsx.utils.sheet_to_json(ws, { header: 1, defval: null });
const headers = rows[0].map((h) => String(h ?? "").trim());
const col = Object.fromEntries(headers.map((h, i) => [h, i]));

function normEn(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/_/g, "-");
}

function setCell(rowIndex, key, value) {
  const c = col[key];
  if (c == null) return;
  const ref = xlsx.utils.encode_cell({ c, r: rowIndex });
  if (value == null || value === "") {
    delete ws[ref];
    return;
  }
  ws[ref] = { t: "s", v: value };
}

/** @type {Array<{ match: (row: unknown[]) => boolean, zh?: string, en?: string }>} */
const rowRules = [
  {
    match: (row) => String(row[col.name_zh] ?? "").includes("泰狮"),
    zh: "东南亚菜",
    en: "southeast-asian-cuisine",
  },
  {
    match: (row) => String(row[col.cuisine_zh] ?? "").trim() === "东南亚菜",
    en: "southeast-asian-cuisine",
  },
  {
    match: (row) => String(row[col.cuisine_zh] ?? "").trim() === "川菜",
    en: "chuan-cuisine",
  },
  {
    match: (row) => String(row[col.cuisine_zh] ?? "").trim() === "西班牙菜",
    en: "spanish-cuisine",
  },
  {
    match: (row) => String(row[col.cuisine_zh] ?? "").trim() === "西式",
    en: "western-cuisine",
  },
  {
    match: (row) => {
      const zh = String(row[col.cuisine_zh] ?? "").trim();
      const en = normEn(row[col.cuisine_en]);
      return zh === "面条" || en === "noodele";
    },
    zh: "面食",
    en: "noodle",
  },
  {
    match: (row) => String(row[col.cuisine_zh] ?? "").trim() === "小吃",
    zh: "零食",
  },
  {
    match: (row) => String(row[col.cuisine_zh] ?? "").trim() === "贵州菜",
    zh: "黔菜",
  },
  {
    match: (row) => {
      const zh = String(row[col.cuisine_zh] ?? "").trim();
      return zh === "俄国菜" || zh === "俄餐";
    },
    zh: "俄罗斯菜",
  },
];

/** @type {Record<string, string>} */
const enMigrations = {
  "sichuan-cuisine": "chuan-cuisine",
  spanish: "spanish-cuisine",
  "western-food": "western-cuisine",
  noodele: "noodle",
  japanese: "japanese-cuisine",
  korean: "korean-cuisine",
  italian: "italian-cuisine",
  "southeast-asian": "southeast-asian-cuisine",
  "northeastern-chinese-cuisine": "northeast-cuisine",
};

let changed = 0;
for (let r = 1; r < rows.length; r += 1) {
  const row = rows[r];
  let zh = String(row[col.cuisine_zh] ?? "").trim();
  let en = normEn(row[col.cuisine_en]);

  const migrated = enMigrations[en];
  if (migrated) en = migrated;

  for (const rule of rowRules) {
    if (!rule.match(row)) continue;
    if (rule.zh) zh = rule.zh;
    if (rule.en) en = rule.en;
  }

  const prevZh = String(row[col.cuisine_zh] ?? "").trim();
  const prevEn = normEn(row[col.cuisine_en]);
  if (zh !== prevZh || en !== prevEn) {
    setCell(r, "cuisine_zh", zh);
    setCell(r, "cuisine_en", en);
    changed += 1;
  }
}

xlsx.writeFile(wb, FILE);
console.log(`Updated ${changed} rows in ${FILE}`);
