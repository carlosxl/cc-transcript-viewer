export function fmtCost(c: number | null | undefined): string {
  if (c == null || Number.isNaN(c)) return '—'
  if (c === 0) return '$0.00'
  if (c < 0.01) return '<$0.01'
  return `$${c.toFixed(2)}`
}

export function fmtK(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—'
  const abs = Math.abs(n)
  if (abs < 1000) return String(Math.round(n))
  if (abs < 1_000_000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}K`
  return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
}

export function fmtDuration(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms) || ms < 0) return '—'
  if (ms < 1000) return `${Math.round(ms)}ms`
  return `${(ms / 1000).toFixed(2)}s`
}

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

export function fmtRelativeTime(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return '—'
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return '—'
  const diff = Math.max(0, now - t)
  if (diff < MINUTE) return 'just now'
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)}m ago`
  if (diff < DAY) return `${Math.floor(diff / HOUR)}h ago`
  if (diff < 2 * DAY) return 'yesterday'
  if (diff < 7 * DAY) return `${Math.floor(diff / DAY)}d ago`
  return new Date(t).toLocaleDateString()
}

export function shortPreview(s: string, max = 90): string {
  const collapsed = (s ?? '').replace(/\s+/g, ' ').trim()
  if (collapsed.length <= max) return collapsed
  return collapsed.slice(0, max - 1).trimEnd() + '…'
}
