"""
Risk Scores API Endpoint
"""

from fastapi import APIRouter, HTTPException, Query
from datetime import datetime
from typing import List
from app.models.schemas import RiskScoresCollectionResponse
from app.services.flood_service import flood_service, risk_engine

router = APIRouter()


@router.get("", response_model=RiskScoresCollectionResponse)
async def get_risk_scores():
    """
    Get composite risk scores for all flood zones
    
    Returns risk calculations: flood severity (40%), population exposure (30%), 
    infrastructure exposure (30%)
    """
    try:
        zones = flood_service.get_flood_zones()
        zone_ids = [z["id"] for z in zones]
        scores = risk_engine.calculate_risk_scores(zone_ids)
        
        return RiskScoresCollectionResponse(
            scores=scores,
            count=len(scores),
            timestamp=datetime.utcnow()
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error calculating risk scores: {str(e)}")


@router.get("/distribution", response_model=dict)
async def get_risk_distribution():
    """
    Get distribution of zones by risk level
    
    Returns count of LOW, MODERATE, HIGH, CRITICAL zones
    """
    try:
        zones = flood_service.get_flood_zones()
        zone_ids = [z["id"] for z in zones]
        scores = risk_engine.calculate_risk_scores(zone_ids)
        distribution = risk_engine.get_risk_distribution(scores)
        
        return {
            "distribution": distribution,
            "timestamp": datetime.utcnow()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error calculating risk distribution: {str(e)}")


@router.get("/global-index", response_model=dict)
async def get_global_risk_index():
    """
    Get weighted global risk index (0-100)
    
    Higher values indicate greater overall flood risk across the region
    """
    try:
        zones = flood_service.get_flood_zones()
        zone_ids = [z["id"] for z in zones]
        scores = risk_engine.calculate_risk_scores(zone_ids)
        index = risk_engine.get_global_risk_index(scores)
        
        # Determine severity label
        if index >= 80:
            severity = "CRITICAL"
        elif index >= 60:
            severity = "HIGH"
        elif index >= 40:
            severity = "MODERATE"
        else:
            severity = "LOW"
        
        return {
            "global_risk_index": index,
            "severity": severity,
            "zones_analyzed": len(zones),
            "timestamp": datetime.utcnow()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error calculating global risk index: {str(e)}")
