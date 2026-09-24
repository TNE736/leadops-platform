'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, Search } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Panel } from '@/components/ui/Panel';
import { useAGUIState } from '@/lib/ag-ui/provider';
import { LEAD_JOURNEY } from '@/lib/ag-ui/types';
import { cn } from '@/lib/utils';

/** One consultant and how far they have progressed (from GET /consultants/journey). */
interface ConsultantJourney {
  leadId: string;
  label: string;
  stage: string;
  closed: boolean;
  reached: Record<string, boolean>;
}

export default function LeadJourneyPage() {
  // Re-fetch on load and whenever a change arrives over the live stream.
  const { lastEventAt } = useAGUIState();
  const [leads, setLeads] = useState<ConsultantJourney[]>([]);
  const [selectedLead, setSelectedLead] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    const url = `${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://127.0.0.1:8000'}/consultants/journey`;
    fetch(url)
      .then((r) => r.json())
      .then((data) => setLeads(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [lastEventAt]);

  const leadIds = leads.map((l) => l.leadId);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return leads;
    return leads.filter(
      (l) =>
        l.leadId.toLowerCase().includes(q) || (l.label || '').toLowerCase().includes(q)
    );
  }, [leads, query]);

  const activeLead = selectedLead ?? leadIds[0] ?? null;
  const active = leads.find((l) => l.leadId === activeLead) ?? null;
  const reachedStages = new Set(
    active ? Object.entries(active.reached).filter(([, v]) => v).map(([k]) => k) : []
  );

  const progress = LEAD_JOURNEY.filter((s) => reachedStages.has(s.key)).length;
  const pct = Math.round((progress / LEAD_JOURNEY.length) * 100);

  return (
    <>
      <PageHeader
        eyebrow="Trace"
        title="Lead journey"
        titleFont="font-journey"
        description="Select a consultant to see how far they have progressed through Loaded → Emailed → Engaged → Researched → Followed up → Qualified → Handed off."
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[300px_1fr]">
        <Panel
          className="animate-rise"
          eyebrow="Consultants"
          title={`${leadIds.length} in MongoDB`}
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
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search consultants…"
                aria-label="Search consultants"
                className="w-full rounded-xl border border-line-soft bg-sunken py-2 pl-9 pr-3 text-xs text-ink placeholder:text-ink-faint focus:border-line focus:outline-none focus:ring-2 focus:ring-brand/25"
              />
            </div>
          </div>

          <div className="max-h-[560px] overflow-y-auto p-2.5">
            {leadIds.length === 0 ? (
              <p className="px-3 py-8 text-center text-sm text-ink-muted">
                No consultants in MongoDB yet.
              </p>
            ) : filtered.length === 0 ? (
              <p className="px-3 py-8 text-center text-sm text-ink-muted">
                No consultants match “{query.trim()}”.
              </p>
            ) : (
              <ul className="space-y-1">
                {filtered.map((lead) => (
                  <li key={lead.leadId}>
                    <button
                      onClick={() => setSelectedLead(lead.leadId)}
                      aria-current={activeLead === lead.leadId ? 'true' : undefined}
                      className={cn(
                        'relative w-full truncate rounded-xl px-3.5 py-2.5 text-left font-mono text-xs transition-all duration-200',
                        activeLead === lead.leadId
                          ? 'bg-brand/12 font-medium text-ink ring-1 ring-inset ring-line'
                          : 'text-ink-muted hover:bg-raised hover:text-ink'
                      )}
                    >
                      {activeLead === lead.leadId && (
                        <span
                          aria-hidden
                          className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full bg-brand-gradient shadow-glow-brand"
                        />
                      )}
                      {lead.leadId}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Panel>

        <Panel
          className="animate-rise"
          eyebrow="Journey"
          title={active?.label ?? activeLead ?? 'No lead selected'}
          description={
            active
              ? active.closed
                ? `Closed as “${active.stage}”`
                : `${progress} of ${LEAD_JOURNEY.length} stages complete`
              : undefined
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
              Pick a consultant on the left to see their journey.
            </p>
          ) : (
            <ol className="relative space-y-6">
              {LEAD_JOURNEY.map((stage, idx) => {
                const reached = reachedStages.has(stage.key);
                const isLast = idx === LEAD_JOURNEY.length - 1;
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
                        <p
                          className={cn(
                            'text-sm font-medium',
                            reached ? 'text-ink' : 'text-ink-faint'
                          )}
                        >
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
          )}
        </Panel>
      </div>
    </>
  );
}
