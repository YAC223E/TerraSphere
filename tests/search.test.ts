import { describe, expect, it } from 'vitest'
import { bboxTargetHeightMeters, parseCoordinateInput } from '../src/search/nominatim'

describe('Nominatim search helpers (no network)', () => {
  it('parses "lat, lon" coordinates', () => {
    expect(parseCoordinateInput('9.0054, 38.7578')).toEqual({ lat: 9.0054, lon: 38.7578 })
    expect(parseCoordinateInput('-33.9249 18.4241')).toEqual({ lat: -33.9249, lon: 18.4241 })
  })

  it('rejects place names and out-of-range pairs', () => {
    expect(parseCoordinateInput('Nairobi')).toBeNull()
    expect(parseCoordinateInput('Cairo Egypt')).toBeNull()
    expect(parseCoordinateInput('100, 200')).toBeNull()
    expect(parseCoordinateInput('10, 20, 30')).toBeNull()
  })

  it('sizes fly-to height from bounding-box diagonal', () => {
    // City-scale bbox (~20 km diagonal) → ~60–100 km height floor.
    const city = bboxTargetHeightMeters({ south: -1.4, north: -1.2, west: 36.7, east: 36.9 })
    expect(city).toBeGreaterThanOrEqual(60_000)
    expect(city).toBeLessThan(500_000)
    // Continent-scale bbox → multi-thousand km, capped at 20M.
    const continent = bboxTargetHeightMeters({ south: -35, north: 37, west: -18, east: 52 })
    expect(continent).toBeGreaterThan(5_000_000)
    expect(continent).toBeLessThanOrEqual(20_000_000)
    // Missing bbox → continental default.
    expect(bboxTargetHeightMeters(undefined)).toBe(2_000_000)
  })
})
