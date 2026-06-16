import { Navigation2, Route, MapPin, X } from 'lucide-react'
import { useMapStore } from '../store/mapStore'
import CategoryChips from './CategoryChips'

export default function QuickActionsMobile({ snapTo }) {
  const setOrigin       = useMapStore((s) => s.setOrigin)
  const setSidebarMode  = useMapStore((s) => s.setSidebarMode)
  const userLocation    = useMapStore((s) => s.userLocation)
  const setUserLoc      = useMapStore((s) => s.setUserLocation)
  const poiResults      = useMapStore((s) => s.poiResults)
  const poiCategory     = useMapStore((s) => s.poiCategory)
  const clearPoiResults = useMapStore((s) => s.clearPoiResults)
  const setSelectedPOI  = useMapStore((s) => s.setSelectedPOI)
  const flyTo           = useMapStore((s) => s.flyTo)

  const startFromHere = () => {
    const use = (loc) => {
      setUserLoc(loc)
      setOrigin({ name: 'My location', ...loc })
      setSidebarMode('directions')
      snapTo?.('half')
    }
    if (userLocation) { use(userLocation); return }
    navigator.geolocation?.getCurrentPosition(
      (pos) => use({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {},
      { timeout: 10000, maximumAge: 60000 }
    )
  }

  // Same behaviour as tapping an orange dot on the map — show PlaceCard first
  const goToPOI = (place) => {
    setSelectedPOI(place)
    flyTo([place.lng, place.lat], 15)
    snapTo?.('half')
  }

  // When POI results are available, show them instead of quick actions
  if (poiResults.length > 0) {
    return (
      <div className="space-y-1">
        <div className="flex items-center justify-between px-1 pb-1">
          <p className="text-[10px] font-semibold text-txt-secondary dark:text-txt-secondary-dark uppercase tracking-widest">
            {poiCategory} nearby
          </p>
          <button
            onClick={clearPoiResults}
            className="w-6 h-6 flex items-center justify-center rounded-full text-txt-secondary dark:text-txt-secondary-dark hover:bg-surface-secondary dark:hover:bg-surface-dark-secondary"
          >
            <X size={13} />
          </button>
        </div>
        {poiResults.map((place, i) => (
          <button
            key={i}
            onClick={() => goToPOI(place)}
            className="w-full flex items-center gap-3 px-3 py-3 rounded-2xl hover:bg-surface-secondary dark:hover:bg-surface-dark-secondary active:opacity-70 transition-all text-left"
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

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <ActionBtn
          icon={<Navigation2 size={17} className="text-primary dark:text-primary-dark" />}
          title="Directions from here"
          sub="Use your current location as start"
          onClick={startFromHere}
        />
        <ActionBtn
          icon={<Route size={17} className="text-primary dark:text-primary-dark" />}
          title="Plan a trip"
          sub="Car, bike, walk, or transit"
          onClick={() => { setSidebarMode('directions'); snapTo?.('half') }}
        />
      </div>

      <div>
        <p className="text-[10px] font-semibold text-txt-secondary dark:text-txt-secondary-dark uppercase tracking-widest mb-2 px-1">
          Nearby
        </p>
        <CategoryChips />
      </div>
    </div>
  )
}

function ActionBtn({ icon, title, sub, onClick }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-3 py-3 rounded-2xl hover:bg-surface-secondary dark:hover:bg-surface-dark-secondary active:opacity-70 transition-all text-left"
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
