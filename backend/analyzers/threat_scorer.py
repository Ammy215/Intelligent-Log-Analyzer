"""Threat scoring engine for calculating IP threat levels.

Implements weighted scoring (0-100) based on attack patterns, event types,
and threat intelligence signals. Returns severity verdict and contributing factors.
"""
import logging
from typing import Optional

from db.supabase import rest_select

logger = logging.getLogger(__name__)

# Fallback weights used when an org has no configured detection_rules (or
# the Postgres fetch fails) — every org gets its own copy of these seeded
# into detection_rules at signup (see routers/auth.py), so this dict is a
# safety net, not the primary source of truth going forward.
THREAT_WEIGHTS = {
    # Login/auth attacks
    "failed_login_1_to_5": 5,
    "failed_login_6_to_20": 15,
    "failed_login_over_20": 30,  # Confirmed brute force
    "multiple_usernames": 10,  # Credential stuffing
    "root_login_attempt": 10,  # Targeting privileged account
    # Network attacks
    "port_scan_detected": 15,
    "rapid_sequential_ports": 20,
    "syn_flood_pattern": 25,
    # Web attacks
    "sql_injection_pattern": 20,
    "xss_pattern": 15,
    "directory_traversal": 15,
    "repeated_403_errors": 8,
    "repeated_404_errors": 5,
    # Threat intelligence signals
    "known_attacker_ip": 25,  # In threat_actors collection
    "abuseipdb_score_over_80": 20,
    "abuseipdb_score_over_50": 10,
    "otx_pulse_match": 15,
    # Geographic / behavioral signals
    "foreign_high_risk_country": 8,
    "after_hours_activity": 5,
    "tor_exit_node": 15,
    "datacenter_ip": 5,
    # Escalation signals
    "lateral_movement": 20,
    "privilege_escalation": 25,
    # SSH specific
    "invalid_user_attempts": 8,
    "brute_force_attempt": 20,
}

SEVERITY_LABELS = {
    (0, 20): "LOW",
    (20, 45): "MEDIUM",
    (45, 70): "HIGH",
    (70, 101): "CRITICAL",
}


async def get_org_weights(org_id: str, user_token: str) -> dict[str, int]:
    """Fetch this org's detection rule weights from Postgres.

    Falls back to the hardcoded THREAT_WEIGHTS defaults if the org has no
    enabled rules or the fetch fails, so a Postgres hiccup never blocks log
    ingestion or scoring — it just temporarily loses per-org tuning.
    """
    try:
        rows = await rest_select(
            "detection_rules",
            {"select": "rule_key,weight", "org_id": f"eq.{org_id}", "enabled": "eq.true"},
            user_token=user_token,
        )
        if not rows:
            return THREAT_WEIGHTS
        return {row["rule_key"]: row["weight"] for row in rows}
    except Exception as e:
        logger.warning(f"Failed to fetch detection_rules for org {org_id}, falling back to defaults: {e}")
        return THREAT_WEIGHTS


def calculate_threat_score(factors: list[str], weights: Optional[dict[str, int]] = None) -> dict:
    """Calculate threat score from a list of contributing factors.

    Args:
        factors: List of threat factor keys
        weights: Org-specific weights from get_org_weights(). Falls back to
            the hardcoded THREAT_WEIGHTS defaults if not provided or empty.

    Returns:
        Dictionary with score (0-100), severity label, and contributing factors
    """
    active_weights = weights if weights else THREAT_WEIGHTS

    score = 0
    for factor in factors:
        if factor in active_weights:
            score += active_weights[factor]

    # Cap at 100
    score = min(score, 100)

    # Determine severity
    severity = "LOW"
    for (low, high), label in SEVERITY_LABELS.items():
        if low <= score < high:
            severity = label
            break

    return {
        "score": score,
        "severity": severity,
        "factors": factors,
        "contributing_weights": {f: active_weights.get(f, 0) for f in factors},
    }


def get_threat_verdict(score: int, abuseipdb_score: int = 0) -> str:
    """Get human-readable verdict based on threat score.

    Args:
        score: Threat score 0-100
        abuseipdb_score: External AbuseIPDB score

    Returns:
        Verdict string: SAFE, SUSPICIOUS, HIGH_RISK, or CRITICAL
    """
    if score < 20 and abuseipdb_score < 25:
        return "SAFE"
    elif score < 45 and abuseipdb_score < 50:
        return "SUSPICIOUS"
    elif score < 70 and abuseipdb_score < 75:
        return "HIGH_RISK"
    else:
        return "CRITICAL"


def count_event_type(event_type: str, count: int) -> list[str]:
    """Get threat factors based on event type count.

    Args:
        event_type: Type of event (failed_login, etc)
        count: Number of occurrences

    Returns:
        List of threat factors
    """
    factors = []

    if event_type == "failed_login":
        if 1 <= count <= 5:
            factors.append("failed_login_1_to_5")
        elif 6 <= count <= 20:
            factors.append("failed_login_6_to_20")
        elif count > 20:
            factors.append("failed_login_over_20")

    elif event_type == "invalid_user":
        factors.append("invalid_user_attempts")

    elif event_type == "brute_force_attempt":
        factors.append("brute_force_attempt")

    elif event_type == "root_login_attempt":
        factors.append("root_login_attempt")

    elif event_type == "sql_injection":
        factors.append("sql_injection_pattern")

    elif event_type == "xss":
        factors.append("xss_pattern")

    elif event_type == "directory_traversal":
        factors.append("directory_traversal")

    return factors
