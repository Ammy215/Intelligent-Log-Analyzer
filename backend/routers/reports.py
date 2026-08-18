"""Report generation endpoints for Phase 5.

Provides endpoints for generating AI-powered security reports:
- POST /reports/executive/{ip} - Executive summary
- POST /reports/incident/{incident_id} - Incident report
- POST /reports/remediation - Remediation plan
- POST /reports/full - Full comprehensive report

Learning: API design for LLM integration, async operations, response formatting.
"""
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query

from analyzers.threat_scorer import get_org_weights, get_threat_verdict
from config import settings
from database import get_logs_collection, get_incidents_collection
from middleware.auth import CurrentUser
from middleware.rate_limit import rate_limit_by_org
from middleware.rbac import require_role
from threat_intel.ip_profiler import get_ip_profiler
from report_generator.gemini_client import (
    GeminiError,
    generate_executive_summary as gemini_generate_executive_summary,
    generate_incident_report as gemini_generate_incident_report,
    generate_remediation_plan as gemini_generate_remediation_plan,
)
from billing.credits import InsufficientCreditsError, spend_credit


router = APIRouter(prefix="/api/v1/reports", tags=["reports"])


@router.post("/executive/{ip}")
async def generate_executive_summary(
    ip: str,
    user: CurrentUser = Depends(rate_limit_by_org("ai_analyst", 5, 60)),
    _role_check: CurrentUser = Depends(require_role("admin", "analyst")),
) -> dict:
    """Generate an executive summary for an IP address, via Gemini.

    The profile is built from this org's own log events for the IP plus
    external threat intel. Passing that local context is not optional: this
    endpoint used to call profile_ip() with no event_count or threat
    factors, so the profile always came back with zero local events and a
    SAFE-leaning composite score — the summary then reported "0 detected
    security events" for IPs the rest of the app scored CRITICAL. The
    aggregation below mirrors what /analysis/ip/{ip} already does.
    """
    try:
        logs_collection = await get_logs_collection()
        events = await logs_collection.find(
            {"source_ip": ip, "org_id": user.org_id}
        ).to_list(None)

        if not events:
            raise HTTPException(status_code=404, detail=f"No events found for IP {ip}")

        # Distinct tags across this IP's events are the local threat factors
        # the scorer weights (same inputs /analysis/ip/{ip} feeds it).
        threat_factors = sorted({
            tag for event in events for tag in (event.get("tags") or []) if tag
        })

        # What our own logs actually recorded. This is the authoritative risk
        # signal for the summary: the profiler's composite is tag-derived, and
        # ingested events often carry no tags, which collapses it to "SAFE"
        # even when the stored per-event scores say CRITICAL. get_threat_verdict
        # on the max stored score is exactly what /analysis/ip and the UI show,
        # so the report agrees with the rest of the app instead of contradicting it.
        scores = [e.get("threat_score", 0) or 0 for e in events]
        severity_breakdown: dict[str, int] = {}
        for e in events:
            sev = e.get("severity") or "UNKNOWN"
            severity_breakdown[sev] = severity_breakdown.get(sev, 0) + 1
        observed = {
            "total_events": len(events),
            "max_threat_score": max(scores),
            "avg_threat_score": round(sum(scores) / len(scores), 1),
            "severity_breakdown": severity_breakdown,
            "event_types": sorted({e.get("event_type") for e in events if e.get("event_type")}),
            "verdict": get_threat_verdict(int(max(scores)), 0),
        }

        profiler = get_ip_profiler()
        weights = await get_org_weights(user.org_id, user.access_token)
        threat_profile = await profiler.profile_ip(
            ip,
            local_threat_factors=threat_factors,
            event_count=len(events),
            weights=weights,
        )

        if threat_profile.get("error"):
            raise HTTPException(status_code=404, detail=f"IP {ip} not found or analysis failed")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Report generation failed: {str(e)}")

    # Outside the try above so a Gemini failure surfaces as a 502 with its
    # real reason, instead of being flattened into a generic 400 — and so it
    # can never be silently replaced with placeholder text.
    try:
        summary_text = await gemini_generate_executive_summary(threat_profile, observed)
    except GeminiError as e:
        raise HTTPException(status_code=502, detail=f"Report generation failed: {e.detail}")

    return {
        "status": "success",
        "ip": ip,
        "report_type": "executive",
        "generated_at": datetime.now().isoformat(),
        "threat_profile": threat_profile,
        "executive_summary": summary_text,
        "key_findings": threat_profile.get("risk_factors", []),
        # risk_level is the verdict from our own logged events, matching
        # /analysis/ip and the UI — not the enrichment composite, which reads
        # SAFE whenever events carry no tags.
        "risk_level": observed["verdict"],
        "enrichment_risk_level": threat_profile.get("risk_level"),
        "confidence": threat_profile.get("confidence"),
        "observed": observed,
        "total_events": len(events),
    }


@router.post("/incident/{incident_id}")
async def generate_incident_report(
    incident_id: str,
    user: CurrentUser = Depends(rate_limit_by_org("ai_analyst", 5, 60)),
    _role_check: CurrentUser = Depends(require_role("admin", "analyst")),
) -> dict:
    """Generate an AI incident report from real incident data (Gemini SDK,
    direct call — no LangChain). Credit-metered: 1 credit per report,
    checked BEFORE generation and only deducted AFTER Gemini actually
    succeeds, so a failed call is never charged. This is the only
    credit-gated endpoint in the app — every other feature stays free.

    The generated report is persisted onto the incident document's
    ai_report field, so Incidents.jsx's detail view shows it on future
    loads without regenerating (and re-spending a credit).
    """
    from bson.objectid import ObjectId

    incidents_collection = await get_incidents_collection()
    incident = await incidents_collection.find_one({"_id": ObjectId(incident_id), "org_id": user.org_id})

    if not incident:
        raise HTTPException(status_code=404, detail=f"Incident {incident_id} not found")

    from billing.credits import get_org_credits

    balance = await get_org_credits(user.org_id, user.access_token)
    if balance["total_available"] < 1:
        raise HTTPException(
            status_code=402,
            detail="Out of credits — you have 0 free and 0 purchased credits remaining. Buy more credits to continue.",
        )

    try:
        report_text = await gemini_generate_incident_report(incident)
    except GeminiError as e:
        raise HTTPException(status_code=502, detail=f"Report generation failed, no credit charged: {e.detail}")

    try:
        spend_result = await spend_credit(user.org_id, user.access_token, reason="ai_analyst_incident_report")
    except InsufficientCreditsError:
        # Balance changed between the check above and now (race) — the
        # report was already generated, but we still refuse to charge past
        # zero. Report is returned anyway since generation already happened
        # and cost real API usage; the credit gate protects future calls.
        spend_result = {"spent": 0, "source": None, **balance}

    await incidents_collection.update_one(
        {"_id": ObjectId(incident_id), "org_id": user.org_id},
        {"$set": {"ai_report": report_text}},
    )

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
        "incident_report": report_text,
        "credits": spend_result,
    }


@router.post("/remediation")
async def generate_remediation_plan(
    threat_factors: list = Query(..., description="List of threat factors"),
    risk_level: str = Query(..., description="Risk level: SAFE, SUSPICIOUS, HIGH_RISK, CRITICAL"),
    user: CurrentUser = Depends(rate_limit_by_org("ai_analyst", 5, 60)),
    _role_check: CurrentUser = Depends(require_role("admin", "analyst")),
) -> dict:
    """Generate a remediation and prevention plan, via Gemini.

    No UI currently calls this (see the spec doc's known-unused-endpoint
    note) — it is kept as a working future feature, so it runs on the same
    real AI path as every other report rather than returning canned text.
    """
    if risk_level not in ["SAFE", "SUSPICIOUS", "HIGH_RISK", "CRITICAL"]:
        raise HTTPException(status_code=400, detail=f"Invalid risk_level: {risk_level}")

    try:
        plan_text = await gemini_generate_remediation_plan(threat_factors, risk_level)
    except GeminiError as e:
        raise HTTPException(status_code=502, detail=f"Plan generation failed: {e.detail}")

    return {
        "status": "success",
        "report_type": "remediation",
        "generated_at": datetime.now().isoformat(),
        "risk_level": risk_level,
        "threat_factors": threat_factors,
        "remediation_plan": plan_text,
    }


@router.post("/summary-statistics")
async def generate_summary_statistics(
    user: CurrentUser = Depends(rate_limit_by_org("ai_analyst", 5, 60)),
    _role_check: CurrentUser = Depends(require_role("admin", "analyst")),
) -> dict:
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
    """Report-generation service health.

    There is no longer a "mock mode" to report: without a configured key
    every report path raises instead of returning fabricated text, so this
    reports configured/not-configured honestly.
    """
    api_configured = bool(settings.gemini_api_key)

    return {
        "status": "healthy" if api_configured else "degraded",
        "ai_provider": "gemini",
        "ai_client": "configured" if api_configured else "not_configured",
        "model": settings.gemini_model,
        "message": (
            "Report generation service ready"
            if api_configured
            else "GEMINI_API_KEY is not set — report generation will fail"
        ),
    }
