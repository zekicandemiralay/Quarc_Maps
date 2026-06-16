import axios from 'axios'

const BASE = 'https://overpass-api.de/api/interpreter'

// Maps our chip keys to OSM tags (arrays = multiple tag options, OR-ed together)
const CATEGORY_TAGS = {
  restaurant: [['amenity', 'restaurant'], ['amenity', 'fast_food']],
  cafe:       [['amenity', 'cafe'], ['amenity', 'coffee_shop']],
  hotel:      [['tourism', 'hotel'], ['tourism', 'motel'], ['tourism', 'hostel']],
  gas:        [['amenity', 'fuel']],
  atm:        [['amenity', 'atm'], ['amenity', 'bank']],
  shopping:   [['shop', 'mall'], ['shop', 'department_store'], ['shop', 'supermarket'], ['shop', 'convenience']],
  hospital:   [['amenity', 'hospital'], ['amenity', 'clinic'], ['amenity', 'doctors']],
  parking:    [['amenity', 'parking']],
  pharmacy:   [['amenity', 'pharmacy']],
}

export async function nearbyPOI(category, lat, lng, radius = 1500, limit = 15) {
  const tagPairs = CATEGORY_TAGS[category] ?? [['amenity', category]]

  // Build Overpass union query — node + way for each tag pair
  const unions = tagPairs.map(([key, val]) => [
    `node["${key}"="${val}"](around:${radius},${lat},${lng});`,
    `way["${key}"="${val}"](around:${radius},${lat},${lng});`,
  ]).flat().join('\n  ')

  const query = `[out:json][timeout:12];\n(\n  ${unions}\n);\nout center ${limit};`

  const { data } = await axios.post(BASE, `data=${encodeURIComponent(query)}`, {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'QuarcMaps/1.0',
    },
    timeout: 14000,
  })

  return (data.elements ?? [])
    .map((el) => {
      const coords = el.type === 'way' ? el.center : el
      if (!coords?.lat || !coords?.lon) return null
      const t = el.tags ?? {}
      const name = t.name || t['name:en'] || t.amenity || t.tourism || t.shop || category
      const subtitleParts = [
        t['addr:street'] && t['addr:housenumber']
          ? `${t['addr:street']} ${t['addr:housenumber']}`
          : t['addr:street'],
        t['addr:city'] || t['addr:suburb'],
      ].filter(Boolean)
      return {
        name,
        subtitle: subtitleParts.join(', ') || null,
        lat: coords.lat,
        lng: coords.lon,
        // OSM data extras (not always present)
        stars:        t.stars        || null,   // hotel star rating (1-5)
        cuisine:      t.cuisine      || null,   // restaurant cuisine type
        opening_hours: t.opening_hours || null,
        website:      t.website      || null,
        phone:        t.phone || t['contact:phone'] || null,
      }
    })
    .filter(Boolean)
}
