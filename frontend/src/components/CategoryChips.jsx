import { useState } from 'react'
import { UtensilsCrossed, Coffee, Hotel, Fuel, CreditCard, ShoppingBag, Building2, ParkingCircle } from 'lucide-react'
import { useMapStore } from '../store/mapStore'
import clsx from 'clsx'

const API = import.meta.env.VITE_API_URL ?? '/api'

const CHIPS = [
  { label: 'Restaurants', icon: UtensilsCrossed, key: 'restaurant' },
  { label: 'Cafes',       icon: Coffee,          key: 'cafe'       },
  { label: 'Hotels',      icon: Hotel,           key: 'hotel'      },
  { label: 'Gas',         icon: Fuel,            key: 'gas'        },
  { label: 'ATM',         icon: CreditCard,      key: 'atm'        },
  { label: 'Shopping',    icon: ShoppingBag,     key: 'shopping'   },
  { label: 'Hospital',    icon: Building2,       key: 'hospital'   },
  { label: 'Parking',     icon: ParkingCircle,   key: 'parking'    },
]

export default function CategoryChips({ className = '' }) {
  const [loading, setLoading] = useState(null)

  const mapRef         = useMapStore((s) => s.mapRef)
  const poiCategory    = useMapStore((s) => s.poiCategory)
  const setPoiResults  = useMapStore((s) => s.setPoiResults)
  const clearPoiResults = useMapStore((s) => s.clearPoiResults)
  const showToast      = useMapStore((s) => s.showToast)

  const handleChip = async (chip) => {
    // Toggle off if already active
    if (poiCategory === chip.label) {
      clearPoiResults()
      return
    }

    const center = mapRef ? mapRef.getCenter() : null
    if (!center) { showToast('Move the map to your area first'); return }

    setLoading(chip.key)
    try {
      const res = await fetch(
        `${API}/nearby?category=${chip.key}&lat=${center.lat.toFixed(6)}&lng=${center.lng.toFixed(6)}&radius=2000`
      )
      if (!res.ok) throw new Error('Failed')
      const results = await res.json()
      if (results.length === 0) {
        showToast(`No ${chip.label.toLowerCase()} found nearby`)
        clearPoiResults()
      } else {
        setPoiResults(results, chip.label, chip.key)
        showToast(`${results.length} ${chip.label.toLowerCase()} nearby`)
      }
    } catch {
      showToast('Search failed, try again')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className={clsx('flex gap-2 overflow-x-auto scrollbar-none py-0.5 px-1', className)}>
      {CHIPS.map((chip) => {
        const Icon    = chip.icon
        const active  = poiCategory === chip.label
        const spinner = loading === chip.key

        return (
          <button
            key={chip.label}
            onClick={() => handleChip(chip)}
            disabled={!!loading}
            className={clsx(
              'flex items-center gap-1.5 flex-shrink-0',
              'px-3 py-1.5 rounded-full text-xs font-medium',
              'border transition-all active:scale-95',
              active
                ? 'bg-primary dark:bg-primary-dark text-white border-primary dark:border-primary-dark shadow-sm'
                : 'bg-surface dark:bg-surface-dark-secondary border-border dark:border-border-dark text-txt-primary dark:text-txt-primary-dark shadow-card dark:shadow-card-dark hover:shadow-google hover:bg-surface-secondary dark:hover:bg-surface-dark-tertiary'
            )}
          >
            {spinner
              ? <span className="w-3 h-3 border-2 border-current/30 border-t-current rounded-full animate-spin" />
              : <Icon size={13} className={active ? 'text-white' : 'text-primary dark:text-primary-dark'} />
            }
            {chip.label}
          </button>
        )
      })}
    </div>
  )
}
