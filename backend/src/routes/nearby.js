import { Router } from 'express'
import { nearbyPOI } from '../services/overpass.js'

const router = Router()

// GET /nearby?category=restaurant&lat=48.137&lng=11.576&radius=1500
router.get('/', async (req, res, next) => {
  try {
    const { category, lat, lng, radius = 1500 } = req.query
    if (!category || !lat || !lng) {
      return res.status(400).json({ message: 'category, lat, lng required' })
    }
    const results = await nearbyPOI(category, Number(lat), Number(lng), Number(radius))
    res.json(results)
  } catch (err) {
    next(err)
  }
})

export default router
