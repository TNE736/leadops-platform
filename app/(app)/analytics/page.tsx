'use client';

import { PageHeader } from '@/components/layout/PageHeader';
import { Panel } from '@/components/ui/Panel';
import { usePipelineCounts } from '@/lib/ag-ui/provider';
import { STAGE_LABELS } from '@/lib/ag-ui/types';

export default function AnalyticsPage() {
  const stages = usePipelineCounts();
  const max = Math.max(1, ...stages.map((s) => s.count));
  const entry = stages[0]?.count ?? 0;

  return (
    <>
      <PageHeader
        eyebrow="Analytics"
        title="Pipeline conversion"
        titleFont="font-analytics"
        description="Event volume at each stage. Every bar measures the same thing, so they share one treatment — length carries the comparison."
      />

      <Panel
        eyebrow="Funnel"
        title="Leads by stage"
        description="Share is measured against lead.created, the pipeline entry point."
        className="animate-rise"
      >
        <ol className="space-y-4">
          {stages.map(({ stage, count }) => {
            const share = entry > 0 ? Math.round((count / entry) * 100) : 0;
            return (
              <li
                key={stage}
                className="group grid grid-cols-[minmax(0,210px)_1fr_auto] items-center gap-5 rounded-xl px-2 py-1.5 transition-colors hover:bg-raised"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">{STAGE_LABELS[stage]}</p>
                  <p className="mt-0.5 truncate font-mono text-[11px] text-ink-faint" title={stage}>
                    {stage}
                  </p>
                </div>

                <div
                  className="h-3 w-full overflow-hidden rounded-full bg-sunken ring-1 ring-inset ring-line-soft"
                  role="img"
                  aria-label={`${STAGE_LABELS[stage]}: ${count} events, ${share}% of entry volume`}
                >
                  <div
                    className="h-full rounded-full bg-brand-gradient shadow-glow-brand transition-[width] duration-700 ease-out"
                    style={{ width: `${(count / max) * 100}%` }}
                  />
                </div>

                <div className="flex w-28 shrink-0 items-baseline justify-end gap-3">
                  <span className="text-lg font-semibold tabular-nums text-ink">{count}</span>
                  <span className="w-11 text-right text-xs tabular-nums text-ink-faint">
                    {entry > 0 ? `${share}%` : '—'}
                  </span>
                </div>
              </li>
            );
          })}
        </ol>

        {entry === 0 && (
          <p className="mt-6 border-t border-line-soft pt-4 text-xs text-ink-faint">
            No events recorded yet — upload a Leads CSV to populate the funnel.
          </p>
        )}
      </Panel>
    </>
  );
}
