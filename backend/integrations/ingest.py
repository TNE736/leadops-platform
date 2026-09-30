"""CSV ingestion, in reading order: the response contract, the row schema, CSV helpers, the
consultant-file check, the row loop, and the MongoDB write.

Roster CSVs (first_name, email, ... and no company_id) are validated against ConsultantProfile,
de-duplicated by email and inserted with the starting fields the bench-outreach pipeline expects.
Consultants already in the collection are never touched, so their pipeline progress and Compass
edits are safe.
"""

from __future__ import annotations

import asyncio
import csv
import io
import re
from datetime import datetime, timezone
from typing import Annotated, NotRequired, TypedDict

from opentelemetry import trace
from opentelemetry.trace import Status, StatusCode
from pydantic import AfterValidator, BaseModel, BeforeValidator, ValidationError
from pymongo.collection import Collection
from pymongo.errors import BulkWriteError, PyMongoError

from integrations_logging import current_trace_id

MAX_REPORTED_ERRORS = 200
DUPLICATE_KEY_ERROR = 11000
REQUIRED_CONSULTANT_FIELDS = {"first_name", "email"}
# ID columns from the retired lead-file format. A file carrying them is a list of client
# contacts, not consultants, so it must not be imported as a roster. A plain "Company" column
# (a consultant's employer) is still allowed.
LEAD_ID_HEADERS = {"employeeid", "empid", "companyid", "compid"}
CONSULTANT_FIELD_ALIASES: dict[str, list[str]] = {
    "first_name": ["first_name", "firstname", "fname"],
    "last_name": ["last_name", "lastname", "lname", "surname"],
    "email": ["email", "e_mail", "email_address"],
    "phone": ["phone", "phone_number", "mobile", "contact_number"],
    "technology": ["technology", "tech", "skill", "skills", "primary_skill"],
    "title": ["title", "job_title", "designation", "role"],
    "seniority": ["seniority", "level", "experience_level"],
    "visa_status": ["visa_status", "visa", "work_authorization"],
}
# A new consultant starts at stage "loaded". bench-outreach's gateway picks up every new
# consultant as it is inserted (its hand-off trigger: operation insert) and emails them.
CONSULTANT_STARTING_FIELDS = {"opted_out": False, "qualification_stage": "loaded"}
EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
PHONE_RE = re.compile(r"^[+()\-.\s\d]{7,20}$")
tracer = trace.get_tracer(__name__)


# ── Contract ─────────────────────────────────────────────────────────────────


class IngestError(Exception):
    """Request-level problem the caller should surface as a 4xx response."""

    def __init__(self, message: str, status_code: int = 400):
        super().__init__(message)
        self.status_code = status_code


class RowError(TypedDict):
    """One rejected row, shown in the upload page's error table."""

    file: str
    row: int
    key: NotRequired[str | None]
    issues: list[str]


class IngestSummary(TypedDict):
    """Response body of POST /leads/ingest (mirrored by `IngestSummary` in lib/api.ts)."""

    total: int
    valid: int
    skippedDuplicate: int
    invalid: int
    inserted: bool
    insertedCount: int
    errors: list[RowError]
    errorsOmitted: int
    dbError: NotRequired[str]


# ── Row schema ───────────────────────────────────────────────────────────────


def blank_to_none(value: object) -> str | None:
    return None if value is None else (str(value).strip() or None)


def require_text(value: object) -> str:
    text = blank_to_none(value)
    if text is None:
        raise ValueError("required")
    return text


def check_email(value: str) -> str:
    if not EMAIL_RE.match(value):
        raise ValueError("invalid email format")
    return value


def check_phone(value: str | None) -> str | None:
    if value is not None and not PHONE_RE.match(value):
        raise ValueError("invalid phone number")
    return value


OptionalText = Annotated[str | None, BeforeValidator(blank_to_none)]
RequiredText = Annotated[str, BeforeValidator(require_text)]


class ConsultantProfile(BaseModel):
    """One bench consultant. Mandatory: first_name and email (the dedupe key, stored lowercase).
    The rest serialize as null when empty; phone is format-checked whenever a value is present."""

    first_name: RequiredText
    last_name: OptionalText = None
    email: Annotated[RequiredText, AfterValidator(check_email), AfterValidator(str.lower)]
    phone: Annotated[OptionalText, AfterValidator(check_phone)] = None
    technology: OptionalText = None
    title: OptionalText = None
    seniority: OptionalText = None
    visa_status: OptionalText = None


# ── CSV helpers ──────────────────────────────────────────────────────────────


def normalize_header(header: str) -> str:
    """'E-mail Address' -> 'emailaddress', so header aliases match loosely."""
    return re.sub(r"[^a-z0-9]", "", header.lower())


# Normalized alias -> canonical field name.
CONSULTANT_HEADER_LOOKUP = {
    normalize_header(alias): field for field, names in CONSULTANT_FIELD_ALIASES.items() for alias in names
}


def build_header_map(fieldnames: list[str]) -> dict[str, str]:
    """CSV header -> canonical field. If two headers map to one field, the first wins."""
    header_map: dict[str, str] = {}
    for header in fieldnames:
        field = CONSULTANT_HEADER_LOOKUP.get(normalize_header(header))
        if field and field not in header_map.values():
            header_map[header] = field
    return header_map


def open_csv(name: str, data: bytes) -> csv.DictReader:
    try:
        text = data.decode("utf-8-sig")
    except UnicodeDecodeError as error:
        raise IngestError(f"{name}: not valid UTF-8 ({error.reason})") from error

    reader = csv.DictReader(io.StringIO(text))
    if not reader.fieldnames:
        raise IngestError(f"{name}: not a readable CSV (no header row)")
    return reader


def is_blank_row(raw: dict) -> bool:
    """True when every header cell is empty. Cells beyond the header, which csv.DictReader
    collects as a list under the `None` key, are ignored."""
    return not any((value or "").strip() for header, value in raw.items() if header is not None)


def format_validation_issues(error: ValidationError) -> list[str]:
    return [f"{'.'.join(str(part) for part in issue['loc'])}: {issue['msg']}" for issue in error.errors()]


def check_consultant_file(name: str, fieldnames: list[str]) -> None:
    """Raise IngestError unless the file is a consultant roster: first-name and email columns,
    and no employee_id / company_id columns."""
    headers = {normalize_header(header) for header in fieldnames}
    seen = ", ".join(fieldnames)
    if headers & LEAD_ID_HEADERS:
        raise IngestError(
            f"{name}: looks like a lead file (employee_id / company_id columns); "
            f"only consultant files can be uploaded (headers seen: {seen})"
        )
    if not REQUIRED_CONSULTANT_FIELDS <= {CONSULTANT_HEADER_LOOKUP.get(header) for header in headers}:
        raise IngestError(
            f"{name}: not a consultant file; it needs first_name and email columns (headers seen: {seen})"
        )


# ── Pipeline ─────────────────────────────────────────────────────────────────


async def ingest_csv_files(files: list[tuple[str, bytes]], collection: Collection) -> IngestSummary:
    """Entry point: check every file is a consultant roster, then validate, dedupe and insert."""
    if not files:
        raise IngestError("expected at least 1 CSV file, received 0")

    with tracer.start_as_current_span("check_headers", attributes={"inputs.files": [n for n, _ in files]}) as step:
        readers = [(name, open_csv(name, data)) for name, data in files]
        for name, reader in readers:
            check_consultant_file(name, reader.fieldnames)
        step.set_attribute("outputs.consultant_files", len(readers))
    return await import_consultants(readers, collection)


async def import_consultants(files: list[tuple[str, csv.DictReader]], collection: Collection) -> IngestSummary:
    errors: list[RowError] = []
    records: list[dict] = []
    seen_emails: set[str] = set()
    skipped_duplicate = 0
    rows = [
        (name, header_map, line, raw)
        for name, reader in files
        for header_map in [build_header_map(reader.fieldnames)]
        for line, raw in enumerate(reader, start=2)  # data starts after the header line
        if not is_blank_row(raw)
    ]
    total = len(rows)

    with tracer.start_as_current_span("validate_rows", attributes={"inputs.rows": total}) as step:
        for number, (name, header_map, line, raw) in enumerate(rows, start=1):
            with tracer.start_as_current_span(
                "validate_row", attributes={"item": number, "of": total, "key": f"{name}:{line}"}
            ) as item:
                candidate = {field: raw.get(header) for header, field in header_map.items()}
                try:
                    consultant = ConsultantProfile(**candidate)
                except ValidationError as error:
                    issues = format_validation_issues(error)
                    errors.append({"file": name, "row": line, "key": candidate.get("email") or None, "issues": issues})
                    item.set_status(Status(StatusCode.ERROR, "; ".join(issues)))
                    continue
                if consultant.email in seen_emails:
                    skipped_duplicate += 1
                    item.set_attribute("outputs.result", "duplicate email in this upload")
                    continue
                seen_emails.add(consultant.email)
                records.append(consultant.model_dump())
                item.set_attribute("outputs.result", "valid")
        step.set_attribute("outputs.valid", len(records))
        step.set_attribute("outputs.duplicates_in_upload", skipped_duplicate)
        step.set_attribute("outputs.skipped_keys", [f"{e['file']}:{e['row']}" for e in errors])

    summary: IngestSummary = {
        "total": total,
        "valid": len(records),
        "skippedDuplicate": skipped_duplicate,
        "invalid": total - len(records) - skipped_duplicate,
        "inserted": False,
        "insertedCount": 0,
        # The list is capped at MAX_REPORTED_ERRORS, plus how many were cut.
        "errors": errors[:MAX_REPORTED_ERRORS],
        "errorsOmitted": max(0, len(errors) - MAX_REPORTED_ERRORS),
    }
    if records:
        await persist_new_consultants(records, collection, summary)
    return summary


async def persist_new_consultants(records: list[dict], collection: Collection, summary: IngestSummary) -> None:
    """Insert consultants whose email is not stored yet and record the outcome on the summary.
    PyMongo is blocking, so each call runs off the event loop."""
    try:
        with tracer.start_as_current_span("find_existing_emails", attributes={"inputs.emails": len(records)}) as step:
            existing = await asyncio.to_thread(find_existing_emails, collection, [r["email"] for r in records])
            step.set_attribute("outputs.already_saved", len(existing))
        new_consultants = [r for r in records if r["email"] not in existing]
        summary["skippedDuplicate"] += len(records) - len(new_consultants)
        with tracer.start_as_current_span(
            "insert_consultants", attributes={"inputs.new_consultants": len(new_consultants)}
        ) as step:
            # trace_id lets bench-outreach's gateway and Email Agent join this upload's trace
            # (ConsultantField.TRACE_ID). Existing docs keep theirs.
            trace_fields = {"trace_id": trace_id} if (trace_id := current_trace_id()) else {}
            # loaded_at: when the consultant entered MongoDB (UTC), the same moment for the whole upload.
            loaded_at = datetime.now(timezone.utc)
            new_records = [
                {**r, **CONSULTANT_STARTING_FIELDS, "loaded_at": loaded_at, **trace_fields} for r in new_consultants
            ]
            inserted, raced = await asyncio.to_thread(insert_ignoring_duplicates, collection, new_records)
            step.set_attribute("outputs.inserted", inserted)
            step.set_attribute("outputs.saved_meanwhile", raced)
    except PyMongoError as error:
        summary["dbError"] = str(error)
    else:
        summary["skippedDuplicate"] += raced
        summary.update(inserted=True, insertedCount=inserted)


def find_existing_emails(collection: Collection, emails: list[str]) -> set[str]:
    return {doc["email"] for doc in collection.find({"email": {"$in": emails}}, {"email": 1})}


def insert_ignoring_duplicates(collection: Collection, records: list[dict]) -> tuple[int, int]:
    """Insert records and return (inserted, skipped). A duplicate-key error means another upload
    saved the same email between our check and this insert (the collection has a unique email
    index), so it counts as skipped."""
    if not records:
        return 0, 0
    try:
        return len(collection.insert_many(records, ordered=False).inserted_ids), 0
    except BulkWriteError as error:
        write_errors = error.details.get("writeErrors", [])
        if any(write_error.get("code") != DUPLICATE_KEY_ERROR for write_error in write_errors):
            raise
        return error.details.get("nInserted", 0), len(write_errors)
