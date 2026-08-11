"""Upstash Redis REST client for caching threat intel enrichment results.

Upstash's REST API maps Redis commands to URL paths: GET {url}/set/{key}/{value}?EX={ttl}
and GET {url}/get/{key}, both returning {"result": ...} (null on miss, not a 404).
Values are JSON-encoded before storage since enrichment results are dicts, not strings.

Replaces the old in-memory ThreatIntelCache (threat_intel/cache.py, now removed) —
that cache's key was accidentally built from the client instance (`self`), not the
IP being looked up, so every IP silently collided onto one cache entry. Callers
here build explicit, IP-scoped keys instead (e.g. "abuseipdb:{ip}").
"""
import json
import logging
from typing import Any, Optional

from config import settings
from utils.http_client import client as _http_client

logger = logging.getLogger(__name__)


async def cache_get(key: str) -> Optional[Any]:
    """Return the cached value for key, or None on a miss or any failure.

    Failures are swallowed (logged, not raised) — a Redis hiccup should
    degrade to "cache miss, call the real API" rather than break enrichment.
    """
    if not settings.upstash_redis_rest_url:
        return None
    try:
        resp = await _http_client.get(
            f"{settings.upstash_redis_rest_url}/get/{key}",
            headers={"Authorization": f"Bearer {settings.upstash_redis_rest_token}"},
            timeout=5,
        )
        if resp.status_code != 200:
            return None
        result = resp.json().get("result")
        if result is None:
            return None
        return json.loads(result)
    except Exception as e:
        logger.warning(f"Redis cache_get failed for key {key}: {e}")
        return None


async def cache_set(key: str, value: Any, ttl_seconds: int = 86400) -> None:
    """Store value under key with a TTL. Failures are logged, not raised."""
    if not settings.upstash_redis_rest_url:
        return
    try:
        await _http_client.post(
            f"{settings.upstash_redis_rest_url}/set/{key}",
            headers={"Authorization": f"Bearer {settings.upstash_redis_rest_token}"},
            params={"EX": ttl_seconds},
            content=json.dumps(value),
            timeout=5,
        )
    except Exception as e:
        logger.warning(f"Redis cache_set failed for key {key}: {e}")
