"""Live consultant data for the UI, read from the MongoDB consultants collection.

Stages follow bench-outreach's pipeline (consultant_fields.QualificationStage):
loaded -> emailed -> engaged -> researched -> followed_up -> qualified -> handed_off.
Each tile counts everyone who has reached that stage or gone past it.
"""

from __future__ import annotations

import asyncio

from pymongo.collection import Collection

STAGE_ORDER = [
    "loaded", "emailed", "engaged", "researched", "followed_up", "qualified", "handed_off",
]


def _reached(stage: str) -> dict:
    return {"qualification_stage": {"$in": STAGE_ORDER[STAGE_ORDER.index(stage):]}}


def _count_all(collection: Collection) -> dict:
    return {
        "consultants": collection.count_documents({}),
        "decisionMakers": collection.count_documents({"decision_maker": True}),
        "emailed": collection.count_documents(_reached("emailed")),
        "engaged": collection.count_documents(_reached("engaged")),
        "qualified": collection.count_documents(_reached("qualified")),
    }


async def fetch_metrics(collection: Collection) -> dict:
    """The five tile totals. PyMongo is blocking, so keep it off the event loop."""
    return await asyncio.to_thread(_count_all, collection)


CLOSING_STAGES = {"suppressed", "closed", "invalid", "referred"}
MAX_JOURNEY_ROWS = 1000


def _journey_rows(collection: Collection) -> list[dict]:
    rows: list[dict] = []
    projection = {"first_name": 1, "last_name": 1, "email": 1, "qualification_stage": 1}
    # Newest first: an ObjectId starts with its creation time.
    for doc in collection.find({}, projection).sort("_id", -1).limit(MAX_JOURNEY_ROWS):
        stage = doc.get("qualification_stage") or "loaded"
        # A closing stage (suppressed, closed, …) doesn't say how far they got,
        # so only "loaded" counts as reached for them.
        level = STAGE_ORDER.index(stage) if stage in STAGE_ORDER else 0
        name = " ".join(x for x in (doc.get("first_name"), doc.get("last_name")) if x)
        rows.append({
            "leadId": doc.get("email") or str(doc["_id"]),
            "label": name or doc.get("email") or str(doc["_id"]),
            "stage": stage,
            "closed": stage in CLOSING_STAGES,
            "reached": {s: i <= level for i, s in enumerate(STAGE_ORDER)},
        })
    return rows


async def fetch_journey(collection: Collection) -> list[dict]:
    """Every consultant (newest first, capped) with the stages they have reached,
    for the Lead Journey page."""
    return await asyncio.to_thread(_journey_rows, collection)
