"""AG-UI Gateway — the real-time event relay for the LeadOps Live Metrics.

Two jobs:
  GET  /events   Server-Sent Events stream the browser subscribes to.
  POST /publish  Any backend service posts an AG-UI event (or a list of them)
                 here; the gateway fans it out to every connected browser.

The Next.js app reaches this via the /api/ag-ui/* rewrite (see next.config.mjs),
so the browser opens /api/ag-ui/events → localhost:4000/events.

Run from backend/gateway:  uvicorn main:app --port 4000
"""
from __future__ import annotations

import asyncio
import json
from collections import deque

import os

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

app = FastAPI(title="AG-UI Gateway")

# The browser opens the SSE stream directly (cross-origin from the Next.js UI).
# The dev server hops to :3001, :3002… whenever :3000 is busy, so allow any
# localhost port in dev; set ALLOWED_WEB_ORIGINS to the real origin(s) in production.
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get(
        "ALLOWED_WEB_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000"
    ).split(","),
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1):\d+",
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

# One queue per connected browser; publish fans out to all of them.
subscribers: set[asyncio.Queue[str]] = set()

# The last N events, kept in memory only (not persisted). Replayed to each new
# subscriber so a fresh page load / refresh shows recent activity instead of an
# empty feed. Wiped whenever this process restarts.
RECENT: deque[str] = deque(maxlen=50)


@app.get("/events")
async def events(request: Request) -> StreamingResponse:
    queue: asyncio.Queue[str] = asyncio.Queue()
    subscribers.add(queue)

    async def stream():
        try:
            yield ": connected\n\n"  # opens the stream immediately
            # Replay the recent history first so the dashboard isn't empty on load.
            for past in list(RECENT):
                yield f"data: {past}\n\n"
            while True:
                if await request.is_disconnected():
                    break
                try:
                    data = await asyncio.wait_for(queue.get(), timeout=15)
                    yield f"data: {data}\n\n"
                except asyncio.TimeoutError:
                    yield ": keepalive\n\n"  # keep the connection warm
        finally:
            subscribers.discard(queue)

    return StreamingResponse(
        stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.post("/publish")
async def publish(request: Request):
    body = await request.json()
    events = body if isinstance(body, list) else [body]
    for event in events:
        data = json.dumps(event)
        RECENT.append(data)  # remember it for replay to future subscribers
        for queue in list(subscribers):
            queue.put_nowait(data)
    return {"published": len(events), "subscribers": len(subscribers)}


@app.get("/health")
async def health():
    return {"ok": True, "subscribers": len(subscribers), "buffered": len(RECENT)}
