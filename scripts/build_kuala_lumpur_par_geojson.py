"""
Build assets/geojson/kuala-lumpur.geojson from TindakMalaysia Federal Territories
Kuala Lumpur parliamentary boundaries (2015). ODbL — see upstream repo LICENSE.

Source: https://github.com/TindakMalaysia/Federal-Territories-Maps
File: KL/KL_PAR_2015/Kuala_Lumpur_PAR_2015.geojson
"""
from __future__ import annotations

import json
from pathlib import Path
import urllib.request

SOURCE_URL = (
    "https://raw.githubusercontent.com/TindakMalaysia/Federal-Territories-Maps/"
    "master/KL/KL_PAR_2015/Kuala_Lumpur_PAR_2015.geojson"
)

# Common Chinese names for WP Kuala Lumpur federal constituencies (国会议席).
PARLIAMENT_ZH: dict[str, str] = {
    "BANDAR TUN RAZAK": "敦拉萨镇",
    "BATU": "峇都",
    "BUKIT BINTANG": "武吉免登",
    "CHERAS": "蕉赖",
    "KEPONG": "甲洞",
    "LEMBAH PANTAI": "班底谷",
    "SEGAMBUT": "泗岩沫",
    "SEPUTEH": "士布爹",
    "SETIAWANGSA": "斯迪亚旺沙",
    "TITIWANGSA": "蒂蒂旺沙",
    "WANGSA MAJU": "旺沙玛珠",
}


def title_en(par: str) -> str:
    return " ".join(w.capitalize() for w in par.strip().split())


def main() -> int:
    req = urllib.request.Request(SOURCE_URL, headers={"User-Agent": "vein-taste-album/1.0 (geojson build)"})
    with urllib.request.urlopen(req, timeout=120) as resp:
        raw = json.load(resp)

    out_features = []
    for feat in raw.get("features", []):
        if feat.get("type") != "Feature":
            continue
        props = feat.get("properties") or {}
        par = str(props.get("Parliament") or "").strip().upper()
        if not par:
            continue
        name_en = title_en(par)
        name_zh = PARLIAMENT_ZH.get(par, name_en)
        out_features.append(
            {
                "type": "Feature",
                "properties": {
                    "name": name_en,
                    "name_en": name_en,
                    "name_zh": name_zh,
                    "level": "district",
                    "ffj_admin": "mys_parliament_wpkl_2015",
                    "ffj_parliament_ms": par,
                    "ffj_source": "TindakMalaysia/Federal-Territories-Maps KL_PAR_2015 (ODbL)",
                },
                "geometry": feat.get("geometry"),
            }
        )

    out_fc = {
        "type": "FeatureCollection",
        "features": out_features,
        "properties": {
            "ffj_attribution": (
                "Boundaries: TindakMalaysia Federal-Territories-Maps "
                "(Kuala_Lumpur_PAR_2015.geojson), ODbL."
            ),
        },
    }

    dest = Path(__file__).resolve().parents[1] / "src" / "assets" / "geojson" / "kuala-lumpur.geojson"
    dest.write_text(json.dumps(out_fc, ensure_ascii=False), encoding="utf-8")
    print(f"wrote {dest} ({len(out_features)} features)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
