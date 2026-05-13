import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface MetricChipProps {
  label: string
  value: ReactNode
  tone?: 'default' | 'accent'
  title?: string
}

/**
 * Compact mono metric chip in the transcript header (Phase 3).
 * Matches the Messages / Tokens / Model trio from workspace-app.jsx.
 */
export function MetricChip({ label, value, tone = 'default', title }: MetricChipProps) {
  return (
    <span
      role="group"
      title={title}
      className={cn(
        'inline-flex items-center gap-1.5 h-7 rounded-sm border border-border bg-card px-2 text-xs',
        'cursor-default',
      )}
    >
      <span className="text-muted-foreground uppercase tracking-wide text-[10px] font-semibold">
        {label}
      </span>
      <span
        className={cn(
          'font-mono text-xs',
          tone === 'accent' ? 'text-primary font-semibold' : 'text-foreground font-medium',
        )}
      >
        {value}
      </span>
    </span>
  )
}
