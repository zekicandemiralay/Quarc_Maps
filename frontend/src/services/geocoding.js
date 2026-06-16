const API = import.meta.env.VITE_API_URL ?? '/api'

export async function searchPlaces(query, bias = null) {
  const params = new URLSearchParams({ q: query })
  if (bias?.lat != null && bias?.lng != null) {
    params.set('lat', bias.lat)
    params.set('lng', bias.lng)
  }
  const res = await fetch(`${API}/geocode?${params}`)
  if (!res.ok) throw new Error('Geocoding failed')
  return res.json()
}

export async function reverseGeocode(lat, lng) {
  const res = await fetch(`${API}/geocode/reverse?lat=${lat}&lng=${lng}`)
  if (!res.ok) return null
  return res.json()
}
