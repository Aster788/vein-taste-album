import { useEffect } from "react";
import { useLanguage } from "../context/LanguageContext.jsx";

export default function Bookshelf() {
  const { setCitySlug } = useLanguage();

  useEffect(() => {
    setCitySlug(null);
    delete document.documentElement.dataset.city;
  }, [setCitySlug]);

  return (
    <main className="ffj-page-shell ffj-paper-noise ffj-paper-noise--warm">
      <p className="ffj-body-text">书架页占位</p>
      <p className="ffj-body-text">当前路由：/</p>
      <p className="ffj-city-accent">未选城市（中性主题 token）</p>
    </main>
  );
}
