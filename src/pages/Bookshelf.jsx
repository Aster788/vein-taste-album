import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import Book from "../components/Book.jsx";
import BookTransition from "../components/BookTransition.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";
import { getBookshelfCities } from "../utils/dataLoader.js";
/* Slogan 旁 page 贴纸须透明底、无整幅黑/白底 path（与书脊 cities 贴纸同旨，见 Book.jsx 注释） */
import earthStickerUrl from "../assets/stickers/page/earth.svg?url";
import footprintsStickerUrl from "../assets/stickers/page/footprints.svg?url";
import evelynAvatarUrl from "../assets/photos/evelyn-transparent.png";

export default function Bookshelf() {
  const { setCitySlug } = useLanguage();
  const navigate = useNavigate();
  const cities = useMemo(() => getBookshelfCities(), []);
  const sloganCnFull = "世界这本书 我想一直读";
  const sloganEnFull =
    "I wander, I wonder, I fall in love with the world-again and again";
  const scrollRef = useRef(null);
  const trackRef = useRef(null);
  const rafRef = useRef(0);
  const applyBookTransformsRef = useRef(() => {});
  const slotMetricsRef = useRef([]);
  const targetYawRef = useRef([]);
  const currentYawRef = useRef([]);
  const targetFrontVisRef = useRef([]);
  const currentFrontVisRef = useRef([]);
  const targetBackVisRef = useRef([]);
  const currentBackVisRef = useRef([]);
  const activeBookIndexRef = useRef(-1);
  const animateRunningRef = useRef(false);
  const lastFrameTsRef = useRef(0);
  const [activeBookIndex, setActiveBookIndex] = useState(-1);
  const [typedCn, setTypedCn] = useState("");
  const [typedEn, setTypedEn] = useState("");
  const [isTypingDone, setIsTypingDone] = useState(false);
  const [typingPhase, setTypingPhase] = useState("cn");
  const [transitioningBook, setTransitioningBook] = useState(null);

  const scrollBookToCenter = (bookIndex) => {
    const scroller = scrollRef.current;
    const track = trackRef.current;
    if (!scroller || !track) return;
    const slots = track.querySelectorAll(".ffj-bookshelf-book-slot");
    const targetSlot = slots[bookIndex];
    if (!targetSlot) return;
    const targetCenter = targetSlot.offsetLeft + targetSlot.offsetWidth / 2;
    const maxScrollLeft = Math.max(0, scroller.scrollWidth - scroller.clientWidth);
    const nextScrollLeft = Math.min(
      maxScrollLeft,
      Math.max(0, targetCenter - scroller.clientWidth / 2),
    );
    scroller.scrollTo({
      left: nextScrollLeft,
      behavior: "smooth",
    });
  };

  /**
   * 处理书本点击，触发翻书过渡动画
   * @param {Object} city - 城市数据
   * @param {HTMLElement} bookElement - 被点击的书本元素
   */
  const handleBookClick = (city, bookElement) => {
    // 获取书本的 3D 组装元素位置（更精确的书本边界）
    const assembly = bookElement?.querySelector(".ffj-book__assembly");
    const rect = assembly ? assembly.getBoundingClientRect() : bookElement.getBoundingClientRect();

    // 设置过渡状态，触发 BookTransition 动画
    setTransitioningBook({
      city,
      rect,
    });

    // 延迟导航，让动画播放至展开阶段（总时长 1.4s 的约 80%）
    setTimeout(() => {
      navigate(`/${city.slug}`);
    }, 1100);
  };

  /**
   * 动画完成后的清理
   */
  const handleTransitionComplete = () => {
    setTransitioningBook(null);
  };

  useEffect(() => {
    setCitySlug(null);
    delete document.documentElement.dataset.city;
  }, [setCitySlug]);

  useEffect(() => {
    setTypedCn("");
    setTypedEn("");
    setIsTypingDone(false);
    setTypingPhase("cn");
    let cnIndex = 0;
    let enIndex = 0;
    let enTimer = 0;
    const cnIntervalMs = 95;
    const enIntervalMs = 55;

    const cnTimer = window.setInterval(() => {
      cnIndex += 1;
      setTypedCn(sloganCnFull.slice(0, cnIndex));
      if (cnIndex >= sloganCnFull.length) {
        window.clearInterval(cnTimer);
        setTypingPhase("en");
        enTimer = window.setInterval(() => {
          enIndex += 1;
          setTypedEn(sloganEnFull.slice(0, enIndex));
          if (enIndex >= sloganEnFull.length) {
            window.clearInterval(enTimer);
            setTypingPhase("done");
            setIsTypingDone(true);
          }
        }, enIntervalMs);
      }
    }, cnIntervalMs);

    return () => {
      window.clearInterval(cnTimer);
      if (enTimer) {
        window.clearInterval(enTimer);
      }
    };
  }, [sloganCnFull, sloganEnFull]);

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
      const max = scroller.scrollWidth - scroller.clientWidth;
      scroller.scrollLeft = max <= 0 ? 0 : max / 2;
      window.requestAnimationFrame(() => {
        applyBookTransformsRef.current?.();
      });
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

  useLayoutEffect(() => {
    const scroller = scrollRef.current;
    const track = trackRef.current;
    if (!scroller || !track) return;

    /** Stripe-like（克制版）：仅滚动驱动正/反面变化，正面权重高于反面。 */
    const smoothstep01 = (t) => {
      const x = Math.max(0, Math.min(1, t));
      return x * x * (3 - 2 * x);
    };

    const getNearestCenterIndex = (metrics) => {
      if (!metrics.length) return -1;
      const vc = scroller.scrollLeft + scroller.clientWidth / 2;
      let nearestIndex = 0;
      let nearestDistance = Math.abs(metrics[0].center - vc);
      for (let i = 1; i < metrics.length; i += 1) {
        const distance = Math.abs(metrics[i].center - vc);
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestIndex = i;
        }
      }
      return nearestIndex;
    };

    const syncActiveBookIndex = (metrics) => {
      const nextIndex = getNearestCenterIndex(metrics);
      if (nextIndex !== activeBookIndexRef.current) {
        activeBookIndexRef.current = nextIndex;
        setActiveBookIndex(nextIndex);
      }
    };

    const recalcMetrics = () => {
      const metrics = [];
      for (const slot of track.querySelectorAll(".ffj-bookshelf-book-slot")) {
        metrics.push({
          el: slot,
          center: slot.offsetLeft + slot.offsetWidth / 2,
        });
      }
      slotMetricsRef.current = metrics;
      syncActiveBookIndex(metrics);
      if (currentYawRef.current.length !== metrics.length) {
        currentYawRef.current = new Array(metrics.length).fill(0);
      }
      if (targetYawRef.current.length !== metrics.length) {
        targetYawRef.current = new Array(metrics.length).fill(0);
      }
      if (currentFrontVisRef.current.length !== metrics.length) {
        currentFrontVisRef.current = new Array(metrics.length).fill(0);
      }
      if (targetFrontVisRef.current.length !== metrics.length) {
        targetFrontVisRef.current = new Array(metrics.length).fill(0);
      }
      if (currentBackVisRef.current.length !== metrics.length) {
        currentBackVisRef.current = new Array(metrics.length).fill(0);
      }
      if (targetBackVisRef.current.length !== metrics.length) {
        targetBackVisRef.current = new Array(metrics.length).fill(0);
      }
    };

    const updateTargetsFromScroll = () => {
      const metrics = slotMetricsRef.current;
      if (metrics.length === 0) return;
      const vc = scroller.scrollLeft + scroller.clientWidth / 2;
      const band = Math.min(Math.max(scroller.clientWidth * 0.46, 280), 620);
      const maxFrontYawDeg = 30;
      const maxBackYawDeg = 18;
      // 用“最接近视口中心”的书作为锚点，保证该书接近纯书脊
      let anchorCenter = metrics[0].center;
      let anchorDist = Math.abs(metrics[0].center - vc);
      for (let i = 1; i < metrics.length; i += 1) {
        const d = Math.abs(metrics[i].center - vc);
        if (d < anchorDist) {
          anchorDist = d;
          anchorCenter = metrics[i].center;
        }
      }
      for (let i = 0; i < metrics.length; i += 1) {
        const t = metrics[i].center - anchorCenter;
        const absT = Math.abs(t);
        const fr = Math.min(1, Math.max(0, absT / Math.max(1, band)));
        const u = 1 - smoothstep01(fr);
        const centerSpineZonePx = 12;
        const visBand = Math.max(1, band * 0.32);
        const side = Math.abs(t) <= centerSpineZonePx ? 0 : Math.sign(t);
        const visProgress = Math.min(
          1,
          Math.max(0, (absT - centerSpineZonePx) / visBand),
        );
        const sideVis = smoothstep01(visProgress);
        const sideFront = side < 0 ? sideVis : 0;
        const sideBack = side > 0 ? sideVis : 0;
        targetYawRef.current[i] =
          side < 0 ? maxFrontYawDeg * u : side > 0 ? -maxBackYawDeg * u : 0;
        targetFrontVisRef.current[i] = sideFront;
        targetBackVisRef.current[i] = sideBack;
      }
    };

    const writeCurrentState = (dtMs) => {
      const metrics = slotMetricsRef.current;
      const dt = Math.max(1, Math.min(64, dtMs || 16.67));
      const dampingHz = 12;
      const alpha = 1 - Math.exp((-dampingHz * dt) / 1000);
      const yawEpsilon = 0.04;
      const visEpsilon = 0.005;
      let keepAnimating = false;
      for (let i = 0; i < metrics.length; i += 1) {
        const yawTarget = targetYawRef.current[i] ?? 0;
        const yawCurr = currentYawRef.current[i] ?? 0;
        const yawNext = yawCurr + (yawTarget - yawCurr) * alpha;
        currentYawRef.current[i] = yawNext;

        const frontTarget = targetFrontVisRef.current[i] ?? 0;
        const frontNext = frontTarget;
        currentFrontVisRef.current[i] = frontNext;

        const backTarget = targetBackVisRef.current[i] ?? 0;
        const backNext = backTarget;
        currentBackVisRef.current[i] = backNext;

        metrics[i].el.style.setProperty("--ffj-book-yaw-scroll", `${yawNext.toFixed(3)}deg`);
        metrics[i].el.style.setProperty("--ffj-book-front-vis", frontNext.toFixed(3));
        metrics[i].el.style.setProperty("--ffj-book-back-vis", backNext.toFixed(3));

        if (
          Math.abs(yawTarget - yawNext) > yawEpsilon ||
          Math.abs(frontTarget - frontNext) > visEpsilon ||
          Math.abs(backTarget - backNext) > visEpsilon
        ) {
          keepAnimating = true;
        }
      }
      return keepAnimating;
    };

    const frame = (ts) => {
      rafRef.current = 0;
      const dt = lastFrameTsRef.current ? ts - lastFrameTsRef.current : 16.67;
      lastFrameTsRef.current = ts;
      const keepAnimating = writeCurrentState(dt);
      if (keepAnimating) {
        rafRef.current = window.requestAnimationFrame(frame);
      } else {
        animateRunningRef.current = false;
        lastFrameTsRef.current = 0;
      }
    };

    const startAnimation = () => {
      if (animateRunningRef.current) return;
      animateRunningRef.current = true;
      rafRef.current = window.requestAnimationFrame(frame);
    };

    const applyTransforms = () => {
      recalcMetrics();
      updateTargetsFromScroll();
      startAnimation();
    };

    const onScroll = () => {
      updateTargetsFromScroll();
      syncActiveBookIndex(slotMetricsRef.current);
      startAnimation();
    };

    applyBookTransformsRef.current = onScroll;

    const schedule = () => {
      applyTransforms();
    };

    applyTransforms();
    scroller.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", schedule, { passive: true });

    return () => {
      applyBookTransformsRef.current = () => {};
      window.cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
      animateRunningRef.current = false;
      lastFrameTsRef.current = 0;
      scroller.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", schedule);
      for (const { el } of slotMetricsRef.current) {
        el.style.removeProperty("--ffj-book-yaw-scroll");
        el.style.removeProperty("--ffj-book-front-vis");
        el.style.removeProperty("--ffj-book-back-vis");
      }
      slotMetricsRef.current = [];
      targetYawRef.current = [];
      currentYawRef.current = [];
      targetFrontVisRef.current = [];
      currentFrontVisRef.current = [];
      targetBackVisRef.current = [];
      currentBackVisRef.current = [];
      activeBookIndexRef.current = -1;
    };
  }, [cities]);

  return (
    <main className="ffj-page-shell ffj-paper-noise ffj-paper-noise--warm ffj-bookshelf-page">
      <div className="ffj-bookshelf-slogan-region">
        <section
          className="ffj-bookshelf-slogan"
          aria-labelledby="ffj-bookshelf-slogan-cn"
        >
          <img
            className="ffj-bookshelf-slogan-avatar"
            src={evelynAvatarUrl}
            alt="Evelyn 动漫头像"
            width={128}
            height={128}
            decoding="async"
          />
          <span className="ffj-bookshelf-avatar-welcome" aria-hidden>
            Welcome~
          </span>
          <div
            className={`ffj-bookshelf-slogan-lines${isTypingDone ? " is-floating" : ""}`}
          >
            <p
              id="ffj-bookshelf-slogan-cn"
              className={`ffj-bookshelf-slogan-cn${typingPhase !== "cn" ? " is-typed" : ""}`}
            >
              <span className="ffj-slogan-line-ghost" aria-hidden>
                {sloganCnFull}
              </span>
              <span className="ffj-slogan-line-live">{typedCn}</span>
            </p>
            <p
              className={`ffj-bookshelf-slogan-en${
                typingPhase !== "cn" ? " is-visible" : ""
              }${typingPhase === "en" ? " is-typing" : ""}`}
            >
              <span className="ffj-slogan-line-ghost" aria-hidden>
                {sloganEnFull}
              </span>
              <span className="ffj-slogan-line-live">{typedEn}</span>
            </p>
          </div>
          <img
            className="ffj-bookshelf-slogan-earth"
            src={earthStickerUrl}
            alt=""
            width={120}
            height={120}
            decoding="async"
          />
        </section>
      </div>
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
            >
              <div
                className="ffj-bookshelf-book-hit"
                role="button"
                tabIndex={0}
                aria-label={
                  city.city_zh
                    ? `进入${city.city_zh}详情`
                    : `Enter ${city.city_en}`
                }
                onClick={(e) => handleBookClick(city, e.currentTarget)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleBookClick(city, e.currentTarget);
                  }
                }}
              >
                <Book city={city} />
              </div>
            </li>
          ))}
        </ul>
      </div>
      <div className="ffj-bookshelf-footprints" aria-label="书架脚印导航" role="navigation">
        {cities.map((city, index) => (
          <button
            type="button"
            key={`${city.slug}-footprint`}
            className={`ffj-footprint${index === activeBookIndex ? " is-active" : ""}`}
            aria-label={`将${city.city_zh || city.city_en}定位到中间`}
            onClick={() => {
              scrollBookToCenter(index);
            }}
          >
            <img src={footprintsStickerUrl} alt="" decoding="async" />
          </button>
        ))}
      </div>

      {/* 翻书过渡动画 */}
      <AnimatePresence>
        {transitioningBook && (
          <BookTransition
            city={transitioningBook.city}
            startRect={transitioningBook.rect}
            onComplete={handleTransitionComplete}
          />
        )}
      </AnimatePresence>
    </main>
  );
}
