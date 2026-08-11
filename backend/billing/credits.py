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

from db.supabase import rest_insert, rest_select, rest_update

logger = logging.getLogger(__name__)

FREE_CREDITS_PER_MONTH = 20


class InsufficientCreditsError(Exception):
    """Raised when an org has 0 credits in both pools. Callers should catch
    this BEFORE doing any expensive work (an LLM call) — never after."""

    def __init__(self, org_id: str):
        self.org_id = org_id
        super().__init__(f"Org {org_id} has no credits remaining")


def _current_period() -> str:
    """Current calendar month as 'YYYY-MM', UTC."""
    return datetime.now(timezone.utc).strftime("%Y-%m")


async def get_org_credits(org_id: str, user_token: str = None, use_service_role: bool = False) -> dict:
    """Get this org's credit balance, lazily resetting the free allowance
    if the stored period is stale (a new month has started since the last
    check, or this is the org's very first check and the period is null).

    use_service_role=True bypasses RLS for cross-org reads — the only
    caller that needs it is the superadmin router (checking a balance for
    an org the caller isn't a member of); every normal in-org call keeps
    using the caller's own token, same as before.
    """
    org_rows = await rest_select(
        "organizations",
        {"select": "id,credits_current_period,free_credits_remaining", "id": f"eq.{org_id}"},
        user_token=user_token,
        use_service_role=use_service_role,
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
        use_service_role=use_service_role,
    )
    purchased_credits = sum(row["delta"] for row in ledger_rows)

    return {
        "period": current_period,
        "free_credits_remaining": free_remaining,
        "purchased_credits": purchased_credits,
        "total_available": free_remaining + purchased_credits,
    }


async def spend_credit(org_id: str, user_token: str, reason: str) -> dict:
    """Deduct exactly 1 credit for a metered action (currently: AI Analyst
    incident reports). Spends the free monthly allowance first, purchased
    credits (credits_ledger) second — same two-pool priority as the
    balance-check logic above. Raises InsufficientCreditsError up front,
    before the caller does any expensive work (an LLM call) — callers must
    check credits BEFORE generating, and only call this AFTER the work
    actually succeeds, so a failed generation is never charged.
    """
    balance = await get_org_credits(org_id, user_token)  # also runs the lazy monthly reset

    if balance["total_available"] < 1:
        raise InsufficientCreditsError(org_id)

    if balance["free_credits_remaining"] >= 1:
        source = "free"
        new_free = balance["free_credits_remaining"] - 1
        await rest_update(
            "organizations",
            {"id": f"eq.{org_id}"},
            {"free_credits_remaining": new_free},
            use_service_role=True,
        )
        new_purchased = balance["purchased_credits"]
    else:
        source = "purchased"
        await rest_insert(
            "credits_ledger",
            {"org_id": org_id, "delta": -1, "reason": reason},
            use_service_role=True,
        )
        new_free = balance["free_credits_remaining"]
        new_purchased = balance["purchased_credits"] - 1

    logger.info(f"Spent 1 credit for org {org_id} ({reason}), source={source}")

    return {
        "spent": 1,
        "source": source,
        "free_credits_remaining": new_free,
        "purchased_credits": new_purchased,
        "total_available": new_free + new_purchased,
    }
