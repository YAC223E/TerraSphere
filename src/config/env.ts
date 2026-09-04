export function getCesiumIonToken(): string | undefined {
  const token = import.meta.env.VITE_CESIUM_ION_TOKEN as string | undefined
  if (token && token.trim().length > 0) return token.trim()
  return undefined
}

export function getDefaultView(): { lon: number; lat: number } {
  const lon = Number(import.meta.env.VITE_DEFAULT_VIEW_LON ?? 20)
  const lat = Number(import.meta.env.VITE_DEFAULT_VIEW_LAT ?? 5)
  return {
    lon: Number.isFinite(lon) ? lon : 20,
    lat: Number.isFinite(lat) ? lat : 5,
  }
}
