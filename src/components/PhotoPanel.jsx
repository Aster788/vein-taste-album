import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  getPreloadedDisplayUrl,
  isPhotoDisplayReady,
  preloadImage,
  preloadImages,
  revokePreloadedBlobUrls,
} from "../utils/preloadImage.js";
import { getSortedStorePhotos } from "../utils/storePhotos.js";

export default function PhotoPanel({
  citySlug,
  selectedStore,
  activePhotoIndex,
  onChangeActivePhotoIndex,
  onDisplayPhotoIndexChange,
  labels,
  metaContent = null,
}) {
  const autoplayRef = useRef(/** @type {number | null} */ (null));
  const isHoveredRef = useRef(false);
  const lightboxOpenRef = useRef(false);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isPhotoLoading, setIsPhotoLoading] = useState(false);
  const [displaySrc, setDisplaySrc] = useState("");
  const [isRecoveringBrokenImage, setIsRecoveringBrokenImage] = useState(false);
  const transitionTimerRef = useRef(/** @type {number | null} */ (null));
  const displayRequestRef = useRef(0);
  const convertedUrlCacheRef = useRef(new Map());
  const conversionFailedRef = useRef(new Set());
  const transitionDurationMs = 280;

  const photos = useMemo(
    () => getSortedStorePhotos(citySlug, selectedStore),
    [citySlug, selectedStore],
  );

  const photoCount = photos.length;
  const hasPhotos = photoCount > 0;
  const safeIndex = hasPhotos ? Math.min(activePhotoIndex, photoCount - 1) : 0;
  const activePhoto = hasPhotos ? photos[safeIndex] : null;

  const triggerTransition = useCallback(() => {
    setIsTransitioning(true);
    if (transitionTimerRef.current != null) {
      window.clearTimeout(transitionTimerRef.current);
    }
    transitionTimerRef.current = window.setTimeout(() => {
      setIsTransitioning(false);
      transitionTimerRef.current = null;
    }, transitionDurationMs);
  }, []);

  const commitDisplayPhoto = useCallback(
    (href, index) => {
      setDisplaySrc(href);
      setIsPhotoLoading(false);
      triggerTransition();
      onDisplayPhotoIndexChange?.(index);
    },
    [onDisplayPhotoIndexChange, triggerTransition],
  );

  useEffect(() => {
    const fullHref = activePhoto?.href ?? "";
    const thumbHref =
      activePhoto?.thumbHref && activePhoto.thumbHref !== fullHref
        ? activePhoto.thumbHref
        : "";

    if (fullHref === "") {
      displayRequestRef.current += 1;
      setDisplaySrc("");
      setIsPhotoLoading(false);
      onDisplayPhotoIndexChange?.(0);
      return;
    }

    const requestId = displayRequestRef.current + 1;
    displayRequestRef.current = requestId;
    setIsRecoveringBrokenImage(false);

    if (isPhotoDisplayReady(fullHref)) {
      commitDisplayPhoto(getPreloadedDisplayUrl(fullHref), safeIndex);
      return;
    }

    let cancelled = false;

    const loadFull = () =>
      preloadImage(fullHref, { priority: "high" })
        .then((displayUrl) => {
          if (cancelled || displayRequestRef.current !== requestId) return;
          commitDisplayPhoto(displayUrl ?? fullHref, safeIndex);
        })
        .catch(() => {
          if (cancelled || displayRequestRef.current !== requestId) return;
          commitDisplayPhoto(fullHref, safeIndex);
        });

    const run = async () => {
      if (thumbHref !== "") {
        if (isPhotoDisplayReady(thumbHref)) {
          commitDisplayPhoto(getPreloadedDisplayUrl(thumbHref), safeIndex);
          await loadFull();
          return;
        }
        try {
          const thumbUrl = await preloadImage(thumbHref, { priority: "high" });
          if (cancelled || displayRequestRef.current !== requestId) return;
          commitDisplayPhoto(thumbUrl ?? thumbHref, safeIndex);
          await loadFull();
          return;
        } catch {
          // Thumb missing on CDN — fall through to full image.
        }
      }
      await loadFull();
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [
    activePhoto?.href,
    activePhoto?.thumbHref,
    commitDisplayPhoto,
    onDisplayPhotoIndexChange,
    safeIndex,
  ]);

  useEffect(() => {
    if (!photos.length) return;
    const priority = [];
    const current = photos[safeIndex];
    if (current?.thumbHref) priority.push(current.thumbHref);
    if (current?.href) priority.push(current.href);
    for (let offset = 1; offset <= 2; offset += 1) {
      const prev = photos[(safeIndex - offset + photoCount) % photoCount];
      const next = photos[(safeIndex + offset) % photoCount];
      if (prev?.thumbHref) priority.push(prev.thumbHref);
      if (prev?.href) priority.push(prev.href);
      if (next?.thumbHref) priority.push(next.thumbHref);
      if (next?.href) priority.push(next.href);
    }
    const allHrefs = photos.flatMap((photo) =>
      [photo.thumbHref, photo.href].filter((href) => String(href ?? "").trim() !== ""),
    );
    preloadImages(allHrefs, { prioritize: priority });
  }, [photos, photoCount, safeIndex]);

  useEffect(() => {
    if (!hasPhotos) {
      if (activePhotoIndex !== 0) onChangeActivePhotoIndex(0);
      return;
    }
    if (activePhotoIndex > photoCount - 1) {
      onChangeActivePhotoIndex(0);
    }
  }, [activePhotoIndex, hasPhotos, onChangeActivePhotoIndex, photoCount]);

  useEffect(() => {
    return () => {
      if (transitionTimerRef.current != null) {
        window.clearTimeout(transitionTimerRef.current);
      }
      convertedUrlCacheRef.current.forEach((url) => URL.revokeObjectURL(url));
      convertedUrlCacheRef.current.clear();
      revokePreloadedBlobUrls();
    };
  }, []);

  useEffect(() => {
    lightboxOpenRef.current = isLightboxOpen;
  }, [isLightboxOpen]);

  useEffect(() => {
    setIsLightboxOpen(false);
  }, [citySlug, selectedStore?.store_slug]);

  useEffect(() => {
    if (!hasPhotos) return undefined;

    const clearAutoplay = () => {
      if (autoplayRef.current != null) {
        window.clearInterval(autoplayRef.current);
        autoplayRef.current = null;
      }
    };

    const startAutoplay = () => {
      clearAutoplay();
      autoplayRef.current = window.setInterval(() => {
        if (isHoveredRef.current || lightboxOpenRef.current) return;
        onChangeActivePhotoIndex((prev) => ((prev + 1) % photoCount));
      }, 5000);
    };

    startAutoplay();
    return () => {
      clearAutoplay();
    };
  }, [hasPhotos, onChangeActivePhotoIndex, photoCount]);

  const goToIndex = (nextIndex) => {
    if (!hasPhotos) return;
    onChangeActivePhotoIndex(nextIndex);
  };

  const goPrev = useCallback(() => {
    if (!hasPhotos) return;
    onChangeActivePhotoIndex((prev) => {
      const current = Math.min(Math.max(0, prev), photoCount - 1);
      return (current - 1 + photoCount) % photoCount;
    });
  }, [hasPhotos, onChangeActivePhotoIndex, photoCount]);

  const goNext = useCallback(() => {
    if (!hasPhotos) return;
    onChangeActivePhotoIndex((prev) => {
      const current = Math.min(Math.max(0, prev), photoCount - 1);
      return (current + 1) % photoCount;
    });
  }, [hasPhotos, onChangeActivePhotoIndex, photoCount]);

  useEffect(() => {
    if (!hasPhotos || photoCount <= 1 || isLightboxOpen) return undefined;

    const isTypingTarget = (target) => {
      if (!(target instanceof HTMLElement)) return false;
      const tag = target.tagName;
      return (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        target.isContentEditable
      );
    };

    const onKeyDown = (event) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      if (isTypingTarget(event.target)) return;
      event.preventDefault();
      if (event.key === "ArrowLeft") goPrev();
      else goNext();
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [goNext, goPrev, hasPhotos, isLightboxOpen, photoCount]);

  useEffect(() => {
    if (!isLightboxOpen) return undefined;

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setIsLightboxOpen(false);
        return;
      }
      if (!hasPhotos || photoCount <= 1) return;
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        goPrev();
        return;
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        goNext();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [goNext, goPrev, hasPhotos, isLightboxOpen, photoCount]);

  const openLightbox = () => {
    if (!hasPhotos || !activePhoto) return;
    setIsLightboxOpen(true);
  };

  const closeLightbox = () => {
    setIsLightboxOpen(false);
  };

  const lightboxSrc = displaySrc || activePhoto?.href || "";
  const lightboxAlt = activePhoto?.filename ?? "";
  const polaroidSrc = displaySrc || "";

  return (
    <section className="ffj-photo-panel" aria-label={labels.photoRegion}>
      <div
        className="ffj-photo-stage"
        aria-busy={isPhotoLoading}
        onMouseEnter={() => {
          isHoveredRef.current = true;
        }}
        onMouseLeave={() => {
          isHoveredRef.current = false;
        }}
      >
        {hasPhotos && activePhoto ? (
          <>
            <button
              type="button"
              className="ffj-photo-nav ffj-photo-nav--prev"
              onClick={goPrev}
              aria-label={labels.prevPhoto}
            >
              <svg
                className="ffj-photo-nav-icon"
                viewBox="0 0 24 24"
                width="24"
                height="24"
                aria-hidden="true"
              >
                <polyline
                  points="15 5 7 12 15 19"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="square"
                  strokeLinejoin="miter"
                />
              </svg>
            </button>
            <figure
              className={`ffj-photo-polaroid ffj-photo-polaroid--clickable ${isPhotoLoading ? "is-loading" : ""}`}
              role="button"
              tabIndex={0}
              aria-label={labels.expandPhoto}
              onClick={openLightbox}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  openLightbox();
                }
              }}
            >
              {polaroidSrc !== "" ? (
                <img
                  className={`ffj-photo-polaroid-image ${isTransitioning ? "is-transitioning" : ""}`}
                  src={polaroidSrc}
                  alt={activePhoto.filename}
                  loading="eager"
                  fetchPriority="high"
                  decoding="async"
                  draggable={false}
                  onError={async () => {
                    if (
                      !activePhoto?.href ||
                      isRecoveringBrokenImage ||
                      conversionFailedRef.current.has(activePhoto.href)
                    ) {
                      return;
                    }
                    const requestId = displayRequestRef.current;
                    const cached = convertedUrlCacheRef.current.get(activePhoto.href);
                    if (cached) {
                      commitDisplayPhoto(cached, safeIndex);
                      return;
                    }
                    setIsRecoveringBrokenImage(true);
                    try {
                      const response = await fetch(activePhoto.href);
                      const blob = await response.blob();
                      const heicBlob = new Blob([blob], { type: "image/heic" });
                      const { default: heic2any } = await import("heic2any");
                      const converted = await heic2any({
                        blob: heicBlob,
                        toType: "image/jpeg",
                        quality: 0.92,
                      });
                      const convertedBlob = Array.isArray(converted) ? converted[0] : converted;
                      if (!(convertedBlob instanceof Blob)) return;
                      const convertedUrl = URL.createObjectURL(convertedBlob);
                      convertedUrlCacheRef.current.set(activePhoto.href, convertedUrl);
                      const displayUrl = await preloadImage(convertedUrl, { priority: "high" });
                      if (displayRequestRef.current !== requestId) return;
                      commitDisplayPhoto(displayUrl ?? convertedUrl, safeIndex);
                    } catch (_error) {
                      conversionFailedRef.current.add(activePhoto.href);
                      if (displayRequestRef.current !== requestId) return;
                      commitDisplayPhoto(activePhoto.href, safeIndex);
                    } finally {
                      setIsRecoveringBrokenImage(false);
                    }
                  }}
                />
              ) : null}
            </figure>
            <button
              type="button"
              className="ffj-photo-nav ffj-photo-nav--next"
              onClick={goNext}
              aria-label={labels.nextPhoto}
            >
              <svg
                className="ffj-photo-nav-icon"
                viewBox="0 0 24 24"
                width="24"
                height="24"
                aria-hidden="true"
              >
                <polyline
                  points="9 5 17 12 9 19"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="square"
                  strokeLinejoin="miter"
                />
              </svg>
            </button>
          </>
        ) : (
          <div className="ffj-photo-empty">{labels.noPhoto}</div>
        )}
      </div>
      {metaContent ? (
        <div className="ffj-photo-meta-slot">
          {metaContent}
        </div>
      ) : null}
      {hasPhotos ? (
        <div className="ffj-photo-dots" role="tablist" aria-label={labels.photoPagination}>
          {photos.map((photo, index) => (
            <button
              key={`${photo.filename}-${index}`}
              type="button"
              role="tab"
              className={`ffj-photo-dot ${index === safeIndex ? "is-active" : ""}`}
              aria-selected={index === safeIndex}
              aria-label={`${labels.gotoPhoto} ${index + 1}`}
              onClick={() => goToIndex(index)}
            />
          ))}
        </div>
      ) : null}
      {isLightboxOpen && lightboxSrc
        ? createPortal(
            <div
              className="ffj-photo-lightbox"
              role="dialog"
              aria-modal="true"
              aria-label={labels.closeLightbox}
              onClick={closeLightbox}
            >
              {photoCount > 1 ? (
                <>
                  <button
                    type="button"
                    className="ffj-photo-lightbox-nav ffj-photo-lightbox-nav--prev"
                    aria-label={labels.prevPhoto}
                    onClick={(event) => {
                      event.stopPropagation();
                      goPrev();
                    }}
                  >
                    <svg
                      className="ffj-photo-lightbox-nav-icon"
                      viewBox="0 0 24 24"
                      width="22"
                      height="22"
                      aria-hidden="true"
                    >
                      <polyline
                        points="15 5 7 12 15 19"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="square"
                        strokeLinejoin="miter"
                      />
                    </svg>
                  </button>
                  <button
                    type="button"
                    className="ffj-photo-lightbox-nav ffj-photo-lightbox-nav--next"
                    aria-label={labels.nextPhoto}
                    onClick={(event) => {
                      event.stopPropagation();
                      goNext();
                    }}
                  >
                    <svg
                      className="ffj-photo-lightbox-nav-icon"
                      viewBox="0 0 24 24"
                      width="22"
                      height="22"
                      aria-hidden="true"
                    >
                      <polyline
                        points="9 5 17 12 9 19"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="square"
                        strokeLinejoin="miter"
                      />
                    </svg>
                  </button>
                </>
              ) : null}
              <img
                className="ffj-photo-lightbox-image"
                src={lightboxSrc}
                alt={lightboxAlt}
                draggable={false}
              />
            </div>,
            document.body,
          )
        : null}
    </section>
  );
}
