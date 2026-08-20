'use client';

import { useState } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Panel } from '@/components/ui/Panel';
import { EventFeed } from '@/components/events/EventFeed';
import { useAGUIState } from '@/lib/ag-ui/provider';
import { PIPELINE_STAGE_ORDER, type PipelineStage } from '@/lib/ag-ui/types';
import { cn } from '@/lib/utils';

const ALL = 'all';
type Filter = PipelineStage | typeof ALL;

export default function EventTimelinePage() {
  const { events } = useAGUIState();
  const [filter, setFilter] = useState<Filter>(ALL);

  const filtered = filter === ALL ? events : events.filter((e) => e.type === filter);
  const countFor = (f: Filter) =>
    f === ALL ? events.length : events.filter((e) => e.type === f).length;

  const chips: Filter[] = [ALL, ...PIPELINE_STAGE_ORDER];

  return (
    <>
      <PageHeader
        eyebrow="Stream"
        title="Event timeline"
        titleFont="font-timeline"
        description="Every event relayed by the AG-UI Gateway, newest first."
      />

      {/* Filters in one row above the log. */}
      <div className="mb-5 flex flex-wrap gap-2">
        {chips.map((chip) => {
          const active = filter === chip;
          const count = countFor(chip);
          return (
            <button
              key={chip}
              onClick={() => setFilter(chip)}
              aria-pressed={active}
              className={cn(
                'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 font-mono text-[11px] transition-all duration-200',
                active
                  ? 'border-transparent bg-brand-gradient font-semibold text-onBrand shadow-glow-brand'
                  : 'border-line-soft bg-sunken text-ink-muted hover:border-line-strong hover:text-ink'
              )}
            >
              {chip}
              <span className={cn('tabular-nums', active ? 'text-onBrand/70' : 'text-ink-faint')}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <Panel
        className="animate-rise"
        eyebrow="Log"
        title={filter === ALL ? 'All events' : filter}
        description={`${filtered.length} event${filtered.length === 1 ? '' : 's'} in the current window`}
        flush
        bodyClassName="border-t border-line-soft"
      >
        <EventFeed
          events={filtered}
          emptyLabel={
            filter === ALL ? 'No events yet.' : `No ${filter} events in the current window.`
          }
        />
      </Panel>
    </>
  );
}
