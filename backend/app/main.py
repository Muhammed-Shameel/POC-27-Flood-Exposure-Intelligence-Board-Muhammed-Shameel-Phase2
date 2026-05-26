"""
Flood Intelligence Board - FastAPI Backend
Enterprise-grade geospatial intelligence platform
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import logging
from datetime import datetime

# Import API routers
from app.api import flood_zones, rainfall, emergency_impact, risk_scores, alerts, scenario_simulation, ml, live

# Import ML service
from app.services.ml_service import init_ml_service

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize FastAPI application
app = FastAPI(
    title="Flood Intelligence Board API",
    description="Enterprise-grade flood exposure intelligence platform",
    version="1.0.0"
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Startup event - Initialize ML service
@app.on_event("startup")
async def startup_event():
    """Initialize services on startup"""
    logger.info("Initializing services...")
    await init_ml_service()
    logger.info("ML service initialized")

# Health Check Endpoint
@app.get("/health")
async def health_check():
    """System health status"""
    return {
        "status": "operational",
        "timestamp": datetime.utcnow().isoformat(),
        "service": "Flood Intelligence Board API",
        "version": "1.0.0"
    }

# API Root
@app.get("/api")
async def api_root():
    """API documentation and available endpoints"""
    return {
        "message": "Flood Intelligence Board API",
        "endpoints": {
            "flood_zones": "/api/flood-zones",
            "rainfall": "/api/rainfall",
            "emergency_impact": "/api/emergency-impact",
            "risk_scores": "/api/risk-scores",
            "alerts": "/api/alerts",
            "scenario_simulation": "/api/scenario-simulation",
            "ml_predictions": "/api/ml/predict-risk"
        }
    }

# Include API Routers
app.include_router(flood_zones.router, prefix="/api/flood-zones", tags=["flood_zones"])
app.include_router(rainfall.router, prefix="/api/rainfall", tags=["rainfall"])
app.include_router(emergency_impact.router, prefix="/api/emergency-impact", tags=["emergency_impact"])
app.include_router(risk_scores.router, prefix="/api/risk-scores", tags=["risk_scores"])
app.include_router(alerts.router, prefix="/api/alerts", tags=["alerts"])
app.include_router(scenario_simulation.router, prefix="/api/scenario-simulation", tags=["scenario_simulation"])
app.include_router(ml.router, tags=["ml"])
app.include_router(live.router, tags=["live"])
app.include_router(live.historical_router, tags=["historical"])

# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    """Global exception handler for unhandled errors"""
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal server error",
            "detail": str(exc)
        }
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )

