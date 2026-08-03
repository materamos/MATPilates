"use client";

import Image from "next/image";
import { type SyntheticEvent, useEffect, useRef, useState } from "react";
import { getClassWhatsappUrl, landingCtas, type ClassOffering } from "@/lib/site-content";
import { Button } from "./button";

interface ClassCardProps {
  classOffering: ClassOffering;
}

const intensityLabels = {
  low: "Baja",
  moderate: "Moderada",
  high: "Alta",
} as const satisfies Record<ClassOffering["intensity"], string>;

function closeOtherOpenCards(event: SyntheticEvent<HTMLDetailsElement>) {
  const currentCard = event.currentTarget;

  if (!currentCard.open) {
    return;
  }

  currentCard
    .closest(".mat-class-catalog")
    ?.querySelectorAll<HTMLDetailsElement>(".mat-class-card[open]")
    .forEach((card) => {
      if (card !== currentCard) {
        card.open = false;
      }
    });
}

export function ClassCard({ classOffering }: ClassCardProps) {
  const isHot = classOffering.environment === "hot";
  const titleLabel = isHot ? `${classOffering.name}, con calor` : classOffering.name;
  const titleViewportRef = useRef<HTMLSpanElement>(null);
  const titleMeasureRef = useRef<HTMLSpanElement>(null);
  const [isTitleOverflowing, setIsTitleOverflowing] = useState(false);

  useEffect(() => {
    const titleViewport = titleViewportRef.current;
    const titleMeasure = titleMeasureRef.current;

    if (!titleViewport || !titleMeasure) {
      return;
    }

    const updateOverflow = () => {
      setIsTitleOverflowing(titleMeasure.getBoundingClientRect().width > titleViewport.clientWidth);
    };

    const resizeObserver = new ResizeObserver(updateOverflow);
    resizeObserver.observe(titleViewport);
    resizeObserver.observe(titleMeasure);
    updateOverflow();

    return () => resizeObserver.disconnect();
  }, [classOffering.name]);

  return (
    <details
      className="mat-class-card"
      id={`clase-${classOffering.id}`}
      name="mat-class-catalog"
      onToggle={closeOtherOpenCards}
    >
      <summary className="mat-class-card__summary">
        <span className="mat-class-card__summary-copy">
          <h3
            aria-label={isTitleOverflowing ? titleLabel : undefined}
            className="mat-h3 mat-class-card__name"
          >
            <span className="mat-class-card__title-viewport" ref={titleViewportRef}>
              {isTitleOverflowing ? (
                <span aria-hidden="true" className="mat-class-card__title-track">
                  {[0, 1].map((copy) => (
                    <span className="mat-class-card__title-track-item" key={copy}>
                      <span className="mat-class-card__title-content">
                        <span>{classOffering.name}</span>
                        {isHot ? (
                          <Image
                            alt=""
                            className="mat-class-card__title-fire"
                            height={15}
                            src="/icons/hot-class-fire.svg"
                            width={12}
                          />
                        ) : null}
                      </span>
                    </span>
                  ))}
                </span>
              ) : (
                <span className="mat-class-card__title-content">
                  <span>{classOffering.name}</span>
                  {isHot ? (
                    <Image
                      alt="Con calor"
                      className="mat-class-card__title-fire"
                      height={15}
                      src="/icons/hot-class-fire.svg"
                      width={12}
                    />
                  ) : null}
                </span>
              )}
            </span>
            <span aria-hidden="true" className="mat-class-card__title-measurement">
              <span className="mat-class-card__title-measure" ref={titleMeasureRef}>
                <span className="mat-class-card__title-content">
                  <span>{classOffering.name}</span>
                  {isHot ? (
                    <Image
                      alt=""
                      className="mat-class-card__title-fire"
                      height={15}
                      src="/icons/hot-class-fire.svg"
                      width={12}
                    />
                  ) : null}
                </span>
              </span>
            </span>
          </h3>
          <span className="mat-body-small mat-class-card__tagline">
            {classOffering.tagline}
          </span>
          <span
            className={`mat-class-card__intensity mat-class-card__intensity--${classOffering.intensity}`}
          >
            Intensidad {intensityLabels[classOffering.intensity]}
          </span>
        </span>
        <span aria-hidden="true" className="mat-class-card__indicator" />
      </summary>
      <div className="mat-class-card__details">
        <p className="mat-body-small">{classOffering.description}</p>
        <Button
          ariaLabel={`Quiero la experiencia ${classOffering.name}`}
          className="mat-class-card__cta"
          href={getClassWhatsappUrl(classOffering.name)}
          rel="noreferrer"
          target="_blank"
        >
          {landingCtas.selectExperience.label}
        </Button>
      </div>
    </details>
  );
}
