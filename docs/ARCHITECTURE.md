# Architecture

## Decision (Phase 0 summary)

| Criterion | Weight | CesiumJS | Three.js custom | deck.gl | MapLibre |
|-----------|--------|----------|-----------------|---------|----------|
| Geographic precision (WGS84/ECEF) | Critical | ✅ native ellipsoid | ⚠️ hand-roll risk | ❌ Mercator layers | ⚠️ Mercator-first |
| True 3D globe | Critical | ✅ | ⚠️ | ❌ | ⚠️ globe effect |
| Terrain streaming (quantized-mesh/LOD) | Critical | ✅ | ❌ rebuild | ❌ | partial |
| Large vector datasets + 3D Tiles | Critical | ✅ OGC 3D Tiles | ⚠️ | ✅ overlays only | vector tiles |
| Imagery + vectors + terrain separation | High | ✅ | ⚠️ | ⚠️ | ✅ |
| Measurement-ready (cartographic picking) | High | ✅ | ⚠️ | ⚠️ | ⚠️ |
| Licensing / maintainability | Critical | ✅ Apache-2.0 + ion ToS | ✅ MIT | ✅ MIT | ✅ BSD-3 |

**Chosen: CesiumJS.** It is the only engine where Africa-correctness emerges from
`lon/lat → ellipsoid → terrain-drape` math instead of manual scaling.

## Runtime pipeline

```
GeoJSON (WGS84 lon/lat, EPSG:4326)
  → validation (ranges, antimeridian unroll, MultiPolygon split)
  → Cesium Cartographic → ECEF (WGS84 ellipsoid)
  → clamp/drape to quantized-mesh terrain tiles (LOD, frustum-culled, streamed)
  → imagery tiles (independent layer) + atmosphere/sun shader
  → pick → Cartographic → GeographicLib geodesic math (distance/area)
```

Quality modes change only tile resolution / MSSE / effects — never geometry.

## Frontend

- Vite + React + TS. `src/config/env.ts` (token handling), `src/geodesy/` (pure, testable),
  `src/globe/createViewer.ts` (Cesium lifecycle), `src/components/GlobeViewer.tsx` (HUD).
- Future: `src/layers/` (borders/labels), `src/search/` (Nominatim), `src/measure/` (tools),
  `src/compare/` (d3-geo 2D panel, educational only).

## Data pipeline (automated, no manual edits)

```
raw-data/ (Natural Earth versioned zips)
 → validation (GeoJSON lint, ring closure, CRS check)
 → cleaning (de-dupe, POV documented)
 → LOD generation (110m global / 50m continental / 10m regional)
 → runtime assets (quantized-mesh via ion; vectors as GeoJSON/3D Tiles)
```

## Performance

Cesium gives tile streaming, HLOD (`maximumScreenSpaceError`), frustum culling,
imagery/geometry separation, tile cache. Profile before optimizing (Phase 10).
