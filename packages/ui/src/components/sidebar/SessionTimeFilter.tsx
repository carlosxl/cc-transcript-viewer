export type TimeWindow = 'all' | '1d' | '2d' | '7d' | '30d'

const OPTIONS: { value: TimeWindow; label: string }[] = [
  { value: '1d', label: 'Last 24 hours' },
  { value: '2d', label: 'Last 2 days' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: 'all', label: 'All time' },
]

const DAY_MS = 24 * 60 * 60 * 1000

/** Milliseconds covered by a window, or null for "all time" (no filtering). */
export function windowMs(w: TimeWindow): number | null {
  switch (w) {
    case '1d':
      return DAY_MS
    case '2d':
      return 2 * DAY_MS
    case '7d':
      return 7 * DAY_MS
    case '30d':
      return 30 * DAY_MS
    case 'all':
      return null
  }
}

export function SessionTimeFilter({
  value,
  onChange,
}: {
  value: TimeWindow
  onChange: (w: TimeWindow) => void
}) {
  return (
    <label className="mx-2.5 mb-2.5 flex items-center gap-2 font-mono text-[10.5px] text-[var(--text-3)]">
      <span className="uppercase" style={{ letterSpacing: '0.05em' }}>
        Since
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as TimeWindow)}
        className="flex-1 cursor-pointer rounded-sm border border-[var(--border-1)] bg-[var(--surface-2)] px-2 py-1 text-[11px] text-[var(--text-2)] transition-colors hover:border-[var(--border-2)] hover:text-[var(--text-1)]"
      >
        {OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}
