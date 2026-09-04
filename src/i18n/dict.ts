// Translation resources. English is the source of truth; `fr` is typed as
// `Strings` so a missing French key fails compilation. Runtime lookup falls
// back to English per-key (never undefined / key / empty).
// Proper names (CesiumJS, WGS84, Natural Earth, OpenStreetMap, dataset/API
// values, country names) stay untranslated by design.
export const en = {
  appTitle: 'High-precision 3D Earth',
  appSubtitle: 'WGS84 globe · real geographic coordinates',
  vectorsLod: 'vectors: Natural Earth LOD [{lod}] · click a country',
  noTokenWarning:
    'No Cesium ion token — using ellipsoid + open imagery fallback. Add VITE_CESIUM_ION_TOKEN for full terrain.',
  viewerError: 'Viewer error: {error}',
  globeAria: '3D Earth globe',
  bottomRight: 'Globe is authoritative · projections are educational only',
  coordLabel: 'WGS84',
  terrainWord: 'terrain',
  offGlobe: '— (off-globe)',
  noSignal: 'no signal',
  approxSuffix: '(approx)',
  langAria: 'Language',

  searchHeading: 'Search',
  searchPlaceholder: 'Search countries, cities, landmarks…',
  searchAria: 'Geographic search',
  flyButton: 'Fly',
  coordHint: 'Coordinates detected — Enter flies there.',
  noResults: 'No results — try "lat, lon" coordinates.',
  searchFailed: 'Search failed — check connection and retry.',
  searchLimits: 'min. 3 chars, ≤1 req/s',

  measureHeading: 'Measure (geodesic)',
  distanceButton: 'Distance',
  areaButton: 'Area',
  unitsAria: 'Measurement units',
  measurePoints: 'Click the globe to add points ({n})',
  measureAreaExtra: ' · ≥3 closes polygon',
  measureEsc: ' · Esc cancels',
  lengthLabel: 'Length',
  areaLabel: 'Area',
  clearButton: 'Clear',
  doneButton: 'Done',
  measureFootnote: 'Karney WGS84 geodesics — never pixels.',
  measureOff: 'Off — country click-to-inspect active.',

  terrainHeading: 'Terrain',
  terrainStateLoading: 'loading',
  terrainStateReady: 'ready',
  terrainStateError: 'error',
  terrainStateEllipsoid: 'ellipsoid',
  terrainLoading: 'Streaming World Terrain tiles…',
  terrainReady: 'World Terrain ready · vertex normals + water mask on',
  terrainError:
    'Terrain tiles failing — globe falls back per-tile to ellipsoid. Vectors stay correct.',
  terrainEllipsoidFallback: 'ellipsoid fallback (no ion token)',
  qualityLabel: 'Quality',
  qualityAria: 'Rendering quality',
  qualityPerformance: 'Performance',
  qualityBalanced: 'Balanced',
  qualityHigh: 'High quality',
  exaggerationLabel: 'Exaggeration',
  exaggerationAria: 'Terrain exaggeration (visual only)',
  terrainVisualOnly: 'Visual only — measurements use ellipsoid geodesics.',

  sunHeading: 'Sun & sky (real ephemeris)',
  lightingLabel: 'Sun lighting + day/night terminator',
  atmosphereLabel: 'Atmosphere + stars',
  sunTimeLabel: 'Sun time (UTC)',
  sunTimeAria: 'Sun time in UTC hours',
  resetNow: 'Reset to now',
  cloudsLabel: 'Clouds (visual / approximate — not real coverage)',

  layersHeading: 'Layers',
  imageryLabel: 'Imagery',
  imageryAria: 'Base imagery',
  imageryAuto: 'Auto (ion satellite, else Esri)',
  imageryEsriSatellite: 'Esri World Imagery (satellite)',
  imageryEsriLabels: 'Esri satellite + boundaries/places',
  imageryOsmRoads: 'OpenStreetMap roads (low-volume)',
  imageryOff: 'No imagery (vectors on ellipsoid)',
  bordersLabel: 'Country borders',
  landLabel: 'Land fill',
  namesLabel: 'Country names',
  flyAfrica: 'Fly to Africa',

  countryHeading: 'Country',
  countryEmpty: 'Click any country to inspect it.',
  popLabel: 'Pop',
  areaRowLabel: 'Geodesic area',
  geometryNote: 'Geometry preserved · highlight only, never moved/scaled.',

  africaHeading: 'Africa Reality Check',
  datasetLabel: 'Dataset',
  referenceLabel: 'Reference',
  toleranceLabel: 'tolerance',
  passText: 'PASS',
  failText: 'FAIL',
  africaComputing: 'computing…',
  africaNote: '{n} features · Natural Earth 1:10m Africa subset (CONTINENT filter, coordinates untouched)',
  africaSameData:
    'Same data on globe and here — scale emerges from ellipsoid math, not manual resize.',
  africaUnavailable: 'verification unavailable: {error}',

  webglError:
    'WebGL unavailable — this 3D globe requires WebGL2. Try a recent desktop/mobile browser with hardware acceleration.',
}

export type Strings = typeof en
export type StringKey = keyof Strings

export const fr: Strings = {
  appTitle: 'Terre 3D haute précision',
  appSubtitle: 'Globe WGS84 · coordonnées géographiques réelles',
  vectorsLod: 'vecteurs : Natural Earth LOD [{lod}] · cliquez sur un pays',
  noTokenWarning:
    'Aucun jeton Cesium ion — ellipsoïde + imagerie ouverte de secours. Ajoutez VITE_CESIUM_ION_TOKEN pour le terrain complet.',
  viewerError: "Erreur d'affichage : {error}",
  globeAria: 'Globe terrestre 3D',
  bottomRight: "Le globe fait foi · les projections n'ont qu'un but pédagogique",
  coordLabel: 'WGS84',
  terrainWord: 'terrain',
  offGlobe: '— (hors du globe)',
  noSignal: 'aucun signal',
  approxSuffix: '(approx.)',
  langAria: 'Langue',

  searchHeading: 'Recherche',
  searchPlaceholder: 'Rechercher pays, villes, lieux…',
  searchAria: 'Recherche géographique',
  flyButton: 'Aller',
  coordHint: 'Coordonnées détectées — Entrée pour y aller.',
  noResults: 'Aucun résultat — essayez des coordonnées « lat, lon ».',
  searchFailed: 'Échec de la recherche — vérifiez la connexion et réessayez.',
  searchLimits: 'min. 3 caractères, ≤1 req/s',

  measureHeading: 'Mesure (géodésique)',
  distanceButton: 'Distance',
  areaButton: 'Superficie',
  unitsAria: 'Unités de mesure',
  measurePoints: 'Cliquez sur le globe pour ajouter des points ({n})',
  measureAreaExtra: ' · ≥3 ferme le polygone',
  measureEsc: ' · Échap annule',
  lengthLabel: 'Longueur',
  areaLabel: 'Superficie',
  clearButton: 'Effacer',
  doneButton: 'Terminé',
  measureFootnote: 'Géodésiques de Karney (WGS84) — jamais des pixels.',
  measureOff: 'Désactivée — cliquez sur un pays pour l’inspecter.',

  terrainHeading: 'Terrain',
  terrainStateLoading: 'chargement',
  terrainStateReady: 'prêt',
  terrainStateError: 'erreur',
  terrainStateEllipsoid: 'ellipsoïde',
  terrainLoading: 'Chargement des tuiles World Terrain…',
  terrainReady: 'World Terrain prêt · normales de sommets et masque d’eau activés',
  terrainError:
    'Échec des tuiles de terrain — repli vers l’ellipsoïde tuile par tuile. Les vecteurs restent exacts.',
  terrainEllipsoidFallback: 'ellipsoïde de secours (sans jeton ion)',
  qualityLabel: 'Qualité',
  qualityAria: 'Qualité de rendu',
  qualityPerformance: 'Performance',
  qualityBalanced: 'Équilibrée',
  qualityHigh: 'Haute qualité',
  exaggerationLabel: 'Exagération',
  exaggerationAria: 'Exagération du relief (visuel uniquement)',
  terrainVisualOnly: 'Visuel uniquement — les mesures utilisent les géodésiques de l’ellipsoïde.',

  sunHeading: 'Soleil et ciel (éphémérides réelles)',
  lightingLabel: 'Éclairage solaire + terminateur jour/nuit',
  atmosphereLabel: 'Atmosphère + étoiles',
  sunTimeLabel: 'Heure solaire (UTC)',
  sunTimeAria: 'Heure solaire en heures UTC',
  resetNow: 'Heure actuelle',
  cloudsLabel: 'Nuages (visuel / approximatif — pas de données réelles)',

  layersHeading: 'Couches',
  imageryLabel: 'Imagerie',
  imageryAria: "Imagerie de fond",
  imageryAuto: 'Auto (satellite ion, sinon Esri)',
  imageryEsriSatellite: 'Esri World Imagery (satellite)',
  imageryEsriLabels: 'Satellite Esri + frontières et lieux',
  imageryOsmRoads: 'Routes OpenStreetMap (faible volume)',
  imageryOff: 'Sans imagerie (vecteurs sur l’ellipsoïde)',
  bordersLabel: 'Frontières',
  landLabel: 'Terres',
  namesLabel: 'Noms des pays',
  flyAfrica: 'Aller en Afrique',

  countryHeading: 'Pays',
  countryEmpty: 'Cliquez sur un pays pour l’inspecter.',
  popLabel: 'Pop.',
  areaRowLabel: 'Superficie géodésique',
  geometryNote: 'Géométrie préservée · surlignage seul, sans déplacement ni redimensionnement.',

  africaHeading: 'Vérification Afrique',
  datasetLabel: 'Données',
  referenceLabel: 'Référence',
  toleranceLabel: 'tolérance',
  passText: 'RÉUSSI',
  failText: 'ÉCHEC',
  africaComputing: 'calcul en cours…',
  africaNote:
    '{n} entités · sous-ensemble Afrique Natural Earth 1:10m (filtre CONTINENT, coordonnées intactes)',
  africaSameData:
    'Mêmes données ici et sur le globe — l’échelle découle du calcul ellipsoïdal, sans redimensionnement manuel.',
  africaUnavailable: 'vérification indisponible : {error}',

  webglError:
    'WebGL indisponible — ce globe 3D requiert WebGL2. Utilisez un navigateur récent avec accélération matérielle.',
}

const tables = { en, fr } as const

export function translate(
  lang: 'en' | 'fr',
  key: StringKey,
  vars?: Record<string, string | number>,
  table?: Partial<Record<StringKey, string>>,
): string {
  // Per-key English fallback: never undefined / key / empty.
  // An explicit table replaces the language table (used to simulate gaps).
  const src: Partial<Record<StringKey, string>> = table ?? tables[lang]
  let s: string = src[key] ?? en[key]
  if (vars) {
    for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, String(v))
  }
  return s
}
