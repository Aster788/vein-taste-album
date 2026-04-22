# 10城行政边界偏移审计报告

| 城市 | 文件存在 | 来源识别 | 几何闭环 | 点样本数 | A落区率 | B落区率 | B-A |
|---|---:|---|---:|---:|---:|---:|---:|
| shanghai | Yes | DataV-like (China district boundary schema) | 25/25 | 0 | N/A | N/A | N/A |
| qingdao | Yes | DataV-like (China district boundary schema) | 32/32 | 0 | N/A | N/A | N/A |
| chongqing | Yes | DataV-like (China district boundary schema) | 47/47 | 0 | N/A | N/A | N/A |
| guangzhou | Yes | DataV-like (China district boundary schema) | 11/11 | 0 | N/A | N/A | N/A |
| fuzhou | Yes | DataV-like (China district boundary schema) | 127/127 | 0 | N/A | N/A | N/A |
| quanzhou | Yes | DataV-like (China district boundary schema) | 50/50 | 0 | N/A | N/A | N/A |
| xiamen | Yes | DataV-like (China district boundary schema) | 12/12 | 0 | N/A | N/A | N/A |
| dalian | Yes | DataV-like (China district boundary schema) | 98/98 | 11 | 100.0% | 100.0% | +0.0% |
| jeju | Yes | Minimal custom schema (likely open admin source) | 3/3 | 19 | 78.9% | 78.9% | +0.0% |
| kuala-lumpur | Yes | TindakMalaysia parliamentary boundary schema | 11/11 | 0 | N/A | N/A | N/A |

## 说明
- A/B 指标定义：
  - A：原始 GeoJSON 边界
  - B：中国城市边界执行 GCJ->WGS 转换后
- 点样本不足（N/A）说明该城当前 restaurants.json 缺少可用经纬度。
- meanGcjToWgsShiftMeters 表示若把该城边界从 GCJ 转到 WGS，平均坐标位移量（米），用于估计潜在系统偏移规模。
