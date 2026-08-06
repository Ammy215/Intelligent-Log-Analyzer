"""Pattern matching engine for detecting common attack types.

Identifies attack patterns using:
- Regular expressions for payload-based attacks
- Statistical counting for behavioral attacks
- Time-series analysis for timing-based attacks
"""
import re
from datetime import datetime, timedelta


PATTERNS = {
    "brute_force": {
        "condition": "more than 10 failed_login or invalid_user events from same IP in 5 minutes",
        "severity": "HIGH",
        "factor": "brute_force_attempt",
    },
    "credential_stuffing": {
        "condition": "failed_login with more than 5 different usernames from same IP",
        "severity": "HIGH",
        "factor": "multiple_usernames",
    },
    "port_scan": {
        "condition": "more than 20 different destination ports from same IP in 60 seconds",
        "severity": "MEDIUM",
        "factor": "port_scan_detected",
    },
    "sql_injection": {
        "regex": r"(union.*select|select.*from|drop.*table|insert.*into|'.*or.*'.*=|--|;|\*|xp_|sp_)",
        "severity": "CRITICAL",
        "factor": "sql_injection_pattern",
    },
    "directory_traversal": {
        "regex": r"(\.\./|\.\.\\|%2e%2e%2f|%252e%252e%252f|\.\.%5c)",
        "severity": "HIGH",
        "factor": "directory_traversal",
    },
    "xss_attempt": {
        "regex": r"(<script|javascript:|onerror=|onload=|alert\(|eval\(|src=|img)",
        "severity": "HIGH",
        "factor": "xss_pattern",
    },
    "after_hours": {
        "condition": "event timestamp outside 08:00-18:00 local timezone",
        "severity": "LOW",
        "factor": "after_hours_activity",
    },
}


def detect_sql_injection(raw_log: str) -> bool:
    """Detect SQL injection attempts in raw log.

    Args:
        raw_log: Raw log entry string

    Returns:
        True if SQL injection pattern detected
    """
    pattern = PATTERNS["sql_injection"]["regex"]
    return bool(re.search(pattern, raw_log, re.IGNORECASE))


def detect_xss(raw_log: str) -> bool:
    """Detect XSS attempts in raw log.

    Args:
        raw_log: Raw log entry string

    Returns:
        True if XSS pattern detected
    """
    pattern = PATTERNS["xss_attempt"]["regex"]
    return bool(re.search(pattern, raw_log, re.IGNORECASE))


def detect_directory_traversal(raw_log: str) -> bool:
    """Detect directory traversal attempts in raw log.

    Args:
        raw_log: Raw log entry string

    Returns:
        True if directory traversal pattern detected
    """
    pattern = PATTERNS["directory_traversal"]["regex"]
    return bool(re.search(pattern, raw_log, re.IGNORECASE))


def detect_brute_force(
    events: list[dict], time_window_minutes: int = 5
) -> bool:
    """Detect brute force attacks from event list.

    Looks for more than 10 failed_login or invalid_user events in given time window.

    Args:
        events: List of log entry dicts, should be sorted by timestamp
        time_window_minutes: Time window for detection

    Returns:
        True if brute force pattern detected
    """
    if len(events) < 11:
        return False

    # Get first event timestamp
    first_timestamp = events[0].get("timestamp")
    if not first_timestamp:
        return False

    if isinstance(first_timestamp, str):
        first_timestamp = datetime.fromisoformat(first_timestamp)

    window_end = first_timestamp + timedelta(minutes=time_window_minutes)

    # Count auth events in window
    auth_events = 0
    for event in events:
        event_time = event.get("timestamp")
        if isinstance(event_time, str):
            event_time = datetime.fromisoformat(event_time)

        if event_time > window_end:
            break

        event_type = event.get("event_type", "")
        if event_type in ["failed_login", "invalid_user", "brute_force_attempt"]:
            auth_events += 1

    return auth_events > 10


def detect_credential_stuffing(events: list[dict]) -> bool:
    """Detect credential stuffing attacks.

    Looks for failed_login attempts with more than 5 different usernames.

    Args:
        events: List of log entry dicts from same source IP

    Returns:
        True if credential stuffing pattern detected
    """
    usernames = set()

    for event in events:
        if event.get("event_type") in ["failed_login", "invalid_user"]:
            username = event.get("username")
            if username:
                usernames.add(username)

    return len(usernames) > 5


def detect_port_scan(events: list[dict], time_window_seconds: int = 60) -> bool:
    """Detect port scanning activity.

    Looks for more than 20 different destination ports in given time window.

    Args:
        events: List of log entry dicts
        time_window_seconds: Time window for detection

    Returns:
        True if port scan pattern detected
    """
    if len(events) < 21:
        return False

    first_timestamp = events[0].get("timestamp")
    if not first_timestamp:
        return False

    if isinstance(first_timestamp, str):
        first_timestamp = datetime.fromisoformat(first_timestamp)

    window_end = first_timestamp + timedelta(seconds=time_window_seconds)

    ports = set()
    for event in events:
        event_time = event.get("timestamp")
        if isinstance(event_time, str):
            event_time = datetime.fromisoformat(event_time)

        if event_time > window_end:
            break

        port = event.get("port")
        if port:
            ports.add(port)

    return len(ports) > 20


def is_after_hours(timestamp: datetime, local_tz_offset: int = 0) -> bool:
    """Check if event occurred outside business hours.

    Args:
        timestamp: Event timestamp
        local_tz_offset: Local timezone offset in hours

    Returns:
        True if event is outside 08:00-18:00 local time
    """
    if isinstance(timestamp, str):
        timestamp = datetime.fromisoformat(timestamp)

    # Adjust for local timezone
    local_hour = (timestamp.hour + local_tz_offset) % 24

    # Outside business hours
    return local_hour < 8 or local_hour >= 18


def detect_attack_patterns(events: list[dict]) -> list[str]:
    """Main function to detect all attack patterns from event list.
    
    Args:
        events: List of log entry dictionaries
        
    Returns:
        List of detected attack pattern names
    """
    patterns = []
    
    if not events:
        return patterns
    
    # Check behavioral patterns
    if detect_brute_force(events):
        patterns.append("brute_force_attack")
    
    if detect_credential_stuffing(events):
        patterns.append("credential_stuffing")
    
    if detect_port_scan(events):
        patterns.append("port_scanning")
    
    # Check payload-based patterns in raw logs
    for event in events:
        raw_log = event.get("raw_log", "")
        
        if detect_sql_injection(raw_log):
            patterns.append("sql_injection_attack")
        
        if detect_xss(raw_log):
            patterns.append("xss_attack")
        
        if detect_directory_traversal(raw_log):
            patterns.append("directory_traversal_attack")
    
    # Check timing patterns
    for event in events:
        timestamp = event.get("timestamp")
        if timestamp and is_after_hours(timestamp):
            patterns.append("after_hours_activity")
            break  # Only add once per event set
    
    # Detect massive attacks (100+ events = massive brute force)
    if len(events) > 100:
        patterns.append("massive_brute_force")
    elif len(events) > 50:
        patterns.append("sustained_attack")
    
    # Check for root targeting
    root_events = [e for e in events if e.get("username") == "root" or e.get("event_type") == "root_login_attempt"]
    if len(root_events) > 3:
        patterns.append("root_targeting")
    
    # Remove duplicates and return
    return list(set(patterns))
