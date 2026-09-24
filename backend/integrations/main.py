"""backend/integrations — FastAPI service (processing + storage).

The browser posts the CSVs DIRECTLY here (browser -> FastAPI -> MongoDB).
Next.js only serves the UI.

POST /leads/ingest   accepts one or more CSV files under the `files` form
                     field, runs the pipeline (parse -> join -> lead rule ->
                     validate -> DM filter), inserts the eligible records into
                     MongoDB, returns an IngestSummary.
Run from backend/integrations:  uvicorn main:app --port 8000
"""

from __future__ import annotations

import os
import uuid
from datetime import datetime, timezone
from pathlib import Path

import httpx
from fastapi import FastAPI, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from csv_processor import IngestError, run_csv_processor
from mongo_metrics import fetch_journey, fetch_metrics

from db_connection import get_collection

collection = get_collection()

REPO_ROOT = Path(__file__).resolve().parents[2]


def _load_env() -> None:
    """Load the repo-root .env into the environment so the backend and the
    frontend share one env file. Server-only settings (MONGODB_*) have no
    NEXT_PUBLIC_ prefix, so Next never exposes them to the browser; this loader
    reads them for the API. Shell-set vars win over the file."""
    env_path = REPO_ROOT / ".env"
    if not env_path.exists():
        return
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, val = line.partition("=")
        os.environ.setdefault(key.strip(), val.strip().strip('"').strip("'"))


_load_env()

GATEWAY_URL = os.environ.get("LIVE_UPDATES_GATEWAY_URL", "http://127.0.0.1:4000")


async def publish_pipeline_events(summary: dict) -> None:
    """Emit one lead.created event per lead inserted into MongoDB and relay
    them to the AG-UI Gateway. Best-effort: if the gateway is down, the upload
    still succeeds — the Live Metrics just stay quiet."""
    now = datetime.now(timezone.utc).isoformat()
    events = [
        {
            "id": uuid.uuid4().hex,
            "type": "lead.created",
            "status": "success",
            "timestamp": now,
            "leadId": lead_id,
            "source": "lead-profile-agent",
        }
        for lead_id in summary.get("leadIds", [])
    ]

    if not events:
        return
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            await client.post(f"{GATEWAY_URL}/publish", json=events)
    except httpx.HTTPError:
        pass  # gateway is optional; never fail the upload because of it


app = FastAPI(title="LQABR_Integrations", docs_url="/docs")

# The upload page (Next.js dev server) calls this API cross-origin. The dev
# server hops to :3001, :3002… whenever :3000 is busy, so allow any localhost
# port in dev; set ALLOWED_WEB_ORIGINS to the real origin(s) in production.
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get(
        "ALLOWED_WEB_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000"
    ).split(","),
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1):\d+",
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/leads/ingest")
async def ingest(request: Request, files: list[UploadFile]):
    try:
        payload = [
            (f.filename or f"file{i + 1}.csv", await f.read())
            for i, f in enumerate(files)
        ]
        summary = await run_csv_processor(payload, mongo_collection=collection)
    except IngestError as e:
        return JSONResponse({"error": str(e)}, status_code=e.status)

    if summary["valid"] == 0:
        return JSONResponse(summary, status_code=422)
    if not summary["inserted"]:
        return JSONResponse(summary, status_code=503)

    await publish_pipeline_events(summary)  # light up the Live Metrics with real counts
    return summary


@app.get("/metrics/consultants")
async def metrics_consultants():
    """The five Live Metrics tile totals, read live from MongoDB. Called by the
    upload page and dashboard on load, after an upload, and on a short poll."""
    return await fetch_metrics(collection)


@app.get("/consultants/journey")
async def consultants_journey():
    """Every consultant with the pipeline stages they have reached, for the Lead
    Journey page."""
    return await fetch_journey(collection)
