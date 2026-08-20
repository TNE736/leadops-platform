'use client';

import { PageHeader } from '@/components/layout/PageHeader';
import { Panel } from '@/components/ui/Panel';
import { EventFeed } from '@/components/events/EventFeed';
import { useAGUIState } from '@/lib/ag-ui/provider';
import type { EventSource } from '@/lib/ag-ui/types';

const AGENTS: Array<{ source: EventSource; name: string; tasks: string[] }> = [
  { source: 'lead-profile-agent', name: 'Lead Profile Agent', tasks: ['Build profile', 'Score & eligibility', 'Upsert to HubSpot'] },
  { source: 'email-agent', name: 'Email Agent', tasks: ['Read profile via MCP', 'Send via Mailgun', 'Write status to HubSpot'] },
  { source: 'voice-agent', name: 'Voice Agent', tasks: ['Place call', 'Natural conversation', 'Write outcome to HubSpot'] },
  { source: 'agent-gateway', name: 'AG-UI Gateway', tasks: ['Relay agent events', 'Receive webhooks', 'Notify next agent'] },
];

const WEBHOOK_SOURCES: Array<{ source: EventSource; name: string; tasks: string[] }> = [
  { source: 'mailgun-webhook', name: 'Mailgun webhook', tasks: ['Delivery & open events', 'Writes to HubSpot via MCP'] },
  { source: 'hubspot-webhook', name: 'HubSpot webhook', tasks: ['Property change events', 'Notifies the Gateway'] },
];

export default function AgentTracesPage() {
  const { events } = useAGUIState();

  return (
    <>
      <PageHeader
        eyebrow="Agent Traces"
        title="Agent & webhook activity"
        description="Every action taken by the Lead Profile, Email, and Voice agents, plus the two webhook sources that feed HubSpot's own state back into this stream."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {AGENTS.map((agent) => {
          const agentEvents = events.filter((e) => e.source === agent.source);
          return (
            <Panel key={agent.source} eyebrow={agent.tasks.join(' · ')} title={agent.name}>
              <EventFeed events={agentEvents} emptyLabel="No traces from this agent yet." />
            </Panel>
          );
        })}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {WEBHOOK_SOURCES.map((wh) => {
          const whEvents = events.filter((e) => e.source === wh.source);
          return (
            <Panel key={wh.source} eyebrow={wh.tasks.join(' · ')} title={wh.name} accent="orange">
              <EventFeed events={whEvents} emptyLabel="No webhook deliveries yet." />
            </Panel>
          );
        })}
      </div>
    </>
  );
}
