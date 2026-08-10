"""Free-tier monthly credit lifecycle — lazy reset, no rollover.

Free credits (organizations.free_credits_remaining) are a separate pool
from purchased credits (credits_ledger, Razorpay top-ups only — see
routers/billing.py). There's no scheduled job resetting every org at
month boundaries; whichever balance check happens to run first after a
new month starts notices the stored period is stale and resets right
then. A stale reset always sets free_credits_remaining to exactly
FREE_CREDITS_PER_MONTH — never adds to whatever was left, so unused free
credits don't roll over. Purchased credits are never touched by this.
"""
import logging
from datetime import datetime, timezone

from db.supabase import rest_select, rest_update

logger = logging.getLogger(__name__)

FREE_CREDITS_PER_MONTH = 20


def _current_period() -> str:
    """Current calendar month as 'YYYY-MM', UTC."""
    return datetime.now(timezone.utc).strftime("%Y-%m")


async def get_org_credits(org_id: str, user_token: str) -> dict:
    """Get this org's credit balance, lazily resetting the free allowance
    if the stored period is stale (a new month has started since the last
    check, or this is the org's very first check and the period is null).
    """
    org_rows = await rest_select(
        "organizations",
        {"select": "id,credits_current_period,free_credits_remaining", "id": f"eq.{org_id}"},
        user_token=user_token,
    )
    if not org_rows:
        raise ValueError(f"Org {org_id} not found")
    org = org_rows[0]

    current_period = _current_period()
    free_remaining = org["free_credits_remaining"]
    stored_period = org.get("credits_current_period")

    if stored_period != current_period:
        free_remaining = FREE_CREDITS_PER_MONTH
        await rest_update(
            "organizations",
            {"id": f"eq.{org_id}"},
            {"credits_current_period": current_period, "free_credits_remaining": free_remaining},
            use_service_role=True,
        )
        logger.info(
            f"Reset free credits for org {org_id}: period {stored_period!r} -> {current_period!r}, "
            f"free_credits_remaining -> {free_remaining}"
        )

    ledger_rows = await rest_select(
        "credits_ledger",
        {"select": "delta", "org_id": f"eq.{org_id}"},
        user_token=user_token,
    )
    purchased_credits = sum(row["delta"] for row in ledger_rows)

    return {
        "period": current_period,
        "free_credits_remaining": free_remaining,
        "purchased_credits": purchased_credits,
        "total_available": free_remaining + purchased_credits,
    }
