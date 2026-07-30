"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

const AUTO_ROTATION_MS = 5000;
const SLIDE_TRANSITION_MS = 400;

type StudioGalleryImage = {
  alt: string;
  src: string;
};

type StudioGalleryProps = {
  images: readonly StudioGalleryImage[];
};

export function StudioGallery({ images }: StudioGalleryProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [transitionEnabled, setTransitionEnabled] = useState(true);

  const renderedImages = images.length > 1 ? [...images, images[0]] : images;

  useEffect(() => {
    if (images.length < 2) {
      return;
    }

    const intervalId = window.setInterval(() => {
      if (!document.hidden) {
        setCurrentIndex((index) => index + 1);
      }
    }, AUTO_ROTATION_MS);

    return () => window.clearInterval(intervalId);
  }, [images.length]);

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

  return (
    <div className="mat-studio__image mat-studio-gallery">
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
