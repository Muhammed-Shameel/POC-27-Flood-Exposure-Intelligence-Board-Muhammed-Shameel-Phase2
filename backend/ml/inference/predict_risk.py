"""
Inference Module
Load model and make predictions on new data
"""

import numpy as np
from typing import Dict, List
import os
import sys

# Add parent directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../..'))

from backend.ml.models.flood_risk_model import FloodRiskModel
from backend.ml.preprocessing.preprocess_data import DataPreprocessor


class RiskPredictor:
    """Make risk predictions using trained model"""
    
    def __init__(self, model_path: str = None):
        """
        Initialize predictor with model
        
        Args:
            model_path: Optional path to model file
        """
        self.model = FloodRiskModel()
        self.preprocessor = DataPreprocessor()
        self.load_attempts = []
        
        if model_path:
            candidate_paths = [model_path]
        else:
            models_dir = os.path.join(os.path.dirname(__file__), '..', 'models')
            candidate_paths = [
                os.path.join(models_dir, 'gradientboosting_pipeline.pkl'),
            ]

        for candidate_path in candidate_paths:
            loaded = self.model.load(candidate_path)
            self.load_attempts.append({
                'path': os.path.basename(candidate_path),
                'loaded': loaded,
                'error': self.model.load_error,
            })
            if loaded:
                break
    
    @staticmethod
    def get_risk_level(score: float) -> str:
        """
        Classify risk score into risk level
        
        Args:
            score: Risk score (0-100)
        
        Returns:
            Risk level classification
        """
        if score < 25:
            return 'LOW'
        elif score < 50:
            return 'MODERATE'
        elif score < 75:
            return 'HIGH'
        else:
            return 'CRITICAL'
    
    @staticmethod
    def get_risk_color(risk_level: str) -> str:
        """Get color code for risk level"""
        colors = {
            'LOW': '#22C55E',  # Green
            'MODERATE': '#F59E0B',  # Amber
            'HIGH': '#EF4444',  # Red
            'CRITICAL': '#7C3AED'  # Violet
        }
        return colors.get(risk_level, '#6B7280')
    
    def predict_single(self, features: Dict) -> Dict:
        """
        Predict risk for a single data point
        
        Args:
            features: Dictionary with feature values
        
        Returns:
            Dictionary with prediction and confidence
        """
        try:
            # Validate features
            is_valid, errors = self.preprocessor.validate_features(features)
            if not is_valid:
                return {
                    'status': 'error',
                    'error': '; '.join(errors),
                    'risk_score': None,
                    'risk_level': None
                }
            
            # Preprocess features
            X = self.preprocessor.preprocess_single(features)
            
            # Make prediction
            if not self.model.is_trained:
                return {
                    'status': 'error',
                    'error': 'Model not trained. Please train model first.',
                    'risk_score': None,
                    'risk_level': None
                }
            
            prediction = float(self.model.predict(X)[0])
            if prediction <= 1:
                prediction = prediction * 100
            risk_level = self.get_risk_level(prediction)
            
            return {
                'status': 'success',
                'risk_score': float(np.round(prediction, 2)),
                'risk_level': risk_level,
                'risk_color': self.get_risk_color(risk_level),
                'features': features
            }
        
        except Exception as e:
            return {
                'status': 'error',
                'error': str(e),
                'risk_score': None,
                'risk_level': None
            }
    
    def predict_batch(self, features_list: List[Dict]) -> Dict:
        """
        Predict risk for multiple data points
        
        Args:
            features_list: List of feature dictionaries
        
        Returns:
            Dictionary with predictions for each point
        """
        predictions = []
        
        for features in features_list:
            pred = self.predict_single(features)
            predictions.append(pred)
        
        return {
            'status': 'success',
            'predictions': predictions,
            'count': len(predictions)
        }
    
    def get_model_info(self) -> Dict:
        """Get model metadata"""
        return {
            'is_trained': self.model.is_trained,
            'features': self.model.feature_names,
            'feature_importance': self.model.get_feature_importance(),
            'model_type': self.model.model_type,
            'loaded': self.model.is_trained,
            'trained': self.model.is_trained,
            'status': 'ready' if self.model.is_trained else 'not_ready',
            'model_path': os.path.basename(self.model.model_path) if self.model.model_path else None,
            'load_attempts': self.load_attempts,
            'version': '1.0.0'
        }


# Global predictor instance
_predictor = None


def get_predictor() -> RiskPredictor:
    """Get or create global predictor instance"""
    global _predictor
    if _predictor is None:
        _predictor = RiskPredictor()
    return _predictor
