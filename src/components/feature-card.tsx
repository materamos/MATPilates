interface FeatureCardProps {
  description: string;
  number: string;
  title: string;
}

export function FeatureCard({
  description,
  number,
  title,
}: FeatureCardProps) {
  return (
    <article className="flex min-h-56 flex-col rounded-[var(--mat-radius-lg)] bg-[var(--mat-surface-brand)] p-6">
      <p className="text-xs font-medium tracking-[0.12em]">{number}</p>
      <h3 className="mt-5 text-2xl font-medium tracking-[-0.03em]">{title}</h3>
      <p className="mt-auto pt-6 text-sm leading-6">{description}</p>
    </article>
  );
}
