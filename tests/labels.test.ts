import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import * as Cesium from 'cesium'
import { anchorForFeature, largestExteriorRing } from '../src/layers/vectors'
import type { AreaCollection, AreaFeature } from '../src/geodesy/areas'

function feature(props: Record<string, unknown>, coordinates: number[][][][]): AreaFeature {
  return {
    type: 'Feature',
    properties: props,
    geometry: { type: 'MultiPolygon', coordinates },
  }
}

const square = (x0: number, y0: number, x1: number, y1: number): number[][][] => [
  [
    [x0, y0],
    [x1, y0],
    [x1, y1],
    [x0, y1],
    [x0, y0],
  ],
]

describe('country label anchors', () => {
  it('uses the NAME property field (verified across shipped datasets)', () => {
    for (const f of [
      'ne_110m_admin_0_countries.geojson',
      'ne_50m_admin_0_countries.geojson',
      'africa-110m.geojson',
      'africa-10m.geojson',
    ]) {
      const path = join(process.cwd(), 'public', 'data', f)
      if (!existsSync(path)) continue
      const fc = JSON.parse(readFileSync(path, 'utf8')) as AreaCollection
      for (const feat of fc.features) {
        const name = (feat.properties as Record<string, unknown> | undefined)?.NAME
        expect(typeof name === 'string' && name.length > 0, `${f} missing NAME`).toBe(true)
      }
    }
  })

  it('anchors on the largest landmass, not the first ring (island-first ordering)', () => {
    // Small island listed first, mainland second — naive [0] would pick the island.
    const f = feature({ NAME: 'Fakeland' }, [square(50, 50, 51, 51), square(0, 0, 10, 10)])
    const ring = largestExteriorRing(f)
    expect(ring?.[0]).toEqual([0, 0])
  })

  it('places the anchor inside the largest ring bbox', () => {
    const f = feature({ NAME: 'Fakeland' }, [square(50, 50, 51, 51), square(0, 0, 10, 10)])
    const anchor = anchorForFeature(f)
    expect(anchor).not.toBeNull()
    const carto = Cesium.Ellipsoid.WGS84.cartesianToCartographic(anchor!)
    const lon = Cesium.Math.toDegrees(carto.longitude)
    const lat = Cesium.Math.toDegrees(carto.latitude)
    expect(lon).toBeGreaterThanOrEqual(0)
    expect(lon).toBeLessThanOrEqual(10)
    expect(lat).toBeGreaterThanOrEqual(0)
    expect(lat).toBeLessThanOrEqual(10)
  })

  it('anchors real island-heavy countries on their mainland', () => {
    const path = join(process.cwd(), 'public', 'data', 'ne_50m_admin_0_countries.geojson')
    if (!existsSync(path)) return
    const fc = JSON.parse(readFileSync(path, 'utf8')) as AreaCollection
    const at = (name: string) => {
      const feat = fc.features.find((x) => (x.properties as { NAME?: string } | undefined)?.NAME === name)
      expect(feat, `${name} present`).toBeDefined()
      const anchor = anchorForFeature(feat!)
      expect(anchor, `${name} anchor`).not.toBeNull()
      const carto = Cesium.Ellipsoid.WGS84.cartesianToCartographic(anchor!)
      return {
        lon: Cesium.Math.toDegrees(carto.longitude),
        lat: Cesium.Math.toDegrees(carto.latitude),
      }
    }
    // United States: mainland, not Alaska/Hawaii (lon would be <-130 or >-60... Hawaii ~-157).
    const us = at('United States of America')
    expect(us.lon).toBeGreaterThan(-130)
    expect(us.lon).toBeLessThan(-65)
    expect(us.lat).toBeGreaterThan(24)
    // France: metropolitan, not Guyane (~-53) or New Caledonia (~165).
    const fr = at('France')
    expect(fr.lon).toBeGreaterThan(-6)
    expect(fr.lon).toBeLessThan(11)
    expect(fr.lat).toBeGreaterThan(41)
    // Kenya sanity.
    const ke = at('Kenya')
    expect(ke.lon).toBeGreaterThan(33)
    expect(ke.lon).toBeLessThan(43)
  })
})
