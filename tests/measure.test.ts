import { describe, expect, it } from 'vitest'
import {
  formatArea,
  formatDistance,
  geodesicDistanceMeters,
  geodesicPathLengthMeters,
  geodesicPolygonArea,
} from '../src/geodesy/geodesic'

// Phase 8 validation: all UI numbers must come from these functions — never pixels.
describe('measurement math (Karney WGS84)', () => {
  it('returns 0 for degenerate inputs', () => {
    expect(geodesicPathLengthMeters([])).toBe(0)
    expect(geodesicPathLengthMeters([[0, 0]])).toBe(0)
    expect(geodesicPolygonArea([]).areaSqMeters).toBe(0)
    expect(geodesicPolygonArea([[0, 0], [1, 0]]).areaSqMeters).toBe(0)
  })

  it('sums segments: path length equals pairwise legs', () => {
    const pts: Array<[number, number]> = [
      [36.8219, -1.2921], // Nairobi
      [31.2357, 30.0444], // Cairo
      [18.4241, -33.9249], // Cape Town
    ]
    const legs =
      geodesicDistanceMeters(pts[0][0], pts[0][1], pts[1][0], pts[1][1]) +
      geodesicDistanceMeters(pts[1][0], pts[1][1], pts[2][0], pts[2][1])
    expect(geodesicPathLengthMeters(pts)).toBeCloseTo(legs, 6)
  })

  it('measures Nairobi–Cairo ≈ 3,500 km (sanity band)', () => {
    const d = geodesicDistanceMeters(36.8219, -1.2921, 31.2357, 30.0444)
    expect(d).toBeGreaterThan(3_300_000)
    expect(d).toBeLessThan(3_700_000)
  })

  it('treats unclosed rings by closure: area stable', () => {
    const ring: Array<[number, number]> = [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ]
    const closed = [...ring, ring[0]]
    expect(geodesicPolygonArea(closed).areaSqMeters).toBeGreaterThan(0)
  })

  it('crosses the antimeridian the short way', () => {
    const d = geodesicPathLengthMeters([
      [179.9, 0],
      [-179.9, 0],
    ])
    expect(d).toBeLessThan(25_000)
  })

  it('formats metric and imperial units', () => {
    expect(formatDistance(1500)).toBe('1.50 km')
    expect(formatDistance(500)).toBe('500.0 m')
    expect(formatDistance(160934.4, 'imperial')).toBe('100.0 mi')
    expect(formatDistance(500, 'imperial')).toBe('1,640 ft')
    expect(formatArea(1e6)).toBe('1 km²')
    expect(formatArea(2589988.11, 'imperial')).toBe('1 mi²')
  })
})
