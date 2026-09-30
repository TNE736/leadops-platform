"""Ingest API (FastAPI, :8000). The browser calls it directly; Next.js only serves the UI.

POST /leads/ingest         CSV files under the `files` form field -> MongoDB; returns an IngestSummary
GET  /metrics/consultants  The five Live Metrics tile totals
GET  /consultants/journey  Every consultant with the pipeline stages reached

Run from backend/integrations:  uvicorn main:app --port 8000
"""

from __future__ import annotations

import logging
import os
from pathlib import Path

from fastapi import FastAPI, Request, UploadFile
from fastapi.exception_handlers import http_exception_handler, request_validation_exception_handler
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from opentelemetry import trace
from opentelemetry.trace import Status, StatusCode
from starlette.exceptions import HTTPException as StarletteHTTPException

from db_connection import get_consultants_collection
from ingest import IngestError, ingest_csv_files
from integrations_logging import configure_logging, instrument_fastapi_app
from queries import fetch_journey, fetch_metrics

configure_logging()  # before the MongoClient below, so pymongo's calls are traced
logger = logging.getLogger(__name__)
tracer = trace.get_tracer(__name__)


# NOTE: this runs before load_repo_env(), so MONGODB_* values in .env are not
# applied (only real environment variables are). Kept on purpose: changing the
# order changes which MongoDB URI is used. See refactoring decision D1.
consultants_collection = get_consultants_collection()

REPO_ENV_FILE = Path(__file__).resolve().parents[2] / ".env"
DEFAULT_WEB_ORIGINS = "http://localhost:3000,http://127.0.0.1:3000"


def load_repo_env() -> None:
    """Load the repo-root .env so the backend and frontend share one file.
    Server-only settings have no NEXT_PUBLIC_ prefix, so Next never exposes
    them to the browser. Variables already set in the shell win."""
    if not REPO_ENV_FILE.exists():
        return
    for line in REPO_ENV_FILE.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            key, _, value = line.partition("=")
            os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


load_repo_env()
logger.info(
    "mongodb target",
    extra={
        "uri_setting": "MONGODB_URI",
        "database": consultants_collection.database.name,
        "collection": consultants_collection.name,
    },
)

app = FastAPI(title="LQABR_Integrations", docs_url="/docs")

# The Next.js dev server hops to :3001, :3002… when :3000 is busy, so any
# localhost port is allowed; set ALLOWED_WEB_ORIGINS to the real origin(s) in production.
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get("ALLOWED_WEB_ORIGINS", DEFAULT_WEB_ORIGINS).split(","),
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1):\d+",
    allow_methods=["*"],
    allow_headers=["*"],
)
# The dashboard's polls and the API docs are not runs.
instrument_fastapi_app(app, excluded_urls="metrics/consultants,consultants/journey,docs,openapi.json")


class RefusalError(Exception):
    """A deliberate 4xx/5xx answer: its status code, the JSON body sent, and the reason logged."""

    def __init__(self, status_code: int, body: dict, detail: str):
        super().__init__(detail)
        self.status_code, self.body, self.detail = status_code, body, detail


def mark_run_failed(reason: str) -> None:
    """Sets the current run's status to error with the reason. The reason is also kept as the
    `refusal` attribute, because the instrumentation drops a 5xx status description when the response starts."""
    run = trace.get_current_span()
    run.set_status(Status(StatusCode.ERROR, reason))
    run.set_attribute("refusal", reason)


async def answer_refusal(request: Request, error: Exception) -> JSONResponse:
    """The one handler for every deliberate refusal: marks the run failed with 'HTTP <code>: <detail>'
    and returns the same response the route or the framework would have sent."""
    if isinstance(error, RefusalError):
        response, detail = JSONResponse(error.body, status_code=error.status_code), error.detail
    elif isinstance(error, IngestError):
        response, detail = JSONResponse({"error": str(error)}, status_code=error.status_code), str(error)
    elif isinstance(error, RequestValidationError):
        response, detail = await request_validation_exception_handler(request, error), "request validation failed"
    else:
        response, detail = await http_exception_handler(request, error), str(error.detail)
    mark_run_failed(f"HTTP {response.status_code}: {detail}")
    return response


for refusal_type in (RefusalError, IngestError, RequestValidationError, StarletteHTTPException):
    app.add_exception_handler(refusal_type, answer_refusal)


@app.post("/leads/ingest")
async def ingest(files: list[UploadFile]):
    run = trace.get_current_span()
    with tracer.start_as_current_span("read_uploads", attributes={"inputs.files": len(files)}) as step:
        uploads = [(upload.filename or f"file{i}.csv", await upload.read()) for i, upload in enumerate(files, 1)]
        step.set_attribute("outputs.file_names", [name for name, _ in uploads])
        step.set_attribute("outputs.bytes", sum(len(data) for _, data in uploads))
    run.set_attribute("inputs.file_names", [name for name, _ in uploads])
    summary = await ingest_csv_files(uploads, consultants_collection)
    for field in ("total", "valid", "invalid", "skippedDuplicate", "insertedCount"):
        run.set_attribute(f"outputs.{field}", summary[field])

    if summary["valid"] == 0:
        raise RefusalError(422, summary, "no records passed validation")
    if not summary["inserted"]:
        logger.error("MongoDB write failed", extra={"db_error": summary.get("dbError")})
        raise RefusalError(503, summary, f"MongoDB write failed: {summary.get('dbError')}")

    return summary


@app.get("/metrics/consultants")
async def metrics_consultants():
    """The five Live Metrics tile totals, read live from MongoDB. Called by the
    upload page and dashboard on load, after an upload, and on a short poll."""
    return await fetch_metrics(consultants_collection)


@app.get("/consultants/journey")
async def consultants_journey():
    """Every consultant with the pipeline stages they have reached, for the Lead
    Journey page."""
    return await fetch_journey(consultants_collection)
