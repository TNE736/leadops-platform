# LeadOps — Routes

All HTTP endpoints across the services, and who calls whom.

---

## Ingest API — FastAPI, `backend/integrations/main.py` (`:8000`)

### `POST /leads/ingest`
Accepts one or more CSV files as multipart form-data under the field `files`.
Runs the pipeline (parse → join → validate → DM filter), inserts the valid records into MongoDB,
then publishes Live Flow events. Returns an `IngestSummary`.

| Status | Meaning |
|--------|---------|
| 200 | Batch saved (summary includes counts + `insertedCount`) |
| 400 | Wrong file count / unreadable CSV / missing key columns |
| 422 | Processed, but zero eligible records |
| 503 | MongoDB insert failed (`dbError` in the summary) |

### `GET /metrics/consultants`
The five Live Metrics tile totals, counted live from MongoDB: `consultants`, `decisionMakers`,
`emailed`, `engaged`, `qualified` (each stage tile counts that stage or later).

### `GET /consultants/journey`
Every consultant (newest first, max 1000) with `stage`, `closed` and a `reached` map over
bench-outreach's stages, for the Lead Journey page.

---

## Gateway — FastAPI, `backend/gateway/main.py` (`:4000`)

### `GET /events`
Server-Sent Events stream. The browser subscribes here and receives every published event live.
Sends CORS headers for the UI origin.

### `POST /publish`
Any service posts an event (or a JSON array of events) here; the gateway fans it out to every
connected browser. Returns `{ published, subscribers }`.

### `GET /health`
Liveness check. Returns `{ ok: true, subscribers }`.

---

## Outbound calls the backend makes

### Ingest → MongoDB
The validated decision-maker records are inserted with `insert_many` into the collection set by
`MONGODB_URI` / `MONGODB_DB` / `MONGODB_COLLECTION` (defaults: `localhost:27017`, `bench_outreach.consultants`).

### Ingest → Gateway — `POST /publish`
After a successful insert, one `lead.created` per saved lead.

---

## Who calls what

```
Browser ──POST /leads/ingest──▶ Ingest API :8000
Browser ──GET  /events (SSE)──▶ Gateway   :4000

Ingest API ──insert_many───────────▶ MongoDB
Ingest API ──POST /publish──────────▶ Gateway :4000 ──(SSE)──▶ Browser
```

---

## Endpoint URLs by environment

Only the base URLs change; the paths stay the same.

| Route | Local | Cloud (env var) |
|-------|-------|-----------------|
| Ingest `POST /leads/ingest` | `http://localhost:8000` | `NEXT_PUBLIC_BACKEND_URL` |
| Gateway `GET /events` | `http://localhost:4000/events` | `NEXT_PUBLIC_LIVE_UPDATES_URL` |
| Gateway `POST /publish` (from ingest) | `http://localhost:4000` | `LIVE_UPDATES_GATEWAY_URL` |
| MongoDB | local / Atlas | `MONGODB_URI`, `MONGODB_DB`, `MONGODB_COLLECTION` |
