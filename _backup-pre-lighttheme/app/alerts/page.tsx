'use client';

import { AlertTriangle } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Panel } from '@/components/ui/Panel';
import { EventFeed } from '@/components/events/EventFeed';
import { useAGUIState } from '@/lib/ag-ui/provider';

export default function AlertsPage() {
  const { events } = useAGUIState();
  const failed = events.filter((e) => e.status === 'failed' || e.type === 'error.occurred');

  return (
    <>
      <PageHeader
        eyebrow="Alerts"
        title="Failures & errors"
        description="Routed from PagerDuty via the Observability & Infrastructure layer whenever a stage in the pipeline fails."
      />

      {failed.length === 0 ? (
        <Panel accent="green" className="flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-status-success" />
          <p className="text-sm text-slate-300">No active alerts. Every stage is healthy.</p>
        </Panel>
      ) : (
        <Panel accent="orange">
          <EventFeed events={failed} />
        </Panel>
      )}
    </>
  );
}
