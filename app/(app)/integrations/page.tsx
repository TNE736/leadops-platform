'use client';

import { CheckCircle2, AlertTriangle, Clock, MinusCircle, Info } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Panel } from '@/components/ui/Panel';
import { useAGUIState } from '@/lib/ag-ui/provider';
import type { EventSource } from '@/lib/ag-ui/types';
import { formatRelativeTime } from '@/lib/utils';

const TOUCHPOINTS: Array<{ source: EventSource; name: string; note: string }> = [
  {
    source: 'lead-profile-agent',
    name: 'Lead Profile Agent → HubSpot',
    note: 'Contact upsert via MCP',
  },
  {
    source: 'email-agent',
    name: 'Email Agent → HubSpot',
    note: 'Reads profile, writes send status via MCP',
  },
  { source: 'voice-agent', name: 'Voice Agent → HubSpot', note: 'Writes call outcome via MCP' },
  {
    source: 'mailgun-webhook',
    name: 'Mailgun → HubSpot',
    note: 'Delivery / open events written via MCP',
  },
  {
    source: 'hubspot-webhook',
    name: 'HubSpot → Gateway',
    note: 'Property-change webhook relayed live',
  },
];

/** Minutes past which a touchpoint with no recent event reads as stale rather than idle. */
const STALE_AFTER_MIN = 5;

/** Health is never colour-alone: each state ships an icon and a written label. */
const HEALTH = {
  healthy: {
    label: 'Healthy',
    icon: CheckCircle2,
    text: 'text-status-success',
    wash: 'bg-status-success/10',
    ring: 'ring-status-success/30',
  },
  stale: {
    label: 'Stale',
    icon: Clock,
    text: 'text-status-triggered',
    wash: 'bg-status-triggered/10',
    ring: 'ring-status-triggered/30',
  },
  failed: {
    label: 'Failing',
    icon: AlertTriangle,
    text: 'text-status-failed',
    wash: 'bg-status-failed/10',
    ring: 'ring-status-failed/30',
  },
  idle: {
    label: 'No data',
    icon: MinusCircle,
    text: 'text-status-waiting',
    wash: 'bg-status-waiting/10',
    ring: 'ring-status-waiting/30',
  },
} as const;

export default function IntegrationsPage() {
  const { events } = useAGUIState();

  return (
    <>
      <PageHeader
        eyebrow="Integrations"
        title="HubSpot sync health"
        titleFont="font-integrations"
        description="HubSpot CRM is the system of record every agent reads and writes via MCP. This is a health strip for each of those touchpoints, plus the two webhooks that feed status back into this app."
      />

      <div className="stagger space-y-3">
        {TOUCHPOINTS.map((tp) => {
          const last = events.find((e) => e.source === tp.source);
          const minutesSince = last
            ? (Date.now() - new Date(last.timestamp).getTime()) / 60000
            : null;

          const key = !last
            ? 'idle'
            : last.status === 'failed'
              ? 'failed'
              : minutesSince !== null && minutesSince > STALE_AFTER_MIN
                ? 'stale'
                : 'healthy';
          const health = HEALTH[key];
          const Icon = health.icon;

          return (
            <div
              key={tp.source}
              className="group relative flex flex-wrap items-center justify-between gap-4 overflow-hidden rounded-2xl border border-line bg-sunken px-5 py-4 shadow-card backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 hover:border-line-strong hover:bg-raised hover:shadow-pop"
            >
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0 bg-transparent opacity-60"
              />
              <div className="relative flex min-w-0 items-center gap-4">
                <span
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ring-1 ring-inset ${health.wash} ${health.ring}`}
                >
                  <Icon className={`h-5 w-5 ${health.text}`} aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-base font-medium text-ink">{tp.name}</p>
                  <p className="mt-0.5 truncate text-xs text-ink-muted">{tp.note}</p>
                </div>
              </div>

              <div className="relative flex shrink-0 items-center gap-5">
                <div className="text-right">
                  {last ? (
                    <>
                      <p className="text-sm text-ink-secondary">
                        {formatRelativeTime(last.timestamp)}
                      </p>
                      <p className="mt-0.5 font-mono text-[11px] text-ink-faint">{last.type}</p>
                    </>
                  ) : (
                    <p className="text-sm text-ink-faint">No events yet</p>
                  )}
                </div>
                <span
                  className={`inline-flex w-24 justify-center rounded-full px-2.5 py-1 text-2xs font-medium ring-1 ring-inset ${health.wash} ${health.text} ${health.ring}`}
                >
                  {health.label}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <Panel className="mt-6 animate-rise" tone="info" eyebrow="Context" title="Why this page exists">
        <div className="flex gap-3.5">
          <Info className="mt-0.5 h-5 w-5 shrink-0 text-status-running" aria-hidden />
          <p className="text-sm leading-relaxed text-ink-secondary">
            The Mailgun → HubSpot → Gateway path is two webhook hops deep, which makes it the
            weakest link in the pipeline: a dropped webhook fails silently rather than erroring. If
            a touchpoint above goes stale while Leads are actively moving through the funnel,
            that&rsquo;s the signal a reconciliation job should be polling HubSpot directly to catch.
          </p>
        </div>
      </Panel>
    </>
  );
}
