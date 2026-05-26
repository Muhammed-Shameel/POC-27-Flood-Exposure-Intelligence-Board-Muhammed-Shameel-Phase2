"""
Model Training Script
Train flood risk prediction model
"""

import pandas as pd
import numpy as np
from pathlib import Path
import sys
import os
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score

# Add parent directory to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../..'))

from backend.ml.models.flood_risk_model import FloodRiskModel
import json


def load_training_data(csv_path: str) -> tuple:
    """
    Load training data from CSV
    
    Args:
        csv_path: Path to CSV file
    
    Returns:
        Tuple of (X, y)
    """
    df = pd.read_csv(csv_path)
    
    # Features and target
    feature_cols = [
        'rainfall',
        'population_density',
        'elevation',
        'infrastructure_density',
        'historical_flood_score'
    ]
    
    X = df[feature_cols].values
    y = df['risk_score'].values
    
    return X, y


def train_model(csv_path: str, test_size: float = 0.2):
    """
    Train the flood risk model
    
    Args:
        csv_path: Path to training data CSV
        test_size: Fraction for test set
    
    Returns:
        Dictionary with training results
    """
    
    # Load data
    print(f"Loading training data from {csv_path}...")
    X, y = load_training_data(csv_path)
    
    # Split data
    X_train, X_test, y_train, y_test = train_test_split(
        X, y,
        test_size=test_size,
        random_state=42
    )
    
    print(f"Training set size: {len(X_train)}")
    print(f"Test set size: {len(X_test)}")
    
    # Create and train model
    model = FloodRiskModel()
    train_metrics = model.train(X_train, y_train)
    
    # Evaluate on test set
    y_pred = model.predict(X_test)
    
    mse = mean_squared_error(y_test, y_pred)
    rmse = np.sqrt(mse)
    mae = mean_absolute_error(y_test, y_pred)
    r2 = r2_score(y_test, y_pred)
    
    test_metrics = {
        'mse': float(mse),
        'rmse': float(rmse),
        'mae': float(mae),
        'r2_score': float(r2),
        'test_samples': len(X_test)
    }
    
    # Save model
    model.save()
    
    # Compile results
    results = {
        'training': train_metrics,
        'testing': test_metrics,
        'feature_importance': model.get_feature_importance(),
        'status': 'success'
    }
    
    print("\n" + "="*50)
    print("TRAINING RESULTS")
    print("="*50)
    print(f"Train R² Score: {train_metrics['train_r2_score']:.4f}")
    print(f"Test R² Score: {test_metrics['r2_score']:.4f}")
    print(f"Test RMSE: {test_metrics['rmse']:.4f}")
    print(f"Test MAE: {test_metrics['mae']:.4f}")
    print("\nFeature Importance:")
    for feat, imp in results['feature_importance'].items():
        print(f"  {feat}: {imp:.4f}")
    print("="*50 + "\n")
    
    return results


if __name__ == "__main__":
    # Default training data path
    current_dir = os.path.dirname(os.path.abspath(__file__))
    default_csv = os.path.join(
        current_dir, 
        '..', 'datasets', 'sample_training_data.csv'
    )
    
    csv_path = sys.argv[1] if len(sys.argv) > 1 else default_csv
    
    if not os.path.exists(csv_path):
        print(f"Error: Training data file not found: {csv_path}")
        sys.exit(1)
    
    results = train_model(csv_path)
    print("\nTraining completed successfully!")
    
    
if __name__ == "__main__":
    # Default training data path
    current_dir = os.path.dirname(os.path.abspath(__file__))
    default_csv = os.path.join(
        current_dir, 
        '..', 'datasets', 'sample_training_data.csv'
    )
    
    csv_path = sys.argv[1] if len(sys.argv) > 1 else default_csv
    
    if not os.path.exists(csv_path):
        print(f"Error: Training data file not found: {csv_path}")
        sys.exit(1)
    
    results = train_model(csv_path)
    print("\nTraining completed successfully!")