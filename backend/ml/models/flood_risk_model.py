"""
Flood Risk Model
Machine learning model for predicting flood risk scores
"""

import joblib
from typing import Tuple, Optional, Dict, Any
import numpy as np
import warnings
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline
import os

warnings.filterwarnings('ignore')

MODEL_PATH = os.path.join(os.path.dirname(__file__), 'gradientboosting_pipeline.pkl')
SCALER_PATH = os.path.join(os.path.dirname(__file__), 'scaler.pkl')
EXPECTED_MODEL_TYPE = 'GradientBoostingRegressor'


class FloodRiskModel:
    """
    ML Model for predicting flood risk scores
    
    Features:
    - rainfall (mm)
    - population_density (people/km²)
    - elevation (meters)
    - infrastructure_density (facilities/km²)
    - historical_flood_score (0-100)
    
    Target:
    - risk_score (0-100)
    """
    
    def __init__(self):
        self.model = None
        self.scaler = None
        self.is_trained = False
        self.model_path = None
        self.model_type = "unloaded"
        self.load_error = None
        self.feature_names = [
            'rainfall',
            'population_density',
            'elevation',
            'infrastructure_density',
            'historical_flood_score'
        ]
    
    def create_model(self) -> Pipeline:
        """
        Create ML pipeline with preprocessing and model
        
        Returns:
            sklearn Pipeline with scaler and GradientBoostingRegressor
        """
        pipeline = Pipeline([
            ('scaler', StandardScaler()),
            ('model', GradientBoostingRegressor(
                n_estimators=200,
                learning_rate=0.1,
                max_depth=5,
                subsample=0.8,
                random_state=42
            ))
        ])
        return pipeline
    
    def train(self, X_train: np.ndarray, y_train: np.ndarray) -> dict:
        """
        Train the model on data
        
        Args:
            X_train: Feature matrix
            y_train: Target values
        
        Returns:
            Training metrics dictionary
        """
        print(f"Training Flood Risk Model on {len(X_train)} samples...")
        
        self.model = self.create_model()
        self.model.fit(X_train, y_train)
        
        # Calculate R² score
        train_score = self.model.score(X_train, y_train)
        
        self.is_trained = True
        self.model_type = EXPECTED_MODEL_TYPE
        
        metrics = {
            'train_r2_score': float(train_score),
            'samples_trained': len(X_train),
            'features': self.feature_names,
            'status': 'trained'
        }
        
        return metrics
    
    def predict(self, X: np.ndarray) -> np.ndarray:
        """
        Make predictions on data
        
        Args:
            X: Feature matrix
        
        Returns:
            Predicted risk scores (0-100)
        """
        if not self.is_trained or self.model is None:
            raise ValueError("Model must be trained before making predictions")
        
        predictions = self.model.predict(X)
        # Clip to 0-100 range
        predictions = np.clip(predictions, 0, 100)
        return predictions
    
    def save(self, model_path: str = MODEL_PATH):
        """Save model to disk"""
        if self.model is None:
            raise ValueError("No model to save. Train first.")
        
        joblib.dump(self.model, model_path)
        print(f"Model saved to {model_path}")
    
    def load(self, model_path: str = MODEL_PATH) -> bool:
        """
        Load model from disk
        
        Returns:
            True if successful, False otherwise
        """
        try:
            if os.path.exists(model_path):
                loaded_model = joblib.load(model_path)
                estimator = loaded_model.named_steps.get('model') if hasattr(loaded_model, 'named_steps') else loaded_model
                model_type = estimator.__class__.__name__

                if model_type != EXPECTED_MODEL_TYPE:
                    self.load_error = (
                        f"Rejected non-production model {model_type}; "
                        f"expected {EXPECTED_MODEL_TYPE}"
                    )
                    print(self.load_error)
                    return False

                self.model = loaded_model
                self.is_trained = True
                self.model_path = model_path
                self.model_type = model_type
                self.load_error = None
                print(f"Model loaded from {model_path}")
                return True
            else:
                self.load_error = f"Model file not found: {model_path}"
                print(self.load_error)
                return False
        except Exception as e:
            self.load_error = f"{type(e).__name__}: {e}"
            print(f"Error loading model: {self.load_error}")
            return False
    
    def get_feature_importance(self) -> dict:
        """
        Get feature importance from trained model
        
        Returns:
            Dictionary mapping feature names to importance scores
        """
        if not self.is_trained or self.model is None:
            return {}
        
        importance = self.model.named_steps['model'].feature_importances_
        return {
            name: float(imp)
            for name, imp in zip(self.feature_names, importance)
        }


# Global model instance
flood_risk_model = FloodRiskModel()
