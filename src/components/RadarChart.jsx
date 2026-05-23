import {
  CategoryScale,
  Chart as ChartJS,
  Filler,
  LineElement,
  PointElement,
  RadialLinearScale,
} from "chart.js";
import { useMemo } from "react";
import { Radar } from "react-chartjs-2";

ChartJS.register(
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  CategoryScale,
);

const DEFAULT_LABELS = Object.freeze({
  taste: "Taste",
  environment: "Environment",
  queue: "Queue",
  service: "Service",
  packaging: "Packaging",
  delivery: "Delivery",
  personal: "Recommend",
});

const METRIC_PRIORITY = Object.freeze([
  "taste",
  "environment",
  "queue",
  "service",
  "packaging",
  "delivery",
  "personal",
]);

function toFiniteScore(value) {
  if (value == null) return null;
  if (typeof value === "string") {
    const trimmed = value.trim().toLowerCase();
    if (trimmed === "" || trimmed === "null") return null;
  }
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  return Math.max(0, Math.min(5, numeric));
}

export default function RadarChart({ store, labels }) {
  const mergedLabels = { ...DEFAULT_LABELS, ...(labels ?? {}) };

  const metricValues = {
    taste: toFiniteScore(store?.scoreTaste),
    environment: toFiniteScore(store?.scoreEnvironment),
    queue: toFiniteScore(store?.scoreQueue),
    service: toFiniteScore(store?.scoreService),
    packaging: toFiniteScore(store?.scorePackaging),
    delivery: toFiniteScore(store?.scoreDelivery),
    personal: toFiniteScore(store?.scorePersonal),
  };

  const visibleMetricKeys = METRIC_PRIORITY.filter(
    (key) => metricValues[key] != null,
  );
  const values = visibleMetricKeys.map((key) => metricValues[key]);
  const hasAnyValue = visibleMetricKeys.length > 0;

  const data = useMemo(
    () => ({
      labels: visibleMetricKeys.map((key) => mergedLabels[key]),
      datasets: [
        {
          label: mergedLabels.radar ?? "Radar",
          data: values,
          borderColor: "rgba(95, 132, 176, 0.9)",
          backgroundColor: "rgba(95, 132, 176, 0.2)",
          borderWidth: 2,
          pointRadius: 2.2,
          pointHoverRadius: 3,
          pointBackgroundColor: "rgba(95, 132, 176, 0.95)",
        },
      ],
    }),
    [visibleMetricKeys, mergedLabels, values],
  );

  const options = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      layout: {
        padding: {
          top: 20,
          right: 26,
          bottom: 20,
          left: 26,
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: { enabled: false },
      },
      scales: {
        r: {
          min: 0,
          max: 5,
          ticks: {
            stepSize: 1,
            backdropColor: "transparent",
            color: "rgba(87, 72, 57, 0.72)",
            font: { size: 12, family: "LXGW WenKai" },
          },
          grid: { color: "rgba(125, 103, 82, 0.2)" },
          angleLines: { color: "rgba(125, 103, 82, 0.2)" },
          pointLabels: {
            color: "rgba(65, 53, 42, 0.88)",
            font: { size: 12, family: "LXGW WenKai" },
            padding: 10,
          },
        },
      },
    }),
    [],
  );

  if (!hasAnyValue) {
    return null;
  }

  return (
    <div className="ffj-note-radar-section">
      <div className="ffj-note-radar-wrap" aria-label={mergedLabels.radar ?? "Score radar chart"}>
        <Radar data={data} options={options} />
      </div>
    </div>
  );
}
