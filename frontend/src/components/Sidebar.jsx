import { useState } from 'react'
import { Bookmark, Navigation2, Route, MapPin, X } from 'lucide-react'
import { useMapStore } from '../store/mapStore'
import SearchBar from './SearchBar'
import RoutePanel from './RoutePanel'
import PlaceCard from './PlaceCard'
import CategoryChips from './CategoryChips'
import ThemeToggle from './ThemeToggle'
import clsx from 'clsx'

// Google Maps-style floating panel — top-left, all-corners rounded, shadow all around
export default function Sidebar() {
  const sidebarMode   = useMapStore((s) => s.sidebarMode)
  const savedPlaces   = useMapStore((s) => s.savedPlaces)
  const poiResults    = useMapStore((s) => s.poiResults)
  const poiCategory   = useMapStore((s) => s.poiCategory)
  const destination   = useMapStore((s) => s.destination)
  const origin        = useMapStore((s) => s.origin)
  const clearAll      = useMapStore((s) => s.clearAll)
  const selectedPOI   = useMapStore((s) => s.selectedPOI)
  const [view, setView] = useState('search') // 'search' | 'saved'

  const isDirections  = sidebarMode === 'directions'
  const hasActiveState = !!(destination || origin || poiResults.length > 0 || selectedPOI)
  // Auto-switch to POI view when category chips return results
  const effectiveView = poiResults.length > 0 && !isDirections && !selectedPOI ? 'poi' : view

  return (
    <div
      className="absolute left-3 top-3 z-20 flex flex-col w-[400px] max-w-[calc(100vw-24px)]"
      style={{
        maxHeight: 'calc(100dvh - 24px)',
        borderRadius: '24px',
        boxShadow: '0 1px 2px rgba(60,64,67,0.3), 0 2px 6px rgba(60,64,67,0.15)',
        overflow: 'hidden',
      }}
    >
      <div
        className="flex flex-col h-full bg-surface dark:bg-surface-dark"
        style={{ maxHeight: 'calc(100dvh - 24px)' }}
      >

        {/* ── Search bar (always visible at top) ──────────────────────── */}
        {!isDirections && (
          <div className="flex-shrink-0">
            <div className="flex items-center pr-2">
              <div className="flex-1">
                <SearchBar panelMode />
              </div>
              <div className="flex items-center gap-0.5 pr-1">
                {/* Clear-all X — shown whenever there's any active state */}
                {hasActiveState && (
                  <button
                    onClick={() => { clearAll(); setView('search') }}
                    title="Clear search"
                    className="w-9 h-9 flex items-center justify-center rounded-full text-txt-secondary dark:text-txt-secondary-dark hover:text-txt-primary dark:hover:text-txt-primary-dark hover:bg-surface-secondary dark:hover:bg-surface-dark-secondary transition-colors"
                  >
                    <X size={17} />
                  </button>
                )}
                <button
                  onClick={() => setView(view === 'saved' ? 'search' : 'saved')}
                  title="Saved places"
                  className={clsx(
                    'relative w-9 h-9 flex items-center justify-center rounded-full transition-colors',
                    view === 'saved'
                      ? 'bg-primary/10 dark:bg-primary-dark/10 text-primary dark:text-primary-dark'
                      : 'text-txt-secondary dark:text-txt-secondary-dark hover:bg-surface-secondary dark:hover:bg-surface-dark-secondary'
                  )}
                >
                  <Bookmark size={17} />
                  {savedPlaces.length > 0 && (
                    <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-primary dark:bg-primary-dark" />
                  )}
                </button>
                <ThemeToggle />
              </div>
            </div>

            {/* Category chips — shown when nothing is being searched */}
            {view === 'search' && (
              <div className="px-3 pb-3 border-b border-border dark:border-border-dark">
                <CategoryChips />
              </div>
            )}
          </div>
        )}

        {/* ── Scrollable content area ──────────────────────────────────── */}
        {/* All views share the same scrollable wrapper */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
          {selectedPOI     && <PlaceCard />}
          {!selectedPOI && isDirections  && <RoutePanel />}
          {!selectedPOI && !isDirections && effectiveView === 'poi'    && <POIResultsView category={poiCategory} />}
          {!selectedPOI && !isDirections && effectiveView === 'search' && <QuickActions />}
          {!selectedPOI && !isDirections && effectiveView === 'saved'  && <SavedPlacesView />}
        </div>
      </div>
    </div>
  )
}

function QuickActions() {
  const setOrigin      = useMapStore((s) => s.setOrigin)
  const setSidebarMode = useMapStore((s) => s.setSidebarMode)
  const userLocation   = useMapStore((s) => s.userLocation)
  const setUserLoc     = useMapStore((s) => s.setUserLocation)

  const startFromHere = () => {
    const use = (loc) => {
      setUserLoc(loc)
      setOrigin({ name: 'My location', ...loc })
      setSidebarMode('directions')
    }
    if (userLocation) { use(userLocation); return }
    navigator.geolocation?.getCurrentPosition(
      (pos) => use({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {},
      { timeout: 10000, maximumAge: 60000 }
    )
  }

  return (
    <div className="p-3 space-y-1">
      <QuickBtn
        icon={<Navigation2 size={17} className="text-primary dark:text-primary-dark" />}
        title="Directions from here"
        sub="Use your current location as start"
        onClick={startFromHere}
      />
      <QuickBtn
        icon={<Route size={17} className="text-primary dark:text-primary-dark" />}
        title="Plan a trip"
        sub="Car, bike, walk, or transit"
        onClick={() => setSidebarMode('directions')}
      />
    </div>
  )
}

function QuickBtn({ icon, title, sub, onClick }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-3 py-3 rounded-2xl hover:bg-surface-secondary dark:hover:bg-surface-dark-secondary transition-colors text-left"
    >
      <div className="w-10 h-10 rounded-full bg-primary/10 dark:bg-primary-dark/10 flex items-center justify-center flex-shrink-0">
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-sm font-medium text-txt-primary dark:text-txt-primary-dark truncate">{title}</div>
        <div className="text-xs text-txt-secondary dark:text-txt-secondary-dark truncate">{sub}</div>
      </div>
    </button>
  )
}

function SavedPlacesView() {
  const savedPlaces    = useMapStore((s) => s.savedPlaces)
  const unsavePlace    = useMapStore((s) => s.unsavePlace)
  const setDestination = useMapStore((s) => s.setDestination)
  const setOrigin      = useMapStore((s) => s.setOrigin)
  const setSidebarMode = useMapStore((s) => s.setSidebarMode)
  const flyTo          = useMapStore((s) => s.flyTo)
  const userLocation   = useMapStore((s) => s.userLocation)

  const goTo = (place) => {
    setDestination(place)
    setOrigin(userLocation ? { name: 'My location', ...userLocation } : null)
    setSidebarMode('directions')
    flyTo([place.lng, place.lat])
  }

  if (savedPlaces.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center px-8 py-16 text-center gap-3">
        <div className="w-14 h-14 rounded-full bg-surface-secondary dark:bg-surface-dark-secondary flex items-center justify-center">
          <Bookmark size={22} className="text-txt-secondary dark:text-txt-secondary-dark" />
        </div>
        <div>
          <p className="text-sm font-semibold text-txt-primary dark:text-txt-primary-dark">No saved places</p>
          <p className="text-xs text-txt-secondary dark:text-txt-secondary-dark mt-1">
            Tap the bookmark icon on any search result to save it here.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="py-2">
      <div className="px-4 py-2 text-[10px] font-semibold text-txt-secondary dark:text-txt-secondary-dark uppercase tracking-widest">
        Saved places
      </div>
      {savedPlaces.map((place) => (
        <div key={place.name} className="flex items-center gap-3 px-3 py-2 hover:bg-surface-secondary dark:hover:bg-surface-dark-secondary transition-colors group rounded-xl mx-1">
          <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
            <Bookmark size={16} className="text-amber-600 dark:text-amber-400 fill-amber-600 dark:fill-amber-400" />
          </div>
          <button className="flex-1 min-w-0 text-left" onClick={() => goTo(place)}>
            <div className="text-sm font-medium text-txt-primary dark:text-txt-primary-dark truncate">{place.name}</div>
            {place.subtitle && <div className="text-xs text-txt-secondary dark:text-txt-secondary-dark truncate">{place.subtitle}</div>}
          </button>
          <button
            onClick={() => unsavePlace(place.name)}
            className="w-7 h-7 flex items-center justify-center rounded-full text-txt-secondary dark:text-txt-secondary-dark hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors opacity-0 group-hover:opacity-100"
            title="Remove"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  )
}

function POIResultsView({ category }) {
  const poiResults    = useMapStore((s) => s.poiResults)
  const clearPoiResults = useMapStore((s) => s.clearPoiResults)
  const setSelectedPOI = useMapStore((s) => s.setSelectedPOI)
  const flyTo         = useMapStore((s) => s.flyTo)

  // Same behaviour as tapping an orange dot on the map
  const goTo = (place) => {
    setSelectedPOI(place)
    flyTo([place.lng, place.lat], 15)
  }

  return (
    <div className="py-2">
      <div className="flex items-center justify-between px-4 py-2">
        <p className="text-[10px] font-semibold text-txt-secondary dark:text-txt-secondary-dark uppercase tracking-widest">
          {category} nearby
        </p>
        <button
          onClick={clearPoiResults}
          className="w-6 h-6 flex items-center justify-center rounded-full text-txt-secondary dark:text-txt-secondary-dark hover:bg-surface-secondary dark:hover:bg-surface-dark-secondary transition-colors"
          title="Clear results"
        >
          <X size={13} />
        </button>
      </div>

      {poiResults.map((place, i) => (
        <button
          key={i}
          onClick={() => goTo(place)}
          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-secondary dark:hover:bg-surface-dark-secondary transition-colors text-left"
        >
          <div className="w-9 h-9 rounded-full bg-primary/10 dark:bg-primary-dark/10 flex items-center justify-center flex-shrink-0">
            <MapPin size={15} className="text-primary dark:text-primary-dark" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-txt-primary dark:text-txt-primary-dark truncate">{place.name}</div>
            <div className="text-xs text-txt-secondary dark:text-txt-secondary-dark truncate flex items-center gap-1.5">
              {place.stars && <span className="text-amber-500">{'★'.repeat(Math.min(5, parseInt(place.stars)))}</span>}
              {place.cuisine && <span className="capitalize">{place.cuisine.replace(/_/g,' ')}</span>}
              {place.subtitle && <span>{place.subtitle}</span>}
            </div>
          </div>
        </button>
      ))}
    </div>
  )
}

