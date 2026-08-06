"""Report models and schemas for Pydantic validation.

Defines the structure of various report types that can be generated.

Learning: Pydantic models for data validation and JSON schema generation.
"""
from datetime import datetime
from pydantic import BaseModel, Field
from typing import Optional, List


class ReportMetadata(BaseModel):
    """Metadata about generated report."""

    title: str
    report_type: str  # "executive", "incident", "remediation", "full"
    generated_at: datetime
    generated_by: str = "Intelligent Log Analyzer"
    version: str = "1.0"


class ExecutiveSummary(BaseModel):
    """Executive summary report."""

    metadata: ReportMetadata
    executive_summary: str
    key_findings: List[str]
    risk_assessment: str
    recommendations: List[str]


class IncidentReport(BaseModel):
    """Detailed incident report."""

    metadata: ReportMetadata
    incident_id: Optional[str] = None
    incident_title: str
    incident_description: str
    severity: str
    status: str
    affected_ips: List[str]
    attack_timeline: str
    impact_assessment: str
    root_cause_analysis: str
    recommended_actions: List[str]


class RemediationPlan(BaseModel):
    """Remediation and prevention plan."""

    metadata: ReportMetadata
    risk_factors: List[str]
    risk_level: str
    critical_actions: List[str] = Field(..., description="Within 24 hours")
    high_priority_actions: List[str] = Field(..., description="Within 1 week")
    medium_priority_actions: List[str] = Field(..., description="Within 1 month")
    prevention_measures: List[str]


class FullSecurityReport(BaseModel):
    """Comprehensive security report combining all elements."""

    metadata: ReportMetadata
    executive_summary: str
    threat_overview: str
    incident_details: Optional[IncidentReport] = None
    remediation_plan: Optional[RemediationPlan] = None
    appendix: Optional[str] = None


class ReportRequest(BaseModel):
    """Request model for report generation."""

    report_type: str = Field(..., description="Type: 'executive', 'incident', 'remediation', 'full'")
    ip_address: Optional[str] = None
    incident_id: Optional[str] = None
    include_threat_intel: bool = True
    include_recommendations: bool = True
