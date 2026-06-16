import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import geocodingRoutes from './routes/geocoding.js'
import routingRoutes   from './routes/routing.js'
import transitRoutes   from './routes/transit.js'
import nearbyRoutes    from './routes/nearby.js'
import debugRoutes     from './routes/debug.js'
import { startGtfsRefreshScheduler } from './services/dataManager.js'

const app  = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json())

app.use('/geocode',  geocodingRoutes)
app.use('/route',    routingRoutes)
app.use('/transit',  transitRoutes)
app.use('/nearby',   nearbyRoutes)
app.use('/debug',    debugRoutes)

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'quarc-maps-api' }))

app.use((err, _req, res, _next) => {
  console.error(err)
  res.status(500).json({ message: err.message || 'Internal server error' })
})

app.listen(PORT, () => {
  console.log(`Quarc Maps API listening on :${PORT}`)
  startGtfsRefreshScheduler()
})
