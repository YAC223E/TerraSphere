// Authoritative geodesic math on the WGS84 ellipsoid via Karney's algorithms
// (geographiclib-geodesic, MIT). Used for distance + area measurements and
// Africa verification. Do NOT use spherical Haversine or screen-pixel math.
import { Geodesic } from 'geographiclib-geodesic'
import { validateLonLat } from './wgs84'

const geod = Geodesic.WGS84

export function geodesicDistanceMeters(
  lon1: number,
  lat1: number,
  lon2: number,
  lat2: number,
): number {
  validateLonLat(lon1, lat1)
  validateLonLat(lon2, lat2)
  return geod.Inverse(lat1, lon1, lat2, lon2).s12 ?? 0
}

export function geodesicPathLengthMeters(coords: Array<[number, number]>): number {
  if (coords.length < 2) return 0
  let total = 0
  for (let i = 1; i < coords.length; i++) {
    total += geodesicDistanceMeters(coords[i - 1][0], coords[i - 1][1], coords[i][0], coords[i][1])
  }
  return total
}

// Ring is GeoJSON-style [lon, lat] positions. Handles antimeridian by unrolling
// longitudes so edges take the short path (same approach as GeographicLib examples).
function unrollRing(ring: Array<[number, number]>): Array<[number, number]> {
  if (ring.length === 0) return ring
  const out: Array<[number, number]> = [ring[0]]
  for (let i = 1; i < ring.length; i++) {
    let [lon] = ring[i]
    const prevLon = out[i - 1][0]
    while (lon - prevLon > 180) lon -= 360
    while (lon - prevLon < -180) lon += 360
    out.push([lon, ring[i][1]])
  }
  return out
}

export interface PolygonAreaResult {
  areaSqMeters: number
  perimeterMeters: number
}

export function geodesicPolygonArea(ring: Array<[number, number]>): PolygonAreaResult {
  if (ring.length < 3) return { areaSqMeters: 0, perimeterMeters: 0 }
  const unrolled = unrollRing(ring)
  const poly = geod.Polygon(false)
  for (const [lon, lat] of unrolled) {
    validateLonLat(
      Math.max(-180, Math.min(180, lon)),
      lat,
    )
    // PolygonArea expects (lat, lon); unrolled lon may exceed 180 — accepted for edge continuity.
    poly.AddPoint(lat, lon)
  }
  const { number, perimeter, area } = poly.Compute(false, true)
  void number
  return { areaSqMeters: Math.abs(area ?? 0), perimeterMeters: perimeter ?? 0 }
}

function num(locale: string, value: number, fractionDigits: number): string {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value)
}

// Locale-aware display only — inputs stay SI meters. Coordinates intentionally
// keep '.' decimals (geodetic convention, unambiguous); grouped integers and
// measured decimals follow the UI locale.
export function formatDistance(
  meters: number,
  units: 'metric' | 'imperial' = 'metric',
  locale = 'en-US',
): string {
  if (units === 'imperial') {
    const miles = meters / 1609.344
    return miles >= 100 ? `${num(locale, miles, 1)} mi` : `${num(locale, meters * 3.28084, 0)} ft`
  }
  if (meters >= 1000) return `${num(locale, meters / 1000, 2)} km`
  return `${num(locale, meters, 1)} m`
}

export function formatArea(
  sqMeters: number,
  units: 'metric' | 'imperial' = 'metric',
  locale = 'en-US',
): string {
  if (units === 'imperial') {
    return `${num(locale, sqMeters / 2589988.11, 0)} mi²`
  }
  return `${num(locale, sqMeters / 1e6, 0)} km²`
}

export function formatInt(locale: string, value: number): string {
  return num(locale, Math.round(value), 0)
}
