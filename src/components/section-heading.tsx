interface SectionHeadingProps {
  eyebrow: string;
  title: string;
  description?: string;
  inverse?: boolean;
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  inverse = false,
}: SectionHeadingProps) {
  const textClassName = inverse
    ? "text-[var(--mat-text-inverse)]"
    : "text-[var(--mat-text-primary)]";

  return (
    <div className={`max-w-2xl ${textClassName}`}>
      <p className="text-xs font-medium tracking-[0.12em] uppercase">{eyebrow}</p>
      <h2 className="mt-4 text-4xl font-semibold leading-[1.1] tracking-[-0.04em] sm:text-5xl">
        {title}
      </h2>
      {description ? (
        <p className="mt-5 max-w-xl text-base leading-7 sm:text-lg">{description}</p>
      ) : null}
    </div>
  );
}
