"""Abstract base class for all log parsers.

Every parser inherits from this base to ensure consistent interface
and standardized log entry creation.
"""
from abc import ABC, abstractmethod
from datetime import datetime
from typing import Optional

from models.log_entry import LogEntry, GeoModel, ThreatIntelModel


class BaseParser(ABC):
    """Abstract base parser that all format-specific parsers inherit from."""

    @abstractmethod
    def parse(self, raw_log: str) -> Optional[LogEntry]:
        """Parse a single raw log line into a LogEntry model.

        Args:
            raw_log: Raw log line as string

        Returns:
            LogEntry if parsing succeeds, None if it fails

        Must be implemented by each format-specific parser.
        """
        pass

    @abstractmethod
    def parse_batch(self, raw_logs: list[str]) -> list[LogEntry]:
        """Parse multiple raw log lines.

        Args:
            raw_logs: List of raw log line strings

        Returns:
            List of successfully parsed LogEntry objects
        """
        pass

    def _create_log_entry(
        self,
        timestamp: datetime,
        source_ip: str,
        destination_ip: str,
        event_type: str,
        severity: str,
        raw_log: str,
        username: Optional[str] = None,
        target_service: Optional[str] = None,
        port: Optional[int] = None,
        threat_score: int = 0,
        tags: Optional[list[str]] = None,
        **kwargs,
    ) -> LogEntry:
        """Factory method to create a LogEntry with consistent defaults.

        Args:
            timestamp: When the event occurred
            source_ip: Source IP address
            destination_ip: Destination IP address
            event_type: Type of security event
            severity: Severity level (LOW, MEDIUM, HIGH, CRITICAL)
            raw_log: Original log line
            username: Username involved (if applicable)
            target_service: Service targeted (ssh, http, etc)
            port: Port number (if applicable)
            threat_score: Initial threat score (0-100)
            tags: Security tags for categorization
            **kwargs: Additional fields

        Returns:
            Initialized LogEntry
        """
        if tags is None:
            tags = []

        return LogEntry(
            timestamp=timestamp,
            source_ip=source_ip,
            destination_ip=destination_ip,
            event_type=event_type,
            severity=severity,
            username=username,
            target_service=target_service,
            port=port,
            raw_log=raw_log,
            threat_score=threat_score,
            tags=tags,
            geo=GeoModel(),
            threat_intel=ThreatIntelModel(),
            **kwargs,
        )
