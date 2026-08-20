import { cn } from '@/lib/utils';

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  titleFont,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  description?: string;
  actions?: React.ReactNode;
  /** Segment heading typeface, e.g. "font-dashboard" — see tailwind.config.ts. */
  titleFont?: string;
}) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-5 animate-rise">
      <div className="min-w-0">
        {eyebrow && (
          <p className="mb-2 text-2xs font-semibold uppercase tracking-[0.18em] text-brand-ink">
            {eyebrow}
          </p>
        )}
        <h1 className={cn('text-3xl font-semibold tracking-tight text-ink sm:text-4xl', titleFont)}>
          {title}
        </h1>
        {description && (
          <p className="mt-2.5 max-w-3xl text-base leading-relaxed text-ink-muted">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="shrink-0">{actions}</div>}
    </div>
  );
}
