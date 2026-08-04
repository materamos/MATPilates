"use client";

import { useSyncExternalStore } from "react";

const reducedMotionQuery = "(prefers-reduced-motion: reduce)";
const reducedMotionSubscribers = new Set<() => void>();
let reducedMotionMediaQuery: MediaQueryList | null = null;

function getReducedMotionMediaQuery() {
  reducedMotionMediaQuery ??= window.matchMedia(reducedMotionQuery);
  return reducedMotionMediaQuery;
}

function notifyReducedMotionSubscribers() {
  reducedMotionSubscribers.forEach((callback) => callback());
}

function subscribeToReducedMotion(callback: () => void) {
  const mediaQuery = getReducedMotionMediaQuery();
  reducedMotionSubscribers.add(callback);

  if (reducedMotionSubscribers.size === 1) {
    mediaQuery.addEventListener("change", notifyReducedMotionSubscribers);
  }

  return () => {
    reducedMotionSubscribers.delete(callback);

    if (reducedMotionSubscribers.size === 0) {
      mediaQuery.removeEventListener("change", notifyReducedMotionSubscribers);
    }
  };
}

function getReducedMotionPreference() {
  return getReducedMotionMediaQuery().matches;
}

function getServerReducedMotionPreference() {
  return false;
}

export function useMatReducedMotion() {
  return useSyncExternalStore(
    subscribeToReducedMotion,
    getReducedMotionPreference,
    getServerReducedMotionPreference,
  );
}
