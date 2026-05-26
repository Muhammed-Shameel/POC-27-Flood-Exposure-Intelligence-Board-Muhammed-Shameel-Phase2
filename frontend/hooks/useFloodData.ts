/*
Custom Hooks
React hooks for data fetching and state management
*/

'use client'

import { useState, useEffect, useCallback } from 'react'
import { floodService } from '@/services/floodService'
import { FloodZone, RiskScore, RainfallData, Alert, EmergencyImpact } from '@/types'
import { config } from '@/lib/config'

export function useFloodZones() {
  const [zones, setZones] = useState<FloodZone[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchZones = async () => {
      try {
        setLoading(true)
        const data = await floodService.getFloodZones()
        setZones(data)
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch flood zones')
        console.error('Error fetching flood zones:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchZones()
    const interval = setInterval(fetchZones, config.refresh_flood_zones)
    return () => clearInterval(interval)
  }, [])

  return { zones, loading, error }
}

export function useRainfallData() {
  const [rainfall, setRainfall] = useState<RainfallData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchRainfall = async () => {
      try {
        setLoading(true)
        const data = await floodService.getRainfallData()
        setRainfall(data)
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch rainfall data')
        console.error('Error fetching rainfall data:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchRainfall()
    const interval = setInterval(fetchRainfall, config.refresh_rainfall)
    return () => clearInterval(interval)
  }, [])

  return { rainfall, loading, error }
}

export function useRiskScores() {
  const [scores, setScores] = useState<RiskScore[]>([])
  const [distribution, setDistribution] = useState<Record<string, number> | null>(null)
  const [globalIndex, setGlobalIndex] = useState<number>(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        const [scoresData, distData, indexData] = await Promise.all([
          floodService.getRiskScores(),
          floodService.getRiskDistribution(),
          floodService.getGlobalRiskIndex(),
        ])
        setScores(scoresData)
        setDistribution(distData)
        setGlobalIndex(indexData.global_risk_index)
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch risk data')
        console.error('Error fetching risk data:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
    const interval = setInterval(fetchData, config.refresh_risk_scores)
    return () => clearInterval(interval)
  }, [])

  return { scores, distribution, globalIndex, loading, error }
}

export function useAlerts() {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [criticalAlerts, setCriticalAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        setLoading(true)
        const [allAlerts, critical] = await Promise.all([
          floodService.getAlerts(),
          floodService.getCriticalAlerts(),
        ])
        setAlerts(allAlerts)
        setCriticalAlerts(critical)
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch alerts')
        console.error('Error fetching alerts:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchAlerts()
    const interval = setInterval(fetchAlerts, config.refresh_alerts)
    return () => clearInterval(interval)
  }, [])

  return { alerts, criticalAlerts, loading, error }
}

export function useEmergencyImpact() {
  const [impact, setImpact] = useState<Record<string, any> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchImpact = async () => {
      try {
        setLoading(true)
        const data = await floodService.getEmergencyImpact()
        setImpact(data)
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch emergency impact')
        console.error('Error fetching impact data:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchImpact()
    const interval = setInterval(fetchImpact, config.refresh_risk_scores)
    return () => clearInterval(interval)
  }, [])

  return { impact, loading, error }
}

export function useScenarioSimulation() {
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const runScenario = useCallback(async (multiplier: number) => {
    try {
      setLoading(true)
      setError(null)
      const data = await floodService.runScenario(multiplier)
      setResult(data)
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Scenario simulation failed'
      setError(errorMsg)
      console.error('Error running scenario:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  return { result, loading, error, runScenario }
}
