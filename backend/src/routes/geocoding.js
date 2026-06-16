import { Router } from 'express'
import { search, reverse } from '../services/photon.js'

const router = Router()

// GET /geocode?q=istanbul&limit=7
router.get('/', async (req, res, next) => {
  try {
    const { q, limit = 7, lat, lng } = req.query
    if (!q?.trim()) return res.json([])
    const bias = (lat && lng) ? { lat: Number(lat), lng: Number(lng) } : null
    const results = await search(q, Number(limit), bias)
    res.json(results)
  } catch (err) {
    next(err)
  }
})

// GET /geocode/reverse?lat=41&lng=28
router.get('/reverse', async (req, res, next) => {
  try {
    const { lat, lng } = req.query
    if (!lat || !lng) return res.status(400).json({ message: 'lat and lng required' })
    const result = await reverse(Number(lat), Number(lng))
    res.json(result)
  } catch (err) {
    next(err)
  }
})

export default router
