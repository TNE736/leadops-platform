# LeadOps platform — CSV upload to MongoDB, watched live

Upload a consultant CSV in the browser; it is validated and saved into the local
MongoDB (`bench_outreach.consultants`). From there the
[bench-outreach](../bench-outreach) pipeline takes over: a person marks a
consultant `decision_maker: true` in Compass, and bench-outreach's gateway hands
them to its Email Agent. This app shows the whole thing as it happens.

**MongoDB is the system of record.** There is no HubSpot and no Kafka/PubSub.

```
Browser (Next.js :3000)
  ├─ POST /leads/ingest ──────────▶ Ingest API (:8000) ──insert──▶ MongoDB (WSL, rs0)
  ├─ GET  /metrics/consultants ───▶ Ingest API ──count──────────▶ MongoDB
  ├─ GET  /consultants/journey ───▶ Ingest API ──find───────────▶ MongoDB
  └─ GET  /events (SSE) ──────────▶ Live-updates gateway (:4000)
                                          ▲
                        Ingest API ──POST /publish

MongoDB ──change stream──▶ bench-outreach gateway ──▶ Email Agent (:8081) ──▶ Mailgun
```

## What the upload accepts

- **Consultant files** (the normal case): a CSV with `first_name` and `email`
  columns and no `company_id`. Optional: `last_name`, `phone`, `technology`,
  `title`, `seniority`, `visa_status`. Emails are stored lowercase.
  - New consultants are saved with `decision_maker: false`, `opted_out: false`,
    `qualification_stage: "loaded"` — the starting state bench-outreach expects.
  - Consultants already in the database (matched on email) are skipped, never
    overwritten, so their pipeline progress and Compass edits are safe.
  - Uploading does **not** start any emails. Flipping `decision_maker` to `true`
    in Compass does.
- **Lead files**: employee + company CSVs joined on `employee_id` /
  `company_id`, validated, and filtered to decision makers. Upload lead files and
  consultant files separately.

Rows that fail validation are listed on the page with file, line and reason.

## Running it locally (Windows)

Run everything from **Windows PowerShell**, one terminal each. MongoDB itself
runs inside WSL Ubuntu as replica set `rs0` and starts automatically with WSL.

**1. MongoDB relay** — always first. WSL's own `localhost` forwarding stops
working on this machine shortly after WSL starts (Docker inside WSL breaks it),
so this script carries Windows connections on `127.0.0.1:27017` into WSL:

```powershell
python C:\Users\StephenMiller\leadops-platform\scripts\wsl_mongo_relay.py
```

**2. Live-updates gateway (:4000)**

```powershell
cd C:\Users\StephenMiller\leadops-platform\backend\gateway
uvicorn main:app --port 4000 --reload --timeout-graceful-shutdown 2
```

`--timeout-graceful-shutdown` matters: open browser tabs hold a live stream, and
without it Ctrl+C waits forever for them.

**3. Ingest API (:8000)**

```powershell
cd C:\Users\StephenMiller\leadops-platform\backend\integrations
uvicorn main:app --port 8000 --reload
```

It reads the repo-root `.env` at startup; restart it after changing `.env`
(`--reload` only watches `.py` files).

**4. UI (:3000)**

```powershell
cd C:\Users\StephenMiller\leadops-platform
npm install   # first time only
npm run dev
```

Open http://localhost:3000/upload. Run **only one** `npm run dev`: two copies
share the `.next` build cache and break each other's styling. If it says it is
using port 3001, another copy is already running.

To look at the data, connect MongoDB Compass to
`mongodb://127.0.0.1:27017/?directConnection=true` → `bench_outreach` →
`consultants`.

### First-time setup

```powershell
cp .env.example .env
pip install fastapi uvicorn httpx python-multipart pymongo
```

## Configuration (`.env`)

| Variable | Used by | Default |
|---|---|---|
| `MONGODB_URI` | ingest API | `mongodb://localhost:27017/` (set to `…/?replicaSet=rs0`) |
| `MONGODB_DB` | ingest API | `bench_outreach` |
| `MONGODB_COLLECTION` | ingest API | `consultants` |
| `LIVE_UPDATES_GATEWAY_URL` | ingest API → gateway | `http://127.0.0.1:4000` |
| `ALLOWED_WEB_ORIGINS` | ingest API, gateway (CORS) | `http://localhost:3000,http://127.0.0.1:3000` |
| `NEXT_PUBLIC_BACKEND_URL` | browser → ingest API | `http://127.0.0.1:8000` |
| `NEXT_PUBLIC_LIVE_UPDATES_URL` | browser → gateway SSE | `http://127.0.0.1:4000/events` |
| `NEXT_PUBLIC_LIVE_UPDATES_WS_URL` | browser → gateway WebSocket fallback | unset |

Use `127.0.0.1`, not `localhost`, for ports 4000 and 8000: a Docker container in
WSL (`agentgateway`) also answers on `localhost:4000` over IPv6.

## Pages

| Page | Shows |
|---|---|
| `/` | Landing page with the pipeline diagram |
| `/dashboard` | Consultant totals from MongoDB, live throughput, event feed |
| `/upload` | Upload CSVs; import summary; five live tiles from MongoDB |
| `/lead-journey` | Every consultant and the stages they have reached |

The five tiles (upload page) and dashboard cards refresh on load, after an
upload, whenever a live event arrives, and every 15 seconds:

| Tile | Counts |
|---|---|
| Consultants | every document |
| Decision makers | `decision_maker: true` |
| Emailed | stage `emailed` or later |
| Engaged | stage `engaged` or later (they replied) |
| Qualified | stage `qualified` or `handed_off` |

Stages follow bench-outreach: loaded → emailed → engaged → researched →
followed_up → qualified → handed_off (closing stages: suppressed, closed,
invalid, referred).

## Project structure

```
app/
  page.tsx                     Landing page
  (app)/dashboard/page.tsx     Overview KPIs + live feed
  (app)/upload/page.tsx        CSV upload, import summary, live tiles
  (app)/lead-journey/page.tsx  Per-consultant stage progress
components/                    Layout (TopNav, nav.ts), panels, charts, upload dropzone
hooks/
  useConsultantMetrics.ts      Tile totals from GET /metrics/consultants (shared)
lib/ag-ui/
  types.ts                     Event types, stage labels, LEAD_JOURNEY stages
  client.ts / provider.tsx     SSE client (WebSocket fallback) and React state
backend/integrations/          Ingest API (FastAPI, :8000)
  main.py                      Routes: /leads/ingest, /metrics/consultants, /consultants/journey
  csv_processor.py             Parse, validate, dedupe, insert (consultants and leads)
  schema.py                    ConsultantProfile and LeadProfile validation
  mongo_metrics.py             Tile counts and journey rows from MongoDB
  db_connection.py             MongoDB collection from MONGODB_* settings
backend/gateway/main.py        Live-updates gateway (FastAPI, :4000): /events, /publish, /health
scripts/wsl_mongo_relay.py     Windows ⇄ WSL MongoDB relay
LeadOps-Architecture.md        Every endpoint and who calls whom
```

## Troubleshooting

| Symptom | Fix |
|---|---|
| Upload fails with a MongoDB connection error / Compass can't connect | Start the relay (step 1). |
| `error while attempting to bind … 8000` (or 4000) | Something already runs on that port; stop it first. |
| Page shows unstyled links and huge icons | Two `npm run dev` copies ran at once. Stop both, delete `.next`, start one. |
| Header says "Connecting…" | The live-updates gateway (:4000) isn't running. |
| Gateway hangs on Ctrl+C | Close LeadOps browser tabs, or start it with `--timeout-graceful-shutdown 2`. |
