import { X } from 'lucide-react'
import SearchBar from './SearchBar'
import CategoryChips from './CategoryChips'
import ThemeToggle from './ThemeToggle'
import { useMapStore } from '../store/mapStore'

export default function FloatingSearchBar({ onSearchFocus }) {
  const destination = useMapStore((s) => s.destination)
  const origin      = useMapStore((s) => s.origin)
  const poiResults  = useMapStore((s) => s.poiResults)
  const clearAll    = useMapStore((s) => s.clearAll)

  const hasActive = !!(destination || origin || poiResults.length > 0)

  return (
    <div
      className="absolute left-3 right-3 z-20 flex flex-col gap-2"
      style={{
        pointerEvents: 'none',
        top: 'max(12px, calc(env(safe-area-inset-top, 44px) + 8px))',
      }}
    >
      {/* Search pill row */}
      <div
        className="flex items-center gap-1 bg-surface dark:bg-surface-dark rounded-full px-1"
        style={{
          boxShadow: '0 1px 2px rgba(60,64,67,0.3), 0 2px 6px rgba(60,64,67,0.15)',
          pointerEvents: 'auto',
        }}
      >
        <div className="flex-1 min-w-0">
          <SearchBar onFocus={onSearchFocus} />
        </div>

        {/* Clear-all X — only when something is active */}
        {hasActive && (
          <button
            onClick={clearAll}
            title="Clear"
            className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-full text-txt-secondary dark:text-txt-secondary-dark hover:text-txt-primary dark:hover:text-txt-primary-dark hover:bg-surface-secondary dark:hover:bg-surface-dark-secondary transition-colors"
          >
            <X size={17} />
          </button>
        )}

        <ThemeToggle />
      </div>

      {/* Category chips */}
      <div style={{ pointerEvents: 'auto' }}>
        <CategoryChips />
      </div>
    </div>
  )
}
