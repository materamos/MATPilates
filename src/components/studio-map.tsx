"use client";

import { useEffect, useRef, useState } from "react";

const MAP_LAYOUT_QUERY = "(min-width: 1025px) and (orientation: landscape)";

type StudioMapProps = {
  embedUrl: string;
};

export function StudioMap({ embedUrl }: StudioMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isEligible, setIsEligible] = useState(false);
  const [shouldLoad, setShouldLoad] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia(MAP_LAYOUT_QUERY);

    const syncEligibility = () => {
      setIsEligible(mediaQuery.matches);

      if (!mediaQuery.matches) {
        setShouldLoad(false);
      }
    };

    syncEligibility();
    mediaQuery.addEventListener("change", syncEligibility);

    return () => mediaQuery.removeEventListener("change", syncEligibility);
  }, []);

  useEffect(() => {
    const container = containerRef.current;

    if (!isEligible || !container) {
      return;
    }

    const IntersectionObserverConstructor = window.IntersectionObserver;

    if (typeof IntersectionObserverConstructor !== "function") {
      const loadTimeoutId = globalThis.setTimeout(() => setShouldLoad(true), 0);

      return () => globalThis.clearTimeout(loadTimeoutId);
    }

    const observer = new IntersectionObserverConstructor(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShouldLoad(true);
          observer.disconnect();
        }
      },
      { rootMargin: "320px 0px" },
    );

    observer.observe(container);

    return () => observer.disconnect();
  }, [isEligible]);

  return (
    <div className="mat-studio__map" ref={containerRef}>
      {shouldLoad ? (
        <iframe
          allowFullScreen
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
          src={embedUrl}
          title="Mapa de MAT Pilates en Canning Center"
        />
      ) : null}
    </div>
  );
}
