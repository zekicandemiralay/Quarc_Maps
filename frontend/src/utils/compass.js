import { useMapStore } from '../store/mapStore'

let tracking = false

export function startCompassTracking() {
  if (tracking) return
  tracking = true
  window.addEventListener('deviceorientation', (e) => {
    const h = e.webkitCompassHeading ?? (e.alpha != null ? (360 - e.alpha) % 360 : null)
    if (h != null) useMapStore.getState().setUserHeading(Math.round(h))
  }, true)
}

// Call once from a user-gesture context (required by iOS).
// Returns true if granted / not needed.
export async function requestCompassPermission() {
  if (typeof DeviceOrientationEvent === 'undefined') return false
  if (typeof DeviceOrientationEvent.requestPermission !== 'function') {
    // Android / desktop — no permission dialog needed
    startCompassTracking()
    return true
  }
  try {
    const perm = await DeviceOrientationEvent.requestPermission()
    if (perm === 'granted') { startCompassTracking(); return true }
  } catch {}
  return false
}
