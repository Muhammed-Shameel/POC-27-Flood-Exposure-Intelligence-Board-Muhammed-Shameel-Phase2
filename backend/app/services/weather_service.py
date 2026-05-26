"""
Open-Meteo Weather Service with Resilient Caching
Integrates live weather data with automatic fallback to cached responses
"""
import asyncio
import json
from datetime import datetime
from pathlib import Path
from typing import Optional, Dict, Any, List
import httpx

# Cache file location
CACHE_DIR = Path(__file__).parent.parent.parent / "cache"
CACHE_DIR.mkdir(parents=True, exist_ok=True)
CACHE_FILE = CACHE_DIR / "live_weather_cache.json"


class WeatherCache:
    """Persistent cache with freshness tracking"""
    
    @staticmethod
    def save(data: Dict[str, Any], cache_type: str = "current") -> None:
        """Save weather data to cache with timestamp"""
        cache_data = {
            "timestamp": datetime.utcnow().isoformat(),
            "type": cache_type,
            "data": data
        }
        try:
            with open(CACHE_FILE, 'w') as f:
                json.dump(cache_data, f, indent=2)
        except Exception:
            pass  # Silently fail on cache write
    
    @staticmethod
    def load() -> Optional[Dict[str, Any]]:
        """Load cached weather data"""
        if not CACHE_FILE.exists():
            return None
        try:
            with open(CACHE_FILE, 'r') as f:
                return json.load(f)
        except Exception:
            return None
    
    @staticmethod
    def is_fresh(max_age_minutes: int = 10) -> bool:
        """Check if cache is still fresh"""
        cache = WeatherCache.load()
        if not cache:
            return False
        try:
            timestamp = datetime.fromisoformat(cache['timestamp'])
            age = (datetime.utcnow() - timestamp).total_seconds() / 60
            return age < max_age_minutes
        except Exception:
            return False


class WeatherService:
    """Open-Meteo API integration with caching and fallback"""
    
    BASE_URL = "https://api.open-meteo.com/v1"
    TIMEOUT = 5.0  # Fail fast
    
    @staticmethod
    async def get_current_weather(lat: float, lon: float) -> Dict[str, Any]:
        """
        Fetch current weather for a location with resilient fallback
        Returns: {current, status, timestamp}
        status: LIVE | CACHED | OFFLINE
        """
        try:
            async with httpx.AsyncClient(timeout=WeatherService.TIMEOUT) as client:
                url = f"{WeatherService.BASE_URL}/forecast"
                params = {
                    "latitude": lat,
                    "longitude": lon,
                    "current": "temperature_2m,relative_humidity_2m,precipitation,cloud_cover,wind_speed_10m",
                    "timezone": "UTC"
                }
                
                response = await client.get(url, params=params)
                response.raise_for_status()
                data = response.json()
                
                # Cache successful response
                WeatherCache.save({
                    "location": {"lat": lat, "lon": lon},
                    "current": data.get("current", {}),
                }, "current")
                
                return {
                    "current": data.get("current", {}),
                    "status": "LIVE",
                    "timestamp": datetime.utcnow().isoformat()
                }
        except Exception:
            # Use cached data as fallback
            cache = WeatherCache.load()
            if cache and cache.get("data", {}).get("current"):
                return {
                    "current": cache["data"]["current"],
                    "status": "CACHED",
                    "cached_at": cache["timestamp"],
                    "timestamp": datetime.utcnow().isoformat()
                }
            
            # Offline - return minimal response
            return {
                "current": {},
                "status": "OFFLINE",
                "timestamp": datetime.utcnow().isoformat()
            }
    
    @staticmethod
    async def get_forecast(lat: float, lon: float, days: int = 7) -> Dict[str, Any]:
        """Fetch weather forecast"""
        try:
            async with httpx.AsyncClient(timeout=WeatherService.TIMEOUT) as client:
                url = f"{WeatherService.BASE_URL}/forecast"
                params = {
                    "latitude": lat,
                    "longitude": lon,
                    "hourly": "precipitation,precipitation_probability,relative_humidity_2m",
                    "daily": "precipitation_sum,precipitation_probability_max,temperature_2m_max",
                    "forecast_days": min(days, 16),
                    "timezone": "UTC"
                }
                
                response = await client.get(url, params=params)
                response.raise_for_status()
                data = response.json()
                
                WeatherCache.save({
                    "location": {"lat": lat, "lon": lon},
                    "forecast": data,
                }, "forecast")
                
                return {
                    "hourly": data.get("hourly", {}),
                    "daily": data.get("daily", {}),
                    "status": "LIVE",
                    "timestamp": datetime.utcnow().isoformat()
                }
        except Exception:
            cache = WeatherCache.load()
            if cache and cache.get("data", {}).get("forecast"):
                return {
                    "hourly": cache["data"]["forecast"].get("hourly", {}),
                    "daily": cache["data"]["forecast"].get("daily", {}),
                    "status": "CACHED",
                    "cached_at": cache["timestamp"],
                    "timestamp": datetime.utcnow().isoformat()
                }
            
            return {
                "hourly": {},
                "daily": {},
                "status": "OFFLINE",
                "timestamp": datetime.utcnow().isoformat()
            }
    
    @staticmethod
    async def get_batch_weather(locations: List[tuple]) -> Dict[str, Any]:
        """
        Fetch current weather for multiple locations
        locations: List of (lat, lon) tuples
        """
        results = {}
        tasks = []
        
        for lat, lon in locations:
            task = WeatherService.get_current_weather(lat, lon)
            tasks.append((f"{lat},{lon}", task))
        
        responses = await asyncio.gather(
            *[task for _, task in tasks],
            return_exceptions=True
        )
        
        for (loc_key, _), response in zip(tasks, responses):
            if isinstance(response, Exception):
                results[loc_key] = {
                    "current": {},
                    "status": "ERROR"
                }
            else:
                results[loc_key] = response
        
        return results


def get_weather_service() -> WeatherService:
    """Get weather service"""
    return WeatherService()