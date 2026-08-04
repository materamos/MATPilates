"use client";

import { type ComponentPropsWithoutRef, useEffect, useRef } from "react";

const closeDisclosureEvent = "mat:close-disclosure";
const openDisclosureEvent = "mat:open-disclosure";
const transitionFallbackBuffer = 50;

interface AnimatedDisclosureProps
  extends Omit<
    ComponentPropsWithoutRef<"details">,
    "name" | "onClick" | "onToggle"
  > {
  group: string;
}

function getExpansion(disclosure: HTMLDetailsElement) {
  return disclosure.querySelector<HTMLElement>(":scope > .mat-disclosure__expansion");
}

function parseTransitionTime(value: string) {
  const numericValue = Number.parseFloat(value);

  if (!Number.isFinite(numericValue)) {
    return 0;
  }

  return value.trim().endsWith("ms") ? numericValue : numericValue * 1000;
}

function getTransitionTotal(element: HTMLElement) {
  const styles = getComputedStyle(element);
  const durations = styles.transitionDuration.split(",").map(parseTransitionTime);
  const delays = styles.transitionDelay.split(",").map(parseTransitionTime);

  return durations.reduce(
    (longest, duration, index) =>
      Math.max(longest, duration + (delays[index % delays.length] ?? 0)),
    0,
  );
}

function requestGroupClose(disclosure: HTMLDetailsElement) {
  const group = disclosure.dataset.disclosureGroup;

  document
    .querySelectorAll<HTMLDetailsElement>("details[data-disclosure-group][open]")
    .forEach((candidate) => {
      if (
        group &&
        candidate !== disclosure &&
        candidate.dataset.disclosureGroup === group &&
        candidate.dataset.closing !== "true"
      ) {
        candidate.dispatchEvent(new Event(closeDisclosureEvent));
      }
    });
}

export function openAnimatedDisclosure(disclosure: HTMLDetailsElement) {
  const openEvent = new Event(openDisclosureEvent, { cancelable: true });

  if (disclosure.dispatchEvent(openEvent)) {
    disclosure.open = true;
  }
}

export function AnimatedDisclosure({
  children,
  group,
  ...detailsProps
}: AnimatedDisclosureProps) {
  const disclosureRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const disclosure = disclosureRef.current;
    const expansion = disclosure ? getExpansion(disclosure) : null;

    if (!disclosure || !expansion) {
      return;
    }

    let clearTransition: (() => void) | null = null;

    const clearClosingResources = () => {
      clearTransition?.();
      clearTransition = null;
    };
    const cancelClose = () => {
      if (disclosure.dataset.closing !== "true") {
        return;
      }

      clearClosingResources();
      delete disclosure.dataset.closing;
      expansion.inert = false;
    };
    const finishClose = () => {
      if (disclosure.dataset.closing !== "true") {
        return;
      }

      clearClosingResources();
      disclosure.open = false;
      delete disclosure.dataset.closing;
      expansion.inert = false;
    };
    const startClose = () => {
      if (!disclosure.open || disclosure.dataset.closing === "true") {
        return;
      }

      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        disclosure.open = false;
        return;
      }

      disclosure.dataset.closing = "true";
      expansion.inert = true;

      const handleTransitionEnd = (event: TransitionEvent) => {
        if (event.target === expansion && event.propertyName === "grid-template-rows") {
          finishClose();
        }
      };
      const fallback = window.setTimeout(
        finishClose,
        getTransitionTotal(expansion) + transitionFallbackBuffer,
      );

      expansion.addEventListener("transitionend", handleTransitionEnd);
      clearTransition = () => {
        window.clearTimeout(fallback);
        expansion.removeEventListener("transitionend", handleTransitionEnd);
      };
    };
    const handleClick = (event: MouseEvent) => {
      const target = event.target;
      const summary = target instanceof Element ? target.closest("summary") : null;

      if (summary?.parentElement !== disclosure || !disclosure.open) {
        return;
      }

      event.preventDefault();
      disclosure.dataset.closing === "true" ? cancelClose() : startClose();
    };
    const handleToggle = () => {
      if (disclosure.open && disclosure.dataset.closing !== "true") {
        requestGroupClose(disclosure);
      }
    };
    const handleOpenRequest = (event: Event) => {
      event.preventDefault();
      cancelClose();
      disclosure.open = true;
      requestGroupClose(disclosure);
    };

    disclosure.addEventListener("click", handleClick);
    disclosure.addEventListener("toggle", handleToggle);
    disclosure.addEventListener(closeDisclosureEvent, startClose);
    disclosure.addEventListener(openDisclosureEvent, handleOpenRequest);

    return () => {
      clearClosingResources();
      disclosure.removeEventListener("click", handleClick);
      disclosure.removeEventListener("toggle", handleToggle);
      disclosure.removeEventListener(closeDisclosureEvent, startClose);
      disclosure.removeEventListener(openDisclosureEvent, handleOpenRequest);
    };
  }, []);

  return (
    <details {...detailsProps} data-disclosure-group={group} ref={disclosureRef}>
      {children}
    </details>
  );
}
