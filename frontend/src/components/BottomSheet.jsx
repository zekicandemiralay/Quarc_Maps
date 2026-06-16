import { useState, useRef, useCallback, useEffect } from 'react'
import { useMapStore } from '../store/mapStore'
import RoutePanel from './RoutePanel'
import PlaceCard from './PlaceCard'
import QuickActionsMobile from './QuickActionsMobile'

// Peek height: how many px are visible above the home indicator at default state
const PEEK_PX = 96

function getSafeAreaBottom() {
  try { return parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sab')) || 0 } catch { return 0 }
}

function getSnaps() {
  const vh     = window.innerHeight
  const sab    = getSafeAreaBottom()
  const sheetH = Math.round(vh * 0.92)
  return {
    peek: sheetH - PEEK_PX - sab,
    half: Math.round(sheetH - vh * 0.52),
    full: 0,
    sheetH,
  }
}

export default function BottomSheet() {
  const [snap,  setSnap]  = useState('peek')
  const [liveY, setLiveY] = useState(null)
  const isDragging       = useRef(false)
  const startClientY     = useRef(0)
  const startTranslate   = useRef(0)
  const startTime        = useRef(0)
  const dragZoneRef      = useRef(null)

  const sidebarMode        = useMapStore((s) => s.sidebarMode)
  const setSidebarMode     = useMapStore((s) => s.setSidebarMode)
  const clearRoute         = useMapStore((s) => s.clearRoute)
  const clearAll           = useMapStore((s) => s.clearAll)
  const route              = useMapStore((s) => s.route)
  const transitItineraries = useMapStore((s) => s.transitItineraries)
  const isLoading          = useMapStore((s) => s.isLoading)
  const error              = useMapStore((s) => s.error)
  const poiResults         = useMapStore((s) => s.poiResults)
  const selectedPOI        = useMapStore((s) => s.selectedPOI)
  const clearSelectedPOI   = useMapStore((s) => s.clearSelectedPOI)

  const snapTo = useCallback((name) => {
    setSnap(name)
    setLiveY(null)
    isDragging.current = false
  }, [])

  // Auto-expand when content arrives; collapse back to peek when all cleared
  useEffect(() => {
    if (isLoading || route || transitItineraries.length > 0 || error || poiResults.length > 0 || selectedPOI) {
      setSnap((s) => (s === 'peek' ? 'half' : s))
    } else if (!isLoading && !route && !error && poiResults.length === 0 && !selectedPOI && sidebarMode === 'search') {
      setSnap('peek')
    }
  }, [isLoading, route, transitItineraries.length, error, poiResults.length, selectedPOI, sidebarMode])

  useEffect(() => {
    if (sidebarMode === 'directions') setSnap((s) => (s === 'peek' ? 'half' : s))
  }, [sidebarMode])

  // Non-passive touchmove on drag zone
  useEffect(() => {
    const el = dragZoneRef.current
    if (!el) return
    const onMove = (e) => {
      if (!isDragging.current) return
      e.preventDefault()
      const snaps = getSnaps()
      const raw   = startTranslate.current + (e.touches[0].clientY - startClientY.current)
      setLiveY(Math.max(0, Math.min(snaps.peek + 60, raw)))
    }
    el.addEventListener('touchmove', onMove, { passive: false })
    return () => el.removeEventListener('touchmove', onMove)
  }, [])

  const onDragStart = useCallback((clientY) => {
    isDragging.current     = true
    startClientY.current   = clientY
    startTranslate.current = liveY ?? getSnaps()[snap]
    startTime.current      = Date.now()
  }, [liveY, snap])

  const onDragEnd = useCallback((clientY) => {
    if (!isDragging.current) return
    isDragging.current = false
    const snaps    = getSnaps()
    const deltaY   = clientY - startClientY.current
    const elapsed  = Math.max(1, Date.now() - startTime.current)
    const velocity = deltaY / elapsed
    const current  = startTranslate.current + deltaY
    const names    = ['full', 'half', 'peek']
    let nearest = 'peek', nearestDist = Infinity
    for (const name of names) {
      const d = Math.abs(snaps[name] - current)
      if (d < nearestDist) { nearest = name; nearestDist = d }
    }
    if (velocity > 0.4) {
      const idx = names.indexOf(nearest)
      if (idx < names.length - 1) nearest = names[idx + 1]
    } else if (velocity < -0.4) {
      const idx = names.indexOf(nearest)
      if (idx > 0) nearest = names[idx - 1]
    }
    snapTo(nearest)
  }, [snapTo])

  const onMouseDrag = useCallback((e) => {
    onDragStart(e.clientY)
    const onMove = (ev) => {
      if (!isDragging.current) return
      const snaps = getSnaps()
      const raw   = startTranslate.current + (ev.clientY - startClientY.current)
      setLiveY(Math.max(0, Math.min(snaps.peek + 60, raw)))
    }
    const onUp = (ev) => {
      onDragEnd(ev.clientY)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [onDragStart, onDragEnd])

  const snaps      = getSnaps()
  const translateY = liveY !== null ? liveY : snaps[snap]

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-30 flex flex-col bg-surface dark:bg-surface-dark rounded-t-3xl overflow-hidden"
      style={{
        height: snaps.sheetH,
        transform: `translateY(${translateY}px)`,
        transition: liveY !== null ? 'none' : 'transform 0.35s cubic-bezier(0.32, 0.72, 0, 1)',
        willChange: 'transform',
        boxShadow: '0 -2px 12px rgba(60,64,67,0.15), 0 -1px 3px rgba(60,64,67,0.1)',
      }}
    >
      {/* Safe area extension */}
      <div
        className="absolute inset-x-0 bg-surface dark:bg-surface-dark pointer-events-none"
        style={{
          top: 'auto',
          bottom: 'calc(-1 * env(safe-area-inset-bottom, 0px))',
          height: 'env(safe-area-inset-bottom, 0px)',
        }}
      />

      {/* Drag handle — tall so it's easy to grab anywhere on the peek strip */}
      <div
        ref={dragZoneRef}
        className="flex-shrink-0 flex flex-col items-center cursor-grab active:cursor-grabbing select-none"
        style={{ touchAction: 'none', paddingTop: '10px', paddingBottom: '18px' }}
        onTouchStart={(e) => onDragStart(e.touches[0].clientY)}
        onTouchEnd={(e)   => onDragEnd(e.changedTouches[0].clientY)}
        onMouseDown={onMouseDrag}
      >
        {/* Visual pill */}
        <div className="w-10 h-1 rounded-full bg-border dark:bg-border-dark mb-3" />
        {/* Label — gives extra tap surface and a hint */}
        <span className="text-[11px] font-semibold text-txt-secondary dark:text-txt-secondary-dark uppercase tracking-widest select-none">
          Quarc Maps
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto overscroll-contain">
        {selectedPOI ? (
          <PlaceCard />
        ) : sidebarMode === 'directions' ? (
          <div className="pb-safe">
            <RoutePanel onClose={() => { clearRoute(); setSidebarMode('search'); snapTo('peek') }} />
          </div>
        ) : (
          <div className="px-4 pb-safe pt-2 space-y-3">
            <QuickActionsMobile snapTo={snapTo} />
          </div>
        )}
      </div>
    </div>
  )
}
