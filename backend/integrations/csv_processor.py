"""LQABR_Integrations — ingestion pipeline.

parse (3 CSVs) -> index -> join (employee files on employee_id+company_id,
company files on company_id) -> lead-list rule -> validate (schema.LeadRecord)
-> decision-maker filter -> forward the JSON batch to the target endpoint.
Invalid rows are reported with file, line and reasons — never silently dropped.
"""

from __future__ import annotations

import asyncio
import csv
import io
import os
import re

import httpx
from pydantic import ValidationError

from schema import LEAD_FIELDS, LeadProfile

FORWARD_TIMEOUT_S = 600.0
FORWARD_ATTEMPTS = 1
MAX_REPORTED_ERRORS = 200

FIELD_ALIASES: dict[str, list[str]] = {
    "employee_id": ["employee_id", "emp_id", "employeeid", "empid", "employee"],
    "company_id": ["company_id", "comp_id", "companyid", "compid", "company"],
    "decision_maker_flag": [
        "decision_maker_flag",
        "decision_maker",
        "dm_flag",
        "decisionmaker",
    ],
    "job_title": ["job_title", "title", "designation", "role"],
    "email": ["email", "e_mail", "email_address", "work_email"],
    "phone": ["phone", "phone_number", "mobile", "contact_number"],
    "firstname": ["firstname", "first_name", "fname"],
    "lastname": ["lastname", "last_name", "lname", "surname"],
    "industry": ["industry", "sector", "vertical"],
    "annual_revenue_m": [
        "annual_revenue_m",
        "annual_revenue",
        "revenue_m",
        "annual_revenue_in_m",
    ],
    "frequency_of_purchase": [
        "frequency_of_purchase",
        "purchase_frequency",
        "frequency",
    ],
    "lead_context": ["lead_context", "context", "lead_notes"],
    "voice_status": ["voice_status"],
    "email_status": ["email_status"],
    "probability": ["probability", "prob"],
    "last_modified_voice": ["last_modified_voice", "voice_last_modified"],
    "last_modified_email": ["last_modified_email", "email_last_modified"],
}


def _canon(s: str) -> str:
    return re.sub(r"[^a-z0-9]", "", s.lower())


CANONICAL_LOOKUP = {
    _canon(alias): field
    for field, aliases in FIELD_ALIASES.items()
    for alias in aliases
}


class IngestError(Exception):
    """Request-level problem the caller should surface as 4xx."""

    def __init__(self, message: str, status: int = 400):
        super().__init__(message)
        self.status = status


class ParsedFile:
    def __init__(
        self, name: str, has_employee_id: bool, rows: list[tuple[int, dict[str, str]]]
    ):
        self.name = name
        self.has_employee_id = has_employee_id
        self.rows = rows  # (csv line number, canonical-field -> value)


async def push_to_lead_profile_agent(lead_profiles: list[dict], endpoint: str) -> dict:
    """POST the lead profiles to the Lead Profile Agent as a plain list."""
    headers = {}
    token = os.environ.get("LEADS_FORWARD_AUTH_TOKEN")
    if token:
        headers["Authorization"] = f"Bearer {token}"

    last_error = ""
    async with httpx.AsyncClient(timeout=FORWARD_TIMEOUT_S) as client:
        for attempt in range(1, FORWARD_ATTEMPTS + 1):
            try:
                res = await client.post(endpoint, json=lead_profiles, headers=headers)
                if res.is_success:
                    try:
                        return {"ok": True, "endpointResponse": res.json()}
                    except ValueError:
                        return {"ok": True, "endpointResponse": None}
                if res.status_code < 500:  # contract problem — retrying cannot fix it
                    return {"ok": False, "error": f"endpoint rejected batch ({res.status_code})"}
                last_error = f"endpoint responded {res.status_code}"
            except httpx.HTTPError as e:
                last_error = str(e) or "network error"
            if attempt < FORWARD_ATTEMPTS:
                await asyncio.sleep(0.5 * 2 ** (attempt - 1))
    return {"ok": False, "error": f"{last_error} (after {FORWARD_ATTEMPTS} attempts)"}


async def run_csv_processor(
    files: list[tuple[str, bytes]], lead_profile_agent_endpoint: str
) -> dict:
    if len(files) != 3:
        raise IngestError(f"expected exactly 3 CSV files, received {len(files)}")

    errors: list[dict] = []

    parsed = [parse_csv_file(name, data) for name, data in files]
    employee_files = [p for p in parsed if p.has_employee_id]
    company_files = [p for p in parsed if not p.has_employee_id]
    if not employee_files:
        raise IngestError("at least one CSV must contain an employee_id column")

    emp_indexes = [_index_rows(p, errors) for p in employee_files]
    comp_indexes = [_index_rows(p, errors) for p in company_files]

    all_keys = {k for ix in emp_indexes for k in ix}
    records: list[dict] = []
    skipped_non_dm = 0
    skipped_not_lead = 0

    for key in all_keys:
        company_id = key.split("::", 1)[1]
        emp_hits = [ix.get(key) for ix in emp_indexes]
        comp_hits = [ix.get(company_id) for ix in comp_indexes]
        source_file = next(f for f, h in zip(employee_files, emp_hits) if h)
        first_line = next(h for h in emp_hits if h)[0]

        # Business rule: an employee is a lead only if present in EVERY
        # employee-level file — the employee-with-company file defines the
        # lead list, so an employee missing from it has no company association.
        if not all(emp_hits):
            skipped_not_lead += 1
            continue

        missing_company = [f.name for f, h in zip(company_files, comp_hits) if not h]
        if missing_company:
            errors.append(
                {
                    "file": ", ".join(missing_company),
                    "row": first_line,
                    "key": key,
                    "issues": [
                        f"no matching company row in: {', '.join(missing_company)}"
                    ],
                }
            )
            continue

        # First non-empty value wins, employee files first, in upload order.
        candidate: dict[str, str] = {}
        for field in LEAD_FIELDS:
            for hit in emp_hits + comp_hits:
                if hit and field in hit[1]:
                    candidate[field] = hit[1][field]
                    break

        try:
            leadprofiles = LeadProfile(**candidate)
        except ValidationError as e:
            errors.append(
                {
                    "file": source_file.name,
                    "row": first_line,
                    "key": key,
                    "issues": [
                        f"{'.'.join(str(p) for p in err['loc'])}: {err['msg']}"
                        for err in e.errors()
                    ],
                }
            )
            continue

        # Business rule: only decision makers are pushed downstream.
        if leadprofiles.decision_maker_flag == "No":
            skipped_non_dm += 1
        else:
            records.append(leadprofiles.model_dump())

    summary = {
        "total": len(all_keys),
        "valid": len(records),
        "skippedNonDecisionMaker": skipped_non_dm,
        "skippedNotLead": skipped_not_lead,
        "invalid": len(all_keys) - len(records) - skipped_non_dm - skipped_not_lead,
        "forwarded": False,
        "targetUrl": lead_profile_agent_endpoint,
        "errors": errors[:MAX_REPORTED_ERRORS],
        "errorsOmitted": max(0, len(errors) - MAX_REPORTED_ERRORS),
    }

    if not records:
        return summary  # caller answers 422

    forward = await push_to_lead_profile_agent(records, lead_profile_agent_endpoint)
    summary["forwarded"] = forward["ok"]
    summary["endpointResponse"] = forward.get("endpointResponse")
    if not forward["ok"]:
        summary["forwardError"] = forward["error"]
    return summary


def parse_csv_file(name: str, data: bytes) -> ParsedFile:
    try:
        text = data.decode("utf-8-sig")
    except UnicodeDecodeError as e:
        raise IngestError(f"{name}: not valid UTF-8 ({e.reason})")

    reader = csv.DictReader(io.StringIO(text))
    if not reader.fieldnames:
        raise IngestError(f"{name}: not a readable CSV (no header row)")

    header_map: dict[str, str] = {}
    for header in reader.fieldnames:
        field = CANONICAL_LOOKUP.get(_canon(header))
        if field and field not in header_map.values():
            header_map[header] = field
    if "company_id" not in header_map.values():
        raise IngestError(
            f"{name}: could not find a company_id column (headers seen: {', '.join(reader.fieldnames)})"
        )

    rows: list[tuple[int, dict[str, str]]] = []
    for line, raw in enumerate(reader, start=2):  # data starts after the header line
        if not any((v or "").strip() for v in raw.values()):
            continue
        values = {
            field: str(raw[header]).strip()
            for header, field in header_map.items()
            if raw.get(header) is not None and str(raw[header]).strip()
        }
        rows.append((line, values))

    return ParsedFile(name, "employee_id" in header_map.values(), rows)


def _index_rows(
    file: ParsedFile, errors: list[dict]
) -> dict[str, tuple[int, dict[str, str]]]:
    """Employee files index by 'employee_id::company_id'; company files by company_id."""
    index: dict[str, tuple[int, dict[str, str]]] = {}
    for line, values in file.rows:
        emp, comp = values.get("employee_id"), values.get("company_id")
        if not comp or (file.has_employee_id and not emp):
            errors.append(
                {
                    "file": file.name,
                    "row": line,
                    "issues": ["missing employee_id or company_id"],
                }
            )
            continue
        key = f"{emp}::{comp}" if file.has_employee_id else comp
        if key in index:
            errors.append(
                {
                    "file": file.name,
                    "row": line,
                    "key": key,
                    "issues": ["duplicate key — later row kept"],
                }
            )
        index[key] = (line, values)
    return index
