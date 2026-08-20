'use client';

import { CheckCircle2, AlertTriangle, Webhook } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Panel } from '@/components/ui/Panel';
import { useAGUIState } from '@/lib/ag-ui/provider';
import type { EventSource } from '@/lib/ag-ui/types';
import { formatRelativeTime } from '@/lib/utils';

const TOUCHPOINTS: Array<{ source: EventSource; name: string; note: string }> = [
  { source: 'lead-profile-agent', name: 'Lead Profile Agent → HubSpot', note: 'Contact upsert via MCP' },
  { source: 'email-agent', name: 'Email Agent → HubSpot', note: 'Reads profile, writes send status via MCP' },
  { source: 'voice-agent', name: 'Voice Agent → HubSpot', note: 'Writes call outcome via MCP' },
  { source: 'mailgun-webhook', name: 'Mailgun → HubSpot', note: 'Delivery/open events written via MCP' },
  { source: 'hubspot-webhook', name: 'HubSpot → Gateway', note: 'Property-change webhook relayed live' },
];

/** Threshold, in minutes, past which a touchpoint with no recent event reads as stale rather than idle. */
const STALE_AFTER_MIN = 5;

export default function IntegrationsPage() {
  const { events } = useAGUIState();

  return (
    <>
      <PageHeader
        eyebrow="Integrations"
        title="HubSpot sync health"
        description="HubSpot CRM is the system of record every agent reads and writes via MCP. This is a health strip for each of those touchpoints, plus the two webhooks that feed status back into this app."
      />

      <div className="space-y-3">
        {TOUCHPOINTS.map((tp) => {
          const last = events.find((e) => e.source === tp.source);
          const minutesSince = last
            ? (Date.now() - new Date(last.timestamp).getTime()) / 60000
            : null;
          const stale = minutesSince !== null && minutesSince > STALE_AFTER_MIN;
          const failed = last?.status === 'failed';

          return (
            <Panel
              key={tp.source}
              accent={failed ? 'orange' : stale ? 'default' : 'green'}
              className="flex items-center justify-between gap-4"
            >
              <div className="flex items-center gap-3">
                {failed ? (
                  <AlertTriangle className="h-5 w-5 text-status-failed" />
                ) : (
                  <CheckCircle2
                    className={`h-5 w-5 ${stale || !last ? 'text-slate-600' : 'text-status-success'}`}
                  />
                )}
                <div>
                  <p className="text-sm font-medium text-slate-200">{tp.name}</p>
                  <p className="text-xs text-slate-500">{tp.note}</p>
                </div>
              </div>
              <div className="text-right text-xs">
                {last ? (
                  <>
                    <p className={stale ? 'text-status-waiting' : 'text-slate-400'}>
                      Last event {formatRelativeTime(last.timestamp)}
                    </p>
                    <p className="font-mono text-[10px] text-slate-600">{last.type}</p>
                  </>
                ) : (
                  <p className="text-slate-600">No events yet</p>
                )}
              </div>
            </Panel>
          );
        })}
      </div>

      <Panel eyebrow="Reconciliation" title="Why this page exists" accent="blue" className="mt-6">
        <div className="flex gap-3">
          <Webhook className="h-5 w-5 shrink-0 text-brand-blue" />
          <p className="text-sm text-slate-400">
            The Mailgun → HubSpot → Gateway path is two webhook hops deep — the weakest link
            in the whole pipeline, since a dropped webhook fails silently rather than erroring. If a
            touchpoint above goes stale while leads are actively moving through the funnel, that&rsquo;s
            the signal a reconciliation job should be polling HubSpot directly to catch.
          </p>
        </div>
      </Panel>
    </>
  );
}
