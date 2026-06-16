import axios from 'axios'

const PLAN_QUERY = `
  query Plan($fromLat: Float!, $fromLon: Float!, $toLat: Float!, $toLon: Float!, $date: String, $time: String, $arriveBy: Boolean) {
    plan(
      from: { lat: $fromLat, lon: $fromLon }
      to:   { lat: $toLat,   lon: $toLon   }
      date: $date
      time: $time
      arriveBy: $arriveBy
      numItineraries: 3
      transportModes: [
        { mode: WALK }
        { mode: BUS }
        { mode: SUBWAY }
        { mode: RAIL }
        { mode: TRAM }
        { mode: FERRY }
        { mode: CABLE_CAR }
      ]
    ) {
      itineraries {
        duration
        startTime
        endTime
        walkTime
        waitingTime
        numberOfTransfers
        legs {
          mode
          startTime
          endTime
          duration
          distance
          realTime
          departureDelay
          arrivalDelay
          from { name lat lon }
          to   { name lat lon }
          legGeometry { points }
          route {
            shortName
            longName
            color
            textColor
            agency { name }
          }
          steps {
            distance
            relativeDirection
            streetName
          }
          intermediateStops {
            name
            lat
            lon
          }
        }
      }
    }
  }
`

export async function planTransit(otpUrl, origin, destination, { date, time, arriveBy } = {}) {
  try {
    const { data } = await axios.post(
      `${otpUrl}/otp/gtfs/v1`,
      {
        query: PLAN_QUERY,
        variables: {
          fromLat:  origin.lat,
          fromLon:  origin.lng,
          toLat:    destination.lat,
          toLon:    destination.lng,
          date:     date     ?? null,
          time:     time     ?? null,
          arriveBy: arriveBy ?? false,
        },
      },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000,
      }
    )

    const errors = data.errors
    if (errors?.length) {
      const msg = errors[0].message
      if (msg === 'No transit graph loaded yet') return null
      throw new Error(msg)
    }

    const raw = data.data?.plan?.itineraries ?? []
    const itineraries = raw.map(itin => ({
      ...itin,
      legs: itin.legs.map(leg => ({
        ...leg,
        routeColor:     leg.route?.color     ?? null,
        routeTextColor: leg.route?.textColor ?? null,
      })),
    }))

    return { itineraries }
  } catch (err) {
    const CONNECTION_ERRORS = ['ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN', 'ETIMEDOUT', 'ECONNRESET', 'ECONNABORTED', 'EHOSTUNREACH']
    if (CONNECTION_ERRORS.includes(err.code)) {
      return null  // OTP unreachable — caller triggers auto-download
    }
    throw err
  }
}

export async function getNearbyStops(otpUrl, lat, lng, radius = 500) {
  const query = `
    query Stops($lat: Float!, $lon: Float!, $radius: Int!) {
      stopsByRadius(lat: $lat, lon: $lon, radius: $radius) {
        edges {
          node {
            stop {
              gtfsId
              name
              lat
              lon
              routes { shortName longName color mode }
            }
          }
        }
      }
    }
  `
  try {
    const { data } = await axios.post(
      `${otpUrl}/otp/gtfs/v1`,
      { query, variables: { lat, lon: lng, radius } },
      { headers: { 'Content-Type': 'application/json' }, timeout: 10000 }
    )
    return (data.data?.stopsByRadius?.edges ?? []).map((e) => e.node.stop)
  } catch {
    return []
  }
}
