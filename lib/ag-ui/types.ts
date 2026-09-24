/**
 * AG-UI Protocol — shared types
 *
 * Reflects the current architecture:
 * CSV -> ingest API -> MongoDB `bench_outreach.consultants` (system of record)
 * -> bench-outreach agents (Email Agent sends via Mailgun, …), with events
 * relayed to the frontend by the AG-UI Gateway over SSE/WebSocket.
 *
 * There is no Kafka/PubSub backbone. MongoDB itself is the shared state every
 * agent reads and writes; services publish events to the Gateway to light up
 * the live views.
 */

/** Pipeline stage identifiers, in the order a lead moves through them. */
export type PipelineStage =
  | 'lead.created'
  | 'lead.eligibility.checked'
  | 'crm.contact.upserted'
  | 'email.sent'
  | 'voice.trigger.requested'
  | 'voice.completed'
  | 'crm.updated'
  | 'error.occurred'
  // New pipeline taxonomy (Blog Summary → Research → Lead Context → Email → Voice)
  | 'blog.summary'
  | 'research.completed'
  | 'lead.context'
  | 'email.opened';

/** Matches the Event Status Legend on the architecture poster. */
export type EventStatus = 'success' | 'running' | 'triggered' | 'waiting' | 'failed';

/**
 * Who published the event. Distinguishes "an agent decided this synchronously"
 * from "a webhook told us something changed" — the two failure modes behave
 * very differently, so the feeds group by this field.
 */
export type EventSource =
  | 'lead-profile-agent'
  | 'email-agent'
  | 'voice-agent'
  | 'mailgun-webhook'
  | 'agent-gateway';

export interface AGUIEventBase {
  id: string;
  type: PipelineStage;
  status: EventStatus;
  timestamp: string; // ISO 8601
  leadId?: string;
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
  payload: { consultantId: string; stage: string };
}

export interface EmailSentEvent extends AGUIEventBase {
  type: 'email.sent';
  payload: { messageId: string; to: string; subject: string };
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
  payload: { consultantId: string; stage: string };
}

export interface ErrorOccurredEvent extends AGUIEventBase {
  type: 'error.occurred';
  payload: { message: string; stage: PipelineStage; detail?: string };
}

export interface BlogSummaryEvent extends AGUIEventBase {
  type: 'blog.summary';
  payload?: { summary?: string };
}

export interface ResearchCompletedEvent extends AGUIEventBase {
  type: 'research.completed';
  payload?: Record<string, unknown>;
}

export interface LeadContextEvent extends AGUIEventBase {
  type: 'lead.context';
  payload?: { context?: string };
}

export interface EmailOpenedEvent extends AGUIEventBase {
  type: 'email.opened';
  payload?: { messageId?: string };
}

export type AGUIEvent =
  | LeadCreatedEvent
  | LeadEligibilityCheckedEvent
  | CrmContactUpsertedEvent
  | EmailSentEvent
  | VoiceTriggerRequestedEvent
  | VoiceCompletedEvent
  | CrmUpdatedEvent
  | ErrorOccurredEvent
  | BlogSummaryEvent
  | ResearchCompletedEvent
  | LeadContextEvent
  | EmailOpenedEvent;

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
  'voice.trigger.requested',
  'voice.completed',
  'crm.updated',
];

export const STAGE_LABELS: Record<PipelineStage, string> = {
  'lead.created': 'New lead created',
  'lead.eligibility.checked': 'Scored & eligibility checked',
  'crm.contact.upserted': 'Saved to MongoDB',
  'email.sent': 'Email Agent sent via Mailgun',
  'voice.trigger.requested': 'Gateway notified Voice Agent',
  'voice.completed': 'Call outcome captured',
  'crm.updated': 'MongoDB updated with results',
  'error.occurred': 'Pipeline error',
  'blog.summary': 'Blog Summary generated',
  'research.completed': 'Research Agent enriched',
  'lead.context': 'Lead Context ready',
  'email.opened': 'Email opened',
};

/**
 * The Lead Journey stage sequence: bench-outreach's `qualification_stage`
 * values, in order. `key` matches the `reached` map from GET /consultants/journey.
 */
export interface JourneyStage {
  key: string;
  label: string;
}

export const LEAD_JOURNEY: JourneyStage[] = [
  { key: 'loaded', label: 'Loaded into MongoDB' },
  { key: 'emailed', label: 'Emailed about a role' },
  { key: 'engaged', label: 'Replied (engaged)' },
  { key: 'researched', label: 'Researched' },
  { key: 'followed_up', label: 'Qualifying follow-up sent' },
  { key: 'qualified', label: 'Qualified' },
  { key: 'handed_off', label: 'Handed off to Bench TA' },
];

/** Human-readable names for each publisher, used in feeds and trace headers. */
export const SOURCE_LABELS: Record<EventSource, string> = {
  'lead-profile-agent': 'Lead Profile Agent',
  'email-agent': 'Email Agent',
  'voice-agent': 'Voice Agent',
  'mailgun-webhook': 'Mailgun webhook',
  'agent-gateway': 'AG-UI Gateway',
};
