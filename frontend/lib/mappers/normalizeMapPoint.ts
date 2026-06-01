/**
 * normalizeMapPoint.ts
 *
 * Single source of truth for transforming any raw region/API shape
 * into the canonical MapPoint schema expected by InteractiveFloodMap.
 *
 * Place this at:  src/lib/normalizeMapPoint.ts
 */

// ── Canonical schema ──────────────────────────────────────────────────────────
// This is the ONLY shape InteractiveFloodMap should ever receive.

export interface MapPoint {
  id:          number | string
  location: {
    latitude:  number
    longitude: number
  }
  intensity:   number
  rainfall_mm: number
  city?:       string
  country?:    string
  exposed_population?: number
  baseline_vulnerability_score?: number
  ml_features?: Record<string, number>
  infrastructure?: {
    hospitals?: number
    schools?: number
    road_km?: number
    power_assets?: number
    critical_facilities?: number
  }
  infrastructure_intelligence?: Record<string, number>
}

// ── Raw input union ───────────────────────────────────────────────────────────
// Covers every real-world shape your backend or regions.json might produce.
// Adding a new backend variant? Add it here — nowhere else.

export interface RawRegionPoint {
  // Flat lat/lng (most common from regions.json + apiClient)
  lat?:       number
  lng?:       number

  // Flat latitude/longitude (alternate flat style)
  latitude?:  number
  longitude?: number

  // Nested location object (legacy / some backends)
  location?: {
    latitude?:  number
    longitude?: number
    lat?:       number
    lng?:       number
  }

  // Risk / intensity fields — multiple naming conventions exist
  intensity?:          number
  risk_score?:         number
  riskScore?:          number
  flood_probability?:  number

  // Rainfall fields
  rainfall_mm?:        number
  rainfall?:           number
  precipitationMm?:    number

  // Identity
  id?:      number | string
  city?:    string
  country?: string

  // Allow any other fields from the API without breaking the type
  [key: string]: unknown
}

// ── Core extractor helpers ────────────────────────────────────────────────────

/**
 * Extracts a valid latitude from any known field layout.
 * Returns null if nothing usable is found — caller decides how to handle.
 */
function extractLatitude(raw: RawRegionPoint): number | null {
  // Nested location object first (highest specificity)
  if (typeof raw.location?.latitude  === 'number') return raw.location.latitude
  if (typeof raw.location?.lat       === 'number') return raw.location.lat

  // Flat fields
  if (typeof raw.latitude            === 'number') return raw.latitude
  if (typeof raw.lat                 === 'number') return raw.lat

  return null
}

/**
 * Extracts a valid longitude from any known field layout.
 * Returns null if nothing usable is found.
 */
function extractLongitude(raw: RawRegionPoint): number | null {
  if (typeof raw.location?.longitude === 'number') return raw.location.longitude
  if (typeof raw.location?.lng       === 'number') return raw.location.lng

  if (typeof raw.longitude           === 'number') return raw.longitude
  if (typeof raw.lng                 === 'number') return raw.lng

  return null
}

/**
 * Extracts the intensity / risk score from any known field name.
 * Falls back to 0 rather than undefined so the map never receives NaN.
 */
function extractIntensity(raw: RawRegionPoint): number {
  if (typeof raw.intensity          === 'number') return raw.intensity
  if (typeof raw.risk_score         === 'number') return raw.risk_score
  if (typeof raw.riskScore          === 'number') return raw.riskScore
  if (typeof raw.flood_probability  === 'number') return raw.flood_probability * 100
  return 0
}

/**
 * Extracts the rainfall figure from any known field name.
 */
function extractRainfall(raw: RawRegionPoint): number {
  if (typeof raw.rainfall_mm      === 'number') return raw.rainfall_mm
  if (typeof raw.rainfall         === 'number') return raw.rainfall
  if (typeof raw.precipitationMm  === 'number') return raw.precipitationMm
  return 0
}

// ── Main exported function ────────────────────────────────────────────────────

/**
 * Converts a single raw region point — regardless of its original shape —
 * into a guaranteed-valid MapPoint.
 *
 * Returns null when the point has no usable coordinates so the caller
 * can filter it out rather than silently rendering at [0, 0].
 *
 * Usage:
 *   const point = normalizeRegionToMapPoint(rawItem, index)
 *   if (!point) return   // skip invalid entries
 */
export function normalizeRegionToMapPoint(
  raw: RawRegionPoint,
  fallbackId: number | string = 0,
): MapPoint | null {
  const latitude  = extractLatitude(raw)
  const longitude = extractLongitude(raw)

  // Hard reject — a point with no coordinates is not renderable.
  // Using null return (not a thrown error) so batch processing can filter
  // bad entries gracefully without crashing the whole map.
  if (latitude === null || longitude === null) {
    if (process.env.NODE_ENV === 'development') {
      console.warn(
        '[normalizeRegionToMapPoint] Could not extract coordinates from point:',
        raw
      )
    }
    return null
  }

  return {
    id:          raw.id ?? fallbackId,
    location: {
      latitude,
      longitude,
    },
    intensity:   extractIntensity(raw),
    rainfall_mm: extractRainfall(raw),
    city:        raw.city,
    country:     raw.country,
    exposed_population: typeof raw.exposed_population === 'number' ? raw.exposed_population : undefined,
    baseline_vulnerability_score: typeof raw.baseline_vulnerability_score === 'number' ? raw.baseline_vulnerability_score : undefined,
    ml_features: raw.ml_features as Record<string, number> | undefined,
    infrastructure: raw.infrastructure as MapPoint['infrastructure'],
    infrastructure_intelligence: raw.infrastructure_intelligence as Record<string, number> | undefined,
  }
}

/**
 * Batch version — maps an array of raw points, silently drops invalid entries,
 * and returns only clean MapPoints.
 *
 * This is what CommandCenter (and any other consumer) should call.
 *
 * Usage:
 *   const mapPoints = normalizeRegions(regionData)
 */
export function normalizeRegions(rawList: RawRegionPoint[]): MapPoint[] {
  return rawList
    .map((item, index) => normalizeRegionToMapPoint(item, index))
    .filter((point): point is MapPoint => point !== null)
}
