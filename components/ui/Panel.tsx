import { cn } from '@/lib/utils';

export type PanelTone = 'default' | 'success' | 'warning' | 'danger' | 'info';

interface PanelProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  title?: React.ReactNode;
  eyebrow?: string;
  description?: string;
  actions?: React.ReactNode;
  /** Accent hue for the eyebrow + header icon. Module identity, not state. */
  accent?: string;
  icon?: React.ReactNode;
  tone?: PanelTone;
  flush?: boolean;
  interactive?: boolean;
  bodyClassName?: string;
}

const TONE_EDGE: Record<PanelTone, string> = {
  default: '',
  success: 'before:bg-status-success',
  warning: 'before:bg-status-triggered',
  danger: 'before:bg-status-failed',
  info: 'before:bg-status-running',
};

/**
 * The card everything is built from. A solid raised surface — clearly lighter
 * than the canvas — so a panel always reads as an object, not a tint. `tone`
 * adds a 3px left edge for state; `accent` colours the eyebrow for module
 * identity. The two never overlap.
 */
export function Panel({
  title,
  eyebrow,
  description,
  actions,
  accent,
  icon,
  tone = 'default',
  flush = false,
  interactive = false,
  className,
  bodyClassName,
  children,
  ...props
}: PanelProps) {
  const hasHeader = Boolean(eyebrow || title || description || actions || icon);

  return (
    <section
      className={cn(
        'relative overflow-hidden rounded-2xl border border-line bg-card shadow-card',
        tone !== 'default' &&
          'before:absolute before:inset-y-0 before:left-0 before:z-10 before:w-[3px] before:content-[""]',
        TONE_EDGE[tone],
        interactive &&
          'transition-all duration-300 hover:-translate-y-0.5 hover:border-line-strong hover:bg-raised hover:shadow-pop',
        className
      )}
      {...props}
    >
      {hasHeader && (
        <header
          className={cn(
            'flex items-start justify-between gap-4 px-5 py-4',
            !flush && 'border-b border-line-soft'
          )}
        >
          <div className="flex min-w-0 items-start gap-3">
            {icon && (
              <span
                className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                style={
                  accent
                    ? { backgroundColor: `${accent}1F`, color: accent, boxShadow: `inset 0 0 0 1px ${accent}33` }
                    : undefined
                }
              >
                {icon}
              </span>
            )}
            <div className="min-w-0">
              {eyebrow && (
                <p
                  className="mb-1 text-2xs font-semibold uppercase tracking-[0.14em]"
                  style={{ color: accent ?? '#5B21B6' }}
                >
                  {eyebrow}
                </p>
              )}
              {title && (
                <h2 className="truncate text-base font-semibold tracking-tight text-ink">{title}</h2>
              )}
              {description && (
                <p className="mt-1 max-w-2xl text-sm leading-relaxed text-ink-muted">
                  {description}
                </p>
              )}
            </div>
          </div>
          {actions && <div className="shrink-0">{actions}</div>}
        </header>
      )}
      <div className={cn(!flush && 'px-5 py-4', bodyClassName)}>{children}</div>
    </section>
  );
}
