"""Admin-only endpoints: org members, audit log, detection rule tuning,
credits ledger. Every endpoint here is gated by require_role("admin") at
the API layer — and for the reads/writes that touch tables with their own
admin-scoped RLS policy (detection_rules, audit_logs), the caller's own
JWT is used (not the service role) so Postgres enforces the same rule a
second time. Not just a hidden button in the frontend.
"""
import asyncio
import logging

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from audit import log_action
from billing.credits import get_org_credits_with_ledger
from db.supabase import SupabaseError, rest_select, rest_update
from middleware.auth import CurrentUser
from middleware.rbac import require_role

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/admin", tags=["admin"])


class UpdateRuleWeight(BaseModel):
    weight: int = Field(ge=0, le=100)


@router.get("/members")
async def list_members(user: CurrentUser = Depends(require_role("admin"))) -> dict:
    """Org members and their roles."""
    try:
        rows = await rest_select(
            "user_profiles",
            {"select": "id,full_name,email,role,created_at", "org_id": f"eq.{user.org_id}"},
            user_token=user.access_token,
        )
    except SupabaseError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)

    return {"status": "success", "count": len(rows), "data": rows}


@router.get("/audit-log")
async def list_audit_log(user: CurrentUser = Depends(require_role("admin"))) -> dict:
    """Recent audit log entries for this org, newest first."""
    try:
        # Resolve actor_id -> a human identity. One extra query for the whole
        # org, not one per row: the UI otherwise had to render a raw UUID
        # fragment, which tells an admin reading their own audit log nothing.
        #
        # Gathered, not awaited in sequence: neither query feeds the other,
        # and a Supabase round trip is ~200ms, so running them back to back
        # made this endpoint pay that twice (~500ms measured) for no reason.
        rows, profiles = await asyncio.gather(
            rest_select(
                "audit_logs",
                {
                    "select": "id,actor_id,action,ip_address,user_agent,created_at",
                    "org_id": f"eq.{user.org_id}",
                    "order": "created_at.desc",
                    "limit": "200",
                },
                user_token=user.access_token,
            ),
            rest_select(
                "user_profiles",
                {"select": "id,full_name,email", "org_id": f"eq.{user.org_id}"},
                user_token=user.access_token,
            ),
        )
    except SupabaseError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)

    by_id = {p["id"]: p for p in profiles}
    for row in rows:
        # actor_id is null for pre-auth events (a failed login isn't a known
        # user yet) and unresolvable for members who have since been removed.
        profile = by_id.get(row.get("actor_id"))
        row["actor_name"] = (profile or {}).get("full_name")
        row["actor_email"] = (profile or {}).get("email")

    return {"status": "success", "count": len(rows), "data": rows}


@router.get("/detection-rules")
async def list_detection_rules(user: CurrentUser = Depends(require_role("admin"))) -> dict:
    """This org's detection rule weights — the real UI for what was
    previously only editable via direct DB writes."""
    try:
        rows = await rest_select(
            "detection_rules",
            {"select": "id,rule_key,weight,enabled", "org_id": f"eq.{user.org_id}", "order": "rule_key.asc"},
            user_token=user.access_token,
        )
    except SupabaseError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)

    return {"status": "success", "count": len(rows), "data": rows}


@router.patch("/detection-rules/{rule_id}")
async def update_detection_rule(
    rule_id: str,
    body: UpdateRuleWeight,
    request: Request,
    user: CurrentUser = Depends(require_role("admin")),
) -> dict:
    """Update one detection rule's weight. Scoped to the caller's org via
    RLS (the update uses the caller's own JWT, not the service role) —
    detection_rules' "org admins can write own detection rules" policy
    means this can't touch another org's rule even if someone guessed an
    ID, regardless of what this endpoint's own org_id filter does."""
    existing = await rest_select(
        "detection_rules",
        {"select": "id,rule_key,weight", "id": f"eq.{rule_id}", "org_id": f"eq.{user.org_id}"},
        user_token=user.access_token,
    )
    if not existing:
        raise HTTPException(status_code=404, detail="Detection rule not found")
    old_weight = existing[0]["weight"]
    rule_key = existing[0]["rule_key"]

    try:
        rows = await rest_update(
            "detection_rules",
            {"id": f"eq.{rule_id}", "org_id": f"eq.{user.org_id}"},
            {"weight": body.weight},
            user_token=user.access_token,
        )
    except SupabaseError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)

    await log_action(
        action=f"detection_rules.update:{rule_key}:{old_weight}->{body.weight}",
        org_id=user.org_id,
        actor_id=user.id,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )

    return {"status": "success", "data": rows[0] if rows else None}


@router.get("/credits-ledger")
async def credits_ledger(user: CurrentUser = Depends(require_role("admin"))) -> dict:
    """Current balance breakdown (free vs. purchased) plus the raw
    purchased-credit ledger history."""
    try:
        # One helper, two parallel round trips. This used to call
        # get_org_credits() (which itself read credits_ledger) and then read
        # credits_ledger again for the fuller column set — three sequential
        # Supabase calls where two parallel ones do, since the second read's
        # columns are a superset of the first's.
        balance, ledger_rows = await get_org_credits_with_ledger(
            user.org_id, user.access_token
        )
    except SupabaseError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)

    return {"status": "success", "balance": balance, "ledger": ledger_rows}
