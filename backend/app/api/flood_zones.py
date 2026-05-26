"""
Flood Zones API Endpoint
"""

from fastapi import APIRouter, HTTPException, Query
from datetime import datetime
from app.models.schemas import FloodZoneGeometry, FloodZonesResponse
from app.services.flood_service import flood_service

router = APIRouter()


@router.get("", response_model=FloodZonesResponse)
async def get_flood_zones(refresh: bool = Query(False, description="Force refresh mock data")):
    """
    Get all current flood zones with GeoJSON geometry
    
    Returns flood zone polygons with severity levels and estimated depths
    """
    try:
        zones = flood_service.get_flood_zones(refresh=refresh)
        
        return FloodZonesResponse(
            zones=zones,
            count=len(zones),
            timestamp=datetime.utcnow()
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving flood zones: {str(e)}")


@router.get("/{zone_id}", response_model=FloodZoneGeometry)
async def get_flood_zone(zone_id: str):
    """
    Get a specific flood zone by ID
    
    Returns detailed information about a single flood zone
    """
    try:
        zone = flood_service.get_flood_zone_by_id(zone_id)
        
        if not zone:
            raise HTTPException(status_code=404, detail=f"Flood zone {zone_id} not found")
        
        return zone
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving flood zone: {str(e)}")


@router.post("", response_model=FloodZonesResponse)
async def refresh_flood_zones():
    """
    Force regeneration of flood zone data
    
    Useful for testing or updating to latest data
    """
    try:
        zones = flood_service.get_flood_zones(refresh=True)
        
        return FloodZonesResponse(
            zones=zones,
            count=len(zones),
            timestamp=datetime.utcnow()
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error refreshing flood zones: {str(e)}")
