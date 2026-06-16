import { create } from 'zustand'

const stored = (key, fallback) => {
  try { return localStorage.getItem(key) ?? fallback } catch { return fallback }
}

const storedJson = (key, fallback) => {
  try { return JSON.parse(localStorage.getItem(key) ?? 'null') ?? fallback } catch { return fallback }
}

// Read last GPS-confirmed position so map opens there instead of Munich default
const lastPos = storedJson('sm-lastpos', null)

export const useMapStore = create((set, get) => ({
  // ── Theme & Map Type ─────────────────────────────────────────────────────
  theme:   stored('sm-theme', 'dark'),
  mapType: stored('sm-maptype', 'streets'), // streets | satellite | outdoor | winter

  setTheme: (theme) => {
    try { localStorage.setItem('sm-theme', theme) } catch {}
    set({ theme })
  },
  setMapType: (mapType) => {
    try { localStorage.setItem('sm-maptype', mapType) } catch {}
    set({ mapType })
  },

  // ── Map View ─────────────────────────────────────────────────────────────
  center: lastPos ? [lastPos.lng, lastPos.lat] : [11.576, 48.137],
  zoom:   lastPos ? (lastPos.zoom ?? 13) : 12,
  setCenter: (center) => set({ center }),
  setZoom: (zoom) => set({ zoom }),

  // ── Routing Inputs ───────────────────────────────────────────────────────
  origin: null,
  destination: null,
  mode: 'driving',

  setOrigin: (origin) => set({ origin }),
  setDestination: (destination) => set({ destination }),
  setMode: (mode) => set({ mode, route: null, routeAlternatives: [], selectedAlternative: 0, transitItineraries: [], steps: [] }),
  swapEndpoints: () => set((s) => ({ origin: s.destination, destination: s.origin })),

  // ── Route Result ─────────────────────────────────────────────────────────
  route: null,
  steps: [],
  duration: null,
  distance: null,
  transitItineraries: [],
  selectedItinerary: 0,

  // Route alternatives (for driving/cycling/walking)
  routeAlternatives: [],   // [{ route, steps, duration, distance }]
  selectedAlternative: 0,

  setRoute: (route, steps, duration, distance) =>
    set({ route, steps, duration, distance, routeAlternatives: [], selectedAlternative: 0, transitItineraries: [], isLoading: false }),

  setRouteWithAlternatives: (alternatives, primarySteps) => {
    if (!alternatives?.length) return
    const primary = alternatives[0]
    set({
      route: primary.route,
      steps: primary.steps ?? primarySteps ?? [],
      duration: primary.duration,
      distance: primary.distance,
      routeAlternatives: alternatives,
      selectedAlternative: 0,
      transitItineraries: [],
      isLoading: false,
    })
  },

  selectAlternative: (index) => set((s) => {
    const alt = s.routeAlternatives[index]
    if (!alt) return {}
    return {
      selectedAlternative: index,
      route: alt.route,
      steps: alt.steps,
      duration: alt.duration,
      distance: alt.distance,
    }
  }),

  setTransitItineraries: (itineraries) =>
    set({ transitItineraries: Array.isArray(itineraries) ? itineraries : [], selectedItinerary: 0, route: null, routeAlternatives: [], isLoading: false }),

  selectItinerary: (index) => set({ selectedItinerary: index }),

  clearRoute: () => {
    const { mapRef: m } = get()
    m?.getSource?.('poi')?.setData?.({ type: 'FeatureCollection', features: [] })
    set({
      route: null, steps: [], duration: null, distance: null,
      transitItineraries: [], selectedItinerary: 0,
      routeAlternatives: [], selectedAlternative: 0,
      error: null,
      poiResults: [], poiCategory: null, poiCategoryKey: null, showSearchHere: false,
    })
  },

  // ── Saved Places ─────────────────────────────────────────────────────────
  savedPlaces: storedJson('sm-saved', []),

  savePlace: (place) => set((s) => {
    const entry = { name: place.name, lat: place.lat, lng: place.lng, subtitle: place.subtitle || '' }
    const saved = [entry, ...s.savedPlaces.filter((p) => p.name !== place.name)]
    try { localStorage.setItem('sm-saved', JSON.stringify(saved)) } catch {}
    return { savedPlaces: saved }
  }),

  unsavePlace: (name) => set((s) => {
    const saved = s.savedPlaces.filter((p) => p.name !== name)
    try { localStorage.setItem('sm-saved', JSON.stringify(saved)) } catch {}
    return { savedPlaces: saved }
  }),

  isSaved: (name) => get().savedPlaces.some((p) => p.name === name),

  // ── User Location ────────────────────────────────────────────────────────
  userLocation: null,
  followUser: false,
  userHeading: null,
  headingMode: false,
  setUserLocation: (loc) => {
    // Persist so the map opens here next session instead of the Munich default
    try { localStorage.setItem('sm-lastpos', JSON.stringify({ lat: loc.lat, lng: loc.lng, zoom: 14 })) } catch {}
    set({ userLocation: loc })
  },
  setFollowUser: (v) => set({ followUser: v }),
  setUserHeading: (h) => set({ userHeading: h }),
  setHeadingMode: (v) => set({ headingMode: v }),

  // ── Selected POI (place card) ────────────────────────────────────────────
  selectedPOI: null,  // { name, subtitle, lat, lng, stars, cuisine, opening_hours, website, phone }
  setSelectedPOI: (poi) => set({ selectedPOI: poi }),
  clearSelectedPOI: () => set({ selectedPOI: null }),

  // ── UI State ─────────────────────────────────────────────────────────────
  sidebarMode: 'search',   // search | directions
  isLoading: false,
  error: null,
  contextMenu: null,
  mapRef: null,

  setSidebarMode: (mode) => set({ sidebarMode: mode }),
  setLoading: (v) => set({ isLoading: v }),
  setError: (error) => set({ error, isLoading: false }),
  setContextMenu: (menu) => set({ contextMenu: menu }),
  setMapRef: (ref) => set({ mapRef: ref }),

  // ── POI Results (category chip search) ───────────────────────────────────
  poiResults: [],        // [{ name, subtitle, lat, lng, stars? }]
  poiCategory: null,     // label shown in UI
  poiCategoryKey: null,  // API key for re-search
  showSearchHere: false, // show "Search this area" button after map pan

  setPoiResults: (results, category, categoryKey = null) =>
    set({ poiResults: results, poiCategory: category, poiCategoryKey: categoryKey, showSearchHere: false }),

  setShowSearchHere: (v) => set({ showSearchHere: v }),

  clearPoiResults: () => {
    // Immediately clear the GeoJSON source on the map (don't wait for React effect)
    const { mapRef: m } = get()
    m?.getSource?.('poi')?.setData?.({ type: 'FeatureCollection', features: [] })
    set({ poiResults: [], poiCategory: null, poiCategoryKey: null, showSearchHere: false })
  },

  // ── Toast ────────────────────────────────────────────────────────────────
  toast: null,
  showToast: (msg, type = 'success') => {
    set({ toast: { msg, type } })
    setTimeout(() => set((s) => s.toast?.msg === msg ? { toast: null } : {}), 2500)
  },

  // ── Clear everything — back to blank map ─────────────────────────────────
  clearAll: () => {
    // Directly clear the map's POI source so dots vanish immediately
    const { mapRef: m } = get()
    m?.getSource?.('poi')?.setData?.({ type: 'FeatureCollection', features: [] })
    set({
      origin: null, destination: null,
      route: null, steps: [], duration: null, distance: null,
      transitItineraries: [], selectedItinerary: 0,
      routeAlternatives: [], selectedAlternative: 0,
      poiResults: [], poiCategory: null, poiCategoryKey: null,
      showSearchHere: false,
      selectedPOI: null,
      sidebarMode: 'search',
      error: null, isLoading: false,
    })
  },

  // ── Actions ──────────────────────────────────────────────────────────────
  startDirections: (from, to) => set({
    origin: from,
    destination: to,
    sidebarMode: 'directions',
    route: null, steps: [], routeAlternatives: [], transitItineraries: [], error: null,
  }),

  flyTo: (center, zoom = 15) => {
    const { mapRef } = get()
    if (mapRef) mapRef.flyTo({ center, zoom, speed: 1.2 })
  },
}))
