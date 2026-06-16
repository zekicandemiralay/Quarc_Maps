export default function ElevationProfile({ route }) {
  if (!route?.features?.[0]) return null

  const coords = route.features[0].geometry.coordinates
  // Only render if elevation data present (3D coordinates)
  if (!Array.isArray(coords?.[0]) || coords[0].length < 3 || coords[0][2] == null) return null

  // Compute cumulative distance + elevation pairs
  let totalDist = 0
  const pts = coords.map((c, i) => {
    if (i > 0) {
      const p  = coords[i - 1]
      const dx = (c[0] - p[0]) * 111320 * Math.cos(c[1] * Math.PI / 180)
      const dy = (c[1] - p[1]) * 110540
      totalDist += Math.sqrt(dx * dx + dy * dy)
    }
    return { dist: totalDist, ele: c[2] }
  })

  if (totalDist === 0) return null

  const eles   = pts.map((p) => p.ele)
  const minEle = Math.min(...eles)
  const maxEle = Math.max(...eles)
  const range  = maxEle - minEle || 1

  // Gain / loss
  let gain = 0, loss = 0
  for (let i = 1; i < pts.length; i++) {
    const diff = pts[i].ele - pts[i - 1].ele
    if (diff > 0) gain += diff
    else loss += Math.abs(diff)
  }

  const W = 300, H = 56, PAD = 4

  const toX = (dist) => (dist / totalDist) * W
  const toY = (ele)  => H - PAD - ((ele - minEle) / range) * (H - PAD * 2)

  const pathD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${toX(p.dist).toFixed(1)},${toY(p.ele).toFixed(1)}`).join(' ')
  const fillD = `${pathD} L${W},${H} L0,${H} Z`

  return (
    <div className="px-4 py-3 border-b border-border dark:border-border-dark">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-txt-secondary dark:text-txt-secondary-dark uppercase tracking-wide">
          Elevation
        </span>
        <div className="flex gap-3 text-xs text-txt-secondary dark:text-txt-secondary-dark">
          {gain > 1 && <span className="text-emerald-600 dark:text-emerald-400">↑ {Math.round(gain)}m</span>}
          {loss > 1 && <span className="text-red-500 dark:text-red-400">↓ {Math.round(loss)}m</span>}
          <span>{Math.round(minEle)}–{Math.round(maxEle)}m</span>
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-14" preserveAspectRatio="none">
        <defs>
          <linearGradient id="eleGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#3B82F6" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#3B82F6" stopOpacity="0.04" />
          </linearGradient>
        </defs>
        <path d={fillD} fill="url(#eleGrad)" />
        <path d={pathD} fill="none" stroke="#3B82F6" strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
    </div>
  )
}
