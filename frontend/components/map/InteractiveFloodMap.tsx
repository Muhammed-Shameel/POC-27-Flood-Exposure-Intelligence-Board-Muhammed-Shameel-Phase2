'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { MapContainer, TileLayer, CircleMarker, Polygon, Polyline, Tooltip } from 'react-leaflet'
import L from 'leaflet'
import { MAP_CENTER, MAP_ZOOM_LEVELS } from '@/lib/constants'
import type { MapPoint } from '@/lib/mappers/normalizeMapPoint'
import { formatDisplayNumber, formatMetric } from '@/lib/utils'

interface InteractiveFloodMapProps {
  zones: MapPoint[]
  selectedZone: MapPoint | null
  onZoneSelect: (zone: MapPoint) => void
  rainfall: Array<{
    location: { latitude: number; longitude: number }
    intensity_mm: number
  }>
  rainfallMultiplier: number
  loading: boolean
  onMapReady?: (flyTo: (lat: number, lng: number) => void) => void
  dataMode?: 'live' | 'historical'
}

type AssetOverlayKey = 'hospitals' | 'schools' | 'roads' | 'power' | 'critical'

const ASSET_OVERLAYS: Array<{ key: AssetOverlayKey; label: string; color: string }> = [
  { key: 'hospitals', label: 'Hospitals', color: '#f87171' },
  { key: 'schools', label: 'Schools', color: '#f59e0b' },
  { key: 'roads', label: 'Roads', color: '#94a3b8' },
  { key: 'power', label: 'Power', color: '#a78bfa' },
  { key: 'critical', label: 'Critical', color: '#22d3ee' },
]

function severityMeta(score: number) {
  if (score >= 85) return { label: 'Extreme', color: '#a855f7', opacity: 0.38 }
  if (score >= 70) return { label: 'Severe', color: '#ef4444', opacity: 0.34 }
  if (score >= 50) return { label: 'High', color: '#f97316', opacity: 0.30 }
  if (score >= 25) return { label: 'Moderate', color: '#f59e0b', opacity: 0.24 }
  return { label: 'Low', color: '#22c55e', opacity: 0.18 }
}

function floodExtentForZone(zone: MapPoint): [number, number][] {
  const lat = zone.location.latitude
  const lng = zone.location.longitude
  const score = zone.intensity ?? 0
  const rainfall = zone.rainfall_mm ?? 0
  const radius = 0.18 + Math.min(0.82, score / 145) + Math.min(0.28, rainfall / 650)
  return [
    [lat + radius * 0.72, lng - radius * 1.05],
    [lat + radius * 0.88, lng + radius * 0.40],
    [lat + radius * 0.16, lng + radius * 1.15],
    [lat - radius * 0.74, lng + radius * 0.84],
    [lat - radius * 0.86, lng - radius * 0.24],
    [lat - radius * 0.18, lng - radius * 1.16],
  ]
}

function assetPointsForZone(zone: MapPoint, key: AssetOverlayKey) {
  const exposed = assetExposureForZone(zone, key)
  const count = key === 'roads'
    ? Math.min(5, Math.max(0, Math.ceil(exposed / 12)))
    : Math.min(4, Math.max(0, Math.ceil(exposed)))
  const offsets: Record<AssetOverlayKey, Array<[number, number]>> = {
    hospitals: [[0.15, -0.18], [-0.18, 0.20], [0.24, 0.16], [-0.26, -0.12]],
    schools: [[0.22, 0.08], [-0.14, -0.25], [0.05, 0.28], [-0.30, 0.04]],
    roads: [[-0.34, -0.30], [-0.18, -0.10], [0.05, 0.04], [0.25, 0.18], [0.42, 0.28]],
    power: [[-0.24, 0.26], [0.30, -0.20], [0.08, -0.34]],
    critical: [[0.0, 0.0], [0.26, 0.30], [-0.32, -0.26]],
  }
  return offsets[key].slice(0, Math.min(count, offsets[key].length)).map(([latOffset, lngOffset], index) => ({
    id: `${zone.id}-${key}-${index}`,
    lat: zone.location.latitude + latOffset,
    lng: zone.location.longitude + lngOffset,
    exposed,
  }))
}

function mapFeature(zone: MapPoint, name: string, fallback = 50) {
  const value = zone.ml_features?.[name]
  return Number.isFinite(Number(value)) ? Number(value) : fallback
}

function assetExposureForZone(zone: MapPoint, key: AssetOverlayKey) {
  const inventory = zone.infrastructure
  const total = key === 'hospitals'
    ? Number(inventory?.hospitals ?? 0)
    : key === 'schools'
    ? Number(inventory?.schools ?? 0)
    : key === 'roads'
    ? Number(inventory?.road_km ?? 0)
    : key === 'power'
    ? Number(inventory?.power_assets ?? 0)
    : Number(inventory?.critical_facilities ?? 0)

  if (!Number.isFinite(total) || total <= 0) return 0

  const risk = zone.intensity ?? 0
  const vulnerability = Number(zone.baseline_vulnerability_score ?? mapFeature(zone, 'PopulationScore'))
  const rainfall = zone.rainfall_mm ?? 0
  const exposedPopulation = Number(zone.exposed_population ?? 0)
  const populationPressure = exposedPopulation > 0 ? Math.min(18, Math.log10(exposedPopulation) * 3) : 8
  const exposureRate = Math.min(
    0.92,
    Math.max(
      0,
      risk * 0.0052 + vulnerability * 0.002 + Math.min(rainfall, 220) * 0.001 + populationPressure * 0.006,
    ),
  )

  return key === 'roads'
    ? Math.round(total * exposureRate * 10) / 10
    : Math.round(total * exposureRate)
}

export default function InteractiveFloodMap({
  zones,
  selectedZone,
  onZoneSelect,
  rainfall,
  rainfallMultiplier,
  loading,
  onMapReady,
  dataMode = 'live',
}: InteractiveFloodMapProps) {
  const [map, setMap] = useState<L.Map | null>(null)
  const [inundationVisible, setInundationVisible] = useState(true)
  const [isInfraExpanded, setIsInfraExpanded] = useState(false)
  const [isSeverityExpanded, setIsSeverityExpanded] = useState(false)
  const [assetVisibility, setAssetVisibility] = useState<Record<AssetOverlayKey, boolean>>({
    hospitals: false,
    schools: false,
    roads: false,
    power: false,
    critical: false,
  })

  const visibleAssets = useMemo(
    () => ASSET_OVERLAYS.filter(asset => assetVisibility[asset.key]),
    [assetVisibility]
  )

  const flyTo = useCallback((lat: number, lng: number) => {
    map?.flyTo([lat, lng], MAP_ZOOM_LEVELS.region, {
      animate: true,
      duration: 1.2,
    })
  }, [map])

  useEffect(() => {
    if (map && onMapReady) onMapReady(flyTo)
  }, [flyTo, map, onMapReady])

  const getPointColor = (score: number) => {
    if (score > 70) return '#ef4444'
    if (score > 45) return '#f59e0b'
    return '#22c55e'
  }

  // ---------------- LOADING ----------------
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-gradient-to-b from-[#030712] via-[#0B1117] to-[#030712]">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-t-[#38BDF8] border-r-[#38BDF8] rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[#38BDF8] text-sm">
            Loading flood intelligence data...
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative h-full w-full overflow-hidden rounded-lg border border-[#1F2937]">

      <MapContainer
        center={[MAP_CENTER.lat, MAP_CENTER.lng]}
        zoom={MAP_ZOOM_LEVELS.world}
        className="h-full w-full"
        ref={setMap}
      >
        {/* BASE MAP */}
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />

        {inundationVisible && zones?.map((zone) => {
          const score = zone.intensity ?? 0
          if (score < 12) return null
          const meta = severityMeta(score)
          return (
            <Polygon
              key={`inundation-${zone.id}-${zone.city}`}
              positions={floodExtentForZone(zone)}
              interactive={false}
              pathOptions={{
                fillColor: meta.color,
                color: meta.color,
                weight: 1,
                opacity: 0.38,
                fillOpacity: dataMode === 'historical' ? meta.opacity * 0.72 : meta.opacity,
              }}
            />
          )
        })}

        {visibleAssets.flatMap(asset => zones.map(zone => {
          const exposed = assetExposureForZone(zone, asset.key)
          if (exposed <= 0) return null

          if (asset.key === 'roads') {
            const points = assetPointsForZone(zone, asset.key)
            if (points.length < 2) return null
            return (
              <Polyline
                key={`asset-road-${zone.id}`}
                positions={points.map(point => [point.lat, point.lng])}
                interactive
                pathOptions={{
                  color: asset.color,
                  weight: Math.max(2, Math.min(5, (zone.intensity ?? 0) / 22)),
                  opacity: 0.62,
                  dashArray: '6 6',
                }}
              >
                <Tooltip sticky>
                  {zone.city} roads affected: {formatMetric(exposed, 'km', 1)}
                </Tooltip>
              </Polyline>
            )
          }

          return assetPointsForZone(zone, asset.key).map(point => (
            <CircleMarker
              key={point.id}
              center={[point.lat, point.lng]}
              radius={4.5}
              interactive
              pathOptions={{
                fillColor: asset.color,
                color: '#e5fff7',
                weight: 1,
                opacity: 0.72,
                fillOpacity: 0.72,
              }}
            >
              <Tooltip sticky>
                {zone.city} {asset.label.toLowerCase()} affected: {formatDisplayNumber(point.exposed, asset.key === 'roads' ? 1 : 0)}
              </Tooltip>
            </CircleMarker>
          ))
        }))}

        {/* ---------------- FLOOD INTELLIGENCE POINTS ---------------- */}
        {zones?.map((zone) => {
          const isSelected = selectedZone?.city === zone.city
          const score = zone.intensity ?? 0
          const color = getPointColor(score)
          const lat = zone.location?.latitude
          const lng = zone.location?.longitude

          if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null

          return (
            <CircleMarker
              key={`zone-${zone.id}-${zone.city}`}
              center={[lat, lng]}
              radius={isSelected ? 12 : 7 + Math.min(7, score / 18)}
              eventHandlers={{
                click: () => onZoneSelect(zone),
              }}
              pathOptions={{
                fillColor: color,
                color: isSelected ? '#e5fff7' : color,
                weight: isSelected ? 3 : 2,
                opacity: isSelected ? 1 : 0.82,
                fillOpacity: dataMode === 'historical' ? 0.5 : 0.68,
              }}
            >
              <Tooltip sticky>
                <div>
                  <strong>{zone.city}</strong>
                  <br />
                  Risk: {formatDisplayNumber(score)}
                  <br />
                  Rainfall: {formatMetric(zone.rainfall_mm, 'mm')}
                </div>
              </Tooltip>
            </CircleMarker>
          )
        })}

        {/* ---------------- RAINFALL POINTS ---------------- */}
        {(rainfall ?? []).map((point, idx) => {
          // SAFE COORDINATE HANDLING
          const lat =
            point?.location?.latitude ??
            (point as any)?.latitude ??
            (point as any)?.lat

          const lng =
            point?.location?.longitude ??
            (point as any)?.longitude ??
            (point as any)?.lng

          // ❗ skip invalid points
          if (lat == null || lng == null) return null

          return (
            <CircleMarker
              key={`rain-${idx}`}
              center={[lat, lng]}
              radius={4 + ((point.intensity_mm ?? 0) / 50) * 3}
              interactive={false}
              pathOptions={{
                fillColor: '#38BDF8',
                color: '#38BDF8',
                weight: 2,
                opacity: 0.8,
                fillOpacity: 0.5,
              }}
            >
              <Tooltip sticky>
                Rainfall: {formatMetric(point.intensity_mm, 'mm')} x{' '}
                {formatDisplayNumber(rainfallMultiplier)}
              </Tooltip>
            </CircleMarker>
          )
        })}
      </MapContainer>

      <div className={`pointer-events-auto absolute left-4 top-4 z-[500] rounded-lg border border-emerald-500/30 bg-[#020b16]/95 p-3 shadow-[0_0_32px_rgba(16,185,129,0.15)] backdrop-blur-sm transition-all duration-300 ${isInfraExpanded ? 'w-64' : 'w-14 h-12 flex items-center justify-center p-0 overflow-hidden'}`}>
        {!isInfraExpanded ? (
          <button 
            onClick={() => setIsInfraExpanded(true)}
            className="w-full h-full flex flex-col items-center justify-center text-emerald-300 hover:bg-emerald-500/10 transition-colors"
            title="Expand Infrastructure Layers"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 2 7 12 12 22 7 12 2" />
              <polyline points="2 17 12 22 22 17" />
              <polyline points="2 12 12 17 22 12" />
            </svg>
            <span className="text-[8px] font-bold mt-0.5 tracking-tighter">INFRA</span>
          </button>
        ) : (
          <>
            {/* Header */}
            <div className="mb-4 border-b border-emerald-500/20 pb-2 flex items-center justify-between">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-emerald-300">Infrastructure Intelligence</h3>
              <button 
                onClick={() => setIsInfraExpanded(false)}
                className="text-gray-500 hover:text-emerald-300 p-1"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Flood Toggle */}
            <div className="mb-3 flex items-center justify-between rounded bg-emerald-500/5 px-3 py-2 border border-emerald-500/15">
              <span className="flex items-center gap-2">
                <div className="h-2.5 w-2.5 rounded-full bg-cyan-400/80"></div>
                <span className="text-xs font-semibold text-gray-200">Flood Zones</span>
              </span>
              <button
                type="button"
                onClick={() => setInundationVisible(value => !value)}
                className={`relative h-5 w-9 rounded-full transition-all ${
                  inundationVisible
                    ? 'bg-cyan-500/30'
                    : 'bg-gray-700/30'
                }`}
              >
                <div className={`absolute top-0.5 h-4 w-4 rounded-full bg-cyan-400 transition-transform ${
                  inundationVisible ? 'translate-x-4' : 'translate-x-0.5'
                }`} />
              </button>
            </div>

            {/* Asset Toggles */}
            <div className="space-y-2">
              {ASSET_OVERLAYS.map(asset => (
                <button
                  key={asset.key}
                  type="button"
                  onClick={() => setAssetVisibility(current => ({ ...current, [asset.key]: !current[asset.key] }))}
                  className={`group w-full flex items-center justify-between rounded px-3 py-2 transition-all ${
                    assetVisibility[asset.key] 
                      ? 'bg-gradient-to-r from-emerald-500/20 to-emerald-500/5 border border-emerald-500/30' 
                      : 'border border-transparent hover:bg-white/5 hover:border-emerald-500/15'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <div className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: asset.color, opacity: assetVisibility[asset.key] ? 1 : 0.5 }} />
                    <span className={`text-xs font-medium ${assetVisibility[asset.key] ? 'text-gray-100' : 'text-gray-400 group-hover:text-gray-300'}`}>
                      {asset.label}
                    </span>
                  </span>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                    assetVisibility[asset.key]
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : 'text-gray-600'
                  }`}>
                    {assetVisibility[asset.key] ? 'ON' : 'OFF'}
                  </span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      <div className={`pointer-events-auto absolute bottom-5 left-4 z-[500] rounded-lg border border-emerald-500/30 bg-[#020b16]/95 p-4 shadow-[0_0_32px_rgba(16,185,129,0.15)] backdrop-blur-sm transition-all duration-300 ${isSeverityExpanded ? 'w-72' : 'w-14 h-12 flex items-center justify-center p-0 overflow-hidden'}`}>
        {!isSeverityExpanded ? (
          <button 
            onClick={() => setIsSeverityExpanded(true)}
            className="w-full h-full flex flex-col items-center justify-center text-emerald-300 hover:bg-emerald-500/10 transition-colors"
            title="Expand Severity Legend"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20v-6M6 20V10M18 20V4" />
            </svg>
            <span className="text-[8px] font-bold mt-0.5 tracking-tighter">DIST</span>
          </button>
        ) : (
          <>
            {/* Header */}
            <div className="mb-3 border-b border-emerald-500/20 pb-2 flex items-center justify-between">
              <div>
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-emerald-300">Severity Distribution</h3>
              </div>
              <button 
                onClick={() => setIsSeverityExpanded(false)}
                className="text-gray-500 hover:text-emerald-300 p-1"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Severity Level Bars */}
            <div className="space-y-2.5">
              {[
                { name: 'Extreme', minScore: 85, color: '#a855f7' },
                { name: 'Severe', minScore: 70, color: '#ef4444' },
                { name: 'High', minScore: 50, color: '#f97316' },
                { name: 'Moderate', minScore: 25, color: '#f59e0b' },
                { name: 'Low', minScore: 0, color: '#22c55e' },
              ].map(level => {
                const count = zones.filter(z => {
                  const score = z.intensity ?? 0
                  return level.minScore === 85 
                    ? score >= 85
                    : level.minScore === 70
                    ? score >= 70 && score < 85
                    : level.minScore === 50
                    ? score >= 50 && score < 70
                    : level.minScore === 25
                    ? score >= 25 && score < 50
                    : score >= 0 && score < 25
                }).length
                const percentage = zones.length > 0 ? Math.round((count / zones.length) * 100) : 0

                return (
                  <div key={level.name} className="flex items-center gap-3">
                    {/* Label & Metrics */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-semibold text-gray-200">{level.name}</span>
                        <span className="text-[10px] text-gray-400">{count} zones</span>
                      </div>
                      {/* Progress Bar */}
                      <div className="h-1.5 rounded-full bg-gray-700/40 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${percentage}%`,
                            backgroundColor: level.color,
                            opacity: percentage > 0 ? 0.75 : 0.2,
                          }}
                        />
                      </div>
                    </div>
                    {/* Percentage */}
                    <span className="text-[10px] font-semibold text-gray-400 w-8 text-right">{percentage}%</span>
                  </div>
                )
              })}
            </div>

            {/* Footer Stats */}
            <div className="mt-3 pt-3 border-t border-emerald-500/15 flex items-center justify-between text-[10px] text-gray-500">
              <span>Total Zones: {zones.length}</span>
              <span>
                Avg: <span className="text-emerald-300 font-semibold">
                  {zones.length > 0 
                    ? Math.round((zones.reduce((sum, z) => sum + (z.intensity ?? 0), 0) / zones.length) * 10) / 10
                    : '--'}
                </span>
              </span>
            </div>
          </>
        )}
      </div>

      {/* ---------------- STYLES ---------------- */}
      <style>{`
        .leaflet-container {
          background: #030712;
        }

        .leaflet-control-zoom {
          border: 1px solid #1F2937;
          background: rgba(11,17,23,0.8);
        }

        .leaflet-control-attribution {
          background: rgba(3,7,18,0.7);
          color: #818CF8;
        }
      `}</style>
    </div>
  )
}
