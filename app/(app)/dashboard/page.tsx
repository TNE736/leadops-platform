'use client';

import { useMemo } from 'react';
import {
  Users,
  UserCheck,
  BadgeCheck,
  AlertTriangle,
  Activity,
  Gauge,
  Cpu,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Panel } from '@/components/ui/Panel';
import { StatCard } from '@/components/dashboard/StatCard';
import { EventFeed } from '@/components/events/EventFeed';
import { AreaChart } from '@/components/charts/AreaChart';
import { RadialMeter } from '@/components/charts/RadialMeter';
import { useAGUIState } from '@/lib/ag-ui/provider';
import { useConsultantMetrics } from '@/hooks/useConsultantMetrics';
import { SOURCE_LABELS, type AGUIEvent, type EventSource } from '@/lib/ag-ui/types';
import { formatRelativeTime } from '@/lib/utils';

const BUCKETS = 18;
const BUCKET_MS = 10_000;

/** Buckets events into fixed time slices so the charts show real throughput. */
function buildSeries(events: AGUIEvent[], match: (e: AGUIEvent) => boolean): number[] {
  const now = Date.now();
  const series = new Array(BUCKETS).fill(0);
  for (const evt of events) {
    if (!match(evt)) continue;
    const age = now - new Date(evt.timestamp).getTime();
    const idx = BUCKETS - 1 - Math.floor(age / BUCKET_MS);
    if (idx >= 0 && idx < BUCKETS) series[idx] += 1;
  }
  return series;
}

/** Each worker owns one accent hue — identity, consistent across the app. */
const WORKERS: Array<{ source: EventSource; accent: string }> = [
  { source: 'lead-profile-agent', accent: '#7C3AED' },
  { source: 'email-agent', accent: '#C026D3' },
  { source: 'voice-agent', accent: '#059669' },
  { source: 'agent-gateway', accent: '#4338CA' },
  { source: 'mailgun-webhook', accent: '#E11D48' },
];

export default function DashboardPage() {
  const { events, activeLeads } = useAGUIState();
  const failed = events.filter((e) => e.status === 'failed').length;

  // Real totals from MongoDB (every consultant in the system, not just this
  // session's live events). The throughput chart, feed and worker load below
  // stay purely live — this only backs the top KPIs and the conversion ring.
  const { metrics } = useConsultantMetrics();

  const series = useMemo(
    () => ({
      all: buildSeries(events, () => true),
      crm: buildSeries(events, (e) => e.type === 'crm.contact.upserted'),
      done: buildSeries(events, (e) => e.type === 'crm.updated'),
      failed: buildSeries(events, (e) => e.status === 'failed'),
    }),
    [events]
  );

  const lastMinute = series.all.slice(-6).reduce((a, b) => a + b, 0);

  // Prefer the MongoDB totals; fall back to live-stream counts until they load.
  const consultants = metrics?.consultants ?? activeLeads;
  const decisionMakers = metrics?.decisionMakers ?? 0;
  const qualified = metrics?.qualified ?? 0;

  const workerRows = useMemo(
    () =>
      WORKERS.map((w) => {
        const own = events.filter((e) => e.source === w.source);
        return { ...w, count: own.length, last: own[0] };
      }),
    [events]
  );
  const busiest = Math.max(1, ...workerRows.map((w) => w.count));

  return (
    <>
      <PageHeader
        eyebrow="Mission Control"
        title="Pipeline overview"
        titleFont="font-dashboard"
        description="Every consultant moving through CSV ingestion, MongoDB, and the outreach agents — live."
      />

      {/* KPI row */}
      <div className="stagger grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Consultants"
          value={consultants}
          hint="In MongoDB"
          icon={Users}
          accent="#7C3AED"
          series={series.all}
          delta={`${lastMinute} events/min`}
        />
        <StatCard
          label="Decision makers"
          value={decisionMakers}
          hint="Approved for outreach"
          icon={UserCheck}
          accent="#4338CA"
          series={series.crm}
        />
        <StatCard
          label="Qualified"
          value={qualified}
          hint="Qualified or handed off"
          icon={BadgeCheck}
          accent="#059669"
          series={series.done}
        />
        <StatCard
          label="Failed events"
          value={failed}
          hint={failed > 0 ? 'Needs attention' : 'All stages healthy'}
          icon={AlertTriangle}
          accent={failed > 0 ? '#DC2626' : '#B45309'}
          series={series.failed}
        />
      </div>

      {/* Throughput + conversion */}
      <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-3">
        <Panel
          className="animate-rise xl:col-span-2"
          eyebrow="Throughput"
          title="Events per 10 seconds"
          description="All sources combined, over the last three minutes. Hover for an exact count."
          accent="#4338CA"
          icon={<Activity className="h-[18px] w-[18px]" />}
        >
          <AreaChart data={series.all} bucketSeconds={BUCKET_MS / 1000} color="#4338CA" height={200} />
        </Panel>

        <Panel
          className="animate-rise"
          eyebrow="Conversion"
          title="Reached qualification"
          accent="#059669"
          icon={<Gauge className="h-[18px] w-[18px]" />}
        >
          <div className="flex flex-col items-center py-2">
            <RadialMeter
              value={qualified}
              max={Math.max(1, consultants)}
              label="qualified"
              color="#059669"
              sublabel={`${qualified} of ${consultants} consultants reached qualification`}
            />
          </div>
        </Panel>
      </div>

      {/* Feed + workers */}
      <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-3">
        <Panel
          className="animate-rise xl:col-span-2"
          eyebrow="Stream"
          title="Recent activity"
          description="Newest first, across every agent and webhook."
          accent="#4338CA"
          icon={<Activity className="h-[18px] w-[18px]" />}
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
          accent="#7C3AED"
          icon={<Cpu className="h-[18px] w-[18px]" />}
        >
          <ul className="space-y-3.5">
            {workerRows.map((w) => (
              <li key={w.source}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span
                      aria-hidden
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: w.accent, boxShadow: `0 0 8px ${w.accent}` }}
                    />
                    <span className="truncate text-sm text-ink">{SOURCE_LABELS[w.source]}</span>
                  </div>
                  <span className="shrink-0 text-sm font-semibold tabular-nums text-ink">
                    {w.count}
                  </span>
                </div>
                <div className="mt-1.5 flex items-center gap-3">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-sunken">
                    <div
                      className="h-full rounded-full transition-[width] duration-700 ease-out"
                      style={{
                        width: `${(w.count / busiest) * 100}%`,
                        backgroundColor: w.accent,
                      }}
                    />
                  </div>
                  <span className="w-16 shrink-0 text-right text-[11px] tabular-nums text-ink-faint">
                    {w.last ? formatRelativeTime(w.last.timestamp) : '—'}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </>
  );
}
