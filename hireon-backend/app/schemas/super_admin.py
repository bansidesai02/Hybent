from datetime import datetime
from pydantic import BaseModel, EmailStr
from typing import Any

class SubscriptionPlanOut(BaseModel):
    id: str
    name: str
    price_monthly: float
    price_yearly: float
    max_users: int
    max_jobs: int
    features: dict[str, bool]

    class Config:
        from_attributes = True


class CompanySubscriptionOut(BaseModel):
    plan_name: str
    status: str
    billing_cycle: str
    current_period_start: datetime
    current_period_end: datetime
    trial_end: datetime | None

    class Config:
        from_attributes = True


class CompanyFeatureFlagOut(BaseModel):
    flag_key: str
    is_enabled: bool

    class Config:
        from_attributes = True


class ClientOut(BaseModel):
    id: str
    name: str
    slug: str
    logo_url: str | None
    website: str | None
    industry: str | None
    size: str | None
    is_active: bool
    created_at: datetime
    plan: str
    status: str
    users_count: int
    users_limit: int
    jobs_count: int
    jobs_limit: int
    interviews_count: int
    mrr: float
    location: str | None
    flags: dict[str, bool]

    class Config:
        from_attributes = True


class ClientCreate(BaseModel):
    name: str
    slug: str
    industry: str | None = None
    size: str | None = None
    location: str | None = None
    admin_email: EmailStr
    plan_name: str = "Pro"  # Starter, Pro, Enterprise
    billing_cycle: str = "monthly"  # monthly, yearly
    trial_days: int = 14
    flags: dict[str, bool] | None = None


class ClientUpdate(BaseModel):
    name: str | None = None
    industry: str | None = None
    size: str | None = None
    location: str | None = None
    is_active: bool | None = None
    plan_name: str | None = None


class GlobalUserOut(BaseModel):
    id: str
    full_name: str
    email: str
    role: str
    client: str
    is_active: bool
    online: bool = False

    class Config:
        from_attributes = True


class SuperAdminAuditLogOut(BaseModel):
    id: str
    action: str
    module: str
    client: str
    actor: str
    created_at: datetime
    ip_address: str | None
    user_agent: str | None

    class Config:
        from_attributes = True


class ImpersonationStartRequest(BaseModel):
    reason: str


class HealthStatus(BaseModel):
    api_uptime: str = "99.9%"
    avg_latency: str = "340ms"
    errors_24h: int = 0
    db_queries_sec: int = 0
    services: list[dict[str, str]]
    cpu_percent: float = 0.0
    memory_percent: float = 0.0
    disk_percent: float = 0.0


class SMTPBrandingSecuritySettings(BaseModel):
    smtp_provider: str = "SMTP relay"
    smtp_sender_name: str = "Hirreon"
    smtp_sender_email: str = "no-reply@hirreon.com"
    require_2fa: bool = False
    session_timeout: bool = True
    ip_whitelist: bool = False
    platform_name: str = "Hirreon"
    logo_url: str | None = None
    primary_color: str = "#534AB7"


class PlatformSettingsUpdate(BaseModel):
    smtp_provider: str | None = None
    smtp_sender_name: str | None = None
    smtp_sender_email: str | None = None
    require_2fa: bool | None = None
    session_timeout: bool | None = None
    ip_whitelist: bool | None = None
    platform_name: str | None = None
    logo_url: str | None = None
    primary_color: str | None = None
