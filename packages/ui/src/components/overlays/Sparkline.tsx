interface SparklineProps {
  data: number[]
  height?: number
  accent?: string
}

export function Sparkline({ data, height = 80, accent = 'var(--accent)' }: SparklineProps) {
  const w = 600
  const h = height
  const pad = 8
  if (data.length === 0) {
    return (
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} preserveAspectRatio="none" />
    )
  }
  const max = Math.max(...data, 0.0001)
  const points = data.map<[number, number]>((v, i) => {
    const x = pad + (i * (w - pad * 2)) / Math.max(1, data.length - 1)
    const y = h - pad - (v / max) * (h - pad * 2)
    return [x, y]
  })
  const path = points
    .map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1))
    .join(' ')
  const areaPath =
    path +
    ` L ${points[points.length - 1][0].toFixed(1)} ${h - pad} L ${points[0][0].toFixed(1)} ${h - pad} Z`
  const gradientId = `spark-fill-${Math.random().toString(36).slice(2, 8)}`
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} preserveAspectRatio="none">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={accent} stopOpacity="0.28" />
          <stop offset="100%" stopColor={accent} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradientId})`} />
      <path d={path} stroke={accent} strokeWidth="1.5" fill="none" />
      {points.map((p, i) => (
        <circle key={i} cx={p[0]} cy={p[1]} r="2.5" fill={accent} />
      ))}
    </svg>
  )
}
