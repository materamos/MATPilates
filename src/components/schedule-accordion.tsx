"use client";

import { useEffect } from "react";
import { openAnimatedDisclosure } from "@/components/animated-disclosure";

interface ScheduleAccordionProps {
  timezone: string;
}

function getOpenDayId(timezone: string) {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "long",
  })
    .format(new Date())
    .toLowerCase();

  return weekday === "sunday" ? "monday" : weekday;
}

export function ScheduleAccordion({ timezone }: ScheduleAccordionProps) {
  useEffect(() => {
    const mobileSchedule = document
      .getElementById("horarios")
      ?.querySelector<HTMLElement>(".mat-schedule__mobile");
    const openDay = mobileSchedule?.querySelector<HTMLDetailsElement>(
      `details[data-schedule-day="${getOpenDayId(timezone)}"]`,
    );

    if (openDay) {
      openAnimatedDisclosure(openDay);
    }
  }, [timezone]);

  return null;
}
