"""
Application configuration using pydantic-settings.
All values read from environment variables / .env file.
"""
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    from pydantic import field_validator

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

    # ── Email (SMTP) ───────────────────────────────────────────────────────────
    smtp_host: str = "smtp.gmail.com"
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from_name: str = "Hybent Hiring"
    resend_api_key: str = ""

    # ── Google Calendar ────────────────────────────────────────────────────────
    google_client_id: str = ""
    google_client_secret: str = ""
    google_redirect_uri: str = "http://localhost:8000/v1/calendar/callback"

    # ── Storage ────────────────────────────────────────────────────────────────
    upload_dir: str = "uploads"
    max_file_size_mb: int = 10

    # ── CORS ───────────────────────────────────────────────────────────────────
    frontend_url: str = "https://hybent.com"

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

    from pydantic import model_validator

    @model_validator(mode='after')
    def _strip_cloudinary_credentials(self):
        """Strip accidental leading/trailing whitespace from Cloudinary config values."""
        self.cloudinary_cloud_name = self.cloudinary_cloud_name.strip()
        self.cloudinary_api_key = self.cloudinary_api_key.strip()
        self.cloudinary_api_secret = self.cloudinary_api_secret.strip()

        if self.app_env == "production":
            if not self.database_url:
                raise ValueError("DATABASE_URL environment variable is required in production.")
            if not self.secret_key:
                raise ValueError("SECRET_KEY environment variable is required.")
        return self

    @property
    def is_production(self) -> bool:
        return self.app_env == "production"

    @property
    def max_file_size_bytes(self) -> int:
        return self.max_file_size_mb * 1024 * 1024


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
