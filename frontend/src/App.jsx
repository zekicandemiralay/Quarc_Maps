import { useEffect, useRef, useCallback } from 'react'
import { useMapStore } from './store/mapStore'
import MapView from './components/MapView'
import Sidebar from './components/Sidebar'
import BottomSheet from './components/BottomSheet'
import FloatingSearchBar from './components/FloatingSearchBar'
import MapControls from './components/MapControls'
import ContextMenu from './components/ContextMenu'
import SearchHereButton from './components/SearchHereButton'
import Toast from './components/Toast'

async function fetchIpLocation() {
  const providers = [
    { url: 'https://ipapi.co/json/',         lat: (d) => d.latitude,  lng: (d) => d.longitude },
    { url: 'https://freeipapi.com/api/json', lat: (d) => d.latitude,  lng: (d) => d.longitude },
    { url: 'https://ipwho.is/',              lat: (d) => d.latitude,  lng: (d) => d.longitude },
  ]
  for (const { url, lat, lng } of providers) {
    try {
      const ctrl = new AbortController()
      const t = setTimeout(() => ctrl.abort(), 5000)
      const r = await fetch(url, { signal: ctrl.signal })
      clearTimeout(t)
      const d = await r.json()
      const la = lat(d), lo = lng(d)
      if (la && lo) return { lat: Number(la), lng: Number(lo) }
    } catch {}
  }
  return null
}

function applyUrlParams() {
  const p = new URLSearchParams(window.location.search)
  if (!p.has('from') && !p.has('to') && !p.has('center')) return
  const store = useMapStore.getState()
  const parseCoord = (str) => {
    if (!str) return null
    const parts = str.split(',')
    if (parts.length < 2) return null
    const lat = parseFloat(parts[0]), lng = parseFloat(parts[1])
    const name = parts[2] ? decodeURIComponent(parts[2]) : `${lat.toFixed(5)}, ${lng.toFixed(5)}`
    if (isNaN(lat) || isNaN(lng)) return null
    return { lat, lng, name }
  }
  const from = parseCoord(p.get('from')), to = parseCoord(p.get('to'))
  const mode = p.get('mode'), center = parseCoord(p.get('center'))
  if (from)  store.setOrigin(from)
  if (to)    store.setDestination(to)
  if (mode)  store.setMode(mode)
  if (from || to) store.setSidebarMode('directions')
  if (center?.lat && center?.lng) {
    const parts = (p.get('center') ?? '').split(',')
    const zoom  = parts[2] ? parseFloat(parts[2]) : 12
    window.__urlCenter = { lat: center.lat, lng: center.lng, zoom: isNaN(zoom) ? 12 : zoom }
  }
}

function useStartupLocation() {
  const mapReady  = useMapStore((s) => !!s.mapRef)
  const didLocate = useRef(false)

  useEffect(() => {
    if (!mapReady || didLocate.current) return
    didLocate.current = true
    const { setUserLocation, flyTo } = useMapStore.getState()
    let gpsDone = false
    if (window.__urlCenter) {
      const { lat, lng, zoom } = window.__urlCenter
      flyTo([lng, lat], zoom)
      delete window.__urlCenter
      return
    }
    // If we have a cached GPS position the map already started there — skip IP fallback
    const hasCache = !!localStorage.getItem('sm-lastpos')
    if (!hasCache) {
      fetchIpLocation().then((loc) => { if (!gpsDone && loc) flyTo([loc.lng, loc.lat], 11) })
    }

    if (window.isSecureContext && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          gpsDone = true
          const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude }
          setUserLocation(loc)           // also saves to sm-lastpos
          if (!hasCache) flyTo([loc.lng, loc.lat], 14)  // only fly if no cache (map already there)
        },
        () => { gpsDone = true },
        { timeout: 10000, maximumAge: 60000 }
      )
    }
  }, [mapReady])
}

applyUrlParams()

export default function App() {
  const theme = useMapStore((s) => s.theme)
  useStartupLocation()

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])


  const handleMobileSearchFocus = useCallback(() => {
    // Bottom sheet will snap to half when results arrive via store
  }, [])

  return (
    <div className="relative w-screen h-dvh overflow-hidden bg-surface-secondary dark:bg-surface-dark font-sans">
      {/* Map fills entire screen */}
      <MapView />

      {/* Desktop: Google Maps-style floating panel (top-left) */}
      <div className="hidden md:block">
        <Sidebar />
      </div>

      {/* Mobile: floating search bar at top + bottom sheet */}
      <div className="md:hidden">
        <FloatingSearchBar onSearchFocus={handleMobileSearchFocus} />
        <BottomSheet />
      </div>

      <SearchHereButton />
      <MapControls />
      <ContextMenu />
      <Toast />
    </div>
  )
}
