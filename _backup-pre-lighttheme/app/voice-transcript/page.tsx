'use client';

import { PhoneCall } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Panel } from '@/components/ui/Panel';
import { StatusBadge } from '@/components/ui/StatusBadge';
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
        eyebrow="Voice Transcript"
        title="Voice Agent calls"
        description="The Gateway triggers the Voice Agent as soon as HubSpot's email_status property syncs to “opened”. Shown here: each trigger and the outcome the agent captured."
      />

      <div className="space-y-4">
        {triggered.length === 0 && (
          <Panel>
            <p className="text-sm text-slate-500">No calls triggered yet.</p>
          </Panel>
        )}
        {triggered.map((trigger) => {
          const outcome = completed.find((c) => c.leadId === trigger.leadId);
          return (
            <Panel key={trigger.id} accent={outcome ? 'green' : 'orange'}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <PhoneCall className="mt-0.5 h-5 w-5 text-status-triggered" />
                  <div>
                    <p className="font-mono text-xs text-slate-200">{trigger.leadId}</p>
                    <p className="text-xs text-slate-500">{trigger.payload.reason}</p>
                  </div>
                </div>
                <span className="text-[11px] text-slate-500">
                  {formatRelativeTime(trigger.timestamp)}
                </span>
              </div>

              <div className="mt-4 rounded-lg border border-border-soft bg-panel-raised p-3">
                {outcome ? (
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-slate-200">{outcome.payload.outcome}</p>
                    <StatusBadge status="success" />
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-slate-500">Call in progress…</p>
                    <StatusBadge status="triggered" pulse />
                  </div>
                )}
              </div>
            </Panel>
          );
        })}
      </div>
    </>
  );
}
