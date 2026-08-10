"""Analysis endpoints for threat summary, trends, and statistics.

This router provides:
- GET /analysis/summary - Overall threat metrics
- GET /analysis/top-attackers - Top N IPs by attack count
- GET /analysis/timeline - Time-series event counts
- GET /analysis/event-types - Event type distribution
- GET /analysis/heatmap - Attack frequency matrix
- POST /analysis/ip/{ip} - Full IP profile analysis
"""
from datetime import datetime, timedelta
from typing import Optional

import pandas as pd
from fastapi import APIRouter, Depends, Query, HTTPException

from database import get_logs_collection, get_threat_actors_collection
from analyzers.threat_scorer import calculate_threat_score, get_threat_verdict
from middleware.auth import CurrentUser, get_current_user
from threat_intel.ip_profiler import get_ip_profiler

router = APIRouter(prefix="/api/v1/analysis", tags=["analysis"])


@router.get("/summary")
async def get_analysis_summary(user: CurrentUser = Depends(get_current_user)) -> dict:
    """Get overall summary statistics of all logs in database.

    Returns:
        Dictionary with total events, severity breakdown, and key metrics
    """
    try:
        logs_collection = await get_logs_collection()

        # Count total events
        total_count = await logs_collection.count_documents({})

        if total_count == 0:
            return {
                "status": "success",
                "total_events": 0,
                "severity_breakdown": {},
                "event_type_breakdown": {},
                "top_sources": [],
                "critical_alerts": 0,
            }

        # Aggregate by severity
        severity_agg = await logs_collection.aggregate(
            [
                {"$group": {"_id": "$severity", "count": {"$sum": 1}}},
            ]
        ).to_list(None)

        severity_breakdown = {item["_id"]: item["count"] for item in severity_agg}

        # Aggregate by event type
        event_agg = await logs_collection.aggregate(
            [
                {"$group": {"_id": "$event_type", "count": {"$sum": 1}}},
                {"$sort": {"count": -1}},
                {"$limit": 10},
            ]
        ).to_list(None)

        event_breakdown = {item["_id"]: item["count"] for item in event_agg}

        # Top source IPs
        top_ips_agg = await logs_collection.aggregate(
            [
                {"$group": {"_id": "$source_ip", "count": {"$sum": 1}}},
                {"$sort": {"count": -1}},
                {"$limit": 5},
            ]
        ).to_list(None)

        top_sources = [{"ip": item["_id"], "count": item["count"]} for item in top_ips_agg]

        # Count critical events
        critical_count = await logs_collection.count_documents({"severity": "CRITICAL"})

        return {
            "status": "success",
            "total_events": total_count,
            "severity_breakdown": severity_breakdown,
            "event_type_breakdown": event_breakdown,
            "top_sources": top_sources,
            "critical_alerts": critical_count,
        }

    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Analysis error: {str(e)}")


@router.get("/top-attackers")
async def get_top_attackers(
    limit: int = Query(10, ge=1, le=100),
    user: CurrentUser = Depends(get_current_user),
) -> dict:
    """Get top attacking IP addresses by event count.

    Args:
        limit: Number of top IPs to return

    Returns:
        Dictionary with list of top attacking IPs
    """
    try:
        logs_collection = await get_logs_collection()

        # Aggregate logs by source IP
        top_ips = await logs_collection.aggregate(
            [
                {
                    "$group": {
                        "_id": "$source_ip",
                        "event_count": {"$sum": 1},
                        "max_threat_score": {"$max": "$threat_score"},
                        "severity_list": {"$push": "$severity"},
                        "event_types": {"$addToSet": "$event_type"},
                    }
                },
                {"$sort": {"event_count": -1}},
                {"$limit": limit},
            ]
        ).to_list(None)

        result = []
        for ip_data in top_ips:
            # Count critical/high severity events
            severity_list = ip_data.get("severity_list", [])
            critical_count = severity_list.count("CRITICAL")
            high_count = severity_list.count("HIGH")

            result.append(
                {
                    "ip": ip_data["_id"],
                    "total_events": ip_data["event_count"],
                    "max_threat_score": ip_data["max_threat_score"],
                    "critical_events": critical_count,
                    "high_events": high_count,
                    "event_types": list(ip_data["event_types"]),
                }
            )

        return {
            "status": "success",
            "limit": limit,
            "count": len(result),
            "data": result,
        }

    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Analysis error: {str(e)}")


@router.get("/timeline")
async def get_attack_timeline(
    interval: str = Query("hour", pattern="^(hour|day)$"),
    days: int = Query(7, ge=1, le=90),
    user: CurrentUser = Depends(get_current_user),
) -> dict:
    """Get time-series event counts over time.

    Args:
        interval: Time interval (hour or day)
        days: Number of days to retrieve

    Returns:
        Dictionary with timeline data
    """
    try:
        logs_collection = await get_logs_collection()

        # Calculate start date
        start_date = datetime.utcnow() - timedelta(days=days)

        # Group by time interval
        if interval == "hour":
            group_expr = {
                "year": {"$year": "$timestamp"},
                "month": {"$month": "$timestamp"},
                "day": {"$dayOfMonth": "$timestamp"},
                "hour": {"$hour": "$timestamp"},
            }
            date_format = "%Y-%m-%d %H:00"
        else:  # day
            group_expr = {
                "year": {"$year": "$timestamp"},
                "month": {"$month": "$timestamp"},
                "day": {"$dayOfMonth": "$timestamp"},
            }
            date_format = "%Y-%m-%d"

        timeline = await logs_collection.aggregate(
            [
                {"$match": {"timestamp": {"$gte": start_date}}},
                {
                    "$group": {
                        "_id": group_expr,
                        "count": {"$sum": 1},
                        "critical": {"$sum": {"$cond": [{"$eq": ["$severity", "CRITICAL"]}, 1, 0]}},
                        "high": {"$sum": {"$cond": [{"$eq": ["$severity", "HIGH"]}, 1, 0]}},
                    }
                },
                {"$sort": {"_id": 1}},
            ]
        ).to_list(None)

        # Format results
        result = []
        for item in timeline:
            id_parts = item["_id"]
            if interval == "hour":
                date_str = datetime(
                    id_parts["year"],
                    id_parts["month"],
                    id_parts["day"],
                    id_parts["hour"],
                ).strftime(date_format)
            else:
                date_str = datetime(
                    id_parts["year"],
                    id_parts["month"],
                    id_parts["day"],
                ).strftime(date_format)

            result.append(
                {
                    "timestamp": date_str,
                    "total_events": item["count"],
                    "critical": item["critical"],
                    "high": item["high"],
                }
            )

        return {
            "status": "success",
            "interval": interval,
            "days": days,
            "data": result,
        }

    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Analysis error: {str(e)}")


@router.get("/event-types")
async def get_event_type_distribution(user: CurrentUser = Depends(get_current_user)) -> dict:
    """Get distribution of event types.

    Returns:
        Dictionary with event type counts and percentages
    """
    try:
        logs_collection = await get_logs_collection()

        total = await logs_collection.count_documents({})
        if total == 0:
            return {
                "status": "success",
                "total_events": 0,
                "data": [],
            }

        distribution = await logs_collection.aggregate(
            [
                {
                    "$group": {
                        "_id": "$event_type",
                        "count": {"$sum": 1},
                    }
                },
                {"$sort": {"count": -1}},
            ]
        ).to_list(None)

        data = [
            {
                "event_type": item["_id"],
                "count": item["count"],
                "percentage": round(item["count"] / total * 100, 2),
            }
            for item in distribution
        ]

        return {
            "status": "success",
            "total_events": total,
            "data": data,
        }

    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Analysis error: {str(e)}")


@router.get("/heatmap")
async def get_attack_heatmap(user: CurrentUser = Depends(get_current_user)) -> dict:
    """Get attack frequency heatmap: hour of day × day of week.

    Returns:
        Dictionary with heatmap data (7x24 matrix)
    """
    try:
        logs_collection = await get_logs_collection()

        # Group by hour and day of week
        heatmap_data = await logs_collection.aggregate(
            [
                {
                    "$group": {
                        "_id": {
                            "hour": {"$hour": "$timestamp"},
                            "dow": {"$dayOfWeek": "$timestamp"},
                        },
                        "count": {"$sum": 1},
                    }
                },
                {"$sort": {"_id.dow": 1, "_id.hour": 1}},
            ]
        ).to_list(None)

        # Create 7x24 matrix (day x hour)
        matrix = [[0 for _ in range(24)] for _ in range(7)]

        for item in heatmap_data:
            dow = item["_id"]["dow"] - 1  # MongoDB: 1=Sunday, convert to 0=Sunday
            hour = item["_id"]["hour"]
            matrix[dow][hour] = item["count"]

        day_names = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

        return {
            "status": "success",
            "matrix": matrix,
            "day_names": day_names,
            "hours": list(range(24)),
        }

    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Analysis error: {str(e)}")


@router.post("/ip/{ip}")
async def analyze_ip_profile(ip: str, user: CurrentUser = Depends(get_current_user)) -> dict:
    """Get complete threat profile for a single IP address.
    
    Combines local log analysis with external threat intelligence from:
    - AbuseIPDB (IP reputation)
    - OTX (Open Threat Exchange)
    - GeoIP (geolocation)

    Args:
        ip: IP address to analyze

    Returns:
        Dictionary with full IP profile, local analysis, and threat intel enrichment
    """
    try:
        logs_collection = await get_logs_collection()

        # Get all events from this IP
        events = await logs_collection.find({"source_ip": ip}).to_list(None)

        if not events:
            return {
                "status": "success",
                "ip": ip,
                "found": False,
                "message": "No events found for this IP",
            }

        # Calculate local statistics
        df = pd.DataFrame([{k: v for k, v in e.items() if k != "_id"} for e in events])

        threat_scores = df["threat_score"].tolist()
        max_score = max(threat_scores) if threat_scores else 0
        avg_score = sum(threat_scores) / len(threat_scores) if threat_scores else 0

        # Event type breakdown
        event_types = df["event_type"].value_counts().to_dict()

        # Severity breakdown
        severities = df["severity"].value_counts().to_dict()

        # Timeline
        first_seen = df["timestamp"].min()
        last_seen = df["timestamp"].max()

        # Verdict
        verdict = get_threat_verdict(int(max_score), 0)

        # Most common usernames attacked
        usernames = []
        if "username" in df.columns:
            usernames = (
                df[df["username"].notna()]["username"]
                .value_counts()
                .head(5)
                .to_dict()
            )

        # Phase 4: Enrich with threat intelligence
        profiler = get_ip_profiler()
        threat_factors = df["tags"].explode().unique().tolist() if "tags" in df.columns else []
        threat_factors = [t for t in threat_factors if t]  # Remove None values
        
        threat_profile = await profiler.profile_ip(
            ip,
            local_threat_factors=threat_factors,
            event_count=len(events)
        )

        return {
            "status": "success",
            "ip": ip,
            "found": True,
            "total_events": len(events),
            "first_seen": first_seen.isoformat() if first_seen else None,
            "last_seen": last_seen.isoformat() if last_seen else None,
            "threat_scores": {
                "max": int(max_score),
                "avg": round(avg_score, 1),
                "min": min(threat_scores) if threat_scores else 0,
            },
            "verdict": verdict,
            "event_types": event_types,
            "severity_breakdown": severities,
            "target_usernames": usernames,
            # Phase 4: Threat Intelligence Enrichment
            "threat_intelligence": {
                "local_analysis": threat_profile.get("local_analysis"),
                "abuseipdb": threat_profile.get("abuseipdb"),
                "otx": threat_profile.get("otx"),
                "geolocation": threat_profile.get("geolocation"),
                "composite_score": threat_profile.get("composite_score"),
                "risk_level": threat_profile.get("risk_level"),
                "risk_factors": threat_profile.get("risk_factors"),
                "confidence": threat_profile.get("confidence")
            }
        }

    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Analysis error: {str(e)}")
