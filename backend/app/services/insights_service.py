"""
AI Insights Generator Service
Creates intelligent summaries of flood risk with drivers and recommendations
"""
from typing import Dict, Any, List


class AIInsightsGenerator:
    """Generate AI-powered insight summaries"""
    
    RISK_DRIVERS_THRESHOLDS = {
        "MonsoonIntensity": (70, "Extreme monsoon activity"),
        "Urbanization": (75, "High urbanization"),
        "Deforestation": (65, "Significant deforestation"),
        "DrainageSystems": (75, "Drainage infrastructure stress"),
        "WetlandLoss": (70, "Wetland degradation"),
        "CoastalVulnerability": (70, "Coastal erosion risk"),
        "PopulationScore": (80, "High population concentration"),
        "DeterioratingInfrastructure": (75, "Infrastructure deterioration"),
    }
    
    RECOMMENDATIONS_BY_RISK = {
        "CRITICAL": [
            "Activate emergency response protocols immediately",
            "Deploy response teams to critical zones",
            "Prepare evacuation plans for high-density areas",
            "Monitor river systems continuously",
            "Increase drainage monitoring",
        ],
        "HIGH": [
            "Monitor weather forecasts closely",
            "Prepare emergency response teams",
            "Alert critical infrastructure operators",
            "Monitor river levels",
            "Ready evacuation procedures",
        ],
        "MODERATE": [
            "Monitor rainfall levels",
            "Maintain alert status",
            "Regular infrastructure checks",
            "Ensure drainage systems operational",
            "Update forecast models",
        ],
        "LOW": [
            "Continue regular monitoring",
            "Maintain infrastructure",
            "Review seasonal patterns",
            "Update risk assessments",
            "Train response teams",
        ],
    }
    
    @staticmethod
    def generate_insight(
        region_name: str,
        risk_score: float,
        risk_level: str,
        ml_features: Dict[str, float],
        rainfall: float,
        forecast_rainfall: float = None
    ) -> Dict[str, Any]:
        """
        Generate AI insight for a region
        """
        insight = {
            "region": region_name,
            "risk_score": risk_score,
            "risk_level": risk_level,
            "headline": AIInsightsGenerator._generate_headline(region_name, risk_level, rainfall),
            "primary_drivers": AIInsightsGenerator._extract_drivers(ml_features),
            "rainfall_context": AIInsightsGenerator._generate_rainfall_context(rainfall, forecast_rainfall),
            "recommendations": AIInsightsGenerator.RECOMMENDATIONS_BY_RISK.get(risk_level, []),
            "urgency": AIInsightsGenerator._calculate_urgency(risk_score, rainfall),
        }
        return insight
    
    @staticmethod
    def _generate_headline(region: str, risk_level: str, rainfall: float) -> str:
        """Generate attention-grabbing headline"""
        if risk_level == "CRITICAL":
            return f"🚨 {region} CRITICAL Risk - Immediate Action Required"
        elif risk_level == "HIGH":
            if rainfall > 50:
                return f"⚠️ {region} High Risk - Heavy Rainfall Detected"
            return f"⚠️ {region} High Risk - Enhanced Monitoring Active"
        elif risk_level == "MODERATE":
            return f"🟡 {region} Moderate Risk - Conditions Elevated"
        return f"🟢 {region} Low Risk - Normal Monitoring"
    
    @staticmethod
    def _extract_drivers(ml_features: Dict[str, float], top_n: int = 4) -> List[str]:
        """Extract top risk drivers from features"""
        drivers = []
        
        for feature, (threshold, description) in AIInsightsGenerator.RISK_DRIVERS_THRESHOLDS.items():
            value = ml_features.get(feature, 0)
            if value >= threshold:
                drivers.append(f"{description} ({value:.0f}/100)")
        
        # Sort by value descending and return top N
        return sorted(
            drivers,
            key=lambda x: float(x.split("(")[1].split("/")[0]),
            reverse=True
        )[:top_n]
    
    @staticmethod
    def _generate_rainfall_context(current: float, forecast: float = None) -> str:
        """Generate rainfall summary"""
        if current > 50:
            status = "Heavy"
        elif current > 25:
            status = "Moderate"
        elif current > 10:
            status = "Light"
        else:
            status = "Minimal"
        
        context = f"{status} rainfall detected ({current:.1f}mm)"
        
        if forecast:
            if forecast > current * 1.5:
                context += f". Forecast shows significant increase to {forecast:.1f}mm"
            elif forecast < current * 0.5:
                context += f". Forecast shows improvement to {forecast:.1f}mm"
        
        return context
    
    @staticmethod
    def _calculate_urgency(risk_score: float, rainfall: float) -> str:
        """Calculate urgency level"""
        if risk_score > 80 and rainfall > 40:
            return "IMMEDIATE"
        elif risk_score > 60 and rainfall > 25:
            return "HIGH"
        elif risk_score > 40 or rainfall > 50:
            return "ELEVATED"
        return "NORMAL"


def generate_region_insight(
    region_data: Dict[str, Any],
    current_weather: Dict[str, Any],
    forecast_weather: Dict[str, Any] = None,
    ml_prediction: Dict[str, Any] = None
) -> Dict[str, Any]:
    """
    High-level function to generate insight for a region
    Combines static region data with live weather and ML predictions
    """
    
    rainfall = current_weather.get("precipitation", 0) or 0
    forecast_rainfall = None
    
    if forecast_weather and forecast_weather.get("daily"):
        daily = forecast_weather["daily"]
        if daily.get("precipitation_sum"):
            # Get next day precipitation
            forecast_rainfall = daily["precipitation_sum"][0] if daily["precipitation_sum"] else None
    
    ml_features = region_data.get("ml_features", {})
    
    # Use ML prediction if available, otherwise use baseline vulnerability
    if ml_prediction:
        risk_score = ml_prediction.get("risk_score", region_data.get("baseline_vulnerability_score", 50))
        risk_level = ml_prediction.get("risk_level", region_data.get("risk_category", "MODERATE"))
    else:
        risk_score = region_data.get("baseline_vulnerability_score", 50)
        risk_level = region_data.get("risk_category", "MODERATE")
    
    return AIInsightsGenerator.generate_insight(
        region_name=region_data.get("city", "Unknown"),
        risk_score=risk_score,
        risk_level=risk_level,
        ml_features=ml_features,
        rainfall=rainfall,
        forecast_rainfall=forecast_rainfall
    )
