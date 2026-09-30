'use client';

import { Loader2 } from 'lucide-react';
import type { EventStatus } from '@/lib/ag-ui';
import { accentChipStyle, BRAND_INK } from '@/lib/theme';
import { cn } from '@/lib/utils';

type PanelTone = 'default' | 'success' | 'danger';

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
  bodyClassName?: string;
}

const TONE_EDGE: Record<PanelTone, string> = {
  default: '',
  success: 'before:bg-status-success',
  danger: 'before:bg-status-failed',
};

/**
 * The card everything is built from: a solid raised surface, clearly lighter than the canvas.
 * `tone` adds a 3px left edge for state; `accent` colours the eyebrow for module identity.
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
                style={accent ? accentChipStyle(accent) : undefined}
              >
                {icon}
              </span>
            )}
            <div className="min-w-0">
              {eyebrow && (
                <p
                  className="mb-1 text-2xs font-semibold uppercase tracking-[0.14em]"
                  style={{ color: accent ?? BRAND_INK }}
                >
                  {eyebrow}
                </p>
              )}
              {title && (
                <h2 className="truncate text-base font-semibold tracking-tight text-ink">
                  {title}
                </h2>
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

/**
 * Status is never carried by colour alone — every pill renders a dot AND its label, which is
 * what keeps `triggered` (amber) and `failed` (red) separable for red-green colour-blind readers.
 * Classes are written out in full because Tailwind only generates classes it can see literally.
 */
const STATUS_TONES: Record<EventStatus, { label: string; pill: string; dot: string; glow: string }> = {
  success: {
    label: 'Success',
    pill: 'bg-status-success/10 text-status-success ring-status-success/30',
    dot: 'bg-status-success',
    glow: 'shadow-[0_0_10px_-1px_rgba(74,222,128,0.8)]',
  },
  running: {
    label: 'Running',
    pill: 'bg-status-running/10 text-status-running ring-status-running/30',
    dot: 'bg-status-running',
    glow: 'shadow-[0_0_10px_-1px_rgba(96,165,250,0.8)]',
  },
  triggered: {
    label: 'Triggered',
    pill: 'bg-status-triggered/10 text-status-triggered ring-status-triggered/30',
    dot: 'bg-status-triggered',
    glow: 'shadow-[0_0_10px_-1px_rgba(251,191,36,0.8)]',
  },
  waiting: {
    label: 'Waiting',
    pill: 'bg-status-waiting/10 text-status-waiting ring-status-waiting/30',
    dot: 'bg-status-waiting',
    glow: '',
  },
  failed: {
    label: 'Failed',
    pill: 'bg-status-failed/10 text-status-failed ring-status-failed/30',
    dot: 'bg-status-failed',
    glow: 'shadow-[0_0_10px_-1px_rgba(248,113,113,0.8)]',
  },
};

/** Status pill: coloured dot (or spinner) plus label. Used by StatusBadge and ConnectionIndicator. */
export function Pill({
  tone,
  glow,
  spin = false,
  pulse = false,
  large = false,
  children,
}: {
  tone: EventStatus;
  glow: string;
  spin?: boolean;
  pulse?: boolean;
  large?: boolean;
  children: React.ReactNode;
}) {
  const { pill, dot } = STATUS_TONES[tone];
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full font-medium ring-1 ring-inset backdrop-blur',
        large ? 'gap-2 px-3 py-1.5 text-xs' : 'gap-1.5 px-2.5 py-1 text-2xs',
        pill
      )}
    >
      {spin ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
      ) : (
        <span
          className={cn('h-1.5 w-1.5 rounded-full', dot, glow, pulse && 'animate-pulseDot')}
          aria-hidden
        />
      )}
      {children}
    </span>
  );
}

export function StatusBadge({ status, pulse = false }: { status: EventStatus; pulse?: boolean }) {
  const { label, glow } = STATUS_TONES[status];
  return (
    <Pill tone={status} glow={glow} pulse={pulse}>
      {label}
    </Pill>
  );
}
