import { ScheduleAccordion } from "@/components/schedule-accordion";
import { ScheduleClassLink } from "@/components/schedule-class-link";
import {
  getScheduledClassOffering,
  type ScheduleTime,
  type WeeklySchedule,
  weeklyScheduleStartTimes,
} from "@/lib/schedule-content";

interface ScheduleSectionProps {
  content: {
    eyebrow: string;
    title: string;
  };
  schedule: WeeklySchedule;
}

function formatScheduleTime(time: ScheduleTime) {
  return time.replace(":", ".");
}

function ScheduleClassName({
  classId,
  day,
  time,
}: {
  classId: Parameters<typeof getScheduledClassOffering>[0];
  day: string;
  time: ScheduleTime;
}) {
  const classOffering = getScheduledClassOffering(classId);
  const isHot = classOffering.environment === "hot";

  return (
    <ScheduleClassLink
      ariaLabel={`Ver detalles de ${classOffering.name}, ${day} a las ${time}${isHot ? ", clase con calor" : ""}`}
      classId={classId}
    >
      <span>{classOffering.name}</span>
      {isHot ? <span aria-hidden="true" className="mat-schedule__class-fire" /> : null}
    </ScheduleClassLink>
  );
}

export function ScheduleSection({ content, schedule }: ScheduleSectionProps) {
  return (
    <section className="mat-schedule mat-scroll-target" id="horarios">
      <div className="mat-section-heading mat-schedule__heading">
        <div className="mat-section-heading__title">
          <p className="mat-label">{content.eyebrow}</p>
          <h2 className="mat-h2" tabIndex={-1}>
            {content.title}
          </h2>
        </div>
      </div>

      <div aria-label="Horarios semanales por día" className="mat-schedule__mobile">
        <ScheduleAccordion timezone={schedule.timezone} />
        {schedule.days.map((day) => (
          <details
            className="mat-schedule-day"
            data-schedule-day={day.id}
            key={day.id}
            name="mat-weekly-schedule"
          >
            <summary className="mat-schedule-day__summary">
              <span className="mat-h3">{day.label}</span>
              <span aria-hidden="true" className="mat-schedule-day__indicator" />
            </summary>
            <ol aria-label={`Clases del ${day.label}`} className="mat-schedule-day__slots">
              {day.slots.map((slot) => (
                <li className="mat-schedule-day__slot" key={`${day.id}-${slot.startTime}`}>
                  <time className="mat-schedule__time" dateTime={slot.startTime}>
                    {formatScheduleTime(slot.startTime)}
                  </time>
                  <ScheduleClassName
                    classId={slot.classId}
                    day={day.label}
                    time={slot.startTime}
                  />
                </li>
              ))}
            </ol>
          </details>
        ))}
      </div>

      <div className="mat-schedule__desktop">
        <table className="mat-schedule-table">
          <caption className="sr-only">Horario semanal de clases de MAT Pilates</caption>
          <colgroup>
            <col className="mat-schedule-table__time-column" />
            {schedule.days.map((day) => (
              <col key={day.id} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th className="mat-schedule-table__corner" scope="col">
                <span className="sr-only">Hora</span>
              </th>
              {schedule.days.map((day) => (
                <th className="mat-schedule-table__day" key={day.id} scope="col">
                  {day.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {weeklyScheduleStartTimes.map((time) => (
              <tr key={time}>
                <th className="mat-schedule-table__time" scope="row">
                  <time dateTime={time}>{formatScheduleTime(time)}</time>
                </th>
                {schedule.days.map((day) => {
                  const slot = day.slots.find((candidate) => candidate.startTime === time);

                  return (
                    <td
                      className={
                        slot
                          ? "mat-schedule-table__slot"
                          : "mat-schedule-table__slot mat-schedule-table__slot--empty"
                      }
                      data-schedule-day={day.id}
                      data-schedule-time={time}
                      key={day.id}
                    >
                      {slot ? (
                        <ScheduleClassName
                          classId={slot.classId}
                          day={day.label}
                          time={slot.startTime}
                        />
                      ) : (
                        <>
                          <span aria-hidden="true">—</span>
                          <span className="sr-only">Sin clase</span>
                        </>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
