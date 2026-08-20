import type { AGUIEvent, EventSource } from './types';

const names = ['Priya Shah', 'Daniel Ortiz', 'Mei Lin', 'Sam Okafor', 'Elena Petrova'];
const companies = ['Northwind Retail', 'Vega Logistics', 'Brightline Health', 'Solace Robotics'];

let leadCounter = 0;
function nextSyntheticLead() {
  leadCounter += 1;
  return {
    leadId: `lead_${String(leadCounter).padStart(4, '0')}`,
    name: names[leadCounter % names.length]!,
    company: companies[leadCounter % companies.length]!,
  };
}

export const id = () => Math.random().toString(36).slice(2, 10);
export const now = () => new Date().toISOString();

export interface LeadIdentity {
  leadId: string;
  name: string;
  email: string;
  company?: string;
}

/**
 * Builds the full lead.created -> ... -> crm.updated factory sequence for one
 * lead, matching the current (no-Kafka) architecture: HubSpot is written to
 * directly by each agent via MCP, and the two email.status.synced events are
 * tagged with source: 'hubspot-webhook' since that's how the frontend would
 * really learn about them — one hop behind Mailgun's own webhook to HubSpot.
 * Shared by the synthetic demo stream and by real leads ingested from an
 * uploaded CSV (`AGUIClient.ingestLeads`).
 */
export function buildLeadSequence(
  lead: LeadIdentity,
  overrides?: { source?: EventSource }
): Array<() => AGUIEvent> {
  const hubspotContactId = `hs_${id()}`;

  return [
    () => ({
      id: id(),
      type: 'lead.created',
      status: 'success',
      timestamp: now(),
      leadId: lead.leadId,
      source: overrides?.source ?? 'lead-profile-agent',
      payload: { name: lead.name, email: lead.email, company: lead.company },
    }),
    () => ({
      id: id(),
      type: 'lead.eligibility.checked',
      status: 'success',
      timestamp: now(),
      leadId: lead.leadId,
      source: 'lead-profile-agent',
      payload: { eligible: true, score: 72 + (leadCounter % 20) },
    }),
    () => ({
      id: id(),
      type: 'crm.contact.upserted',
      status: 'success',
      timestamp: now(),
      leadId: lead.leadId,
      hubspotContactId,
      source: 'lead-profile-agent',
      payload: { hubspotContactId, stage: 'Marketing Qualified Lead' },
    }),
    () => ({
      id: id(),
      type: 'email.sent',
      status: 'running',
      timestamp: now(),
      leadId: lead.leadId,
      hubspotContactId,
      source: 'email-agent',
      payload: {
        messageId: id(),
        to: lead.email,
        subject: `${lead.name.split(' ')[0]}, a quick idea for ${lead.company ?? 'your team'}`,
      },
    }),
    () => ({
      id: id(),
      type: 'email.status.synced',
      status: 'success',
      timestamp: now(),
      leadId: lead.leadId,
      hubspotContactId,
      source: 'hubspot-webhook',
      payload: { status: 'delivered', hubspotProperty: 'email_status' },
    }),
    () => ({
      id: id(),
      type: 'email.status.synced',
      status: 'success',
      timestamp: now(),
      leadId: lead.leadId,
      hubspotContactId,
      source: 'hubspot-webhook',
      payload: { status: 'opened', hubspotProperty: 'email_status' },
    }),
    () => ({
      id: id(),
      type: 'voice.trigger.requested',
      status: 'triggered',
      timestamp: now(),
      leadId: lead.leadId,
      hubspotContactId,
      source: 'agent-gateway',
      payload: { reason: 'email_status changed to opened' },
    }),
    () => ({
      id: id(),
      type: 'voice.completed',
      status: 'success',
      timestamp: now(),
      leadId: lead.leadId,
      hubspotContactId,
      source: 'voice-agent',
      payload: { callId: id(), outcome: 'Meeting booked', transcriptUrl: '#' },
    }),
    () => ({
      id: id(),
      type: 'crm.updated',
      status: 'success',
      timestamp: now(),
      leadId: lead.leadId,
      hubspotContactId,
      source: 'voice-agent',
      payload: { hubspotContactId, stage: 'Meeting Scheduled' },
    }),
  ];
}

/**
 * Returns a fixed sequence of event factories that trace one synthetic lead
 * through the full pipeline. Used by the demo/mock real-time stream when no
 * AG-UI Gateway is connected.
 */
export function mockEventSequence(): Array<() => AGUIEvent> {
  const lead = nextSyntheticLead();
  const email = `${lead.name.toLowerCase().replace(' ', '.')}@${lead.company
    .toLowerCase()
    .replace(/\s+/g, '')}.com`;
  return buildLeadSequence({ ...lead, email });
}
