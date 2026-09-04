import { describe, expect, it } from 'vitest'
import {
  WGS84_A,
  WGS84_F,
  isValidLatitude,
  isValidLongitude,
  lonLatToEcef,
  normalizeLongitude,
  validateLonLat,
} from '../src/geodesy/wgs84'

// WGS84 per NGA TR8350.2 / EPSG:4326. Fails loudly if constants drift.
describe('WGS84 earth model', () => {
  it('uses canonical equatorial radius and flattening', () => {
    expect(WGS84_A).toBe(6378137.0)
    expect(WGS84_F).toBeCloseTo(1 / 298.257223563, 15)
  })

  it('accepts valid geographic ranges and rejects the rest', () => {
    expect(isValidLongitude(-180)).toBe(true)
    expect(isValidLongitude(180)).toBe(true)
    expect(isValidLongitude(181)).toBe(false)
    expect(isValidLatitude(-90)).toBe(true)
    expect(isValidLatitude(90)).toBe(true)
    expect(isValidLatitude(91)).toBe(false)
    expect(() => validateLonLat(200, 0)).toThrow(RangeError)
    expect(() => validateLonLat(0, -91)).toThrow(RangeError)
  })

  it('normalizes antimeridian longitudes', () => {
    expect(normalizeLongitude(190)).toBeCloseTo(-170, 10)
    expect(normalizeLongitude(-190)).toBeCloseTo(170, 10)
    expect(normalizeLongitude(180)).toBeCloseTo(180, 10)
  })

  it('places equator/prime-meridian intersection on +X axis at a', () => {
    const p = lonLatToEcef(0, 0)
    expect(p.x).toBeCloseTo(WGS84_A, 3)
    expect(p.y).toBeCloseTo(0, 6)
    expect(p.z).toBeCloseTo(0, 6)
  })

  it('places north pole on +Z near polar semi-axis', () => {
    const p = lonLatToEcef(0, 90)
    expect(p.x).toBeCloseTo(0, 3)
    expect(p.y).toBeCloseTo(0, 3)
    // b = a(1-f) ≈ 6356752.314
    expect(p.z).toBeCloseTo(6356752.314, 0)
  })
})
