'use client';

import {
  UserPlus,
  ShieldCheck,
  Database,
  Send,
  RefreshCw,
  PhoneOutgoing,
  PhoneCall,
  CheckCircle2,
  type LucideIcon,
} from 'lucide-react';
import { usePipelineCounts } from '@/lib/ag-ui/provider';
import { STAGE_LABELS, type PipelineStage } from '@/lib/ag-ui/types';
import { cn } from '@/lib/utils';

const STAGE_ICON: Partial<Record<PipelineStage, LucideIcon>> = {
  'lead.created': UserPlus,
  'lead.eligibility.checked': ShieldCheck,
  'crm.contact.upserted': Database,
  'email.sent': Send,
  'email.status.synced': RefreshCw,
  'voice.trigger.requested': PhoneOutgoing,
  'voice.completed': PhoneCall,
  'crm.updated': CheckCircle2,
};

/**
 * Animated packets travelling one connector. Rendered only when traffic has
 * actually passed through both ends, so the motion reports something real
 * rather than decorating a dead pipeline.
 */
function Connector({ live }: { live: boolean }) {
  return (
    <div className="relative mx-1 h-px min-w-[28px] flex-1 self-start" style={{ marginTop: 27 }}>
      <div
        className={cn(
          'absolute inset-0 h-px rounded-full transition-colors duration-500',
          live
            ? 'bg-gradient-to-r from-[#4338CA]/50 via-brand/50 to-[#C026D3]/50'
            : 'bg-line'
        )}
      />
      {live && (
        <>
          <span
            aria-hidden
            className="absolute -top-[3px] h-[7px] w-[7px] animate-packet rounded-full bg-brand shadow-[0_0_10px_2px_rgba(124,58,237,0.9)]"
          />
          <span
            aria-hidden
            className="absolute -top-[2px] h-[5px] w-[5px] animate-packet rounded-full bg-[#C026D3] shadow-[0_0_8px_2px_rgba(192,38,212,0.8)]"
            style={{ animationDelay: '1.4s' }}
          />
        </>
      )}
    </div>
  );
}

/**
 * The hero: the pipeline drawn as an actual flow — glowing nodes joined by
 * connectors with lead packets moving along them.
 *
 * Deliberately NOT colour-coded per stage. Eight hues in a row would read as
 * eight unrelated categories; this is one ordered sequence, so order comes from
 * position, and colour is reserved for a single distinction — is this stage
 * carrying traffic or not.
 */
export function EventPipeline() {
  const stages = usePipelineCounts();

  return (
    <div className="overflow-x-auto px-5 pb-6 pt-5">
      {/* Node columns are a fixed width and connectors take the slack, so a
          long stage label can never push a node off the end of the track. */}
      <div className="flex min-w-[1120px] items-start">
        {stages.map(({ stage, count }, idx) => {
          const Icon = STAGE_ICON[stage] ?? CheckCircle2;
          const active = count > 0;
          const nextCount = stages[idx + 1]?.count ?? 0;

          return (
            <div key={stage} className="flex flex-1 items-start">
              <div className="group flex w-[118px] shrink-0 cursor-default flex-col items-center text-center">
                {/* Node */}
                <div className="relative">
                  {active && (
                    <span
                      aria-hidden
                      className="absolute inset-0 animate-pulseDot rounded-full bg-brand-gradient blur-md"
                    />
                  )}
                  <span
                    className={cn(
                      'relative flex h-[54px] w-[54px] items-center justify-center rounded-full border transition-all duration-300 group-hover:scale-110',
                      active
                        ? 'border-transparent bg-brand-gradient text-onBrand shadow-glow-brand'
                        : 'border-line bg-sunken text-ink-faint backdrop-blur group-hover:border-accent-violet/50 group-hover:bg-accent-violet/10 group-hover:text-brand-ink group-hover:shadow-glow-brand'
                    )}
                  >
                    <Icon className="h-[22px] w-[22px]" aria-hidden />
                  </span>
                  {/* Step index */}
                  <span
                    className={cn(
                      'absolute -left-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full border text-[10px] font-semibold tabular-nums',
                      active
                        ? 'border-brand/40 bg-canvas text-brand-ink'
                        : 'border-line bg-canvas text-ink-faint'
                    )}
                  >
                    {idx + 1}
                  </span>
                </div>

                {/* Count */}
                <p
                  className={cn(
                    'mt-2.5 text-xl font-semibold tabular-nums transition-colors',
                    active ? 'text-ink' : 'text-ink-faint'
                  )}
                >
                  {count}
                </p>

                {/* Labels */}
                <p
                  className={cn(
                    'mt-1.5 text-[11px] font-medium leading-tight transition-colors',
                    active ? 'text-ink-secondary' : 'text-ink-faint'
                  )}
                >
                  {STAGE_LABELS[stage]}
                </p>
                <p
                  className="mt-1 w-full truncate font-mono text-[10px] text-ink-faint"
                  title={stage}
                >
                  {stage}
                </p>
              </div>

              {idx < stages.length - 1 && <Connector live={active && nextCount > 0} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}
