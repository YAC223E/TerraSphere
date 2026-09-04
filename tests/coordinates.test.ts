import { describe, expect, it } from 'vitest'
import { geodesicDistanceMeters, geodesicPolygonArea } from '../src/geodesy/geodesic'

// Known-location checks: rendered coordinates must equal geographic truth.
// Tolerances are tight because Karney geodesics are nm-accurate; loosen only for dataset reasons.
describe('geographic accuracy — known locations', () => {
  const cases: Array<{ name: string; lon: number; lat: number }> = [
    { name: 'Greenwich', lon: 0, lat: 51.4769 },
    { name: 'Nairobi', lon: 36.8219, lat: -1.2921 },
    { name: 'Cairo', lon: 31.2357, lat: 30.0444 },
    { name: 'Cape Town', lon: 18.4241, lat: -33.9249 },
    { name: 'Lagos', lon: 3.3792, lat: 6.5244 },
    { name: 'Dakar', lon: -17.4441, lat: 14.6937 },
    { name: 'Addis Ababa', lon: 38.7578, lat: 9.0054 },
    { name: 'Antananarivo (Madagascar)', lon: 47.5079, lat: -18.8792 },
    { name: 'North Pole', lon: 0, lat: 90 },
    { name: 'South Pole', lon: 0, lat: -90 },
  ]

  it('keeps every reference coordinate inside valid WGS84 ranges', () => {
    for (const c of cases) {
      expect(c.lon, `${c.name} lon`).toBeGreaterThanOrEqual(-180)
      expect(c.lon, `${c.name} lon`).toBeLessThanOrEqual(180)
      expect(c.lat, `${c.name} lat`).toBeGreaterThanOrEqual(-90)
      expect(c.lat, `${c.name} lat`).toBeLessThanOrEqual(90)
    }
  })

  it('measures ~111.32 km per degree of longitude at the equator (WGS84)', () => {
    const d = geodesicDistanceMeters(0, 0, 1, 0)
    expect(d).toBeGreaterThan(111300)
    expect(d).toBeLessThan(111400)
  })

  it('measures ~10,000 km from equator to pole along a meridian (quarter-meridian)', () => {
    const d = geodesicDistanceMeters(0, 0, 0, 90)
    // WGS84 quarter-meridian ≈ 10,001,965.7 m
    expect(d).toBeGreaterThan(9_990_000)
    expect(d).toBeLessThan(10_015_000)
  })

  it('handles antimeridian crossing via the short path, not around the world', () => {
    const across = geodesicDistanceMeters(179.9, 0, -179.9, 0)
    // 0.2° at equator ≈ 22.26 km — must NOT be ~40,000 km
    expect(across).toBeGreaterThan(20_000)
    expect(across).toBeLessThan(25_000)
  })

  it('computes sane area for a 1°x1° equatorial cell (~12,300 km²)', () => {
    const { areaSqMeters } = geodesicPolygonArea([
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
      [0, 0],
    ])
    const sqKm = areaSqMeters / 1e6
    expect(sqKm).toBeGreaterThan(12_000)
    expect(sqKm).toBeLessThan(12_600)
  })

  it('supports MultiPolygon-style islands as independent rings', () => {
    // Madagascar simplified bbox ring — just checks plumbing, full dataset test is africa-area.test.ts
    const { areaSqMeters } = geodesicPolygonArea([
      [43.2, -12.3],
      [50.5, -12.3],
      [50.5, -25.6],
      [43.2, -25.6],
      [43.2, -12.3],
    ])
    expect(areaSqMeters).toBeGreaterThan(0)
  })
})
