import { Bus, Train, Ship, Footprints, Clock, ArrowRight, Zap } from 'lucide-react'
import { useMapStore } from '../store/mapStore'
import { formatDuration } from '../utils/polyline'
import clsx from 'clsx'

const MODE_ICON = {
  BUS:      Bus,
  SUBWAY:   Train,
  TRAM:     Train,
  RAIL:     Train,
  FERRY:    Ship,
  CABLE_CAR: Train,
  WALK:     Footprints,
  DEFAULT:  Bus,
}

function LegBadge({ leg }) {
  const Icon = MODE_ICON[leg.mode] ?? MODE_ICON.DEFAULT
  const color = leg.routeColor ? `#${leg.routeColor}` : null
  const textColor = leg.routeTextColor ? `#${leg.routeTextColor}` : '#fff'

  if (leg.mode === 'WALK') {
    return (
      <div className="flex items-center gap-1 text-xs text-txt-secondary dark:text-txt-secondary-dark">
        <Footprints size={12} />
        <span>{Math.round((leg.duration ?? 0) / 60)} min</span>
      </div>
    )
  }

  return (
    <div
      className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold"
      style={color ? { backgroundColor: color, color: textColor } : undefined}
      // fallback colors when no route color
    >
      <Icon size={11} />
      {leg.route?.shortName && <span>{leg.route.shortName}</span>}
    </div>
  )
}

function ItineraryCard({ itinerary, index, selected, onSelect }) {
  const start = new Date(itinerary.startTime)
  const end   = new Date(itinerary.endTime)
  const fmt   = (d) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  const transfers = itinerary.legs.filter((l) => l.mode !== 'WALK').length - 1
  const hasRealtime = itinerary.legs.some((l) => l.realTime)

  return (
    <button
      onClick={() => onSelect(index)}
      className={clsx(
        'w-full px-4 py-4 text-left border-b border-border dark:border-border-dark transition-colors',
        selected
          ? 'bg-primary/5 dark:bg-primary-dark/5'
          : 'hover:bg-surface-secondary dark:hover:bg-surface-dark-secondary'
      )}
    >
      {/* Time row */}
      <div className="flex items-baseline justify-between mb-2">
        <div className="text-lg font-bold text-txt-primary dark:text-txt-primary-dark">
          {formatDuration(itinerary.duration)}
        </div>
        <div className="text-sm text-txt-secondary dark:text-txt-secondary-dark">
          {fmt(start)} → {fmt(end)}
        </div>
      </div>

      {/* Legs */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {itinerary.legs.map((leg, i) => (
          <div key={i} className="flex items-center gap-1">
            <LegBadge leg={leg} />
            {i < itinerary.legs.length - 1 && (
              <ArrowRight size={10} className="text-txt-secondary dark:text-txt-secondary-dark" />
            )}
          </div>
        ))}
      </div>

      {/* Meta */}
      <div className="flex items-center gap-3 mt-2 text-xs text-txt-secondary dark:text-txt-secondary-dark">
        {transfers > 0 && <span>{transfers} transfer{transfers > 1 ? 's' : ''}</span>}
        {hasRealtime && (
          <span className="flex items-center gap-0.5 text-green-600 dark:text-green-400">
            <Zap size={10} /> Live
          </span>
        )}
        <span className="flex items-center gap-0.5">
          <Clock size={10} />
          {Math.round(itinerary.walkTime / 60)} min walking
        </span>
      </div>
    </button>
  )
}

function LegDetail({ leg }) {
  const Icon  = MODE_ICON[leg.mode] ?? MODE_ICON.DEFAULT
  const color = leg.routeColor ? `#${leg.routeColor}` : undefined
  const fmt   = (ms) => new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  return (
    <div className="px-4 py-3 border-b border-border dark:border-border-dark">
      <div className="flex items-start gap-3">
        <div
          className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center mt-0.5"
          style={color ? { backgroundColor: color } : undefined}
        >
          <Icon size={13} className={color ? 'text-white' : 'text-txt-secondary dark:text-txt-secondary-dark'} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-txt-primary dark:text-txt-primary-dark">
            {leg.mode === 'WALK' ? `Walk to ${leg.to?.name}` : `${leg.route?.shortName ?? leg.mode} → ${leg.to?.name}`}
          </div>
          {leg.mode !== 'WALK' && leg.route?.longName && (
            <div className="text-xs text-txt-secondary dark:text-txt-secondary-dark">{leg.route.longName}</div>
          )}
          <div className="text-xs text-txt-secondary dark:text-txt-secondary-dark mt-0.5">
            {fmt(leg.startTime)} · {Math.round(leg.duration / 60)} min
            {leg.realTime && leg.departureDelay != null && leg.departureDelay !== 0 && (
              <span className={clsx('ml-1', leg.departureDelay > 0 ? 'text-red-500' : 'text-green-500')}>
                {leg.departureDelay > 0 ? `+${Math.round(leg.departureDelay / 60)}` : Math.round(leg.departureDelay / 60)} min
              </span>
            )}
          </div>
        </div>
      </div>
      {leg.intermediateStops?.length > 0 && (
        <div className="ml-10 mt-1 text-xs text-txt-secondary dark:text-txt-secondary-dark">
          {leg.intermediateStops.length} stop{leg.intermediateStops.length > 1 ? 's' : ''}
        </div>
      )}
    </div>
  )
}

export default function TransitPanel() {
  const itineraries       = useMapStore((s) => s.transitItineraries)
  const selectedItinerary = useMapStore((s) => s.selectedItinerary)
  const selectItinerary   = useMapStore((s) => s.selectItinerary)

  if (!itineraries.length) return null

  const selected = itineraries[selectedItinerary]

  return (
    <div>
      {/* Itinerary options */}
      {itineraries.map((itin, i) => (
        <ItineraryCard
          key={i}
          itinerary={itin}
          index={i}
          selected={i === selectedItinerary}
          onSelect={selectItinerary}
        />
      ))}

      {/* Detailed legs of selected */}
      {selected && (
        <div className="mt-2 border-t-4 border-border dark:border-border-dark">
          <div className="px-4 py-2 text-xs font-semibold text-txt-secondary dark:text-txt-secondary-dark uppercase tracking-wide">
            Step by step
          </div>
          {selected.legs.map((leg, i) => (
            <LegDetail key={i} leg={leg} />
          ))}
        </div>
      )}
    </div>
  )
}
