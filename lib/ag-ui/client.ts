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
 * All events come from the Gateway — nothing is fabricated client-side.
 * With no gateway URL configured (or the gateway down) the connection
 * state reports `error` and the UI shows an honest disconnected state.
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
      this.setState('error'); // no gateway configured
    }
  }

  disconnect() {
    this.destroyed = true;
    this.eventSource?.close();
    this.socket?.close();
    this.setState('closed');
  }

  onEvent(listener: Listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
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
  }

  private connectWebSocket() {
    this.setState('connecting');
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
