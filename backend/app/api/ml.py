"""
ML Prediction API Routes
Endpoints for flood risk prediction using trained ML model
"""

from fastapi import APIRouter, HTTPException, status
from typing import List
import logging
from datetime import datetime

from app.models.schemas import (
    RiskPredictionInput,
    RiskPredictionOutput,
    BatchRiskPredictionRequest,
    BatchRiskPredictionOutput,
    ModelStatusResponse,
    ModelInfoResponse
)
from app.services.ml_service import get_ml_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/ml", tags=["ML Predictions"])


@router.post("/predict-risk", response_model=RiskPredictionOutput)
async def predict_risk(features: RiskPredictionInput):
    """
    Predict flood risk for a single location
    
    **Features:**
    - rainfall: mm (0-500)
    - population_density: people/km² (0-50000)
    - elevation: meters (-50 to 5000)
    - infrastructure_density: facilities/km² (0-1000)
    - historical_flood_score: 0-100 scale
    
    **Returns:**
    - risk_score: Predicted risk (0-100)
    - risk_level: LOW / MODERATE / HIGH / CRITICAL
    - risk_color: Hex color code for visualization
    """
    try:
        ml_service = get_ml_service()
        
        features_dict = features.dict()
        result = ml_service.predict_risk(features_dict)
        
        return RiskPredictionOutput(
            status=result.get('status'),
            risk_score=result.get('risk_score'),
            risk_level=result.get('risk_level'),
            risk_color=result.get('risk_color'),
            features=features,
            error=result.get('error'),
            timestamp=datetime.utcnow()
        )
    
    except Exception as e:
        logger.error(f"Prediction error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.post("/batch-predict", response_model=BatchRiskPredictionOutput)
async def batch_predict_risk(request: BatchRiskPredictionRequest):
    """
    Predict flood risk for multiple locations
    
    Useful for:
    - Scenario simulations
    - Area-wide assessments
    - Batch processing of monitoring data
    """
    try:
        ml_service = get_ml_service()
        
        features_list = [p.dict() for p in request.predictions]
        result = ml_service.batch_predict_risk(features_list)
        
        # Convert predictions to RiskPredictionOutput objects
        prediction_outputs = []
        for pred in result.get('predictions', []):
            if 'features' in pred:
                input_features = RiskPredictionInput(**pred['features'])
                prediction_outputs.append(
                    RiskPredictionOutput(
                        status=pred.get('status'),
                        risk_score=pred.get('risk_score'),
                        risk_level=pred.get('risk_level'),
                        risk_color=pred.get('risk_color'),
                        features=input_features,
                        error=pred.get('error')
                    )
                )
        
        return BatchRiskPredictionOutput(
            status=result.get('status'),
            count=len(prediction_outputs),
            results=prediction_outputs,
            timestamp=datetime.utcnow()
        )
    
    except Exception as e:
        logger.error(f"Batch prediction error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.get("/model-status", response_model=ModelStatusResponse)
async def get_model_status():
    """
    Get ML model status and health information
    
    **Returns:**
    - loaded: Whether model is loaded in memory
    - trained: Whether model has been trained
    - status: Current operational status
    - model_info: Model architecture and features
    """
    try:
        ml_service = get_ml_service()
        status_info = ml_service.get_model_status()
        
        model_info = None
        if status_info.get('model_info'):
            model_info = ModelInfoResponse(**status_info['model_info'])
        
        return ModelStatusResponse(
            loaded=status_info.get('loaded'),
            trained=status_info.get('trained'),
            status=status_info.get('status'),
            model_info=model_info,
            timestamp=datetime.utcnow()
        )
    
    except Exception as e:
        logger.error(f"Status check error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.get("/feature-importance")
async def get_feature_importance():
    """
    Get feature importance scores from the trained model
    
    Shows which input features have the most influence on predictions
    """
    try:
        ml_service = get_ml_service()
        importance = ml_service.get_feature_importance()
        
        if not importance:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Model not trained or loaded"
            )
        
        return {
            "status": "success",
            "feature_importance": importance,
            "timestamp": datetime.utcnow()
        }
    
    except Exception as e:
        logger.error(f"Feature importance error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.get("/health")
async def ml_health_check():
    """Check ML service health status"""
    try:
        ml_service = get_ml_service()
        health = ml_service.health_check()
        return health
    
    except Exception as e:
        logger.error(f"Health check error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )
