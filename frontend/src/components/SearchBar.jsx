import { useState, useEffect, useRef, useCallback } from 'react'
import { Search, X, MapPin, Clock, LocateFixed, Bookmark, Menu } from 'lucide-react'
import { useMapStore } from '../store/mapStore'
import { searchPlaces } from '../services/geocoding'
import clsx from 'clsx'

const MAX_RECENT = 5

export function getRecent() {
  try { return JSON.parse(localStorage.getItem('sm-recent') ?? '[]') } catch { return [] }
}
export function saveRecent(place) {
  try {
    const list = [place, ...getRecent().filter((r) => r.name !== place.name)].slice(0, MAX_RECENT)
    localStorage.setItem('sm-recent', JSON.stringify(list))
  } catch {}
}

// ── Shared result-row renderer ────────────────────────────────────────────
function ResultRow({ place, isRecent, onSelect, onToggleSave, saved }) {
  return (
    <div className="flex items-center group hover:bg-surface-secondary dark:hover:bg-surface-dark-secondary transition-colors">
      <button
        onMouseDown={() => onSelect(place)}
        className="flex-1 flex items-center gap-3 px-4 py-3 text-left"
      >
        <div className="flex-shrink-0 w-9 h-9 rounded-full bg-surface-secondary dark:bg-surface-dark-secondary flex items-center justify-center">
          {isRecent
            ? <Clock size={15} className="text-txt-secondary dark:text-txt-secondary-dark" />
            : <MapPin size={15} className="text-primary dark:text-primary-dark" />}
        </div>
        <div className="min-w-0">
          <div className="text-sm font-medium text-txt-primary dark:text-txt-primary-dark truncate">{place.name}</div>
          {place.subtitle && (
            <div className="text-xs text-txt-secondary dark:text-txt-secondary-dark truncate">{place.subtitle}</div>
          )}
        </div>
      </button>
      {!isRecent && onToggleSave && (
        <button
          onMouseDown={(e) => { e.stopPropagation(); onToggleSave(place) }}
          className={clsx(
            'flex-shrink-0 w-10 h-10 flex items-center justify-center mr-1 rounded-full transition-colors',
            saved ? 'text-amber-500' : 'text-txt-secondary dark:text-txt-secondary-dark opacity-0 group-hover:opacity-100 hover:text-amber-500'
          )}
          title={saved ? 'Remove from saved' : 'Save place'}
        >
          <Bookmark size={15} className={saved ? 'fill-current' : ''} />
        </button>
      )}
    </div>
  )
}

function MyLocationRow({ onSelect }) {
  return (
    <button
      onMouseDown={onSelect}
      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-secondary dark:hover:bg-surface-dark-secondary transition-colors border-b border-border dark:border-border-dark"
    >
      <div className="flex-shrink-0 w-9 h-9 rounded-full bg-primary/10 dark:bg-primary-dark/10 flex items-center justify-center">
        <LocateFixed size={15} className="text-primary dark:text-primary-dark" />
      </div>
      <div className="min-w-0">
        <div className="text-sm font-medium text-txt-primary dark:text-txt-primary-dark">My location</div>
        <div className="text-xs text-txt-secondary dark:text-txt-secondary-dark">Use your current location</div>
      </div>
    </button>
  )
}

// ── Default export: standalone search bar (dropdown mode for mobile) ──────
export default function SearchBar({ onFocus: onFocusProp, panelMode = false } = {}) {
  const [query,   setQuery]   = useState('')
  const [results, setResults] = useState([])
  const [focused, setFocused] = useState(false)
  const [loading, setLoading] = useState(false)
  const inputRef    = useRef(null)
  const debounceRef = useRef(null)

  const setDestination  = useMapStore((s) => s.setDestination)
  const setSidebarMode  = useMapStore((s) => s.setSidebarMode)
  const setOrigin       = useMapStore((s) => s.setOrigin)
  const setUserLocation = useMapStore((s) => s.setUserLocation)
  const flyTo           = useMapStore((s) => s.flyTo)
  const savePlace       = useMapStore((s) => s.savePlace)
  const unsavePlace     = useMapStore((s) => s.unsavePlace)
  const isSaved         = useMapStore((s) => s.isSaved)
  const showToast       = useMapStore((s) => s.showToast)
  const mapRef          = useMapStore((s) => s.mapRef)

  const recent = getRecent()

  const doSearch = useCallback(async (q) => {
    if (!q.trim()) { setResults([]); return }
    setLoading(true)
    try {
      const center = mapRef ? mapRef.getCenter() : null
      const bias   = center ? { lat: center.lat, lng: center.lng } : null
      const res = await searchPlaces(q, bias)
      setResults(res)
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [mapRef])

  useEffect(() => {
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => doSearch(query), 300)
    return () => clearTimeout(debounceRef.current)
  }, [query])

  const selectPlace = (place) => {
    saveRecent(place)
    setDestination(place)
    setSidebarMode('directions')
    const { userLocation } = useMapStore.getState()
    setOrigin(userLocation ? { name: 'My location', ...userLocation } : null)
    flyTo([place.lng, place.lat])
    setQuery('')
    setFocused(false)
  }

  const selectMyLocation = () => {
    setQuery('')
    setFocused(false)
    const { userLocation, destination } = useMapStore.getState()
    const use = (loc) => {
      setUserLocation(loc)
      setOrigin({ name: 'My location', ...loc })
      setSidebarMode('directions')
      // Only flyTo if no destination — fitBounds will handle it when both endpoints are set
      if (!destination) flyTo([loc.lng, loc.lat], 15)
    }
    if (userLocation) { use(userLocation); return }
    navigator.geolocation?.getCurrentPosition(
      (pos) => use({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {},
      { timeout: 10000, maximumAge: 60000 }
    )
  }

  const toggleSave = (place) => {
    if (isSaved(place.name)) {
      unsavePlace(place.name)
      showToast('Removed from saved places')
    } else {
      savePlace(place)
      showToast('Place saved')
    }
  }

  const clear = () => { setQuery(''); setResults([]); inputRef.current?.focus() }

  const items    = query.length === 0 ? recent : results
  const isRecent = query.length === 0

  // ── Panel mode (inline results, used inside floating desktop panel) ──────
  if (panelMode) {
    const showResults = focused

    return (
      <div>
        {/* Input row */}
        <div className={clsx(
          'flex items-center gap-2 px-2 py-2',
          showResults && 'border-b border-border dark:border-border-dark'
        )}>
          <button className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-surface-secondary dark:hover:bg-surface-dark-secondary transition-colors flex-shrink-0">
            <Menu size={18} className="text-txt-secondary dark:text-txt-secondary-dark" />
          </button>
          <Search size={16} className={clsx(
            'flex-shrink-0 transition-colors',
            focused ? 'text-primary dark:text-primary-dark' : 'text-txt-secondary dark:text-txt-secondary-dark'
          )} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => { setFocused(true); onFocusProp?.() }}
            onBlur={() => setTimeout(() => setFocused(false), 150)}
            placeholder="Search Quarc Maps"
            className="flex-1 bg-transparent outline-none text-sm text-txt-primary dark:text-txt-primary-dark placeholder-txt-secondary dark:placeholder-txt-secondary-dark"
          />
          {query && (
            <button onClick={clear} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-surface-secondary dark:hover:bg-surface-dark-secondary text-txt-secondary dark:text-txt-secondary-dark transition-colors flex-shrink-0">
              <X size={15} />
            </button>
          )}
          {loading && (
            <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin flex-shrink-0" />
          )}
        </div>

        {/* Inline results */}
        {showResults && (
          <div>
            <MyLocationRow onSelect={selectMyLocation} />
            {isRecent && items.length > 0 && (
              <div className="px-4 pt-3 pb-1 text-[10px] font-semibold text-txt-secondary dark:text-txt-secondary-dark uppercase tracking-widest">
                Recent
              </div>
            )}
            {items.map((place, i) => (
              <ResultRow
                key={i}
                place={place}
                isRecent={isRecent}
                onSelect={selectPlace}
                onToggleSave={!isRecent ? toggleSave : null}
                saved={isSaved(place.name)}
              />
            ))}
            {query.length > 0 && results.length === 0 && !loading && (
              <div className="px-4 py-6 text-sm text-center text-txt-secondary dark:text-txt-secondary-dark">
                No results for &ldquo;{query}&rdquo;
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  // ── Dropdown mode (floating pill, used in FloatingSearchBar on mobile) ───
  return (
    <div className="relative">
      <div className={clsx(
        'flex items-center gap-2.5 px-4 py-3 rounded-full border transition-all',
        focused
          ? 'border-primary dark:border-primary-dark shadow-float dark:shadow-float-dark'
          : 'border-border dark:border-border-dark shadow-google dark:shadow-google-dark',
        'bg-surface dark:bg-surface-dark'
      )}>
        <Search size={17} className={clsx(
          'flex-shrink-0 transition-colors',
          focused ? 'text-primary dark:text-primary-dark' : 'text-txt-secondary dark:text-txt-secondary-dark'
        )} />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => { setFocused(true); onFocusProp?.() }}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          placeholder="Search here"
          className="flex-1 bg-transparent outline-none text-sm text-txt-primary dark:text-txt-primary-dark placeholder-txt-secondary dark:placeholder-txt-secondary-dark"
        />
        {query && (
          <button onClick={clear} className="text-txt-secondary dark:text-txt-secondary-dark hover:text-txt-primary transition-colors">
            <X size={15} />
          </button>
        )}
        {loading && (
          <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin flex-shrink-0" />
        )}
      </div>

      {focused && (
        <div className="absolute top-full left-0 right-0 mt-1.5 bg-surface dark:bg-surface-dark border border-border dark:border-border-dark rounded-2xl shadow-google dark:shadow-google-dark z-50 overflow-hidden animate-slide-up">
          <MyLocationRow onSelect={selectMyLocation} />
          {isRecent && items.length > 0 && (
            <div className="px-4 pt-2.5 pb-1 text-[10px] font-semibold text-txt-secondary dark:text-txt-secondary-dark uppercase tracking-widest">
              Recent
            </div>
          )}
          {items.map((place, i) => (
            <ResultRow
              key={i}
              place={place}
              isRecent={isRecent}
              onSelect={selectPlace}
              onToggleSave={!isRecent ? toggleSave : null}
              saved={isSaved(place.name)}
            />
          ))}
          {query.length > 0 && results.length === 0 && !loading && (
            <div className="px-4 py-6 text-sm text-center text-txt-secondary dark:text-txt-secondary-dark">
              No results for &ldquo;{query}&rdquo;
            </div>
          )}
        </div>
      )}
    </div>
  )
}
