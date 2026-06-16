import {
  ArrowUp, ArrowLeft, ArrowRight, RefreshCw,
  MapPin, Navigation
} from 'lucide-react'

// ORS maneuver type → icon + label
const MANEUVER = {
  0:  { Icon: ArrowLeft,        label: 'Turn left' },
  1:  { Icon: ArrowRight,       label: 'Turn right' },
  2:  { Icon: ArrowLeft,        label: 'Sharp left' },
  3:  { Icon: ArrowRight,       label: 'Sharp right' },
  4:  { Icon: ArrowLeft,        label: 'Slight left' },
  5:  { Icon: ArrowRight,       label: 'Slight right' },
  6:  { Icon: ArrowUp,          label: 'Continue straight' },
  7:  { Icon: RefreshCw,  label: 'Enter roundabout' },
  8:  { Icon: RefreshCw,  label: 'Exit roundabout' },
  10: { Icon: MapPin,           label: 'Arrive' },
  11: { Icon: Navigation,       label: 'Depart' },
  12: { Icon: ArrowUp,          label: 'Keep straight' },
}

function formatDist(m) {
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`
}

export default function DirectionsList({ steps = [] }) {
  if (!steps.length) return null

  return (
    <div className="divide-y divide-border dark:divide-border-dark">
      {steps.map((step, i) => {
        const type = step.type ?? 6
        const { Icon, label } = MANEUVER[type] ?? MANEUVER[6]

        return (
          <div key={i} className="flex items-start gap-3 px-4 py-3 hover:bg-surface-secondary dark:hover:bg-surface-dark-secondary transition-colors">
            <div className="flex-shrink-0 w-8 h-8 rounded-xl bg-surface-secondary dark:bg-surface-dark-secondary flex items-center justify-center mt-0.5">
              <Icon size={14} className="text-txt-secondary dark:text-txt-secondary-dark" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm text-txt-primary dark:text-txt-primary-dark font-medium">
                {step.instruction || label}
              </div>
              {step.name && step.name !== '-' && (
                <div className="text-xs text-txt-secondary dark:text-txt-secondary-dark mt-0.5">{step.name}</div>
              )}
            </div>
            <div className="flex-shrink-0 text-xs text-txt-secondary dark:text-txt-secondary-dark mt-1">
              {formatDist(step.distance)}
            </div>
          </div>
        )
      })}
    </div>
  )
}
