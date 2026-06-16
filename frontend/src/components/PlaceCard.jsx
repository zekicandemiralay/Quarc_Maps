import { X, Navigation, Globe, Phone, Clock, Star, UtensilsCrossed, Bookmark } from 'lucide-react'
import { useMapStore } from '../store/mapStore'
import clsx from 'clsx'

export default function PlaceCard() {
  const poi             = useMapStore((s) => s.selectedPOI)
  const clearPOI        = useMapStore((s) => s.clearSelectedPOI)
  const setDestination  = useMapStore((s) => s.setDestination)
  const setOrigin       = useMapStore((s) => s.setOrigin)
  const setSidebarMode  = useMapStore((s) => s.setSidebarMode)
  const clearPoiResults = useMapStore((s) => s.clearPoiResults)
  const userLocation    = useMapStore((s) => s.userLocation)
  const savePlace       = useMapStore((s) => s.savePlace)
  const unsavePlace     = useMapStore((s) => s.unsavePlace)
  const isSaved         = useMapStore((s) => s.isSaved)
  const showToast       = useMapStore((s) => s.showToast)

  if (!poi) return null

  const saved = isSaved(poi.name)

  const getDirections = () => {
    setDestination({ name: poi.name, lat: poi.lat, lng: poi.lng, subtitle: poi.subtitle })
    setOrigin(userLocation ? { name: 'My location', ...userLocation } : null)
    setSidebarMode('directions')
    clearPoiResults()
    clearPOI()
  }

  const toggleSave = () => {
    if (saved) { unsavePlace(poi.name); showToast('Removed from saved places') }
    else        { savePlace({ name: poi.name, lat: poi.lat, lng: poi.lng, subtitle: poi.subtitle }); showToast('Place saved') }
  }

  const hours    = poi.opening_hours
    ? poi.opening_hours.replace(/;/g, ' · ').slice(0, 80) + (poi.opening_hours.length > 80 ? '…' : '')
    : null
  const starsNum = poi.stars ? Math.min(5, parseInt(poi.stars)) : 0
  const hasDetails = !!(poi.subtitle || hours || poi.phone || poi.website)

  return (
    // Plain div — no flex/h-full trickery.
    // Parent scroll container (Sidebar or BottomSheet) handles overflow.
    // DOM order guarantees: name → buttons → details (scroll down for more).
    <div>

      {/* ── Name row ──────────────────────────────────────────────────── */}
      <div className="flex items-start gap-2 px-4 pt-4 pb-2">
        <div className="flex-1 min-w-0">
          <h2 className="text-[17px] font-bold text-txt-primary dark:text-txt-primary-dark leading-tight">
            {poi.name}
          </h2>
          {starsNum > 0 && (
            <div className="flex items-center gap-0.5 mt-1">
              {Array.from({ length: starsNum }).map((_, i) => (
                <Star key={i} size={12} className="text-amber-400 fill-amber-400" />
              ))}
              <span className="text-xs text-txt-secondary dark:text-txt-secondary-dark ml-1">{starsNum}-star</span>
            </div>
          )}
          {poi.cuisine && (
            <div className="flex items-center gap-1.5 mt-1">
              <UtensilsCrossed size={11} className="text-txt-secondary dark:text-txt-secondary-dark" />
              <span className="text-xs text-txt-secondary dark:text-txt-secondary-dark capitalize">
                {poi.cuisine.replace(/_/g, ' ')}
              </span>
            </div>
          )}
        </div>
        <button
          onClick={clearPOI}
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-surface-secondary dark:hover:bg-surface-dark-secondary transition-colors flex-shrink-0 text-txt-secondary dark:text-txt-secondary-dark"
        >
          <X size={16} />
        </button>
      </div>

      {/* ── Buttons — second in DOM = first thing visible after the name ── */}
      <div className="px-4 pb-4 flex gap-2">
        <button
          onClick={getDirections}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-2xl bg-primary dark:bg-primary-dark text-white text-sm font-semibold hover:opacity-90 active:scale-[0.98] transition-all"
        >
          <Navigation size={15} />
          Directions
        </button>
        <button
          onClick={toggleSave}
          title={saved ? 'Remove from saved' : 'Save place'}
          className={clsx(
            'w-11 h-11 flex items-center justify-center rounded-2xl border transition-all',
            saved
              ? 'border-amber-400 bg-amber-50 dark:bg-amber-900/20 text-amber-500'
              : 'border-border dark:border-border-dark text-txt-secondary dark:text-txt-secondary-dark hover:border-amber-400 hover:text-amber-500'
          )}
        >
          <Bookmark size={16} className={saved ? 'fill-current' : ''} />
        </button>
      </div>

      {/* ── Details — below buttons, scroll down to see ───────────────── */}
      {hasDetails && (
        <div className="border-t border-border dark:border-border-dark px-4 py-3 space-y-3">
          {poi.subtitle && <InfoRow icon={<Navigation size={14} />}>{poi.subtitle}</InfoRow>}
          {hours        && <InfoRow icon={<Clock size={14} />}>{hours}</InfoRow>}
          {poi.phone    && (
            <InfoRow icon={<Phone size={14} />}>
              <a href={`tel:${poi.phone}`} className="text-primary dark:text-primary-dark hover:underline">
                {poi.phone}
              </a>
            </InfoRow>
          )}
          {poi.website  && (
            <InfoRow icon={<Globe size={14} />}>
              <a
                href={poi.website.startsWith('http') ? poi.website : `https://${poi.website}`}
                target="_blank" rel="noopener noreferrer"
                className="text-primary dark:text-primary-dark hover:underline truncate block"
              >
                {poi.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
              </a>
            </InfoRow>
          )}
        </div>
      )}

      {!hasDetails && (
        <div className="px-4 pb-4 border-t border-border dark:border-border-dark pt-3">
          <p className="text-xs text-txt-secondary dark:text-txt-secondary-dark italic">
            No additional info in OpenStreetMap for this place.
          </p>
        </div>
      )}
    </div>
  )
}

function InfoRow({ icon, children }) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex-shrink-0 mt-0.5 text-primary dark:text-primary-dark">{icon}</div>
      <span className="text-sm text-txt-primary dark:text-txt-primary-dark leading-snug flex-1 min-w-0">
        {children}
      </span>
    </div>
  )
}
