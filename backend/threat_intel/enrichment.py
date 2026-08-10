"""Background IP enrichment — runs AbuseIPDB/OTX/IPInfo concurrently and
persists a shared, global reputation snapshot to the threat_actors collection.

Triggered from routers/logs.py via FastAPI BackgroundTasks whenever an
ingested log scores HIGH/CRITICAL, so ingestion never waits on 3 external
API calls. threat_actors has no org_id on purpose — an IP's reputation
doesn't differ by org (see Phase 5 notes). Which orgs have actually seen
this IP stays answerable from the already org-scoped `logs` collection —
no separate tracking needed for that.
"""
import asyncio
import logging
from datetime import datetime

from database import DatabaseManager
from threat_intel.abuseipdb_client import get_abuseipdb_client
from threat_intel.otx_client import get_otx_client
from threat_intel.geolocation_client import get_geoip_client
from analyzers.threat_scorer import get_threat_verdict

logger = logging.getLogger(__name__)


async def enrich_and_persist_ip(ip: str) -> None:
    """Fetch AbuseIPDB/OTX/IPInfo for ip (cache-first) and upsert threat_actors.

    Swallows its own errors — this runs as a fire-and-forget background
    task, so a failure here must never surface anywhere the caller would
    notice; it just means the reputation snapshot doesn't get updated.
    """
    try:
        abuseipdb = get_abuseipdb_client()
        otx = get_otx_client()
        geoip = get_geoip_client()

        abuse_result, otx_result, geo_result = await asyncio.gather(
            abuseipdb.check_ip(ip),
            otx.get_ip_reputation(ip),
            geoip.get_geolocation(ip),
            return_exceptions=True,
        )
        if isinstance(abuse_result, Exception):
            logger.warning(f"AbuseIPDB enrichment failed for {ip}: {abuse_result}")
            abuse_result = {"status": "failed"}
        if isinstance(otx_result, Exception):
            logger.warning(f"OTX enrichment failed for {ip}: {otx_result}")
            otx_result = {"status": "failed"}
        if isinstance(geo_result, Exception):
            logger.warning(f"IPInfo enrichment failed for {ip}: {geo_result}")
            geo_result = {"status": "failed"}

        abuse_score = abuse_result.get("confidence_score", 0) if abuse_result.get("status") == "success" else 0
        otx_pulses = otx_result.get("threat_pulses", 0) if otx_result.get("status") == "success" else 0
        geo = geo_result if geo_result.get("status") == "success" else None
        verdict = get_threat_verdict(0, abuse_score)

        now = datetime.utcnow()
        db = DatabaseManager.get_db()
        await db["threat_actors"].update_one(
            {"ip": ip},
            {
                "$set": {
                    "last_seen": now,
                    "verdict": verdict,
                    "abuseipdb_score": abuse_score,
                    "otx_pulses": otx_pulses,
                    "geo": geo,
                    "max_threat_score": abuse_score,
                },
                "$setOnInsert": {"first_seen": now, "total_events": 0, "event_types": []},
            },
            upsert=True,
        )
        logger.info(f"Enrichment persisted for {ip}: verdict={verdict}, abuseipdb={abuse_score}, otx_pulses={otx_pulses}")

    except Exception as e:
        logger.error(f"Background enrichment failed for {ip}: {e}")
