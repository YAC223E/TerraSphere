# Accuracy methodology

- Terminology: "high-precision 3D geospatial visualization using real geographic
  coordinates" — never "100% distortion-free flat map" (impossible: sphere ≠ plane).
- Earth: WGS84 ellipsoid. Verified via `lonLatToEcef` closed-form tests.
- Distance: Karney inverse geodesic (`Geodesic.WGS84.Inverse`), nm-accurate.
  Turf Haversine is NOT authoritative.
- Area: Karney `PolygonArea` over geodesic edges; antimeridian rings unrolled.
- Africa gate: Natural Earth dissolve vs 30.37M km² (UN/WB) ≤5%; resolution/coastline
  differences documented, geometry never scaled.
- Honesty: decimal places ≠ survey accuracy. Effective accuracy = min(source survey,
  coastline definition, simplification, terrain/imagery source). Stated per layer.
