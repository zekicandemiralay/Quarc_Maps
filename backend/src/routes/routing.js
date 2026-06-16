import { Router } from 'express'
import { route as orsRoute }               from '../services/ors.js'
import { planTransit as otpTransit }        from '../services/otp.js'
import { planTransit as transitousTransit } from '../services/transitous.js'
import { getOtpUrl }                        from '../services/dataManager.js'

const router = Router()

// POST /route
// body: { origin: {lat, lng}, destination: {lat, lng}, mode: 'driving'|'cycling'|'walking'|'transit' }
router.post('/', async (req, res, next) => {
  try {
    const { origin, destination, mode } = req.body

    if (!origin?.lat || !origin?.lng || !destination?.lat || !destination?.lng) {
      return res.status(400).json({ message: 'origin and destination with lat/lng required' })
    }

    if (mode === 'transit') {
      const { date, time, arriveBy } = req.body

      // Use local OTP if already running for this region (no download triggered)
      const otpUrl = getOtpUrl(origin.lat, origin.lng)
      const local = otpUrl ? await otpTransit(otpUrl, origin, destination, { date, time, arriveBy }) : null
      if (local?.itineraries?.length) return res.json(local)

      // Online fallback via Transitous (covers all of Europe)
      const online = await transitousTransit(origin, destination, { date, time, arriveBy })
      if (online?.itineraries?.length) return res.json({ ...online, source: 'online' })

      return res.status(404).json({ message: 'No transit routes found. Transit may not serve this area or no routes run at this time.' })
    }

    const result = await orsRoute(origin, destination, mode ?? 'driving')
    res.json(result)   // includes { alternatives, route, steps, duration, distance }
  } catch (err) {
    next(err)
  }
})

export default router
