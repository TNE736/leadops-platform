"""Live consultant read models for the UI, from the MongoDB consultants collection.

Stages follow bench-outreach's pipeline (consultant_fields.QualificationStage),
mirrored by JOURNEY_STAGES in lib/api.ts:
loaded -> emailed -> engaged -> researched -> followed_up -> qualified -> handed_off.
Each tile counts everyone who has reached that stage or gone past it.
PyMongo is blocking, so every query runs off the event loop.
"""

from __future__ import annotations

import asyncio

from pymongo.collection import Collection

STAGE_ORDER = ["loaded", "emailed", "engaged", "researched", "followed_up", "qualified", "handed_off"]
CLOSING_STAGES = {"suppressed", "closed", "invalid", "referred"}
MAX_JOURNEY_ROWS = 1000


def _stages_from(stage: str) -> list[str]:
    """The stage and every stage after it."""
    return STAGE_ORDER[STAGE_ORDER.index(stage) :]


def _count_if(condition: dict) -> dict:
    return {"$sum": {"$cond": [condition, 1, 0]}}


# All four tiles in one pass over the collection (one round trip instead of four).
TILE_TOTALS_PIPELINE = [
    {
        "$group": {
            "_id": None,
            "consultants": {"$sum": 1},
            **{
                tile: _count_if({"$in": ["$qualification_stage", _stages_from(tile)]})
                for tile in ("emailed", "engaged", "qualified")
            },
        }
    },
    {"$project": {"_id": 0}},
]
TILE_KEYS = ("consultants", "emailed", "engaged", "qualified")


def _count_tiles(collection: Collection) -> dict[str, int]:
    totals = next(collection.aggregate(TILE_TOTALS_PIPELINE), {})
    return {key: totals.get(key, 0) for key in TILE_KEYS}


async def fetch_metrics(collection: Collection) -> dict[str, int]:
    """The four Live Metrics tile totals."""
    return await asyncio.to_thread(_count_tiles, collection)


def _journey_rows(collection: Collection) -> list[dict]:
    rows: list[dict] = []
    projection = {"first_name": 1, "last_name": 1, "email": 1, "qualification_stage": 1}
    # Newest first: an ObjectId starts with its creation time.
    for doc in collection.find({}, projection).sort("_id", -1).limit(MAX_JOURNEY_ROWS):
        stage = doc.get("qualification_stage") or "loaded"
        # A closing stage doesn't say how far they got, so only "loaded" counts as reached.
        level = STAGE_ORDER.index(stage) if stage in STAGE_ORDER else 0
        name = " ".join(part for part in (doc.get("first_name"), doc.get("last_name")) if part)
        rows.append(
            {
                "leadId": doc.get("email") or str(doc["_id"]),
                "label": name or doc.get("email") or str(doc["_id"]),
                "stage": stage,
                "closed": stage in CLOSING_STAGES,
                "reached": {step: i <= level for i, step in enumerate(STAGE_ORDER)},
            }
        )
    return rows


async def fetch_journey(collection: Collection) -> list[dict]:
    """Every consultant (newest first, capped) with the stages they have reached."""
    return await asyncio.to_thread(_journey_rows, collection)
