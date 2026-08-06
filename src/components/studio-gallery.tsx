"use client";

import Image from "next/image";
import { m, type PanInfo } from "motion/react";
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

export function StudioGallery({ images }: StudioGalleryProps) {
  const prefersReducedMotion = useMatReducedMotion();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [outgoingIndex, setOutgoingIndex] = useState<number | null>(null);
  const [incomingIndex, setIncomingIndex] = useState<number | null>(null);
  const [direction, setDirection] = useState<-1 | 1>(1);
  const [isTransitionReady, setIsTransitionReady] = useState(false);
  const [manualPaused, setManualPaused] = useState<boolean | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isPointerActive, setIsPointerActive] = useState(false);
  const currentIndexRef = useRef(0);
  const isAnimatingRef = useRef(false);
  const isMountedRef = useRef(true);
  const isPointerActiveRef = useRef(false);
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);

  const canRotate = images.length > 1;
  const isPaused = manualPaused ?? prefersReducedMotion;
  const currentImage = images[currentIndex % images.length];

  const setActiveIndex = useCallback((index: number) => {
    currentIndexRef.current = index;
    setCurrentIndex(index);
  }, []);

  const navigateBy = useCallback(
    (direction: -1 | 1) => {
      if (!canRotate || isAnimatingRef.current) {
        return;
      }

      const targetIndex =
        (currentIndexRef.current + direction + images.length) % images.length;

      isAnimatingRef.current = true;
      setIsAnimating(true);
      setDirection(direction);
      setOutgoingIndex(currentIndexRef.current);
      setIncomingIndex(targetIndex);
      setIsTransitionReady(false);
    }, [canRotate, images.length],
  );

  const finishAnimation = useCallback(() => {
    if (!isMountedRef.current || !isAnimatingRef.current || !isTransitionReady) {
      return;
    }

    isAnimatingRef.current = false;
    setIsAnimating(false);
    setOutgoingIndex(null);
    setIncomingIndex(null);
    setIsTransitionReady(false);
  }, [isTransitionReady]);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (incomingIndex === null || isTransitionReady) {
      return;
    }

    let secondFrameId: number | undefined;
    const frameId = window.requestAnimationFrame(() => {
      secondFrameId = window.requestAnimationFrame(() => {
        setActiveIndex(incomingIndex);
        setIsTransitionReady(true);
      });
    });

    return () => {
      window.cancelAnimationFrame(frameId);

      if (secondFrameId !== undefined) {
        window.cancelAnimationFrame(secondFrameId);
      }
    };
  }, [incomingIndex, isTransitionReady, setActiveIndex]);

  useEffect(() => {
    if (!canRotate || isPaused || isAnimating || isPointerActive) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      if (!document.hidden && !isPointerActiveRef.current) {
        navigateBy(1);
      }
    }, AUTO_ROTATION_MS);

    return () => window.clearTimeout(timeoutId);
  }, [canRotate, currentIndex, isAnimating, isPaused, isPointerActive, navigateBy]);

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
    isPointerActiveRef.current = true;
    setIsPointerActive(true);
  };

  const handlePointerEnd = () => {
    isPointerActiveRef.current = false;
    setIsPointerActive(false);
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
    }
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
      data-studio-animating={isAnimating && isTransitionReady ? "true" : "false"}
      onClick={handleClick}
      onKeyDown={canRotate ? handleKeyDown : undefined}
      onPointerCancel={canRotate ? handlePointerEnd : undefined}
      onPointerDown={canRotate ? handlePointerDown : undefined}
      onPointerUp={canRotate ? handlePointerEnd : undefined}
      role={canRotate ? "button" : undefined}
      tabIndex={canRotate ? 0 : undefined}
    >
      <div aria-live="off" className="mat-studio-gallery__track">
        {images.map((image, imageIndex) => {
          const isCurrentImage = imageIndex === currentIndex;
          const isOutgoingImage = imageIndex === outgoingIndex;
          const isIncomingImage = imageIndex === incomingIndex;
          const targetX =
            isIncomingImage && !isTransitionReady
              ? `${direction * 100}%`
              : isCurrentImage
                ? "0%"
                : `${(isOutgoingImage ? -direction : direction) * 100}%`;

          return (
            <m.div
              animate={{ x: targetX }}
              aria-hidden={canRotate && !isCurrentImage ? true : undefined}
              className="mat-studio-gallery__slide"
              data-studio-image-index={imageIndex}
              drag={canRotate && isCurrentImage && !isAnimating ? "x" : false}
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.18}
              dragMomentum={false}
              initial={false}
              key={image.src}
              onAnimationComplete={
                isCurrentImage && isTransitionReady ? finishAnimation : undefined
              }
              onDragEnd={isCurrentImage ? handleDragEnd : undefined}
              style={{
                pointerEvents: isCurrentImage && !isAnimating ? "auto" : "none",
                touchAction: "pan-y",
                zIndex: isCurrentImage ? 2 : isOutgoingImage ? 1 : 0,
              }}
              transition={
                isIncomingImage && !isTransitionReady
                  ? { duration: 0 }
                  : getMatMotionTransition(
                      MAT_MOTION_DURATION.gallery,
                      prefersReducedMotion,
                      MAT_MOTION_EASE.slide,
                    )
              }
            >
              <Image
                alt={canRotate ? "" : image.alt}
                className="mat-cropped-image mat-studio__photo"
                fill
                loading="eager"
                quality={90}
                sizes="(min-width: 1440px) 622px, (min-width: 1024px) calc(48vw - 67px), (min-width: 768px) 720px, calc(100vw - 48px)"
                src={image.src}
              />
            </m.div>
          );
        })}
      </div>
    </div>
  );
}
