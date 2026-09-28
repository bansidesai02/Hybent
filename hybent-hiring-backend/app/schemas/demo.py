from pydantic import BaseModel, EmailStr, Field, field_validator

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


class ContactRequest(BaseModel):
    """The hybent.com/contact form. Name, email and message are required;
    the rest is optional context."""
    name: str = Field(..., min_length=1, max_length=120)
    email: EmailStr
    message: str = Field(..., min_length=10, max_length=5000)
    phone: str | None = Field(None, max_length=40)
    company: str | None = Field(None, max_length=200)
    country: str | None = Field(None, max_length=100)
    location: str | None = Field(None, max_length=200)
    referrer: str | None = Field(None, max_length=200)
    # Honeypot: hidden from people, so only bots fill it in.
    website: str | None = Field(None, max_length=500)

    @field_validator("name", "message", mode="before")
    @classmethod
    def _strip_required(cls, v):
        return v.strip() if isinstance(v, str) else v

    @field_validator("phone", "company", "country", "location", "referrer", "website", mode="before")
    @classmethod
    def _blank_to_none(cls, v):
        if isinstance(v, str):
            v = v.strip()
            return v or None
        return v
