"use client";

import Image from "next/image";
import { m, type PanInfo, useAnimationControls } from "motion/react";
import {
  type KeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  getMatMotionTransition,
  MAT_MOTION_DURATION,
  MAT_MOTION_EASE,
  MAT_MOTION_SWIPE,
} from "@/components/ui/motion-tokens";
import { useMatReducedMotion } from "@/components/ui/use-mat-reduced-motion";

const AUTO_ROTATION_MS = 5000;
const POINTER_CLICK_TOLERANCE = 8;

type StudioGalleryImage = {
  alt: string;
  src: string;
};

type StudioGalleryProps = {
  images: readonly StudioGalleryImage[];
};

function getGalleryX(index: number) {
  return `${index * -100}%`;
}

export function StudioGallery({ images }: StudioGalleryProps) {
  const controls = useAnimationControls();
  const prefersReducedMotion = useMatReducedMotion();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [manualPaused, setManualPaused] = useState<boolean | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const currentIndexRef = useRef(0);
  const isAnimatingRef = useRef(false);
  const isMountedRef = useRef(true);
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);

  const renderedImages = images.length > 1 ? [...images, images[0]] : images;
  const canRotate = images.length > 1;
  const isPaused = manualPaused ?? prefersReducedMotion;
  const currentImage = images[currentIndex % images.length];

  const setActiveIndex = useCallback((index: number) => {
    currentIndexRef.current = index;
    setCurrentIndex(index);
  }, []);

  const animateToIndex = useCallback(
    async (targetIndex: number) => {
      if (!canRotate || isAnimatingRef.current) {
        return;
      }

      isAnimatingRef.current = true;
      setIsAnimating(true);
      setActiveIndex(targetIndex);

      if (prefersReducedMotion) {
        const normalizedIndex = targetIndex % images.length;
        controls.set({ x: getGalleryX(normalizedIndex) });
        setActiveIndex(normalizedIndex);
        isAnimatingRef.current = false;
        setIsAnimating(false);
        return;
      }

      await controls.start({
        x: getGalleryX(targetIndex),
        transition: getMatMotionTransition(
          MAT_MOTION_DURATION.gallery,
          false,
          MAT_MOTION_EASE.slide,
        ),
      });

      if (!isMountedRef.current) {
        return;
      }

      if (targetIndex === images.length) {
        controls.set({ x: getGalleryX(0) });
        setActiveIndex(0);
      }

      isAnimatingRef.current = false;
      setIsAnimating(false);
    }, [canRotate, controls, images.length, prefersReducedMotion, setActiveIndex],
  );

  const navigateBy = useCallback(
    (direction: -1 | 1) => {
      if (!canRotate || isAnimatingRef.current) {
        return;
      }

      let sourceIndex = currentIndexRef.current;

      if (direction === -1 && sourceIndex === 0) {
        sourceIndex = images.length;
        controls.set({ x: getGalleryX(sourceIndex) });
        setActiveIndex(sourceIndex);
      }

      void animateToIndex(sourceIndex + direction);
    }, [animateToIndex, canRotate, controls, images.length, setActiveIndex],
  );

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      controls.stop();
    };
  }, [controls]);

  useEffect(() => {
    if (!prefersReducedMotion || images.length === 0) {
      return;
    }

    controls.stop();
    const normalizedIndex = currentIndexRef.current % images.length;
    controls.set({ x: getGalleryX(normalizedIndex) });
    setActiveIndex(normalizedIndex);
    isAnimatingRef.current = false;
    setIsAnimating(false);
  }, [controls, images.length, prefersReducedMotion, setActiveIndex]);

  useEffect(() => {
    if (!canRotate || isPaused) {
      return;
    }

    const intervalId = window.setInterval(() => {
      if (!document.hidden && !isAnimatingRef.current) {
        navigateBy(1);
      }
    }, AUTO_ROTATION_MS);

    return () => window.clearInterval(intervalId);
  }, [canRotate, isPaused, navigateBy]);

  if (images.length === 0) {
    return null;
  }

  const togglePaused = () => {
    if (canRotate) {
      setManualPaused((paused) => !(paused ?? prefersReducedMotion));
    }
  };

  const handleClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    const pointerStart = pointerStartRef.current;
    pointerStartRef.current = null;

    if (
      pointerStart &&
      Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y) >
        POINTER_CLICK_TOLERANCE
    ) {
      return;
    }

    togglePaused();
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    pointerStartRef.current = { x: event.clientX, y: event.clientY };
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    event.preventDefault();
    togglePaused();
  };

  const handleDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const movedToNext =
      info.offset.x <= -MAT_MOTION_SWIPE.distance ||
      info.velocity.x <= -MAT_MOTION_SWIPE.velocity;
    const movedToPrevious =
      info.offset.x >= MAT_MOTION_SWIPE.distance ||
      info.velocity.x >= MAT_MOTION_SWIPE.velocity;

    if (movedToNext) {
      navigateBy(1);
      return;
    }

    if (movedToPrevious) {
      navigateBy(-1);
      return;
    }

    void controls.start({
      x: getGalleryX(currentIndexRef.current),
      transition: getMatMotionTransition(
        MAT_MOTION_DURATION.standard,
        prefersReducedMotion,
      ),
    });
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
      data-studio-active-index={currentIndex % images.length}
      data-studio-animating={isAnimating ? "true" : "false"}
      onClick={handleClick}
      onKeyDown={canRotate ? handleKeyDown : undefined}
      onPointerDown={canRotate ? handlePointerDown : undefined}
      role={canRotate ? "button" : undefined}
      tabIndex={canRotate ? 0 : undefined}
    >
      <m.div
        animate={controls}
        aria-live="off"
        className="mat-studio-gallery__track"
        drag={canRotate && !isAnimating ? "x" : false}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.18}
        dragMomentum={false}
        initial={false}
        onDragEnd={handleDragEnd}
        style={{ touchAction: "pan-y", x: getGalleryX(0) }}
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
              quality={90}
              sizes="(min-width: 1440px) 622px, (min-width: 1024px) calc(48vw - 67px), (min-width: 768px) 720px, calc(100vw - 48px)"
              src={image.src}
            />
          </div>
        ))}
      </m.div>
    </div>
  );
}
