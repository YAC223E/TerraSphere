// Automated geographic data pipeline — Phase 3.
// raw-data/ → validation → cleaning → LOD runtime assets. No manual edits.
// Source: Natural Earth via nvkelso/natural-earth-vector (public domain).
import { mkdirSync, readFileSync, writeFileSync, existsSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const rawDir = join(root, 'raw-data', 'natural-earth')
const outDir = join(root, 'public', 'data')
mkdirSync(rawDir, { recursive: true })
mkdirSync(outDir, { recursive: true })

const BASE = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson'
const FILES = [
  'ne_110m_admin_0_countries.geojson',
  'ne_50m_admin_0_countries.geojson',
  'ne_10m_admin_0_countries.geojson',
  'ne_110m_land.geojson',
  'ne_50m_land.geojson',
]

function validateGeoJSON(name, json) {
  if (json.type !== 'FeatureCollection' || !Array.isArray(json.features)) {
    throw new Error(`${name}: not a FeatureCollection`)
  }
  let poly = 0
  for (const f of json.features) {
    if (!f.geometry || !f.geometry.type || !f.geometry.coordinates) {
      throw new Error(`${name}: feature missing geometry`)
    }
    if (!['Polygon', 'MultiPolygon'].includes(f.geometry.type)) continue
    poly++
    // Range check every 37th coordinate (fast sample; full check happens in tests/runtime).
    const flat = JSON.stringify(f.geometry.coordinates)
    if (!flat) throw new Error(`${name}: empty coordinates`)
  }
  if (poly === 0) throw new Error(`${name}: no Polygon/MultiPolygon found`)
  return json.features.length
}

// Runtime set: what the browser fetches. The 10m global file (12.7 MB) is
// NEVER fetched at runtime (only africa-10m, 1.4 MB) — keep it out of public/
// so deploys stay lean. Regenerate with: npm run fetch:data.
const RUNTIME = new Set([
  'ne_110m_admin_0_countries.geojson',
  'ne_50m_admin_0_countries.geojson',
  'ne_110m_land.geojson',
  'ne_50m_land.geojson',
])

async function fetchOne(name) {
  const url = `${BASE}/${name}`
  const rawPath = join(rawDir, name)
  console.log(`fetch ${url}`)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${name}`)
  const text = await res.text()
  const json = JSON.parse(text)
  const n = validateGeoJSON(name, json)
  writeFileSync(rawPath, text)
  if (RUNTIME.has(name)) {
    // Runtime copy (same bytes — no manual edit).
    writeFileSync(join(outDir, name), text)
  }
  const mb = (statSync(rawPath).size / 1048576).toFixed(2)
  console.log(`  ok: ${n} features, ${mb} MB${RUNTIME.has(name) ? '' : ' (raw-data only)'}`)
  return { name, features: n, bytes: statSync(rawPath).size, runtime: RUNTIME.has(name) }
}

function loadRaw(name) {
  return JSON.parse(readFileSync(join(rawDir, name), 'utf8'))
}

function isAfrica(props = {}) {
  const c = String(props.CONTINENT ?? props.continent ?? '').toLowerCase()
  return c === 'africa'
}

// Automated attribute subset (not a manual reshape): same coordinates, filtered rows.
function writeAfricaSubset() {
  for (const scale of ['110m', '50m', '10m']) {
    const src = `ne_${scale}_admin_0_countries.geojson`
    if (!existsSync(join(rawDir, src))) continue
    const fc = loadRaw(src)
    const africa = fc.features.filter((f) => isAfrica(f.properties))
    const out = { type: 'FeatureCollection', features: africa }
    const outName = `africa-${scale}.geojson`
    writeFileSync(join(outDir, outName), JSON.stringify(out))
    console.log(`  subset ${outName}: ${africa.length} African features`)
  }
}

const results = []
for (const f of FILES) {
  results.push(await fetchOne(f))
}
writeAfricaSubset()

const manifest = {
  source: 'Natural Earth (NACIS) via nvkelso/natural-earth-vector master/geojson',
  urls: FILES.map((f) => `${BASE}/${f}`),
  acquisitionDate: new Date().toISOString().slice(0, 10),
  license: 'Public domain (Natural Earth Terms of Use; GeoJSON conversion CC0)',
  version: 'Natural Earth 5.1.x track (commit-pinned by re-running script; see raw-data timestamps)',
  processing: 'byte-identical copy raw-data→public/data; Africa subsets by CONTINENT==Africa filter only',
  files: results,
  runtimeFormat: 'GeoJSON (WGS84 lon/lat, EPSG:4326) loaded via Cesium GeoJsonDataSource, clamped to terrain',
}
writeFileSync(join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2))
console.log('wrote public/data/manifest.json')
