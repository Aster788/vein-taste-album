import { useEffect, useMemo, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { boundaryGeoJsonForMapbox, lngLatForMapbox } from "../utils/coordTransform.js";
import {
  pickByDetailLocale,
  pickByLocale,
  useLanguage,
} from "../context/LanguageContext.jsx";
import {
  cityEnFromBookshelfSlug,
  getMappableRestaurantsByCity,
} from "../utils/dataLoader.js";
import { isChinaCitySlug } from "../utils/citySlugs.js";
import placeholderMapUrl from "../assets/fallback-maps/placeholder-map.svg?url";
import dalianStaticMapUrl from "../assets/fallback-maps/dalian-static-map.png?url";
import jejuStaticMapUrl from "../assets/fallback-maps/jeju-static-map.png?url";

const FALLBACK_CITY_SLUG = "shanghai";
const MAPBOX_STYLE = "mapbox://styles/mapbox/light-v11";
const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
const MAP_PAPER_BACKGROUND = "#F7F3EE";
const MAP_ROAD_WARM_GRAY = "#D8CEC2";
const MAP_WATER_LIGHT_BLUE = "#DDE8EF";
const CITY_BOUNDARY_SOURCE_ID = "ffj-city-boundary-source";
const CITY_BOUNDARY_LINE_HALO_LAYER_ID = "ffj-city-boundary-line-halo";
const CITY_BOUNDARY_LINE_LAYER_ID = "ffj-city-boundary-line";
const CITY_BOUNDARY_LABEL_SOURCE_ID = "ffj-city-boundary-label-source";
const CITY_BOUNDARY_LABEL_LAYER_ID = "ffj-city-boundary-label";
const RESTAURANT_POINTS_SOURCE_ID = "ffj-restaurant-points-source";
const RESTAURANT_POINTS_LAYER_ID = "ffj-restaurant-points-layer";
const FALLBACK_MAP_IMAGE_BY_CITY_SLUG = Object.freeze({
  dalian: dalianStaticMapUrl,
  jeju: jejuStaticMapUrl,
});

// PRD 1.6：Mapbox 初始化城市中心（WGS-84）与推荐缩放。
const CITY_VIEW_BY_SLUG = Object.freeze({
  dalian: Object.freeze({ center: [121.6147, 38.914], zoom: 11 }),
  qingdao: Object.freeze({ center: [120.3826, 36.0671], zoom: 11 }),
  shanghai: Object.freeze({ center: [121.4737, 31.2304], zoom: 11 }),
  guangzhou: Object.freeze({ center: [113.2644, 23.1291], zoom: 11 }),
  chongqing: Object.freeze({ center: [106.5516, 29.563], zoom: 11 }),
  fuzhou: Object.freeze({ center: [119.2965, 26.0745], zoom: 11 }),
  xiamen: Object.freeze({ center: [118.0894, 24.4798], zoom: 11 }),
  quanzhou: Object.freeze({ center: [118.6757, 24.8741], zoom: 11 }),
  jeju: Object.freeze({ center: [126.5312, 33.4996], zoom: 10 }),
  "kuala-lumpur": Object.freeze({ center: [101.6869, 3.139], zoom: 11 }),
});

function getCityView(citySlug) {
  return CITY_VIEW_BY_SLUG[citySlug] ?? CITY_VIEW_BY_SLUG[FALLBACK_CITY_SLUG];
}

/** 与 `global.css` 中 `html[data-city]` 的 `--city-primary` / `--city-secondary` 保持一致，供地图边界线着色。 */
const CITY_MAP_LINE_COLORS_BY_SLUG = Object.freeze({
  dalian: Object.freeze({ primary: "#6f93ae", secondary: "#eaf0f4" }),
  qingdao: Object.freeze({ primary: "#5f84b0", secondary: "#f0ede7" }),
  shanghai: Object.freeze({ primary: "#505050", secondary: "#ece7d9" }),
  guangzhou: Object.freeze({ primary: "#b18a59", secondary: "#f3efe7" }),
  chongqing: Object.freeze({ primary: "#b0664d", secondary: "#f0e0d8" }),
  fuzhou: Object.freeze({ primary: "#7d9570", secondary: "#ece5dc" }),
  xiamen: Object.freeze({ primary: "#6e9496", secondary: "#eeeae3" }),
  quanzhou: Object.freeze({ primary: "#967662", secondary: "#f0ebe4" }),
  jeju: Object.freeze({ primary: "#d98f65", secondary: "#f5eae1" }),
  "kuala-lumpur": Object.freeze({ primary: "#9368b8", secondary: "#f2ede4" }),
});

function getCityMapLineColors(citySlug) {
  return CITY_MAP_LINE_COLORS_BY_SLUG[citySlug] ?? CITY_MAP_LINE_COLORS_BY_SLUG[FALLBACK_CITY_SLUG];
}

function overrideMapPaperPalette(map) {
  const style = map.getStyle();
  if (!style?.layers) return;

  style.layers.forEach((layer) => {
    if (layer.type === "background") {
      map.setPaintProperty(layer.id, "background-color", MAP_PAPER_BACKGROUND);
      return;
    }

    const sourceLayerName = String(layer["source-layer"] ?? "").toLowerCase();
    const layerId = String(layer.id ?? "").toLowerCase();
    const isRoadLayer = sourceLayerName.includes("road") || layerId.includes("road");
    const isWaterLayer =
      sourceLayerName.includes("water") ||
      layerId.includes("water") ||
      sourceLayerName.includes("ocean");

    if (isRoadLayer && layer.type === "line") {
      map.setPaintProperty(layer.id, "line-color", MAP_ROAD_WARM_GRAY);
      return;
    }

    if (isRoadLayer && layer.type === "fill") {
      map.setPaintProperty(layer.id, "fill-color", MAP_ROAD_WARM_GRAY);
      return;
    }

    if (isWaterLayer && layer.type === "fill") {
      map.setPaintProperty(layer.id, "fill-color", MAP_WATER_LIGHT_BLUE);
      return;
    }

    if (isWaterLayer && layer.type === "line") {
      map.setPaintProperty(layer.id, "line-color", MAP_WATER_LIGHT_BLUE);
    }
  });
}

function hideBaseAdminNoiseLayers(map) {
  const style = map.getStyle();
  if (!style?.layers) return;

  style.layers.forEach((layer) => {
    const sourceLayerName = String(layer["source-layer"] ?? "").toLowerCase();
    const layerId = String(layer.id ?? "").toLowerCase();
    const isBoundaryOrAdminLayer =
      sourceLayerName.includes("admin") ||
      sourceLayerName.includes("boundary") ||
      layerId.includes("admin") ||
      layerId.includes("boundary");
    const isPlaceLabelLayer =
      layer.type === "symbol" &&
      (sourceLayerName.includes("place") || layerId.includes("place-label"));
    const shouldHideLayer = isBoundaryOrAdminLayer || isPlaceLabelLayer;

    if (!shouldHideLayer) return;

    try {
      map.setLayoutProperty(layer.id, "visibility", "none");
    } catch {
      // 某些底图图层不支持可见性切换时，静默跳过，避免影响地图初始化。
    }
  });
}

function removeCityBoundaryLayers(map) {
  if (map.getLayer(CITY_BOUNDARY_LABEL_LAYER_ID)) {
    map.removeLayer(CITY_BOUNDARY_LABEL_LAYER_ID);
  }
  if (map.getLayer(CITY_BOUNDARY_LINE_LAYER_ID)) {
    map.removeLayer(CITY_BOUNDARY_LINE_LAYER_ID);
  }
  if (map.getLayer(CITY_BOUNDARY_LINE_HALO_LAYER_ID)) {
    map.removeLayer(CITY_BOUNDARY_LINE_HALO_LAYER_ID);
  }
  if (map.getSource(CITY_BOUNDARY_LABEL_SOURCE_ID)) {
    map.removeSource(CITY_BOUNDARY_LABEL_SOURCE_ID);
  }
  if (map.getSource(CITY_BOUNDARY_SOURCE_ID)) {
    map.removeSource(CITY_BOUNDARY_SOURCE_ID);
  }
}

function removeRestaurantPointLayers(map) {
  if (map.getLayer(RESTAURANT_POINTS_LAYER_ID)) {
    map.removeLayer(RESTAURANT_POINTS_LAYER_ID);
  }
  if (map.getSource(RESTAURANT_POINTS_SOURCE_ID)) {
    map.removeSource(RESTAURANT_POINTS_SOURCE_ID);
  }
}

function polygonSignedArea(ring) {
  if (!Array.isArray(ring) || ring.length < 3) return 0;
  let sum = 0;
  for (let i = 0; i < ring.length - 1; i += 1) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[i + 1];
    sum += x1 * y2 - x2 * y1;
  }
  return sum / 2;
}

function polygonCentroid(ring) {
  if (!Array.isArray(ring) || ring.length < 4) return null;

  let cx = 0;
  let cy = 0;
  let signedArea = 0;

  for (let i = 0; i < ring.length - 1; i += 1) {
    const [x0, y0] = ring[i];
    const [x1, y1] = ring[i + 1];
    const cross = x0 * y1 - x1 * y0;
    signedArea += cross;
    cx += (x0 + x1) * cross;
    cy += (y0 + y1) * cross;
  }

  if (signedArea === 0) return null;

  const area = signedArea * 0.5;
  cx /= 6 * area;
  cy /= 6 * area;
  return [cx, cy];
}

function centroidFromPolygonCoords(polygonCoords) {
  if (!Array.isArray(polygonCoords) || polygonCoords.length === 0) return null;

  let bestRing = null;
  let bestAbsArea = -1;

  polygonCoords.forEach((ring) => {
    if (!Array.isArray(ring) || ring.length < 4) return;
    const area = polygonSignedArea(ring);
    const absArea = Math.abs(area);
    if (absArea > bestAbsArea) {
      bestAbsArea = absArea;
      bestRing = ring;
    }
  });

  if (!bestRing) return null;
  return polygonCentroid(bestRing);
}

function centroidFromGeometry(geometry) {
  if (!geometry) return null;

  if (geometry.type === "Polygon") {
    return centroidFromPolygonCoords(geometry.coordinates);
  }

  if (geometry.type === "MultiPolygon") {
    let best = null;
    let bestAbsArea = -1;

    geometry.coordinates.forEach((polygonCoords) => {
      if (!Array.isArray(polygonCoords) || polygonCoords.length === 0) return;
      const outerRing = polygonCoords[0];
      const area = polygonSignedArea(outerRing);
      const absArea = Math.abs(area);
      if (absArea > bestAbsArea) {
        bestAbsArea = absArea;
        best = centroidFromPolygonCoords(polygonCoords);
      }
    });

    return best;
  }

  return null;
}

function pointCoordsFromDistrictPropertiesOrGeometry(properties, geometry) {
  const p = properties ?? {};

  const centroid = p.centroid;
  if (Array.isArray(centroid) && centroid.length >= 2) {
    const lng = Number(centroid[0]);
    const lat = Number(centroid[1]);
    if (Number.isFinite(lng) && Number.isFinite(lat)) return [lng, lat];
  }

  const center = p.center;
  if (Array.isArray(center) && center.length >= 2) {
    const lng = Number(center[0]);
    const lat = Number(center[1]);
    if (Number.isFinite(lng) && Number.isFinite(lat)) return [lng, lat];
  }

  return centroidFromGeometry(geometry);
}

function pickDistrictLabelZh(properties) {
  const p = properties ?? {};
  const zh = String(p.name_zh ?? "").trim();
  if (zh !== "") return zh;
  return String(p.name ?? p.NAME ?? p.Name ?? "").trim();
}

function pickDistrictLabelEn(properties) {
  const p = properties ?? {};
  const en = String(p.name_en ?? "").trim();
  if (en !== "") return en;
  return String(p.name ?? p.NAME ?? p.Name ?? "").trim();
}

function buildDistrictLabelPoints(boundaryGeoJson) {
  const features = Array.isArray(boundaryGeoJson?.features) ? boundaryGeoJson.features : [];
  const labelFeatures = [];

  features.forEach((feature) => {
    if (!feature || feature.type !== "Feature") return;
    const centroid = pointCoordsFromDistrictPropertiesOrGeometry(feature.properties, feature.geometry);
    if (!centroid) return;

    const zh = pickDistrictLabelZh(feature.properties);
    const en = pickDistrictLabelEn(feature.properties);
    const ffj_label_text = zh !== "" && en !== "" && zh !== en ? `${zh}\n${en}` : zh || en;

    labelFeatures.push({
      type: "Feature",
      properties: {
        ...feature.properties,
        ffj_label_zh: zh,
        ffj_label_en: en,
        ffj_label_text,
      },
      geometry: {
        type: "Point",
        coordinates: centroid,
      },
    });
  });

  return {
    type: "FeatureCollection",
    features: labelFeatures,
  };
}

function normalizeBoundaryGeoJson(rawData) {
  if (rawData?.type === "FeatureCollection" && Array.isArray(rawData?.features)) {
    return rawData;
  }
  return null;
}

async function loadCityBoundaryGeoJson(citySlug) {
  const geoJsonUrl = new URL(`../assets/geojson/${citySlug}.geojson`, import.meta.url).href;
  const response = await fetch(geoJsonUrl);
  if (!response.ok) return null;
  const rawData = await response.json();
  const normalized = normalizeBoundaryGeoJson(rawData);
  if (!normalized) return null;
  return boundaryGeoJsonForMapbox(normalized, isChinaCitySlug(citySlug));
}

function buildRestaurantPointsGeoJson(citySlug) {
  const cityEn = cityEnFromBookshelfSlug(citySlug);
  const rows = getMappableRestaurantsByCity(cityEn);
  const features = rows
    .map((row) => {
      const point = lngLatForMapbox(row);
      if (!Number.isFinite(point?.lng) || !Number.isFinite(point?.lat)) return null;
      const displayName = pickRestaurantDisplayName(row);
      return {
        type: "Feature",
        properties: {
          name_zh: row.name_zh,
          name_en: row.name_en,
          name_local: row.name_local,
          display_name: displayName,
          cuisine: row.cuisine,
          city_en: row.city_en,
          score_overall: row.score_overall,
          score_taste: row.score_taste,
          score_environment: row.socre_environment ?? row.score_environment,
          score_service: row.score_service,
          score_queue: row.score_queue,
          score_packaging: row.score_packaging,
          score_delivery: row.score_delivery,
          score_personal: row.score_personal,
          address: row.address,
          price_per_person: row.price_per_person,
          currency: row.currency,
          hours: row.hours,
          phone: row.phone,
          map_platform: row.map_platform,
          map_url: row.map_url,
          dining_type: row.dining_type,
          store_key:
            String(row.store_slug ?? "").trim() !== ""
              ? `${String(row.city_en ?? "").trim()}-${String(row.store_slug ?? "").trim()}`
              : `${String(row.city_en ?? "").trim()}-${displayName}`,
        },
        geometry: {
          type: "Point",
          coordinates: [point.lng, point.lat],
        },
      };
    })
    .filter(Boolean);
  return {
    type: "FeatureCollection",
    features,
  };
}

function pickRestaurantDisplayName(properties) {
  const zh = String(properties?.name_zh ?? "").trim();
  if (zh !== "") return zh;

  const en = String(properties?.name_en ?? "").trim();
  if (en !== "") return en;

  return String(properties?.name_local ?? "").trim();
}

const MAP_TAG_EDGE_MARGIN_PX = 14;
const MAP_TAG_BUBBLE_HEIGHT_PX = 34;
const MAP_TAG_FONT_SIZE_PX = 14;
const MAP_TAG_HORIZONTAL_PADDING_PX = 14;
const MAP_TAG_MIN_WIDTH_PX = 76;
const MAP_TAG_MAX_WIDTH_PX = 148;
const MAP_TAG_BUBBLE_ANCHOR_INSET_PX = 18;
const MAP_TAG_TRIANGLE_BASE_HALF_WIDTH_PX = 6;
const MAP_TAG_COLLISION_PAD_X_PX = 18;
const MAP_TAG_COLLISION_PAD_Y_PX = 14;
const MAP_TAG_LINE_GAP_PX = 4;
const MAP_TAG_GROWTH_START_ZOOM = 12.2;
let restaurantTagMeasureContext = null;

function getRestaurantPointRadiusPx(zoom) {
  if (!Number.isFinite(zoom)) return 6;
  if (zoom <= 8) return 4;
  if (zoom >= 14) return 8;
  if (zoom <= 11) return 4 + ((zoom - 8) / 3) * 2;
  return 6 + ((zoom - 11) / 3) * 2;
}

function getRestaurantTagMaxChars(zoom, fullLength) {
  const safeLength = Math.max(0, Number(fullLength) || 0);
  if (safeLength <= 7) return safeLength;
  return safeLength;
}

function toStoreLabelByZoom(name, zoom, forcedMaxChars) {
  const plain = String(name ?? "").trim();
  if (plain === "") return "";

  const maxChars =
    Number.isFinite(forcedMaxChars) && forcedMaxChars > 0
      ? Math.min(forcedMaxChars, plain.length)
      : getRestaurantTagMaxChars(zoom, plain.length);
  if (plain.length <= maxChars) return plain;
  return `${plain.slice(0, maxChars)}...`;
}

function getRestaurantTagVisualMetrics(zoom, containerWidth) {
  const safeZoom = Number.isFinite(zoom) ? zoom : 10;
  const zoomProgress = clampNumber(
    (safeZoom - MAP_TAG_GROWTH_START_ZOOM) / 3.8,
    0,
    1,
  );
  const fontSizePx = Math.round(MAP_TAG_FONT_SIZE_PX + zoomProgress * 2);
  const horizontalPaddingPx = Math.round(
    MAP_TAG_HORIZONTAL_PADDING_PX - 2 + zoomProgress * 3,
  );
  const bubbleHeightPx = Math.round(MAP_TAG_BUBBLE_HEIGHT_PX + zoomProgress * 4);
  const containerDrivenMaxWidth = Math.max(
    MAP_TAG_MIN_WIDTH_PX,
    Math.floor(Math.max(0, containerWidth || 0) - MAP_TAG_EDGE_MARGIN_PX * 2),
  );
  const maxWidthPx = Math.max(
    MAP_TAG_MAX_WIDTH_PX + Math.round(zoomProgress * 72),
    containerDrivenMaxWidth,
  );

  return {
    fontSizePx,
    horizontalPaddingPx,
    bubbleHeightPx,
    maxWidthPx,
  };
}

function measureRestaurantTagWidthPx(text, metrics) {
  const plain = String(text ?? "");
  if (plain === "") return MAP_TAG_MIN_WIDTH_PX;
  const fontSizePx = metrics?.fontSizePx ?? MAP_TAG_FONT_SIZE_PX;
  const horizontalPaddingPx =
    metrics?.horizontalPaddingPx ?? MAP_TAG_HORIZONTAL_PADDING_PX;
  const maxWidthPx = metrics?.maxWidthPx ?? MAP_TAG_MAX_WIDTH_PX;

  if (
    restaurantTagMeasureContext == null &&
    typeof document !== "undefined"
  ) {
    restaurantTagMeasureContext = document.createElement("canvas").getContext("2d");
  }

  if (restaurantTagMeasureContext) {
    restaurantTagMeasureContext.font = `600 ${fontSizePx}px "LXGW WenKai"`;
    const measuredWidth = restaurantTagMeasureContext.measureText(plain).width;
    return clampNumber(
      Math.ceil(measuredWidth + horizontalPaddingPx * 2),
      MAP_TAG_MIN_WIDTH_PX,
      maxWidthPx,
    );
  }

  return clampNumber(
    Math.ceil(plain.length * fontSizePx + horizontalPaddingPx * 2),
    MAP_TAG_MIN_WIDTH_PX,
    maxWidthPx,
  );
}

function clampNumber(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function getRectOverlapArea(rectA, rectB) {
  const overlapWidth = Math.max(0, Math.min(rectA.right, rectB.right) - Math.max(rectA.left, rectB.left));
  const overlapHeight = Math.max(0, Math.min(rectA.bottom, rectB.bottom) - Math.max(rectA.top, rectB.top));
  return overlapWidth * overlapHeight;
}

function expandRect(rect, padX, padY) {
  return {
    left: rect.left - padX,
    top: rect.top - padY,
    right: rect.right + padX,
    bottom: rect.bottom + padY,
  };
}

function getRestaurantTagCandidates() {
  return [
    Object.freeze({ bubbleCenterShiftX: 0, lineHeight: 20 }),
    Object.freeze({ bubbleCenterShiftX: -92, lineHeight: 20 }),
    Object.freeze({ bubbleCenterShiftX: 92, lineHeight: 20 }),
    Object.freeze({ bubbleCenterShiftX: -144, lineHeight: 28 }),
    Object.freeze({ bubbleCenterShiftX: 144, lineHeight: 28 }),
    Object.freeze({ bubbleCenterShiftX: -64, lineHeight: 48 }),
    Object.freeze({ bubbleCenterShiftX: 64, lineHeight: 48 }),
    Object.freeze({ bubbleCenterShiftX: 0, lineHeight: 64 }),
    Object.freeze({ bubbleCenterShiftX: -196, lineHeight: 40 }),
    Object.freeze({ bubbleCenterShiftX: 196, lineHeight: 40 }),
    Object.freeze({ bubbleCenterShiftX: -126, lineHeight: 72 }),
    Object.freeze({ bubbleCenterShiftX: 126, lineHeight: 72 }),
  ];
}

function buildTextRect(bubbleRect, bubbleWidth, bubbleHeight, metrics) {
  const horizontalPaddingPx =
    metrics?.horizontalPaddingPx ?? MAP_TAG_HORIZONTAL_PADDING_PX;
  const fontSizePx = metrics?.fontSizePx ?? MAP_TAG_FONT_SIZE_PX;
  const textHeight = Math.max(fontSizePx + 2, bubbleHeight - 12);

  return {
    left: bubbleRect.left + horizontalPaddingPx,
    right: bubbleRect.left + bubbleWidth - horizontalPaddingPx,
    top: bubbleRect.top + (bubbleHeight - textHeight) / 2,
    bottom: bubbleRect.top + (bubbleHeight + textHeight) / 2,
  };
}

function buildBubbleLayoutForChars(item, candidate, charCount, zoom, containerWidth, pointRadius, visualMetrics) {
  const labelText = toStoreLabelByZoom(item.storeName, zoom, charCount);
  const bubbleWidth = measureRestaurantTagWidthPx(labelText, visualMetrics);
  const bubbleHeight = visualMetrics.bubbleHeightPx;
  const unclampedBubbleLeft =
    item.projectedX + candidate.bubbleCenterShiftX - bubbleWidth / 2;
  const bubbleLeft = clampNumber(
    unclampedBubbleLeft,
    MAP_TAG_EDGE_MARGIN_PX,
    Math.max(
      MAP_TAG_EDGE_MARGIN_PX,
      containerWidth - MAP_TAG_EDGE_MARGIN_PX - bubbleWidth,
    ),
  );
  const bubbleTop =
    item.projectedY -
    pointRadius -
    MAP_TAG_LINE_GAP_PX -
    candidate.lineHeight -
    bubbleHeight;
  const bubbleAnchorX = clampNumber(
    item.projectedX,
    bubbleLeft + MAP_TAG_BUBBLE_ANCHOR_INSET_PX,
    bubbleLeft + bubbleWidth - MAP_TAG_BUBBLE_ANCHOR_INSET_PX,
  );
  const bubbleRect = {
    left: bubbleLeft,
    top: bubbleTop,
    right: bubbleLeft + bubbleWidth,
    bottom: bubbleTop + bubbleHeight,
  };
  const textRect = buildTextRect(
    bubbleRect,
    bubbleWidth,
    bubbleHeight,
    visualMetrics,
  );

  return {
    labelText,
    currentChars: charCount,
    bubbleWidth,
    bubbleHeight,
    bubbleRect,
    textRect,
    bubbleAnchorX,
    bubbleAnchorY: bubbleRect.bottom,
    lineStartX: item.projectedX,
    lineStartY: item.projectedY - pointRadius - 1,
  };
}

function isEarlyZoomHybridMode(zoom) {
  return !Number.isFinite(zoom) || zoom <= MAP_TAG_GROWTH_START_ZOOM;
}

function pickBestGrowthCandidate(
  layout,
  targetChars,
  zoom,
  visualMetrics,
  containerWidth,
  pointRadius,
  currentTextRects,
  currentBubbleRects,
) {
  let bestCandidate = null;
  const strictDefaultMode = isEarlyZoomHybridMode(zoom);

  getRestaurantTagCandidates().forEach((candidate) => {
    const candidateLayout = buildBubbleLayoutForChars(
      layout,
      candidate,
      targetChars,
      zoom,
      containerWidth,
      pointRadius,
      visualMetrics,
    );

    const textOverlap = currentTextRects.reduce((sum, placedRect) => {
      if (placedRect.key === layout.key) return sum;
      return sum + getRectOverlapArea(candidateLayout.textRect, placedRect.textRect);
    }, 0);
    if (textOverlap > 0) return;

    const bubbleOverlap = currentBubbleRects.reduce((sum, placedRect) => {
      if (placedRect.key === layout.key) return sum;
      return sum + getRectOverlapArea(candidateLayout.bubbleRect, placedRect.bubbleRect);
    }, 0);
    if (strictDefaultMode && bubbleOverlap > 0) return;

    const score =
      bubbleOverlap * 20 +
      Math.abs(candidateLayout.bubbleAnchorX - layout.pointX) * 1.8 +
      candidate.lineHeight;

    if (!bestCandidate || score < bestCandidate.score) {
      bestCandidate = {
        ...candidateLayout,
        candidate,
        score,
      };
    }
  });

  return bestCandidate;
}

function buildRestaurantTagLayouts(map, pointGeoJson) {
  const pointFeatures = Array.isArray(pointGeoJson?.features) ? pointGeoJson.features : [];
  const container = map.getContainer();
  const containerWidth = container?.clientWidth ?? 0;
  const containerHeight = container?.clientHeight ?? 0;
  const zoom = map.getZoom();
  const pointRadius = getRestaurantPointRadiusPx(zoom);
  const placedBubbleRects = [];
  const placedTextRects = [];
  const visualMetrics = getRestaurantTagVisualMetrics(zoom, containerWidth);

  return pointFeatures
    .map((feature, index) => {
      const coordinates = feature?.geometry?.coordinates;
      if (!Array.isArray(coordinates) || coordinates.length < 2) return null;
      const [lng, lat] = coordinates;
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;

      const projected = map.project([lng, lat]);
      const storeName =
        String(feature?.properties?.display_name ?? "").trim() ||
        pickRestaurantDisplayName(feature?.properties);
      const desiredMaxChars = getRestaurantTagMaxChars(zoom, storeName.length);
      if (storeName === "") return null;

      return {
        key:
          String(feature?.properties?.store_key ?? "").trim() ||
          `${storeName || "store"}-${index}`,
        projectedX: projected.x,
        projectedY: projected.y,
        storeName,
        desiredMaxChars,
        selectedStore: toSelectedStore(feature?.properties),
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      if (a.projectedY !== b.projectedY) return a.projectedY - b.projectedY;
      return a.projectedX - b.projectedX;
    })
    .map((item) => {
      let bestCandidate = null;

      getRestaurantTagCandidates().forEach((candidate) => {
        const candidateLayout = buildBubbleLayoutForChars(
          item,
          candidate,
          7,
          zoom,
          containerWidth,
          pointRadius,
          visualMetrics,
        );
        const bubbleOverlapArea = placedBubbleRects.reduce(
          (sum, placedRect) => sum + getRectOverlapArea(candidateLayout.bubbleRect, placedRect),
          0,
        );
        const textOverlapArea = placedTextRects.reduce(
          (sum, placedRect) => sum + getRectOverlapArea(candidateLayout.textRect, placedRect),
          0,
        );
        const topOverflow = Math.max(0, MAP_TAG_EDGE_MARGIN_PX - candidateLayout.bubbleRect.top);
        const bottomOverflow = Math.max(
          0,
          candidateLayout.bubbleRect.bottom - (containerHeight - MAP_TAG_EDGE_MARGIN_PX),
        );
        const score =
          textOverlapArea * 4000 +
          bubbleOverlapArea * 35 +
          topOverflow * 700 +
          bottomOverflow * 700 +
          Math.abs(candidateLayout.bubbleAnchorX - item.projectedX) * 1.8 +
          candidate.lineHeight;

        if (!bestCandidate || score < bestCandidate.score) {
          bestCandidate = {
            ...candidateLayout,
            candidate,
            score,
          };
        }
      });

      if (!bestCandidate) return null;

      placedBubbleRects.push(
        expandRect(
          bestCandidate.bubbleRect,
          MAP_TAG_COLLISION_PAD_X_PX,
          MAP_TAG_COLLISION_PAD_Y_PX,
        ),
      );
      placedTextRects.push(bestCandidate.textRect);
      return {
        ...item,
        candidate: bestCandidate.candidate,
        key: item.key,
        labelText: bestCandidate.labelText,
        pointX: item.projectedX,
        pointY: item.projectedY,
        pointRadius,
        bubbleLeft: bestCandidate.bubbleRect.left,
        bubbleTop: bestCandidate.bubbleRect.top,
        bubbleWidth: bestCandidate.bubbleWidth,
        bubbleHeight: bestCandidate.bubbleHeight,
        bubbleAnchorX: bestCandidate.bubbleAnchorX,
        bubbleAnchorY: bestCandidate.bubbleRect.bottom,
        lineStartX: item.projectedX,
        lineStartY: item.projectedY - pointRadius - 1,
        fontSizePx: visualMetrics.fontSizePx,
        horizontalPaddingPx: visualMetrics.horizontalPaddingPx,
        currentChars: 7,
        bubbleRect: bestCandidate.bubbleRect,
        textRect: bestCandidate.textRect,
      };
    })
    .filter(Boolean);
}

function growRestaurantTagLayouts(baseLayouts, zoom, visualMetrics, containerWidth, pointRadius) {
  let grownLayouts = baseLayouts.map((layout) => ({ ...layout }));
  const defaultHybridMode = isEarlyZoomHybridMode(zoom);
  const maxDesiredChars = grownLayouts.reduce(
    (maxValue, layout) => Math.max(maxValue, layout.desiredMaxChars),
    7,
  );

  for (let targetChars = 8; targetChars <= maxDesiredChars; targetChars += 1) {
    const proposals = [];
    const currentTextRects = grownLayouts.map((layout) => ({
      key: layout.key,
      textRect: layout.textRect,
    }));
    const currentBubbleRects = grownLayouts.map((layout) => ({
      key: layout.key,
      bubbleRect: layout.bubbleRect,
    }));

    grownLayouts.forEach((layout, index) => {
      if (layout.desiredMaxChars < targetChars) return;
      if (layout.currentChars >= targetChars) return;

      const candidateLayout = pickBestGrowthCandidate(
        layout,
        targetChars,
        zoom,
        visualMetrics,
        containerWidth,
        pointRadius,
        currentTextRects,
        currentBubbleRects,
      );
      if (!candidateLayout) return;

      proposals.push({
        index,
        layout: {
          ...layout,
          ...candidateLayout,
          candidate: candidateLayout.candidate,
          bubbleLeft: candidateLayout.bubbleRect.left,
          bubbleTop: candidateLayout.bubbleRect.top,
          fontSizePx: visualMetrics.fontSizePx,
          horizontalPaddingPx: visualMetrics.horizontalPaddingPx,
        },
        score:
          Math.abs(candidateLayout.bubbleAnchorX - layout.pointX) * 1.8 +
          layout.candidate.lineHeight,
      });
    });

    proposals.sort((a, b) => a.score - b.score || a.index - b.index);
    const acceptedTextRects = [];
    const acceptedBubbleRects = [];

    proposals.forEach((proposal) => {
      const conflictsAcceptedText = acceptedTextRects.some(
        (placedRect) =>
          getRectOverlapArea(proposal.layout.textRect, placedRect) > 0,
      );
      if (conflictsAcceptedText) return;

      if (defaultHybridMode) {
        const conflictsAcceptedBubble = acceptedBubbleRects.some(
          (placedRect) =>
            getRectOverlapArea(proposal.layout.bubbleRect, placedRect) > 0,
        );
        if (conflictsAcceptedBubble) return;
      }

      acceptedTextRects.push(proposal.layout.textRect);
      acceptedBubbleRects.push(proposal.layout.bubbleRect);
      grownLayouts[proposal.index] = proposal.layout;
    });
  }

  return grownLayouts;
}

function readNumber(value) {
  if (typeof value === "string" && value.trim() === "") return null;
  if (value == null) return null;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function readText(value) {
  const text = String(value ?? "").trim();
  if (text === "" || text.toLowerCase() === "null") return "";
  return text;
}

function toSelectedStore(properties) {
  return {
    storeKey: readText(properties?.store_key),
    nameZh: readText(properties?.name_zh),
    nameEn: readText(properties?.name_en),
    nameLocal: readText(properties?.name_local),
    displayName: readText(properties?.display_name),
    cuisine: readText(properties?.cuisine),
    address: readText(properties?.address),
    scoreOverall: readNumber(properties?.score_overall),
    scoreTaste: readNumber(properties?.score_taste),
    scoreEnvironment: readNumber(
      properties?.score_environment ?? properties?.socre_environment,
    ),
    scoreService: readNumber(properties?.score_service),
    scoreQueue: readNumber(properties?.score_queue),
    scorePackaging: readNumber(properties?.score_packaging),
    scoreDelivery: readNumber(properties?.score_delivery),
    scorePersonal: readNumber(properties?.score_personal),
    pricePerPerson: readNumber(properties?.price_per_person),
    currency: readText(properties?.currency),
    hours: readText(properties?.hours),
    phone: readText(properties?.phone),
    mapPlatform: readText(properties?.map_platform),
    mapUrl: readText(properties?.map_url),
    diningType: readText(properties?.dining_type),
  };
}

export default function MapPanel({
  citySlug,
  cityLabel,
  isVisible = true,
  activeCuisine = "",
  onSelectStore,
  onInteractiveHoverChange,
  onContinueWithoutMap,
}) {
  // #region agent log
  fetch('http://127.0.0.1:7912/ingest/1d8177e6-7440-400c-b3ec-b5409296808e',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'79f6c0'},body:JSON.stringify({sessionId:'79f6c0',runId:'run1',hypothesisId:'H1',location:'src/components/MapPanel.jsx:component-entry',message:'MapPanel entered',data:{citySlug},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const [isMapReady, setIsMapReady] = useState(false);
  const [mapInitError, setMapInitError] = useState("");
  const [restaurantTagLayouts, setRestaurantTagLayouts] = useState([]);
  const [mapBootVersion, setMapBootVersion] = useState(0);
  const { detailLocale, localeConfig } = useLanguage();

  const cityView = useMemo(() => getCityView(citySlug), [citySlug]);
  const missingToken = MAPBOX_TOKEN == null || String(MAPBOX_TOKEN).trim() === "";
  const fallbackImageUrl = FALLBACK_MAP_IMAGE_BY_CITY_SLUG[citySlug] ?? placeholderMapUrl;
  const pickUiText = (zhText, enText, nativeText = "") =>
    localeConfig.isChina
      ? pickByLocale(detailLocale, zhText, enText)
      : pickByDetailLocale(
          detailLocale,
          zhText,
          enText,
          nativeText,
          localeConfig.nativeIso639_1,
        );
  const fallbackTitle = pickUiText(
    "嘿，看起来你当前网络有点不稳定！",
    "Looks like your network is unstable right now!",
    "",
  );
  const fallbackBody = pickUiText(
    "地图加载失败啦（请检查网络后刷新重试：切换wifi/热点、关闭或更换代理……）",
    "Map failed to load. Please check your network and retry (switch Wi-Fi/hotspot, disable or change proxy, etc.).",
    "",
  );
  const fallbackFootnote = pickUiText(
    "但店铺列表和图文详情还可正常浏览哦~",
    "You can still browse the store list and food details.",
    "",
  );
  const retryLabel = pickUiText("重新加载地图", "Retry map", "");
  const continueLabel = pickUiText("继续浏览店铺内容", "Continue without map", "");

  useEffect(() => {
    if (missingToken || mapRef.current || !mapContainerRef.current) {
      return;
    }

    mapboxgl.accessToken = MAPBOX_TOKEN;
    setMapInitError("");

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: MAPBOX_STYLE,
      center: cityView.center,
      zoom: cityView.zoom,
      attributionControl: false,
    });

    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "bottom-right");
    map.once("load", () => {
      overrideMapPaperPalette(map);
      hideBaseAdminNoiseLayers(map);
      setIsMapReady(true);
    });
    map.on("error", (event) => {
      const message = String(event?.error?.message ?? "").trim();
      setMapInitError(message || "Mapbox 初始化失败，请检查 Token 与网络连接。");
    });
    mapRef.current = map;

    return () => {
      setIsMapReady(false);
      map.remove();
      mapRef.current = null;
    };
  }, [cityView.center, cityView.zoom, missingToken, mapBootVersion]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.easeTo({
      center: cityView.center,
      zoom: cityView.zoom,
      duration: 700,
      essential: true,
    });
  }, [cityView.center, cityView.zoom]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isVisible) return;
    const resizeMap = () => map.resize();
    resizeMap();
    requestAnimationFrame(resizeMap);
  }, [isVisible]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapReady) return;

    let isCancelled = false;

    const mountCityBoundary = async () => {
      const boundaryGeoJson = await loadCityBoundaryGeoJson(citySlug);
      if (isCancelled) return;

      const { primary: boundaryLineColor, secondary: boundaryHaloColor } = getCityMapLineColors(citySlug);

      removeCityBoundaryLayers(map);
      if (!boundaryGeoJson) {
        console.info(`[MapPanel] Missing GeoJSON for city "${citySlug}".`);
        return;
      }

      map.addSource(CITY_BOUNDARY_SOURCE_ID, {
        type: "geojson",
        data: boundaryGeoJson,
      });

      map.addLayer({
        id: CITY_BOUNDARY_LINE_HALO_LAYER_ID,
        type: "line",
        source: CITY_BOUNDARY_SOURCE_ID,
        paint: {
          "line-color": boundaryHaloColor,
          "line-width": ["interpolate", ["linear"], ["zoom"], 8, 3.2, 11, 4.6, 14, 6.2],
          "line-opacity": 0.98,
        },
        layout: {
          "line-join": "round",
          "line-cap": "round",
        },
      });

      map.addLayer({
        id: CITY_BOUNDARY_LINE_LAYER_ID,
        type: "line",
        source: CITY_BOUNDARY_SOURCE_ID,
        paint: {
          "line-color": boundaryLineColor,
          "line-width": ["interpolate", ["linear"], ["zoom"], 8, 1.35, 11, 2.05, 14, 2.75],
          "line-opacity": 0.92,
        },
        layout: {
          "line-join": "round",
          "line-cap": "round",
        },
      });

      const labelGeoJson = buildDistrictLabelPoints(boundaryGeoJson);
      map.addSource(CITY_BOUNDARY_LABEL_SOURCE_ID, {
        type: "geojson",
        data: labelGeoJson,
      });

      map.addLayer({
        id: CITY_BOUNDARY_LABEL_LAYER_ID,
        type: "symbol",
        source: CITY_BOUNDARY_LABEL_SOURCE_ID,
        layout: {
          "text-field": ["get", "ffj_label_text"],
          "text-font": ["DIN Pro Medium", "Arial Unicode MS Regular"],
          "text-size": ["interpolate", ["linear"], ["zoom"], 8, 10, 11, 12, 13, 14],
          "text-max-width": 8,
          "text-line-height": 1.15,
          "text-allow-overlap": false,
          "text-ignore-placement": false,
        },
        paint: {
          "text-color": "rgba(66, 56, 48, 0.86)",
          "text-halo-color": "rgba(247, 243, 238, 0.92)",
          "text-halo-width": 1,
        },
      });
    };

    mountCityBoundary();

    return () => {
      isCancelled = true;
    };
  }, [citySlug, isMapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapReady) return;

    const pointGeoJson = buildRestaurantPointsGeoJson(citySlug);
    const { primary: cityPrimaryColor } = getCityMapLineColors(citySlug);
    const normalizedCuisine = String(activeCuisine ?? "").trim();
    setRestaurantTagLayouts([]);
    removeRestaurantPointLayers(map);

    map.addSource(RESTAURANT_POINTS_SOURCE_ID, {
      type: "geojson",
      data: pointGeoJson,
    });
    map.addLayer({
      id: RESTAURANT_POINTS_LAYER_ID,
      type: "circle",
      source: RESTAURANT_POINTS_SOURCE_ID,
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 8, 3.2, 11, 4.7, 14, 6.2],
        "circle-color":
          normalizedCuisine === ""
            ? cityPrimaryColor
            : [
                "case",
                ["==", ["coalesce", ["get", "cuisine"], ""], normalizedCuisine],
                cityPrimaryColor,
                "rgba(120, 108, 96, 0.34)",
              ],
        "circle-opacity":
          normalizedCuisine === ""
            ? 1
            : [
                "case",
                ["==", ["coalesce", ["get", "cuisine"], ""], normalizedCuisine],
                1,
                0.56,
              ],
        "circle-stroke-color": "rgba(247, 243, 238, 0.96)",
        "circle-stroke-width": ["interpolate", ["linear"], ["zoom"], 8, 1.75, 11, 2.2, 14, 2.6],
      },
    });

    const handlePointClick = (event) => {
      const feature = event.features?.[0];
      if (!feature) return;
      onSelectStore?.(toSelectedStore(feature.properties));
    };
    const setPointerCursor = () => {
      onInteractiveHoverChange?.(true);
    };
    const resetPointerCursor = () => {
      onInteractiveHoverChange?.(false);
    };

    let frameId = 0;
    const syncTagLayouts = () => {
      if (frameId !== 0) return;
      frameId = requestAnimationFrame(() => {
        frameId = 0;
        const baseLayouts = buildRestaurantTagLayouts(map, pointGeoJson);
        const nextLayouts = growRestaurantTagLayouts(
          baseLayouts,
          map.getZoom(),
          getRestaurantTagVisualMetrics(
            map.getZoom(),
            map.getContainer()?.clientWidth ?? 0,
          ),
          map.getContainer()?.clientWidth ?? 0,
          getRestaurantPointRadiusPx(map.getZoom()),
        );
        const filteredLayouts =
          normalizedCuisine === ""
            ? nextLayouts
            : nextLayouts.map((layout) => ({
                ...layout,
                isDimmed:
                  String(layout.selectedStore?.cuisine ?? "").trim() !== normalizedCuisine,
              }));
        setRestaurantTagLayouts(filteredLayouts);
      });
    };
    syncTagLayouts();
    map.on("click", RESTAURANT_POINTS_LAYER_ID, handlePointClick);
    map.on("mouseenter", RESTAURANT_POINTS_LAYER_ID, setPointerCursor);
    map.on("mouseleave", RESTAURANT_POINTS_LAYER_ID, resetPointerCursor);
    map.on("move", syncTagLayouts);
    map.on("resize", syncTagLayouts);

    return () => {
      if (frameId !== 0) {
        cancelAnimationFrame(frameId);
      }
      map.off("click", RESTAURANT_POINTS_LAYER_ID, handlePointClick);
      map.off("mouseenter", RESTAURANT_POINTS_LAYER_ID, setPointerCursor);
      map.off("mouseleave", RESTAURANT_POINTS_LAYER_ID, resetPointerCursor);
      map.off("move", syncTagLayouts);
      map.off("resize", syncTagLayouts);
      setRestaurantTagLayouts([]);
    };
  }, [citySlug, isMapReady, onSelectStore, onInteractiveHoverChange, activeCuisine]);

  if (missingToken) {
    return (
      <section className="ffj-map-panel ffj-map-panel--fallback" aria-live="polite">
        <p className="ffj-body-text">缺少 VITE_MAPBOX_TOKEN，地图无法初始化。</p>
      </section>
    );
  }

  return (
    <section
      className="ffj-map-panel"
      aria-label={`${cityLabel} Map`}
      data-city-slug={citySlug}
    >
      <div ref={mapContainerRef} className="ffj-map-canvas" />
      <div className="ffj-map-tag-overlay">
        <svg className="ffj-map-tag-lines" preserveAspectRatio="none">
          {restaurantTagLayouts.map((layout) => (
            <polygon
              key={`triangle-${layout.key}`}
              className="ffj-map-tag-triangle"
              points={`${
                layout.bubbleAnchorX - MAP_TAG_TRIANGLE_BASE_HALF_WIDTH_PX
              },${layout.bubbleAnchorY} ${
                layout.bubbleAnchorX + MAP_TAG_TRIANGLE_BASE_HALF_WIDTH_PX
              },${layout.bubbleAnchorY} ${layout.lineStartX},${layout.lineStartY}`}
            />
          ))}
        </svg>
        {restaurantTagLayouts.map((layout) => (
          <button
            key={layout.key}
            type="button"
            className={`ffj-map-tag-bubble ${layout.isDimmed ? "is-dimmed" : ""}`}
            onClick={() => onSelectStore?.(layout.selectedStore)}
            onMouseEnter={() => onInteractiveHoverChange?.(true)}
            onMouseLeave={() => onInteractiveHoverChange?.(false)}
            aria-label={`查看 ${layout.storeName} 的店铺信息`}
            style={{
              left: `${layout.bubbleLeft}px`,
              top: `${layout.bubbleTop}px`,
              width: `${layout.bubbleWidth}px`,
              height: `${layout.bubbleHeight}px`,
              fontSize: `${layout.fontSizePx}px`,
              paddingInline: `${layout.horizontalPaddingPx}px`,
            }}
          >
            {layout.labelText}
          </button>
        ))}
      </div>
      {!isMapReady && mapInitError === "" ? (
        <div className="ffj-map-loading">
          <p className="ffj-body-text">地图加载中...</p>
        </div>
      ) : null}
      {mapInitError !== "" ? (
        <div className="ffj-map-error" role="alert" aria-live="polite">
          <img className="ffj-map-error-image" src={fallbackImageUrl} alt="" aria-hidden="true" />
          <div className="ffj-map-error-copy">
            <p className="ffj-body-text">{fallbackTitle}</p>
            <p className="ffj-map-error-message">{fallbackBody}</p>
            <p className="ffj-map-error-message">{fallbackFootnote}</p>
          </div>
          <div className="ffj-map-error-actions">
            <button
              type="button"
              className="ffj-map-error-btn is-primary"
              onClick={() => {
                setMapInitError("");
                setIsMapReady(false);
                if (mapRef.current) {
                  mapRef.current.remove();
                  mapRef.current = null;
                }
                setMapBootVersion((value) => value + 1);
              }}
            >
              {retryLabel}
            </button>
            <button
              type="button"
              className="ffj-map-error-btn is-secondary"
              onClick={() => onContinueWithoutMap?.()}
            >
              {continueLabel}
            </button>
          </div>
          <p className="ffj-map-error-detail">{mapInitError}</p>
        </div>
      ) : null}
    </section>
  );
}
