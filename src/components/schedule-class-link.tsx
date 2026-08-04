"use client";

import { type MouseEvent, type ReactNode } from "react";
import { openAnimatedDisclosure } from "@/components/animated-disclosure";
import { useClassScheduleNavigation } from "@/components/class-schedule-navigation";
import type { ClassId, ClassOffering } from "@/lib/site-content";

interface ScheduleClassLinkProps {
  ariaLabel: string;
  children: ReactNode;
  classId: ClassId;
  intensity: ClassOffering["intensity"];
}

export function ScheduleClassLink({
  ariaLabel,
  children,
  classId,
  intensity,
}: ScheduleClassLinkProps) {
  const { clearSelection, selectedClass } = useClassScheduleNavigation();
  const cardId = `clase-${classId}`;
  const href = `#${cardId}`;
  const isSelected = selectedClass?.id === classId;

  const openClassCard = (event: MouseEvent<HTMLAnchorElement>) => {
    const classCard = document.getElementById(cardId);

    if (!(classCard instanceof HTMLDetailsElement)) {
      return;
    }

    const summary = classCard.querySelector("summary");

    if (!(summary instanceof HTMLElement)) {
      return;
    }

    event.preventDefault();
    clearSelection();
    openAnimatedDisclosure(classCard);
    window.history.pushState(null, "", href);

    const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? "auto"
      : "smooth";

    window.requestAnimationFrame(() => {
      summary.scrollIntoView({ behavior, block: "center" });
      summary.focus({ preventScroll: true });
    });
  };

  return (
    <a
      aria-label={ariaLabel}
      className={`mat-schedule__class-link mat-schedule__class-link--${intensity}${isSelected ? " mat-schedule__class-link--selected" : ""}`}
      data-schedule-class={classId}
      data-schedule-selected={isSelected ? "true" : undefined}
      href={href}
      onClick={openClassCard}
    >
      {children}
    </a>
  );
}
