import axios from 'axios'

// Transitous — free community-run MOTIS 2 transit routing, covering all of Europe.
// https://transitous.org — not for commercial use; contact them for high-volume apps.

const BASE_URL = 'https://api.transitous.org/api/v6'

function isoToMs(iso) {
  return iso ? new Date(iso).getTime() : 0
}

function delaySecs(actual, scheduled) {
  if (!actual || !scheduled) return 0
  return Math.round((new Date(actual) - new Date(scheduled)) / 1000)
}

// MOTIS encodes polylines at 1e6 precision; the frontend decoder expects 1e5 (Google standard).
// Decode at 1e6, re-encode at 1e5 so the existing frontend works without changes.
function reencodePolyline(encoded) {
  if (!encoded) return ''
  // Decode at 1e6
  const coords = []
  let i = 0, lat = 0, lng = 0
  while (i < encoded.length) {
    let b, shift = 0, result = 0
    do { b = encoded.charCodeAt(i++) - 63; result |= (b & 0x1f) << shift; shift += 5 } while (b >= 0x20)
    lat += (result & 1) ? ~(result >> 1) : (result >> 1)
    shift = 0; result = 0
    do { b = encoded.charCodeAt(i++) - 63; result |= (b & 0x1f) << shift; shift += 5 } while (b >= 0x20)
    lng += (result & 1) ? ~(result >> 1) : (result >> 1)
    coords.push([lat / 1e6, lng / 1e6])
  }
  // Re-encode at 1e5
  let out = '', prevLat = 0, prevLng = 0
  const enc = (v) => {
    v = Math.round(v * 1e5)
    v = v < 0 ? ~(v << 1) : (v << 1)
    let s = ''
    while (v >= 0x20) { s += String.fromCharCode((0x20 | (v & 0x1f)) + 63); v >>= 5 }
    return s + String.fromCharCode(v + 63)
  }
  for (const [la, lo] of coords) {
    out += enc(la - prevLat) + enc(lo - prevLng)
    prevLat = la; prevLng = lo
  }
  return out
}

function normalizeLeg(leg) {
  return {
    mode:           leg.mode,
    startTime:      isoToMs(leg.startTime),
    endTime:        isoToMs(leg.endTime),
    duration:       leg.duration,
    distance:       leg.distance ?? 0,
    realTime:       leg.realTime ?? false,
    departureDelay: delaySecs(leg.startTime, leg.scheduledStartTime),
    arrivalDelay:   delaySecs(leg.endTime,   leg.scheduledEndTime),
    from:           leg.from,
    to:             leg.to,
    legGeometry:    leg.legGeometry
      ? { points: reencodePolyline(leg.legGeometry.points) }
      : null,
    steps:          leg.steps ?? [],
    intermediateStops: leg.intermediateStops ?? [],
    // Build nested route object (OTP2 GraphQL compat) from MOTIS flat fields
    route: leg.routeShortName ? {
      shortName: leg.routeShortName ?? null,
      longName:  leg.routeLongName  ?? null,
      color:     leg.routeColor     ?? null,
      textColor: leg.routeTextColor ?? null,
      agency:    leg.agencyName ? { name: leg.agencyName } : null,
    } : null,
    routeColor:     leg.routeColor     ?? null,
    routeTextColor: leg.routeTextColor ?? null,
  }
}

export async function planTransit(origin, destination, { date, time, arriveBy } = {}) {
  try {
    const params = new URLSearchParams({
      fromPlace:      `${origin.lat},${origin.lng}`,
      toPlace:        `${destination.lat},${destination.lng}`,
      arriveBy:       arriveBy ? 'true' : 'false',
      numItineraries: '3',
    })

    // MOTIS uses ISO 8601 for time; combine OTP-style date + time if provided
    if (date && time) params.set('time', `${date}T${time}`)

    const { data } = await axios.get(`${BASE_URL}/plan?${params}`, {
      timeout: 30000,
      headers: { Accept: 'application/json' },
    })

    const raw = data?.itineraries ?? []
    if (!raw.length) return { itineraries: [] }

    const itineraries = raw.map(itin => {
      const legs       = itin.legs.map(normalizeLeg)
      const walkTime   = legs.filter(l => l.mode === 'WALK').reduce((s, l) => s + l.duration, 0)
      const transitTime = legs.filter(l => l.mode !== 'WALK').reduce((s, l) => s + l.duration, 0)
      return {
        duration:          itin.duration,
        startTime:         isoToMs(itin.startTime),
        endTime:           isoToMs(itin.endTime),
        walkTime,
        waitingTime:       Math.max(0, itin.duration - walkTime - transitTime),
        numberOfTransfers: itin.transfers ?? 0,
        legs,
      }
    })

    return { itineraries }
  } catch (err) {
    const CONNECTION_ERRORS = ['ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN', 'ETIMEDOUT', 'ECONNRESET', 'ECONNABORTED', 'EHOSTUNREACH']
    if (CONNECTION_ERRORS.includes(err.code)) return null
    if (err.response?.status === 400 || err.response?.status === 404) return { itineraries: [] }
    throw err
  }
}
