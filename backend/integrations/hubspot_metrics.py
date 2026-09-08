"""Read-only HubSpot counts for the UI tiles + webhook signature check.

All HubSpot access for the UI lives here, so if this ever needs to move behind
the HubSpot MCP instead of a direct token, only this one file changes.

Env:
  HUBSPOT_READ_TOKEN        read-only private-app token (contacts + tickets read)
  HUBSPOT_WEBHOOK_SECRET   the UI_Gateway app's Client secret (webhook signature)
"""

from __future__ import annotations

import hashlib
import hmac
import os

import httpx

BASE = "https://api.hubapi.com"

# Read at call time (not import time) so a .env loaded by main.py is picked up
# no matter the import order.
def _token() -> str:
    return os.environ.get("HUBSPOT_READ_TOKEN", "")


def _app_secret() -> str:
    return os.environ.get("HUBSPOT_WEBHOOK_SECRET", "")


async def _count(client: httpx.AsyncClient, obj: str, filters: list[dict]) -> int:
    """Return the total number of `obj` records matching `filters` (empty = all).
    Uses the Search API's `total`, so nothing but the count is transferred."""
    body: dict = {"limit": 1}
    if filters:
        body["filterGroups"] = [{"filters": filters}]
    res = await client.post(f"{BASE}/crm/v3/objects/{obj}/search", json=body)
    res.raise_for_status()
    return int(res.json().get("total", 0))


async def fetch_metrics() -> dict:
    """The five tile totals, read live from HubSpot."""
    headers = {"Authorization": f"Bearer {_token()}"}
    async with httpx.AsyncClient(timeout=10.0, headers=headers) as c:
        return {
            "leads": await _count(c, "contacts", []),
            "blogSummary": await _count(
                c, "tickets", [{"propertyName": "blog_summary", "operator": "HAS_PROPERTY"}]
            ),
            "leadContext": await _count(
                c, "contacts", [{"propertyName": "lead_context", "operator": "HAS_PROPERTY"}]
            ),
            "emailOpened": await _count(
                c, "contacts", [{"propertyName": "email_status", "operator": "EQ", "value": "OPENED"}]
            ),
            "voiceCompleted": await _count(
                c, "contacts", [{"propertyName": "voice_status", "operator": "EQ", "value": "COMPLETED"}]
            ),
        }


_STAGE_ORDER = ["blog.summary", "research.completed", "lead.context", "email.sent", "voice.completed"]


async def fetch_leads() -> list[dict]:
    """Every HubSpot lead (contact) with how far it has progressed, mapped to the
    Lead Journey milestones. Progress is inferred from the contact's fields:
      lead_context set      -> Blog Summary + Research + Lead Context reached
      email_status sent/opn -> Email reached
      voice_status COMPLETED-> Voice reached
    Stages are monotonic (a later stage implies the earlier ones)."""
    props = [
        "employee_id", "firstname", "lastname", "email",
        "lead_context", "email_status", "voice_status",
    ]
    headers = {"Authorization": f"Bearer {_token()}"}
    leads: list[dict] = []
    after: str | None = None
    async with httpx.AsyncClient(timeout=15.0, headers=headers) as c:
        while True:
            body: dict = {
                "limit": 100,
                "properties": props,
                "sorts": [{"propertyName": "createdate", "direction": "DESCENDING"}],
            }
            if after:
                body["after"] = after
            res = await c.post(f"{BASE}/crm/v3/objects/contacts/search", json=body)
            res.raise_for_status()
            data = res.json()
            for item in data.get("results", []):
                p = item.get("properties", {}) or {}
                lc = bool(p.get("lead_context"))
                es = (p.get("email_status") or "").upper()
                vs = (p.get("voice_status") or "").upper()
                email_sent = es in ("SENT", "DELIVERED", "OPENED")
                voice_done = vs == "COMPLETED"
                level = 0
                if lc:
                    level = 3
                if email_sent:
                    level = 4
                if voice_done:
                    level = 5
                reached = {stage: (i < level) for i, stage in enumerate(_STAGE_ORDER)}
                name = " ".join(x for x in (p.get("firstname"), p.get("lastname")) if x)
                label = name or p.get("email") or p.get("employee_id") or item.get("id")
                leads.append({
                    "leadId": p.get("employee_id") or item.get("id"),
                    "label": label,
                    "reached": reached,
                })
            after = data.get("paging", {}).get("next", {}).get("after")
            if not after or len(leads) >= 1000:
                break
    return leads


def verify_signature(raw_body: bytes, signature: str | None) -> bool:
    """HubSpot v1 signature: sha256(client_secret + request body).

    Tunnel-safe — it doesn't involve the request URL, so ngrok's host rewrite
    can't break it (unlike the v3 scheme, which signs the full public URL)."""
    secret = _app_secret()
    if not secret or not signature:
        return False
    computed = hashlib.sha256(
        (secret + raw_body.decode("utf-8")).encode("utf-8")
    ).hexdigest()
    return hmac.compare_digest(computed, signature)
