"""
Pydantic schemas for request/response validation
"""

from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any
from datetime import datetime
from enum import Enum


class RiskLevel(str, Enum):
    """Risk severity levels"""
    LOW = "LOW"
    MODERATE = "MODERATE"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class Coordinates(BaseModel):
    """Geographic coordinates (WGS84)"""
    latitude: float = Field(..., ge=-90, le=90, description="Latitude")
    longitude: float = Field(..., ge=-180, le=180, description="Longitude")


class GeoPoint(BaseModel):
    """GeoJSON Point feature"""
    type: str = Field(default="Point")
    coordinates: List[float] = Field(..., description="[longitude, latitude]")


class GeoPolygon(BaseModel):
    """GeoJSON Polygon feature"""
    type: str = Field(default="Polygon")
    coordinates: List[List[List[float]]] = Field(..., description="Polygon ring coordinates")


class FloodZoneGeometry(BaseModel):
    """Flood zone with geometry"""
    id: str
    geometry: Dict[str, Any]  # GeoJSON geometry
    severity: RiskLevel
    flood_depth_meters: float = Field(..., ge=0, description="Estimated flood depth")
    affected_area_sqkm: float = Field(..., ge=0)
    created_at: datetime


class RainfallData(BaseModel):
    """Rainfall measurement or forecast"""
    location: Coordinates
    intensity_mm: float = Field(..., ge=0, description="Rainfall intensity in mm")
    accumulated_mm: float = Field(..., ge=0, description="Accumulated rainfall in mm")
    timestamp: datetime
    forecast_horizon_hours: int = Field(default=0, ge=0)


class PopulationExposure(BaseModel):
    """Population exposure metrics"""
    total_population: int
    affected_population: int
    high_risk_population: int
    evacuation_difficulty_index: float = Field(..., ge=0, le=1)


class InfrastructureExposure(BaseModel):
    """Critical infrastructure exposure"""
    hospitals_affected: int
    schools_affected: int
    power_stations_affected: int
    roads_inaccessible_km: float
    bridges_affected: int


class EmergencyImpactResponse(BaseModel):
    """Emergency impact metrics response"""
    zone_id: str
    timestamp: datetime
    population_exposure: PopulationExposure
    infrastructure_exposure: InfrastructureExposure
    estimated_evacuees: int
    critical_facilities_at_risk: int


class RiskScore(BaseModel):
    """Risk score calculation result"""
    zone_id: str
    overall_score: float = Field(..., ge=0, le=100, description="0-100 composite score")
    flood_severity_score: float = Field(..., ge=0, le=100)
    population_exposure_score: float = Field(..., ge=0, le=100)
    infrastructure_exposure_score: float = Field(..., ge=0, le=100)
    risk_level: RiskLevel
    timestamp: datetime


class Alert(BaseModel):
    """Emergency alert"""
    id: str
    zone_id: str
    alert_type: str = Field(..., description="warning, danger, critical")
    title: str
    message: str
    risk_level: RiskLevel
    affected_population: int
    timestamp: datetime
    active: bool = True


class ScenarioSimulationRequest(BaseModel):
    """Scenario simulation parameters"""
    rainfall_multiplier: float = Field(1.0, ge=0.5, le=3.0, description="Scale rainfall by factor")
    scenario_name: str = Field(default="Custom Scenario")
    duration_hours: int = Field(default=24)


class ScenarioSimulationResponse(BaseModel):
    """Scenario simulation results"""
    scenario_id: str
    scenario_name: str
    rainfall_multiplier: float
    projected_flood_zones: List[FloodZoneGeometry]
    affected_population_total: int
    critical_alerts_count: int
    timestamp: datetime


# Array Response Models
class FloodZonesResponse(BaseModel):
    """Collection of flood zones"""
    zones: List[FloodZoneGeometry]
    count: int
    timestamp: datetime


class RainfallDataCollectionResponse(BaseModel):
    """Collection of rainfall measurements"""
    data: List[RainfallData]
    count: int
    timestamp: datetime


class RiskScoresCollectionResponse(BaseModel):
    """Collection of risk scores"""
    scores: List[RiskScore]
    count: int
    timestamp: datetime


class AlertsCollectionResponse(BaseModel):
    """Collection of alerts"""
    alerts: List[Alert]
    active_count: int
    critical_count: int
    timestamp: datetime


# =============== ML Prediction Schemas ===============

class RiskPredictionInput(BaseModel):
    """Input features for ML risk prediction"""
    rainfall: float = Field(..., ge=0, le=500, description="Rainfall in mm")
    population_density: float = Field(..., ge=0, le=50000, description="Population per km²")
    elevation: float = Field(..., ge=-50, le=5000, description="Elevation in meters")
    infrastructure_density: float = Field(..., ge=0, le=1000, description="Facilities per km²")
    historical_flood_score: float = Field(..., ge=0, le=100, description="Historical score 0-100")


class RiskPredictionOutput(BaseModel):
    """ML model prediction output"""
    status: str = Field(..., description="success or error")
    risk_score: Optional[float] = Field(None, ge=0, le=100, description="Predicted risk 0-100")
    risk_level: Optional[RiskLevel] = None
    risk_color: Optional[str] = None
    confidence: Optional[float] = Field(None, ge=0, le=1)
    features: RiskPredictionInput
    error: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class BatchRiskPredictionRequest(BaseModel):
    """Batch prediction request"""
    predictions: List[RiskPredictionInput]
    scenario_name: Optional[str] = None


class BatchRiskPredictionOutput(BaseModel):
    """Batch prediction results"""
    status: str
    count: int
    results: List[RiskPredictionOutput]
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class ModelInfoResponse(BaseModel):
    """ML model information"""
    model_config = ConfigDict(protected_namespaces=())

    model_type: str
    features: List[str]
    feature_importance: Optional[Dict[str, float]] = None
    loaded: Optional[bool] = None
    trained: Optional[bool] = None
    status: Optional[str] = None
    model_path: Optional[str] = None
    load_attempts: Optional[List[Dict[str, Any]]] = None
    version: str = "1.0.0"


class ModelStatusResponse(BaseModel):
    """ML model status"""
    model_config = ConfigDict(protected_namespaces=())

    loaded: bool
    trained: bool
    status: str
    model_info: Optional[ModelInfoResponse] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class TrainingMetrics(BaseModel):
    """Training evaluation metrics"""
    train_r2_score: float
    test_r2_score: float
    test_rmse: float
    test_mae: float
    cv_mean: float
    cv_std: float
    samples_trained: int


class TrainingResultResponse(BaseModel):
    """Training result summary"""
    status: str
    results: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)
