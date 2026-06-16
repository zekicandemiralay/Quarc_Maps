import { useEffect, useRef } from 'react'
import { Navigation, MapPin, Copy } from 'lucide-react'
import { useMapStore } from '../store/mapStore'
import { reverseGeocode } from '../services/geocoding'

export default function ContextMenu() {
  const menu        = useMapStore((s) => s.contextMenu)
  const setMenu     = useMapStore((s) => s.setContextMenu)
  const setOrigin   = useMapStore((s) => s.setOrigin)
  const setDest     = useMapStore((s) => s.setDestination)
  const setSidebar  = useMapStore((s) => s.setSidebarMode)
  const ref         = useRef(null)

  useEffect(() => {
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setMenu(null) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  if (!menu) return null

  const coord = { lat: menu.lat, lng: menu.lng }

  const getNameAndDo = async (fn) => {
    setMenu(null)
    try {
      const place = await reverseGeocode(menu.lat, menu.lng)
      fn(place ?? { name: `${menu.lat.toFixed(5)}, ${menu.lng.toFixed(5)}`, ...coord })
    } catch {
      fn({ name: `${menu.lat.toFixed(5)}, ${menu.lng.toFixed(5)}`, ...coord })
    }
  }

  const dirFrom = () => getNameAndDo((p) => { setOrigin(p); setSidebar('directions') })
  const dirTo   = () => getNameAndDo((p) => { setDest(p);   setSidebar('directions') })
  const copy    = () => { navigator.clipboard?.writeText(`${menu.lat.toFixed(6)}, ${menu.lng.toFixed(6)}`); setMenu(null) }

  const style = {
    position: 'fixed',
    left: Math.min(menu.x, window.innerWidth - 200),
    top:  Math.min(menu.y, window.innerHeight - 130),
  }

  return (
    <div
      ref={ref}
      style={style}
      className="z-50 w-48 bg-surface dark:bg-surface-dark-secondary border border-border dark:border-border-dark rounded-2xl shadow-float overflow-hidden"
    >
      <div className="px-4 py-2 text-xs text-txt-secondary dark:text-txt-secondary-dark border-b border-border dark:border-border-dark truncate">
        {menu.lat.toFixed(5)}, {menu.lng.toFixed(5)}
      </div>
      {[
        { Icon: Navigation, label: 'Directions from here', action: dirFrom },
        { Icon: MapPin,     label: 'Directions to here',   action: dirTo },
        { Icon: Copy,       label: 'Copy coordinates',     action: copy },
      ].map(({ Icon, label, action }) => (
        <button
          key={label}
          onClick={action}
          className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-txt-primary dark:text-txt-primary-dark hover:bg-surface-secondary dark:hover:bg-surface-dark transition-colors"
        >
          <Icon size={14} className="text-txt-secondary dark:text-txt-secondary-dark" />
          {label}
        </button>
      ))}
    </div>
  )
}
