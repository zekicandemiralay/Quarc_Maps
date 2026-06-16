import { Router } from 'express'
import { diagnose } from '../services/dataManager.js'

const router = Router()

// GET /debug/transit?lat=52.5&lng=13.4
// Returns a full diagnostic report: feed discovery from all sources, OTP status,
// data dir contents, region download state. Safe to call at any time — read-only.
router.get('/transit', async (req, res, next) => {
  try {
    const lat = parseFloat(req.query.lat ?? '52.5')   // default: Berlin
    const lng = parseFloat(req.query.lng ?? '13.4')
    if (isNaN(lat) || isNaN(lng)) {
      return res.status(400).json({ error: 'lat and lng must be numbers' })
    }
    const report = await diagnose(lat, lng)
    res.json(report)
  } catch (err) {
    next(err)
  }
})

export default router
