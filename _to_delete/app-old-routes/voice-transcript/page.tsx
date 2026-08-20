'use client';

import { PhoneCall, PhoneOutgoing } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Panel } from '@/components/ui/Panel';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { CallWaveBars } from '@/components/illustrations/CallWaveBars';
import { useAGUIState } from '@/lib/ag-ui/provider';
import type { VoiceCompletedEvent, VoiceTriggerRequestedEvent } from '@/lib/ag-ui/types';
import { formatRelativeTime } from '@/lib/utils';

export default function VoiceTranscriptPage() {
  const { events } = useAGUIState();
  const triggered = events.filter(
    (e): e is VoiceTriggerRequestedEvent => e.type === 'voice.trigger.requested'
  );
  const completed = events.filter((e): e is VoiceCompletedEvent => e.type === 'voice.completed');

  return (
    <>
      <PageHeader
        eyebrow="Voice"
        title="Voice agent calls"
        titleFont="font-voice"
        description="The Gateway triggers the Voice Agent as soon as HubSpot's email_status property syncs to “opened”. Each trigger is shown with the outcome the agent captured."
      />

      {triggered.length === 0 ? (
        <Panel className="animate-rise">
          <div className="flex flex-col items-center gap-2 py-12 text-center">
            <span className="mb-1 flex h-14 w-14 items-center justify-center rounded-full border border-line bg-sunken">
              <PhoneOutgoing className="h-6 w-6 text-ink-faint" aria-hidden />
            </span>
            <p className="text-base font-medium text-ink">No calls triggered yet</p>
            <p className="text-sm text-ink-muted">
              A call is triggered once a lead&rsquo;s email is marked opened in HubSpot.
            </p>
          </div>
        </Panel>
      ) : (
        <div className="stagger grid grid-cols-1 gap-5 xl:grid-cols-2">
          {triggered.map((trigger) => {
            const outcome = completed.find((c) => c.leadId === trigger.leadId);
            return (
              <Panel key={trigger.id} tone={outcome ? 'success' : 'warning'} interactive>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex min-w-0 items-start gap-3.5">
                    <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line bg-sunken">
                      {!outcome && (
                        <span
                          aria-hidden
                          className="absolute inset-0 animate-pulseDot rounded-full bg-status-triggered/25 blur-md"
                        />
                      )}
                      <PhoneCall
                        className={`relative h-5 w-5 ${outcome ? 'text-status-success' : 'text-status-triggered'}`}
                        aria-hidden
                      />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-mono text-sm font-medium text-ink">
                        {trigger.leadId}
                      </p>
                      <p className="mt-1 text-xs text-ink-muted">{trigger.payload.reason}</p>
                    </div>
                  </div>
                  <time
                    dateTime={trigger.timestamp}
                    className="shrink-0 text-[11px] tabular-nums text-ink-faint"
                  >
                    {formatRelativeTime(trigger.timestamp)}
                  </time>
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line-soft bg-sunken px-4 py-3">
                  {outcome ? (
                    <>
                      <div className="min-w-0">
                        <p className="text-2xs font-semibold uppercase tracking-[0.14em] text-ink-faint">
                          Outcome
                        </p>
                        <p className="mt-1 truncate text-base font-medium text-ink">
                          {outcome.payload.outcome}
                        </p>
                      </div>
                      <StatusBadge status="success" />
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-2.5">
                        <CallWaveBars color="#B45309" />
                        <p className="text-sm text-ink-muted">Call in progress…</p>
                      </div>
                      <StatusBadge status="triggered" pulse />
                    </>
                  )}
                </div>
              </Panel>
            );
          })}
        </div>
      )}
    </>
  );
}
