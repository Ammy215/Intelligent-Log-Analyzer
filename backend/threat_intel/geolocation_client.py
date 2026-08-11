"""IPInfo geolocation enrichment for IP addresses.

Provides geographic context for malicious IPs including country, city,
coordinates, and organization information.

Learning: External API integration, JSON parsing, optional database fallback.
"""
import logging
from typing import Dict, Optional

import httpx

from config import settings
from threat_intel.redis_cache import cache_get, cache_set
from utils.http_client import client as _http_client

logger = logging.getLogger(__name__)

CACHE_TTL_SECONDS = 86400  # 24 hours


class GeoIPClient:
    """Async IPInfo client for IP geolocation enrichment."""

    def __init__(self, api_key: Optional[str] = None):
        """Initialize IPInfo client.

        Args:
            api_key: IPInfo token from environment or parameter. IPInfo's
                free tier works with or without a token (lower rate limit
                without one), so this degrades gracefully either way.
        """
        self.api_key = api_key or settings.ipinfo_token
        self.base_url = "https://ipinfo.io"

    async def get_geolocation(self, ip: str) -> Dict:
        """Get geolocation data for an IP address, via cache if available.

        Args:
            ip: IP address to geolocate

        Returns:
            {
                "ip": str,
                "country": str,        # 2-letter code, e.g. "US" (IPInfo doesn't provide a full name)
                "country_code": str,
                "region": str,
                "city": str,
                "latitude": float,
                "longitude": float,
                "timezone": str,
                "isp": str,            # IPInfo's "org" field (ASN + org name combined)
                "organization": str,
                "status": "success|failed"
            }
        """
        cache_key = f"ipinfo:{ip}"
        cached = await cache_get(cache_key)
        if cached is not None:
            logger.info(f"IPInfo cache hit for {ip}")
            return cached

        logger.info(f"IPInfo cache miss for {ip}, calling live API")
        result = await self._fetch_live(ip)
        if result.get("status") == "success":
            await cache_set(cache_key, result, CACHE_TTL_SECONDS)
        return result

    async def _fetch_live(self, ip: str) -> Dict:
        try:
            params = {}
            if self.api_key and self.api_key != "your_key_here":
                params["token"] = self.api_key

            resp = await _http_client.get(f"{self.base_url}/{ip}/json", params=params, timeout=5)

            if resp.status_code != 200:
                logger.warning(f"IPInfo returned {resp.status_code} for {ip}")
                return {"ip": ip, "status": "failed", "error": f"HTTP {resp.status_code}"}

            data = resp.json()
            if data.get("bogon"):
                # Private/reserved IP (RFC1918 etc.) — no geolocation exists for these
                return {"ip": ip, "status": "failed", "error": "Bogon/private IP, not geolocatable"}

            lat, lon = None, None
            if data.get("loc"):
                try:
                    lat_str, lon_str = data["loc"].split(",")
                    lat, lon = float(lat_str), float(lon_str)
                except (ValueError, AttributeError):
                    pass

            return {
                "ip": ip,
                "country": data.get("country"),
                "country_code": data.get("country"),
                "region": data.get("region"),
                "city": data.get("city"),
                "latitude": lat,
                "longitude": lon,
                "timezone": data.get("timezone"),
                "isp": data.get("org"),
                "organization": data.get("org"),
                "status": "success",
            }

        except httpx.RequestError as e:
            logger.error(f"IPInfo request error for {ip}: {e}")
            return {"ip": ip, "status": "failed", "error": str(e)}
        except Exception as e:
            logger.error(f"IPInfo error for {ip}: {e}")
            return {"ip": ip, "status": "failed", "error": str(e)}


# Global client instance
_geoip_client: Optional[GeoIPClient] = None


def get_geoip_client(api_key: Optional[str] = None) -> GeoIPClient:
    """Get or create global IPInfo client instance."""
    global _geoip_client
    if _geoip_client is None:
        _geoip_client = GeoIPClient(api_key)
    return _geoip_client
