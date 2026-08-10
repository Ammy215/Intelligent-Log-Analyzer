"""Report generation endpoints for Phase 5.

Provides endpoints for generating AI-powered security reports:
- POST /reports/executive/{ip} - Executive summary
- POST /reports/incident/{incident_id} - Incident report
- POST /reports/remediation - Remediation plan
- POST /reports/full - Full comprehensive report

Learning: API design for LLM integration, async operations, response formatting.
"""
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from database import get_logs_collection, get_incidents_collection
from middleware.auth import CurrentUser, get_current_user
from threat_intel.ip_profiler import get_ip_profiler
from report_generator.ai_client import get_ai_client
from report_generator.models import (
    ReportMetadata,
    ReportRequest,
    ExecutiveSummary,
)


router = APIRouter(prefix="/api/v1/reports", tags=["reports"])


@router.post("/executive/{ip}")
async def generate_executive_summary(ip: str, user: CurrentUser = Depends(get_current_user)) -> dict:
    """Generate executive summary for an IP address.
    
    Args:
        ip: IP address to generate report for
        
    Returns:
        Executive summary report with key findings and recommendations
        
    Learning: Integrating threat intel + AI for automated report generation
    """
    try:
        # Get threat profile for this IP
        profiler = get_ip_profiler()
        threat_profile = await profiler.profile_ip(ip)
        
        if threat_profile.get("error"):
            raise HTTPException(status_code=404, detail=f"IP {ip} not found or analysis failed")
        
        # Generate AI summary
        ai_client = get_ai_client()
        summary_text = await ai_client.generate_executive_summary(threat_profile)
        
        return {
            "status": "success",
            "ip": ip,
            "report_type": "executive",
            "generated_at": datetime.now().isoformat(),
            "threat_profile": threat_profile,
            "executive_summary": summary_text,
            "key_findings": threat_profile.get("risk_factors", []),
            "risk_level": threat_profile.get("risk_level"),
            "confidence": threat_profile.get("confidence")
        }
    
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Report generation failed: {str(e)}")


@router.post("/incident/{incident_id}")
async def generate_incident_report(incident_id: str, user: CurrentUser = Depends(get_current_user)) -> dict:
    """Generate detailed incident report.
    
    Args:
        incident_id: MongoDB ObjectId of incident
        
    Returns:
        Full incident report with timeline and recommendations
        
    Learning: Converting database records to narrative reports
    """
    try:
        from bson.objectid import ObjectId
        
        incidents_collection = await get_incidents_collection()
        
        # Fetch incident from database
        incident = await incidents_collection.find_one({"_id": ObjectId(incident_id), "org_id": user.org_id})
        
        if not incident:
            raise HTTPException(status_code=404, detail=f"Incident {incident_id} not found")
        
        # Generate AI report
        ai_client = get_ai_client()
        report_text = await ai_client.generate_incident_report(incident)
        
        return {
            "status": "success",
            "incident_id": incident_id,
            "report_type": "incident",
            "generated_at": datetime.now().isoformat(),
            "incident_data": {
                "title": incident.get("title"),
                "description": incident.get("description"),
                "severity": incident.get("severity"),
                "status": incident.get("status"),
                "source_ips": incident.get("source_ips", []),
                "event_types": incident.get("event_types", [])
            },
            "incident_report": report_text
        }
    
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Report generation failed: {str(e)}")


@router.post("/remediation")
async def generate_remediation_plan(
    threat_factors: list = Query(..., description="List of threat factors"),
    risk_level: str = Query(..., description="Risk level: SAFE, SUSPICIOUS, HIGH_RISK, CRITICAL"),
    user: CurrentUser = Depends(get_current_user),
) -> dict:
    """Generate remediation and prevention plan.
    
    Args:
        threat_factors: List of identified threats
        risk_level: Overall risk classification
        
    Returns:
        Prioritized remediation action plan
        
    Learning: Query parameters with list type, dynamic prompt generation
    """
    try:
        if risk_level not in ["SAFE", "SUSPICIOUS", "HIGH_RISK", "CRITICAL"]:
            raise ValueError(f"Invalid risk_level: {risk_level}")
        
        # Generate AI recommendations
        ai_client = get_ai_client()
        plan_text = await ai_client.generate_remediation_plan(threat_factors, risk_level)
        
        return {
            "status": "success",
            "report_type": "remediation",
            "generated_at": datetime.now().isoformat(),
            "risk_level": risk_level,
            "threat_factors": threat_factors,
            "remediation_plan": plan_text
        }
    
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Plan generation failed: {str(e)}")


@router.post("/summary-statistics")
async def generate_summary_statistics(user: CurrentUser = Depends(get_current_user)) -> dict:
    """Generate summary statistics report for all logs.
    
    Returns:
        High-level statistics and insights about current threat landscape
        
    Learning: Database aggregation + AI insights
    """
    try:
        logs_collection = await get_logs_collection()
        org_match = {"org_id": user.org_id}

        # Get statistics
        total_events = await logs_collection.count_documents(org_match)

        # Get severity breakdown
        severity_stats = await logs_collection.aggregate([
            {"$match": org_match},
            {"$group": {"_id": "$severity", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}}
        ]).to_list(None)

        # Get top IPs
        top_ips = await logs_collection.aggregate([
            {"$match": org_match},
            {"$group": {"_id": "$source_ip", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}},
            {"$limit": 5}
        ]).to_list(None)

        # Get event type distribution
        event_types = await logs_collection.aggregate([
            {"$match": org_match},
            {"$group": {"_id": "$event_type", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}}
        ]).to_list(None)
        
        return {
            "status": "success",
            "report_type": "statistics",
            "generated_at": datetime.now().isoformat(),
            "statistics": {
                "total_events": total_events,
                "severity_breakdown": {s["_id"]: s["count"] for s in severity_stats},
                "top_attacking_ips": [{"ip": ip["_id"], "events": ip["count"]} for ip in top_ips],
                "event_type_distribution": {et["_id"]: et["count"] for et in event_types}
            }
        }
    
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Statistics generation failed: {str(e)}")


@router.get("/health")
async def report_health() -> dict:
    """Check report generation service health.
    
    Returns:
        Health status and AI client availability
    """
    ai_client = get_ai_client()
    api_configured = bool(
        ai_client.api_key and ai_client.api_key != "your_key_here"
    )
    
    return {
        "status": "healthy",
        "ai_client": "configured" if api_configured else "mock_mode",
        "model": ai_client.model,
        "message": "Report generation service ready" if api_configured else "Running in mock mode (API key not configured)"
    }
