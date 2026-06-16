import axios from 'axios'

const BASE = 'https://api.openrouteservice.org/v2'

const PROFILES = {
  driving: 'driving-car',
  cycling: 'cycling-regular',
  walking: 'foot-walking',
}

export async function route(origin, destination, mode) {
  const profile = PROFILES[mode] || PROFILES.driving
  const key = process.env.ORS_API_KEY
  if (!key) throw new Error('ORS_API_KEY is not set')

  const { data } = await axios.post(
    `${BASE}/directions/${profile}/geojson`,
    {
      coordinates: [[origin.lng, origin.lat], [destination.lng, destination.lat]],
      instructions: true,
      language: 'en',
      elevation: true,
      alternative_routes: {
        target_count: 3,
        weight_factor: 1.6,
        share_factor: 0.6,
      },
    },
    {
      headers: {
        Authorization: key,
        'Content-Type': 'application/json',
        'User-Agent': 'QuarcMaps/1.0',
      },
      timeout: 15000,
    }
  )

  const features = data.features ?? []
  if (!features.length) throw new Error('No route found')

  const parseFeature = (feature) => {
    const summary  = feature.properties.summary
    const segments = feature.properties.segments ?? []
    const rawSteps = segments.flatMap((s) => s.steps ?? [])

    const steps = rawSteps.map((s) => ({
      type:        s.type,
      instruction: s.instruction,
      name:        s.name,
      distance:    s.distance,
      duration:    s.duration,
    }))

    return {
      route: {
        type: 'FeatureCollection',
        features: [{ type: 'Feature', geometry: feature.geometry, properties: {} }],
      },
      steps,
      duration: Math.round(summary.duration),
      distance: Math.round(summary.distance),
    }
  }

  const alternatives = features.map(parseFeature)
  const primary      = alternatives[0]

  return {
    alternatives,
    // backward-compat fields
    route:    primary.route,
    steps:    primary.steps,
    duration: primary.duration,
    distance: primary.distance,
  }
}
