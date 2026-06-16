import { Map, Globe, Mountain, Snowflake, Check } from 'lucide-react'
import { useMapStore } from '../store/mapStore'
import clsx from 'clsx'

const STYLES = [
  { id: 'streets',   label: 'Streets',   Icon: Map,       desc: 'Default city map' },
  { id: 'satellite', label: 'Satellite', Icon: Globe,     desc: 'Aerial / hybrid' },
  { id: 'outdoor',   label: 'Outdoor',   Icon: Mountain,  desc: 'Topo & trails' },
  { id: 'winter',    label: 'Winter',    Icon: Snowflake, desc: 'Snow & ski' },
]

export default function LayerPicker({ onClose }) {
  const mapType    = useMapStore((s) => s.mapType)
  const setMapType = useMapStore((s) => s.setMapType)

  const pick = (id) => {
    setMapType(id)
    onClose()
  }

  return (
    <div className="absolute right-14 bottom-0 w-52 bg-surface dark:bg-surface-dark-secondary border border-border dark:border-border-dark rounded-2xl shadow-float dark:shadow-float-dark overflow-hidden z-20 animate-slide-up">
      <div className="px-4 py-2.5 border-b border-border dark:border-border-dark">
        <p className="text-[10px] font-semibold text-txt-secondary dark:text-txt-secondary-dark uppercase tracking-widest">
          Map Style
        </p>
      </div>
      {STYLES.map(({ id, label, Icon, desc }) => (
        <button
          key={id}
          onClick={() => pick(id)}
          className={clsx(
            'w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors',
            mapType === id
              ? 'bg-primary/10 dark:bg-primary-dark/10'
              : 'hover:bg-surface-secondary dark:hover:bg-surface-dark-tertiary'
          )}
        >
          <div className={clsx(
            'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
            mapType === id
              ? 'bg-primary dark:bg-primary-dark text-white'
              : 'bg-surface-tertiary dark:bg-surface-dark-tertiary text-txt-secondary dark:text-txt-secondary-dark'
          )}>
            <Icon size={15} />
          </div>
          <div className="flex-1 min-w-0">
            <div className={clsx(
              'text-sm font-medium',
              mapType === id ? 'text-primary dark:text-primary-dark' : 'text-txt-primary dark:text-txt-primary-dark'
            )}>
              {label}
            </div>
            <div className="text-[11px] text-txt-secondary dark:text-txt-secondary-dark">{desc}</div>
          </div>
          {mapType === id && <Check size={13} className="text-primary dark:text-primary-dark flex-shrink-0" />}
        </button>
      ))}
    </div>
  )
}
