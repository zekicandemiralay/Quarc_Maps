import axios from 'axios'

const BASE = 'https://photon.komoot.io'

export async function search(query, limit = 7, bias = null) {
  const params = { q: query, limit }
  if (bias?.lat != null && bias?.lng != null) {
    params.lat = bias.lat
    params.lon = bias.lng
  }
  const { data } = await axios.get(`${BASE}/api/`, {
    params,
    headers: { 'User-Agent': 'QuarcMaps/1.0' },
    timeout: 5000,
  })

  return (data.features ?? []).map((f) => {
    const p = f.properties
    // Address result (has street + housenumber) — build "Street 42" as the primary name
    const addressName = p.housenumber && p.street
      ? `${p.street} ${p.housenumber}`
      : (p.street && !p.name ? p.street : null)
    const name = addressName || p.name || p.street || 'Unknown'
    // Subtitle: city, state, country — include postcode for address results
    const subtitleParts = [
      p.housenumber && p.postcode ? p.postcode : null,
      p.city,
      p.state,
      p.country,
    ].filter(Boolean)
    return {
      name,
      subtitle: subtitleParts.join(', '),
      lat: f.geometry.coordinates[1],
      lng: f.geometry.coordinates[0],
      osmId: p.osm_id,
      osmType: p.osm_type,
    }
  })
}

export async function reverse(lat, lng) {
  const { data } = await axios.get(`${BASE}/reverse`, {
    params: { lat, lon: lng, limit: 1 },
    headers: { 'User-Agent': 'QuarcMaps/1.0' },
    timeout: 5000,
  })

  const f = data.features?.[0]
  if (!f) return null

  const p = f.properties
  const parts = [p.city, p.state, p.country].filter(Boolean)
  return {
    name: p.name || p.street || parts[0] || `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
    subtitle: parts.join(', '),
    lat,
    lng,
  }
}
