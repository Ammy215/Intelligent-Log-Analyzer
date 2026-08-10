"""JWT verification dependency for Supabase-issued access tokens.

This project's Supabase Auth uses asymmetric JWT Signing Keys (ES256), not
the legacy shared HS256 secret — verification means fetching Supabase's
public key set (JWKS), finding the key that signed a given token by its
`kid`, and verifying against that. The private key never leaves Supabase;
nothing this backend holds could be used to forge a token.
"""
import time
from dataclasses import dataclass
from typing import Optional

import httpx
from fastapi import Header, HTTPException
from jose import JWTError, jwt

from config import settings

_JWKS_URL = f"{settings.supabase_url}/auth/v1/.well-known/jwks.json"
_JWKS_CACHE_TTL_SECONDS = 3600
_jwks_cache: dict = {"keys": [], "fetched_at": 0.0}


@dataclass
class CurrentUser:
    id: str
    email: Optional[str]
    org_id: Optional[str]
    role: Optional[str]
    access_token: str


async def _get_jwks(force_refresh: bool = False) -> list:
    """Fetch Supabase's public signing keys, cached in-process for an hour.

    The JWKS endpoint is public (no auth needed) — it publishes public keys
    only, so there's nothing sensitive to protect here.
    """
    now = time.time()
    if not force_refresh and _jwks_cache["keys"] and (now - _jwks_cache["fetched_at"]) < _JWKS_CACHE_TTL_SECONDS:
        return _jwks_cache["keys"]

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            # Supabase's gateway requires an apikey header to route any
            # request, even this public one — the JWKS content itself
            # needs no auth, so the low-privilege anon key is appropriate.
            resp = await client.get(_JWKS_URL, headers={"apikey": settings.supabase_anon_key})
    except httpx.RequestError as e:
        raise HTTPException(status_code=502, detail=f"Could not reach Supabase JWKS endpoint: {e}")

    if resp.status_code >= 400:
        raise HTTPException(status_code=502, detail=f"Supabase JWKS fetch failed: HTTP {resp.status_code}")

    keys = resp.json().get("keys", [])
    _jwks_cache["keys"] = keys
    _jwks_cache["fetched_at"] = now
    return keys


async def _find_signing_key(kid: str) -> dict:
    keys = await _get_jwks()
    for key in keys:
        if key.get("kid") == kid:
            return key

    # kid not in the cached set — could be a just-rotated key. Refresh once
    # before giving up, rather than caching a false negative for an hour.
    keys = await _get_jwks(force_refresh=True)
    for key in keys:
        if key.get("kid") == kid:
            return key

    raise HTTPException(status_code=401, detail="Token signed with an unrecognized key (kid not in Supabase JWKS)")


async def get_current_user(authorization: Optional[str] = Header(None)) -> CurrentUser:
    """Verify the Authorization: Bearer <jwt> header and extract identity/org/role.

    org_id and role are read from the token's app_metadata claim, which only
    the service role can set (see db/supabase.py: admin_set_app_metadata) —
    never from user_metadata, which the user controls themselves.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")
    token = authorization[len("Bearer "):].strip()

    try:
        unverified_header = jwt.get_unverified_header(token)
    except JWTError as e:
        raise HTTPException(status_code=401, detail=f"Malformed token: {e}")

    kid = unverified_header.get("kid")
    if not kid:
        raise HTTPException(status_code=401, detail="Token missing 'kid' header")

    signing_key = await _find_signing_key(kid)

    try:
        payload = jwt.decode(
            token,
            signing_key,
            algorithms=[signing_key.get("alg", "ES256")],
            audience="authenticated",
        )
    except JWTError as e:
        raise HTTPException(status_code=401, detail=f"Invalid or expired token: {e}")

    app_metadata = payload.get("app_metadata") or {}

    return CurrentUser(
        id=payload["sub"],
        email=payload.get("email"),
        org_id=app_metadata.get("org_id"),
        role=app_metadata.get("role"),
        access_token=token,
    )
