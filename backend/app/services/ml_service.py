"""
ML Service Layer
High-level interface for ML operations
Handles model management, predictions, and training
"""

import os
import sys
from typing import Dict, List, Optional
import json
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

# Add parent directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../..'))

from backend.ml.inference.predict_risk import RiskPredictor, get_predictor
from backend.ml.pipelines.training_pipeline import TrainingPipeline


class MLService:
    """
    Unified interface for ML operations
    Manages model lifecycle and predictions
    """
    
    def __init__(self):
        """Initialize ML service"""
        self.predictor = None
        self.model_loaded = False
        self._load_model()
    
    def _load_model(self):
        """Load model on service initialization"""
        try:
            self.predictor = get_predictor()
            self.model_loaded = self.predictor.model.is_trained
            if self.model_loaded:
                logger.info("ML model loaded successfully")
            else:
                logger.warning("ML model not found. Train model first.")
        except Exception as e:
            logger.error(f"Error initializing ML service: {e}")
            self.model_loaded = False
    
    def predict_risk(self, features: Dict) -> Dict:
        """
        Make risk prediction for single location
        
        Args:
            features: Dictionary with required features
                - rainfall (mm): 0-500
                - population_density (people/km²): 0-50000
                - elevation (meters): -50 to 5000
                - infrastructure_density (facilities/km²): 0-1000
                - historical_flood_score (0-100): 0-100
        
        Returns:
            Prediction result with risk score and level
        """
        if not self.model_loaded:
            return {
                'status': 'error',
                'error': 'Model not loaded. Please train model first.',
                'risk_score': None,
                'risk_level': None
            }
        
        return self.predictor.predict_single(features)
    
    def batch_predict_risk(self, features_list: List[Dict]) -> Dict:
        """
        Make predictions for multiple locations
        
        Args:
            features_list: List of feature dictionaries
        
        Returns:
            Batch prediction results
        """
        if not self.model_loaded:
            return {
                'status': 'error',
                'error': 'Model not loaded',
                'predictions': []
            }
        
        return self.predictor.predict_batch(features_list)
    
    def get_model_status(self) -> Dict:
        """Get model status and information"""
        if self.predictor is None:
            return {
                'loaded': False,
                'trained': False,
                'status': 'not_initialized'
            }
        
        return {
            'loaded': self.model_loaded,
            'trained': self.predictor.model.is_trained,
            'model_info': self.predictor.get_model_info(),
            'status': 'ready' if self.model_loaded else 'not_ready'
        }
    
    def get_feature_importance(self) -> Dict:
        """Get feature importance from model"""
        if not self.model_loaded:
            return {}
        
        return self.predictor.model.get_feature_importance()
    
    def train_model(self, csv_path: str) -> Dict:
        """
        Train ML model on provided data
        
        Args:
            csv_path: Path to training CSV file
        
        Returns:
            Training results
        """
        if not os.path.exists(csv_path):
            return {
                'status': 'error',
                'error': f'Training file not found: {csv_path}'
            }
        
        try:
            pipeline = TrainingPipeline(csv_path)
            results = pipeline.run()
            
            # Reload model after training
            self._load_model()
            
            return results
        
        except Exception as e:
            logger.error(f"Training error: {e}")
            return {
                'status': 'error',
                'error': str(e)
            }
    
    def health_check(self) -> Dict:
        """ML service health status"""
        return {
            'service': 'ml',
            'status': 'operational',
            'model_loaded': self.model_loaded,
            'timestamp': datetime.utcnow().isoformat()
        }


# Global service instance
_ml_service = None


def get_ml_service() -> MLService:
    """
    Get or create global ML service instance
    
    Returns:
        MLService instance
    """
    global _ml_service
    if _ml_service is None:
        _ml_service = MLService()
    return _ml_service


async def init_ml_service():
    """Initialize ML service (for async startup)"""
    get_ml_service()
