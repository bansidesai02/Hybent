"""The 7-day free trial: the public request form and the super admin's review."""
import re
from typing import Literal

from pydantic import BaseModel, EmailStr, Field, field_validator

COMPANY_SIZES = ("1-10", "11-50", "51-200", "201-500", "501-1000", "1000+")
INDUSTRIES = (
    "Information Technology", "Software / SaaS", "IT Services & Consulting", "Staffing & Recruiting",
    "Financial Services", "Healthcare", "Manufacturing", "Retail & E-commerce", "Education",
    "Telecommunications", "Media & Marketing", "Logistics", "Real Estate", "Other",
)
HIRES_PER_YEAR = ("1-10", "11-50", "51-200", "200+")

CompanySize = Literal["1-10", "11-50", "51-200", "201-500", "501-1000", "1000+"]
HiresPerYear = Literal["1-10", "11-50", "51-200", "200+"]

_COMPANY_LINKEDIN = re.compile(r"^https?://([a-z]{2,3}\.)?linkedin\.com/(company|school|showcase)/[^/?#\s]+/?([?#].*)?$", re.I)
_PERSONAL_LINKEDIN = re.compile(r"^https?://([a-z]{2,3}\.)?linkedin\.com/in/[^/?#\s]+/?([?#].*)?$", re.I)
_WEBSITE = re.compile(r"^(https?://)?([a-z0-9-]+\.)+[a-z]{2,}(:\d+)?(/\S*)?$", re.I)


def _with_scheme(url: str) -> str:
    return url if re.match(r"^https?://", url, re.I) else f"https://{url}"


class TrialRequestCreate(BaseModel):
    company_name: str = Field(..., min_length=2, max_length=200)
    company_website: str = Field(..., min_length=4, max_length=500)
    company_linkedin_url: str = Field(..., max_length=500)
    company_size: CompanySize | None = None
    industry: str | None = Field(None, max_length=100)
    country: str | None = Field(None, max_length=100)
    hires_per_year: HiresPerYear | None = None

    contact_name: str = Field(..., min_length=2, max_length=200)
    contact_title: str = Field(..., min_length=2, max_length=200)
    contact_email: EmailStr
    contact_phone: str = Field(..., min_length=4, max_length=40)
    contact_linkedin_url: str = Field(..., max_length=500)
    hiring_needs: str | None = Field(None, max_length=2000)
    accept_terms: bool
    # Which plan to try; the trial gets that plan's features.
    plan: Literal["standard", "pro"] = "pro"
    # From verify-code: proves the applicant owns contact_email.
    email_verification_token: str | None = Field(None, max_length=128)

    # Milliseconds between the form appearing and being sent.
    elapsed_ms: int | None = Field(None, ge=0)
    # Honeypot: hidden from people, so only bots fill it in. Not "website",
    # which this form asks for.
    homepage: str | None = Field(None, max_length=500)

    @field_validator(
        "company_name", "company_website", "company_linkedin_url",
        "contact_name", "contact_title", "contact_phone", "contact_linkedin_url",
        mode="before",
    )
    @classmethod
    def _strip(cls, v):
        return v.strip() if isinstance(v, str) else v

    @field_validator("hiring_needs", "homepage", "hires_per_year", "company_size", "industry", "country", mode="before")
    @classmethod
    def _blank_to_none(cls, v):
        if isinstance(v, str):
            v = v.strip()
            return v or None
        return v

    @field_validator("contact_email")
    @classmethod
    def _lower_email(cls, v: str) -> str:
        return v.strip().lower()

    @field_validator("company_website")
    @classmethod
    def _website(cls, v: str) -> str:
        if not _WEBSITE.match(v):
            raise ValueError("Enter your company website, e.g. https://acme.com")
        return _with_scheme(v)

    @field_validator("company_linkedin_url")
    @classmethod
    def _company_linkedin(cls, v: str) -> str:
        v = _with_scheme(v)
        if not _COMPANY_LINKEDIN.match(v):
            raise ValueError("Enter your company's LinkedIn page, e.g. https://www.linkedin.com/company/acme")
        return v

    @field_validator("contact_linkedin_url")
    @classmethod
    def _personal_linkedin(cls, v: str) -> str:
        v = _with_scheme(v)
        if not _PERSONAL_LINKEDIN.match(v):
            raise ValueError("Enter your LinkedIn profile, e.g. https://www.linkedin.com/in/your-name")
        return v

    @field_validator("industry")
    @classmethod
    def _industry(cls, v: str | None) -> str | None:
        if v is not None and v not in INDUSTRIES:
            raise ValueError("Choose an industry from the list.")
        return v

    @field_validator("accept_terms")
    @classmethod
    def _terms(cls, v: bool) -> bool:
        if not v:
            raise ValueError("Please accept the trial terms.")
        return v




class TrialExtend(BaseModel):
    days: int = Field(..., ge=1, le=7)


class TrialNotes(BaseModel):
    admin_notes: str = Field("", max_length=5000)


class TrialUpgrade(BaseModel):
    plan_name: Literal["Standard", "Pro"]


class TrialSendCode(BaseModel):
    email: EmailStr

    @field_validator("email")
    @classmethod
    def _lower(cls, v: str) -> str:
        return v.strip().lower()


class TrialVerifyCode(TrialSendCode):
    code: str = Field(..., min_length=4, max_length=10)


class TrialReplyDraft(BaseModel):
    kind: Literal["approve", "reject", "info"]
    # Free-text steer for the AI, e.g. "shorter" or the reason for a rejection.
    instructions: str = Field("", max_length=500)


class TrialReplySend(BaseModel):
    kind: Literal["approve", "reject", "info"]
    subject: str = Field(..., min_length=3, max_length=300)
    body: str = Field(..., min_length=10, max_length=8000)
    ai_generated: bool = False
    # Recorded on the request when rejecting; not sent separately.
    reason: str | None = Field(None, max_length=1000)


_HEX = re.compile(r"^#[0-9A-Fa-f]{6}$")


class TrialSetupComplete(BaseModel):
    password: str = Field(..., min_length=8, max_length=128)
    full_name: str = Field(..., min_length=2, max_length=200)
    company_name: str = Field(..., min_length=2, max_length=200)
    website: str | None = Field(None, max_length=255)
    industry: str | None = Field(None, max_length=100)
    size: str | None = Field(None, max_length=50)
    timezone: str | None = Field(None, max_length=50)
    logo_url: str | None = Field(None, max_length=500)
    brand_color: str | None = None
    email_sender_name: str | None = Field(None, max_length=120)

    @field_validator("brand_color")
    @classmethod
    def _color(cls, v):
        if v in (None, ""):
            return None
        if not _HEX.match(v):
            raise ValueError("Use a colour like #4C6FFF.")
        return v.upper()

    @field_validator("password")
    @classmethod
    def _strong(cls, v: str) -> str:
        if not (re.search(r"[A-Za-z]", v) and re.search(r"\d", v)):
            raise ValueError("Use at least 8 characters with letters and numbers.")
        return v
