"""Pydantic models for data validation and serialization.

Models define the expected structure of documents and API payloads.
Pydantic v2 provides automatic validation, JSON schema generation, and serialization.
"""
from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, Field


class GeoModel(BaseModel):
    """Geolocation information for an IP address."""

    country: Optional[str] = None
    country_code: Optional[str] = None
    city: Optional[str] = None
    isp: Optional[str] = None
    asn: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None


class ThreatIntelModel(BaseModel):
    """Threat intelligence data aggregated from external sources."""

    abuseipdb_score: Optional[int] = None
    is_known_attacker: bool = False
    otx_pulses: int = 0
    last_checked: Optional[datetime] = None


class LogEntry(BaseModel):
    """Complete log entry document model.

    Matches the MongoDB logs collection schema exactly.
    """

    id: Optional[str] = Field(None, alias="_id")
    org_id: Optional[str] = None
    timestamp: datetime
    source_ip: str
    destination_ip: str
    event_type: str  # failed_login, brute_force, port_scan, sql_injection, xss, directory_traversal
    severity: str  # LOW, MEDIUM, HIGH, CRITICAL
    username: Optional[str] = None
    target_service: Optional[str] = None  # ssh, http, ftp, smtp, rdp
    port: Optional[int] = None
    raw_log: str
    parsed: bool = True
    threat_score: int = 0  # 0-100
    geo: Optional[GeoModel] = None
    threat_intel: Optional[ThreatIntelModel] = None
    ai_summary: Optional[str] = None
    tags: list[str] = Field(default_factory=list)
    incident_id: Optional[str] = None

    class Config:
        """Pydantic config."""

        from_attributes = True
        populate_by_name = True


class ThreatActor(BaseModel):
    """Known malicious IP profile."""

    id: Optional[str] = Field(None, alias="_id")
    ip: str
    first_seen: datetime
    last_seen: datetime
    total_events: int
    event_types: list[str]
    max_threat_score: int
    verdict: str  # SAFE, SUSPICIOUS, HIGH_RISK, CRITICAL
    geo: Optional[GeoModel] = None
    abuseipdb_score: Optional[int] = None
    otx_pulses: int = 0
    notes: Optional[str] = None

    class Config:
        """Pydantic config."""

        from_attributes = True
        populate_by_name = True


class Incident(BaseModel):
    """Grouped attack campaign or incident."""

    id: Optional[str] = Field(None, alias="_id")
    title: str
    description: Optional[str] = None
    severity: str  # LOW, MEDIUM, HIGH, CRITICAL
    status: str = "open"  # open, investigating, closed
    created_at: datetime
    updated_at: datetime
    source_ips: list[str]
    event_types: list[str]
    total_events: int
    start_time: datetime
    end_time: Optional[datetime] = None
    attack_chain: list[str] = Field(default_factory=list)
    ai_report: Optional[str] = None

    class Config:
        """Pydantic config."""

        from_attributes = True
        populate_by_name = True


class Report(BaseModel):
    """Generated AI analysis report."""

    id: Optional[str] = Field(None, alias="_id")
    created_at: datetime
    report_type: str  # ip_profile, incident, summary
    subject: str  # IP or incident ID
    content: str
    recommendations: list[str] = Field(default_factory=list)
    risk_level: str

    class Config:
        """Pydantic config."""

        from_attributes = True
        populate_by_name = True
