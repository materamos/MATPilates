"use client";

import Image from "next/image";
import { type KeyboardEvent, useEffect, useState, useSyncExternalStore } from "react";

const AUTO_ROTATION_MS = 5000;
const SLIDE_TRANSITION_MS = 400;

type StudioGalleryImage = {
  alt: string;
  src: string;
};

type StudioGalleryProps = {
  images: readonly StudioGalleryImage[];
};

const reducedMotionQuery = "(prefers-reduced-motion: reduce)";

function subscribeToReducedMotion(callback: () => void) {
  const mediaQuery = window.matchMedia(reducedMotionQuery);
  mediaQuery.addEventListener("change", callback);

  return () => mediaQuery.removeEventListener("change", callback);
}

function getReducedMotionPreference() {
  return window.matchMedia(reducedMotionQuery).matches;
}

export function StudioGallery({ images }: StudioGalleryProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [manualPaused, setManualPaused] = useState<boolean | null>(null);
  const [transitionEnabled, setTransitionEnabled] = useState(true);
  const prefersReducedMotion = useSyncExternalStore(
    subscribeToReducedMotion,
    getReducedMotionPreference,
    () => false,
  );

  const renderedImages = images.length > 1 ? [...images, images[0]] : images;
  const canRotate = images.length > 1;
  const isPaused = manualPaused ?? prefersReducedMotion;
  const currentImage = images[currentIndex % images.length];

  useEffect(() => {
    if (!canRotate || isPaused) {
      return;
    }

    const intervalId = window.setInterval(() => {
      if (!document.hidden) {
        setCurrentIndex((index) => index + 1);
      }
    }, AUTO_ROTATION_MS);

    return () => window.clearInterval(intervalId);
  }, [canRotate, isPaused]);

  useEffect(() => {
    if (images.length < 2 || currentIndex !== images.length) {
      return;
    }

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const resetTimeoutId = window.setTimeout(
      () => {
        setTransitionEnabled(false);
        setCurrentIndex(0);

        window.requestAnimationFrame(() => {
          window.requestAnimationFrame(() => setTransitionEnabled(true));
        });
      },
      prefersReducedMotion ? 0 : SLIDE_TRANSITION_MS,
    );

    return () => window.clearTimeout(resetTimeoutId);
  }, [currentIndex, images.length]);

  if (images.length === 0) {
    return null;
  }

  const togglePaused = () => {
    if (canRotate) {
      setManualPaused((paused) => !(paused ?? prefersReducedMotion));
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    event.preventDefault();
    togglePaused();
  };

  return (
    <div
      aria-label={
        canRotate
          ? `${isPaused ? "Reanudar" : "Pausar"} galería del estudio. ${currentImage.alt}`
          : undefined
      }
      aria-pressed={canRotate ? isPaused : undefined}
      className="mat-studio__image mat-studio-gallery"
      onClick={togglePaused}
      onKeyDown={canRotate ? handleKeyDown : undefined}
      role={canRotate ? "button" : undefined}
      tabIndex={canRotate ? 0 : undefined}
    >
      <div
        aria-live="off"
        className={`mat-studio-gallery__track${transitionEnabled ? "" : " mat-studio-gallery__track--instant"}`}
        style={{ transform: `translateX(-${currentIndex * 100}%)` }}
      >
        {renderedImages.map((image, index) => (
          <div
            aria-hidden={index !== currentIndex}
            className="mat-studio-gallery__slide"
            data-studio-image-index={index % images.length}
            key={`${image.src}-${index}`}
          >
            <Image
              alt={index === currentIndex ? image.alt : ""}
              className="mat-cropped-image mat-studio__photo"
              fill
              sizes="(min-width: 1440px) 622px, (min-width: 1024px) calc(48vw - 67px), (min-width: 768px) 720px, calc(100vw - 48px)"
              src={image.src}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
