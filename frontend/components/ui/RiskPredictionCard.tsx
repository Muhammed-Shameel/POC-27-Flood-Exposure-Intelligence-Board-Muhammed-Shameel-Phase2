'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { RiskFeatures, predictRisk, RiskPredictionResult, getRiskBadgeInfo } from '@/services/ml-api'
import { formatDisplayNumber } from '@/lib/utils'

interface RiskPredictionCardProps {
  initialFeatures?: RiskFeatures
  autoRefresh?: boolean
  refreshInterval?: number
}

export default function RiskPredictionCard({
  initialFeatures,
  autoRefresh = false,
  refreshInterval = 60000,
}: RiskPredictionCardProps) {
  const [prediction, setPrediction] = useState<RiskPredictionResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [features, setFeatures] = useState<RiskFeatures>(
    initialFeatures || {
      rainfall: 50,
      population_density: 2500,
      elevation: 150,
      infrastructure_density: 50,
      historical_flood_score: 40,
    }
  )

  const fetchPrediction = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await predictRisk(features)
      setPrediction(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Prediction failed')
      console.error('Prediction error:', err)
    } finally {
      setLoading(false)
    }
  }, [features])

  useEffect(() => {
    fetchPrediction()
  }, [fetchPrediction])

  useEffect(() => {
    if (!autoRefresh) return

    const interval = setInterval(fetchPrediction, refreshInterval)
    return () => clearInterval(interval)
  }, [autoRefresh, refreshInterval, fetchPrediction])

  const handleFeatureChange = (key: keyof RiskFeatures, value: number) => {
    setFeatures((prev) => ({
      ...prev,
      [key]: value,
    }))
  }

  const riskBadgeInfo = prediction?.risk_level ? getRiskBadgeInfo(prediction.risk_level) : null

  return (
    <div className="glow-box p-6 bg-card-bg">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-accent-cyan mb-2">AI Risk Prediction</h3>
        <p className="text-sm text-gray-400">Machine Learning based flood risk assessment</p>
      </div>

      {/* Prediction Result */}
      {prediction && prediction.status === 'success' && (
        <div className="mb-6 p-4 border border-accent-indigo/30 rounded-lg bg-card-bg/50">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-gray-400">Predicted Risk Score</span>
            {riskBadgeInfo && (
              <span
                className="px-3 py-1 rounded-full text-white text-sm font-medium"
                style={{ backgroundColor: riskBadgeInfo.color }}
              >
                {riskBadgeInfo.label}
              </span>
            )}
          </div>
          <div className="text-4xl font-bold text-accent-cyan mb-2">
            {prediction.risk_score !== null ? formatDisplayNumber(prediction.risk_score, 1) : 'N/A'}
            <span className="text-lg text-gray-500 ml-2">/100</span>
          </div>
          <div className="w-full bg-card-bg rounded-full h-2 mb-4">
            <div
              className="h-2 rounded-full transition-all duration-300"
              style={{
                width: `${(prediction.risk_score || 0) / 100 * 100}%`,
                backgroundColor: riskBadgeInfo?.color || '#38BDF8',
              }}
            />
          </div>
        </div>
      )}

      {/* Input Features */}
      <div className="space-y-4 mb-6">
        <h4 className="text-sm font-semibold text-gray-400">Input Features</h4>

        <div>
          <label className="block text-sm text-gray-400 mb-2">
            Rainfall (mm): {formatDisplayNumber(features.rainfall, 1)}
          </label>
          <input
            type="range"
            min="0"
            max="500"
            step="5"
            value={features.rainfall}
            onChange={(e) => handleFeatureChange('rainfall', parseFloat(e.target.value))}
            className="w-full h-2 bg-card-bg rounded-lg appearance-none cursor-pointer accent-cyan-500"
          />
        </div>

        <div>
          <label className="text-sm text-gray-400 mb-2 block">
            Population Density (people/km²): {formatDisplayNumber(features.population_density, 0)}
          </label>
          <input
            type="range"
            min="0"
            max="50000"
            step="100"
            value={features.population_density}
            onChange={(e) => handleFeatureChange('population_density', parseFloat(e.target.value))}
            className="w-full h-2 bg-card-bg rounded-lg appearance-none cursor-pointer accent-cyan-500"
          />
        </div>

        <div>
          <label className="text-sm text-gray-400 mb-2 block">
            Elevation (m): {formatDisplayNumber(features.elevation, 0)}
          </label>
          <input
            type="range"
            min="-50"
            max="5000"
            step="10"
            value={features.elevation}
            onChange={(e) => handleFeatureChange('elevation', parseFloat(e.target.value))}
            className="w-full h-2 bg-card-bg rounded-lg appearance-none cursor-pointer accent-cyan-500"
          />
        </div>

        <div>
          <label className="text-sm text-gray-400 mb-2 block">
            Infrastructure Density (facilities/km²): {formatDisplayNumber(features.infrastructure_density, 0)}
          </label>
          <input
            type="range"
            min="0"
            max="1000"
            step="10"
            value={features.infrastructure_density}
            onChange={(e) => handleFeatureChange('infrastructure_density', parseFloat(e.target.value))}
            className="w-full h-2 bg-card-bg rounded-lg appearance-none cursor-pointer accent-cyan-500"
          />
        </div>

        <div>
          <label className="text-sm text-gray-400 mb-2 block">
            Historical Flood Score (0-100): {formatDisplayNumber(features.historical_flood_score, 0)}
          </label>
          <input
            type="range"
            min="0"
            max="100"
            step="1"
            value={features.historical_flood_score}
            onChange={(e) => handleFeatureChange('historical_flood_score', parseFloat(e.target.value))}
            className="w-full h-2 bg-card-bg rounded-lg appearance-none cursor-pointer accent-cyan-500"
          />
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="p-4 mb-4 bg-red-500/10 border border-red-500/30 rounded-lg">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Predict Button */}
      <button
        onClick={fetchPrediction}
        disabled={loading}
        className="button-primary w-full disabled:opacity-50"
      >
        {loading ? 'Predicting...' : 'Get Prediction'}
      </button>

      {/* Loading State */}
      {loading && (
        <div className="mt-4 flex items-center justify-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-accent-cyan"></div>
          <span className="ml-2 text-sm text-gray-400">Analyzing features...</span>
        </div>
      )}
    </div>
  )
}
