"""
Scenario Simulation API Endpoint
"""

from fastapi import APIRouter, HTTPException, Query
from datetime import datetime
from app.models.schemas import ScenarioSimulationResponse, ScenarioSimulationRequest
from app.services.flood_service import scenario_service

router = APIRouter()


@router.post("", response_model=ScenarioSimulationResponse)
async def run_scenario_simulation(request: ScenarioSimulationRequest):
    """
    Run a flood scenario simulation
    
    Simulates flood impacts with different rainfall multipliers (0.5x to 3.0x)
    
    Args:
        rainfall_multiplier: Scale factor for rainfall intensity
        scenario_name: Name for this scenario
        duration_hours: Simulation duration
    
    Returns:
        Projected flood zones and impact metrics
    """
    try:
        # Validate rainfall multiplier
        if request.rainfall_multiplier < 0.5 or request.rainfall_multiplier > 3.0:
            raise HTTPException(
                status_code=400, 
                detail="Rainfall multiplier must be between 0.5 and 3.0"
            )
        
        result = scenario_service.run_scenario(request.rainfall_multiplier)
        
        return ScenarioSimulationResponse(
            scenario_id=result["scenario_id"],
            scenario_name=request.scenario_name,
            rainfall_multiplier=request.rainfall_multiplier,
            projected_flood_zones=result["projected_flood_zones"],
            affected_population_total=result["affected_population_total"],
            critical_alerts_count=result["critical_alerts_count"],
            timestamp=datetime.utcnow()
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error running scenario simulation: {str(e)}")


@router.get("/compare", response_model=list)
async def compare_scenarios(
    multipliers: str = Query("1.0,1.5,2.0,2.5", description="Comma-separated rainfall multipliers")
):
    """
    Compare multiple scenario outcomes
    
    Run simulations with different rainfall levels and compare results
    
    Args:
        multipliers: Comma-separated values (e.g., "1.0,1.5,2.0")
    
    Returns:
        List of scenario results for comparison
    """
    try:
        # Parse multipliers
        try:
            mult_values = [float(m.strip()) for m in multipliers.split(",")]
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid multiplier format")
        
        # Validate ranges
        for m in mult_values:
            if m < 0.5 or m > 3.0:
                raise HTTPException(
                    status_code=400,
                    detail=f"Rainfall multiplier {m} outside valid range (0.5-3.0)"
                )
        
        results = scenario_service.compare_scenarios(mult_values)
        
        return [
            {
                "scenario_id": r["scenario_id"],
                "scenario_name": r["scenario_name"],
                "rainfall_multiplier": r["rainfall_multiplier"],
                "affected_population_total": r["affected_population_total"],
                "critical_alerts_count": r["critical_alerts_count"],
                "zone_count": len(r["projected_flood_zones"])
            }
            for r in results
        ]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error comparing scenarios: {str(e)}")


@router.get("/preset/low", response_model=ScenarioSimulationResponse)
async def scenario_low_rainfall():
    """
    Preset scenario: Low rainfall (0.7x)
    
    Simulates below-average precipitation
    """
    try:
        result = scenario_service.run_scenario(0.7)
        
        return ScenarioSimulationResponse(
            scenario_id=result["scenario_id"],
            scenario_name="Low Rainfall Scenario",
            rainfall_multiplier=0.7,
            projected_flood_zones=result["projected_flood_zones"],
            affected_population_total=result["affected_population_total"],
            critical_alerts_count=result["critical_alerts_count"],
            timestamp=datetime.utcnow()
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error running preset scenario: {str(e)}")


@router.get("/preset/moderate", response_model=ScenarioSimulationResponse)
async def scenario_moderate_rainfall():
    """
    Preset scenario: Moderate rainfall (1.5x)
    
    Simulates heavy precipitation
    """
    try:
        result = scenario_service.run_scenario(1.5)
        
        return ScenarioSimulationResponse(
            scenario_id=result["scenario_id"],
            scenario_name="Moderate Rainfall Scenario",
            rainfall_multiplier=1.5,
            projected_flood_zones=result["projected_flood_zones"],
            affected_population_total=result["affected_population_total"],
            critical_alerts_count=result["critical_alerts_count"],
            timestamp=datetime.utcnow()
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error running preset scenario: {str(e)}")


@router.get("/preset/extreme", response_model=ScenarioSimulationResponse)
async def scenario_extreme_rainfall():
    """
    Preset scenario: Extreme rainfall (2.5x)
    
    Simulates catastrophic precipitation event
    """
    try:
        result = scenario_service.run_scenario(2.5)
        
        return ScenarioSimulationResponse(
            scenario_id=result["scenario_id"],
            scenario_name="Extreme Rainfall Scenario",
            rainfall_multiplier=2.5,
            projected_flood_zones=result["projected_flood_zones"],
            affected_population_total=result["affected_population_total"],
            critical_alerts_count=result["critical_alerts_count"],
            timestamp=datetime.utcnow()
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error running preset scenario: {str(e)}")
