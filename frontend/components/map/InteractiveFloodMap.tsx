'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { MapContainer, TileLayer, CircleMarker, Tooltip } from 'react-leaflet'
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
