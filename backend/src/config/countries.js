// European countries + Turkey: bbox, Geofabrik path, timezone, geographic centre.
// bbox: [minLon, minLat, maxLon, maxLat]
// Array is sorted smallest-area-first so latLngToCountry picks the most-specific
// match when bounding boxes overlap (e.g. Luxembourg wins inside DE/FR/BE).

export const EUROPE = [
  // ── Micro / small ────────────────────────────────────────────────────────────
  { cc: 'LU', name: 'Luxembourg',     tz: 'Europe/Luxembourg', geofabrik: 'europe/luxembourg',                   center: [49.8,  6.1], bbox: [ 5.73, 49.44,  6.53, 50.18] },
  { cc: 'SI', name: 'Slovenia',       tz: 'Europe/Ljubljana',  geofabrik: 'europe/slovenia',                     center: [46.1, 14.9], bbox: [13.38, 45.42, 16.60, 46.88] },
  { cc: 'ME', name: 'Montenegro',     tz: 'Europe/Podgorica',  geofabrik: 'europe/montenegro',                   center: [42.8, 19.5], bbox: [18.45, 41.85, 20.36, 43.56] },
  { cc: 'MK', name: 'N. Macedonia',   tz: 'Europe/Skopje',     geofabrik: 'europe/north-macedonia',              center: [41.6, 21.7], bbox: [20.45, 40.85, 22.75, 42.37] },
  { cc: 'SK', name: 'Slovakia',       tz: 'Europe/Bratislava', geofabrik: 'europe/slovakia',                     center: [48.7, 19.7], bbox: [16.83, 47.73, 22.57, 49.61] },
  { cc: 'CH', name: 'Switzerland',    tz: 'Europe/Zurich',     geofabrik: 'europe/switzerland',                  center: [46.8,  8.2], bbox: [ 5.96, 45.82, 10.49, 47.81] },
  { cc: 'NL', name: 'Netherlands',    tz: 'Europe/Amsterdam',  geofabrik: 'europe/netherlands',                  center: [52.4,  5.3], bbox: [ 3.36, 50.75,  7.23, 53.56] },
  { cc: 'BE', name: 'Belgium',        tz: 'Europe/Brussels',   geofabrik: 'europe/belgium',                      center: [50.5,  4.5], bbox: [ 2.54, 49.50,  6.40, 51.50] },
  { cc: 'IE', name: 'Ireland',        tz: 'Europe/Dublin',     geofabrik: 'europe/ireland-and-northern-ireland', center: [53.1, -8.0], bbox: [-10.47, 51.44, -6.01, 55.38] },
  { cc: 'DK', name: 'Denmark',        tz: 'Europe/Copenhagen', geofabrik: 'europe/denmark',                      center: [56.0, 10.0], bbox: [ 8.07, 54.56, 15.20, 57.75] },
  { cc: 'EE', name: 'Estonia',        tz: 'Europe/Tallinn',    geofabrik: 'europe/estonia',                      center: [58.5, 25.0], bbox: [21.83, 57.51, 28.21, 59.68] },
  { cc: 'LV', name: 'Latvia',         tz: 'Europe/Riga',       geofabrik: 'europe/latvia',                       center: [56.9, 24.6], bbox: [20.97, 55.67, 28.24, 57.75] },
  { cc: 'LT', name: 'Lithuania',      tz: 'Europe/Vilnius',    geofabrik: 'europe/lithuania',                    center: [55.9, 23.9], bbox: [20.94, 53.89, 26.84, 56.45] },
  { cc: 'PT', name: 'Portugal',       tz: 'Europe/Lisbon',     geofabrik: 'europe/portugal',                     center: [39.6, -8.0], bbox: [-9.53, 36.84, -6.19, 42.15] },
  { cc: 'HU', name: 'Hungary',        tz: 'Europe/Budapest',   geofabrik: 'europe/hungary',                      center: [47.2, 19.5], bbox: [16.11, 45.74, 22.90, 48.59] },
  { cc: 'AT', name: 'Austria',        tz: 'Europe/Vienna',     geofabrik: 'europe/austria',                      center: [47.5, 14.5], bbox: [ 9.53, 46.37, 17.16, 49.02] },
  { cc: 'AL', name: 'Albania',        tz: 'Europe/Tirane',     geofabrik: 'europe/albania',                      center: [41.0, 20.0], bbox: [19.27, 39.62, 21.07, 42.67] },
  { cc: 'BA', name: 'Bosnia',         tz: 'Europe/Sarajevo',   geofabrik: 'europe/bosnia-herzegovina',           center: [44.0, 17.5], bbox: [15.74, 42.56, 19.62, 45.28] },
  { cc: 'HR', name: 'Croatia',        tz: 'Europe/Zagreb',     geofabrik: 'europe/croatia',                      center: [45.1, 16.5], bbox: [13.49, 42.38, 19.45, 46.56] },
  { cc: 'CZ', name: 'Czech Republic', tz: 'Europe/Prague',     geofabrik: 'europe/czech-republic',               center: [49.8, 15.5], bbox: [12.09, 48.55, 18.86, 51.06] },
  { cc: 'MD', name: 'Moldova',        tz: 'Europe/Chisinau',   geofabrik: 'europe/moldova',                      center: [47.4, 28.4], bbox: [26.62, 45.47, 30.16, 48.49] },
  { cc: 'GR', name: 'Greece',         tz: 'Europe/Athens',     geofabrik: 'europe/greece',                       center: [39.0, 22.0], bbox: [19.37, 34.80, 28.24, 41.75] },
  { cc: 'RS', name: 'Serbia',         tz: 'Europe/Belgrade',   geofabrik: 'europe/serbia',                       center: [44.0, 21.0], bbox: [18.84, 42.23, 22.99, 46.19] },
  { cc: 'BG', name: 'Bulgaria',       tz: 'Europe/Sofia',      geofabrik: 'europe/bulgaria',                     center: [42.8, 25.5], bbox: [22.37, 41.24, 28.61, 44.23] },
  { cc: 'RO', name: 'Romania',        tz: 'Europe/Bucharest',  geofabrik: 'europe/romania',                      center: [45.8, 24.9], bbox: [20.26, 43.62, 29.74, 48.27] },
  // ── Medium ───────────────────────────────────────────────────────────────────
  { cc: 'BY', name: 'Belarus',        tz: 'Europe/Minsk',      geofabrik: 'europe/belarus',                      center: [53.5, 28.0], bbox: [23.18, 51.26, 32.78, 56.17] },
  { cc: 'PL', name: 'Poland',         tz: 'Europe/Warsaw',     geofabrik: 'europe/poland',                       center: [52.0, 19.5], bbox: [14.12, 49.00, 24.15, 54.84] },
  { cc: 'DE', name: 'Germany',        tz: 'Europe/Berlin',     geofabrik: 'europe/germany',                      center: [51.0, 10.5], bbox: [ 5.87, 47.27, 15.04, 55.06] },
  { cc: 'IT', name: 'Italy',          tz: 'Europe/Rome',       geofabrik: 'europe/italy',                        center: [42.8, 12.8], bbox: [ 6.63, 36.65, 18.52, 47.10] },
  { cc: 'ES', name: 'Spain',          tz: 'Europe/Madrid',     geofabrik: 'europe/spain',                        center: [40.4, -3.7], bbox: [-9.30, 35.86,  4.33, 43.79] },
  { cc: 'GB', name: 'United Kingdom', tz: 'Europe/London',     geofabrik: 'europe/great-britain',                center: [54.0, -2.0], bbox: [-8.65, 49.86,  1.76, 60.86] },
  { cc: 'FR', name: 'France',         tz: 'Europe/Paris',      geofabrik: 'europe/france',                       center: [46.2,  2.2], bbox: [-5.14, 41.33,  9.56, 51.09] },
  { cc: 'UA', name: 'Ukraine',        tz: 'Europe/Kyiv',       geofabrik: 'europe/ukraine',                      center: [49.0, 31.0], bbox: [22.13, 44.39, 40.23, 52.38] },
  // ── Large / Nordic ───────────────────────────────────────────────────────────
  { cc: 'SE', name: 'Sweden',         tz: 'Europe/Stockholm',  geofabrik: 'europe/sweden',                       center: [62.0, 15.0], bbox: [10.96, 55.34, 24.17, 69.06] },
  { cc: 'NO', name: 'Norway',         tz: 'Europe/Oslo',       geofabrik: 'europe/norway',                       center: [65.0, 14.0], bbox: [ 4.64, 57.97, 31.06, 71.18] },
  { cc: 'FI', name: 'Finland',        tz: 'Europe/Helsinki',   geofabrik: 'europe/finland',                      center: [64.0, 26.0], bbox: [19.09, 59.81, 31.59, 70.09] },
  { cc: 'TR', name: 'Turkey',         tz: 'Europe/Istanbul',   geofabrik: 'europe/turkey',                       center: [39.0, 35.0], bbox: [25.67, 35.82, 44.83, 42.11] },
]

// O(1) lookup by country code
export const COUNTRY_BY_CC = Object.fromEntries(EUROPE.map(c => [c.cc, c]))

// Sorted by bbox area so smaller countries are matched first (micro-states beat large neighbours)
const _byArea = [...EUROPE].sort((a, b) => {
  const area = c => (c.bbox[2] - c.bbox[0]) * (c.bbox[3] - c.bbox[1])
  return area(a) - area(b)
})

// Returns ISO 3166-1 alpha-2 country code if (lat, lng) is inside a known European bbox,
// or null for locations outside Europe / Turkey.
export function latLngToCountry(lat, lng) {
  for (const c of _byArea) {
    const [minLon, minLat, maxLon, maxLat] = c.bbox
    if (lat >= minLat && lat <= maxLat && lng >= minLon && lng <= maxLon) return c.cc
  }
  return null
}
