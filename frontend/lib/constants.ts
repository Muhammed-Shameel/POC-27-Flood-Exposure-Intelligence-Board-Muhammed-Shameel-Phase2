/*
Application constants
*/

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL
  || '/backend-api'

export const MAP_CENTER = {
  lat: 25,
  lng: 65,
} as const

export const MAP_BOUNDS = {
  north: 37.8149,
  south: 37.7349,
  east: -122.3894,
  west: -122.4494,
} as const

export const MAP_ZOOM_LEVELS = {
  world: 3,
  country: 4,
  region: 7,
  city: 10,
  detailed: 13,
} as const

export const RISK_COLORS = {
  LOW: {
    bg: '#DBEAFE',
    border: '#38BDF8',
    text: '#0369A1',
  },
  MODERATE: {
    bg: '#FEFCE8',
    border: '#FBBF24',
    text: '#92400E',
  },
  HIGH: {
    bg: '#FFEDD5',
    border: '#F97316',
    text: '#9A3412',
  },
  CRITICAL: {
    bg: '#FEE2E2',
    border: '#EF4444',
    text: '#991B1B',
  },
} as const

export const RAINFALL_MULTIPLIERS = [0.5, 0.7, 1.0, 1.2, 1.5, 2.0, 2.5, 3.0] as const

export const ALERT_SEVERITIES = ['warning', 'danger', 'critical'] as const

export const API_ENDPOINTS = {
  floodZones: '/api/flood-zones',
  rainfall: '/api/rainfall',
  emergencyImpact: '/api/emergency-impact',
  riskScores: '/api/risk-scores',
  globalRiskIndex: '/api/risk-scores/global-index',
  riskDistribution: '/api/risk-scores/distribution',
  alerts: '/api/alerts',
  alertsCritical: '/api/alerts/critical-only',
  scenario: '/api/scenario-simulation',
  scenarioCompare: '/api/scenario-simulation/compare',
} as const

export const CACHE_DURATION = {
  SHORT: 30 * 1000,      // 30 seconds
  MEDIUM: 5 * 60 * 1000, // 5 minutes
  LONG: 30 * 60 * 1000,  // 30 minutes
} as const

export const CHART_COLORS = {
  cyan: '#38BDF8',
  indigo: '#818CF8',
  red: '#EF4444',
  yellow: '#FBBF24',
  orange: '#F97316',
} as const
