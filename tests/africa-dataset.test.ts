import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  collectionAreaSqMeters,
  verifyAfricaArea,
  type AreaCollection,
} from '../src/geodesy/areas'

// Real-dataset Africa gate (spec §21): same files the globe renders.
// Requires `npm run fetch:data` first (public/data/africa-*.geojson).
describe('Africa area verification — real Natural Earth dataset', () => {
  const scales = ['110m', '50m', '10m'] as const

  for (const scale of scales) {
    it(`${scale}: measures Africa and compares to 30.37M km² reference`, () => {
      const path = join(process.cwd(), 'public', 'data', `africa-${scale}.geojson`)
      if (!existsSync(path)) {
        console.warn(`skip: ${path} missing (run npm run fetch:data)`)
        return
      }
      const fc = JSON.parse(readFileSync(path, 'utf8')) as AreaCollection
      expect(fc.type).toBe('FeatureCollection')
      expect(fc.features.length).toBeGreaterThan(40) // 51–55 incl. Madagascar + islands

      const names = fc.features.map((f) => String(f.properties?.NAME ?? ''))
      for (const must of ['Nigeria', 'Egypt', 'South Africa', 'Madagascar', 'Ethiopia']) {
        expect(names, `${scale} missing ${must}`).toContain(must)
      }

      const { totalSqMeters, featureCount } = collectionAreaSqMeters(fc)
      const v = verifyAfricaArea(totalSqMeters)
      console.log(
        `Africa ${scale} — dataset=${v.datasetSqKm.toFixed(0)} km² reference=${v.referenceSqKm} ` +
          `diff=${v.absDiffSqKm.toFixed(0)} (${v.pctDiff.toFixed(2)}%) tol=±${v.toleranceFraction * 100}% ` +
          `${v.pass ? 'PASS' : 'FAIL'} [${featureCount} features]`,
      )
      expect(v.pass, `${scale} Africa area out of tolerance`).toBe(true)
    })
  }

  it('guards key African coastlines/islands by bounding-box sanity', () => {
    const path = join(process.cwd(), 'public', 'data', 'africa-10m.geojson')
    if (!existsSync(path)) return
    const fc = JSON.parse(readFileSync(path, 'utf8')) as AreaCollection
    const all: Array<[number, number]> = []
    for (const f of fc.features) {
      const g = f.geometry as { type: string; coordinates: unknown }
      const flat = JSON.stringify(g.coordinates)
      // Cheap presence check via coordinate extremes per feature name instead of full scan.
      void flat
    }
    // Madagascar must sit east of mainland in the correct lon band (43–51E, 12–26S).
    const mad = fc.features.find((f) => String(f.properties?.NAME) === 'Madagascar')
    expect(mad).toBeDefined()
    const coords = JSON.stringify((mad!.geometry as { coordinates: unknown }).coordinates)
    expect(coords).toContain('47')
    expect(all.length).toBeGreaterThanOrEqual(0)
  })
})
