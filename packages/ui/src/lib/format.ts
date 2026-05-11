/** D-15: collapse content longer than this. Single tunable constant per D-39. */
export const COLLAPSE_THRESHOLD = { lines: 20, chars: 1500 } as const

const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 })

/** UI-SPEC §"Copywriting Contract": numbers ≥1000 abbreviated; <1000 as-is. */
export function compactNumber(n: number): string {
  if (n < 1000) return String(n)
  return compact.format(n)
}

const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
const UNITS: ReadonlyArray<readonly [Intl.RelativeTimeFormatUnit, number]> = [
  ['year',   60 * 60 * 24 * 365],
  ['month',  60 * 60 * 24 * 30],
  ['day',    60 * 60 * 24],
  ['hour',   60 * 60],
  ['minute', 60],
  ['second', 1],
]

/** D-22 sidebar relative timestamp ("3m ago"). */
export function relativeTime(iso: string): string {
  if (!iso) return ''
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return ''
  const diffSeconds = (Date.now() - t) / 1000
  for (const [unit, secs] of UNITS) {
    if (Math.abs(diffSeconds) >= secs || unit === 'second') {
      return rtf.format(-Math.round(diffSeconds / secs), unit)
    }
  }
  return ''
}

// ─── Token badge helpers (Plan 02-09, VIEW-08) ───────────────────────────────

/**
 * Abbreviate a non-negative integer to one decimal in k/m/b.
 * UI-SPEC §"Copywriting Contract": numbers ≥1000 abbreviated with one decimal;
 * numbers <1000 shown as-is.
 *
 * Examples: 999 → "999", 1000 → "1.0k", 12438 → "12.4k", 1_500_000 → "1.5m"
 */
export function abbreviateInt(n: number): string {
  if (!Number.isFinite(n) || n < 0) return '0'
  if (n < 1000)            return String(Math.trunc(n))
  if (n < 1_000_000)       return `${(n / 1000).toFixed(1)}k`
  if (n < 1_000_000_000)   return `${(n / 1_000_000).toFixed(1)}m`
  return `${(n / 1_000_000_000).toFixed(1)}b`
}

/** Exact integer with thousands separators (used in tooltips). */
export function formatExactInt(n: number): string {
  return new Intl.NumberFormat('en-US').format(Math.trunc(n))
}

/** Full ISO-8601 string for popover display. */
export function formatTimestampExact(iso: string): string {
  // ISO is already display-ready; swap later for locale-aware formatting if needed.
  return iso
}

/**
 * Compact per-turn timestamp shown in the transcript header strip. Uses local
 * time. Same calendar day as `now` → `HH:MM:SS`; otherwise `MMM D · HH:MM:SS`
 * so a multi-day session reads unambiguously without overflowing the row.
 * Returns '' for empty/invalid input so the caller can simply omit the element.
 */
export function formatTurnTimestamp(iso: string, now: Date = new Date()): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  const hms = d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
  if (sameDay) return hms
  const md = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return `${md} · ${hms}`
}

/**
 * Relative time for header badge (distinct from relativeTime which uses Intl.RelativeTimeFormat).
 * Returns short-form strings: "3m ago", "2h ago", "yesterday", "3d ago", etc.
 * Accepts an optional `now` parameter for deterministic testing.
 */
export function formatTimestampRelative(iso: string, now: Date = new Date()): string {
  const t = new Date(iso).getTime()
  const dms = now.getTime() - t
  if (Number.isNaN(dms)) return 'unknown'
  const s = Math.max(0, Math.floor(dms / 1000))
  if (s < 60)    return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60)    return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24)    return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d === 1)   return 'yesterday'
  if (d < 30)    return `${d}d ago`
  const mo = Math.floor(d / 30)
  if (mo < 12)   return `${mo}mo ago`
  const y = Math.floor(d / 365)
  return `${y}y ago`
}
