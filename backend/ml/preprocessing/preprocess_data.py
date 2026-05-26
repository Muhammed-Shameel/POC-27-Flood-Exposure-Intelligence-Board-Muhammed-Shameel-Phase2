"""
Data preprocessing module for flood risk prediction
Handles data validation, normalization, and feature engineering
"""

import numpy as np
import pandas as pd
from typing import Tuple, Dict, Any, List
from sklearn.preprocessing import StandardScaler
import warnings

warnings.filterwarnings('ignore')


class DataPreprocessor:
    """
    Preprocesses data for flood risk model prediction
    
    Handles:
    - Feature validation
    - Missing value imputation
    - Feature scaling
    - Range normalization
    """
    
    FEATURE_NAMES = [
        'rainfall',
        'population_density',
        'elevation',
        'infrastructure_density',
        'historical_flood_score'
    ]
    
    # Expected feature ranges (for validation)
    FEATURE_RANGES = {
        'rainfall': (0, 500),  # mm
        'population_density': (0, 50000),  # people/km²
        'elevation': (-50, 5000),  # meters
        'infrastructure_density': (0, 1000),  # facilities/km²
        'historical_flood_score': (0, 100)  # 0-100 scale
    }
    
    # Default values for missing data
    FEATURE_DEFAULTS = {
        'rainfall': 50.0,
        'population_density': 2000.0,
        'elevation': 100.0,
        'infrastructure_density': 50.0,
        'historical_flood_score': 40.0
    }
    
    def __init__(self):
        self.scaler = StandardScaler()
        self.is_fitted = False
    
    def validate_features(self, data: Dict[str, float]) -> Tuple[bool, List[str]]:
        """
        Validate input features
        
        Args:
            data: Dictionary of feature values
        
        Returns:
            Tuple of (is_valid, error_messages)
        """
        errors = []
        
        for feature in self.FEATURE_NAMES:
            if feature not in data:
                errors.append(f"Missing feature: {feature}")
                continue
            
            value = data[feature]
            min_val, max_val = self.FEATURE_RANGES[feature]
            
            if value < min_val or value > max_val:
                errors.append(
                    f"{feature} out of range: {value} (expected {min_val}-{max_val})"
                )
        
        return len(errors) == 0, errors
    
    @staticmethod
    def validate_ranges(data: dict) -> Tuple[bool, str]:
        """
        Validate that all required features are present
        
        Args:
            data: Dictionary with feature values
        
        Returns:
            Tuple of (is_valid, error_message)
        """
        required_features = [
            'rainfall',
            'population_density',
            'elevation',
            'infrastructure_density',
            'historical_flood_score'
        ]
        
        missing = [f for f in required_features if f not in data]
        
        if missing:
            return False, f"Missing features: {', '.join(missing)}"
        
        # Validate ranges
        if data.get('rainfall', 0) < 0:
            return False, "Rainfall cannot be negative"
        
        if data.get('population_density', 0) < 0:
            return False, "Population density cannot be negative"
        
        if not (0 <= data.get('historical_flood_score', 0) <= 100):
            return False, "Historical flood score must be 0-100"
        
        if data.get('infrastructure_density', 0) < 0:
            return False, "Infrastructure density cannot be negative"
        
        return True, "Valid"
    
    def preprocess_single(self, data: Dict[str, float]) -> np.ndarray:
        """
        Preprocess a single prediction input
        
        Args:
            data: Dictionary with feature values
        
        Returns:
            Preprocessed feature array (1D)
        """
        # Validate
        is_valid, errors = self.validate_features(data)
        if not is_valid:
            print(f"Validation warnings: {errors}")
        
        # Extract features in order
        features = []
        for feature in self.FEATURE_NAMES:
            value = data.get(feature, self.FEATURE_DEFAULTS[feature])
            
            # Handle out-of-range values (clip them)
            min_val, max_val = self.FEATURE_RANGES[feature]
            value = np.clip(value, min_val, max_val)
            
            features.append(value)
        
        return np.array(features).reshape(1, -1)
    
    def preprocess_batch(self, df: pd.DataFrame) -> np.ndarray:
        """
        Preprocess a batch of data
        
        Args:
            df: DataFrame with features
        
        Returns:
            Preprocessed feature matrix
        """
        # Select only required features
        features_data = df[self.FEATURE_NAMES].copy()
        
        # Fill missing values with defaults
        for feature in self.FEATURE_NAMES:
            if feature in features_data.columns:
                features_data[feature] = features_data[feature].fillna(
                    self.FEATURE_DEFAULTS[feature]
                )
        
        # Clip values to valid ranges
        for feature in self.FEATURE_NAMES:
            if feature in features_data.columns:
                min_val, max_val = self.FEATURE_RANGES[feature]
                features_data[feature] = features_data[feature].clip(
                    min_val, max_val
                )
        
        return features_data.values
    
    def fit(self, X: np.ndarray):
        """Fit scaler on training data"""
        self.scaler.fit(X)
        self.is_fitted = True
    
    def transform(self, X: np.ndarray) -> np.ndarray:
        """Transform data using fitted scaler"""
        if not self.is_fitted:
            raise ValueError("Preprocessor not fitted. Call fit() first.")
        return self.scaler.transform(X)
    
    def fit_transform(self, X: np.ndarray) -> np.ndarray:
        """Fit and transform data"""
        self.fit(X)
        return self.transform(X)


def load_and_preprocess_csv(csv_path: str) -> Tuple[np.ndarray, np.ndarray]:
    """
    Load and preprocess data from CSV
    
    Args:
        csv_path: Path to CSV file
    
    Returns:
        Tuple of (X, y)
    """
    df = pd.read_csv(csv_path)
    
    preprocessor = DataPreprocessor()
    X = preprocessor.preprocess_batch(df)
    y = df['risk_score'].values
    
    return X, y
    
    @staticmethod
    def normalize_features(data: dict) -> np.ndarray:
        """
        Convert dictionary to feature array in correct order
        
        Args:
            data: Dictionary with feature values
        
        Returns:
            NumPy array of features
        """
        feature_order = [
            'rainfall',
            'population_density',
            'elevation',
            'infrastructure_density',
            'historical_flood_score'
        ]
        
        return np.array([[data[feature] for feature in feature_order]])
    
    @staticmethod
    def preprocess_batch(data_list: list) -> np.ndarray:
        """
        Preprocess a batch of data
        
        Args:
            data_list: List of feature dictionaries
        
        Returns:
            NumPy array of shape (n_samples, n_features)
        """
        features = []
        feature_order = [
            'rainfall',
            'population_density',
            'elevation',
            'infrastructure_density',
            'historical_flood_score'
        ]
        
        for data in data_list:
            features.append([data[feature] for feature in feature_order])
        
        return np.array(features)
    
    @staticmethod
    def engineer_features(raw_data: dict) -> dict:
        """
        Create additional engineered features from raw features
        
        Args:
            raw_data: Raw feature dictionary
        
        Returns:
            Enhanced feature dictionary
        """
        features = raw_data.copy()
        
        # Rainfall intensity ratio
        rainfall = raw_data.get('rainfall', 0)
        features['rainfall_intensity_ratio'] = min(rainfall / 100, 1.0) if rainfall > 0 else 0
        
        # Population exposure index
        pop_density = raw_data.get('population_density', 0)
        features['population_exposure_index'] = min(pop_density / 5000, 1.0) if pop_density > 0 else 0
        
        # Infrastructure vulnerability
        infra_density = raw_data.get('infrastructure_density', 0)
        features['infrastructure_vulnerability'] = min(infra_density / 100, 1.0) if infra_density > 0 else 0
        
        # Elevation risk (lower elevation = higher risk)
        elevation = raw_data.get('elevation', 0)
        features['elevation_risk'] = max(1.0 - (elevation / 1000), 0.0)
        
        return features


# Create global preprocessor instance
data_preprocessor = DataPreprocessor()
