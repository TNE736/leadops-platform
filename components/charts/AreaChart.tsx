'use client';

import { useId, useMemo, useState } from 'react';

interface AreaChartProps {
  /** One measure over time, oldest → newest. */
  data: number[];
  /** Seconds each bucket covers, used to label the tooltip. */
  bucketSeconds?: number;
  /** Single hue — this is a magnitude encoding, not a categorical one. */
  color?: string;
  height?: number;
  label?: string;
}

const PAD = { top: 10, right: 4, bottom: 20, left: 30 };

/**
 * Throughput over time.
 *
 * One series, so one hue and no legend — the panel title names it. The gradient
 * fill is decoration under a single line, not a second encoding. Hovering snaps
 * a crosshair to the nearest bucket and reports its exact value, so the chart
 * never has to label every point.
 */
export function AreaChart({
  data,
  bucketSeconds = 10,
  color = '#7C3AED',
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

  const { linePath, areaPath, points } = useMemo(() => {
    if (data.length < 2) return { linePath: '', areaPath: '', points: [] as Array<[number, number]> };
    const step = plotW / (data.length - 1);
    const pts: Array<[number, number]> = data.map((v, i) => [
      PAD.left + i * step,
      PAD.top + plotH - (v / axisTop) * plotH,
    ]);
    const line = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
    const area = `${line} L${pts[pts.length - 1]![0].toFixed(1)},${(PAD.top + plotH).toFixed(1)} L${pts[0]![0].toFixed(1)},${(PAD.top + plotH).toFixed(1)} Z`;
    return { linePath: line, areaPath: area, points: pts };
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

        {areaPath && <path d={areaPath} fill={`url(#${gradId})`} />}
        {linePath && (
          <path
            d={linePath}
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
