"""LQABR_Integrations — data contract (single source of truth).

17 fields per lead record. Mandatory: employee_id, company_id,
decision_maker_flag, job_title, industry, annual_revenue_m,
frequency_of_purchase. The rest are optional and serialize as null when
empty; email/phone are format-checked whenever a value is present.
"""
from __future__ import annotations

import re

from pydantic import BaseModel, field_validator

EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
PHONE_RE = re.compile(r"^[+()\-.\s\d]{7,20}$")
REVENUE_RE = re.compile(r"^\d+(\.\d+)?$")
YES = {"yes", "y", "true", "1"}
NO = {"no", "n", "false", "0"}

OPTIONAL_FIELDS = (
    "email", "phone", "firstname", "lastname", "lead_context", "voice_status",
    "email_status", "probability", "last_modified_voice", "last_modified_email",
)
MANDATORY_FIELDS = (
    "employee_id", "company_id", "decision_maker_flag", "job_title",
    "industry", "annual_revenue_m", "frequency_of_purchase",
)


class LeadProfile(BaseModel):
    employee_id: str
    company_id: str
    decision_maker_flag: str
    job_title: str
    email: str | None = None
    phone: str | None = None
    firstname: str | None = None
    lastname: str | None = None
    industry: str
    annual_revenue_m: str
    frequency_of_purchase: str
    lead_context: str | None = None
    voice_status: str | None = None
    email_status: str | None = None
    probability: str | None = None
    last_modified_voice: str | None = None
    last_modified_email: str | None = None

    @field_validator(*OPTIONAL_FIELDS, mode="before")
    @classmethod
    def _empty_to_none(cls, v):
        if v is None:
            return None
        s = str(v).strip()
        return s or None

    @field_validator(*MANDATORY_FIELDS, mode="before")
    @classmethod
    def _required(cls, v):
        s = "" if v is None else str(v).strip()
        if not s:
            raise ValueError("required")
        return s

    @field_validator("decision_maker_flag")
    @classmethod
    def _yes_no(cls, v: str) -> str:
        low = v.lower()
        if low in YES:
            return "Yes"
        if low in NO:
            return "No"
        raise ValueError("must be Yes or No")

    @field_validator("industry")
    @classmethod
    def _uppercase(cls, v: str) -> str:
        # Business rule: industry is always emitted in capitals.
        return v.upper()

    @field_validator("annual_revenue_m")
    @classmethod
    def _revenue(cls, v: str) -> str:
        if not REVENUE_RE.match(v):
            raise ValueError('must be a number like "4.9"')
        return v

    @field_validator("email")
    @classmethod
    def _email(cls, v: str | None) -> str | None:
        if v is not None and not EMAIL_RE.match(v):
            raise ValueError("invalid email format")
        return v

    @field_validator("phone")
    @classmethod
    def _phone(cls, v: str | None) -> str | None:
        if v is not None and not PHONE_RE.match(v):
            raise ValueError("invalid phone number")
        return v


LEAD_FIELDS: tuple[str, ...] = tuple(LeadProfile.model_fields)
