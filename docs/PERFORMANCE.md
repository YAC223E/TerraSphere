# Performance baseline (measured 2026-09-04, Phase 10)

Measure first — every optimization below cites a number. Nothing here changes
geometry or geodesy; quality modes alter tile density only.

## Deploy weight (`vite build`)

| Artifact | Size | Gzip | Notes |
|----------|------|------|-------|
| `assets/index-*.js` | 4.39 MB | ~1.19 MB | Cesium-dominated; tree-shaking N/A (engine is monolithic) |
| `assets/index-*.css` | 28 KB | ~6 KB | app + Cesium widgets |
| `cesium/` (Workers/Assets/Widgets/ThirdParty) | 7.6 MB | — | required static assets; 110 workers |
| `data/` runtime vectors | 7.5 MB total | — | 110m countries 0.8 MB, 50m 3.0 MB, land 1.7 MB, africa-10m 1.4 MB |
| `data/ne_10m` global 12.7 MB | excluded | — | raw-data only; runtime never fetches it (−13 MB deploy) |

## Runtime loading (by design, not accident)

- Initial vector fetch: 110m countries (0.8 MB) + land (0.13 MB). 50m (4.6 MB)
  loads only below 9,000 km; africa-10m (1.4 MB) only below 5,000 km over Africa.
- Terrain/imagery stream per-tile via Cesium (quantized-mesh LOD, frustum-culled,
  tile cache). MSSE 4/2/1 across Performance/Balanced/High.
- Search: debounced + ≤1 req/s + 10-min cache (provider policy, not perf theater).

## Measured suite

- `npm test`: 34 tests, ~3.7 s (Vitest, Node).
- `npm run qa` (headless Chrome + SwiftShader): canvas renders (lit 0.56),
  LOD badge + Africa PASS in DOM, zero console/page errors, zero local 4xx.
  Screenshot: `qa/screenshots/global.png` (regenerate; gitignored).

## Applied optimizations (this phase)

1. Removed `d3-geo` + `@types/d3-geo`: imported nowhere (projection-comparison
   2D mode deferred — see README limitations). Smaller install surface.
2. `ne_10m` global excluded from `public/`/dist: saves 13 MB deploy; Africa
   detail still served via `africa-10m` subset (same bytes per feature).
3. Fixed `vite-plugin-static-copy` mapping (was emitting
   `dist/cesium/node_modules/...` → production 404s on Workers/Assets, black
   globe). Correctness fix with perf side-effect (workers actually load).
4. Fixed Africa-10m LOD toggle dead-code (overlay never engaged within one LOD
   band) — avoids redundant full reloads on zoom.

## Known, deliberately not "optimized"

- 4.39 MB JS: splitting Cesium via dynamic import would complicate the viewer
  lifecycle for marginal first-paint gain (globe IS the app). Revisit with RUM
  data, not speculation.
- Software-GL QA render ≈25 s wall (15 s settle + tiles); hardware GL is the
  real target — QA asserts correctness, not frame rate.
