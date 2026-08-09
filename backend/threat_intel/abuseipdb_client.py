"""AbuseIPDB API client for IP reputation checking.

Queries AbuseIPDB to get IP reputation scores, abuse types, and report counts.
Provides confidence scores indicating likelihood of malicious activity.

Learning: Real external API integration, authentication headers, rate limiting.
"""
import aiohttp
import asyncio
import logging
from typing import Dict, Optional

from threat_intel.cache import cached_threat_intel
from config import settings


logger = logging.getLogger(__name__)


class AbuseIPDBClient:
    """Async client for AbuseIPDB IP reputation API.
    
    API Documentation: https://www.abuseipdb.com/api
    Rate Limit: 15 requests/day for free tier, higher for paid
    """

    def __init__(self, api_key: Optional[str] = None):
        """Initialize AbuseIPDB client.
        
        Args:
            api_key: AbuseIPDB API key from environment or parameter
        
        Learning: Configuration management with environment variables
        """
        self.api_key = api_key or settings.abuseipdb_api_key
        self.base_url = "https://api.abuseipdb.com/api/v2"
        self.headers = {
            "Key": self.api_key,
            "Accept": "application/json",
        }
        self.rate_limit_delay = 1.0  # Conservative delay for free tier

    @cached_threat_intel(ttl_seconds=604800)  # 7 days - abuse history changes slowly
    async def check_ip(self, ip: str, max_age_days: int = 90) -> Dict:
        """Check IP reputation on AbuseIPDB.
        
        Args:
            ip: IP address to check
            max_age_days: Only return reports from last N days (1-365)
            
        Returns:
            {
                "ip": str,
                "confidence_score": 0-100,  # Confidence of abuse (higher = more likely)
                "abuse_count": int,         # Number of abuse reports
                "last_reported_at": str|null,
                "abuse_types": [str],       # Types: "hacking", "malware", etc.
                "isp": str,
                "is_whitelisted": bool,
                "status": "success|failed|no_key"
            }
        
        Learning: Optional API integration (gracefully handles missing credentials),
                 error handling for API limits, data transformation.
        """
        if not self.api_key or self.api_key == "your_key_here":
            logger.info(f"AbuseIPDB API key not configured, skipping {ip} check")
            return {
                "ip": ip,
                "status": "no_key",
                "confidence_score": 0,
                "message": "AbuseIPDB API key not configured"
            }

        try:
            params = {
                "ipAddress": ip,
                "maxAgeInDays": max_age_days,
                "verbose": ""  # Get additional details
            }

            async with aiohttp.ClientSession() as session:
                async with session.get(
                    f"{self.base_url}/check",
                    headers=self.headers,
                    params=params,
                    timeout=aiohttp.ClientTimeout(total=10)
                ) as response:
                    if response.status == 200:
                        data = await response.json()
                        
                        if "data" in data:
                            abuse_data = data["data"]
                            return {
                                "ip": ip,
                                "confidence_score": abuse_data.get("abuseConfidenceScore", 0),
                                "abuse_count": abuse_data.get("totalReports", 0),
                                "last_reported_at": abuse_data.get("lastReportedAt"),
                                "abuse_types": abuse_data.get("usageType", ""),
                                "isp": abuse_data.get("isp"),
                                "is_whitelisted": abuse_data.get("isWhitelisted", False),
                                "status": "success"
                            }
                        else:
                            return {
                                "ip": ip,
                                "status": "failed",
                                "error": data.get("errors", [{}])[0].get("detail", "Unknown error")
                            }
                    
                    elif response.status == 429:
                        logger.warning(f"AbuseIPDB rate limit hit for {ip}")
                        return {
                            "ip": ip,
                            "status": "failed",
                            "error": "Rate limit exceeded"
                        }
                    
                    elif response.status == 401:
                        logger.error("AbuseIPDB API authentication failed - invalid key")
                        return {
                            "ip": ip,
                            "status": "failed",
                            "error": "Authentication failed - check API key"
                        }
                    
                    else:
                        logger.warning(f"AbuseIPDB returned {response.status} for {ip}")
                        return {
                            "ip": ip,
                            "status": "failed",
                            "error": f"HTTP {response.status}"
                        }

        except asyncio.TimeoutError:
            logger.error(f"AbuseIPDB timeout for {ip}")
            return {"ip": ip, "status": "failed", "error": "Request timeout"}
        except Exception as e:
            logger.error(f"AbuseIPDB error for {ip}: {str(e)}")
            return {"ip": ip, "status": "failed", "error": str(e)}


# Global client instance
_abuseipdb_client: Optional[AbuseIPDBClient] = None


def get_abuseipdb_client(api_key: Optional[str] = None) -> AbuseIPDBClient:
    """Get or create global AbuseIPDB client instance."""
    global _abuseipdb_client
    if _abuseipdb_client is None:
        _abuseipdb_client = AbuseIPDBClient(api_key)
    return _abuseipdb_client
