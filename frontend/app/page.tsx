'use client'

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { motion, AnimatePresence } from 'framer-motion'
import { apiClient } from '@/services/apiClient'
import {
  normalizeRegions,
  normalizeRegionToMapPoint,
  type MapPoint,
  type RawRegionPoint,
} from '@/lib/mappers/normalizeMapPoint'
import { formatDisplayNumber, formatMetric } from '@/lib/utils'

// ── SSR-safe map import ────────────────────────────────────────────────────────
const InteractiveFloodMap = dynamic(
  () => import('@/components/map/InteractiveFloodMap'),
  { ssr: false, loading: () => <MapSkeleton /> }
)

// ── Types ─────────────────────────────────────────────────────────────────────
type RegionData = RawRegionPoint & {
  risk_status?: string
  mode?: 'LIVE' | 'HISTORICAL'
  model_type?: string
  inference_status?: string
  humidity_percent?: number
  water_level_index?: number
  current_weather?: Record<string, any>
  baseline_vulnerability_score?: number
  risk_category?: string
  region_notes?: string
  notable_flood_events?: string[]
  ml_features?: Record<string, number>
  infrastructure?: InfrastructureInventory
  infrastructure_source?: Record<string, any>
  infrastructure_intelligence?: Record<string, number>
  exposed_population?: number
  continent?: string
  state?: string
  geojson?: Record<string, any>
}

type RightPanelTab = 'ai' | 'alerts' | 'zones' | 'reports' | 'timeline' | 'response' | 'project'
type DataMode = 'live' | 'historical'

const ALL_CITIES = 'all'
const ALL_CITIES_LABEL = 'All Cities'
const GLOBAL_MONITORING_LABEL = 'Global Monitoring'
const LIVE_CACHE_KEY = 'flood-command-center:live-intelligence:latest'
const PRODUCTION_MODEL_TYPE = 'GradientBoostingRegressor'

const RIGHT_PANEL_TABS: { id: RightPanelTab; label: string }[] = [
  { id: 'ai',       label: 'AI'       },
  { id: 'alerts',   label: 'Alerts'   },
  { id: 'zones',    label: 'Zones'    },
  { id: 'project',  label: 'Project'  },
  { id: 'response', label: 'Response' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'reports',  label: 'Reports'  },
]

let regionCacheByMode: Partial<Record<DataMode, RegionData[]>> = {}

function getLocalStorage(): Storage | null {
  if (typeof window === 'undefined') return null
  try { return window.localStorage ?? null } catch { return null }
}

function isValidRegionSnapshot(data: unknown, requireProductionModel = false): data is RegionData[] {
  if (!Array.isArray(data) || data.length === 0) return false
  return data.every(item => {
    if (!item || typeof item !== 'object') return false
    const region = item as RegionData
    const hasIdentity    = typeof region.city === 'string' && region.city.length > 0
    const hasCoordinates = typeof region.latitude === 'number' || typeof region.lat === 'number'
    const hasRisk        = Number.isFinite(Number(region.risk_score))
    const modelType      = String(region.model_type ?? '')
    return hasIdentity && hasCoordinates && hasRisk
      && (!requireProductionModel || modelType === PRODUCTION_MODEL_TYPE)
  })
}

function readLatestLiveCache(): RegionData[] | null {
  const storage = getLocalStorage()
  if (!storage) return null
  try {
    const cached = storage.getItem(LIVE_CACHE_KEY)
    if (!cached) return null
    const parsed = JSON.parse(cached)
    const data = parsed?.data
    return isValidRegionSnapshot(data, true) ? data : null
  } catch (err) {
    console.warn('[CommandCenter] Ignoring invalid live cache:', err)
    return null
  }
}

function writeLatestLiveCache(data: RegionData[]) {
  const storage = getLocalStorage()
  if (!storage || !isValidRegionSnapshot(data, true)) return
  try {
    storage.setItem(LIVE_CACHE_KEY, JSON.stringify({ timestamp: new Date().toISOString(), data }))
  } catch (err) {
    console.warn('[CommandCenter] Failed to persist live cache:', err)
  }
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function CommandCenter() {
  const [regionData,      setRegionData]      = useState<RegionData[]>([])
  const [selectedRegion,  setSelectedRegion]  = useState<RegionData | null>(null)
  const [mapPoints,       setMapPoints]       = useState<MapPoint[]>([])
  const [panelOpen,       setPanelOpen]       = useState(true)
  const [activeTab,       setActiveTab]       = useState<RightPanelTab>('ai')
  const [analyticsOpen,   setAnalyticsOpen]   = useState(false)
  const [infoOpen,        setInfoOpen]        = useState(false)
  const [time,            setTime]            = useState<string>('')
  const [loading,         setLoading]         = useState(true)
  const [selectedCity,    setSelectedCity]    = useState<string>(ALL_CITIES)
  const [dataMode,        setDataMode]        = useState<DataMode>('live')
  const [apiError,        setApiError]        = useState(false)

  const mapFlyToRef            = useRef<((lat: number, lng: number) => void) | null>(null)
  const lastSelectedCityRef    = useRef<string | null>(null)
  const selectedCityRef        = useRef<string>(ALL_CITIES)
  const pendingInitialFlyRef   = useRef<RegionData | null>(null)

  // ── Hydration-safe clock ──────────────────────────────────────────────────
  useEffect(() => {
    setTime(new Date().toLocaleTimeString())
    const t = setInterval(() => setTime(new Date().toLocaleTimeString()), 1000)
    return () => clearInterval(t)
  }, [])

  // ── Keyboard: Escape closes analytics overlay ─────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setAnalyticsOpen(false)
        setPanelOpen(false)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  useEffect(() => { selectedCityRef.current = selectedCity }, [selectedCity])

  // ── Data fetch ────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false

    const applySnapshot = (raw: RegionData[]) => {
      if (cancelled || !raw.length) return false
      setRegionData(raw)
      setMapPoints(normalizeRegions(raw))

      const activeCity = selectedCityRef.current
      if (activeCity === ALL_CITIES) {
        pendingInitialFlyRef.current = null
        lastSelectedCityRef.current = null
        setSelectedRegion(null)
        return true
      }

      const refreshed = raw.find(r => r.city === activeCity) ?? null
      if (!refreshed) {
        selectedCityRef.current = ALL_CITIES
        pendingInitialFlyRef.current = null
        lastSelectedCityRef.current = null
        setSelectedCity(ALL_CITIES)
        setSelectedRegion(null)
        return true
      }

      pendingInitialFlyRef.current = refreshed
      lastSelectedCityRef.current = null
      setSelectedRegion(refreshed)
      return true
    }

    const load = async () => {
      const cachedSnapshot = dataMode === 'live'
        ? readLatestLiveCache() ?? regionCacheByMode.live
        : regionCacheByMode[dataMode]
      const cacheApplied = cachedSnapshot ? applySnapshot(cachedSnapshot) : false

      try {
        if (!cancelled) { setLoading(!cacheApplied); setApiError(false) }
        const endpoint = dataMode === 'live'
          ? '/api/live/regions-intelligence'
          : '/api/historical/regions'
        const raw: RegionData[] = await apiClient.get(endpoint)
        if (!isValidRegionSnapshot(raw, dataMode === 'live')) {
          throw new Error(`Invalid ${dataMode} intelligence snapshot`)
        }
        regionCacheByMode[dataMode] = raw
        if (dataMode === 'live') writeLatestLiveCache(raw)
        applySnapshot(raw)
        if (!cancelled) setApiError(false)
      } catch (err) {
        console.error('[CommandCenter] Failed to load region data:', err)
        if (!cacheApplied) {
          const fallback = dataMode === 'live'
            ? readLatestLiveCache() ?? regionCacheByMode.live
            : regionCacheByMode[dataMode]
          if (fallback) applySnapshot(fallback)
        }
        if (!cancelled) setApiError(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [dataMode])

  const selectedMapPoint = useMemo<MapPoint | null>(
    () => selectedRegion ? normalizeRegionToMapPoint(selectedRegion, 'selected') : null,
    [selectedRegion]
  )

  // ── Derived KPI values — memoized so panel/analytics state doesn't re-derive ──
  const criticalCount = useMemo(
    () => regionData.filter(r => (r.risk_score ?? 0) > 70).length,
    [regionData]
  )
  const avgRisk = useMemo(
    () => regionData.length
      ? Math.round(regionData.reduce((s, r) => s + (r.risk_score ?? 0), 0) / regionData.length)
      : 0,
    [regionData]
  )
  const avgRainfall  = useMemo(() => average(regionData.map(r => Number(r.rainfall_mm ?? 0))),      [regionData])
  const avgWaterLevel= useMemo(() => average(regionData.map(r => Number(r.water_level_index ?? 0))), [regionData])
  const activeRainfall   = selectedRegion ? Number(selectedRegion.rainfall_mm ?? 0)       : avgRainfall
  const activeWaterLevel = selectedRegion ? Number(selectedRegion.water_level_index ?? 0) : avgWaterLevel
  const selectedRegionLabel = selectedRegion?.city ?? ALL_CITIES_LABEL
  const visibleRegionData = useMemo(
    () => selectedCity === ALL_CITIES
      ? regionData
      : regionData.filter(r => r.city === selectedCity),
    [regionData, selectedCity]
  )
  const exposedPopulation = useMemo(
    () => estimateExposedPopulation(selectedRegion, regionData),
    [selectedRegion, regionData]
  )

  const handleSelectRegion = useCallback((region: RegionData, updateFilter = true) => {
    setSelectedRegion(region)
    if (updateFilter) setSelectedCity(region.city ?? ALL_CITIES)
    if (region.city && lastSelectedCityRef.current === region.city) return
    lastSelectedCityRef.current = region.city ?? null
    const lat = region.latitude ?? region.lat ?? region.location?.latitude ?? region.location?.lat
    const lng = region.longitude ?? region.lng ?? region.location?.longitude ?? region.location?.lng
    if (typeof lat === 'number' && typeof lng === 'number') {
      mapFlyToRef.current?.(lat, lng)
    }
  }, [])

  useEffect(() => {
    const pending = pendingInitialFlyRef.current
    if (!pending || !mapFlyToRef.current) return
    pendingInitialFlyRef.current = null
    handleSelectRegion(pending, false)
  }, [handleSelectRegion, mapPoints.length])

  // Memoize filteredMapPoints — prevents map prop churn on panel/analytics toggles
  const filteredMapPoints = useMemo(
    () => selectedCity === ALL_CITIES
      ? mapPoints
      : mapPoints.filter(p => p.city === selectedCity),
    [mapPoints, selectedCity]
  )

  // Memoize rainfall prop to prevent referential churn
  const rainfallProp = useMemo(
    () => filteredMapPoints.map(p => ({ location: p.location, intensity_mm: p.rainfall_mm })),
    [filteredMapPoints]
  )

  // Stable zone-select handler — doesn't recreate on panel/analytics state changes
  const handleZoneSelect = useCallback((point: MapPoint) => {
    const match = regionData.find(r => r.city?.toLowerCase() === point.city?.toLowerCase())
    if (match) {
      handleSelectRegion(match)
      setPanelOpen(true)
    }
  }, [regionData, handleSelectRegion])

  // Stable map-ready handler
  const handleMapReady = useCallback((flyTo: (lat: number, lng: number) => void) => {
    mapFlyToRef.current = flyTo
    if (pendingInitialFlyRef.current) {
      const pending = pendingInitialFlyRef.current
      pendingInitialFlyRef.current = null
      handleSelectRegion(pending, false)
    }
  }, [handleSelectRegion])

  // ── Tab click: only switches content, never closes panel ─────────────────
  const handleTabClick = useCallback((tab: RightPanelTab) => {
    if (panelOpen && activeTab === tab) {
      setPanelOpen(false)
      return
    }
    setActiveTab(tab)
    setPanelOpen(true)
  }, [activeTab, panelOpen])

  return (
    // Root: just a viewport anchor — no flex, no layout flow
    <div className="fixed inset-0 bg-dark-bg text-main font-mono" style={{ isolation: 'isolate' }}>

      {/* ══════════════════════════════════════════════════════════════════════
          LAYER 0 — MAP BACKGROUND (permanent canvas, never moves)
      ══════════════════════════════════════════════════════════════════════ */}
      <div className="fixed inset-0 z-0">
        {/* Vignette over map */}
        <div
          className="pointer-events-none absolute inset-0 z-[1]"
          style={{ boxShadow: 'inset 0 0 120px rgba(2,6,23,0.65)' }}
        />
        {/* Top fade so navbar reads cleanly */}
        <div
          className="pointer-events-none absolute inset-x-0 top-0 z-[1] h-24"
          style={{ background: 'linear-gradient(180deg,rgba(2,6,23,0.70) 0%,transparent 100%)' }}
        />
        {/* Right fade so panel edge is clean */}
        <div
          className="pointer-events-none absolute inset-y-0 right-0 z-[1] w-16"
          style={{ background: 'linear-gradient(270deg,rgba(2,6,23,0.45) 0%,transparent 100%)' }}
        />

        <InteractiveFloodMap
          zones={filteredMapPoints}
          rainfall={rainfallProp}
          selectedZone={selectedMapPoint}
          onZoneSelect={handleZoneSelect}
          onMapReady={handleMapReady}
          dataMode={dataMode}
          rainfallMultiplier={1}
          loading={loading}
        />
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          LAYER 1 — SCANLINE ATMOSPHERE (cosmetic, non-interactive)
      ══════════════════════════════════════════════════════════════════════ */}
      <div
        className="pointer-events-none fixed inset-0 z-[2] opacity-[0.022]"
        style={{
          backgroundImage:
            'repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,255,128,0.15) 2px,rgba(0,255,128,0.15) 4px)',
        }}
      />

      {/* ══════════════════════════════════════════════════════════════════════
          LAYER 2 — TOP NAVBAR  z-700
      ══════════════════════════════════════════════════════════════════════ */}
      <nav
        className="fixed inset-x-0 top-0 z-[700] h-[64px] flex items-center px-5 gap-4 border-b border-emerald-500/20"
        style={{
          background: 'linear-gradient(180deg,rgba(2,6,23,0.97) 0%,rgba(2,6,23,0.88) 100%)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
        }}
      >
        {/* Brand */}
        <div className="flex flex-col leading-none shrink-0">
          <span
            className="
              whitespace-nowrap
              text-emerald-400
              font-bold
              text-2xl
              uppercase
              tracking-[0.04em]
              font-['Orbitron']
            "
          >
            FLUVIO
          </span>
          <span className="text-[9px] uppercase tracking-[0.08em] text-cyan-400/60 mt-0.5 font-semibold">
            Flood Intel Command
          </span>
          <span className="text-[9px] uppercase tracking-[0.08em] text-blue-400/60 mt-0.5 font-semibold">
            Inforcreon Internship
          </span>
        </div>

        {/* KPI Row - Essential only */}
        <div className="flex items-center gap-3 overflow-hidden">
          <KPI label="Regions"   value={loading ? '--' : `${regionData.length}`}                   accent="cyan"    />
          <KPI label="Critical"  value={loading ? '--' : `${criticalCount}`}                       accent="red"     />
          <KPI label="Exposed Pop" value={loading ? '--' : formatDisplayNumber(exposedPopulation, 0)} accent="emerald" />
        </div>

        <div className="h-9 w-px bg-white/10 shrink-0 mx-1" />

        {/* Primary Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <motion.button
            onClick={() => setAnalyticsOpen(value => !value)}
            whileHover={{ scale: 1.03, y: -1 }}
            whileTap={{ scale: 0.97 }}
            className="
              h-9 px-4 rounded-lg
              border border-violet-500/30 bg-violet-500/10
              hover:bg-violet-500/20 hover:border-violet-400/50
              text-violet-300 hover:text-violet-200
              text-[10px] uppercase tracking-widest font-bold
              transition-all duration-200
              flex items-center gap-2
            "
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.21 15.89A10 10 0 1 1 8 2.83" /><path d="M22 12A10 10 0 0 0 12 2v10z" /></svg>
            Analytics
          </motion.button>

          <DatasetExportControls
            currentDataset={visibleRegionData}
            selectedRegion={selectedRegion}
            regionData={regionData}
            dataMode={dataMode}
          />

          {/* Data Mode Toggle */}
          <div className="flex items-center h-9 rounded-lg border border-emerald-500/20 bg-[#06111d] p-0.5">
            {(['live', 'historical'] as DataMode[]).map(mode => (
              <button
                key={mode}
                onClick={() => setDataMode(mode)}
                className={`
                  px-3 h-full flex items-center text-[10px] uppercase tracking-[0.1em] font-bold rounded-md transition-all duration-200
                  ${dataMode === mode
                    ? mode === 'live'
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : 'bg-cyan-500/15 text-cyan-300'
                    : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
                  }
                `}
              >
                {mode}
              </button>
            ))}
          </div>

          {/* City Filter */}
          <select
            value={selectedCity}
            onChange={(e) => {
              const city = e.target.value
              setSelectedCity(city)
              if (city === ALL_CITIES) {
                setSelectedRegion(null)
                return
              }
              const found = regionData.find(r => r.city === city)
              if (found) handleSelectRegion(found)
            }}
            className="
              h-9 bg-[#07111f] border border-emerald-500/20 text-gray-300
              text-[11px] px-3 rounded-lg outline-none font-bold uppercase tracking-wider
              hover:border-emerald-400/40 focus:border-emerald-400 transition-all
            "
          >
            <option value={ALL_CITIES}>Filter Region</option>
            {[...new Set(regionData.map(r => r.city))].map((city, i) => (
              <option key={i} value={city}>{city}</option>
            ))}
          </select>
        </div>

        {/* Spacer to push time/status right */}
        <div className="flex-1" />

        {/* Status & Time */}
        <div className="flex items-center gap-3 shrink-0">
          {apiError && (
            <div className="h-9 flex items-center gap-1.5 px-3 rounded-lg bg-amber-500/10 border border-amber-500/25 text-amber-400 text-[10px] font-bold tracking-widest uppercase">
              <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              OFFLINE_CACHE
            </div>
          )}
          <div className="relative flex items-center gap-3">
            <div className="h-9 flex items-center gap-3 px-4 rounded-lg bg-[#06111d] border border-emerald-500/15">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
              <span className="text-gray-400 text-[12px] font-bold tabular-nums tracking-widest">{time}</span>
            </div>
            <button
              onClick={() => setInfoOpen(!infoOpen)}
              className="h-9 w-9 flex items-center justify-center rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20"
            >
              ⓘ
            </button>
            <AnimatePresence>
              {infoOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }}
                  className="absolute top-full right-0 mt-2 w-48 rounded-xl border border-emerald-500/20 bg-[#06111d] p-4 text-white shadow-xl z-[900]"
                >
                  <h2 className="text-sm font-bold text-emerald-300 mb-2">About the Creator</h2>
                  <div className="space-y-1 text-[11px]">
                    <p><span className="text-gray-400">Name:</span> Muhammed Shameel</p>
                    <p><span className="text-gray-400">Batch:</span> Batch 3</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </nav>

      {/* ══════════════════════════════════════════════════════════════════════
          LAYER 3 — SIDE PANEL OVERLAY  z-600
          Fixed to right edge, floats above the permanent map background.
      ══════════════════════════════════════════════════════════════════════ */}
      <AnimatePresence initial={false}>
        {panelOpen && (
          <motion.aside
            key="right-panel"
            initial={{ x: '100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0 }}
            transition={{ type: 'spring', stiffness: 340, damping: 36 }}
            className="fixed right-0 z-[600] flex max-w-full flex-col overflow-hidden"
            style={{
              top: 64,            // below navbar
              bottom: 0,
              width: 'min(460px, 100vw)',
              maxHeight: 'calc(100vh - 64px)',
              background: 'linear-gradient(180deg,rgba(3,13,26,0.97) 0%,rgba(2,10,20,0.97) 100%)',
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
              borderLeft: '1px solid rgba(16,185,129,0.12)',
              boxShadow: '-24px 0 64px rgba(0,0,0,0.55), -1px 0 0 rgba(16,185,129,0.06)',
            }}
          >
            {/* Panel Header */}
            <div
              className="sticky top-0 z-20 shrink-0 border-b border-emerald-500/10"
              style={{ background: 'rgba(3,13,26,0.60)' }}
            >
              {/* Tab row + close — single h-11 row */}
              <div className="flex h-12 items-center gap-1 px-2">
                <div className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto pr-1" style={{ scrollbarWidth: 'none' }}>
                  {RIGHT_PANEL_TABS.map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => handleTabClick(tab.id)}
                      className={`
                        relative h-8 shrink-0 px-2.5 text-[10px] font-semibold uppercase tracking-wider
                        rounded-md transition-all duration-200 whitespace-nowrap
                        ${activeTab === tab.id
                          ? 'text-emerald-300 bg-emerald-500/12 shadow-[0_0_12px_rgba(16,185,129,0.15)]'
                          : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
                        }
                      `}
                    >
                      {tab.label}
                      {activeTab === tab.id && (
                        <motion.div
                          layoutId="active-tab-indicator"
                          className="absolute bottom-0 left-2 right-2 h-px bg-emerald-400/70 rounded-full"
                        />
                      )}
                    </button>
                  ))}
                </div>
                {/* Close */}
                <button
                  onClick={() => setPanelOpen(false)}
                  className="
                    sticky right-0 z-30 w-8 h-8 flex items-center justify-center rounded-lg shrink-0
                    text-red-300 hover:text-red-100
                    border border-red-400/35 hover:border-red-300/60
                    bg-red-500/10 hover:bg-red-500/20
                    shadow-[0_0_16px_rgba(248,113,113,0.10)]
                    transition-all duration-200
                  "
                  aria-label="Close panel"
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M1 1L11 11M11 1L1 11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                  </svg>
                </button>
              </div>

              {/* Sub-header context */}
              <div className="flex items-center justify-between px-4 py-2 border-t border-white/4">
                <span className="text-[10px] text-gray-600 uppercase tracking-widest truncate">
                  {selectedRegion?.city ?? ALL_CITIES_LABEL}
                </span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wider font-semibold shrink-0
                  ${dataMode === 'live'
                    ? 'bg-emerald-500/15 text-emerald-400'
                    : 'bg-cyan-500/15 text-cyan-400'
                  }`}
                >
                  {dataMode}
                </span>
              </div>
            </div>

            {/* Panel scrollable content */}
            <div
              className="flex-1 overflow-y-auto p-4 space-y-4"
              style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.08) transparent' }}
            >
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.16 }}
                >
                  <RightPanelContent
                    activeTab={activeTab}
                    setActiveTab={setActiveTab}
                    selectedRegion={selectedRegion}
                    regionData={regionData}
                    dataMode={dataMode}
                    onSelectRegion={handleSelectRegion}
                    mapPoints={mapPoints}
                  />
                </motion.div>
              </AnimatePresence>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* ══════════════════════════════════════════════════════════════════════
          LAYER 4 — FLOATING PANEL OPENER  z-600
          Anchored to panel edge — feels attached to the UI system.
          Visible only when panel is closed.
      ══════════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {!panelOpen && (
          <motion.button
            key="panel-opener"
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 16 }}
            transition={{ duration: 0.20, ease: 'easeOut' }}
            onClick={() => setPanelOpen(true)}
            aria-label="Open intelligence panel"
            className="
              fixed right-0 z-[600]
              flex items-center justify-center
              w-9 h-16 rounded-l-xl
              border border-r-0 border-emerald-500/28
              hover:border-emerald-400/55
              text-gray-500 hover:text-emerald-300
              transition-all duration-200
              shadow-[-6px_0_24px_rgba(16,185,129,0.14)]
              hover:shadow-[-6px_0_32px_rgba(16,185,129,0.28)]
            "
            style={{
              top: 'calc(64px + 50% - 32px)',  // navbar height + vertical center offset
              background: 'linear-gradient(270deg,rgba(3,13,26,0.96) 0%,rgba(2,10,20,0.90) 100%)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M5 2L10 7L5 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </motion.button>
        )}
      </AnimatePresence>

      {/* ══════════════════════════════════════════════════════════════════════
          LAYER 5 — ANALYTICS WORKSPACE  z-800 backdrop / z-900 window
          Fully independent of map and panel. Centered modal workspace.
      ══════════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {analyticsOpen && (
          <>
            {/* Backdrop — dims + blurs the world behind */}
            <motion.div
              key="analytics-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="fixed inset-0 z-[800]"
              style={{
                backgroundColor: 'rgba(1, 4, 14, 0.46)',
                backdropFilter: 'blur(6px)',
                WebkitBackdropFilter: 'blur(6px)',
              }}
              onClick={() => setAnalyticsOpen(false)}
            />

            {/* Workspace window — centered, bounded, never clips viewport */}
            <motion.div
              key="analytics-window"
              initial={{ opacity: 0, scale: 0.96, y: 18 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 18 }}
              transition={{ type: 'spring', stiffness: 310, damping: 30 }}
              className="fixed inset-0 z-[900] flex items-center justify-center pointer-events-none"
            >
              <div
                className="pointer-events-auto flex flex-col rounded-2xl overflow-hidden border border-emerald-500/18"
                style={{
                  width: 'min(85vw, 1480px)',
                  height: 'min(88vh, 1040px)',
                  background: 'linear-gradient(160deg,rgba(2,10,24,0.99) 0%,rgba(2,8,18,0.99) 100%)',
                  backdropFilter: 'blur(32px)',
                  WebkitBackdropFilter: 'blur(32px)',
                  boxShadow: [
                    '0 0 0 1px rgba(16,185,129,0.07)',
                    '0 0 80px rgba(16,185,129,0.10)',
                    '0 40px 120px rgba(0,0,0,0.90)',
                    'inset 0 1px 0 rgba(255,255,255,0.04)',
                  ].join(', '),
                }}
              >
                {/* Analytics header */}
                <div
                  className="shrink-0 flex items-center justify-between px-7 py-4 border-b border-emerald-500/10"
                  style={{ background: 'rgba(3,14,28,0.70)' }}
                >
                  <div className="flex items-center gap-5">
                    <div>
                      <h2
                        className="text-sm font-bold text-emerald-300 uppercase tracking-[0.18em]"
                        style={{ fontFamily: "'Orbitron', monospace" }}
                      >
                        Analytics Intelligence Layer
                      </h2>
                      <p className="text-[11px] text-gray-500 mt-0.5 tracking-wide">
                        Flood Exposure Operations Matrix &mdash; {dataMode} telemetry &middot; {regionData.length} regions
                      </p>
                    </div>
                    <span className={`
                      inline-flex items-center gap-1.5 text-[10px] px-2.5 py-1 rounded-md border
                      uppercase tracking-wider font-semibold
                      ${dataMode === 'live'
                        ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300'
                        : 'border-cyan-500/25 bg-cyan-500/10 text-cyan-300'
                      }
                    `}>
                      {dataMode === 'live' && (
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      )}
                      {dataMode}
                    </span>
                  </div>
                  <button
                    onClick={() => setAnalyticsOpen(false)}
                    aria-label="Close analytics"
                    title="Close (Esc)"
                    className="
                      w-9 h-9 flex items-center justify-center rounded-xl
                      border border-red-400/35 hover:border-red-300/60
                      text-red-300 hover:text-red-100
                      bg-red-500/10 hover:bg-red-500/20
                      shadow-[0_0_18px_rgba(248,113,113,0.12)]
                      transition-all duration-200
                    "
                  >
                    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                      <path d="M1 1L12 12M12 1L1 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                    </svg>
                  </button>
                </div>

                {/* Scrollable analytics content */}
                <div
                  className="flex-1 overflow-y-auto p-7"
                  style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(16,185,129,0.14) transparent' }}
                >
                  <AnalyticsCommandPanel
                    regionData={regionData}
                    selectedRegion={selectedRegion ?? buildGlobalRegion(regionData)}
                    dataMode={dataMode}
                    onSelectRegion={handleSelectRegion}
                    visibleRegionData={visibleRegionData}
                  />
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// RIGHT PANEL CONTENT — switches by tab without closing panel
// ══════════════════════════════════════════════════════════════════════════════
function RightPanelContent({
  activeTab,
  setActiveTab,
  selectedRegion,
  regionData,
  dataMode,
  onSelectRegion,
  mapPoints,
}: {
  activeTab: RightPanelTab
  setActiveTab: (tab: RightPanelTab) => void
  selectedRegion: RegionData | null
  regionData: RegionData[]
  dataMode: DataMode
  onSelectRegion: (region: RegionData) => void
  mapPoints: MapPoint[]
}) {
  const focusRegion = selectedRegion ?? buildGlobalRegion(regionData)
  const isGlobalMode = !selectedRegion

  switch (activeTab) {

    // ── AI TAB ──────────────────────────────────────────────────────────────
    case 'ai': {
      const score      = focusRegion?.risk_score ?? 0
      const modelLabel = focusRegion?.model_type ?? 'ML pipeline'
      const infra      = infrastructureProfile(focusRegion, regionData)
      const ranked     = [...regionData]
        .map(r => ({ city: r.city, score: Number(r.risk_score ?? 0) }))
        .sort((a, b) => b.score - a.score)
      const rank       = focusRegion?.city
        ? ranked.findIndex(r => r.city === focusRegion.city) + 1
        : 0
      const avgRisk    = average(regionData.map(r => Number(r.risk_score ?? 0)))
      const avgRain    = average(regionData.map(r => Number(r.rainfall_mm ?? 0)))
      const avgWater   = average(regionData.map(r => Number(r.water_level_index ?? 0)))
      const currentRain  = Number(focusRegion?.rainfall_mm ?? avgRain)
      const currentWater = Number(focusRegion?.water_level_index ?? avgWater)
      const insights   = buildIntelligenceInsights({
        region: focusRegion, regionData, dataMode, rank, score,
        avgRisk, currentRain, avgRain, currentWater, avgWater, infra,
      })

      return (
        <>
          <SectionTitle label="AI Insights" color="text-emerald-400" />
          
          {/* Action Row */}
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('response')}
              className="flex-1 flex items-center justify-center gap-2 h-9 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[10px] font-bold uppercase tracking-widest hover:bg-emerald-500/25 transition-all"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
              View Protocol
            </button>
            <button
              onClick={() => setActiveTab('alerts')}
              className="flex-1 flex items-center justify-center gap-2 h-9 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] font-bold uppercase tracking-widest hover:bg-red-500/20 transition-all"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
              Monitor Alerts
            </button>
          </div>

          <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-3">
            <div className="text-xs text-emerald-300/60 flex items-center justify-between">
              <span>Model: {modelLabel}</span>
              <span className="text-[10px] opacity-60 uppercase">{dataMode} mode</span>
            </div>
            <div className="text-[10px] text-emerald-300/40 mt-1 uppercase tracking-tighter">
              Inference status: {focusRegion?.inference_status ?? 'ok'} &middot; rank #{rank} of {regionData.length}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <InfraMetric label="Resilience"  value={infra.resilienceScore}        accent="emerald" inverse />
            <InfraMetric label="Runoff"       value={infra.runoffPressure}         accent="cyan"    />
            <InfraMetric label="Drainage"     value={infra.drainageStress}         accent="blue"    />
            <InfraMetric label="Watershed"    value={infra.watershedDegradation}   accent="amber"   />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <MiniMetric label="Exposed Population" value={formatDisplayNumber(estimateExposedPopulation(focusRegion, regionData), 0)} tone="emerald" />
            <MiniMetric label="Readiness" value={formatDisplayNumber(responseReadinessScore(focusRegion, regionData), 0)} tone="cyan" />
          </div>
          <InfrastructureImpactMini impact={estimateInfrastructureImpact(focusRegion, regionData)} />
          <div className="space-y-2">
            {insights.map((insight, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.06 }}
                className="p-3 bg-white/3 border border-white/6 rounded-xl text-xs text-gray-300 leading-relaxed"
              >
                {insight}
              </motion.div>
            ))}
          </div>
          <SectionTitle label="Data Sources" color="text-gray-400" />
          <div className="space-y-1.5 text-xs text-gray-600">
            {['Open-Meteo API (live rainfall)', 'regions.json (static profiles)', 'ML Pipeline (.pkl)', 'NDMA flood records'].map(s => (
              <div key={s} className="flex items-center gap-1.5">
                <div className="w-1 h-1 rounded-full bg-emerald-500/50" />
                {s}
              </div>
            ))}
          </div>
        </>
      )
    }

    // ── ALERTS TAB ──────────────────────────────────────────────────────────
    case 'response': {
      const score = Number(focusRegion?.risk_score ?? average(regionData.map(r => Number(r.risk_score ?? 0))))
      const severity = severityFromScore(score)
      const checklist = buildResponseChecklist(score)
      const impact = estimateInfrastructureImpact(focusRegion, regionData)

      return (
        <>
          <SectionTitle label="Response Checklist" color="text-emerald-400" />
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-semibold text-gray-100">{focusRegion?.city ?? ALL_CITIES_LABEL}</div>
                <div className="mt-0.5 text-[10px] uppercase tracking-widest text-gray-600">{severity.label} operating posture</div>
              </div>
              <div className="text-xl font-bold tabular-nums text-emerald-300">{formatDisplayNumber(score, 0)}</div>
            </div>
          </div>
          <div className="space-y-2">
            {checklist.map((item, index) => (
              <motion.div
                key={item.category}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.04 }}
                className="rounded-xl border border-white/8 bg-white/3 p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-gray-200">{item.category}</span>
                  <span className={`rounded px-1.5 py-0.5 text-[9px] uppercase tracking-wider ${item.active ? 'bg-emerald-500/15 text-emerald-300' : 'bg-white/5 text-gray-500'}`}>
                    {item.active ? 'active' : 'standby'}
                  </span>
                </div>
                <div className="mt-1.5 text-xs leading-relaxed text-gray-500">{item.action}</div>
              </motion.div>
            ))}
          </div>
          <SectionTitle label="Infrastructure Impact" color="text-cyan-400" />
          <InfrastructureImpactMini impact={impact} />
        </>
      )
    }

    case 'alerts': {
      const critical = regionData.filter(r => (r.risk_score ?? 0) > 70)
      const high     = regionData.filter(r => (r.risk_score ?? 0) > 45 && (r.risk_score ?? 0) <= 70)
      const moderate = regionData.filter(r => (r.risk_score ?? 0) <= 45)

      return (
        <>
          <SectionTitle label="Active Alerts" color="text-amber-400" />
          <div className="grid grid-cols-3 gap-2">
            <AlertCountBadge count={critical.length} label="Critical" color="red"   />
            <AlertCountBadge count={high.length}     label="High"     color="amber" />
            <AlertCountBadge count={moderate.length} label="Moderate" color="green" />
          </div>
          {critical.length > 0 && (
            <>
              <SectionTitle label="Critical Regions" color="text-red-400" />
              <div className="space-y-1.5">
                {critical.map((r, i) => (
                  <motion.button
                    key={i}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    onClick={() => onSelectRegion(r)}
                    className="w-full flex items-center justify-between px-3 py-2
                               bg-red-500/5 border border-red-500/20 rounded-lg
                               hover:bg-red-500/10 transition-colors"
                  >
                    <div className="text-left">
                      <div className="text-xs text-white font-medium">{r.city}</div>
                      <div className="text-[10px] text-gray-600">{r.country}</div>
                    </div>
                    <div className="text-red-400 text-sm font-bold tabular-nums">
                      {formatDisplayNumber(r.risk_score, 0)}
                    </div>
                  </motion.button>
                ))}
              </div>
            </>
          )}
          {high.length > 0 && (
            <>
              <SectionTitle label="High Risk Regions" color="text-amber-400" />
              <div className="space-y-1.5">
                {high.slice(0, 5).map((r, i) => (
                  <button
                    key={i}
                    onClick={() => onSelectRegion(r)}
                    className="w-full flex items-center justify-between px-3 py-2
                               bg-amber-500/5 border border-amber-500/20 rounded-lg
                               hover:bg-amber-500/10 transition-colors"
                  >
                    <div className="text-left">
                      <div className="text-xs text-white font-medium">{r.city}</div>
                      <div className="text-[10px] text-gray-600">{r.country}</div>
                    </div>
                    <div className="text-amber-400 text-sm font-bold tabular-nums">
                      {formatDisplayNumber(r.risk_score, 0)}
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}
        </>
      )
    }

    // ── ZONES TAB ───────────────────────────────────────────────────────────
    case 'zones': {
      const sorted = [...regionData].sort((a, b) => (b.risk_score ?? 0) - (a.risk_score ?? 0))

      return (
        <>
          <SectionTitle label="All Zones" color="text-cyan-400" />
          <div className="bg-cyan-500/5 border border-cyan-500/20 rounded-xl p-3 flex items-center justify-between">
            <span className="text-xs text-gray-500 uppercase tracking-wider">Monitored zones</span>
            <span className="text-2xl font-bold text-cyan-300 tabular-nums">{regionData.length}</span>
          </div>
          <div className="space-y-1.5">
            {sorted.map((r, i) => (
              <button
                key={i}
                onClick={() => onSelectRegion(r)}
                className="w-full flex items-center gap-2 hover:bg-white/5 rounded-lg px-2 py-1.5 transition-colors"
              >
                <div className="text-xs text-gray-500 w-6 text-right tabular-nums shrink-0">{i + 1}</div>
                <div className="flex-1 text-xs text-gray-300 text-left truncate">{r.city}</div>
                <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.min(100, r.risk_score ?? 0)}%`,
                      backgroundColor:
                        (r.risk_score ?? 0) > 70 ? '#ef4444' :
                        (r.risk_score ?? 0) > 45 ? '#f59e0b' : '#22c55e',
                    }}
                  />
                </div>
                <div className="text-xs text-gray-400 w-8 text-right tabular-nums shrink-0">
                  {formatDisplayNumber(r.risk_score, 0)}
                </div>
              </button>
            ))}
          </div>
        </>
      )
    }

    // ── REPORTS TAB ─────────────────────────────────────────────────────────
    case 'reports': {
      const mm          = focusRegion?.rainfall_mm ?? 0
      const humidity    = focusRegion?.humidity_percent ?? focusRegion?.current_weather?.relative_humidity_2m ?? 0
      const waterLevel  = focusRegion?.water_level_index ?? 0
      const sortedRain  = [...regionData]
        .sort((a, b) => (b.rainfall_mm ?? 0) - (a.rainfall_mm ?? 0))
        .slice(0, 6)
      const maxMm = sortedRain[0]?.rainfall_mm ?? 1

      return (
        <>
          <SectionTitle label="Rainfall Report" color="text-blue-400" />
          <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4 space-y-2">
            <div className="flex items-end gap-2">
              <span className="text-4xl font-bold text-blue-400 tabular-nums">{formatDisplayNumber(mm)}</span>
              <span className="text-blue-300 text-lg mb-1">mm</span>
            </div>
            <div className="text-xs text-gray-500">{focusRegion?.city ?? ALL_CITIES_LABEL}</div>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <div className="rounded-lg border border-cyan-500/15 bg-cyan-500/5 px-2 py-1.5">
                <div className="text-[10px] text-gray-500 uppercase">Humidity</div>
                <div className="text-sm text-cyan-300 font-bold tabular-nums">{formatMetric(humidity, '%', 0)}</div>
              </div>
              <div className="rounded-lg border border-emerald-500/15 bg-emerald-500/5 px-2 py-1.5">
                <div className="text-[10px] text-gray-500 uppercase">Water Index</div>
                <div className="text-sm text-emerald-300 font-bold tabular-nums">{formatDisplayNumber(waterLevel, 0)}</div>
              </div>
            </div>
            <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-blue-400"
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, (mm / 200) * 100)}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
              />
            </div>
          </div>
          <SectionTitle label="Top Rainfall Regions" color="text-gray-400" />
          <div className="space-y-2">
            {sortedRain.map((r, i) => (
              <button
                key={i}
                onClick={() => onSelectRegion(r)}
                className="w-full flex items-center gap-2 hover:bg-white/5 rounded-lg px-1 py-0.5 transition-colors"
              >
                <div className="text-xs text-gray-500 w-24 truncate text-left">{r.city}</div>
                <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-blue-400"
                    style={{ width: `${((r.rainfall_mm ?? 0) / maxMm) * 100}%` }}
                  />
                </div>
                <div className="text-xs text-blue-300 w-12 text-right tabular-nums">
                  {formatMetric(r.rainfall_mm, 'mm')}
                </div>
              </button>
            ))}
          </div>
          <SectionTitle label="Rainfall Thresholds" color="text-gray-400" />
          <div className="space-y-1.5">
            {[
              { label: 'Extreme',  threshold: '>150mm', dot: 'bg-red-400'    },
              { label: 'Severe',   threshold: '>100mm', dot: 'bg-amber-400'  },
              { label: 'Moderate', threshold: '>50mm',  dot: 'bg-yellow-400' },
              { label: 'Normal',   threshold: '<50mm',  dot: 'bg-green-400'  },
            ].map(t => (
              <div key={t.label} className="flex items-center gap-2 text-xs">
                <div className={`w-1.5 h-1.5 rounded-full ${t.dot}`} />
                <span className="text-gray-400 w-20">{t.label}</span>
                <span className="text-gray-600">{t.threshold}</span>
              </div>
            ))}
          </div>
        </>
      )
    }

    // ── PROJECT TAB ────────────────────────────────────────────────────────
    case 'project': {
      return (
        <>
          <SectionTitle label="Why This Matters" color="text-emerald-400" />
          <div className="space-y-3">
            <div className="p-3 bg-white/3 border border-white/6 rounded-xl">
              <h4 className="text-xs font-bold text-gray-200 mb-1">Human & Economic Impact</h4>
              <p className="text-[11px] text-gray-400 leading-relaxed">
                Flood events threaten infrastructure, displace populations, and cause cascading economic damage. Real-time intelligence enables coordinated emergency response and protects critical assets.
              </p>
            </div>
            <div className="p-3 bg-white/3 border border-white/6 rounded-xl">
              <h4 className="text-xs font-bold text-gray-200 mb-1">Infrastructure Protection</h4>
              <p className="text-[11px] text-gray-400 leading-relaxed">
                By identifying at-risk hospitals, schools, and power facilities before water levels peak, authorities can deploy physical barriers and move sensitive equipment.
              </p>
            </div>
          </div>

          <SectionTitle label="Who Controls The Rails" color="text-cyan-400" />
          <div className="space-y-3">
            <div className="p-3 bg-cyan-500/5 border border-cyan-500/15 rounded-xl">
              <h4 className="text-xs font-bold text-cyan-300 mb-1">Risk Calculation Pipeline</h4>
              <div className="space-y-2 mt-2">
                {[
                  { step: '1. Telemetry', desc: 'Live Open-Meteo rainfall & humidity' },
                  { step: '2. Inventory', desc: 'OSM infrastructure & population density' },
                  { step: '3. ML Inference', desc: 'Gradient Boost model (trained on historicals)' },
                  { step: '4. Calibration', desc: 'Composite weighting of environmental & static risk' }
                ].map(s => (
                  <div key={s.step} className="flex flex-col gap-0.5">
                    <span className="text-[10px] font-bold text-gray-300 uppercase">{s.step}</span>
                    <span className="text-[10px] text-gray-500">{s.desc}</span>
                  </div>
                ))}
              </div>
            </div>
            <p className="text-[10px] text-gray-600 italic px-1">
              The FLUVIO engine automates this pipeline every 15 minutes to provide a high-confidence operational posture.
            </p>
          </div>
        </>
      )
    }

    // ── TIMELINE TAB ────────────────────────────────────────────────────────
    case 'timeline': {
      const score = focusRegion?.risk_score ?? 0
      const status= focusRegion?.risk_status ?? 'Unknown'
      const pct   = Math.min(100, Math.round(score))
      const barColor = score > 70 ? '#ef4444' : score > 45 ? '#f59e0b' : '#22c55e'

      return (
        <>
          <SectionTitle label="Risk Timeline" color="text-red-400" />
          <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4 space-y-3">
            <div className="flex items-end justify-between">
              <span className="text-4xl font-bold text-red-400 tabular-nums">
                {formatDisplayNumber(score, 0)}
              </span>
              <span className="text-xs text-gray-500 mb-1">/ 100</span>
            </div>
            <StatusBadge status={status} score={score} />
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-gray-500">
                <span>Flood Risk Index</span>
                <span>{pct}%</span>
              </div>
              <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  style={{ backgroundColor: barColor }}
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                />
              </div>
            </div>
          </div>

          <SectionTitle label="Active Scope" color="text-gray-400" />
          <div className="bg-white/3 border border-white/8 rounded-xl p-4 space-y-1.5">
            <div className="text-white font-semibold">{focusRegion?.city ?? ALL_CITIES_LABEL}</div>
            <div className="text-gray-500 text-xs">
              {isGlobalMode ? `${regionData.length} regions monitored` : focusRegion?.country ?? '--'}
            </div>
            <div className="text-xs text-gray-600 tabular-nums">
              {isGlobalMode
                ? GLOBAL_MONITORING_LABEL
                : <>
                    {formatDisplayNumber(focusRegion?.latitude ?? focusRegion?.lat)},&nbsp;
                    {formatDisplayNumber(focusRegion?.longitude ?? focusRegion?.lng)}
                  </>
              }
            </div>
          </div>

          <SectionTitle label="All Regions Risk" color="text-gray-400" />
          <div className="space-y-2">
            {regionData.slice(0, 10).map((r, i) => (
              <button
                key={i}
                onClick={() => onSelectRegion(r)}
                className="w-full flex items-center gap-2 hover:bg-white/5 rounded-lg px-1 py-0.5 transition-colors"
              >
                <div className="text-xs text-gray-500 w-24 truncate text-left">{r.city}</div>
                <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.min(100, r.risk_score ?? 0)}%`,
                      backgroundColor:
                        (r.risk_score ?? 0) > 70 ? '#ef4444' :
                        (r.risk_score ?? 0) > 45 ? '#f59e0b' : '#22c55e',
                    }}
                  />
                </div>
                <div className="text-xs text-gray-400 w-8 text-right tabular-nums">
                  {formatDisplayNumber(r.risk_score, 0)}
                </div>
              </button>
            ))}
          </div>
        </>
      )
    }

    default:
      return null
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// ANALYTICS COMMAND PANEL (full workspace)
// ══════════════════════════════════════════════════════════════════════════════
function AnalyticsCommandPanel({
  regionData,
  selectedRegion,
  dataMode,
  onSelectRegion,
  visibleRegionData,
}: {
  regionData: RegionData[]
  selectedRegion: RegionData | null
  dataMode: DataMode
  onSelectRegion: (region: RegionData) => void
  visibleRegionData: RegionData[]
}) {
  const selected       = selectedRegion ?? regionData[0] ?? null
  const risks          = regionData.map(r => Number(r.risk_score ?? 0))
  const rain           = regionData.map(r => Number(r.rainfall_mm ?? 0))
  const humidity       = regionData.map(r => Number(r.humidity_percent ?? r.current_weather?.relative_humidity_2m ?? 0))
  const water          = regionData.map(r => Number(r.water_level_index ?? 0))
  const avgRisk        = average(risks)
  const avgRain        = average(rain)
  const avgHumidity    = average(humidity)
  const avgWater       = average(water)
  const highRiskCount  = regionData.filter(r => Number(r.risk_score ?? 0) >= 50).length
  const criticalCount  = regionData.filter(r => Number(r.risk_score ?? 0) >= 70).length
  const eventIndex     = Math.round(clamp(avgRisk * 0.62 + avgWater * 0.38, 0, 100))
  const environmentalStress = Math.round(clamp(avgRain * 1.15 + avgHumidity * 0.18 + avgWater * 0.58, 0, 100))
  const inferenceShare = regionData.length
    ? regionData.filter(r => String(r.inference_status ?? '').includes('ml')).length / regionData.length
    : 0
  const mlConfidence   = Math.round(clamp(74 + inferenceShare * 18 - standardDeviation(risks) * 0.6, 58, 96))
  const alertStatus    = criticalCount > 0 ? 'CRITICAL' : highRiskCount > 0 ? 'WATCH' : 'STABLE'
  const infra          = infrastructureProfile(selected, regionData)
  const exposedPop     = estimateExposedPopulation(selected, regionData)
  const infrastructure = estimateInfrastructureImpact(selected, regionData)
  const readiness      = responseReadinessScore(selected, regionData)

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-7 gap-4">
        <IntelligenceKpiCard label="Active Flood Risk"      value={selected ? formatDisplayNumber(selected.risk_score, 1) : '--'}  detail={selected?.risk_status ?? '--'}                                            accent="red"     trend={selected ? Number(selected.risk_score ?? 0) - avgRisk : 0}            series={risks.slice(0, 12)} />
        <IntelligenceKpiCard label="Regions Monitored"      value={regionData.length || '--'}                                       detail={`${highRiskCount} high-watch`}                                            accent="cyan"    trend={highRiskCount}                                                        series={risks} />
        <IntelligenceKpiCard label="Rainfall Intensity"     value={formatMetric(selected?.rainfall_mm ?? avgRain, 'mm', 1)}         detail={`${formatMetric(avgRain, 'mm', 1)} network avg`}                          accent="blue"    trend={Number(selected?.rainfall_mm ?? avgRain) - avgRain}                    series={rain} />
        <IntelligenceKpiCard label="ML Confidence"          value={`${mlConfidence}%`}                                              detail={selected?.model_type ?? 'model status'}                                   accent="emerald" trend={mlConfidence - 80}                                                    series={risks.map(v => clamp(v + mlConfidence * 0.08, 0, 100))} />
        <IntelligenceKpiCard label="High-Risk Zones"        value={highRiskCount}                                                   detail={`${criticalCount} critical`}                                              accent="amber"   trend={highRiskCount - Math.round(regionData.length * 0.2)}                   series={risks.filter(v => v >= 45)} />
        <IntelligenceKpiCard label="Historical Event Index" value={eventIndex}                                                      detail="frequency weighted"                                                       accent="violet"  trend={eventIndex - avgRisk}                                                 series={regionData.map(r => Number(r.risk_score ?? 0) * 0.62 + Number(r.water_level_index ?? 0) * 0.38)} />
        <IntelligenceKpiCard label="Environmental Stress"   value={environmentalStress}                                             detail={`water ${formatDisplayNumber(avgWater, 0)} / humidity ${formatMetric(avgHumidity, '%', 0)}`} accent="cyan" trend={environmentalStress - 55}                           series={water} />
        <IntelligenceKpiCard label="Live Alert Status"      value={alertStatus}                                                     detail={criticalCount ? 'deploy watch desk' : highRiskCount ? 'monitor escalation' : 'routine scan'} accent={criticalCount ? 'red' : highRiskCount ? 'amber' : 'emerald'} trend={criticalCount + highRiskCount} series={risks.slice().sort((a, b) => b - a)} />
        <IntelligenceKpiCard label="Exposed Population"     value={formatDisplayNumber(exposedPop, 0)}                              detail={`${selected?.city ?? ALL_CITIES_LABEL} estimate`}                      accent="emerald" trend={exposedPop - average(regionData.map(r => estimateExposedPopulation(r, regionData)))} series={regionData.map(r => estimateExposedPopulation(r, regionData) / 10000)} />
        <IntelligenceKpiCard label="Response Readiness"     value={formatDisplayNumber(readiness, 0)}                               detail={readiness > 70 ? 'ready posture' : readiness > 45 ? 'partial posture' : 'surge required'} accent={readiness > 70 ? 'emerald' : readiness > 45 ? 'amber' : 'red'} trend={readiness - 60} series={regionData.map(r => responseReadinessScore(r, regionData))} />
        <IntelligenceKpiCard label="Runoff Pressure"        value={formatDisplayNumber(infra.runoffPressure, 0)}                    detail={`${formatDisplayNumber(pctDelta(infra.runoffPressure, infra.network.runoffPressure), 0)}% vs network`}        accent="cyan"    trend={infra.runoffPressure - infra.network.runoffPressure}            series={regionData.map(r => infraValue(r, 'runoff_pressure', 50))} />
        <IntelligenceKpiCard label="Drainage Stress"        value={formatDisplayNumber(infra.drainageStress, 0)}                    detail={`${formatDisplayNumber(pctDelta(infra.drainageStress, infra.network.drainageStress), 0)}% vs network`}          accent="blue"    trend={infra.drainageStress - infra.network.drainageStress}              series={regionData.map(r => infraValue(r, 'drainage_stress', 50))} />
        <IntelligenceKpiCard label="Watershed Stability"    value={formatDisplayNumber(100 - infra.watershedDegradation, 0)}        detail={`${formatDisplayNumber(infra.watershedDegradation, 0)} degradation`}                                             accent="emerald" trend={infra.network.watershedDegradation - infra.watershedDegradation} series={regionData.map(r => 100 - infraValue(r, 'watershed_degradation', 50))} />
        <IntelligenceKpiCard label="Resilience Rank"        value={formatDisplayNumber(infra.resilienceScore, 0)}                   detail={`${formatDisplayNumber(pctDelta(infra.resilienceScore, infra.network.resilienceScore), 0)}% vs network`}          accent="violet"  trend={infra.resilienceScore - infra.network.resilienceScore}            series={regionData.map(r => infraValue(r, 'resilience_score', 50))} />
      </div>

      <InfrastructureImpactStrip impact={infrastructure} />

      <div className="grid grid-cols-1 2xl:grid-cols-2 gap-4">
        <FloodForecastGraph        selectedRegion={selected} regionData={regionData} dataMode={dataMode} />
        <ExposedPopulationTrendGraph regionData={visibleRegionData.length ? visibleRegionData : regionData} selectedRegion={selected} />
        <AssetExposureSummaryGraph regionData={visibleRegionData.length ? visibleRegionData : regionData} selectedRegion={selected} />
        <ResponseReadinessGraph regionData={regionData} selectedRegion={selected} />
        <RegionalComparisonGraph   regionData={regionData} onSelectRegion={onSelectRegion} />
        <InfrastructureStressGraph regionData={regionData} selectedRegion={selected} />
        <VulnerabilityDistributionGraph regionData={regionData} dataMode={dataMode} />
        <WeatherCorrelationGraph   regionData={regionData} />
        <HistoricalPatternGraph    regionData={regionData} dataMode={dataMode} />
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// SHARED SUB-COMPONENTS
// ══════════════════════════════════════════════════════════════════════════════

function KPI({ label, value, accent }: {
  label: string; value: string | number
  accent: 'emerald' | 'cyan' | 'red' | 'blue' | 'violet'
}) {
  const colors: Record<string, string> = {
    emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    cyan:    'text-cyan-400    bg-cyan-500/10    border-cyan-500/20',
    red:     'text-red-400     bg-red-500/10     border-red-500/20',
    blue:    'text-blue-400    bg-blue-500/10    border-blue-500/20',
    violet:  'text-violet-400  bg-violet-500/10  border-violet-500/20',
  }
  const displayValue = typeof value === 'number' ? formatDisplayNumber(value) : value
  return (
    <motion.div
      whileHover={{ scale: 1.025, y: -1 }}
      transition={{ duration: 0.16, ease: 'easeOut' }}
      className={`w-[110px] h-9 px-2.5 flex flex-col justify-center border rounded-lg ${colors[accent]} transition-all duration-200 hover:border-emerald-300/35 hover:shadow-[0_0_18px_rgba(34,211,238,0.10)]`}
    >
      <div className="truncate text-[8px] text-gray-500 uppercase tracking-widest leading-none font-medium mb-0.5" title={label}>{label}</div>
      <div className={`truncate text-[14px] font-bold tabular-nums leading-none ${colors[accent].split(' ')[0]}`} title={String(displayValue)}>
        {displayValue}
      </div>
    </motion.div>
  )
}

function SectionTitle({ label, color }: { label: string; color: string }) {
  return (
    <div className="flex items-center gap-1.5 pt-1">
      <span className={`text-xs font-semibold uppercase tracking-wider ${color}`}>{label}</span>
    </div>
  )
}

function StatusBadge({ status, score }: { status: string; score: number }) {
  const [bg, text] =
    score > 70 ? ['bg-red-500/15 border-red-500/30',     'text-red-300']    :
    score > 45 ? ['bg-amber-500/15 border-amber-500/30', 'text-amber-300']  :
                 ['bg-green-500/15 border-green-500/30', 'text-green-300']
  return (
    <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md border text-xs ${bg} ${text}`}>
      <div className={`w-1.5 h-1.5 rounded-full ${
        score > 70 ? 'bg-red-400 animate-pulse' : score > 45 ? 'bg-amber-400' : 'bg-green-400'
      }`} />
      {status}
    </div>
  )
}

function AlertCountBadge({ count, label, color }: {
  count: number; label: string; color: 'red' | 'amber' | 'green'
}) {
  const map = {
    red:   'bg-red-500/10   border-red-500/25   text-red-400',
    amber: 'bg-amber-500/10 border-amber-500/25 text-amber-400',
    green: 'bg-green-500/10 border-green-500/25 text-green-400',
  }
  return (
    <motion.div
      whileHover={{ scale: 1.02, y: -1 }}
      transition={{ duration: 0.16, ease: 'easeOut' }}
      className={`border rounded-lg p-2 text-center transition-all duration-200 hover:border-emerald-300/30 hover:shadow-[0_0_18px_rgba(16,185,129,0.10)] ${map[color]}`}
    >
      <div className="text-2xl font-bold">{count}</div>
      <div className="text-[10px] text-gray-500 mt-0.5 uppercase">{label}</div>
    </motion.div>
  )
}

function InfraMetric({ label, value, accent, inverse = false }: {
  label: string; value: number
  accent: 'emerald' | 'cyan' | 'blue' | 'amber'
  inverse?: boolean
}) {
  const colors = commandColors(accent)
  const normalized = clamp(value, 0, 100)
  const pressure   = inverse ? 100 - normalized : normalized
  const state      = pressure > 70 ? 'critical' : pressure > 45 ? 'watch' : 'stable'
  return (
    <div className={`rounded-lg border ${colors.border} ${colors.bg} p-2`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] uppercase tracking-widest text-gray-500">{label}</span>
        <span className={`text-sm font-bold tabular-nums ${colors.text}`}>{formatDisplayNumber(normalized, 0)}</span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/5">
        <div className="h-full rounded-full" style={{ width: `${normalized}%`, backgroundColor: colors.hex }} />
      </div>
      <div className="mt-1 text-[9px] uppercase tracking-wider text-gray-600">{state}</div>
    </div>
  )
}

function MapSkeleton() {
  return (
    <div className="w-full h-full flex items-center justify-center bg-[#020d1a]">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-emerald-500/40 border-t-emerald-400 rounded-full animate-spin" />
        <span className="text-xs text-gray-600 tracking-widest">LOADING MAP</span>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// ANALYTICS CHART COMPONENTS (unchanged from original)
// ══════════════════════════════════════════════════════════════════════════════

function MiniMetric({ label, value, tone }: { label: string; value: string | number; tone: 'emerald' | 'cyan' }) {
  const colors = tone === 'emerald'
    ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-300'
    : 'border-cyan-500/20 bg-cyan-500/5 text-cyan-300'
  return (
    <div className={`rounded-lg border p-2 ${colors}`}>
      <div className="text-[10px] uppercase tracking-widest text-gray-500">{label}</div>
      <div className="mt-1 text-sm font-bold tabular-nums">{value}</div>
    </div>
  )
}

function InfrastructureImpactMini({ impact }: { impact: InfrastructureImpactEstimate }) {
  const items = [
    ['Roads', formatMetric(impact.roadsKm, 'km', 1), '#94a3b8'],
    ['Hospitals', impact.hospitals, '#f87171'],
    ['Schools', impact.schools, '#f59e0b'],
    ['Power', impact.power, '#a78bfa'],
    ['Critical', impact.criticalFacilities, '#22d3ee'],
  ] as const
  return (
    <div className="rounded-xl border border-cyan-500/15 bg-cyan-500/5 p-3">
      <div className="mb-2 text-[10px] uppercase tracking-widest text-gray-500">Affected Infrastructure</div>
      <div className="grid grid-cols-2 gap-2">
        {items.map(([label, value, color]) => (
          <div key={label} className="flex items-center justify-between gap-2 rounded-lg bg-white/5 px-2 py-1.5">
            <span className="flex items-center gap-1.5 text-[10px] text-gray-500">
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
              {label}
            </span>
            <span className="text-xs font-bold tabular-nums text-gray-200">{value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function InfrastructureImpactStrip({ impact }: { impact: InfrastructureImpactEstimate }) {
  const items = [
    ['Roads (est. affected)', formatMetric(impact.roadsKm, 'km', 1), 'cyan'],
    ['Hospitals (est. affected)', impact.hospitals, 'red'],
    ['Schools (est. affected)', impact.schools, 'amber'],
    ['Power assets (est. risk)', impact.power, 'violet'],
    ['Critical facilities (est. risk)', impact.criticalFacilities, 'emerald'],
  ] as const
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500">Infrastructure Impact Estimates</h3>
        <span className="text-[9px] text-gray-600 uppercase tracking-widest">Source: OpenStreetMap Inventory</span>
      </div>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
        {items.map(([label, value, accent]) => {
          const colors = commandColors(accent)
          return (
            <div key={label} className={`rounded-lg border ${colors.border} ${colors.bg} p-3 transition-all hover:border-white/10`}>
              <div className="text-[10px] uppercase tracking-widest text-gray-500">{label}</div>
              <div className={`mt-1 text-xl font-bold tabular-nums ${colors.text}`}>{value}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function DatasetExportControls({
  currentDataset,
  selectedRegion,
  regionData,
  dataMode,
}: {
  currentDataset: RegionData[]
  selectedRegion: RegionData | null
  regionData: RegionData[]
  dataMode: DataMode
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  
  const download = (target: 'selected' | 'cache') => {
    setMenuOpen(false)
    const liveCache = readLatestLiveCache()
    const cachedRows = liveCache ?? regionCacheByMode[dataMode] ?? regionData
    const selectedRows = selectedRegion
      ? cachedRows.filter(row => row.city === selectedRegion.city)
      : currentDataset
    const rows = target === 'selected' ? selectedRows : cachedRows
    if (!rows.length) return
    downloadCsv(`flood-dataset-${target}-${new Date().toISOString().slice(0, 10)}.csv`, buildTelemetryCsv(rows, dataMode))
  }

  return (
    <div className="shrink-0 relative">
      <button
        type="button"
        onClick={() => setMenuOpen(!menuOpen)}
        className="h-9 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 text-[10px] font-bold uppercase tracking-widest text-emerald-300 transition-all hover:bg-emerald-500/20 hover:border-emerald-400/50 flex items-center gap-2"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
        Export
      </button>
      
      {menuOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
          <div className="absolute top-full mt-1.5 right-0 z-50 rounded-lg border border-emerald-500/25 bg-[#030d1a] overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.60)] min-w-[200px]">
            <button
              onClick={() => download('cache')}
              className="w-full px-4 py-3 text-left text-[10px] uppercase tracking-wider font-bold text-emerald-300 hover:bg-emerald-500/15 transition-colors border-b border-emerald-500/10"
            >
              Export Global Cache
            </button>
            <button
              onClick={() => download('selected')}
              disabled={!selectedRegion}
              className={`w-full px-4 py-3 text-left text-[10px] uppercase tracking-wider font-bold transition-colors ${
                selectedRegion ? 'text-emerald-300 hover:bg-emerald-500/15' : 'text-gray-600 cursor-not-allowed'
              }`}
            >
              Export Selected City
            </button>
          </div>
        </>
      )}
    </div>
  )
}

function IntelligenceKpiCard({ label, value, detail, accent, trend, series }: {
  label: string; value: string | number; detail: string
  accent: 'emerald' | 'cyan' | 'red' | 'blue' | 'violet' | 'amber'
  trend: number; series: number[]
}) {
  const colors    = commandColors(accent)
  const trendLabel = trend > 0 ? `+${formatDisplayNumber(trend, 1)}` : formatDisplayNumber(trend, 1)
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.015, y: -1 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      className={`relative overflow-hidden rounded-lg border ${colors.border} ${colors.bg} p-3 transition-all duration-200 hover:border-emerald-300/30 hover:shadow-[0_0_22px_rgba(34,211,238,0.10)]`}
    >
      <div className={`absolute right-3 top-3 h-2 w-2 rounded-full ${colors.dot} shadow-[0_0_18px_currentColor] animate-pulse`} />
      <div className="text-[10px] uppercase tracking-widest text-gray-500">{label}</div>
      <div className={`mt-1 text-2xl font-bold tabular-nums ${colors.text}`}>{value}</div>
      <div className="mt-1 flex items-center justify-between gap-2">
        <span className="truncate text-[10px] text-gray-500">{detail}</span>
        <span className={`text-[10px] tabular-nums ${trend >= 0 ? colors.text : 'text-slate-400'}`}>
          {trend >= 0 ? '^' : 'v'} {trendLabel}
        </span>
      </div>
      <Sparkline values={series} color={colors.hex} />
    </motion.div>
  )
}

function FloodForecastGraph({ selectedRegion, regionData, dataMode }: {
  selectedRegion: RegionData | null; regionData: RegionData[]; dataMode: DataMode
}) {
  const selectedRisk  = Number(selectedRegion?.risk_score ?? average(regionData.map(r => Number(r.risk_score ?? 0))))
  const selectedRain  = Number(selectedRegion?.rainfall_mm ?? average(regionData.map(r => Number(r.rainfall_mm ?? 0))))
  const selectedWater = Number(selectedRegion?.water_level_index ?? average(regionData.map(r => Number(r.water_level_index ?? 0))))
  const historicalBase = selectedRegion
    ? Number(selectedRegion.risk_score ?? 0) * 0.72 + Number(selectedRegion.water_level_index ?? 0) * 0.28
    : selectedRisk
  const hours = ['-18h', '-12h', '-6h', 'now', '+6h', '+12h', '+18h', '+24h', '+30h', '+36h', '+42h', '+48h']
  const wave  = [-0.18, -0.11, -0.05, 0, 0.06, 0.12, 0.18, 0.14, 0.1, 0.06, 0.03, 0]
  const live  = hours.map((_, i) => clamp(selectedRisk + selectedRain * wave[i] + selectedWater * (i > 3 ? 0.035 : -0.015), 0, 100))
  const historical = hours.map((_, i) => clamp(historicalBase + selectedRain * wave[(i + 8) % wave.length] * 0.55, 0, 100))
  const moving = movingAverage(live, 3)
  const band   = clamp(5 + standardDeviation(regionData.map(r => Number(r.risk_score ?? 0))) * 0.35 + selectedRain * 0.04, 4, 14)
  const anomalies = live.filter((v, i) => i > 2 && v - moving[i] > band * 0.42)

  return (
    <ChartShell title="Flood Risk Forecast" subtitle={`${selectedRegion?.city ?? 'Network'} predictive progression | ${dataMode} blend`} stat={formatDisplayNumber(live[live.length - 1], 1)} statLabel="48h risk">
      <svg viewBox="0 0 640 300" className="h-[300px] w-full overflow-visible">
        <ChartGrid width={640} height={300} />
        <defs>
          <linearGradient id="forecastBand" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.26" />
            <stop offset="100%" stopColor="#22c55e" stopOpacity="0.02" />
          </linearGradient>
          <linearGradient id="forecastSweep" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#22c55e" stopOpacity="0" />
            <stop offset="55%" stopColor="#22d3ee" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#a7f3d0" stopOpacity="0.15" />
          </linearGradient>
        </defs>
        <path d={bandPath(live, band, 600, 240, 22, 28)} fill="url(#forecastBand)" />
        <path d={linePath(historical, 600, 240, 22, 28)} fill="none" stroke="#8b5cf6" strokeWidth="2" strokeDasharray="6 6" opacity="0.72" />
        <path d={linePath(moving, 600, 240, 22, 28)} fill="none" stroke="#f59e0b" strokeWidth="2" opacity="0.84" />
        <motion.path
          d={linePath(live, 600, 240, 22, 28)}
          fill="none" stroke="url(#forecastSweep)" strokeWidth="4" strokeLinecap="round"
          initial={{ pathLength: 0, opacity: 0.2 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 1.1, ease: 'easeOut' }}
          style={{ filter: 'drop-shadow(0 0 8px rgba(34,211,238,0.8))' }}
        />
        {live.map((v, i) => {
          const [x, y] = pointFor(v, i, live.length, 600, 240, 22, 28)
          const isAnomaly = i > 2 && v - moving[i] > band * 0.42
          return (
            <g key={hours[i]}>
              {isAnomaly && <circle cx={x} cy={y} r="8" fill="#ef4444" opacity="0.18" />}
              <circle cx={x} cy={y} r={isAnomaly ? 4.5 : 3} fill={isAnomaly ? '#ef4444' : '#67e8f9'} />
              <text x={x} y={282} textAnchor="middle" fill="#64748b" fontSize="10">{hours[i]}</text>
            </g>
          )
        })}
        <motion.rect x="22" y="28" width="2" height="240" fill="#a7f3d0" opacity="0.5" animate={{ x: [22, 620, 22] }} transition={{ repeat: Infinity, duration: 5.5, ease: 'linear' }} />
        <ChartLegend items={[['Live ML', '#22d3ee'], ['Historical', '#8b5cf6'], ['Moving avg', '#f59e0b'], [`Anomalies ${anomalies.length}`, '#ef4444']]} />
      </svg>
    </ChartShell>
  )
}

function ExposedPopulationTrendGraph({ regionData, selectedRegion }: {
  regionData: RegionData[]; selectedRegion: RegionData | null
}) {
  const population = regionData.map(r => estimateExposedPopulation(r, regionData))
  const maxPop = Math.max(1, ...population)
  const selectedPop = estimateExposedPopulation(selectedRegion, regionData)
  const trend = population.map(value => (value / maxPop) * 100)
  return (
    <ChartShell title="Exposed Population Trend" subtitle={`${selectedRegion?.city ?? 'Visible dataset'} affected population estimate`} stat={selectedPop} statLabel="people exposed">
      <svg viewBox="0 0 640 300" className="h-[300px] w-full overflow-visible">
        <ChartGrid width={640} height={300} />
        <path d={bandPath(trend, 7, 590, 220, 28, 36)} fill="#22d3ee" opacity="0.12" />
        <motion.path initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1 }} d={linePath(trend, 590, 220, 28, 36)} fill="none" stroke="#34d399" strokeWidth="3" />
        {trend.map((value, index) => {
          const [x, y] = pointFor(value, index, trend.length, 590, 220, 28, 36)
          return <circle key={`${index}-${value}`} cx={x} cy={y} r="3.5" fill="#67e8f9" opacity="0.86" />
        })}
        <ChartLegend items={[['Estimated exposed population', '#34d399'], ['uncertainty band', '#22d3ee']]} />
      </svg>
    </ChartShell>
  )
}

function AssetExposureSummaryGraph({ regionData, selectedRegion }: {
  regionData: RegionData[]; selectedRegion: RegionData | null
}) {
  const impact = estimateInfrastructureImpact(selectedRegion, regionData)
  const values = [
    { label: 'Hospitals', value: impact.hospitals, color: '#f87171' },
    { label: 'Schools', value: impact.schools, color: '#f59e0b' },
    { label: 'Road km', value: impact.roadsKm, color: '#94a3b8' },
    { label: 'Power', value: impact.power, color: '#a78bfa' },
    { label: 'Critical', value: impact.criticalFacilities, color: '#22d3ee' },
  ]
  const maxValue = Math.max(1, ...values.map(item => item.value))
  return (
    <ChartShell title="Asset Exposure Summary" subtitle="Infrastructure exposure from region metadata" stat={values.reduce((sum, item) => sum + item.value, 0)} statLabel="asset load">
      <div className="space-y-3 pt-1">
        {values.map(item => (
          <div key={item.label}>
            <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-widest">
              <span className="text-gray-500">{item.label}</span>
              <span className="text-gray-300 tabular-nums">{formatDisplayNumber(item.value, 1)}</span>
            </div>
            <div className="h-8 overflow-hidden rounded bg-white/[0.035]">
              <motion.div initial={{ width: 0 }} animate={{ width: `${(item.value / maxValue) * 100}%` }} className="h-full rounded-r" style={{ backgroundColor: item.color, opacity: 0.74 }} />
            </div>
          </div>
        ))}
      </div>
    </ChartShell>
  )
}

function ResponseReadinessGraph({ regionData, selectedRegion }: {
  regionData: RegionData[]; selectedRegion: RegionData | null
}) {
  const readiness = responseReadinessScore(selectedRegion, regionData)
  const checklist = buildResponseChecklist(Number(selectedRegion?.risk_score ?? average(regionData.map(r => Number(r.risk_score ?? 0)))))
  return (
    <ChartShell title="Response Readiness Indicators" subtitle="Operational readiness based on severity and resilience" stat={readiness} statLabel="readiness">
      <div className="grid grid-cols-1 gap-2 pt-1 sm:grid-cols-5">
        {checklist.map(item => (
          <div key={item.category} className={`rounded-lg border p-3 ${item.active ? 'border-emerald-500/20 bg-emerald-500/10' : 'border-white/8 bg-white/3'}`}>
            <div className={`text-xl font-bold ${item.active ? 'text-emerald-300' : 'text-gray-600'}`}>{item.active ? 'ON' : 'IDLE'}</div>
            <div className="mt-1 text-[10px] uppercase tracking-widest text-gray-500">{item.category}</div>
          </div>
        ))}
      </div>
    </ChartShell>
  )
}

function RegionalComparisonGraph({ regionData, onSelectRegion }: {
  regionData: RegionData[]; onSelectRegion: (region: RegionData) => void
}) {
  const ranked = [...regionData]
    .map(r => {
      const risk     = Number(r.risk_score ?? 0)
      const rainfall = Number(r.rainfall_mm ?? 0)
      const water    = Number(r.water_level_index ?? 0)
      const alert    = risk >= 70 ? 100 : risk >= 50 ? 70 : risk >= 45 ? 45 : 20
      const exposure = clamp(risk * 0.48 + rainfall * 0.92 + water * 0.28 + alert * 0.12, 0, 100)
      return { region: r, risk, rainfall, water, alert, exposure }
    })
    .sort((a, b) => b.exposure - a.exposure)
    .slice(0, 5)

  return (
    <ChartShell title="Regional Risk Comparison" subtitle="Ranked exposure, rainfall stress, water load, alert pressure" stat={ranked[0]?.region.city ?? '--'} statLabel="top watch">
      <div className="space-y-2 pt-1">
        {ranked.map((item, i) => (
          <button key={`${item.region.city}-${i}`} onClick={() => onSelectRegion(item.region)}
            className="group grid w-full grid-cols-[28px_112px_1fr_46px] items-center gap-3 rounded-lg border border-white/5 bg-white/[0.025] px-3 py-2 text-left transition-colors hover:border-emerald-500/25 hover:bg-emerald-500/5">
            <div className="text-xs text-gray-600 tabular-nums">{String(i + 1).padStart(2, '0')}</div>
            <div>
              <div className="truncate text-xs font-semibold text-gray-200">{item.region.city}</div>
              <div className="truncate text-[10px] text-gray-600">{item.region.country}</div>
            </div>
            <div className="h-8 overflow-hidden rounded bg-white/5">
              <div className="flex h-full">
                <motion.div initial={{ width: 0 }} animate={{ width: `${item.risk}%` }} className="bg-red-400/75" />
                <motion.div initial={{ width: 0 }} animate={{ width: `${clamp(item.rainfall, 0, 100)}%` }} className="bg-cyan-400/70" />
                <motion.div initial={{ width: 0 }} animate={{ width: `${item.water}%` }} className="bg-emerald-400/65" />
                <motion.div initial={{ width: 0 }} animate={{ width: `${item.alert * 0.35}%` }} className="bg-amber-400/75" />
              </div>
            </div>
            <div className="text-right text-sm font-bold tabular-nums text-emerald-300">{formatDisplayNumber(item.exposure, 0)}</div>
          </button>
        ))}
      </div>
      <div className="mt-3 flex gap-4 text-[10px] uppercase tracking-widest text-gray-600">
        <LegendDot color="#f87171" label="Risk" />
        <LegendDot color="#22d3ee" label="Rain" />
        <LegendDot color="#34d399" label="Water" />
        <LegendDot color="#f59e0b" label="Alert" />
      </div>
    </ChartShell>
  )
}

function InfrastructureStressGraph({ regionData, selectedRegion }: {
  regionData: RegionData[]; selectedRegion: RegionData | null
}) {
  const selected = infrastructureProfile(selectedRegion, regionData)
  const metrics  = [
    { label: 'Drainage',   value: selected.drainageStress,       avg: selected.network.drainageStress,       color: '#60a5fa' },
    { label: 'Runoff',     value: selected.runoffPressure,        avg: selected.network.runoffPressure,        color: '#22d3ee' },
    { label: 'Watershed',  value: selected.watershedDegradation,  avg: selected.network.watershedDegradation,  color: '#f59e0b' },
    { label: 'Infra',      value: selected.infrastructureStrain,  avg: selected.network.infrastructureStrain,  color: '#f87171' },
    { label: 'Resilience', value: selected.resilienceScore,       avg: selected.network.resilienceScore,       color: '#34d399' },
  ]
  const stress = clamp(
    selected.drainageStress * 0.26 + selected.runoffPressure * 0.24
    + selected.watershedDegradation * 0.2 + selected.infrastructureStrain * 0.2
    + (100 - selected.resilienceScore) * 0.1, 0, 100,
  )

  return (
    <ChartShell title="Infrastructure Stress Matrix" subtitle={`${selectedRegion?.city ?? 'Network'} drainage, runoff, watershed and resilience indices`} stat={formatDisplayNumber(stress, 0)} statLabel="strain index">
      <div className="space-y-3">
        {metrics.map((metric) => (
          <div key={metric.label}>
            <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-widest">
              <span className="text-gray-500">{metric.label}</span>
              <span className="text-gray-400 tabular-nums">
                {formatDisplayNumber(metric.value, 0)} / avg {formatDisplayNumber(metric.avg, 0)}
              </span>
            </div>
            <div className="relative h-7 overflow-hidden rounded bg-white/[0.035]">
              <div className="absolute inset-y-0 w-px bg-white/35" style={{ left: `${clamp(metric.avg, 0, 100)}%` }} />
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${clamp(metric.value, 0, 100)}%` }}
                className="h-full rounded-r"
                style={{ backgroundColor: metric.color, opacity: 0.72 }}
              />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 text-[10px] leading-relaxed text-gray-500">
        White markers show the monitored network average; bars show selected region pressure from ML feature fields and live or historical telemetry.
      </div>
    </ChartShell>
  )
}

function VulnerabilityDistributionGraph({ regionData, dataMode }: {
  regionData: RegionData[]; dataMode: DataMode
}) {
  const buckets = [
    { label: 'LOW',  min: 0,  max: 25,  color: '#22d3ee' },
    { label: 'MOD',  min: 25, max: 50,  color: '#34d399' },
    { label: 'HIGH', min: 50, max: 75,  color: '#f59e0b' },
    { label: 'CRIT', min: 75, max: 101, color: '#ef4444' },
  ].map(bucket => {
    const items = regionData.filter(r => {
      const score = Number(r.risk_score ?? 0)
      return score >= bucket.min && score < bucket.max
    })
    return { ...bucket, count: items.length,
      rainfall: average(items.map(r => Number(r.rainfall_mm ?? 0))),
      water: average(items.map(r => Number(r.water_level_index ?? 0))),
    }
  })
  const maxCount = Math.max(1, ...buckets.map(b => b.count))
  const dominant = buckets.slice().sort((a, b) => b.count - a.count)[0]

  return (
    <ChartShell title="Vulnerability Distribution" subtitle={`Risk bands from ${dataMode} region intelligence`} stat={dominant?.label ?? '--'} statLabel="dominant band">
      <svg viewBox="0 0 640 300" className="h-[300px] w-full overflow-visible">
        <ChartGrid width={640} height={300} />
        {buckets.map((bucket, i) => {
          const x      = 72 + i * 132
          const h      = (bucket.count / maxCount) * 190
          const waterY = 252 - clamp(bucket.water, 0, 100) * 1.9
          return (
            <g key={bucket.label}>
              <motion.rect initial={{ height: 0, y: 252 }} animate={{ height: h, y: 252 - h }} x={x} width="64" rx="6" fill={bucket.color} fillOpacity="0.72" />
              <circle cx={x + 32} cy={waterY} r="5" fill="#a7f3d0" fillOpacity="0.78" />
              <text x={x + 32} y="278" textAnchor="middle" fill="#94a3b8" fontSize="10">{bucket.label}</text>
              <text x={x + 32} y={244 - h} textAnchor="middle" fill="#e5fff7" fontSize="11" fontWeight="700">{formatDisplayNumber(bucket.count, 0)}</text>
              <text x={x + 32} y={Math.min(246, waterY + 18)} textAnchor="middle" fill="#64748b" fontSize="9">{formatMetric(bucket.rainfall, 'mm', 1)}</text>
            </g>
          )
        })}
        <ChartLegend items={[['Region count', '#34d399'], ['Avg water index', '#a7f3d0'], ['Avg rainfall label', '#64748b']]} />
      </svg>
    </ChartShell>
  )
}

function WeatherCorrelationGraph({ regionData }: { regionData: RegionData[] }) {
  const points   = regionData.map(r => ({
    city: r.city ?? '',
    rainfall: Number(r.rainfall_mm ?? 0),
    humidity: Number(r.humidity_percent ?? r.current_weather?.relative_humidity_2m ?? 0),
    water: Number(r.water_level_index ?? 0),
    risk: Number(r.risk_score ?? 0),
  }))
  const maxRain  = Math.max(20, ...points.map(p => p.rainfall))
  const corr     = correlation(points.map(p => p.rainfall + p.humidity * 0.08 + p.water * 0.25), points.map(p => p.risk))

  return (
    <ChartShell title="Weather vs Flood Correlation" subtitle="Rainfall probability, humidity drag, environmental pressure" stat={formatDisplayNumber(corr)} statLabel="corr coeff">
      <svg viewBox="0 0 640 300" className="h-[300px] w-full overflow-visible">
        <ChartGrid width={640} height={300} />
        <text x="22" y="24" fill="#64748b" fontSize="10">Risk probability</text>
        <text x="530" y="284" fill="#64748b" fontSize="10">Weather pressure</text>
        {points.map((p, i) => {
          const x     = 34 + (p.rainfall / maxRain) * 540 + p.humidity * 0.32
          const y     = 266 - p.risk * 2.25
          const color = p.water > 60 ? '#ef4444' : p.water > 45 ? '#f59e0b' : '#22d3ee'
          return (
            <g key={`${p.city}-${i}`}>
              <circle cx={x} cy={y} r={3 + p.water / 25} fill={color} fillOpacity="0.68" stroke="#e5fff7" strokeOpacity="0.35" />
              {i < 6 && <text x={x + 8} y={y + 3} fill="#94a3b8" fontSize="9">{p.city.slice(0, 9)}</text>}
            </g>
          )
        })}
        <path d={`M 42 ${260 - avgRiskLine(points) * 2.1} C 180 220, 330 170, 610 ${235 - clamp(corr * 80, -60, 80)}`} fill="none" stroke="#34d399" strokeWidth="2" strokeDasharray="5 5" opacity="0.8" />
        <ChartLegend items={[['Rainfall x risk', '#22d3ee'], ['Water pressure', '#f59e0b'], ['Critical load', '#ef4444']]} />
      </svg>
    </ChartShell>
  )
}

function HistoricalPatternGraph({ regionData, dataMode }: { regionData: RegionData[]; dataMode: DataMode }) {
  const avgRisk  = average(regionData.map(r => Number(r.risk_score ?? 0)))
  const avgRain  = average(regionData.map(r => Number(r.rainfall_mm ?? 0)))
  const avgWater = average(regionData.map(r => Number(r.water_level_index ?? 0)))
  const months   = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D']
  const seasonalCurve = [0.34, 0.28, 0.32, 0.42, 0.58, 0.9, 1, 0.96, 0.78, 0.62, 0.48, 0.38]
  const seasonal = seasonalCurve.map((m, i) => clamp(avgRisk * 0.45 + avgRain * m * 1.25 + avgWater * 0.3 + (i >= 5 && i <= 8 ? 12 : 0), 0, 100))
  const cumulative = seasonal.reduce<number[]>((acc, v, i) => { acc.push((acc[i - 1] ?? 0) + v); return acc }, [])
  const maxCum   = Math.max(...cumulative, 1)
  const years    = ['2021', '2022', '2023', '2024', '2025', '2026']
  const yearly   = years.map((_, i) => clamp(avgRisk * (0.82 + i * 0.035) + avgWater * 0.18 + (dataMode === 'live' ? avgRain * 0.18 : 0), 0, 100))

  return (
    <ChartShell title="Historical Flood Pattern Analysis" subtitle="Seasonal cycles, intensity trend, cumulative exposure" stat={seasonal.indexOf(Math.max(...seasonal)) + 1} statLabel="peak month">
      <svg viewBox="0 0 640 300" className="h-[300px] w-full overflow-visible">
        <ChartGrid width={640} height={300} />
        {seasonal.map((v, i) => {
          const x     = 34 + i * 49
          const h     = v * 1.95
          const color = v > 70 ? '#ef4444' : v > 50 ? '#f59e0b' : '#22d3ee'
          return (
            <g key={`${months[i]}-${i}`}>
              <motion.rect initial={{ height: 0, y: 260 }} animate={{ height: h, y: 260 - h }} x={x} width="26" rx="4" fill={color} fillOpacity="0.72" />
              <text x={x + 13} y="282" textAnchor="middle" fill="#64748b" fontSize="10">{months[i]}</text>
            </g>
          )
        })}
        <path d={linePath(cumulative.map(v => (v / maxCum) * 100), 560, 210, 42, 42)} fill="none" stroke="#34d399" strokeWidth="3" opacity="0.9" />
        <path d={linePath(yearly, 250, 90, 350, 52)} fill="none" stroke="#a78bfa" strokeWidth="2.5" opacity="0.9" />
        {years.map((year, i) => (
          <text key={year} x={350 + i * 50} y="160" fill="#64748b" fontSize="9" textAnchor="middle">{year.slice(2)}</text>
        ))}
        <ChartLegend items={[['Seasonal intensity', '#22d3ee'], ['Cumulative exposure', '#34d399'], ['Year trend', '#a78bfa']]} />
      </svg>
    </ChartShell>
  )
}

function ChartShell({ title, subtitle, stat, statLabel, children }: {
  title: string; subtitle: string; stat: string | number; statLabel: string; children: React.ReactNode
}) {
  const displayStat = typeof stat === 'number' ? formatDisplayNumber(stat) : stat
  return (
    <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="rounded-lg border border-emerald-500/15 bg-[#020b16]/82 p-4 shadow-[0_0_34px_rgba(16,185,129,0.08)]">
      <div className="mb-3 flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-bold uppercase tracking-wider text-gray-100">{title}</div>
          <div className="mt-0.5 text-[10px] text-gray-500">{subtitle}</div>
        </div>
        <div className="text-right">
          <div className="text-xl font-bold tabular-nums text-emerald-300">{displayStat}</div>
          <div className="text-[10px] uppercase tracking-widest text-gray-600">{statLabel}</div>
        </div>
      </div>
      {children}
    </motion.section>
  )
}

function Sparkline({ values, color }: { values: number[]; color: string }) {
  const safeValues = values.length ? values.slice(0, 18) : [0]
  return (
    <svg viewBox="0 0 120 26" className="mt-2 h-7 w-full">
      <path d={linePath(safeValues, 112, 20, 4, 3)} fill="none" stroke={color} strokeWidth="2" opacity="0.85" />
    </svg>
  )
}

function ChartGrid({ width, height }: { width: number; height: number }) {
  return (
    <g opacity="0.75">
      {[0, 1, 2, 3, 4].map(i => (
        <line key={`h-${i}`} x1="22" y1={28 + i * ((height - 60) / 4)} x2={width - 20} y2={28 + i * ((height - 60) / 4)} stroke="#12303b" strokeWidth="1" />
      ))}
      {[0, 1, 2, 3, 4, 5].map(i => (
        <line key={`v-${i}`} x1={22 + i * ((width - 42) / 5)} y1="28" x2={22 + i * ((width - 42) / 5)} y2={height - 32} stroke="#10252f" strokeWidth="1" />
      ))}
    </g>
  )
}

function ChartLegend({ items }: { items: Array<[string, string]> }) {
  return (
    <g transform="translate(28 12)">
      {items.map(([label, color], i) => (
        <g key={label} transform={`translate(${i * 112} 0)`}>
          <circle cx="0" cy="0" r="3" fill={color} />
          <text x="8" y="3" fill="#64748b" fontSize="9">{label}</text>
        </g>
      ))}
    </g>
  )
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// UTILITY / MATH HELPERS
// ══════════════════════════════════════════════════════════════════════════════

type InfrastructureImpactEstimate = {
  roadsKm: number
  hospitals: number
  schools: number
  power: number
  criticalFacilities: number
}

type InfrastructureInventory = {
  hospitals?: number
  schools?: number
  road_km?: number
  power_assets?: number
  critical_facilities?: number
}

function severityFromScore(score: number) {
  if (score >= 85) return { label: 'Extreme', color: '#a855f7' }
  if (score >= 70) return { label: 'Severe', color: '#ef4444' }
  if (score >= 50) return { label: 'High', color: '#f97316' }
  if (score >= 25) return { label: 'Moderate', color: '#f59e0b' }
  return { label: 'Low', color: '#22c55e' }
}

function estimateRegionPopulation(region: RegionData | null | undefined): number {
  const populationScore = feature(region, 'PopulationScore', 50)
  const urbanization = feature(region, 'Urbanization', 50)
  const baseline = Number(region?.baseline_vulnerability_score ?? 50)
  const continentFactor = region?.continent === 'Asia' ? 1.22 : region?.continent === 'Africa' ? 1.08 : 0.92
  return Math.round((60000 + populationScore * populationScore * 1450 + urbanization * 18500 + baseline * 9000) * continentFactor)
}

function estimateExposedPopulation(region: RegionData | null | undefined, regionData: RegionData[]): number {
  if (!region || region.city === ALL_CITIES_LABEL) {
    return Math.round(regionData.reduce((sum, item) => sum + estimateExposedPopulation(item, regionData), 0))
  }
  if (Number.isFinite(Number(region.exposed_population))) return Math.round(Number(region.exposed_population))
  const risk = Number(region.risk_score ?? 0)
  const vulnerability = Number(region.baseline_vulnerability_score ?? feature(region, 'PopulationScore', 50))
  const rainfall = Number(region.rainfall_mm ?? 0)
  const water = Number(region.water_level_index ?? 0)
  const exposureRate = clamp(
    risk * 0.0048 + vulnerability * 0.0022 + Math.min(rainfall, 180) * 0.0011 + water * 0.0015,
    0.015,
    0.78,
  )
  return Math.round(estimateRegionPopulation(region) * exposureRate)
}

function infrastructureInventory(region: RegionData | null | undefined): Required<InfrastructureInventory> {
  const inventory = region?.infrastructure ?? {}
  return {
    hospitals: Number.isFinite(Number(inventory.hospitals)) ? Number(inventory.hospitals) : 0,
    schools: Number.isFinite(Number(inventory.schools)) ? Number(inventory.schools) : 0,
    road_km: Number.isFinite(Number(inventory.road_km)) ? Number(inventory.road_km) : 0,
    power_assets: Number.isFinite(Number(inventory.power_assets)) ? Number(inventory.power_assets) : 0,
    critical_facilities: Number.isFinite(Number(inventory.critical_facilities)) ? Number(inventory.critical_facilities) : 0,
  }
}

function estimateInfrastructureImpact(region: RegionData | null | undefined, regionData: RegionData[]): InfrastructureImpactEstimate {
  if (!region || region.city === ALL_CITIES_LABEL) {
    return regionData.reduce<InfrastructureImpactEstimate>((sum, item) => {
      const impact = estimateInfrastructureImpact(item, regionData)
      return {
        roadsKm: sum.roadsKm + impact.roadsKm,
        hospitals: sum.hospitals + impact.hospitals,
        schools: sum.schools + impact.schools,
        power: sum.power + impact.power,
        criticalFacilities: sum.criticalFacilities + impact.criticalFacilities,
      }
    }, { roadsKm: 0, hospitals: 0, schools: 0, power: 0, criticalFacilities: 0 })
  }
  const risk = Number(region.risk_score ?? 0)
  const infra = infrastructureProfile(region ?? null, regionData)
  const inventory = infrastructureInventory(region)
  const exposedPopulation = estimateExposedPopulation(region, regionData)
  const populationPressure = clamp(Math.log10(Math.max(10, exposedPopulation)) * 7, 0, 45)
  const rainfallSeverity = clamp(Number(region.rainfall_mm ?? 0) / 2.2, 0, 100)
  const vulnerability = Number(region.baseline_vulnerability_score ?? feature(region, 'PopulationScore', 50))
  const exposureRate = clamp(
    risk * 0.0048
    + vulnerability * 0.0018
    + rainfallSeverity * 0.0015
    + infra.infrastructureStrain * 0.0012
    + infra.drainageStress * 0.0009
    + populationPressure * 0.001,
    0,
    0.92,
  )
  return {
    roadsKm: Math.round(clamp(inventory.road_km * exposureRate, 0, inventory.road_km) * 10) / 10,
    hospitals: Math.round(clamp(inventory.hospitals * exposureRate, 0, inventory.hospitals)),
    schools: Math.round(clamp(inventory.schools * exposureRate, 0, inventory.schools)),
    power: Math.round(clamp(inventory.power_assets * exposureRate, 0, inventory.power_assets)),
    criticalFacilities: Math.round(clamp(inventory.critical_facilities * exposureRate, 0, inventory.critical_facilities)),
  }
}

function responseReadinessScore(region: RegionData | null | undefined, regionData: RegionData[]): number {
  const infra = infrastructureProfile(region ?? null, regionData)
  const risk = Number(region?.risk_score ?? average(regionData.map(r => Number(r.risk_score ?? 0))))
  return Math.round(clamp(infra.resilienceScore * 0.62 + (100 - risk) * 0.22 + (100 - infra.infrastructureStrain) * 0.16, 0, 100))
}

function buildResponseChecklist(score: number) {
  const severity = severityFromScore(score).label
  const isModerate = score >= 25
  const isHigh = score >= 50
  const isSevere = score >= 70
  const isExtreme = score >= 85
  return [
    { category: 'Monitoring', active: true, action: isModerate ? `Maintain ${severity.toLowerCase()} watch cadence and verify rainfall telemetry every cycle.` : 'Continue routine river, rainfall, and cache telemetry checks.' },
    { category: 'Evacuation', active: isHigh, action: isHigh ? 'Pre-stage evacuation routes and confirm shelter readiness for exposed wards.' : 'Keep shelter and route inventory ready for escalation.' },
    { category: 'Emergency Services', active: isSevere, action: isSevere ? 'Place rescue, medical, and incident command units on active deployment posture.' : 'Confirm team availability and mutual-aid contacts.' },
    { category: 'Infrastructure Protection', active: isHigh, action: isHigh ? 'Inspect drainage, power nodes, hospitals, schools, and road chokepoints.' : 'Prioritize maintenance checks for drainage and utility assets.' },
    { category: 'Public Communication', active: isModerate, action: isExtreme ? 'Issue urgent public advisories with evacuation and road-closure instructions.' : isModerate ? 'Publish watch advisories and preparedness guidance.' : 'Maintain standard public information monitoring.' },
  ]
}

function buildTelemetryCsv(rows: RegionData[], dataMode: DataMode) {
  const headers = [
    'city',
    'country',
    'timestamp',
    'rainfall_mm',
    'flood_risk_score',
    'severity',
    'exposed_population',
    'affected_hospitals',
    'affected_schools',
    'affected_road_km',
    'affected_power_assets',
    'affected_critical_facilities',
    'model_prediction',
    'telemetry_mode',
  ]
  const timestamp = new Date().toISOString()
  const escape = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`
  const body = rows.map(region => {
    const score = Number(region.risk_score ?? 0)
    const impact = estimateInfrastructureImpact(region, rows)
    return [
      region.city,
      region.country,
      timestamp,
      Number(region.rainfall_mm ?? 0).toFixed(2),
      score.toFixed(2),
      severityFromScore(score).label,
      estimateExposedPopulation(region, rows),
      impact.hospitals,
      impact.schools,
      impact.roadsKm.toFixed(1),
      impact.power,
      impact.criticalFacilities,
      region.model_type ?? region.inference_status ?? 'GradientBoostingRegressor',
      region.mode ?? dataMode.toUpperCase(),
    ].map(escape).join(',')
  })
  return [headers.join(','), ...body].join('\n')
}

function downloadCsv(filename: string, csv: string) {
  if (typeof window === 'undefined') return
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function commandColors(accent: 'emerald' | 'cyan' | 'red' | 'blue' | 'violet' | 'amber') {
  const map = {
    emerald: { text: 'text-emerald-300', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', dot: 'bg-emerald-400', hex: '#0d9488' },
    cyan:    { text: 'text-cyan-300',    bg: 'bg-cyan-500/10',    border: 'border-cyan-500/20',    dot: 'bg-cyan-400',    hex: '#0891b2' },
    red:     { text: 'text-red-300',     bg: 'bg-red-500/10',     border: 'border-red-500/20',     dot: 'bg-red-400',     hex: '#be123c' },
    blue:    { text: 'text-blue-300',    bg: 'bg-blue-500/10',    border: 'border-blue-500/20',    dot: 'bg-blue-400',    hex: '#475569' },
    violet:  { text: 'text-violet-300',  bg: 'bg-violet-500/10',  border: 'border-violet-500/20',  dot: 'bg-violet-400',  hex: '#7c3aed' },
    amber:   { text: 'text-amber-300',   bg: 'bg-amber-500/10',   border: 'border-amber-500/20',   dot: 'bg-amber-400',   hex: '#b45309' },
  }
  return map[accent]
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min))
}

function average(values: number[]) {
  const clean = values.filter(Number.isFinite)
  return clean.length ? clean.reduce((sum, value) => sum + value, 0) / clean.length : 0
}

function pctDelta(value: number, baseline: number) {
  if (!Number.isFinite(value) || !Number.isFinite(baseline) || baseline === 0) return 0
  return ((value - baseline) / baseline) * 100
}

function feature(region: RegionData | null | undefined, name: string, fallback = 50) {
  const value = region?.ml_features?.[name]
  return Number.isFinite(Number(value)) ? Number(value) : fallback
}

function infraValue(region: RegionData | null | undefined, key: string, fallback: number) {
  const value = region?.infrastructure_intelligence?.[key]
  return Number.isFinite(Number(value)) ? Number(value) : fallback
}

function infrastructureProfile(region: RegionData | null, regionData: RegionData[]) {
  const avg       = (key: string) => average(regionData.map(item => infraValue(item, key, 50)))
  const rainfall  = Number(region?.rainfall_mm ?? average(regionData.map(item => Number(item.rainfall_mm ?? 0))))
  return {
    drainageStress:      infraValue(region, 'drainage_stress',      clamp(feature(region, 'DrainageSystems') * 0.55 + feature(region, 'TopographyDrainage') * 0.3 + rainfall * 0.15, 0, 100)),
    runoffPressure:      infraValue(region, 'runoff_pressure',      clamp(feature(region, 'Urbanization') * 0.42 + feature(region, 'WetlandLoss') * 0.33 + feature(region, 'Encroachments') * 0.25, 0, 100)),
    watershedDegradation:infraValue(region, 'watershed_degradation',clamp(feature(region, 'Watersheds') * 0.42 + feature(region, 'Siltation') * 0.32 + feature(region, 'Deforestation') * 0.26, 0, 100)),
    coastalExposure:     infraValue(region, 'coastal_exposure',     clamp(feature(region, 'CoastalVulnerability', 0) * 0.76 + feature(region, 'ClimateChange') * 0.24, 0, 100)),
    infrastructureStrain:infraValue(region, 'infrastructure_strain',clamp(feature(region, 'DeterioratingInfrastructure') * 0.34 + (100 - feature(region, 'DamsQuality')) * 0.24 + feature(region, 'InadequatePlanning') * 0.2 + feature(region, 'PopulationScore') * 0.22, 0, 100)),
    resilienceScore:     infraValue(region, 'resilience_score', 50),
    climateEscalation:   infraValue(region, 'climate_escalation', feature(region, 'ClimateChange')),
    network: {
      drainageStress:       avg('drainage_stress'),
      runoffPressure:       avg('runoff_pressure'),
      watershedDegradation: avg('watershed_degradation'),
      infrastructureStrain: avg('infrastructure_strain'),
      resilienceScore:      avg('resilience_score'),
    },
  }
}

function buildIntelligenceInsights({
  region, regionData, dataMode, rank, score, avgRisk,
  currentRain, avgRain, currentWater, avgWater, infra,
}: {
  region: RegionData | null; regionData: RegionData[]; dataMode: DataMode
  rank: number; score: number; avgRisk: number
  currentRain: number; avgRain: number; currentWater: number; avgWater: number
  infra: ReturnType<typeof infrastructureProfile>
}) {
  const riskDelta  = pctDelta(score, avgRisk)
  const rainDelta  = pctDelta(currentRain, avgRain)
  const waterDelta = pctDelta(currentWater, avgWater)
  const location   = region?.city ?? ALL_CITIES_LABEL
  const recurrenceSignal = clamp(score * 0.45 + infra.watershedDegradation * 0.22 + currentWater * 0.2 + feature(region, 'MonsoonIntensity') * 0.13, 0, 100)

  return [
    score > 70
      ? `${location} is in critical flood exposure: ML risk is ${formatDisplayNumber(Math.abs(riskDelta), 0)}% ${riskDelta >= 0 ? 'above' : 'below'} the monitored regional baseline.`
      : score > 45
      ? `${location} is elevated but not yet critical; risk is ${formatDisplayNumber(Math.abs(riskDelta), 0)}% ${riskDelta >= 0 ? 'above' : 'below'} the network baseline.`
      : `${location} remains in routine watch, with ML risk ${formatDisplayNumber(Math.abs(riskDelta), 0)}% ${riskDelta >= 0 ? 'above' : 'below'} the regional baseline.`,
    rank
      ? `${location} ranks ${rank} of ${regionData.length} for current flood exposure, driven by rainfall, water load, and static vulnerability features.`
      : `${ALL_CITIES_LABEL} aggregate risk is ${formatDisplayNumber(score)} against a network average of ${formatDisplayNumber(avgRisk)}.`,
    `Rainfall stress is ${formatDisplayNumber(Math.abs(rainDelta), 0)}% ${rainDelta >= 0 ? 'above' : 'below'} baseline at ${formatMetric(currentRain, 'mm', 1)}, while water index is ${formatDisplayNumber(Math.abs(waterDelta), 0)}% ${waterDelta >= 0 ? 'above' : 'below'} baseline.`,
    `Drainage vulnerability reads ${formatDisplayNumber(infra.drainageStress, 0)}/100 and runoff pressure reads ${formatDisplayNumber(infra.runoffPressure, 0)}/100, indicating ${infra.runoffPressure > 65 ? 'urban runoff amplification' : 'contained runoff pressure'} under ${dataMode} telemetry.`,
    `Watershed instability is ${formatDisplayNumber(infra.watershedDegradation, 0)}/100; recurrence pressure is ${formatDisplayNumber(recurrenceSignal, 0)}/100 after blending model risk, water load, watershed condition, and monsoon signal.`,
    infra.coastalExposure > 55
      ? `Coastal exposure contributes ${formatDisplayNumber(infra.coastalExposure, 0)}/100, so drainage decisions should account for tide, estuary, or storm-surge coupling.`
      : `Infrastructure strain is ${formatDisplayNumber(infra.infrastructureStrain, 0)}/100 with resilience at ${formatDisplayNumber(infra.resilienceScore, 0)}/100, keeping the main watch on drainage capacity and watershed behavior.`,
    `Model output is sourced from ${dataMode === 'live' ? 'live regional Gradient Boost inference' : 'historical Gradient Boost inference'} using processed region features, not a static UI score.`,
  ]
}

function riskStatusFromScore(score: number) {
  if (score < 25) return 'LOW'
  if (score < 50) return 'MODERATE'
  if (score < 75) return 'HIGH'
  return 'CRITICAL'
}

function buildGlobalRegion(regionData: RegionData[]): RegionData | null {
  if (!regionData.length) return null
  const risks      = regionData.map(r => Number(r.risk_score ?? 0))
  const rainfall   = regionData.map(r => Number(r.rainfall_mm ?? 0))
  const humidity   = regionData.map(r => Number(r.humidity_percent ?? r.current_weather?.relative_humidity_2m ?? 0))
  const water      = regionData.map(r => Number(r.water_level_index ?? 0))
  const latitudes  = regionData.map(r => Number(r.latitude ?? r.lat)).filter(Number.isFinite)
  const longitudes = regionData.map(r => Number(r.longitude ?? r.lng)).filter(Number.isFinite)
  const riskScore  = average(risks)
  const modelType  = regionData.find(r => r.model_type === PRODUCTION_MODEL_TYPE)?.model_type
    ?? regionData.find(r => r.model_type)?.model_type

  return {
    city:     ALL_CITIES_LABEL,
    country:  GLOBAL_MONITORING_LABEL,
    latitude: average(latitudes),
    longitude:average(longitudes),
    current_weather: {},
    risk_score:   riskScore,
    risk_status:  riskStatusFromScore(riskScore),
    rainfall_mm:  average(rainfall),
    humidity_percent: average(humidity),
    water_level_index: average(water),
    status:    regionData.some(r => r.status === 'LIVE') ? 'LIVE' : regionData[0]?.status ?? 'CACHED',
    mode:      regionData[0]?.mode,
    model_type: modelType,
    inference_status: `${regionData.length} region aggregate`,
    baseline_vulnerability_score: average(regionData.map(r => Number(r.baseline_vulnerability_score ?? 50))),
    ml_features: {
      MonsoonIntensity:    average(regionData.map(r => feature(r, 'MonsoonIntensity'))),
      DrainageSystems:     average(regionData.map(r => feature(r, 'DrainageSystems'))),
      TopographyDrainage:  average(regionData.map(r => feature(r, 'TopographyDrainage'))),
      Urbanization:        average(regionData.map(r => feature(r, 'Urbanization'))),
      WetlandLoss:         average(regionData.map(r => feature(r, 'WetlandLoss'))),
      Encroachments:       average(regionData.map(r => feature(r, 'Encroachments'))),
      Watersheds:          average(regionData.map(r => feature(r, 'Watersheds'))),
      Siltation:           average(regionData.map(r => feature(r, 'Siltation'))),
      Deforestation:       average(regionData.map(r => feature(r, 'Deforestation'))),
      CoastalVulnerability:average(regionData.map(r => feature(r, 'CoastalVulnerability', 0))),
      ClimateChange:       average(regionData.map(r => feature(r, 'ClimateChange'))),
      DeterioratingInfrastructure: average(regionData.map(r => feature(r, 'DeterioratingInfrastructure'))),
      DamsQuality:         average(regionData.map(r => feature(r, 'DamsQuality'))),
      InadequatePlanning:  average(regionData.map(r => feature(r, 'InadequatePlanning'))),
      PopulationScore:     average(regionData.map(r => feature(r, 'PopulationScore'))),
    },
    infrastructure: {
      hospitals:           regionData.reduce((sum, r) => sum + infrastructureInventory(r).hospitals, 0),
      schools:             regionData.reduce((sum, r) => sum + infrastructureInventory(r).schools, 0),
      road_km:             Math.round(regionData.reduce((sum, r) => sum + infrastructureInventory(r).road_km, 0) * 10) / 10,
      power_assets:        regionData.reduce((sum, r) => sum + infrastructureInventory(r).power_assets, 0),
      critical_facilities: regionData.reduce((sum, r) => sum + infrastructureInventory(r).critical_facilities, 0),
    },
    infrastructure_intelligence: {
      drainage_stress:          average(regionData.map(r => infraValue(r, 'drainage_stress', 50))),
      runoff_pressure:          average(regionData.map(r => infraValue(r, 'runoff_pressure', 50))),
      watershed_degradation:    average(regionData.map(r => infraValue(r, 'watershed_degradation', 50))),
      coastal_exposure:         average(regionData.map(r => infraValue(r, 'coastal_exposure', 50))),
      infrastructure_strain:    average(regionData.map(r => infraValue(r, 'infrastructure_strain', 50))),
      resilience_score:         average(regionData.map(r => infraValue(r, 'resilience_score', 50))),
      climate_escalation:       average(regionData.map(r => infraValue(r, 'climate_escalation', 50))),
    },
  }
}

function standardDeviation(values: number[]) {
  const mean  = average(values)
  const clean = values.filter(Number.isFinite)
  if (!clean.length) return 0
  return Math.sqrt(clean.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / clean.length)
}

function correlation(xs: number[], ys: number[]) {
  const n = Math.min(xs.length, ys.length)
  if (n < 2) return 0
  const x     = xs.slice(0, n)
  const y     = ys.slice(0, n)
  const xMean = average(x)
  const yMean = average(y)
  const numerator   = x.reduce((sum, value, i) => sum + (value - xMean) * (y[i] - yMean), 0)
  const denominator = Math.sqrt(
    x.reduce((sum, value) => sum + Math.pow(value - xMean, 2), 0)
    * y.reduce((sum, value) => sum + Math.pow(value - yMean, 2), 0)
  )
  return denominator ? numerator / denominator : 0
}

function movingAverage(values: number[], windowSize: number) {
  return values.map((_, index) => {
    const start = Math.max(0, index - windowSize + 1)
    return average(values.slice(start, index + 1))
  })
}

function pointFor(value: number, index: number, total: number, width: number, height: number, x0: number, y0: number): [number, number] {
  const x = x0 + (index / Math.max(1, total - 1)) * width
  const y = y0 + height - (clamp(value, 0, 100) / 100) * height
  return [x, y]
}

function linePath(values: number[], width: number, height: number, x0: number, y0: number) {
  if (!values.length) return ''
  return values.map((value, index) => {
    const [x, y] = pointFor(value, index, values.length, width, height, x0, y0)
    return `${index === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`
  }).join(' ')
}

function bandPath(values: number[], band: number, width: number, height: number, x0: number, y0: number) {
  if (!values.length) return ''
  const upper = values.map(v => clamp(v + band, 0, 100))
  const lower = values.map(v => clamp(v - band, 0, 100)).reverse()
  const upperPath = upper.map((value, index) => {
    const [x, y] = pointFor(value, index, upper.length, width, height, x0, y0)
    return `${index === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`
  })
  const lowerPath = lower.map((value, reverseIndex) => {
    const index = lower.length - 1 - reverseIndex
    const [x, y] = pointFor(value, index, lower.length, width, height, x0, y0)
    return `L ${x.toFixed(1)} ${y.toFixed(1)}`
  })
  return `${upperPath.join(' ')} ${lowerPath.join(' ')} Z`
}

function avgRiskLine(points: Array<{ risk: number }>) {
  return average(points.map(point => point.risk))
}
