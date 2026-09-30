"""The ingest API's one logging file (Logging Spec §10): OpenTelemetry spans and
standard-library log lines written as one JSON line each, plus the console renderer.

Part 1 installs the tracer provider, the FastAPI / pymongo / logging
instrumentations and the writers. Part 2 draws the records as columns, live
(LOG_CONSOLE=rendered) or from a file:  python integrations_logging.py render [-f] <file>
"""

from __future__ import annotations

import json
import logging
import os
import sys
import threading
import time
import traceback
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from opentelemetry import trace
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import ReadableSpan, SpanLimits, SpanProcessor, TracerProvider

# ── Part 1: the logging ──────────────────────────────────────────────────────

SERVICE_NAME = os.environ.get("SERVICE_NAME", "integrations")
LOG_FILE = os.environ.get("LOG_FILE", f"logs/{SERVICE_NAME}.jsonl")
LOG_CONSOLE = os.environ.get("LOG_CONSOLE", "json")
LOG_MODE = os.environ.get("LOG_MODE", "normal")
ATTRIBUTE_VALUE_MAX_CHARS = {"terse": 32, "normal": 240, "debug": None}.get(LOG_MODE, 240)
TRACE_PROJECT_ID = os.environ.get("GOOGLE_CLOUD_PROJECT", "")
SECRET_NAME_PARTS = (
    "token",
    "secret",
    "password",
    "api_key",
    "authorization",
    "auth",
    "bearer",
    "credential",
    "private_key",
    "access_key",
    "session_id",
    "cookie",
    "signature",
)
NEVER_SECRET_NAMES = (
    "gen_ai.usage.input_tokens",
    "gen_ai.usage.output_tokens",
    "llm.token_count.prompt",
    "llm.token_count.completion",
    "llm.token_count.total",
)
NEVER_SECRET_SUFFIXES = ("_name", "_source", "_ref", "_kind", "_type", "_count")
NOISY_LOGGERS = (
    "uvicorn",
    "uvicorn.error",
    "uvicorn.access",
    "fastapi",
    "pymongo",
    "asyncio",
    "multipart",
    "python_multipart",
    "opentelemetry",
)
STANDARD_LOG_RECORD_FIELDS = set(vars(logging.LogRecord("", 0, "", 0, "", (), None))) | {"message", "asctime"}

if LOG_FILE != "-":
    Path(LOG_FILE).parent.mkdir(parents=True, exist_ok=True)
log_file = open(LOG_FILE, "a", encoding="utf-8") if LOG_FILE != "-" else None  # noqa: SIM115 (open for the process)
write_lock = threading.Lock()


def redact_secret_values(attributes: dict[str, Any]) -> dict[str, Any]:
    """Returns the attributes with the value of every secret-looking name replaced by <redacted> (§3.5)."""

    def is_secret(name: str) -> bool:
        lowered = name.lower()
        if lowered in NEVER_SECRET_NAMES or lowered.endswith(NEVER_SECRET_SUFFIXES):
            return False
        return any(part in lowered for part in SECRET_NAME_PARTS)

    return {name: "<redacted>" if is_secret(name) else value for name, value in attributes.items()}


def timestamp_now() -> str:
    """Returns the current UTC time as ISO-8601 with milliseconds and a trailing Z."""
    return datetime.now(UTC).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def write_record(record: dict[str, Any]) -> None:
    """Writes one record as one JSON line to the log file, then to the console as LOG_CONSOLE says."""
    if TRACE_PROJECT_ID and record.get("trace_id"):
        record["logging.googleapis.com/trace"] = f"projects/{TRACE_PROJECT_ID}/traces/{record['trace_id']}"
    line = json.dumps(record, default=str, ensure_ascii=False)
    with write_lock:
        if log_file:
            log_file.write(line + "\n")
            log_file.flush()
        if LOG_CONSOLE == "rendered":
            for row in render_record(record):
                print(row, flush=True)
        elif LOG_CONSOLE == "json" or not log_file:
            print(line, flush=True)


def span_kind_name(span: ReadableSpan) -> str:
    """Returns SERVER, INTERNAL or CLIENT; a model provider's span counts as CLIENT, as it leaves the process."""
    attributes = span.attributes or {}
    if "gen_ai.request.model" in attributes or "llm.model_name" in attributes:
        return "CLIENT"
    return {trace.SpanKind.SERVER: "SERVER", trace.SpanKind.CLIENT: "CLIENT"}.get(span.kind, "INTERNAL")


def span_identifiers(span: ReadableSpan) -> dict[str, str]:
    """Returns the span's trace_id, span_id and (when it has one) parent_span_id as lower-case hex."""
    identifiers = {"trace_id": f"{span.context.trace_id:032x}", "span_id": f"{span.context.span_id:016x}"}
    if span.parent is not None:
        identifiers["parent_span_id"] = f"{span.parent.span_id:016x}"
    return identifiers


def belongs_to_a_run(span: ReadableSpan) -> bool:
    """Returns False for a CORS preflight and for a call made outside any run (a dashboard poll's query)."""
    attributes = span.attributes or {}
    method = attributes.get("http.request.method") or attributes.get("http.method")
    return span.parent is not None or (span.kind == trace.SpanKind.SERVER and method != "OPTIONS")


class JsonLineSpanProcessor(SpanProcessor):
    """Writes a span_start record when a span opens and a span_end record when it closes."""

    def on_start(self, span: Any, parent_context: Any = None) -> None:
        """Writes {ts, event: span_start, service, name, kind, identifiers, attributes}."""
        if belongs_to_a_run(span):
            write_record(
                {
                    "ts": timestamp_now(),
                    "event": "span_start",
                    "service": SERVICE_NAME,
                    "name": span.name,
                    "kind": span_kind_name(span),
                    **span_identifiers(span),
                    "attributes": redact_secret_values(dict(span.attributes or {})),
                }
            )

    def on_end(self, span: ReadableSpan) -> None:
        """Writes {ts, event: span_end, …, status, reason?, duration_ms, attributes, exception?}."""
        if not belongs_to_a_run(span):
            return
        record = {
            "ts": timestamp_now(),
            "event": "span_end",
            "service": SERVICE_NAME,
            "name": span.name,
            "kind": span_kind_name(span),
            **span_identifiers(span),
            "status": span.status.status_code.name.lower(),
        }
        reason = span.status.description or (span.attributes or {}).get("refusal")
        if reason:
            record["reason"] = reason
        record["duration_ms"] = round(((span.end_time or 0) - (span.start_time or 0)) / 1e6)
        record["attributes"] = redact_secret_values(dict(span.attributes or {}))
        for event in span.events:
            if event.name == "exception":
                record["exception"] = (
                    f"{event.attributes.get('exception.type')}: {event.attributes.get('exception.message')}"
                )
        write_record(record)


class JsonLineLogHandler(logging.Handler):
    """The only root handler: writes each standard-library log call as one `log` record."""

    def emit(self, log_record: logging.LogRecord) -> None:
        """Writes {ts, event: log, service, level, logger, message, trace_id?, span_id?, exception?, …fields}."""
        record: dict[str, Any] = {
            "ts": timestamp_now(),
            "event": "log",
            "service": SERVICE_NAME,
            "level": log_record.levelname.lower(),
            "logger": log_record.name,
            "message": log_record.getMessage().rstrip(),
        }
        trace_id = getattr(log_record, "otelTraceID", "0")
        if trace_id.strip("0"):
            record["trace_id"], record["span_id"] = trace_id, getattr(log_record, "otelSpanID", "")
        fields = {
            name: value
            for name, value in vars(log_record).items()
            if name not in STANDARD_LOG_RECORD_FIELDS and not name.startswith("otel")
        }
        record.update(redact_secret_values(fields))
        if log_record.exc_info and log_record.exc_info[1] is not None:
            error = log_record.exc_info[1]
            record["exception"] = f"{type(error).__name__}: {error}"
            record["traceback"] = "".join(traceback.format_exception(*log_record.exc_info)).rstrip()
        write_record(record)


def record_database_reply(span: Any, event: Any) -> None:
    """pymongo's response hook: puts a summary of the reply (never the documents) under outputs.response."""
    reply = event.reply or {}
    summary = {key: reply[key] for key in ("n", "nModified") if key in reply}
    if "cursor" in reply:
        summary["documents"] = len(reply["cursor"].get("firstBatch", []))
    if reply.get("writeErrors"):
        summary["write_errors"] = len(reply["writeErrors"])
    span.set_attribute("outputs.response", json.dumps(summary))


def current_trace_id() -> str:
    """Returns the active trace's id as 32 lower-case hex characters ('' outside a trace); read, never generated."""
    span_context = trace.get_current_span().get_span_context()
    return f"{span_context.trace_id:032x}" if span_context.is_valid else ""


def configure_logging() -> None:
    """Installs the tracer provider, this file's writers and the instrumentations; call once, first."""
    try:
        from opentelemetry.instrumentation.logging import LoggingInstrumentor
        from opentelemetry.instrumentation.pymongo import PymongoInstrumentor
    except ModuleNotFoundError as error:  # started by a Python that lacks this app's packages
        raise SystemExit(
            f"{sys.executable} does not have this app's packages (missing {error.name}). "
            "Start it with .\\scripts\\start-dev.ps1 from the repo root, "
            "or here: ..\\.venv\\Scripts\\python -m uvicorn main:app --port 8000"
        ) from error

    provider = TracerProvider(
        resource=Resource.create({"service.name": SERVICE_NAME}),
        span_limits=SpanLimits(max_attribute_length=ATTRIBUTE_VALUE_MAX_CHARS),
    )
    provider.add_span_processor(JsonLineSpanProcessor())
    if os.environ.get("OTEL_EXPORTER_OTLP_ENDPOINT"):
        from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
        from opentelemetry.sdk.trace.export import BatchSpanProcessor

        provider.add_span_processor(BatchSpanProcessor(OTLPSpanExporter()))
    trace.set_tracer_provider(provider)
    PymongoInstrumentor().instrument(capture_statement=True, response_hook=record_database_reply)
    LoggingInstrumentor().instrument(inject_trace_context=True, enable_log_auto_instrumentation=False)
    root = logging.getLogger()
    root.handlers[:] = [JsonLineLogHandler()]
    root.setLevel(logging.INFO)
    for name in NOISY_LOGGERS:
        noisy = logging.getLogger(name)
        noisy.handlers.clear()
        noisy.propagate = True
        noisy.setLevel(logging.WARNING)
    logging.getLogger("opentelemetry.attributes").setLevel(logging.ERROR)


def instrument_fastapi_app(app: Any, excluded_urls: str = "") -> None:
    """Opens a SERVER span per request (excluded_urls skipped), without spans for ASGI receive/send."""
    from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor

    FastAPIInstrumentor.instrument_app(app, excluded_urls=excluded_urls, exclude_spans=["receive", "send"])


# ── Part 2: the console renderer ─────────────────────────────────────────────

LINE_WIDTH = 200
LENGTH = "http.response_content_length"
STEP_COLUMN_WIDTH = 22
VALUE_MAX_CHARS = 60
PAYLOAD_MAX_CHARS = 130
USE_COLOUR = sys.stdout.isatty()
COLOURS = {"ok": "\033[32m", "failed": "\033[31m", "dim": "\033[2m", "reset": "\033[0m"}
open_spans: dict[str, dict[str, Any]] = {}


def paint(text: str, colour: str) -> str:
    """Returns the text wrapped in a colour code when standard output is a terminal."""
    return f"{COLOURS[colour]}{text}{COLOURS['reset']}" if USE_COLOUR and text else text


def visible_length(text: str) -> int:
    """Returns the text's width with colour codes ignored."""
    for code in COLOURS.values():
        text = text.replace(code, "")
    return len(text)


def format_value(value: Any) -> str:
    """Returns one value on one line: booleans as true/false, long lists as [N], long text cut with ' ...'."""
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, (list, tuple)):
        joined = "[" + ", ".join(format_value(item) for item in value) + "]"
        return f"[{len(value)}]" if len(value) > 3 or len(joined) > VALUE_MAX_CHARS else joined
    if isinstance(value, float):
        return f"{value:f}".rstrip("0").rstrip(".")
    text = " ".join(str(value).split())
    return text if len(text) <= VALUE_MAX_CHARS else text[:VALUE_MAX_CHARS] + " ..."


def format_payload(text: Any) -> str:
    """Returns a payload on one line, cut with ' ...' past PAYLOAD_MAX_CHARS."""
    flat = " ".join(str(text).split())
    return flat if len(flat) <= PAYLOAD_MAX_CHARS else flat[:PAYLOAD_MAX_CHARS] + " ..."


def key_value_pairs(attributes: dict[str, Any], prefix: str, skip: tuple[str, ...] = ()) -> str:
    """Returns the attributes under prefix as 'key=value  key=value', empties dropped, short values first."""
    pairs = [
        (name[len(prefix) :], format_value(value))
        for name, value in attributes.items()
        if name.startswith(prefix) and name[len(prefix) :] not in skip and value not in (None, "", [], ())
    ]
    pairs.sort(key=lambda pair: len(pair[1]) > 24)
    return "  ".join(f"{key}={value}" for key, value in pairs)


def labelled_pairs(attributes: dict[str, Any], prefix: str, skip: tuple[str, ...] = ()) -> str:
    """Returns 'in: …' or 'out: …' around key_value_pairs, or '' when there are none."""
    pairs = key_value_pairs(attributes, prefix, skip)
    return f"{'in' if prefix == 'inputs.' else 'out'}: {pairs}" if pairs else ""


def step_name_for(record: dict[str, Any]) -> str:
    """Returns the step column: the span's name, a step name plus ' n/N' for an item, the enclosing step for a call."""
    attributes = record.get("attributes", {})
    parent = open_spans.get(record.get("parent_span_id", ""), {})
    if "item" in attributes:
        return f"{parent.get('name', record['name'])} {attributes['item']}/{attributes.get('of', '?')}"
    if record.get("kind") == "CLIENT":
        return parent.get("step", record["name"])
    return record["name"]


def console_line(
    timestamp: str, stream: str, mark: str, kind: str, step: str, content: str, identifiers: dict[str, Any]
) -> str:
    """Returns one row with trace=… span=… right-aligned at LINE_WIDTH; long content wraps, never cut."""
    clock = timestamp[11:19] if len(timestamp) >= 19 else timestamp
    head = f"{clock}  {stream:<7}  {mark:<2} {kind:<4}  {step:<{STEP_COLUMN_WIDTH}}  "
    ids = (
        paint(f"trace={identifiers['trace_id']} span={identifiers.get('span_id', '')}", "dim")
        if identifiers.get("trace_id")
        else ""
    )
    room = LINE_WIDTH - len(head) - visible_length(ids) - 2
    if visible_length(content) <= room:
        return head + content + " " * (room - visible_length(content) + 2) + ids
    return f"{head}{content}\n{' ' * len(head)}{' ' * max(0, LINE_WIDTH - len(head) - visible_length(ids))}{ids}"


def status_marker(record: dict[str, Any]) -> str:
    """Returns '+ ok' or 'x failed' for a span_end record."""
    return paint("x failed", "failed") if record.get("status") == "error" else paint("+ ok", "ok")


def render_call(record: dict[str, Any], step: str) -> list[str]:
    """Returns the rows of a CLIENT span: a model call, a peer (rpc or database) call, or an http call."""
    attributes, ms = record.get("attributes", {}), f"{record.get('duration_ms', 0)} ms"
    get = lambda *names: next((attributes[n] for n in names if attributes.get(n) not in (None, "")), None)  # noqa: E731
    failure = f"  {status_marker(record)}  reason={record.get('reason', '')}" if record.get("status") == "error" else ""
    rows_after: list[tuple[str, Any]] = []
    model = get("gen_ai.request.model", "llm.model_name")
    if model:
        content = (
            f"model {model}  {ms}  in: {get('gen_ai.usage.input_tokens', 'llm.token_count.prompt') or 0} tok"
            f"  out: {record.get('status')}  {get('gen_ai.usage.output_tokens', 'llm.token_count.completion') or 0} tok"
        )
        rows_after = [
            ("in  prompt:   ", get("gen_ai.prompt", "llm.input_messages.0.message.content", "input.value")),
            ("out response: ", get("gen_ai.completion", "llm.output_messages.0.message.content", "output.value")),
        ]
    elif get("rpc.method", "db.system"):
        statement = get("inputs.query", "db.statement", "db.query.text")
        method = get("rpc.method") or f"{attributes['db.system']} {str(statement or record['name']).split()[0]}"
        host, port = get("server.address", "net.peer.name"), get("server.port", "net.peer.port")
        address = f"{host}:{port}" if host and port else host or ""
        pairs = "  ".join(
            p
            for p in (
                labelled_pairs(attributes, "inputs.", ("query",)),
                labelled_pairs(attributes, "outputs.", ("response",)),
            )
            if p
        )
        content = f"{method}  {address}  {ms}  {pairs}".rstrip()
        rows_after = [("in  query:    ", statement), ("out response: ", get("outputs.response"))]
    else:
        target = get("url.path", "http.target") or str(get("url.full", "http.url") or "").split("?")[0]
        content = (
            f"http  in: {get('http.request.method', 'http.method')} {target}  {get('server.address', 'net.peer.name')}"
            f"  out: {get('http.response.status_code', 'http.status_code')}  {ms}  "
            f"{get('http.response.body.size', LENGTH, f'{LENGTH}_uncompressed')} bytes"
            f"  {get('http.response.header.content-type') or ''}"
        )
    ids = {key: record.get(key) for key in ("trace_id", "span_id")}
    rows = [console_line(record["ts"], "audit", "->", "CALL", step, content + failure, ids)]
    rows += [
        console_line(record["ts"], "audit", "", "", "", label + format_payload(value), ids)
        for label, value in rows_after
        if value not in (None, "")
    ]
    return rows


def render_record(record: dict[str, Any]) -> list[str]:
    """Returns the console rows for one record (§6)."""
    event, kind, attributes = record.get("event"), record.get("kind"), record.get("attributes", {})
    ids = {key: record.get(key) for key in ("trace_id", "span_id")}
    ts = record.get("ts", "")
    if event == "log":
        fields = {
            k: v
            for k, v in record.items()
            if k not in ("ts", "event", "service", "level", "logger", "message", "trace_id", "span_id")
        }
        content = "  ".join([record.get("message", "")] + [f"{k}={format_value(v)}" for k, v in fields.items()])
        mark = "x" if record.get("level") in ("error", "critical") else "*"
        return [
            console_line(
                ts,
                "process" if record.get("trace_id") else "system",
                mark,
                record.get("level", "")[:4].upper(),
                record.get("logger", "")[:STEP_COLUMN_WIDTH],
                content,
                ids,
            )
        ]
    step = step_name_for(record)
    if event == "span_start":
        if kind == "CLIENT":
            return []
        inputs = labelled_pairs(attributes, "inputs.")
        parent = open_spans.get(record.get("parent_span_id", ""), {})
        open_spans[record["span_id"]] = {
            "name": record["name"],
            "step": step if kind == "INTERNAL" else "",
            "items": 0,
            "items_ok": 0,
            "inputs_shown": bool(inputs),
        }
        if kind == "SERVER":
            return [console_line(ts, "process", "*", "", "run_start", f"{record['name']}  {inputs}".rstrip(), ids)]
        if "item" in attributes:
            open_spans[record["span_id"]]["step"] = parent.get("step", step)
            return [console_line(ts, "process", ">", "", step, f"key={format_value(attributes.get('key'))}", ids)]
        return [console_line(ts, "process", ">", "IN", step, inputs, ids)]
    if kind == "CLIENT":
        return render_call(record, step)
    state = open_spans.pop(record.get("span_id", ""), {})
    reason = f"reason={record['reason']}" if record.get("reason") else ""
    outputs = labelled_pairs(attributes, "outputs.")
    if kind == "SERVER":
        inputs = "" if state.get("inputs_shown") else labelled_pairs(attributes, "inputs.")
        content = "  ".join(
            p for p in (status_marker(record), f"{record.get('duration_ms', 0)} ms", reason, inputs, outputs) if p
        )
        return [console_line(ts, "process", "*", "", "run_end", content, ids), "", ""]
    items = f"{state['items']} items, {state['items_ok']} ok" if state.get("items") else ""
    content = "  ".join(
        p for p in (status_marker(record), f"{record.get('duration_ms', 0)} ms", items, reason, outputs) if p
    )
    if "item" in attributes:
        parent = open_spans.get(record.get("parent_span_id", ""))
        if parent is not None:
            parent["items"] += 1
            parent["items_ok"] += record.get("status") != "error"
        return [console_line(ts, "process", "<", "", step, content, ids), ""]
    return [console_line(ts, "process", "<", "OUT", step, content, ids), "", ""]


def render_file(path: str, follow: bool = False) -> None:
    """Prints render_record of every line of a log file; with follow, waits for it and keeps reading."""
    while follow and not Path(path).exists():
        time.sleep(0.5)
    with open(path, encoding="utf-8") as handle:
        while True:
            line = handle.readline()
            if not line:
                if not follow:
                    return
                time.sleep(0.3)
                continue
            try:
                rows = render_record(json.loads(line))
            except (ValueError, KeyError, TypeError):
                rows = [line.rstrip("\n")]
            for row in rows:
                print(row)


def run_command_line() -> None:
    """Runs `render [-f] <file>`, the file's only command."""
    arguments = sys.argv[1:]
    if not arguments or arguments[0] != "render" or len(arguments) < 2:
        sys.exit("usage: python integrations_logging.py render [-f] <file>")
    render_file(arguments[-1], follow="-f" in arguments[1:-1])


if __name__ == "__main__":
    run_command_line()
