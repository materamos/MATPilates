import { classCatalog, type ClassId } from "@/lib/site-content";

export type WeekdayId =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday";

export type ScheduleTime = `${number}${number}:${number}${number}`;

export interface WeeklyScheduleSlot {
  readonly classId: ClassId;
  readonly startTime: ScheduleTime;
}

export interface WeeklyScheduleDay {
  readonly id: WeekdayId;
  readonly label: string;
  readonly slots: readonly WeeklyScheduleSlot[];
}

export interface WeeklySchedule {
  readonly days: readonly WeeklyScheduleDay[];
  readonly effectiveFrom: string;
  readonly status: "published";
  readonly timezone: "America/Argentina/Buenos_Aires";
}

export interface ClassScheduleDay {
  readonly id: WeekdayId;
  readonly label: string;
  readonly shortLabel: string;
  readonly times: readonly ScheduleTime[];
}

const scheduleDayInitials: Record<WeekdayId, string> = {
  monday: "L",
  tuesday: "M",
  wednesday: "X",
  thursday: "J",
  friday: "V",
  saturday: "S",
};

export const weeklySchedule = {
  status: "published",
  timezone: "America/Argentina/Buenos_Aires",
  effectiveFrom: "2026-08-03",
  days: [
    {
      id: "monday",
      label: "Lunes",
      slots: [
        { startTime: "08:00", classId: "mat-pilates" },
        { startTime: "09:00", classId: "stretch-glow" },
        { startTime: "10:00", classId: "hot-pilates-stretch" },
        { startTime: "11:00", classId: "hot-sweat" },
        { startTime: "12:00", classId: "hot-pilates-stretch" },
        { startTime: "13:00", classId: "hot-pilates-stretch" },
        { startTime: "14:00", classId: "stretching" },
        { startTime: "15:00", classId: "abs-on" },
        { startTime: "16:00", classId: "sculpt-flow" },
        { startTime: "17:00", classId: "abs-on" },
        { startTime: "18:00", classId: "hot-booty" },
        { startTime: "19:00", classId: "hot-mat-burn" },
      ],
    },
    {
      id: "tuesday",
      label: "Martes",
      slots: [
        { startTime: "08:00", classId: "mat-pilates" },
        { startTime: "09:00", classId: "mat-pilates" },
        { startTime: "10:00", classId: "stretching" },
        { startTime: "11:00", classId: "hot-pilates-stretch" },
        { startTime: "15:00", classId: "hot-sculpt" },
        { startTime: "16:00", classId: "sculpt-flow" },
        { startTime: "17:00", classId: "abs-on" },
        { startTime: "18:00", classId: "hot-booty" },
        { startTime: "19:00", classId: "hot-mat-burn" },
      ],
    },
    {
      id: "wednesday",
      label: "Miércoles",
      slots: [
        { startTime: "08:00", classId: "mat-pilates" },
        { startTime: "09:00", classId: "stretch-glow" },
        { startTime: "10:00", classId: "hot-sculpt" },
        { startTime: "11:00", classId: "hot-sweat" },
        { startTime: "15:00", classId: "hot-sweat" },
        { startTime: "16:00", classId: "abs-on" },
        { startTime: "17:00", classId: "sculpt-flow" },
        { startTime: "18:00", classId: "hot-booty" },
        { startTime: "19:00", classId: "hot-mat-burn" },
      ],
    },
    {
      id: "thursday",
      label: "Jueves",
      slots: [
        { startTime: "08:00", classId: "mat-pilates" },
        { startTime: "09:00", classId: "stretching" },
        { startTime: "10:00", classId: "stretch-glow" },
        { startTime: "11:00", classId: "hot-pilates-stretch" },
        { startTime: "15:00", classId: "hot-sculpt" },
        { startTime: "16:00", classId: "sculpt-flow" },
        { startTime: "17:00", classId: "abs-on" },
        { startTime: "18:00", classId: "hot-booty" },
        { startTime: "19:00", classId: "hot-sculpt" },
      ],
    },
    {
      id: "friday",
      label: "Viernes",
      slots: [
        { startTime: "08:00", classId: "mat-pilates" },
        { startTime: "09:00", classId: "stretch-glow" },
        { startTime: "10:00", classId: "stretching" },
        { startTime: "11:00", classId: "hot-pilates-stretch" },
        { startTime: "15:00", classId: "abs-on" },
        { startTime: "16:00", classId: "mat-pilates" },
        { startTime: "17:00", classId: "sculpt-flow" },
        { startTime: "18:00", classId: "hot-mat-burn" },
        { startTime: "19:00", classId: "hot-sweat" },
      ],
    },
    {
      id: "saturday",
      label: "Sábado",
      slots: [
        { startTime: "08:00", classId: "stretch-glow" },
        { startTime: "09:00", classId: "stretch-glow" },
        { startTime: "10:00", classId: "hot-sculpt" },
        { startTime: "11:00", classId: "hot-mat-burn" },
      ],
    },
  ],
} as const satisfies WeeklySchedule;

const classOfferingById = new Map(
  classCatalog.map((classOffering) => [classOffering.id, classOffering]),
);

export function getScheduledClassOffering(classId: ClassId) {
  const classOffering = classOfferingById.get(classId);

  if (!classOffering) {
    throw new Error(`Unknown class ID in weekly schedule: ${classId}`);
  }

  return classOffering;
}

export function getClassScheduleDays(classId: ClassId): readonly ClassScheduleDay[] {
  return weeklySchedule.days.flatMap((day) => {
    const times = day.slots
      .filter((slot) => slot.classId === classId)
      .map((slot) => slot.startTime);

    return times.length > 0
      ? [
          {
            id: day.id,
            label: day.label,
            shortLabel: scheduleDayInitials[day.id],
            times,
          },
        ]
      : [];
  });
}

export function formatScheduleTime(time: ScheduleTime) {
  return time.replace(":", ".");
}

export const weeklyScheduleStartTimes = Array.from(
  new Set(weeklySchedule.days.flatMap((day) => day.slots.map((slot) => slot.startTime))),
).sort();
