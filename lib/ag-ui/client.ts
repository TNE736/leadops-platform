import type { AGUIEvent, ConnectionState } from './types';

type Listener = (event: AGUIEvent) => void;
type StateListener = (state: ConnectionState) => void;

interface AGUIClientOptions {
  /** Same-origin SSE endpoint, proxied to the AG-UI Gateway (see next.config.mjs rewrites). */
  sseUrl?: string;
  /** Direct WebSocket URL to the AG-UI Gateway, used as a fallback transport. */
  wsUrl?: string;
  maxBackoffMs?: number;
}

/**
 * Thin client for the AG-UI Gateway's real-time channel.
 *
 * Mirrors the "Real-time Updates (SSE / WebSocket)" and "AG-UI Protocol
 * (Events & State)" boxes between the Next.js frontend and the Gateway:
 * it opens a persistent connection, normalizes inbound messages into
 * `AGUIEvent`s, and exposes a small pub/sub surface for the React layer.
 *
 * Falls back to a mock event generator when no gateway is reachable, so the
 * frontend is fully demo-able before the backend agents exist.
 */
export class AGUIClient {
  private eventSource: EventSource | null = null;
  private socket: WebSocket | null = null;
  private listeners = new Set<Listener>();
  private stateListeners = new Set<StateListener>();
  private state: ConnectionState = 'closed';
  private backoffMs = 1000;
  private readonly maxBackoffMs: number;
  private readonly sseUrl?: string;
  private readonly wsUrl?: string;
  private mockTimer: ReturnType<typeof setInterval> | null = null;
  private destroyed = false;

  constructor(options: AGUIClientOptions = {}) {
    this.sseUrl = options.sseUrl;
    this.wsUrl = options.wsUrl;
    this.maxBackoffMs = options.maxBackoffMs ?? 15000;
  }

  connect() {
    this.destroyed = false;
    if (typeof window === 'undefined') return; // no-op on the server
    if (this.sseUrl && 'EventSource' in window) {
      this.connectSSE();
    } else if (this.wsUrl) {
      this.connectWebSocket();
    } else {
      this.startMockStream();
    }
  }

  disconnect() {
    this.destroyed = true;
    this.eventSource?.close();
    this.socket?.close();
    if (this.mockTimer) clearInterval(this.mockTimer);
    this.setState('closed');
  }

  onEvent(listener: Listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Feeds real leads (e.g. parsed from an uploaded CSV) into the event
   * stream: the "1. DATA INGESTION" -> "2. LEAD AGENTS" hop in the
   * architecture diagram. Emits `lead.created` for each row immediately
   * (source: lead-profile-agent, handing off through HubSpot),
   * then plays out the rest of that lead's pipeline stages on a short delay
   * so the UI mirrors what an async backend would stream back.
   *
   * This is optimistic, client-side simulation for demo purposes. Once a
   * real AG-UI Gateway is wired up, its own SSE/WebSocket events become the
   * source of truth and this local playback can be removed.
   */
  ingestLeads(leads: Array<{ leadId: string; name: string; email: string; company?: string }>) {
    const { buildLeadSequence } = require('./mock') as typeof import('./mock');
    leads.forEach((lead, leadIndex) => {
      const sequence = buildLeadSequence(lead);
      sequence.forEach((factory, stageIndex) => {
        const delay = stageIndex === 0 ? leadIndex * 120 : 400 * stageIndex + leadIndex * 120;
        setTimeout(() => {
          if (this.destroyed) return;
          this.emit(factory());
        }, delay);
      });
    });
  }

  onStateChange(listener: StateListener) {
    this.stateListeners.add(listener);
    return () => this.stateListeners.delete(listener);
  }

  private setState(next: ConnectionState) {
    this.state = next;
    this.stateListeners.forEach((l) => l(next));
  }

  private emit(event: AGUIEvent) {
    this.listeners.forEach((l) => l(event));
  }

  private connectSSE() {
    this.setState('connecting');
    try {
      const es = new EventSource(this.sseUrl!);
      this.eventSource = es;
      es.onopen = () => {
        this.backoffMs = 1000;
        this.setState('open');
      };
      es.onmessage = (msg) => this.handleRawMessage(msg.data);
      es.onerror = () => {
        es.close();
        this.setState('error');
        if (!this.destroyed) this.scheduleReconnect(() => this.connectSSE());
      };
    } catch {
      this.startMockStream();
    }
  }

  private connectWebSocket() {
    this.setState('connecting');
    try {
      const ws = new WebSocket(this.wsUrl!);
      this.socket = ws;
      ws.onopen = () => {
        this.backoffMs = 1000;
        this.setState('open');
      };
      ws.onmessage = (msg) => this.handleRawMessage(msg.data);
      ws.onclose = () => {
        this.setState('closed');
        if (!this.destroyed) this.scheduleReconnect(() => this.connectWebSocket());
      };
      ws.onerror = () => this.setState('error');
    } catch {
      this.startMockStream();
    }
  }

  private scheduleReconnect(retry: () => void) {
    setTimeout(retry, this.backoffMs);
    this.backoffMs = Math.min(this.backoffMs * 2, this.maxBackoffMs);
  }

  private handleRawMessage(raw: string) {
    try {
      const parsed = JSON.parse(raw) as AGUIEvent;
      this.emit(parsed);
    } catch {
      // Ignore malformed frames rather than crashing the stream.
    }
  }

  /**
   * Local, in-browser event generator that walks the same pipeline stages
   * shown in the architecture diagram. Lets every dashboard page be built
   * and demoed against realistic data before the AG-UI Gateway is live.
   */
  private startMockStream() {
    this.setState('open');
    const { mockEventSequence } = require('./mock') as typeof import('./mock');
    const sequence = mockEventSequence();
    let i = 0;
    this.mockTimer = setInterval(() => {
      if (this.destroyed) return;
      const next = sequence[i % sequence.length];
      if (next) this.emit(next());
      i += 1;
    }, 2200);
  }
}

let singleton: AGUIClient | null = null;

/** Returns a process-wide singleton so multiple hooks share one connection. */
export function getAGUIClient(): AGUIClient {
  if (!singleton) {
    singleton = new AGUIClient({
      sseUrl: process.env.NEXT_PUBLIC_AG_UI_SSE_URL,
      wsUrl: process.env.NEXT_PUBLIC_AG_UI_WS_URL,
    });
  }
  return singleton;
}
