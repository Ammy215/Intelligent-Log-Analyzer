"""Apache and Nginx access.log and error.log parser.

Parses HTTP logs for:
- SQL injection attempts
- XSS attempts
- Directory traversal
- 403/404 errors
- HTTP methods and response codes
"""
import logging
import re
from datetime import datetime
from typing import Optional

from parsers.base_parser import BaseParser
from models.log_entry import LogEntry

logger = logging.getLogger(__name__)


class ApacheParser(BaseParser):
    """Parser for Apache/Nginx HTTP access logs."""

    # Apache combined log format:
    # 192.168.1.1 - - [15/Jan/2024:10:23:45 +0000] "GET /api HTTP/1.1" 200 1234 "-" "Mozilla/5.0"
    # Handles paths with special characters and quotes
    ACCESS_LOG_PATTERN = (
        r'(?P<source_ip>[\d\.]+) - - \[(?P<timestamp>[^\]]+)\] '
        r'"(?P<method>\w+) (?P<path>.+?) HTTP/[\d\.]+" '
        r'(?P<status_code>\d+) (?P<bytes>\d+|-) "(?P<referer>[^"]*)" "(?P<user_agent>[^"]*)"'
    )

    # SQL injection patterns in URLs/parameters
    SQL_INJECTION_INDICATORS = [
        r"union.*select",
        r"select.*from",
        r"insert.*into",
        r"drop.*table",
        r"update.*set",
        r"delete.*from",
        r"'.*or.*'.*=",
        r"--",
        r";",
        r"xp_",
        r"sp_",
    ]

    # XSS patterns
    XSS_INDICATORS = [
        r"<script",
        r"javascript:",
        r"onerror=",
        r"onload=",
        r"alert\(",
        r"eval\(",
    ]

    # Directory traversal patterns
    TRAVERSAL_INDICATORS = [
        r"\.\./",
        r"\.\.\\",
        r"%2e%2e",
        r"etc/passwd",
        r"windows/system",
    ]

    def parse(self, raw_log: str) -> Optional[LogEntry]:
        """Parse single Apache access log line.

        Args:
            raw_log: Raw Apache log entry

        Returns:
            LogEntry if parsing succeeds, None otherwise
        """
        try:
            match = re.search(self.ACCESS_LOG_PATTERN, raw_log)
            if not match:
                return None

            groups = match.groupdict()
            source_ip = groups["source_ip"]
            timestamp_str = groups["timestamp"]
            method = groups["method"]
            path = groups["path"]
            status_code = int(groups["status_code"])
            user_agent = groups.get("user_agent", "")

            # Parse Apache timestamp: "15/Jan/2024:10:23:45 +0000"
            try:
                timestamp = datetime.strptime(
                    timestamp_str.split(" ")[0], "%d/%b/%Y:%H:%M:%S"
                )
            except ValueError:
                timestamp = datetime.now()

            # Determine event type and severity based on patterns and status code
            event_type = "http_request"
            severity = "LOW"
            threat_score = 0
            tags = []

            # Check for malicious patterns
            if self._has_sql_injection(path):
                event_type = "sql_injection"
                severity = "CRITICAL"
                threat_score = 85
                tags.append("sql_injection")

            elif self._has_xss(path):
                event_type = "xss"
                severity = "HIGH"
                threat_score = 65
                tags.append("xss")

            elif self._has_directory_traversal(path):
                event_type = "directory_traversal"
                severity = "HIGH"
                threat_score = 60
                tags.append("directory_traversal")

            # Check for error status codes
            elif status_code == 403:
                event_type = "forbidden_access"
                severity = "MEDIUM"
                threat_score = 15
                tags.append("403_forbidden")

            elif status_code == 404:
                event_type = "not_found"
                severity = "LOW"
                threat_score = 3
                tags.append("404_notfound")

            elif status_code == 401:
                event_type = "unauthorized"
                severity = "MEDIUM"
                threat_score = 10
                tags.append("401_unauthorized")

            elif status_code >= 500:
                event_type = "server_error"
                severity = "MEDIUM"
                threat_score = 20
                tags.append(f"5xx_error")

            tags.extend(["http", "web"])

            return self._create_log_entry(
                timestamp=timestamp,
                source_ip=source_ip,
                destination_ip="0.0.0.0",  # Server IP not in access log
                event_type=event_type,
                severity=severity,
                raw_log=raw_log,
                target_service="http",
                port=80 if status_code < 400 else 443,
                threat_score=threat_score,
                tags=tags,
            )

        except Exception as e:
            logger.error(f"Apache parser error: {e}")
            return None

    def parse_batch(self, raw_logs: list[str]) -> list[LogEntry]:
        """Parse multiple Apache log entries.

        Args:
            raw_logs: List of raw Apache log lines

        Returns:
            List of successfully parsed LogEntry objects
        """
        entries = []
        for raw_log in raw_logs:
            entry = self.parse(raw_log)
            if entry:
                entries.append(entry)
        return entries

    def _has_sql_injection(self, path: str) -> bool:
        """Check if path contains SQL injection indicators."""
        for pattern in self.SQL_INJECTION_INDICATORS:
            if re.search(pattern, path, re.IGNORECASE):
                return True
        return False

    def _has_xss(self, path: str) -> bool:
        """Check if path contains XSS indicators."""
        for pattern in self.XSS_INDICATORS:
            if re.search(pattern, path, re.IGNORECASE):
                return True
        return False

    def _has_directory_traversal(self, path: str) -> bool:
        """Check if path contains directory traversal indicators."""
        for pattern in self.TRAVERSAL_INDICATORS:
            if re.search(pattern, path, re.IGNORECASE):
                return True
        return False
