"""
Build assets/geojson/melaka.geojson from DOSM Malaysia open geodata (GE15 DUN).

Source: https://github.com/dosm-malaysia/data-open
File: datasets/geodata/electoral_1_dun.geojson
"""
from __future__ import annotations

import json
from pathlib import Path
import urllib.request

SOURCE_URL = (
    "https://raw.githubusercontent.com/dosm-malaysia/data-open/main/"
    "datasets/geodata/electoral_1_dun.geojson"
)

# Chinese labels for Melaka state assembly seats (GE15), keyed by English name.
DUN_ZH: dict[str, str] = {
    "KUALA LINGGI": "瓜拉宁宜",
    "TANJUNG BIDARA": "丹绒比达拉",
    "AYER LIMAU": "亚依莱毛",
    "LENDU": "莲柱",
    "TABOH NANING": "沓浩宁宁",
    "REMBIA": "伦比亚",
    "GADEK": "嘉帝",
    "MACHAP JAYA": "马接再也",
    "DURIAN TUNGGAL": "榴梿洞甲",
    "ASAHAN": "亚沙汉",
    "SUNGAI UDANG": "乌浪河",
    "PANTAI KUNDOR": "昆多尔海岸",
    "PAYA RUMPUT": "巴耶隆布",
    "KELEBANG": "吉打邦",
    "PENGKALAN BATU": "巴西皮夯",
    "AYER KEROH": "爱极乐",
    "BUKIT KATIL": "武吉加迪",
    "AYER MOLEK": "爱人流",
    "KESIDANG": "格西当",
    "KOTA LAKSAMANA": "拉士曼纳城",
    "DUYONG": "杜勇",
    "BANDAR HILIR": "滨海城",
    "TELOK MAS": "金马士湾",
    "BEMBAN": "文班",
    "RIM": "林茂",
    "SERKAM": "昔甘",
    "MERLIMAU": "木叻茂",
    "SUNGAI RAMBAI": "双溪兰拜",
}


def title_en(name: str) -> str:
    return " ".join(w.capitalize() for w in name.strip().split())


def dun_name_en(dun_label: str) -> str:
    """Parse 'N.22 Bandar Hilir' -> 'Bandar Hilir'."""
    label = dun_label.strip()
    if " " in label:
        return label.split(" ", 1)[1].strip()
    return label


def main() -> int:
    req = urllib.request.Request(SOURCE_URL, headers={"User-Agent": "food-for-joy/1.0 (geojson build)"})
    with urllib.request.urlopen(req, timeout=120) as resp:
        raw = json.load(resp)

    out_features = []
    for feat in raw.get("features", []):
        if feat.get("type") != "Feature":
            continue
        props = feat.get("properties") or {}
        if props.get("state") != "Melaka":
            continue

        dun_label = str(props.get("dun") or "").strip()
        raw_en = dun_name_en(dun_label)
        if not raw_en:
            continue

        name_en = title_en(raw_en)
        name_key = raw_en.upper()
        name_zh = DUN_ZH.get(name_key, name_en)

        out_features.append(
            {
                "type": "Feature",
                "properties": {
                    "name": name_en,
                    "name_en": name_en,
                    "name_zh": name_zh,
                    "level": "district",
                    "ffj_admin": "mys_dun_melaka_ge15",
                    "ffj_dun": props.get("code_dun"),
                    "ffj_parlimen": props.get("code_parlimen"),
                    "ffj_source": "dosm-malaysia/data-open electoral_1_dun.geojson (GE15)",
                },
                "geometry": feat.get("geometry"),
            }
        )

    out_features.sort(key=lambda f: str((f.get("properties") or {}).get("ffj_dun") or ""))

    out_fc = {
        "type": "FeatureCollection",
        "features": out_features,
        "properties": {
            "ffj_attribution": (
                "Boundaries: DOSM data-open electoral_1_dun (Melaka DUN, GE15)."
            ),
        },
    }

    dest = Path(__file__).resolve().parents[1] / "src" / "assets" / "geojson" / "melaka.geojson"
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(json.dumps(out_fc, ensure_ascii=False), encoding="utf-8")
    print(f"wrote {dest} ({len(out_features)} features)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
