'use client';

import type { AGUIEvent } from '@/lib/ag-ui/types';
import { STAGE_LABELS } from '@/lib/ag-ui/types';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { formatRelativeTime } from '@/lib/utils';

export function EventFeed({ events, emptyLabel }: { events: AGUIEvent[]; emptyLabel?: string }) {
  if (events.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-slate-500">
        {emptyLabel ?? 'No events yet — waiting for the first event from the AG-UI Gateway.'}
      </p>
    );
  }

  return (
    <ul className="divide-y divide-border-soft">
      {events.map((evt) => (
        <li key={evt.id} className="flex items-center justify-between gap-4 py-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="truncate font-mono text-xs text-slate-300">{evt.type}</span>
              {evt.leadId && (
                <span className="rounded bg-panel-raised px-1.5 py-0.5 text-[10px] text-slate-500">
                  {evt.leadId}
                </span>
              )}
            </div>
            <p className="mt-0.5 truncate text-xs text-slate-500">{STAGE_LABELS[evt.type]}</p>
          </div>
          <div className="flex shrink-0 items-center gap-4">
            <StatusBadge status={evt.status} pulse={evt.status === 'running'} />
            <span className="w-16 text-right text-[11px] text-slate-500">
              {formatRelativeTime(evt.timestamp)}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}
