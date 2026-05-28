/**
 * Degraded card for rows the schema didn't recognise (007-ui-information-revamp,
 * FR-007 / SC-009).
 *
 * Renders a clearly-flagged warning header carrying the raw `type` field plus
 * a pretty-printed JSON dump so a future Claude Code row variant is still
 * visible — never silently dropped.
 */
import type { UnknownRow } from '@/lib/types'

interface UnknownRowCardProps {
  row: UnknownRow
}

export function UnknownRowCard({ row }: UnknownRowCardProps) {
  const raw = row.raw as Record<string, unknown> | null
  const rowType = typeof raw?.type === 'string' ? raw.type : '(missing type)'
  const json = safeStringify(raw)

  return (
    <div
      role="region"
      aria-label="Unknown row"
      className="my-2 rounded-md border border-amber-400/60 bg-amber-50/40 dark:border-amber-500/40 dark:bg-amber-900/10 p-3 text-sm"
    >
      <header className="flex items-center justify-between gap-2 mb-2">
        <span className="font-mono text-amber-700 dark:text-amber-300">
          ⚠ unknown row
        </span>
        <span className="font-mono text-xs text-amber-700/70 dark:text-amber-300/70">
          type: {rowType}
        </span>
      </header>
      <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words font-mono text-xs text-amber-950 dark:text-amber-100">
        {json}
      </pre>
    </div>
  )
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}
