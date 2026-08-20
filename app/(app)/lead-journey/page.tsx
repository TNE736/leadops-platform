'use client';

import { useMemo, useState } from 'react';
import { Check } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Panel } from '@/components/ui/Panel';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useAGUIState } from '@/lib/ag-ui/provider';
import { PIPELINE_STAGE_ORDER, STAGE_LABELS, SOURCE_LABELS } from '@/lib/ag-ui/types';
import { cn, formatRelativeTime } from '@/lib/utils';

export default function LeadJourneyPage() {
  const { events } = useAGUIState();
  const [selectedLead, setSelectedLead] = useState<string | null>(null);

  const leadIds = useMemo(() => {
    const ids = new Set<string>();
    events.forEach((e) => e.leadId && ids.add(e.leadId));
    return Array.from(ids);
  }, [events]);

  const activeLead = selectedLead ?? leadIds[0] ?? null;
  const leadEvents = events.filter((e) => e.leadId === activeLead);
  const reachedStages = new Set(leadEvents.map((e) => e.type));
  const progress = PIPELINE_STAGE_ORDER.filter((s) => reachedStages.has(s)).length;
  const pct = Math.round((progress / PIPELINE_STAGE_ORDER.length) * 100);

  return (
    <>
      <PageHeader
        eyebrow="Trace"
        title="Lead journey"
        titleFont="font-journey"
        description="Select a lead to see how far it has progressed through CSV → Lead Agents → Email → Voice Agent → CRM."
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[300px_1fr]">
        <Panel
          className="animate-rise"
          eyebrow="Leads"
          title={`${leadIds.length} in the window`}
          flush
          bodyClassName="max-h-[620px] overflow-y-auto border-t border-line-soft p-2.5"
        >
          {leadIds.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-ink-muted">
              Waiting for Leads to arrive…
            </p>
          ) : (
            <ul className="space-y-1">
              {leadIds.map((id) => (
                <li key={id}>
                  <button
                    onClick={() => setSelectedLead(id)}
                    aria-current={activeLead === id ? 'true' : undefined}
                    className={cn(
                      'relative w-full truncate rounded-xl px-3.5 py-2.5 text-left font-mono text-xs transition-all duration-200',
                      activeLead === id
                        ? 'bg-brand/12 font-medium text-ink ring-1 ring-inset ring-line'
                        : 'text-ink-muted hover:bg-raised hover:text-ink'
                    )}
                  >
                    {activeLead === id && (
                      <span
                        aria-hidden
                        className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full bg-brand-gradient shadow-glow-brand"
                      />
                    )}
                    {id}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          className="animate-rise"
          eyebrow="Journey"
          title={activeLead ?? 'No lead selected'}
          description={
            activeLead ? `${progress} of ${PIPELINE_STAGE_ORDER.length} stages complete` : undefined
          }
          actions={
            activeLead ? (
              <div className="flex items-center gap-3">
                <div className="h-2 w-32 overflow-hidden rounded-full bg-sunken ring-1 ring-inset ring-line-soft">
                  <div
                    className="h-full rounded-full bg-brand-gradient shadow-glow-brand transition-[width] duration-700 ease-out"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-sm font-semibold tabular-nums text-ink">{pct}%</span>
              </div>
            ) : undefined
          }
        >
          {!activeLead ? (
            <p className="py-10 text-center text-sm text-ink-muted">
              Pick a lead on the left to see its journey.
            </p>
          ) : (
            <ol className="relative space-y-6">
              {PIPELINE_STAGE_ORDER.map((stage, idx) => {
                const evt = leadEvents.find((e) => e.type === stage);
                const reached = reachedStages.has(stage);
                const isLast = idx === PIPELINE_STAGE_ORDER.length - 1;
                return (
                  <li key={stage} className="relative flex gap-4">
                    {!isLast && (
                      <span
                        aria-hidden
                        className={cn(
                          'absolute left-[13px] top-7 h-[calc(100%+8px)] w-px',
                          reached ? 'bg-brand/40' : 'bg-line'
                        )}
                      />
                    )}
                    <span
                      className={cn(
                        'relative z-10 flex h-[27px] w-[27px] shrink-0 items-center justify-center rounded-full border transition-all',
                        reached
                          ? 'border-transparent bg-brand-gradient text-onBrand shadow-glow-brand'
                          : 'border-line bg-sunken text-ink-faint'
                      )}
                    >
                      {reached ? (
                        <Check className="h-3.5 w-3.5" aria-hidden />
                      ) : (
                        <span className="h-1.5 w-1.5 rounded-full bg-line-strong" aria-hidden />
                      )}
                    </span>

                    <div className="flex min-w-0 flex-1 flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p
                          className={cn(
                            'text-sm font-medium',
                            reached ? 'text-ink' : 'text-ink-faint'
                          )}
                        >
                          {STAGE_LABELS[stage]}
                        </p>
                        <p className="mt-0.5 font-mono text-[11px] text-ink-faint">
                          {stage}
                          {evt && (
                            <>
                              <span className="mx-1.5">·</span>
                              {SOURCE_LABELS[evt.source]}
                            </>
                          )}
                        </p>
                      </div>
                      {evt && (
                        <div className="flex shrink-0 items-center gap-3">
                          <StatusBadge status={evt.status} pulse={evt.status === 'running'} />
                          <time
                            dateTime={evt.timestamp}
                            className="text-[11px] tabular-nums text-ink-faint"
                          >
                            {formatRelativeTime(evt.timestamp)}
                          </time>
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </Panel>
      </div>
    </>
  );
}
