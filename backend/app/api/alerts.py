"""
Alerts API Endpoint
"""

from fastapi import APIRouter, HTTPException, Query
from datetime import datetime
from app.models.schemas import AlertsCollectionResponse
from app.services.flood_service import flood_service, risk_engine, alert_service

router = APIRouter()


@router.get("", response_model=AlertsCollectionResponse)
async def get_alerts(
    active_only: bool = Query(True, description="Show only active alerts"),
    severity: str = Query(None, description="Filter by severity: warning, danger, critical")
):
    """
    Get emergency alerts
    
    Returns active alerts based on current flood risk conditions
    """
    try:
        zones = flood_service.get_flood_zones()
        zone_ids = [z["id"] for z in zones]
        scores = risk_engine.calculate_risk_scores(zone_ids)
        
        alerts = alert_service.generate_alerts(zone_ids, scores)
        
        if active_only:
            alerts = alert_service.get_active_alerts(alerts)
        
        if severity:
            alerts = [a for a in alerts if a["alert_type"] == severity]
        
        critical_count = len(alert_service.get_critical_alerts(alerts))
        
        return AlertsCollectionResponse(
            alerts=alerts,
            active_count=len(alerts),
            critical_count=critical_count,
            timestamp=datetime.utcnow()
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving alerts: {str(e)}")


@router.get("/zone/{zone_id}", response_model=AlertsCollectionResponse)
async def get_zone_alerts(zone_id: str):
    """
    Get alerts for a specific flood zone
    """
    try:
        zone = flood_service.get_flood_zone_by_id(zone_id)
        
        if not zone:
            raise HTTPException(status_code=404, detail=f"Flood zone {zone_id} not found")
        
        zones = flood_service.get_flood_zones()
        zone_ids = [z["id"] for z in zones]
        scores = risk_engine.calculate_risk_scores(zone_ids)
        
        all_alerts = alert_service.generate_alerts(zone_ids, scores)
        zone_alerts = alert_service.get_alerts_by_zone(zone_id, all_alerts)
        
        critical_count = len([a for a in zone_alerts if a["alert_type"] == "critical"])
        
        return AlertsCollectionResponse(
            alerts=zone_alerts,
            active_count=len(zone_alerts),
            critical_count=critical_count,
            timestamp=datetime.utcnow()
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving zone alerts: {str(e)}")


@router.get("/critical-only", response_model=AlertsCollectionResponse)
async def get_critical_alerts():
    """
    Get only critical-level alerts
    """
    try:
        zones = flood_service.get_flood_zones()
        zone_ids = [z["id"] for z in zones]
        scores = risk_engine.calculate_risk_scores(zone_ids)
        
        all_alerts = alert_service.generate_alerts(zone_ids, scores)
        critical = alert_service.get_critical_alerts(all_alerts)
        
        return AlertsCollectionResponse(
            alerts=critical,
            active_count=len(critical),
            critical_count=len(critical),
            timestamp=datetime.utcnow()
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving critical alerts: {str(e)}")
