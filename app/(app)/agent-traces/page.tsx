'use client';

import { PageHeader } from '@/components/layout/PageHeader';
import { Panel } from '@/components/ui/Panel';
import { EventFeed } from '@/components/events/EventFeed';
import { useAGUIState } from '@/lib/ag-ui/provider';
import type { AGUIEvent, EventSource } from '@/lib/ag-ui/types';

interface TraceSource {
  source: EventSource;
  name: string;
  tasks: string[];
}

const AGENTS: TraceSource[] = [
  {
    source: 'lead-profile-agent',
    name: 'Lead Profile Agent',
    tasks: ['Build profile', 'Score & eligibility', 'Upsert to HubSpot'],
  },
  {
    source: 'email-agent',
    name: 'Email Agent',
    tasks: ['Read profile via MCP', 'Send via Mailgun', 'Write status to HubSpot'],
  },
  {
    source: 'voice-agent',
    name: 'Voice Agent',
    tasks: ['Place call', 'Natural conversation', 'Write outcome to HubSpot'],
  },
  {
    source: 'agent-gateway',
    name: 'AG-UI Gateway',
    tasks: ['Relay agent events', 'Receive webhooks', 'Notify next agent'],
  },
];

const WEBHOOKS: TraceSource[] = [
  {
    source: 'mailgun-webhook',
    name: 'Mailgun webhook',
    tasks: ['Delivery & open events', 'Writes to HubSpot via MCP'],
  },
  {
    source: 'hubspot-webhook',
    name: 'HubSpot webhook',
    tasks: ['Property change events', 'Notifies the Gateway'],
  },
];

function TracePanel({ trace, events }: { trace: TraceSource; events: AGUIEvent[] }) {
  const own = events.filter((e) => e.source === trace.source);
  return (
    <Panel
      className="animate-rise"
      eyebrow={trace.tasks.join(' · ')}
      title={trace.name}
      flush
      actions={
        <span className="rounded-full border border-line-soft bg-sunken px-2.5 py-1 text-2xs font-semibold tabular-nums text-ink-secondary">
          {own.length}
        </span>
      }
      bodyClassName="max-h-[340px] overflow-y-auto border-t border-line-soft"
    >
      <EventFeed events={own} emptyLabel="No activity from this source yet." showSource={false} />
    </Panel>
  );
}

export default function AgentTracesPage() {
  const { events } = useAGUIState();

  return (
    <>
      <PageHeader
        eyebrow="Observability"
        title="Agent & webhook activity"
        titleFont="font-traces"
        description="Every action taken by the Lead Profile, Email and Voice agents, plus the two webhook sources that feed HubSpot's state back into this stream."
      />

      <h2 className="mb-3.5 text-2xs font-semibold uppercase tracking-[0.16em] text-ink-faint">
        Agents
      </h2>
      <div className="stagger grid grid-cols-1 gap-5 xl:grid-cols-2">
        {AGENTS.map((agent) => (
          <TracePanel key={agent.source} trace={agent} events={events} />
        ))}
      </div>

      <h2 className="mb-3.5 mt-9 text-2xs font-semibold uppercase tracking-[0.16em] text-ink-faint">
        Webhook sources
      </h2>
      <div className="stagger grid grid-cols-1 gap-5 xl:grid-cols-2">
        {WEBHOOKS.map((wh) => (
          <TracePanel key={wh.source} trace={wh} events={events} />
        ))}
      </div>
    </>
  );
}
