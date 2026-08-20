'use client';

import { useMemo, useState } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Panel } from '@/components/ui/Panel';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useAGUIState } from '@/lib/ag-ui/provider';
import { PIPELINE_STAGE_ORDER, STAGE_LABELS } from '@/lib/ag-ui/types';
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

  return (
    <>
      <PageHeader
        eyebrow="Lead Journey"
        title="Track a lead through the pipeline"
        description="Select a lead to see how far it has progressed through the CSV → Lead Agents → Email → Voice Agent → CRM flow."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[260px_1fr]">
        <Panel eyebrow="Leads" title={`${leadIds.length} in view`}>
          <ul className="space-y-1">
            {leadIds.length === 0 && (
              <li className="text-sm text-slate-500">Waiting for leads to arrive…</li>
            )}
            {leadIds.map((id) => (
              <li key={id}>
                <button
                  onClick={() => setSelectedLead(id)}
                  className={cn(
                    'w-full rounded-lg px-3 py-2 text-left font-mono text-xs transition-colors',
                    activeLead === id
                      ? 'bg-brand-purple/15 text-slate-100 border border-brand-purple/40'
                      : 'text-slate-400 hover:bg-panel-raised border border-transparent'
                  )}
                >
                  {id}
                </button>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel eyebrow="Journey" title={activeLead ?? 'No lead selected'} accent="purple">
          {!activeLead ? (
            <p className="text-sm text-slate-500">Pick a lead on the left to see its journey.</p>
          ) : (
            <ol className="relative ml-3 space-y-6 border-l border-border pl-6">
              {PIPELINE_STAGE_ORDER.map((stage) => {
                const evt = leadEvents.find((e) => e.type === stage);
                const reached = reachedStages.has(stage);
                return (
                  <li key={stage} className="relative">
                    <span
                      className={cn(
                        'absolute -left-[31px] top-1 h-3 w-3 rounded-full border-2',
                        reached
                          ? 'bg-status-success border-status-success'
                          : 'bg-panel border-border'
                      )}
                    />
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p
                          className={cn(
                            'font-mono text-xs',
                            reached ? 'text-slate-100' : 'text-slate-600'
                          )}
                        >
                          {stage}
                        </p>
                        <p className="text-xs text-slate-500">{STAGE_LABELS[stage]}</p>
                      </div>
                      {evt && (
                        <div className="flex items-center gap-3">
                          <StatusBadge status={evt.status} />
                          <span className="text-[11px] text-slate-500">
                            {formatRelativeTime(evt.timestamp)}
                          </span>
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
