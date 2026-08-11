"""Thin async Razorpay client — Payment Link creation + webhook signature
verification, via raw httpx calls rather than the razorpay-python SDK.

Same pattern as db/supabase.py and the removed billing/stripe_client.py:
no new dependency, every request this app makes to Razorpay is visible
here. Signature verification uses only Python's standard library
(hmac/hashlib).

Switched from Stripe to Razorpay because Stripe requires an invite-only
account for India — a hard blocker. Razorpay sandbox mode is the
replacement, and stays sandbox-only permanently (portfolio project, no
real payments ever), unlike the original Stripe plan which intended to go
live after Phase 11.

The webhook payload shape below (payment_link.paid structure, field
names) was verified against a real webhook delivery in Phase 6: a real
sandbox payment through a real Razorpay Payment Link, delivered to this
backend via ngrok, signature verified, and credits_ledger correctly
topped up from the actual payload — not just built from documentation.
"""
import hashlib
import hmac
import logging
from typing import Optional

import httpx

from config import settings
from utils.http_client import client as _http_client

logger = logging.getLogger(__name__)

RAZORPAY_API_BASE = "https://api.razorpay.com/v1"


class RazorpayError(Exception):
    def __init__(self, status_code: int, detail: str):
        self.status_code = status_code
        self.detail = detail
        super().__init__(f"Razorpay error {status_code}: {detail}")


async def create_payment_link(org_id: str, amount_inr: int, description: str, callback_url: str) -> dict:
    """Create a Razorpay Payment Link for a one-time credit top-up purchase.

    org_id is attached as a note so the webhook handler can identify which
    org to credit when payment_link.paid fires — Razorpay echoes notes back
    on the event payload unchanged, same role Stripe's session metadata played.

    Args:
        amount_inr: whole-rupee amount (converted to paise, Razorpay's base unit)
    """
    payload = {
        "amount": amount_inr * 100,  # paise
        "currency": "INR",
        "description": description,
        "notify": {"sms": False, "email": False},
        "reminder_enable": False,
        "notes": {"org_id": org_id},
        "callback_url": callback_url,
        "callback_method": "get",
    }

    try:
        resp = await _http_client.post(
            f"{RAZORPAY_API_BASE}/payment_links",
            auth=(settings.razorpay_key_id, settings.razorpay_key_secret),
            json=payload,
        )
    except httpx.RequestError as e:
        logger.error(f"Razorpay payment link request failed: {e}")
        raise RazorpayError(502, f"Could not reach Razorpay: {e}")

    if resp.status_code >= 400:
        raise RazorpayError(resp.status_code, resp.text)
    return resp.json()


def verify_webhook_signature(payload: bytes, sig_header: Optional[str], webhook_secret: str) -> dict:
    """Verify a Razorpay webhook payload against its X-Razorpay-Signature header.

    Unlike Stripe, Razorpay's signature is a single hex HMAC-SHA256 digest
    of the raw body — no embedded timestamp to check for replay tolerance,
    so there's no separate timestamp-window check here (that's a real
    difference from the Stripe implementation, not an oversight).

    Raises RazorpayError (400) on any failure. Returns the parsed JSON
    event only once verified; callers must never parse/act on the body
    before calling this.
    """
    import json

    if not sig_header:
        raise RazorpayError(400, "Missing X-Razorpay-Signature header")

    expected_signature = hmac.new(webhook_secret.encode("utf-8"), payload, hashlib.sha256).hexdigest()

    if not hmac.compare_digest(expected_signature, sig_header):
        raise RazorpayError(400, "Signature verification failed")

    return json.loads(payload)
