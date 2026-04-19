import gcoord from "gcoord";

/**
 * 将单点 GCJ-02（国测局 / 高德）转为 WGS-84（Mapbox 使用）。
 * @param {number} lng
 * @param {number} lat
 * @returns {{ lng: number, lat: number }}
 */
export function gcj02ToWgs84(lng, lat) {
  const [wgsLng, wgsLat] = gcoord.transform(
    [lng, lat],
    gcoord.GCJ02,
    gcoord.WGS84
  );
  return { lng: wgsLng, lat: wgsLat };
}

/**
 * 交给 Mapbox 前的经纬度：中国店铺为 GCJ-02→WGS-84；非中国为原始 WGS-84。
 * @param {{ lng: number, lat: number, is_china: boolean }} restaurant restaurants.json 单条
 * @returns {{ lng: number, lat: number }}
 */
export function lngLatForMapbox(restaurant) {
  if (!restaurant.is_china) {
    return { lng: restaurant.lng, lat: restaurant.lat };
  }
  return gcj02ToWgs84(restaurant.lng, restaurant.lat);
}

/*
 * 手动校验示例（浏览器控制台或临时脚本）：
 *
 *   import { gcj02ToWgs84, lngLatForMapbox } from './coordTransform.js';
 *   gcj02ToWgs84(121.647437, 38.925011);
 *   lngLatForMapbox({ lng: 121.647437, lat: 38.925011, is_china: true });
 *   lngLatForMapbox({ lng: 126.5, lat: 33.5, is_china: false }); // 不转换
 */
