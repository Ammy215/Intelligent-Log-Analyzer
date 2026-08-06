"""Caching utilities for threat intelligence API responses.

Implements time-based caching (TTL) to store API responses and reduce
redundant requests. All threat intel clients use this cache.

Learning: Decorator pattern for caching, time-based expiration.
"""
import asyncio
import time
from functools import wraps
from typing import Any, Callable, Dict


class CacheEntry:
    """Single cache entry with TTL (time-to-live)."""

    def __init__(self, value: Any, ttl_seconds: int = 86400):  # 24 hour default
        self.value = value
        self.created_at = time.time()
        self.ttl_seconds = ttl_seconds

    def is_expired(self) -> bool:
        """Check if this cache entry has expired."""
        return (time.time() - self.created_at) > self.ttl_seconds


class ThreatIntelCache:
    """Thread-safe cache for threat intelligence responses."""

    def __init__(self, default_ttl: int = 86400):
        """Initialize cache with default TTL.
        
        Args:
            default_ttl: Default time-to-live in seconds (86400 = 24 hours)
        """
        self._cache: Dict[str, CacheEntry] = {}
        self.default_ttl = default_ttl

    def get(self, key: str) -> Any | None:
        """Get cached value if not expired.
        
        Args:
            key: Cache key (e.g., "abuseipdb:192.168.1.1")
            
        Returns:
            Cached value or None if not found/expired
        """
        if key not in self._cache:
            return None

        entry = self._cache[key]
        if entry.is_expired():
            del self._cache[key]  # Clean up expired entry
            return None

        return entry.value

    def set(self, key: str, value: Any, ttl_seconds: int | None = None) -> None:
        """Store value in cache with optional custom TTL.
        
        Args:
            key: Cache key
            value: Value to cache
            ttl_seconds: Optional custom TTL (uses default if None)
        """
        ttl = ttl_seconds or self.default_ttl
        self._cache[key] = CacheEntry(value, ttl)

    def clear(self) -> None:
        """Clear entire cache."""
        self._cache.clear()

    def cleanup_expired(self) -> int:
        """Remove all expired entries. Returns count of removed entries."""
        expired_keys = [k for k, v in self._cache.items() if v.is_expired()]
        for key in expired_keys:
            del self._cache[key]
        return len(expired_keys)


# Global cache instance shared across all threat intel clients
_threat_intel_cache = ThreatIntelCache()


def cached_threat_intel(ttl_seconds: int = 86400) -> Callable:
    """Decorator for caching async threat intel API responses.
    
    Args:
        ttl_seconds: Time-to-live for cached response (default 24 hours)
        
    Example:
        @cached_threat_intel(ttl_seconds=86400)
        async def get_abuseipdb_data(ip: str) -> dict:
            # Make API call
            return response_data
    
    Learning: Decorator pattern + async function wrapping + cache key generation
    """

    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def wrapper(*args, **kwargs) -> Any:
            # Generate cache key from function name and first positional arg (usually IP)
            cache_key = f"{func.__name__}:{args[0] if args else 'none'}"

            # Check cache first
            cached_value = _threat_intel_cache.get(cache_key)
            if cached_value is not None:
                return cached_value

            # If not cached, call the actual function
            result = await func(*args, **kwargs)

            # Store result in cache
            _threat_intel_cache.set(cache_key, result, ttl_seconds)

            return result

        return wrapper

    return decorator


def get_cache() -> ThreatIntelCache:
    """Get the global threat intel cache instance."""
    return _threat_intel_cache
