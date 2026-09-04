import * as Cesium from 'cesium'
import { geodesicPathLengthMeters, geodesicPolygonArea } from '../geodesy/geodesic'

// Phase 8 — interactive geodesic measurement. All numbers come from WGS84
// Karney geodesics over lon/lat vertices. Screen pixels are never used.
export type MeasureMode = 'off' | 'distance' | 'area'

export interface MeasureState {
  mode: Exclude<MeasureMode, 'off'>
  vertices: Array<[number, number]>
  distanceMeters: number
  areaSqMeters: number
}

function toLonLat(cartesian: Cesium.Cartesian3): [number, number] | null {
  const carto = Cesium.Ellipsoid.WGS84.cartesianToCartographic(cartesian)
  if (!carto) return null
  return [Cesium.Math.toDegrees(carto.longitude), Cesium.Math.toDegrees(carto.latitude)]
}

export function createMeasureTool(
  viewer: Cesium.Viewer,
  onUpdate: (state: MeasureState | null) => void,
): {
  setMode(mode: MeasureMode): void
  clear(): void
  destroy(): void
} {
  let mode: MeasureMode = 'off'
  let vertices: Array<[number, number]> = []
  let hover: [number, number] | null = null
  const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas)

  function emit() {
    if (mode === 'off' || vertices.length === 0) {
      onUpdate(null)
      return
    }
    const path: Array<[number, number]> = hover ? [...vertices, hover] : [...vertices]
    const distanceMeters = geodesicPathLengthMeters(path.length >= 2 ? path : vertices)
    let areaSqMeters = 0
    if (mode === 'area' && vertices.length >= 3) {
      const ring = [...vertices, vertices[0]]
      areaSqMeters = geodesicPolygonArea(hover ? [...vertices, hover, vertices[0]] : ring).areaSqMeters
    }
    onUpdate({ mode: mode as Exclude<MeasureMode, 'off'>, vertices: [...vertices], distanceMeters, areaSqMeters })
  }

  function redraw() {
    viewer.entities.suspendEvents()
    try {
      // Remove previous measure entities (tagged), keep search markers + vectors.
      const doomed = viewer.entities.values.filter((e) => (e.properties?.getValue(Cesium.JulianDate.now()) as { measure?: boolean } | undefined)?.measure)
      for (const e of doomed) viewer.entities.remove(e)

      if (mode === 'off' || vertices.length === 0) return
      const pts = hover ? [...vertices, hover] : vertices
      for (const [lon, lat] of vertices) {
        viewer.entities.add({
          properties: { measure: true },
          position: Cesium.Cartesian3.fromDegrees(lon, lat),
          point: new Cesium.PointGraphics({
            pixelSize: 8,
            color: Cesium.Color.CYAN,
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 2,
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          }),
        })
      }
      if (pts.length >= 2) {
        viewer.entities.add({
          properties: { measure: true },
          polyline: new Cesium.PolylineGraphics({
            positions: new Cesium.ConstantProperty(
              Cesium.Cartesian3.fromDegreesArray(pts.flat()),
            ),
            material: new Cesium.ColorMaterialProperty(Cesium.Color.CYAN.withAlpha(0.9)),
            width: new Cesium.ConstantProperty(2),
            clampToGround: new Cesium.ConstantProperty(true),
          }),
        })
      }
      if (mode === 'area' && vertices.length >= 3) {
        const ring = [...vertices, vertices[0]]
        viewer.entities.add({
          properties: { measure: true },
          polygon: new Cesium.PolygonGraphics({
            hierarchy: new Cesium.ConstantProperty(
              new Cesium.PolygonHierarchy(Cesium.Cartesian3.fromDegreesArray(ring.flat())),
            ),
            material: new Cesium.ColorMaterialProperty(Cesium.Color.CYAN.withAlpha(0.2)),
            outline: new Cesium.ConstantProperty(true),
            outlineColor: new Cesium.ConstantProperty(Cesium.Color.CYAN),
            heightReference: new Cesium.ConstantProperty(Cesium.HeightReference.CLAMP_TO_GROUND),
          }),
        })
      }
    } finally {
      viewer.entities.resumeEvents()
    }
  }

  function refresh() {
    redraw()
    emit()
  }

  handler.setInputAction((click: Cesium.ScreenSpaceEventHandler.PositionedEvent) => {
    if (mode === 'off') return
    const picked = viewer.camera.pickEllipsoid(click.position)
    if (!picked) return
    const ll = toLonLat(picked)
    if (!ll) return
    vertices.push(ll)
    refresh()
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK)

  handler.setInputAction((m: Cesium.ScreenSpaceEventHandler.MotionEvent) => {
    if (mode === 'off' || vertices.length === 0) return
    const picked = viewer.camera.pickEllipsoid(m.endPosition)
    hover = picked ? (toLonLat(picked) ?? null) : null
    refresh()
  }, Cesium.ScreenSpaceEventType.MOUSE_MOVE)

  handler.setInputAction(() => {
    // Double-click adds nothing (Cesium fires two LEFT_CLICKs); finish via Done button.
  }, Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK)

  return {
    setMode(m: MeasureMode) {
      mode = m
      vertices = []
      hover = null
      refresh()
    },
    clear() {
      vertices = []
      hover = null
      refresh()
    },
    destroy() {
      handler.destroy()
    },
  }
}
