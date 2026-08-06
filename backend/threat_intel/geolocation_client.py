"""GeoIP geolocation enrichment for IP addresses.

Provides geographic context for malicious IPs including country, city,
coordinates, and organization information.

Learning: External API integration, JSON parsing, optional database fallback.
"""
import aiohttp
import logging
from typing import Dict, Optional

from backend.threat_intel.cache import cached_threat_intel


logger = logging.getLogger(__name__)


class GeoIPClient:
    """Async GeoIP client for IP geolocation enrichment."""

    def __init__(self, api_key: Optional[str] = None):
        """Initialize GeoIP client.
        
        Args:
            api_key: Optional API key for premium services (not required for free tier)
        
        Learning: Optional external API keys for upgrade paths
        """
        self.api_key = api_key
        self.base_url = "https://ip-api.com/json"
        # Free tier allows 45 requests/minute
        self.rate_limit_delay = 0.02  # 50ms to stay under rate limit

    @cached_threat_intel(ttl_seconds=2592000)  # 30 days for geolocation (changes slowly)
    async def get_geolocation(self, ip: str) -> Dict:
        """Get geolocation data for an IP address.
        
        Args:
            ip: IP address to geolocate
            
        Returns:
            {
                "country": "United States",
                "country_code": "US",
                "region": "California", 
                "city": "Los Angeles",
                "latitude": 34.0522,
                "longitude": -118.2437,
                "timezone": "America/Los_Angeles",
                "isp": "Example ISP",
                "organization": "Example Org",
                "status": "success|fail"
            }
        
        Learning: Async HTTP requests with aiohttp, error handling, data normalization
        """
        try:
            async with aiohttp.ClientSession() as session:
                # Construct request with optional API key
                params = {
                    "query": ip,
                    "fields": "status,country,countryCode,region,city,lat,lon,timezone,isp,org",
                }
                
                async with session.get(
                    self.base_url,
                    params=params,
                    timeout=aiohttp.ClientTimeout(total=5)
                ) as response:
                    if response.status == 200:
                        data = await response.json()
                        
                        # Normalize response format
                        if data.get("status") == "success":
                            return {
                                "ip": ip,
                                "country": data.get("country"),
                                "country_code": data.get("countryCode"),
                                "region": data.get("region"),
                                "city": data.get("city"),
                                "latitude": data.get("lat"),
                                "longitude": data.get("lon"),
                                "timezone": data.get("timezone"),
                                "isp": data.get("isp"),
                                "organization": data.get("org"),
                                "status": "success"
                            }
                        else:
                            return {
                                "ip": ip,
                                "status": "failed",
                                "error": data.get("message", "Unknown error")
                            }
                    else:
                        logger.warning(f"GeoIP API returned status {response.status} for {ip}")
                        return {
                            "ip": ip,
                            "status": "failed",
                            "error": f"HTTP {response.status}"
                        }
                        
        except asyncio.TimeoutError:
            logger.error(f"GeoIP API timeout for {ip}")
            return {"ip": ip, "status": "failed", "error": "Request timeout"}
        except Exception as e:
            logger.error(f"GeoIP API error for {ip}: {str(e)}")
            return {"ip": ip, "status": "failed", "error": str(e)}


# Global client instance
_geoip_client: Optional[GeoIPClient] = None


def get_geoip_client(api_key: Optional[str] = None) -> GeoIPClient:
    """Get or create global GeoIP client instance."""
    global _geoip_client
    if _geoip_client is None:
        _geoip_client = GeoIPClient(api_key)
    return _geoip_client
