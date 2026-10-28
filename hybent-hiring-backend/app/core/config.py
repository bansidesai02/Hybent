"""
Application configuration using pydantic-settings.
All values read from environment variables / .env file.
"""
from functools import lru_cache
from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )


    @field_validator("gemini_api_key", "groq_api_key", "huggingface_api_key", "openai_api_key", mode="before")
    @classmethod
    def strip_whitespace(cls, v):
        if isinstance(v, str):
            return v.strip()
        return v

    @field_validator("database_url", mode="before")
    @classmethod
    def convert_database_url(cls, v):
        if isinstance(v, str):
            v = v.strip()
            if v.startswith("postgres://"):
                v = v.replace("postgres://", "postgresql+asyncpg://", 1)
            elif v.startswith("postgresql://") and not v.startswith("postgresql+asyncpg://"):
                v = v.replace("postgresql://", "postgresql+asyncpg://", 1)
        return v


    # ── App ────────────────────────────────────────────────────────────────────
    app_name: str = "Hybent Hiring"
    app_env: str = "development"
    secret_key: str = ""
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60
    refresh_token_expire_days: int = 30
    # How long a super admin support (impersonation) session lasts. It can't be
    # refreshed; the super admin starts a new one.
    impersonation_session_minutes: int = 30

    # ── Database & Redis ───────────────────────────────────────────────────────
    database_url: str = "postgresql+asyncpg://postgres:root@localhost:5432/hybent_hiring_db"
    redis_url: str = "redis://localhost:6379/0"
    elasticsearch_url: str = "http://localhost:9200"

    # ── AI API Keys ────────────────────────────────────────────────────────────
    gemini_api_key: str = ""
    groq_api_key: str = ""
    mistral_api_key: str = ""
    huggingface_api_key: str = ""
    openai_api_key: str = ""

    # ── Copilot agent v2 (LangGraph) ───────────────────────────────────────────
    # COPILOT_AGENT_V2=true turns it on for every org; otherwise only the org
    # ids in COPILOT_AGENT_V2_ORGS (comma-separated) get the new agent.
    copilot_agent_v2: bool = False
    copilot_agent_v2_orgs: str = ""
    # Groq model for the agent loop; empty = the first available entry of
    # PREFERRED_TEXT_MODELS. Pick it with tests/agents/test_copilot_agent_eval.py.
    copilot_agent_model: str = ""

    def copilot_agent_v2_enabled_for(self, organization_id) -> bool:
        if self.copilot_agent_v2:
            return True
        allow = {o.strip() for o in self.copilot_agent_v2_orgs.split(",") if o.strip()}
        return str(organization_id) in allow

    # ── Candidate Screening Agent (LangGraph) ──────────────────────────────────
    # Screens each new candidate and recommends a next step for a recruiter to
    # approve. SCREENING_AGENT=true turns it on for every org; otherwise only
    # the org ids in SCREENING_AGENT_ORGS (comma-separated).
    screening_agent: bool = False
    screening_agent_orgs: str = ""

    def screening_agent_enabled_for(self, organization_id) -> bool:
        if self.screening_agent:
            return True
        allow = {o.strip() for o in self.screening_agent_orgs.split(",") if o.strip()}
        return str(organization_id) in allow

    # ── AI Calls (Hybent AI Agent voice engine, hybent-voice-agent/) ───────────
    # AI_CALLS=true turns AI calling on for every org; otherwise only the org
    # ids in AI_CALLS_ORGS (comma-separated). The engine URL, the key it gave
    # us and the secret it signs callbacks with come from its create_client.
    ai_calls: bool = False
    ai_calls_orgs: str = ""
    voice_engine_url: str = "http://localhost:8100"
    voice_api_key: str = ""
    voice_callback_secret: str = ""
    # Where the engine should POST results (this backend's public URL).
    voice_callback_url: str = "http://localhost:8000/v1/voice-calls/callbacks"
    # What one connected call minute costs us (telephony + STT + LLM + TTS +
    # LiveKit, ~Rs 3). Billed to AI credits per started minute at the usual 2x.
    voice_cost_per_minute_usd: float = 0.035

    def ai_calls_enabled_for(self, organization_id) -> bool:
        if not (self.voice_api_key and self.voice_callback_secret):
            return False
        if self.ai_calls:
            return True
        allow = {o.strip() for o in self.ai_calls_orgs.split(",") if o.strip()}
        return str(organization_id) in allow

    # ── Integrations (n8n and other machine clients) ───────────────────────────
    # Kill switch for /v1/integrations/* calls made with an integration key.
    # Off by default: keys can still be created and revoked, but none of them
    # authenticates until INTEGRATIONS_ENABLED=true.
    integrations_enabled: bool = False
    # Requests per minute allowed for each integration key (own Redis bucket,
    # separate from the per-IP limit browsers get).
    integration_rate_limit_per_minute: int = 60

    # ── Email (SMTP) ───────────────────────────────────────────────────────────
    smtp_host: str = "smtp.gmail.com"
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from_name: str = "Hybent Hiring"
    # The address every platform email is sent from and replied to, whether
    # it goes out over SMTP or Resend. SMTP_USER is only the login: it must be
    # this mailbox, or an account allowed to send as it (e.g. a Gmail "Send
    # mail as" alias), or the provider rewrites the From.
    email_from_address: str = "info@hybent.com"
    resend_api_key: str = ""

    # ── Google Calendar ────────────────────────────────────────────────────────
    google_client_id: str = ""
    google_client_secret: str = ""
    google_redirect_uri: str = "http://localhost:8000/v1/calendar/callback"

    # ── Email Accounts (per-organization integrations) ─────────────────────────
    # Encrypts OAuth tokens / SMTP passwords for organization-connected mailboxes.
    # MUST be set to a strong random value via env in real deployments.
    email_accounts_encryption_key: str = "dev-only-insecure-default-change-me"
    # Reuses the same Google OAuth client as Calendar (google_client_id/secret above) —
    # just register this additional redirect URI on that same OAuth client.
    gmail_redirect_uri: str = "http://localhost:8000/v1/email-accounts/gmail/callback"

    # ── Stripe (payments) ──────────────────────────────────────────────────────
    # Without a secret key, payments fall back to emailed requests that the
    # Hybent team invoices by hand.
    stripe_secret_key: str = ""
    stripe_webhook_secret: str = ""

    # ── Storage ────────────────────────────────────────────────────────────────
    upload_dir: str = "uploads"
    max_file_size_mb: int = 10

    # ── CORS ───────────────────────────────────────────────────────────────────
    frontend_url: str = "https://hybent.com"
    # Development only: lets one company request free trials again and again
    # (no one-trial-per-domain rule, no hourly code limit). Never set in production.
    trial_testing_mode: bool = False

    # ── Logging ────────────────────────────────────────────────────────────────
    log_level: str = "INFO"

    # ── Firebase (push notifications) ──────────────────────────────────────────
    firebase_service_account_json: str = ""

    # ── LinkedIn OAuth ─────────────────────────────────────────────────────────
    linkedin_client_id: str = ""
    linkedin_client_secret: str = ""
    linkedin_redirect_uri: str = "http://localhost:3000/v1/linkedin/callback"
    # ── Cloudinary ─────────────────────────────────────────────────────────────
    cloudinary_cloud_name: str = ""
    cloudinary_api_key: str = ""
    cloudinary_api_secret: str = ""

    # ── Supabase Storage ───────────────────────────────────────────────────────
    supabase_url: str = ""
    supabase_service_role_key: str = ""
    # Signed URL expiry in seconds (configurable per file type)
    resume_signed_url_expiry: int = 3600   # 1 hour

    @property
    def use_supabase_resume_storage(self) -> bool:
        """Production (Render) stores resumes in Supabase; local/Docker in Cloudinary."""
        return self.app_env == "production"


    @model_validator(mode='after')
    def _strip_cloudinary_credentials(self):
        """Strip accidental leading/trailing whitespace from Cloudinary config values."""
        self.cloudinary_cloud_name = self.cloudinary_cloud_name.strip()
        self.cloudinary_api_key = self.cloudinary_api_key.strip()
        self.cloudinary_api_secret = self.cloudinary_api_secret.strip()

        if self.app_env == "production" and not self.database_url:
            raise ValueError("DATABASE_URL environment variable is required in production.")
        # In every environment: an empty key signs tokens with "", which
        # anyone can forge.
        if not self.secret_key:
            raise ValueError("SECRET_KEY environment variable is required.")
        return self

    @property
    def is_production(self) -> bool:
        return self.app_env == "production"

    @property
    def stripe_enabled(self) -> bool:
        return bool(self.stripe_secret_key.strip())

    @property
    def max_file_size_bytes(self) -> int:
        return self.max_file_size_mb * 1024 * 1024


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
