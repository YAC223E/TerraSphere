import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildPickIndex, pickCountry } from '../src/geodesy/pick'
import type { AreaCollection } from '../src/geodesy/areas'

function fc(features: AreaCollection['features']): AreaCollection {
  return { type: 'FeatureCollection', features }
}

describe('math-based country picking', () => {
  it('hits inside a square, misses outside', () => {
    const index = buildPickIndex(
      fc([
        {
          type: 'Feature',
          properties: { NAME: 'Testland' },
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [0, 0],
                [10, 0],
                [10, 10],
                [0, 10],
                [0, 0],
              ],
            ],
          },
        },
      ]),
    )
    expect(pickCountry(index, 5, 5)?.properties?.NAME).toBe('Testland')
    expect(pickCountry(index, 15, 5)).toBeNull()
  })

  it('subtracts holes', () => {
    const index = buildPickIndex(
      fc([
        {
          type: 'Feature',
          properties: { NAME: 'Donut' },
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [0, 0],
                [10, 0],
                [10, 10],
                [0, 10],
                [0, 0],
              ],
              [
                [4, 4],
                [6, 4],
                [6, 6],
                [4, 6],
                [4, 4],
              ],
            ],
          },
        },
      ]),
    )
    expect(pickCountry(index, 2, 2)?.properties?.NAME).toBe('Donut')
    expect(pickCountry(index, 5, 5)).toBeNull()
  })

  it('crosses the antimeridian the short way', () => {
    const index = buildPickIndex(
      fc([
        {
          type: 'Feature',
          properties: { NAME: 'Dateline' },
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [179, 10],
                [-179, 10],
                [-179, 20],
                [179, 20],
                [179, 10],
              ],
            ],
          },
        },
      ]),
    )
    expect(pickCountry(index, 179.5, 15)?.properties?.NAME).toBe('Dateline')
    expect(pickCountry(index, -179.5, 15)?.properties?.NAME).toBe('Dateline')
    expect(pickCountry(index, 170, 15)).toBeNull()
  })

  it('finds real countries in Natural Earth Africa (Nairobi→Kenya, sea→null)', () => {
    const path = join(process.cwd(), 'public', 'data', 'africa-10m.geojson')
    if (!existsSync(path)) return
    const collection = JSON.parse(readFileSync(path, 'utf8')) as AreaCollection
    const index = buildPickIndex(collection)
    expect(pickCountry(index, 36.8219, -1.2921)?.properties?.NAME).toBe('Kenya')
    expect(pickCountry(index, 47.5079, -18.8792)?.properties?.NAME).toBe('Madagascar')
    expect(pickCountry(index, 15, 36)).toBeNull() // Mediterranean sea
  })
})
