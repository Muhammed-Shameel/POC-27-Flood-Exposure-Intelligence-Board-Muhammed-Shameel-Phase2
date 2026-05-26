/*
Flood Data Service
Manages flood zone and rainfall data fetching
*/

import { apiClient } from './apiClient'
import { 
  FloodZone, 
  RainfallData, 
  RiskScore, 
  EmergencyImpact,
  Alert 
} from '@/types'

export const floodService = {
  // Flood Zones
  getFloodZones: async (): Promise<FloodZone[]> => {
    const response = await apiClient.get<{ zones: FloodZone[]; count: number }>('/api/flood-zones')
    return response.zones
  },

  getFloodZone: async (zoneId: string): Promise<FloodZone> => {
    return apiClient.get(`/api/flood-zones/${zoneId}`)
  },

  // Rainfall
  getRainfallData: async (): Promise<RainfallData[]> => {
    const response = await apiClient.get<{ data: RainfallData[]; count: number }>('/api/rainfall')
    return response.data
  },

  getRainfallByLocation: async (lat: number, lon: number, radiusKm: number = 10): Promise<RainfallData[]> => {
    const response = await apiClient.get<{ data: RainfallData[]; count: number }>(
      `/api/rainfall/location/${lat}/${lon}`,
      { radius_km: radiusKm }
    )
    return response.data
  },

  // Risk Scores
  getRiskScores: async (): Promise<RiskScore[]> => {
    const response = await apiClient.get<{ scores: RiskScore[]; count: number }>('/api/risk-scores')
    return response.scores
  },

  getRiskDistribution: async (): Promise<Record<string, number>> => {
    const response = await apiClient.get<{ distribution: Record<string, number> }>('/api/risk-scores/distribution')
    return response.distribution
  },

  getGlobalRiskIndex: async (): Promise<{ global_risk_index: number; severity: string }> => {
    return apiClient.get('/api/risk-scores/global-index')
  },

  // Emergency Impact
  getEmergencyImpact: async (): Promise<Record<string, any>> => {
    return apiClient.get('/api/emergency-impact')
  },

  getZoneEmergencyImpact: async (zoneId: string): Promise<EmergencyImpact> => {
    return apiClient.get(`/api/emergency-impact/${zoneId}`)
  },

  // Alerts
  getAlerts: async (activeOnly: boolean = true): Promise<Alert[]> => {
    const response = await apiClient.get<{ alerts: Alert[]; active_count: number }>(
      '/api/alerts',
      { active_only: activeOnly }
    )
    return response.alerts
  },

  getZoneAlerts: async (zoneId: string): Promise<Alert[]> => {
    const response = await apiClient.get<{ alerts: Alert[]; active_count: number }>(
      `/api/alerts/zone/${zoneId}`
    )
    return response.alerts
  },

  getCriticalAlerts: async (): Promise<Alert[]> => {
    const response = await apiClient.get<{ alerts: Alert[]; critical_count: number }>(
      '/api/alerts/critical-only'
    )
    return response.alerts
  },

  // Scenario Simulation
  runScenario: async (rainfallMultiplier: number, scenarioName: string = 'Custom Scenario') => {
    return apiClient.post('/api/scenario-simulation', {
      rainfall_multiplier: rainfallMultiplier,
      scenario_name: scenarioName,
      duration_hours: 24,
    })
  },

  compareScenarios: async (multipliers: number[]) => {
    return apiClient.get('/api/scenario-simulation/compare', {
      multipliers: multipliers.join(','),
    })
  },

  runLowRainfallScenario: async () => {
    return apiClient.get('/api/scenario-simulation/preset/low')
  },

  runModerateRainfallScenario: async () => {
    return apiClient.get('/api/scenario-simulation/preset/moderate')
  },

  runExtremeRainfallScenario: async () => {
    return apiClient.get('/api/scenario-simulation/preset/extreme')
  },
}
