import { useEffect } from "react";
import { Navigate, useParams } from "react-router-dom";
import {
  formatFixedTriple,
  useLanguage,
} from "../context/LanguageContext.jsx";
import {
  isValidCitySlug,
  normalizeCitySlug,
} from "../utils/citySlugs.js";

export default function CityDetail() {
  const { city } = useParams();
  const slug = normalizeCitySlug(city);
  const valid = isValidCitySlug(slug);
  const {
    setCitySlug,
    showEnCnToggle,
    isFixedTripleCity,
    locale,
  } = useLanguage();

  useEffect(() => {
    if (!valid) return;
    document.documentElement.dataset.city = slug;
    return () => {
      delete document.documentElement.dataset.city;
    };
  }, [slug, valid]);

  useEffect(() => {
    if (!valid) {
      setCitySlug(null);
      return;
    }
    setCitySlug(slug);
    return () => {
      setCitySlug(null);
    };
  }, [valid, slug, setCitySlug]);

  if (!valid) {
    return <Navigate to="/" replace />;
  }

  return (
    <main className="ffj-page-shell ffj-paper-noise">
      <p className="ffj-body-text">城市详情占位（路由 /:city）</p>
      <p className="ffj-body-text">city key：{slug}</p>
      <p className="ffj-city-accent">主题色（data-city 已设为上述 key）</p>
      {showEnCnToggle ? (
        <p className="ffj-body-text">
          EN/CN 切换占位（当前 locale={locale}，Phase 2/3 挂右上角；书脊/封面双行不受此处影响）
        </p>
      ) : (
        <p className="ffj-body-text">
          固定三语占位（无 EN/CN 切换）：{" "}
          {formatFixedTriple("본문 예시", "Body sample", "正文示例")}
        </p>
      )}
    </main>
  );
}
