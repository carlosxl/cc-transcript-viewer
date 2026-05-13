import { GitCompare } from 'lucide-react'
import type { DiffSummary, ToolInteraction, ToolUse } from '@cc-viewer/shared'
import { useNavigationStore } from '@/stores/useNavigationStore'
import { useActiveInteractions } from '@/hooks/useActiveInteractions'
import { useInteractionByToolId } from '@/hooks/useInteractionByToolId'
import { cn } from '@/lib/utils'

type Row = { type: 'add' | 'rm' | 'ctx'; text: string }

/**
 * Tiny line-by-line splitter — for Edit-style replacements this is "rm all
 * old lines, add all new lines". For Write it's "add the whole content". For
 * MultiEdit we flatten each sub-edit using the Edit rule.
 *
 * This is intentionally NOT a real diff algorithm. The Phase 2 projection
 * only stores `added` / `removed` line counts; producing a true unified
 * diff (LCS) is out of scope here. The visual still communicates "this
 * code went, that code came in", which is the design's intent.
 */
function buildRows(toolName: string, input: Record<string, unknown>): Row[] {
  const str = (k: string): string => (typeof input[k] === 'string' ? (input[k] as string) : '')
  const linesOf = (s: string): string[] => (s.length === 0 ? [] : s.split('\n'))

  if (toolName === 'Write') {
    return linesOf(str('content')).map((text) => ({ type: 'add' as const, text }))
  }
  if (toolName === 'Edit') {
    return [
      ...linesOf(str('old_string')).map((text) => ({ type: 'rm' as const, text })),
      ...linesOf(str('new_string')).map((text) => ({ type: 'add' as const, text })),
    ]
  }
  if (toolName === 'MultiEdit') {
    const edits = Array.isArray(input.edits) ? (input.edits as Array<Record<string, unknown>>) : []
    const out: Row[] = []
    for (const e of edits) {
      const o = typeof e.old_string === 'string' ? e.old_string : ''
      const n = typeof e.new_string === 'string' ? e.new_string : ''
      out.push(...linesOf(o).map((text) => ({ type: 'rm' as const, text })))
      out.push(...linesOf(n).map((text) => ({ type: 'add' as const, text })))
    }
    return out
  }
  if (toolName === 'NotebookEdit') {
    return linesOf(str('new_source')).map((text) => ({ type: 'add' as const, text }))
  }
  return []
}

interface DiffViewProps {
  /** Diff summary (file path + counts). */
  diff: DiffSummary
  /** Tool name that produced the diff — drives the rm/add row splitter. */
  toolName: string
  /** Raw ToolUse.input — read for `old_string` / `new_string` / `content`. */
  input: Record<string, unknown>
  /** Cap on visible rows; everything else scrolls inside `max-h-64`. */
  maxHeight?: string
}

/**
 * Presentational diff renderer. No store reads, no click handlers. Both the
 * inline `DiffBlock` (selection-aware capsule peer) and the Inspector's
 * `DiffTab` render this same view.
 */
export function DiffView({ diff, toolName, input, maxHeight = 'max-h-64' }: DiffViewProps) {
  const rows = buildRows(toolName, input)
  return (
    <div className="overflow-hidden rounded-md border border-[var(--code-border)] bg-[var(--code-bg)]">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-[var(--code-border)] bg-[var(--surface-2)]">
        <div className="flex items-center gap-2 min-w-0">
          <GitCompare className="w-3 h-3 text-muted-foreground flex-shrink-0" aria-hidden="true" />
          <span className="font-mono text-[11px] text-foreground truncate">
            {diff.filePath}
          </span>
        </div>
        <div className="flex gap-2 font-mono text-[11px] flex-shrink-0">
          <span className="text-[var(--diff-add-text)]">+{diff.added}</span>
          <span className="text-[var(--diff-rm-text)]">−{diff.removed}</span>
        </div>
      </div>
      <div className={cn('font-mono text-xs leading-snug overflow-auto', maxHeight)}>
        {rows.map((row, i) => {
          const bg =
            row.type === 'add' ? 'bg-[var(--diff-add-bg)]'
            : row.type === 'rm' ? 'bg-[var(--diff-rm-bg)]'
            : 'bg-transparent'
          const fg =
            row.type === 'add' ? 'text-[var(--diff-add-text)]'
            : row.type === 'rm' ? 'text-[var(--diff-rm-text)]'
            : 'text-[var(--code-text)]'
          const marker = row.type === 'add' ? '+' : row.type === 'rm' ? '−' : ' '
          return (
            <div key={i} className={cn('flex', bg, fg)}>
              <div className="w-5 text-center text-muted-foreground select-none flex-shrink-0">{marker}</div>
              <div className="px-2 whitespace-pre overflow-hidden flex-1">{row.text || '\u00A0'}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

interface DiffBlockProps {
  interaction: ToolInteraction
  toolUse: ToolUse
}

/** Selection-aware wrapper around DiffView. Click selects the same interaction the capsule selects. */
export function DiffBlock({ interaction, toolUse }: DiffBlockProps) {
  const selectedId = useNavigationStore((s) => s.selectedInteractionId)
  const setSelected = useNavigationStore((s) => s.setSelectedInteractionId)
  const isSelected = selectedId === interaction.id

  const diff = interaction.diff
  if (!diff) return <></>

  return (
    <div
      className={cn(
        'overflow-hidden rounded-md cursor-pointer',
        isSelected && 'ring-2 ring-primary/20 outline outline-1 outline-primary',
      )}
      onClick={() => setSelected(interaction.id)}
      data-interaction-id={interaction.id}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          setSelected(interaction.id)
        }
      }}
    >
      <DiffView diff={diff} toolName={toolUse.name} input={toolUse.input} />
    </div>
  )
}

/**
 * Flat-node adapter. Looks the interaction + tool use up from the active
 * detail response so callers don't have to.
 */
export function DiffBlockRow({
  turn,
  toolUseId,
}: {
  turn: { toolUses: ToolUse[] }
  toolUseId: string
}) {
  const interactions = useActiveInteractions()
  const byId = useInteractionByToolId(interactions)
  const interaction = byId.get(toolUseId)
  const tu = turn.toolUses.find((u) => u.id === toolUseId)
  if (!interaction || !tu || !interaction.diff) return <></>
  return (
    <div className="px-4 pb-2 pt-0">
      <DiffBlock interaction={interaction} toolUse={tu} />
    </div>
  )
}
