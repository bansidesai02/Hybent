from typing import Literal

from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator

class DemoRequest(BaseModel):
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: str = Field(..., min_length=1, max_length=100)
    work_email: EmailStr
    company_name: str = Field(..., min_length=1, max_length=200)
    team_size: str = Field(..., max_length=50)
    monthly_hires: str = Field(..., max_length=50)
    hiring_challenge: str = Field(..., max_length=5000)

    @field_validator("first_name", "last_name", "company_name", "team_size", "monthly_hires", "hiring_challenge", mode="before")
    @classmethod
    def _strip(cls, v):
        return v.strip() if isinstance(v, str) else v


ContactTopic = Literal["hiring", "services"]


class ContactRequest(BaseModel):
    """The hybent.com/contact form. Every field the form shows is required:
    Hybent Hiring leads also give company size and hires a year; IT Services
    leads don't. The link context and attribution are filled in by the page."""
    # What the visitor came for. Decides the [tag] on the email to info@.
    topic: ContactTopic
    name: str = Field(..., min_length=1, max_length=120)
    email: EmailStr
    message: str = Field(..., min_length=10, max_length=5000)
    phone: str = Field(..., min_length=1, max_length=40)
    company: str = Field(..., min_length=1, max_length=200)
    location: str = Field(..., min_length=1, max_length=200)
    referrer: str = Field(..., min_length=1, max_length=200)
    # Hybent Hiring only — see _hiring_details.
    team_size: str | None = Field(None, max_length=50)
    hires_per_year: str | None = Field(None, max_length=50)
    # What the link that opened the form was about — a service page, an
    # industry, a Hire Talent role. Not asked; carried from the URL.
    service: str | None = Field(None, max_length=200)
    industry: str | None = Field(None, max_length=200)
    role: str | None = Field(None, max_length=200)

    # Recorded by the page, not typed: the site page the visitor was on before
    # /contact, where their visit started, and the outside site or campaign
    # that sent them.
    came_from: str | None = Field(None, max_length=300)
    landing_page: str | None = Field(None, max_length=300)
    external_referrer: str | None = Field(None, max_length=500)
    utm_source: str | None = Field(None, max_length=100)
    utm_medium: str | None = Field(None, max_length=100)
    utm_campaign: str | None = Field(None, max_length=200)

    # Milliseconds between the form appearing and being sent.
    elapsed_ms: int | None = Field(None, ge=0)
    # Honeypot: hidden from people, so only bots fill it in.
    website: str | None = Field(None, max_length=500)

    @field_validator(
        "name", "message", "phone", "company", "location", "referrer",
        mode="before",
    )
    @classmethod
    def _strip_required(cls, v):
        return v.strip() if isinstance(v, str) else v

    @field_validator(
        "team_size", "hires_per_year", "website", "service", "industry", "role",
        "came_from", "landing_page", "external_referrer", "utm_source", "utm_medium", "utm_campaign",
        mode="before",
    )
    @classmethod
    def _blank_to_none(cls, v):
        if isinstance(v, str):
            v = v.strip()
            return v or None
        return v

    @model_validator(mode="after")
    def _hiring_details(self):
        if self.topic == "hiring":
            missing = [f for f in ("team_size", "hires_per_year") if not getattr(self, f)]
            if missing:
                raise ValueError(f"Required for Hybent Hiring: {', '.join(missing)}")
        return self


class AssistantTurn(BaseModel):
    role: str = Field(..., pattern="^(user|assistant)$")
    content: str = Field(..., min_length=1, max_length=4000)


class AssistantRequest(BaseModel):
    """The hybent.com chatbot. The visitor's conversation so far, oldest
    first, ending with their new message."""
    messages: list[AssistantTurn] = Field(..., min_length=1, max_length=40)
