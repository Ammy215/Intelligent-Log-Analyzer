"""SSH auth.log parser for Unix-like systems.

Parses /var/log/auth.log entries with a focus on sshd authentication events.
Handles failed logins, successful logins, invalid users, brute force detection.
"""
import logging
import re
from datetime import datetime
from typing import Optional

from parsers.base_parser import BaseParser
from models.log_entry import LogEntry

logger = logging.getLogger(__name__)


class SSHParser(BaseParser):
    """Parser for SSH authentication log entries."""

    # Regex patterns for common SSH events
    FAILED_PASSWORD_PATTERN = (
        r"Failed password for (?P<username>\S+) from (?P<source_ip>[\d\.]+) port (?P<port>\d+)"
    )
    INVALID_USER_PATTERN = (
        r"Invalid user (?P<username>\S+) from (?P<source_ip>[\d\.]+) port (?P<port>\d+)"
    )
    ACCEPTED_PASSWORD_PATTERN = (
        r"Accepted password for (?P<username>\S+) from (?P<source_ip>[\d\.]+) port (?P<port>\d+)"
    )
    ROOT_LOGIN_PATTERN = r"ROOT LOGIN REFUSED from (?P<source_ip>[\d\.]+)"
    BRUTE_FORCE_PATTERN = r"Received disconnect from (?P<source_ip>[\d\.]+).*\[preauth\]"

    def parse(self, raw_log: str) -> Optional[LogEntry]:
        """Parse single SSH log line.

        Args:
            raw_log: Raw SSH log entry

        Returns:
            LogEntry if parsing succeeds, None otherwise
        """
        try:
            # Extract timestamp, hostname, and message from typical syslog format
            # Format: Mon DD HH:MM:SS hostname sshd[PID]: message
            timestamp_match = re.match(
                r"(\w+ \s?\d{1,2} \d{2}:\d{2}:\d{2}) \S+ sshd\[\d+\]: (.*)",
                raw_log,
            )

            if not timestamp_match:
                return None

            timestamp_str, message = timestamp_match.groups()
            timestamp = self._parse_syslog_timestamp(timestamp_str)

            # Try each pattern
            if "Failed password" in message:
                return self._parse_failed_password(raw_log, timestamp, message)
            elif "Invalid user" in message:
                return self._parse_invalid_user(raw_log, timestamp, message)
            elif "Accepted password" in message:
                return self._parse_accepted_password(raw_log, timestamp, message)
            elif "ROOT LOGIN REFUSED" in message:
                return self._parse_root_login_refused(raw_log, timestamp, message)
            elif "Received disconnect" in message and "[preauth]" in message:
                return self._parse_brute_force(raw_log, timestamp, message)

            return None

        except Exception as e:
            logger.error(f"SSH parser error: {e}")
            return None

    def parse_batch(self, raw_logs: list[str]) -> list[LogEntry]:
        """Parse multiple SSH log entries.

        Args:
            raw_logs: List of raw SSH log lines

        Returns:
            List of successfully parsed LogEntry objects
        """
        entries = []
        for raw_log in raw_logs:
            entry = self.parse(raw_log)
            if entry:
                entries.append(entry)
        return entries

    def _parse_failed_password(self, raw_log: str, timestamp: datetime, message: str) -> Optional[LogEntry]:
        """Parse 'Failed password' event."""
        match = re.search(self.FAILED_PASSWORD_PATTERN, message)
        if not match:
            return None

        username = match.group("username")
        source_ip = match.group("source_ip")
        port = int(match.group("port"))

        return self._create_log_entry(
            timestamp=timestamp,
            source_ip=source_ip,
            destination_ip="0.0.0.0",  # SSH logs don't include server IP, use placeholder
            event_type="failed_login",
            severity="MEDIUM",
            raw_log=raw_log,
            username=username,
            target_service="ssh",
            port=port,
            threat_score=15,
            tags=["ssh", "failed_login", "authentication_failure"],
        )

    def _parse_invalid_user(self, raw_log: str, timestamp: datetime, message: str) -> Optional[LogEntry]:
        """Parse 'Invalid user' event."""
        match = re.search(self.INVALID_USER_PATTERN, message)
        if not match:
            return None

        username = match.group("username")
        source_ip = match.group("source_ip")
        port = int(match.group("port"))

        return self._create_log_entry(
            timestamp=timestamp,
            source_ip=source_ip,
            destination_ip="0.0.0.0",
            event_type="invalid_user",
            severity="MEDIUM",
            raw_log=raw_log,
            username=username,
            target_service="ssh",
            port=port,
            threat_score=10,
            tags=["ssh", "invalid_user", "credential_stuffing"],
        )

    def _parse_accepted_password(self, raw_log: str, timestamp: datetime, message: str) -> Optional[LogEntry]:
        """Parse 'Accepted password' event."""
        match = re.search(self.ACCEPTED_PASSWORD_PATTERN, message)
        if not match:
            return None

        username = match.group("username")
        source_ip = match.group("source_ip")
        port = int(match.group("port"))

        return self._create_log_entry(
            timestamp=timestamp,
            source_ip=source_ip,
            destination_ip="0.0.0.0",
            event_type="successful_login",
            severity="LOW",
            raw_log=raw_log,
            username=username,
            target_service="ssh",
            port=port,
            threat_score=0,
            tags=["ssh", "successful_login"],
        )

    def _parse_root_login_refused(self, raw_log: str, timestamp: datetime, message: str) -> Optional[LogEntry]:
        """Parse 'ROOT LOGIN REFUSED' event."""
        match = re.search(self.ROOT_LOGIN_PATTERN, message)
        if not match:
            return None

        source_ip = match.group("source_ip")

        return self._create_log_entry(
            timestamp=timestamp,
            source_ip=source_ip,
            destination_ip="0.0.0.0",
            event_type="root_login_attempt",
            severity="HIGH",
            raw_log=raw_log,
            username="root",
            target_service="ssh",
            port=22,
            threat_score=25,
            tags=["ssh", "root_login_attempt", "privilege_escalation"],
        )

    def _parse_brute_force(self, raw_log: str, timestamp: datetime, message: str) -> Optional[LogEntry]:
        """Parse brute force indicators from disconnect messages."""
        match = re.search(self.BRUTE_FORCE_PATTERN, message)
        if not match:
            return None

        source_ip = match.group("source_ip")

        return self._create_log_entry(
            timestamp=timestamp,
            source_ip=source_ip,
            destination_ip="0.0.0.0",
            event_type="brute_force_attempt",
            severity="HIGH",
            raw_log=raw_log,
            target_service="ssh",
            port=22,
            threat_score=30,
            tags=["ssh", "brute_force", "multiple_attempts"],
        )

    @staticmethod
    def _parse_syslog_timestamp(timestamp_str: str) -> datetime:
        """Parse syslog timestamp format: 'Mon DD HH:MM:SS' without year.

        Uses current year as fallback.

        Args:
            timestamp_str: Syslog timestamp string

        Returns:
            datetime object
        """
        # Use current year since syslog doesn't include year
        current_year = datetime.now().year
        timestamp_str_with_year = f"{timestamp_str} {current_year}"

        try:
            return datetime.strptime(timestamp_str_with_year, "%b %d %H:%M:%S %Y")
        except ValueError:
            # Fallback if parsing fails
            return datetime.now()
