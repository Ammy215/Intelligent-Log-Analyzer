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
    # No secret_key field: this app verifies Supabase-issued tokens via a
    # public JWKS endpoint (ES256), so there is no shared secret to hold.
    # The setting existed with zero consumers and told deployers to generate
    # a 64-char secret that did nothing.
    allowed_origins: str = "http://localhost:3000,http://localhost:5173"
    # Defaults to dev so /docs and /openapi.json stay on locally with no
    # extra setup — a real deploy MUST set ENVIRONMENT=production explicitly,
    # which turns them off (see main.py). Note the default is the permissive
    # one: a deploy that forgets this variable silently exposes /docs,
    # /redoc and /openapi.json. It is documented as required in .env.example
    # for that reason. Not a secrecy measure (routes stay auth-gated), just
    # not advertising the full API surface to anyone who finds the URL.
    environment: str = "development"

    # ── Threat Intelligence ──────────────────────────
    abuseipdb_api_key: str = ""
    otx_api_key: str = ""
    ipinfo_token: str = ""

    # ── Redis (Upstash REST) ──────────────────────────
    upstash_redis_rest_url: str = ""
    upstash_redis_rest_token: str = ""

    # ── Razorpay (sandbox mode only, permanently — portfolio project, ──
    # ── never goes live. Switched from Stripe: invite-only for India. ──
    razorpay_key_id: str = ""
    razorpay_key_secret: str = ""
    razorpay_webhook_secret: str = ""

    # ── Resend (transactional email, sandbox sender only) ─────
    resend_api_key: str = ""

    # ── AI ───────────────────────────────────────────
    # Gemini is the only AI provider. Switched from OpenAI: no permanent
    # free tier there, Gemini's needs no card on file — matters for a
    # portfolio project meant to stay free to run indefinitely. The OpenAI
    # settings are gone along with the client that read them; it had been
    # left at a placeholder key, which silently downgraded reports to
    # hardcoded mock text rather than failing.
    gemini_api_key: str = ""
    # Primary is flash-LITE, not flash: gemini-flash-latest was returning a
    # sustained 503 "this model is currently experiencing high demand" —
    # Google-side capacity, not a key/quota problem, since flash-lite served
    # the identical request on the same key throughout. That 503 made every
    # report endpoint fail in practice, so the proven-available model leads.
    gemini_model: str = "gemini-flash-lite-latest"
    # Tried only when the primary reports a capacity failure (503/429), so a
    # future saturation of flash-lite doesn't take reports down the way
    # flash-latest's did. Set empty to disable failover entirely.
    gemini_fallback_model: str = "gemini-flash-latest"
    max_tokens: int = 2000

    # ── Supabase (Auth + Postgres) ─────────────────────
    # No JWT secret here on purpose: this project signs tokens with
    # asymmetric keys (ES256), verified via a public JWKS endpoint
    # (backend/middleware/auth.py) — there's no shared secret to hold.
    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_service_key: str = ""

    # No streamlit_server_port / api_base_url: the Streamlit dashboard was
    # removed in Phase 0, and the frontend resolves its own backend URL from
    # VITE_API_URL at build time (frontend/src/lib/constants.js). Both had
    # zero consumers here.

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
        # Undeclared .env vars are ignored rather than crashing startup —
        # otherwise adding a key to .env ahead of the code that reads it
        # (e.g. prepping credentials for a not-yet-built phase) takes the
        # whole app down until Settings catches up.
        extra = "ignore"


# Global settings instance
settings = Settings()
