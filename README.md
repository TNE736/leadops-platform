# LeadOps platform — CSV upload to MongoDB, watched live

Upload a consultant CSV in the browser; it is validated and saved into the local
MongoDB (`bench_outreach.consultants`). From there the
[bench-outreach](../bench-outreach) pipeline takes over: its gateway sees each new
consultant the moment it is inserted and hands them to its Email Agent. This app shows the whole thing as it happens.

**MongoDB is the system of record.** There is no HubSpot and no Kafka/PubSub.

```
Browser (Next.js :3000)
  ├─ POST /leads/ingest ──────────▶ Ingest API (:8000) ──insert──▶ MongoDB (WSL, rs0)
  ├─ GET  /metrics/consultants ───▶ Ingest API ──count──────────▶ MongoDB
  ├─ GET  /consultants/journey ───▶ Ingest API ──find───────────▶ MongoDB
  └─ GET  /events (SSE) ──────────▶ Live-updates gateway (:4100) ◀── POST /publish (any service)

MongoDB ──change stream──▶ bench-outreach gateway ──▶ Email Agent (:8081) ──▶ Mailgun
```

## What the upload accepts

- **Consultant files only**: a CSV with `first_name` and `email` columns.
  Optional: `last_name`, `phone`, `technology`,
  `title`, `seniority`, `visa_status`. Emails are stored lowercase.
  - New consultants are saved with `opted_out: false`, `qualification_stage: "loaded"`,
    `loaded_at` and `trace_id` — the starting state bench-outreach expects.
  - Consultants already in the database (matched on email) are skipped, never
    overwritten, so their pipeline progress and Compass edits are safe.
  - **Uploading starts the emails:** bench-outreach emails every new consultant
    automatically (its trigger in `config/handoff_trigger.yaml` is `operation: insert`).
    Upload only consultants you mean to contact.
- Files with `employee_id` / `company_id` columns (the retired lead-file format)
  are rejected with a clear message. A plain `Company` column is fine.

Rows that fail validation are listed on the page with file, line and reason.

## Running it locally (Windows)

**Quick start:** one command opens the services in their own windows, always on the
repo's own Python environment (`backend\.venv`), whatever Python is first on your PATH. It first
pings MongoDB on `127.0.0.1:27017` and opens the relay window (step 1) only if that fails:

```powershell
cd C:\Users\StephenMiller\leadops-platform
.\scripts\start-dev.ps1                  # first run also creates backend\.venv and installs everything
.\scripts\start-dev.ps1 -StubDatabase    # ingest API writes to bench_outreach_stub instead
.\scripts\start-dev.ps1 -Relay           # always start the relay
```

If PowerShell blocks scripts: `powershell -ExecutionPolicy Bypass -File .\scripts\start-dev.ps1`.
After changing `backend\pyproject.toml` or `frontend\package.json`, run `.\scripts\start-dev.ps1 -Setup` once.
In VS Code, select `backend\.venv\Scripts\python.exe` as the Python interpreter.

To start them by hand instead, use **Windows PowerShell**, one terminal each, with `backend\.venv`
activated (`.\backend\.venv\Scripts\Activate.ps1` from the repo root). MongoDB itself runs inside
WSL Ubuntu as replica set `rs0` and starts automatically with WSL.

**1. MongoDB relay** — only when Windows can't reach MongoDB by itself. WSL normally
forwards the WSL mongod to Windows `127.0.0.1:27017`, but on this machine that forwarding
drops shortly after WSL starts (Docker inside WSL breaks it). Check first:
`Test-NetConnection 127.0.0.1 -Port 27017` (or connect with Compass). If it fails, this
script carries Windows connections on `127.0.0.1:27017` into WSL:

```powershell
python C:\Users\StephenMiller\leadops-platform\backend\scripts\wsl_mongo_relay.py
```

Permanent fix instead of the relay: WSL mirrored networking (Windows 11 22H2+, WSL 2.0+).
Add `[wsl2]` / `networkingMode=mirrored` to `C:\Users\StephenMiller\.wslconfig`, run
`wsl --shutdown`, reopen Ubuntu; Windows and WSL then share `localhost` and nothing needs
relaying. Check the Docker container's ports afterwards.

**2. Live-updates gateway (:4100)**

```powershell
cd C:\Users\StephenMiller\leadops-platform\backend\gateway
uvicorn main:app --port 4100 --reload --timeout-graceful-shutdown 2
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
cd C:\Users\StephenMiller\leadops-platform\frontend
npm install   # first time only
npm run dev
```

Next.js reads the repo-root `.env` through `frontend\next.config.mjs`; restart `npm run dev`
after changing it.

Open http://localhost:3000/upload. Run **only one** `npm run dev`: two copies
share the `frontend\.next` build cache and break each other's styling. If it says it is
using port 3001, another copy is already running.

To look at the data, connect MongoDB Compass to
`mongodb://127.0.0.1:27017/?directConnection=true` → `bench_outreach` →
`consultants`.

### First-time setup

```powershell
cp .env.example .env
.\scripts\start-dev.ps1 -Setup   # creates backend\.venv, installs backend\pyproject.toml and frontend's npm dependencies
```

## Configuration (`.env`)

One `.env` at the repo root serves both sides. The ingest API loads it in
`backend/integrations/main.py`; `frontend/next.config.mjs` loads it for Next.js, which on its
own only reads `frontend/`. Variables already set in the shell win over the file.

| Variable | Used by | Default |
|---|---|---|
| `MONGODB_URI` | ingest API | `mongodb://localhost:27017/` (set to `…/?replicaSet=rs0`) |
| `MONGODB_DB` | ingest API | `bench_outreach` |
| `MONGODB_COLLECTION` | ingest API | `consultants` |
| `ALLOWED_WEB_ORIGINS` | ingest API, gateway (CORS) | `http://localhost:3000,http://127.0.0.1:3000` |
| `NEXT_PUBLIC_BACKEND_URL` | browser → ingest API | `http://127.0.0.1:8000` |
| `NEXT_PUBLIC_LIVE_UPDATES_URL` | browser → gateway SSE | `http://127.0.0.1:4100/events` |
| `NEXT_PUBLIC_LIVE_UPDATES_WS_URL` | browser → gateway WebSocket fallback | unset |

The gateway uses port 4100, not 4000: a Docker container in WSL (`agentgateway`)
takes port 4000 on Windows whenever WSL starts first. Use `127.0.0.1`, not
`localhost`, for the app's URLs.

## Pages

| Page | Shows |
|---|---|
| `/` | Landing page with the pipeline diagram |
| `/dashboard` | Consultant totals from MongoDB, live throughput, event feed |
| `/upload` | Upload CSVs; import summary; four live tiles from MongoDB |
| `/lead-journey` | Every consultant and the stages they have reached |

The four tiles (upload page) and dashboard cards refresh on load, after an
upload, whenever a live event arrives, and every 15 seconds:

| Tile | Counts |
|---|---|
| Consultants | every document |
| Emailed | stage `emailed` or later |
| Engaged | stage `engaged` or later (they replied) |
| Qualified | stage `qualified` or `handed_off` |

Stages follow bench-outreach: loaded → emailed → engaged → researched →
followed_up → qualified → handed_off (closing stages: suppressed, closed,
invalid, referred).

## API routes

### Ingest API — `backend/integrations/main.py` (`:8000`)

| Route | Does | Answers |
|---|---|---|
| `POST /leads/ingest` | Multipart `files` → validate rows, drop duplicate emails, insert new consultants | 200 saved (summary with `insertedCount`); 400 no files, unreadable CSV or a lead file; 422 zero valid rows; 503 MongoDB insert failed (`dbError` in the summary) |
| `GET /metrics/consultants` | The four tile totals, counted live in one aggregation | `{ consultants, emailed, engaged, qualified }` |
| `GET /consultants/journey` | Every consultant, newest first, max 1000 | `[{ leadId, label, stage, closed, reached }]` |

The ingest API does not publish to the gateway; pages pick up new totals through the refresh
after an upload and the 15-second poll.

### Live-updates gateway — `backend/gateway/main.py` (`:4100`)

| Route | Does | Answers |
|---|---|---|
| `GET /events` | SSE stream; replays the last 50 events to a new tab, then relays live | `data: <event JSON>` frames, `: keepalive` every 15 s |
| `POST /publish` | Any service posts one event or a JSON array; fanned out to every tab | `{ published, subscribers }` |
| `GET /health` | Liveness | `{ ok, subscribers, buffered }` |

Only the base URLs change between local and cloud (`NEXT_PUBLIC_BACKEND_URL`,
`NEXT_PUBLIC_LIVE_UPDATES_URL`, `MONGODB_*`); the paths stay the same.

## Project structure

One file per question. Components used by a single page live in that page.

```
.env / .env.example              The one settings file for both sides (see Configuration)
scripts/start-dev.ps1            Starts the whole stack; -Setup installs both sides
frontend/                        Next.js UI (:3000) — package.json, next.config.mjs, tsconfig, Tailwind, ESLint, Prettier
  app/
    layout.tsx                   Root: fonts, global CSS, mounts AGUIProvider so the stream connects on every page
    page.tsx                     Landing page (/) with its ambient background and pipeline diagram
    (app)/layout.tsx             Shell for the operational pages: TopNav + main column
    (app)/dashboard/page.tsx     KPI tiles, throughput chart, event feed, source load
    (app)/upload/page.tsx        Upload queue + in-browser row counting, dropzone, result panels, live tiles, the traced upload run
    (app)/lead-journey/page.tsx  Searchable consultant list + seven-stage timeline
    api/logs/route.ts            Receives the browser's log records → frontend/logs/frontend.jsonl + dev terminal
  components/
    shell.tsx                    Nav data, TopNav, connection pill, PageHeader
    ui.tsx                       Panel (the card), Pill, StatusBadge
    charts.tsx                   linePaths, AreaChart, RadialMeter
  hooks/useCountUp.ts            Rolling-number animation (TopNav, StatCard, RadialMeter)
  lib/
    ag-ui.tsx                    Live events: types, labels, SSE client (WebSocket fallback), provider, useAGUIState
    api.ts                       Ingest API: base URL, response types, fetchers, JOURNEY_STAGES, polling hooks
    frontend_logging.ts          OpenTelemetry in the browser + console renderer (mirrors integrations_logging.py)
    theme.ts                     Brand colours and gradients (also feeds tailwind.config.ts)
    utils.ts                     cn()
backend/                         Python services — pyproject.toml (dependencies, ruff), .venv
  integrations/                  Ingest API (FastAPI, :8000)
    main.py                      .env loading, CORS, tracing, refusal handler, the three routes
    db_connection.py             MongoDB collection from MONGODB_* settings
    ingest.py                    CSV → MongoDB: contract types, ConsultantProfile, CSV helpers, file check, row loop, insert
    queries.py                   Tile counts (one aggregation) and journey rows
    integrations_logging.py      OpenTelemetry spans + logs as JSON lines (logs/integrations.jsonl) and their console renderer
  gateway/main.py                Live-updates gateway (FastAPI, :4100): /events, /publish, /health
  scripts/wsl_mongo_relay.py     Windows ⇄ WSL MongoDB relay
```

## Logs (upload flow)

Every upload is one trace from the click to MongoDB. In the browser, `frontend/lib/frontend_logging.ts`
opens the `upload_consultants` run (`check_files`, `send_upload`, `show_result`); its records show in the
DevTools console and, via `POST /api/logs`, in the `npm run dev` terminal and `frontend/logs/frontend.jsonl`; the fetch instrumentation sends `traceparent` to the ingest API. There the
`POST /leads/ingest` run joins the same trace, its five steps (`read_uploads`,
`check_headers`, `validate_rows` with one item per CSV row, `find_existing_emails`,
`insert_consultants`) and each MongoDB call, one JSON line per record in
`backend/integrations/logs/integrations.jsonl`. Dashboard polls, `/docs` and CORS preflights are
not runs. Settings: `LOG_CONSOLE=rendered|json|file`, `LOG_MODE=terse|normal|debug`,
`LOG_FILE`, `OTEL_EXPORTER_OTLP_ENDPOINT` (browser: `NEXT_PUBLIC_LOG_CONSOLE`, `NEXT_PUBLIC_LOG_MODE`,
`NEXT_PUBLIC_OTEL_EXPORTER_OTLP_ENDPOINT`). Each new consultant document stores the upload's `trace_id`, so bench-outreach's
gateway and Email Agent join the same trace. Read a file as columns:

```powershell
python backend\integrations\integrations_logging.py render backend\integrations\logs\integrations.jsonl
```

## Code style

- Python, from `backend/`: `ruff check .` and `ruff format integrations gateway` (settings in `backend/pyproject.toml`, PEP 8, 120 columns).
- TypeScript, from `frontend/`: `npm run lint`, `npm run typecheck`, and `npx prettier --write .` (settings in `frontend/.prettierrc.json`).

## Troubleshooting

| Symptom | Fix |
|---|---|
| Upload fails with a MongoDB connection error / Compass can't connect | WSL forwarding dropped: restart with `.\scripts\start-dev.ps1 -Relay`, or start the relay (step 1). |
| `error while attempting to bind … 8000` (or 4100) | Something already runs on that port; stop it first. |
| Page shows unstyled links and huge icons | Two `npm run dev` copies ran at once. Stop both, delete `frontend\.next`, start one. |
| Header says "Connecting…" | The live-updates gateway (:4100) isn't running. |
| Gateway hangs on Ctrl+C | Close LeadOps browser tabs, or start it with `--timeout-graceful-shutdown 2`. |
