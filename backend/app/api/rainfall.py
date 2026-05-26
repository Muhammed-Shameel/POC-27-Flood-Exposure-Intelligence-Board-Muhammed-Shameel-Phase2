"""
Rainfall Data API Endpoint
"""

from fastapi import APIRouter, HTTPException, Query
from datetime import datetime
from app.models.schemas import RainfallDataCollectionResponse
from app.services.flood_service import rainfall_service

router = APIRouter()


@router.get("", response_model=RainfallDataCollectionResponse)
async def get_rainfall_data():
    """
    Get current rainfall measurements and forecasts
    
    Returns rainfall intensity and accumulated data from multiple locations
    """
    try:
        data = rainfall_service.get_rainfall_data()
        
        return RainfallDataCollectionResponse(
            data=data,
            count=len(data),
            timestamp=datetime.utcnow()
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving rainfall data: {str(e)}")


@router.get("/location/{latitude}/{longitude}", response_model=RainfallDataCollectionResponse)
async def get_rainfall_by_location(
    latitude: float,
    longitude: float,
    radius_km: float = Query(10, ge=1, le=100, description="Search radius in kilometers")
):
    """
    Get rainfall data near a specific location
    
    Returns rainfall measurements within specified radius of coordinates
    """
    try:
        data = rainfall_service.get_rainfall_by_location(latitude, longitude, radius_km)
        
        return RainfallDataCollectionResponse(
            data=data,
            count=len(data),
            timestamp=datetime.utcnow()
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving rainfall data: {str(e)}")
