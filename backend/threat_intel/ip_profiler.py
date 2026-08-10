"""IP Profiler - Aggregates multiple threat intelligence sources.

Combines local threat scoring, pattern detection, anomaly detection,
and external threat intelligence APIs into a comprehensive IP threat profile.

Learning: asyncio.gather() for concurrent requests, data aggregation patterns,
         composite scoring logic, risk factor analysis.
"""
import asyncio
import logging
from typing import Dict, List, Optional

from threat_intel.abuseipdb_client import get_abuseipdb_client
from threat_intel.otx_client import get_otx_client
from threat_intel.geolocation_client import get_geoip_client
from analyzers.threat_scorer import calculate_threat_score, get_threat_verdict
from models.log_entry import ThreatIntelModel


logger = logging.getLogger(__name__)


class IPProfiler:
    """Profiles IP addresses with comprehensive threat intelligence."""

    def __init__(self):
        """Initialize IP profiler with all threat intelligence clients."""
        self.abuseipdb = get_abuseipdb_client()
        self.otx = get_otx_client()
        self.geoip = get_geoip_client()

    async def profile_ip(
        self,
        ip: str,
        local_threat_factors: Optional[List[str]] = None,
        event_count: Optional[int] = None,
        weights: Optional[Dict[str, int]] = None,
    ) -> Dict:
        """Create comprehensive threat profile for an IP.
        
        Args:
            ip: IP address to profile
            local_threat_factors: Local threat factors (e.g., ["failed_login_over_20"])
            event_count: Number of events from this IP in logs (for severity boost)
            
        Returns:
            {
                "ip": str,
                "local_analysis": {
                    "threat_score": 0-100,
                    "severity": "LOW|MEDIUM|HIGH|CRITICAL",
                    "threat_factors": [str],
                    "event_count": int
                },
                "abuseipdb": {
                    "confidence_score": 0-100,
                    "abuse_count": int,
                    "status": "success|failed|no_key"
                },
                "otx": {
                    "reputation": 0-100,
                    "threat_level": "low|medium|high|critical",
                    "malware_samples": int,
                    "status": "success|failed"
                },
                "geolocation": {
                    "country": str,
                    "city": str,
                    "latitude": float,
                    "longitude": float,
                    "isp": str,
                    "status": "success|failed"
                },
                "composite_score": 0-100,  # Weighted combination of all sources
                "risk_level": "SAFE|SUSPICIOUS|HIGH_RISK|CRITICAL",
                "risk_factors": [str],     # Top reasons for concern
                "confidence": 0-100        # Confidence in the assessment (higher = more data)
            }
        
        Learning: Concurrent API calls, composite scoring, confidence calculation,
                 data enrichment, risk factor analysis.
        """
        # Default threat factors if not provided
        if local_threat_factors is None:
            local_threat_factors = []

        try:
            # Make all API calls concurrently
            logger.info(f"Profiling IP {ip} from multiple sources...")
            
            results = await asyncio.gather(
                self._get_local_analysis(ip, local_threat_factors, event_count, weights),
                self.abuseipdb.check_ip(ip),
                self.otx.get_ip_reputation(ip),
                self.geoip.get_geolocation(ip),
                return_exceptions=True
            )

            local_analysis = results[0]
            abuse_ipdb_data = results[1] if not isinstance(results[1], Exception) else None
            otx_data = results[2] if not isinstance(results[2], Exception) else None
            geo_data = results[3] if not isinstance(results[3], Exception) else None

            # Calculate composite score and risk factors
            composite_score, risk_factors, confidence = self._calculate_composite_score(
                local_analysis,
                abuse_ipdb_data,
                otx_data,
                geo_data
            )

            # Determine risk level
            if composite_score >= 80:
                risk_level = "CRITICAL"
            elif composite_score >= 60:
                risk_level = "HIGH_RISK"
            elif composite_score >= 30:
                risk_level = "SUSPICIOUS"
            else:
                risk_level = "SAFE"

            return {
                "ip": ip,
                "local_analysis": local_analysis,
                "abuseipdb": abuse_ipdb_data or {"status": "failed", "error": "No data"},
                "otx": otx_data or {"status": "failed", "error": "No data"},
                "geolocation": geo_data or {"status": "failed", "error": "No data"},
                "composite_score": composite_score,
                "risk_level": risk_level,
                "risk_factors": risk_factors,
                "confidence": confidence
            }

        except Exception as e:
            logger.error(f"Error profiling IP {ip}: {str(e)}")
            return {
                "ip": ip,
                "error": str(e),
                "status": "failed"
            }

    async def _get_local_analysis(
        self,
        ip: str,
        threat_factors: List[str],
        event_count: Optional[int],
        weights: Optional[Dict[str, int]] = None,
    ) -> Dict:
        """Get local threat analysis for IP.

        Learning: Async wrapper for synchronous functions
        """
        try:
            # Call sync threat scoring function (it's I/O free)
            threat_score_result = calculate_threat_score(threat_factors, weights)
            
            # Boost score if we have many events from this IP
            if event_count and event_count > 10:
                score_boost = min(20, event_count // 5)  # 1 point per 5 events, max 20
                threat_score_result["score"] = min(
                    100,
                    threat_score_result["score"] + score_boost
                )

            return {
                "threat_score": threat_score_result["score"],
                "severity": threat_score_result["severity"],
                "threat_factors": threat_factors,
                "event_count": event_count or 0
            }
        except Exception as e:
            logger.error(f"Local analysis error for {ip}: {str(e)}")
            return {
                "status": "failed",
                "error": str(e)
            }

    def _calculate_composite_score(
        self,
        local: Dict,
        abuseipdb: Optional[Dict],
        otx: Optional[Dict],
        geo: Optional[Dict]
    ) -> tuple[int, List[str], int]:
        """Calculate weighted composite threat score.
        
        Weights:
        - Local analysis: 40% (our logs are most reliable)
        - AbuseIPDB: 35% (established reputation source)
        - OTX: 20% (threat intelligence data)
        - GeoLocation: 5% (context only)
        
        Returns:
            (composite_score, risk_factors, confidence)
        
        Learning: Weighted composite scoring, data quality indicators, confidence calculation
        """
        scores = []
        weights = []
        risk_factors = []

        # Local analysis (40% weight)
        if local and "threat_score" in local:
            local_score = local.get("threat_score", 0)
            scores.append(local_score)
            weights.append(0.40)
            if local_score >= 50:
                risk_factors.append(f"Local threat analysis: {local_score} score")

        # AbuseIPDB confidence score (35% weight)
        if abuseipdb and abuseipdb.get("status") == "success":
            abuse_score = abuseipdb.get("confidence_score", 0)
            scores.append(abuse_score)
            weights.append(0.35)
            if abuse_score >= 30:
                risk_factors.append(f"AbuseIPDB reputation: {abuse_score}% confidence")

        # OTX reputation (20% weight)
        if otx and otx.get("status") == "success":
            otx_score = otx.get("reputation", 0)
            scores.append(otx_score)
            weights.append(0.20)
            if otx_score >= 30:
                threat_level = otx.get("threat_level")
                risk_factors.append(f"OTX threat level: {threat_level}")

        # GeoLocation context (5% weight)
        if geo and geo.get("status") == "success":
            # Only add weight if location is suspicious (e.g., not common).
            # IPInfo returns 2-letter country codes (e.g. "US"), not full names.
            country = geo.get("country", "")
            if country and country not in ["US", "CA"]:  # Example filter
                scores.append(20)  # Low score for unknown location
                weights.append(0.05)
                risk_factors.append(f"Unusual location: {country}")

        # Calculate weighted average
        if not scores:
            # No data sources available
            return 0, ["No threat intelligence data available"], 0

        total_weight = sum(weights)
        if total_weight > 0:
            composite_score = int(sum(s * w for s, w in zip(scores, weights)) / total_weight)
        else:
            composite_score = 0

        # Confidence increases with number of data sources
        confidence = len([s for s in scores if s > 0]) * 25  # 25% per source, max 100%

        return composite_score, risk_factors[:3], confidence  # Top 3 risk factors


# Global profiler instance
_ip_profiler: Optional[IPProfiler] = None


def get_ip_profiler() -> IPProfiler:
    """Get or create global IP profiler instance."""
    global _ip_profiler
    if _ip_profiler is None:
        _ip_profiler = IPProfiler()
    return _ip_profiler
