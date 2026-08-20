'use client';

import {
  UserPlus,
  ShieldCheck,
  Database,
  Send,
  RefreshCw,
  PhoneCall,
  CheckCircle2,
  ArrowRight,
} from 'lucide-react';
import { usePipelineCounts } from '@/lib/ag-ui/provider';
import { STAGE_LABELS, type PipelineStage } from '@/lib/ag-ui/types';
import { cn } from '@/lib/utils';

const STAGE_ICON: Record<PipelineStage, React.ComponentType<{ className?: string }>> = {
  'lead.created': UserPlus,
  'lead.eligibility.checked': ShieldCheck,
  'crm.contact.upserted': Database,
  'email.sent': Send,
  'email.status.synced': RefreshCw,
  'voice.trigger.requested': PhoneCall,
  'voice.completed': CheckCircle2,
  'crm.updated': CheckCircle2,
  'error.occurred': CheckCircle2,
};

const STAGE_TINT: Record<PipelineStage, string> = {
  'lead.created': 'text-slate-300 border-slate-600 bg-slate-500/10',
  'lead.eligibility.checked': 'text-brand-purple border-brand-purple/40 bg-brand-purple/10',
  'crm.contact.upserted': 'text-status-success border-status-success/40 bg-status-success/10',
  'email.sent': 'text-status-triggered border-status-triggered/40 bg-status-triggered/10',
  'email.status.synced': 'text-status-triggered border-status-triggered/40 bg-status-triggered/10',
  'voice.trigger.requested': 'text-brand-purple border-brand-purple/40 bg-brand-purple/10',
  'voice.completed': 'text-status-success border-status-success/40 bg-status-success/10',
  'crm.updated': 'text-status-success border-status-success/40 bg-status-success/10',
  'error.occurred': 'text-status-failed border-status-failed/40 bg-status-failed/10',
};

/** The horizontal "Event Pipeline" strip: lead.created → … → crm.updated. */
export function EventPipeline() {
  const stages = usePipelineCounts();

  return (
    <div className="flex items-stretch gap-1 overflow-x-auto pb-2">
      {stages.map(({ stage, count }, idx) => {
        const Icon = STAGE_ICON[stage];
        return (
          <div key={stage} className="flex items-center">
            <div
              className={cn(
                'flex w-[150px] flex-col items-center gap-2 rounded-lg border px-3 py-4 text-center',
                STAGE_TINT[stage]
              )}
            >
              <Icon className="h-5 w-5" />
              <div className="text-[10.5px] font-mono text-slate-200">{stage}</div>
              <div className="text-[10px] leading-tight text-slate-400">{STAGE_LABELS[stage]}</div>
              <div className="mt-1 rounded-full bg-panel-raised px-2 py-0.5 text-[11px] font-semibold text-slate-100">
                {count}
              </div>
            </div>
            {idx < stages.length - 1 && (
              <ArrowRight className="mx-1 h-4 w-4 shrink-0 text-slate-600" />
            )}
          </div>
        );
      })}
    </div>
  );
}
