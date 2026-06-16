import { useState } from 'react'
import { Search } from 'lucide-react'
import { useMapStore } from '../store/mapStore'

const API = import.meta.env.VITE_API_URL ?? '/api'

export default function SearchHereButton() {
  const [busy, setBusy] = useState(false)

  const showSearchHere  = useMapStore((s) => s.showSearchHere)
  const poiCategory     = useMapStore((s) => s.poiCategory)
  const poiCategoryKey  = useMapStore((s) => s.poiCategoryKey)
  const mapRef          = useMapStore((s) => s.mapRef)
  const setPoiResults   = useMapStore((s) => s.setPoiResults)
  const setShowSearchHere = useMapStore((s) => s.setShowSearchHere)
  const showToast       = useMapStore((s) => s.showToast)

  if (!showSearchHere || !poiCategoryKey) return null

  const doSearch = async () => {
    const center = mapRef?.getCenter()
    if (!center) return
    setBusy(true)
    setShowSearchHere(false)
    try {
      const res = await fetch(
        `${API}/nearby?category=${poiCategoryKey}&lat=${center.lat.toFixed(6)}&lng=${center.lng.toFixed(6)}&radius=2000`
      )
      const results = await res.json()
      setPoiResults(results, poiCategory, poiCategoryKey)
      if (results.length === 0) showToast('No results in this area')
    } catch {
      showToast('Search failed')
      setShowSearchHere(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    // Centre horizontally; sit below the top UI bars
    <div className="absolute left-1/2 -translate-x-1/2 z-20 pointer-events-none"
      style={{ top: 'max(100px, calc(env(safe-area-inset-top, 44px) + 90px))' }}
    >
      <button
        onClick={doSearch}
        disabled={busy}
        className={[
          'pointer-events-auto flex items-center gap-2 px-4 py-2 rounded-full',
          'bg-surface dark:bg-surface-dark',
          'border border-border dark:border-border-dark',
          'text-sm font-medium text-txt-primary dark:text-txt-primary-dark',
          'shadow-google dark:shadow-google-dark',
          'hover:shadow-float transition-all active:scale-95',
          busy ? 'opacity-70' : '',
        ].join(' ')}
      >
        {busy
          ? <span className="w-3.5 h-3.5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          : <Search size={13} className="text-primary dark:text-primary-dark" />
        }
        Search this area
      </button>
    </div>
  )
}
