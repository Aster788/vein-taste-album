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

function transformPosition(position) {
  if (!Array.isArray(position) || position.length < 2) return position;
  const lng = Number(position[0]);
  const lat = Number(position[1]);
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return position;
  const [wgsLng, wgsLat] = gcoord.transform([lng, lat], gcoord.GCJ02, gcoord.WGS84);
  return [wgsLng, wgsLat];
}

function transformCoordinatesDeep(coords) {
  if (!Array.isArray(coords)) return coords;
  if (coords.length >= 2 && typeof coords[0] === "number" && typeof coords[1] === "number") {
    return transformPosition(coords);
  }
  return coords.map((child) => transformCoordinatesDeep(child));
}

/**
 * 将城市边界 GeoJSON 从 GCJ-02 转为 Mapbox 使用的 WGS-84。
 * 仅在上层确认 `shouldTransform=true` 时生效（通常为中国城市）。
 *
 * @param {GeoJSON.FeatureCollection} featureCollection
 * @param {boolean} shouldTransform
 * @returns {GeoJSON.FeatureCollection}
 */
export function boundaryGeoJsonForMapbox(featureCollection, shouldTransform) {
  if (!shouldTransform) return featureCollection;
  if (!featureCollection || featureCollection.type !== "FeatureCollection") return featureCollection;

  const features = Array.isArray(featureCollection.features) ? featureCollection.features : [];
  return {
    ...featureCollection,
    features: features.map((feature) => {
      const geometry = feature?.geometry;
      if (!geometry?.coordinates) return feature;
      return {
        ...feature,
        geometry: {
          ...geometry,
          coordinates: transformCoordinatesDeep(geometry.coordinates),
        },
      };
    }),
  };
}

/*
 * 手动校验示例（浏览器控制台或临时脚本）：
 *
 *   import { gcj02ToWgs84, lngLatForMapbox } from './coordTransform.js';
 *   gcj02ToWgs84(121.647437, 38.925011);
 *   lngLatForMapbox({ lng: 121.647437, lat: 38.925011, is_china: true });
 *   lngLatForMapbox({ lng: 126.5, lat: 33.5, is_china: false }); // 不转换
 */
