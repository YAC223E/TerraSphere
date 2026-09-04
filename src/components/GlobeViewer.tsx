import { useEffect, useRef, useState } from 'react'
import * as Cesium from 'cesium'
import 'cesium/Build/Cesium/Widgets/widgets.css'
import { createGlobeViewer, flyToLonLat, type ViewerStatus } from '../globe/createViewer'
import {
  applyExaggeration,
  applyQualityMode,
  sampleTerrainHeight,
  type QualityMode,
  type TerrainInfo,
} from '../globe/terrain'
import { applyImagery, IMAGERY_OPTIONS, type ImageryId } from '../globe/imagery'
import {
  resetClockToNow,
  setAtmosphere,
  setClouds,
  setLighting,
  setUtcHour,
} from '../globe/sun'
import SearchBox from '../search/SearchBox'
import { createMeasureTool, type MeasureMode, type MeasureState } from '../measure/tool'
import { formatArea, formatDistance, formatInt } from '../geodesy/geodesic'
import { attachVectorLayers, type CountryInfo } from '../layers/vectors'
import {
  collectionAreaSqMeters,
  verifyAfricaArea,
  type AfricaVerification,
} from '../geodesy/areas'
import { useLang, type Lang } from '../i18n/lang'
import { translate, type StringKey } from '../i18n/dict'

const AFRICA_FOCUS = { lon: 20, lat: 5, height: 8_000_000 }

const IMAGERY_LABEL: Record<ImageryId, StringKey> = {
  auto: 'imageryAuto',
  'esri-satellite': 'imageryEsriSatellite',
  'esri-labels': 'imageryEsriLabels',
  'osm-roads': 'imageryOsmRoads',
  off: 'imageryOff',
}

const TERRAIN_STATE_LABEL: Record<TerrainInfo['state'], StringKey> = {
  loading: 'terrainStateLoading',
  ready: 'terrainStateReady',
  error: 'terrainStateError',
  ellipsoid: 'terrainStateEllipsoid',
}

function LanguageSelector() {
  const { lang, setLang, t } = useLang()
  const btn = (l: Lang, flag: string, name: string) => (
    <button
      key={l}
      type="button"
      className={`lang-btn${lang === l ? ' active' : ''}`}
      aria-pressed={lang === l}
      title={name}
      onClick={() => setLang(l)}
    >
      <span aria-hidden="true">{flag}</span> {name}
    </button>
  )
  return (
    <div className="lang-switch" role="group" aria-label={t('langAria')}>
      {btn('en', '🇬🇧', 'English')}
      {btn('fr', '🇫🇷', 'Français')}
    </div>
  )
}

export default function GlobeViewer() {
  const { lang, locale, t } = useLang()
  const containerRef = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<Cesium.Viewer | null>(null)
  const [status, setStatus] = useState<ViewerStatus | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [coords, setCoords] = useState<string>('—')
  const [lod, setLod] = useState<string>('110m')
  const [borders, setBorders] = useState(true)
  const [land, setLand] = useState(true)
  const [labels, setLabels] = useState(false)
  const [country, setCountry] = useState<CountryInfo | null>(null)
  const [africa, setAfrica] = useState<AfricaVerification | null>(null)
  const [africaCount, setAfricaCount] = useState<number | null>(null)
  const [africaError, setAfricaError] = useState<string | null>(null)
  const [quality, setQuality] = useState<QualityMode>('balanced')
  const [exaggeration, setExaggeration] = useState(1)
  const [terrainInfo, setTerrainInfo] = useState<TerrainInfo | null>(null)
  const [elevation, setElevation] = useState<string>('—')
  const [measureMode, setMeasureMode] = useState<MeasureMode>('off')
  const [units, setUnits] = useState<'metric' | 'imperial'>('metric')
  const [measure, setMeasure] = useState<MeasureState | null>(null)
  const [imagery, setImagery] = useState<ImageryId>('auto')
  const [lighting, setLightingOn] = useState(true)
  const [atmosphere, setAtmosphereOn] = useState(true)
  const [utcHour, setUtcHourState] = useState(() => new Date().getUTCHours())
  const [clouds, setCloudsOn] = useState(false)
  const imageryStateRef = useRef<{ baseLayers: Cesium.ImageryLayer[] }>({ baseLayers: [] })
  const cloudsStateRef = useRef<{ layer: Cesium.ImageryLayer | null }>({ layer: null })
  const hasTokenRef = useRef(false)
  const measureRef = useRef<ReturnType<typeof createMeasureTool> | null>(null)
  const measureModeRef = useRef<MeasureMode>('off')
  const handleRef = useRef<ReturnType<typeof attachVectorLayers> | null>(null)
  // Mount-once Cesium handlers must use the CURRENT language, not the
  // closure from first render.
  const langRef = useRef<Lang>(lang)
  langRef.current = lang

  useEffect(() => {
    let viewer: Cesium.Viewer | undefined
    let handler: Cesium.ScreenSpaceEventHandler | undefined
    let destroyed = false

    function init() {
      if (!containerRef.current) return
      try {
        const created = createGlobeViewer(containerRef.current, {
          // Creation-time language for pre-React strings (WebGL error, terrain events).
          lang,
          onTerrainInfo: (info) => {
            if (!destroyed) setTerrainInfo(info)
          },
        })
        if (destroyed) {
          created.viewer.destroy()
          return
        }
        viewer = created.viewer
        viewerRef.current = viewer
        // Dev-only QA hook (never set in production builds).
        if (import.meta.env.DEV) {
          ;(window as unknown as { __earthViewer?: Cesium.Viewer }).__earthViewer = viewer
        }
        setStatus(created.status)
        imageryStateRef.current = created.imageryState
        hasTokenRef.current = created.hasToken

        const handle = attachVectorLayers(viewer, { onLodChange: (l) => setLod(l) })
        handleRef.current = handle
        handle.onCountrySelect((info) => {
          if (measureModeRef.current !== 'off') return
          setCountry(info)
        })

        measureRef.current = createMeasureTool(viewer, (s) => {
          if (!destroyed) setMeasure(s)
        })

        handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas)
        handler.setInputAction((movement: Cesium.ScreenSpaceEventHandler.MotionEvent) => {
          const L = langRef.current
          const cartesian = viewer?.camera.pickEllipsoid(movement.endPosition)
          if (!cartesian) {
            setCoords(translate(L, 'offGlobe'))
            setElevation(translate(L, 'noSignal'))
            return
          }
          const carto = Cesium.Ellipsoid.WGS84.cartesianToCartographic(cartesian)
          const lon = Cesium.Math.toDegrees(carto.longitude)
          const lat = Cesium.Math.toDegrees(carto.latitude)
          setCoords(`${lat.toFixed(4)}°, ${lon.toFixed(4)}°`)
          // Terrain height is display-only; measurements use ellipsoid geodesics.
          // Without an ion token there is no streamed terrain — Cesium falls back
          // to its coarse approximate-height grid, so label those readings.
          const h = viewer ? sampleTerrainHeight(viewer, lon, lat) : undefined
          if (h == null) {
            setElevation(translate(L, 'noSignal'))
          } else {
            const approx = created.status.mode === 'fallback' ? ` ${translate(L, 'approxSuffix')}` : ''
            const loc = L === 'fr' ? 'fr-FR' : 'en-US'
            setElevation(`~${formatInt(loc, h)} m${approx}`)
          }
        }, Cesium.ScreenSpaceEventType.MOUSE_MOVE)

        // Africa verification from the SAME runtime asset (no separate scaled copy).
        const base = import.meta.env.BASE_URL || '/'
        fetch(`${base}data/africa-10m.geojson`)
          .then((r) => {
            if (!r.ok) throw new Error(`HTTP ${r.status}`)
            return r.json()
          })
          .then((fc) => {
            if (destroyed) return
            const { totalSqMeters, featureCount } = collectionAreaSqMeters(fc)
            const v = verifyAfricaArea(totalSqMeters)
            setAfrica(v)
            setAfricaCount(featureCount)
            setAfricaError(null)
          })
          .catch((e) => {
            if (!destroyed) setAfricaError(String(e))
          })
      } catch (e) {
        console.error(e)
        if (!destroyed) setError(e instanceof Error ? e.message : String(e))
      }
    }
    init()

    return () => {
      destroyed = true
      handler?.destroy()
      handleRef.current?.destroy()
      measureRef.current?.destroy()
      if (viewer && !viewer.isDestroyed()) viewer.destroy()
      viewerRef.current = null
    }
    // Intentionally once: the Cesium viewer outlives language switches
    // (camera, layers, measurements all preserved; only strings re-render).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    handleRef.current?.setBordersVisible(borders)
  }, [borders])
  useEffect(() => {
    handleRef.current?.setLandVisible(land)
  }, [land])
  useEffect(() => {
    handleRef.current?.setLabelsVisible(labels)
  }, [labels])
  useEffect(() => {
    const v = viewerRef.current
    if (v) applyQualityMode(v, quality)
  }, [quality])
  useEffect(() => {
    const v = viewerRef.current
    if (v) applyExaggeration(v, exaggeration)
  }, [exaggeration])
  useEffect(() => {
    measureModeRef.current = measureMode
    measureRef.current?.setMode(measureMode)
    handleRef.current?.setSelectionEnabled(measureMode === 'off')
    if (measureMode === 'off') setMeasure(null)
  }, [measureMode])
  useEffect(() => {
    const v = viewerRef.current
    if (v) applyImagery(v, imagery, hasTokenRef.current, imageryStateRef.current)
  }, [imagery])
  useEffect(() => {
    const v = viewerRef.current
    if (v) setLighting(v, lighting)
  }, [lighting])
  useEffect(() => {
    const v = viewerRef.current
    if (v) setAtmosphere(v, atmosphere)
  }, [atmosphere])
  useEffect(() => {
    const v = viewerRef.current
    if (v) setClouds(v, clouds, cloudsStateRef.current)
  }, [clouds])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMeasureMode('off')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const intFmt = (v: number) => formatInt(locale, v)
  const pctFmt = (v: number) =>
    new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v)

  return (
    <div className="globe-shell">
      <div ref={containerRef} className="globe-container" aria-label={t('globeAria')} />
      <div className="hud top-left">
        <div className="hud-title">{t('appTitle')}</div>
        <div className="hud-sub">{t('appSubtitle')}</div>
        <LanguageSelector />
        {status && (
          <div className="hud-status">
            <span className={`dot ${status.mode}`} />
            {status.terrain} · {status.imagery}
          </div>
        )}
        <div className="hud-status">{t('vectorsLod', { lod })}</div>
        {status?.warning && <div className="hud-warning">{status.warning}</div>}
        {error && <div className="hud-warning">{t('viewerError', { error })}</div>}
      </div>

      <div className="panel top-right">
        <div className="panel-section">
          <div className="panel-heading">{t('searchHeading')}</div>
          <SearchBox viewerRef={viewerRef} />
        </div>

        <div className="panel-section">
          <div className="panel-heading">{t('measureHeading')}</div>
          <div className="measure-row">
            <button
              className={`btn measure-btn${measureMode === 'distance' ? ' active' : ''}`}
              type="button"
              onClick={() => setMeasureMode(measureMode === 'distance' ? 'off' : 'distance')}
            >
              {t('distanceButton')}
            </button>
            <button
              className={`btn measure-btn${measureMode === 'area' ? ' active' : ''}`}
              type="button"
              onClick={() => setMeasureMode(measureMode === 'area' ? 'off' : 'area')}
            >
              {t('areaButton')}
            </button>
            <select
              className="select"
              value={units}
              onChange={(e) => setUnits(e.target.value as 'metric' | 'imperial')}
              aria-label={t('unitsAria')}
            >
              <option value="metric">km / m</option>
              <option value="imperial">mi / ft</option>
            </select>
          </div>
          {measureMode !== 'off' ? (
            <div className="measure-readout">
              <div className="muted small">
                {t('measurePoints', { n: measure?.vertices.length ?? 0 })}
                {measureMode === 'area' ? t('measureAreaExtra') : ''}
                {t('measureEsc')}
              </div>
              <div className="kv">
                <span>
                  {t('lengthLabel')} <b>{formatDistance(measure?.distanceMeters ?? 0, units, locale)}</b>
                </span>
                {measureMode === 'area' && (
                  <span>
                    {t('areaLabel')} <b>{formatArea(measure?.areaSqMeters ?? 0, units, locale)}</b>
                  </span>
                )}
              </div>
              <div className="measure-row">
                <button className="btn" type="button" onClick={() => measureRef.current?.clear()}>
                  {t('clearButton')}
                </button>
                <button className="btn" type="button" onClick={() => setMeasureMode('off')}>
                  {t('doneButton')}
                </button>
              </div>
              <div className="muted small">{t('measureFootnote')}</div>
            </div>
          ) : (
            <div className="muted small">{t('measureOff')}</div>
          )}
        </div>

        <div className="panel-section">
          <div className="panel-heading">{t('terrainHeading')}</div>
          <div className="muted">
            {terrainInfo
              ? `${t(TERRAIN_STATE_LABEL[terrainInfo.state])}: ${terrainInfo.detail}`
              : t('terrainEllipsoidFallback')}
          </div>
          <label className="check">
            {t('qualityLabel')}
            <select
              className="select"
              value={quality}
              onChange={(e) => setQuality(e.target.value as QualityMode)}
              aria-label={t('qualityAria')}
            >
              <option value="performance">{t('qualityPerformance')}</option>
              <option value="balanced">{t('qualityBalanced')}</option>
              <option value="high">{t('qualityHigh')}</option>
            </select>
          </label>
          <label className="check">
            {t('exaggerationLabel')}
            <input
              type="range"
              min={1}
              max={3}
              step={0.1}
              value={exaggeration}
              onChange={(e) => setExaggeration(Number(e.target.value))}
              aria-label={t('exaggerationAria')}
            />
            <span>{new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(exaggeration)}×</span>
          </label>
          <div className="muted small">{t('terrainVisualOnly')}</div>
        </div>

        <div className="panel-section">
          <div className="panel-heading">{t('sunHeading')}</div>
          <label className="check">
            <input
              type="checkbox"
              checked={lighting}
              onChange={(e) => setLightingOn(e.target.checked)}
            />
            {t('lightingLabel')}
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={atmosphere}
              onChange={(e) => setAtmosphereOn(e.target.checked)}
            />
            {t('atmosphereLabel')}
          </label>
          <label className="check">
            {t('sunTimeLabel')}
            <input
              type="range"
              min={0}
              max={23}
              step={1}
              value={utcHour}
              onChange={(e) => {
                const h = Number(e.target.value)
                setUtcHourState(h)
                const v = viewerRef.current
                if (v) setUtcHour(v, h)
              }}
              aria-label={t('sunTimeAria')}
            />
            <span>{utcHour}:00</span>
          </label>
          <button
            className="btn"
            type="button"
            onClick={() => {
              const v = viewerRef.current
              if (v) resetClockToNow(v)
              setUtcHourState(new Date().getUTCHours())
            }}
          >
            {t('resetNow')}
          </button>
          <label className="check">
            <input type="checkbox" checked={clouds} onChange={(e) => setCloudsOn(e.target.checked)} />
            {t('cloudsLabel')}
          </label>
        </div>

        <div className="panel-section">
          <div className="panel-heading">{t('layersHeading')}</div>
          <label className="check">
            {t('imageryLabel')}
            <select
              className="select"
              value={imagery}
              onChange={(e) => setImagery(e.target.value as ImageryId)}
              aria-label={t('imageryAria')}
            >
              {IMAGERY_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>
                  {t(IMAGERY_LABEL[o.id])}
                </option>
              ))}
            </select>
          </label>
          <div className="muted small">
            {IMAGERY_OPTIONS.find((o) => o.id === imagery)?.attribution}
          </div>
          <label className="check">
            <input type="checkbox" checked={borders} onChange={(e) => setBorders(e.target.checked)} />
            {t('bordersLabel')}
          </label>
          <label className="check">
            <input type="checkbox" checked={land} onChange={(e) => setLand(e.target.checked)} />
            {t('landLabel')}
          </label>
          <label className="check">
            <input type="checkbox" checked={labels} onChange={(e) => setLabels(e.target.checked)} />
            {t('namesLabel')}
          </label>
          <button
            className="btn"
            type="button"
            onClick={() => {
              const v = viewerRef.current
              if (v) flyToLonLat(v, AFRICA_FOCUS.lon, AFRICA_FOCUS.lat, AFRICA_FOCUS.height)
            }}
          >
            {t('flyAfrica')}
          </button>
        </div>

        <div className="panel-section">
          <div className="panel-heading">{t('countryHeading')}</div>
          {country ? (
            <div className="country-card">
              <div className="country-name">{country.name}</div>
              {country.continent && <div className="muted">{country.continent}</div>}
              <div className="kv">
                {country.isoA3 && (
                  <span>
                    ISO <b>{country.isoA3}</b>
                  </span>
                )}
                {typeof country.popEst === 'number' && (
                  <span>
                    {t('popLabel')} <b>{intFmt(country.popEst)}</b>
                  </span>
                )}
              </div>
              <div className="kv">
                <span>
                  {t('areaRowLabel')} <b>{formatArea(country.areaSqMeters, units, locale)}</b>
                </span>
              </div>
              {country.lon != null && country.lat != null && (
                <div className="muted">
                  {country.lat.toFixed(2)}°, {country.lon.toFixed(2)}°
                </div>
              )}
              <div className="muted small">{t('geometryNote')}</div>
            </div>
          ) : (
            <div className="muted">{t('countryEmpty')}</div>
          )}
        </div>

        <div className="panel-section">
          <div className="panel-heading">{t('africaHeading')}</div>
          {africa ? (
            <>
              <div className="kv">
                <span>
                  {t('datasetLabel')} <b>{intFmt(africa.datasetSqKm)} km²</b>
                </span>
              </div>
              <div className="kv">
                <span>
                  {t('referenceLabel')} <b>{intFmt(africa.referenceSqKm)} km²</b>
                </span>
              </div>
              <div className="kv">
                <span>
                  Δ <b>{intFmt(africa.absDiffSqKm)} km²</b> ({pctFmt(africa.pctDiff)}%)
                </span>
              </div>
              <div className={africa.pass ? 'verdict pass' : 'verdict fail'}>
                {africa.pass ? t('passText') : t('failText')} · {t('toleranceLabel')} ±
                {intFmt(africa.toleranceFraction * 100)}%
              </div>
              <div className="muted small">
                {africaCount != null ? t('africaNote', { n: africaCount }) : t('africaComputing')}
              </div>
              <div className="muted small">{t('africaSameData')}</div>
            </>
          ) : (
            <div className="muted">
              {africaError ? t('africaUnavailable', { error: africaError }) : t('africaComputing')}
            </div>
          )}
        </div>
      </div>

      <div className="hud bottom-left">
        <span className="coord-label">{t('coordLabel')}</span>
        <span className="coord-value">{coords}</span>
        <span className="coord-label">{t('terrainWord')}</span>
        <span className="coord-value">{elevation}</span>
      </div>
      <div className="hud bottom-right">{t('bottomRight')}</div>
    </div>
  )
}
