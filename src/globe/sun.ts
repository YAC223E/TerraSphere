import * as Cesium from 'cesium'

// Phase 9 — sun, atmosphere, clouds. Honesty rules:
// - Sun position always comes from Cesium's ephemeris for the clock time —
//   never an arbitrary orbiting light. The slider only changes the CLOCK.
// - Clouds default OFF and are labeled visual/approximate in the UI dictionary
//   (cloudsLabel): no free real-time global cloud coverage source is wired.
//   Do not present them as observations.

export function setLighting(viewer: Cesium.Viewer, on: boolean): void {
  viewer.scene.globe.enableLighting = on
}

export function setAtmosphere(viewer: Cesium.Viewer, on: boolean): void {
  if (viewer.scene.skyAtmosphere) viewer.scene.skyAtmosphere.show = on
  viewer.scene.globe.showGroundAtmosphere = on
}

// Pure: today (UTC) at the given hour. Tested without Cesium.
export function dayUtcHour(now: Date, hour: number): Date {
  const h = Math.min(23, Math.max(0, Math.floor(hour)))
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), h, 0, 0))
}

export function setUtcHour(viewer: Cesium.Viewer, hour: number): void {
  viewer.clock.shouldAnimate = false
  viewer.clock.currentTime = Cesium.JulianDate.fromDate(dayUtcHour(new Date(), hour))
}

export function resetClockToNow(viewer: Cesium.Viewer): void {
  viewer.clock.shouldAnimate = false
  viewer.clock.currentTime = Cesium.JulianDate.fromDate(new Date())
}

let cloudUrl: string | null = null
export const CLOUD_TEXTURE_WIDTH = 1024
export const CLOUD_TEXTURE_HEIGHT = 512

// Soft blotchy alpha texture generated once at runtime (no external fetch,
// no licensing burden). Deliberately smooth — it must never read as data.
export function makeCloudTexture(): string {
  if (cloudUrl) return cloudUrl
  const w = CLOUD_TEXTURE_WIDTH
  const h = CLOUD_TEXTURE_HEIGHT
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''
  ctx.clearRect(0, 0, w, h)
  let seed = 42
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0
    return seed / 4294967296
  }
  for (const cells of [6, 12, 24, 48]) {
    const gw = cells * 2
    const gh = cells
    const grid = document.createElement('canvas')
    grid.width = gw
    grid.height = gh
    const g = grid.getContext('2d')
    if (!g) continue
    const img = g.createImageData(gw, gh)
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.floor(rand() * 255)
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 255
      img.data[i + 3] = v
    }
    g.putImageData(img, 0, 0)
    ctx.globalAlpha = 0.28
    ctx.imageSmoothingEnabled = true
    ctx.drawImage(grid, 0, 0, w, h)
  }
  // Threshold: keep soft mid-tones, drop faint haze and hard whites.
  const full = ctx.getImageData(0, 0, w, h)
  const d = full.data
  for (let i = 0; i < d.length; i += 4) {
    const a = d[i + 3] / 255
    const t = Math.min(1, Math.max(0, (a - 0.42) * 2.4))
    d[i] = d[i + 1] = d[i + 2] = 255
    d[i + 3] = Math.floor(t * 150)
  }
  ctx.globalAlpha = 1
  ctx.putImageData(full, 0, 0)
  cloudUrl = canvas.toDataURL('image/png')
  return cloudUrl
}

export function setClouds(
  viewer: Cesium.Viewer,
  on: boolean,
  state: { layer: Cesium.ImageryLayer | null },
): void {
  if (on && !state.layer) {
    const url = makeCloudTexture()
    if (!url) return
    state.layer = buildCloudsLayer(url)
    viewer.imageryLayers.add(state.layer)
  } else if (!on && state.layer) {
    viewer.imageryLayers.remove(state.layer, true)
    state.layer = null
  }
}

// Pure construction (no DOM): unit-testable. Throws if Cesium's required
// tileWidth/tileHeight are missing — regression guard for the Phase-11 find.
export function buildCloudsLayer(dataUrl: string): Cesium.ImageryLayer {
  const layer = new Cesium.ImageryLayer(
    new Cesium.SingleTileImageryProvider({
      url: dataUrl,
      rectangle: Cesium.Rectangle.MAX_VALUE,
      // Required by Cesium (Check.typeOf.number) — must match makeCloudTexture().
      tileWidth: CLOUD_TEXTURE_WIDTH,
      tileHeight: CLOUD_TEXTURE_HEIGHT,
    }),
  )
  layer.alpha = 0.85
  return layer
}
