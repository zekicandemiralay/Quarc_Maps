#!/usr/bin/env node
/**
 * One-time bulk download of GTFS + OSM data for all European countries + Turkey.
 * Fully resumable — already-completed files are skipped on restart.
 *
 * Run inside Docker (recommended):
 *   docker compose run --rm backend node src/scripts/download-europe.js
 *
 * Options:
 *   --countries=DE,TR,FR   process only specific country codes (comma-separated)
 *   --skip-osm             skip OSM downloads (GTFS only)
 *   --skip-gtfs            skip GTFS downloads (OSM only)
 *   --trigger-only         re-queue .rebuild for countries that already have data but no graph
 *
 * Disk space: ~60 GB OSM + ~3 GB GTFS + ~100 GB graphs (after build)
 * Network:    4–12 hours depending on connection speed
 * Build time: 1–3 hrs/country, sequential, unattended (OTP supervisor handles it)
 *
 * After running this script, start (or restart) the OTP container:
 *   docker compose restart otp
 * The supervisor will build all queued countries one-by-one automatically.
 * Watch progress: docker compose logs -f otp
 */

import axios from 'axios'
import { createWriteStream, existsSync, mkdirSync, readFileSync, writeFileSync, statSync, renameSync, unlinkSync, readdirSync } from 'fs'
import { join } from 'path'
import { pipeline } from 'stream/promises'
import { EUROPE, COUNTRY_BY_CC } from '../config/countries.js'

// ── Config ────────────────────────────────────────────────────────────────────

const DATA_DIR           = process.env.OTP_DATA_DIR    || '/otp-data'
const MDB_REFRESH_TOKEN  = process.env.MDB_REFRESH_TOKEN  || ''
const TRANSITLAND_API_KEY = process.env.TRANSITLAND_API_KEY || ''
const MANIFEST_FILE      = join(DATA_DIR, '.download-manifest.json')
const GEOFABRIK_BASE     = 'https://download.geofabrik.de'

// ── CLI args ──────────────────────────────────────────────────────────────────

const args           = process.argv.slice(2)
const onlyCodes      = args.find(a => a.startsWith('--countries='))?.slice('--countries='.length)?.toUpperCase().split(',') ?? null
const skipOsm        = args.includes('--skip-osm')
const skipGtfs       = args.includes('--skip-gtfs')
// --trigger-builds: after download, write .rebuild for countries that have data but no graph.
// Do NOT pass this while the OTP container is already building something — only use it
// when you want to explicitly queue a batch of builds.
const triggerBuilds  = args.includes('--trigger-builds')
const selectedCountries = onlyCodes ? EUROPE.filter(c => onlyCodes.includes(c.cc)) : EUROPE

// ── Manifest (progress persistence) ──────────────────────────────────────────

let manifest = {}
function loadManifest() {
  try { manifest = JSON.parse(readFileSync(MANIFEST_FILE, 'utf8')) } catch {}
}
function saveManifest() {
  try { writeFileSync(MANIFEST_FILE, JSON.stringify(manifest, null, 2)) } catch (e) {
    console.error('[manifest] Save failed:', e.message)
  }
}

// ── MDB token ─────────────────────────────────────────────────────────────────

let _token = null, _tokenExpiry = 0
async function getMdbToken() {
  if (_token && Date.now() < _tokenExpiry - 60_000) return _token
  const { data } = await axios.post(
    'https://api.mobilitydatabase.org/v1/tokens',
    { refresh_token: MDB_REFRESH_TOKEN },
    { timeout: 15_000 }
  )
  _token = data.access_token
  _tokenExpiry = Date.now() + (data.expires_in ?? 3600) * 1000
  return _token
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function mb(bytes) { return (bytes / (1024 * 1024)).toFixed(0) + ' MB' }

async function downloadFile(url, dest, label, timeoutMs = 90 * 60_000) {
  const tmp = dest + '.tmp'
  process.stdout.write(`  ↓ ${label} … `)
  try {
    const r = await axios.get(url, {
      responseType: 'stream',
      timeout: timeoutMs,
      headers: { 'Accept-Encoding': 'identity' },
    })
    await pipeline(r.data, createWriteStream(tmp))
    renameSync(tmp, dest)
    console.log(`done (${mb(statSync(dest).size)})`)
    return true
  } catch (e) {
    try { unlinkSync(tmp) } catch {}
    console.log(`FAILED — ${e.message}`)
    return false
  }
}

// Assign next unused OTP port for this country
function assignPort(cc, rDir) {
  const portFile = join(rDir, '.port')
  if (existsSync(portFile)) return parseInt(readFileSync(portFile, 'utf8').trim(), 10)

  // Collect ports already used by other countries
  const used = new Set()
  try {
    const state = JSON.parse(readFileSync(join(DATA_DIR, '.state.json'), 'utf8'))
    for (const r of Object.values(state)) if (r.otpPort) used.add(r.otpPort)
  } catch {}
  for (const c of EUROPE) {
    try {
      const p = parseInt(readFileSync(join(DATA_DIR, c.cc, '.port'), 'utf8').trim(), 10)
      if (!isNaN(p)) used.add(p)
    } catch {}
  }

  let port = 8080
  while (used.has(port)) port++
  writeFileSync(portFile, String(port))
  return port
}

// ── OSM download ──────────────────────────────────────────────────────────────

async function downloadOSM(country, rDir) {
  const mf = (manifest[country.cc] ??= {})

  // Check if already done
  if (mf.osm?.status === 'done') {
    const f = join(rDir, mf.osm.file)
    if (existsSync(f)) {
      console.log(`  [OSM] ✓ Already downloaded: ${mf.osm.file} (${mb(statSync(f).size)})`)
      return true
    }
    // File deleted after being marked done — re-download
    console.log(`  [OSM] File missing, re-downloading…`)
    delete mf.osm
    saveManifest()
  }

  // Try primary URL then alternate (Geofabrik sometimes changes subregion names)
  const slug     = country.geofabrik.split('/').pop()
  const fileName = `${slug}-latest.osm.pbf`
  const dest     = join(rDir, fileName)
  const urls     = [
    `${GEOFABRIK_BASE}/${country.geofabrik}-latest.osm.pbf`,
  ]
  // Some countries have a "-latest" mirror variant
  if (country.cc === 'MK') urls.push(`${GEOFABRIK_BASE}/europe/macedonia-latest.osm.pbf`)

  let ok = false
  for (const url of urls) {
    ok = await downloadFile(url, dest, `OSM ${country.name} (${country.cc})`, 120 * 60_000)
    if (ok) break
  }

  if (ok) {
    mf.osm = { status: 'done', file: fileName, bytes: statSync(dest).size, completedAt: new Date().toISOString() }
    saveManifest()
  }
  return ok
}

// ── GTFS download ─────────────────────────────────────────────────────────────

async function findFeedsForCountry(country) {
  const feeds = []
  const seen  = new Set()

  // Layer 1: MobilityData (by country_code — most authoritative)
  if (MDB_REFRESH_TOKEN) {
    try {
      const token = await getMdbToken()
      const { data } = await axios.get('https://api.mobilitydatabase.org/v1/gtfs_feeds', {
        params: { country_code: country.cc, status: 'active', limit: 100 },
        headers: { Authorization: `Bearer ${token}` },
        timeout: 30_000,
      })
      const list = Array.isArray(data) ? data : (data.results ?? [])
      for (const f of list) {
        const url = f.latest_dataset?.hosted_url ?? ''
        if (url.startsWith('http') && !seen.has(url)) {
          seen.add(url)
          feeds.push({ id: `mdb-${f.id}`, url, source: 'mdb' })
        }
      }
      console.log(`  [MDB]  ${list.length} feeds for ${country.cc}, ${feeds.length} with download URLs`)
    } catch (e) {
      console.warn(`  [MDB]  Error: ${e.message}`)
    }
  }

  // Layer 2: Transitland (using full country bbox for coverage)
  if (TRANSITLAND_API_KEY) {
    try {
      const [minLon, minLat, maxLon, maxLat] = country.bbox
      const bbox = [minLon, minLat, maxLon, maxLat].join(',')
      const { data } = await axios.get('https://transit.land/api/v2/rest/feeds', {
        params: { bbox, per_page: 100, spec: 'gtfs', apikey: TRANSITLAND_API_KEY },
        timeout: 30_000,
      })
      let added = 0
      for (const f of (data.feeds ?? [])) {
        if ((f.spec ?? '').toUpperCase() !== 'GTFS') continue
        const authType = (f.authorization?.type ?? '').toLowerCase().trim()
        if (['query_param', 'header', 'basic_auth', 'oauth2'].includes(authType)) continue
        const url = f.urls?.static_current
        if (url && !seen.has(url)) { seen.add(url); feeds.push({ id: `tl-${f.id}`, url, source: 'tl' }); added++ }
      }
      console.log(`  [TL]   ${added} additional feeds (total ${feeds.length})`)
    } catch (e) {
      console.warn(`  [TL]   Error: ${e.message}`)
    }
  }

  return feeds
}

async function downloadGTFS(country, rDir) {
  const mf = (manifest[country.cc] ??= {})

  // Check if already done (all files still exist)
  if (mf.gtfs?.status === 'done') {
    const existing = (mf.gtfs.feeds ?? []).filter(f => existsSync(join(rDir, f.file)))
    if (existing.length > 0) {
      console.log(`  [GTFS] ✓ Already downloaded: ${existing.length} feed(s)`)
      return existing.length
    }
    console.log(`  [GTFS] Files missing, re-downloading…`)
    delete mf.gtfs
    saveManifest()
  }

  console.log(`  [GTFS] Discovering feeds for ${country.cc}…`)
  const feeds = await findFeedsForCountry(country)

  if (feeds.length === 0) {
    if (!MDB_REFRESH_TOKEN && !TRANSITLAND_API_KEY) {
      console.log(`  [GTFS] ⚠  No API keys — set MDB_REFRESH_TOKEN or TRANSITLAND_API_KEY`)
    } else {
      console.log(`  [GTFS] No feeds found for ${country.cc}`)
    }
    mf.gtfs = { status: 'done', feeds: [], completedAt: new Date().toISOString() }
    saveManifest()
    return 0
  }

  let downloaded = 0
  const savedFeeds = []

  for (const feed of feeds) {
    const safeName = feed.id.replace(/[^a-z0-9]/gi, '-')
    const dest     = join(rDir, `gtfs-${safeName}.zip`)

    // Already cached?
    if (existsSync(dest)) {
      const bytes = statSync(dest).size
      console.log(`  [GTFS] ✓ Cached: ${feed.id} (${mb(bytes)})`)
      savedFeeds.push({ id: feed.id, file: `gtfs-${safeName}.zip`, url: feed.url, source: feed.source, bytes })
      downloaded++
      continue
    }

    const ok = await downloadFile(feed.url, dest, `GTFS [${feed.source}] ${feed.id}`, 30 * 60_000)
    if (ok) {
      savedFeeds.push({ id: feed.id, file: `gtfs-${safeName}.zip`, url: feed.url, source: feed.source, bytes: statSync(dest).size })
      downloaded++
    }
  }

  mf.gtfs = { status: 'done', feeds: savedFeeds, completedAt: new Date().toISOString() }
  saveManifest()
  console.log(`  [GTFS] ${downloaded}/${feeds.length} feeds downloaded`)
  return downloaded
}

// ── Per-country orchestration ─────────────────────────────────────────────────

async function processCountry(country) {
  const rDir = join(DATA_DIR, country.cc)
  mkdirSync(rDir, { recursive: true })

  const sep = '─'.repeat(58)
  console.log(`\n┌${sep}┐`)
  console.log(`│  ${country.cc}  ${country.name.padEnd(24)}  ${country.geofabrik.padEnd(26)}│`)
  console.log(`└${sep}┘`)

  if (!skipOsm)  await downloadOSM(country, rDir)
  if (!skipGtfs) await downloadGTFS(country, rDir)

  // Write build-config.json (idempotent)
  writeFileSync(join(rDir, 'build-config.json'), JSON.stringify({
    transitServiceStart: '-P1Y',
    transitServiceEnd:   'P3Y',
    localFileNamePatterns: { osm: '.*\\.osm(\\.pbf)?', gtfs: '.*\\.zip' },
    osmDefaults: { timeZone: country.tz },
  }, null, 2))

  // Assign OTP port (idempotent)
  const port = assignPort(country.cc, rDir)
  console.log(`  [PORT] ${port}`)

  // Check data completeness — report only, do NOT write .rebuild here.
  // Builds are triggered separately via --trigger-builds (one country at a time)
  // or automatically on the first routing request via the backend.
  const mf        = manifest[country.cc] ?? {}
  const osmFile   = mf.osm?.file ? join(rDir, mf.osm.file) : null
  const hasOsm    = osmFile ? existsSync(osmFile) : false
  const gtfsFeeds = mf.gtfs?.feeds ?? []
  const hasGtfs   = gtfsFeeds.some(f => existsSync(join(rDir, f.file)))
  const hasGraph  = existsSync(join(rDir, 'graph.obj'))

  if (!hasOsm || !hasGtfs) {
    console.log(`  [STATUS] ⚠  Missing ${!hasOsm ? 'OSM' : ''}${!hasOsm && !hasGtfs ? ' + ' : ''}${!hasGtfs ? 'GTFS' : ''} — build not possible yet`)
  } else if (hasGraph) {
    console.log(`  [STATUS] ✓ Data complete, graph.obj exists — ready to serve`)
  } else {
    console.log(`  [STATUS] ✓ Data complete — build will start on first routing request`)
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  mkdirSync(DATA_DIR, { recursive: true })
  loadManifest()

  const totalOsm  = selectedCountries.reduce((s, c) => {
    // rough estimate: small countries ~200 MB, Germany ~4 GB, etc.
    return s
  }, 0)

  console.log('\n╔══════════════════════════════════════════════════════════╗')
  console.log('║       Quarc Maps — Europe + Turkey Bulk Download        ║')
  console.log('╚══════════════════════════════════════════════════════════╝')
  console.log(`DATA_DIR     : ${DATA_DIR}`)
  console.log(`Countries    : ${selectedCountries.length} (${selectedCountries.map(c => c.cc).join(', ')})`)
  console.log(`MDB token    : ${MDB_REFRESH_TOKEN  ? '✓ configured' : '✗ NOT SET — GTFS from MDB skipped'}`)
  console.log(`Transitland  : ${TRANSITLAND_API_KEY ? '✓ configured' : '✗ NOT SET — GTFS from TL skipped'}`)
  console.log(`Skip OSM       : ${skipOsm}`)
  console.log(`Skip GTFS      : ${skipGtfs}`)
  console.log(`Trigger builds : ${triggerBuilds}`)
  console.log()
  console.log('This will take several hours. Safe to Ctrl+C and resume.')
  console.log('Progress is saved after each file download.')
  console.log()

  if (!MDB_REFRESH_TOKEN && !TRANSITLAND_API_KEY && !skipGtfs) {
    console.error('⚠  WARNING: No API keys set. Only OSM data will be downloaded.')
    console.error('   Add MDB_REFRESH_TOKEN and/or TRANSITLAND_API_KEY to your .env file.\n')
  }

  const start = Date.now()

  for (let i = 0; i < selectedCountries.length; i++) {
    const country = selectedCountries[i]
    console.log(`\n[${i + 1}/${selectedCountries.length}]`)
    await processCountry(country)
  }

  const elapsed = Math.round((Date.now() - start) / 60_000)
  console.log('\n\n╔══════════════════════════════════════════════════════════╗')
  console.log('║                  Download complete!                      ║')
  console.log('╚══════════════════════════════════════════════════════════╝')
  console.log(`Time: ${elapsed} min`)
  console.log()

  // Summary
  let built = 0, readyToBuild = 0, missing = 0
  const readyCountries = []
  for (const c of selectedCountries) {
    const rDir  = join(DATA_DIR, c.cc)
    const mf    = manifest[c.cc] ?? {}
    const hasOsm  = mf.osm?.file   ? existsSync(join(rDir, mf.osm.file)) : false
    const hasGtfs = (mf.gtfs?.feeds ?? []).some(f => existsSync(join(rDir, f.file)))
    if (existsSync(join(rDir, 'graph.obj'))) { built++; continue }
    if (hasOsm && hasGtfs) { readyToBuild++; readyCountries.push(c.cc); continue }
    missing++
  }
  console.log(`Graphs already built  : ${built}`)
  console.log(`Ready to build        : ${readyToBuild}  (${readyCountries.join(', ')})`)
  console.log(`Missing data          : ${missing}`)
  console.log()

  // --trigger-builds: write .rebuild files NOW so OTP builds them on next start.
  // Only do this after ALL downloads are done to avoid OTP building while downloads
  // are still consuming RAM.
  if (triggerBuilds && readyCountries.length > 0) {
    console.log(`Writing .rebuild for ${readyCountries.length} countries…`)
    for (const cc of readyCountries) {
      writeFileSync(join(DATA_DIR, cc, '.rebuild'), String(Date.now()))
    }
    console.log('Done. Start OTP now:')
    console.log('  docker compose restart otp')
    console.log('  docker compose logs -f otp')
    console.log()
    console.log('Builds run ONE country at a time (~1–3 hrs each).')
    console.log('Once a country is built it routes instantly, forever.')
  } else if (readyToBuild > 0) {
    console.log('Data is downloaded. Builds start automatically on first routing request.')
    console.log('To pre-build all countries right now (OTP must be running):')
    console.log(`  docker compose run --rm backend node src/scripts/download-europe.js --trigger-builds --skip-osm --skip-gtfs`)
    console.log()
    console.log('Or just start the app — each country builds the first time someone')
    console.log('requests a route there (~1–3 hrs, then instant forever).')
  }
}

process.on('SIGINT', () => {
  console.log('\n\nInterrupted. All completed downloads are saved. Re-run to resume.')
  process.exit(0)
})

main().catch(e => { console.error('\nFatal error:', e); process.exit(1) })
