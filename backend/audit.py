"""Audit log writer — audit_logs has existed in the Postgres schema (and its
RLS "org admins can read own audit logs" policy) since Phase 1, but nothing
ever wrote to it until now. Minimal scope for Phase 10: log successful/
failed login and detection_rules weight edits — the security-relevant
actions that exist today. Extend this as new admin-relevant actions get
built, not by guessing ahead of what actually exists.

Always uses the service role: audit_logs has no INSERT policy for regular
authenticated users on purpose (an audit trail writable by the actor it's
auditing isn't a trustworthy audit trail), only a service-role bypass path.
"""
import logging
from typing import Optional

from db.supabase import rest_insert

logger = logging.getLogger(__name__)


async def log_action(
    action: str,
    org_id: Optional[str] = None,
    actor_id: Optional[str] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> None:
    """Best-effort audit write — never raises. A failed audit-log insert
    must not break the real action it was recording (a login, a rule
    edit); it should only ever be logged and swallowed, same pattern as
    the email/enrichment background triggers elsewhere in this app."""
    try:
        await rest_insert(
            "audit_logs",
            {
                "org_id": org_id,
                "actor_id": actor_id,
                "action": action,
                "ip_address": ip_address,
                "user_agent": user_agent,
            },
            use_service_role=True,
        )
    except Exception as e:
        logger.warning(f"Audit log write failed for action={action!r}: {e}")
