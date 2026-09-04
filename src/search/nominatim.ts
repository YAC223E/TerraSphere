// Phase 7 — geographic search via Nominatim (OpenStreetMap, ODbL).
// No hardcoded cities. Policy: ≤1 req/s, cache results, identify app via Referer
// (browsers forbid custom User-Agent); production should proxy with a real UA.
// Attribution "© OpenStreetMap contributors" is rendered under results.
export interface Place {
  displayName: string
  lat: number
  lon: number
  type: string
  class: string
  importance: number
  bbox?: { south: number; north: number; west: number; east: number }
}

export const SEARCH_ATTRIBUTION = '© OpenStreetMap contributors (ODbL)'

const ENDPOINT = 'https://nominatim.openstreetmap.org/search'
const cache = new Map<string, { at: number; places: Place[] }>()
const CACHE_TTL_MS = 10 * 60 * 1000
let lastRequestAt = 0

interface NominatimRow {
  display_name: string
  lat: string
  lon: string
  type: string
  class: string
  importance: number
  boundingbox?: [string, string, string, string]
}

// Parses "lat, lon" (or "lat lon") so users can fly to raw coordinates.
export function parseCoordinateInput(q: string): { lat: number; lon: number } | null {
  const m = q.trim().replace(',', ' ').split(/\s+/).filter(Boolean)
  if (m.length !== 2) return null
  const a = Number(m[0])
  const b = Number(m[1])
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null
  // Heuristic: first value in [-90,90] is latitude.
  if (a >= -90 && a <= 90 && b >= -180 && b <= 180) return { lat: a, lon: b }
  return null
}

// Target height from a bounding box diagonal (geodesic): fits the place in view.
export function bboxTargetHeightMeters(bbox: Place['bbox']): number {
  if (!bbox) return 2_000_000
  const dLat = Math.abs(bbox.north - bbox.south) * 111_320
  const midLat = ((bbox.north + bbox.south) / 2) * (Math.PI / 180)
  const dLon = Math.abs(bbox.east - bbox.west) * 111_320 * Math.max(0.2, Math.cos(midLat))
  const diag = Math.hypot(dLat, dLon)
  return Math.min(20_000_000, Math.max(60_000, diag * 1.6))
}

export async function searchPlaces(query: string, signal?: AbortSignal): Promise<Place[]> {
  const q = query.trim()
  if (q.length < 3) return []
  const hit = cache.get(q.toLowerCase())
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.places

  // Throttle to Nominatim's 1 req/s policy (per app, all users combined).
  const wait = 1100 - (Date.now() - lastRequestAt)
  if (wait > 0) await new Promise((r) => setTimeout(r, wait))
  if (signal?.aborted) return []
  lastRequestAt = Date.now()

  const url =
    `${ENDPOINT}?format=jsonv2&limit=5&addressdetails=0&extratags=0&` +
    `q=${encodeURIComponent(q)}`
  const res = await fetch(url, {
    signal,
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) throw new Error(`Search failed (HTTP ${res.status})`)
  const rows = (await res.json()) as NominatimRow[]
  const places: Place[] = rows
    .map((r) => {
      const lat = Number(r.lat)
      const lon = Number(r.lon)
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null
      let bbox: Place['bbox']
      if (r.boundingbox) {
        const [s, n, w, e] = r.boundingbox.map(Number)
        if ([s, n, w, e].every(Number.isFinite)) bbox = { south: s, north: n, west: w, east: e }
      }
      return {
        displayName: r.display_name,
        lat,
        lon,
        type: r.type,
        class: r.class,
        importance: r.importance ?? 0,
        bbox,
      } as Place
    })
    .filter((p): p is Place => p !== null)
  cache.set(q.toLowerCase(), { at: Date.now(), places })
  return places
}

export function clearSearchCache(): void {
  cache.clear()
}
