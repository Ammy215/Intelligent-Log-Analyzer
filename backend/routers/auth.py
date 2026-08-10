"""Auth endpoints: Supabase-backed signup/login/logout.

Also includes three throwaway endpoints for Phase 1 verification only
(/me, /my-organization, /admin-only-test) — these exist to prove the JWT
and RBAC dependencies work, not as real product functionality. Real
endpoints get gated with these dependencies starting Phase 2.
"""
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from analyzers.threat_scorer import THREAT_WEIGHTS
from db.supabase import (
    SupabaseError,
    admin_set_app_metadata,
    auth_login,
    auth_logout,
    auth_signup,
    rest_insert,
    rest_select,
)
from middleware.auth import CurrentUser, get_current_user
from middleware.rbac import require_role

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])

SIGNUP_BONUS_CREDITS = 20


class SignupRequest(BaseModel):
    email: str
    password: str
    org_name: Optional[str] = None
    full_name: Optional[str] = None


class LoginRequest(BaseModel):
    email: str
    password: str


@router.post("/signup")
async def signup(body: SignupRequest) -> dict:
    """Create a Supabase Auth user, a new organization, and an admin profile.

    Every signup creates its own new organization with the signing-up user
    as its 'admin' — there's no invite/join-existing-org flow yet.
    """
    try:
        auth_result = await auth_signup(body.email, body.password)
    except SupabaseError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)

    user = auth_result.get("user") or auth_result
    user_id = user.get("id")
    if not user_id:
        raise HTTPException(status_code=502, detail="Supabase signup did not return a user id")

    org_name = body.org_name or f"{body.email.split('@')[0]}'s Organization"

    try:
        org_rows = await rest_insert("organizations", {"name": org_name}, use_service_role=True)
        org_id = org_rows[0]["id"]

        await rest_insert(
            "user_profiles",
            {
                "id": user_id,
                "org_id": org_id,
                "full_name": body.full_name,
                "role": "admin",
            },
            use_service_role=True,
        )

        await admin_set_app_metadata(user_id, {"org_id": org_id, "role": "admin"})

        # Seed this org's own copy of today's default detection weights, so
        # scoring is fully tunable per-org from day one instead of an
        # unconfigured org silently depending on the hardcoded fallback.
        rule_rows = [
            {"org_id": org_id, "rule_key": key, "weight": weight, "enabled": True}
            for key, weight in THREAT_WEIGHTS.items()
        ]
        await rest_insert("detection_rules", rule_rows, use_service_role=True)

        # Starting credit allotment — free to try the platform before ever
        # touching Stripe. Not tied to a Stripe event, so stripe_event_id
        # stays null on this entry.
        await rest_insert(
            "credits_ledger",
            {"org_id": org_id, "delta": SIGNUP_BONUS_CREDITS, "reason": "signup_bonus"},
            use_service_role=True,
        )
    except SupabaseError as e:
        logger.error(f"Org/profile provisioning failed for user {user_id}: {e.detail}")
        raise HTTPException(
            status_code=502,
            detail="Account created but organization setup failed — contact support",
        )

    email_confirmation_required = not auth_result.get("session")

    return {
        "status": "success",
        "message": (
            "Signup successful. Check your email to verify your account before logging in."
            if email_confirmation_required
            else "Signup successful."
        ),
        "user_id": user_id,
        "org_id": org_id,
        "org_name": org_name,
    }


@router.post("/login")
async def login(body: LoginRequest) -> dict:
    """Exchange email/password for a Supabase access token."""
    try:
        result = await auth_login(body.email, body.password)
    except SupabaseError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)

    return {
        "status": "success",
        "access_token": result.get("access_token"),
        "refresh_token": result.get("refresh_token"),
        "expires_in": result.get("expires_in"),
        "user": {
            "id": result.get("user", {}).get("id"),
            "email": result.get("user", {}).get("email"),
        },
    }


@router.post("/logout")
async def logout(user: CurrentUser = Depends(get_current_user)) -> dict:
    """Invalidate the caller's current session."""
    try:
        await auth_logout(user.access_token)
    except SupabaseError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)
    return {"status": "success", "message": "Logged out"}


@router.get("/me")
async def me(user: CurrentUser = Depends(get_current_user)) -> dict:
    """Phase 1 test endpoint: proves JWT verification works and that
    org_id/role are present in the token's app_metadata claim."""
    return {
        "id": user.id,
        "email": user.email,
        "org_id": user.org_id,
        "role": user.role,
    }


@router.get("/my-organization")
async def my_organization(user: CurrentUser = Depends(get_current_user)) -> dict:
    """Phase 1 test endpoint: queries Postgres using the CALLER's own JWT
    (not the service role), so this exercises RLS for real. Should only
    ever return the caller's own organization row — never another org's,
    and never every org in the table.
    """
    rows = await rest_select("organizations", {"select": "*"}, user_token=user.access_token)
    return {"status": "success", "count": len(rows), "data": rows}


@router.get("/admin-only-test")
async def admin_only_test(user: CurrentUser = Depends(require_role("admin"))) -> dict:
    """Phase 1 test endpoint: proves the RBAC dependency actually gates by role."""
    return {"status": "success", "message": f"Welcome, admin {user.email}", "org_id": user.org_id}
