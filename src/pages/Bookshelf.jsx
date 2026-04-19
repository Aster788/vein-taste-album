import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import Book from "../components/Book.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";
import { getBookshelfCities } from "../utils/dataLoader.js";

export default function Bookshelf() {
  const { setCitySlug } = useLanguage();
  const cities = useMemo(() => getBookshelfCities(), []);
  const scrollRef = useRef(null);
  const trackRef = useRef(null);

  useEffect(() => {
    setCitySlug(null);
    delete document.documentElement.dataset.city;
  }, [setCitySlug]);

  useLayoutEffect(() => {
    const scroller = scrollRef.current;
    const track = trackRef.current;
    if (!scroller || !track) return;

    const measureBleedPx = () => {
      const sr = scroller.getBoundingClientRect();
      const cs = getComputedStyle(scroller);
      const scrollerClipTop =
        sr.top +
        (Number.parseFloat(cs.borderTopWidth) || 0) +
        (Number.parseFloat(cs.paddingTop) || 0);
      const pageEl = scroller.closest(".ffj-bookshelf-page");
      const prPage = pageEl?.getBoundingClientRect();
      const csp = pageEl ? getComputedStyle(pageEl) : null;
      const pageClipTop =
        prPage && csp
          ? prPage.top +
            (Number.parseFloat(csp.borderTopWidth) || 0) +
            (Number.parseFloat(csp.paddingTop) || 0)
          : 0;
      let maxBleedScroller = 0;
      let maxBleedPage = 0;
      let slotsChecked = 0;
      for (const slot of track.querySelectorAll(".ffj-bookshelf-book-slot")) {
        const asm = slot.querySelector(".ffj-book__assembly");
        const spine = slot.querySelector(".ffj-book__spine");
        if (!asm) continue;
        slotsChecked += 1;
        const ar = asm.getBoundingClientRect();
        maxBleedScroller = Math.max(maxBleedScroller, scrollerClipTop - ar.top);
        if (spine) {
          const spr = spine.getBoundingClientRect();
          maxBleedScroller = Math.max(
            maxBleedScroller,
            scrollerClipTop - spr.top,
          );
        }
        if (prPage && csp) {
          maxBleedPage = Math.max(maxBleedPage, pageClipTop - ar.top);
          if (spine) {
            const spr = spine.getBoundingClientRect();
            maxBleedPage = Math.max(maxBleedPage, pageClipTop - spr.top);
          }
        }
      }
      return {
        maxBleedScroller: Math.max(0, maxBleedScroller),
        maxBleedPage: Math.max(0, maxBleedPage),
        slotsChecked,
      };
    };

    const sync = () => {
      scroller.style.setProperty("--ffj-bookshelf-top-bleed", "0px");
      void scroller.offsetHeight;
      const before = measureBleedPx();
      const firstSlot = track.querySelector(".ffj-bookshelf-book-slot");
      const slotH = firstSlot?.offsetHeight ?? 0;
      /** 与 global.css 中 .ffj-book__assembly rotateX(3deg) 一致；几何下界避免「量到 0 仍被裁顶」 */
      const pitchDeg = 3;
      const angularFloor = Math.ceil(
        slotH * Math.sin((pitchDeg * Math.PI) / 180) + 14,
      );
      const measured = Math.ceil(
        Math.max(before.maxBleedScroller, before.maxBleedPage) + 8,
      );
      const extra = Math.max(measured, angularFloor, 0);
      scroller.style.setProperty(
        "--ffj-bookshelf-top-bleed",
        extra > 0 ? `${extra}px` : "0px",
      );
      void scroller.offsetHeight;
      const after = measureBleedPx();

      const max = scroller.scrollWidth - scroller.clientWidth;
      scroller.scrollLeft = max <= 0 ? 0 : max / 2;

      // #region agent log
      const first = track.querySelector(".ffj-bookshelf-book-slot");
      const assembly = first?.querySelector(".ffj-book__assembly");
      const scrollR = scroller.getBoundingClientRect();
      const asmR = assembly?.getBoundingClientRect();
      fetch("http://127.0.0.1:7912/ingest/1d8177e6-7440-400c-b3ec-b5409296808e", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Debug-Session-Id": "8aec42",
        },
        body: JSON.stringify({
          sessionId: "8aec42",
          runId: "bleed-sync",
          hypothesisId: "H1-H4",
          location: "Bookshelf.jsx:sync",
          message: "spine top bleed measure + --ffj-bookshelf-top-bleed",
          timestamp: Date.now(),
          data: {
            slotH,
            trackClientH: track.clientHeight,
            scrollerClientH: scroller.clientHeight,
            slotExceedsTrack: slotH > track.clientHeight + 0.5,
            angularFloor,
            measuredBleedCeil: measured,
            bleedBeforeScroller: Math.round(before.maxBleedScroller * 100) / 100,
            bleedBeforePage: Math.round(before.maxBleedPage * 100) / 100,
            bleedVarPx: extra,
            bleedAfterScroller: Math.round(after.maxBleedScroller * 100) / 100,
            bleedAfterPage: Math.round(after.maxBleedPage * 100) / 100,
            slotsChecked: before.slotsChecked,
            deltaAsmAboveScroller:
              asmR && scrollR
                ? Math.round((scrollR.top - asmR.top) * 100) / 100
                : null,
            scrollClientH: scroller.clientHeight,
          },
        }),
      }).catch(() => {});
      // #endregion
    };

    sync();
    const ro = new ResizeObserver(() => {
      requestAnimationFrame(sync);
    });
    ro.observe(scroller);
    ro.observe(track);

    return () => {
      ro.disconnect();
      scroller.style.removeProperty("--ffj-bookshelf-top-bleed");
    };
  }, [cities]);

  return (
    <main className="ffj-page-shell ffj-paper-noise ffj-paper-noise--warm ffj-bookshelf-page">
      <div className="ffj-bookshelf-slogan-region" aria-hidden />
      <div className="ffj-bookshelf-scroll" ref={scrollRef}>
        <ul
          ref={trackRef}
          className="ffj-bookshelf-track"
          aria-label="城市书架"
        >
          {cities.map((city) => (
            <li
              key={city.slug}
              className="ffj-bookshelf-book-slot"
              data-city={city.slug}
              data-sticker-file={city.stickerFileName || undefined}
              aria-label={city.city_zh ? `${city.city_zh}，${city.city_en}` : city.city_en}
            >
              <Book city={city} />
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
