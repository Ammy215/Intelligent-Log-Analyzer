"""Configuration management using pydantic-settings.

Loads all environment variables from .env file and provides
typed, validated configuration throughout the application.
"""
from pydantic import computed_field
from pydantic_settings import BaseSettings


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

        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False


# Global settings instance
settings = Settings()
