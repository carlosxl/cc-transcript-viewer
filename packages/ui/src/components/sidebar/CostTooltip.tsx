import type { ReactNode } from 'react'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { fmtK } from '@/lib/format'

export interface CostTokenBreakdown {
  in: number
  out: number
  cc: number
  cr: number
}

interface CostTooltipProps {
  tokens: CostTokenBreakdown
  children: ReactNode
}

/**
 * Hover-tooltip on cost values showing the four token components used in
 * the design's `cost-tip`. Radix Tooltip avoids the manual onMouseEnter
 * state from the prototype and gets keyboard focus + portal behaviour for free.
 */
export function CostTooltip({ tokens, children }: CostTooltipProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span>{children}</span>
      </TooltipTrigger>
      <TooltipContent side="top" className="font-mono text-[10.5px]">
        <Row label="input" val={fmtK(tokens.in)} />
        <Row label="output" val={fmtK(tokens.out)} />
        <Row label="cache create" val={fmtK(tokens.cc)} />
        <Row label="cache read" val={fmtK(tokens.cr)} />
      </TooltipContent>
    </Tooltip>
  )
}

function Row({ label, val }: { label: string; val: string }) {
  return (
    <div className="flex justify-between gap-3 leading-[1.5]">
      <span className="text-[var(--text-2)]">{label}</span>
      <span className="text-[var(--text-0)]">{val}</span>
    </div>
  )
}
