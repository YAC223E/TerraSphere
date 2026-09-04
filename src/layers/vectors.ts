import * as Cesium from 'cesium'
import {
  featureAreaSqMeters,
  type AreaCollection,
  type AreaFeature,
  type Position,
} from '../geodesy/areas'
import { geodesicPolygonArea } from '../geodesy/geodesic'
import { buildPickIndex, pickCountry, type PickIndex } from '../geodesy/pick'

export type LodKey = '110m' | '50m'
export interface CountryInfo {
  name: string
  continent?: string
  isoA3?: string
  popEst?: number
  areaSqMeters: number
  lon?: number
  lat?: number
}

export interface VectorHandle {
  setBordersVisible(v: boolean): void
  setLandVisible(v: boolean): void
  setLabelsVisible(v: boolean): void
  setSelectionEnabled(v: boolean): void
  getLod(): LodKey | '110m+africa10m' | '50m+africa10m'
  onCountrySelect(cb: (info: CountryInfo | null) => void): void
  destroy(): void
}

const base = import.meta.env.BASE_URL || '/'
const URLS = {
  countries110: `${base}data/ne_110m_admin_0_countries.geojson`,
  countries50: `${base}data/ne_50m_admin_0_countries.geojson`,
  land110: `${base}data/ne_110m_land.geojson`,
  land50: `${base}data/ne_50m_land.geojson`,
  africa10: `${base}data/africa-10m.geojson`,
}

// Label anchor: largest exterior ring by geodesic area, so island-heavy
// countries (US/Alaska/Hawaii, France/Guyane, Norway/Svalbard) anchor on the
// mainland instead of a centroid skewed by far-flung islands. Exported for tests.
export function largestExteriorRing(feature: AreaFeature): Position[] | null {
  const g = feature.geometry as { type: string; coordinates?: unknown }
  const polys: Position[][][] =
    g.type === 'Polygon'
      ? [g.coordinates as Position[][]]
      : g.type === 'MultiPolygon'
        ? (g.coordinates as Position[][][])
        : []
  let best: Position[] | null = null
  let bestArea = 0
  for (const poly of polys) {
    if (!poly || poly.length === 0 || !poly[0]) continue
    const area = geodesicPolygonArea(poly[0]).areaSqMeters
    if (area > bestArea) {
      bestArea = area
      best = poly[0]
    }
  }
  return best
}

// Center of the bounding sphere through the largest ring's surface points.
// Computed in 3D Cartesian (no antimeridian wrapping problem).
export function anchorForFeature(feature: AreaFeature): Cesium.Cartesian3 | null {
  const ring = largestExteriorRing(feature)
  if (!ring || ring.length < 3) return null
  const flat: number[] = []
  for (const [lon, lat] of ring) flat.push(lon, lat)
  const points = Cesium.Cartesian3.fromDegreesArray(flat)
  if (points.length === 0) return null
  return Cesium.BoundingSphere.fromPoints(points).center
}

const AFRICA_BBOX = { minLon: -20, maxLon: 56, minLat: -37, maxLat: 38 }

function cameraOverAfrica(viewer: Cesium.Viewer): boolean {
  const c = viewer.camera.positionCartographic
  if (!c) return false
  const lon = Cesium.Math.toDegrees(c.longitude)
  const lat = Cesium.Math.toDegrees(c.latitude)
  return lon >= AFRICA_BBOX.minLon && lon <= AFRICA_BBOX.maxLon && lat >= AFRICA_BBOX.minLat && lat <= AFRICA_BBOX.maxLat
}

async function loadCountries(fc: AreaCollection) {
  return Cesium.GeoJsonDataSource.load(fc as unknown as object, {
    stroke: Cesium.Color.WHITE.withAlpha(0.85),
    fill: Cesium.Color.TRANSPARENT,
    strokeWidth: 1,
    clampToGround: true,
  })
}

// Single fetch shared by renderer + pick index (no double download/parse).
const jsonCache = new Map<string, AreaCollection>()
async function loadJson(url: string): Promise<AreaCollection> {
  let fc = jsonCache.get(url)
  if (!fc) {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`vectors HTTP ${res.status}: ${url}`)
    fc = (await res.json()) as AreaCollection
    if (fc.type !== 'FeatureCollection' || !Array.isArray(fc.features)) {
      throw new Error(`vectors invalid GeoJSON: ${url}`)
    }
    jsonCache.set(url, fc)
  }
  return fc
}

export function attachVectorLayers(
  viewer: Cesium.Viewer,
  opts: { onLodChange?: (lod: string) => void } = {},
): VectorHandle {
  let bordersVisible = true
  let landVisible = true
  let labelsVisible = false // default off: ~200 labels at once is clutter
  let labeled: Cesium.Entity[] = []
  let lod: LodKey = '110m'
  let africa10On = false
  let gen = 0
  let destroyed = false
  let selectCb: (info: CountryInfo | null) => void = () => {}
  let highlighted: Cesium.Entity[] = []
  let selectionEnabled = true
  let pickState: { index: PickIndex } | null = null

  let countriesDs: Cesium.GeoJsonDataSource | undefined
  let landDs: Cesium.GeoJsonDataSource | undefined
  let africaDs: Cesium.GeoJsonDataSource | undefined

  function currentLabel(): LodKey | '110m+africa10m' | '50m+africa10m' {
    if (africa10On) return `${lod}+africa10m`
    return lod
  }

  function styleEntities(ds: Cesium.DataSource) {
    for (const e of ds.entities.values) {
      const poly = e.polygon
      if (poly) {
        poly.material = new Cesium.ColorMaterialProperty(Cesium.Color.TRANSPARENT)
        poly.outline = new Cesium.ConstantProperty(true)
        poly.outlineColor = new Cesium.ConstantProperty(Cesium.Color.WHITE.withAlpha(0.85))
        poly.outlineWidth = new Cesium.ConstantProperty(1)
        poly.heightReference = new Cesium.ConstantProperty(Cesium.HeightReference.CLAMP_TO_GROUND)
      }
      const line = e.polyline
      if (line) {
        line.material = new Cesium.ColorMaterialProperty(Cesium.Color.WHITE.withAlpha(0.85))
        line.width = new Cesium.ConstantProperty(1)
        line.clampToGround = new Cesium.ConstantProperty(true)
      }
    }
  }

  // One label per country NAME, anchored on the largest landmass.
  // Africa-10m overlay is skipped (same features, would double-label).
  function applyCountryLabels(
    ds: Cesium.GeoJsonDataSource,
    fc: AreaCollection,
  ) {
    labeled = []
    const firstByName = new Map<string, Cesium.Entity>()
    for (const e of ds.entities.values) {
      let name = ''
      try {
        const props = (e.properties?.getValue(Cesium.JulianDate.now()) ?? {}) as Record<
          string,
          unknown
        >
        name = String(props.NAME ?? '')
      } catch {
        continue
      }
      if (name && !firstByName.has(name)) firstByName.set(name, e)
    }
    for (const feature of fc.features) {
      const props = (feature.properties ?? {}) as Record<string, unknown>
      // Verified field: Natural Earth admin-0 uses NAME (ADMIN as fallback).
      const name = String(props.NAME ?? props.ADMIN ?? '')
      if (!name) continue
      const anchor = anchorForFeature(feature)
      const target = firstByName.get(name)
      if (!anchor || !target) continue
      target.position = new Cesium.ConstantPositionProperty(anchor)
      target.label = new Cesium.LabelGraphics({
        text: new Cesium.ConstantProperty(name),
        font: new Cesium.ConstantProperty('14px Inter, system-ui, sans-serif'),
        fillColor: new Cesium.ConstantProperty(Cesium.Color.WHITE),
        outlineColor: new Cesium.ConstantProperty(Cesium.Color.BLACK),
        outlineWidth: new Cesium.ConstantProperty(2),
        style: new Cesium.ConstantProperty(Cesium.LabelStyle.FILL_AND_OUTLINE),
        show: new Cesium.ConstantProperty(labelsVisible),
        // Labels stay readable over terrain relief (far-side labels visible too).
        disableDepthTestDistance: new Cesium.ConstantProperty(Number.POSITIVE_INFINITY),
        heightReference: new Cesium.ConstantProperty(Cesium.HeightReference.CLAMP_TO_GROUND),
        horizontalOrigin: new Cesium.ConstantProperty(Cesium.HorizontalOrigin.CENTER),
        verticalOrigin: new Cesium.ConstantProperty(Cesium.VerticalOrigin.CENTER),
      })
      labeled.push(target)
    }
  }

  async function refresh() {
    const myGen = ++gen
    const height = viewer.camera.positionCartographic?.height ?? 22_000_000
    const wantLod: LodKey = height < 9_000_000 ? '50m' : '110m'
    const wantAfrica10 = height < 5_000_000 && cameraOverAfrica(viewer)

    const lodChanged = wantLod !== lod
    const africaChanged = wantAfrica10 !== africa10On
    if (lodChanged) lod = wantLod
    if (africaChanged) africa10On = wantAfrica10
    if (!lodChanged && !africaChanged && countriesDs) {
      opts.onLodChange?.(currentLabel())
      return
    }

    // Operability signal (also drives the loading indicator + QA waits).
    viewer.container.setAttribute('data-vectors', 'loading')
    try {
      // Countries (global LOD). Same object feeds renderer + pick index.
      const countriesUrl = lod === '50m' ? URLS.countries50 : URLS.countries110
      const fc = await loadJson(countriesUrl)
      if (destroyed || myGen !== gen) return
      pickState = { index: buildPickIndex(fc) }
      const nextCountries = await loadCountries(fc)
      if (destroyed || myGen !== gen) return
      styleEntities(nextCountries)
      if (countriesDs) {
        viewer.dataSources.remove(countriesDs, true)
      }
      countriesDs = nextCountries as Cesium.GeoJsonDataSource
      countriesDs.show = bordersVisible
      applyCountryLabels(countriesDs, fc)
      await viewer.dataSources.add(countriesDs)

      // Land fill (subtle, below borders).
      const landUrl = lod === '50m' ? URLS.land50 : URLS.land110
      const nextLand = await Cesium.GeoJsonDataSource.load(landUrl, {
        stroke: Cesium.Color.TRANSPARENT,
        fill: Cesium.Color.WHITE.withAlpha(0.04),
        clampToGround: true,
      })
      if (destroyed || myGen !== gen) return
      if (landDs) viewer.dataSources.remove(landDs, true)
      landDs = nextLand as Cesium.GeoJsonDataSource
      landDs.show = landVisible
      await viewer.dataSources.add(landDs)
      viewer.dataSources.lowerToBottom?.(landDs)

      // Africa 10m detail overlay — same style, higher resolution only.
      // (Pick index stays on the countries LOD: same features, no duplicates.)
      if (africa10On) {
        const africaFc = await loadJson(URLS.africa10)
        if (destroyed || myGen !== gen) return
        const nextAfrica = await loadCountries(africaFc)
        if (destroyed || myGen !== gen) return
        styleEntities(nextAfrica)
        if (africaDs) viewer.dataSources.remove(africaDs, true)
        africaDs = nextAfrica as Cesium.GeoJsonDataSource
        africaDs.show = bordersVisible
        await viewer.dataSources.add(africaDs)
      } else if (africaDs) {
        viewer.dataSources.remove(africaDs, true)
        africaDs = undefined
      }
      opts.onLodChange?.(currentLabel())
      viewer.container.setAttribute(
        'data-vectors',
        `ready:${countriesDs.entities.values.length}`,
      )
    } catch (err) {
      console.warn('[vectors] LOD refresh failed', err)
      viewer.container.setAttribute('data-vectors', 'error')
    }
  }

  let debounce: ReturnType<typeof setTimeout> | undefined
  const onMoveEnd = () => {
    if (debounce) clearTimeout(debounce)
    debounce = setTimeout(() => void refresh(), 250)
  }
  viewer.camera.moveEnd.addEventListener(onMoveEnd)

  // Country picking via SOURCE COORDINATES (not scene.pick, which proved
  // driver-fragile for ground-clamped vectors). Highlight only — never move/scale.
  function clearHighlight() {
    for (const e of highlighted) {
      try {
        if (e.polygon) {
          e.polygon.material = new Cesium.ColorMaterialProperty(Cesium.Color.TRANSPARENT)
        }
      } catch {
        // Entity was removed with its data source during an LOD switch.
      }
    }
    highlighted = []
  }

  function featureKey(props: Record<string, unknown>): string {
    return `${String(props.ISO_A3 ?? '')}|${String(props.NAME ?? props.ADMIN ?? '')}`
  }

  function highlightFeature(feature: AreaFeature) {
    clearHighlight()
    const props = (feature.properties ?? {}) as Record<string, unknown>
    const key = featureKey(props)
    for (const ds of [countriesDs, africaDs]) {
      if (!ds) continue
      for (const e of ds.entities.values) {
        let ep: Record<string, unknown> = {}
        try {
          ep = (e.properties?.getValue(Cesium.JulianDate.now()) ?? {}) as Record<string, unknown>
        } catch {
          continue
        }
        if (featureKey(ep) === key && e.polygon) {
          e.polygon.material = new Cesium.ColorMaterialProperty(
            Cesium.Color.YELLOW.withAlpha(0.35),
          )
          highlighted.push(e)
        }
      }
    }
  }

  const clickHandler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas)
  clickHandler.setInputAction((click: Cesium.ScreenSpaceEventHandler.PositionedEvent) => {
    if (!selectionEnabled) return
    clearHighlight()
    const cartesian = viewer.camera.pickEllipsoid(click.position)
    if (!cartesian || !pickState) {
      selectCb(null)
      return
    }
    const carto = Cesium.Ellipsoid.WGS84.cartesianToCartographic(cartesian)
    const lon = Cesium.Math.toDegrees(carto.longitude)
    const lat = Cesium.Math.toDegrees(carto.latitude)
    const feature = pickCountry(pickState.index, lon, lat)
    if (!feature) {
      selectCb(null)
      return
    }
    highlightFeature(feature)
    const props = (feature.properties ?? {}) as Record<string, unknown>
    selectCb({
      name: String(props.NAME ?? props.ADMIN ?? 'Unknown'),
      continent: props.CONTINENT != null ? String(props.CONTINENT) : undefined,
      isoA3: props.ISO_A3 != null ? String(props.ISO_A3) : undefined,
      popEst: typeof props.POP_EST === 'number' ? props.POP_EST : undefined,
      areaSqMeters: featureAreaSqMeters(feature),
      lon: Number(lon.toFixed(2)),
      lat: Number(lat.toFixed(2)),
    })
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK)

  void refresh()

  return {
    setBordersVisible(v: boolean) {
      bordersVisible = v
      if (countriesDs) countriesDs.show = v
      if (africaDs) africaDs.show = v
    },
    setLandVisible(v: boolean) {
      landVisible = v
      if (landDs) landDs.show = v
    },
    setLabelsVisible(v: boolean) {
      labelsVisible = v
      for (const e of labeled) {
        if (e.label) e.label.show = new Cesium.ConstantProperty(v)
      }
    },
    setSelectionEnabled(v: boolean) {
      selectionEnabled = v
    },
    getLod: () => currentLabel(),
    onCountrySelect(cb) {
      selectCb = cb
    },
    destroy() {
      destroyed = true
      if (debounce) clearTimeout(debounce)
      viewer.camera.moveEnd.removeEventListener(onMoveEnd)
      clickHandler.destroy()
    },
  }
}

