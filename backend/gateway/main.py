"""Live-updates gateway (FastAPI, :4100): the real-time event relay for the LeadOps UI.

GET  /events   Server-Sent Events stream each browser tab subscribes to (directly, via CORS).
POST /publish  Any backend service posts an event (or a list of them); it is fanned out to every tab.
GET  /health   Liveness, with subscriber and replay-buffer counts.

Run from backend/gateway:  uvicorn main:app --port 4100 --timeout-graceful-shutdown 2
"""

from __future__ import annotations

import asyncio
import json
import os
from collections import deque

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

KEEPALIVE_SECONDS = 15
REPLAY_BUFFER_SIZE = 50

app = FastAPI(title="AG-UI Gateway")

# The Next.js dev server hops to :3001, :3002… when :3000 is busy, so any
# localhost port is allowed; set ALLOWED_WEB_ORIGINS to the real origin(s) in production.
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get("ALLOWED_WEB_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(","),
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1):\d+",
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

# One queue per connected tab; publish fans out to all of them.
subscriber_queues: set[asyncio.Queue[str]] = set()
# The last events, in memory only, replayed to each new subscriber so a fresh
# page load shows recent activity. Wiped whenever this process restarts.
recent_events: deque[str] = deque(maxlen=REPLAY_BUFFER_SIZE)


def sse_frame(event_json: str) -> str:
    return f"data: {event_json}\n\n"


@app.get("/events")
async def events(request: Request) -> StreamingResponse:
    queue: asyncio.Queue[str] = asyncio.Queue()
    subscriber_queues.add(queue)

    async def event_stream():
        try:
            yield ": connected\n\n"  # opens the stream immediately
            for event_json in list(recent_events):
                yield sse_frame(event_json)
            while not await request.is_disconnected():
                try:
                    yield sse_frame(await asyncio.wait_for(queue.get(), timeout=KEEPALIVE_SECONDS))
                except TimeoutError:
                    yield ": keepalive\n\n"
        finally:
            subscriber_queues.discard(queue)

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.post("/publish")
async def publish(request: Request):
    body = await request.json()
    published = body if isinstance(body, list) else [body]
    for event in published:
        event_json = json.dumps(event)
        recent_events.append(event_json)
        for queue in list(subscriber_queues):
            queue.put_nowait(event_json)
    return {"published": len(published), "subscribers": len(subscriber_queues)}


@app.get("/health")
async def health():
    return {"ok": True, "subscribers": len(subscriber_queues), "buffered": len(recent_events)}
