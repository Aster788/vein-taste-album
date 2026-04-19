# one-off: Gaode Web Service place search (key via env AMAP_WEB_KEY)
import json
import os
import urllib.parse
import urllib.request

KEY = os.environ.get("AMAP_WEB_KEY", "").strip()
if not KEY:
    raise SystemExit("Set AMAP_WEB_KEY")

STORES = [
    "仙生生寿司专门店(中山店)",
    "皇家面点(顺阳街)",
    "日月昇海鲜码头(民主广场店)",
    "WUYOO冰奶大连中山店",
    "阿水的生鱼饭旗舰店(长江路店)",
    "鹅记好吃店",
    "奉天玖福记沈阳鸡架(奥林匹克店)",
    "東北灵丹·SUP(南山路超级萃取店)",
    "王慧洁开口虾水饺·地道东北菜(银泰城店)",
    "DIVECOFFEE2.0 南山店",
    "岐迹正宗无水南瓜糕",
]


def get(url: str) -> dict:
    req = urllib.request.Request(url, headers={"User-Agent": "FoodForJoy/1.0"})
    with urllib.request.urlopen(req, timeout=25) as r:
        return json.loads(r.read().decode("utf-8"))


def place_text(keywords: str) -> dict:
    params = {
        "key": KEY,
        "keywords": keywords,
        "city": "大连",
        "citylimit": "true",
        "extensions": "all",
        "children": "1",
        "offset": "10",
        "page": "1",
    }
    q = urllib.parse.urlencode(params)
    return get(f"https://restapi.amap.com/v3/place/text?{q}")


def place_detail(poi_id: str) -> dict:
    params = {"key": KEY, "id": poi_id, "extensions": "all"}
    q = urllib.parse.urlencode(params)
    return get(f"https://restapi.amap.com/v3/place/detail?{q}")


def main():
    out = []
    for name in STORES:
        row = {"query": name, "text": None, "detail": None, "error": None}
        try:
            t = place_text(name)
            row["text"] = t
            if t.get("status") != "1":
                row["error"] = t.get("info")
                out.append(row)
                continue
            pois = t.get("pois") or []
            if not pois:
                row["error"] = "no_pois"
                out.append(row)
                continue
            best = pois[0]
            row["best_match"] = {
                "name": best.get("name"),
                "id": best.get("id"),
                "location": best.get("location"),
                "address": best.get("address"),
                "pname": best.get("pname"),
                "cityname": best.get("cityname"),
                "adname": best.get("adname"),
                "business_area": best.get("business_area"),
                "type": best.get("type"),
                "tel": best.get("tel"),
                "distance": best.get("distance"),
            }
            pid = best.get("id")
            if pid:
                row["detail"] = place_detail(pid)
        except Exception as e:
            row["error"] = str(e)
        out.append(row)
    print(json.dumps(out, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
