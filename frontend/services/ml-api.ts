/**
 * ML Prediction Service
 * Frontend integration with ML prediction API endpoints
 */

import { apiClient } from './apiClient'

export interface RiskFeatures {
  rainfall: number
  population_density: number
  elevation: number
  infrastructure_density: number
  historical_flood_score: number
}

export interface RiskPredictionResult {
  status: string
  risk_score: number | null
  risk_level: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL' | null
  risk_color: string | null
  features: RiskFeatures
  error?: string
  timestamp: string
}

export interface BatchPredictionRequest {
  predictions: RiskFeatures[]
  scenario_name?: string
}

export interface BatchPredictionResult {
  status: string
  count: number
  results: RiskPredictionResult[]
  timestamp: string
}

export interface ModelStatus {
  loaded: boolean
  trained: boolean
  status: string
  model_info?: {
    model_type: string
    features: string[]
    feature_importance?: Record<string, number>
  }
  timestamp: string
}

/**
 * Predict risk for a single location
 */
export async function predictRisk(
  features: RiskFeatures
): Promise<RiskPredictionResult> {
  try {
    return apiClient.post('/api/ml/predict-risk', features)
  } catch (error) {
    console.error('ML prediction error:', error)
    throw error
  }
}

/**
 * Predict risk for multiple locations
 */
export async function batchPredictRisk(
  request: BatchPredictionRequest
): Promise<BatchPredictionResult> {
  try {
    return apiClient.post('/api/ml/batch-predict', request)
  } catch (error) {
    console.error('Batch prediction error:', error)
    throw error
  }
}

/**
 * Get ML model status
 */
export async function getModelStatus(): Promise<ModelStatus> {
  try {
    return apiClient.get('/api/ml/model-status')
  } catch (error) {
    console.error('Model status error:', error)
    throw error
  }
}

/**
 * Get feature importance
 */
export async function getFeatureImportance(): Promise<Record<string, number>> {
  try {
    const response = await apiClient.get<{ feature_importance: Record<string, number> }>('/api/ml/feature-importance')
    return response.feature_importance
  } catch (error) {
    console.error('Feature importance error:', error)
    throw error
  }
}

/**
 * Check ML service health
 */
export async function checkMLHealth(): Promise<any> {
  try {
    return apiClient.get('/api/ml/health')
  } catch (error) {
    console.error('ML health check error:', error)
    throw error
  }
}

/**
 * Determine risk badge color and label
 */
export function getRiskBadgeInfo(
  riskLevel: string | null
): { color: string; label: string; bgColor: string } {
  const colors: Record<
    string,
    { color: string; label: string; bgColor: string }
  > = {
    LOW: {
      color: '#22C55E',
      label: 'Low Risk',
      bgColor: 'bg-green-500',
    },
    MODERATE: {
      color: '#F59E0B',
      label: 'Moderate Risk',
      bgColor: 'bg-amber-500',
    },
    HIGH: {
      color: '#EF4444',
      label: 'High Risk',
      bgColor: 'bg-red-500',
    },
    CRITICAL: {
      color: '#7C3AED',
      label: 'Critical Risk',
      bgColor: 'bg-violet-500',
    },
  }

  return colors[riskLevel || ''] || colors.LOW
}
