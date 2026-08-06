"""Threat scoring engine for calculating IP threat levels.

Implements weighted scoring (0-100) based on attack patterns, event types,
and threat intelligence signals. Returns severity verdict and contributing factors.
"""

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


def calculate_threat_score(factors: list[str]) -> dict:
    """Calculate threat score from a list of contributing factors.

    Args:
        factors: List of threat factor keys

    Returns:
        Dictionary with score (0-100), severity label, and contributing factors
    """
    score = 0
    for factor in factors:
        if factor in THREAT_WEIGHTS:
            score += THREAT_WEIGHTS[factor]

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
        "contributing_weights": {f: THREAT_WEIGHTS.get(f, 0) for f in factors},
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
