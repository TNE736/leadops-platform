'use client';

import { useId, useMemo, useState } from 'react';
import { useCountUp } from '@/hooks/useCountUp';

/**
 * SVG path data for a line through the points ("Mx,y Lx,y …", one decimal place) and the same
 * line closed down to `baseY` as a fillable area. Empty strings for fewer than two points.
 */
export function linePaths(points: ReadonlyArray<readonly [number, number]>, baseY: number) {
  const first = points[0];
  const last = points[points.length - 1];
  if (!first || !last || points.length < 2) return { line: '', area: '' };
  const line = points
    .map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`)
    .join(' ');
  const base = baseY.toFixed(1);
  return { line, area: `${line} L${last[0].toFixed(1)},${base} L${first[0].toFixed(1)},${base} Z` };
}

interface AreaChartProps {
  /** One measure over time, oldest → newest. */
  data: number[];
  /** Seconds each bucket covers, used to label the tooltip. */
  bucketSeconds?: number;
  /** Single hue — this is a magnitude encoding, not a categorical one. */
  color: string;
  height?: number;
  label?: string;
}

const PAD = { top: 10, right: 4, bottom: 20, left: 30 };

/**
 * Throughput over time. One series, so one hue and no legend; the panel title names it.
 * Hovering snaps a crosshair to the nearest bucket and reports its exact value.
 */
export function AreaChart({
  data,
  bucketSeconds = 10,
  color,
  height = 190,
  label = 'events',
}: AreaChartProps) {
  const gradId = useId();
  const [hover, setHover] = useState<number | null>(null);

  const W = 600;
  const H = height;
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const max = Math.max(1, ...data);
  // Round the axis top to something readable rather than the raw max.
  const axisTop = max <= 4 ? 4 : Math.ceil(max / 4) * 4;

  const { line, area, points } = useMemo(() => {
    const step = plotW / Math.max(1, data.length - 1);
    const pts: Array<[number, number]> = data.map((v, i) => [
      PAD.left + i * step,
      PAD.top + plotH - (v / axisTop) * plotH,
    ]);
    return { ...linePaths(pts, PAD.top + plotH), points: data.length < 2 ? [] : pts };
  }, [data, plotW, plotH, axisTop]);

  const ticks = [0, axisTop / 2, axisTop];

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ height }}
        role="img"
        aria-label={`${label} per ${bucketSeconds} seconds over the last ${data.length * bucketSeconds} seconds`}
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const x = ((e.clientX - rect.left) / rect.width) * W;
          const step = plotW / Math.max(1, data.length - 1);
          const idx = Math.round((x - PAD.left) / step);
          setHover(idx >= 0 && idx < data.length ? idx : null);
        }}
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.42" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* Recessive gridlines + value axis. */}
        {ticks.map((t) => {
          const y = PAD.top + plotH - (t / axisTop) * plotH;
          return (
            <g key={t}>
              <line
                x1={PAD.left}
                x2={W - PAD.right}
                y1={y}
                y2={y}
                stroke="#E2E8F0"
                strokeWidth="1"
                strokeDasharray={t === 0 ? '0' : '3 4'}
              />
              <text x={PAD.left - 8} y={y + 4} textAnchor="end" fontSize="10" fill="#64748B">
                {t}
              </text>
            </g>
          );
        })}

        {area && <path d={area} fill={`url(#${gradId})`} />}
        {line && (
          <path
            d={line}
            fill="none"
            stroke={color}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* Crosshair + focused marker. */}
        {hover !== null && points[hover] && (
          <g>
            <line
              x1={points[hover]![0]}
              x2={points[hover]![0]}
              y1={PAD.top}
              y2={PAD.top + plotH}
              stroke="#CBD5E1"
              strokeWidth="1"
            />
            <circle
              cx={points[hover]![0]}
              cy={points[hover]![1]}
              r="5"
              fill={color}
              stroke="#FFFFFF"
              strokeWidth="2.5"
            />
          </g>
        )}

        <text x={PAD.left} y={H - 4} fontSize="10" fill="#64748B">
          −{data.length * bucketSeconds}s
        </text>
        <text x={W - PAD.right} y={H - 4} fontSize="10" fill="#64748B" textAnchor="end">
          now
        </text>
      </svg>

      {hover !== null && (
        <div
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-full rounded-lg border border-line bg-raised px-2.5 py-1.5 text-2xs shadow-pop"
          style={{
            left: `${((points[hover]?.[0] ?? 0) / W) * 100}%`,
            top: `${((points[hover]?.[1] ?? 0) / H) * 100}%`,
          }}
        >
          <span className="font-semibold tabular-nums text-ink">{data[hover]}</span>
          <span className="ml-1 text-ink-muted">{label}</span>
          <span className="ml-1.5 text-ink-faint">
            {(data.length - 1 - hover) * bucketSeconds}s ago
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * A meter, not a pie: one proportion of one whole, so the arc carries the value and the number
 * in the middle states it exactly. No slices, no legend.
 */
export function RadialMeter({
  value,
  max,
  label,
  sublabel,
  color,
  size = 168,
}: {
  value: number;
  max: number;
  label: string;
  sublabel?: string;
  color: string;
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
        <svg
          width={size}
          height={size}
          className="-rotate-90"
          role="img"
          aria-label={`${label}: ${pct}%`}
        >
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
          <span className="mt-0.5 text-2xs uppercase tracking-[0.14em] text-ink-faint">
            {label}
          </span>
        </div>
      </div>
      {sublabel && <p className="mt-3 text-center text-xs text-ink-muted">{sublabel}</p>}
    </div>
  );
}
