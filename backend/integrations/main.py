"""backend/integrations — FastAPI service (processing + delivery).

The browser posts the 3 CSVs DIRECTLY here (2-call architecture:
browser -> FastAPI -> endpoint). Next.js only serves the UI.

POST /leads/ingest   accepts exactly three CSV files under the `files` form
                     field, runs the pipeline (parse -> join -> lead rule ->
                     validate -> DM filter), forwards the batch, returns an
                     IngestSummary.
Run from backend/integrations:  uvicorn main:app --port 8000
"""

from __future__ import annotations

import os
import uuid
from datetime import datetime, timezone
from pathlib import Path

import httpx
from fastapi import FastAPI, Header, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from csv_processor import IngestError, run_csv_processor
from hubspot_metrics import fetch_leads, fetch_metrics, verify_signature

REPO_ROOT = Path(__file__).resolve().parents[2]


def _load_env() -> None:
    """Load the repo-root .env.local into the environment so the backend and the
    frontend share one env file. HUBSPOT_* have no NEXT_PUBLIC_ prefix, so Next
    never exposes them to the browser; this loader reads them for the API.
    Shell-set vars win over the file."""
    env_path = REPO_ROOT / ".env.local"
    if not env_path.exists():
        return
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, val = line.partition("=")
        os.environ.setdefault(key.strip(), val.strip().strip('"').strip("'"))


_load_env()

GATEWAY_URL = os.environ.get("LIVE_UPDATES_GATEWAY_URL", "http://localhost:4000")


async def publish_pipeline_events(summary: dict) -> None:
    """Turn the agent's per-lead results into Live Metrics events and relay them
    to the AG-UI Gateway. Best-effort: if the gateway is down, the upload still
    succeeds — the Live Metrics just stay quiet."""
    response = summary.get("endpointResponse")
    results = response.get("results") if isinstance(response, dict) else None
    if not isinstance(results, list):
        return

    now = datetime.now(timezone.utc).isoformat()
    events: list[dict] = []
    for r in results:
        lead_id = r.get("employee_id") or r.get("lead_ref_id")
        events.append({
            "id": uuid.uuid4().hex,
            "type": "lead.created",
            "status": "success",
            "timestamp": now,
            "leadId": lead_id,
            "source": "agent-gateway",
        })
        if r.get("status") == "pushed":
            events.append({
                "id": uuid.uuid4().hex,
                "type": "crm.contact.upserted",
                "status": "success",
                "timestamp": now,
                "leadId": lead_id,
                "hubspotContactId": r.get("contact_hs_id"),
                "source": "agent-gateway",
            })

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
        lead_profile_agent_endpoint = (
            os.environ.get("UI_GATEWAY_PUBLIC_URL")
            or ""
        )
        summary = await run_csv_processor(payload, lead_profile_agent_endpoint)
    except IngestError as e:
        return JSONResponse({"error": str(e)}, status_code=e.status)

    if summary["valid"] == 0:
        return JSONResponse(summary, status_code=422)
    if not summary["forwarded"]:
        return JSONResponse(summary, status_code=502)

    await publish_pipeline_events(summary)  # light up the Live Metrics with real counts
    return summary


@app.get("/metrics/hubspot")
async def metrics_hubspot():
    """The five Live Metrics tile totals, read live from HubSpot. Called by the
    upload page on load and again whenever a change arrives over the stream."""
    return await fetch_metrics()


@app.get("/leads/hubspot")
async def leads_hubspot():
    """Every HubSpot lead with its per-stage progress, for the Lead Journey page."""
    return await fetch_leads()


@app.post("/ui/hubspots")
async def hubspot_webhook(
    request: Request,
    x_hubspot_signature: str | None = Header(default=None),
):
    """HubSpot (the UI_Gateway app) pings this whenever one of our fields
    changes. We verify it's really HubSpot, then nudge the browser to re-read
    the counts — the numbers themselves always come from HubSpot."""
    raw = await request.body()
    if not verify_signature(raw, x_hubspot_signature):
        return JSONResponse({"error": "bad signature"}, status_code=401)
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            await client.post(
                f"{GATEWAY_URL}/publish",
                json={
                    "id": uuid.uuid4().hex,
                    "type": "hubspot.changed",
                    "status": "success",
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "source": "hubspot-webhook",
                },
            )
    except httpx.HTTPError:
        pass  # gateway optional; the next page load still reads correct totals
    return {"ok": True}
