'use client';

import { useCountUp } from '@/hooks/useCountUp';

/**
 * A meter, not a pie: one proportion of one whole, so the arc carries the value
 * and the number in the middle states it exactly. No slices, no legend.
 */
export function RadialMeter({
  value,
  max,
  label,
  sublabel,
  color = '#059669',
  size = 168,
}: {
  value: number;
  max: number;
  label: string;
  sublabel?: string;
  color?: string;
  size?: number;
}) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  const shown = useCountUp(pct, 900);

  const stroke = 12;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = (shown / 100) * c;

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90" role="img" aria-label={`${label}: ${pct}%`}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="#E2E8F0"
            strokeWidth={stroke}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${c}`}
            style={{ filter: `drop-shadow(0 0 8px ${color}66)` }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-4xl font-semibold tabular-nums text-ink">{shown}%</span>
          <span className="mt-0.5 text-2xs uppercase tracking-[0.14em] text-ink-faint">{label}</span>
        </div>
      </div>
      {sublabel && <p className="mt-3 text-center text-xs text-ink-muted">{sublabel}</p>}
    </div>
  );
}
