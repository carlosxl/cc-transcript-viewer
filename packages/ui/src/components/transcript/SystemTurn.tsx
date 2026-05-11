import { Terminal } from 'lucide-react'
import type { Turn } from '@cc-viewer/shared'

export function SystemTurn({ turn }: { turn: Turn }) {
  const text = turn.textBlocks.join('\n\n')
  return (
    <div className="px-4 py-2 border-b border-border bg-muted/30" data-role="system" data-turn-uuid={turn.uuid}>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Terminal className="w-4 h-4" aria-hidden="true" />
        <span className="font-semibold">System</span>
        <span className="font-mono truncate flex-1">{text.slice(0, 200)}</span>
      </div>
    </div>
  )
}
