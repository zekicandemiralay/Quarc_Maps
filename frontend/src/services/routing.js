const API = import.meta.env.VITE_API_URL ?? '/api'

export async function calculateRoute(origin, destination, mode, transitOptions = {}) {
  const res = await fetch(`${API}/route`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ origin, destination, mode, ...transitOptions }),
  })

  const data = await res.json().catch(() => ({}))

  // 202 = transit data is being downloaded/built for this area
  if (res.status === 202) return { _loading: true, ...data }

  if (!res.ok) throw new Error(data.message || `Routing failed (${res.status})`)

  return data
}
