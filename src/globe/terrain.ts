import * as Cesium from 'cesium'

// Phase 5 — terrain polish. Rendering detail only; never touches geometry or geodesy.
// Quality modes change tile resolution (maximumScreenSpaceError) and effects.
// Terrain exaggeration is a VISUAL scaling of heights for readability and MUST NOT
// feed measurements (distance/area use ellipsoid geodesics in src/geodesy).

export type QualityMode = 'performance' | 'balanced' | 'high'

export const QUALITY_SETTINGS: Record<QualityMode, { msse: number; label: string }> = {
  performance: { msse: 4, label: 'Performance (coarser tiles, weak hardware)' },
  balanced: { msse: 2, label: 'Balanced (default)' },
  high: { msse: 1, label: 'High quality (denser terrain/imagery)' },
}

export function applyQualityMode(viewer: Cesium.Viewer, mode: QualityMode): void {
  viewer.scene.globe.maximumScreenSpaceError = QUALITY_SETTINGS[mode].msse
}

export function clampExaggeration(v: number): number {
  if (!Number.isFinite(v)) return 1
  return Math.min(3, Math.max(1, v))
}

export function applyExaggeration(viewer: Cesium.Viewer, value: number): void {
  const scene = viewer.scene as Cesium.Scene & {
    verticalExaggeration?: number
  }
  if (typeof scene.verticalExaggeration === 'number') {
    scene.verticalExaggeration = clampExaggeration(value)
  }
}

export type TerrainState = 'ellipsoid' | 'loading' | 'ready' | 'error'

export interface TerrainInfo {
  state: TerrainState
  detail: string
}

// Samples terrain height (meters above ellipsoid) at lon/lat. Returns undefined
// while tiles load or on the smooth ellipsoid fallback (no terrain signal).
export function sampleTerrainHeight(
  viewer: Cesium.Viewer,
  lon: number,
  lat: number,
): number | undefined {
  try {
    const carto = Cesium.Cartographic.fromDegrees(lon, lat)
    const h = viewer.scene.sampleHeight?.(carto)
    return typeof h === 'number' && Number.isFinite(h) ? h : undefined
  } catch {
    return undefined
  }
}
