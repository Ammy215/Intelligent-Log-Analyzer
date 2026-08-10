"""Windows Event Log (EVTX) parser for Security log authentication/privilege events.

Unlike SSH/Apache logs, EVTX is a binary chunked format, not line-delimited
text — parse() here takes one already-extracted event record as an XML
string (matching what python-evtx yields per record), not a raw text line.
extract_records_from_evtx_bytes() handles the binary -> XML-strings step.
"""
import tempfile
import xml.etree.ElementTree as ET
from datetime import datetime
from pathlib import Path
from typing import Optional

import Evtx.Evtx as evtx

from parsers.base_parser import BaseParser
from models.log_entry import LogEntry

NS = {"e": "http://schemas.microsoft.com/win/2004/08/events/event"}

# Security-log Event IDs mapped to (event_type, severity, threat_score, tags).
# Reference: Windows Security Auditing event ID documentation.
EVENT_ID_MAP: dict[str, tuple[str, str, int, list[str]]] = {
    "4624": ("successful_login", "LOW", 0, ["windows", "successful_login"]),
    "4625": ("failed_login", "MEDIUM", 15, ["windows", "failed_login", "authentication_failure"]),
    "4648": ("explicit_credential_logon", "MEDIUM", 10, ["windows", "explicit_credentials"]),
    "4672": ("privileged_logon", "HIGH", 20, ["windows", "privilege_escalation", "admin_logon"]),
    "4720": ("account_created", "MEDIUM", 15, ["windows", "account_created"]),
    "4732": ("group_membership_change", "HIGH", 20, ["windows", "privilege_escalation", "group_change"]),
    "1102": ("audit_log_cleared", "CRITICAL", 40, ["windows", "log_tampering", "anti_forensics"]),
}


class WindowsEventParser(BaseParser):
    """Parser for Windows Security Event Log (EVTX) records."""

    @staticmethod
    def extract_records_from_evtx_bytes(file_bytes: bytes) -> list[str]:
        """Extract each event record as an XML string from raw .evtx file bytes.

        python-evtx's Evtx class needs a filesystem path, so the uploaded
        bytes are written to a temp file for the duration of extraction.
        """
        with tempfile.NamedTemporaryFile(suffix=".evtx", delete=False) as tmp:
            tmp.write(file_bytes)
            tmp_path = tmp.name

        try:
            records = []
            with evtx.Evtx(tmp_path) as log:
                for record in log.records():
                    records.append(record.xml())
            return records
        finally:
            Path(tmp_path).unlink(missing_ok=True)

    def parse(self, raw_log: str) -> Optional[LogEntry]:
        """Parse a single Windows Event Log record (XML string).

        Args:
            raw_log: One event record's XML, as produced by python-evtx's
                Record.xml() — not a raw text line.

        Returns:
            LogEntry if the event ID is a recognized security-relevant
            event, None otherwise (unmapped event IDs are silently skipped,
            same as unmatched lines in the other parsers).
        """
        try:
            root = ET.fromstring(raw_log)

            event_id_el = root.find(".//e:System/e:EventID", NS)
            if event_id_el is None or event_id_el.text not in EVENT_ID_MAP:
                return None
            event_id = event_id_el.text
            event_type, severity, threat_score, tags = EVENT_ID_MAP[event_id]

            time_created_el = root.find(".//e:System/e:TimeCreated", NS)
            timestamp = self._parse_evtx_timestamp(
                time_created_el.get("SystemTime") if time_created_el is not None else None
            )

            computer_el = root.find(".//e:System/e:Computer", NS)
            computer = computer_el.text if computer_el is not None else "unknown"

            event_data = {
                data.get("Name"): (data.text or "")
                for data in root.findall(".//e:EventData/e:Data", NS)
                if data.get("Name")
            }

            username = event_data.get("TargetUserName")
            ip_address = event_data.get("IpAddress")
            source_ip = ip_address if ip_address and ip_address != "-" else "0.0.0.0"

            return self._create_log_entry(
                timestamp=timestamp,
                source_ip=source_ip,
                destination_ip="0.0.0.0",  # EVTX identifies the host via Computer, not an IP
                event_type=event_type,
                severity=severity,
                raw_log=raw_log,
                username=username if username and username != "-" else None,
                target_service="windows",
                threat_score=threat_score,
                tags=[*tags, f"host:{computer}"],
            )

        except ET.ParseError as e:
            print(f"Windows event parser XML error: {e}")
            return None
        except Exception as e:
            print(f"Windows event parser error: {e}")
            return None

    def parse_batch(self, raw_logs: list[str]) -> list[LogEntry]:
        """Parse multiple event records (XML strings).

        Args:
            raw_logs: List of event record XML strings.

        Returns:
            List of successfully parsed LogEntry objects.
        """
        entries = []
        for raw_log in raw_logs:
            entry = self.parse(raw_log)
            if entry:
                entries.append(entry)
        return entries

    @staticmethod
    def _parse_evtx_timestamp(system_time: Optional[str]) -> datetime:
        """Parse EVTX's TimeCreated SystemTime attribute (ISO 8601, e.g.
        '2024-01-15T10:23:45.123456Z')."""
        if not system_time:
            return datetime.now()
        try:
            return datetime.fromisoformat(system_time.replace("Z", "+00:00"))
        except ValueError:
            return datetime.now()
