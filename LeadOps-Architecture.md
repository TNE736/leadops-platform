# LeadOps — Routes

All HTTP endpoints across the services, and who calls whom.

---

## Ingest API — FastAPI, `backend/integrations/main.py` (`:8000`)

### `POST /leads/ingest`
Accepts exactly three files (CSV / Excel / JSON) as multipart form-data under the field `files`.
Runs the pipeline (parse → join → validate → DM filter), forwards the valid list to the agent,
then publishes Live Flow events. Returns an `IngestSummary`.

| Status | Meaning |
|--------|---------|
| 200 | Batch forwarded (summary includes counts + agent response) |
| 400 | Wrong file count / unreadable CSV / missing key columns |
| 422 | Processed, but zero eligible records |
| 502 | Delivery to the agent failed |

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

### Ingest → Agent — `POST <LEAD_PROFILE_AGENT_ENDPOINT>`
The validated decision-maker records as a bare JSON list `[ {…17 fields…}, … ]`.
URL from env (`LEAD_PROFILE_AGENT_ENDPOINT`); optional `Authorization: Bearer <TARGET_ENDPOINT_TOKEN>`.

### Ingest → Gateway — `POST /publish`
After forwarding, one `lead.created` per lead and one `crm.contact.upserted` per pushed lead.

---

## Who calls what

```
Browser ──POST /leads/ingest──▶ Ingest API :8000
Browser ──GET  /events (SSE)──▶ Gateway   :4000

Ingest API ──POST <agent endpoint>──▶ Lead Profile Agent
Ingest API ──POST /publish──────────▶ Gateway :4000 ──(SSE)──▶ Browser
```

---

## Endpoint URLs by environment

Only the base URLs change; the paths stay the same.

| Route | Local | Cloud (env var) |
|-------|-------|-----------------|
| Ingest `POST /leads/ingest` | `http://localhost:8000` | `NEXT_PUBLIC_LEADS_API_URL` |
| Gateway `GET /events` | `http://localhost:4000/events` | `NEXT_PUBLIC_AG_UI_DIRECT_SSE_URL` |
| Gateway `POST /publish` (from ingest) | `http://localhost:4000` | `AG_UI_GATEWAY_URL` |
| Agent `POST …` | ngrok / agent URL | `LEAD_PROFILE_AGENT_ENDPOINT` |
