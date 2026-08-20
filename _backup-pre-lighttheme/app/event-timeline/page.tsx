'use client';

import { useState } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Panel } from '@/components/ui/Panel';
import { EventFeed } from '@/components/events/EventFeed';
import { useAGUIState } from '@/lib/ag-ui/provider';
import { PIPELINE_STAGE_ORDER, type PipelineStage } from '@/lib/ag-ui/types';
import { cn } from '@/lib/utils';

const ALL = 'all';

export default function EventTimelinePage() {
  const { events } = useAGUIState();
  const [filter, setFilter] = useState<PipelineStage | typeof ALL>(ALL);

  const filtered = filter === ALL ? events : events.filter((e) => e.type === filter);

  return (
    <>
      <PageHeader
        eyebrow="Event Timeline"
        title="Full event log"
        description="Every event stored in the Event Store (PostgreSQL) and replayed through the Event Backbone, newest first."
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <button
          onClick={() => setFilter(ALL)}
          className={cn(
            'rounded-full border px-3 py-1 text-xs font-mono',
            filter === ALL
              ? 'border-brand-purple/50 bg-brand-purple/15 text-slate-100'
              : 'border-border text-slate-400 hover:text-slate-200'
          )}
        >
          all
        </button>
        {PIPELINE_STAGE_ORDER.map((stage) => (
          <button
            key={stage}
            onClick={() => setFilter(stage)}
            className={cn(
              'rounded-full border px-3 py-1 text-xs font-mono',
              filter === stage
                ? 'border-brand-purple/50 bg-brand-purple/15 text-slate-100'
                : 'border-border text-slate-400 hover:text-slate-200'
            )}
          >
            {stage}
          </button>
        ))}
      </div>

      <Panel>
        <EventFeed events={filtered} />
      </Panel>
    </>
  );
}
