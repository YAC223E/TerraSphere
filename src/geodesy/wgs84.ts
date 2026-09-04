// WGS84 reference constants and coordinate validation.
// Source: NGA TR8350.2 / EPSG:4326. a = 6378137.0 m, f = 1/298.257223563.
// GeoJSON (RFC 7946) coordinates are WGS84 lon/lat in decimal degrees — no silent CRS change.

export const WGS84_A = 6378137.0
export const WGS84_F = 1 / 298.257223563
export const WGS84_B = WGS84_A * (1 - WGS84_F)

export interface LonLat {
  lon: number
  lat: number
}

export function isValidLongitude(lon: number): boolean {
  return Number.isFinite(lon) && lon >= -180 && lon <= 180
}

export function isValidLatitude(lat: number): boolean {
  return Number.isFinite(lat) && lat >= -90 && lat <= 90
}

export function normalizeLongitude(lon: number): number {
  // Normalize to [-180, 180). Preserves antimeridian-crossing logic for display;
  // geodesic math uses unrolled longitudes where needed (GeographicLib LONG_UNROLL).
  let n = ((lon + 180) % 360 + 360) % 360
  n -= 180
  // Map -180 edge to 180 only if input was positive overflow; keep -180 as-is otherwise.
  if (n === -180 && lon > 0) return 180
  return n
}

export function validateLonLat(lon: number, lat: number): LonLat {
  if (!isValidLongitude(lon)) throw new RangeError(`Invalid longitude ${lon}: expected [-180, 180]`)
  if (!isValidLatitude(lat)) throw new RangeError(`Invalid latitude ${lat}: expected [-90, 90]`)
  return { lon, lat }
}

// Closed-form ECEF on the WGS84 ellipsoid (h = ellipsoidal height in meters).
// Used in tests to verify engine placement math independently of Cesium.
export function lonLatToEcef(lonDeg: number, latDeg: number, h = 0): { x: number; y: number; z: number } {
  const { lon, lat } = validateLonLat(lonDeg, latDeg)
  const rad = Math.PI / 180
  const phi = lat * rad
  const lam = lon * rad
  const sinPhi = Math.sin(phi)
  const cosPhi = Math.cos(phi)
  const e2 = 2 * WGS84_F - WGS84_F * WGS84_F
  const N = WGS84_A / Math.sqrt(1 - e2 * sinPhi * sinPhi)
  return {
    x: (N + h) * cosPhi * Math.cos(lam),
    y: (N + h) * cosPhi * Math.sin(lam),
    z: (N * (1 - e2) + h) * sinPhi,
  }
}
