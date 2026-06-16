import { Router } from 'express'
import { getNearbyStops }           from '../services/otp.js'
import { getStatus, retryRegion, getOtpUrl } from '../services/dataManager.js'

const router = Router()

// GET /transit/status?lat=41&lng=28
router.get('/status', (req, res) => {
  const { lat, lng } = req.query
  if (!lat || !lng) return res.status(400).json({ message: 'lat and lng required' })
  const status = getStatus(Number(lat), Number(lng))
  res.json(status ?? { status: 'unknown', message: 'No download started for this area yet.' })
})

// POST /transit/retry?lat=41&lng=28
router.post('/retry', (req, res) => {
  const { lat, lng } = req.query
  if (!lat || !lng) return res.status(400).json({ message: 'lat and lng required' })
  const status = retryRegion(Number(lat), Number(lng))
  res.json(status)
})

// GET /transit/stops/nearby?lat=41&lng=28&radius=500
router.get('/stops/nearby', async (req, res, next) => {
  try {
    const { lat, lng, radius = 500 } = req.query
    if (!lat || !lng) return res.status(400).json({ message: 'lat and lng required' })
    const otpUrl = getOtpUrl(Number(lat), Number(lng))
    if (!otpUrl) return res.json([])
    const stops = await getNearbyStops(otpUrl, Number(lat), Number(lng), Number(radius))
    res.json(stops)
  } catch (err) {
    next(err)
  }
})

// GET /transit/stop/:id  — live arrivals stub
router.get('/stop/:id', (_req, res) => {
  res.json({ arrivals: [], message: 'Configure a GTFS-RT feed for live arrivals' })
})

export default router
