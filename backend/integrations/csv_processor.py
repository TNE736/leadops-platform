"""LQABR_Integrations — ingestion pipeline.

parse (3 CSVs) -> index -> join (employee files on employee_id+company_id,
company files on company_id) -> lead-list rule -> validate (schema.LeadRecord)
-> decision-maker filter -> insert the eligible records into MongoDB.
Invalid rows are reported with file, line and reasons — never silently dropped.

Consultant roster files (first_name, email, … and no company_id) take a separate
path: validate (schema.ConsultantProfile) -> drop emails already in the batch or
the collection -> insert the new ones into MongoDB with the starting fields the
bench-outreach pipeline expects (see CONSULTANT_STARTING_FIELDS).
"""

from __future__ import annotations

import asyncio
import csv
import io
import re

from pydantic import ValidationError
from pymongo.collection import Collection
from pymongo.errors import BulkWriteError, PyMongoError

from schema import LEAD_FIELDS, ConsultantProfile, LeadProfile

MAX_REPORTED_ERRORS = 200

# bench-outreach reads bench_outreach.consultants. A new consultant starts at
# stage "loaded", not yet a decision maker; a person flips decision_maker in
# Compass, and bench-outreach's gateway picks that change up. Existing
# consultants are never touched, so their pipeline progress is safe.
CONSULTANT_STARTING_FIELDS = {
    "decision_maker": False,
    "opted_out": False,
    "qualification_stage": "loaded",
}
DUPLICATE_KEY_ERROR = 11000

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


CONSULTANT_ALIASES: dict[str, list[str]] = {
    "first_name": ["first_name", "firstname", "fname"],
    "last_name": ["last_name", "lastname", "lname", "surname"],
    "email": ["email", "e_mail", "email_address"],
    "phone": ["phone", "phone_number", "mobile", "contact_number"],
    "technology": ["technology", "tech", "skill", "skills", "primary_skill"],
    "title": ["title", "job_title", "designation", "role"],
    "seniority": ["seniority", "level", "experience_level"],
    "visa_status": ["visa_status", "visa", "work_authorization"],
}


def _canon(s: str) -> str:
    return re.sub(r"[^a-z0-9]", "", s.lower())


CANONICAL_LOOKUP = {
    _canon(alias): field
    for field, aliases in FIELD_ALIASES.items()
    for alias in aliases
}

CONSULTANT_LOOKUP = {
    _canon(alias): field
    for field, aliases in CONSULTANT_ALIASES.items()
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


async def run_csv_processor(
    files: list[tuple[str, bytes]], mongo_collection: Collection
) -> dict:
    if not files:
        raise IngestError("expected at least 1 CSV file, received 0")

    opened = [(name, _open_csv(name, data)) for name, data in files]
    consultant_files = [_is_consultant_file(r.fieldnames) for _, r in opened]
    if all(consultant_files):
        return await run_consultant_import(opened, mongo_collection)
    if any(consultant_files):
        raise IngestError("upload consultant files and lead files separately")

    errors: list[dict] = []

    parsed = [parse_csv_file(name, reader) for name, reader in opened]
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

        # Business rule: an employee is a lead only if present in EVERY employee-level file
        if not all(emp_hits):
            skipped_not_lead += 1
            continue

        missing_company = [
            f.name for f, h in zip(company_files, comp_hits) if not h
        ]
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

        # Business rule: only decision makers are saved.
        if leadprofiles.decision_maker_flag == "No":
            skipped_non_dm += 1
        else:
            records.append(leadprofiles.model_dump())

    summary = {
        "total": len(all_keys),
        "valid": len(records),
        "skippedNonDecisionMaker": skipped_non_dm,
        "skippedNotLead": skipped_not_lead,
        "invalid": len(all_keys)
        - len(records)
        - skipped_non_dm
        - skipped_not_lead,
        "inserted": False,
        "errors": errors[:MAX_REPORTED_ERRORS],
        "errorsOmitted": max(0, len(errors) - MAX_REPORTED_ERRORS),
    }

    if not records:
        return summary

    lead_ids = [r["employee_id"] for r in records]

    # Insert into MongoDB. PyMongo is blocking, so keep it off the event loop.
    try:
        result = await asyncio.to_thread(mongo_collection.insert_many, records)
        summary["inserted"] = True
        summary["insertedCount"] = len(result.inserted_ids)
        summary["leadIds"] = lead_ids
    except PyMongoError as e:
        summary["inserted"] = False
        summary["dbError"] = str(e)

    return summary

async def run_consultant_import(
    files: list[tuple[str, csv.DictReader]], mongo_collection: Collection
) -> dict:
    errors: list[dict] = []
    records: list[dict] = []
    seen: set[str] = set()
    total = 0
    skipped_duplicate = 0

    for name, reader in files:
        header_map: dict[str, str] = {}
        for header in reader.fieldnames:
            field = CONSULTANT_LOOKUP.get(_canon(header))
            if field and field not in header_map.values():
                header_map[header] = field

        for line, raw in enumerate(reader, start=2):
            if not any((v or "").strip() for v in raw.values()):
                continue
            total += 1
            candidate = {field: raw.get(header) for header, field in header_map.items()}
            try:
                consultant = ConsultantProfile(**candidate)
            except ValidationError as e:
                errors.append(
                    {
                        "file": name,
                        "row": line,
                        "key": candidate.get("email") or None,
                        "issues": [
                            f"{'.'.join(str(p) for p in err['loc'])}: {err['msg']}"
                            for err in e.errors()
                        ],
                    }
                )
                continue
            if consultant.email in seen:
                skipped_duplicate += 1
                continue
            seen.add(consultant.email)
            records.append(consultant.model_dump())

    summary = {
        "kind": "consultants",
        "total": total,
        "valid": len(records),
        "skippedNonDecisionMaker": 0,
        "skippedNotLead": 0,
        "skippedDuplicate": skipped_duplicate,
        "invalid": total - len(records) - skipped_duplicate,
        "inserted": False,
        "insertedCount": 0,
        "errors": errors[:MAX_REPORTED_ERRORS],
        "errorsOmitted": max(0, len(errors) - MAX_REPORTED_ERRORS),
    }

    if not records:
        return summary

    # PyMongo is blocking, so keep it off the event loop.
    def insert_new() -> int:
        existing = {
            doc["email"]
            for doc in mongo_collection.find(
                {"email": {"$in": [r["email"] for r in records]}}, {"email": 1}
            )
        }
        new = [
            {**r, **CONSULTANT_STARTING_FIELDS}
            for r in records
            if r["email"] not in existing
        ]
        summary["skippedDuplicate"] += len(records) - len(new)
        if not new:
            return 0
        try:
            return len(mongo_collection.insert_many(new, ordered=False).inserted_ids)
        except BulkWriteError as e:
            # Someone else saved the same email between our check and the insert
            # (the collection has a unique email index): count it as a duplicate.
            write_errors = e.details.get("writeErrors", [])
            if any(w.get("code") != DUPLICATE_KEY_ERROR for w in write_errors):
                raise
            summary["skippedDuplicate"] += len(write_errors)
            return e.details.get("nInserted", 0)

    try:
        summary["insertedCount"] = await asyncio.to_thread(insert_new)
        summary["inserted"] = True
    except PyMongoError as e:
        summary["dbError"] = str(e)

    return summary


def _open_csv(name: str, data: bytes) -> csv.DictReader:
    try:
        text = data.decode("utf-8-sig")
    except UnicodeDecodeError as e:
        raise IngestError(f"{name}: not valid UTF-8 ({e.reason})")

    reader = csv.DictReader(io.StringIO(text))
    if not reader.fieldnames:
        raise IngestError(f"{name}: not a readable CSV (no header row)")
    return reader


def _is_consultant_file(headers: list[str]) -> bool:
    """A consultant roster has first_name + email columns and no company_id."""
    lead_fields = {CANONICAL_LOOKUP.get(_canon(h)) for h in headers}
    consultant_fields = {CONSULTANT_LOOKUP.get(_canon(h)) for h in headers}
    return "company_id" not in lead_fields and {"first_name", "email"} <= consultant_fields


def parse_csv_file(name: str, reader: csv.DictReader) -> ParsedFile:
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
