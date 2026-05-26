"""
Emergency Impact API Endpoint
"""

from fastapi import APIRouter, HTTPException
from datetime import datetime
from app.models.schemas import EmergencyImpactResponse
from app.services.flood_service import flood_service, impact_service

router = APIRouter()


@router.get("", response_model=dict)
async def get_emergency_impact():
    """
    Get aggregated emergency impact metrics
    
    Returns total population affected, infrastructure exposure, evacuee estimates
    """
    try:
        zones = flood_service.get_flood_zones()
        impacts = [
            impact_service.get_impact_for_zone(z["id"], z["severity"]) 
            for z in zones
        ]
        
        total_impact = impact_service.get_total_impact(impacts)
        
        return {
            "impacts": total_impact,
            "zone_count": len(zones),
            "timestamp": datetime.utcnow()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving emergency impact: {str(e)}")


@router.get("/{zone_id}", response_model=EmergencyImpactResponse)
async def get_zone_emergency_impact(zone_id: str):
    """
    Get emergency impact for a specific flood zone
    
    Returns population exposure, infrastructure at risk, evacuation estimates
    """
    try:
        zone = flood_service.get_flood_zone_by_id(zone_id)
        
        if not zone:
            raise HTTPException(status_code=404, detail=f"Flood zone {zone_id} not found")
        
        impact = impact_service.get_impact_for_zone(zone_id, zone["severity"])
        
        return impact
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving zone impact: {str(e)}")
