'use client';

import { useId } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCountUp } from '@/hooks/useCountUp';

/**
 * Builds line + fill paths for the tile's sparkline. One measure, one hue —
 * the shape carries the trend, the big number carries the value.
 */
function sparkPaths(series: number[], w: number, h: number) {
  if (series.length < 2) return { line: '', area: '' };
  const max = Math.max(1, ...series);
  const step = w / (series.length - 1);
  const pts = series.map((v, i) => [i * step, h - (v / max) * (h - 3) - 1.5] as const);
  const line = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const area = `${line} L${w},${h} L0,${h} Z`;
  return { line, area };
}

/**
 * A KPI tile: a coloured icon chip for identity, one big rolling number, and a
 * sparkline for recent shape. The accent is module identity — status colour is
 * used only where the number itself reports state.
 */
export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  accent = '#7C3AED',
  series,
  delta,
}: {
  label: string;
  value: number;
  hint?: string;
  icon?: LucideIcon;
  accent?: string;
  series?: number[];
  /** Optional trend note, e.g. "+3 in the last minute". */
  delta?: string;
}) {
  const gradId = useId();
  const shown = useCountUp(value);
  const { line, area } = series ? sparkPaths(series, 120, 40) : { line: '', area: '' };

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-line bg-card p-5 shadow-card transition-all duration-300 hover:-translate-y-1 hover:border-line-strong hover:bg-raised hover:shadow-pop">
      {/* Accent bloom, tinted to this tile's hue. */}
      <span
        aria-hidden
        className="pointer-events-none absolute -right-14 -top-14 h-36 w-36 rounded-full opacity-20 blur-3xl transition-opacity duration-500 group-hover:opacity-40"
        style={{ backgroundColor: accent }}
      />

      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          {Icon && (
            <span
              className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl"
              style={{
                backgroundColor: `${accent}1F`,
                color: accent,
                boxShadow: `inset 0 0 0 1px ${accent}38`,
              }}
            >
              <Icon className="h-5 w-5" aria-hidden />
            </span>
          )}
          <p className="truncate text-2xs font-semibold uppercase tracking-[0.16em] text-ink-faint">
            {label}
          </p>
          <p className="mt-1.5 text-4xl font-semibold tracking-tight tabular-nums text-ink">
            {shown}
          </p>
        </div>

        {line && (
          <svg viewBox="0 0 120 40" preserveAspectRatio="none" className="h-12 w-28 shrink-0" aria-hidden>
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={accent} stopOpacity="0.45" />
                <stop offset="100%" stopColor={accent} stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={area} fill={`url(#${gradId})`} />
            <path
              d={line}
              fill="none"
              stroke={accent}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        )}
      </div>

      {(hint || delta) && (
        <div className="relative mt-3 flex flex-wrap items-center gap-x-2 gap-y-1">
          {delta && (
            <span
              className="rounded-full px-2 py-0.5 text-2xs font-medium"
              style={{ backgroundColor: `${accent}1F`, color: accent }}
            >
              {delta}
            </span>
          )}
          {hint && <span className={cn('text-xs text-ink-muted')}>{hint}</span>}
        </div>
      )}
    </div>
  );
}
