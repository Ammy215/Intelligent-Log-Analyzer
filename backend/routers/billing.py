"""Billing endpoints: Razorpay Payment Link creation + webhook handler +
credit balance check.

Two separate credit pools: the free monthly allowance (organizations.
free_credits_remaining, lazily reset — see billing/credits.py) and
purchased credits (credits_ledger, Razorpay top-ups only, earned via the
/checkout + /webhook flow below). Spending either is Phase 9 (AI Analyst),
not wired in yet.

Switched from Stripe to Razorpay — Stripe requires an invite-only account
for India. Razorpay sandbox mode is the replacement, and stays sandbox-only
permanently (portfolio project, no real payments ever).
"""
import logging

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request

from billing.credits import get_org_credits
from billing.razorpay_client import RazorpayError, create_payment_link, verify_webhook_signature
from config import settings
from db.supabase import SupabaseError, rest_insert
from middleware.auth import CurrentUser, get_current_user
from middleware.rbac import require_role
from notifications.triggers import notify_payment_confirmation

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/billing", tags=["billing"])

CREDITS_PER_TOPUP = 100  # matches the schema comment's own example (+100 top-up)
TOPUP_AMOUNT_INR = 500   # whole rupees; arbitrary sandbox-mode price, never a real charge

# No real frontend exists yet (Phase 8) — this is a placeholder Razorpay
# redirects the browser to after payment.
CALLBACK_URL = "http://localhost:5173/billing/callback"


@router.get("/credits")
async def credits(user: CurrentUser = Depends(get_current_user)) -> dict:
    """Current credit balance for the caller's org — also the lazy-reset
    trigger point for the monthly free tier. Any org member can check
    their own balance, not just admins.
    """
    try:
        result = await get_org_credits(user.org_id, user.access_token)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return {"status": "success", **result}


@router.post("/checkout")
async def checkout(user: CurrentUser = Depends(require_role("admin"))) -> dict:
    """Create a Razorpay Payment Link for a credit top-up. Admin-only —
    buying credits is a billing action, same tier as other sensitive writes.

    Returns a hosted Razorpay payment URL; the client redirects there. We
    never build our own payment form.
    """
    try:
        link = await create_payment_link(
            org_id=user.org_id,
            amount_inr=TOPUP_AMOUNT_INR,
            description=f"{CREDITS_PER_TOPUP} credit top-up",
            callback_url=CALLBACK_URL,
        )
    except RazorpayError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)

    return {
        "status": "success",
        "checkout_url": link.get("short_url"),
        "payment_link_id": link.get("id"),
    }


@router.post("/webhook")
async def razorpay_webhook(request: Request, background_tasks: BackgroundTasks) -> dict:
    """Razorpay calls this directly — no JWT, verified by signature instead.

    The raw request body is read and verified BEFORE any JSON parsing or
    business logic runs; nothing here trusts an unsigned payload.
    """
    payload = await request.body()
    sig_header = request.headers.get("x-razorpay-signature")

    try:
        event = verify_webhook_signature(payload, sig_header, settings.razorpay_webhook_secret)
    except RazorpayError as e:
        logger.warning(f"Rejected webhook: {e.detail}")
        raise HTTPException(status_code=e.status_code, detail=e.detail)

    event_type = event.get("event")

    if event_type == "payment_link.paid":
        payment_link_entity = event.get("payload", {}).get("payment_link", {}).get("entity", {})
        payment_entity = event.get("payload", {}).get("payment", {}).get("entity", {})
        org_id = payment_link_entity.get("notes", {}).get("org_id")
        payment_id = payment_entity.get("id")

        if not org_id:
            logger.error(f"payment_link.paid event has no org_id in notes (payment {payment_id})")
            return {"status": "ignored", "reason": "no org_id in notes"}

        try:
            await rest_insert(
                "credits_ledger",
                {
                    "org_id": org_id,
                    "delta": CREDITS_PER_TOPUP,
                    "reason": "razorpay_topup",
                    "razorpay_payment_id": payment_id,
                },
                use_service_role=True,
            )
            logger.info(f"Credited {CREDITS_PER_TOPUP} credits to org {org_id} for payment {payment_id}")
            background_tasks.add_task(notify_payment_confirmation, org_id, CREDITS_PER_TOPUP, TOPUP_AMOUNT_INR)
        except SupabaseError as e:
            # 409 = unique constraint on razorpay_payment_id already hit, i.e.
            # Razorpay retried a delivery we already processed. Idempotent
            # no-op, not an error — never double-credit on a retry.
            if e.status_code == 409:
                logger.info(f"Webhook for payment {payment_id} already processed, skipping duplicate")
            else:
                logger.error(f"Failed to record credit top-up for payment {payment_id}: {e.detail}")
                raise HTTPException(status_code=502, detail="Failed to record credit top-up")

    return {"status": "success"}
