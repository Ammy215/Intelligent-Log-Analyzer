"""Redis-backed rate limiting (Upstash REST counters, fixed-window).

Phase 11 finding: this was specified since the original rebuild plan
(§8: auth 10/15min, ingest 60/min, AI analyst 5/min, global 200/15min)
but never actually built — same class of gap as Phase 10's audit_logs
(declared in the spec, never wired up). Built now.

Fixed-window via INCR + EXPIRE-on-first-hit: not a true sliding window,
but simple, exactly what "Redis counters" in the spec means, and correct
enough for this project's actual threat model (a portfolio app, not a
bank). Fails OPEN on any Redis failure — same philosophy as
threat_intel/redis_cache.py: an Upstash outage must degrade to
"no rate limiting" rather than take the whole API down. That's a
deliberate availability-over-strictness tradeoff, not an oversight.
"""
import logging
from typing import Optional

import httpx
from fastapi import Depends, HTTPException, Request

from config import settings
from middleware.auth import CurrentUser, get_current_user

logger = logging.getLogger(__name__)


async def _incr_with_expiry(key: str, window_seconds: int) -> Optional[int]:
    """Returns the post-increment count, or None if Redis is unreachable/
    unconfigured (caller must treat None as "allow the request")."""
    if not settings.upstash_redis_rest_url:
        return None
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            resp = await client.get(
                f"{settings.upstash_redis_rest_url}/incr/{key}",
                headers={"Authorization": f"Bearer {settings.upstash_redis_rest_token}"},
            )
            if resp.status_code != 200:
                return None
            count = resp.json().get("result")
            if count == 1:
                # First request in this window — start the TTL now, so the
                # counter resets window_seconds from the FIRST request, not
                # from whenever it happens to be read again.
                await client.get(
                    f"{settings.upstash_redis_rest_url}/expire/{key}/{window_seconds}",
                    headers={"Authorization": f"Bearer {settings.upstash_redis_rest_token}"},
                )
            return count
    except Exception as e:
        logger.warning(f"Rate limit check failed for key {key!r}: {e}")
        return None


async def enforce_rate_limit(key: str, limit: int, window_seconds: int) -> None:
    """Raises 429 if key has exceeded limit requests within window_seconds."""
    count = await _incr_with_expiry(key, window_seconds)
    if count is None:
        return  # fail open — see module docstring
    if count > limit:
        raise HTTPException(
            status_code=429,
            detail=f"Rate limit exceeded: {limit} requests per {window_seconds}s. Try again shortly.",
        )


def _client_ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"


def rate_limit_by_ip(category: str, limit: int, window_seconds: int):
    """Dependency factory for pre-auth endpoints (signup/login) — the only
    identity available before a token exists is the caller's IP."""

    async def _dep(request: Request) -> None:
        await enforce_rate_limit(f"ratelimit:{category}:{_client_ip(request)}", limit, window_seconds)

    return _dep


def rate_limit_by_org(category: str, limit: int, window_seconds: int):
    """Dependency factory for authenticated, org-scoped endpoints (ingest,
    AI analyst). Returns CurrentUser, same as get_current_user, so routes
    can use this as a drop-in replacement rather than stacking two
    dependencies — FastAPI dependency-caches get_current_user within a
    single request, so this costs nothing extra."""

    async def _dep(request: Request, user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
        await enforce_rate_limit(f"ratelimit:{category}:{user.org_id}", limit, window_seconds)
        return user

    return _dep


async def global_rate_limit(request: Request) -> None:
    """Applied as ASGI middleware in main.py to every /api/v1 request,
    keyed by IP. The 200/15min ceiling behind all the more specific
    per-category limits above."""
    await enforce_rate_limit(f"ratelimit:global:{_client_ip(request)}", 200, 900)
