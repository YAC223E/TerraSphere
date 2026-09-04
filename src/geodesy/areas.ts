// GeoJSON area aggregation on the WGS84 ellipsoid.
// Sums geodesic areas of Polygon/MultiPolygon features (exteriors minus holes).
// Same math as src/geodesy/geodesic.ts, lifted to Feature level so runtime,
// scripts, and tests share one implementation — geometry is never scaled.
import { geodesicPolygonArea } from './geodesic'

export type Position = [number, number]
export interface PolygonGeometry {
  type: 'Polygon'
  coordinates: Position[][]
}
export interface MultiPolygonGeometry {
  type: 'MultiPolygon'
  coordinates: Position[][][]
}
export type AreaGeometry = PolygonGeometry | MultiPolygonGeometry
export interface AreaFeature {
  type: 'Feature'
  properties?: Record<string, unknown>
  geometry: AreaGeometry | { type: string; coordinates?: unknown }
}
export interface AreaCollection {
  type: 'FeatureCollection'
  features: AreaFeature[]
}

function ringAreaSqM(ring: Position[]): number {
  return geodesicPolygonArea(ring).areaSqMeters
}

export function featureAreaSqMeters(feature: AreaFeature): number {
  const g = feature.geometry as AreaGeometry
  if (!g || !g.coordinates) return 0
  if (g.type === 'Polygon') {
    let area = ringAreaSqM(g.coordinates[0] ?? [])
    for (let i = 1; i < g.coordinates.length; i++) area -= ringAreaSqM(g.coordinates[i])
    return Math.max(0, area)
  }
  if (g.type === 'MultiPolygon') {
    let total = 0
    for (const poly of g.coordinates) {
      let area = ringAreaSqM(poly[0] ?? [])
      for (let i = 1; i < poly.length; i++) area -= ringAreaSqM(poly[i])
      total += Math.max(0, area)
    }
    return total
  }
  return 0
}

export interface CollectionArea {
  totalSqMeters: number
  featureCount: number
  perFeature: Array<{ name: string; sqMeters: number }>
}

export function collectionAreaSqMeters(collection: AreaCollection): CollectionArea {
  let total = 0
  const perFeature: CollectionArea['perFeature'] = []
  for (const f of collection.features) {
    const sqMeters = featureAreaSqMeters(f)
    total += sqMeters
    const props = (f.properties ?? {}) as Record<string, unknown>
    const name = String(props.NAME ?? props.name ?? props.ADMIN ?? 'unknown')
    perFeature.push({ name, sqMeters })
  }
  return { totalSqMeters: total, featureCount: collection.features.length, perFeature }
}

export const AFRICA_REFERENCE_SQ_KM = 30_370_000
export const AFRICA_TOLERANCE_FRACTION = 0.05

export interface AfricaVerification {
  datasetSqKm: number
  referenceSqKm: number
  absDiffSqKm: number
  pctDiff: number
  toleranceFraction: number
  pass: boolean
}

export function verifyAfricaArea(totalSqMeters: number): AfricaVerification {
  const datasetSqKm = totalSqMeters / 1e6
  const absDiffSqKm = Math.abs(datasetSqKm - AFRICA_REFERENCE_SQ_KM)
  const pctDiff = (absDiffSqKm / AFRICA_REFERENCE_SQ_KM) * 100
  return {
    datasetSqKm,
    referenceSqKm: AFRICA_REFERENCE_SQ_KM,
    absDiffSqKm,
    pctDiff,
    toleranceFraction: AFRICA_TOLERANCE_FRACTION,
    pass: absDiffSqKm / AFRICA_REFERENCE_SQ_KM <= AFRICA_TOLERANCE_FRACTION,
  }
}
