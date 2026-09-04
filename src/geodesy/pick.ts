// Renderer-independent country picking (Phase 11 fix).
// scene.pick proved environment-fragile for ground-clamped vectors
// (empty pick buffer under some GL drivers despite entities rendering).
// Selection now uses source coordinates: lon/lat → point-in-polygon over the
// SAME GeoJSON the globe renders. Deterministic, unit-testable, driver-proof.
import type { AreaCollection, AreaFeature, Position } from './areas'

export interface PickedFeature {
  feature: AreaFeature
}

interface IndexedRing {
  ring: Position[]
  minLon: number
  maxLon: number
  minLat: number
  maxLat: number
}

interface IndexedFeature {
  feature: AreaFeature
  outers: IndexedRing[]
  holes: IndexedRing[][]
}

export interface PickIndex {
  features: IndexedFeature[]
}

function bbox(ring: Position[]): { minLon: number; maxLon: number; minLat: number; maxLat: number } {
  let minLon = 180
  let maxLon = -180
  let minLat = 90
  let maxLat = -90
  for (const [lon, lat] of ring) {
    if (lon < minLon) minLon = lon
    if (lon > maxLon) maxLon = lon
    if (lat < minLat) minLat = lat
    if (lat > maxLat) maxLat = lat
  }
  return { minLon, maxLon, minLat, maxLat }
}

// Shift ring longitudes near the click so antimeridian-crossing polygons
// (Russia, Fiji, Antarctica) test correctly.
function unrollAround(ring: Position[], lon: number): Position[] {
  return ring.map(([x, y]) => {
    let shifted = x
    while (shifted - lon > 180) shifted -= 360
    while (shifted - lon < -180) shifted += 360
    return [shifted, y] as Position
  })
}

function ringContains(ring: Position[], lon: number, lat: number): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside
    }
  }
  return inside
}

export function buildPickIndex(collection: AreaCollection): PickIndex {
  const features: IndexedFeature[] = []
  for (const feature of collection.features) {
    const g = feature.geometry as { type: string; coordinates?: unknown }
    if (g.type !== 'Polygon' && g.type !== 'MultiPolygon') continue
    const polys: Position[][][] =
      g.type === 'Polygon'
        ? [g.coordinates as Position[][]]
        : (g.coordinates as Position[][][])
    const outers: IndexedRing[] = []
    const holes: IndexedRing[][] = []
    for (const poly of polys) {
      if (poly.length === 0) continue
      outers.push({ ring: poly[0], ...bbox(poly[0]) })
      holes.push(poly.slice(1).map((r) => ({ ring: r, ...bbox(r) })))
    }
    features.push({ feature, outers, holes })
  }
  return { features }
}

export function pickCountry(index: PickIndex, lon: number, lat: number): AreaFeature | null {
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null
  for (const { feature, outers, holes } of index.features) {
    for (let p = 0; p < outers.length; p++) {
      const o = outers[p]
      // Bbox precheck in unrolled space.
      const span = o.maxLon - o.minLon
      let qLon = lon
      if (span < 180) {
        const mid = (o.minLon + o.maxLon) / 2
        while (qLon - mid > 180) qLon -= 360
        while (qLon - mid < -180) qLon += 360
        if (qLon < o.minLon || qLon > o.maxLon || lat < o.minLat || lat > o.maxLat) continue
      }
      const outer = unrollAround(o.ring, qLon)
      if (!ringContains(outer, qLon, lat)) continue
      let inHole = false
      for (const h of holes[p]) {
        const hole = unrollAround(h.ring, qLon)
        if (ringContains(hole, qLon, lat)) {
          inHole = true
          break
        }
      }
      if (!inHole) return feature
    }
  }
  return null
}
