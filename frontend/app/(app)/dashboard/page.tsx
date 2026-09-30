'use client';

import { useId, useMemo } from 'react';
import {
  Activity,
  AlertTriangle,
  BadgeCheck,
  Cpu,
  Gauge,
  MailCheck,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { AreaChart, RadialMeter, linePaths } from '@/components/charts';
import { PageHeader } from '@/components/shell';
import { Panel, StatusBadge } from '@/components/ui';
import { useCountUp } from '@/hooks/useCountUp';
import {
  SOURCE_LABELS,
  STAGE_LABELS,
  useAGUIState,
  type AGUIEvent,
  type EventSource,
} from '@/lib/ag-ui';
import { useConsultantMetrics } from '@/lib/api';
import { ACCENT, accentChipStyle } from '@/lib/theme';
import { cn } from '@/lib/utils';

const BUCKET_COUNT = 18;
const BUCKET_MS = 10_000;
const BUCKETS_PER_MINUTE = 60_000 / BUCKET_MS;
const PANEL_ICON_CLASS = 'h-[18px] w-[18px]';

function formatRelativeTime(iso: string): string {
  const seconds = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(iso).toLocaleDateString();
}

/** Counts matching events per fixed time slice (oldest → newest), so the charts show real throughput. */
function buildEventSeries(events: AGUIEvent[], matches: (event: AGUIEvent) => boolean): number[] {
  const now = Date.now();
  const series = new Array<number>(BUCKET_COUNT).fill(0);
  for (const event of events) {
    if (!matches(event)) continue;
    const bucket =
      BUCKET_COUNT - 1 - Math.floor((now - new Date(event.timestamp).getTime()) / BUCKET_MS);
    if (bucket >= 0 && bucket < BUCKET_COUNT) series[bucket]! += 1;
  }
  return series;
}

/**
 * A KPI tile: a coloured icon chip for identity, one big rolling number, and a sparkline for
 * recent shape. The accent is module identity; status colour only where the number reports state.
 */
function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  accent,
  series,
  delta,
}: {
  label: string;
  value: number;
  hint?: string;
  icon?: LucideIcon;
  accent: string;
  series?: number[];
  /** Optional trend note, e.g. "+3 in the last minute". */
  delta?: string;
}) {
  const gradId = useId();
  const shown = useCountUp(value);
  const spark = useMemo(() => {
    if (!series || series.length < 2) return { line: '', area: '' };
    const max = Math.max(1, ...series);
    const step = 120 / (series.length - 1);
    return linePaths(
      series.map((v, i) => [i * step, 40 - (v / max) * 37 - 1.5] as const),
      40
    );
  }, [series]);

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
              style={accentChipStyle(accent, '38')}
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

        {spark.line && (
          <svg
            viewBox="0 0 120 40"
            preserveAspectRatio="none"
            className="h-12 w-28 shrink-0"
            aria-hidden
          >
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={accent} stopOpacity="0.45" />
                <stop offset="100%" stopColor={accent} stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={spark.area} fill={`url(#${gradId})`} />
            <path
              d={spark.line}
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
          {hint && <span className="text-xs text-ink-muted">{hint}</span>}
        </div>
      )}
    </div>
  );
}

/** Live events, newest first, each with its type, lead, source, status and age. */
function EventFeed({ events }: { events: AGUIEvent[] }) {
  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-1.5 px-5 py-14 text-center">
        <span
          aria-hidden
          className="mb-2 h-10 w-10 rounded-full border border-line bg-sunken shadow-[inset_0_0_18px_-6px_rgba(124,58,237,0.6)]"
        />
        <p className="text-sm text-ink-muted">No events yet.</p>
        <p className="text-xs text-ink-faint">
          Events appear here the moment the stream delivers them.
        </p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-line-soft">
      {events.map((evt, idx) => (
        <li
          key={evt.id}
          /* Newest rows slide down into place as they arrive. Keying on the
             event id means React animates only genuinely new entries. */
          className={cn(
            'group relative flex items-center justify-between gap-4 px-5 py-3.5 transition-colors hover:bg-raised',
            idx === 0 && 'animate-slideIn'
          )}
        >
          <span
            aria-hidden
            className="absolute inset-y-0 left-0 w-[2px] scale-y-0 bg-brand-gradient transition-transform duration-300 group-hover:scale-y-100"
          />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <span className="truncate font-mono text-xs font-medium text-ink">{evt.type}</span>
              {evt.leadId && (
                <span className="rounded-md bg-sunken px-1.5 py-0.5 font-mono text-[11px] text-ink-muted ring-1 ring-inset ring-line-soft">
                  {evt.leadId}
                </span>
              )}
            </div>
            <p className="mt-1 truncate text-xs text-ink-muted">
              {STAGE_LABELS[evt.type]}
              <span className="mx-1.5 text-ink-faint">·</span>
              <span className="text-ink-faint">{SOURCE_LABELS[evt.source]}</span>
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3.5">
            <StatusBadge status={evt.status} pulse={evt.status === 'running'} />
            <time
              dateTime={evt.timestamp}
              className="w-16 text-right text-[11px] tabular-nums text-ink-faint"
            >
              {formatRelativeTime(evt.timestamp)}
            </time>
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Each event source owns one accent hue, consistent across the app. */
const SOURCE_ACCENTS: Array<{ source: EventSource; accent: string }> = [
  { source: 'lead-profile-agent', accent: ACCENT.violet },
  { source: 'email-agent', accent: ACCENT.fuchsia },
  { source: 'voice-agent', accent: ACCENT.emerald },
  { source: 'agent-gateway', accent: ACCENT.indigo },
  { source: 'mailgun-webhook', accent: ACCENT.rose },
];

/** Events per source as bars scaled to the busiest source, with the time of each source's latest event. */
function SourceLoadList({ events }: { events: AGUIEvent[] }) {
  const sourceRows = useMemo(
    () =>
      SOURCE_ACCENTS.map((row) => {
        const sourceEvents = events.filter((event) => event.source === row.source);
        return { ...row, count: sourceEvents.length, latest: sourceEvents[0] };
      }),
    [events]
  );
  const maxSourceCount = Math.max(1, ...sourceRows.map((row) => row.count));

  return (
    <ul className="space-y-3.5">
      {sourceRows.map(({ source, accent, count, latest }) => (
        <li key={source}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <span
                aria-hidden
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: accent, boxShadow: `0 0 8px ${accent}` }}
              />
              <span className="truncate text-sm text-ink">{SOURCE_LABELS[source]}</span>
            </div>
            <span className="shrink-0 text-sm font-semibold tabular-nums text-ink">{count}</span>
          </div>
          <div className="mt-1.5 flex items-center gap-3">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-sunken">
              <div
                className="h-full rounded-full transition-[width] duration-700 ease-out"
                style={{ width: `${(count / maxSourceCount) * 100}%`, backgroundColor: accent }}
              />
            </div>
            <span className="w-16 shrink-0 text-right text-[11px] tabular-nums text-ink-faint">
              {latest ? formatRelativeTime(latest.timestamp) : '—'}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}

export default function DashboardPage() {
  const { events, activeLeads } = useAGUIState();
  // Real totals from MongoDB back the top KPIs and the conversion ring; the
  // throughput chart, feed and source load stay purely live.
  const { metrics } = useConsultantMetrics();
  const failedCount = events.filter((event) => event.status === 'failed').length;

  const series = useMemo(
    () => ({
      all: buildEventSeries(events, () => true),
      contactUpserted: buildEventSeries(events, (event) => event.type === 'crm.contact.upserted'),
      crmUpdated: buildEventSeries(events, (event) => event.type === 'crm.updated'),
      failed: buildEventSeries(events, (event) => event.status === 'failed'),
    }),
    [events]
  );
  const eventsLastMinute = series.all
    .slice(-BUCKETS_PER_MINUTE)
    .reduce((sum, count) => sum + count, 0);

  // Prefer the MongoDB totals; fall back to live-stream counts until they load.
  const consultants = metrics?.consultants ?? activeLeads;
  const emailed = metrics?.emailed ?? 0;
  const qualified = metrics?.qualified ?? 0;

  return (
    <>
      <PageHeader
        eyebrow="Mission Control"
        title="Pipeline overview"
        titleFont="font-dashboard"
        description="Every consultant moving through CSV ingestion, MongoDB, and the outreach agents — live."
      />

      <div className="stagger grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Consultants"
          value={consultants}
          hint="In MongoDB"
          icon={Users}
          accent={ACCENT.violet}
          series={series.all}
          delta={`${eventsLastMinute} events/min`}
        />
        <StatCard
          label="Emailed"
          value={emailed}
          hint="Emailed or further along"
          icon={MailCheck}
          accent={ACCENT.indigo}
          series={series.contactUpserted}
        />
        <StatCard
          label="Qualified"
          value={qualified}
          hint="Qualified or handed off"
          icon={BadgeCheck}
          accent={ACCENT.emerald}
          series={series.crmUpdated}
        />
        <StatCard
          label="Failed events"
          value={failedCount}
          hint={failedCount > 0 ? 'Needs attention' : 'All stages healthy'}
          icon={AlertTriangle}
          accent={failedCount > 0 ? ACCENT.red : ACCENT.amber}
          series={series.failed}
        />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-3">
        <Panel
          className="animate-rise xl:col-span-2"
          eyebrow="Throughput"
          title="Events per 10 seconds"
          description="All sources combined, over the last three minutes. Hover for an exact count."
          accent={ACCENT.indigo}
          icon={<Activity className={PANEL_ICON_CLASS} />}
        >
          <AreaChart
            data={series.all}
            bucketSeconds={BUCKET_MS / 1000}
            color={ACCENT.indigo}
            height={200}
          />
        </Panel>

        <Panel
          className="animate-rise"
          eyebrow="Conversion"
          title="Reached qualification"
          accent={ACCENT.emerald}
          icon={<Gauge className={PANEL_ICON_CLASS} />}
        >
          <div className="flex flex-col items-center py-2">
            <RadialMeter
              value={qualified}
              max={Math.max(1, consultants)}
              label="qualified"
              color={ACCENT.emerald}
              sublabel={`${qualified} of ${consultants} consultants reached qualification`}
            />
          </div>
        </Panel>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-3">
        <Panel
          className="animate-rise xl:col-span-2"
          eyebrow="Stream"
          title="Recent activity"
          description="Newest first, across every agent and webhook."
          accent={ACCENT.indigo}
          icon={<Activity className={PANEL_ICON_CLASS} />}
          flush
          bodyClassName="border-t border-line-soft"
        >
          <EventFeed events={events.slice(0, 10)} />
        </Panel>

        <Panel
          className="animate-rise"
          eyebrow="Workers"
          title="Agent & webhook load"
          description="Share of events published by each source."
          accent={ACCENT.violet}
          icon={<Cpu className={PANEL_ICON_CLASS} />}
        >
          <SourceLoadList events={events} />
        </Panel>
      </div>
    </>
  );
}
