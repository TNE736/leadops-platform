'use client';

import { PageHeader } from '@/components/layout/PageHeader';
import { Panel } from '@/components/ui/Panel';
import { usePipelineCounts } from '@/lib/ag-ui/provider';

export default function AnalyticsPage() {
  const stages = usePipelineCounts();
  const max = Math.max(1, ...stages.map((s) => s.count));

  return (
    <>
      <PageHeader
        eyebrow="Analytics"
        title="Pipeline conversion"
        description="Volume at each stage of the pipeline, sourced from the Stream Processor's aggregated event counts."
      />

      <Panel eyebrow="Funnel" title="Leads by stage" accent="blue">
        <div className="space-y-3">
          {stages.map(({ stage, count }) => (
            <div key={stage} className="flex items-center gap-3">
              <span className="w-36 shrink-0 font-mono text-[11px] text-slate-400">{stage}</span>
              <div className="h-3 flex-1 overflow-hidden rounded-full bg-panel-raised">
                <div
                  className="h-full rounded-full bg-brand-gradient transition-all"
                  style={{ width: `${(count / max) * 100}%` }}
                />
              </div>
              <span className="w-8 shrink-0 text-right text-xs tabular-nums text-slate-300">
                {count}
              </span>
            </div>
          ))}
        </div>
      </Panel>
    </>
  );
}
