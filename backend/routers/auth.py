"""Auth endpoints: Supabase-backed signup/login/logout.

Also includes three throwaway endpoints for Phase 1 verification only
(/me, /my-organization, /admin-only-test) — these exist to prove the JWT
and RBAC dependencies work, not as real product functionality. Real
endpoints get gated with these dependencies starting Phase 2.
"""
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from analyzers.threat_scorer import THREAT_WEIGHTS
from audit import log_action
from db.supabase import (
    SupabaseError,
    admin_set_app_metadata,
    auth_login,
    auth_logout,
    auth_signup,
    generate_action_link,
    rest_insert,
    rest_select,
)
from middleware.auth import CurrentUser, get_current_user
from middleware.rbac import require_role
from notifications.resend_client import ResendError, send_email

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


class SignupRequest(BaseModel):
    email: str
    password: str
    org_name: Optional[str] = None
    full_name: Optional[str] = None


class LoginRequest(BaseModel):
    email: str
    password: str


class ResendVerificationRequest(BaseModel):
    email: str


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
                "email": body.email,
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

        # No credits_ledger insert here on purpose — the starting free
        # allotment now lives entirely in organizations.free_credits_remaining
        # (defaults to 20 at the DB level) and refreshes monthly via lazy
        # reset (billing/credits.py). credits_ledger is purchased-only
        # (Razorpay top-ups); a signup_bonus ledger row would double-count
        # against the new free-tier column.
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
async def login(body: LoginRequest, request: Request) -> dict:
    """Exchange email/password for a Supabase access token."""
    ip_address = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")

    try:
        result = await auth_login(body.email, body.password)
    except SupabaseError as e:
        # org_id/actor_id are genuinely unknown for a failed attempt (wrong
        # password or nonexistent email) — logged with the attempted email
        # in the action string since audit_logs has no separate detail
        # column. Rows like this are write-only: org-scoped RLS means no
        # admin's view will ever surface a null-org_id row, which is
        # correct — a failed login isn't "this org's" data until we know
        # which org it was aimed at.
        await log_action(
            action=f"auth.login_failed:{body.email}",
            ip_address=ip_address,
            user_agent=user_agent,
        )
        raise HTTPException(status_code=e.status_code, detail=e.detail)

    user = result.get("user", {})
    app_metadata = user.get("app_metadata") or {}
    await log_action(
        action="auth.login",
        org_id=app_metadata.get("org_id"),
        actor_id=user.get("id"),
        ip_address=ip_address,
        user_agent=user_agent,
    )

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


@router.post("/resend-verification")
async def resend_verification(body: ResendVerificationRequest) -> dict:
    """Resend an account-verification email, sent via Resend rather than
    Supabase's own built-in delivery (Supabase still sends its own email at
    signup time — this is only the resend path).

    Unauthenticated on purpose (the caller isn't logged in yet, that's the
    whole reason they need this), so it always returns the same generic
    response regardless of whether the email exists — otherwise this
    endpoint would let anyone enumerate registered accounts.
    """
    generic_response = {
        "status": "success",
        "message": "If that email is registered, a verification link has been sent.",
    }
    try:
        link_result = await generate_action_link(body.email)
    except SupabaseError as e:
        logger.warning(f"generate_action_link failed for resend-verification ({body.email}): {e.detail}")
        return generic_response

    action_link = link_result.get("action_link") or link_result.get("properties", {}).get("action_link")
    if not action_link:
        logger.error(f"generate_action_link returned no action_link, raw response: {link_result}")
        return generic_response

    try:
        await send_email(
            body.email,
            "Verify your account",
            f"<p>Click the link below to verify your account and sign in:</p>"
            f'<p><a href="{action_link}">{action_link}</a></p>',
        )
    except ResendError as e:
        logger.error(f"Resend send failed for resend-verification ({body.email}): {e}")
        raise HTTPException(status_code=502, detail="Could not send verification email — try again shortly")

    return generic_response


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
