'use client';

import type { AGUIEvent } from '@/lib/ag-ui/types';
import { STAGE_LABELS, SOURCE_LABELS } from '@/lib/ag-ui/types';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { formatRelativeTime, cn } from '@/lib/utils';

export function EventFeed({
  events,
  emptyLabel,
  showSource = true,
  className,
}: {
  events: AGUIEvent[];
  emptyLabel?: string;
  showSource?: boolean;
  className?: string;
}) {
  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-1.5 px-5 py-14 text-center">
        <span
          aria-hidden
          className="mb-2 h-10 w-10 rounded-full border border-line bg-sunken shadow-[inset_0_0_18px_-6px_rgba(124,58,237,0.6)]"
        />
        <p className="text-sm text-ink-muted">{emptyLabel ?? 'No events yet.'}</p>
        <p className="text-xs text-ink-faint">
          Events appear here the moment the stream delivers them.
        </p>
      </div>
    );
  }

  return (
    <ul className={cn('divide-y divide-line-soft', className)}>
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
              {showSource && (
                <>
                  <span className="mx-1.5 text-ink-faint">·</span>
                  <span className="text-ink-faint">{SOURCE_LABELS[evt.source]}</span>
                </>
              )}
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
