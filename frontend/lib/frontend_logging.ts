/**
 * The browser's one logging file (Logging Spec §10): OpenTelemetry spans for the Upload page's
 * run, written as one JSON record each to the browser console, plus the console renderer.
 *
 * Part 1 installs a browser tracer provider and the fetch instrumentation, which sends
 * `traceparent` to the ingest API so its run joins this trace. Part 2 draws the records as
 * columns (NEXT_PUBLIC_LOG_CONSOLE=rendered, the default). A browser has no log file; records
 * copied out as JSON lines render with `python backend/integrations/integrations_logging.py render`.
 */
import {
  context,
  SpanKind,
  SpanStatusCode,
  trace,
  type Attributes,
  type Context,
  type Span,
} from '@opentelemetry/api';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import {
  FetchInstrumentation,
  type FetchCustomAttributeFunction,
} from '@opentelemetry/instrumentation-fetch';
import { resourceFromAttributes } from '@opentelemetry/resources';
import {
  BatchSpanProcessor,
  WebTracerProvider,
  type ReadableSpan,
  type SpanProcessor,
} from '@opentelemetry/sdk-trace-web';
import { INGEST_API_URL } from '@/lib/api';

type LogRecord = Record<string, unknown>;

// ── Part 1: the logging ──────────────────────────────────────────────────────

const SERVICE_NAME = process.env.NEXT_PUBLIC_SERVICE_NAME || 'frontend';
const LOG_CONSOLE = process.env.NEXT_PUBLIC_LOG_CONSOLE || 'rendered';
const LOG_MODE = process.env.NEXT_PUBLIC_LOG_MODE || 'normal';
const ATTRIBUTE_VALUE_MAX_CHARS = { terse: 32, normal: 240, debug: undefined }[LOG_MODE] ?? 240;
const OTLP_ENDPOINT = process.env.NEXT_PUBLIC_OTEL_EXPORTER_OTLP_ENDPOINT || '';
const TRACE_PROJECT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLOUD_PROJECT || '';
const SECRET_NAME_PARTS = [
  'token',
  'secret',
  'password',
  'api_key',
  'authorization',
  'auth',
  'bearer',
  'credential',
  'private_key',
  'access_key',
  'session_id',
  'cookie',
  'signature',
];
const NEVER_SECRET_NAMES = [
  'gen_ai.usage.input_tokens',
  'gen_ai.usage.output_tokens',
  'llm.token_count.prompt',
  'llm.token_count.completion',
  'llm.token_count.total',
];
const NEVER_SECRET_SUFFIXES = ['_name', '_source', '_ref', '_kind', '_type', '_count'];
/** Fetches that are never part of a run: the dashboard polls, Next.js assets and fonts. */
const NOT_RUN_URLS = [
  /\/metrics\/consultants/,
  /\/consultants\/journey/,
  /\/_next\//,
  /fonts\.g/,
  /\/api\/logs/,
];
/** Where the browser posts its records so they land in logs/frontend.jsonl and the `npm run dev` terminal ('-' = off). */
const LOG_SINK = process.env.NEXT_PUBLIC_LOG_SINK || '/api/logs';
const pendingRecords: LogRecord[] = [];

export const tracer = trace.getTracer(SERVICE_NAME);
let configured = false;
let activeRun: Span | undefined;

/** Returns the attributes with the value of every secret-looking name replaced by <redacted> (§3.5). */
export function redactSecretValues(attributes: LogRecord): LogRecord {
  const isSecret = (name: string) => {
    const lowered = name.toLowerCase();
    if (
      NEVER_SECRET_NAMES.includes(lowered) ||
      NEVER_SECRET_SUFFIXES.some((s) => lowered.endsWith(s))
    )
      return false;
    return SECRET_NAME_PARTS.some((part) => lowered.includes(part));
  };
  return Object.fromEntries(
    Object.entries(attributes).map(([k, v]) => [k, isSecret(k) ? '<redacted>' : v])
  );
}

/** Returns the current UTC time as ISO-8601 with milliseconds and a trailing Z. */
export function timestampNow(): string {
  return new Date().toISOString();
}

/** Writes one record to the browser console, as rows (rendered) or one JSON line (json); `file` writes nothing. */
export function writeRecord(record: LogRecord): void {
  if (TRACE_PROJECT_ID && record.trace_id) {
    record['logging.googleapis.com/trace'] =
      `projects/${TRACE_PROJECT_ID}/traces/${record.trace_id}`;
  }
  if (LOG_CONSOLE === 'rendered') renderRecord(record).forEach((row) => console.log(row));
  else if (LOG_CONSOLE === 'json') console.log(JSON.stringify(record));
  if (typeof window !== 'undefined' && LOG_SINK !== '-') {
    if (pendingRecords.push(record) === 1) setTimeout(sendPendingRecords, 250);
  }
}

/** Posts the queued records to LOG_SINK in one request; a failed post is dropped, never retried or thrown. */
function sendPendingRecords(): void {
  const body = JSON.stringify(pendingRecords.splice(0));
  fetch(LOG_SINK, {
    method: 'POST',
    body,
    keepalive: true,
    headers: { 'content-type': 'application/json' },
  }).catch(() => {});
}

/** Returns SERVER, INTERNAL or CLIENT; a model provider's span counts as CLIENT, as it leaves the process. */
export function spanKindName(span: ReadableSpan): 'SERVER' | 'INTERNAL' | 'CLIENT' {
  if ('gen_ai.request.model' in span.attributes || 'llm.model_name' in span.attributes)
    return 'CLIENT';
  if (span.kind === SpanKind.SERVER) return 'SERVER';
  return span.kind === SpanKind.CLIENT ? 'CLIENT' : 'INTERNAL';
}

/** Returns the span's trace_id, span_id and (when it has one) parent_span_id as lower-case hex. */
export function spanIdentifiers(span: ReadableSpan): LogRecord {
  const { traceId, spanId } = span.spanContext();
  const parent = span.parentSpanContext?.spanId;
  return parent
    ? { trace_id: traceId, span_id: spanId, parent_span_id: parent }
    : { trace_id: traceId, span_id: spanId };
}

/** Returns true for the run and the spans inside it; false for a fetch made outside any run or a preflight timing span. */
function belongsToARun(span: ReadableSpan): boolean {
  if (span.name === 'CORS Preflight') return false; // resource-timing detail of the fetch, not a step
  return span.parentSpanContext !== undefined || span.kind === SpanKind.SERVER;
}

/** Writes a span_start record when a span opens and a span_end record when it closes. */
export class JsonLineSpanProcessor implements SpanProcessor {
  /** Writes {ts, event: span_start, service, name, kind, identifiers, attributes}. */
  onStart(span: Span & ReadableSpan): void {
    if (!belongsToARun(span)) return;
    writeRecord({
      ts: timestampNow(),
      event: 'span_start',
      service: SERVICE_NAME,
      name: span.name,
      kind: spanKindName(span),
      ...spanIdentifiers(span),
      attributes: redactSecretValues({ ...span.attributes }),
    });
  }

  /** Writes {ts, event: span_end, …, status, reason?, duration_ms, attributes, exception?}. */
  onEnd(span: ReadableSpan): void {
    if (!belongsToARun(span)) return;
    const record: LogRecord = {
      ts: timestampNow(),
      event: 'span_end',
      service: SERVICE_NAME,
      name: span.name,
      kind: spanKindName(span),
      ...spanIdentifiers(span),
      status: ['unset', 'ok', 'error'][span.status.code],
    };
    if (span.status.message) record.reason = span.status.message;
    record.duration_ms = Math.round(span.duration[0] * 1e3 + span.duration[1] / 1e6);
    record.attributes = redactSecretValues({ ...span.attributes });
    const failure = span.events.find((event) => event.name === 'exception')?.attributes;
    if (failure) record.exception = `${failure['exception.type']}: ${failure['exception.message']}`;
    writeRecord(record);
  }

  forceFlush(): Promise<void> {
    return Promise.resolve();
  }

  shutdown(): Promise<void> {
    return Promise.resolve();
  }
}

/** The fetch instrumentation's response hook: size and content type from the response headers, never the body. */
export const recordResponseSizeAndType: FetchCustomAttributeFunction = (span, request, result) => {
  const sent = new Headers((request as RequestInit).headers).get('traceparent');
  if (sent) span.setAttribute('http.request.header.traceparent', sent);
  if (!(result instanceof Response)) {
    span.setStatus({ code: SpanStatusCode.ERROR, message: result.message || 'network error' });
    return;
  }
  const size = result.headers.get('content-length');
  if (size) span.setAttribute('http.response.body.size', Number(size));
  span.setAttribute('http.response.header.content-type', result.headers.get('content-type') ?? '');
};

/** Installs the browser tracer provider, this file's writer and the fetch instrumentation; once, in the browser only. */
export function configureLogging(): void {
  if (configured || typeof window === 'undefined') return;
  configured = true;
  const spanProcessors: SpanProcessor[] = [new JsonLineSpanProcessor()];
  if (OTLP_ENDPOINT) {
    spanProcessors.push(
      new BatchSpanProcessor(new OTLPTraceExporter({ url: `${OTLP_ENDPOINT}/v1/traces` }))
    );
  }
  new WebTracerProvider({
    resource: resourceFromAttributes({ 'service.name': SERVICE_NAME }),
    spanLimits: { attributeValueLengthLimit: ATTRIBUTE_VALUE_MAX_CHARS },
    spanProcessors,
  }).register();
  registerInstrumentations({
    instrumentations: [
      new FetchInstrumentation({
        // Cross-origin, so traceparent is sent only to the ingest API.
        propagateTraceHeaderCorsUrls: [
          new RegExp(`^${INGEST_API_URL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`),
        ],
        ignoreUrls: NOT_RUN_URLS,
        applyCustomAttributesOnSpan: recordResponseSizeAndType,
        clearTimingResources: true,
      }),
    ],
  });
}

/** Opens the root SERVER span of a run with inputs.* set (a page has no request to open one) and returns it. */
export function startRun(name: string, inputs: Attributes = {}): Span {
  configureLogging();
  const prefixed = Object.fromEntries(
    Object.entries(inputs).map(([key, value]) => [`inputs.${key}`, value])
  );
  activeRun = tracer.startSpan(
    name,
    { kind: SpanKind.SERVER, attributes: prefixed },
    context.active()
  );
  return activeRun;
}

/** Returns the run span of the active upload, or undefined outside one. */
export function currentRun(): Span | undefined {
  return activeRun;
}

/** Opens a step (or an item) as a child of `parent` (default: the current run) and returns it. */
export function startStep(
  name: string,
  attributes: Attributes,
  parent: Span | undefined = activeRun
): Span {
  const parentContext: Context = parent
    ? trace.setSpan(context.active(), parent)
    : context.active();
  return tracer.startSpan(name, { attributes }, parentContext);
}

/** Runs `work` with `span` as the active span, so a fetch it starts becomes the span's child. */
export function runInsideSpan<T>(span: Span, work: () => T): T {
  return context.with(trace.setSpan(context.active(), span), work);
}

/** Marks a span failed (status error) with the reason. */
export function failSpan(span: Span, reason: string): void {
  span.setStatus({ code: SpanStatusCode.ERROR, message: reason });
}

// ── Part 2: the console renderer ─────────────────────────────────────────────

const LINE_WIDTH = 200;
const STEP_COLUMN_WIDTH = 22;
const VALUE_MAX_CHARS = 60;
const PAYLOAD_MAX_CHARS = 130;
const openSpans = new Map<
  string,
  { name: string; step: string; items: number; itemsOk: number; inputsShown: boolean }
>();
/** span_id → step name, kept after the span ends: the fetch instrumentation ends its span ~300 ms after the response. */
const stepNames = new Map<string, string>();

/** Returns one value on one line: booleans as true/false, long lists as [N], long text cut with ' ...'. */
export function formatValue(value: unknown): string {
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (Array.isArray(value)) {
    const joined = `[${value.map(formatValue).join(', ')}]`;
    return value.length > 3 || joined.length > VALUE_MAX_CHARS ? `[${value.length}]` : joined;
  }
  const text = String(value).split(/\s+/).join(' ');
  return text.length <= VALUE_MAX_CHARS ? text : `${text.slice(0, VALUE_MAX_CHARS)} ...`;
}

/** Returns a payload on one line, cut with ' ...' past PAYLOAD_MAX_CHARS. */
export function formatPayload(text: unknown): string {
  const flat = String(text).split(/\s+/).join(' ');
  return flat.length <= PAYLOAD_MAX_CHARS ? flat : `${flat.slice(0, PAYLOAD_MAX_CHARS)} ...`;
}

/** Returns the attributes under prefix as 'key=value  key=value', empties dropped, short values first. */
export function keyValuePairs(attributes: LogRecord, prefix: string): string {
  const pairs = Object.entries(attributes)
    .filter(
      ([name, value]) =>
        name.startsWith(prefix) && value !== undefined && value !== null && value !== ''
    )
    .map(([name, value]) => [name.slice(prefix.length), formatValue(value)] as const)
    .sort((a, b) => Number(a[1].length > 24) - Number(b[1].length > 24));
  return pairs.map(([key, value]) => `${key}=${value}`).join('  ');
}

/** Returns 'in: …' or 'out: …' around keyValuePairs, or '' when there are none. */
export function labelledPairs(attributes: LogRecord, prefix: 'inputs.' | 'outputs.'): string {
  const pairs = keyValuePairs(attributes, prefix);
  return pairs ? `${prefix === 'inputs.' ? 'in' : 'out'}: ${pairs}` : '';
}

/** Returns the step column: the span's name, a step name plus ' n/N' for an item, the enclosing step for a call. */
export function stepNameFor(record: LogRecord): string {
  const attributes = (record.attributes ?? {}) as LogRecord;
  const parent = openSpans.get(String(record.parent_span_id ?? ''));
  if ('item' in attributes)
    return `${parent?.name ?? record.name} ${attributes.item}/${attributes.of ?? '?'}`;
  if (record.kind === 'CLIENT')
    return parent?.step ?? stepNames.get(String(record.parent_span_id)) ?? String(record.name);
  return String(record.name);
}

/** Returns one row with trace=… span=… right-aligned at LINE_WIDTH; content that does not fit wraps, never cut. */
export function consoleLine(
  timestamp: string,
  stream: string,
  mark: string,
  kind: string,
  step: string,
  content: string,
  identifiers: LogRecord
): string {
  const head = `${timestamp.slice(11, 19)}  ${stream.padEnd(7)}  ${mark.padEnd(2)} ${kind.padEnd(4)}  ${step.padEnd(STEP_COLUMN_WIDTH)}  `;
  const ids = identifiers.trace_id
    ? `trace=${identifiers.trace_id} span=${identifiers.span_id ?? ''}`
    : '';
  const room = LINE_WIDTH - head.length - ids.length - 2;
  if (content.length <= room) return head + content + ' '.repeat(room - content.length + 2) + ids;
  return `${head}${content}\n${' '.repeat(Math.max(head.length, LINE_WIDTH - ids.length))}${ids}`;
}

/** Returns '+ ok' or 'x failed' for a span_end record. */
export function statusMarker(record: LogRecord): string {
  return record.status === 'error' ? 'x failed' : '+ ok';
}

/** Returns the rows of a CLIENT span: a model call, a peer call, or an http call. */
export function renderCall(record: LogRecord, step: string): string[] {
  const attributes = (record.attributes ?? {}) as LogRecord;
  const get = (...names: string[]) =>
    names.map((n) => attributes[n]).find((v) => v !== undefined && v !== '');
  const ms = `${record.duration_ms ?? 0} ms`;
  const failure = record.status === 'error' ? `  x failed  reason=${record.reason ?? ''}` : '';
  const ids = { trace_id: record.trace_id, span_id: record.span_id };
  let content: string;
  let after: Array<[string, unknown]> = [];
  const model = get('gen_ai.request.model', 'llm.model_name');
  if (model) {
    content = `model ${model}  ${ms}  in: ${get('gen_ai.usage.input_tokens', 'llm.token_count.prompt') ?? 0} tok  out: ${record.status}  ${get('gen_ai.usage.output_tokens', 'llm.token_count.completion') ?? 0} tok`;
    after = [
      [
        'in  prompt:   ',
        get('gen_ai.prompt', 'llm.input_messages.0.message.content', 'input.value'),
      ],
      [
        'out response: ',
        get('gen_ai.completion', 'llm.output_messages.0.message.content', 'output.value'),
      ],
    ];
  } else if (get('rpc.method')) {
    content =
      `${get('rpc.method')}  ${get('server.address') ?? ''}  ${ms}  ${labelledPairs(attributes, 'inputs.')}  ${labelledPairs(attributes, 'outputs.')}`.trim();
    after = [
      ['in  query:    ', get('inputs.query')],
      ['out response: ', get('outputs.response')],
    ];
  } else {
    const url = String(get('url.full', 'http.url') ?? '');
    const path = get('url.path', 'http.target') ?? (url ? new URL(url).pathname : '');
    content = `http  in: ${get('http.request.method', 'http.method')} ${path}  ${get('server.address', 'net.peer.name') ?? ''}  out: ${get('http.response.status_code', 'http.status_code') ?? ''}  ${ms}  ${get('http.response.body.size', 'http.response_content_length') ?? '?'} bytes  ${get('http.response.header.content-type') ?? ''}`;
    after = [['in  traceparent: ', get('http.request.header.traceparent')]];
  }
  const rows = [
    consoleLine(String(record.ts), 'audit', '->', 'CALL', step, content + failure, ids),
  ];
  after
    .filter(([, value]) => value !== undefined && value !== '')
    .forEach(([label, value]) =>
      rows.push(
        consoleLine(String(record.ts), 'audit', '', '', '', label + formatPayload(value), ids)
      )
    );
  return rows;
}

/** Returns the console rows for one record (§6). */
export function renderRecord(record: LogRecord): string[] {
  const attributes = (record.attributes ?? {}) as LogRecord;
  const ids = { trace_id: record.trace_id, span_id: record.span_id };
  const ts = String(record.ts ?? '');
  const ms = `${record.duration_ms ?? 0} ms`;
  if (record.event === 'log') {
    const {
      ts: _t,
      event: _e,
      service: _s,
      level,
      logger,
      message,
      trace_id,
      span_id: _i,
      ...fields
    } = record;
    const content = [
      String(message ?? ''),
      ...Object.entries(fields).map(([k, v]) => `${k}=${formatValue(v)}`),
    ].join('  ');
    return [
      consoleLine(
        ts,
        trace_id ? 'process' : 'system',
        level === 'error' ? 'x' : '*',
        String(level ?? '')
          .slice(0, 4)
          .toUpperCase(),
        String(logger ?? ''),
        content,
        ids
      ),
    ];
  }
  const step = stepNameFor(record);
  const spanId = String(record.span_id);
  if (record.event === 'span_start') {
    if (record.kind === 'CLIENT') return [];
    const inputs = labelledPairs(attributes, 'inputs.');
    const parent = openSpans.get(String(record.parent_span_id ?? ''));
    const isItem = 'item' in attributes;
    openSpans.set(spanId, {
      name: String(record.name),
      step: isItem ? (parent?.step ?? step) : step,
      items: 0,
      itemsOk: 0,
      inputsShown: Boolean(inputs),
    });
    stepNames.set(spanId, isItem ? (parent?.step ?? step) : step);
    if (record.kind === 'SERVER')
      return [
        consoleLine(ts, 'process', '*', '', 'run_start', `${record.name}  ${inputs}`.trim(), ids),
      ];
    if (isItem)
      return [consoleLine(ts, 'process', '>', '', step, `key=${formatValue(attributes.key)}`, ids)];
    return [consoleLine(ts, 'process', '>', 'IN', step, inputs, ids)];
  }
  if (record.kind === 'CLIENT') return renderCall(record, step);
  const state = openSpans.get(spanId);
  openSpans.delete(spanId);
  const reason = record.reason ? `reason=${record.reason}` : '';
  const outputs = labelledPairs(attributes, 'outputs.');
  if (record.kind === 'SERVER') {
    const inputs = state?.inputsShown ? '' : labelledPairs(attributes, 'inputs.');
    const content = [statusMarker(record), ms, reason, inputs, outputs].filter(Boolean).join('  ');
    return [consoleLine(ts, 'process', '*', '', 'run_end', content, ids), '', ''];
  }
  const items = state?.items ? `${state.items} items, ${state.itemsOk} ok` : '';
  const content = [statusMarker(record), ms, items, reason, outputs].filter(Boolean).join('  ');
  if ('item' in attributes) {
    const parent = openSpans.get(String(record.parent_span_id ?? ''));
    if (parent) {
      parent.items += 1;
      parent.itemsOk += record.status === 'error' ? 0 : 1;
    }
    return [consoleLine(ts, 'process', '<', '', step, content, ids), ''];
  }
  return [consoleLine(ts, 'process', '<', 'OUT', step, content, ids), '', ''];
}
