/**
 * AG-UI Protocol — shared types
 *
 * Reflects the current architecture (see the architecture poster):
 * CSV -> Lead Profile Agent -> HubSpot CRM (system of record) -> Email Agent
 * -> Mailgun -> webhook -> HubSpot -> webhook -> Voice Agent -> HubSpot,
 * all relayed to the frontend by the AG-UI Gateway over SSE/WebSocket.
 *
 * There is no Kafka/PubSub backbone. HubSpot itself is the shared state
 * every agent reads and writes via MCP; the Gateway's Webhook Receiver is
 * what turns HubSpot's own webhooks (and Mailgun's, one hop upstream of
 * HubSpot) into events on this stream.
 */

/** Pipeline stage identifiers, in the order a lead moves through them. */
export type PipelineStage =
  | 'lead.created'
  | 'lead.eligibility.checked'
  | 'crm.contact.upserted'
  | 'email.sent'
  | 'email.status.synced'
  | 'voice.trigger.requested'
  | 'voice.completed'
  | 'crm.updated'
  | 'error.occurred';

/** Matches the Event Status Legend on the architecture poster. */
export type EventStatus = 'success' | 'running' | 'triggered' | 'waiting' | 'failed';

/** HubSpot email-status values, carried in email.status.synced events. */
export type EmailSyncStatus = 'sent' | 'delivered' | 'opened' | 'bounced';

/**
 * Who published the event. Distinguishes "an agent decided this synchronously"
 * from "HubSpot told us something changed" — the two failure modes behave
 * very differently, so Agent Traces and Alerts group by this field.
 */
export type EventSource =
  | 'lead-profile-agent'
  | 'email-agent'
  | 'voice-agent'
  | 'mailgun-webhook'
  | 'hubspot-webhook'
  | 'agent-gateway';

export interface AGUIEventBase {
  id: string;
  type: PipelineStage;
  status: EventStatus;
  timestamp: string; // ISO 8601
  leadId?: string;
  hubspotContactId?: string;
  source: EventSource;
}

export interface LeadCreatedEvent extends AGUIEventBase {
  type: 'lead.created';
  payload: { name: string; email: string; company?: string };
}

export interface LeadEligibilityCheckedEvent extends AGUIEventBase {
  type: 'lead.eligibility.checked';
  payload: { eligible: boolean; score: number; reasons?: string[] };
}

export interface CrmContactUpsertedEvent extends AGUIEventBase {
  type: 'crm.contact.upserted';
  payload: { hubspotContactId: string; stage: string };
}

export interface EmailSentEvent extends AGUIEventBase {
  type: 'email.sent';
  payload: { messageId: string; to: string; subject: string };
}

/** Fired by the Webhook Receiver after HubSpot's own webhook confirms a property change. */
export interface EmailStatusSyncedEvent extends AGUIEventBase {
  type: 'email.status.synced';
  payload: { status: EmailSyncStatus; hubspotProperty: string };
}

export interface VoiceTriggerRequestedEvent extends AGUIEventBase {
  type: 'voice.trigger.requested';
  payload: { reason: string };
}

export interface VoiceCompletedEvent extends AGUIEventBase {
  type: 'voice.completed';
  payload: { callId: string; outcome: string; transcriptUrl?: string };
}

export interface CrmUpdatedEvent extends AGUIEventBase {
  type: 'crm.updated';
  payload: { hubspotContactId: string; stage: string };
}

export interface ErrorOccurredEvent extends AGUIEventBase {
  type: 'error.occurred';
  payload: { message: string; stage: PipelineStage; detail?: string };
}

export type AGUIEvent =
  | LeadCreatedEvent
  | LeadEligibilityCheckedEvent
  | CrmContactUpsertedEvent
  | EmailSentEvent
  | EmailStatusSyncedEvent
  | VoiceTriggerRequestedEvent
  | VoiceCompletedEvent
  | CrmUpdatedEvent
  | ErrorOccurredEvent;

/** Connection state for the Real-time Updates (SSE / WebSocket) channel. */
export type ConnectionState = 'connecting' | 'open' | 'closed' | 'error';

/** Aggregate, derived state the AG-UI Gateway's State Manager would broadcast. */
export interface AGUIState {
  connection: ConnectionState;
  events: AGUIEvent[];
  stageCounts: Record<PipelineStage, number>;
  activeLeads: number;
  lastEventAt?: string;
}

export const PIPELINE_STAGE_ORDER: PipelineStage[] = [
  'lead.created',
  'lead.eligibility.checked',
  'crm.contact.upserted',
  'email.sent',
  'email.status.synced',
  'voice.trigger.requested',
  'voice.completed',
  'crm.updated',
];

export const STAGE_LABELS: Record<PipelineStage, string> = {
  'lead.created': 'New lead created',
  'lead.eligibility.checked': 'Scored & eligibility checked',
  'crm.contact.upserted': 'Written to HubSpot via MCP',
  'email.sent': 'Email Agent sent via Mailgun',
  'email.status.synced': 'HubSpot property synced via webhook',
  'voice.trigger.requested': 'Gateway notified Voice Agent',
  'voice.completed': 'Call outcome captured',
  'crm.updated': 'HubSpot updated with results',
  'error.occurred': 'Pipeline error',
};

/** Human-readable names for each publisher, used in feeds and trace headers. */
export const SOURCE_LABELS: Record<EventSource, string> = {
  'lead-profile-agent': 'Lead Profile Agent',
  'email-agent': 'Email Agent',
  'voice-agent': 'Voice Agent',
  'mailgun-webhook': 'Mailgun webhook',
  'hubspot-webhook': 'HubSpot webhook',
  'agent-gateway': 'AG-UI Gateway',
};

/** Sources that only reach the frontend via HubSpot's own webhook, one hop removed from the agent that caused them. */
export const WEBHOOK_SOURCES: EventSource[] = ['mailgun-webhook', 'hubspot-webhook'];
