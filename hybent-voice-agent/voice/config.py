"""
Engine configuration, read from environment variables / .env.
"""
from functools import lru_cache

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", case_sensitive=False, extra="ignore")

    @field_validator("database_url", mode="before")
    @classmethod
    def convert_database_url(cls, v):
        if isinstance(v, str):
            v = v.strip()
            if v.startswith("postgres://"):
                v = v.replace("postgres://", "postgresql+asyncpg://", 1)
            elif v.startswith("postgresql://"):
                v = v.replace("postgresql://", "postgresql+asyncpg://", 1)
        return v

    app_env: str = "development"
    database_url: str = "postgresql+asyncpg://hybent_hiring:admin123@localhost:5433/hybent_hiring_db"

    # ── Scheduler (runs inside the API process; keep exactly one API replica) ──
    scheduler_enabled: bool = True
    scheduler_interval_sec: int = 15
    stale_call_minutes: int = 30          # an IN_CALL record older than this is failed
    max_analysis_attempts: int = 5
    max_delivery_attempts: int = 12

    # ── Defaults copied into each task's config (Spec §4.3, §4.4) ──
    default_window_start: str = "09:00"
    default_window_end: str = "20:00"
    default_max_attempts: int = 3
    default_retry_gap_minutes: int = 120

    # ── Dialer: "fake" (local dev / tests) or "livekit" ──
    dialer: str = "fake"
    livekit_url: str = ""
    livekit_api_key: str = ""
    livekit_api_secret: str = ""
    livekit_agent_name: str = "hybent-agent"
    sip_outbound_trunk_id: str = ""

    # ── Models ──
    groq_api_key: str = ""
    groq_base_url: str = "https://api.groq.com/openai/v1"
    groq_call_model: str = "openai/gpt-oss-20b"
    groq_analysis_model: str = "llama-3.3-70b-versatile"
    sarvam_api_key: str = ""
    deepgram_api_key: str = ""
    cartesia_api_key: str = ""

    @property
    def is_production(self) -> bool:
        return self.app_env == "production"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
