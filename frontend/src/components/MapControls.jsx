import { useState } from 'react'
import { Plus, Minus, Layers, LocateFixed, Compass } from 'lucide-react'
import { useMapStore } from '../store/mapStore'
import { requestCompassPermission } from '../utils/compass'
import LayerPicker from './LayerPicker'
import clsx from 'clsx'

export default function MapControls() {
  const [layerPickerOpen, setLayerPickerOpen] = useState(false)

  const mapRef       = useMapStore((s) => s.mapRef)
  const mapType      = useMapStore((s) => s.mapType)
  const setUserLoc   = useMapStore((s) => s.setUserLocation)
  const setFollowUs  = useMapStore((s) => s.setFollowUser)
  const followUser   = useMapStore((s) => s.followUser)
  const headingMode  = useMapStore((s) => s.headingMode)
  const setHeadingMode = useMapStore((s) => s.setHeadingMode)
  const userHeading  = useMapStore((s) => s.userHeading)

  const zoom = (delta) => {
    if (!mapRef) return
    mapRef.zoomTo(mapRef.getZoom() + delta, { duration: 200 })
  }

  const locateMe = () => {
    if (!navigator.geolocation) {
      alert('Location is not available in this browser.')
      return
    }
    if (!window.isSecureContext) {
      alert('Location requires HTTPS. Please install the certificate on this device.')
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        setUserLoc(loc)
        setFollowUs(true)
        // flyTo handled by the MapView followUser effect — don't call here to avoid conflict
      },
      (err) => {
        if (err.code === 1) alert('Location permission denied.')
        else if (err.code === 2) alert('Location unavailable. Make sure GPS is enabled.')
        else alert('Location request timed out. Please try again.')
      },
      { timeout: 15000, maximumAge: 60000, enableHighAccuracy: true }
    )

    // Start compass tracking — idempotent, only registers listener once
    requestCompassPermission()
  }

  const toggleHeadingMode = () => {
    const next = !headingMode
    setHeadingMode(next)
    if (!next) mapRef?.easeTo({ bearing: 0, pitch: 0, duration: 500 })
  }

  const btn = clsx(
    'w-10 h-10 flex items-center justify-center rounded-xl',
    'bg-surface dark:bg-surface-dark-secondary',
    'border border-border dark:border-border-dark',
    'shadow-control dark:shadow-control-dark',
    'text-txt-secondary dark:text-txt-secondary-dark',
    'hover:text-txt-primary dark:hover:text-txt-primary-dark',
    'hover:bg-surface-secondary dark:hover:bg-surface-dark-tertiary',
    'transition-colors'
  )

  const btnActive = clsx(btn, 'border-primary dark:border-primary-dark text-primary dark:text-primary-dark bg-primary/5 dark:bg-primary-dark/10')

  return (
    <div className="absolute right-4 bottom-36 md:bottom-8 flex flex-col gap-2 z-10">
      {/* Layers button + picker */}
      <div className="relative">
        <button
          onClick={() => setLayerPickerOpen((o) => !o)}
          title="Map style"
          className={clsx(layerPickerOpen ? btnActive : btn)}
        >
          <Layers size={16} />
        </button>
        {layerPickerOpen && (
          <LayerPicker onClose={() => setLayerPickerOpen(false)} />
        )}
      </div>

      {/* Compass / heading */}
      <button
        onClick={toggleHeadingMode}
        title={headingMode ? 'Switch to North up' : 'Switch to Heading up'}
        className={clsx(headingMode && userHeading != null ? btnActive : btn)}
      >
        <Compass
          size={16}
          style={headingMode && userHeading != null
            ? { transform: `rotate(${-userHeading}deg)`, transition: 'transform 200ms' }
            : undefined
          }
        />
      </button>

      {/* Zoom (desktop only) */}
      <button onClick={() => zoom(1)}  title="Zoom in"  className={clsx(btn, 'hidden md:flex')}><Plus  size={18} /></button>
      <button onClick={() => zoom(-1)} title="Zoom out" className={clsx(btn, 'hidden md:flex')}><Minus size={18} /></button>

      {/* My location */}
      <button
        onClick={locateMe}
        title="My location"
        className={clsx(followUser ? btnActive : btn)}
      >
        <LocateFixed size={16} />
      </button>
    </div>
  )
}
