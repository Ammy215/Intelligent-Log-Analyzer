"""Fire-and-forget email triggers for background contexts (payment webhook,
incident detection) — neither has a real end-user request to fail loudly to,
so every function here swallows its own errors and only logs. Contrast with
routers/auth.py's resend-verification endpoint, which calls resend_client
directly and lets failures surface, since sending IS that endpoint's feature.

Recipient resolution: org admins' emails, denormalized onto
user_profiles.email at signup (see routers/auth.py) so this never needs an
extra Supabase Admin API round trip per notification.
"""
import logging

from db.supabase import SupabaseError, rest_select
from notifications.resend_client import ResendError, send_email

logger = logging.getLogger(__name__)


async def _org_admin_emails(org_id: str) -> list[str]:
    rows = await rest_select(
        "user_profiles",
        {"select": "email", "org_id": f"eq.{org_id}", "role": "eq.admin"},
        use_service_role=True,
    )
    return [row["email"] for row in rows if row.get("email")]


async def notify_payment_confirmation(org_id: str, credits_added: int, amount_inr: int) -> None:
    """Fires after routers/billing.py's webhook successfully credits an org."""
    try:
        emails = await _org_admin_emails(org_id)
        if not emails:
            logger.warning(f"No admin email on file for org {org_id}, skipping payment confirmation email")
            return
        subject = "Payment received — credits added"
        html = (
            f"<p>Your payment of ₹{amount_inr} was received.</p>"
            f"<p><strong>{credits_added} credits</strong> have been added to your account.</p>"
        )
        for email in emails:
            await send_email(email, subject, html)
        logger.info(f"Payment confirmation email sent to {len(emails)} admin(s) for org {org_id}")
    except (ResendError, SupabaseError) as e:
        logger.error(f"Payment confirmation email failed for org {org_id}: {e}")


async def notify_critical_incident(org_id: str, incident_id: str, title: str, description: str) -> None:
    """Fires immediately per-incident when routers/incidents.py's detector
    creates a CRITICAL-severity incident. No batching/digest — a scheduled
    digest job needs a scheduler, which this project avoids (free-tier /
    no-Docker constraint established earlier in the rebuild)."""
    try:
        emails = await _org_admin_emails(org_id)
        if not emails:
            logger.warning(f"No admin email on file for org {org_id}, skipping CRITICAL incident email")
            return
        subject = f"CRITICAL incident: {title}"
        html = (
            f"<p><strong>A CRITICAL-severity incident was just detected.</strong></p>"
            f"<p><strong>{title}</strong></p><p>{description}</p>"
            f"<p>Incident ID: {incident_id}</p>"
        )
        for email in emails:
            await send_email(email, subject, html)
        logger.info(f"CRITICAL incident email sent to {len(emails)} admin(s) for org {org_id} (incident {incident_id})")
    except (ResendError, SupabaseError) as e:
        logger.error(f"CRITICAL incident email failed for org {org_id} (incident {incident_id}): {e}")
