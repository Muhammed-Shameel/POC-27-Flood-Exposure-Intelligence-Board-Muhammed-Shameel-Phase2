/*
Frontend Type Definitions
*/

export type RiskLevel = 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL'

export interface GeoCoordinates {
  latitude: number
  longitude: number
}

export interface GeoJSON {
  type: 'Point' | 'Polygon' | 'LineString'
  coordinates: number[] | number[][] | number[][][]
}

export interface FloodZone {
  id: string
  geometry: GeoJSON
  severity: RiskLevel
  flood_depth_meters: number
  affected_area_sqkm: number
  created_at: string
}

export interface RainfallData {
  location: GeoCoordinates
  intensity_mm: number
  accumulated_mm: number
  timestamp: string
  forecast_horizon_hours: number
}

export interface PopulationExposure {
  total_population: number
  affected_population: number
  high_risk_population: number
  evacuation_difficulty_index: number
}

export interface InfrastructureExposure {
  hospitals_affected: number
  schools_affected: number
  power_stations_affected: number
  roads_inaccessible_km: number
  bridges_affected: number
}

export interface EmergencyImpact {
  zone_id: string
  timestamp: string
  population_exposure: PopulationExposure
  infrastructure_exposure: InfrastructureExposure
  estimated_evacuees: number
  critical_facilities_at_risk: number
}

export interface RiskScore {
  zone_id: string
  overall_score: number
  flood_severity_score: number
  population_exposure_score: number
  infrastructure_exposure_score: number
  risk_level: RiskLevel
  timestamp: string
}

export interface Alert {
  id: string
  zone_id: string
  alert_type: 'warning' | 'danger' | 'critical'
  title: string
  message: string
  risk_level: RiskLevel
  affected_population: number
  timestamp: string
  active: boolean
}

export interface ScenarioSimulationRequest {
  rainfall_multiplier: number
  scenario_name: string
  duration_hours: number
}

export interface ScenarioSimulationResult {
  scenario_id: string
  scenario_name: string
  rainfall_multiplier: number
  projected_flood_zones: FloodZone[]
  affected_population_total: number
  critical_alerts_count: number
  timestamp: string
}

export interface DashboardState {
  floodZones: FloodZone[]
  rainfallData: RainfallData[]
  impacts: EmergencyImpact[]
  riskScores: RiskScore[]
  alerts: Alert[]
  globalRiskIndex: number
  riskDistribution: {
    LOW: number
    MODERATE: number
    HIGH: number
    CRITICAL: number
  }
  selectedZone: FloodZone | null
  rainfallMultiplier: number
  loading: boolean
  error: string | null
}
