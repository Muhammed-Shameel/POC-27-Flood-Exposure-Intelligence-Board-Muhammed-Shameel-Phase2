"""
ML Training Pipeline
Orchestrate data loading, preprocessing, training, and evaluation
"""

import pandas as pd
import numpy as np
from pathlib import Path
import sys
import os
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score
import json
from datetime import datetime
import warnings

warnings.filterwarnings('ignore')

# Add parent directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../..'))

from backend.ml.models.flood_risk_model import FloodRiskModel
from backend.ml.preprocessing.preprocess_data import DataPreprocessor


class TrainingPipeline:
    """Complete ML training pipeline"""
    
    def __init__(self, csv_path: str):
        self.csv_path = csv_path
        self.model = FloodRiskModel()
        self.preprocessor = DataPreprocessor()
        self.X_train = None
        self.X_test = None
        self.y_train = None
        self.y_test = None
        self.results = {}
    
    def load_data(self) -> bool:
        """Load training data from CSV"""
        try:
            print(f"Loading data from {self.csv_path}...")
            df = pd.read_csv(self.csv_path)
            
            feature_cols = [
                'rainfall',
                'population_density',
                'elevation',
                'infrastructure_density',
                'historical_flood_score'
            ]
            
            X = df[feature_cols].values
            y = df['risk_score'].values
            
            print(f"Loaded {len(df)} samples with {len(feature_cols)} features")
            
            self.X_train, self.X_test, self.y_train, self.y_test = train_test_split(
                X, y, test_size=0.2, random_state=42
            )
            
            return True
        
        except Exception as e:
            print(f"Error loading data: {e}")
            return False
    
    def train(self) -> bool:
        """Train the model"""
        try:
            if self.X_train is None:
                print("Error: Load data first")
                return False
            
            print(f"\nTraining model on {len(self.X_train)} samples...")
            self.model.train(self.X_train, self.y_train)
            
            return True
        
        except Exception as e:
            print(f"Error training model: {e}")
            return False
    
    def evaluate(self) -> dict:
        """Evaluate model performance"""
        try:
            if self.X_test is None:
                print("Error: Load data first")
                return {}
            
            print("\nEvaluating model...")
            
            # Test predictions
            y_pred = self.model.predict(self.X_test)
            
            # Calculate metrics
            mse = mean_squared_error(self.y_test, y_pred)
            rmse = np.sqrt(mse)
            mae = mean_absolute_error(self.y_test, y_pred)
            r2 = r2_score(self.y_test, y_pred)
            
            # Cross-validation
            cv_scores = cross_val_score(
                self.model.model,
                self.X_train, self.y_train,
                cv=5,
                scoring='r2'
            )
            
            self.results = {
                'mse': float(mse),
                'rmse': float(rmse),
                'mae': float(mae),
                'r2_score': float(r2),
                'cv_mean': float(cv_scores.mean()),
                'cv_std': float(cv_scores.std()),
                'cv_scores': [float(s) for s in cv_scores],
                'test_samples': len(self.X_test)
            }
            
            return self.results
        
        except Exception as e:
            print(f"Error evaluating model: {e}")
            return {}
    
    def save_model(self, model_path: str = None):
        """Save trained model"""
        try:
            self.model.save(model_path)
            print(f"Model saved successfully")
            return True
        except Exception as e:
            print(f"Error saving model: {e}")
            return False
    
    def run(self) -> dict:
        """Run complete training pipeline"""
        print("="*60)
        print("FLOOD RISK PREDICTION - TRAINING PIPELINE")
        print("="*60)
        
        # Step 1: Load
        if not self.load_data():
            return {'status': 'failed', 'error': 'Data loading failed'}
        
        # Step 2: Train
        if not self.train():
            return {'status': 'failed', 'error': 'Training failed'}
        
        # Step 3: Evaluate
        eval_results = self.evaluate()
        if not eval_results:
            return {'status': 'failed', 'error': 'Evaluation failed'}
        
        # Step 4: Save
        self.save_model()
        
        # Summary
        print("\n" + "="*60)
        print("TRAINING COMPLETE")
        print("="*60)
        print(f"R² Score (Train):     {self.model.model.score(self.X_train, self.y_train):.4f}")
        print(f"R² Score (Test):      {eval_results['r2_score']:.4f}")
        print(f"RMSE (Test):          {eval_results['rmse']:.4f}")
        print(f"MAE (Test):           {eval_results['mae']:.4f}")
        print(f"Cross-Val Mean (R²):  {eval_results['cv_mean']:.4f}")
        print(f"Cross-Val Std (R²):   {eval_results['cv_std']:.4f}")
        print("\nFeature Importance:")
        for feat, imp in self.model.get_feature_importance().items():
            print(f"  {feat:.<30} {imp:.4f}")
        print("="*60 + "\n")
        
        return {
            'status': 'success',
            'results': eval_results,
            'timestamp': datetime.now().isoformat()
        }


def run_training_pipeline(csv_path: str = None) -> dict:
    """
    Convenience function to run training pipeline
    
    Args:
        csv_path: Path to training CSV file
    
    Returns:
        Pipeline results dictionary
    """
    if csv_path is None:
        # Use default path
        current_dir = os.path.dirname(os.path.abspath(__file__))
        csv_path = os.path.join(
            current_dir,
            '..',
            'datasets',
            'sample_training_data.csv'
        )
    
    if not os.path.exists(csv_path):
        print(f"Error: CSV file not found: {csv_path}")
        return {'status': 'failed', 'error': f'File not found: {csv_path}'}
    
    pipeline = TrainingPipeline(csv_path)
    return pipeline.run()


if __name__ == "__main__":
    csv_path = sys.argv[1] if len(sys.argv) > 1 else None
    results = run_training_pipeline(csv_path)
    print(json.dumps(results, indent=2))
    print(f"Error loading data: {e}")
    
    def run(self, test_size: float = 0.2, cv_folds: int = 5) -> dict:
        """
        Run complete training pipeline
        
        Args:
            test_size: Fraction for test set
            cv_folds: Number of cross-validation folds
        
        Returns:
            Dictionary with complete results
        """
        # Load data
        try:
            df = pd.read_csv(self.csv_path)
        except Exception as e:
            print(f"Error loading data: {e}")
            return {'error': str(e), 'status': 'failed'}
        
        feature_cols = [
            'rainfall',
            'population_density',
            'elevation',
            'infrastructure_density',
            'historical_flood_score'
        ]
        
        X = df[feature_cols].values
        y = df['risk_score'].values
        
        print(f"\n{'='*60}")
        print("FLOOD RISK PREDICTION MODEL TRAINING PIPELINE")
        print(f"{'='*60}\n")
        
        # Split data
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=test_size, random_state=42
        )
        
        print(f"Train samples: {len(X_train)}")
        print(f"Test samples:  {len(X_test)}")
        
        # Train model
        print("\nTraining model...")
        train_metrics = self.model.train(X_train, y_train)
        
        # Cross-validation
        print(f"\nRunning {cv_folds}-fold cross-validation...")
        cv_scores = cross_val_score(
            self.model.model,
            X,
            y,
            cv=cv_folds,
            scoring='r2'
        )
        
        # Test evaluation
        y_pred = self.model.predict(X_test)
        
        metrics = {
            'train_r2': float(train_metrics['train_r2_score']),
            'test_r2': float(r2_score(y_test, y_pred)),
            'test_rmse': float(np.sqrt(mean_squared_error(y_test, y_pred))),
            'test_mae': float(mean_absolute_error(y_test, y_pred)),
            'cv_mean': float(cv_scores.mean()),
            'cv_std': float(cv_scores.std()),
            'cv_scores': [float(s) for s in cv_scores],
            'feature_importance': self.model.get_feature_importance(),
            'timestamp': datetime.utcnow().isoformat(),
            'status': 'success'
        }
        
        # Save model
        self.model.save()
        
        # Print results
        print(f"\n{'='*60}")
        print("TRAINING RESULTS")
        print(f"{'='*60}")
        print(f"Train R²:           {metrics['train_r2']:.4f}")
        print(f"Test R²:            {metrics['test_r2']:.4f}")
        print(f"Test RMSE:          {metrics['test_rmse']:.4f}")
        print(f"Test MAE:           {metrics['test_mae']:.4f}")
        print(f"CV Mean R²:         {metrics['cv_mean']:.4f} ± {metrics['cv_std']:.4f}")
        print("\nFeature Importance:")
        for feature, importance in metrics['feature_importance'].items():
            print(f"  {feature:.<30} {importance:.4f}")
        print(f"{'='*60}\n")
        
        self.results = metrics
        return metrics


def run_pipeline(csv_path: str) -> dict:
    """
    Convenience function to run the full pipeline
    
    Args:
        csv_path: Path to training data
    
    Returns:
        Dictionary with results
    """
    pipeline = TrainingPipeline(csv_path)
    return pipeline.run()


if __name__ == '__main__':
    # Run pipeline with sample data
    csv_path = Path(__file__).parent.parent / 'datasets' / 'sample_training_data.csv'
    
    if csv_path.exists():
        results = run_pipeline(str(csv_path))
    else:
        print(f"Dataset not found: {csv_path}")
