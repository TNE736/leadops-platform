'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, Radio, Search } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Panel } from '@/components/ui/Panel';
import { useAGUIState } from '@/lib/ag-ui/provider';
import { LEAD_JOURNEY } from '@/lib/ag-ui/types';
import { cn } from '@/lib/utils';

const MILESTONES = LEAD_JOURNEY.filter((s) => s.kind === 'milestone');

/** One HubSpot lead and how far it has progressed (from GET /leads/hubspot). */
interface HubspotLead {
  leadId: string;
  label: string;
  reached: Record<string, boolean>;
}

export default function LeadJourneyPage() {
  // Re-fetch on load and whenever a change arrives over the live stream.
  const { lastEventAt } = useAGUIState();
  const [leads, setLeads] = useState<HubspotLead[]>([]);
  const [selectedLead, setSelectedLead] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    const url = `${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'}/leads/hubspot`;
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

  // A milestone is reached when HubSpot says so; a relay hop lights up once the
  // milestone immediately before it in the sequence is reached.
  const isReached = (idx: number): boolean => {
    const stage = LEAD_JOURNEY[idx]!;
    if (stage.kind === 'milestone') return !!stage.event && reachedStages.has(stage.event);
    for (let i = idx - 1; i >= 0; i--) {
      const prev = LEAD_JOURNEY[i]!;
      if (prev.kind === 'milestone') return !!prev.event && reachedStages.has(prev.event);
    }
    return false;
  };

  const progress = MILESTONES.filter((s) => s.event && reachedStages.has(s.event)).length;
  const pct = Math.round((progress / MILESTONES.length) * 100);

  return (
    <>
      <PageHeader
        eyebrow="Trace"
        title="Lead journey"
        titleFont="font-journey"
        description="Select a lead to see how far it has progressed through Blog Summary → Gateway → Research Agent → Lead Context → Gateway → Email Agent → Gateway → Voice Agent."
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[300px_1fr]">
        <Panel
          className="animate-rise"
          eyebrow="Leads"
          title={`${leadIds.length} in HubSpot`}
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
                placeholder="Search leads…"
                aria-label="Search leads"
                className="w-full rounded-xl border border-line-soft bg-sunken py-2 pl-9 pr-3 text-xs text-ink placeholder:text-ink-faint focus:border-line focus:outline-none focus:ring-2 focus:ring-brand/25"
              />
            </div>
          </div>

          <div className="max-h-[560px] overflow-y-auto p-2.5">
            {leadIds.length === 0 ? (
              <p className="px-3 py-8 text-center text-sm text-ink-muted">
                No leads in HubSpot yet.
              </p>
            ) : filtered.length === 0 ? (
              <p className="px-3 py-8 text-center text-sm text-ink-muted">
                No leads match “{query.trim()}”.
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
          description={activeLead ? `${progress} of ${MILESTONES.length} stages complete` : undefined}
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
              {LEAD_JOURNEY.map((stage, idx) => {
                const reached = isReached(idx);
                const isLast = idx === LEAD_JOURNEY.length - 1;
                const relay = stage.kind === 'relay';
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
                        'relative z-10 flex shrink-0 items-center justify-center rounded-full border transition-all',
                        relay ? 'h-[21px] w-[21px]' : 'h-[27px] w-[27px]',
                        reached
                          ? relay
                            ? 'border-dashed border-brand/50 bg-brand/10 text-brand'
                            : 'border-transparent bg-brand-gradient text-onBrand shadow-glow-brand'
                          : relay
                            ? 'border-dashed border-line-strong bg-sunken text-ink-faint'
                            : 'border-line bg-sunken text-ink-faint'
                      )}
                    >
                      {relay ? (
                        <Radio className="h-3 w-3" aria-hidden />
                      ) : reached ? (
                        <Check className="h-3.5 w-3.5" aria-hidden />
                      ) : (
                        <span className="h-1.5 w-1.5 rounded-full bg-line-strong" aria-hidden />
                      )}
                    </span>

                    <div className="flex min-w-0 flex-1 flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p
                          className={cn(
                            relay ? 'text-[13px] font-medium' : 'text-sm font-medium',
                            reached ? (relay ? 'text-ink-muted' : 'text-ink') : 'text-ink-faint'
                          )}
                        >
                          {stage.label}
                        </p>
                        <p className="mt-0.5 font-mono text-[11px] text-ink-faint">
                          {relay ? 'gateway.relay' : stage.event}
                        </p>
                      </div>
                      {reached && !relay && (
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
