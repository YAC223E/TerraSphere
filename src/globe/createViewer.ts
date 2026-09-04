import * as Cesium from 'cesium'
import { getCesiumIonToken, getDefaultView } from '../config/env'
import { en, fr, type StringKey } from '../i18n/dict'
import type { Lang } from '../i18n/lang'
import { applyImagery } from './imagery'
import { applyExaggeration, applyQualityMode, type TerrainInfo } from './terrain'

export interface ViewerStatus {
  mode: 'ion' | 'fallback'
  terrain: string
  imagery: string
  warning?: string
}

// Creates the authoritative 3D globe:
// - WGS84 ellipsoid (Cesium default; never replaced with a plain sphere)
// - Real lon/lat -> ECEF placement via Cesium Cartographic (no Mercator texture trick)
// - Quantized-mesh world terrain when token present, ellipsoid fallback otherwise
// - Sun lighting + atmosphere + stars (Cesium defaults, physically sensible terminator)
export function createGlobeViewer(
  container: HTMLElement,
  opts: { onTerrainInfo?: (info: TerrainInfo) => void; lang?: Lang } = {},
): {
  viewer: Cesium.Viewer
  status: ViewerStatus
  imageryState: { baseLayers: Cesium.ImageryLayer[] }
  hasToken: boolean
} {
  const token = getCesiumIonToken()
  if (token) Cesium.Ion.defaultAccessToken = token
  const S = opts.lang === 'fr' ? fr : en
  const str = (key: StringKey): string => S[key]

  const { lon, lat } = getDefaultView()
  let terrain: Cesium.Terrain | undefined
  const imageryState: { baseLayers: Cesium.ImageryLayer[] } = { baseLayers: [] }
  let status: ViewerStatus

  if (token) {
    // Terrain.fromWorldTerrain() is sync — it returns a Terrain helper that
    // resolves its provider asynchronously (readyEvent/errorEvent).
    terrain = Cesium.Terrain.fromWorldTerrain({
      requestVertexNormals: true,
      requestWaterMask: true,
    })
    status = {
      mode: 'ion',
      terrain: 'Cesium World Terrain (quantized-mesh, ion)',
      imagery: 'Cesium World Imagery (ion)',
    }
    terrain.readyEvent.addEventListener(() => {
      opts.onTerrainInfo?.({ state: 'ready', detail: str('terrainReady') })
    })
    terrain.errorEvent.addEventListener((err) => {
      console.warn('[globe] World Terrain error', err)
      opts.onTerrainInfo?.({ state: 'error', detail: str('terrainError') })
    })
    opts.onTerrainInfo?.({ state: 'loading', detail: str('terrainLoading') })
  } else {
    status = {
      mode: 'fallback',
      terrain: 'WGS84 ellipsoid (no ion token)',
      imagery: 'Esri World Imagery (no ion token)',
      warning: str('noTokenWarning'),
    }
  }

  const viewerOptions: Cesium.Viewer.ConstructorOptions = {
    animation: false,
    timeline: false,
    fullscreenButton: false,
    vrButton: false,
    geocoder: false, // custom Nominatim search in Phase 7 (no hardcoded cities)
    homeButton: true,
    sceneModePicker: true, // 3D globe is authoritative; 2D/Columbus only for education
    baseLayerPicker: false,
    baseLayer: false, // imagery applied below via applyImagery (independent of terrain)
    navigationHelpButton: true,
    infoBox: true,
    selectionIndicator: true,
    shadows: false,
  }
  if (terrain) viewerOptions.terrain = terrain

  let viewer: Cesium.Viewer
  try {
    viewer = new Cesium.Viewer(container, viewerOptions)
  } catch (err) {
    container.innerHTML = ''
    const msg = document.createElement('div')
    msg.className = 'globe-error'
    msg.textContent = str('webglError')
    container.appendChild(msg)
    throw err
  }

  // Natural camera: drag rotate, wheel/pinch zoom, right-drag tilt, orbit — Cesium defaults.
  const controller = viewer.scene.screenSpaceCameraController
  controller.enableRotate = true
  controller.enableZoom = true
  controller.enableTilt = true
  controller.enableLook = true
  controller.inertiaSpin = 0.9
  controller.inertiaZoom = 0.85

  // Physically sensible sun + atmosphere. No arbitrary orbiting light.
  viewer.scene.globe.enableLighting = true
  viewer.scene.globe.showGroundAtmosphere = true
  if (viewer.scene.skyAtmosphere) viewer.scene.skyAtmosphere.show = true
  viewer.shadows = false

  // Phase 5 defaults: balanced detail, true heights. Exaggeration is opt-in visual only.
  applyQualityMode(viewer, 'balanced')
  applyExaggeration(viewer, 1)

  viewer.camera.setView({
    destination: Cesium.Cartesian3.fromDegrees(lon, lat, 22_000_000),
    orientation: { heading: 0, pitch: -Math.PI / 2, roll: 0 },
  })

  // Attribution is legally required — Cesium renders ion credit automatically;
  // fallback imagery credit is added by the provider itself.
  applyImagery(viewer, 'auto', token != null, imageryState)
  return { viewer, status, imageryState, hasToken: token != null }
}

export function flyToLonLat(
  viewer: Cesium.Viewer,
  lon: number,
  lat: number,
  heightMeters = 2_000_000,
): void {
  viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(lon, lat, heightMeters),
    duration: 2.2,
  })
}
