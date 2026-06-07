import RadarChart from "./RadarChart.jsx";

function pickStoreName(store) {
  const names = [store?.nameZh, store?.nameEn, store?.nameLocal, store?.displayName];
  for (const name of names) {
    const text = String(name ?? "").trim();
    if (text !== "") return text;
  }
  return "";
}

function formatStoreNameForDisplay(name) {
  const text = String(name ?? "").trim();
  if (text === "") return "";
  const asciiParenIndex = text.indexOf("(");
  const fullWidthParenIndex = text.indexOf("（");
  const indexes = [asciiParenIndex, fullWidthParenIndex].filter((index) => index >= 0);
  if (indexes.length === 0) return text;
  const splitIndex = Math.min(...indexes);
  return `${text.slice(0, splitIndex).trimEnd()}\n${text.slice(splitIndex)}`;
}

function formatScore(value) {
  if (!Number.isFinite(value)) return "—";
  return `${value.toFixed(1)} / 5.0`;
}

function formatPrice(value, currency) {
  if (!Number.isFinite(value)) return "";
  const text = Math.round(value).toString();
  const unit = String(currency ?? "").trim().toUpperCase();
  if (unit === "CNY") return `¥${text}`;
  if (unit === "KRW") return `₩${text}`;
  if (unit === "MYR") return `RM ${text}`;
  return text;
}

/** Multi-segment hours in xlsx/json use `|` or `｜`; see `src/data/README.md` §Hours. */
function formatHours(value) {
  const text = String(value ?? "").trim();
  if (text === "") return "";
  const segments = text
    .split(/[|｜]/)
    .map((segment) => segment.trim())
    .filter((segment) => segment !== "");
  if (segments.length === 0) return "";
  return segments.join("\n");
}

function formatPhone(value) {
  const text = String(value ?? "").trim();
  if (text === "") return "";
  const segments = text
    .split(/[;；]/)
    .map((segment) => segment.trim())
    .filter((segment) => segment !== "");
  if (segments.length === 0) return "";
  return segments.join("\n");
}

function normalizeMapPlatform(value) {
  const platform = String(value ?? "").trim().toLowerCase();
  return platform === "google" || platform === "amap" ? platform : "";
}

function resolveMapUrl(url) {
  const text = String(url ?? "").trim();
  if (text === "") return "";
  try {
    const parsed = new URL(text);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return "";
    return parsed.toString();
  } catch {
    return "";
  }
}

const warmedMapOrigins = new Set();

function warmupMapOrigin(url) {
  const text = String(url ?? "").trim();
  if (text === "" || typeof document === "undefined") return;
  let origin = "";
  try {
    origin = new URL(text).origin;
  } catch {
    return;
  }
  if (origin === "" || warmedMapOrigins.has(origin)) return;
  warmedMapOrigins.add(origin);

  const preconnect = document.createElement("link");
  preconnect.rel = "preconnect";
  preconnect.href = origin;
  preconnect.crossOrigin = "anonymous";
  document.head.appendChild(preconnect);

  const dnsPrefetch = document.createElement("link");
  dnsPrefetch.rel = "dns-prefetch";
  dnsPrefetch.href = origin;
  document.head.appendChild(dnsPrefetch);
}

function MapPlatformIcon({ platform }) {
  if (platform === "google") {
    return (
      <svg viewBox="0 0 24 24" className="ffj-note-map-link-icon-svg" aria-hidden="true">
        <path fill="#EA4335" d="M12 2a7.5 7.5 0 0 0-7.5 7.5c0 5.4 7.5 12.5 7.5 12.5s7.5-7.1 7.5-12.5A7.5 7.5 0 0 0 12 2z" />
        <circle cx="12" cy="9.5" r="3" fill="#FFF" />
        <path fill="#4285F4" d="M16.2 18.2L12 22l-4.2-3.8 2.8-2.6h2.8z" />
      </svg>
    );
  }
  if (platform === "amap") {
    return (
      <svg viewBox="0 0 24 24" className="ffj-note-map-link-icon-svg" aria-hidden="true">
        <rect x="2.5" y="2.5" width="19" height="19" rx="5" fill="#0A66FF" />
        <path
          d="M12 5.8c-2.2 0-3.9 1.8-3.9 4 0 2.8 3.9 7.9 3.9 7.9s3.9-5.1 3.9-7.9c0-2.2-1.8-4-3.9-4zm0 5.5a1.5 1.5 0 1 1 0-3.1 1.5 1.5 0 0 1 0 3.1z"
          fill="#FFF"
        />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className="ffj-note-map-link-icon-svg" aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="currentColor" opacity="0.18" />
      <path
        d="M12 5.8c-2.2 0-4 1.8-4 4 0 2.8 4 8 4 8s4-5.2 4-8c0-2.2-1.8-4-4-4zm0 5.6a1.6 1.6 0 1 1 0-3.2 1.6 1.6 0 0 1 0 3.2z"
        fill="currentColor"
      />
    </svg>
  );
}

export default function NotePanel({
  guideText,
  selectedStore,
  labels,
  showMapLink = true,
  onInteractiveHoverChange,
}) {
  const storeName = pickStoreName(selectedStore);
  const storeNameDisplay = formatStoreNameForDisplay(storeName);
  const hasSelection = selectedStore != null && storeName !== "";
  const mapPlatform = normalizeMapPlatform(selectedStore?.mapPlatform);
  const mapUrl = resolveMapUrl(selectedStore?.mapUrl);
  const hasMapUrl = mapUrl !== "";
  const priceText = formatPrice(selectedStore?.pricePerPerson, selectedStore?.currency);
  const hoursText = formatHours(selectedStore?.hours);
  const phoneText = formatPhone(selectedStore?.phone);
  return (
    <section className={`ffj-note-panel ${hasSelection ? "is-filled" : ""}`} aria-live="polite">
      <div className="ffj-note-panel-lines" aria-hidden="true" />
      {hasSelection ? (
        <article className="ffj-note-card">
          <header className="ffj-note-store-header">
            <h3 className="ffj-note-store-name">{storeNameDisplay}</h3>
            {showMapLink ? (
              hasMapUrl ? (
                <a
                  className="ffj-note-map-link"
                  href={mapUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onMouseEnter={() => {
                    warmupMapOrigin(mapUrl);
                    onInteractiveHoverChange?.(true);
                  }}
                  onMouseLeave={() => onInteractiveHoverChange?.(false)}
                  onFocus={() => {
                    warmupMapOrigin(mapUrl);
                    onInteractiveHoverChange?.(true);
                  }}
                  onBlur={() => onInteractiveHoverChange?.(false)}
                  aria-label={labels?.mapOpen ?? "Open map link in a new tab"}
                  title={labels?.mapOpen ?? "Open map link in a new tab"}
                >
                  <MapPlatformIcon platform={mapPlatform} />
                </a>
              ) : (
                <span
                  className="ffj-note-map-link is-disabled"
                  aria-label={labels?.mapUnavailable ?? "Map link unavailable"}
                  title={labels?.mapUnavailable ?? "Map link unavailable"}
                >
                  <MapPlatformIcon platform={mapPlatform} />
                </span>
              )
            ) : null}
          </header>
          <dl className="ffj-note-fields">
            <div className="ffj-note-field">
              <dt>{labels?.cuisine ?? "Cuisine"}</dt>
              <dd>
                {String(
                  selectedStore.cuisine_zh ?? selectedStore.cuisine ?? "",
                ).trim() || "—"}
              </dd>
            </div>
            <div className="ffj-note-field">
              <dt>{labels?.scoreOverall ?? "Overall score"}</dt>
              <dd>{formatScore(selectedStore.scoreOverall)}</dd>
            </div>
            {priceText !== "" ? (
              <div className="ffj-note-field">
                <dt>{labels?.pricePerPerson ?? "Average spend"}</dt>
                <dd>{priceText}</dd>
              </div>
            ) : null}
            {hoursText !== "" ? (
              <div className="ffj-note-field">
                <dt>{labels?.hours ?? "Business hours"}</dt>
                <dd className="ffj-note-field-value--multiline">{hoursText}</dd>
              </div>
            ) : null}
            {phoneText !== "" ? (
              <div className="ffj-note-field">
                <dt>{labels?.phone ?? "Phone"}</dt>
                <dd className="ffj-note-field-value--multiline">{phoneText}</dd>
              </div>
            ) : null}
          </dl>
          <RadarChart
            store={selectedStore}
            labels={{
              radar: labels?.radar ?? "Score radar",
              taste: labels?.radarTaste ?? "Taste",
              environment: labels?.radarEnvironment ?? "Environment",
              queue: labels?.radarQueue ?? "Queue",
              service: labels?.radarService ?? "Service",
              packaging: labels?.radarPackaging ?? "Packaging",
              delivery: labels?.radarDelivery ?? "Delivery",
              personal: labels?.radarPersonal ?? "Recommend",
            }}
          />
          {showMapLink && !hasMapUrl ? (
            <p className="ffj-note-map-link-fallback">{labels?.mapUnavailable ?? "Map link unavailable"}</p>
          ) : null}
        </article>
      ) : (
        <p className="ffj-note-panel-guide">{guideText}</p>
      )}
    </section>
  );
}
