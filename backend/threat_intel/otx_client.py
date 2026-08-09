"""OTX (Open Threat Exchange) API client for threat intelligence.

Queries AlienVault OTX for threat pulses, malware indicators, and
threat actor information related to IP addresses.

Learning: Complex REST API with nested resources, data enrichment patterns.
"""
import aiohttp
import asyncio
import logging
from typing import Dict, Optional, List

from threat_intel.cache import cached_threat_intel
from config import settings


logger = logging.getLogger(__name__)


class OTXClient:
    """Async client for AlienVault Open Threat Exchange API.
    
    API Documentation: https://otx.alienvault.com/api
    Rate Limit: 50 requests/hour (free tier - no API key required)
    """

    def __init__(self, api_key: Optional[str] = None):
        """Initialize OTX client.
        
        Args:
            api_key: OTX API key (optional - can query without key)
        
        Learning: Optional API authentication for enhanced features
        """
        self.api_key = api_key or settings.otx_api_key
        self.base_url = "https://otx.alienvault.com/api/v1"
        self.headers = {}
        if self.api_key and self.api_key != "your_key_here":
            self.headers["X-OTX-API-KEY"] = self.api_key

    @cached_threat_intel(ttl_seconds=604800)  # 7 days
    async def get_ip_reputation(self, ip: str) -> Dict:
        """Get IP reputation and threat data from OTX.
        
        Args:
            ip: IP address to check
            
        Returns:
            {
                "ip": str,
                "reputation": int,           # OTX reputation score
                "threat_level": "low|medium|high|critical",
                "threat_pulses": int,        # Number of threat pulses mentioning this IP
                "malware_samples": int,
                "recent_threats": [str],     # List of recent threat categories
                "status": "success|failed"
            }
        
        Learning: Multi-endpoint API calls, data aggregation from multiple sources
        """
        try:
            # Get general IP reputation
            ip_reputation = await self._get_ip_general(ip)
            
            if ip_reputation.get("status") != "success":
                return ip_reputation

            # Get malware samples (only if reputation indicates threat)
            malware_data = await self._get_ip_malware(ip)
            
            # Determine threat level based on reputation
            reputation = ip_reputation.get("reputation", 0)
            if reputation >= 100:
                threat_level = "critical"
            elif reputation >= 50:
                threat_level = "high"
            elif reputation >= 20:
                threat_level = "medium"
            else:
                threat_level = "low"

            return {
                "ip": ip,
                "reputation": reputation,
                "threat_level": threat_level,
                "threat_pulses": ip_reputation.get("threat_pulses", 0),
                "malware_samples": malware_data.get("count", 0),
                "recent_threats": malware_data.get("types", []),
                "status": "success"
            }

        except Exception as e:
            logger.error(f"OTX error for {ip}: {str(e)}")
            return {"ip": ip, "status": "failed", "error": str(e)}

    async def _get_ip_general(self, ip: str) -> Dict:
        """Get general IP information from OTX.
        
        Learning: Error handling in helper methods, nested API calls
        """
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    f"{self.base_url}/pulses/subscribed?limit=10&page=1",
                    headers=self.headers,
                    timeout=aiohttp.ClientTimeout(total=10)
                ) as response:
                    if response.status != 200:
                        return {"status": "failed", "error": f"HTTP {response.status}"}

                    # For free tier, we estimate reputation from pulse data
                    data = await response.json()
                    pulses = data.get("results", [])
                    
                    # Count pulses mentioning this IP
                    threat_pulses = 0
                    for pulse in pulses:
                        indicators = pulse.get("indicators", [])
                        if any(ind.get("indicator") == ip for ind in indicators):
                            threat_pulses += 1

                    return {
                        "status": "success",
                        "reputation": threat_pulses * 10,  # Simple scoring
                        "threat_pulses": threat_pulses
                    }

        except asyncio.TimeoutError:
            logger.error(f"OTX timeout for IP general info {ip}")
            return {"status": "failed", "error": "Timeout"}
        except Exception as e:
            logger.error(f"OTX general IP error: {str(e)}")
            return {"status": "failed", "error": str(e)}

    async def _get_ip_malware(self, ip: str) -> Dict:
        """Get malware samples associated with IP.
        
        Learning: Fallback error handling, empty result handling
        """
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    f"{self.base_url}/indicators/IPv4/{ip}/malware",
                    headers=self.headers,
                    timeout=aiohttp.ClientTimeout(total=10)
                ) as response:
                    if response.status == 404:
                        # No malware data found - this is okay
                        return {"count": 0, "types": []}
                    
                    if response.status != 200:
                        return {"count": 0, "types": [], "error": f"HTTP {response.status}"}

                    data = await response.json()
                    samples = data.get("data", {}).get("samples", [])
                    
                    # Extract malware types
                    malware_types = set()
                    for sample in samples:
                        if "filetype" in sample:
                            malware_types.add(sample["filetype"])

                    return {
                        "count": len(samples),
                        "types": list(malware_types)
                    }

        except asyncio.TimeoutError:
            return {"count": 0, "types": [], "error": "Timeout"}
        except Exception as e:
            logger.error(f"OTX malware error: {str(e)}")
            return {"count": 0, "types": [], "error": str(e)}


# Global client instance
_otx_client: Optional[OTXClient] = None


def get_otx_client(api_key: Optional[str] = None) -> OTXClient:
    """Get or create global OTX client instance."""
    global _otx_client
    if _otx_client is None:
        _otx_client = OTXClient(api_key)
    return _otx_client
