'use client';

import { useMemo, useState } from 'react';
import { Check, Search } from 'lucide-react';
import { PageHeader } from '@/components/shell';
import { Panel } from '@/components/ui';
import { JOURNEY_STAGES, useConsultantJourneys, type ConsultantJourney } from '@/lib/api';
import { cn } from '@/lib/utils';

/** Searchable list of consultants; the selected one drives the journey panel. */
function ConsultantList({
  totalCount,
  journeys,
  query,
  onQueryChange,
  activeLeadId,
  onSelect,
}: {
  totalCount: number;
  journeys: ConsultantJourney[];
  query: string;
  onQueryChange: (query: string) => void;
  activeLeadId: string | null;
  onSelect: (leadId: string) => void;
}) {
  return (
    <Panel
      className="animate-rise"
      eyebrow="Consultants"
      title={`${totalCount} in MongoDB`}
      flush
      bodyClassName="border-t border-line-soft"
    >
      <div className="border-b border-line-soft p-2.5">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-faint"
            aria-hidden
          />
          <input
            type="search"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Search consultants…"
            aria-label="Search consultants"
            className="w-full rounded-xl border border-line-soft bg-sunken py-2 pl-9 pr-3 text-xs text-ink placeholder:text-ink-faint focus:border-line focus:outline-none focus:ring-2 focus:ring-brand/25"
          />
        </div>
      </div>

      <div className="max-h-[560px] overflow-y-auto p-2.5">
        {totalCount === 0 ? (
          <p className="px-3 py-8 text-center text-sm text-ink-muted">
            No consultants in MongoDB yet.
          </p>
        ) : journeys.length === 0 ? (
          <p className="px-3 py-8 text-center text-sm text-ink-muted">
            No consultants match “{query.trim()}”.
          </p>
        ) : (
          <ul className="space-y-1">
            {journeys.map(({ leadId }) => {
              const isActive = activeLeadId === leadId;
              return (
                <li key={leadId}>
                  <button
                    onClick={() => onSelect(leadId)}
                    aria-current={isActive ? 'true' : undefined}
                    className={cn(
                      'relative w-full truncate rounded-xl px-3.5 py-2.5 text-left font-mono text-xs transition-all duration-200',
                      isActive
                        ? 'bg-brand/12 font-medium text-ink ring-1 ring-inset ring-line'
                        : 'text-ink-muted hover:bg-raised hover:text-ink'
                    )}
                  >
                    {isActive && (
                      <span
                        aria-hidden
                        className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full bg-brand-gradient shadow-glow-brand"
                      />
                    )}
                    {leadId}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Panel>
  );
}

/** The seven bench-outreach stages as a vertical timeline, reached ones highlighted. */
function JourneyTimeline({ reachedStages }: { reachedStages: Set<string> }) {
  return (
    <ol className="relative space-y-6">
      {JOURNEY_STAGES.map((stage, index) => {
        const reached = reachedStages.has(stage.key);
        const isLast = index === JOURNEY_STAGES.length - 1;
        return (
          <li key={stage.key} className="relative flex gap-4">
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
                <p className={cn('text-sm font-medium', reached ? 'text-ink' : 'text-ink-faint')}>
                  {stage.label}
                </p>
                <p className="mt-0.5 font-mono text-[11px] text-ink-faint">{stage.key}</p>
              </div>
              {reached && (
                <span className="shrink-0 rounded-full bg-status-success/12 px-2.5 py-1 text-[11px] font-semibold text-status-success">
                  Reached
                </span>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export default function LeadJourneyPage() {
  const journeys = useConsultantJourneys();
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const filteredJourneys = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return journeys;
    return journeys.filter(
      ({ leadId, label }) =>
        leadId.toLowerCase().includes(needle) || (label || '').toLowerCase().includes(needle)
    );
  }, [journeys, query]);

  const activeLeadId = selectedLeadId ?? journeys[0]?.leadId ?? null;
  const activeJourney = journeys.find((journey) => journey.leadId === activeLeadId) ?? null;
  const reachedStages = new Set(
    Object.entries(activeJourney?.reached ?? {})
      .filter(([, reached]) => reached)
      .map(([stage]) => stage)
  );
  const completedCount = JOURNEY_STAGES.filter((stage) => reachedStages.has(stage.key)).length;
  const progressPct = Math.round((completedCount / JOURNEY_STAGES.length) * 100);

  return (
    <>
      <PageHeader
        eyebrow="Trace"
        title="Lead journey"
        titleFont="font-journey"
        description="Select a consultant to see how far they have progressed through Loaded → Emailed → Engaged → Researched → Followed up → Qualified → Handed off."
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[300px_1fr]">
        <ConsultantList
          totalCount={journeys.length}
          journeys={filteredJourneys}
          query={query}
          onQueryChange={setQuery}
          activeLeadId={activeLeadId}
          onSelect={setSelectedLeadId}
        />

        <Panel
          className="animate-rise"
          eyebrow="Journey"
          title={activeJourney?.label ?? activeLeadId ?? 'No lead selected'}
          description={
            activeJourney
              ? activeJourney.closed
                ? `Closed as “${activeJourney.stage}”`
                : `${completedCount} of ${JOURNEY_STAGES.length} stages complete`
              : undefined
          }
          actions={
            activeLeadId ? (
              <div className="flex items-center gap-3">
                <div className="h-2 w-32 overflow-hidden rounded-full bg-sunken ring-1 ring-inset ring-line-soft">
                  <div
                    className="h-full rounded-full bg-brand-gradient shadow-glow-brand transition-[width] duration-700 ease-out"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
                <span className="text-sm font-semibold tabular-nums text-ink">{progressPct}%</span>
              </div>
            ) : undefined
          }
        >
          {activeLeadId ? (
            <JourneyTimeline reachedStages={reachedStages} />
          ) : (
            <p className="py-10 text-center text-sm text-ink-muted">
              Pick a consultant on the left to see their journey.
            </p>
          )}
        </Panel>
      </div>
    </>
  );
}
