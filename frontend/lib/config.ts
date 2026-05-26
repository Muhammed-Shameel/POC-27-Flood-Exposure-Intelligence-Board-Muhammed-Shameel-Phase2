/*
Frontend configuration
*/

export const config = {
  // Application
  app_name: 'Flood Intelligence Board',
  app_version: '1.0.0',
  
  // API
  api_timeout: 10000,
  api_retry_attempts: 3,
  api_retry_delay: 1000,
  
  // Data refresh intervals
  refresh_flood_zones: 60000,      // 1 minute
  refresh_rainfall: 30000,          // 30 seconds
  refresh_alerts: 30000,            // 30 seconds
  refresh_risk_scores: 120000,      // 2 minutes
  
  // Map
  map_default_zoom: 10,
  map_animation_duration: 300,
  
  // UI
  loading_timeout: 15000,
  toast_duration: 4000,
  
  // Feature flags
  features: {
    realtime_updates: true,
    scenario_simulation: true,
    alert_notifications: true,
    data_export: true,
  },
} as const
