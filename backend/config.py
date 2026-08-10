"""Configuration management using pydantic-settings.

Loads all environment variables from .env file and provides
typed, validated configuration throughout the application.
"""
from pathlib import Path

from pydantic import computed_field
from pydantic_settings import BaseSettings

# Repo root's .env, resolved from this file's location rather than the
# process's working directory — uvicorn is always launched with `backend/`
# as cwd, so a plain relative ".env" here would look for backend/.env
# (which doesn't exist) and silently fall back to every field's default.
_ENV_FILE = Path(__file__).resolve().parent.parent / ".env"


class Settings(BaseSettings):
    """Application configuration from environment variables."""

    # ── MongoDB ──────────────────────────────────────
    mongodb_uri: str = "mongodb://localhost:27017"
    database_name: str = "log_analyzer"

    # ── FastAPI ──────────────────────────────────────
    app_host: str = "0.0.0.0"
    app_port: int = 8000
    debug: bool = True
    secret_key: str = "replace_with_random_64_char_string"
    allowed_origins: str = "http://localhost:8501,http://localhost:3000"

    # ── Threat Intelligence ──────────────────────────
    abuseipdb_api_key: str = ""
    otx_api_key: str = ""

    # ── Geolocation ──────────────────────────────────
    ipgeo_api_key: str = ""

    # ── AI ───────────────────────────────────────────
    openai_api_key: str = ""
    openai_model: str = "gpt-4o-mini"
    max_tokens: int = 2000

    # ── Supabase (Auth + Postgres) ─────────────────────
    # No JWT secret here on purpose: this project signs tokens with
    # asymmetric keys (ES256), verified via a public JWKS endpoint
    # (backend/middleware/auth.py) — there's no shared secret to hold.
    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_service_key: str = ""

    # ── Dashboard ────────────────────────────────────
    streamlit_server_port: int = 8501
    api_base_url: str = "http://localhost:8000/api/v1"

    # ── App Settings ─────────────────────────────────
    log_level: str = "INFO"
    max_file_size_mb: int = 50
    allowed_log_extensions: str = ".log,.txt,.xml,.evtx,.csv"

    @computed_field
    @property
    def allowed_origins_list(self) -> list[str]:
        """Parse allowed_origins as a list."""
        return [o.strip() for o in self.allowed_origins.split(",")]

    @computed_field
    @property
    def allowed_extensions_list(self) -> list[str]:
        """Parse allowed_log_extensions as a list."""
        return [e.strip() for e in self.allowed_log_extensions.split(",")]

    class Config:
        """Pydantic config for settings."""

        env_file = _ENV_FILE
        env_file_encoding = "utf-8"
        case_sensitive = False


# Global settings instance
settings = Settings()
