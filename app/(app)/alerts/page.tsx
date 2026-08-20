'use client';

import { ShieldCheck } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Panel } from '@/components/ui/Panel';
import { EventFeed } from '@/components/events/EventFeed';
import { RadarPulse } from '@/components/illustrations/RadarPulse';
import { useAGUIState } from '@/lib/ag-ui/provider';

export default function AlertsPage() {
  const { events } = useAGUIState();
  const failed = events.filter((e) => e.status === 'failed' || e.type === 'error.occurred');

  return (
    <>
      <PageHeader
        eyebrow="Operations"
        title="Alerts"
        titleFont="font-alerts"
        description="Every failed or errored event in the current window, newest first."
      />

      {failed.length === 0 ? (
        <Panel tone="success" className="animate-rise">
          <div className="flex flex-col items-center gap-2 py-12 text-center">
            <span className="relative mb-1 flex h-16 w-16 items-center justify-center rounded-full ring-1 ring-inset ring-status-success/30">
              <RadarPulse color="#15803D" />
              <span
                aria-hidden
                className="absolute inset-0 animate-pulseDot rounded-full bg-status-success/15 blur-md"
              />
              <ShieldCheck className="relative h-7 w-7 text-status-success" aria-hidden />
            </span>
            <p className="text-lg font-medium text-ink">No active alerts</p>
            <p className="text-sm text-ink-muted">Every stage in the pipeline is healthy.</p>
          </div>
        </Panel>
      ) : (
        <Panel
          className="animate-rise"
          tone="danger"
          flush
          eyebrow="Failures"
          title={`${failed.length} failing event${failed.length === 1 ? '' : 's'}`}
          description="Each row names the agent or webhook that reported it."
          bodyClassName="border-t border-line-soft"
        >
          <EventFeed events={failed} />
        </Panel>
      )}
    </>
  );
}
