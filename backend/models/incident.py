"""Pydantic models for incidents and threat actors."""
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


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
    geo: Optional[dict] = None
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
    org_id: Optional[str] = None
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
