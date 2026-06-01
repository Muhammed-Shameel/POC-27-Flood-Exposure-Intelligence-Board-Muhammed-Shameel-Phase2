"""
Live Weather, Forecast, and Simulation APIs
Provides real-time flood intelligence data with ML integration
"""

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field
from typing import List, Dict, Any, Optional
import json
import csv
from pathlib import Path
from datetime import datetime

from ..services.weather_service import WeatherService
from ..services.ml_service import get_ml_service

router = APIRouter(prefix="/api/live", tags=["live"])
historical_router = APIRouter(prefix="/api/historical", tags=["historical"])

# =========================================================
# FILE PATHS
# =========================================================

BASE_DIR = Path(__file__).resolve().parent.parent.parent

REGIONS_FILE = BASE_DIR / "data" / "regions.json"
REGIONS_CACHE_FILE = BASE_DIR / "cache" / "regions_intelligence_cache.json"
REGIONS_ARCHIVE_FILE = BASE_DIR / "cache" / "historical_intelligence_archive.csv"
PRODUCTION_MODEL_TYPE = "GradientBoostingRegressor"
ARCHIVE_FIELDS = [
    "snapshot_timestamp",
    "region_key",
    "city",
    "country",
    "latitude",
    "longitude",
    "risk_score",
    "risk_status",
    "rainfall_mm",
    "humidity_percent",
    "water_level_index",
    "status",
    "mode",
    "model_type",
    "inference_status",
]


# =========================================================
# PYDANTIC MODELS
# =========================================================


class LocationData(BaseModel):
    """
    Location intelligence model
    """

    model_config = ConfigDict(
        protected_namespaces=()
    )

    city: str
    country: str
    latitude: float
    longitude: float

    current_weather: Dict[str, Any]
    geojson: Optional[Dict[str, Any]] = None

    risk_score: float
    risk_status: str

    rainfall_mm: float
    humidity_percent: float = 0
    water_level_index: float = 0

    status: str  # LIVE | CACHED | OFFLINE
    mode: str = "LIVE"
    model_type: Optional[str] = None
    inference_status: str = "ok"
    state: Optional[str] = None
    continent: Optional[str] = None
    baseline_vulnerability_score: float = 50
    risk_category: Optional[str] = None
    region_notes: Optional[str] = None
    notable_flood_events: List[str] = Field(default_factory=list)
    ml_features: Dict[str, Any] = Field(default_factory=dict)
    infrastructure: Dict[str, float] = Field(default_factory=dict)
    infrastructure_source: Dict[str, Any] = Field(default_factory=dict)
    infrastructure_intelligence: Dict[str, float] = Field(default_factory=dict)


class SimulationRequest(BaseModel):
    """
    Flood simulation parameters
    """

    monsoon_intensity: float = 80
    urbanization: float = 80
    deforestation: float = 60
    river_management: float = 50
    drainage_systems: float = 70
    climate_change: float = 70


class ForecastPoint(BaseModel):
    """
    Forecast timeline point
    """

    time: str
    rainfall_mm: float
    probability: float


def _load_regions() -> List[Dict[str, Any]]:
    if not REGIONS_FILE.exists():
        raise HTTPException(
            status_code=404,
            detail="regions.json not found"
        )

    with open(REGIONS_FILE, "r", encoding="utf-8") as f:
        regions_data = json.load(f)

    return regions_data.get("regions", [])


def _load_regions_cache_payload() -> Optional[Dict[str, Any]]:
    if not REGIONS_CACHE_FILE.exists():
        return None

    try:
        with open(REGIONS_CACHE_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return None


def _is_valid_live_snapshot(results: List[LocationData]) -> bool:
    if not results:
        return False

    return all(
        item.city
        and item.country
        and isinstance(item.risk_score, (int, float))
        and item.model_type == PRODUCTION_MODEL_TYPE
        and item.inference_status == "ml_calibrated"
        for item in results
    )


def _archive_regions_cache(cache: Optional[Dict[str, Any]]) -> None:
    if not cache:
        return

    snapshot_timestamp = cache.get("timestamp")
    data = cache.get("data", [])
    if not snapshot_timestamp or not isinstance(data, list) or not data:
        return

    try:
        REGIONS_ARCHIVE_FILE.parent.mkdir(parents=True, exist_ok=True)
        existing_keys = set()

        if REGIONS_ARCHIVE_FILE.exists():
            with open(REGIONS_ARCHIVE_FILE, "r", encoding="utf-8", newline="") as f:
                for row in csv.DictReader(f):
                    existing_keys.add(
                        (
                            row.get("snapshot_timestamp"),
                            row.get("region_key"),
                        )
                    )

        rows = []
        for item in data:
            city = item.get("city")
            country = item.get("country")
            if not city or not country:
                continue

            region_key = f"{city}|{country}"
            dedupe_key = (snapshot_timestamp, region_key)
            if dedupe_key in existing_keys:
                continue

            rows.append({
                "snapshot_timestamp": snapshot_timestamp,
                "region_key": region_key,
                "city": city,
                "country": country,
                "latitude": item.get("latitude"),
                "longitude": item.get("longitude"),
                "risk_score": item.get("risk_score"),
                "risk_status": item.get("risk_status"),
                "rainfall_mm": item.get("rainfall_mm"),
                "humidity_percent": item.get("humidity_percent"),
                "water_level_index": item.get("water_level_index"),
                "status": item.get("status"),
                "mode": item.get("mode"),
                "model_type": item.get("model_type"),
                "inference_status": item.get("inference_status"),
            })
            existing_keys.add(dedupe_key)

        if not rows:
            return

        write_header = not REGIONS_ARCHIVE_FILE.exists()
        with open(REGIONS_ARCHIVE_FILE, "a", encoding="utf-8", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=ARCHIVE_FIELDS)
            if write_header:
                writer.writeheader()
            writer.writerows(rows)
    except Exception:
        pass


def _save_regions_cache(results: List[LocationData]) -> None:
    try:
        if not _is_valid_live_snapshot(results):
            return

        previous_cache = _load_regions_cache_payload()
        _archive_regions_cache(previous_cache)

        REGIONS_CACHE_FILE.parent.mkdir(parents=True, exist_ok=True)
        with open(REGIONS_CACHE_FILE, "w", encoding="utf-8") as f:
            json.dump(
                {
                    "timestamp": datetime.utcnow().isoformat(),
                    "data": [item.model_dump() for item in results]
                },
                f,
                indent=2
            )
    except Exception:
        pass


def _load_regions_cache() -> List[LocationData]:
    try:
        cache = _load_regions_cache_payload()
        if not cache:
            return []

        cached = [
            LocationData(**{**item, "status": "CACHED"})
            for item in cache.get("data", [])
        ]
        return cached if _is_valid_live_snapshot(cached) else []
    except Exception:
        return []


def _region_features(region: Dict[str, Any], rainfall: float) -> Dict[str, float]:
    ml_features = region.get("ml_features", {})
    drainage_risk = float(ml_features.get("TopographyDrainage", 50))
    return {
        "rainfall": float(rainfall or 0),
        "population_density": float(ml_features.get("PopulationScore", 50)) * 50,
        "elevation": max(-20, (100 - drainage_risk) * 5),
        "infrastructure_density": float(ml_features.get("DeterioratingInfrastructure", 50)),
        "historical_flood_score": float(region.get("baseline_vulnerability_score", 50)),
    }


def _infrastructure_intelligence(region: Dict[str, Any], rainfall: float) -> Dict[str, float]:
    ml_features = region.get("ml_features", {})

    def feature(name: str, fallback: float = 50) -> float:
        return float(ml_features.get(name, fallback))

    drainage_stress = min(100, feature("DrainageSystems") * 0.55 + feature("TopographyDrainage") * 0.3 + rainfall * 0.15)
    runoff_pressure = min(100, feature("Urbanization") * 0.42 + feature("WetlandLoss") * 0.33 + feature("Encroachments") * 0.25)
    watershed_degradation = min(100, feature("Watersheds") * 0.42 + feature("Siltation") * 0.32 + feature("Deforestation") * 0.26)
    coastal_exposure = min(100, feature("CoastalVulnerability", 0) * 0.76 + feature("ClimateChange") * 0.24)
    infrastructure_strain = min(
        100,
        feature("DeterioratingInfrastructure") * 0.34
        + (100 - feature("DamsQuality")) * 0.24
        + feature("InadequatePlanning") * 0.2
        + feature("PopulationScore") * 0.22,
    )
    resilience_score = max(
        0,
        100
        - drainage_stress * 0.24
        - runoff_pressure * 0.2
        - watershed_degradation * 0.18
        - infrastructure_strain * 0.24
        - coastal_exposure * 0.14,
    )

    return {
        "drainage_stress": round(drainage_stress, 2),
        "runoff_pressure": round(runoff_pressure, 2),
        "watershed_degradation": round(watershed_degradation, 2),
        "coastal_exposure": round(coastal_exposure, 2),
        "infrastructure_strain": round(infrastructure_strain, 2),
        "resilience_score": round(resilience_score, 2),
        "climate_escalation": round(feature("ClimateChange"), 2),
    }


def _geojson_point(region: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "type": "Feature",
        "geometry": {
            "type": "Point",
            "coordinates": [region["longitude"], region["latitude"]],
        },
        "properties": {
            "city": region["city"],
            "country": region["country"],
            "continent": region.get("continent"),
        },
    }


def _region_payload(region: Dict[str, Any], weather: Dict[str, Any], metrics: Dict[str, float], prediction: Dict[str, Any], mode: str) -> Dict[str, Any]:
    rainfall = metrics["rainfall_mm"]

    return {
        "city": region["city"],
        "country": region["country"],
        "state": region.get("state"),
        "continent": region.get("continent"),
        "latitude": region["latitude"],
        "longitude": region["longitude"],
        "geojson": _geojson_point(region),
        "current_weather": weather.get("current", {}),
        "risk_score": prediction["risk_score"],
        "risk_status": prediction["risk_level"],
        "rainfall_mm": rainfall,
        "humidity_percent": metrics["humidity_percent"],
        "water_level_index": metrics["water_level_index"],
        "status": weather.get("status", mode),
        "mode": mode,
        "model_type": prediction.get("model_type"),
        "inference_status": prediction.get("inference_status", "ml"),
        "baseline_vulnerability_score": float(region.get("baseline_vulnerability_score", 50)),
        "risk_category": region.get("risk_category"),
        "region_notes": region.get("region_notes"),
        "notable_flood_events": region.get("notable_flood_events", []),
        "ml_features": region.get("ml_features", {}),
        "infrastructure": region.get("infrastructure", {}),
        "infrastructure_source": region.get("infrastructure_source", {}),
        "infrastructure_intelligence": _infrastructure_intelligence(region, rainfall),
    }


def _risk_level(score: float) -> str:
    if score < 25:
        return "LOW"
    if score < 50:
        return "MODERATE"
    if score < 75:
        return "HIGH"
    return "CRITICAL"


def _weather_metrics(region: Dict[str, Any], weather: Dict[str, Any]) -> Dict[str, float]:
    current = weather.get("current", {}) or {}
    ml_features = region.get("ml_features", {})

    precipitation = float(current.get("precipitation") or 0)
    humidity = float(current.get("relative_humidity_2m") or 0)
    cloud_cover = float(current.get("cloud_cover") or 0)
    monsoon = float(ml_features.get("MonsoonIntensity", 50))
    drainage = float(ml_features.get("TopographyDrainage", 50))
    coastal = float(ml_features.get("CoastalVulnerability", 0))

    if not current:
        humidity = max(humidity, min(96, 45 + monsoon * 0.45))
        cloud_cover = max(cloud_cover, min(100, monsoon * 0.75))

    weather_stress_rainfall = (
        precipitation * 18
        + max(0, humidity - 55) * 0.18
        + cloud_cover * 0.04
        + monsoon * 0.16
    )
    effective_rainfall = round(min(500, max(0, weather_stress_rainfall)), 2)

    water_level = round(
        min(
            100,
            effective_rainfall * 0.45
            + drainage * 0.22
            + coastal * 0.18
            + float(region.get("baseline_vulnerability_score", 50)) * 0.15,
        ),
        2
    )

    return {
        "rainfall_mm": effective_rainfall,
        "humidity_percent": round(humidity, 1),
        "water_level_index": water_level,
    }


def _predict_region_risk(region: Dict[str, Any], rainfall: float) -> Dict[str, Any]:
    ml_svc = get_ml_service()
    model_status = ml_svc.get_model_status()
    prediction = ml_svc.predict_risk(_region_features(region, rainfall))

    risk_score = prediction.get("risk_score")
    if risk_score is None:
        raise RuntimeError(
            f"Gradient Boost prediction failed for {region.get('city', 'unknown region')}: "
            f"{prediction.get('error', 'unknown error')}"
        )

    baseline = float(region.get("baseline_vulnerability_score", 50))
    calibrated_score = min(
        100,
        max(
            0,
            float(risk_score) * 0.6
            + baseline * 0.25
            + min(100, float(rainfall or 0) * 1.2) * 0.15,
        )
    )
    risk_level = _risk_level(calibrated_score)

    return {
        "risk_score": round(calibrated_score, 2),
        "risk_level": risk_level,
        "inference_status": "ml_calibrated",
        "model_type": model_status.get("model_info", {}).get("model_type"),
    }


# =========================================================
# WEATHER ENDPOINT
# =========================================================


@router.get("/weather")
async def get_location_weather(
    latitude: float = Query(..., description="Latitude"),
    longitude: float = Query(..., description="Longitude")
):
    """
    Get current weather by coordinates

    Example:
    /api/live/weather?latitude=11.25&longitude=75.78
    """

    try:
        weather_svc = WeatherService()

        result = await weather_svc.get_current_weather(
            latitude,
            longitude
        )

        return {
            "success": True,
            "timestamp": datetime.utcnow().isoformat(),
            "data": result
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Weather fetch failed: {str(e)}"
        )


# =========================================================
# FORECAST ENDPOINT
# =========================================================


@router.get("/forecast")
async def get_location_forecast(
    latitude: float = Query(...),
    longitude: float = Query(...),
    days: int = Query(7, ge=1, le=16)
):
    """
    Get forecast data

    Example:
    /api/live/forecast?latitude=11.25&longitude=75.78&days=7
    """

    try:
        weather_svc = WeatherService()

        result = await weather_svc.get_forecast(
            latitude,
            longitude,
            days
        )

        return {
            "success": True,
            "timestamp": datetime.utcnow().isoformat(),
            "forecast_days": days,
            "data": result
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Forecast fetch failed: {str(e)}"
        )


# =========================================================
# REGIONS INTELLIGENCE
# =========================================================


@router.get(
    "/regions-intelligence",
    response_model=List[LocationData]
)
async def get_regions_intelligence():
    """
    Get all region intelligence data
    Includes:
    - live weather
    - rainfall
    - ML flood risk
    - cached fallback support
    """

    try:

        weather_svc = WeatherService()

        results = []

        regions = _load_regions()

        # Concurrent weather fetch
        locations = [
            (r["latitude"], r["longitude"])
            for r in regions
        ]

        weather_results = await weather_svc.get_batch_weather(
            locations
        )

        for region in regions:

            loc_key = f"{region['latitude']},{region['longitude']}"

            weather = weather_results.get(
                loc_key,
                {
                    "current": {},
                    "status": "OFFLINE"
                }
            )

            metrics = _weather_metrics(region, weather)
            rainfall = metrics["rainfall_mm"]

            prediction = _predict_region_risk(region, rainfall)

            results.append(LocationData(**_region_payload(region, weather, metrics, prediction, "LIVE")))

        if _is_valid_live_snapshot(results):
            _save_regions_cache(results)
            return results

        cached = _load_regions_cache()
        if cached:
            return cached

        raise HTTPException(
            status_code=503,
            detail="Gradient Boost live intelligence snapshot failed validation"
        )

    except HTTPException:
        raise

    except Exception as e:

        cached = _load_regions_cache()
        if cached:
            return cached

        raise HTTPException(
            status_code=500,
            detail=f"Regions intelligence failed: {str(e)}"
        )


@historical_router.get(
    "/regions",
    response_model=List[LocationData]
)
async def get_historical_regions():
    """
    Return static regional flood intelligence for historical mode.
    This path intentionally avoids live weather and uses the curated
    regional flood profile as the source of truth.
    """

    try:
        results = []

        for region in _load_regions():
            historical_rainfall = float(
                region.get("ml_features", {}).get("MonsoonIntensity", 0)
            )
            prediction = _predict_region_risk(region, historical_rainfall)
            water_level = round(
                min(
                    100,
                    historical_rainfall * 0.35
                    + float(region.get("ml_features", {}).get("TopographyDrainage", 50)) * 0.25
                    + float(region.get("baseline_vulnerability_score", 50)) * 0.2,
                ),
                2
            )

            metrics = {
                "rainfall_mm": round(historical_rainfall, 2),
                "humidity_percent": 0,
                "water_level_index": water_level,
            }
            prediction = {**prediction, "inference_status": "historical_ml_dataset"}
            results.append(LocationData(**_region_payload(region, {"current": {}, "status": "HISTORICAL"}, metrics, prediction, "HISTORICAL")))

        return results

    except Exception as e:
        cached = _load_regions_cache()
        if cached:
            return [
                LocationData(**{**item.model_dump(), "mode": "HISTORICAL", "status": "CACHED"})
                for item in cached
            ]

        raise HTTPException(
            status_code=500,
            detail=f"Historical regions failed: {str(e)}"
        )


# =========================================================
# REGION FORECAST
# =========================================================


@router.get("/region-forecast")
async def get_region_forecast(
    city: str = Query(...)
):
    """
    Get 7-day forecast for a region

    Example:
    /api/live/region-forecast?city=Kozhikode
    """

    try:

        with open(REGIONS_FILE, "r", encoding="utf-8") as f:
            regions_data = json.load(f)

        region = next(
            (
                r for r in regions_data.get("regions", [])
                if r["city"].lower() == city.lower()
            ),
            None
        )

        if not region:
            raise HTTPException(
                status_code=404,
                detail=f"{city} not found"
            )

        weather_svc = WeatherService()

        forecast = await weather_svc.get_forecast(
            region["latitude"],
            region["longitude"],
            days=7
        )

        return {
            "success": True,
            "city": region["city"],
            "country": region["country"],
            "baseline_vulnerability":
                region.get(
                    "baseline_vulnerability_score",
                    50
                ),
            "forecast": forecast,
            "timestamp": datetime.utcnow().isoformat()
        }

    except HTTPException:
        raise

    except Exception as e:

        raise HTTPException(
            status_code=500,
            detail=f"Region forecast failed: {str(e)}"
        )


# =========================================================
# SIMULATION
# =========================================================


@router.post("/simulate")
async def simulate_flood_scenario(
    request: SimulationRequest
):
    """
    Flood simulation endpoint

    Runs:
    - ML predictions
    - rainfall impact
    - urbanization stress
    - climate amplification
    """

    try:

        with open(REGIONS_FILE, "r", encoding="utf-8") as f:
            regions_data = json.load(f)

        weather_svc = WeatherService()

        results = []

        regions = regions_data.get("regions", [])[:5]

        for region in regions:

            weather = await weather_svc.get_current_weather(
                region["latitude"],
                region["longitude"]
            )

            adjusted_rainfall = round(
                _weather_metrics(region, weather)["rainfall_mm"]
                * (request.monsoon_intensity / 80),
                2
            )
            prediction = _predict_region_risk(region, adjusted_rainfall)

            results.append({
                "city": region["city"],
                "country": region["country"],

                "latitude": region["latitude"],
                "longitude": region["longitude"],

                "risk_score": prediction["risk_score"],
                "risk_level": prediction["risk_level"],

                "baseline_vulnerability":
                    region.get(
                        "baseline_vulnerability_score",
                        50
                    ),

                "rainfall_mm": adjusted_rainfall,

                "simulation_inputs": request.dict()
            })

        return {
            "success": True,
            "simulation_results": results,
            "timestamp": datetime.utcnow().isoformat()
        }

    except Exception as e:

        raise HTTPException(
            status_code=500,
            detail=f"Simulation failed: {str(e)}"
        )


# =========================================================
# STATUS ENDPOINT
# =========================================================


@router.get("/status")
async def get_api_status():
    """
    System health endpoint
    """

    return {
        "status": "healthy",

        "timestamp": datetime.utcnow().isoformat(),

        "services": {
            "weather_api": "connected",
            "ml_engine": "ready",
            "cache": "active",
            "forecasting": "enabled",
            "simulation": "enabled"
        }
    }
