"""Platform-level super admin endpoints — cross-org visibility and control
for the one account that operates the whole platform (not an org admin,
a platform admin). Every endpoint here is gated by require_superadmin
(checks an is_superadmin JWT claim, independent of org_id/role) and reads/
writes via the service role, since org-scoped RLS would otherwise block
cross-org access even for a superadmin-flagged token.

Deliberately NOT included here: suspending/reactivating an org. That
touches every existing authenticated request path (not a clean isolated
addition like everything below), and was deferred to a separate,
focused change rather than folded into this one.
"""
import logging
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from audit import log_action
from billing.credits import get_org_credits
from database import get_incidents_collection, get_logs_collection
from db.supabase import SupabaseError, admin_get_user, admin_set_app_metadata, rest_insert, rest_select, rest_update
from middleware.auth import CurrentUser
from middleware.rbac import require_superadmin

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/superadmin", tags=["superadmin"])

VALID_ROLES = {"admin", "analyst", "viewer"}


class AdjustCreditsRequest(BaseModel):
    delta: int
    reason: str = Field(min_length=1, max_length=256)


class ChangeRoleRequest(BaseModel):
    role: str


def _client_ip(request: Request):
    return request.client.host if request.client else None


@router.get("/organizations")
async def list_organizations(user: CurrentUser = Depends(require_superadmin)) -> dict:
    """Every org on the platform, with member count and current credit
    balance. Two extra queries (all user_profiles, all credits_ledger)
    instead of N+1 per-org queries — fine at portfolio scale, revisit if
    this ever needs to handle thousands of orgs."""
    try:
        orgs = await rest_select(
            "organizations", {"select": "*", "order": "created_at.desc"}, use_service_role=True
        )
        profiles = await rest_select("user_profiles", {"select": "org_id"}, use_service_role=True)
        ledger = await rest_select("credits_ledger", {"select": "org_id,delta"}, use_service_role=True)
    except SupabaseError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)

    member_counts = {}
    for p in profiles:
        member_counts[p["org_id"]] = member_counts.get(p["org_id"], 0) + 1

    purchased_by_org = {}
    for row in ledger:
        purchased_by_org[row["org_id"]] = purchased_by_org.get(row["org_id"], 0) + row["delta"]

    data = [
        {
            "id": org["id"],
            "name": org["name"],
            "created_at": org["created_at"],
            "member_count": member_counts.get(org["id"], 0),
            "free_credits_remaining": org["free_credits_remaining"],
            "purchased_credits": purchased_by_org.get(org["id"], 0),
        }
        for org in orgs
    ]
    return {"status": "success", "count": len(data), "data": data}


@router.get("/users")
async def list_users(user: CurrentUser = Depends(require_superadmin)) -> dict:
    """Every user on the platform, with their org name."""
    try:
        profiles = await rest_select(
            "user_profiles",
            {"select": "id,full_name,email,role,org_id,created_at", "order": "created_at.desc"},
            use_service_role=True,
        )
        orgs = await rest_select("organizations", {"select": "id,name"}, use_service_role=True)
    except SupabaseError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)

    org_names = {o["id"]: o["name"] for o in orgs}
    data = [{**p, "org_name": org_names.get(p["org_id"], "Unknown")} for p in profiles]
    return {"status": "success", "count": len(data), "data": data}


@router.get("/stats")
async def platform_stats(user: CurrentUser = Depends(require_superadmin)) -> dict:
    """Platform-wide aggregate numbers — orgs, users, incidents (Mongo,
    no org_id filter), total revenue proxy (sum of positive ledger deltas,
    i.e. real top-ups, excluding the free monthly allowance which was
    never a purchase)."""
    try:
        orgs = await rest_select("organizations", {"select": "id"}, use_service_role=True)
        profiles = await rest_select("user_profiles", {"select": "id"}, use_service_role=True)
        ledger = await rest_select("credits_ledger", {"select": "delta"}, use_service_role=True)
    except SupabaseError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)

    incidents_collection = await get_incidents_collection()
    logs_collection = await get_logs_collection()
    total_incidents = await incidents_collection.count_documents({})
    total_logs = await logs_collection.count_documents({})

    total_credits_purchased = sum(row["delta"] for row in ledger if row["delta"] > 0)

    return {
        "status": "success",
        "total_organizations": len(orgs),
        "total_users": len(profiles),
        "total_incidents": total_incidents,
        "total_logs": total_logs,
        "total_credits_purchased": total_credits_purchased,
    }


@router.get("/organizations/{org_id}")
async def get_organization_detail(org_id: str, user: CurrentUser = Depends(require_superadmin)) -> dict:
    """Drill into one org: profile, members, credit balance, incident/log
    counts. Read-only support/debug view."""
    try:
        org_rows = await rest_select("organizations", {"select": "*", "id": f"eq.{org_id}"}, use_service_role=True)
        if not org_rows:
            raise HTTPException(status_code=404, detail="Organization not found")

        members = await rest_select(
            "user_profiles",
            {"select": "id,full_name,email,role,created_at", "org_id": f"eq.{org_id}"},
            use_service_role=True,
        )
        balance = await get_org_credits(org_id, use_service_role=True)
    except SupabaseError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)
    except ValueError:
        raise HTTPException(status_code=404, detail="Organization not found")

    incidents_collection = await get_incidents_collection()
    logs_collection = await get_logs_collection()
    incident_count = await incidents_collection.count_documents({"org_id": org_id})
    log_count = await logs_collection.count_documents({"org_id": org_id})

    return {
        "status": "success",
        "organization": org_rows[0],
        "members": members,
        "balance": balance,
        "incident_count": incident_count,
        "log_count": log_count,
    }


@router.patch("/organizations/{org_id}/credits")
async def adjust_org_credits(
    org_id: str,
    body: AdjustCreditsRequest,
    request: Request,
    user: CurrentUser = Depends(require_superadmin),
) -> dict:
    """Manually adjust an org's purchased-credit balance (credits_ledger
    entry) — for comping credits, fixing a support issue, etc. Free
    monthly allowance is untouched; this only ever affects the
    purchased-credit pool, same ledger the Razorpay webhook writes to."""
    org_rows = await rest_select("organizations", {"select": "id", "id": f"eq.{org_id}"}, use_service_role=True)
    if not org_rows:
        raise HTTPException(status_code=404, detail="Organization not found")

    try:
        await rest_insert(
            "credits_ledger",
            {"org_id": org_id, "delta": body.delta, "reason": f"superadmin_adjustment: {body.reason}"},
            use_service_role=True,
        )
    except SupabaseError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)

    await log_action(
        action=f"superadmin.credits_adjust:{body.delta}:{body.reason}",
        org_id=org_id,
        actor_id=user.id,
        ip_address=_client_ip(request),
        user_agent=request.headers.get("user-agent"),
    )

    balance = await get_org_credits(org_id, use_service_role=True)
    return {"status": "success", "balance": balance}


@router.patch("/users/{user_id}/role")
async def change_user_role(
    user_id: str,
    body: ChangeRoleRequest,
    request: Request,
    user: CurrentUser = Depends(require_superadmin),
) -> dict:
    """Change any user's role. Updates both user_profiles (source of
    truth for display) and the user's own JWT app_metadata (source of
    truth for authorization) — they'd drift apart otherwise, same reason
    signup writes both. The role change only takes effect on that user's
    NEXT login; their current session's JWT keeps its old role claim
    until it's reissued."""
    if body.role not in VALID_ROLES:
        raise HTTPException(status_code=400, detail=f"role must be one of {sorted(VALID_ROLES)}")

    profile_rows = await rest_select(
        "user_profiles", {"select": "id,org_id,role", "id": f"eq.{user_id}"}, use_service_role=True
    )
    if not profile_rows:
        raise HTTPException(status_code=404, detail="User not found")
    profile = profile_rows[0]
    old_role = profile["role"]

    try:
        await rest_update(
            "user_profiles", {"id": f"eq.{user_id}"}, {"role": body.role}, use_service_role=True
        )
        auth_user = await admin_get_user(user_id)
        current_metadata = dict(auth_user.get("app_metadata") or {})
        current_metadata["org_id"] = profile["org_id"]
        current_metadata["role"] = body.role
        await admin_set_app_metadata(user_id, current_metadata)
    except SupabaseError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)

    await log_action(
        action=f"superadmin.role_change:{user_id}:{old_role}->{body.role}",
        org_id=profile["org_id"],
        actor_id=user.id,
        ip_address=_client_ip(request),
        user_agent=request.headers.get("user-agent"),
    )

    return {"status": "success", "user_id": user_id, "old_role": old_role, "new_role": body.role}
