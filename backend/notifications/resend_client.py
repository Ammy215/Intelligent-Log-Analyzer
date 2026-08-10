"""Thin async client for the Resend transactional email API.

Uses Resend's shared sandbox sender (onboarding@resend.dev) rather than a
verified custom domain — this is a portfolio project with no owned domain
to attach DNS records to, and the sandbox sender is exactly what Resend
provides for this case.

send_email() raises ResendError on failure — callers that treat email as
the actual feature (e.g. a "resend verification" button) should let that
surface to the caller. Callers where email is a side-effect of something
else (payment webhook, incident detection) must catch it themselves and
log-and-continue, never let an email failure break the real feature; see
notifications/triggers.py for that wrapping.
"""
import logging

import httpx

from config import settings

logger = logging.getLogger(__name__)

_RESEND_API_URL = "https://api.resend.com/emails"
FROM_ADDRESS = "Intelligent Log Analyzer <onboarding@resend.dev>"


class ResendError(Exception):
    def __init__(self, status_code: int, detail: str):
        self.status_code = status_code
        self.detail = detail
        super().__init__(f"Resend error {status_code}: {detail}")


async def send_email(to: str, subject: str, html: str) -> dict:
    """Send one email via Resend. Raises ResendError on any failure
    (bad/missing API key, Resend-side error, network failure)."""
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                _RESEND_API_URL,
                headers={
                    "Authorization": f"Bearer {settings.resend_api_key}",
                    "Content-Type": "application/json",
                },
                json={"from": FROM_ADDRESS, "to": [to], "subject": subject, "html": html},
            )
    except httpx.RequestError as e:
        raise ResendError(502, f"Could not reach Resend: {e}")

    if resp.status_code >= 400:
        raise ResendError(resp.status_code, resp.text)
    return resp.json()
