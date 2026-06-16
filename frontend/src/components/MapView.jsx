import { useEffect, useRef, useCallback } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useMapStore } from '../store/mapStore'
import { decodePolyline } from '../utils/polyline'

const KEY = import.meta.env.VITE_MAPTILER_KEY || 'get-your-free-key-at-maptiler-com'

const STYLES = {
  streets: {
    dark:  `https://api.maptiler.com/maps/streets-v2-dark/style.json?key=${KEY}`,
    light: `https://api.maptiler.com/maps/streets-v2/style.json?key=${KEY}`,
  },
  satellite: {
    dark:  `https://api.maptiler.com/maps/hybrid/style.json?key=${KEY}`,
    light: `https://api.maptiler.com/maps/hybrid/style.json?key=${KEY}`,
  },
  outdoor: {
    dark:  `https://api.maptiler.com/maps/outdoor-v2/style.json?key=${KEY}`,
    light: `https://api.maptiler.com/maps/outdoor-v2/style.json?key=${KEY}`,
  },
  winter: {
    dark:  `https://api.maptiler.com/maps/winter-v2/style.json?key=${KEY}`,
    light: `https://api.maptiler.com/maps/winter-v2/style.json?key=${KEY}`,
  },
}

const MODE_COLOR = {
  driving:  '#1A73E8',
  cycling:  '#34A853',
  walking:  '#F9AB00',
  transit:  '#9C27B0',
}

function createEl(className) {
  const el = document.createElement('div')
  el.className = className
  return el
}

function createUserMarkerEl() {
  const wrapper = document.createElement('div')
  wrapper.className = 'marker-user-wrapper'
  const cone = document.createElement('div')
  cone.className = 'marker-user-cone'
  const dot = document.createElement('div')
  dot.className = 'marker-user'
  wrapper.appendChild(cone)
  wrapper.appendChild(dot)
  return wrapper
}

export default function MapView() {
  const containerRef = useRef(null)
  const mapRef       = useRef(null)
  const markers      = useRef({ origin: null, destination: null, user: null })

  const theme              = useMapStore((s) => s.theme)
  const mapType            = useMapStore((s) => s.mapType)
  const mode               = useMapStore((s) => s.mode)
  const origin             = useMapStore((s) => s.origin)
  const destination        = useMapStore((s) => s.destination)
  const route              = useMapStore((s) => s.route)
  const poiResults         = useMapStore((s) => s.poiResults)
  const routeAlternatives  = useMapStore((s) => s.routeAlternatives)
  const selectedAlternative = useMapStore((s) => s.selectedAlternative)
  const transitItineraries = useMapStore((s) => s.transitItineraries)
  const selectedItinerary  = useMapStore((s) => s.selectedItinerary)
  const userLocation       = useMapStore((s) => s.userLocation)
  const followUser         = useMapStore((s) => s.followUser)
  const userHeading        = useMapStore((s) => s.userHeading)
  const headingMode        = useMapStore((s) => s.headingMode)
  const center             = useMapStore((s) => s.center)
  const zoom               = useMapStore((s) => s.zoom)

  const setContextMenu = useMapStore((s) => s.setContextMenu)
  const setDestination = useMapStore((s) => s.setDestination)
  const setSidebarMode = useMapStore((s) => s.setSidebarMode)
  const setMapRef      = useMapStore((s) => s.setMapRef)

  const styleUrl = useCallback(
    () => (STYLES[mapType] ?? STYLES.streets)[theme] ?? STYLES.streets.dark,
    [theme, mapType]
  )

  const setupLayers = useCallback((map) => {
    // POI results (category chip search)
    if (!map.getSource('poi')) {
      map.addSource('poi', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
    }
    if (!map.getLayer('poi-circles')) {
      map.addLayer({
        id: 'poi-circles',
        type: 'circle',
        source: 'poi',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 5, 16, 10],
          'circle-color': '#FF7043',   // orange — distinct from blue user dot
          'circle-stroke-width': 2.5,
          'circle-stroke-color': '#ffffff',
          'circle-opacity': 0.95,
        },
      })
    }

    // Route alternatives (dimmed, behind main route)
    if (!map.getSource('route-alt')) {
      map.addSource('route-alt', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
    }
    if (!map.getLayer('route-alt-line')) {
      map.addLayer({
        id: 'route-alt-line',
        type: 'line',
        source: 'route-alt',
        paint: {
          'line-color': '#9CA3AF',
          'line-width': ['interpolate', ['linear'], ['zoom'], 10, 3, 16, 5],
          'line-opacity': 0.55,
        },
        layout: { 'line-cap': 'round', 'line-join': 'round' },
      })
    }

    // Main route
    if (!map.getSource('route')) {
      map.addSource('route', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
    }
    if (!map.getLayer('route-outline')) {
      map.addLayer({
        id: 'route-outline',
        type: 'line',
        source: 'route',
        paint: { 'line-color': '#fff', 'line-width': 9, 'line-opacity': 0.6 },
        layout: { 'line-cap': 'round', 'line-join': 'round' },
      })
    }
    if (!map.getLayer('route-line')) {
      map.addLayer({
        id: 'route-line',
        type: 'line',
        source: 'route',
        paint: {
          'line-color': ['coalesce', ['get', 'color'], '#3B82F6'],
          'line-width': ['interpolate', ['linear'], ['zoom'], 10, 3, 16, 7],
        },
        layout: { 'line-cap': 'round', 'line-join': 'round' },
      })
    }
  }, [])

  // ── Initialize map ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: styleUrl(),
      center,
      zoom,
      attributionControl: false,
    })

    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right')

    map.on('load',       () => setupLayers(map))
    map.on('style.load', () => setupLayers(map))

    map.on('contextmenu', (e) => {
      setContextMenu({ lng: e.lngLat.lng, lat: e.lngLat.lat, x: e.point.x, y: e.point.y })
    })

    map.on('click', (e) => {
      setContextMenu(null)

      // Check if a POI dot was clicked — show place card instead of going straight to directions
      const poiHits = map.queryRenderedFeatures(e.point, { layers: ['poi-circles'] })
      if (poiHits.length > 0) {
        const feat       = poiHits[0]
        const [lng, lat] = feat.geometry.coordinates.slice()
        const state      = useMapStore.getState()
        const match      = state.poiResults.find(
          (p) => Math.abs(p.lat - lat) < 0.0001 && Math.abs(p.lng - lng) < 0.0001
        ) ?? { name: feat.properties.name, lat, lng, subtitle: null }
        state.setSelectedPOI(match)
        state.flyTo([lng, lat], Math.max(mapRef.current.getZoom(), 15))
        return
      }

      const state = useMapStore.getState()
      if (state.sidebarMode === 'directions' && !state.destination) {
        setDestination({ name: `${e.lngLat.lat.toFixed(5)}, ${e.lngLat.lng.toFixed(5)}`, lat: e.lngLat.lat, lng: e.lngLat.lng })
      }
    })

    // Pointer cursor when hovering POI dots
    map.on('mousemove', (e) => {
      const hits = map.queryRenderedFeatures(e.point, { layers: ['poi-circles'] })
      map.getCanvas().style.cursor = hits.length > 0 ? 'pointer' : ''
    })

    // "Search this area" pill: show when map moves while a category is active
    map.on('moveend', () => {
      const { poiCategoryKey, setShowSearchHere } = useMapStore.getState()
      if (poiCategoryKey) setShowSearchHere(true)
    })

    mapRef.current = map
    setMapRef(map)

    return () => {
      map.remove()
      mapRef.current = null
      setMapRef(null)
    }
  }, []) // intentionally empty — map lives for component lifetime

  // ── Swap style on theme/mapType change ────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    map.setStyle(styleUrl())
  }, [theme, mapType])

  // ── Main route GeoJSON ────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const apply = () => {
      const src = map.getSource('route')
      if (!src) return

      if (mode === 'transit' && transitItineraries.length > 0) {
        const itin = transitItineraries[selectedItinerary]
        if (!itin) return
        const features = itin.legs.map((leg) => ({
          type: 'Feature',
          geometry: decodePolyline(leg.legGeometry?.points ?? ''),
          properties: {
            color: leg.routeColor ? `#${leg.routeColor}` : (leg.mode === 'WALK' ? '#9CA3AF' : MODE_COLOR.transit),
          },
        }))
        src.setData({ type: 'FeatureCollection', features })
        return
      }

      if (route) {
        const feature = route.features?.[0]
        if (!feature) return
        src.setData({
          type: 'FeatureCollection',
          features: [{ ...feature, properties: { ...feature.properties, color: MODE_COLOR[mode] ?? MODE_COLOR.driving } }],
        })
        return
      }

      src.setData({ type: 'FeatureCollection', features: [] })
    }

    if (map.isStyleLoaded()) apply()
    else map.once('style.load', apply)
  }, [route, transitItineraries, selectedItinerary, mode])

  // ── Alternative routes (dimmed) ───────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const apply = () => {
      const src = map.getSource('route-alt')
      if (!src) return
      if (routeAlternatives.length > 1) {
        const features = routeAlternatives
          .filter((_, i) => i !== selectedAlternative)
          .flatMap((alt) => alt.route?.features ?? [])
        src.setData({ type: 'FeatureCollection', features })
      } else {
        src.setData({ type: 'FeatureCollection', features: [] })
      }
    }

    if (map.isStyleLoaded()) apply()
    else map.once('style.load', apply)
  }, [routeAlternatives, selectedAlternative])

  // ── Origin marker ─────────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    markers.current.origin?.remove()
    markers.current.origin = null
    if (origin) {
      markers.current.origin = new maplibregl.Marker({ element: createEl('marker-origin') })
        .setLngLat([origin.lng, origin.lat])
        .addTo(map)
    }
  }, [origin])

  // ── Destination marker ────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    markers.current.destination?.remove()
    markers.current.destination = null
    if (destination) {
      markers.current.destination = new maplibregl.Marker({ element: createEl('marker-destination') })
        .setLngLat([destination.lng, destination.lat])
        .addTo(map)
    }
  }, [destination])

  // ── User location marker ──────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    markers.current.user?.remove()
    markers.current.user = null
    if (userLocation) {
      const el = createUserMarkerEl()
      const { userHeading: h } = useMapStore.getState()
      if (h != null) el.classList.add('has-heading')
      markers.current.user = new maplibregl.Marker({ element: el, rotationAlignment: 'map' })
        .setLngLat([userLocation.lng, userLocation.lat])
        .setRotation(h ?? 0)
        .addTo(map)
      if (followUser) {
        const currentZoom = map.getZoom()
        map.easeTo({
          center: [userLocation.lng, userLocation.lat],
          zoom: currentZoom < 14 ? 15 : currentZoom,
          duration: 600,
        })
      }
    }
  }, [userLocation, followUser])

  // ── Heading: rotate marker cone ───────────────────────────────────────────
  useEffect(() => {
    const marker = markers.current.user
    if (!marker) return
    if (userHeading != null) {
      marker.getElement().classList.add('has-heading')
      marker.setRotation(userHeading)
    } else {
      marker.getElement().classList.remove('has-heading')
    }
  }, [userHeading])

  // ── Heading mode: rotate map ──────────────────────────────────────────────
  useEffect(() => {
    if (!headingMode || userHeading == null) return
    const map = mapRef.current
    if (map) map.easeTo({ bearing: userHeading, duration: 150 })
  }, [userHeading, headingMode])

  // ── Fit bounds when both endpoints set ───────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map || !origin || !destination) return
    const bounds = new maplibregl.LngLatBounds()
      .extend([origin.lng, origin.lat])
      .extend([destination.lng, destination.lat])
    map.fitBounds(bounds, { padding: { top: 80, bottom: 80, left: 420, right: 80 }, maxZoom: 16 })
  }, [origin, destination])

  // ── POI markers from category search ─────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const apply = () => {
      const src = map.getSource('poi')
      if (!src) return
      src.setData({
        type: 'FeatureCollection',
        features: poiResults.map((p) => ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
          properties: { name: p.name },
        })),
      })
    }
    if (map.isStyleLoaded()) apply()
    else map.once('style.load', apply)
  }, [poiResults])

  return <div ref={containerRef} className="absolute inset-0 w-full h-full" />
}
