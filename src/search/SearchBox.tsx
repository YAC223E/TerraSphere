import { useEffect, useRef, useState } from 'react'
import * as Cesium from 'cesium'
import {
  bboxTargetHeightMeters,
  parseCoordinateInput,
  SEARCH_ATTRIBUTION,
  searchPlaces,
  type Place,
} from './nominatim'
import { useLang } from '../i18n/lang'
import { flyToLonLat } from '../globe/createViewer'

export default function SearchBox({ viewerRef }: { viewerRef: React.RefObject<Cesium.Viewer | null> }) {
  const { t } = useLang()
  const [q, setQ] = useState('')
  const [results, setResults] = useState<Place[]>([])
  const [loading, setLoading] = useState(false)
  // Error stored as a translation KEY so it re-renders in the active language.
  const [errKey, setErrKey] = useState<'noResults' | 'searchFailed' | null>(null)
  const [coordHint, setCoordHint] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const markerRef = useRef<Cesium.Entity | null>(null)

  useEffect(() => {
    setCoordHint(parseCoordinateInput(q) !== null)
    if (q.trim().length < 3) {
      setResults([])
      setErrKey(null)
      setLoading(false)
      abortRef.current?.abort()
      return
    }
    setLoading(true)
    const timer = setTimeout(() => {
      abortRef.current?.abort()
      const ctl = new AbortController()
      abortRef.current = ctl
      searchPlaces(q, ctl.signal)
        .then((places) => {
          setResults(places)
          setErrKey(places.length === 0 ? 'noResults' : null)
        })
        .catch((e) => {
          if ((e as Error).name !== 'AbortError') setErrKey('searchFailed')
        })
        .finally(() => setLoading(false))
    }, 400)
    return () => clearTimeout(timer)
  }, [q])

  function go(lat: number, lon: number, label: string, bbox?: Place['bbox']) {
    const viewer = viewerRef.current
    if (!viewer) return
    if (markerRef.current) viewer.entities.remove(markerRef.current)
    markerRef.current = viewer.entities.add({
      position: Cesium.Cartesian3.fromDegrees(lon, lat),
      point: new Cesium.PointGraphics({
        pixelSize: 10,
        color: Cesium.Color.YELLOW,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 2,
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
      }),
      label: new Cesium.LabelGraphics({
        text: label.length > 60 ? `${label.slice(0, 60)}…` : label,
        font: '12px Inter, sans-serif',
        fillColor: Cesium.Color.WHITE,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 3,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        pixelOffset: new Cesium.Cartesian2(0, -28),
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
      }),
    })
    flyToLonLat(viewer, lon, lat, bboxTargetHeightMeters(bbox))
    setResults([])
  }

  function submit() {
    const c = parseCoordinateInput(q)
    if (c) {
      go(c.lat, c.lon, `${c.lat}, ${c.lon}`)
      return
    }
    const first = results[0]
    if (first) go(first.lat, first.lon, first.displayName, first.bbox)
  }

  return (
    <div className="search">
      <div className="search-row">
        <input
          className="search-input"
          type="search"
          placeholder={t('searchPlaceholder')}
          aria-label={t('searchAria')}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit()
            if (e.key === 'Escape') {
              setQ('')
              setResults([])
            }
          }}
        />
        <button className="btn search-btn" type="button" onClick={submit} disabled={q.trim().length < 3 && !coordHint}>
          {loading ? '…' : t('flyButton')}
        </button>
      </div>
      {coordHint && <div className="muted small">{t('coordHint')}</div>}
      {errKey && <div className="hud-warning">{t(errKey)}</div>}
      {results.length > 0 && (
        <ul className="search-results">
          {results.map((p, i) => (
            <li key={`${p.lat},${p.lon}-${i}`}>
              <button type="button" onClick={() => go(p.lat, p.lon, p.displayName, p.bbox)}>
                <span className="sr-name">{p.displayName}</span>
                <span className="muted small">
                  {p.type} · {p.lat.toFixed(3)}°, {p.lon.toFixed(3)}°
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="muted small">{SEARCH_ATTRIBUTION} · {t('searchLimits')}</div>
    </div>
  )
}
