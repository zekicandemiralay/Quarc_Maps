import { useState, useCallback, useMemo } from 'react'
import {
  ArrowLeft, ArrowUpDown, Navigation, MapPin, LocateFixed, History,
  Download, Share2, Copy
} from 'lucide-react'
import { useMapStore } from '../store/mapStore'
import { searchPlaces } from '../services/geocoding'
import { calculateRoute } from '../services/routing'
import { formatDuration, formatDistance } from '../utils/polyline'
import ModeSelector from './ModeSelector'
import DirectionsList from './DirectionsList'
import TransitPanel from './TransitPanel'
import ElevationProfile from './ElevationProfile'
import clsx from 'clsx'

function getRecent() {
  try { return JSON.parse(localStorage.getItem('sm-recent') ?? '[]') } catch { return [] }
}
function saveRecent(place) {
  try {
    const list = [place, ...getRecent().filter((r) => r.name !== place.name)].slice(0, 5)
    localStorage.setItem('sm-recent', JSON.stringify(list))
  } catch {}
}

// ── GPX export ────────────────────────────────────────────────────────────
function downloadGPX(route, name) {
  const coords = route?.features?.[0]?.geometry?.coordinates
  if (!coords) return
  const trkpts = coords
    .map(([lon, lat, ele]) => {
      const eleTag = (ele != null && !isNaN(ele)) ? `<ele>${ele.toFixed(1)}</ele>` : ''
      return `      <trkpt lat="${lat.toFixed(7)}" lon="${lon.toFixed(7)}">${eleTag}</trkpt>`
    })
    .join('\n')

  const gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Quarc Maps" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata><name>${name}</name></metadata>
  <trk>
    <name>${name}</name>
    <trkseg>
${trkpts}
    </trkseg>
  </trk>
</gpx>`

  const blob = new Blob([gpx], { type: 'application/gpx+xml' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url
  a.download = 'route.gpx'
  a.click()
  URL.revokeObjectURL(url)
}

// ── Location input ────────────────────────────────────────────────────────
function LocationInput({ value, placeholder, icon: Icon, onChange, onSelect, color }) {
  const [query,   setQuery]   = useState(value?.name ?? '')
  const [results, setResults] = useState([])
  const [open,    setOpen]    = useState(false)
  const debounce = useCallback((fn, delay) => {
    let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), delay) }
  }, [])
  const search = useCallback(debounce(async (q) => {
    if (!q.trim()) { setResults([]); return }
    const res = await searchPlaces(q)
    setResults(res)
  }, 300), [])

  const recent = getRecent()
  const showRecent  = open && query.trim() === '' && recent.length > 0
  const showResults = open && results.length > 0

  const handleSelect = (place) => {
    saveRecent(place)
    onSelect(place)
    setQuery(place.name)
    setOpen(false)
  }

  const handleSelectMyLocation = () => {
    const { userLocation } = useMapStore.getState()
    const use = (loc) => {
      useMapStore.getState().setUserLocation(loc)
      handleSelect({ name: 'My location', ...loc })
    }
    if (userLocation) { use(userLocation); return }
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      (pos) => use({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {},
      { timeout: 10000, maximumAge: 60000 }
    )
  }

  return (
    <div className="relative">
      <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-border dark:border-border-dark bg-surface-secondary dark:bg-surface-dark-secondary focus-within:border-primary dark:focus-within:border-primary-dark focus-within:bg-surface dark:focus-within:bg-surface-dark transition-colors">
        <Icon size={14} className={color} />
        <input
          value={query}
          onChange={(e) => { setQuery(e.target.value); search(e.target.value); onChange(e.target.value) }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder={placeholder}
          className="flex-1 bg-transparent outline-none text-sm text-txt-primary dark:text-txt-primary-dark placeholder-txt-secondary dark:placeholder-txt-secondary-dark"
        />
      </div>
      {open && (showRecent || showResults || true) && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-surface dark:bg-surface-dark-secondary border border-border dark:border-border-dark rounded-xl shadow-float dark:shadow-float-dark z-50 max-h-52 overflow-y-auto animate-slide-up">
          <button
            onMouseDown={handleSelectMyLocation}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-surface-secondary dark:hover:bg-surface-dark-tertiary text-sm border-b border-border dark:border-border-dark transition-colors"
          >
            <LocateFixed size={13} className="text-primary dark:text-primary-dark flex-shrink-0" />
            <span className="font-medium text-txt-primary dark:text-txt-primary-dark">My location</span>
          </button>
          {showRecent && (
            <>
              <div className="px-3 pt-2 pb-0.5 text-[10px] font-semibold text-txt-secondary dark:text-txt-secondary-dark uppercase tracking-widest">Recent</div>
              {recent.map((place, i) => (
                <button key={i} onMouseDown={() => handleSelect(place)}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-surface-secondary dark:hover:bg-surface-dark-tertiary text-sm transition-colors">
                  <History size={12} className="text-txt-secondary dark:text-txt-secondary-dark flex-shrink-0" />
                  <div className="min-w-0">
                    <div className="font-medium text-txt-primary dark:text-txt-primary-dark truncate">{place.name}</div>
                    {place.subtitle && <div className="text-xs text-txt-secondary dark:text-txt-secondary-dark truncate">{place.subtitle}</div>}
                  </div>
                </button>
              ))}
            </>
          )}
          {showResults && results.map((place, i) => (
            <button key={i} onMouseDown={() => handleSelect(place)}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-surface-secondary dark:hover:bg-surface-dark-tertiary text-sm transition-colors">
              <MapPin size={12} className="text-txt-secondary dark:text-txt-secondary-dark flex-shrink-0" />
              <div className="min-w-0">
                <div className="font-medium text-txt-primary dark:text-txt-primary-dark truncate">{place.name}</div>
                {place.subtitle && <div className="text-xs text-txt-secondary dark:text-txt-secondary-dark truncate">{place.subtitle}</div>}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────
export default function RoutePanel({ onClose } = {}) {
  const origin             = useMapStore((s) => s.origin)
  const destination        = useMapStore((s) => s.destination)
  const mode               = useMapStore((s) => s.mode)
  const route              = useMapStore((s) => s.route)
  const duration           = useMapStore((s) => s.duration)
  const distance           = useMapStore((s) => s.distance)
  const transitItineraries = useMapStore((s) => s.transitItineraries)
  const routeAlternatives  = useMapStore((s) => s.routeAlternatives)
  const selectedAlternative = useMapStore((s) => s.selectedAlternative)
  const isLoading          = useMapStore((s) => s.isLoading)
  const error              = useMapStore((s) => s.error)
  const steps              = useMapStore((s) => s.steps)

  const [transitWhen, setTransitWhen] = useState('now')
  const [transitDate, setTransitDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [transitTime, setTransitTime] = useState(() => {
    const n = new Date()
    return `${String(n.getHours()).padStart(2,'0')}:${String(n.getMinutes()).padStart(2,'0')}`
  })
  const [shareCopied, setShareCopied] = useState(false)

  const setOrigin           = useMapStore((s) => s.setOrigin)
  const setDestination      = useMapStore((s) => s.setDestination)
  const swapEndpoints       = useMapStore((s) => s.swapEndpoints)
  const setSidebarMode      = useMapStore((s) => s.setSidebarMode)
  const setLoading          = useMapStore((s) => s.setLoading)
  const setError            = useMapStore((s) => s.setError)
  const setRoute            = useMapStore((s) => s.setRoute)
  const setRouteWithAlts    = useMapStore((s) => s.setRouteWithAlternatives)
  const selectAlternative   = useMapStore((s) => s.selectAlternative)
  const setTransit          = useMapStore((s) => s.setTransitItineraries)
  const clearRoute          = useMapStore((s) => s.clearRoute)
  const setUserLoc          = useMapStore((s) => s.setUserLocation)
  const showToast           = useMapStore((s) => s.showToast)
  const mapRef              = useMapStore((s) => s.mapRef)

  const handleGetRoute = useCallback(async () => {
    if (!origin || !destination) return
    setLoading(true)
    setError(null)
    try {
      const transitOptions = (mode === 'transit' && transitWhen !== 'now')
        ? { date: transitDate, time: transitTime + ':00', arriveBy: transitWhen === 'arrive' }
        : {}
      const result = await calculateRoute(origin, destination, mode, transitOptions)

      if (mode === 'transit') {
        setTransit(result.itineraries)
      } else if (result.alternatives?.length > 1) {
        setRouteWithAlts(result.alternatives)
      } else {
        setRoute(result.route, result.steps, result.duration, result.distance)
      }
    } catch (err) {
      setError(err.message || 'Could not calculate route')
    }
  }, [origin, destination, mode, transitWhen, transitDate, transitTime])

  const useMyLocation = () => {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition((pos) => {
      const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude }
      setUserLoc(loc)
      setOrigin({ name: 'My location', ...loc })
    })
  }

  const handleShare = () => {
    const params = new URLSearchParams({ mode })
    if (origin)      params.set('from', `${origin.lat.toFixed(6)},${origin.lng.toFixed(6)},${encodeURIComponent(origin.name || '')}`)
    if (destination) params.set('to',   `${destination.lat.toFixed(6)},${destination.lng.toFixed(6)},${encodeURIComponent(destination.name || '')}`)
    if (mapRef) {
      const c = mapRef.getCenter()
      params.set('center', `${c.lat.toFixed(5)},${c.lng.toFixed(5)},${Math.round(mapRef.getZoom())}`)
    }
    const url = `${window.location.origin}${window.location.pathname}?${params}`
    navigator.clipboard.writeText(url).then(() => {
      setShareCopied(true)
      showToast('Link copied to clipboard')
      setTimeout(() => setShareCopied(false), 2500)
    }).catch(() => showToast('Could not copy link'))
  }

  const hasRoute = route || transitItineraries.length > 0
  const showElev = hasRoute && route && (mode === 'cycling' || mode === 'walking')

  const altLabels = ['Fastest', 'Alternative', 'Scenic']

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border dark:border-border-dark flex-shrink-0">
        <button
          onClick={() => { setSidebarMode('search'); clearRoute(); onClose?.() }}
          className="p-1.5 rounded-full hover:bg-surface-secondary dark:hover:bg-surface-dark-secondary transition-colors"
        >
          <ArrowLeft size={17} className="text-txt-primary dark:text-txt-primary-dark" />
        </button>
        <span className="font-semibold text-[15px] text-txt-primary dark:text-txt-primary-dark">Directions</span>
      </div>

      {/* Inputs */}
      <div className="px-4 py-3 space-y-2 border-b border-border dark:border-border-dark flex-shrink-0">
        <div className="flex gap-2 items-center">
          <div className="flex flex-col gap-2 flex-1">
            <LocationInput
              value={origin}
              placeholder="Choose starting point"
              icon={Navigation}
              color="text-primary dark:text-primary-dark"
              onChange={() => {}}
              onSelect={setOrigin}
            />
            <LocationInput
              value={destination}
              placeholder="Choose destination"
              icon={MapPin}
              color="text-red-500"
              onChange={() => {}}
              onSelect={setDestination}
            />
          </div>
          <button
            onClick={swapEndpoints}
            className="p-2 rounded-lg hover:bg-surface-secondary dark:hover:bg-surface-dark-secondary transition-colors text-txt-secondary dark:text-txt-secondary-dark"
            title="Swap"
          >
            <ArrowUpDown size={15} />
          </button>
        </div>

        {!origin && (
          <button onClick={useMyLocation} className="flex items-center gap-1.5 text-xs text-primary dark:text-primary-dark hover:underline">
            <LocateFixed size={12} /> Use my location
          </button>
        )}

        <ModeSelector />

        {mode === 'transit' && (
          <TransitTimeSelector
            when={transitWhen} date={transitDate} time={transitTime}
            onWhenChange={setTransitWhen} onDateChange={setTransitDate} onTimeChange={setTransitTime}
          />
        )}

        <button
          onClick={handleGetRoute}
          disabled={!origin || !destination || isLoading}
          className={clsx(
            'w-full py-2.5 rounded-xl text-sm font-semibold transition-all',
            origin && destination && !isLoading
              ? 'bg-primary dark:bg-primary-dark text-white hover:opacity-90 active:scale-[0.98]'
              : 'bg-surface-secondary dark:bg-surface-dark-secondary text-txt-secondary dark:text-txt-secondary-dark cursor-not-allowed'
          )}
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Calculating…
            </span>
          ) : 'Get Directions'}
        </button>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto">
        {error && (
          <div className="mx-4 mt-4 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        {hasRoute && !error && (
          <>
            {/* Route alternatives picker */}
            {routeAlternatives.length > 1 && mode !== 'transit' && (
              <div className="px-4 py-3 border-b border-border dark:border-border-dark">
                <p className="text-[10px] font-semibold text-txt-secondary dark:text-txt-secondary-dark uppercase tracking-widest mb-2">
                  Route options
                </p>
                <div className="flex gap-2">
                  {routeAlternatives.map((alt, i) => (
                    <button
                      key={i}
                      onClick={() => selectAlternative(i)}
                      className={clsx(
                        'flex-1 py-2.5 px-2 rounded-xl text-center text-xs border transition-all',
                        i === selectedAlternative
                          ? 'bg-primary dark:bg-primary-dark text-white border-primary dark:border-primary-dark shadow-sm'
                          : 'border-border dark:border-border-dark text-txt-primary dark:text-txt-primary-dark hover:bg-surface-secondary dark:hover:bg-surface-dark-secondary'
                      )}
                    >
                      <div className="font-bold text-sm">{formatDuration(alt.duration)}</div>
                      <div className="opacity-80">{formatDistance(alt.distance)}</div>
                      <div className={clsx(
                        'text-[10px] mt-0.5',
                        i === selectedAlternative ? 'opacity-80' : 'text-txt-secondary dark:text-txt-secondary-dark'
                      )}>
                        {altLabels[i] ?? `Option ${i + 1}`}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Route summary (non-transit) */}
            {mode !== 'transit' && duration && (
              <div className="px-4 py-3 border-b border-border dark:border-border-dark">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-2xl font-bold text-txt-primary dark:text-txt-primary-dark">
                      {formatDuration(duration)}
                    </div>
                    <div className="text-sm text-txt-secondary dark:text-txt-secondary-dark mt-0.5">
                      {formatDistance(distance)}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 mt-1">
                    {/* GPX export */}
                    <button
                      onClick={() => {
                        downloadGPX(route, `${origin?.name ?? 'Start'} → ${destination?.name ?? 'End'}`)
                        showToast('GPX file downloaded')
                      }}
                      title="Export GPX"
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-txt-secondary dark:text-txt-secondary-dark hover:text-primary dark:hover:text-primary-dark hover:bg-surface-secondary dark:hover:bg-surface-dark-secondary transition-colors"
                    >
                      <Download size={15} />
                    </button>
                    {/* Share route */}
                    <button
                      onClick={handleShare}
                      title="Share route"
                      className={clsx(
                        'w-8 h-8 flex items-center justify-center rounded-lg transition-colors',
                        shareCopied
                          ? 'text-primary dark:text-primary-dark bg-primary/10 dark:bg-primary-dark/10'
                          : 'text-txt-secondary dark:text-txt-secondary-dark hover:text-primary dark:hover:text-primary-dark hover:bg-surface-secondary dark:hover:bg-surface-dark-secondary'
                      )}
                    >
                      {shareCopied ? <Copy size={15} /> : <Share2 size={15} />}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Elevation profile (cycling / walking only) */}
            {showElev && <ElevationProfile route={route} />}

            {/* Steps / Transit */}
            {mode === 'transit'
              ? <TransitPanel />
              : <DirectionsList steps={steps} />
            }
          </>
        )}
      </div>
    </div>
  )
}

function TransitTimeSelector({ when, date, time, onWhenChange, onDateChange, onTimeChange }) {
  const dateOptions = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() + i)
    const value = d.toISOString().slice(0, 10)
    const label = i === 0 ? 'Today'
      : i === 1 ? 'Tomorrow'
      : d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    return { value, label }
  }), [])

  return (
    <div className="space-y-1.5">
      <div className="flex rounded-xl bg-surface-secondary dark:bg-surface-dark-secondary p-0.5 gap-0.5">
        {[['now', 'Now'], ['depart', 'Depart at'], ['arrive', 'Arrive by']].map(([v, l]) => (
          <button
            key={v}
            type="button"
            onClick={() => onWhenChange(v)}
            className={clsx(
              'flex-1 py-1.5 text-xs font-medium rounded-lg transition-all',
              when === v
                ? 'bg-surface dark:bg-surface-dark text-txt-primary dark:text-txt-primary-dark shadow-sm'
                : 'text-txt-secondary dark:text-txt-secondary-dark hover:text-txt-primary dark:hover:text-txt-primary-dark'
            )}
          >
            {l}
          </button>
        ))}
      </div>

      {when !== 'now' && (
        <div className="flex gap-2">
          <select
            value={date}
            onChange={(e) => onDateChange(e.target.value)}
            className="flex-1 text-xs px-2 py-1.5 rounded-lg border border-border dark:border-border-dark bg-surface dark:bg-surface-dark text-txt-primary dark:text-txt-primary-dark outline-none focus:border-primary dark:focus:border-primary-dark"
          >
            {dateOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <input
            type="time"
            value={time}
            onChange={(e) => onTimeChange(e.target.value)}
            className="w-28 text-xs px-2 py-1.5 rounded-lg border border-border dark:border-border-dark bg-surface dark:bg-surface-dark text-txt-primary dark:text-txt-primary-dark outline-none focus:border-primary dark:focus:border-primary-dark"
          />
        </div>
      )}
    </div>
  )
}
