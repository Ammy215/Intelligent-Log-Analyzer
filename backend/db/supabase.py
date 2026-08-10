"""Thin async HTTP client for Supabase Auth and PostgREST.

Uses raw httpx calls instead of the supabase-py SDK: no new dependency
(httpx is already pinned), and every request this app makes to Supabase is
visible here rather than hidden inside a client library.
"""
import logging
from typing import Any, Optional, Union

import httpx

from config import settings

logger = logging.getLogger(__name__)


class SupabaseError(Exception):
    """Raised for both Supabase API error responses and network failures."""

    def __init__(self, status_code: int, detail: Any):
        self.status_code = status_code
        self.detail = detail
        super().__init__(f"Supabase error {status_code}: {detail}")


def _anon_headers() -> dict:
    return {"apikey": settings.supabase_anon_key, "Content-Type": "application/json"}


def _user_headers(access_token: str) -> dict:
    return {
        "apikey": settings.supabase_anon_key,
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json",
    }


def _service_headers() -> dict:
    # Service role key bypasses RLS. Only ever used server-side for
    # provisioning (signup) — never forwarded to a client.
    return {
        "apikey": settings.supabase_service_key,
        "Authorization": f"Bearer {settings.supabase_service_key}",
        "Content-Type": "application/json",
    }


async def _request(method: str, url: str, **kwargs) -> httpx.Response:
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            return await client.request(method, url, **kwargs)
    except httpx.RequestError as e:
        logger.error(f"Supabase request failed: {method} {url}: {e}")
        raise SupabaseError(502, f"Could not reach Supabase: {e}")


async def auth_signup(email: str, password: str) -> dict:
    """Create a Supabase Auth user. Returns the Auth API response (includes
    a session only if email confirmation is disabled on the project)."""
    resp = await _request(
        "POST",
        f"{settings.supabase_url}/auth/v1/signup",
        headers=_anon_headers(),
        json={"email": email, "password": password},
    )
    if resp.status_code >= 400:
        raise SupabaseError(resp.status_code, resp.json())
    return resp.json()


async def auth_login(email: str, password: str) -> dict:
    """Exchange email/password for an access + refresh token."""
    resp = await _request(
        "POST",
        f"{settings.supabase_url}/auth/v1/token?grant_type=password",
        headers=_anon_headers(),
        json={"email": email, "password": password},
    )
    if resp.status_code >= 400:
        raise SupabaseError(resp.status_code, resp.json())
    return resp.json()


async def auth_logout(access_token: str) -> None:
    """Invalidate the session behind the given access token."""
    resp = await _request(
        "POST",
        f"{settings.supabase_url}/auth/v1/logout",
        headers=_user_headers(access_token),
    )
    if resp.status_code >= 400:
        raise SupabaseError(resp.status_code, resp.text)


async def admin_set_app_metadata(user_id: str, app_metadata: dict) -> dict:
    """Set org_id/role claims on a user via the service role key.

    app_metadata is admin-only-writable in Supabase (unlike user_metadata,
    which the user can change themselves) — this is the only place org_id
    and role should ever be written.
    """
    resp = await _request(
        "PUT",
        f"{settings.supabase_url}/auth/v1/admin/users/{user_id}",
        headers=_service_headers(),
        json={"app_metadata": app_metadata},
    )
    if resp.status_code >= 400:
        raise SupabaseError(resp.status_code, resp.json())
    return resp.json()


async def rest_insert(
    table: str, data: Union[dict, list[dict]], use_service_role: bool = False, user_token: Optional[str] = None
) -> list:
    """Insert one row (dict) or many rows in one request (list of dicts) via PostgREST.

    Provisioning inserts (org/profile creation at signup) must use the
    service role, since a brand-new user has no org_id yet to satisfy any
    org-scoped RLS policy. Pass user_token for writes that should be subject
    to RLS instead.
    """
    headers = _service_headers() if use_service_role else _user_headers(user_token)
    headers["Prefer"] = "return=representation"
    resp = await _request(
        "POST",
        f"{settings.supabase_url}/rest/v1/{table}",
        headers=headers,
        json=data,
    )
    if resp.status_code >= 400:
        raise SupabaseError(resp.status_code, resp.text)
    return resp.json()


async def rest_select(table: str, params: dict, user_token: str) -> list:
    """Select rows via PostgREST using the caller's own JWT, so RLS applies."""
    resp = await _request(
        "GET",
        f"{settings.supabase_url}/rest/v1/{table}",
        headers=_user_headers(user_token),
        params=params,
    )
    if resp.status_code >= 400:
        raise SupabaseError(resp.status_code, resp.text)
    return resp.json()
