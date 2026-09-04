# Data provenance

| Dataset | Provider / version | Resolution | License | URL | Processing → runtime |
|---------|--------------------|------------|---------|-----|----------------------|
| Countries (all scales) | Natural Earth 5.1.x via nvkelso/natural-earth-vector master, acquired 2026-09-04 | 1:110m (177 feats, 0.8 MB) / 1:50m (242, 2.9 MB) / 1:10m (258, 12.7 MB) | Public domain (NACIS; GeoJSON conversion CC0) | https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_{110m,50m,10m}_admin_0_countries.geojson | `npm run fetch:data` → byte-identical raw-data→public/data, validated FeatureCollection |
| Land (coastline fill) | Same source/date | 1:110m (127, 0.13 MB) / 1:50m (1420, 1.6 MB) | Public domain | …/ne_{110m,50m}_land.geojson | Same pipeline, subtle white fill clamped to terrain |
| Africa subsets | Derived 2026-09-04 by `CONTINENT==Africa` filter only | africa-110m (51) / africa-50m (54) / africa-10m (55, 1.4 MB) | Same as source | local `public/data/africa-*.geojson` | Attribute filter, coordinates untouched — same bytes per feature |
| Terrain | Cesium World Terrain (ion; SRTM, EU-DEM/Copernicus, LINZ NZ 8m, Geoscience AU 5m, USGS NED/GTOPO30) | 0.5m–30m land, 1km fill | Cesium ion ToS (token, attribution) | https://cesium.com/platform/cesium-ion/content/cesium-world-terrain | quantized-mesh streamed; fallback `EllipsoidTerrainProvider` |
| Imagery primary | Cesium World Imagery / Sentinel-2 (ion) | to ~0.3m urban | ion ToS (sessions metered) | ion dashboard | default base layer when token present |
| Imagery fallback | Esri World Imagery (Maxar/Airbus/community) | variable | Esri Master Agreement (attribution, no bulk scrape) | services.arcgisonline.com tile/{z}/{y}/{x} | `UrlTemplateImageryProvider`, credit rendered |
| Imagery labels overlay | Esri Reference/World_Boundaries_and_Places (Overture, OSM) | variable | Esri Master Agreement (attribution) | …/Reference/World_Boundaries_and_Places/…/tile/{z}/{y}/{x} | second layer above satellite |
| Imagery roads | OpenStreetMap raster tiles | z0–19 | ODbL (attribution, low-volume; tile policy) | tile.openstreetmap.org | explicit option, not default |
| Clouds | Runtime-generated soft alpha texture (no external source) | n/a (visual) | none (generated, unencumbered) | none | `SingleTileImageryProvider`, default OFF, labeled approximate |
| Search (Phase 7) | Nominatim / OSM planet | — | ODbL (attribution, 1 req/s, User-Agent, cache) | nominatim.openstreetmap.org | fetch → flyTo; Photon autocomplete later |

## Africa verification results (2026-09-04, Karney geodesics, holes subtracted)

| LOD | Features | Dataset area | vs 30.37M ref | Verdict (±5%) |
|-----|----------|--------------|---------------|---------------|
| 110m | 51 | 29,946,198 km² | −1.40% | PASS |
| 50m | 54 | 29,890,202 km² | −1.58% | PASS |
| 10m | 55 | 29,890,708 km² | −1.58% | PASS |

Residual −1.4→−1.6% is coastline generalization + dataset definition (de-facto boundaries,
small-island merges at 110m), not manipulation. Includes Madagascar. Reproduce:
`npm run fetch:data && npm test` (see `tests/africa-dataset.test.ts`).

Disputed boundaries: Natural Earth de-facto convention; POV variants documented, never
presented as absolute truth. GADM rejected (non-commercial restriction). No Google/Bing/Apple scrape.
Regenerate any time: `npm run fetch:data` (writes `public/data/manifest.json`).
