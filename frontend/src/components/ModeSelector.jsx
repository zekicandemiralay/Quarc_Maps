import { Car, Bike, Footprints, Bus } from 'lucide-react'
import { useMapStore } from '../store/mapStore'
import clsx from 'clsx'

const MODES = [
  { id: 'driving',  label: 'Drive',    Icon: Car },
  { id: 'cycling',  label: 'Cycle',    Icon: Bike },
  { id: 'walking',  label: 'Walk',     Icon: Footprints },
  { id: 'transit',  label: 'Transit',  Icon: Bus },
]

export default function ModeSelector() {
  const mode    = useMapStore((s) => s.mode)
  const setMode = useMapStore((s) => s.setMode)

  return (
    <div className="flex gap-1 p-1 rounded-xl bg-surface-secondary dark:bg-surface-dark-secondary border border-border dark:border-border-dark">
      {MODES.map(({ id, label, Icon }) => (
        <button
          key={id}
          onClick={() => setMode(id)}
          className={clsx(
            'flex flex-col items-center gap-0.5 px-3 py-2 rounded-lg text-xs font-medium transition-all',
            mode === id
              ? 'bg-primary dark:bg-primary-dark text-white shadow-sm'
              : 'text-txt-secondary dark:text-txt-secondary-dark hover:bg-surface-tertiary dark:hover:bg-surface-dark-tertiary'
          )}
          title={label}
        >
          <Icon size={15} />
          <span>{label}</span>
        </button>
      ))}
    </div>
  )
}
