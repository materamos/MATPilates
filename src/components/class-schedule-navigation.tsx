"use client";

import { AnimatePresence, m } from "motion/react";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { openAnimatedDisclosure } from "@/components/animated-disclosure";
import {
  getMatMotionTransition,
  MAT_MOTION_DISTANCE,
  MAT_MOTION_DURATION,
} from "@/components/ui/motion-tokens";
import { useMatReducedMotion } from "@/components/ui/use-mat-reduced-motion";
import type { ClassId } from "@/lib/site-content";

interface SelectedScheduleClass {
  readonly id: ClassId;
  readonly name: string;
}

interface ClassScheduleNavigationValue {
  readonly clearSelection: () => void;
  readonly selectedClass: SelectedScheduleClass | null;
  readonly showSchedule: (classId: ClassId, className: string) => void;
}

const ClassScheduleNavigationContext = createContext<ClassScheduleNavigationValue | null>(null);
const scheduleFocusTimeout = 1000;

function findVisibleScheduleLink(classId: ClassId) {
  const schedule = document.getElementById("horarios");

  if (!schedule) {
    return null;
  }

  const scheduleView = schedule.querySelector<HTMLElement>(
    window.matchMedia("(min-width: 1024px)").matches
      ? ".mat-schedule__desktop"
      : ".mat-schedule__mobile",
  );

  return (
    Array.from(
      scheduleView?.querySelectorAll<HTMLAnchorElement>("[data-schedule-class]") ?? [],
    ).find((link) => link.dataset.scheduleClass === classId) ?? null
  );
}

function moveToSchedule(classId: ClassId) {
  window.history.pushState(null, "", "#horarios");

  window.requestAnimationFrame(() => {
    const target = findVisibleScheduleLink(classId);

    if (!target) {
      return;
    }

    const dayDisclosure = target.closest<HTMLDetailsElement>(".mat-schedule-day");

    const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? "auto"
      : "smooth";

    if (dayDisclosure) {
      openAnimatedDisclosure(dayDisclosure);
    }

    const focusDeadline = performance.now() + scheduleFocusTimeout;
    let scrolledTarget: HTMLAnchorElement | null = null;
    const focusWhenInteractive = () => {
      const currentTarget = findVisibleScheduleLink(classId);
      const currentDisclosure = currentTarget?.closest<HTMLDetailsElement>(".mat-schedule-day");
      const currentExpansion = currentTarget?.closest<HTMLElement>(
        ".mat-disclosure__expansion",
      );
      const isInteractive =
        currentTarget?.isConnected &&
        (!currentDisclosure || currentDisclosure.open) &&
        !currentExpansion?.inert &&
        currentTarget.getClientRects().length > 0;

      if (currentTarget && isInteractive) {
        if (scrolledTarget !== currentTarget) {
          currentTarget.scrollIntoView({ behavior, block: "center" });
          scrolledTarget = currentTarget;
        }

        currentTarget.focus({ preventScroll: true });

        if (document.activeElement === currentTarget) {
          return;
        }
      }

      if (performance.now() < focusDeadline) {
        window.requestAnimationFrame(focusWhenInteractive);
      }
    };

    window.requestAnimationFrame(focusWhenInteractive);
  });
}

export function ClassScheduleNavigationProvider({ children }: { children: ReactNode }) {
  const [selectedClass, setSelectedClass] = useState<SelectedScheduleClass | null>(null);

  useEffect(() => {
    const clearSelectionOutsideSchedule = () => {
      if (window.location.hash !== "#horarios") {
        setSelectedClass(null);
      }
    };

    window.addEventListener("hashchange", clearSelectionOutsideSchedule);
    window.addEventListener("popstate", clearSelectionOutsideSchedule);

    return () => {
      window.removeEventListener("hashchange", clearSelectionOutsideSchedule);
      window.removeEventListener("popstate", clearSelectionOutsideSchedule);
    };
  }, []);

  useEffect(() => {
    if (selectedClass) {
      moveToSchedule(selectedClass.id);
    }
  }, [selectedClass]);

  const clearSelection = useCallback(() => {
    setSelectedClass(null);
  }, []);

  const showSchedule = useCallback((classId: ClassId, className: string) => {
    setSelectedClass({ id: classId, name: className });
  }, []);

  const value = useMemo(
    () => ({ clearSelection, selectedClass, showSchedule }),
    [clearSelection, selectedClass, showSchedule],
  );

  return (
    <ClassScheduleNavigationContext.Provider value={value}>
      {children}
    </ClassScheduleNavigationContext.Provider>
  );
}

export function ScheduleSelectionStatus({
  clearLabel,
  selectionPrefix,
}: {
  clearLabel: string;
  selectionPrefix: string;
}) {
  const { clearSelection, selectedClass } = useClassScheduleNavigation();
  const prefersReducedMotion = useMatReducedMotion();

  const clearAndFocusHeading = () => {
    clearSelection();

    window.requestAnimationFrame(() => {
      document.querySelector<HTMLElement>("#horarios h2")?.focus({ preventScroll: true });
    });
  };

  return (
    <>
      <span aria-atomic="true" aria-live="polite" className="sr-only">
        {selectedClass ? `${selectionPrefix} ${selectedClass.name}` : ""}
      </span>
      <AnimatePresence initial={false}>
        {selectedClass ? (
          <m.div
            animate={{ opacity: 1, y: 0 }}
            className="mat-schedule-selection"
            exit={{ opacity: 0, y: -MAT_MOTION_DISTANCE.selection }}
            initial={{ opacity: 0, y: -MAT_MOTION_DISTANCE.selection }}
            key="schedule-selection"
            transition={getMatMotionTransition(
              MAT_MOTION_DURATION.fast,
              prefersReducedMotion,
            )}
          >
            <p className="mat-body-small">
              {selectionPrefix} <strong>{selectedClass.name}</strong>
            </p>
            <button
              className="mat-text-button mat-schedule-selection__clear"
              onClick={clearAndFocusHeading}
              type="button"
            >
              {clearLabel}
            </button>
          </m.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}

export function useClassScheduleNavigation() {
  const context = useContext(ClassScheduleNavigationContext);

  if (!context) {
    throw new Error("Class schedule navigation must be used within its provider.");
  }

  return context;
}
