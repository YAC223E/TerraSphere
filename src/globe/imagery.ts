import * as Cesium from 'cesium'

// Phase 6 (rest) — imagery as a layer independent of terrain/vectors.
// Every option documents license + attribution; "off" proves vectors don't
// depend on any texture. No Google/Bing/Apple scraping.
export type ImageryId = 'auto' | 'esri-satellite' | 'esri-labels' | 'osm-roads' | 'off'

export interface ImageryOption {
  id: ImageryId
  attribution: string
  requiresToken: boolean
}

export const IMAGERY_OPTIONS: ImageryOption[] = [
  {
    id: 'auto',
    attribution: 'Cesium ion / Esri, Maxar, Earthstar Geographics',
    requiresToken: false,
  },
  {
    id: 'esri-satellite',
    attribution: 'Esri, Maxar, Earthstar Geographics',
    requiresToken: false,
  },
  {
    id: 'esri-labels',
    attribution: 'Esri, Maxar, Earthstar Geographics; Overture/OSM places',
    requiresToken: false,
  },
  {
    id: 'osm-roads',
    attribution: '© OpenStreetMap contributors (ODbL)',
    requiresToken: false,
  },
  {
    id: 'off',
    attribution: '—',
    requiresToken: false,
  },
]

const ESRI_TILE = 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
const ESRI_REF =
  'https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}'

export function makeEsriSatelliteLayer(): Cesium.ImageryLayer {
  return new Cesium.ImageryLayer(
    new Cesium.UrlTemplateImageryProvider({
      url: ESRI_TILE,
      credit: 'Esri, Maxar, Earthstar Geographics',
      maximumLevel: 19,
    }),
  )
}

function makeUrlLayer(url: string, credit: string, max = 19): Cesium.ImageryLayer {
  return new Cesium.ImageryLayer(
    new Cesium.UrlTemplateImageryProvider({ url, credit, maximumLevel: max }),
  )
}

// Replaces only the base imagery stack (index 0..nBase), preserving overlay
// layers above (e.g. approximate clouds) and all vector data sources.
export function applyImagery(
  viewer: Cesium.Viewer,
  id: ImageryId,
  hasToken: boolean,
  state: { baseLayers: Cesium.ImageryLayer[] },
): void {
  for (const l of state.baseLayers) {
    const i = viewer.imageryLayers.indexOf(l)
    if (i >= 0) viewer.imageryLayers.remove(l, true)
  }
  state.baseLayers = []
  const add = (layer: Cesium.ImageryLayer, index?: number) => {
    state.baseLayers.push(layer)
    viewer.imageryLayers.add(layer, index)
  }

  switch (id) {
    case 'off':
      return // bare ellipsoid + vectors: geographic truth without any texture
    case 'osm-roads':
      add(makeUrlLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', '© OpenStreetMap contributors', 19))
      return
    case 'esri-labels':
      add(makeEsriSatelliteLayer(), 0)
      add(makeUrlLayer(ESRI_REF, 'Esri; Overture Maps, OSM places', 19), 1)
      return
    case 'esri-satellite':
      add(makeEsriSatelliteLayer(), 0)
      return
    case 'auto':
    default:
      if (hasToken) {
        add(Cesium.ImageryLayer.fromWorldImagery({}), 0)
      } else {
        add(makeEsriSatelliteLayer(), 0)
      }
  }
}
