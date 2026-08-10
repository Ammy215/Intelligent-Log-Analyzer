"""Incident management endpoints.

This router provides:
- GET /incidents - List all incidents
- GET /incidents/{id} - Get single incident
- POST /incidents/detect - Auto-detect and group attacks into incidents
- PATCH /incidents/{id}/status - Update incident status
"""
from datetime import datetime, timedelta
from typing import Optional

from bson.objectid import ObjectId
from fastapi import APIRouter, Depends, Query, HTTPException, Body

from database import (
    get_logs_collection,
    get_incidents_collection,
    get_threat_actors_collection,
)
from middleware.auth import CurrentUser, get_current_user
from models.incident import Incident, ThreatActor

router = APIRouter(prefix="/api/v1/incidents", tags=["incidents"])


@router.get("")
async def list_incidents(
    severity: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=100),
    skip: int = Query(0, ge=0),
    user: CurrentUser = Depends(get_current_user),
) -> dict:
    """List incidents with optional filters.

    Args:
        severity: Filter by severity (LOW, MEDIUM, HIGH, CRITICAL)
        status: Filter by status (open, investigating, closed)
        limit: Number of incidents to return
        skip: Number of incidents to skip

    Returns:
        Dictionary with incident list and metadata
    """
    try:
        incidents_collection = await get_incidents_collection()

        # Build filter
        filter_dict = {}
        if severity:
            filter_dict["severity"] = severity
        if status:
            filter_dict["status"] = status

        # Get total count
        total_count = await incidents_collection.count_documents(filter_dict)

        # Get incidents
        incidents = (
            await incidents_collection.find(filter_dict)
            .sort("created_at", -1)
            .skip(skip)
            .limit(limit)
            .to_list(None)
        )

        # Format results
        data = []
        for inc in incidents:
            data.append(
                {
                    "id": str(inc.get("_id")),
                    "title": inc.get("title"),
                    "severity": inc.get("severity"),
                    "status": inc.get("status"),
                    "created_at": inc.get("created_at").isoformat() if inc.get("created_at") else None,
                    "total_events": inc.get("total_events"),
                    "source_ips": inc.get("source_ips", []),
                }
            )

        return {
            "status": "success",
            "total_count": total_count,
            "returned_count": len(data),
            "data": data,
        }

    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Incident list error: {str(e)}")


@router.get("/{incident_id}")
async def get_incident(incident_id: str, user: CurrentUser = Depends(get_current_user)) -> dict:
    """Get single incident with full details.

    Args:
        incident_id: MongoDB ObjectId of incident

    Returns:
        Dictionary with incident details
    """
    try:
        incidents_collection = await get_incidents_collection()

        try:
            obj_id = ObjectId(incident_id)
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid incident ID format")

        incident = await incidents_collection.find_one({"_id": obj_id})

        if not incident:
            raise HTTPException(status_code=404, detail="Incident not found")

        return {
            "status": "success",
            "data": {
                "id": str(incident.get("_id")),
                "title": incident.get("title"),
                "description": incident.get("description"),
                "severity": incident.get("severity"),
                "status": incident.get("status"),
                "created_at": incident.get("created_at").isoformat() if incident.get("created_at") else None,
                "updated_at": incident.get("updated_at").isoformat() if incident.get("updated_at") else None,
                "source_ips": incident.get("source_ips", []),
                "event_types": incident.get("event_types", []),
                "total_events": incident.get("total_events"),
                "attack_chain": incident.get("attack_chain", []),
                "ai_report": incident.get("ai_report"),
            },
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Incident retrieval error: {str(e)}")


@router.post("/detect")
async def detect_incidents(
    time_window_minutes: int = Query(60, ge=5, le=1440),
    user: CurrentUser = Depends(get_current_user),
) -> dict:
    """Auto-detect incidents by grouping related attacks.

    Groups attacks by:
    1. Same source IP within time window
    2. Multiple event types (indicates multi-stage attack)
    3. High threat scores (indicates coordinated attack)

    Args:
        time_window_minutes: Time window for grouping related events

    Returns:
        Dictionary with detected incidents
    """
    try:
        logs_collection = await get_logs_collection()
        incidents_collection = await get_incidents_collection()

        # Get high-severity events from last 24 hours
        cutoff_time = datetime.utcnow() - timedelta(hours=24)
        high_severity_events = await logs_collection.find(
            {
                "timestamp": {"$gte": cutoff_time},
                "severity": {"$in": ["HIGH", "CRITICAL"]},
            }
        ).to_list(None)

        if not high_severity_events:
            return {
                "status": "success",
                "detected_incidents": 0,
                "message": "No high-severity events found",
            }

        # Group by source IP
        ip_groups = {}
        for event in high_severity_events:
            ip = event.get("source_ip")
            if ip not in ip_groups:
                ip_groups[ip] = []
            ip_groups[ip].append(event)

        detected_incidents = []

        # Process each IP group
        for ip, events in ip_groups.items():
            if len(events) < 2:
                continue  # Skip isolated events

            events = sorted(events, key=lambda e: e.get("timestamp", datetime.now()))
            event_types = list(set(e.get("event_type") for e in events))
            max_threat_score = max(e.get("threat_score", 0) for e in events)

            # Determine severity
            if max_threat_score >= 70:
                severity = "CRITICAL"
            elif max_threat_score >= 45:
                severity = "HIGH"
            else:
                severity = "MEDIUM"

            # Build attack chain
            attack_chain = []
            current_time = events[0].get("timestamp")
            for event in events:
                event_time = event.get("timestamp")
                if event_time - current_time > timedelta(minutes=time_window_minutes):
                    attack_chain.append("---")
                    current_time = event_time
                attack_chain.append(
                    f"{event.get('event_type')} ({event.get('severity')})"
                )

            # Create incident
            incident_data = {
                "title": f"Attack from {ip}",
                "description": f"Coordinated attack with {len(events)} events including: {', '.join(set(event_types))}",
                "severity": severity,
                "status": "open",
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow(),
                "source_ips": [ip],
                "event_types": event_types,
                "total_events": len(events),
                "start_time": events[0].get("timestamp"),
                "end_time": events[-1].get("timestamp"),
                "attack_chain": attack_chain,
            }

            result = await incidents_collection.insert_one(incident_data)
            detected_incidents.append(str(result.inserted_id))

        return {
            "status": "success",
            "detected_incidents": len(detected_incidents),
            "incident_ids": detected_incidents,
        }

    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Incident detection error: {str(e)}")


@router.patch("/{incident_id}/status")
async def update_incident_status(
    incident_id: str,
    new_status: str = Body(..., embed=True),
    user: CurrentUser = Depends(get_current_user),
) -> dict:
    """Update incident status.

    Args:
        incident_id: MongoDB ObjectId of incident
        new_status: New status (open, investigating, closed)

    Returns:
        Dictionary with update result
    """
    try:
        if new_status not in ["open", "investigating", "closed"]:
            raise HTTPException(
                status_code=400,
                detail="Invalid status. Must be: open, investigating, closed",
            )

        incidents_collection = await get_incidents_collection()

        try:
            obj_id = ObjectId(incident_id)
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid incident ID format")

        result = await incidents_collection.update_one(
            {"_id": obj_id},
            {
                "$set": {
                    "status": new_status,
                    "updated_at": datetime.utcnow(),
                }
            },
        )

        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Incident not found")

        return {
            "status": "success",
            "message": f"Incident {incident_id} updated to status: {new_status}",
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Status update error: {str(e)}")
