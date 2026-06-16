import axios from 'axios'
import { createWriteStream, existsSync, mkdirSync, readFileSync, writeFileSync, renameSync, unlinkSync, statSync, readdirSync } from 'fs'
import { join } from 'path'
import { pipeline } from 'stream/promises'
import { exec, execSync } from 'child_process'
import { promisify } from 'util'
import { latLngToCountry, COUNTRY_BY_CC } from '../config/countries.js'

const execAsync = promisify(exec)

const DATA_DIR  = process.env.OTP_DATA_DIR  || '/otp-data'
const CACHE_DIR = process.env.OSM_CACHE_DIR || '/osm-cache'
const STATE_FILE = join(DATA_DIR, '.state.json')

// OTP hostname — strip port from OTP_URL if present; each region uses its own port
const OTP_HOST = (process.env.OTP_URL || 'http://otp:8080').replace(/:\d+$/, '')

const MDB_REFRESH_TOKEN   = process.env.MDB_REFRESH_TOKEN   || ''
const TRANSITLAND_API_KEY = process.env.TRANSITLAND_API_KEY || ''
let _mdbToken = null
let _mdbTokenExpiry = 0

let regions = {}
try { regions = JSON.parse(readFileSync(STATE_FILE, 'utf8')) } catch {}

// Any in-progress state from a previous process is stale
for (const k of Object.keys(regions)) {
  const s = regions[k].status
  if (s === 'building' || s === 'downloading') {
    regions[k] = { ...regions[k], status: 'error', message: 'Backend restarted — click Retry.' }
  }
}

function persist() {
  try { mkdirSync(DATA_DIR, { recursive: true }); writeFileSync(STATE_FILE, JSON.stringify(regions)) } catch {}
}

// For European locations return the 2-letter country code (e.g. "DE", "TR").
// All cities within a country share one OTP instance backed by full national data.
// For locations outside Europe fall back to rounded coordinates (city-scale, on-demand).
function key(lat, lng) { return latLngToCountry(lat, lng) ?? `${Math.round(lat)}_${Math.round(lng)}` }

// A key is "country mode" when it is a 2-letter ISO code (European pre-loaded country).
function isCountryKey(k) { return /^[A-Z]{2}$/.test(k) }

// Per-region subdirectory: DATA_DIR/{key}/
function regionDir(k) { return join(DATA_DIR, k) }

// ── Port management ───────────────────────────────────────────────────────────
// Each region gets a unique port starting at 8080. The port is stored both in
// the region state (for fast lookup) and in a .port file in the region directory
// (so it survives a lost state.json across restarts).

function getOrAssignPort(k, rDir) {
  // .port file survives state.json loss
  const portFile = join(rDir, '.port')
  if (existsSync(portFile)) {
    const p = parseInt(readFileSync(portFile, 'utf8').trim(), 10)
    if (!isNaN(p)) return p
  }
  if (regions[k]?.otpPort) return regions[k].otpPort
  // Assign next available port
  const used = new Set(Object.values(regions).map(r => r.otpPort).filter(Boolean))
  let port = 8080
  while (used.has(port)) port++
  return port
}

// Returns the full OTP URL for the given coordinates, or null if not yet initialized
export function getOtpUrl(lat, lng) {
  const port = regions[key(lat, lng)]?.otpPort
  return port ? `${OTP_HOST}:${port}` : null
}

export function getStatus(lat, lng) { return regions[key(lat, lng)] ?? null }

const STUCK_TIMEOUT_MS = 65 * 60 * 1000
const GTFS_MAX_AGE_MS  =  7 * 24 * 60 * 60 * 1000

export function ensureCoverage(lat, lng) {
  const k = key(lat, lng)
  const r = regions[k]
  if (r) {
    const stuck = (r.status === 'building' || r.status === 'downloading') &&
                  (Date.now() - (r.startedAt ?? 0)) > STUCK_TIMEOUT_MS
    // Region ready but missing port means it was initialized before multi-region
    // support — re-initialize so it gets a port and a proper subdirectory.
    const needsReInit = r.status === 'ready' && !r.otpPort
    if (!stuck && !needsReInit && r.status !== 'error') return r
  }
  regions[k] = { status: 'downloading', startedAt: Date.now(), message: 'Searching for transit feeds…' }
  persist()
  runDownload(k, lat, lng)
  return regions[k]
}

export function retryRegion(lat, lng) {
  const k = key(lat, lng)
  delete regions[k]
  persist()
  return ensureCoverage(lat, lng)
}

// ── OTP health check ──────────────────────────────────────────────────────────
async function isRealOtpAt(url) {
  try {
    const { data } = await axios.post(`${url}/otp/gtfs/v1`,
      { query: '{ __typename }' }, { timeout: 5_000 })
    return !!(data?.data && !data.errors)
  } catch { return false }
}

// Polls until OTP is up on the given port (or 60 min timeout)
async function waitForOtpUp(port, upd) {
  const url = `${OTP_HOST}:${port}`
  for (let i = 0; i < 120; i++) {
    await new Promise(r => setTimeout(r, 30_000))
    if (upd) upd({ message: `Building routing engine… (${Math.round((i + 1) * 0.5)} min elapsed)` })
    if (await isRealOtpAt(url)) return true
  }
  return false
}

// ── MobilityData API auth ─────────────────────────────────────────────────────
async function getMdbToken() {
  if (_mdbToken && Date.now() < _mdbTokenExpiry - 60_000) return _mdbToken
  const { data } = await axios.post(
    'https://api.mobilitydatabase.org/v1/tokens',
    { refresh_token: MDB_REFRESH_TOKEN },
    { timeout: 15_000 }
  )
  _mdbToken = data.access_token
  _mdbTokenExpiry = Date.now() + (data.expires_in ?? 3600) * 1000
  return _mdbToken
}

async function getCountryCode(lat, lng) {
  try {
    const { data } = await axios.get('https://photon.komoot.io/reverse', {
      params: { lat, lon: lng, limit: 1 },
      timeout: 10_000,
    })
    const cc = data?.features?.[0]?.properties?.countrycode
    return cc ? cc.toUpperCase() : null
  } catch (e) {
    console.warn('[dataManager] Reverse geocode failed:', e.message)
    return null
  }
}

// ── Layer 1: Transitland ──────────────────────────────────────────────────────
// bboxOverride: [minLon, minLat, maxLon, maxLat] — used in country mode so the
// query covers the full country, not just a 0.75° circle around one city.
async function findFeedsTransitland(lat, lng, bboxOverride = null) {
  if (!TRANSITLAND_API_KEY) {
    console.log('[dataManager] TRANSITLAND_API_KEY not set — skipping Transitland')
    return []
  }
  const d = 0.75
  const bbox = bboxOverride
    ? bboxOverride.join(',')
    : [(lng - d).toFixed(4), (lat - d).toFixed(4), (lng + d).toFixed(4), (lat + d).toFixed(4)].join(',')
  try {
    const { data } = await axios.get('https://transit.land/api/v2/rest/feeds', {
      params: { bbox, per_page: 100, spec: 'gtfs', apikey: TRANSITLAND_API_KEY },
      timeout: 30_000,
    })
    const feeds = (data.feeds ?? [])
      .filter(f => {
        if ((f.spec ?? '').toUpperCase() !== 'GTFS') return false
        const authType = (f.authorization?.type ?? '').toLowerCase().trim()
        const requiresCredentials = ['query_param', 'header', 'basic_auth', 'oauth2'].includes(authType)
        return !requiresCredentials && f.urls?.static_current
      })
      .map(f => ({ id: `tl-${f.id}`, url: f.urls.static_current }))
    console.log(`[dataManager] Transitland: ${feeds.length} free GTFS feeds near (${lat}, ${lng})`)
    return feeds
  } catch (e) {
    console.warn('[dataManager] Transitland query failed:', e.message)
    return []
  }
}

// ── Layer 2: MobilityData ─────────────────────────────────────────────────────
// skipBboxFilter: in country mode we want ALL national feeds, not just those
// whose bounding_box covers a single city centre.
async function findFeedsMDB(lat, lng, countryCode, skipBboxFilter = false) {
  if (!MDB_REFRESH_TOKEN) {
    console.log('[dataManager] MDB_REFRESH_TOKEN not set — skipping MobilityData')
    return []
  }
  try {
    const token = await getMdbToken()
    const params = { limit: 100, status: 'active' }
    if (countryCode) params.country_code = countryCode
    const { data } = await axios.get('https://api.mobilitydatabase.org/v1/gtfs_feeds', {
      params,
      headers: { Authorization: `Bearer ${token}` },
      timeout: 30_000,
    })
    const list = Array.isArray(data) ? data : (data.results ?? [])
    console.log(`[dataManager] MobilityData: ${list.length} feeds for country ${countryCode}`)
    const accepted = skipBboxFilter ? list : list.filter(f =>
      f.locations?.some(loc => {
        const b = loc.bounding_box
        if (!b) return true
        return lat >= b.minimum_latitude && lat <= b.maximum_latitude &&
               lng >= b.minimum_longitude && lng <= b.maximum_longitude
      })
    )
    if (!skipBboxFilter)
      console.log(`[dataManager] MobilityData: ${accepted.length} of ${list.length} feeds cover (${lat}, ${lng})`)
    return accepted
      .map(f => ({ id: String(f.id), url: f.latest_dataset?.hosted_url ?? '' }))
      .filter(f => f.url.startsWith('http'))
  } catch (e) {
    console.warn('[dataManager] MobilityData query failed:', e.message)
    return []
  }
}

async function findFeedsForLocation(lat, lng, countryCode) {
  const seen    = new Set()
  const results = []
  const addUnique = (feeds, source) => {
    let n = 0
    for (const f of feeds) {
      if (!f.url?.startsWith('http') || seen.has(f.url)) continue
      seen.add(f.url); results.push({ ...f, source }); n++
    }
    return n
  }
  const tlAdded  = addUnique(await findFeedsTransitland(lat, lng), 'transitland')
  const mdbAdded = addUnique(await findFeedsMDB(lat, lng, countryCode), 'mobilitydata')
  console.log(`[dataManager] Total feeds: ${results.length} (${tlAdded} Transitland, ${mdbAdded} MobilityData)`)
  return results
}

function getTimezoneForLocation(lat, lng, countryCode) {
  if (countryCode === 'US') {
    if (lng < -115) return 'America/Los_Angeles'
    if (lng < -100) return 'America/Denver'
    if (lng < -87)  return 'America/Chicago'
    return 'America/New_York'
  }
  if (countryCode === 'CA') {
    if (lng < -120) return 'America/Vancouver'
    if (lng < -95)  return 'America/Winnipeg'
    return 'America/Toronto'
  }
  if (countryCode === 'AU') {
    if (lng < 129) return 'Australia/Perth'
    if (lng < 141) return 'Australia/Adelaide'
    return 'Australia/Sydney'
  }
  if (countryCode === 'BR') {
    if (lng < -51) return 'America/Manaus'
    return 'America/Sao_Paulo'
  }
  const TZ = {
    TR:'Europe/Istanbul', DE:'Europe/Berlin',   FR:'Europe/Paris',
    GB:'Europe/London',   IT:'Europe/Rome',     ES:'Europe/Madrid',
    NL:'Europe/Amsterdam',BE:'Europe/Brussels', PL:'Europe/Warsaw',
    SE:'Europe/Stockholm',NO:'Europe/Oslo',     DK:'Europe/Copenhagen',
    FI:'Europe/Helsinki', AT:'Europe/Vienna',   CH:'Europe/Zurich',
    PT:'Europe/Lisbon',   GR:'Europe/Athens',   RO:'Europe/Bucharest',
    HU:'Europe/Budapest', CZ:'Europe/Prague',   SK:'Europe/Bratislava',
    HR:'Europe/Zagreb',   SI:'Europe/Ljubljana',BG:'Europe/Sofia',
    LT:'Europe/Vilnius',  LV:'Europe/Riga',     EE:'Europe/Tallinn',
    UA:'Europe/Kyiv',     RU:'Europe/Moscow',
    JP:'Asia/Tokyo',      KR:'Asia/Seoul',      CN:'Asia/Shanghai',
    IN:'Asia/Kolkata',    TH:'Asia/Bangkok',    SG:'Asia/Singapore',
    MY:'Asia/Kuala_Lumpur',PH:'Asia/Manila',    ID:'Asia/Jakarta',
    VN:'Asia/Ho_Chi_Minh',AE:'Asia/Dubai',      SA:'Asia/Riyadh',
    IL:'Asia/Jerusalem',  EG:'Africa/Cairo',    ZA:'Africa/Johannesburg',
    NG:'Africa/Lagos',    KE:'Africa/Nairobi',  ET:'Africa/Addis_Ababa',
    AR:'America/Argentina/Buenos_Aires',        CL:'America/Santiago',
    CO:'America/Bogota',  PE:'America/Lima',    MX:'America/Mexico_City',
    NZ:'Pacific/Auckland',
  }
  return TZ[countryCode] ?? 'UTC'
}

// ── Main download orchestrator ────────────────────────────────────────────────
async function runDownload(k, lat, lng) {
  const rDir = regionDir(k)
  mkdirSync(rDir,    { recursive: true })
  mkdirSync(CACHE_DIR, { recursive: true })

  // Assign port synchronously before first await to prevent race conditions
  // when two regions are initialized concurrently.
  const port = getOrAssignPort(k, rDir)
  regions[k] = { ...regions[k], otpPort: port }
  writeFileSync(join(rDir, '.port'), String(port))
  persist()

  const upd = (patch) => { regions[k] = { ...regions[k], ...patch }; persist() }
  console.log(`[dataManager] ── Starting download for region ${k} (${lat}, ${lng}) port ${port} ──`)

  try {
    const countryCode = await getCountryCode(lat, lng)
    console.log(`[dataManager] Country: ${countryCode ?? 'unknown'}`)
    if (!countryCode) throw new Error('Could not determine country for this location')
    const tz = getTimezoneForLocation(lat, lng, countryCode)
    console.log(`[dataManager] Timezone: ${tz}`)

    // ── 1. Find feeds ─────────────────────────────────────────────────────
    upd({ message: 'Searching global transit catalog…' })
    const feeds = await findFeedsForLocation(lat, lng, countryCode)
    console.log(`[dataManager] Found ${feeds.length} candidate feeds`)

    if (!feeds.length) {
      const noKeys = !TRANSITLAND_API_KEY && !MDB_REFRESH_TOKEN
      upd({
        status: 'unavailable',
        message: noKeys
          ? 'Transit auto-download requires API keys. Add TRANSITLAND_API_KEY or MDB_REFRESH_TOKEN to .env.'
          : 'No public transit data found for this area.',
      })
      return
    }

    // ── 2. Download + validate GTFS feeds ────────────────────────────────
    const MAX_ATTEMPTS = 30
    const MAX_VALID    = 3
    const MAX_SIZE_MB  = 150

    const sorted = [...feeds].sort((a, b) => {
      if (a.source === 'transitland' && b.source !== 'transitland') return -1
      if (b.source === 'transitland' && a.source !== 'transitland') return  1
      return 0
    })

    let downloaded = 0
    let attempted  = 0
    let freshGtfsDownloaded = false   // true if any GTFS file was re-downloaded this run

    for (const feed of sorted) {
      if (downloaded >= MAX_VALID || attempted >= MAX_ATTEMPTS) break
      attempted++

      const dest = join(rDir, `gtfs-${feed.id.replace(/[^a-z0-9]/gi, '-')}.zip`)
      upd({ message: `Checking transit feed ${attempted}/${Math.min(sorted.length, MAX_ATTEMPTS)} [${feed.source}]…` })

      if (!existsSync(dest)) {
        try {
          const head = await axios.head(feed.url, { timeout: 10_000 })
          const sizeBytes = parseInt(head.headers['content-length'] ?? '0')
          if (sizeBytes > MAX_SIZE_MB * 1024 * 1024) {
            console.log(`[dataManager] Skipping ${feed.id}: ${(sizeBytes / 1024 / 1024).toFixed(0)} MB > ${MAX_SIZE_MB} MB limit`)
            continue
          }
        } catch {}

        console.log(`[dataManager] Downloading GTFS (${feed.source}): ${feed.url}`)
        try {
          const r = await axios.get(feed.url, { responseType: 'stream', timeout: 300_000 })
          await pipeline(r.data, createWriteStream(dest))
          const sizeMB = Math.round(statSync(dest).size / (1024 * 1024))
          console.log(`[dataManager] Downloaded ${feed.id} (${sizeMB} MB)`)
          freshGtfsDownloaded = true
        } catch (e) {
          console.warn(`[dataManager] Skipping ${feed.id}: ${e.message}`)
          try { unlinkSync(dest) } catch {}
          continue
        }
      } else {
        const sizeMB = Math.round(statSync(dest).size / (1024 * 1024))
        console.log(`[dataManager] Cached: ${feed.id} (${sizeMB} MB)`)
      }

      const v = validateGtfs(dest, tz, lat, lng)
      if (!v.valid) {
        console.warn(`[dataManager] Invalid feed ${feed.id}: ${v.reason}`)
        try { unlinkSync(dest) } catch {}
        continue
      }
      console.log(`[dataManager] Valid: ${feed.id} — ${v.note ?? `${v.checked} stop_times, ${v.stops} stops`}`)
      downloaded++
    }

    if (downloaded === 0) {
      upd({ status: 'error', message: 'No valid transit feeds available for this area. Check backend logs for details.' })
      return
    }

    // ── 3. Download/extract OSM street data ───────────────────────────────
    await downloadOSM(lat, lng, countryCode, upd, rDir, countryMode)

    // ── 4. Write location-specific build-config.json ─────────────────────
    const buildCfg = {
      transitServiceStart: '-P1Y',
      transitServiceEnd: 'P3Y',
      localFileNamePatterns: { osm: '.*\\.osm(\\.pbf)?', gtfs: '.*\\.zip' },
      osmDefaults: { timeZone: tz },
    }
    writeFileSync(join(rDir, 'build-config.json'), JSON.stringify(buildCfg, null, 2))

    // ── 5. Delete stale graph if GTFS was re-downloaded ───────────────────
    // Forces OTP to rebuild from the new data rather than loading the old graph.
    if (freshGtfsDownloaded) {
      const graphPath = join(rDir, 'graph.obj')
      if (existsSync(graphPath)) {
        unlinkSync(graphPath)
        console.log(`[dataManager] Deleted stale graph.obj for ${k} — will rebuild from new GTFS`)
      }
    }

    // ── 6. Signal OTP supervisor to build (if needed) and serve ──────────
    upd({ status: 'building', message: 'Building routing engine… (5–15 min first time)' })
    writeFileSync(join(rDir, '.rebuild'), String(Date.now()))

    // ── 7. Wait for OTP to come up on this region's port ─────────────────
    const ready = await waitForOtpUp(port, upd)
    if (!ready) {
      throw new Error('Routing engine failed to start within 60 min. Check OTP container logs.')
    }
    upd({ status: 'ready', message: 'Transit routing ready!', completedAt: Date.now(), gtfsRefreshedAt: Date.now() })

  } catch (err) {
    console.error('[dataManager] Download failed:', err.message)
    regions[k] = { ...regions[k], status: 'error', message: err.message || 'Download failed' }
    persist()
  }
}

// ── startRebuildWatch ─────────────────────────────────────────────────────────
// Called when OTP is unreachable for a region that is already "ready" in state
// (e.g. after OTP container restart). Signals supervisor to reload the pre-built
// graph (~30 sec) instead of re-downloading and rebuilding (15 min).
export function startRebuildWatch(lat, lng) {
  const k = key(lat, lng)
  if (regions[k]?.status === 'building') return regions[k]

  const r = regions[k]
  const port = r?.otpPort
  if (!port) {
    // No port — region was initialized before multi-region support; re-initialize.
    regions[k] = { ...(r ?? {}), status: 'error', message: 'Region state outdated — click Retry.' }
    persist()
    return regions[k]
  }

  const upd = (patch) => { regions[k] = { ...regions[k], ...patch }; persist() }
  upd({ status: 'building', startedAt: Date.now(), message: 'Routing engine loading…' })
  console.log(`[dataManager] OTP unreachable for region ${k} — signalling supervisor to reload (port ${port})`)

  // Signal supervisor to (re)start OTP for this region from the pre-built graph
  const rDir = regionDir(k)
  writeFileSync(join(rDir, '.rebuild'), String(Date.now()))

  ;(async () => {
    const ready = await waitForOtpUp(port, upd)
    if (ready) {
      upd({ status: 'ready', message: 'Transit routing ready!', completedAt: Date.now() })
      console.log(`[dataManager] OTP back up for region ${k} on port ${port}`)
    } else {
      upd({ status: 'error', message: 'Routing engine did not come back within 60 min. Check OTP container logs.' })
      console.error(`[dataManager] OTP restart timeout for region ${k}`)
    }
  })()

  return regions[k]
}

// ── GTFS pre-validation ───────────────────────────────────────────────────────
function parseCsvLine(line) {
  const out = []
  let cur = '', inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++ }
      else inQuotes = !inQuotes
    } else if (c === ',' && !inQuotes) {
      out.push(cur); cur = ''
    } else {
      cur += c
    }
  }
  out.push(cur)
  return out.map(s => s.trim())
}

function readZipEntry(zipPath, entryName) {
  try {
    return execSync(`unzip -p "${zipPath}" "${entryName}"`, {
      maxBuffer: 512 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    }).toString('utf8')
  } catch {
    return null
  }
}

function loadIdSet(content, idColumn) {
  const set = new Set()
  if (!content) return set
  const lines = content.split(/\r?\n/)
  if (lines.length < 2) return set
  const header = parseCsvLine(lines[0])
  const idx = header.indexOf(idColumn)
  if (idx < 0) return set
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]
    if (!line || !line.trim()) continue
    const id = (parseCsvLine(line)[idx] ?? '').trim()
    if (id) set.add(id)
  }
  return set
}

function validateGtfs(zipPath, expectedTimezone, targetLat, targetLon) {
  try {
    if (expectedTimezone) {
      const agencyRaw = readZipEntry(zipPath, 'agency.txt')
      if (agencyRaw) {
        const aLines = agencyRaw.split(/\r?\n/)
        const aHeader = parseCsvLine(aLines[0] ?? '')
        const tzIdx = aHeader.indexOf('agency_timezone')
        if (tzIdx >= 0) {
          for (let i = 1; i < aLines.length; i++) {
            if (!aLines[i].trim()) continue
            const feedTz = (parseCsvLine(aLines[i])[tzIdx] ?? '').trim()
            if (feedTz && feedTz !== expectedTimezone) {
              return { valid: false, reason: `agency_timezone="${feedTz}" != expected "${expectedTimezone}"` }
            }
          }
        }
      }
    }

    // Read stops.txt once: build stop_id set + check geographic coverage
    const stopsRaw = readZipEntry(zipPath, 'stops.txt')
    if (!stopsRaw) return { valid: false, reason: 'stops.txt empty or missing' }
    const stopsLines = stopsRaw.split(/\r?\n/)
    if (stopsLines.length < 2) return { valid: false, reason: 'stops.txt empty or missing' }

    const sHeader  = parseCsvLine(stopsLines[0])
    const sidIdx   = sHeader.indexOf('stop_id')
    const slatIdx  = sHeader.indexOf('stop_lat')
    const slonIdx  = sHeader.indexOf('stop_lon')
    if (sidIdx < 0) return { valid: false, reason: 'stops.txt missing stop_id column' }

    const stops = new Set()
    let totalStops = 0
    let nearbyStops = 0
    const doGeo = targetLat != null && targetLon != null && slatIdx >= 0 && slonIdx >= 0

    for (let i = 1; i < stopsLines.length; i++) {
      const line = stopsLines[i]
      if (!line || !line.trim()) continue
      const cols = parseCsvLine(line)
      const id   = (cols[sidIdx] ?? '').trim()
      if (!id) continue
      stops.add(id)
      totalStops++
      if (doGeo) {
        const slat = parseFloat(cols[slatIdx] ?? '')
        const slon = parseFloat(cols[slonIdx] ?? '')
        if (!isNaN(slat) && !isNaN(slon) &&
            Math.abs(slat - targetLat) <= 0.5 && Math.abs(slon - targetLon) <= 0.5) {
          nearbyStops++
        }
      }
    }

    if (stops.size === 0) return { valid: false, reason: 'stops.txt empty or missing' }

    // Reject feeds where < 15% of stops are within 0.5° of the target — catches
    // national/multi-country feeds that would produce thousands of isolated stops.
    // 0.5° ≈ 55 km radius, double the OSM extract bbox.
    if (doGeo && totalStops > 1000) {
      const pct = nearbyStops / totalStops
      if (pct < 0.15) {
        return {
          valid: false,
          reason: `geographic mismatch: only ${(pct * 100).toFixed(1)}% of ${totalStops} stops within 0.5° of target (${nearbyStops} nearby) — likely a national/regional feed`,
        }
      }
      console.log(`[validateGtfs] Geo OK: ${nearbyStops}/${totalStops} stops (${(pct * 100).toFixed(1)}%) within 0.5° of target`)
    }

    const sizeMB = statSync(zipPath).size / (1024 * 1024)
    if (sizeMB > 50) {
      console.log(`[validateGtfs] Large feed (${sizeMB.toFixed(0)} MB) — skipping stop_times scan`)
      return { valid: true, checked: 0, stops: stops.size, note: `large-feed (${sizeMB.toFixed(0)} MB) — timezone+stops+geo OK` }
    }

    const groups    = loadIdSet(readZipEntry(zipPath, 'location_groups.txt'), 'location_group_id')
    const locations = new Set()
    const locGeo    = readZipEntry(zipPath, 'locations.geojson')
    if (locGeo) {
      try {
        const geo = JSON.parse(locGeo)
        for (const f of (geo.features ?? [])) {
          if (f.id != null) locations.add(String(f.id))
        }
      } catch {}
    }

    const st = readZipEntry(zipPath, 'stop_times.txt')
    if (!st) return { valid: false, reason: 'stop_times.txt missing' }
    const lines = st.split(/\r?\n/)
    if (lines.length < 2) return { valid: false, reason: 'stop_times.txt empty' }

    const header   = parseCsvLine(lines[0])
    const stopIdx  = header.indexOf('stop_id')
    const locIdx   = header.indexOf('location_id')
    const groupIdx = header.indexOf('location_group_id')
    if (stopIdx < 0) return { valid: false, reason: 'no stop_id column' }

    let checked = 0
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i]
      if (!line || !line.trim()) continue
      const cols = parseCsvLine(line)
      const sId  = stopIdx  >= 0 ? (cols[stopIdx]  ?? '').trim() : ''
      const lId  = locIdx   >= 0 ? (cols[locIdx]   ?? '').trim() : ''
      const gId  = groupIdx >= 0 ? (cols[groupIdx] ?? '').trim() : ''
      const ok   = (sId && stops.has(sId)) || (lId && locations.has(lId)) || (gId && groups.has(gId))
      if (!ok) {
        return {
          valid: false,
          reason: `row ${i + 1}: stop_id="${sId}" location_id="${lId}" location_group_id="${gId}" — no valid reference`,
        }
      }
      checked++
    }
    return { valid: true, checked, stops: stops.size }
  } catch (e) {
    return { valid: false, reason: `validation error: ${e.message}` }
  }
}

// ── OSM download via Geofabrik + osmium ──────────────────────────────────────
function geofabrikBbox(f) {
  const allCoords = []
  if (f.geometry?.type === 'Polygon') {
    for (const ring of (f.geometry.coordinates ?? [])) allCoords.push(...ring)
  } else if (f.geometry?.type === 'MultiPolygon') {
    for (const poly of (f.geometry.coordinates ?? []))
      for (const ring of poly) allCoords.push(...ring)
  }
  if (!allCoords.length) return null
  let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity
  for (const [lon, lat] of allCoords) {
    if (lon < minLon) minLon = lon
    if (lon > maxLon) maxLon = lon
    if (lat < minLat) minLat = lat
    if (lat > maxLat) maxLat = lat
  }
  return [minLon, minLat, maxLon, maxLat]
}

async function findGeofabrikExtract(lat, lng, countryCode) {
  const { data } = await axios.get('https://download.geofabrik.de/index-v1.json', { timeout: 30_000 })
  let best = null, bestArea = Infinity
  for (const pass of [true, false]) {
    for (const f of data.features) {
      const url = f.properties?.urls?.pbf
      if (!url) continue
      if (pass) {
        const iso = f.properties['iso3166-1:alpha2'] ?? []
        if (!iso.includes(countryCode)) continue
      }
      const b = geofabrikBbox(f)
      if (!b) continue
      if (lng >= b[0] && lng <= b[2] && lat >= b[1] && lat <= b[3]) {
        const area = (b[2] - b[0]) * (b[3] - b[1])
        if (area < bestArea) { best = { url, name: f.properties.name, id: f.properties.id }; bestArea = area }
      }
    }
    if (best) return best
  }
  return null
}

// fullCountry = true  → download the entire Geofabrik country PBF with no osmium clip.
//                        Used for European countries (country-mode) so all transit stops
//                        have matching OSM street network regardless of their city.
// fullCountry = false → city-scale mode: download country PBF to CACHE_DIR, then clip
//                        a 0.5° bbox to destDir (fast, small file for on-demand routing).
async function downloadOSM(lat, lng, countryCode, upd, destDir, fullCountry = false) {
  if (fullCountry) {
    const info = COUNTRY_BY_CC[countryCode]
    if (!info) throw new Error(`No Geofabrik path known for country ${countryCode}`)
    const slug = info.geofabrik.split('/').pop()
    const dest = join(destDir, `${slug}-latest.osm.pbf`)
    if (existsSync(dest)) {
      console.log(`[dataManager] Full-country OSM already exists: ${dest}`)
      return
    }
    const url = `https://download.geofabrik.de/${info.geofabrik}-latest.osm.pbf`
    upd({ message: `Downloading ${info.name} full-country map (${countryCode}, one-time, ~30–120 min)…` })
    console.log(`[dataManager] Downloading full-country OSM: ${url}`)
    const tmp = dest + '.tmp'
    try {
      const r = await axios.get(url, {
        responseType: 'stream',
        timeout: 120 * 60_000,
        headers: { 'Accept-Encoding': 'identity' },
      })
      await pipeline(r.data, createWriteStream(tmp))
      renameSync(tmp, dest)
      const sizeMB = Math.round(statSync(dest).size / (1024 * 1024))
      console.log(`[dataManager] Full-country OSM done: ${dest} (${sizeMB} MB)`)
    } catch (e) {
      try { unlinkSync(tmp) } catch {}
      throw new Error(`Full-country OSM download failed: ${e.message}`)
    }
    return
  }

  // ── City-scale (bbox clip) mode ───────────────────────────────────────────
  const dest = join(destDir, `osm-${Math.round(lat)}_${Math.round(lng)}.osm.pbf`)
  if (existsSync(dest)) {
    console.log('[dataManager] OSM extract already exists:', dest)
    return
  }

  upd({ message: 'Finding regional map data…' })
  const extract = await findGeofabrikExtract(lat, lng, countryCode)
  if (!extract) throw new Error(`No Geofabrik extract found for ${countryCode} at (${lat}, ${lng})`)

  const cachedCountryPbf = join(CACHE_DIR, `${extract.id ?? extract.name.replace(/[^a-z0-9]/gi, '-')}.osm.pbf`)

  if (!existsSync(cachedCountryPbf)) {
    upd({ message: `Downloading ${extract.name} map data (one-time, ~5 min)…` })
    console.log(`[dataManager] Downloading Geofabrik: ${extract.url}`)
    const tmp = cachedCountryPbf + '.tmp'
    try {
      const r = await axios.get(extract.url, {
        responseType: 'stream',
        timeout: 30 * 60_000,
        headers: { 'Accept-Encoding': 'identity' },
      })
      await pipeline(r.data, createWriteStream(tmp))
      renameSync(tmp, cachedCountryPbf)
      const sizeMB = Math.round(statSync(cachedCountryPbf).size / (1024 * 1024))
      console.log(`[dataManager] Country PBF cached: ${cachedCountryPbf} (${sizeMB} MB)`)
    } catch (e) {
      try { unlinkSync(tmp) } catch {}
      throw new Error(`Geofabrik download failed: ${e.message}`)
    }
  } else {
    const sizeMB = Math.round(statSync(cachedCountryPbf).size / (1024 * 1024))
    console.log(`[dataManager] Using cached country PBF: ${cachedCountryPbf} (${sizeMB} MB)`)
  }

  upd({ message: 'Extracting city area from country map…' })
  const d = 0.25
  const south = (lat - d).toFixed(4), north = (lat + d).toFixed(4)
  const west  = (lng - d).toFixed(4), east  = (lng + d).toFixed(4)
  const tmpExtract = dest + '.tmp'

  console.log(`[dataManager] osmium extract bbox ${west},${south},${east},${north}`)
  try {
    const { stderr } = await execAsync(
      `osmium extract --overwrite --strategy=smart --output-format=pbf --bbox=${west},${south},${east},${north} -o "${tmpExtract}" "${cachedCountryPbf}"`,
      { timeout: 15 * 60_000, maxBuffer: 32 * 1024 * 1024 }
    )
    if (stderr) console.log('[osmium]', stderr.trim())
    renameSync(tmpExtract, dest)
    const sizeMB = Math.round(statSync(dest).size / (1024 * 1024))
    console.log(`[dataManager] City extract done: ${dest} (${sizeMB} MB)`)
  } catch (e) {
    try { unlinkSync(tmpExtract) } catch {}
    throw new Error(`osmium extract failed: ${e.message}`)
  }
}

// ── Auto-refresh: re-download GTFS every 7 days ──────────────────────────────
function deleteGtfsZips(rDir) {
  try {
    for (const f of readdirSync(rDir)) {
      if (f.startsWith('gtfs-') && f.endsWith('.zip')) {
        unlinkSync(join(rDir, f))
        console.log(`[dataManager] Deleted stale GTFS: ${f}`)
      }
    }
  } catch (e) {
    console.warn('[dataManager] deleteGtfsZips error:', e.message)
  }
}

export function startGtfsRefreshScheduler() {
  setInterval(() => {
    for (const [k, region] of Object.entries(regions)) {
      if (region.status !== 'ready') continue
      const age = Date.now() - (region.gtfsRefreshedAt ?? 0)
      if (age < GTFS_MAX_AGE_MS) continue

      const parts = k.split('_')
      const lat = parseFloat(parts[0])
      const lng = parseFloat(parts[1])
      if (isNaN(lat) || isNaN(lng)) continue

      console.log(`[dataManager] GTFS refresh: region ${k} is ${Math.round(age / 86_400_000)}d old — refreshing`)
      deleteGtfsZips(regionDir(k))
      regions[k] = { ...region, status: 'downloading', startedAt: Date.now(), message: 'Refreshing transit schedules (weekly update)…' }
      persist()
      runDownload(k, lat, lng)
    }
  }, 60 * 60 * 1000)
  console.log('[dataManager] GTFS auto-refresh scheduler started (7-day interval)')
}

// ── Diagnostics ───────────────────────────────────────────────────────────────
export async function diagnose(lat, lng) {
  const report = { lat, lng, timestamp: new Date().toISOString(), steps: {} }

  try {
    const cc = await getCountryCode(lat, lng)
    const tz = getTimezoneForLocation(lat, lng, cc)
    report.countryCode = cc
    report.timezone    = tz
    report.steps.geocode = { ok: true, countryCode: cc, timezone: tz }
  } catch (e) {
    report.steps.geocode = { ok: false, error: e.message }
  }

  try {
    const feeds = await findFeedsTransitland(lat, lng)
    report.steps.transitland = {
      ok: true, configured: !!TRANSITLAND_API_KEY,
      count: feeds.length, feeds: feeds.map(f => ({ id: f.id, url: f.url })),
    }
  } catch (e) {
    report.steps.transitland = { ok: false, error: e.message }
  }

  try {
    const feeds = await findFeedsMDB(lat, lng, report.countryCode ?? null)
    report.steps.mobilitydata = {
      ok: true, configured: !!MDB_REFRESH_TOKEN,
      count: feeds.length, feeds: feeds.map(f => ({ id: f.id, url: f.url })),
    }
  } catch (e) {
    report.steps.mobilitydata = { ok: false, error: e.message }
  }

  const regionState = getStatus(lat, lng)
  const otpPort = regionState?.otpPort
  report.steps.region = { state: regionState ?? { status: 'unknown' }, otpPort }

  try {
    const otpUrl = otpPort ? `${OTP_HOST}:${otpPort}` : null
    const ready  = otpUrl ? await isRealOtpAt(otpUrl) : false
    report.steps.otp = { ok: true, ready, url: otpUrl }
  } catch (e) {
    report.steps.otp = { ok: false, error: e.message }
  }

  const k   = key(lat, lng)
  const rDir = regionDir(k)
  try {
    const files = readdirSync(rDir)
      .map(name => {
        try {
          const s = statSync(join(rDir, name))
          return { name, sizeMB: parseFloat((s.size / (1024 * 1024)).toFixed(1)), isFile: s.isFile() }
        } catch { return { name } }
      })
      .sort((a, b) => (b.sizeMB ?? 0) - (a.sizeMB ?? 0))
    report.steps.dataDir = { ok: true, path: rDir, files }
  } catch (e) {
    report.steps.dataDir = { ok: false, path: rDir, error: e.message }
  }

  return report
}
