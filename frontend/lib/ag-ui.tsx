'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';

/**
 * AG-UI live-updates channel: services POST events to the gateway (backend/gateway), which
 * relays them to the browser over SSE (WebSocket fallback). MongoDB stays the system of record.
 * The stream is opened directly (CORS) because a proxy would buffer it. Use 127.0.0.1 rather
 * than localhost; port 4100 because the agentgateway Docker service in WSL takes 4000 on Windows.
 */
const SSE_URL = process.env.NEXT_PUBLIC_LIVE_UPDATES_URL || 'http://127.0.0.1:4100/events';
const WS_URL = process.env.NEXT_PUBLIC_LIVE_UPDATES_WS_URL;
const MAX_EVENTS = 200;
const INITIAL_BACKOFF_MS = 1_000;
const MAX_BACKOFF_MS = 15_000;

/** Event type → label. Names are shared with bench-outreach's publishers, so they never change here alone. */
export const STAGE_LABELS = {
  'lead.created': 'New lead created',
  'lead.eligibility.checked': 'Scored & eligibility checked',
  'crm.contact.upserted': 'Saved to MongoDB',
  'email.sent': 'Email Agent sent via Mailgun',
  'voice.trigger.requested': 'Gateway notified Voice Agent',
  'voice.completed': 'Call outcome captured',
  'crm.updated': 'MongoDB updated with results',
  'error.occurred': 'Pipeline error',
  // New pipeline taxonomy (Blog Summary → Research → Lead Context → Email → Voice)
  'blog.summary': 'Blog Summary generated',
  'research.completed': 'Research Agent enriched',
  'lead.context': 'Lead Context ready',
  'email.opened': 'Email opened',
} as const;

/** Publisher → label. Agents decide synchronously, webhooks report changes; the feeds group by this. */
export const SOURCE_LABELS = {
  'lead-profile-agent': 'Lead Profile Agent',
  'email-agent': 'Email Agent',
  'voice-agent': 'Voice Agent',
  'mailgun-webhook': 'Mailgun webhook',
  'agent-gateway': 'AG-UI Gateway',
} as const;

export type PipelineStage = keyof typeof STAGE_LABELS;
export type EventSource = keyof typeof SOURCE_LABELS;
export type EventStatus = 'success' | 'running' | 'triggered' | 'waiting' | 'failed';
export type ConnectionState = 'connecting' | 'open' | 'closed' | 'error';

/** One relayed event. The UI renders only the envelope; payload shapes belong to the publishers. */
export interface AGUIEvent {
  id: string;
  type: PipelineStage;
  status: EventStatus;
  timestamp: string; // ISO 8601
  leadId?: string;
  source: EventSource;
  payload?: Record<string, unknown>;
}

export interface AGUIState {
  connection: ConnectionState;
  /** Newest first, capped at MAX_EVENTS. */
  events: AGUIEvent[];
  activeLeads: number;
  lastEventAt?: string;
}

type Listener<T> = (value: T) => void;

/**
 * One persistent gateway connection (SSE preferred, WebSocket fallback) with exponential-backoff
 * reconnects. Nothing is fabricated client-side: with no gateway reachable the state is `error`.
 */
class AGUIClient {
  private stream: globalThis.EventSource | WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private backoffMs = INITIAL_BACKOFF_MS;
  private destroyed = false;
  private readonly eventListeners = new Set<Listener<AGUIEvent>>();
  private readonly stateListeners = new Set<Listener<ConnectionState>>();

  connect() {
    this.destroyed = false;
    if (typeof window === 'undefined') return; // no-op on the server
    if (SSE_URL && 'EventSource' in window) this.open(new EventSource(SSE_URL));
    else if (WS_URL) this.open(new WebSocket(WS_URL));
    else this.setState('error'); // no gateway configured
  }

  disconnect() {
    this.destroyed = true;
    // A reconnect still pending from an earlier failure would otherwise open a second stream.
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.stream?.close();
    this.setState('closed');
  }

  onEvent(listener: Listener<AGUIEvent>) {
    this.eventListeners.add(listener);
    return () => void this.eventListeners.delete(listener);
  }

  onStateChange(listener: Listener<ConnectionState>) {
    this.stateListeners.add(listener);
    return () => void this.stateListeners.delete(listener);
  }

  private setState(next: ConnectionState) {
    this.stateListeners.forEach((listener) => listener(next));
  }

  private open(stream: globalThis.EventSource | WebSocket) {
    this.setState('connecting');
    this.stream = stream;
    stream.onopen = () => {
      this.backoffMs = INITIAL_BACKOFF_MS;
      this.setState('open');
    };
    stream.onmessage = (message: MessageEvent) => {
      try {
        const event = JSON.parse(message.data) as AGUIEvent; // trusted: frames come from our gateway
        this.eventListeners.forEach((listener) => listener(event));
      } catch {
        // Ignore malformed frames rather than crashing the stream.
      }
    };
    if (stream instanceof globalThis.EventSource) {
      stream.onerror = () => {
        stream.close();
        this.setState('error');
        this.scheduleReconnect();
      };
    } else {
      stream.onclose = () => {
        this.setState('closed');
        this.scheduleReconnect();
      };
      stream.onerror = () => this.setState('error');
    }
  }

  private scheduleReconnect() {
    if (this.destroyed) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, this.backoffMs);
    this.backoffMs = Math.min(this.backoffMs * 2, MAX_BACKOFF_MS);
  }
}

/** One client per browser tab, so every consumer shares a single connection. */
let sharedClient: AGUIClient | null = null;

const AGUIContext = createContext<AGUIState | null>(null);

/** Provides live gateway state to the whole app. Mounted once, in the root layout. */
export function AGUIProvider({ children }: { children: React.ReactNode }) {
  const [connection, setConnection] = useState<ConnectionState>('connecting');
  const [events, setEvents] = useState<AGUIEvent[]>([]);

  useEffect(() => {
    const client = (sharedClient ??= new AGUIClient());
    const unsubscribeEvents = client.onEvent((event) =>
      setEvents((previous) => [event, ...previous].slice(0, MAX_EVENTS))
    );
    const unsubscribeState = client.onStateChange(setConnection);
    client.connect();
    return () => {
      unsubscribeEvents();
      unsubscribeState();
      client.disconnect();
    };
  }, []);

  const state = useMemo<AGUIState>(() => {
    const activeLeadIds = new Set(
      events.filter((event) => event.leadId && event.type !== 'crm.updated').map((e) => e.leadId)
    );
    return { connection, events, activeLeads: activeLeadIds.size, lastEventAt: events[0]?.timestamp };
  }, [connection, events]);

  return <AGUIContext.Provider value={state}>{children}</AGUIContext.Provider>;
}

/** The live gateway state: connection, events (newest first) and derived counts. */
export function useAGUIState(): AGUIState {
  const state = useContext(AGUIContext);
  if (!state) throw new Error('useAGUIState must be used within an <AGUIProvider>');
  return state;
}
