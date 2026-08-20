'use client';

import { UploadCloud, Database, Send, PhoneCall, CheckCircle2, type LucideIcon } from 'lucide-react';

const STEPS: Array<{ icon: LucideIcon; title: string; desc: string; gradient: string }> = [
  {
    icon: UploadCloud,
    title: 'CSV upload',
    desc: 'Leads parsed & validated',
    gradient: 'linear-gradient(135deg,#4338CA,#6D28D9)',
  },
  {
    icon: Database,
    title: 'HubSpot CRM',
    desc: 'Scored Leads upserted via MCP',
    gradient: 'linear-gradient(135deg,#7C3AED,#A855F7)',
  },
  {
    icon: Send,
    title: 'Email agent',
    desc: 'Outreach sent via Mailgun',
    gradient: 'linear-gradient(135deg,#A855F7,#C026D3)',
  },
  {
    icon: PhoneCall,
    title: 'Voice agent',
    desc: 'Call placed on engagement',
    gradient: 'linear-gradient(135deg,#C026D3,#E879F9)',
  },
  {
    icon: CheckCircle2,
    title: 'CRM updated',
    desc: 'Outcome written back',
    gradient: 'linear-gradient(135deg,#6D28D9,#4338CA)',
  },
];

// One shared 6.4s cycle (see popIn/growIn in tailwind.config.ts) — each step
// pops in after the last, the connector above it grows to meet it, then the
// whole thing holds, fades, and loops. Not a dot sliding along a static line.
const NODE_DELAYS = [0, 1.05, 2.1, 3.15, 4.2];
const CONNECTOR_DELAYS = [0.6, 1.65, 2.7, 3.75];

/**
 * "The pipeline, live" — the hero's visual explanation of what LeadOps does,
 * shown as the actual five hops a lead makes, revealed one at a time.
 */
export function PipelineDiagram() {
  return (
    <div
      className="relative h-full rounded-2xl border border-line p-7"
      style={{
        background:
          'radial-gradient(circle at 15% 15%, rgba(67,56,202,0.08), transparent 55%), radial-gradient(circle at 85% 85%, rgba(192,38,212,0.08), transparent 55%), #FFFFFF',
      }}
    >
      <p className="mb-5 text-2xs font-semibold uppercase tracking-[0.14em] text-ink-faint">
        The pipeline, live
      </p>
      <div className="flex flex-col">
        {STEPS.map((step, i) => {
          const Icon = step.icon;
          return (
            <div key={step.title}>
              {i > 0 && (
                <div
                  className="ml-[22px] h-[24px] w-0.5 origin-top animate-growIn opacity-0"
                  style={{ background: '#E7E3F1', animationDelay: `${CONNECTOR_DELAYS[i - 1]}s` }}
                />
              )}
              <div
                className="flex items-center gap-3.5 py-1 animate-popIn opacity-0"
                style={{ animationDelay: `${NODE_DELAYS[i]}s` }}
              >
                <span
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white shadow-[0_8px_18px_-8px_rgba(0,0,0,0.4)]"
                  style={{ background: step.gradient }}
                >
                  <Icon className="h-[19px] w-[19px]" />
                </span>
                <span className="min-w-0">
                  <b className="block truncate text-sm font-bold text-ink">{step.title}</b>
                  <span className="mt-0.5 block truncate text-xs text-ink-faint">{step.desc}</span>
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
