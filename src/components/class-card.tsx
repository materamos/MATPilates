import type { ClassOffering } from "@/lib/site-content";

interface ClassCardProps {
  classOffering: ClassOffering;
}

const environmentLabels: Record<ClassOffering["environment"], string> = {
  hot: "Con calor",
  "room-temperature": "Sin calor",
};

export function ClassCard({ classOffering }: ClassCardProps) {
  return (
    <details className="mat-class-card">
      <summary className="mat-class-card__summary">
        <span className="mat-class-card__summary-copy">
          <span className="mat-label mat-class-card__environment">
            {environmentLabels[classOffering.environment]}
          </span>
          <h3 className="mat-h3 mat-class-card__name">{classOffering.name}</h3>
          <span className="mat-body-small mat-class-card__tagline">
            {classOffering.tagline}
          </span>
        </span>
        <span aria-hidden="true" className="mat-class-card__indicator" />
      </summary>
      <div className="mat-class-card__details">
        <p className="mat-body-small">{classOffering.description}</p>
      </div>
    </details>
  );
}
