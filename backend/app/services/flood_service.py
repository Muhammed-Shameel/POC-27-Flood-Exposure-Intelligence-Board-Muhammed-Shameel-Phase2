"""
Core flood intelligence services
Handles business logic, data processing, and risk calculations
"""

from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
from data_pipeline.generate_mock_data import MockDataGenerator


class FloodService:
    """Service for flood zone operations"""
    
    def __init__(self):
        self.generator = MockDataGenerator()
        self._cache = None
        self._cache_timestamp = None
    
    def get_flood_zones(self, refresh: bool = False) -> List[Dict[str, Any]]:
        """
        Get current flood zones
        
        Args:
            refresh: Force regeneration of mock data
        
        Returns:
            List of flood zone dictionaries
        """
        if refresh or self._cache is None or self._is_cache_stale():
            self._cache = self.generator.generate_flood_zones(12)
            self._cache_timestamp = datetime.utcnow()
        
        return self._cache
    
    def get_flood_zone_by_id(self, zone_id: str) -> Optional[Dict[str, Any]]:
        """Get a specific flood zone"""
        zones = self.get_flood_zones()
        return next((z for z in zones if z["id"] == zone_id), None)
    
    def _is_cache_stale(self) -> bool:
        """Check if cache is older than 5 minutes"""
        if self._cache_timestamp is None:
            return True
        return datetime.utcnow() - self._cache_timestamp > timedelta(minutes=5)


class RainfallService:
    """Service for rainfall data operations"""
    
    def __init__(self):
        self.generator = MockDataGenerator()
    
    def get_rainfall_data(self) -> List[Dict[str, Any]]:
        """Get current rainfall measurements and forecasts"""
        return self.generator.generate_rainfall_data(15)
    
    def get_rainfall_by_location(self, lat: float, lon: float, radius_km: float = 10) -> List[Dict[str, Any]]:
        """Get rainfall data near a location"""
        rainfall = self.get_rainfall_data()
        
        # Simple distance check (in degrees, rough approximation)
        radius_deg = radius_km / 111.0
        
        nearby = [
            r for r in rainfall
            if abs(r["location"]["latitude"] - lat) < radius_deg
            and abs(r["location"]["longitude"] - lon) < radius_deg
        ]
        
        return nearby


class RiskScoreEngine:
    """Risk scoring and analysis service"""
    
    def __init__(self):
        self.generator = MockDataGenerator()
    
    def calculate_risk_scores(self, zone_ids: List[str]) -> List[Dict[str, Any]]:
        """
        Calculate composite risk scores for zones
        
        Formula:
        Risk = 0.4 * flood_severity + 0.3 * population_exposure + 0.3 * infrastructure_exposure
        """
        return self.generator.generate_risk_scores(zone_ids)
    
    def get_risk_distribution(self, scores: List[Dict[str, Any]]) -> Dict[str, int]:
        """Get count of zones by risk level"""
        distribution = {
            "LOW": 0,
            "MODERATE": 0,
            "HIGH": 0,
            "CRITICAL": 0
        }
        
        for score in scores:
            distribution[score["risk_level"]] += 1
        
        return distribution
    
    def get_global_risk_index(self, scores: List[Dict[str, Any]]) -> float:
        """Calculate weighted global risk index"""
        if not scores:
            return 0.0
        
        weights = {"CRITICAL": 1.0, "HIGH": 0.7, "MODERATE": 0.4, "LOW": 0.1}
        total_weight = 0.0
        weighted_sum = 0.0
        
        for score in scores:
            weight = weights.get(score["risk_level"], 0)
            weighted_sum += score["overall_score"] * weight
            total_weight += weight
        
        return round(weighted_sum / total_weight if total_weight > 0 else 0, 1)


class EmergencyImpactService:
    """Service for emergency impact calculations"""
    
    def __init__(self):
        self.generator = MockDataGenerator()
    
    def get_impact_for_zone(self, zone_id: str, zone_severity: str) -> Dict[str, Any]:
        """Calculate emergency impact for a zone"""
        return self.generator.generate_emergency_impact(zone_id, zone_severity)
    
    def get_total_impact(self, impacts: List[Dict[str, Any]]) -> Dict[str, int]:
        """Aggregate impacts across all zones"""
        return {
            "total_affected_population": sum(
                i["population_exposure"]["affected_population"] for i in impacts
            ),
            "total_estimated_evacuees": sum(
                i["estimated_evacuees"] for i in impacts
            ),
            "total_hospitals_affected": sum(
                i["infrastructure_exposure"]["hospitals_affected"] for i in impacts
            ),
            "total_schools_affected": sum(
                i["infrastructure_exposure"]["schools_affected"] for i in impacts
            ),
            "total_roads_inaccessible_km": sum(
                i["infrastructure_exposure"]["roads_inaccessible_km"] for i in impacts
            ),
            "critical_facilities_at_risk": sum(
                i["critical_facilities_at_risk"] for i in impacts
            )
        }


class AlertService:
    """Service for alert generation and management"""
    
    def __init__(self):
        self.generator = MockDataGenerator()
    
    def generate_alerts(self, zone_ids: List[str], risk_scores: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Generate alerts based on risk scores"""
        return self.generator.generate_alerts(zone_ids, risk_scores)
    
    def get_active_alerts(self, alerts: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Filter to active alerts only"""
        return [a for a in alerts if a.get("active", True)]
    
    def get_critical_alerts(self, alerts: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Get only critical-level alerts"""
        return [a for a in alerts if a["alert_type"] == "critical"]
    
    def get_alerts_by_zone(self, zone_id: str, alerts: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Get alerts for a specific zone"""
        return [a for a in alerts if a["zone_id"] == zone_id]


class ScenarioSimulationService:
    """Service for scenario simulation and forecasting"""
    
    def __init__(self):
        self.generator = MockDataGenerator()
    
    def run_scenario(self, rainfall_multiplier: float = 1.5) -> Dict[str, Any]:
        """
        Run a scenario simulation with different rainfall levels
        
        Args:
            rainfall_multiplier: Factor to multiply rainfall (0.5-3.0)
        
        Returns:
            Scenario results with projected impacts
        """
        return self.generator.generate_scenario_simulation(rainfall_multiplier)
    
    def compare_scenarios(self, multipliers: List[float]) -> List[Dict[str, Any]]:
        """Run multiple scenarios for comparison"""
        return [self.run_scenario(m) for m in multipliers]


# Global service instances
flood_service = FloodService()
rainfall_service = RainfallService()
risk_engine = RiskScoreEngine()
impact_service = EmergencyImpactService()
alert_service = AlertService()
scenario_service = ScenarioSimulationService()
